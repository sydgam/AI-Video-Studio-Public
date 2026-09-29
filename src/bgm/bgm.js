const example = 'Cinematic documentary underscore. Felt piano plays a sparse repeating motif over warm cello and soft strings. A gentle pulse gradually builds, then resolves into a hopeful ending. Leave room for narration.';
const $ = (id) => document.getElementById(`bgm${id}`);
const defaults = {Steps: 50, Guidance: 7, Shift: 1, CfgStart: 0, CfgEnd: 1, Method: 'ode', Sampler: 'euler', FadeIn: 0.3, FadeOut: 1, Keyscale: '', Timesignature: '', Normalize: 'true', NormalizationDb: -1};
const fields = ['Prompt', 'Mood', 'Instruments', 'Duration', 'Bpm', 'Lyrics', 'Language', ...Object.keys(defaults)];
const mode = () => $('Instrumental').checked ? 'instrumental' : 'vocal';
let polling = false;
let historyKey = '';
let submitting = false;

function prompt() {
  return [$('Prompt').value.trim(), $('Mood').value && `Mood: ${$('Mood').value}.`,
    $('Instruments').value && `Main instruments: ${$('Instruments').value}.`,
    mode() === 'instrumental' ? 'Instrumental only. No vocals.' : 'Vocal song.'].filter(Boolean).join('\n');
}

function save() {
  $('Lyrics').disabled = $('Instrumental').checked;
  $('Language').disabled = $('Instrumental').checked;
  $('Duration').max = $('LimitDuration').checked ? '120' : '600';
  $('Preview').textContent = prompt();
  try { localStorage.setItem('studio.bgm.settings', JSON.stringify({...Object.fromEntries(fields.map(k => [k, $(k).value])), Instrumental: $('Instrumental').checked, LimitDuration: $('LimitDuration').checked})); } catch {}
}

function render(jobs) {
  const key = JSON.stringify(jobs);
  if (key === historyKey) return;
  historyKey = key;
  const container = $('History');
  // Keep existing audio players alive while polling an unrelated running job.
  for (const job of jobs) {
    let row = document.getElementById(`bgm-job-${job.id}`);
    if (row?.dataset.status === job.status && job.status === 'completed') continue;
    const isNew = !row;
    if (!row) { row = document.createElement('article'); row.id = `bgm-job-${job.id}`; row.className = 'bgm-job'; }
    row.dataset.status = job.status;
    row.replaceChildren();
    const title = document.createElement('strong');
    const labels = {completed: '완료', failed: '실패', interrupted: '상태 확인 필요', waiting: '다른 GPU 작업 대기 중', running: '음악 생성 중', queued: '준비 중'};
    title.textContent = `${labels[job.status] || job.status} · ${job.duration}초 · ${job.bpm} BPM · Seed ${job.result?.seed ?? job.seed}${job.elapsedSeconds ? ` · ${job.elapsedSeconds}초 경과` : ''}`;
    row.append(title);
    if (job.result?.settings?.mode || job.mode) {
      const content = job.result?.settings || job;
      const details = document.createElement('details');
      const summary = document.createElement('summary'); summary.textContent = `곡 유형: ${content.mode} · 언어: ${content.language} · 가사/설정 보기`;
      const pre = document.createElement('pre'); pre.style.whiteSpace = 'pre-wrap'; pre.textContent = JSON.stringify(content, null, 2);
      details.append(summary, pre); row.append(details);
    }
    const settings = job.result?.settings || (job.steps ? job : null);
    if (settings) {
      const detail = document.createElement('p');
      detail.textContent = `${settings.steps}단계 · CFG ${settings.guidance} (${settings.cfgStart}~${settings.cfgEnd}) · Shift ${settings.shift} · ${settings.method}/${settings.sampler} · 페이드 ${settings.fadeIn}/${settings.fadeOut}초`;
      row.append(detail);
    }
    const description = document.createElement('p'); description.textContent = job.error || job.prompt; row.append(description);
    if (job.audio) {
      const audio = document.createElement('audio'); audio.controls = true; audio.preload = 'none'; audio.src = job.audio;
      const link = document.createElement('a'); link.href = job.audio; link.download = `bgm-${job.id}.wav`; link.textContent = 'WAV 다운로드';
      row.append(audio, link);
    }
    if (isNew) container.prepend(row);
  }
  if (jobs.length) container.querySelector(':scope > p')?.remove();
}

