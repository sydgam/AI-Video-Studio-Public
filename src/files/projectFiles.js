import { listAssets, loadAsset, removeAsset } from '../core/assetStore.js';
import { getSelectedProject } from '../core/projectManager.js';
import { state } from '../core/state.js';

let isInitialized = false;
let elements = {};
let syncTimer = null;
let isSyncing = false;
let latestFiles = [];

const GROUPS = [
  ['img', '생성 이미지'],
  ['planning', '기획'],
  ['storyboard', '스토리보드'],
  ['root', '프로젝트']
];

function getElements() {
  return {
    panel: document.getElementById('filesPanel'),
    tab: document.getElementById('filesTab'),
    syncButton: document.getElementById('syncProjectFilesButton'),
    refreshButton: document.getElementById('refreshProjectFilesButton'),
    path: document.getElementById('projectFilesPath'),
    status: document.getElementById('projectFilesStatus'),
    list: document.getElementById('projectFilesList'),
    diskUsage: document.getElementById('projectDiskUsage'),
    imageUsage: document.getElementById('projectImageUsage'),
    documentUsage: document.getElementById('projectDocumentUsage'),
    browserUsage: document.getElementById('browserAssetUsage'),
    browserQuota: document.getElementById('browserQuotaUsage'),
    cleanupDiskButton: document.getElementById('cleanupDiskImagesButton'),
    cleanupBrowserButton: document.getElementById('cleanupBrowserAssetsButton')
  };
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle('is-error', isError);
}

function escapeMarkdown(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function buildOverviewMarkdown(project) {
  const overview = project.overview || {};
  const rows = [
    ['프로젝트명', overview.projectName || project.name],
    ['클라이언트', overview.clientName || project.client],
    ['영상 제목', overview.videoTitle],
    ['핵심 메시지', overview.coreMessage],
    ['영상 목적', overview.purpose],
    ['타깃 시청자', overview.targetAudience],
    ['화면 비율', overview.aspectRatio],
    ['영상 길이', overview.duration],
    ['톤앤매너', overview.tone],
    ['참고 링크', overview.referenceLinks],
    ['제작 메모', overview.notes]
  ];
  return [
    `# ${escapeMarkdown(project.name)} — 프로젝트 개요`,
    '',
    ...rows.flatMap(([label, value]) => [
      `## ${label}`,
      escapeMarkdown(value) || '-',
      ''
    ])
  ].join('\n');
}

function buildLlmMarkdown(project) {
  const nodes = (project.workflow?.nodes || []).filter((node) =>
    ['openai-chat', 'anthropic-chat', 'google-chat', 'human-review'].includes(node.type) &&
    typeof node.execution?.output === 'string' &&
    node.execution.output.trim()
  );
  return [
    `# ${escapeMarkdown(project.name)} — LLM 작업 결과`,
    '',
    ...(nodes.length ? nodes.flatMap((node, index) => [
      `## ${index + 1}. ${escapeMarkdown(node.title || node.type)}`,
      '',
      `- 모델: ${escapeMarkdown(node.execution?.model || node.config?.model || '-')}`,
      `- 완료 시각: ${escapeMarkdown(node.execution?.completedAt || '-')}`,
      '',
      escapeMarkdown(node.execution.output),
      ''
    ]) : ['아직 저장된 LLM 결과가 없습니다.', ''])
  ].join('\n');
}

function buildStoryboardMarkdown(project) {
  const storyboard = Array.isArray(project.storyboard) ? project.storyboard : [];
  return [
    `# ${escapeMarkdown(project.name)} — 스토리보드`,
    '',
    ...storyboard.flatMap((cut, index) => {
      const number = cut.sceneNumber || index + 1;
      const imageExtension = extensionForAsset(cut.imageAsset);
      return [
        `## 컷 ${number} — ${escapeMarkdown(cut.title) || '제목 없음'}`,
        '',
        `- 장면: ${escapeMarkdown(cut.description) || '-'}`,
        `- 내레이션: ${escapeMarkdown(cut.narration) || '-'}`,
        `- SFX: ${escapeMarkdown(cut.sfx) || '-'}`,
        `- VFX: ${escapeMarkdown(cut.vfx) || '-'}`,
        `- 길이: ${Number(cut.duration) || 0}초`,
        `- 이미지: ${cut.imageAsset?.id ? `../img/cut-${String(number).padStart(3, '0')}.${imageExtension}` : '-'}`,
        '',
        '### 이미지 프롬프트',
        escapeMarkdown(cut.imagePrompt) || '-',
        '',
        '### 영상 프롬프트',
        escapeMarkdown(cut.videoPrompt) || '-',
        ''
      ];
    })
  ].join('\n');
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했습니다.'));
    reader.readAsDataURL(blob);
  });
}

