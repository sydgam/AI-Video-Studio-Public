import Phaser from 'phaser';
import { AGENT_DEFINITIONS } from '../config/agentDefinitions';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';
import { OFFICE_ROOMS } from '../config/officeLayout';
import { ExecutiveCharacter, type ExecutiveCharacterConfig } from '../entities/ExecutiveCharacter';
import { gameToReactEvents, reactToGameEvents } from '../events/EventBridge';
import { AgentManager } from '../managers/AgentManager';
import { NavigationEditStorage } from '../managers/NavigationEditStorage';
import { TiledNavigationMapLoader } from '../managers/TiledNavigationMapLoader';
import { NavigationEditorSystem } from '../systems/NavigationEditorSystem';
import { NavigationSystem } from '../systems/NavigationSystem';
import type { NavigationEditableLayer } from '../types/navigationEditor';
import type { AgentDefinition } from '../../types/agent';
import type { EmployeeDepartmentId, EmployeeRecord } from '../../types/employee';

const EMPLOYEE_STORAGE_KEY = 'ai-video-studio:pixel-office-employees:v1';
const ASSET_BASE = `${import.meta.env.BASE_URL}assets/game/`;
const DEPARTMENT_WORK_ANCHORS: Record<EmployeeDepartmentId, string> = {
  strategy: 'strategy-whiteboard', narrative: 'narrative-desk', shot: 'shot-console',
  frame: 'frame-tablet', motion: 'motion-console', quality: 'quality-monitor'
};

const DEFAULT_EMPLOYEES: EmployeeRecord[] = [
  { id: 'employee-narrative-01', name: '윤서', role: '내러티브 라이터', departmentId: 'narrative', appearanceId: 'writer-female-01', personalityId: 'creative', userPrompt: '전체 이야기의 맥락과 감정선을 유지하면서 명료한 서사를 작성한다.' },
  { id: 'employee-shot-01', name: '하린', role: '컷 디자이너', departmentId: 'shot', appearanceId: 'shot-female-01', personalityId: 'proactive', userPrompt: '영상의 리듬과 시선을 고려해 실행 가능한 컷 구성을 빠르게 제안한다.' },
  { id: 'employee-frame-01', name: '민준', role: '프레임 아티스트', departmentId: 'frame', appearanceId: 'artist-male-01', personalityId: 'meticulous', userPrompt: '구도, 조명, 색상과 시각적 연속성을 세밀하게 점검한다.' },
  { id: 'employee-motion-01', name: '서아', role: '모션 디자이너', departmentId: 'motion', appearanceId: 'motion-female-01', personalityId: 'analytical', userPrompt: '동작의 목적과 타이밍을 분석해 자연스럽고 효율적인 모션을 설계한다.' },
  { id: 'employee-quality-01', name: '지우', role: '최종 검수 매니저', departmentId: 'quality', appearanceId: 'strategist-female-01', personalityId: 'collaborative', userPrompt: '요청사항과 전체 결과물을 비교하고 수정 우선순위를 분명하게 정리한다.' }
];

const EMPLOYEE_APPEARANCE_CONFIGS: Record<EmployeeRecord['appearanceId'], ExecutiveCharacterConfig> = {
  'casual-male-01': { id: 'employee', textureId: 'employee-casual-male-01', sourceKey: 'employee-casual-male-source', cropTop: 136, cropHeight: 512, displayHeight: 109 },
  'strategist-female-01': { id: 'employee', textureId: 'employee-strategist-female-01', sourceKey: 'employee-strategist-female-source', cropTop: 108, cropHeight: 534, displayHeight: 109 },
  'writer-female-01': { id: 'employee', textureId: 'employee-writer-female-01', sourceKey: 'employee-writer-female-source', cropTop: 108, cropHeight: 562, displayHeight: 109 },
  'shot-female-01': { id: 'employee', textureId: 'employee-shot-female-01', sourceKey: 'employee-shot-female-source', cropTop: 190, cropHeight: 456, displayHeight: 109 },
  'motion-female-01': { id: 'employee', textureId: 'employee-motion-female-01', sourceKey: 'employee-motion-female-source', cropTop: 138, cropHeight: 518, displayHeight: 109 },
  'artist-male-01': { id: 'employee', textureId: 'employee-artist-male-01', sourceKey: 'employee-artist-male-source', cropTop: 104, cropHeight: 524, displayHeight: 109 }
};

