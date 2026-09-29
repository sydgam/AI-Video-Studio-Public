const THEME_KEY = 'ai-video-studio-theme';
const SIDEBAR_KEY = 'ai-video-studio-sidebar-collapsed';
const THEMES = new Set(['dark', 'warm-light', 'sage']);

let isInitialized = false;

function readPreference(key, fallback = '') {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writePreference(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // UI preferences remain usable for the current session.
  }
}

function applyTheme(theme) {
  const selected = THEMES.has(theme) ? theme : 'dark';
  document.documentElement.dataset.theme = selected;
  document.getElementById('themeSelect').value = selected;
  writePreference(THEME_KEY, selected);
}

function applySidebarState(collapsed) {
  const sidebar = document.querySelector('.sidebar');
  const button = document.getElementById('sidebarToggleButton');
  if (!sidebar || !button) return;
  sidebar.classList.toggle('is-collapsed', collapsed);
  button.setAttribute('aria-expanded', String(!collapsed));
  button.setAttribute('aria-label', collapsed ? '프로젝트 패널 펼치기' : '프로젝트 패널 접기');
  button.textContent = collapsed ? '›' : '‹';
  writePreference(SIDEBAR_KEY, collapsed ? 'true' : 'false');
  window.dispatchEvent(new Event('resize'));
}

export function init() {
  if (isInitialized) return;
  const themeSelect = document.getElementById('themeSelect');
  const sidebarButton = document.getElementById('sidebarToggleButton');
  if (!themeSelect || !sidebarButton) {
    console.warn('화면 설정 UI를 찾을 수 없습니다.');
    isInitialized = true;
    return;
  }
  applyTheme(readPreference(THEME_KEY, 'dark'));
  applySidebarState(readPreference(SIDEBAR_KEY, 'false') === 'true');
  themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));
  sidebarButton.addEventListener('click', () => {
    applySidebarState(!document.querySelector('.sidebar')?.classList.contains('is-collapsed'));
  });
  isInitialized = true;
}
