import { getSelectedProject } from '../core/projectManager.js';
import { saveProjects } from '../core/storage.js';
import { state } from '../core/state.js';
import { createId } from '../utils/id.js';
import {
  getStoryboardHistory,
  pushStoryboardHistory,
  undoStoryboard
} from './storyboardHistory.js';
import { loadAsset, removeAsset, saveAsset } from '../core/assetStore.js';

let isInitialized = false;
let elements = {};
let toastTimer = null;
const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_JPEG_QUALITY = 0.82;

const EDITABLE_FIELDS = new Set([
  'title',
  'description',
  'narration',
  'sfx',
  'vfx',
  'duration',
  'imagePrompt',
  'videoPrompt'
]);

function getElements() {
  return {
    addButton: document.getElementById('addStoryboardCutButton'),
    undoButton: document.getElementById('undoStoryboardButton'),
    history: document.getElementById('storyboardHistory'),
    previewSize: document.getElementById('storyboardPreviewSize'),
    list: document.getElementById('storyboardList'),
    toast: document.getElementById('overviewToast'),
    imageViewer: document.getElementById('imageViewer'),
    imageViewerImage: document.getElementById('imageViewerImage'),
    imageViewerTitle: document.getElementById('imageViewerTitle')
  };
}

function createCut(source = {}) {
  const now = new Date().toISOString();

  return {
    id: createId('cut'),
    sceneNumber: 1,
    title: source.title || '',
    description: source.description || '',
    narration: source.narration || '',
    sfx: source.sfx || '',
    vfx: source.vfx || '',
    duration: Number.isFinite(Number(source.duration)) ? Number(source.duration) : 5,
    imagePrompt: source.imagePrompt || '',
    videoPrompt: source.videoPrompt || '',
    imageAsset: source.imageAsset ? { ...source.imageAsset } : null,
    createdAt: now,
    updatedAt: now,
    updatedBy: 'local-user'
  };
}

function normalizeStoryboard(storyboard) {
  return storyboard.map((cut, index) => ({
    ...cut,
    sceneNumber: index + 1
  }));
}

function showToast(message = '저장되었습니다.') {
  if (!elements.toast) {
    return;
  }

  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }

  elements.toast.textContent = message;
  elements.toast.classList.remove('is-visible');
  window.requestAnimationFrame(() => elements.toast.classList.add('is-visible'));
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove('is-visible');
  }, 2000);
}

function commitStoryboard(nextStoryboard, shouldRender = true, historyLabel = '스토리보드 수정', recordHistory = true) {
  const project = getSelectedProject();
  if (!project) {
    return false;
  }

  const previousStoryboard = project.storyboard;
  const previousHistory = project.storyboardHistory;
  if (recordHistory) {
    pushStoryboardHistory(project, historyLabel);
  }
  project.storyboard = normalizeStoryboard(nextStoryboard);

  if (!saveProjects(state.projects)) {
    project.storyboard = previousStoryboard;
    project.storyboardHistory = previousHistory;
    if (shouldRender) {
      render();
    }
    return false;
  }

  if (shouldRender) {
    render();
  }
  showToast();
  return true;
}