export class OfficeScene extends Phaser.Scene {
  private statusText?: Phaser.GameObjects.Text;
  private unsubscribeTestEvent?: () => void;
  private unsubscribeNavigationDebug?: () => void;
  private unsubscribeAgentCommand?: () => void;
  private unsubscribeAgentSnapshotRequest?: () => void;
  private unsubscribeNavigationEditor?: () => void;
  private unsubscribeNavigationSave?: () => void;
  private unsubscribeNavigationEditTool?: () => void;
  private unsubscribeNavigationDeletePoint?: () => void;
  private unsubscribeNavigationReset?: () => void;
  private unsubscribeNavigationTestStart?: () => void;
  private unsubscribeNavigationTestStop?: () => void;
  private unsubscribeAddEmployee?: () => void;
  private unsubscribeRemoveEmployee?: () => void;
  private councilMessageHandler?: (event: MessageEvent) => void;
  private resetStatusTimer?: Phaser.Time.TimerEvent;
  private navigationSystem?: NavigationSystem;
  private testCharacter?: ExecutiveCharacter;
  private readonly executiveCharacters = new Map<string, ExecutiveCharacter>();
  private readonly employeeCharacters = new Map<string, ExecutiveCharacter>();
  private employees: EmployeeRecord[] = [];
  private agentManager?: AgentManager;
  private destinationMarker?: Phaser.GameObjects.Arc;
  private navigationEditor?: NavigationEditorSystem;
  private navigationMap?: ReturnType<typeof TiledNavigationMapLoader.parse>;
  private originalNavigationMap?: ReturnType<typeof TiledNavigationMapLoader.parse>;
  private editorEnabled = false;
  private editorLayer: NavigationEditableLayer = 'walkable';
  private navigationTestToken = 0;

  constructor() {
    super({ key: 'OfficeScene' });
  }

  preload(): void {
    this.load.image('office-map', `${ASSET_BASE}office-map-v2.png`);
    this.load.image('gpt-executive-source', `${ASSET_BASE}characters/gpt-directional-source-v1.png`);
    this.load.image('claude-executive-source', `${ASSET_BASE}characters/claude-directional-source-v1.png`);
    this.load.image('gemini-executive-source', `${ASSET_BASE}characters/gemini-directional-source-v1.png`);
    this.load.image('employee-casual-male-source', `${ASSET_BASE}characters/employee-casual-male-directional-v1.png`);
    this.load.image('employee-strategist-female-source', `${ASSET_BASE}characters/employee-strategist-female-v1.png`);
    this.load.image('employee-writer-female-source', `${ASSET_BASE}characters/employee-writer-female-v1.png`);
    this.load.image('employee-shot-female-source', `${ASSET_BASE}characters/employee-shot-female-v1.png`);
    this.load.image('employee-motion-female-source', `${ASSET_BASE}characters/employee-motion-female-v1.png`);
    this.load.image('employee-artist-male-source', `${ASSET_BASE}characters/employee-artist-male-v1.png`);
    this.load.tilemapTiledJSON('office-navigation', `${ASSET_BASE}maps/office-navigation-v2.json`);
    this.load.json('office-navigation-recovered', `${ASSET_BASE}maps/office-navigation-latest-20260827.json`);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101622');
    this.add.image(0, 0, 'office-map')
      .setOrigin(0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);

    // Preserve the authored map while lifting the darkest navy areas slightly.
    // Keeping this as a separate light layer makes later day/night tuning cheap.
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xfff1d6, .075)
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(2);

