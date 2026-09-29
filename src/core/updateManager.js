const LAST_CHECK_KEY = 'ai-video-studio-last-update-check';
const LAST_RESULT_KEY = 'ai-video-studio-last-update-result';
const CHECK_INTERVAL = 24 * 60 * 60 * 1000;

let latestUpdate = null;
let initialized = false;

function elements() {
  return {
    current: document.getElementById('currentAppVersion'),
    status: document.getElementById('updateStatus'),
    details: document.getElementById('updateDetails'),
    latest: document.getElementById('latestAppVersion'),
    notes: document.getElementById('updateReleaseNotes'),
    check: document.getElementById('checkForUpdatesButton'),
    download: document.getElementById('downloadUpdateButton')
  };
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `업데이트 요청 실패 (${response.status})`);
  return payload;
}

function setStatus(message, type = '') {
  const ui = elements();
  if (!ui.status) return;
  ui.status.textContent = message;
  ui.status.classList.toggle('is-error', type === 'error');
  ui.status.classList.toggle('is-success', type === 'success');
}

function renderResult(result) {
  const ui = elements();
  latestUpdate = result;
  ui.current.textContent = `현재 버전 ${result.currentVersion}`;
  ui.details.hidden = !result.updateAvailable;
  ui.download.hidden = !result.updateAvailable || !result.asset;
  if (result.updateAvailable) {
    ui.latest.textContent = `새 버전 ${result.latestVersion} · ${result.releaseName || ''}`;
    ui.notes.textContent = result.notes || '등록된 변경 내용이 없습니다.';
    setStatus(`새로운 버전 ${result.latestVersion}을 사용할 수 있습니다.`, 'success');
  } else {
    setStatus(`현재 ${result.currentVersion} 버전이 최신입니다.`, 'success');
  }
}

async function checkForUpdates({ automatic = false } = {}) {
  const ui = elements();
  if (!ui.check) return;
  ui.check.disabled = true;
  if (!automatic) setStatus('GitHub Release를 확인하고 있습니다.');
  try {
    const result = await readJson(await fetch('/api/updates/check', { cache: 'no-store' }));
    renderResult(result);
    window.localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
    window.localStorage.setItem(LAST_RESULT_KEY, JSON.stringify(result));
  } catch (error) {
    if (!automatic) setStatus(error.message, 'error');
  } finally {
    ui.check.disabled = false;
  }
}

async function downloadUpdate() {
  const ui = elements();
  if (!latestUpdate?.updateAvailable) return;
  const approved = window.confirm(
    `AI Video Studio ${latestUpdate.latestVersion} 업데이트 파일을 다운로드할까요?\n\n` +
    '현재 프로그램 파일은 아직 교체하지 않으며, 검증된 ZIP을 updates 폴더에 준비합니다.'
  );
  if (!approved) return;
  ui.download.disabled = true;
  ui.check.disabled = true;
  setStatus('업데이트 파일을 다운로드하고 체크섬을 확인하고 있습니다.');
  try {
    const result = await readJson(await fetch('/api/updates/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    }));
    setStatus(`업데이트 ${result.version} 준비 완료: ${result.path}`, 'success');
    ui.download.hidden = true;
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    ui.download.disabled = false;
    ui.check.disabled = false;
  }
}

export function init() {
  if (initialized) return;
  const ui = elements();
  if (!ui.check || !ui.download) return;
  ui.check.addEventListener('click', () => checkForUpdates());
  ui.download.addEventListener('click', downloadUpdate);
  const lastCheck = Number(window.localStorage.getItem(LAST_CHECK_KEY) || 0);
  if (Date.now() - lastCheck >= CHECK_INTERVAL) {
    checkForUpdates({ automatic: true });
  } else {
    try {
      const cached = JSON.parse(window.localStorage.getItem(LAST_RESULT_KEY) || 'null');
      if (cached?.currentVersion) renderResult(cached);
      else checkForUpdates({ automatic: true });
    } catch {
      checkForUpdates({ automatic: true });
    }
  }
  initialized = true;
}