function extensionForAsset(asset, storedAsset) {
  const type = asset?.type || asset?.mimeType || storedAsset?.type ||
    storedAsset?.mimeType || storedAsset?.blob?.type || '';
  if (type.startsWith('image/')) {
    return type.includes('jpeg') ? 'jpg' : type.split('/')[1] || 'png';
  }
  const fromName = String(asset?.name || storedAsset?.name || '').split('.').pop()?.toLowerCase();
  return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(fromName) ? fromName : 'png';
}

async function imageFile(asset, pathPrefix) {
  if (!asset?.id) return null;
  const storedAsset = await loadAsset(asset.id);
  if (!storedAsset?.blob) return null;
  const extension = extensionForAsset(asset, storedAsset);
  return {
    path: `${pathPrefix}.${extension}`,
    encoding: 'base64',
    content: await blobToBase64(storedAsset.blob)
  };
}

async function collectImageFiles(project, onlyCutNumber = null) {
  const files = [];
  const usedAssetIds = new Set();
  const storyboard = Array.isArray(project.storyboard) ? project.storyboard : [];
  for (const [index, cut] of storyboard.entries()) {
    const number = Number(cut.sceneNumber || index + 1);
    if (onlyCutNumber && number !== Number(onlyCutNumber)) continue;
    const file = await imageFile(cut.imageAsset, `img/cut-${String(number).padStart(3, '0')}`);
    if (file) {
      files.push(file);
      usedAssetIds.add(cut.imageAsset.id);
    }
  }
  if (onlyCutNumber) return files;
  for (const node of project.workflow?.nodes || []) {
    const asset = node.execution?.output?.asset;
    if (!asset?.id || usedAssetIds.has(asset.id)) continue;
    const safeTitle = String(node.title || 'generated')
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
      .replace(/\s+/g, '-')
      .slice(0, 48);
    const file = await imageFile(asset, `img/${safeTitle}-${asset.id.slice(-8)}`);
    if (file) files.push(file);
  }
  return files;
}

function documentFiles(project) {
  return [
    { path: 'planning/project-overview.md', encoding: 'utf8', content: buildOverviewMarkdown(project) },
    { path: 'planning/llm-results.md', encoding: 'utf8', content: buildLlmMarkdown(project) },
    { path: 'storyboard/storyboard.md', encoding: 'utf8', content: buildStoryboardMarkdown(project) },
    {
      path: 'storyboard/storyboard.json',
      encoding: 'utf8',
      content: JSON.stringify(project.storyboard || [], null, 2)
    },
    { path: 'project.json', encoding: 'utf8', content: JSON.stringify(project, null, 2) }
  ];
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `파일 요청 실패 (${response.status})`);
  return result;
}

async function syncProjectFiles({ includeImages = false, onlyCutNumber = null, render = false } = {}) {
  const project = getSelectedProject();
  if (!project || isSyncing) return;
  isSyncing = true;
  elements.syncButton.disabled = true;
  setStatus('프로젝트 파일을 저장하고 있습니다...');
  try {
    let result = await postJson('/api/project-files/sync', {
      projectName: project.name,
      files: documentFiles(project)
    });
    if (includeImages) {
      const images = await collectImageFiles(project, onlyCutNumber);
      for (const file of images) {
        result = await postJson('/api/project-files/sync', {
          projectName: project.name,
          files: [file]
        });
      }
    }
    elements.path.textContent = result.projectPath;
    setStatus(`자동 저장 완료 · 파일 ${result.files.length}개`);
    if (render || elements.panel.classList.contains('is-active')) renderFiles(result.files);
  } catch (error) {
    setStatus(error.message || '프로젝트 파일을 저장하지 못했습니다.', true);
  } finally {
    isSyncing = false;
    elements.syncButton.disabled = !getSelectedProject();
  }
}

