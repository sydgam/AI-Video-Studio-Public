export const CHARACTER_SPEC = Object.freeze({
  logicalFrameWidth: 96,
  logicalFrameHeight: 128,
  footAnchorX: .5,
  footAnchorY: .94,
  directions: ['front', 'back', 'left', 'right'],
  states: ['idle', 'walk', 'run', 'sitDown', 'seated', 'standUp', 'work', 'interact', 'talk'],
  walkSpeed: .0105,
  runSpeed: .16,
  arrivalDistance: .0015
});

export const STATE_DEFINITIONS = Object.freeze({
  idle: { loop: true, fps: 2, duration: Infinity },
  walk: { loop: true, fps: 6, duration: Infinity },
  run: { loop: true, fps: 10, duration: Infinity },
  sitDown: { loop: false, fps: 6, duration: 520, next: 'seated' },
  seated: { loop: true, fps: 2, duration: Infinity },
  standUp: { loop: false, fps: 6, duration: 520, next: 'idle' },
  work: { loop: true, fps: 4, duration: Infinity },
  interact: { loop: true, fps: 4, duration: Infinity },
  talk: { loop: true, fps: 5, duration: Infinity }
});

const TRANSITIONS = Object.freeze({
  idle: ['walk', 'run', 'sitDown', 'work', 'interact', 'talk'],
  walk: ['idle', 'run', 'sitDown', 'interact'],
  run: ['idle', 'walk', 'sitDown'],
  sitDown: ['seated'],
  seated: ['standUp', 'talk', 'work'],
  standUp: ['idle', 'walk', 'run'],
  work: ['idle', 'walk', 'run', 'talk'],
  interact: ['idle', 'walk', 'run'],
  talk: ['idle', 'seated', 'standUp']
});

// 현재 5프레임 시트가 제공하지 않는 동작은 가장 가까운 안전 프레임으로 대체합니다.
export const LEGACY_FALLBACK_FRAMES = Object.freeze({
  idle: { front: [0], back: [3], left: [4], right: [4] },
  walk: { front: [1, 2], back: [3], left: [4], right: [1, 2] },
  run: { front: [1, 2], back: [3], left: [4], right: [1, 2] },
  sitDown: { front: [0], back: [3], left: [4], right: [4] },
  seated: { front: [0], back: [3], left: [4], right: [4] },
  standUp: { front: [0], back: [3], left: [4], right: [4] },
  work: { front: [0], back: [3], left: [4], right: [4] },
  interact: { front: [0], back: [3], left: [4], right: [4] },
  talk: { front: [0], back: [3], left: [4], right: [4] }
});

export class CharacterStateMachine {
  constructor(initialState = 'idle') {
    this.state = STATE_DEFINITIONS[initialState] ? initialState : 'idle';
    this.direction = 'front';
    this.elapsed = 0;
    this.queue = [];
    this.locked = false;
  }

  canTransition(next) {
    return next === this.state || Boolean(TRANSITIONS[this.state]?.includes(next));
  }

  setState(next, { force = false, direction } = {}) {
    if (!STATE_DEFINITIONS[next]) return false;
    if (!force && (this.locked || !this.canTransition(next))) return false;
    if (direction && CHARACTER_SPEC.directions.includes(direction)) this.direction = direction;
    if (next !== this.state) {
      this.state = next;
      this.elapsed = 0;
    }
    this.locked = ['sitDown', 'standUp'].includes(next);
    return true;
  }

  enqueue(state, options = {}) {
    this.queue.push({ state, options });
  }

  clearQueue() {
    this.queue.length = 0;
  }

  update(delta) {
    this.elapsed += delta;
    const definition = STATE_DEFINITIONS[this.state];
    if (Number.isFinite(definition.duration) && this.elapsed >= definition.duration) {
      this.locked = false;
      const queued = this.queue.shift();
      if (queued) this.setState(queued.state, { ...queued.options, force: true });
      else if (definition.next) this.setState(definition.next, { force: true });
    }
  }

  getLegacyFrame() {
    const definition = STATE_DEFINITIONS[this.state];
    const frames = LEGACY_FALLBACK_FRAMES[this.state]?.[this.direction] || [0];
    const frameDuration = 1000 / definition.fps;
    return frames[Math.floor(this.elapsed / frameDuration) % frames.length];
  }
}

export function directionFromVector(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'back' : 'front';
}
