import type { AgentDefinition } from '../../types/agent';

export const AGENT_DEFINITIONS: readonly AgentDefinition[] = [
  {
    id: 'gpt-executive',
    name: 'GPT',
    model: 'openai',
    departmentId: 'executive',
    role: '콘텐츠 전략 총괄',
    spawnAnchorId: 'gpt-executive-spawn',
    workAnchorId: 'gpt-executive-position',
    meetingAnchorId: 'gpt-executive-position'
  },
  {
    id: 'claude-executive',
    name: 'Claude',
    model: 'anthropic',
    departmentId: 'executive',
    role: '내러티브·리스크 총괄',
    spawnAnchorId: 'claude-executive-spawn',
    workAnchorId: 'claude-executive-position',
    meetingAnchorId: 'claude-executive-position'
  },
  {
    id: 'gemini-executive',
    name: 'Gemini',
    model: 'google',
    departmentId: 'executive',
    role: '비주얼·리서치 총괄',
    spawnAnchorId: 'gemini-executive-spawn',
    workAnchorId: 'gemini-executive-position',
    meetingAnchorId: 'gemini-executive-position'
  }
] as const;
