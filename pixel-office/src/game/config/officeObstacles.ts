import type { NormalizedPoint } from './officeNavigation';

export type NavigationObstacleDefinition = {
  id: string;
  points: readonly NormalizedPoint[];
};

function rectangle(id: string, x: number, y: number, width: number, height: number): NavigationObstacleDefinition {
  return {
    id,
    points: [
      { x, y }, { x: x + width, y },
      { x: x + width, y: y + height }, { x, y: y + height }
    ]
  };
}

// Coarse collision footprints for large furniture and fixed equipment.
// Smaller props and chair-level interaction points are intentionally deferred.
export const OFFICE_OBSTACLES: readonly NavigationObstacleDefinition[] = [
  rectangle('strategy-main-table', .080, .150, .130, .105),
  rectangle('strategy-reference-wall', .070, .080, .145, .060),
  rectangle('narrative-upper-desk', .315, .130, .075, .060),
  rectangle('narrative-lower-desk', .302, .205, .095, .060),
  rectangle('commons-sofas', .456, .175, .090, .145),
  rectangle('shot-workstation', .625, .175, .115, .075),
  rectangle('frame-left-desks', .805, .105, .080, .150),
  rectangle('frame-right-desk', .890, .110, .060, .145),
  rectangle('motion-workstation', .065, .420, .185, .105),
  rectangle('quality-preview-wall', .785, .405, .160, .070),
  rectangle('quality-review-table', .800, .485, .135, .085),
  rectangle('commons-west-console', .335, .300, .075, .075),
  rectangle('commons-east-console', .590, .300, .075, .075),
  rectangle('boardroom-main-table', .345, .665, .310, .150),
  rectangle('boardroom-west-lounge', .190, .675, .070, .155),
  rectangle('boardroom-east-lounge', .740, .675, .070, .155),
  rectangle('balcony-west-console', .065, .805, .075, .070),
  rectangle('balcony-east-console', .860, .805, .075, .070)
] as const;
