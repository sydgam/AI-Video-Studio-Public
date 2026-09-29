import Phaser from 'phaser';
import type { MapAnchor, OfficeNavigationMapData, PolygonRegion } from '../types/navigationMap';

export class NavigationSystem {
  // Navigation is evaluated around the character's feet, not the full sprite.
  // A compact radius keeps narrow doors usable while collision polygons still
  // prevent characters from crossing walls and furniture.
  private static readonly movementRadius = 5;
  private static readonly pathClearance = 7;
  private areas: Map<string, Phaser.Geom.Polygon>;
  private doors: Map<string, Phaser.Geom.Polygon>;
  private obstacles: Map<string, Phaser.Geom.Polygon>;
  private readonly debugGraphics: Phaser.GameObjects.Graphics;
  private readonly pathGraphics: Phaser.GameObjects.Graphics;
  private debugVisible = false;
  private readonly gridClearance = new Map<string, boolean>();
  private readonly polygonBounds = new WeakMap<Phaser.Geom.Polygon, { left: number; right: number; top: number; bottom: number }>();

  constructor(
    scene: Phaser.Scene,
    private readonly mapData: OfficeNavigationMapData,
    private readonly worldWidth: number,
    private readonly worldHeight: number
  ) {
    this.areas = this.createPolygonMap(mapData.walkable);
    this.doors = this.createPolygonMap(mapData.doors);
    this.obstacles = this.createPolygonMap(mapData.collisions);
    this.debugGraphics = scene.add.graphics().setDepth(40).setVisible(false);
    this.pathGraphics = scene.add.graphics().setDepth(41).setVisible(false);
  }

  setDebugVisible(visible: boolean): void {
    this.debugVisible = visible;
    this.debugGraphics.setVisible(visible);
    this.pathGraphics.setVisible(visible);
    if (visible) this.drawDebugGeometry();
  }

  isDebugVisible(): boolean {
    return this.debugVisible;
  }

  refreshGeometry(): void {
    this.gridClearance.clear();
    this.areas = this.createPolygonMap(this.mapData.walkable);
    this.doors = this.createPolygonMap(this.mapData.doors);
    this.obstacles = this.createPolygonMap(this.mapData.collisions);
    if (this.debugVisible) this.drawDebugGeometry();
  }

  isWalkable(x: number, y: number): boolean {
    return Boolean(this.getAreaIdAt(x, y)) && !this.isObstacle(x, y);
  }

  canOccupy(x: number, y: number, radius = NavigationSystem.movementRadius): boolean {
    return this.isWalkableWithClearance(x, y, radius);
  }

  resolveDestination(destination: Phaser.Math.Vector2, maxDistance = 72): Phaser.Math.Vector2 | undefined {
    const characterRadius = NavigationSystem.pathClearance;
    if (this.isWalkableWithClearance(destination.x, destination.y, characterRadius)) return destination.clone();
    for (let distance = 6; distance <= maxDistance; distance += 6) {
      const samples = Math.max(12, Math.ceil(Math.PI * 2 * distance / 9));
      for (let index = 0; index < samples; index += 1) {
        const angle = index / samples * Math.PI * 2;
        const candidate = new Phaser.Math.Vector2(
          destination.x + Math.cos(angle) * distance,
          destination.y + Math.sin(angle) * distance
        );
        if (this.isWalkableWithClearance(candidate.x, candidate.y, characterRadius)) return candidate;
      }
    }
    return undefined;
  }

