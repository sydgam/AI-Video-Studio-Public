import { CHARACTER_SPEC, CharacterStateMachine, directionFromVector } from './characterSystem.js';

const EXECUTIVES = {
  anthropic: { name: 'Claude', sprite: './assets/council/sprite-claude-v1.png', seatedSprite: './assets/council/seated-claude-v2.png', zone: 'executive', x: .425, y: .305 },
  openai: { name: 'GPT', sprite: './assets/council/sprite-gpt-v2.png', seatedSprite: './assets/council/seated-gpt-v1.png', zone: 'executive', x: .525, y: .305 },
  gemini: { name: 'Gemini', sprite: './assets/council/sprite-gemini-v3.png', seatedSprite: './assets/council/seated-gemini-v2.png', zone: 'executive', x: .615, y: .305 }
};

const ZONES = {
  executive: { left: .39, right: .65, top: .278, bottom: .302, objectY: .295 },
  strategy: { left: .17, right: .38, top: .625, bottom: .65, objectY: .642 },
  script: { left: .43, right: .65, top: .625, bottom: .65, objectY: .642 },
  board: { left: .70, right: .93, top: .625, bottom: .65, objectY: .642 },
  visual: { left: .20, right: .35, top: .91, bottom: .945, objectY: .932 },
  motion: { left: .47, right: .61, top: .91, bottom: .945, objectY: .932 },
  quality: { left: .74, right: .90, top: .91, bottom: .945, objectY: .932 }
};

const SEATS = {
  anthropic: { x: .425, y: .296 },
  openai: { x: .525, y: .296 },
  gemini: { x: .615, y: .296 }
};

const ELEVATOR_X = .105;
const FLOOR_LANDINGS = { third: .305, second: .642, first: .932 };
const GUEST_SEATS = [
  { x: .345, y: .307 }, { x: .690, y: .307 },
  { x: .315, y: .307 }, { x: .720, y: .307 }
];

const imageCache = new Map();
let canvas;
let context;
let background;
let executiveRoomShell;
let executiveTable;
let executiveChairs;
let productionFloorShell;
let strategyDesk;
let writersDesk;
let shotDesk;
let characters = [];
let running = false;
let meeting = false;
let lastFrame = 0;
let clickHandler = null;

function loadImage(source) {
  if (imageCache.has(source)) return imageCache.get(source);
  const image = new Image();
  image.decoding = 'async';
  image.src = source;
  imageCache.set(source, image);
  return image;
}

function createCharacter(data) {
  const initialState = data.kind === 'executive' && data.seatedSprite ? 'seated' : 'idle';
  return {
    ...data,
    image: loadImage(data.sprite),
    seatedImage: data.seatedSprite ? loadImage(data.seatedSprite) : null,
    x: data.x,
    y: data.y,
    targetX: data.x,
    targetY: data.y,
    homeX: data.x,
    homeY: data.y,
    route: [],
    routeFinalState: 'idle',
    frame: 0,
    machine: new CharacterStateMachine(initialState),
    walkTick: 0,
    pauseUntil: performance.now() + 800 + Math.random() * 1800,
    state: 'idle',
    width: data.kind === 'executive' ? .036 : .043,
    height: data.kind === 'executive' ? .124 : .145
  };
}

function chooseTarget(character, now) {
  const zone = ZONES[character.zone] || ZONES.strategy;
  const rangeX = Math.min(.018, (zone.right - zone.left) * .16);
  const rangeY = Math.min(.008, (zone.bottom - zone.top) * .08);
  character.targetX = Math.max(zone.left, Math.min(zone.right, character.x + (Math.random() - .5) * rangeX));
  character.targetY = Math.max(zone.top, Math.min(zone.bottom, character.y + (Math.random() - .5) * rangeY));
  character.pauseUntil = now + 1400 + Math.random() * 2400;
}

