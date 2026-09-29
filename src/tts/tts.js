let initialized = false;
let referenceFile = null;
let generating = false;
let engineInfo = null;
let referenceUrl = '';
let lastGenerated = null;
const voiceInstructions = { preset: '', design: '' };
let previousMode = 'preset';
const paceInstructions = {
  slow: '천천히 여유 있는 속도로 말한다.',
  slightly_slow: '평소보다 약간 느리게 말한다.',
  normal: '자연스러운 보통 속도로 말한다.',
  slightly_fast: '발음을 또렷하게 유지하면서 평소보다 약간 빠르게 말한다.',
  fast: '단어를 생략하지 않고 발음을 또렷하게 유지하면서 빠른 속도로 말한다.'
};
const emotionInstructions = {
  neutral: '감정을 절제한 담담한 말투', calm: '차분하고 안정적인 말투',
  happy: '기쁨이 느껴지는 밝은 말투', sad: '슬픔이 느껴지는 가라앉은 말투',
  lament: '한탄과 아쉬움이 느껴지는 말투', angry: '분노가 느껴지는 단호한 말투',
  confident: '자신감 있고 의기양양한 말투', excited: '설레고 들뜬 말투'
};

function supportsInstructions(ui) {
  return ui.mode.value === 'design' || (ui.mode.value === 'preset' && !ui.model.value.includes('0.6b'));
}

function composedInstruction(ui) {
  if (!supportsInstructions(ui)) return '';
  const original = ui.instruction.value.trim();
  const pace = document.getElementById('ttsPace').value;
  const emotion = document.getElementById('ttsEmotion').value;
  const ending = document.getElementById('ttsEndingEmotion').value;
  const additions = [];
  if (paceInstructions[pace]) additions.push(`말하는 속도: ${paceInstructions[pace]}`);
  if (emotionInstructions[emotion]) additions.push(`${ending ? '마지막 문장을 제외한 부분' : '전체 대사'}의 감정: ${emotionInstructions[emotion]}로 말한다.`);
  if (emotionInstructions[ending]) additions.push(`마지막 문장의 감정: 마지막 문장에서만 ${emotionInstructions[ending]}로 전환하며 자연스럽게 마무리한다.`);
  if (!additions.length) return original;
  return [original, '추가 연기 설정: 아래에서 지정한 속도·감정이 앞선 설명의 같은 항목과 충돌하면 아래 설정을 우선한다. 목소리의 성별·나이대·음색은 앞선 설명을 유지한다.', ...additions].filter(Boolean).join('\n');
}

function updatePerformance(ui) {
  const supported = supportsInstructions(ui);
  for (const id of ['ttsPace', 'ttsEmotion', 'ttsEndingEmotion']) document.getElementById(id).disabled = !supported;
  document.getElementById('ttsPerformanceHelp').textContent = supported
    ? '선택한 설정을 설명 뒤에 덧붙입니다. 같은 항목이 충돌하면 선택한 설정을 우선하도록 요청합니다. 속도는 정확한 배속이 아닌 상대적인 발화 지시이며, 감정 전환도 결과를 보장하지 않습니다.'
    : '현재 방식은 속도·감정 지침을 지원하지 않아 적용하지 않습니다. 1.7B 기본 화자 또는 설명으로 새 목소리 만들기를 선택하세요.';
  document.getElementById('ttsPromptPreview').textContent = supported ? composedInstruction(ui) || '추가 지침 없음' : '이 방식에는 목소리 지침을 보내지 않습니다.';
}

function updateSample(ui) {
  const sample = document.getElementById('ttsSpeakerSample');
  sample.pause();
  sample.src = `/assets/tts/speakers/${ui.speaker.value.toLowerCase()}.wav`;
  document.getElementById('ttsSpeakerSampleLabel').textContent = `${ui.speaker.value.replaceAll('_', ' ')} · 한국어 미리듣기`;
}