async function refresh() {
  if (polling) return;
  polling = true;
  try {
    const response = await fetch('/api/bgm/status', { cache: 'no-store' });
    if (!response.ok) throw new Error('BGM 서버 연결을 확인해 주세요.');
    const state = await response.json();
    $('Engine').textContent = state.ready ? 'ACE-Step · 로컬 엔진 준비됨' : '로컬 엔진 설치 필요';
    $('Generate').disabled = submitting || !state.ready || state.busy;
    $('FullEditor').disabled = state.busy;
    $('FullEditorLink').hidden = !state.editorRunning;
    $('CloseEditor').hidden = !state.editorRunning;
    render([...state.jobs].reverse());
  } catch (error) { $('Message').textContent = error.message; $('Generate').disabled = true; }
  finally { polling = false; }
}

export function init() {
  if (!$('Panel')) return;
  for (const [id, action] of [['FullEditor', 'start'], ['CloseEditor', 'stop']]) {
    $(id).addEventListener('click', async () => {
      $(id).disabled = true;
      try {
        const response = await fetch(`/api/bgm/editor/${action}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'});
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        $('Message').textContent = action === 'start' ? '전체 편집기 준비 중입니다. 잠시 후 위의 전체 편집기 열기를 눌러주세요.' : '전체 편집기를 종료했습니다.';
      } catch (error) { $('Message').textContent = error.message; }
      finally { $(id).disabled = false; await refresh(); }
    });
  }
  try {
    const saved = JSON.parse(localStorage.getItem('studio.bgm.settings') || '{}');
    for (const key of fields) if (typeof saved[key] === 'string') $(key).value = saved[key];
    $('Instrumental').checked = saved.Instrumental ?? saved.Mode === 'instrumental';
    $('LimitDuration').checked = saved.LimitDuration ?? true;
  } catch {}
  for (const key of fields) $(key).addEventListener('input', save);
  for (const key of ['Instrumental', 'LimitDuration']) $(key).addEventListener('change', save);
  $('Example').addEventListener('click', () => { $('Prompt').value = example; save(); });
  $('ResetSettings').addEventListener('click', () => { for (const [key, value] of Object.entries(defaults)) $(key).value = value; save(); });
  $('Generate').addEventListener('click', async () => {
    if (submitting) return;
    if (!$('Prompt').value.trim()) { $('Message').textContent = '음악 설명을 입력하거나 예시를 넣어주세요.'; return; }
    for (const key of ['Duration', 'Bpm', ...Object.keys(defaults)]) {
      if (!$(key).checkValidity()) {
        const detail = $(key).closest('details'); if (detail) detail.open = true;
        $(key).reportValidity(); return;
      }
    }
    if (Number($('CfgStart').value) > Number($('CfgEnd').value)) { $('Message').textContent = 'CFG 시작은 종료보다 클 수 없습니다.'; return; }
    submitting = true; $('Generate').disabled = true; $('Message').textContent = '생성 요청 중…';
    try {
      const response = await fetch('/api/bgm/generate', { method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ prompt: prompt(), duration: Number($('Duration').value), limitDuration: $('LimitDuration').checked, bpm: Number($('Bpm').value), mode: mode(), lyrics: $('Lyrics').value, language: $('Language').value || 'unknown',
          ...Object.fromEntries(Object.keys(defaults).map(k => [k[0].toLowerCase() + k.slice(1), k === 'Normalize' ? $(k).value === 'true' : typeof defaults[k] === 'number' ? Number($(k).value) : $(k).value])) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '생성 요청에 실패했습니다.');
      $('Message').textContent = '생성을 시작했습니다. 아래 기록에서 상태를 확인할 수 있습니다. 탭을 이동해도 계속 진행됩니다.';
    } catch (error) { $('Message').textContent = error.message; }
    finally { submitting = false; await refresh(); }
  });
  $('Refresh').addEventListener('click', refresh);
  $('Tab').addEventListener('click', refresh);
  save(); refresh();
  setInterval(() => { if ($('Panel').classList.contains('is-active')) refresh(); }, 3000);
}
