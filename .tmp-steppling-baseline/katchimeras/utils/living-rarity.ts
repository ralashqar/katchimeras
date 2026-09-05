import type { HomeRarityTier, StoredHomeDayRecord } from '@/types/home';

// Rarity comes from living, not from tapping. A creature is as rare as the day
// that birthed it was unusual — a place you'd never been, the small hours, a day
// your body really moved, a span of map far past your usual edges. It is
// computed once, at hatch, and never recomputed: rarity is fixed at birth.
//
// Bond — how often you return — is the deliberately separate axis and lives in
// ./bond. Nothing here looks at history; this only reads the day itself.

export type LivingRarityFactor =
  | 'new_place'
  | 'far_from_routine'
  | 'night_owl'
  | 'first_light'
  | 'long_journey'
  | 'wandering';

export type LivingRarity = {
  tier: HomeRarityTier;
  score: number;
  factors: LivingRarityFactor[];
  reason: string | null;
};

type FactorDef = { factor: LivingRarityFactor; weight: number; reason: string };

const FAR_SPAN_METERS = 25_000;
const ROAMING_SPAN_METERS = 8_000;
const LONG_JOURNEY_STEPS = 12_000;
const MOVED_STEPS = 9_000;
const RUN_ACTIVITY_PATTERN = /run|jog/i;

export function computeLivingRarity(day: StoredHomeDayRecord): LivingRarity {
  const defs: FactorDef[] = [];

  if (day.newPlaceCount >= 2) {
    defs.push({ factor: 'new_place', weight: 0.45, reason: 'places you’d never set foot in' });
  } else if (day.newPlaceCount === 1) {
    defs.push({ factor: 'new_place', weight: 0.25, reason: 'a place you’d never been' });
  }

  const span = computeDaySpanMeters(day.locations);
  if (span >= FAR_SPAN_METERS) {
    defs.push({ factor: 'far_from_routine', weight: 0.5, reason: 'somewhere far from your usual map' });
  } else if (span >= ROAMING_SPAN_METERS) {
    defs.push({ factor: 'far_from_routine', weight: 0.3, reason: 'a day that roamed well past the usual edges' });
  }

  const hours = collectActivityHours(day);
  if (hours.some((hour) => hour >= 0 && hour < 4)) {
    defs.push({ factor: 'night_owl', weight: 0.3, reason: 'the small hours, while most of the world slept' });
  } else if (hours.some((hour) => hour >= 4 && hour < 7)) {
    defs.push({ factor: 'first_light', weight: 0.2, reason: 'out before first light' });
  }

  if (hasRunWorkout(day) || day.stepsCount >= LONG_JOURNEY_STEPS) {
    defs.push({ factor: 'long_journey', weight: 0.35, reason: 'a day your body really moved' });
  } else if (day.stepsCount >= MOVED_STEPS) {
    defs.push({ factor: 'long_journey', weight: 0.2, reason: 'a day with real distance in it' });
  }

  if (day.visitedPlaceCount >= 4) {
    defs.push({ factor: 'wandering', weight: 0.2, reason: 'a day of many small stops' });
  }

  const score = clamp01(defs.reduce((sum, def) => sum + def.weight, 0));
  const top = [...defs].sort((left, right) => right.weight - left.weight)[0] ?? null;

  return {
    tier: scoreToTier(score),
    score,
    factors: defs.map((def) => def.factor),
    reason: top?.reason ?? null,
  };
}

const tierRank: Record<HomeRarityTier, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

const rankTier: HomeRarityTier[] = ['common', 'rare', 'epic', 'legendary'];

// The higher of two rarity tiers wins — used to blend a creature's intrinsic
// floor (a landmark is never "common") with the rarity its birth-day earned.
export function maxRarity(left: HomeRarityTier, right: HomeRarityTier): HomeRarityTier {
  return tierRank[left] >= tierRank[right] ? left : right;
}

function scoreToTier(score: number): HomeRarityTier {
  if (score >= 0.8) return 'legendary';
  if (score >= 0.55) return 'epic';
  if (score >= 0.3) return 'rare';
  return 'common';
}

export function rarityTierFromRank(rank: number): HomeRarityTier {
  return rankTier[Math.min(Math.max(rank, 0), rankTier.length - 1)];
}

export function computeDaySpanMeters(locations: StoredHomeDayRecord['locations']): number {
  if (locations.length < 2) {
    return 0;
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const point of locations) {
    if (point.lat < minLat) minLat = point.lat;
    if (point.lat > maxLat) maxLat = point.lat;
    if (point.lng < minLng) minLng = point.lng;
    if (point.lng > maxLng) maxLng = point.lng;
  }

  return distanceMeters(minLat, minLng, maxLat, maxLng);
}

function collectActivityHours(day: StoredHomeDayRecord): number[] {
  const hours: number[] = [];
  const push = (iso: string | undefined | null) => {
    if (!iso) return;
    const time = new Date(iso);
    if (!Number.isNaN(time.getTime())) {
      hours.push(time.getHours());
    }
  };

  day.locations.forEach((point) => push(point.capturedAt));
  day.moments.forEach((moment) => push(moment.createdAt));
  day.exactRouteSegments.forEach((segment) => {
    push(segment.startedAt);
    segment.coordinates.forEach((coordinate) => push(coordinate.capturedAt));
  });

  return hours;
}

function hasRunWorkout(day: StoredHomeDayRecord): boolean {
  return day.exactRouteSegments.some((segment) => RUN_ACTIVITY_PATTERN.test(segment.activityType));
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadius = 6_371_000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
