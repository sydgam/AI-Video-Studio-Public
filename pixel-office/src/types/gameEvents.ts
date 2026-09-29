import type { AgentCommand, AgentSnapshot } from './agent';
import type { EmployeeRecord } from './employee';
import type { NavigationEditableLayer, NavigationEditTool, NavigationTestResult } from '../game/types/navigationEditor';

export type ReactToGameEvents = {
  TASK_CREATED: { taskId: string; title: string };
  AGENT_ASSIGNED: { taskId: string; agentId: string };
  PROJECT_CHANGED: { projectId: string };
  TEST_PHASER_EVENT: { message: string };
  TOGGLE_NAVIGATION_DEBUG: { enabled: boolean };
  COMMAND_AGENT: { agentId: string; command: AgentCommand };
  REQUEST_AGENT_SNAPSHOTS: Record<string, never>;
  SET_NAVIGATION_EDITOR: { enabled: boolean; layer: NavigationEditableLayer };
  SET_NAVIGATION_EDIT_TOOL: { tool: NavigationEditTool };
  DELETE_SELECTED_NAVIGATION_POINT: Record<string, never>;
  SAVE_NAVIGATION_EDITS: Record<string, never>;
  RESET_NAVIGATION_EDITS: Record<string, never>;
  START_NAVIGATION_TEST: Record<string, never>;
  STOP_NAVIGATION_TEST: Record<string, never>;
  ADD_EMPLOYEE: EmployeeRecord;
  REMOVE_EMPLOYEE: { employeeId: string };
};

export type GameToReactEvents = {
  SCENE_READY: { sceneKey: string };
  CHARACTER_CLICKED: { characterId: string };
  OBJECT_CLICKED: { objectId: string };
  AGENT_STATE_CHANGED: AgentSnapshot;
  AGENTS_SNAPSHOT: { agents: AgentSnapshot[] };
  SCENE_CLICKED: { x: number; y: number; areaId?: string; walkable: boolean };
  TEST_EVENT_RECEIVED: { message: string };
  NAVIGATION_DEBUG_CHANGED: { enabled: boolean };
  NAVIGATION_EDITOR_CHANGED: { enabled: boolean; layer: NavigationEditableLayer; dirty: boolean };
  NAVIGATION_EDITS_SAVED: { message: string };
  NAVIGATION_TEST_PROGRESS: NavigationTestResult;
};