function updateCharacter(character, delta, now) {
  character.machine.update(delta);
  if (character.kind === 'executive' && character.seatedImage) {
    const seat = SEATS[character.key];
    character.x = seat.x;
    character.y = .305;
    character.targetX = character.x;
    character.targetY = character.y;
    const nextState = meeting || character.status === 'thinking' ? 'talk' : 'seated';
    character.machine.setState(nextState, { force: true, direction: 'front' });
    character.frame = character.machine.getLegacyFrame();
    character.state = character.machine.state;
    return;
  }
  if (character.route.length) {
    character.targetX = character.route[0].x;
    character.targetY = character.route[0].y;
  } else if (meeting && character.kind === 'executive') {
    const seat = SEATS[character.key];
    character.targetX = seat.x;
    character.targetY = seat.y;
  } else if (now >= character.pauseUntil && Math.abs(character.targetX - character.x) < .002 && Math.abs(character.targetY - character.y) < .002) {
    chooseTarget(character, now);
  }
  const dx = character.targetX - character.x;
  const dy = character.targetY - character.y;
  const distance = Math.hypot(dx, dy);
  if (distance > CHARACTER_SPEC.arrivalDistance) {
    const direction = directionFromVector(dx, dy);
    const motionState = character.intent === 'run' ? 'run' : 'walk';
    character.machine.setState(motionState, { direction });
    const unitsPerSecond = motionState === 'run' ? CHARACTER_SPEC.runSpeed : CHARACTER_SPEC.walkSpeed;
    const speed = Math.min(distance, unitsPerSecond * delta / 1000);
    character.x += dx / distance * speed;
    character.y += dy / distance * speed;
    character.frame = character.machine.getLegacyFrame();
    character.state = character.machine.state;
  } else {
    character.x = character.targetX;
    character.y = character.targetY;
    if (character.route.length) {
      character.route.shift();
      if (character.route.length) {
        character.targetX = character.route[0].x;
        character.targetY = character.route[0].y;
        character.machine.setState('run', { force: true });
        character.state = character.machine.state;
        character.frame = character.machine.getLegacyFrame();
        return;
      } else {
        character.intent = '';
        character.machine.setState(character.routeFinalState, { force: true, direction: 'front' });
        character.state = character.machine.state;
        character.frame = character.machine.getLegacyFrame();
        character.pauseUntil = now + 3000;
        return;
      }
    }
    character.machine.setState(character.atMeeting ? 'talk' : 'idle');
    character.frame = character.machine.getLegacyFrame();
    character.state = character.machine.state;
  }
}

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function drawCharacter(character) {
  const isSeated = character.kind === 'executive' && character.seatedImage;
  const image = isSeated ? character.seatedImage : character.image;
  if (!image.complete || !image.naturalWidth) return;
  const frameWidth = isSeated ? image.naturalWidth : image.naturalWidth / 5;
  const frameHeight = image.naturalHeight;
  const drawHeight = canvas.height * (isSeated ? .17 : character.height);
  const drawWidth = canvas.width * (isSeated ? .09 : character.width);
  const motionPhase = character.machine?.elapsed || 0;
  const isTalking = character.machine?.state === 'talk';
  const idleLift = isSeated ? Math.round(Math.sin(motionPhase / 720 + character.x * 10)) : 0;
  const talkLift = isTalking ? Math.round(Math.abs(Math.sin(motionPhase / 150)) * 2) : 0;
  const x = canvas.width * character.x - drawWidth / 2;
  const y = canvas.height * character.y - drawHeight - idleLift - talkLift;
  context.save();
  context.fillStyle = 'rgba(24,18,15,.30)';
  context.beginPath();
  context.ellipse(canvas.width * character.x, canvas.height * character.y - 1, drawWidth * .30, Math.max(2, drawHeight * .025), 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
  context.save();
  context.imageSmoothingEnabled = false;
  context.globalAlpha = .96;
  context.filter = character.kind === 'executive'
    ? 'saturate(.86) brightness(.98) contrast(.96)'
    : 'saturate(.82) brightness(.92) sepia(.06)';
  context.shadowColor = 'rgba(25,17,13,.30)';
  context.shadowBlur = 1;
  context.shadowOffsetY = 1;
  context.drawImage(image, isSeated ? 0 : frameWidth * character.frame, 0, frameWidth, frameHeight, x, y, drawWidth, drawHeight);
  context.restore();

  // The supplied Gemini sheet uses the logo itself as the entire face. Overlay
  // that authoritative faceless head on the seated composite as well.
  if (isSeated && character.key === 'gemini' && character.image.complete && character.image.naturalWidth) {
    const logoFrameWidth = character.image.naturalWidth / 5;
    context.save();
    context.imageSmoothingEnabled = false;
    context.drawImage(
      character.image,
      0, 0, logoFrameWidth, character.image.naturalHeight * .48,
      x + drawWidth * .14, y - drawHeight * .005,
      drawWidth * .72, drawHeight * .42
    );
    context.restore();
  }
  character.hitbox = { x, y, width: drawWidth, height: drawHeight };
  if (character.machine?.state === 'talk' || character.status === 'thinking') {
    const bubbleY = y - 8;
    context.fillStyle = character.status === 'thinking' ? '#8ee8ff' : '#fff3cf';
    context.strokeStyle = '#263047';
    context.lineWidth = Math.max(1, canvas.width / 900);
    context.fillRect(x + drawWidth * .28, bubbleY, drawWidth * .44, 5);
    context.strokeRect(x + drawWidth * .28, bubbleY, drawWidth * .44, 5);
  }
}

function drawExecutiveRoomBack() {
  if (executiveRoomShell?.complete && executiveRoomShell.naturalWidth) {
    const cropTop = executiveRoomShell.naturalHeight * .17;
    const cropHeight = executiveRoomShell.naturalHeight * .66;
    context.drawImage(executiveRoomShell, 0, cropTop, executiveRoomShell.naturalWidth, cropHeight, 0, 0, canvas.width, canvas.height * .35);
  }
}

function drawExecutiveRoomFront() {
  if (!executiveTable?.complete || !executiveTable.naturalWidth) return;
  // Keep the furniture's source aspect ratio. The previous shallow crop removed
  // the legs and stretched the tabletop down through the third-floor boundary.
  const source = { x: 32, y: 145, width: 2110, height: 420 };
  const drawWidth = canvas.width * .37;
  const drawHeight = drawWidth / (source.width / source.height);
  const floorBoundaryY = canvas.height * .329;
  const x = (canvas.width - drawWidth) / 2;
  const y = floorBoundaryY - drawHeight;
  context.drawImage(
    executiveTable,
    source.x, source.y, source.width, source.height,
    x, y, drawWidth, drawHeight
  );
}

function drawCropped(image, source, destination) {
  if (!image?.complete || !image.naturalWidth) return;
  context.drawImage(
    image,
    source.x, source.y, source.width, source.height,
    canvas.width * destination.x, canvas.height * destination.y,
    canvas.width * destination.width, canvas.height * destination.height
  );
}

function drawProductionFloorBack() {
  if (!productionFloorShell?.complete || !productionFloorShell.naturalWidth) return;
  const cropTop = productionFloorShell.naturalHeight * .22;
  const cropHeight = productionFloorShell.naturalHeight * .53;
  context.drawImage(
    productionFloorShell,
    0, cropTop, productionFloorShell.naturalWidth, cropHeight,
    0, canvas.height * .35, canvas.width, canvas.height * .315
  );
}

function drawProductionFloorFront() {
  // 2층은 서로 다른 비율의 전경 PNG를 얹지 않고 통일된 방 셸을 사용합니다.
}

function render(now) {
  if (!running) return;
  if (document.hidden) {
    lastFrame = now;
    window.requestAnimationFrame(render);
    return;
  }
  resizeCanvas();
  const delta = Math.min(50, now - lastFrame || 16);
  lastFrame = now;
  if (background?.complete) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;
    context.drawImage(background, 0, 0, canvas.width, canvas.height);
  }
  drawExecutiveRoomBack();
  drawProductionFloorBack();
  characters.forEach((character) => updateCharacter(character, delta, now));
  const executives = characters.filter((character) => character.kind === 'executive').sort((a, b) => a.y - b.y);
  const staff = characters.filter((character) => character.kind === 'employee').sort((a, b) => a.y - b.y);
  executives.forEach(drawCharacter);
  drawExecutiveRoomFront();
  drawProductionFloorFront();
  staff.forEach(drawCharacter);
  window.requestAnimationFrame(render);
}

