import { getSelectedProject, updateProjectOverview } from '../core/projectManager.js';
import { initCouncilGame, setCouncilGameEmployees, setCouncilGameMeeting, setCouncilGameMemberState } from './gameRenderer.js';
import { extractPresentationText } from '../services/documentService.js';

const MEMBERS = {
  openai: {
    name: 'GPT',
    model: 'gpt-5.6-terra',
    endpoint: '/api/openai/responses',
    healthKey: 'openaiConfigured'
  },
  anthropic: {
    name: 'Claude',
    model: 'claude-sonnet-5',
    endpoint: '/api/anthropic/messages',
    healthKey: 'anthropicConfigured'
  },
  gemini: {
    name: 'Gemini',
    model: 'gemini-3.8-flash',
    endpoint: '/api/gemini/generate',
    healthKey: 'geminiConfigured'
  }
};

const INDEPENDENT_INSTRUCTIONS = [
  '당신은 AI Video Studio 임원진 회의의 구성원입니다.',
  '다른 임원의 의견을 보지 않은 상태에서 사용자의 안건을 독립적으로 검토하세요.',
  '사용자의 목적과 제약을 먼저 파악하고, 실행 가능한 권고안과 그 이유를 명확하게 작성하세요.',
  '최신 정보, 가격, 일정, 법·정책, 특정 기업·제품·인물, 현재 상태 또는 외부 사실 검증이 답변 품질에 영향을 준다면 제공된 웹 검색 도구를 사용하세요.',
  '안정적인 일반 지식이나 순수한 창작 안건이라면 불필요하게 검색하지 마세요. 검색한 사실에는 출처를 연결하세요.',
  '불확실한 사실은 단정하지 말고 확인이 필요한 항목으로 표시하세요.',
  '억지로 반대하거나 동의하지 말고 가장 타당한 판단을 제시하세요.',
  '사람이 읽기 편한 한국어 일반 텍스트로 답하세요.'
].join('\n');

const COUNCIL_NOTES_KEY = 'ai-video-studio-council-notes';
const COUNCIL_EMPLOYEES_KEY = 'ai-video-studio-council-employees';
const PIXEL_EMPLOYEES_KEY = 'ai-video-studio:pixel-office-employees:v1';
const PIXEL_DEPARTMENTS = { strategy: 'strategy', script: 'narrative', board: 'shot', visual: 'frame', motion: 'motion', quality: 'quality' };
const COUNCIL_DEPARTMENTS = { strategy: 'strategy', narrative: 'script', shot: 'board', frame: 'visual', motion: 'motion', quality: 'quality' };
const DEPARTMENTS = {
  strategy: { name: '콘셉트 전략실', x: 26, y: 53 },
  script: { name: '내러티브 작가실', x: 52.4, y: 53 },
  board: { name: '컷 설계실', x: 83, y: 53 },
  visual: { name: '프레임 미술실', x: 26, y: 83 },
  motion: { name: '모션 제작실', x: 52.4, y: 83 },
  quality: { name: '최종 검수실', x: 83, y: 83 }
};
const STAFF_MODELS = {
  openai: ['gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.6-luna'],
  anthropic: ['claude-sonnet-5', 'claude-opus-5', 'claude-fable-5', 'claude-haiku-4-5'],
  gemini: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']
};
const EXECUTIVE_POSITIONS = {
  anthropic: { x: 42.7, y: 14.5 },
  openai: { x: 52.4, y: 14.5 },
  gemini: { x: 60.4, y: 14.5 }
};
const EXECUTIVE_SPRITES = {
  openai: './assets/council/sprite-gpt-v2.png',
  anthropic: './assets/council/sprite-claude-v1.png',
  gemini: './assets/council/sprite-gemini-v3.png'
};
const CHARACTER_STEP = 2;

let initialized = false;
let controller = null;
let finalText = '';
let elements = {};
let meetingInProgress = false;
let idleGestureTimer = null;
let returnTimer = null;
let notes = [];
let employees = [];
let characterMotionTimer = null;
let councilAttachments = [];
const employeeAgentStates = new Map();

const PERSONALITY_NAMES = {
  balanced: '균형형', creative: '창의형', analytical: '분석형', meticulous: '꼼꼼형',
  proactive: '주도형', collaborative: '협업형'
};
const EMPLOYEE_THUMBNAILS = {
  'casual-male-01': './pixel-office/dist/assets/game/characters/employee-casual-male-directional-v1.png',
  'strategist-female-01': './pixel-office/dist/assets/game/characters/employee-strategist-female-v1.png',
  'writer-female-01': './pixel-office/dist/assets/game/characters/employee-writer-female-v1.png',
  'shot-female-01': './pixel-office/dist/assets/game/characters/employee-shot-female-v1.png',
  'motion-female-01': './pixel-office/dist/assets/game/characters/employee-motion-female-v1.png',
  'artist-male-01': './pixel-office/dist/assets/game/characters/employee-artist-male-v1.png'
};

function getElements() {
  return {
    question: document.getElementById('councilQuestion'),
    mode: document.getElementById('councilMode'),
    chair: document.getElementById('councilChair'),
    run: document.getElementById('councilRunButton'),
    cancel: document.getElementById('councilCancelButton'),
    fresh: document.getElementById('councilNewSessionButton'),
    hire: document.getElementById('councilHireButton'),
    roomStatus: document.getElementById('councilRoomStatus'),
    progress: document.getElementById('councilProgress'),
    final: document.getElementById('councilFinal'),
    finalBody: document.getElementById('councilFinalBody'),
    copy: document.getElementById('councilCopyButton'),
    sendOverview: document.getElementById('councilSendOverviewButton'),
    notesList: document.getElementById('councilNotesList'),
    notesCount: document.getElementById('councilNotesCount')
    ,employeeLayer: document.getElementById('councilEmployeeLayer')
    ,employeeInvites: document.getElementById('councilEmployeeInvites')
    ,inviteCount: document.getElementById('councilInviteCount')
    ,staffReports: document.getElementById('councilStaffReports')
    ,staffReportList: document.getElementById('councilStaffReportList')
    ,staffStatusList: document.getElementById('councilStaffStatusList')
    ,staffStatusCount: document.getElementById('councilStaffStatusCount')
    ,questionDropzone: document.getElementById('councilQuestionDropzone')
    ,questionAttachments: document.getElementById('councilQuestionAttachments')
    ,questionFileInput: document.getElementById('councilQuestionFileInput')
  };
}

