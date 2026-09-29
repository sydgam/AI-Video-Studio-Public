import type { AgentState } from '../../types/agent';

const ALLOWED_TRANSITIONS: Readonly<Record<AgentState, readonly AgentState[]>> = {
  idle: ['moving', 'blocked'],
  moving: ['idle', 'working', 'meeting', 'blocked'],
  working: ['moving', 'idle', 'blocked'],
  meeting: ['moving', 'idle', 'blocked'],
  blocked: ['moving', 'idle']
};

export class AgentStateMachine {
  constructor(private currentState: AgentState = 'idle') {}

  get state(): AgentState {
    return this.currentState;
  }

  transition(nextState: AgentState): boolean {
    if (nextState === this.currentState) return true;
    if (!ALLOWED_TRANSITIONS[this.currentState].includes(nextState)) return false;
    this.currentState = nextState;
    return true;
  }
}
