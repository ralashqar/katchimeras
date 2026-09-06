import type { StoredHomeLocationPoint } from '@/types/home';
import { getStoredJson, removeStoredValue, setStoredJson } from '@/utils/app-storage';

const HOME_ANCHOR_KEY = 'katchimeras.home.anchor.v1';

// A location within this many metres of the home anchor counts as "at home".
export const HOME_RADIUS_METERS = 150;

export type HomeAnchor = {
  lat: number;
  lng: number;
  // 'manual' = the user tagged it (onboarding "use my current spot"); 'learned'
  // = inferred from where they tend to be (future night-weighted clustering).
  source: 'manual' | 'learned';
  setAt: string;
};

export function loadHomeAnchor(): HomeAnchor | null {
  const raw = getStoredJson<HomeAnchor | null>(HOME_ANCHOR_KEY, null);
  if (!raw || !Number.isFinite(raw.lat) || !Number.isFinite(raw.lng)) {
    return null;
  }
  return raw;
}

export function saveHomeAnchor(anchor: HomeAnchor) {
  setStoredJson(HOME_ANCHOR_KEY, anchor);
}

export function clearHomeAnchor() {
  removeStoredValue(HOME_ANCHOR_KEY);
}

// Great-circle distance between two coordinates, in metres.
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isPointAtHome(
  lat: number,
  lng: number,
  anchor: HomeAnchor | null,
  radius = HOME_RADIUS_METERS
): boolean {
  if (!anchor) {
    return false;
  }
  return distanceMeters(lat, lng, anchor.lat, anchor.lng) <= radius;
}

// A copy of the day's points with any point within home radius re-typed as
// 'home' — being physically home wins over its other classification, so the map
// shows the home pin and the hatch can tell you were home.
export function tagHomeLocations(
  locations: StoredHomeLocationPoint[],
  anchor: HomeAnchor | null
): StoredHomeLocationPoint[] {
  if (!anchor) {
    return locations;
  }
  let changed = false;
  const tagged = locations.map((point) => {
    if (point.type !== 'home' && isPointAtHome(point.lat, point.lng, anchor)) {
      changed = true;
      return { ...point, type: 'home' as const };
    }
    return point;
  });
  return changed ? tagged : locations;
}

export function wasAtHome(locations: StoredHomeLocationPoint[], anchor: HomeAnchor | null): boolean {
  if (!anchor) {
    return false;
  }
  return locations.some((point) => isPointAtHome(point.lat, point.lng, anchor));
}
