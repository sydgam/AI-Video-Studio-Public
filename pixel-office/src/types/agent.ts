export type AgentState = 'idle' | 'moving' | 'working' | 'meeting' | 'blocked';

export type AgentDefinition = {
  id: string;
  name: string;
  model: 'openai' | 'anthropic' | 'google' | 'custom';
  departmentId: string;
  role: string;
  spawnAnchorId: string;
  workAnchorId: string;
  meetingAnchorId: string;
};

export type AgentSnapshot = AgentDefinition & {
  state: AgentState;
  targetAnchorId?: string;
  statusMessage?: string;
};

export type AgentCommand = 'GO_TO_WORK' | 'JOIN_MEETING' | 'END_MEETING' | 'RETURN_TO_SPAWN';
