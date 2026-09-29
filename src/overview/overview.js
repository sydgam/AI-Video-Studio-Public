import { state } from '../core/state.js';
import { getSelectedProject, setSelectionGuard, updateProjectOverview } from '../core/projectManager.js';

let isInitialized = false;
let elements = {};
let hasUnsavedChanges = false;
let toastTimer = null;

function safeWarn(message) {
  console.warn(message);
}

function getElements() {
  return {
    form: document.getElementById('overviewForm'),
    projectNameInput: document.getElementById('overviewProjectName'),
    clientNameInput: document.getElementById('overviewClientName'),
    videoTitleInput: document.getElementById('overviewVideoTitle'),
    coreMessageInput: document.getElementById('overviewCoreMessage'),
    purposeInput: document.getElementById('overviewPurpose'),
    targetAudienceInput: document.getElementById('overviewTargetAudience'),
    aspectRatioSelect: document.getElementById('overviewAspectRatio'),
    durationInput: document.getElementById('overviewDuration'),
    toneInput: document.getElementById('overviewTone'),
    referenceLinksInput: document.getElementById('overviewReferenceLinks'),
    notesInput: document.getElementById('overviewNotes'),
    toast: document.getElementById('overviewToast')
  };
}

function setFormDisabled(isDisabled) {
  if (!elements.form) {
    return;
  }

  const controls = Array.from(elements.form.querySelectorAll('input, select, textarea, button'));
  controls.forEach((control) => {
    control.disabled = isDisabled;
  });

  if (elements.form.querySelector('button[type="submit"]')) {
    elements.form.querySelector('button[type="submit"]').disabled = isDisabled;
  }
}

function clearForm() {
  if (!elements.form) {
    return;
  }

  elements.form.reset();
  hasUnsavedChanges = false;
}

function markDirty() {
  hasUnsavedChanges = true;
}

function buildOverviewPayload() {
  return {
    projectName: elements.projectNameInput?.value?.trim() || '',
    clientName: elements.clientNameInput?.value?.trim() || '',
    videoTitle: elements.videoTitleInput?.value?.trim() || '',
    coreMessage: elements.coreMessageInput?.value?.trim() || '',
    purpose: elements.purposeInput?.value?.trim() || '',
    targetAudience: elements.targetAudienceInput?.value?.trim() || '',
    aspectRatio: elements.aspectRatioSelect?.value || '',
    duration: elements.durationInput?.value?.trim() || '',
    tone: elements.toneInput?.value?.trim() || '',
    referenceLinks: elements.referenceLinksInput?.value?.trim() || '',
    notes: elements.notesInput?.value?.trim() || '',
    updatedAt: new Date().toISOString(),
    updatedBy: 'local-user'
  };
}

function populateForm(project) {
  if (!elements.form) {
    return;
  }

  const overview = project?.overview || {};
  if (elements.projectNameInput) {
    elements.projectNameInput.value = project?.name || overview.projectName || '';
  }
  if (elements.clientNameInput) {
    elements.clientNameInput.value = overview.clientName || project?.client || '';
  }
  if (elements.videoTitleInput) {
    elements.videoTitleInput.value = overview.videoTitle || '';
  }
  if (elements.coreMessageInput) {
    elements.coreMessageInput.value = overview.coreMessage || '';
  }
  if (elements.purposeInput) {
    elements.purposeInput.value = overview.purpose || '';
  }
  if (elements.targetAudienceInput) {
    elements.targetAudienceInput.value = overview.targetAudience || '';
  }
  if (elements.aspectRatioSelect) {
    elements.aspectRatioSelect.value = overview.aspectRatio || '16:9';
  }
  if (elements.durationInput) {
    elements.durationInput.value = overview.duration || '';
  }
  if (elements.toneInput) {
    elements.toneInput.value = overview.tone || '';
  }
  if (elements.referenceLinksInput) {
    elements.referenceLinksInput.value = overview.referenceLinks || '';
  }
  if (elements.notesInput) {
    elements.notesInput.value = overview.notes || '';
  }

  hasUnsavedChanges = false;
}

function handleSelectionChanged(event) {
  const projectId = event?.detail?.projectId || null;
  const project = state.projects.find((entry) => entry.id === projectId) || null;

  if (!project) {
    clearForm();
    setFormDisabled(true);
    return;
  }

  populateForm(project);
  setFormDisabled(false);
}

function showToast() {
  if (!elements.toast) {
    return;
  }

  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }

  elements.toast.classList.remove('is-visible');
  window.requestAnimationFrame(() => {
    elements.toast.classList.add('is-visible');
  });

  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove('is-visible');
  }, 2000);
}

function handleSubmit(event) {
  event.preventDefault();

  const selectedProject = getSelectedProject();
  if (!selectedProject) {
    return;
  }

  const payload = buildOverviewPayload();
  const savedProject = updateProjectOverview(selectedProject.id, payload);
  if (savedProject) {
    hasUnsavedChanges = false;
    showToast();
  }
}

function bindEvents() {
  if (elements.form) {
    elements.form.addEventListener('submit', handleSubmit);
  }

  const fieldElements = [
    elements.projectNameInput,
    elements.clientNameInput,
    elements.videoTitleInput,
    elements.coreMessageInput,
    elements.purposeInput,
    elements.targetAudienceInput,
    elements.aspectRatioSelect,
    elements.durationInput,
    elements.toneInput,
    elements.referenceLinksInput,
    elements.notesInput
  ];

  fieldElements.forEach((field) => {
    if (!field) {
      return;
    }
    field.addEventListener('input', markDirty);
    field.addEventListener('change', markDirty);
  });

  document.addEventListener('project:selection-changed', handleSelectionChanged);
  document.addEventListener('project:overview-updated', (event) => {
    const project = state.projects.find((entry) => entry.id === event?.detail?.projectId) || null;
    if (project && project.id === state.selectedProjectId) populateForm(project);
  });
  setSelectionGuard((nextProjectId) => {
    if (!hasUnsavedChanges) {
      return true;
    }

    const shouldLeave = window.confirm('저장되지 않은 변경 사항이 있습니다. 다른 프로젝트로 이동할까요?');
    return shouldLeave;
  });
}

export function init() {
  if (isInitialized) {
    return;
  }

  elements = getElements();
  if (!elements.form) {
    safeWarn('개요 폼을 찾을 수 없어 초기화를 건너뜁니다.');
    isInitialized = true;
    return;
  }

  bindEvents();
  setFormDisabled(true);
  handleSelectionChanged({ detail: { projectId: state.selectedProjectId } });
  isInitialized = true;
  console.info('개요 작성 기능 준비됨');
}
