const PROJECTS_STORAGE_KEY = 'ai-video-studio-projects';
const SELECTED_PROJECT_ID_KEY = 'ai-video-studio-selected-project-id';

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn('localStorage 접근에 실패했습니다:', error);
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn('localStorage 저장에 실패했습니다:', error);
    return false;
  }
}

export function loadProjects() {
  try {
    const storedValue = readStorage(PROJECTS_STORAGE_KEY);

    if (!storedValue) {
      return [];
    }

    const parsed = JSON.parse(storedValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('프로젝트 로드를 준비하지 못했습니다:', error);
    return [];
  }
}

export function saveProjects(projects) {
  try {
    const serialized = JSON.stringify(projects);
    return writeStorage(PROJECTS_STORAGE_KEY, serialized);
  } catch (error) {
    console.warn('프로젝트 저장을 준비하지 못했습니다:', error);
    return false;
  }
}

export function loadSelectedProjectId() {
  try {
    const storedValue = readStorage(SELECTED_PROJECT_ID_KEY);
    return storedValue ? storedValue : null;
  } catch (error) {
    console.warn('선택된 프로젝트 ID를 불러오지 못했습니다:', error);
    return null;
  }
}

export function saveSelectedProjectId(projectId) {
  try {
    if (!projectId) {
      return writeStorage(SELECTED_PROJECT_ID_KEY, '');
    }

    return writeStorage(SELECTED_PROJECT_ID_KEY, projectId);
  } catch (error) {
    console.warn('선택된 프로젝트 ID를 저장하지 못했습니다:', error);
    return false;
  }
}
