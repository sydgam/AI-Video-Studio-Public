import Phaser from 'phaser';
import { NavigationEditStorage } from '../managers/NavigationEditStorage';
import type { NavigationEditableLayer, NavigationEditTool } from '../types/navigationEditor';
import type { MapAnchor, OfficeNavigationMapData, PolygonRegion } from '../types/navigationMap';
import type { NavigationSystem } from './NavigationSystem';

const POLYGON_LAYERS = new Set<NavigationEditableLayer>(['walkable', 'collisions', 'doors']);
const COLORS: Record<NavigationEditableLayer, number> = {
  walkable: 0x72f1b8,
  collisions: 0xff6b6b,
  doors: 0xffb454,
  interactionAnchors: 0x60a5fa,
  seats: 0xc084fc,
  spawns: 0xffffff,
  waypoints: 0xfacc15
};

export class NavigationEditorSystem {
  private handles: Phaser.GameObjects.Arc[] = [];
  private enabled = false;
  private layer: NavigationEditableLayer = 'walkable';
  private dirty = false;
  private tool: NavigationEditTool = 'move';
  private selected?: { point: { x: number; y: number }; owner: PolygonRegion | MapAnchor; handle: Phaser.GameObjects.Arc };
  private readonly onPointerDown: (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly mapData: OfficeNavigationMapData,
    private readonly navigation: NavigationSystem,
    private readonly onChanged: (dirty: boolean) => void
  ) {
    this.onPointerDown = (pointer, currentlyOver) => {
      if (!this.enabled || this.tool !== 'add') return;
      if (currentlyOver.some((object) => object.getData('navigationEditorHandle'))) return;
      this.addPointAt(pointer.worldX, pointer.worldY);
    };
    this.scene.input.on('pointerdown', this.onPointerDown);
  }

  setMode(enabled: boolean, layer: NavigationEditableLayer): void {
    this.enabled = enabled;
    this.layer = layer;
    this.rebuildHandles();
    this.onChanged(this.dirty);
  }

  setTool(tool: NavigationEditTool): void {
    this.tool = tool;
    this.selected = undefined;
    this.rebuildHandles();
  }

  deleteSelected(): boolean {
    if (!this.selected) return false;
    if (POLYGON_LAYERS.has(this.layer)) {
      const region = this.selected.owner as PolygonRegion;
      const points = region.points as { x: number; y: number }[];
      if (points.length <= 3) return false;
      const index = points.indexOf(this.selected.point);
      if (index < 0) return false;
      points.splice(index, 1);
    } else {
      const anchors = this.mapData[this.layer] as MapAnchor[];
      const selectedAnchor = this.selected.owner as MapAnchor;
      // Named anchors are referenced by agent/task configuration. Keep them movable,
      // but only allow deletion of anchors created by this editor.
      if (!selectedAnchor.id.startsWith('custom-')) return false;
      const index = anchors.indexOf(selectedAnchor);
      if (index < 0) return false;
      anchors.splice(index, 1);
    }
    this.markDirty();
    this.selected = undefined;
    this.rebuildHandles();
    return true;
  }

  save(): void {
    NavigationEditStorage.save(this.mapData);
    this.dirty = false;
    this.onChanged(false);
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown);
    this.clearHandles();
  }

  private rebuildHandles(): void {
    this.clearHandles();
    if (!this.enabled) return;
    if (POLYGON_LAYERS.has(this.layer)) {
      (this.mapData[this.layer] as readonly PolygonRegion[]).forEach((region) => {
        region.points.forEach((point) => this.addHandle(point, region, region.id));
      });
      return;
    }
    (this.mapData[this.layer] as readonly MapAnchor[]).forEach((anchor) => {
      this.addHandle(anchor.position, anchor, anchor.id, true);
    });
  }

  private addHandle(point: { x: number; y: number }, owner: PolygonRegion | MapAnchor, id: string, anchor = false): void {
    const handle = this.scene.add.circle(point.x, point.y, anchor ? 11 : 8, COLORS[this.layer], .95)
      .setStrokeStyle(3, 0x07111d, 1)
      .setDepth(80)
      .setInteractive({ draggable: true, useHandCursor: true });
    handle.setData('navigationEditorHandle', true);
    handle.setData('label', id);
    handle.on('pointerdown', () => {
      this.selected?.handle.setStrokeStyle(3, 0x07111d, 1);
      this.selected = { point, owner, handle };
      handle.setStrokeStyle(4, 0xfacc15, 1);
    });
    handle.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      const x = Phaser.Math.Clamp(Math.round(dragX), 0, 1920);
      const y = Phaser.Math.Clamp(Math.round(dragY), 0, 1080);
      handle.setPosition(x, y);
      point.x = x;
      point.y = y;
      this.markDirty();
    });
    this.handles.push(handle);
  }

  private clearHandles(): void {
    this.handles.forEach((handle) => handle.destroy());
    this.handles = [];
  }

  private addPointAt(x: number, y: number): void {
    const point = { x: Math.round(x), y: Math.round(y) };
    if (!POLYGON_LAYERS.has(this.layer)) {
      const anchors = this.mapData[this.layer] as MapAnchor[];
      anchors.push({ id: `custom-${this.layer}-${Date.now()}`, position: point });
      this.markDirty();
      this.rebuildHandles();
      return;
    }

    const regions = this.mapData[this.layer] as PolygonRegion[];
    let closest: { region: PolygonRegion; insertAt: number; distance: number } | undefined;
    regions.forEach((region) => {
      region.points.forEach((start, index) => {
        const end = region.points[(index + 1) % region.points.length];
        const distance = Phaser.Math.Distance.BetweenPoints(point, this.nearestPointOnSegment(point, start, end));
        if (!closest || distance < closest.distance) closest = { region, insertAt: index + 1, distance };
      });
    });
    if (!closest || closest.distance > 70) return;
    (closest.region.points as { x: number; y: number }[]).splice(closest.insertAt, 0, point);
    this.markDirty();
    this.rebuildHandles();
  }

  private nearestPointOnSegment(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }): { x: number; y: number } {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return start;
    const t = Phaser.Math.Clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
    return { x: start.x + dx * t, y: start.y + dy * t };
  }

  private markDirty(): void {
    this.dirty = true;
    this.navigation.refreshGeometry();
    this.onChanged(true);
  }
}