function updateAvailability(ui) {
  updatePerformance(ui);
  if (!engineInfo?.ready) return;
  const suffix = { preset: 'CustomVoice', design: 'VoiceDesign', clone: 'Base' }[ui.mode.value];
  Array.from(ui.model.options).forEach((option) => {
    const size = option.value.includes('0.6b') ? '0.6B' : '1.7B';
    option.disabled = !(engineInfo.availableModels || []).some((name) => name.endsWith(`${size}-${suffix}`));
  });
  if (ui.model.selectedOptions[0]?.disabled) {
    const available = Array.from(ui.model.options).find((option) => !option.disabled);
    if (available) ui.model.value = available.value;
  }
  const supported = Array.from(ui.model.options).some((option) => !option.disabled);
  ui.generate.disabled = generating || engineInfo.busy || !supported;
  if (ui.instruction) {
    ui.instruction.disabled = ui.mode.value === 'clone' || (ui.mode.value === 'preset' && ui.model.value.includes('0.6b'));
    if (ui.mode.value === 'preset') {
      document.getElementById('ttsInstructionHelp').textContent = ui.instruction.disabled ? '0.6B는 연기 지침을 지원하지 않습니다. 지침을 쓰려면 1.7B를 선택하세요.' : '선택한 화자의 목소리를 유지하면서 말투와 감정을 지시합니다.';
    }
  }
  updatePerformance(ui);
}

function elements() {
  return {
    panel: document.getElementById('ttsPanel'),
    tab: document.getElementById('ttsTab'),
    engineStatus: document.getElementById('ttsEngineStatus'),
    script: document.getElementById('ttsScript'),
    characterCount: document.getElementById('ttsCharacterCount'),
    clear: document.getElementById('ttsClearButton'),
    mode: document.getElementById('ttsMode'),
    referenceInput: document.getElementById('ttsReferenceInput'),
    referenceDropzone: document.getElementById('ttsReferenceDropzone'),
    referenceFile: document.getElementById('ttsReferenceFile'),
    generate: document.getElementById('ttsGenerateButton'),
    message: document.getElementById('ttsMessage'),
    model: document.getElementById('ttsModel'),
    language: document.getElementById('ttsLanguage'),
    speaker: document.getElementById('ttsSpeaker'),
    instruction: document.getElementById('ttsInstruction'),
    referenceText: document.getElementById('ttsReferenceText'),
    outputEmpty: document.getElementById('ttsOutputEmpty'),
    outputPlayer: document.getElementById('ttsOutputPlayer'),
    audio: document.getElementById('ttsAudio'),
    download: document.getElementById('ttsDownloadButton'),
    regenerate: document.getElementById('ttsRegenerateButton')
  };
}