function scheduleSync(options = {}) {
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => syncProjectFiles(options), 900);
}

function formatBytes(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function assetSize(asset) {
  return Number(asset?.blob?.size || asset?.storedSize || asset?.size || 0);
}

function collectReferencedAssetIds() {
  const ids = new Set();
  const addAsset = (asset) => {
    if (asset?.id) ids.add(asset.id);
  };
  state.projects.forEach((project) => {
    (project.storyboard || []).forEach((cut) => addAsset(cut.imageAsset));
    (project.storyboardHistory || []).forEach((entry) =>
      (entry.storyboard || []).forEach((cut) => addAsset(cut.imageAsset))
    );
    (project.workflow?.nodes || []).forEach((node) => {
      addAsset(node.config?.referenceAsset);
      (node.config?.styleAssets || []).forEach(addAsset);
      (node.config?.attachments || []).forEach(addAsset);
      addAsset(node.execution?.output?.asset);
    });
  });
  return ids;
}

async function refreshBrowserStorageUsage() {
  try {
    const assets = await listAssets();
    const total = assets.reduce((sum, asset) => sum + assetSize(asset), 0);
    const referencedIds = collectReferencedAssetIds();
    const unused = assets.filter((asset) => !referencedIds.has(asset.id));
    const unusedSize = unused.reduce((sum, asset) => sum + assetSize(asset), 0);
    elements.browserUsage.textContent = formatBytes(total);
    elements.cleanupBrowserButton.disabled = unused.length === 0;
    elements.cleanupBrowserButton.textContent = unused.length
      ? `미사용 브라우저 이미지 정리 (${formatBytes(unusedSize)})`
      : '미사용 브라우저 이미지 정리';
    elements.cleanupBrowserButton.dataset.unusedCount = String(unused.length);
    elements.cleanupBrowserButton.dataset.unusedSize = String(unusedSize);
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      elements.browserQuota.textContent = estimate.quota
        ? `브라우저 전체 ${formatBytes(estimate.usage || 0)} / ${formatBytes(estimate.quota)}`
        : `미사용 ${formatBytes(unusedSize)}`;
    } else {
      elements.browserQuota.textContent = `미사용 ${formatBytes(unusedSize)}`;
    }
  } catch (error) {
    elements.browserUsage.textContent = '확인 실패';
    elements.browserQuota.textContent = error.message || '';
  }
}

function expectedDiskImagePaths(project) {
  const expected = new Set();
  const usedAssetIds = new Set();
  (project?.storyboard || []).forEach((cut, index) => {
    if (!cut.imageAsset?.id) return;
    const number = Number(cut.sceneNumber || index + 1);
    expected.add(`img/cut-${String(number).padStart(3, '0')}.${extensionForAsset(cut.imageAsset)}`);
    usedAssetIds.add(cut.imageAsset.id);
  });
  (project?.workflow?.nodes || []).forEach((node) => {
    const asset = node.execution?.output?.asset;
    if (!asset?.id || usedAssetIds.has(asset.id)) return;
    const safeTitle = String(node.title || 'generated')
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
      .replace(/\s+/g, '-')
      .slice(0, 48);
    expected.add(`img/${safeTitle}-${asset.id.slice(-8)}.${extensionForAsset(asset)}`);
  });
  return expected;
}

function isStudioManagedDiskImage(path) {
  return /^img\/cut-\d{3,}\.(png|jpe?g|webp|gif)$/i.test(path) ||
    /^img\/.+-[a-z0-9]{8}\.(png|jpe?g|webp|gif)$/i.test(path);
}