function setRoomStatus(message) {
  if (elements.roomStatus) elements.roomStatus.textContent = message;
  const phaserStatus = document.getElementById('councilPhaserStatus');
  if (phaserStatus) phaserStatus.textContent = message;
}

function sendPixelOfficeMessage(type, payload = {}) {
  document.getElementById('councilPixelOfficeFrame')?.contentWindow?.postMessage({ type, ...payload }, window.location.origin);
}

function setStage(stage) {
  document.querySelectorAll('#councilProgress [data-stage]').forEach((item) => {
    const stages = ['independent', 'review', 'synthesis', 'complete'];
    const currentIndex = stages.indexOf(stage);
    const itemIndex = stages.indexOf(item.dataset.stage);
    item.classList.toggle('is-active', itemIndex === currentIndex);
    item.classList.toggle('is-done', itemIndex < currentIndex || stage === 'complete');
  });
}

function setMemberState(key, status, message) {
  setCouncilGameMemberState(key, status);
  const executive = document.querySelector(`[data-council-member="${key}"]`);
  const card = document.querySelector(`[data-council-result="${key}"]`);
  if (executive) {
    executive.classList.remove('is-thinking', 'is-complete', 'is-error', 'is-absent');
    executive.classList.add(`is-${status}`);
    const bubble = executive.querySelector('.pixel-executive__bubble');
    if (bubble) bubble.textContent = message;
  }
  if (card) {
    card.classList.remove('is-thinking', 'is-complete', 'is-error', 'is-absent');
    card.classList.add(`is-${status}`);
    const badge = card.querySelector('header span');
    if (badge) badge.textContent = message;
  }
}

function setOpinion(key, text) {
  const body = document.querySelector(`[data-council-result="${key}"] .council-opinion__body`);
  if (body) body.textContent = text;
}

function executiveElement(key) {
  return document.querySelector(`[data-council-member="${key}"]`);
}

function seatExecutive(key, position) {
  const executive = executiveElement(key);
  if (!executive) return;
  executive.style.setProperty('--executive-x', `${position.x}%`);
  executive.style.setProperty('--executive-y', `${position.y}%`);
  ensureSpriteNode(executive, EXECUTIVE_SPRITES[key], `${MEMBERS[key].name} 캐릭터`);
  setSpriteFrame(executive, 0);
}

function ensureSpriteNode(element, source, alt = '') {
  let viewport = element.querySelector(':scope > .character-sprite');
  if (!viewport) {
    viewport = document.createElement('span');
    viewport.className = 'character-sprite';
    const image = document.createElement('img');
    image.alt = alt;
    viewport.appendChild(image);
    element.prepend(viewport);
  }
  const image = viewport.querySelector('img');
  if (image && image.getAttribute('src') !== source) image.src = source;
  return viewport;
}

function setSpriteFrame(element, frame) {
  if (!element) return;
  element.dataset.spriteFrame = String(Math.max(0, Math.min(4, frame)));
}

function startCharacterMotion() {
  if (document.getElementById('councilGameCanvas')) return;
  if (characterMotionTimer) window.clearInterval(characterMotionTimer);
  characterMotionTimer = window.setInterval(() => {
    if (meetingInProgress || document.hidden) return;
    const candidates = [
      ...Object.keys(EXECUTIVE_POSITIONS).map((key) => executiveElement(key)),
      ...document.querySelectorAll('.pixel-employee')
    ].filter(Boolean);
    const actor = candidates[Math.floor(Math.random() * candidates.length)];
    if (!actor) return;
    const direction = Math.random() > .5 ? 1 : -1;
    const current = Number(actor.dataset.walkOffset || 0);
    const next = Math.max(-4, Math.min(4, current + direction * CHARACTER_STEP));
    actor.dataset.walkOffset = String(next);
    actor.style.setProperty('--walk-x', `${next}px`);
    setSpriteFrame(actor, direction > 0 ? (Math.random() > .5 ? 1 : 2) : 4);
    actor.classList.add('is-walking');
    window.setTimeout(() => {
      actor.classList.remove('is-walking');
      setSpriteFrame(actor, 0);
      if (Math.abs(next) >= 4) {
        actor.classList.add('is-interacting');
        const bubble = actor.querySelector('.pixel-executive__bubble');
        const previous = bubble?.textContent;
        if (bubble) bubble.textContent = actor.dataset.councilMember === 'gemini' ? '보드 확인' : '자료 확인';
        window.setTimeout(() => {
          actor.classList.remove('is-interacting');
          if (bubble && previous) bubble.textContent = previous;
        }, 900);
      }
    }, 650);
  }, 2600);
}

function stopIdleGestures() {
  if (idleGestureTimer) window.clearInterval(idleGestureTimer);
  idleGestureTimer = null;
}

function playIdleGesture() {
  if (meetingInProgress) return;
  const keys = Object.keys(EXECUTIVE_POSITIONS);
  const key = keys[Math.floor(Math.random() * keys.length)];
  const executive = executiveElement(key);
  if (!executive) return;
  const gesture = key === 'openai' ? 'is-looking-right' : key === 'gemini' ? 'is-looking-left' : (Math.random() > .5 ? 'is-looking-left' : 'is-looking-right');
  executive.classList.add(gesture);
  window.setTimeout(() => executive.classList.remove(gesture), 1200);
}

function startIdleGestures() {
  stopIdleGestures();
  meetingInProgress = false;
  Object.entries(EXECUTIVE_POSITIONS).forEach(([key, position]) => {
    const executive = executiveElement(key);
    executive?.classList.remove('is-thinking', 'is-complete', 'is-error', 'is-absent', 'is-commanded', 'is-looking-left', 'is-looking-right');
    const bubble = executive?.querySelector('.pixel-executive__bubble');
    if (bubble) bubble.textContent = '회의 대기 중';
    seatExecutive(key, position);
  });
  idleGestureTimer = window.setInterval(playIdleGesture, 3200);
  startCharacterMotion();
}

