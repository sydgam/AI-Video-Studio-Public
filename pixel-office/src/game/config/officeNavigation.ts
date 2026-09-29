export type NormalizedPoint = { x: number; y: number };

export type WalkableAreaDefinition = {
  id: string;
  roomId: string;
  points: readonly NormalizedPoint[];
};

export type NavigationPortalDefinition = {
  id: string;
  from: string;
  to: string;
  center: NormalizedPoint;
  size: { width: number; height: number };
  orientation: 'horizontal' | 'vertical';
  angle?: number;
};

function rectangle(id: string, roomId: string, x: number, y: number, width: number, height: number): WalkableAreaDefinition {
  return {
    id,
    roomId,
    points: [
      { x, y }, { x: x + width, y },
      { x: x + width, y: y + height }, { x, y: y + height }
    ]
  };
}

function polygon(id: string, roomId: string, points: readonly NormalizedPoint[]): WalkableAreaDefinition {
  return { id, roomId, points };
}

// Phase 2 navigation geometry is intentionally independent from the artwork.
// It can later be replaced by Tiled polygons without changing consumers.
export const WALKABLE_AREAS: readonly WalkableAreaDefinition[] = [
  polygon('strategy-floor', 'strategy', [
    { x: .052, y: .078 }, { x: .236, y: .078 }, { x: .236, y: .254 },
    { x: .207, y: .254 }, { x: .207, y: .352 },
    { x: .181, y: .352 }, { x: .181, y: .326 }, { x: .060, y: .326 },
    { x: .060, y: .254 }, { x: .052, y: .254 }
  ]),
  polygon('strategy-entry-corridor', 'strategy', [
    { x: .060, y: .248 }, { x: .224, y: .248 }, { x: .224, y: .352 },
    { x: .181, y: .352 }, { x: .181, y: .326 }, { x: .060, y: .326 }
  ]),
  rectangle('narrative-floor', 'narrative', .268, .078, .137, .192),
  rectangle('shot-floor', 'shot-design', .608, .078, .145, .192),
  rectangle('frame-floor', 'frame-art', .792, .078, .165, .192),
  polygon('frame-entry-corridor', 'frame-art', [
    { x: .776, y: .248 }, { x: .957, y: .248 }, { x: .957, y: .326 },
    { x: .858, y: .326 }, { x: .858, y: .352 }, { x: .776, y: .352 }
  ]),
  polygon('motion-floor', 'motion', [
    { x: .052, y: .399 }, { x: .257, y: .399 }, { x: .257, y: .520 },
    { x: .238, y: .544 }, { x: .210, y: .572 }, { x: .052, y: .572 }
  ]),
  polygon('quality-floor', 'quality', [
    { x: .743, y: .399 }, { x: .948, y: .399 }, { x: .948, y: .572 },
    { x: .790, y: .572 }, { x: .762, y: .544 }, { x: .743, y: .520 }
  ]),
  polygon('commons-floor', 'commons', [
    { x: .408, y: .078 }, { x: .598, y: .078 }, { x: .598, y: .268 },
    { x: .776, y: .268 }, { x: .776, y: .392 }, { x: .704, y: .392 },
    { x: .704, y: .438 }, { x: .668, y: .438 }, { x: .668, y: .486 },
    { x: .598, y: .486 }, { x: .598, y: .565 }, { x: .408, y: .565 },
    { x: .408, y: .486 }, { x: .332, y: .486 }, { x: .332, y: .438 },
    { x: .294, y: .438 }, { x: .294, y: .392 }, { x: .224, y: .392 },
    { x: .224, y: .268 }, { x: .408, y: .268 }
  ]),
  polygon('west-open-passage', 'commons', [
    { x: .255, y: .352 }, { x: .302, y: .352 }, { x: .302, y: .392 },
    { x: .338, y: .392 }, { x: .338, y: .438 }, { x: .415, y: .438 },
    { x: .415, y: .500 }, { x: .265, y: .500 }, { x: .225, y: .555 },
    { x: .190, y: .610 }, { x: .163, y: .590 }, { x: .213, y: .520 },
    { x: .255, y: .478 }
  ]),
  polygon('east-open-passage', 'commons', [
    { x: .745, y: .352 }, { x: .745, y: .478 }, { x: .787, y: .520 },
    { x: .837, y: .590 }, { x: .810, y: .610 }, { x: .775, y: .555 },
    { x: .735, y: .500 }, { x: .585, y: .500 }, { x: .585, y: .438 },
    { x: .662, y: .438 }, { x: .662, y: .392 }, { x: .698, y: .392 },
    { x: .698, y: .352 }
  ]),
  polygon('west-boardroom-approach', 'commons', [
    { x: .225, y: .486 }, { x: .335, y: .486 }, { x: .335, y: .520 },
    { x: .278, y: .520 }, { x: .278, y: .548 }, { x: .245, y: .562 },
    { x: .225, y: .562 }, { x: .208, y: .548 }, { x: .225, y: .520 }
  ]),
  polygon('east-boardroom-approach', 'commons', [
    { x: .665, y: .486 }, { x: .775, y: .486 }, { x: .775, y: .520 },
    { x: .792, y: .548 }, { x: .775, y: .562 }, { x: .755, y: .562 },
    { x: .722, y: .548 }, { x: .722, y: .520 }, { x: .665, y: .520 }
  ]),
  polygon('boardroom-floor', 'boardroom', [
    { x: .163, y: .589 }, { x: .837, y: .589 }, { x: .837, y: .862 },
    { x: .790, y: .862 }, { x: .790, y: .900 }, { x: .210, y: .900 },
    { x: .210, y: .862 }, { x: .163, y: .862 }
  ]),
  polygon('balcony-floor', 'balcony', [
    { x: .060, y: .780 }, { x: .145, y: .780 }, { x: .145, y: .880 },
    { x: .440, y: .880 }, { x: .440, y: .900 }, { x: .560, y: .900 },
    { x: .560, y: .880 }, { x: .855, y: .880 }, { x: .855, y: .780 },
    { x: .940, y: .780 }, { x: .940, y: .930 }, { x: .060, y: .930 }
  ])
] as const;

export const NAVIGATION_PORTALS: readonly NavigationPortalDefinition[] = [
  { id: 'strategy-door', from: 'strategy-floor', to: 'commons-floor', center: { x: .141, y: .334 }, size: { width: .030, height: .044 }, orientation: 'vertical' },
  { id: 'narrative-door', from: 'narrative-floor', to: 'commons-floor', center: { x: .286, y: .333 }, size: { width: .024, height: .045 }, orientation: 'vertical' },
  { id: 'shot-door', from: 'shot-floor', to: 'commons-floor', center: { x: .721, y: .333 }, size: { width: .026, height: .045 }, orientation: 'vertical' },
  { id: 'frame-door', from: 'frame-floor', to: 'commons-floor', center: { x: .858, y: .333 }, size: { width: .026, height: .045 }, orientation: 'vertical' },
  { id: 'boardroom-balcony-door', from: 'boardroom-floor', to: 'balcony-floor', center: { x: .500, y: .900 }, size: { width: .072, height: .055 }, orientation: 'horizontal' }
] as const;