function refreshDiskUsage(files) {
  latestFiles = files;
  const total = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  const images = files
    .filter((file) => file.path.startsWith('img/'))
    .reduce((sum, file) => sum + Number(file.size || 0), 0);
  elements.diskUsage.textContent = formatBytes(total);
  elements.imageUsage.textContent = formatBytes(images);
  elements.documentUsage.textContent = formatBytes(total - images);
  const expected = expectedDiskImagePaths(getSelectedProject());
  const stale = files.filter((file) =>
    isStudioManagedDiskImage(file.path) && !expected.has(file.path)
  );
  const staleSize = stale.reduce((sum, file) => sum + Number(file.size || 0), 0);
  elements.cleanupDiskButton.disabled = stale.length === 0;
  elements.cleanupDiskButton.textContent = stale.length
    ? `이전 디스크 이미지 정리 (${formatBytes(staleSize)})`
    : '이전 디스크 이미지 정리';
  elements.cleanupDiskButton.dataset.staleCount = String(stale.length);
  elements.cleanupDiskButton.dataset.staleSize = String(staleSize);
}

function renderFiles(files = []) {
  refreshDiskUsage(files);
  refreshBrowserStorageUsage();
  elements.list.innerHTML = '';
  GROUPS.forEach(([key, label]) => {
    const group = document.createElement('section');
    group.className = 'files-group';
    const heading = document.createElement('h4');
    heading.textContent = label;
    group.appendChild(heading);
    const entries = files.filter((file) =>
      key === 'root' ? !file.path.includes('/') : file.path.startsWith(`${key}/`)
    );
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'files-group__empty';
      empty.textContent = '저장된 파일이 없습니다.';
      group.appendChild(empty);
    }
    entries.forEach((file) => {
      const row = document.createElement('div');
      row.className = 'files-item';
      const name = document.createElement('div');
      name.className = 'files-item__name';
      name.innerHTML = `<strong></strong><span></span>`;
      name.querySelector('strong').textContent = file.name;
      name.querySelector('span').textContent =
        `${file.path} · ${formatBytes(file.size)} · ${new Date(file.modifiedAt).toLocaleString('ko-KR')}`;
      const download = document.createElement('button');
      download.type = 'button';
      download.className = 'files-item__action';
      download.dataset.downloadPath = file.path;
      download.textContent = '다운로드';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'files-item__action files-item__action--delete';
      remove.dataset.deletePath = file.path;
      remove.textContent = '삭제';
      row.append(name, download, remove);
      group.appendChild(row);
    });
    elements.list.appendChild(group);
  });
}

