import { Platform } from 'react-native';

import KatchimeraMapSearch, { type NativeApplePlace } from '@/modules/katchimera-map-search';

export type ApplePlaceSearchResult = NativeApplePlace;
export type PlaceSearchAnchor = { latitude: number; longitude: number };

export function appleMapSearchAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return KatchimeraMapSearch?.isAvailable() === true;
  } catch {
    return false;
  }
}

export async function searchApplePlaces(
  query: string,
  anchor?: PlaceSearchAnchor | null,
  radiusMeters = 30_000
): Promise<ApplePlaceSearchResult[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2 || !appleMapSearchAvailable() || !KatchimeraMapSearch) return [];
  try {
    const results = await KatchimeraMapSearch.searchAsync(
      cleanQuery,
      anchor?.latitude ?? null,
      anchor?.longitude ?? null,
      radiusMeters
    );
    return results
      .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude) && item.name.trim())
      .slice(0, 5);
  } catch {
    return [];
  }
}

export async function searchApplePlacesAroundAnchors(
  query: string,
  anchors: PlaceSearchAnchor[],
  radiusMeters = 30_000
): Promise<ApplePlaceSearchResult[]> {
  if (anchors.length === 0) return searchApplePlaces(query, null, radiusMeters);
  const batches = await Promise.all(anchors.slice(0, 3).map((anchor) => searchApplePlaces(query, anchor, radiusMeters)));
  const merged = new Map<string, ApplePlaceSearchResult>();
  for (const results of batches) {
    for (const result of results) {
      const key = `${result.name.toLocaleLowerCase()}|${result.latitude.toFixed(4)}|${result.longitude.toFixed(4)}`;
      const existing = merged.get(key);
      if (!existing || (result.distanceMeters ?? Infinity) < (existing.distanceMeters ?? Infinity)) merged.set(key, result);
    }
  }
  return [...merged.values()]
    .sort((left, right) => (left.distanceMeters ?? Infinity) - (right.distanceMeters ?? Infinity) || (left.rank ?? Infinity) - (right.rank ?? Infinity))
    .slice(0, 5);
}