function createImagePreview(cut) {
  const wrapper = document.createElement('div');
  wrapper.className = 'storyboard-image';

  const dropZone = document.createElement('div');
  dropZone.className = `storyboard-image__dropzone${cut.imageAsset?.id ? ' has-image' : ''}`;
  dropZone.dataset.dropzone = '';
  if (cut.imageAsset?.id) {
    dropZone.dataset.assetId = cut.imageAsset.id;
  }
  dropZone.tabIndex = 0;
  dropZone.setAttribute('role', 'button');
  dropZone.setAttribute(
    'aria-label',
    cut.imageAsset?.id ? `컷 ${cut.sceneNumber} 이미지 크게 보기` : `컷 ${cut.sceneNumber} 이미지 업로드`
  );

  const input = document.createElement('input');
  input.className = 'storyboard-image__input';
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp,image/gif';
  input.dataset.imageInput = '';
  input.setAttribute('aria-label', `컷 ${cut.sceneNumber} 이미지 파일 선택`);

  if (cut.imageAsset?.id) {
    const image = document.createElement('img');
    image.alt = cut.title ? `${cut.title} 프리뷰` : `컷 ${cut.sceneNumber} 프리뷰`;
    image.className = 'is-loading';
    loadImagePreview(image, cut.imageAsset);

    const overlay = document.createElement('span');
    overlay.className = 'storyboard-image__overlay';
    overlay.textContent = '클릭하여 크게 보기 · 새 이미지를 놓아 교체';
    dropZone.append(image, overlay);
  } else {
    const icon = document.createElement('span');
    icon.className = 'storyboard-image__icon';
    icon.textContent = '＋';

    const prompt = document.createElement('strong');
    prompt.textContent = '이미지를 끌어다 놓으세요';

    const help = document.createElement('span');
    help.textContent = '또는 클릭하여 파일 선택 · JPG, PNG, WebP, GIF';
    dropZone.append(icon, prompt, help);
  }

  dropZone.appendChild(input);
  wrapper.appendChild(dropZone);

  if (cut.imageAsset?.id) {
    const meta = document.createElement('div');
    meta.className = 'storyboard-image__meta';

    const name = document.createElement('span');
    name.textContent = cut.imageAsset.name || '업로드 이미지';

    const controls = document.createElement('div');
    controls.className = 'storyboard-image__controls';

    const replaceButton = createActionButton('이미지 교체', 'replace-image', cut.id);
    const removeButton = createActionButton('이미지 삭제', 'remove-image', cut.id);
    removeButton.classList.add('storyboard-image__remove');
    controls.append(replaceButton, removeButton);
    meta.append(name, controls);
    wrapper.appendChild(meta);
  }

  return wrapper;
}

function createField(labelText, fieldName, value, options = {}) {
  const label = document.createElement('label');
  label.className = options.wide ? 'storyboard-field storyboard-field--wide' : 'storyboard-field';

  const labelName = document.createElement('span');
  labelName.textContent = labelText;

  const control = options.multiline ? document.createElement('textarea') : document.createElement('input');
  control.dataset.field = fieldName;
  control.value = value ?? '';

  if (options.multiline) {
    control.rows = options.rows || 3;
  } else {
    control.type = options.type || 'text';
    if (options.min !== undefined) {
      control.min = String(options.min);
    }
  }

  label.append(labelName, control);
  return label;
}

function createActionButton(label, action, cutId, disabled = false) {
  const button = document.createElement('button');
  button.className = action === 'delete' ? 'storyboard-action storyboard-action--danger' : 'storyboard-action';
  button.type = 'button';
  button.dataset.action = action;
  button.dataset.cutId = cutId;
  button.disabled = disabled;
  button.textContent = label;
  return button;
}

function createCutCard(cut, index, total) {
  const card = document.createElement('article');
  card.className = 'storyboard-card';
  card.dataset.cutId = cut.id;

  const media = document.createElement('div');
  media.className = 'storyboard-card__media';

  const number = document.createElement('strong');
  number.className = 'storyboard-card__number';
  number.textContent = `컷 ${cut.sceneNumber}`;

  media.append(number, createImagePreview(cut));

  const details = document.createElement('div');
  details.className = 'storyboard-card__details';

  const topFields = document.createElement('div');
  topFields.className = 'storyboard-card__top-fields';
  topFields.append(
    createField('컷 제목', 'title', cut.title),
    createField('길이(초)', 'duration', cut.duration, { type: 'number', min: 0 })
  );

  details.append(
    topFields,
    createField('장면 설명', 'description', cut.description, { multiline: true, rows: 2 }),
    createField('내레이션', 'narration', cut.narration, { multiline: true, rows: 2 }),
    createField('SFX · 음향 효과', 'sfx', cut.sfx, { multiline: true, rows: 2 }),
    createField('VFX · 시각 효과', 'vfx', cut.vfx, { multiline: true, rows: 2 }),
    createField('이미지 프롬프트', 'imagePrompt', cut.imagePrompt, { multiline: true, rows: 2 }),
    createField('영상 프롬프트', 'videoPrompt', cut.videoPrompt, { multiline: true, rows: 2 })
  );

  const actions = document.createElement('div');
  actions.className = 'storyboard-card__actions';
  actions.append(
    createActionButton('복제', 'duplicate', cut.id),
    createActionButton('위로', 'move-up', cut.id, index === 0),
    createActionButton('아래로', 'move-down', cut.id, index === total - 1),
    createActionButton('삭제', 'delete', cut.id)
  );

  const content = document.createElement('div');
  content.className = 'storyboard-card__content';
  content.append(media, details);

  card.append(content, actions);
  return card;
}

