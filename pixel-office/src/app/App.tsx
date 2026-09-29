import { useEffect, useState } from 'react';
import type { AgentCommand, AgentSnapshot, AgentState } from '../types/agent';
import { PhaserGame } from '../components/game/PhaserGame';
import { gameToReactEvents, reactToGameEvents } from '../game/events/EventBridge';
import type { NavigationEditableLayer, NavigationEditTool, NavigationTestResult } from '../game/types/navigationEditor';
import type { EmployeeAppearanceId, EmployeeDepartmentId, EmployeePersonalityId, EmployeeRecord } from '../types/employee';

const EDITABLE_LAYERS: { value: NavigationEditableLayer; label: string }[] = [
  { value: 'walkable', label: '이동 가능 영역' },
  { value: 'collisions', label: '충돌 영역' },
  { value: 'doors', label: '출입구' },
  { value: 'interactionAnchors', label: '상호작용 지점' },
  { value: 'seats', label: '좌석 지점' },
  { value: 'spawns', label: '시작 지점' },
  { value: 'waypoints', label: '경유 지점' }
];

const EMPLOYEE_DEPARTMENTS: { value: EmployeeDepartmentId; label: string }[] = [
  { value: 'strategy', label: '콘셉트 전략실' },
  { value: 'narrative', label: '내러티브 작가실' },
  { value: 'shot', label: '컷 설계실' },
  { value: 'frame', label: '프레임 미술실' },
  { value: 'motion', label: '모션 제작실' },
  { value: 'quality', label: '최종 검수실' }
];

const EMPLOYEE_PERSONALITIES: { value: EmployeePersonalityId; label: string; description: string }[] = [
  { value: 'balanced', label: '균형형', description: '창의성과 정확성을 고르게 유지' },
  { value: 'creative', label: '창의형', description: '새롭고 과감한 아이디어를 우선' },
  { value: 'analytical', label: '분석형', description: '근거와 구조를 중심으로 판단' },
  { value: 'meticulous', label: '꼼꼼형', description: '오류와 세부 완성도를 우선 점검' },
  { value: 'proactive', label: '추진형', description: '빠른 실행과 결과 도출을 우선' },
  { value: 'collaborative', label: '협업형', description: '다른 직원의 맥락과 의견을 적극 반영' }
];

const EMPLOYEE_APPEARANCES: { value: EmployeeAppearanceId; label: string }[] = [
  { value: 'casual-male-01', label: '캐주얼 남성 01' },
  { value: 'strategist-female-01', label: '전략가 여성 01' },
  { value: 'writer-female-01', label: '작가 여성 01' },
  { value: 'shot-female-01', label: '컷 디자이너 여성 01' },
  { value: 'motion-female-01', label: '모션 여성 01' },
  { value: 'artist-male-01', label: '프레임 남성 01' }
];

