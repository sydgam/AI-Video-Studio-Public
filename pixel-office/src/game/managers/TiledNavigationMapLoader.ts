import Phaser from 'phaser';
import type { DoorRegion, MapAnchor, OfficeNavigationMapData, PolygonRegion, WorldPoint } from '../types/navigationMap';

type TiledProperty = { name: string; value: unknown };
type TiledObject = {
  id: number;
  name?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  polygon?: readonly WorldPoint[];
  point?: boolean;
  properties?: readonly TiledProperty[];
};

export class TiledNavigationMapLoader {
  static parse(tilemap: Phaser.Tilemaps.Tilemap): OfficeNavigationMapData {
    return {
      walkable: this.readPolygons(tilemap, 'Walkable'),
      collisions: this.readPolygons(tilemap, 'Collision'),
      doors: this.readPolygons(tilemap, 'Door').map((region) => ({
        ...region,
        from: this.property(this.objectById(tilemap, 'Door', region.id), 'from'),
        to: this.property(this.objectById(tilemap, 'Door', region.id), 'to')
      })),
      interactionAnchors: this.readAnchors(tilemap, 'InteractionAnchor'),
      seats: this.readAnchors(tilemap, 'Seat'),
      spawns: this.readAnchors(tilemap, 'Spawn'),
      waypoints: this.readAnchors(tilemap, 'Waypoint')
    };
  }

  private static readPolygons(tilemap: Phaser.Tilemaps.Tilemap, layerName: string): PolygonRegion[] {
    return this.objects(tilemap, layerName).map((object) => ({
      id: object.name || `${layerName}-${object.id}`,
      roomId: this.property(object, 'roomId'),
      points: object.polygon?.map((point) => ({ x: object.x + point.x, y: object.y + point.y }))
        ?? this.rectanglePoints(object)
    }));
  }

  private static readAnchors(tilemap: Phaser.Tilemaps.Tilemap, layerName: string): MapAnchor[] {
    return this.objects(tilemap, layerName).map((object) => ({
      id: object.name || `${layerName}-${object.id}`,
      position: { x: object.x, y: object.y },
      facing: this.property(object, 'facing'),
      actionType: this.property(object, 'actionType'),
      objectId: this.property(object, 'objectId'),
      role: this.property(object, 'role')
    }));
  }

  private static objects(tilemap: Phaser.Tilemaps.Tilemap, layerName: string): TiledObject[] {
    return (tilemap.getObjectLayer(layerName)?.objects ?? []) as TiledObject[];
  }

  private static objectById(tilemap: Phaser.Tilemaps.Tilemap, layerName: string, id: string): TiledObject | undefined {
    return this.objects(tilemap, layerName).find((object) => (object.name || `${layerName}-${object.id}`) === id);
  }

  private static property(object: TiledObject | undefined, name: string): string | undefined {
    const value = object?.properties?.find((property) => property.name === name)?.value;
    return typeof value === 'string' ? value : undefined;
  }

  private static rectanglePoints(object: TiledObject): WorldPoint[] {
    const width = object.width ?? 0;
    const height = object.height ?? 0;
    return [
      { x: object.x, y: object.y }, { x: object.x + width, y: object.y },
      { x: object.x + width, y: object.y + height }, { x: object.x, y: object.y + height }
    ];
  }
}
