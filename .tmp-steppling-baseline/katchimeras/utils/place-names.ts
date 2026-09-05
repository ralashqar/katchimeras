import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

// Reverse-geocoding the SAME coordinate can return different labels on different
// calls (map-data updates, offline fallbacks). That made a place's name flicker
// every time a sheet re-opened. We fix it by caching the FIRST resolved label per
// coordinate and reusing it forever — the name a place gets is the name it keeps.

export type ResolvedPlaceName = {
  primary: string;
  locality: string | null;
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
};

const CACHE_KEY = 'katcha:place-names:v1';
// ~110 m grid — close to the day-map cluster radius (150 m), so a cluster's drifting
// centroid keeps hitting the same cache key.
const PRECISION = 3;

let memCache: Record<string, ResolvedPlaceName> | null = null;
let loadPromise: Promise<Record<string, ResolvedPlaceName>> | null = null;

function keyFor(latitude: number, longitude: number): string {
  return `${latitude.toFixed(PRECISION)},${longitude.toFixed(PRECISION)}`;
}

async function loadCache(): Promise<Record<string, ResolvedPlaceName>> {
  if (memCache) return memCache;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        memCache = raw ? (JSON.parse(raw) as Record<string, ResolvedPlaceName>) : {};
      } catch {
        memCache = {};
      }
      return memCache;
    })();
  }
  return loadPromise;
}

function persist(cache: Record<string, ResolvedPlaceName>): void {
  void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache)).catch(() => {});
}

// Apple gives the door number (streetNumber) separately from the street, so a real
// POI name ("Blue Bottle Coffee") is preserved while a bare address ("122 Meridian
// Place") falls back to the number-free street.
function labelFromGeocode(result: Location.LocationGeocodedAddress, coords: string): ResolvedPlaceName {
  const name = result.name?.trim() ?? '';
  const street = result.street?.trim() ?? '';
  const streetNumber = result.streetNumber?.trim() ?? '';
  const isStreetAddress =
    !name ||
    name === street ||
    (Boolean(streetNumber) && Boolean(street) && name.toLowerCase() === `${streetNumber} ${street}`.toLowerCase());
  const primary = (isStreetAddress ? street : name) || result.district?.trim() || result.city?.trim() || coords;
  const locality =
    [result.city, result.region]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value) && value !== primary)
      .slice(0, 2)
      .join(', ') || null;
  return {
    primary,
    locality,
    city: result.city?.trim() || null,
    region: result.region?.trim() || null,
    countryCode: result.isoCountryCode?.trim().toUpperCase() || null,
  };
}

// Resolve a coordinate to a stable, persisted place label. First resolution wins.
export async function resolvePlaceName(latitude: number, longitude: number): Promise<ResolvedPlaceName> {
  const cache = await loadCache();
  const key = keyFor(latitude, longitude);
  const cached = cache[key];
  if (cached) return cached;

  const coords = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  let entry: ResolvedPlaceName = { primary: coords, locality: null };
  try {
    const [result] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (result) entry = labelFromGeocode(result, coords);
  } catch {
    // Offline / no permission — keep the coordinate label, but DON'T cache a
    // fallback as if it were final, so a later online open can still name it.
    return entry;
  }
  cache[key] = entry;
  persist(cache);
  return entry;
}