function beginMeetingAnimation(invitedEmployeeIds = []) {
  meetingInProgress = true;
  setCouncilGameMeeting(true, invitedEmployeeIds);
  sendPixelOfficeMessage('COUNCIL_MEETING', { active: true, invitedEmployeeIds });
  stopIdleGestures();
  if (returnTimer) window.clearTimeout(returnTimer);
  Object.entries(EXECUTIVE_POSITIONS).forEach(([key, position], index) => {
    const executive = executiveElement(key);
    seatExecutive(key, position);
    window.setTimeout(() => {
      executive?.classList.add('is-commanded');
      const bubble = executive?.querySelector('.pixel-executive__bubble');
      if (bubble) bubble.textContent = index === 0 ? '안건 확인!' : index === 1 ? '회의 시작' : '검토할게요';
    }, index * 120);
    window.setTimeout(() => executive?.classList.remove('is-commanded'), 1100 + index * 120);
  });
  setRoomStatus('임원진이 안건을 확인하는 중');
}

function scheduleIdleGestures(delay = 2600) {
  if (returnTimer) window.clearTimeout(returnTimer);
  returnTimer = window.setTimeout(() => {
    setCouncilGameMeeting(false);
    sendPixelOfficeMessage('COUNCIL_MEETING', { active: false, invitedEmployeeIds: [] });
    startIdleGestures();
  }, delay);
}

function loadNotes() {
  try {
    const value = JSON.parse(window.localStorage.getItem(COUNCIL_NOTES_KEY) || '[]');
    notes = Array.isArray(value) ? value : [];
  } catch (error) {
    console.warn('임원진 회의록을 불러오지 못했습니다:', error);
    notes = [];
  }
}

function persistNotes() {
  try {
    window.localStorage.setItem(COUNCIL_NOTES_KEY, JSON.stringify(notes.slice(0, 100)));
  } catch (error) {
    console.warn('임원진 회의록 저장 실패:', error);
  }
}

function safeTopic(value) {
  return String(value || '새 안건')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 36) || '새 안건';
}

function noteFilename(question, dateValue) {
  const date = new Date(dateValue);
  const pad = (value) => String(value).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `${stamp}_${safeTopic(question)}.회의록`;
}