function handleClick(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  const target = [...characters].reverse().find((character) => {
    const box = character.hitbox;
    return box && x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
  });
  if (target?.kind === 'employee') clickHandler?.(target.id);
}

export function initCouncilGame(targetCanvas, onEmployeeClick) {
  if (!targetCanvas || running) return;
  canvas = targetCanvas;
  context = canvas.getContext('2d', { alpha: false });
  background = loadImage('./assets/council/pixel-studio-hq-v1.png');
  executiveRoomShell = loadImage('./assets/council/room-executive-silver-shell-v1.png');
  executiveTable = loadImage('./assets/council/room-executive-silver-table-v1.png');
  executiveChairs = loadImage('./assets/council/room-executive-silver-chairs-v1.png');
  productionFloorShell = loadImage('./assets/council/floor2-production-shell-v1.png');
  strategyDesk = loadImage('./assets/council/floor2-desk-strategy-v1.png');
  writersDesk = loadImage('./assets/council/floor2-desk-writers-v1.png');
  shotDesk = loadImage('./assets/council/floor2-desk-shot-v1.png');
  clickHandler = onEmployeeClick;
  characters = Object.entries(EXECUTIVES).map(([key, data]) => createCharacter({ ...data, key, id: key, kind: 'executive' }));
  canvas.addEventListener('click', handleClick);
  running = true;
  window.requestAnimationFrame(render);
}

