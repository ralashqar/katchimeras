import type { StoredHomeLocationPoint } from '@/types/home';
import type { PlaceSearchAnchor } from '@/utils/apple-map-search';

type JournalHomeAnchor = { lat: number; lng: number };

const CATEGORY_QUERIES: Record<string, string> = {
  park: 'park',
  city: 'city centre',
  beach: 'beach',
  forest: 'forest or walking trail',
  garden: 'garden',
  museum: 'museum or gallery',
  cafe: 'cafe',
  restaurant: 'restaurant',
};

type PlaceCluster = PlaceSearchAnchor & {
  count: number;
  explicitWeight: number;
  latestAt: number;
  home: boolean;
};

export function journalPlaceSearchQuery(specific: string, categoryId: string): string {
  return specific.trim() || CATEGORY_QUERIES[categoryId] || '';
}

export function journalPlaceCategoryHasFallback(categoryId: string): boolean {
  return Boolean(CATEGORY_QUERIES[categoryId]);
}

export function journalDaySearchAnchors(
  points: StoredHomeLocationPoint[] | undefined,
  homeAnchor: JournalHomeAnchor | null = null,
  limit = 2
): PlaceSearchAnchor[] {
  if (!points?.length || limit <= 0) return [];
  const clusters: PlaceCluster[] = [];
  const sorted = points
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng) && point.lat >= -90 && point.lat <= 90 && point.lng >= -180 && point.lng <= 180)
    .sort((left, right) => Date.parse(left.capturedAt) - Date.parse(right.capturedAt));

  for (const point of sorted) {
    const existing = clusters.find((cluster) => distanceBetween(cluster.latitude, cluster.longitude, point.lat, point.lng) <= 250);
    const timestamp = Date.parse(point.capturedAt);
    const explicitWeight = point.source === 'manual' || point.source === 'photo_attachment' ? 3 : point.type !== 'unknown' ? 1 : 0;
    const home = point.type === 'home' || Boolean(homeAnchor && distanceBetween(point.lat, point.lng, homeAnchor.lat, homeAnchor.lng) <= 150);
    if (!existing) {
      clusters.push({
        latitude: point.lat,
        longitude: point.lng,
        count: 1,
        explicitWeight,
        latestAt: Number.isFinite(timestamp) ? timestamp : 0,
        home,
      });
      continue;
    }
    const nextCount = existing.count + 1;
    existing.latitude = (existing.latitude * existing.count + point.lat) / nextCount;
    existing.longitude = (existing.longitude * existing.count + point.lng) / nextCount;
    existing.count = nextCount;
    existing.explicitWeight += explicitWeight;
    existing.latestAt = Math.max(existing.latestAt, Number.isFinite(timestamp) ? timestamp : 0);
    existing.home = existing.home || home;
  }

  const hasAwayCluster = clusters.some((cluster) => !cluster.home);
  return clusters
    .filter((cluster) => !hasAwayCluster || !cluster.home)
    .sort((left, right) => {
      const leftScore = left.explicitWeight * 20 + Math.min(left.count, 12) * 2;
      const rightScore = right.explicitWeight * 20 + Math.min(right.count, 12) * 2;
      return rightScore - leftScore || right.latestAt - left.latestAt;
    })
    .slice(0, limit)
    .map(({ latitude, longitude }) => ({ latitude, longitude }));
}

export function mergePlaceSearchAnchors(dayAnchors: PlaceSearchAnchor[], current: PlaceSearchAnchor | null, limit = 3): PlaceSearchAnchor[] {
  const merged: PlaceSearchAnchor[] = [];
  for (const anchor of [...dayAnchors, ...(current ? [current] : [])]) {
    if (!merged.some((candidate) => distanceBetween(candidate.latitude, candidate.longitude, anchor.latitude, anchor.longitude) <= 400)) merged.push(anchor);
    if (merged.length >= limit) break;
  }
  return merged;
}

function distanceBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const radius = 6_371_000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(haversine)));
}
