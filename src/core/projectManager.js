import { createId } from '../utils/id.js';
import { state } from './state.js';
import { loadProjects, saveProjects, loadSelectedProjectId, saveSelectedProjectId } from './storage.js';
import { GUIDE_WORKFLOW_TEMPLATE } from '../data/guideWorkflow.js';

let isInitialized = false;
let elements = {};
let selectionGuard = null;

function safeWarn(message) {
  console.warn(message);
}

function getElements() {
  return {
    createButton: document.getElementById('newProjectButton'),
    projectList: document.getElementById('projectList'),
    projectTitle: document.querySelector('.project-title'),
    topbarTitle: document.querySelector('.topbar-title'),
    topbarDescription: document.querySelector('.topbar-description'),
    statusPill: document.querySelector('.status-pill'),
    modal: document.getElementById('projectModal'),
    projectForm: document.getElementById('projectForm'),
    projectNameInput: document.getElementById('projectNameInput'),
    clientNameInput: document.getElementById('clientNameInput'),
    modalCloseButtons: Array.from(document.querySelectorAll('[data-close-modal]'))
  };
}

function persistState() {
  const projectsSaved = saveProjects(state.projects);
  saveSelectedProjectId(state.selectedProjectId);
  return projectsSaved;
}

function updateHeader() {
  const selectedProject = state.projects.find((project) => project.id === state.selectedProjectId) || null;

  if (elements.projectTitle) {
    elements.projectTitle.textContent = selectedProject ? selectedProject.name : '새 프로젝트 준비 중';
  }

  if (elements.topbarTitle) {
    elements.topbarTitle.textContent = selectedProject ? selectedProject.name : '현재 프로젝트가 없습니다';
  }

  if (elements.topbarDescription) {
    elements.topbarDescription.textContent = selectedProject
      ? `클라이언트: ${selectedProject.client || '미지정'} · ${new Date(selectedProject.createdAt).toLocaleDateString('ko-KR')}`
      : '새 프로젝트를 시작하기 전까지는 기본 구조만 표시됩니다.';
  }

  if (elements.statusPill) {
    elements.statusPill.textContent = selectedProject ? '저장 상태: 저장됨' : '저장 상태: 준비 중';
  }
}

