export type EmployeeDepartmentId = 'strategy' | 'narrative' | 'shot' | 'frame' | 'motion' | 'quality';

export type EmployeePersonalityId = 'balanced' | 'creative' | 'analytical' | 'meticulous' | 'proactive' | 'collaborative';
export type EmployeeAppearanceId =
  | 'casual-male-01'
  | 'strategist-female-01'
  | 'writer-female-01'
  | 'shot-female-01'
  | 'motion-female-01'
  | 'artist-male-01';

export type EmployeeRecord = {
  id: string;
  name: string;
  role: string;
  departmentId: EmployeeDepartmentId;
  appearanceId: EmployeeAppearanceId;
  personalityId: EmployeePersonalityId;
  userPrompt: string;
};
