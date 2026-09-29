export type NavigationEditableLayer =
  | 'walkable'
  | 'collisions'
  | 'doors'
  | 'interactionAnchors'
  | 'seats'
  | 'spawns'
  | 'waypoints';

export type NavigationEditTool = 'move' | 'add';

export type NavigationTestResult = {
  running: boolean;
  current: number;
  total: number;
  anchorId?: string;
  success?: boolean;
  message: string;
};