export function setCouncilGameEmployees(employees) {
  const executives = characters.filter((character) => character.kind === 'executive');
  const departmentCount = {};
  const staff = employees.map((employee) => {
    const zone = ZONES[employee.department] || ZONES.strategy;
    const index = departmentCount[employee.department] || 0;
    departmentCount[employee.department] = index + 1;
    const columns = [-.075, .075, 0];
    return createCharacter({
      id: employee.id,
      kind: 'employee',
      name: employee.name,
      zone: employee.department,
      sprite: `./assets/council/${employee.sprite || 'sprite-employee-male-v1.png'}`,
      x: (zone.left + zone.right) / 2 + columns[index % 3],
      y: zone.objectY + Math.floor(index / 3) * .025
    });
  });
  characters = [...executives, ...staff];
}

function routeToMeeting(character, guestIndex) {
  const seat = GUEST_SEATS[guestIndex % GUEST_SEATS.length];
  const route = [{ x: ELEVATOR_X, y: character.homeY }];
  if (character.homeY > .75) route.push({ x: ELEVATOR_X, y: FLOOR_LANDINGS.second });
  route.push({ x: ELEVATOR_X, y: FLOOR_LANDINGS.third }, seat);
  character.route = route;
  character.routeFinalState = 'talk';
  character.atMeeting = true;
  character.intent = 'run';
  character.pauseUntil = Number.POSITIVE_INFINITY;
}

function routeHome(character) {
  const route = [
    { x: ELEVATOR_X, y: FLOOR_LANDINGS.third },
    { x: ELEVATOR_X, y: FLOOR_LANDINGS.second }
  ];
  if (character.homeY > .75) route.push({ x: ELEVATOR_X, y: FLOOR_LANDINGS.first });
  route.push({ x: character.homeX, y: character.homeY });
  character.route = route;
  character.routeFinalState = 'idle';
  character.atMeeting = false;
  character.intent = 'run';
  character.pauseUntil = Number.POSITIVE_INFINITY;
}

export function setCouncilGameMeeting(active, invitedEmployeeIds = []) {
  meeting = Boolean(active);
  characters.filter((character) => character.kind === 'executive').forEach((character) => {
    character.machine.clearQueue();
    character.machine.setState(meeting ? 'talk' : 'seated', { force: true, direction: 'front' });
    character.pauseUntil = 0;
    if (!meeting) chooseTarget(character, performance.now());
  });
  const invited = new Set(invitedEmployeeIds);
  characters.filter((character) => character.kind === 'employee').forEach((character, index) => {
    if (meeting && invited.has(character.id)) routeToMeeting(character, index);
    else if (!meeting && character.atMeeting) routeHome(character);
  });
}

export function setCouncilGameMemberState(key, status) {
  const character = characters.find((item) => item.key === key);
  if (!character) return;
  character.status = status;
  if (character.kind === 'executive' && character.seatedImage) {
    character.machine.setState(status === 'thinking' ? 'talk' : 'seated', { force: true, direction: 'front' });
  }
}