    OFFICE_ROOMS.forEach((room) => {
      this.add.text(GAME_WIDTH * room.labelX, GAME_HEIGHT * room.labelY, room.name, {
        color: '#f5e6c8',
        fontFamily: 'sans-serif',
        fontSize: room.id === 'boardroom' ? '25px' : '19px',
        fontStyle: 'bold',
        backgroundColor: 'rgba(8, 14, 24, 0.82)',
        padding: { x: 12, y: 7 }
      }).setOrigin(0.5).setDepth(10);
    });

    this.statusText = this.add.text(GAME_WIDTH - 24, GAME_HEIGHT - 20, 'Phaser Scene Running', {
      color: '#7dd3fc',
      fontFamily: 'monospace',
      fontSize: '19px',
      backgroundColor: 'rgba(8, 14, 24, 0.78)',
      padding: { x: 10, y: 6 }
    }).setOrigin(1, 1).setDepth(20);

    const originalNavigationMap = TiledNavigationMapLoader.parse(this.make.tilemap({ key: 'office-navigation' }));
    this.originalNavigationMap = structuredClone(originalNavigationMap);
    const recoveredNavigationMap = this.cache.json.get('office-navigation-recovered') as typeof originalNavigationMap | undefined;
    const navigationMap = NavigationEditStorage.load(originalNavigationMap, recoveredNavigationMap);
    this.ensureExecutiveAnchors(navigationMap);
    this.navigationMap = navigationMap;
    this.navigationSystem = new NavigationSystem(this, navigationMap, GAME_WIDTH, GAME_HEIGHT);
    this.navigationEditor = new NavigationEditorSystem(this, navigationMap, this.navigationSystem, (dirty) => {
      gameToReactEvents.emit('NAVIGATION_EDITOR_CHANGED', {
        enabled: this.editorEnabled,
        layer: this.editorLayer,
        dirty
      });
    });
    this.agentManager = new AgentManager(
      this.navigationSystem,
      navigationMap,
      (snapshot) => gameToReactEvents.emit('AGENT_STATE_CHANGED', snapshot)
    );
    const characterConfigs: Record<string, ExecutiveCharacterConfig> = {
      'gpt-executive': { id: 'gpt', sourceKey: 'gpt-executive-source', cropTop: 50, cropHeight: 610 },
      'claude-executive': { id: 'claude', sourceKey: 'claude-executive-source', cropTop: 120, cropHeight: 540, displayWidth: 76, displayHeight: 110 },
      'gemini-executive': { id: 'gemini', sourceKey: 'gemini-executive-source', cropTop: 145, cropHeight: 520, displayWidth: 80, displayHeight: 113 }
    };
    AGENT_DEFINITIONS.forEach((definition) => {
      const spawn = navigationMap.spawns.find((anchor) => anchor.id === definition.spawnAnchorId)?.position
        ?? { x: GAME_WIDTH * .5, y: GAME_HEIGHT * .42 };
      const character = new ExecutiveCharacter(this, spawn.x, spawn.y, characterConfigs[definition.id]);
      this.executiveCharacters.set(definition.id, character);
      this.agentManager?.register(definition, character);
      if (definition.id === 'gpt-executive') this.testCharacter = character;
    });
    this.employees = this.loadEmployees();
    this.saveEmployees();
    this.employees.forEach((employee) => this.addEmployeeToWorld(employee));
    this.destinationMarker = this.add.circle(0, 0, 8, 0xffd166, .9)
      .setStrokeStyle(3, 0xffffff, .9)
      .setDepth(29)
      .setVisible(false);

    this.unsubscribeTestEvent = reactToGameEvents.on('TEST_PHASER_EVENT', ({ message }) => {
      this.statusText?.setText(message);
      gameToReactEvents.emit('TEST_EVENT_RECEIVED', { message });
      this.resetStatusTimer?.remove(false);
      this.resetStatusTimer = this.time.delayedCall(1600, () => {
        this.statusText?.setText('Phaser Scene Running');
      });
    });