  findPath(start: Phaser.Math.Vector2, destination: Phaser.Math.Vector2, approachDistance = 72): Phaser.Math.Vector2[] | undefined {
    const characterRadius = NavigationSystem.pathClearance;
    this.pathGraphics.clear();
    if (![start.x, start.y, destination.x, destination.y].every(Number.isFinite)
      || !this.canOccupy(start.x, start.y)) return undefined;
    const resolvedDestination = this.resolveDestination(destination, approachDistance);
    if (!resolvedDestination) return undefined;
    const destinationOffset = Math.hypot(destination.x - resolvedDestination.x, destination.y - resolvedDestination.y);
    if (this.isSegmentWalkable(start, resolvedDestination, characterRadius)) {
      this.drawPath([start, resolvedDestination]);
      return [resolvedDestination];
    }

    const cellSize = 7;
    const columns = Math.ceil(this.worldWidth / cellSize);
    const rows = Math.ceil(this.worldHeight / cellSize);
    const toCell = (point: Phaser.Math.Vector2) => ({
      column: Phaser.Math.Clamp(Math.floor(point.x / cellSize), 0, columns - 1),
      row: Phaser.Math.Clamp(Math.floor(point.y / cellSize), 0, rows - 1)
    });
    const toKey = (column: number, row: number) => `${column},${row}`;
    const toPoint = (column: number, row: number) => new Phaser.Math.Vector2(
      Math.min((column + .5) * cellSize, this.worldWidth - 1),
      Math.min((row + .5) * cellSize, this.worldHeight - 1)
    );
    const startCell = toCell(start);
    const destinationCell = toCell(resolvedDestination);
    const startKey = toKey(startCell.column, startCell.row);
    const open = new Set([startKey]);
    const previous = new Map<string, string>();
    const costs = new Map<string, number>([[startKey, 0]]);
    const estimates = new Map<string, number>([[startKey, 0]]);
    const directions = [
      [-1, 0], [1, 0], [0, -1], [0, 1],
      [-1, -1], [1, -1], [-1, 1], [1, 1]
    ] as const;

    while (open.size > 0) {
      let currentKey = [...open][0];
      open.forEach((key) => {
        if ((estimates.get(key) ?? Infinity) < (estimates.get(currentKey) ?? Infinity)) currentKey = key;
      });
      const [currentColumn, currentRow] = currentKey.split(',').map(Number);
      const currentPoint = currentKey === startKey ? start : toPoint(currentColumn, currentRow);
      const reachesDestination = Math.hypot(currentPoint.x - resolvedDestination.x, currentPoint.y - resolvedDestination.y) <= cellSize * 2
        && this.isSegmentWalkable(currentPoint, resolvedDestination, characterRadius);
      // Furniture anchors may resolve into a pocket between chairs. In that
      // case approach the anchor from a reachable side at comparable distance.
      const reachesApproach = destinationOffset > 0 && currentKey !== startKey
        && Math.hypot(currentPoint.x - destination.x, currentPoint.y - destination.y) <= approachDistance;
      if (reachesDestination || reachesApproach) {
        const path = [(reachesDestination ? resolvedDestination : currentPoint).clone()];
        let cursor = currentKey;
        while (cursor !== startKey) {
          const [column, row] = cursor.split(',').map(Number);
          path.push(toPoint(column, row));
          cursor = previous.get(cursor) ?? startKey;
        }
        path.push(start.clone());
        const result = this.simplifyPath(path.reverse(), characterRadius).slice(1);
        this.drawPath(result);
        return result;
      }

      open.delete(currentKey);
      const [column, row] = currentKey.split(',').map(Number);
      for (const [columnOffset, rowOffset] of directions) {
        const nextColumn = column + columnOffset;
        const nextRow = row + rowOffset;
        if (nextColumn < 0 || nextRow < 0 || nextColumn >= columns || nextRow >= rows) continue;
        const nextKey = toKey(nextColumn, nextRow);
        const stepCost = columnOffset === 0 || rowOffset === 0 ? 1 : Math.SQRT2;
        const nextCost = (costs.get(currentKey) ?? Infinity) + stepCost;
        if (nextCost >= (costs.get(nextKey) ?? Infinity)) continue;
        const nextPoint = toPoint(nextColumn, nextRow);
        const gridKey = `${nextColumn},${nextRow}`;
        if (!this.gridClearance.has(gridKey)) {
          this.gridClearance.set(gridKey, this.isWalkableWithClearance(nextPoint.x, nextPoint.y, characterRadius));
        }
        if (!this.gridClearance.get(gridKey)) continue;
        if (!this.isSegmentWalkable(currentPoint, nextPoint, characterRadius)) continue;
        if (columnOffset !== 0 && rowOffset !== 0) {
          const horizontal = toPoint(column + columnOffset, row);
          const vertical = toPoint(column, row + rowOffset);
          if (!this.isWalkableWithClearance(horizontal.x, horizontal.y, characterRadius)
            || !this.isWalkableWithClearance(vertical.x, vertical.y, characterRadius)) continue;
        }
        previous.set(nextKey, currentKey);
        costs.set(nextKey, nextCost);
        const heuristic = Math.hypot(destinationCell.column - nextColumn, destinationCell.row - nextRow);
        estimates.set(nextKey, nextCost + heuristic);
        open.add(nextKey);
      }
    }

    this.pathGraphics.clear();
    return undefined;
  }

