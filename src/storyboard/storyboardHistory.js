import { saveProjects } from '../core/storage.js';
import { state } from '../core/state.js';

const MAX_STORYBOARD_HISTORY = 3;

function cloneStoryboard(storyboard) {
  return JSON.parse(JSON.stringify(Array.isArray(storyboard) ? storyboard : []));
}

export function pushStoryboardHistory(project, label = '스토리보드 수정') {
  if (!project) return;
  const history = Array.isArray(project.storyboardHistory) ? project.storyboardHistory : [];
  project.storyboardHistory = [
    ...history,
    {
      id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label,
      createdAt: new Date().toISOString(),
      storyboard: cloneStoryboard(project.storyboard)
    }
  ].slice(-MAX_STORYBOARD_HISTORY);
}

export function getStoryboardHistory(project) {
  return Array.isArray(project?.storyboardHistory) ? project.storyboardHistory : [];
}

export function undoStoryboard(project) {
  const history = getStoryboardHistory(project);
  if (!project || !history.length) return false;
  const previous = history[history.length - 1];
  const currentStoryboard = project.storyboard;
  const currentHistory = project.storyboardHistory;
  project.storyboard = cloneStoryboard(previous.storyboard);
  project.storyboardHistory = history.slice(0, -1);
  if (!saveProjects(state.projects)) {
    project.storyboard = currentStoryboard;
    project.storyboardHistory = currentHistory;
    return false;
  }
  document.dispatchEvent(new CustomEvent('project:storyboard-updated', {
    detail: {
      projectId: project.id,
      historyUndo: true,
      restoredAction: previous.label
    }
  }));
  return previous;
}