function openNote(noteId) {
  const note = notes.find((item) => item.id === noteId);
  if (!note) return;
  finalText = note.result;
  elements.question.value = note.question;
  elements.finalBody.textContent = note.result;
  elements.final.hidden = false;
  setRoomStatus(`${note.filename}을 열었습니다`);
  elements.final.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function downloadNote(noteId) {
  const note = notes.find((item) => item.id === noteId);
  if (!note) return;
  const blob = new Blob([`질문\n${note.question}\n\n최종 결론\n${note.result}`], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${note.filename}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderNotes() {
  if (!elements.notesList || !elements.notesCount) return;
  elements.notesCount.textContent = `${notes.length}개의 회의록`;
  elements.notesList.innerHTML = '';
  if (!notes.length) {
    const empty = document.createElement('p');
    empty.textContent = '완료된 회의의 최종 결론이 날짜와 주제별로 저장됩니다.';
    elements.notesList.appendChild(empty);
    return;
  }
  notes.forEach((note) => {
    const item = document.createElement('article');
    item.className = 'council-note';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'council-note__open';
    open.dataset.noteAction = 'open';
    open.dataset.noteId = note.id;
    const filename = document.createElement('strong');
    filename.textContent = note.filename;
    const preview = document.createElement('span');
    preview.textContent = note.result.replace(/\s+/g, ' ').slice(0, 100);
    open.append(filename, preview);
    const download = document.createElement('button');
    download.type = 'button';
    download.className = 'council-note__download';
    download.dataset.noteAction = 'download';
    download.dataset.noteId = note.id;
    download.textContent = 'TXT';
    item.append(open, download);
    elements.notesList.appendChild(item);
  });
}

function saveMeetingNote(question, result) {
  const createdAt = new Date().toISOString();
  const note = {
    id: globalThis.crypto?.randomUUID?.() || `note-${Date.now()}`,
    filename: noteFilename(question, createdAt),
    createdAt,
    question,
    result
  };
  notes.unshift(note);
  notes = notes.slice(0, 100);
  persistNotes();
  renderNotes();
}

function renderOpinion(key, result, reviewText = '') {
  const body = document.querySelector(`[data-council-result="${key}"] .council-opinion__body`);
  if (!body) return;
  body.innerHTML = '';
  const opinion = document.createElement('div');
  opinion.className = 'council-opinion__text';
  opinion.textContent = result.text;
  body.appendChild(opinion);
  if (reviewText) {
    const review = document.createElement('section');
    review.className = 'council-opinion__review';
    const title = document.createElement('strong');
    title.textContent = '심층 교차검토';
    const content = document.createElement('div');
    content.textContent = reviewText;
    review.append(title, content);
    body.appendChild(review);
  }
  const sourceBox = document.createElement('details');
  sourceBox.className = 'council-opinion__sources';
  const summary = document.createElement('summary');
  summary.textContent = result.searched
    ? `웹 검색 사용 · 출처 ${result.sources.length}개`
    : '웹 검색 불필요 판단';
  sourceBox.appendChild(summary);
  if (result.searchQueries.length) {
    const queries = document.createElement('p');
    queries.textContent = `검색어: ${result.searchQueries.join(' · ')}`;
    sourceBox.appendChild(queries);
  }
  result.sources.forEach((source) => {
    const link = document.createElement('a');
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = source.title || source.url;
    sourceBox.appendChild(link);
  });
  body.appendChild(sourceBox);
}

function loadEmployees() {
  try { employees = JSON.parse(localStorage.getItem(COUNCIL_EMPLOYEES_KEY) || '[]'); }
  catch { employees = []; }
  if (!Array.isArray(employees)) employees = [];
  if (!employees.length) {
    try {
      const pixelEmployees = JSON.parse(localStorage.getItem(PIXEL_EMPLOYEES_KEY) || '[]');
      if (Array.isArray(pixelEmployees)) {
        employees = pixelEmployees.map((employee) => ({
          id: employee.id,
          name: employee.name,
          department: COUNCIL_DEPARTMENTS[employee.departmentId] || 'strategy',
          title: employee.role || 'AI 영상 제작 직원',
          duties: employee.userPrompt || employee.role || '소속 부서의 영상 제작 업무를 수행합니다.',
          provider: 'openai', model: STAFF_MODELS.openai[0],
          personality: employee.personalityId || 'balanced',
          userPrompt: employee.userPrompt || '',
          systemPrompt: '', appearanceId: employee.appearanceId || 'casual-male-01',
          avatar: 'employee-avatar-designer-v1.png', sprite: 'sprite-employee-male-v1.png'
        }));
      }
    } catch { /* keep an empty employee list */ }
  }
}

function persistEmployees() {
  localStorage.setItem(COUNCIL_EMPLOYEES_KEY, JSON.stringify(employees));
  const pixelEmployees = employees.map((employee) => ({
    id: employee.id,
    name: employee.name,
    role: employee.title,
    departmentId: PIXEL_DEPARTMENTS[employee.department] || 'strategy',
    appearanceId: employee.appearanceId || 'casual-male-01',
    personalityId: employee.personality || 'balanced',
    userPrompt: employee.userPrompt || employee.systemPrompt || employee.duties || ''
  }));
  localStorage.setItem(PIXEL_EMPLOYEES_KEY, JSON.stringify(pixelEmployees));
  const frame = document.getElementById('councilPixelOfficeFrame');
  if (frame?.dataset.ready === 'true' && frame.getAttribute('src') !== 'about:blank') {
    frame.dataset.ready = 'false';
    frame.contentWindow?.location.reload();
  }
}

function updateEmployeeModels(selected = '') {
  const provider = document.getElementById('councilEmployeeProvider')?.value || 'openai';
  const select = document.getElementById('councilEmployeeModel');
  if (!select) return;
  select.innerHTML = '';
  (STAFF_MODELS[provider] || []).forEach((model) => {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    option.selected = model === selected;
    select.appendChild(option);
  });
}

function closeEmployeeModal() {
  const modal = document.getElementById('councilEmployeeModal');
  modal?.classList.remove('is-open');
  modal?.setAttribute('aria-hidden', 'true');
}

function openEmployeeModal(department = 'strategy', employeeId = '') {
  const employee = employees.find((item) => item.id === employeeId);
  document.getElementById('councilEmployeeId').value = employee?.id || '';
  document.getElementById('councilEmployeeName').value = employee?.name || '';
  document.getElementById('councilEmployeeDepartment').value = employee?.department || department;
  document.getElementById('councilEmployeeTitle').value = employee?.title || '';
  document.getElementById('councilEmployeeDuties').value = employee?.duties || '';
  document.getElementById('councilEmployeeProvider').value = employee?.provider || 'openai';
  document.getElementById('councilEmployeeSystemPrompt').value = employee?.systemPrompt || '';
  document.getElementById('councilEmployeePersonality').value = employee?.personality || 'balanced';
  document.getElementById('councilEmployeeAppearance').value = employee?.appearanceId || 'casual-male-01';
  document.getElementById('councilEmployeeUserPrompt').value = employee?.userPrompt || '';
  updateEmployeeModels(employee?.model || '');
  document.getElementById('councilEmployeeDelete').hidden = !employee;
  document.getElementById('councilEmployeeModalTitle').textContent = employee ? '직원 프로필 수정' : '직원 추가';
  const modal = document.getElementById('councilEmployeeModal');
  modal?.classList.add('is-open');
  modal?.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => document.getElementById('councilEmployeeName')?.focus(), 50);
}

function employeeStateLabel(state = 'idle') {
  return ({ idle: '대기', moving: '이동 중', working: '업무 중', meeting: '회의 중', blocked: '경로 확인 필요' })[state] || '대기';
}

function renderEmployeeStatusPanel() {
  if (!elements.staffStatusList) return;
  elements.staffStatusList.innerHTML = '';
  if (elements.staffStatusCount) elements.staffStatusCount.textContent = `${employees.length}명`;
  if (!employees.length) {
    const empty = document.createElement('p');
    empty.textContent = '등록된 직원이 없습니다.';
    elements.staffStatusList.appendChild(empty);
    return;
  }
  employees.forEach((employee) => {
    const state = employeeAgentStates.get(employee.id)?.state || 'idle';
    const card = document.createElement('article');
    card.className = 'council-staff-card';
    card.dataset.state = state;
    const thumb = document.createElement('div');
    thumb.className = 'council-staff-card__thumb';
    thumb.style.backgroundImage = `url("${EMPLOYEE_THUMBNAILS[employee.appearanceId] || EMPLOYEE_THUMBNAILS['casual-male-01']}")`;
    const content = document.createElement('div');
    content.className = 'council-staff-card__content';
    const header = document.createElement('header');
    const identity = document.createElement('div');
    const name = document.createElement('strong'); name.textContent = employee.name;
    const role = document.createElement('span'); role.textContent = `${DEPARTMENTS[employee.department]?.name || '미지정'} · ${employee.title || '직원'}`;
    identity.append(name, role);
    const badge = document.createElement('em'); badge.textContent = employeeStateLabel(state);
    header.append(identity, badge);
    const personality = document.createElement('p');
    personality.innerHTML = `<b>성격</b> ${PERSONALITY_NAMES[employee.personality] || PERSONALITY_NAMES.balanced}`;
    const prompt = document.createElement('p');
    prompt.className = 'council-staff-card__prompt';
    prompt.innerHTML = `<b>사용자 프롬프트</b> `;
    prompt.append(document.createTextNode(employee.userPrompt || '설정 없음'));
    const edit = document.createElement('button');
    edit.type = 'button'; edit.dataset.editEmployee = employee.id; edit.textContent = '설정 보기 · 수정';
    content.append(header, personality, prompt, edit);
    card.append(thumb, content);
    elements.staffStatusList.appendChild(card);
  });
}

function renderEmployees() {
  if (!elements.employeeLayer || !elements.employeeInvites) return;
  elements.employeeLayer.innerHTML = '';
  const departmentIndexes = {};
  employees.forEach((employee) => {
    const department = DEPARTMENTS[employee.department] || DEPARTMENTS.strategy;
    const index = departmentIndexes[employee.department] || 0;
    departmentIndexes[employee.department] = index + 1;
    const offsets = [-5, 0, 5];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pixel-employee';
    button.style.left = `${department.x + (offsets[index % 3] || 0)}%`;
    button.style.top = `${department.y + Math.floor(index / 3) * 5}%`;
    button.dataset.employeeId = employee.id;
    button.dataset.object = 'desk';
    button.title = `${employee.name} · ${employee.title} (클릭하여 수정)`;
    ensureSpriteNode(button, `./assets/council/${employee.sprite || 'sprite-employee-male-v1.png'}`, `${employee.name} 픽셀 직원`);
    setSpriteFrame(button, 0);
    const name = document.createElement('span');
    name.textContent = employee.name;
    button.append(name);
    elements.employeeLayer.appendChild(button);
  });
  elements.employeeInvites.innerHTML = '';
  if (!employees.length) {
    const empty = document.createElement('p');
    empty.textContent = '부서 이름이나 우측 아래 직원 추가 버튼을 눌러 직원을 채용해 주세요.';
    elements.employeeInvites.appendChild(empty);
  } else employees.forEach((employee) => {
    const label = document.createElement('label');
    label.className = 'council-invite';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = employee.id;
    input.dataset.employeeInvite = '';
    const text = document.createElement('span');
    text.textContent = `${employee.name} · ${employee.title}`;
    label.append(input, text);
    elements.employeeInvites.appendChild(label);
  });
  updateInviteCount();
  setCouncilGameEmployees(employees);
  renderEmployeeStatusPanel();
}

function updateInviteCount() {
  const count = document.querySelectorAll('[data-employee-invite]:checked').length;
  if (elements.inviteCount) elements.inviteCount.textContent = `${count}명 선택`;
}

function saveEmployee(event) {
  event.preventDefault();
  const id = document.getElementById('councilEmployeeId').value;
  const employee = {
    id: id || crypto.randomUUID?.() || `staff-${Date.now()}`,
    name: document.getElementById('councilEmployeeName').value.trim(),
    department: document.getElementById('councilEmployeeDepartment').value,
    title: document.getElementById('councilEmployeeTitle').value.trim(),
    duties: document.getElementById('councilEmployeeDuties').value.trim(),
    provider: document.getElementById('councilEmployeeProvider').value,
    model: document.getElementById('councilEmployeeModel').value,
    systemPrompt: document.getElementById('councilEmployeeSystemPrompt').value.trim(),
    personality: document.getElementById('councilEmployeePersonality').value,
    appearanceId: document.getElementById('councilEmployeeAppearance').value,
    userPrompt: document.getElementById('councilEmployeeUserPrompt').value.trim(),
    avatar: 'employee-avatar-designer-v1.png',
    sprite: document.querySelector('[name="councilEmployeeAvatar"]:checked')?.value || 'sprite-employee-male-v1.png'
  };
  const index = employees.findIndex((item) => item.id === id);
  if (index >= 0) employees[index] = employee; else employees.push(employee);
  persistEmployees();
  renderEmployees();
  closeEmployeeModal();
  setRoomStatus(`${employee.name} 직원이 ${DEPARTMENTS[employee.department].name}에 배치되었습니다.`);
}

function deleteEmployee() {
  const id = document.getElementById('councilEmployeeId').value;
  const employee = employees.find((item) => item.id === id);
  if (!employee || !confirm(`${employee.name} 직원을 삭제할까요?`)) return;
  employees = employees.filter((item) => item.id !== id);
  persistEmployees();
  renderEmployees();
  closeEmployeeModal();
}

function employeeInstructions(employee) {
  const personalityGuide = {
    balanced: '창의성, 정확성, 실행 가능성을 균형 있게 판단하세요.',
    creative: '새롭고 과감한 대안을 적극적으로 제안하세요.',
    analytical: '근거, 구조, 위험 요소를 분석적으로 검토하세요.',
    meticulous: '오류와 누락, 세부 완성도를 꼼꼼하게 확인하세요.',
    proactive: '빠르게 실행 가능한 결론과 다음 행동을 우선 제시하세요.',
    collaborative: '다른 직원과 임원진의 관점을 연결하고 조율하세요.'
  };
  return [
    `당신은 AI Video Studio ${DEPARTMENTS[employee.department]?.name || '실무팀'}의 ${employee.title} '${employee.name}'입니다.`,
    `담당 업무: ${employee.duties}`,
    `업무 성격: ${personalityGuide[employee.personality] || personalityGuide.balanced}`,
    employee.userPrompt ? `사용자 지침: ${employee.userPrompt}` : '',
    employee.systemPrompt,
    '임원진 회의 전 실무 검토 보고서를 작성하세요. 실행 가능한 제안, 위험, 확인할 사실을 간결한 한국어로 정리하세요.',
    '최신 정보나 외부 검증이 필요하면 웹 검색 도구를 사용하고 근거 출처를 남기세요.'
  ].filter(Boolean).join('\n');
}

function renderStaffReport(employee, text, error = false) {
  if (!elements.staffReportList) return;
  const article = document.createElement('article');
  article.className = 'council-staff-report';
  const header = document.createElement('header');
  const name = document.createElement('strong'); name.textContent = employee.name;
  const title = document.createElement('span'); title.textContent = error ? '응답 실패' : employee.title;
  const body = document.createElement('div'); body.textContent = text;
  header.append(name, title); article.append(header, body); elements.staffReportList.appendChild(article);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`${file.name} 파일을 읽지 못했습니다.`));
    reader.readAsDataURL(file);
  });
}

