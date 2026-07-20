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