function fileToDataUrl(file) {
  if (!file) return Promise.resolve('');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('참조 음성을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

async function generateSpeech(ui) {
  if (generating) return;
  const text = ui.script?.value.trim() || '';
  if (!text) {
    ui.message.textContent = '대본을 입력해 주세요.';
    ui.script?.focus();
    return;
  }
  const mode = ui.mode?.value || 'preset';
  if (mode === 'clone' && !referenceFile) {
    ui.message.textContent = '복제에 사용할 참조 음성을 추가해 주세요.';
    return;
  }
  if (mode === 'design' && !ui.instruction.value.trim()) {
    ui.message.textContent = '만들 목소리의 특징을 설명해 주세요.';
    ui.instruction.focus();
    return;
  }
  const requestedText = text;

  generating = true;
  ui.generate.disabled = true;
  if (ui.regenerate) ui.regenerate.disabled = true;
  ui.generate.textContent = '음성 생성 중…';
  ui.message.textContent = '첫 생성에서는 모델을 불러오느라 시간이 더 걸릴 수 있습니다.';
  const started = Date.now();
  const progress = setInterval(async () => {
    try {
      const status = await fetch('/api/tts/status', { cache: 'no-store' }).then((r) => r.json());
      if (!generating) return;
      const seconds = Math.round((Date.now() - started) / 1000);
      ui.message.textContent = `${status.stage === 'loading' ? '모델 불러오는 중' : '음성 생성 중'} · ${seconds}초 경과. 다른 GPU 작업과 동시에 실행하면 오래 걸릴 수 있습니다.`;
    } catch { /* The generation request reports connection failures. */ }
  }, 3000);
  try {
    const response = await fetch('/api/tts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        mode,
        model_size: ui.model?.value.includes('0.6b') ? '0.6b' : '1.7b',
        language: ui.language?.value || 'Korean',
        ...(mode === 'preset' ? { speaker: ui.speaker?.value || 'Sohee' } : {}),
        instruct: composedInstruction(ui),
        reference_audio_base64: mode === 'clone' ? await fileToDataUrl(referenceFile) : '',
        reference_text: mode === 'clone' ? ui.referenceText?.value.trim() || '' : ''
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.audio) throw new Error(result.error || '음성을 생성하지 못했습니다.');
    ui.audio.src = result.audio;
    lastGenerated = { audio: result.audio, text: requestedText };
    ui.outputEmpty.hidden = true;
    ui.outputPlayer.hidden = false;
    ui.download.dataset.audioUrl = result.audio;
    ui.message.textContent = `음성 생성이 완료되었습니다.${result.seconds ? ` 생성 ${result.seconds}초 · 음성 ${result.audioSeconds}초` : ''}`;
  } catch (error) {
    ui.message.textContent = error.message || '음성을 생성하지 못했습니다.';
  } finally {
    clearInterval(progress);
    generating = false;
    ui.generate.disabled = false;
    if (ui.regenerate) ui.regenerate.disabled = false;
    ui.generate.textContent = '음성 생성';
  }
}

function updateCount(ui) {
  if (ui.characterCount) ui.characterCount.textContent = `${ui.script?.value.length || 0}자`;
}

function updateMode(ui) {
  const mode = ui.mode?.value || 'preset';
  if (previousMode !== mode) {
    if (previousMode !== 'clone') voiceInstructions[previousMode] = ui.instruction.value;
    ui.instruction.value = voiceInstructions[mode] || '';
    previousMode = mode;
  }
  document.getElementById('ttsModeHelp').textContent = {
    preset: '① 화자를 미리듣고 선택 → ② 왼쪽에 새 대본 입력 → ③ 음성 생성. 준비된 9명의 목소리를 사용합니다.',
    design: '① 만들 목소리의 특징 설명 → ② 왼쪽에 읽을 대본 입력 → ③ 음성 생성. 마음에 드는 결과는 아래 ‘이 목소리로 다른 대사 만들기’로 재사용하세요.',
    clone: '① 따라 할 녹음 추가 → ② 녹음 내용을 받아쓰기 → ③ 왼쪽에 새로 읽을 대본 입력 → 음성 생성.'
  }[mode];
  document.getElementById('ttsInstructionField').hidden = mode === 'clone';
  document.getElementById('ttsInstructionLabel').textContent = mode === 'design' ? '만들 목소리의 특징 · 필수' : '연기·감정 지침 · 선택';
  ui.instruction.placeholder = mode === 'design' ? '예: 낮고 부드러운 중년 남성 목소리. 차분한 다큐멘터리 내레이터처럼 또렷하고 천천히 말한다.' : '예: 차분하게 시작하고 핵심 문장은 힘 있게 강조한다.';
  document.getElementById('ttsInstructionHelp').textContent = mode === 'design' ? '음색·높낮이·나이대·말투를 구체적으로 설명하세요. 같은 설명도 생성마다 목소리가 달라질 수 있습니다.' : '';
  if (mode !== 'preset') document.getElementById('ttsSpeakerSample').pause();
  document.querySelectorAll('[data-tts-mode-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.ttsModePanel !== mode;
  });
  updateAvailability(ui);
}

function showReference(ui, file) {
  if (referenceUrl) URL.revokeObjectURL(referenceUrl);
  referenceUrl = '';
  referenceFile = file || null;
  ui.referenceText.value = '';
  if (!ui.referenceFile) return;
  ui.referenceFile.hidden = !referenceFile;
  ui.referenceFile.textContent = referenceFile ? `${referenceFile.name} · ${(referenceFile.size / 1024 / 1024).toFixed(1)} MB` : '';
  const player = document.getElementById('ttsReferencePlayer');
  player.pause();
  player.removeAttribute('src');
  player.hidden = !referenceFile;
  document.getElementById('ttsReferenceClear').hidden = !referenceFile;
  if (referenceFile) {
    referenceUrl = URL.createObjectURL(referenceFile);
    player.src = referenceUrl;
  }
}

async function checkEngine(ui) {
  if (generating) return;
  if (!ui.engineStatus) return;
  ui.engineStatus.dataset.state = 'checking';
  ui.engineStatus.querySelector('span').textContent = '로컬 엔진 확인 중';
  try {
    const response = await fetch('/api/tts/status', { cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    engineInfo = result;
    const ready = response.ok && result.ready === true;
    ui.engineStatus.dataset.state = ready ? 'ready' : 'offline';
    ui.engineStatus.querySelector('span').textContent = ready ? '로컬 엔진 준비됨' : '로컬 엔진 미연결';
    if (ui.generate) ui.generate.disabled = !ready;
    const capabilities = result.capabilities || {};
    Array.from(ui.mode?.options || []).forEach((option) => {
      option.disabled = ready && capabilities[option.value] === false;
      option.textContent = option.textContent.replace(' · 설치 필요', '');
      if (option.disabled && !option.textContent.includes('설치 필요')) option.textContent += ' · 설치 필요';
    });
    if (ui.mode?.selectedOptions[0]?.disabled) {
      const available = Array.from(ui.mode.options).find((option) => !option.disabled);
      if (available) ui.mode.value = available.value;
      updateMode(ui);
    }
    updateAvailability(ui);
    if (result.busy) ui.engineStatus.querySelector('span').textContent = `음성 처리 중 · ${Math.round(result.elapsedSeconds || 0)}초`;
    if (ui.message) ui.message.textContent = ready ? '대본과 음성을 설정한 뒤 생성하세요.' : '로컬 TTS 엔진을 연결하면 생성할 수 있습니다.';
  } catch {
    ui.engineStatus.dataset.state = 'offline';
    ui.engineStatus.querySelector('span').textContent = '로컬 엔진 미연결';
    if (ui.generate) ui.generate.disabled = true;
  }
}

export function init() {
  if (initialized) return;
  const ui = elements();
  if (!ui.panel || !ui.tab) return;

  ui.script?.addEventListener('input', () => updateCount(ui));
  ui.clear?.addEventListener('click', () => {
    if (ui.script) ui.script.value = '';
    updateCount(ui);
    ui.script?.focus();
  });
  ui.mode?.addEventListener('change', () => updateMode(ui));
  ui.model?.addEventListener('change', () => updateAvailability(ui));
  ui.instruction?.addEventListener('input', () => updatePerformance(ui));
  for (const id of ['ttsPace', 'ttsEmotion', 'ttsEndingEmotion']) {
    document.getElementById(id).addEventListener('change', () => updatePerformance(ui));
  }
  ui.speaker?.addEventListener('change', () => updateSample(ui));
  document.getElementById('ttsReferenceClear').addEventListener('click', () => {
    showReference(ui, null);
    ui.referenceInput.value = '';
    ui.referenceText.value = '';
  });
  document.getElementById('ttsUseAsReference').addEventListener('click', async () => {
    if (!lastGenerated || generating) return;
    const source = lastGenerated;
    try {
    const blob = await fetch(source.audio).then((response) => response.blob());
    showReference(ui, new File([blob], '생성한-목소리.wav', { type: 'audio/wav' }));
    ui.referenceText.value = source.text;
    ui.mode.value = 'clone';
    updateMode(ui);
    ui.message.textContent = '생성한 녹음과 받아쓰기를 참조로 넣었습니다. 왼쪽 대본을 새 대사로 바꾸고 생성하세요.';
    ui.script.focus();
    } catch {
      ui.message.textContent = '참조 음성으로 옮기지 못했습니다. WAV를 다운로드한 뒤 참조 녹음으로 추가해 주세요.';
    }
  });
  ui.referenceInput?.addEventListener('change', (event) => showReference(ui, event.target.files?.[0]));
  ui.referenceDropzone?.addEventListener('dragover', (event) => {
    event.preventDefault();
    ui.referenceDropzone.classList.add('is-dragging');
  });
  ui.referenceDropzone?.addEventListener('dragleave', () => ui.referenceDropzone.classList.remove('is-dragging'));
  ui.referenceDropzone?.addEventListener('drop', (event) => {
    event.preventDefault();
    ui.referenceDropzone.classList.remove('is-dragging');
    showReference(ui, event.dataTransfer?.files?.[0]);
  });
  ui.tab.addEventListener('click', () => checkEngine(ui));
  ui.generate?.addEventListener('click', () => generateSpeech(ui));
  ui.regenerate?.addEventListener('click', () => generateSpeech(ui));
  ui.download?.addEventListener('click', () => {
    const url = ui.download.dataset.audioUrl;
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `tts-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;
    link.click();
  });

  updateCount(ui);
  updateSample(ui);
  updateMode(ui);
  checkEngine(ui);
  initialized = true;
}