function renderProjects() {
  if (!elements.projectList) {
    return;
  }

  elements.projectList.innerHTML = '';

  if (state.projects.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'project-list__empty';
    emptyMessage.textContent = '아직 생성된 프로젝트가 없습니다.';
    elements.projectList.appendChild(emptyMessage);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'project-list__items';

  state.projects.forEach((project) => {
    const item = document.createElement('li');
    item.className = `project-card${project.id === state.selectedProjectId ? ' is-selected' : ''}`;

    const selectButton = document.createElement('button');
    selectButton.type = 'button';
    selectButton.className = 'project-card__select';
    selectButton.dataset.action = 'select';
    selectButton.dataset.projectId = project.id;

    const name = document.createElement('span');
    name.className = 'project-card__name';
    name.textContent = project.name;

    const meta = document.createElement('span');
    meta.className = 'project-card__meta';
    meta.textContent = project.client || '미지정';

    selectButton.appendChild(name);
    selectButton.appendChild(meta);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'project-card__delete';
    deleteButton.dataset.action = 'delete';
    deleteButton.dataset.projectId = project.id;
    deleteButton.setAttribute('aria-label', `${project.name} 삭제`);
    deleteButton.textContent = '×';

    const renameButton = document.createElement('button');
    renameButton.type = 'button';
    renameButton.className = 'project-card__rename';
    renameButton.dataset.action = 'rename';
    renameButton.dataset.projectId = project.id;
    renameButton.setAttribute('aria-label', `${project.name} 이름 변경`);
    renameButton.textContent = '✎';

    item.appendChild(selectButton);
    item.appendChild(renameButton);
    item.appendChild(deleteButton);
    list.appendChild(item);
  });

  elements.projectList.appendChild(list);
}

function openModal() {
  if (!elements.modal || !elements.projectNameInput) {
    return;
  }

  elements.modal.classList.add('is-open');
  elements.modal.setAttribute('aria-hidden', 'false');
  elements.projectNameInput.focus();
}

function closeModal() {
  if (!elements.modal) {
    return;
  }

  elements.modal.classList.remove('is-open');
  elements.modal.setAttribute('aria-hidden', 'true');

  if (elements.projectForm) {
    elements.projectForm.reset();
  }
}

export function getSelectedProject() {
  return state.projects.find((project) => project.id === state.selectedProjectId) || null;
}

export function getProjectById(projectId) {
  return state.projects.find((project) => project.id === projectId) || null;
}

export function refreshProjectUi() {
  renderProjects();
  updateHeader();
}

export function setSelectionGuard(handler) {
  selectionGuard = typeof handler === 'function' ? handler : null;
}

function canSwitchProject(nextProjectId) {
  if (!selectionGuard) {
    return true;
  }

  try {
    return selectionGuard(nextProjectId);
  } catch (error) {
    console.error('프로젝트 전환 가드 오류:', error);
    return true;
  }
}

export function selectProject(projectId) {
  if (!projectId) {
    return false;
  }

  const targetProject = state.projects.find((project) => project.id === projectId);
  if (!targetProject) {
    return false;
  }

  if (state.selectedProjectId && state.selectedProjectId !== projectId && !canSwitchProject(projectId)) {
    return false;
  }

  state.selectedProjectId = projectId;
  saveSelectedProjectId(projectId);
  refreshProjectUi();
  document.dispatchEvent(new CustomEvent('project:selection-changed', { detail: { projectId } }));
  return true;
}

export function updateProjectOverview(projectId, overviewData) {
  const targetProject = state.projects.find((project) => project.id === projectId);
  if (!targetProject) {
    return null;
  }

  const previousOverview = targetProject.overview;
  const previousName = targetProject.name;
  const previousClient = targetProject.client;
  const nextOverview = {
    ...(targetProject.overview || {}),
    ...overviewData
  };

  targetProject.overview = nextOverview;

  if (overviewData.projectName && typeof overviewData.projectName === 'string' && overviewData.projectName.trim()) {
    targetProject.name = overviewData.projectName.trim();
  }

  if (overviewData.clientName && typeof overviewData.clientName === 'string' && overviewData.clientName.trim()) {
    targetProject.client = overviewData.clientName.trim();
  }

  if (!persistState()) {
    targetProject.overview = previousOverview;
    targetProject.name = previousName;
    targetProject.client = previousClient;
    return null;
  }

  refreshProjectUi();
  document.dispatchEvent(new CustomEvent('project:overview-updated', { detail: { projectId } }));
  return targetProject;
}

function deleteProject(projectId) {
  if (!projectId) {
    return;
  }

  const targetProject = state.projects.find((project) => project.id === projectId);
  if (!targetProject) {
    return;
  }

  const shouldDelete = window.confirm(`${targetProject.name} 프로젝트를 삭제할까요?`);
  if (!shouldDelete) {
    return;
  }

  state.projects = state.projects.filter((project) => project.id !== projectId);

  if (state.selectedProjectId === projectId) {
    state.selectedProjectId = state.projects[0]?.id || null;
  }

  persistState();
  refreshProjectUi();
  document.dispatchEvent(new CustomEvent('project:selection-changed', { detail: { projectId: state.selectedProjectId } }));
}

function renameProject(projectId) {
  const targetProject = state.projects.find((project) => project.id === projectId);
  if (!targetProject) return;
  const nextName = window.prompt('새 프로젝트 이름을 입력하세요.', targetProject.name || '');
  if (nextName === null) return;
  const normalized = nextName.trim();
  if (!normalized) {
    window.alert('프로젝트 이름은 비워 둘 수 없습니다.');
    return;
  }
  const previousName = targetProject.name;
  const previousOverview = targetProject.overview;
  targetProject.name = normalized;
  targetProject.overview = { ...(targetProject.overview || {}), projectName: normalized };
  if (!persistState()) {
    targetProject.name = previousName;
    targetProject.overview = previousOverview;
    window.alert('프로젝트 이름을 저장하지 못했습니다.');
    return;
  }
  refreshProjectUi();
  document.dispatchEvent(new CustomEvent('project:overview-updated', { detail: { projectId } }));
}

function handleProjectCreate(event) {
  event.preventDefault();

  const projectName = elements.projectNameInput?.value?.trim() || '';
  const clientName = elements.clientNameInput?.value?.trim() || '';

  if (!projectName) {
    window.alert('프로젝트명을 입력해 주세요.');
    return;
  }

  const nextProject = {
    id: createId('project'),
    name: projectName,
    client: clientName || '미지정',
    createdAt: new Date().toISOString(),
    members: [{ name: '프로젝트 리더', role: 'Owner' }],
    overview: {},
    storyboard: [],
    storyboardHistory: [],
    workflowGraph: {
      nodes: [],
      edges: []
    }
  };

  state.projects = [...state.projects, nextProject];
  state.selectedProjectId = nextProject.id;

  persistState();
  refreshProjectUi();
  closeModal();
  document.dispatchEvent(new CustomEvent('project:selection-changed', { detail: { projectId: nextProject.id } }));
}

function bindEvents() {
  if (elements.createButton) {
    elements.createButton.removeAttribute('disabled');
    elements.createButton.addEventListener('click', openModal);
  }

  if (elements.projectList) {
    elements.projectList.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) {
        return;
      }

      const action = button.dataset.action;
      const projectId = button.dataset.projectId;

      if (action === 'select') {
        selectProject(projectId);
      } else if (action === 'rename') {
        renameProject(projectId);
      } else if (action === 'delete') {
        deleteProject(projectId);
      }
    });
  }

  if (elements.projectForm) {
    elements.projectForm.addEventListener('submit', handleProjectCreate);
  }

  elements.modalCloseButtons.forEach((button) => {
    button.addEventListener('click', closeModal);
  });

  if (elements.modal) {
    elements.modal.addEventListener('click', (event) => {
      if (event.target === elements.modal) {
        closeModal();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && elements.modal?.classList.contains('is-open')) {
      closeModal();
    }
  });
}