export function App() {
  const embedded = new URLSearchParams(window.location.search).get('embedded') === 'council';
  const [status, setStatus] = useState('Ready');
  const [testCount, setTestCount] = useState(0);
  const [navigationDebug, setNavigationDebug] = useState(false);
  const [agents, setAgents] = useState<Record<string, AgentSnapshot>>({});
  const [editorEnabled, setEditorEnabled] = useState(false);
  const [editorLayer, setEditorLayer] = useState<NavigationEditableLayer>('walkable');
  const [editorDirty, setEditorDirty] = useState(false);
  const [editorTool, setEditorTool] = useState<NavigationEditTool>('move');
  const [navigationTest, setNavigationTest] = useState<NavigationTestResult>({
    running: false, current: 0, total: 0, message: '자동 테스트 대기 중'
  });
  const [employeeName, setEmployeeName] = useState('');
  const [employeeRole, setEmployeeRole] = useState('AI 영상 제작 직원');
  const [employeeDepartment, setEmployeeDepartment] = useState<EmployeeDepartmentId>('strategy');
  const [employeePersonality, setEmployeePersonality] = useState<EmployeePersonalityId>('balanced');
  const [employeeAppearance, setEmployeeAppearance] = useState<EmployeeAppearanceId>('strategist-female-01');
  const [employeePrompt, setEmployeePrompt] = useState('');

  useEffect(() => {
    const offReady = gameToReactEvents.on('SCENE_READY', ({ sceneKey }) => {
      setStatus(`${sceneKey} Ready`);
    });
    const offClick = gameToReactEvents.on('SCENE_CLICKED', ({ x, y, areaId, walkable }) => {
      setStatus(`World ${x}, ${y} · ${walkable ? areaId : 'blocked'}`);
    });
    const offTestReceived = gameToReactEvents.on('TEST_EVENT_RECEIVED', ({ message }) => {
      setStatus(`Phaser received: ${message}`);
    });
    const offNavigationDebug = gameToReactEvents.on('NAVIGATION_DEBUG_CHANGED', ({ enabled }) => {
      setNavigationDebug(enabled);
      setStatus(`Navigation debug: ${enabled ? 'On' : 'Off'}`);
    });
    const offAgentState = gameToReactEvents.on('AGENT_STATE_CHANGED', (agent) => {
      setAgents((current) => ({ ...current, [agent.id]: agent }));
      if (embedded) window.parent.postMessage({ type: 'PIXEL_AGENT_STATE', agent }, window.location.origin);
    });
    const offAgentSnapshot = gameToReactEvents.on('AGENTS_SNAPSHOT', ({ agents: snapshots }) => {
      setAgents(Object.fromEntries(snapshots.map((agent) => [agent.id, agent])));
      if (embedded) window.parent.postMessage({ type: 'PIXEL_AGENTS_SNAPSHOT', agents: snapshots }, window.location.origin);
    });
    const offEditor = gameToReactEvents.on('NAVIGATION_EDITOR_CHANGED', ({ enabled, layer, dirty }) => {
      setEditorEnabled(enabled);
      setEditorLayer(layer);
      setEditorDirty(dirty);
    });
    const offSaved = gameToReactEvents.on('NAVIGATION_EDITS_SAVED', ({ message }) => setStatus(message));
    const offNavigationTest = gameToReactEvents.on('NAVIGATION_TEST_PROGRESS', setNavigationTest);
    reactToGameEvents.emit('REQUEST_AGENT_SNAPSHOTS', {});
    return () => {
      offReady();
      offClick();
      offTestReceived();
      offNavigationDebug();
      offAgentState();
      offAgentSnapshot();
      offEditor();
      offSaved();
      offNavigationTest();
    };
  }, []);

  const sendTestEvent = () => {
    const nextCount = testCount + 1;
    setTestCount(nextCount);
    reactToGameEvents.emit('TEST_PHASER_EVENT', {
      message: `React Event Received #${nextCount}`
    });
  };

  const commandAgent = (agentId: string, command: AgentCommand) => {
    reactToGameEvents.emit('COMMAND_AGENT', { agentId, command });
  };

  const stateLabel: Record<AgentState, string> = {
    idle: '대기',
    moving: '이동 중',
    working: '업무 중',
    meeting: '회의 중',
    blocked: '경로 막힘'
  };

  const toggleNavigationDebug = () => {
    reactToGameEvents.emit('TOGGLE_NAVIGATION_DEBUG', { enabled: !navigationDebug });
  };

  const setEditor = (enabled: boolean, layer = editorLayer) => {
    reactToGameEvents.emit('SET_NAVIGATION_EDITOR', { enabled, layer });
  };

  const addEmployee = () => {
    const name = employeeName.trim();
    const role = employeeRole.trim();
    if (!name || !role) {
      setStatus('직원 이름과 역할을 입력하세요.');
      return;
    }
    const employee: EmployeeRecord = {
      id: `employee-${crypto.randomUUID()}`,
      name,
      role,
      departmentId: employeeDepartment,
      appearanceId: employeeAppearance,
      personalityId: employeePersonality,
      userPrompt: employeePrompt.trim()
    };
    reactToGameEvents.emit('ADD_EMPLOYEE', employee);
    setEmployeeName('');
    setStatus(`${name} 직원을 추가했습니다.`);
  };

  return (
    <main className={`prototype-shell${embedded ? ' prototype-shell--embedded' : ''}`}>
      <header className="prototype-header">
        <strong>AI VIDEO STUDIO</strong>
        <span>Pixel Office Prototype</span>
      </header>

      <section className="game-panel">
        <PhaserGame />
      </section>

      <aside className="react-test-panel">
        <div>
          <strong>React UI Test</strong>
          <span>Status: {status}</span>
        </div>
        <div className="react-test-panel__actions">
          <button type="button" onClick={toggleNavigationDebug}>
            {navigationDebug ? 'Hide Navigation' : 'Show Navigation'}
          </button>
          <button type="button" onClick={sendTestEvent}>Test Phaser Event</button>
        </div>
      </aside>

      <section className="navigation-tools" aria-label="내비게이션 편집 도구">
        <header>
          <div>
            <strong>내장 내비게이션 편집</strong>
            <span>점을 마우스로 끌어 이동 영역과 목적지를 조정합니다.</span>
          </div>
          <span className={editorDirty ? 'navigation-tools__dirty' : ''}>
            {editorDirty ? '저장하지 않은 변경 있음' : '저장됨'}
          </span>
        </header>
        <div className="navigation-tools__controls">
          <button type="button" onClick={() => setEditor(!editorEnabled)}>
            {editorEnabled ? '편집 종료' : '편집 시작'}
          </button>
          <div className="navigation-tools__toolset" aria-label="편집 도구">
            <button
              type="button"
              className={editorTool === 'move' ? 'is-active' : ''}
              disabled={!editorEnabled}
              onClick={() => {
                setEditorTool('move');
                reactToGameEvents.emit('SET_NAVIGATION_EDIT_TOOL', { tool: 'move' });
              }}
            >
              점 이동
            </button>
            <button
              type="button"
              className={editorTool === 'add' ? 'is-active' : ''}
              disabled={!editorEnabled}
              onClick={() => {
                setEditorTool('add');
                reactToGameEvents.emit('SET_NAVIGATION_EDIT_TOOL', { tool: 'add' });
              }}
            >
              점 추가
            </button>
            <button
              type="button"
              disabled={!editorEnabled}
              onClick={() => reactToGameEvents.emit('DELETE_SELECTED_NAVIGATION_POINT', {})}
            >
              선택 점 삭제
            </button>
          </div>
          <label>
            편집 레이어
            <select
              value={editorLayer}
              onChange={(event) => setEditor(editorEnabled, event.target.value as NavigationEditableLayer)}
            >
              {EDITABLE_LAYERS.map((layer) => <option key={layer.value} value={layer.value}>{layer.label}</option>)}
            </select>
          </label>
          <button type="button" disabled={!editorDirty} onClick={() => reactToGameEvents.emit('SAVE_NAVIGATION_EDITS', {})}>
            변경 저장
          </button>
          <button
            type="button"
            className="navigation-tools__danger"
            onClick={() => {
              if (window.confirm('직접 수정한 내비게이션 값을 지우고 원본으로 복원할까요?')) {
                reactToGameEvents.emit('RESET_NAVIGATION_EDITS', {});
              }
            }}
          >
            원본 복원
          </button>
        </div>
        <p className="navigation-tools__help">
          점 추가: 폴리곤의 선 가까이를 클릭합니다. 삭제: 기존 점을 클릭해 노란색으로 선택한 뒤 삭제 버튼을 누릅니다.
        </p>
        <div className="navigation-test">
          <div>
            <strong>GPT 자동 이동 테스트</strong>
            <span>{navigationTest.message}</span>
            {navigationTest.total > 0 && <small>{navigationTest.current} / {navigationTest.total}</small>}
          </div>
          <button
            type="button"
            disabled={editorEnabled}
            onClick={() => reactToGameEvents.emit(navigationTest.running ? 'STOP_NAVIGATION_TEST' : 'START_NAVIGATION_TEST', {})}
          >
            {navigationTest.running ? '테스트 중지' : '전체 구역 테스트'}
          </button>
        </div>
      </section>

      <section className="employee-panel" aria-label="직원 관리">
        <header>
          <div>
            <strong>직원 관리</strong>
            <span>첫 번째 직원 외형 · 캐주얼 남성</span>
          </div>
          <span>현재 직원 {Object.values(agents).filter((agent) => agent.model === 'custom').length}명</span>
        </header>
        <div className="employee-form">
          <label>
            이름
            <input value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} placeholder="예: 김기획" />
          </label>
          <label>
            역할
            <input value={employeeRole} onChange={(event) => setEmployeeRole(event.target.value)} />
          </label>
          <label>
            부서
            <select value={employeeDepartment} onChange={(event) => setEmployeeDepartment(event.target.value as EmployeeDepartmentId)}>
              {EMPLOYEE_DEPARTMENTS.map((department) => (
                <option key={department.value} value={department.value}>{department.label}</option>
              ))}
            </select>
          </label>
          <label>
            외형
            <select value={employeeAppearance} onChange={(event) => setEmployeeAppearance(event.target.value as EmployeeAppearanceId)}>
              {EMPLOYEE_APPEARANCES.map((appearance) => (
                <option key={appearance.value} value={appearance.value}>{appearance.label}</option>
              ))}
            </select>
          </label>
          <fieldset className="employee-personality">
            <legend>성격</legend>
            {EMPLOYEE_PERSONALITIES.map((personality) => (
              <label key={personality.value} title={personality.description}>
                <input
                  type="radio"
                  name="employee-personality"
                  value={personality.value}
                  checked={employeePersonality === personality.value}
                  onChange={() => setEmployeePersonality(personality.value)}
                />
                <span>{personality.label}</span>
              </label>
            ))}
          </fieldset>
          <label className="employee-prompt">
            사용자 프롬프트
            <textarea
              value={employeePrompt}
              onChange={(event) => setEmployeePrompt(event.target.value)}
              placeholder="이 직원이 업무를 처리할 때 항상 따를 지침을 입력하세요."
              rows={3}
            />
          </label>
          <button type="button" onClick={addEmployee}>직원 추가</button>
        </div>
      </section>

      <section className="agent-panel" aria-label="AI Agent status">
        <header>
          <strong>AI AGENTS</strong>
          <span>React Agent Control</span>
        </header>
        {Object.values(agents).map((agent) => (
          <article className="agent-card" key={agent.id}>
            <div className="agent-card__identity">
              <span className={`agent-state agent-state--${agent.state}`} />
              <div>
                <strong>{agent.name}</strong>
                <small>{agent.role}</small>
              </div>
            </div>
            <div className="agent-card__status">
              <span>{stateLabel[agent.state]}</span>
              {agent.statusMessage && <small>{agent.statusMessage}</small>}
            </div>
            <div className="agent-card__actions">
              <button type="button" onClick={() => commandAgent(agent.id, 'GO_TO_WORK')}>업무 위치</button>
              <button type="button" onClick={() => commandAgent(agent.id, 'JOIN_MEETING')}>회의실</button>
              {agent.state === 'meeting' && (
                <button type="button" onClick={() => commandAgent(agent.id, 'END_MEETING')}>회의 종료</button>
              )}
              <button type="button" onClick={() => commandAgent(agent.id, 'RETURN_TO_SPAWN')}>대기 위치</button>
              {agent.model === 'custom' && (
                <button
                  type="button"
                  className="agent-card__remove"
                  onClick={() => {
                    if (window.confirm(`${agent.name} 직원을 삭제할까요?`)) {
                      reactToGameEvents.emit('REMOVE_EMPLOYEE', { employeeId: agent.id });
                    }
                  }}
                >
                  직원 삭제
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