function renderEmptyState(hasProject) {
  const empty = document.createElement('div');
  empty.className = 'empty-state-card storyboard-empty';

  const title = document.createElement('h3');
  title.textContent = hasProject ? '아직 등록된 컷이 없습니다.' : '선택된 프로젝트가 없습니다.';

  const description = document.createElement('p');
  description.textContent = hasProject
    ? '새 컷 추가 버튼으로 첫 장면을 만들어 보세요.'
    : '프로젝트를 생성하거나 선택하면 스토리보드를 편집할 수 있습니다.';

  empty.append(title, description);
  elements.list.appendChild(empty);
}

function render() {
  if (!elements.list || !elements.addButton) {
    return;
  }

  const project = getSelectedProject();
  elements.addButton.disabled = !project;
  elements.previewSize.disabled = !project;
  elements.list.innerHTML = '';

  if (!project) {
    if (elements.undoButton) elements.undoButton.disabled = true;
    if (elements.history) elements.history.textContent = '';
    renderEmptyState(false);
    return;
  }

  const storyboard = Array.isArray(project.storyboard) ? project.storyboard : [];
  const history = getStoryboardHistory(project);
  const previewSize = ['large', 'medium', 'small'].includes(project.storyboardSettings?.previewSize)
    ? project.storyboardSettings.previewSize
    : 'medium';
  elements.previewSize.value = previewSize;
  if (elements.undoButton) elements.undoButton.disabled = history.length === 0;
  if (elements.history) {
    elements.history.textContent = history.length
      ? `최근 작업 ${history.length}/3 · ${history.map((entry) => entry.label).join(' → ')}`
      : '복구 가능한 최근 작업이 없습니다.';
  }
  elements.list.dataset.previewSize = previewSize;
  if (storyboard.length === 0) {
    renderEmptyState(true);
    return;
  }

  storyboard.forEach((cut, index) => {
    elements.list.appendChild(createCutCard(cut, index, storyboard.length));
  });
}

function addCut() {
  const project = getSelectedProject();
  if (!project) {
    return;
  }

  const storyboard = Array.isArray(project.storyboard) ? project.storyboard : [];
  commitStoryboard([...storyboard, createCut()], true, '새 컷 추가');
}

async function handleAction(action, cutId) {
  const project = getSelectedProject();
  const storyboard = Array.isArray(project?.storyboard) ? project.storyboard : [];
  const index = storyboard.findIndex((cut) => cut.id === cutId);

  if (index < 0) {
    return;
  }

  const nextStoryboard = [...storyboard];
  let removedAssetId = null;

  if (action === 'delete') {
    removedAssetId = storyboard[index].imageAsset?.id || null;
    nextStoryboard.splice(index, 1);
  } else if (action === 'remove-image') {
    removedAssetId = storyboard[index].imageAsset?.id || null;
    nextStoryboard[index] = {
      ...storyboard[index],
      imageAsset: null,
      updatedAt: new Date().toISOString(),
      updatedBy: 'local-user'
    };
  } else if (action === 'duplicate') {
    nextStoryboard.splice(index + 1, 0, createCut(storyboard[index]));
  } else if (action === 'move-up' && index > 0) {
    [nextStoryboard[index - 1], nextStoryboard[index]] = [nextStoryboard[index], nextStoryboard[index - 1]];
  } else if (action === 'move-down' && index < nextStoryboard.length - 1) {
    [nextStoryboard[index], nextStoryboard[index + 1]] = [nextStoryboard[index + 1], nextStoryboard[index]];
  } else {
    return;
  }

  const now = new Date().toISOString();
  const movedCutIndex = nextStoryboard.findIndex((cut) => cut.id === cutId);
  if (movedCutIndex >= 0 && action !== 'delete') {
    nextStoryboard[movedCutIndex] = {
      ...nextStoryboard[movedCutIndex],
      updatedAt: now,
      updatedBy: 'local-user'
    };
  }

  if (commitStoryboard(nextStoryboard, true, {
    delete: '컷 삭제',
    'remove-image': '컷 이미지 삭제',
    duplicate: '컷 복제',
    'move-up': '컷 순서 변경',
    'move-down': '컷 순서 변경'
  }[action] || '스토리보드 수정')) {
    await removeAssetIfUnused(removedAssetId);
  }
}