function renderCouncilAttachments() {
  if (!elements.questionAttachments) return;
  elements.questionAttachments.hidden = !councilAttachments.length;
  elements.questionAttachments.innerHTML = '';
  councilAttachments.forEach((attachment) => {
    const chip = document.createElement('article');
    chip.className = 'council-attachment';
    if (attachment.kind === 'image') {
      const image = document.createElement('img'); image.src = attachment.dataUrl; image.alt = '';
      chip.appendChild(image);
    } else {
      const icon = document.createElement('span'); icon.textContent = 'FILE'; chip.appendChild(icon);
    }
    const name = document.createElement('strong'); name.textContent = attachment.name;
    const remove = document.createElement('button');
    remove.type = 'button'; remove.dataset.removeCouncilAttachment = attachment.id; remove.setAttribute('aria-label', `${attachment.name} 제거`); remove.textContent = '×';
    chip.append(name, remove);
    elements.questionAttachments.appendChild(chip);
  });
}

async function addCouncilAttachments(fileList) {
  const files = [...(fileList || [])];
  if (!files.length) return;
  const allowed = new Set(['pdf', 'docx', 'pptx', 'rtf', 'odt', 'txt', 'md', 'json', 'html', 'xml']);
  try {
    for (const file of files) {
      if (!file.size) throw new Error(`${file.name} 파일이 비어 있습니다.`);
      if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name}: 파일은 50MB 이하여야 합니다.`);
      const isImage = file.type.startsWith('image/');
      const extension = file.name.toLowerCase().split('.').pop();
      if (!isImage && !allowed.has(extension)) throw new Error(`${file.name}: 지원하지 않는 파일 형식입니다.`);
      if (isImage && councilAttachments.filter((item) => item.kind === 'image').length >= 6) throw new Error('이미지는 최대 6개까지 첨부할 수 있습니다.');
      if (!isImage && councilAttachments.filter((item) => item.kind === 'document').length >= 10) throw new Error('문서는 최대 10개까지 첨부할 수 있습니다.');
      setRoomStatus(`${file.name} 파일을 준비하는 중`);
      const dataUrl = await fileToDataUrl(file);
      if (isImage) {
        councilAttachments.push({ id: crypto.randomUUID?.() || `image-${Date.now()}`, kind: 'image', name: file.name, dataUrl });
      } else {
        // PDF is understood natively by all three providers. Other supported
        // documents are converted to text locally so the same contents reach
        // GPT, Claude, and Gemini consistently.
        const text = extension === 'pdf' ? '' : await extractPresentationText(file.name, dataUrl);
        councilAttachments.push({
          id: crypto.randomUUID?.() || `document-${Date.now()}`,
          kind: 'document',
          name: file.name,
          source: 'document-input',
          dataUrl,
          text
        });
      }
      renderCouncilAttachments();
    }
    setRoomStatus(`${councilAttachments.length}개 첨부 파일이 준비되었습니다`);
  } catch (error) {
    setRoomStatus(error.message || '첨부 파일을 처리하지 못했습니다');
  } finally {
    if (elements.questionFileInput) elements.questionFileInput.value = '';
  }
}

async function callMember(key, input, instructions, signal, webSearch = false, modelOverride = '', includeAttachments = false) {
  const member = MEMBERS[key];
  const styleImages = includeAttachments
    ? councilAttachments.filter((item) => item.kind === 'image').slice(0, 6).map((item) => item.dataUrl)
    : [];
  const documents = includeAttachments
    ? councilAttachments.filter((item) => item.kind === 'document').slice(0, 10).map((item) => ({
        name: item.name,
        source: item.source,
        dataUrl: item.dataUrl,
        text: item.text
      }))
    : [];
  const response = await fetch(member.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: modelOverride || member.model,
      reasoningEffort: 'medium',
      verbosity: 'medium',
      instructions,
      input,
      webSearch,
      styleImages,
      documents
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `${member.name} 요청 실패 (${response.status})`);
  const outputText = String(result.outputText || '').trim();
  if (!outputText) throw new Error(`${member.name}이 빈 응답을 반환했습니다.`);
  return {
    text: outputText,
    searched: Boolean(result.searched),
    sources: Array.isArray(result.sources) ? result.sources : [],
    searchQueries: Array.isArray(result.searchQueries) ? result.searchQueries : []
  };
}

async function getAvailability() {
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    if (!response.ok) throw new Error('health check failed');
    const health = await response.json();
    return Object.fromEntries(Object.entries(MEMBERS).map(([key, member]) => [key, Boolean(health[member.healthKey])]));
  } catch (error) {
    console.warn('API 설정 상태를 확인하지 못해 모든 임원의 연결을 시도합니다.', error);
    return Object.fromEntries(Object.keys(MEMBERS).map((key) => [key, true]));
  }
}

function formatSources(sources) {
  return sources.length
    ? sources.map((source, index) => `${index + 1}. ${source.title || source.url} - ${source.url}`).join('\n')
    : '표시할 웹 출처 없음';
}

function buildStaffContext(staffOpinions) {
  if (!staffOpinions.length) return '초대된 실무진 없음';
  return staffOpinions.map(({ employee, result }) =>
    `[${employee.name} · ${employee.title} · ${DEPARTMENTS[employee.department]?.name}]\n${result.text}`
  ).join('\n\n');
}

function buildSynthesisInput(question, opinions, reviews = [], staffOpinions = []) {
  const answerBlocks = opinions.map(({ result }, index) =>
    `[독립 의견 ${String.fromCharCode(65 + index)}]\n${result.text}\n\n[의견 ${String.fromCharCode(65 + index)}의 출처]\n${formatSources(result.sources)}`
  ).join('\n\n');
  const reviewBlocks = reviews.length
    ? reviews.map((review, index) => `[익명 교차검토 ${index + 1}]\n${review.text}`).join('\n\n')
    : '빠른 회의 모드로 교차검토를 생략했습니다.';
  return [
    '[사용자 안건]',
    question,
    '',
    '[실무진 사전 검토]',
    buildStaffContext(staffOpinions),
    '',
    '[임원진 독립 의견 - 작성자 이름은 판단 편향을 줄이기 위해 표시하지 않음]',
    answerBlocks,
    '',
    '[교차검토 결과]',
    reviewBlocks
  ].join('\n');
}

function buildReviewInput(question, opinions) {
  return [
    '[사용자 안건]',
    question,
    '',
    '[익명 독립 의견]',
    ...opinions.map(({ result }, index) => [
      `의견 ${String.fromCharCode(65 + index)}`,
      result.text,
      '제시된 출처:',
      formatSources(result.sources)
    ].join('\n'))
  ].join('\n\n');
}

function reviewInstructions() {
  return [
    '당신은 임원진 심층 토론의 익명 검토자입니다.',
    '세 독립 의견의 작성자를 추측하지 말고 주장과 출처의 타당성만 검토하세요.',
    '강점, 사실 오류 또는 근거 부족, 서로 충돌하는 판단, 빠진 관점, 최종 의장이 채택해야 할 결론을 구분해 작성하세요.',
    '새로운 웹 검색은 하지 말고 제공된 의견과 출처만 검토하세요.',
    '간결하고 명확한 한국어로 작성하세요.'
  ].join('\n');
}

function synthesisInstructions() {
  return [
    '당신은 AI Video Studio 임원진 회의의 의장입니다.',
    '사용자의 원래 안건과 익명으로 제공된 임원진 독립 의견을 검토해 최종 회의 결과를 작성하세요.',
    '단순 다수결이나 답변 이어 붙이기를 하지 말고, 타당성을 기준으로 판단하세요.',
    '좋은 아이디어는 통합하고 충돌하는 의견은 이유를 분석하며, 사실이 불확실하면 반드시 표시하세요.',
    '다음 제목을 사용하세요: 최종 권고안, 합의된 핵심, 주요 이견 및 판단, 실행 순서, 추가 확인이 필요한 사항.',
    '해당 항목이 없으면 생략할 수 있습니다. 사람이 읽기 편한 한국어로 답하세요.'
  ].join('\n');
}

function setRunning(running) {
  elements.run.disabled = running;
  elements.question.disabled = running;
  elements.mode.disabled = running;
  elements.chair.disabled = running;
  elements.cancel.hidden = !running;
}

function resetMeeting(clearQuestion = false) {
  if (controller) controller.abort();
  controller = null;
  finalText = '';
  if (clearQuestion) {
    elements.question.value = '';
    councilAttachments = [];
    renderCouncilAttachments();
  }
  elements.final.hidden = true;
  elements.finalBody.textContent = '';
  if (elements.staffReports) elements.staffReports.hidden = true;
  if (elements.staffReportList) elements.staffReportList.innerHTML = '';
  setRoomStatus('안건을 기다리는 중');
  setStage('independent');
  document.querySelector('[data-stage="review"]')?.classList.remove('is-skipped');
  Object.keys(MEMBERS).forEach((key) => {
    setMemberState(key, 'idle', '대기 중');
    setOpinion(key, '회의가 시작되면 독립 의견이 표시됩니다.');
  });
  setRunning(false);
}

async function runMeeting() {
  const typedQuestion = elements.question.value.trim();
  const question = typedQuestion || (councilAttachments.length
    ? '첨부된 이미지와 문서의 내용을 종합적으로 검토하고, 핵심 판단과 실행 가능한 권고안을 제시해 주세요.'
    : '');
  const mode = elements.mode.value === 'deep' ? 'deep' : 'quick';
  if (!question) {
    elements.question.focus();
    setRoomStatus('회의 안건을 입력하거나 파일을 첨부해 주세요');
    return;
  }

  resetMeeting(false);
  controller = new AbortController();
  setRunning(true);
  setStage('independent');
  setRoomStatus('임원진이 독립 의견을 작성 중');

  try {
    const invitedIds = [...document.querySelectorAll('[data-employee-invite]:checked')].map((input) => input.value);
    beginMeetingAnimation(invitedIds);
    const availability = await getAvailability();
    const attending = Object.keys(MEMBERS).filter((key) => availability[key]);
    Object.keys(MEMBERS).forEach((key) => {
      if (availability[key]) {
        setMemberState(key, 'thinking', '생각 중…');
        setOpinion(key, '독립적으로 안건을 검토하고 있습니다.');
      } else {
        setMemberState(key, 'absent', 'API 키 없음');
        setOpinion(key, 'API 키가 설정되지 않아 이번 회의에 참석하지 못했습니다.');
      }
    });
    if (!attending.length) throw new Error('사용 가능한 AI API 키가 없습니다. .env 설정을 확인해 주세요.');

    const invitedEmployees = employees.filter((employee) => invitedIds.includes(employee.id));
    const staffOpinions = [];
    if (invitedEmployees.length) {
      elements.staffReports.hidden = false;
      elements.staffReportList.innerHTML = '';
      for (const employee of invitedEmployees) {
        if (!availability[employee.provider]) {
          renderStaffReport(employee, '선택한 AI 제공자의 API 키가 없어 이번 회의에 참여하지 못했습니다.', true);
          continue;
        }
        try {
          setRoomStatus(`${employee.name} ${employee.title}이 실무 검토 중`);
          const result = await callMember(employee.provider, question, employeeInstructions(employee), controller.signal, true, employee.model, true);
          staffOpinions.push({ employee, result });
          renderStaffReport(employee, result.text);
        } catch (error) {
          if (error.name === 'AbortError') throw error;
          renderStaffReport(employee, error.message || '응답을 받지 못했습니다.', true);
        }
      }
    }

    const executiveQuestion = staffOpinions.length
      ? `${question}\n\n[초대 실무진의 사전 검토 - 비판적으로 검토한 뒤 필요한 내용만 반영]\n${buildStaffContext(staffOpinions)}`
      : question;

    const opinions = [];
    for (const key of attending) {
      try {
        setRoomStatus(`${MEMBERS[key].name} 임원이 독립 의견을 작성 중`);
        const result = await callMember(key, executiveQuestion, INDEPENDENT_INSTRUCTIONS, controller.signal, true, '', true);
        opinions.push({ key, result });
        setMemberState(key, 'complete', '의견 완료');
        renderOpinion(key, result);
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        setMemberState(key, 'error', '응답 실패');
        setOpinion(key, error.message || '응답을 받지 못했습니다.');
      }
    }
    if (!opinions.length) throw new Error('임원진의 응답을 받지 못했습니다. 각 API 설정과 오류 내용을 확인해 주세요.');

    const reviews = [];
    if (mode === 'deep') {
      setStage('review');
      for (const key of opinions.map((item) => item.key)) {
        try {
          setRoomStatus(`${MEMBERS[key].name} 임원이 익명 의견을 교차검토 중`);
          setMemberState(key, 'thinking', '교차검토 중…');
          const review = await callMember(
            key,
            buildReviewInput(question, opinions),
            reviewInstructions(),
            controller.signal,
            false
          );
          reviews.push({ key, text: review.text });
          const opinion = opinions.find((item) => item.key === key);
          renderOpinion(key, opinion.result, review.text);
          setMemberState(key, 'complete', '검토 완료');
        } catch (error) {
          if (error.name === 'AbortError') throw error;
          console.warn(`${MEMBERS[key].name} 교차검토 실패:`, error);
          setMemberState(key, 'error', '검토 실패');
        }
      }
    } else {
      document.querySelector('[data-stage="review"]')?.classList.add('is-skipped');
    }

    setStage('synthesis');
    let chairKey = elements.chair.value;
    if (!opinions.some((item) => item.key === chairKey)) chairKey = opinions[0].key;
    setRoomStatus(`${MEMBERS[chairKey].name} 의장이 최종 의견을 정리 중`);
    setMemberState(chairKey, 'thinking', '종합 중…');
    const finalResult = await callMember(
      chairKey,
      buildSynthesisInput(question, opinions, reviews, staffOpinions),
      synthesisInstructions(),
      controller.signal,
      false
    );
    finalText = finalResult.text;
    setMemberState(chairKey, 'complete', '회의 완료');
    elements.finalBody.textContent = finalText;
    elements.final.hidden = false;
    saveMeetingNote(question, finalText);
    setStage('complete');
    setRoomStatus('최종 결론이 정리되었습니다');
    elements.final.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    if (error.name === 'AbortError') {
      setRoomStatus('회의가 중단되었습니다');
    } else {
      setRoomStatus(error.message || '회의 진행 중 오류가 발생했습니다');
    }
  } finally {
    controller = null;
    setRunning(false);
    scheduleIdleGestures(2600);
  }
}

async function copyFinal() {
  if (!finalText) return;
  try {
    await navigator.clipboard.writeText(finalText);
    elements.copy.textContent = '복사됨';
    window.setTimeout(() => { elements.copy.textContent = '복사'; }, 1400);
  } catch (error) {
    console.warn('회의 결과 복사 실패:', error);
  }
}

function sendToOverview() {
  const project = getSelectedProject();
  if (!project) {
    setRoomStatus('먼저 결과를 보낼 프로젝트를 선택해 주세요');
    return;
  }
  const previousNotes = String(project.overview?.notes || '').trim();
  if (previousNotes && !window.confirm('현재 개요의 제작 메모를 임원진 회의 결과로 교체할까요?')) return;
  const updated = updateProjectOverview(project.id, { notes: finalText });
  if (!updated) {
    setRoomStatus('개요 메모 저장에 실패했습니다');
    return;
  }
  setRoomStatus('최종 결론을 개요의 제작 메모로 보냈습니다');
}

export function init() {
  if (initialized) return;
  elements = getElements();
  if (!elements.question || !elements.run) return;
  initCouncilGame(document.getElementById('councilGameCanvas'), (employeeId) => openEmployeeModal('strategy', employeeId));
  elements.run.addEventListener('click', runMeeting);
  elements.cancel.addEventListener('click', () => controller?.abort());
  elements.fresh.addEventListener('click', () => resetMeeting(true));
  elements.copy.addEventListener('click', copyFinal);
  elements.sendOverview.addEventListener('click', sendToOverview);
  elements.hire.addEventListener('click', () => openEmployeeModal('strategy'));
  document.getElementById('councilPhaserHireButton')?.addEventListener('click', () => openEmployeeModal('strategy'));
  document.querySelectorAll('[class*="pixel-game__room-label--"]').forEach((label) => {
    const department = [...label.classList].find((name) => name.startsWith('pixel-game__room-label--'))?.replace('pixel-game__room-label--', '');
    label.setAttribute('role', 'button');
    label.setAttribute('tabindex', '0');
    label.title = '클릭하여 이 부서에 직원을 추가합니다.';
    label.addEventListener('click', () => openEmployeeModal(department));
    label.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') openEmployeeModal(department); });
  });
  elements.employeeLayer?.addEventListener('click', (event) => {
    const employee = event.target.closest('[data-employee-id]');
    if (employee) openEmployeeModal('strategy', employee.dataset.employeeId);
  });
  elements.employeeInvites?.addEventListener('change', updateInviteCount);
  elements.staffStatusList?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-edit-employee]');
    if (button) openEmployeeModal('strategy', button.dataset.editEmployee);
  });
  elements.questionFileInput?.addEventListener('change', (event) => addCouncilAttachments(event.target.files));
  elements.questionAttachments?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-council-attachment]');
    if (!button) return;
    councilAttachments = councilAttachments.filter((item) => item.id !== button.dataset.removeCouncilAttachment);
    renderCouncilAttachments();
  });
  ['dragenter', 'dragover'].forEach((type) => elements.questionDropzone?.addEventListener(type, (event) => {
    event.preventDefault(); elements.questionDropzone.classList.add('is-dragover');
  }));
  ['dragleave', 'drop'].forEach((type) => elements.questionDropzone?.addEventListener(type, (event) => {
    event.preventDefault(); elements.questionDropzone.classList.remove('is-dragover');
  }));
  elements.questionDropzone?.addEventListener('drop', (event) => addCouncilAttachments(event.dataTransfer?.files));
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.source !== document.getElementById('councilPixelOfficeFrame')?.contentWindow) return;
    if (event.data?.type === 'PIXEL_AGENT_STATE' && event.data.agent?.id) {
      employeeAgentStates.set(event.data.agent.id, event.data.agent);
      renderEmployeeStatusPanel();
    }
    if (event.data?.type === 'PIXEL_AGENTS_SNAPSHOT' && Array.isArray(event.data.agents)) {
      event.data.agents.forEach((agent) => employeeAgentStates.set(agent.id, agent));
      renderEmployeeStatusPanel();
    }
  });
  document.getElementById('councilEmployeeProvider')?.addEventListener('change', () => updateEmployeeModels());
  document.getElementById('councilEmployeeForm')?.addEventListener('submit', saveEmployee);
  document.getElementById('councilEmployeeDelete')?.addEventListener('click', deleteEmployee);
  document.querySelectorAll('[data-close-council-employee]').forEach((button) => button.addEventListener('click', closeEmployeeModal));
  elements.notesList?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-note-action]');
    if (!button) return;
    if (button.dataset.noteAction === 'open') openNote(button.dataset.noteId);
    if (button.dataset.noteAction === 'download') downloadNote(button.dataset.noteId);
  });
  elements.question.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') runMeeting();
  });
  loadNotes();
  loadEmployees();
  persistEmployees();
  renderNotes();
  renderEmployees();
  renderCouncilAttachments();
  resetMeeting(false);
  startIdleGestures();
  initialized = true;
}
