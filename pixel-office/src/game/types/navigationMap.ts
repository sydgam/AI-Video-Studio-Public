export type WorldPoint = { x: number; y: number };

export type PolygonRegion = {
  id: string;
  roomId?: string;
  points: readonly WorldPoint[];
};

export type DoorRegion = PolygonRegion & {
  from?: string;
  to?: string;
};

export type MapAnchor = {
  id: string;
  position: WorldPoint;
  facing?: string;
  actionType?: string;
  objectId?: string;
  role?: string;
};

export type OfficeNavigationMapData = {
  walkable: readonly PolygonRegion[];
  collisions: readonly PolygonRegion[];
  doors: readonly DoorRegion[];
  interactionAnchors: readonly MapAnchor[];
  seats: readonly MapAnchor[];
  spawns: readonly MapAnchor[];
  waypoints: readonly MapAnchor[];
};