function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('이미지 파일을 읽을 수 없습니다.'));
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

async function prepareImageAsset(file) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.');
  }

  if (file.size > MAX_IMAGE_FILE_SIZE) {
    throw new Error('이미지 원본은 10MB 이하여야 합니다.');
  }

  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(originalDataUrl);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('이미지 프리뷰를 만들 수 없습니다.');
  }

  context.drawImage(image, 0, 0, width, height);
  const outputType = file.type === 'image/png' && file.size < 1.5 * 1024 * 1024 ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error('이미지 파일을 변환하지 못했습니다.')),
      outputType,
      IMAGE_JPEG_QUALITY
    );
  });
  const metadata = {
    id: createId('asset'),
    name: file.name,
    mimeType: outputType,
    originalSize: file.size,
    storedSize: blob.size,
    width,
    height,
    source: 'upload',
    createdAt: new Date().toISOString()
  };

  return { metadata, blob };
}

async function uploadImage(cutId, file) {
  const project = getSelectedProject();
  const storyboard = Array.isArray(project?.storyboard) ? project.storyboard : [];
  const index = storyboard.findIndex((cut) => cut.id === cutId);

  if (index < 0 || !file) {
    return;
  }

  try {
    showToast('이미지를 준비하고 있습니다...');
    const { metadata, blob } = await prepareImageAsset(file);
    await saveAsset({ ...metadata, blob });
    const nextStoryboard = [...storyboard];
    const previousAssetId = storyboard[index].imageAsset?.id;
    nextStoryboard[index] = {
      ...storyboard[index],
      imageAsset: metadata,
      updatedAt: new Date().toISOString(),
      updatedBy: 'local-user'
    };

    if (!commitStoryboard(nextStoryboard, true, '컷 이미지 업로드')) {
      await removeAsset(metadata.id);
      showToast('이미지 정보를 저장하지 못했습니다.');
      return;
    }

    if (previousAssetId && !isAssetReferenced(previousAssetId)) {
      await removeAsset(previousAssetId);
    }
  } catch (error) {
    console.warn('이미지 업로드 실패:', error);
    showToast(error.message || '이미지를 업로드하지 못했습니다.');
  }
}

async function loadImagePreview(image, imageAsset) {
  try {
    if (imageAsset.dataUrl) {
      image.src = imageAsset.dataUrl;
    } else {
      const storedAsset = await loadAsset(imageAsset.id);
      if (!storedAsset?.blob) {
        throw new Error('저장된 이미지 파일을 찾을 수 없습니다.');
      }

      const objectUrl = URL.createObjectURL(storedAsset.blob);
      image.onload = () => URL.revokeObjectURL(objectUrl);
      image.onerror = () => URL.revokeObjectURL(objectUrl);
      image.src = objectUrl;
    }
    image.classList.remove('is-loading');
  } catch (error) {
    image.classList.remove('is-loading');
    image.classList.add('is-missing');
    image.alt = '이미지를 불러오지 못했습니다.';
    console.warn('이미지 프리뷰 로드 실패:', error);
  }
}

async function openImageViewer(imageAsset, title) {
  if (!elements.imageViewer || !elements.imageViewerImage || !imageAsset?.id) {
    return;
  }

  elements.imageViewerTitle.textContent = title || imageAsset.name || '이미지 프리뷰';
  elements.imageViewerImage.removeAttribute('src');
  elements.imageViewerImage.className = 'is-loading';
  elements.imageViewer.classList.add('is-open');
  elements.imageViewer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-open-modal');
  await loadImagePreview(elements.imageViewerImage, imageAsset);
}

function closeImageViewer() {
  if (!elements.imageViewer) {
    return;
  }

  elements.imageViewer.classList.remove('is-open');
  elements.imageViewer.setAttribute('aria-hidden', 'true');
  elements.imageViewerImage?.removeAttribute('src');
  document.body.classList.remove('has-open-modal');
}

