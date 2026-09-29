import { loadAsset, removeAsset, saveAsset } from './assetStore.js';
import { getSelectedProject, refreshProjectUi, selectProject } from './projectManager.js';
import { saveProjects } from './storage.js';
import { state } from './state.js';
import { createId } from '../utils/id.js';

const EXPORT_FORMAT = 'ai-video-studio-project';
const EXPORT_VERSION = 1;
const MAX_IMPORT_SIZE = 250 * 1024 * 1024;

let isInitialized = false;
let elements = {};

function getElements() {
  return {
    exportButton: document.getElementById('exportProjectButton'),
    importButton: document.getElementById('importProjectButton'),
    importInput: document.getElementById('importProjectInput'),
    status: document.getElementById('projectTransferStatus')
  };
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle('is-error', isError);
}

function safeFileName(name) {
  return (name || 'project')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'project';
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('이미지 파일을 백업에 포함하지 못했습니다.'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const [header, encoded] = String(dataUrl).split(',');
  if (!header || !encoded) {
    throw new Error('백업 이미지 형식이 올바르지 않습니다.');
  }
  const mimeType = header.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';
  const binary = window.atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function collectAssetIds(project) {
  const ids = new Set();
  (Array.isArray(project.storyboard) ? project.storyboard : []).forEach((cut) => {
    if (cut.imageAsset?.id) {
      ids.add(cut.imageAsset.id);
    }
  });
  (Array.isArray(project.storyboardHistory) ? project.storyboardHistory : []).forEach((entry) => {
    (Array.isArray(entry?.storyboard) ? entry.storyboard : []).forEach((cut) => {
      if (cut.imageAsset?.id) {
        ids.add(cut.imageAsset.id);
      }
    });
  });
  (Array.isArray(project.workflow?.nodes) ? project.workflow.nodes : []).forEach((node) => {
    if (node.config?.referenceAsset?.id) {
      ids.add(node.config.referenceAsset.id);
    }
    (node.config?.styleAssets || []).forEach((asset) => {
      if (asset?.id) ids.add(asset.id);
    });
    (node.config?.attachments || []).forEach((asset) => {
      if (asset?.id) ids.add(asset.id);
    });
    if (node.execution?.output?.asset?.id) {
      ids.add(node.execution.output.asset.id);
    }
  });
  return [...ids];
}

async function exportSelectedProject() {
  const project = getSelectedProject();
  if (!project) {
    setStatus('먼저 내보낼 프로젝트를 선택해 주세요.', true);
    return;
  }

  elements.exportButton.disabled = true;
  setStatus('프로젝트와 이미지를 백업하고 있습니다...');

  try {
    const assets = [];
    for (const assetId of collectAssetIds(project)) {
      const asset = await loadAsset(assetId);
      if (!asset?.blob) {
        console.warn(`백업에서 누락된 이미지: ${assetId}`);
        continue;
      }
      const { blob, ...metadata } = asset;
      assets.push({ ...metadata, dataUrl: await blobToDataUrl(blob) });
    }

    const backup = {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      project: cloneData(project),
      assets
    };
    const file = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFileName(project.name)}-${new Date().toISOString().slice(0, 10)}.aivstudio.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(`내보내기 완료 · 이미지 ${assets.length}개 포함`);
  } catch (error) {
    console.error('프로젝트 내보내기 실패:', error);
    setStatus(error.message || '프로젝트를 내보내지 못했습니다.', true);
  } finally {
    refreshState();
  }
}

function validateBackup(backup) {
  if (!backup || backup.format !== EXPORT_FORMAT || backup.version !== EXPORT_VERSION) {
    throw new Error('AI Video Studio에서 만든 지원 가능한 백업 파일이 아닙니다.');
  }
  if (!backup.project || typeof backup.project !== 'object' || !Array.isArray(backup.assets)) {
    throw new Error('백업 파일에 필요한 프로젝트 정보가 없습니다.');
  }
}

async function importProject(file) {
  if (!file) {
    return;
  }
  if (file.size > MAX_IMPORT_SIZE) {
    setStatus('백업 파일은 250MB 이하여야 합니다.', true);
    return;
  }

  elements.importButton.disabled = true;
  setStatus('백업 파일을 가져오고 있습니다...');
  const savedAssetIds = [];

  try {
    const backup = JSON.parse(await file.text());
    validateBackup(backup);
    const project = cloneData(backup.project);
    const assetIdMap = new Map();

    for (const asset of backup.assets) {
      const newId = createId('asset');
      const blob = dataUrlToBlob(asset.dataUrl);
      const { dataUrl, id, ...metadata } = asset;
      await saveAsset({ ...metadata, id: newId, blob, importedAt: new Date().toISOString() });
      assetIdMap.set(id, newId);
      savedAssetIds.push(newId);
    }

    project.id = createId('project');
    project.name = `${project.name || '가져온 프로젝트'} (가져옴)`;
    project.importedAt = new Date().toISOString();
    project.updatedAt = project.importedAt;
    (Array.isArray(project.storyboard) ? project.storyboard : []).forEach((cut) => {
      if (cut.imageAsset?.id) {
        const newId = assetIdMap.get(cut.imageAsset.id);
        cut.imageAsset = newId ? { ...cut.imageAsset, id: newId } : null;
      }
    });
    (Array.isArray(project.storyboardHistory) ? project.storyboardHistory : []).forEach((entry) => {
      (Array.isArray(entry?.storyboard) ? entry.storyboard : []).forEach((cut) => {
        if (cut.imageAsset?.id) {
          const newId = assetIdMap.get(cut.imageAsset.id);
          cut.imageAsset = newId ? { ...cut.imageAsset, id: newId } : null;
        }
      });
    });
    (Array.isArray(project.workflow?.nodes) ? project.workflow.nodes : []).forEach((node) => {
      const referenceAsset = node.config?.referenceAsset;
      if (referenceAsset?.id) {
        const newReferenceId = assetIdMap.get(referenceAsset.id);
        if (newReferenceId) {
          node.config.referenceAsset = { ...referenceAsset, id: newReferenceId };
        } else {
          delete node.config.referenceAsset;
        }
      }
      if (Array.isArray(node.config?.styleAssets)) {
        node.config.styleAssets = node.config.styleAssets
          .map((styleAsset) => {
            const newStyleId = assetIdMap.get(styleAsset.id);
            return newStyleId ? { ...styleAsset, id: newStyleId } : null;
          })
          .filter(Boolean);
      }
      if (Array.isArray(node.config?.attachments)) {
        node.config.attachments = node.config.attachments
          .map((attachment) => {
            const newAttachmentId = assetIdMap.get(attachment.id);
            return newAttachmentId ? { ...attachment, id: newAttachmentId } : null;
          })
          .filter(Boolean);
      }
      if (['global-style', 'storyboard-input', 'storyboard-output'].includes(node.type)) {
        node.execution = { status: 'idle' };
      }
      const asset = node.execution?.output?.asset;
      if (!asset?.id) {
        return;
      }
      const newId = assetIdMap.get(asset.id);
      if (newId) {
        node.execution.output.asset = { ...asset, id: newId };
      } else {
        node.execution = {
          status: 'error',
          message: '백업에서 생성 이미지 파일을 찾지 못했습니다.'
        };
      }
    });

    state.projects = [...state.projects, project];
    if (!saveProjects(state.projects)) {
      state.projects = state.projects.filter((item) => item.id !== project.id);
      throw new Error('가져온 프로젝트를 브라우저에 저장하지 못했습니다.');
    }

    refreshProjectUi();
    selectProject(project.id);
    setStatus(`가져오기 완료 · ${project.name}`);
  } catch (error) {
    for (const assetId of savedAssetIds) {
      await removeAsset(assetId).catch(() => {});
    }
    console.error('프로젝트 가져오기 실패:', error);
    setStatus(error instanceof SyntaxError ? 'JSON 백업 파일을 읽을 수 없습니다.' : error.message, true);
  } finally {
    elements.importInput.value = '';
    refreshState();
  }
}

function refreshState() {
  elements.exportButton.disabled = !getSelectedProject();
  elements.importButton.disabled = false;
}

export function init() {
  if (isInitialized) {
    return;
  }
  elements = getElements();
  if (!elements.exportButton || !elements.importButton || !elements.importInput || !elements.status) {
    console.warn('프로젝트 백업 UI를 찾을 수 없어 초기화를 건너뜁니다.');
    isInitialized = true;
    return;
  }

  elements.exportButton.addEventListener('click', exportSelectedProject);
  elements.importButton.addEventListener('click', () => elements.importInput.click());
  elements.importInput.addEventListener('change', () => importProject(elements.importInput.files?.[0]));
  document.addEventListener('project:selection-changed', refreshState);
  refreshState();
  isInitialized = true;
}
