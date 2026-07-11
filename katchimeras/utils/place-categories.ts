import type { DayMapNode, StoredHomeDayRecord } from '@/types/home';
import { deriveDayMapSummary } from '@/utils/day-map-engine';
import { supabase } from '@/utils/supabase';

const REQUEST_TIMEOUT_MS = 6000;
const MIN_DWELL_MS = 8 * 60 * 1000;
const MAX_DWELL_MS = 3 * 60 * 60 * 1000;
const ANCHOR_DISTANCE_METERS = 220;
const ANCHOR_PRIOR_DAY_COUNT = 2;
const COORDINATE_PRECISION = 4;

// Product mapping from Apple POI categories to encounter seed ids. Only
// categories whose cast can honestly hatch belong here.
const APPLE_CATEGORY_TO_SEED: Record<string, string> = {
  Cafe: 'coffee_shop',
  Bakery: 'bakery',
  Park: 'park',
  NationalPark: 'park',
  Playground: 'park',
  FoodMarket: 'farm',
  Library: 'library',
  Museum: 'museum',
  Beach: 'beach',
  MovieTheater: 'cinema',
};

type ResolvedCategory = {
  clusterId: string;
  appleCategory: string | null;
};

// Resolves the day's dwell clusters to encounter seeds via the
// resolve-place-categories edge function. Privacy: coordinates are rounded,
// transit the function for lookup only, and only categories come back.
// Precision guards live here, where the data Apple lacks exists:
// - dwell window: pass-throughs (<8 min) and home/work camps (>3h) are skipped
// - anchor exclusion: clusters recurring across prior days (home, office)
//   are never sent at all
export async function resolvePlaceSeedsForDay(
  day: StoredHomeDayRecord,
  priorDays: StoredHomeDayRecord[],
  options: { allowRemote?: boolean } = {}
): Promise<string[]> {
  // Coordinate enrichment is never an automatic hatch-time side effect. A
  // future explicit user action may opt this one lookup in; manual categories
  // and local dwell patterns remain the default intelligence path.
  if (options.allowRemote !== true) return [];
  const dayMap = deriveDayMapSummary(day.locations, day.moments);
  if (!dayMap || dayMap.nodes.length === 0) {
    return [];
  }

  const clusters = dayMap.nodes
    .filter((node) => isVisitDwell(node) && !isRecurringAnchor(node, priorDays))
    .map((node) => ({
      id: node.id,
      latitude: roundCoordinate(node.latitude),
      longitude: roundCoordinate(node.longitude),
    }));

  if (clusters.length === 0) {
    return [];
  }

  try {
    const invocation = supabase.functions.invoke('resolve-place-categories', {
      body: { clusters },
    });
    const timeout = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), REQUEST_TIMEOUT_MS);
    });
    const result = await Promise.race([invocation, timeout]);

    if (!result || result.error) {
      return [];
    }

    const categories = (result.data as { categories?: ResolvedCategory[] } | null)?.categories;
    if (!Array.isArray(categories)) {
      return [];
    }

    const seeds = categories
      .map((entry) => (entry.appleCategory ? APPLE_CATEGORY_TO_SEED[entry.appleCategory] : undefined))
      .filter((seed): seed is string => Boolean(seed));

    return [...new Set(seeds)];
  } catch {
    return [];
  }
}

function isVisitDwell(node: DayMapNode) {
  const dwellMs = new Date(node.endedAt).getTime() - new Date(node.startedAt).getTime();
  return Number.isFinite(dwellMs) && dwellMs >= MIN_DWELL_MS && dwellMs <= MAX_DWELL_MS;
}

function isRecurringAnchor(node: DayMapNode, priorDays: StoredHomeDayRecord[]) {
  const daysSeenNearby = priorDays.filter((priorDay) =>
    priorDay.locations.some(
      (location) =>
        getDistanceMeters(node.latitude, node.longitude, location.lat, location.lng) <=
        ANCHOR_DISTANCE_METERS
    )
  ).length;

  return daysSeenNearby >= ANCHOR_PRIOR_DAY_COUNT;
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(COORDINATE_PRECISION));
}

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadius = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}