function createGuideProject() {
  const createdAt = new Date().toISOString();
  const nodes = GUIDE_WORKFLOW_TEMPLATE.nodes.map((node) => ({
    ...node,
    config: { ...(node.config || {}) },
    execution: { status: 'idle' },
    createdAt,
    updatedAt: createdAt
  }));
  const edges = GUIDE_WORKFLOW_TEMPLATE.edges.map((edge, index) => ({
    id: `guide-edge-${index + 1}`,
    ...edge
  }));
  const groups = (GUIDE_WORKFLOW_TEMPLATE.groups || []).map((group, index) => ({
    id: `guide-group-${index + 1}`,
    title: '노드 그룹',
    nodeIds: [...(group.nodeIds || [])]
  }));

  return {
    id: 'public-guide-project',
    name: 'AI Video Studio 사용 가이드',
    client: '공개 데모',
    createdAt,
    members: [{ name: '프로젝트 리더', role: 'Owner' }],
    overview: {
      projectName: 'AI Video Studio 사용 가이드',
      clientName: '공개 데모',
      objective: '샘플 노드를 따라가며 AI 영상 제작 흐름을 확인합니다.'
    },
    storyboard: [],
    storyboardHistory: [],
    workflowGraph: { nodes: [], edges: [] },
    workflow: {
      nodes,
      edges,
      groups,
      viewport: { ...(GUIDE_WORKFLOW_TEMPLATE.viewport || { x: 80, y: 70, zoom: 1 }) }
    }
  };
}

export function init() {
  if (isInitialized) {
    return;
  }

  elements = getElements();

  if (!elements.createButton && !elements.projectList && !elements.projectTitle && !elements.topbarTitle) {
    safeWarn('프로젝트 관리 UI를 찾을 수 없어 초기화를 건너뜁니다.');
    isInitialized = true;
    return;
  }

  const storedProjects = loadProjects();
  state.projects = Array.isArray(storedProjects) ? storedProjects : [];

  const restoredProjectId = loadSelectedProjectId();
  if (restoredProjectId && state.projects.some((project) => project.id === restoredProjectId)) {
    state.selectedProjectId = restoredProjectId;
  } else if (state.projects.length > 0) {
    state.selectedProjectId = state.projects[0].id;
    saveSelectedProjectId(state.selectedProjectId);
  } else {
    const guideProject = createGuideProject();
    state.projects = [guideProject];
    state.selectedProjectId = guideProject.id;
    saveProjects(state.projects);
    saveSelectedProjectId(state.selectedProjectId);
  }

  bindEvents();
  refreshProjectUi();
  isInitialized = true;
  console.info('프로젝트 관리 기능 준비됨');
}