    this.unsubscribeNavigationDebug = reactToGameEvents.on('TOGGLE_NAVIGATION_DEBUG', ({ enabled }) => {
      this.navigationSystem?.setDebugVisible(enabled);
      gameToReactEvents.emit('NAVIGATION_DEBUG_CHANGED', { enabled });
    });

    this.unsubscribeAgentCommand = reactToGameEvents.on('COMMAND_AGENT', ({ agentId, command }) => {
      this.agentManager?.command(agentId, command);
    });

    this.unsubscribeAgentSnapshotRequest = reactToGameEvents.on('REQUEST_AGENT_SNAPSHOTS', () => {
      gameToReactEvents.emit('AGENTS_SNAPSHOT', { agents: this.agentManager?.snapshots() ?? [] });
    });

    this.unsubscribeNavigationEditor = reactToGameEvents.on('SET_NAVIGATION_EDITOR', ({ enabled, layer }) => {
      this.editorEnabled = enabled;
      this.editorLayer = layer;
      this.navigationSystem?.setDebugVisible(enabled || this.navigationSystem.isDebugVisible());
      this.navigationEditor?.setMode(enabled, layer);
    });
    this.unsubscribeNavigationSave = reactToGameEvents.on('SAVE_NAVIGATION_EDITS', () => {
      this.navigationEditor?.save();
      gameToReactEvents.emit('NAVIGATION_EDITS_SAVED', { message: '브라우저에 이동 영역을 저장했습니다.' });
    });
    this.unsubscribeNavigationEditTool = reactToGameEvents.on('SET_NAVIGATION_EDIT_TOOL', ({ tool }) => {
      this.navigationEditor?.setTool(tool);
    });
    this.unsubscribeNavigationDeletePoint = reactToGameEvents.on('DELETE_SELECTED_NAVIGATION_POINT', () => {
      const deleted = this.navigationEditor?.deleteSelected() ?? false;
      gameToReactEvents.emit('NAVIGATION_EDITS_SAVED', {
        message: deleted
          ? '선택한 편집점을 삭제했습니다.'
          : '점을 선택하세요. 폴리곤은 최소 3점, 기존 업무 앵커는 안전을 위해 삭제할 수 없습니다.'
      });
    });
    this.unsubscribeNavigationReset = reactToGameEvents.on('RESET_NAVIGATION_EDITS', () => {
      NavigationEditStorage.reset();
      if (this.originalNavigationMap) NavigationEditStorage.save(this.originalNavigationMap);
      this.scene.restart();
      gameToReactEvents.emit('NAVIGATION_EDITS_SAVED', { message: '원본 내비게이션 맵으로 복원했습니다.' });
    });
    this.unsubscribeNavigationTestStart = reactToGameEvents.on('START_NAVIGATION_TEST', () => this.startNavigationTest());
    this.unsubscribeNavigationTestStop = reactToGameEvents.on('STOP_NAVIGATION_TEST', () => this.stopNavigationTest('자동 테스트를 중지했습니다.'));
    this.unsubscribeAddEmployee = reactToGameEvents.on('ADD_EMPLOYEE', (employee) => {
      if (this.employees.some((candidate) => candidate.id === employee.id)) return;
      this.employees.push(employee);
      this.addEmployeeToWorld(employee);
      this.saveEmployees();
      gameToReactEvents.emit('AGENTS_SNAPSHOT', { agents: this.agentManager?.snapshots() ?? [] });
    });
    this.unsubscribeRemoveEmployee = reactToGameEvents.on('REMOVE_EMPLOYEE', ({ employeeId }) => {
      this.agentManager?.unregister(employeeId);
      this.employeeCharacters.get(employeeId)?.destroy();
      this.employeeCharacters.delete(employeeId);
      this.employees = this.employees.filter((employee) => employee.id !== employeeId);
      this.saveEmployees();
      gameToReactEvents.emit('AGENTS_SNAPSHOT', { agents: this.agentManager?.snapshots() ?? [] });
    });
    this.councilMessageHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'COUNCIL_MEETING') return;
      const active = Boolean(event.data.active);
      const invited = new Set(Array.isArray(event.data.invitedEmployeeIds) ? event.data.invitedEmployeeIds : []);
      this.agentManager?.snapshots().forEach((agent) => {
        const isExecutive = agent.departmentId === 'executive';
        const shouldAttend = isExecutive || invited.has(agent.id);
        if (active && shouldAttend) this.agentManager?.command(agent.id, 'JOIN_MEETING');
        else if (active) this.agentManager?.command(agent.id, 'GO_TO_WORK');
        else this.agentManager?.command(agent.id, 'END_MEETING');
      });
    };
    window.addEventListener('message', this.councilMessageHandler);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.editorEnabled) return;
      const areaId = this.navigationSystem?.getAreaIdAt(pointer.worldX, pointer.worldY);
      if (areaId && this.navigationSystem && !this.navigationSystem.isObstacle(pointer.worldX, pointer.worldY) && this.testCharacter) {
        const requestedDestination = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
        const destination = this.navigationSystem.resolveDestination(requestedDestination);
        if (!destination) {
          this.destinationMarker?.setVisible(false);
          this.statusText?.setText('No safe destination nearby');
          gameToReactEvents.emit('SCENE_CLICKED', {
            x: Math.round(pointer.worldX), y: Math.round(pointer.worldY), areaId, walkable: false
          });
          return;
        }
        if (this.agentManager?.moveToPoint('gpt-executive', destination)) {
          this.destinationMarker?.setPosition(destination.x, destination.y).setVisible(true);
          this.statusText?.setText(`Moving to ${areaId}`);
        } else {
          this.destinationMarker?.setVisible(false);
          this.statusText?.setText('No connected route');
        }
      } else {
        this.destinationMarker?.setVisible(false);
        this.statusText?.setText('Blocked area');
      }
      gameToReactEvents.emit('SCENE_CLICKED', {
        x: Math.round(pointer.worldX),
        y: Math.round(pointer.worldY),
        areaId,
        walkable: Boolean(areaId)
      });
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.dispose());
    gameToReactEvents.emit('SCENE_READY', { sceneKey: this.scene.key });
  }

  update(_time: number, delta: number): void {
    this.agentManager?.update(delta);
    // In a 3/4 top-down view, the character whose feet are lower on screen
    // must render in front. A fractional range keeps all characters within
    // the existing character layer while removing creation-order bias.
    this.executiveCharacters.forEach((character) => {
      character.container.setDepth(30 + character.container.y / GAME_HEIGHT);
    });
    this.employeeCharacters.forEach((character) => {
      character.container.setDepth(30 + character.container.y / GAME_HEIGHT);
    });
  }

  private dispose(): void {
    this.navigationTestToken += 1;
    this.unsubscribeTestEvent?.();
    this.unsubscribeTestEvent = undefined;
    this.unsubscribeNavigationDebug?.();
    this.unsubscribeNavigationDebug = undefined;
    this.unsubscribeAgentCommand?.();
    this.unsubscribeAgentCommand = undefined;
    this.unsubscribeAgentSnapshotRequest?.();
    this.unsubscribeAgentSnapshotRequest = undefined;
    this.unsubscribeNavigationEditor?.();
    this.unsubscribeNavigationEditor = undefined;
    this.unsubscribeNavigationSave?.();
    this.unsubscribeNavigationSave = undefined;
    this.unsubscribeNavigationEditTool?.();
    this.unsubscribeNavigationEditTool = undefined;
    this.unsubscribeNavigationDeletePoint?.();
    this.unsubscribeNavigationDeletePoint = undefined;
    this.unsubscribeNavigationReset?.();
    this.unsubscribeNavigationReset = undefined;
    this.unsubscribeNavigationTestStart?.();
    this.unsubscribeNavigationTestStart = undefined;
    this.unsubscribeNavigationTestStop?.();
    this.unsubscribeNavigationTestStop = undefined;
    this.unsubscribeAddEmployee?.();
    this.unsubscribeAddEmployee = undefined;
    this.unsubscribeRemoveEmployee?.();
    this.unsubscribeRemoveEmployee = undefined;
    if (this.councilMessageHandler) window.removeEventListener('message', this.councilMessageHandler);
    this.councilMessageHandler = undefined;
    this.resetStatusTimer?.remove(false);
    this.resetStatusTimer = undefined;
    this.agentManager?.destroy();
    this.agentManager = undefined;
    this.executiveCharacters.forEach((character) => character.destroy());
    this.executiveCharacters.clear();
    this.employeeCharacters.forEach((character) => character.destroy());
    this.employeeCharacters.clear();
    this.employees = [];
    this.testCharacter = undefined;
    this.navigationSystem?.destroy();
    this.navigationSystem = undefined;
    this.navigationEditor?.destroy();
    this.navigationEditor = undefined;
    this.navigationMap = undefined;
    this.originalNavigationMap = undefined;
    this.destinationMarker?.destroy();
    this.destinationMarker = undefined;
  }

  private startNavigationTest(): void {
    const anchorIds = [
      'strategy-whiteboard', 'narrative-desk', 'shot-console', 'frame-tablet',
      'motion-console', 'quality-monitor', 'executive-command-position', 'test-spawn'
    ];
    const token = ++this.navigationTestToken;
    let failures = 0;
    const visit = (index: number) => {
      if (token !== this.navigationTestToken) return;
      if (index >= anchorIds.length) {
        gameToReactEvents.emit('NAVIGATION_TEST_PROGRESS', {
          running: false, current: anchorIds.length, total: anchorIds.length,
          success: failures === 0, message: failures ? `자동 이동 테스트 완료: ${failures}개 경로 실패` : '전체 자동 이동 테스트가 완료되었습니다.'
        });
        return;
      }
      const anchorId = anchorIds[index];
      gameToReactEvents.emit('NAVIGATION_TEST_PROGRESS', {
        running: true, current: index + 1, total: anchorIds.length, anchorId,
        message: `${anchorId} 이동 테스트 중`
      });
      let finished = false;
      let watchdog: Phaser.Time.TimerEvent | undefined;
      const finish = (success: boolean) => {
        if (finished || token !== this.navigationTestToken) return;
        finished = true;
        watchdog?.remove(false);
        if (!success) {
          failures += 1;
          this.agentManager?.stop('gpt-executive');
        }
        gameToReactEvents.emit('NAVIGATION_TEST_PROGRESS', {
          running: true, current: index + 1, total: anchorIds.length, anchorId,
          success, message: success ? `${anchorId} 도착 성공` : `${anchorId} 이동 실패 — 다음 위치를 검사합니다.`
        });
        this.time.delayedCall(350, () => visit(index + 1));
      };
      const started = this.agentManager?.moveToAnchorId('gpt-executive', anchorId, () => finish(true));
      if (!started) finish(false);
      else if (!finished) {
        const startedAt = this.time.now;
        watchdog = this.time.addEvent({ delay: 250, loop: true, callback: () => {
          if (token !== this.navigationTestToken) { watchdog?.remove(false); return; }
          const state = this.agentManager?.snapshots().find((agent) => agent.id === 'gpt-executive')?.state;
          if (state !== 'moving' || this.time.now - startedAt > 30000) finish(false);
        }});
      }
    };
    visit(0);
  }

  private stopNavigationTest(message: string): void {
    this.navigationTestToken += 1;
    this.agentManager?.stop('gpt-executive');
    gameToReactEvents.emit('NAVIGATION_TEST_PROGRESS', {
      running: false, current: 0, total: 0, message
    });
  }

  private ensureExecutiveAnchors(navigationMap: ReturnType<typeof TiledNavigationMapLoader.parse>): void {
    const walkable = navigationMap.walkable as {
      id: string; roomId?: string; points: { x: number; y: number }[]
    }[];
    const spawns = navigationMap.spawns as { id: string; position: { x: number; y: number }; role?: string }[];
    const interactions = navigationMap.interactionAnchors as {
      id: string; position: { x: number; y: number }; facing?: string; actionType?: string; objectId?: string
    }[];
    const addIfMissing = <T extends { id: string }>(items: T[], item: T) => {
      if (!items.some((candidate) => candidate.id === item.id)) items.push(item);
    };
    // The authored strategy room and commons polygons visually meet at the open
    // hallway, but their narrow overlap is smaller than the character clearance.
    // This L-shaped floor bridge follows the visible doorway and lower corridor.
    addIfMissing(walkable, {
      id: 'strategy-corridor-bridge',
      roomId: 'strategy',
      points: [
        { x: 210, y: 315 }, { x: 300, y: 315 },
        { x: 300, y: 390 }, { x: 535, y: 390 },
        { x: 535, y: 438 }, { x: 210, y: 438 }
      ]
    });
    addIfMissing(spawns, { id: 'claude-executive-spawn', position: { x: 900, y: 450 }, role: 'executive' });
    // Connect the art-room doorway to the corridor above the review room.
    // The recovered map stopped at the door, leaving this visible floor disconnected.
    addIfMissing(walkable, {
      id: 'frame-corridor-bridge', roomId: 'commons',
      points: [
        { x: 1390, y: 396 }, { x: 1695, y: 396 },
        { x: 1695, y: 423 }, { x: 1390, y: 423 }
      ]
    });
    addIfMissing(spawns, { id: 'gpt-executive-spawn', position: { x: 960, y: 450 }, role: 'executive' });
    addIfMissing(spawns, { id: 'gemini-executive-spawn', position: { x: 1020, y: 450 }, role: 'executive' });
    addIfMissing(interactions, { id: 'claude-executive-position', position: { x: 770, y: 740 }, facing: 'south', actionType: 'executive-work' });
    addIfMissing(interactions, { id: 'gpt-executive-position', position: { x: 1089, y: 747 }, facing: 'south', actionType: 'executive-work' });
    addIfMissing(interactions, { id: 'gemini-executive-position', position: { x: 1179, y: 747 }, facing: 'south', actionType: 'executive-work' });
  }

  private addEmployeeToWorld(employee: EmployeeRecord): void {
    if (!this.navigationMap || !this.navigationSystem || !this.agentManager) return;
    const workAnchorId = DEPARTMENT_WORK_ANCHORS[employee.departmentId];
    const workAnchor = this.navigationMap.interactionAnchors.find((anchor) => anchor.id === workAnchorId);
    const fallback = new Phaser.Math.Vector2(960, 450);
    const workPosition = workAnchor
      ? this.navigationSystem.resolveDestination(new Phaser.Math.Vector2(workAnchor.position.x, workAnchor.position.y), 180) ?? fallback
      : fallback;
    if (workAnchor) workAnchor.position = { x: workPosition.x, y: workPosition.y };
    const index = this.employees.findIndex((candidate) => candidate.id === employee.id);
    const spawnPosition = this.navigationSystem.resolveDestination(
      workPosition.clone().add(new Phaser.Math.Vector2((index % 3 - 1) * 28, 24))
    ) ?? workPosition;
    const meetingCandidates = [
      new Phaser.Math.Vector2(625, 770), new Phaser.Math.Vector2(625, 815), new Phaser.Math.Vector2(625, 860),
      new Phaser.Math.Vector2(1300, 770), new Phaser.Math.Vector2(1300, 815), new Phaser.Math.Vector2(1300, 860)
    ];
    const orderedMeetingCandidates = meetingCandidates.map((_, offset) => meetingCandidates[(index + offset) % meetingCandidates.length]);
    const meetingPosition = this.resolveReachableDestination(spawnPosition, orderedMeetingCandidates)
      ?? spawnPosition;
    const spawnAnchorId = `${employee.id}-spawn`;
    const meetingAnchorId = `${employee.id}-meeting`;
    const spawns = this.navigationMap.spawns as { id: string; position: { x: number; y: number }; role?: string }[];
    const interactions = this.navigationMap.interactionAnchors as {
      id: string; position: { x: number; y: number }; facing?: string; actionType?: string
    }[];
    const storedSpawn = spawns.find((anchor) => anchor.id === spawnAnchorId);
    if (storedSpawn) {
      storedSpawn.position = { x: spawnPosition.x, y: spawnPosition.y };
      storedSpawn.role = 'employee';
    } else {
      spawns.push({ id: spawnAnchorId, position: { x: spawnPosition.x, y: spawnPosition.y }, role: 'employee' });
    }
    const storedMeeting = interactions.find((anchor) => anchor.id === meetingAnchorId);
    if (storedMeeting) {
      storedMeeting.position = { x: meetingPosition.x, y: meetingPosition.y };
      storedMeeting.facing = 'north';
      storedMeeting.actionType = 'join-meeting';
    } else {
      interactions.push({
        id: meetingAnchorId, position: { x: meetingPosition.x, y: meetingPosition.y },
        facing: 'north', actionType: 'join-meeting'
      });
    }
    const definition: AgentDefinition = {
      id: employee.id,
      name: employee.name,
      model: 'custom',
      departmentId: employee.departmentId,
      role: employee.role,
      spawnAnchorId,
      workAnchorId,
      meetingAnchorId
    };
    const appearance = EMPLOYEE_APPEARANCE_CONFIGS[employee.appearanceId] ?? EMPLOYEE_APPEARANCE_CONFIGS['casual-male-01'];
    const character = new ExecutiveCharacter(this, spawnPosition.x, spawnPosition.y, {
      ...appearance,
      id: employee.id
    });
    this.employeeCharacters.set(employee.id, character);
    this.agentManager.register(definition, character);
  }

  private resolveReachableDestination(
    start: Phaser.Math.Vector2,
    candidates: readonly Phaser.Math.Vector2[]
  ): Phaser.Math.Vector2 | undefined {
    if (!this.navigationSystem) return undefined;
    for (const candidate of candidates) {
      const destination = this.navigationSystem.resolveDestination(candidate, 140);
      if (destination && this.navigationSystem.findPath(start, destination)) return destination;
    }
    return undefined;
  }

  private loadEmployees(): EmployeeRecord[] {
    try {
      const value = window.localStorage.getItem(EMPLOYEE_STORAGE_KEY);
      if (!value) return DEFAULT_EMPLOYEES.map((employee) => ({ ...employee }));
      const stored = JSON.parse(value) as Partial<EmployeeRecord>[];
      const migrated = stored.map((employee, index) => ({
        ...employee,
        id: employee.id ?? `employee-migrated-${index}`,
        name: employee.name ?? `직원 ${index + 1}`,
        role: employee.role ?? 'AI 영상 제작 직원',
        departmentId: employee.departmentId ?? 'strategy',
        appearanceId: employee.appearanceId ?? 'casual-male-01',
        personalityId: employee.personalityId ?? 'balanced',
        userPrompt: employee.userPrompt ?? ''
      })) as EmployeeRecord[];
      if (migrated.length === 1) {
        const usedDepartments = new Set(migrated.map((employee) => employee.departmentId));
        DEFAULT_EMPLOYEES.forEach((employee) => {
          if (!usedDepartments.has(employee.departmentId)) migrated.push({ ...employee });
        });
      }
      return migrated;
    } catch {
      return [];
    }
  }

  private saveEmployees(): void {
    window.localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(this.employees));
  }
}
