import type { OfficeNavigationMapData } from '../types/navigationMap';

// v3 starts from the recovered 2026-08-26 edit set and avoids a blank value
// that may have been created on the temporary localhost:8054 origin.
const STORAGE_KEY = 'ai-video-studio:office-navigation-edits:v3';

export class NavigationEditStorage {
  static load(fallback: OfficeNavigationMapData, recovered?: OfficeNavigationMapData): OfficeNavigationMapData {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      if (!value) return structuredClone(recovered ?? fallback);
      const parsed = JSON.parse(value);
      const finitePoint = (point: { x?: number; y?: number } | null) =>
        point && Number.isFinite(point.x) && Number.isFinite(point.y);
      const regionsValid = ['walkable', 'collisions', 'doors'].every((key) =>
        Array.isArray(parsed?.[key]) && parsed[key].every((region: { id?: string; points?: unknown[] }) =>
          region && typeof region.id === 'string' && Array.isArray(region.points)
          && region.points.length >= 3 && region.points.every((point) => finitePoint(point as { x: number; y: number }))));
      const anchorsValid = ['interactionAnchors', 'seats', 'spawns', 'waypoints'].every((key) =>
        Array.isArray(parsed?.[key]) && parsed[key].every((anchor: { id?: string; position?: { x: number; y: number } }) =>
          anchor && typeof anchor.id === 'string' && finitePoint(anchor.position ?? null)));
      if (!regionsValid || !anchorsValid || !parsed.walkable.length) return structuredClone(recovered ?? fallback);
      return parsed as OfficeNavigationMapData;
    } catch {
      return structuredClone(recovered ?? fallback);
    }
  }

  static save(mapData: OfficeNavigationMapData): void {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mapData));
  }

  static reset(): void {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