async function refreshFiles() {
  const project = getSelectedProject();
  if (!project) return;
  setStatus('파일 목록을 불러오고 있습니다...');
  try {
    const result = await postJson('/api/project-files/list', { projectName: project.name });
    elements.path.textContent = result.projectPath;
    renderFiles(result.files);
    setStatus(`파일 ${result.files.length}개`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function cleanupDiskImages() {
  const project = getSelectedProject();
  if (!project) return;
  const expected = expectedDiskImagePaths(project);
  const stale = latestFiles.filter((file) =>
    isStudioManagedDiskImage(file.path) && !expected.has(file.path)
  );
  const reclaimSize = stale.reduce((sum, file) => sum + Number(file.size || 0), 0);
  if (!stale.length) {
    setStatus('정리할 이전 디스크 이미지가 없습니다.');
    return;
  }
  const confirmed = window.confirm(
    `현재 컷과 노드에서 사용하지 않는 이미지 ${stale.length}개를 삭제할까요?\n` +
    `예상 확보 용량: ${formatBytes(reclaimSize)}\n\n이 작업은 되돌릴 수 없습니다.`
  );
  if (!confirmed) return;
  elements.cleanupDiskButton.disabled = true;
  try {
    let result = null;
    for (const file of stale) {
      result = await postJson('/api/project-files/delete', {
        projectName: project.name,
        path: file.path
      });
    }
    renderFiles(result?.files || []);
    setStatus(`이전 디스크 이미지 ${stale.length}개 삭제 · ${formatBytes(reclaimSize)} 확보`);
  } catch (error) {
    setStatus(error.message, true);
    await refreshFiles();
  }
}

async function cleanupBrowserAssets() {
  try {
    const referencedIds = collectReferencedAssetIds();
    const assets = await listAssets();
    const unused = assets.filter((asset) => !referencedIds.has(asset.id));
    const reclaimSize = unused.reduce((sum, asset) => sum + assetSize(asset), 0);
    if (!unused.length) {
      setStatus('정리할 미사용 브라우저 이미지가 없습니다.');
      return;
    }
    const confirmed = window.confirm(
      `모든 프로젝트, 워크플로우와 최근 히스토리에서 사용하지 않는 브라우저 이미지 ` +
      `${unused.length}개를 삭제할까요?\n예상 확보 용량: ${formatBytes(reclaimSize)}\n\n` +
      `이 작업은 되돌릴 수 없습니다.`
    );
    if (!confirmed) return;
    elements.cleanupBrowserButton.disabled = true;
    for (const asset of unused) {
      await removeAsset(asset.id);
    }
    await refreshBrowserStorageUsage();
    setStatus(`미사용 브라우저 이미지 ${unused.length}개 삭제 · ${formatBytes(reclaimSize)} 확보`);
  } catch (error) {
    setStatus(error.message || '브라우저 이미지 정리에 실패했습니다.', true);
    await refreshBrowserStorageUsage();
  }
}

function refreshProjectState() {
  const project = getSelectedProject();
  elements.syncButton.disabled = !project;
  elements.refreshButton.disabled = !project;
  elements.cleanupDiskButton.disabled = true;
  elements.cleanupBrowserButton.disabled = true;
  latestFiles = [];
  if (!project) {
    elements.path.textContent = '프로젝트를 선택해 주세요.';
    elements.list.innerHTML = '';
    elements.diskUsage.textContent = '0 B';
    elements.imageUsage.textContent = '0 B';
    elements.documentUsage.textContent = '0 B';
    elements.browserUsage.textContent = '0 B';
    elements.browserQuota.textContent = '';
    elements.cleanupDiskButton.textContent = '이전 디스크 이미지 정리';
    elements.cleanupBrowserButton.textContent = '미사용 브라우저 이미지 정리';
    setStatus('');
    return;
  }
  scheduleSync();
}

function bindEvents() {
  elements.tab.addEventListener('click', () => syncProjectFiles({ includeImages: true, render: true }));
  elements.syncButton.addEventListener('click', () => syncProjectFiles({ includeImages: true, render: true }));
  elements.refreshButton.addEventListener('click', refreshFiles);
  elements.cleanupDiskButton.addEventListener('click', cleanupDiskImages);
  elements.cleanupBrowserButton.addEventListener('click', cleanupBrowserAssets);
  elements.list.addEventListener('click', async (event) => {
    const project = getSelectedProject();
    if (!project) return;
    const download = event.target.closest('[data-download-path]');
    if (download) {
      const query = new URLSearchParams({
        projectName: project.name,
        path: download.dataset.downloadPath
      });
      window.location.href = `/api/project-files/download?${query}`;
      return;
    }
    const remove = event.target.closest('[data-delete-path]');
    if (!remove) return;
    if (!window.confirm(`"${remove.dataset.deletePath}" 파일을 삭제할까요?`)) return;
    try {
      const result = await postJson('/api/project-files/delete', {
        projectName: project.name,
        path: remove.dataset.deletePath
      });
      renderFiles(result.files);
      setStatus(`삭제 완료 · ${result.deleted}`);
    } catch (error) {
      setStatus(error.message, true);
    }
  });
  document.addEventListener('project:selection-changed', refreshProjectState);
  document.addEventListener('project:overview-updated', () => scheduleSync());
  document.addEventListener('project:storyboard-updated', (event) => {
    const cutNumber = event.detail?.generatedImageApplied ? event.detail.cutNumber : null;
    scheduleSync({ includeImages: Boolean(cutNumber), onlyCutNumber: cutNumber });
  });
  document.addEventListener('project:artifacts-updated', (event) => {
    const cutNumber = event.detail?.source === 'image-generator' ? event.detail.cutNumber : null;
    const includeImages = Boolean(cutNumber) || event.detail?.source === 'workflow-run';
    scheduleSync({ includeImages, onlyCutNumber: cutNumber });
  });
}

export function init() {
  if (isInitialized) return;
  elements = getElements();
  if (!elements.panel || !elements.list || !elements.tab) {
    console.warn('프로젝트 파일 UI를 찾을 수 없습니다.');
    isInitialized = true;
    return;
  }
  bindEvents();
  refreshProjectState();
  isInitialized = true;
}