  getAreaIdAt(x: number, y: number): string | undefined {
    for (const [id, polygon] of this.areas) if (polygon.contains(x, y)) return id;
    for (const [id, polygon] of this.doors) if (polygon.contains(x, y)) return `door:${id}`;
    return undefined;
  }

  isObstacle(x: number, y: number): boolean {
    for (const polygon of this.obstacles.values()) if (polygon.contains(x, y)) return true;
    return false;
  }

  private isWalkableWithClearance(x: number, y: number, radius: number): boolean {
    // Ring samples alone can miss a thin furniture corner inside the footprint.
    for (const polygon of this.obstacles.values()) {
      let bounds = this.polygonBounds.get(polygon);
      if (!bounds) {
        bounds = {
          left: Math.min(...polygon.points.map((p) => p.x)), right: Math.max(...polygon.points.map((p) => p.x)),
          top: Math.min(...polygon.points.map((p) => p.y)), bottom: Math.max(...polygon.points.map((p) => p.y))
        };
        this.polygonBounds.set(polygon, bounds);
      }
      if (x < bounds.left - radius || x > bounds.right + radius || y < bounds.top - radius || y > bounds.bottom + radius) continue;
      if (polygon.contains(x, y)) return false;
      const points = polygon.points;
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSquared = dx * dx + dy * dy;
        const t = lengthSquared ? Math.max(0, Math.min(1, ((x-a.x)*dx + (y-a.y)*dy) / lengthSquared)) : 0;
        if ((x-a.x-t*dx) ** 2 + (y-a.y-t*dy) ** 2 <= radius * radius) return false;
      }
    }
    if (!this.getAreaIdAt(x, y)) return false;
    // Check the actual movement footprint as well as the wider route margin.
    // Separate floor polygons can leave a gap inside the outer sample ring.
    for (const r of radius > NavigationSystem.movementRadius ? [NavigationSystem.movementRadius, radius] : [radius]) {
      const diagonal = r * .707;
      if (![
        [r, 0], [-r, 0], [0, r], [0, -r],
        [diagonal, diagonal], [diagonal, -diagonal], [-diagonal, diagonal], [-diagonal, -diagonal]
      ].every(([offsetX, offsetY]) => this.getAreaIdAt(x + offsetX, y + offsetY))) return false;
    }
    return true;
  }

  destroy(): void {
    this.debugGraphics.destroy();
    this.pathGraphics.destroy();
    this.areas.clear();
    this.doors.clear();
    this.obstacles.clear();
    this.gridClearance.clear();
  }

  private drawDebugGeometry(): void {
    this.debugGraphics.clear();
    this.debugGraphics.fillStyle(0x38d98b, .16);
    this.debugGraphics.lineStyle(4, 0x72f1b8, .9);
    this.areas.forEach((polygon) => {
      this.debugGraphics.fillPoints(polygon.points, true);
      this.debugGraphics.strokePoints(polygon.points, true);
    });

    this.debugGraphics.fillStyle(0xffb454, .72);
    this.doors.forEach((polygon) => this.debugGraphics.fillPoints(polygon.points, true));

    this.debugGraphics.fillStyle(0xef4444, .25);
    this.debugGraphics.lineStyle(3, 0xff6b6b, .9);
    this.obstacles.forEach((polygon) => {
      this.debugGraphics.fillPoints(polygon.points, true);
      this.debugGraphics.strokePoints(polygon.points, true);
    });

    this.drawAnchors(this.mapData.interactionAnchors, 0x60a5fa, 'I');
    this.drawAnchors(this.mapData.seats, 0xc084fc, 'S');
    this.drawAnchors(this.mapData.spawns, 0xffffff, 'P');
    this.drawAnchors(this.mapData.waypoints, 0xfacc15, 'W');
  }

  private createPolygonMap(regions: readonly PolygonRegion[]): Map<string, Phaser.Geom.Polygon> {
    return new Map(regions.map((region) => [region.id, new Phaser.Geom.Polygon([...region.points])]));
  }

  private drawAnchors(anchors: readonly MapAnchor[], color: number, label: string): void {
    this.debugGraphics.fillStyle(color, .95);
    anchors.forEach((anchor) => {
      this.debugGraphics.fillCircle(anchor.position.x, anchor.position.y, 9);
      this.debugGraphics.lineStyle(2, 0x08111f, .9);
      this.debugGraphics.strokeCircle(anchor.position.x, anchor.position.y, 9);
      const direction = this.facingVector(anchor.facing);
      this.debugGraphics.lineStyle(3, color, 1);
      this.debugGraphics.lineBetween(
        anchor.position.x,
        anchor.position.y,
        anchor.position.x + direction.x * 20,
        anchor.position.y + direction.y * 20
      );
      if (label === 'P') this.debugGraphics.strokeCircle(anchor.position.x, anchor.position.y, 14);
    });
  }

  private facingVector(facing?: string): Phaser.Math.Vector2 {
    if (facing === 'north') return new Phaser.Math.Vector2(0, -1);
    if (facing === 'south') return new Phaser.Math.Vector2(0, 1);
    if (facing === 'east') return new Phaser.Math.Vector2(1, 0);
    if (facing === 'west') return new Phaser.Math.Vector2(-1, 0);
    return new Phaser.Math.Vector2(0, 0);
  }

  private simplifyPath(path: Phaser.Math.Vector2[], radius: number): Phaser.Math.Vector2[] {
    if (path.length < 3) return path;
    const simplified = [path[0]];
    let anchorIndex = 0;
    while (anchorIndex < path.length - 1) {
      let nextIndex = path.length - 1;
      while (nextIndex > anchorIndex + 1
        && !this.isSegmentWalkable(path[anchorIndex], path[nextIndex], radius)) {
        nextIndex -= 1;
      }
      simplified.push(path[nextIndex]);
      anchorIndex = nextIndex;
    }
    return simplified;
  }

  private isSegmentWalkable(start: Phaser.Math.Vector2, end: Phaser.Math.Vector2, radius: number): boolean {
    const distance = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);
    const samples = Math.max(1, Math.ceil(distance / 2));
    for (let index = 0; index <= samples; index += 1) {
      const progress = index / samples;
      const x = Phaser.Math.Linear(start.x, end.x, progress);
      const y = Phaser.Math.Linear(start.y, end.y, progress);
      if (!this.isWalkableWithClearance(x, y, radius)) return false;
    }
    return true;
  }

  private drawPath(path: readonly Phaser.Math.Vector2[]): void {
    this.pathGraphics.clear();
    if (path.length < 2) return;
    this.pathGraphics.lineStyle(5, 0x22d3ee, .95);
    this.pathGraphics.beginPath();
    this.pathGraphics.moveTo(path[0].x, path[0].y);
    path.slice(1).forEach((point) => this.pathGraphics.lineTo(point.x, point.y));
    this.pathGraphics.strokePath();
    this.pathGraphics.fillStyle(0xfacc15, 1);
    path.forEach((point) => this.pathGraphics.fillCircle(point.x, point.y, 6));
  }
}