function isAssetReferenced(assetId) {
  return state.projects.some((project) => {
    const currentStoryboardUsesAsset = (Array.isArray(project.storyboard) ? project.storyboard : [])
      .some((cut) => cut.imageAsset?.id === assetId);
    const historyUsesAsset = (Array.isArray(project.storyboardHistory) ? project.storyboardHistory : [])
      .some((entry) =>
        (Array.isArray(entry?.storyboard) ? entry.storyboard : [])
          .some((cut) => cut.imageAsset?.id === assetId)
      );
    return currentStoryboardUsesAsset || historyUsesAsset;
  });
}

async function removeAssetIfUnused(assetId) {
  if (assetId && !isAssetReferenced(assetId)) {
    try {
      await removeAsset(assetId);
    } catch (error) {
      console.warn('사용하지 않는 이미지 정리 실패:', error);
    }
  }
}

function dataUrlToBlob(dataUrl) {
  const [header, encoded] = dataUrl.split(',');
  const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
  const binary = window.atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

async function migrateInlineImages() {
  let hasChanges = false;

  for (const project of state.projects) {
    const storyboard = Array.isArray(project.storyboard) ? project.storyboard : [];

    for (const cut of storyboard) {
      if (!cut.imageAsset?.dataUrl) {
        continue;
      }

      try {
        const blob = dataUrlToBlob(cut.imageAsset.dataUrl);
        const metadata = {
          ...cut.imageAsset,
          id: cut.imageAsset.id || createId('asset'),
          storedSize: blob.size
        };
        delete metadata.dataUrl;
        await saveAsset({ ...metadata, blob });
        cut.imageAsset = metadata;
        hasChanges = true;
      } catch (error) {
        console.warn('기존 이미지 이전 실패:', error);
      }
    }
  }

  if (hasChanges) {
    if (saveProjects(state.projects)) {
      showToast('기존 이미지를 새 저장소로 옮겼습니다.');
    } else {
      console.warn('이전된 이미지 정보를 프로젝트에 저장하지 못했습니다.');
    }
  }
}

function handleFieldChange(event) {
  const field = event.target.dataset.field;
  const card = event.target.closest('.storyboard-card');

  if (!EDITABLE_FIELDS.has(field) || !card) {
    return;
  }

  const project = getSelectedProject();
  const storyboard = Array.isArray(project?.storyboard) ? project.storyboard : [];
  const index = storyboard.findIndex((cut) => cut.id === card.dataset.cutId);

  if (index < 0) {
    return;
  }

  const value = field === 'duration'
    ? Math.max(0, Number(event.target.value) || 0)
    : event.target.value;
  const nextStoryboard = [...storyboard];
  nextStoryboard[index] = {
    ...storyboard[index],
    [field]: value,
    updatedAt: new Date().toISOString(),
    updatedBy: 'local-user'
  };

  commitStoryboard(nextStoryboard, false, '컷 내용 수정', false);
}

function bindEvents() {
  elements.addButton.addEventListener('click', addCut);
  elements.undoButton?.addEventListener('click', () => {
    const restored = undoStoryboard(getSelectedProject());
    showToast(restored ? `"${restored.label}" 이전 상태로 복구했습니다.` : '복구할 작업이 없습니다.');
  });
  elements.previewSize.addEventListener('change', () => {
    const project = getSelectedProject();
    const previewSize = elements.previewSize.value;
    if (!project || !['large', 'medium', 'small'].includes(previewSize)) {
      return;
    }

    const previousSettings = project.storyboardSettings;
    project.storyboardSettings = {
      ...(project.storyboardSettings || {}),
      previewSize
    };

    if (!saveProjects(state.projects)) {
      project.storyboardSettings = previousSettings;
      showToast('이미지 크기 설정을 저장하지 못했습니다.');
      return;
    }

    elements.list.dataset.previewSize = previewSize;
    showToast('이미지 크기를 저장했습니다.');
  });
  elements.list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (button) {
      if (button.dataset.action === 'replace-image') {
        button.closest('.storyboard-card')?.querySelector('[data-image-input]')?.click();
        return;
      }
      handleAction(button.dataset.action, button.dataset.cutId);
      return;
    }

    const dropZone = event.target.closest('[data-dropzone]');
    if (dropZone && !event.target.matches('[data-image-input]')) {
      const card = dropZone.closest('.storyboard-card');
      const project = getSelectedProject();
      const cut = project?.storyboard?.find((item) => item.id === card?.dataset.cutId);

      if (cut?.imageAsset?.id) {
        openImageViewer(cut.imageAsset, `컷 ${cut.sceneNumber} · ${cut.title || cut.imageAsset.name || '이미지'}`);
      } else {
        dropZone.querySelector('[data-image-input]')?.click();
      }
    }
  });
  elements.list.addEventListener('input', handleFieldChange);
  elements.list.addEventListener('focusin', (event) => {
    if (!EDITABLE_FIELDS.has(event.target.dataset.field) || event.target.dataset.historyCaptured) return;
    const project = getSelectedProject();
    if (!project) return;
    pushStoryboardHistory(project, '컷 내용 수정');
    event.target.dataset.historyCaptured = 'true';
    saveProjects(state.projects);
    if (elements.undoButton) elements.undoButton.disabled = false;
    if (elements.history) {
      const history = getStoryboardHistory(project);
      elements.history.textContent = `최근 작업 ${history.length}/3 · ${history.map((entry) => entry.label).join(' → ')}`;
    }
  });
  elements.list.addEventListener('focusout', (event) => {
    delete event.target.dataset.historyCaptured;
  });
  elements.list.addEventListener('change', (event) => {
    if (event.target.dataset.field === 'imagePrompt') {
      document.dispatchEvent(new CustomEvent('project:storyboard-updated', {
        detail: {
          projectId: getSelectedProject()?.id,
          source: 'storyboard-editor',
          field: 'imagePrompt',
          cutId: event.target.closest('.storyboard-card')?.dataset.cutId
        }
      }));
      return;
    }
    if (!event.target.matches('[data-image-input]')) {
      return;
    }

    const card = event.target.closest('.storyboard-card');
    uploadImage(card?.dataset.cutId, event.target.files?.[0]);
  });
  elements.list.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-dropzone]')) {
      event.preventDefault();
      event.target.click();
    }
  });
  elements.list.addEventListener('dragover', (event) => {
    const dropZone = event.target.closest('[data-dropzone]');
    if (!dropZone) {
      return;
    }
    event.preventDefault();
    dropZone.classList.add('is-dragging');
  });
  elements.list.addEventListener('dragleave', (event) => {
    const dropZone = event.target.closest('[data-dropzone]');
    if (dropZone && !dropZone.contains(event.relatedTarget)) {
      dropZone.classList.remove('is-dragging');
    }
  });
  elements.list.addEventListener('drop', (event) => {
    const dropZone = event.target.closest('[data-dropzone]');
    if (!dropZone) {
      return;
    }

    event.preventDefault();
    dropZone.classList.remove('is-dragging');
    const card = dropZone.closest('.storyboard-card');
    uploadImage(card?.dataset.cutId, event.dataTransfer?.files?.[0]);
  });
  elements.imageViewer?.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-image-viewer]')) {
      closeImageViewer();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && elements.imageViewer?.classList.contains('is-open')) {
      closeImageViewer();
    } else if (
      (event.ctrlKey || event.metaKey) &&
      (event.key.toLowerCase() === 'z' || event.code === 'KeyZ')
    ) {
      const project = getSelectedProject();
      if (!getStoryboardHistory(project).length) return;
      event.preventDefault();
      const restored = undoStoryboard(project);
      if (restored) {
        showToast(`"${restored.label}" 이전 상태로 복구했습니다.`);
      }
    }
  }, true);
  document.addEventListener('project:selection-changed', render);
  document.addEventListener('project:storyboard-updated', render);
}

export function init() {
  if (isInitialized) {
    return;
  }

  elements = getElements();
  if (!elements.addButton || !elements.previewSize || !elements.list) {
    console.warn('스토리보드 UI를 찾을 수 없어 초기화를 건너뜁니다.');
    isInitialized = true;
    return;
  }

  bindEvents();
  migrateInlineImages()
    .catch((error) => console.warn('기존 이미지 이전 준비 실패:', error))
    .finally(render);
  isInitialized = true;
  console.info('스토리보드 편집 기능 준비됨');
}
