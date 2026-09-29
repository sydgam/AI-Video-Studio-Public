import { state } from './state.js';

let isTabsInitialized = false;

function syncPixelOffice(activeTab) {
  const frame = document.querySelector('#councilPixelOfficeFrame');
  const container = document.querySelector('.pixel-office-embed');
  if (!(frame instanceof HTMLIFrameElement)) return;

  if (activeTab === 'council') {
    if (!frame.getAttribute('src') || frame.getAttribute('src') === 'about:blank') {
      container?.classList.remove('is-loaded');
      frame.dataset.ready = 'false';
      frame.src = frame.dataset.lazySrc || './pixel-office/dist/index.html?embedded=council';
    }
    return;
  }

  // Unloading the embedded app guarantees that Phaser destroys its canvas,
  // listeners and game instance before another legacy screen takes over.
  if (frame.getAttribute('src') && frame.getAttribute('src') !== 'about:blank') {
    frame.src = 'about:blank';
    frame.dataset.ready = 'false';
    container?.classList.remove('is-loaded');
  }
}

function safeWarn(message) {
  console.warn(message);
}

export function initTabs() {
  if (isTabsInitialized) {
    return;
  }

  const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
  const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));

  if (tabButtons.length === 0 || tabPanels.length === 0) {
    safeWarn('탭 UI를 찾을 수 없어 초기화를 건너뜁니다.');
    isTabsInitialized = true;
    return;
  }

  const buttonMap = new Map();

  tabButtons.forEach((button) => {
    const targetTab = button.getAttribute('data-tab');

    if (!targetTab) {
      safeWarn('탭 버튼에 data-tab 속성이 없습니다.');
      return;
    }

    buttonMap.set(targetTab, button);
  });

  const panelMap = new Map();

  tabPanels.forEach((panel) => {
    const targetTab = panel.getAttribute('data-section');

    if (!targetTab) {
      safeWarn('탭 패널에 data-section 속성이 없습니다.');
      return;
    }

    panelMap.set(targetTab, panel);
  });

  tabButtons.forEach((button) => {
    const targetTab = button.getAttribute('data-tab');

    if (!targetTab) {
      return;
    }

    if (!buttonMap.has(targetTab) || !panelMap.has(targetTab)) {
      safeWarn(`탭 '${targetTab}'에 대응하는 패널이 없습니다.`);
      return;
    }

    button.addEventListener('click', () => {
      const nextTab = targetTab;
      const nextButton = buttonMap.get(nextTab);
      const nextPanel = panelMap.get(nextTab);

      if (!nextButton || !nextPanel) {
        safeWarn(`탭 '${nextTab}'을 활성화할 수 없습니다.`);
        return;
      }

      tabButtons.forEach((item) => item.classList.remove('is-active'));
      tabPanels.forEach((item) => item.classList.remove('is-active'));

      nextButton.classList.add('is-active');
      nextPanel.classList.add('is-active');
      state.activeTab = `${nextTab}Tab`;
      syncPixelOffice(nextTab);
    });
  });

  const pixelOfficeFrame = document.querySelector('#councilPixelOfficeFrame');
  pixelOfficeFrame?.addEventListener('load', () => {
    if (pixelOfficeFrame.getAttribute('src') !== 'about:blank') {
      pixelOfficeFrame.dataset.ready = 'true';
      document.querySelector('.pixel-office-embed')?.classList.add('is-loaded');
    }
  });
  const initialTab = tabButtons.find((button) => button.classList.contains('is-active'))?.getAttribute('data-tab');
  if (initialTab) syncPixelOffice(initialTab);

  isTabsInitialized = true;
}
