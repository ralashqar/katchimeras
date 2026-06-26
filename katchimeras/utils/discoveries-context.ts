import type { HomeDayRecord } from '@/types/home';
import type { DiscoveryContext } from '@/types/discoveries';

// Folds every hydrated day (+ optional native health aggregates) into the lifetime
// aggregates the Discovery rules read. Pure: inject `now`, no storage access. The
// caller passes the full archive (useAllDays / hydrateAllDays).
//
// See docs/discoveries-system-design.md §3.

// Native-only sums that day records can't carry. Empty until the HealthKit
// aggregate read lands (then the distance/streak defs light up automatically).
export type HealthAggregates = {
  totalDistanceMeters?: number;
};

// Reflection prompt kinds that count as "a reflection" (matches the Memory Quests
// engine's REFLECTION_KINDS so the two stay consistent).
const REFLECTION_KINDS = new Set(['feeling', 'inner_weather', 'day_word', 'meaning', 'gratitude', 'highlight']);

// A day counts as a "walking day" if Health gave it a healthy step count or it has
// a walk moment.
const WALK_STEP_THRESHOLD = 5000;
const DAY_MS = 86_400_000;

function isWalkingDay(day: HomeDayRecord): boolean {
  if ((day.stepsCount ?? 0) >= WALK_STEP_THRESHOLD) return true;
  return (day.moments ?? []).some((moment) => moment.type === 'walk');
}

// Longest run of consecutive CALENDAR days (by isoDate, UTC to dodge DST) that
// qualify as walking days.
function longestWalkingStreak(days: HomeDayRecord[]): number {
  const walkTimes = days
    .filter(isWalkingDay)
    .map((day) => Date.parse(`${day.isoDate}T00:00:00Z`))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const t of walkTimes) {
    if (prev !== null && t === prev) continue; // de-dupe same day
    run = prev !== null && t - prev === DAY_MS ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

// A day "felt calm" when calm is the dominant facet (≥ every other and > 0). Range-
// agnostic, so it survives any future rescale of the 0–1 score model.
function isCalmDay(day: HomeDayRecord): boolean {
  const s = day.scores;
  if (!s || !(s.calm > 0)) return false;
  return s.calm >= s.energy && s.calm >= s.social && s.calm >= s.exploration && s.calm >= s.focus;
}

export function buildDiscoveryContext(
  days: HomeDayRecord[],
  now: Date,
  health: HealthAggregates = {}
): DiscoveryContext {
  const placeCategoryCounts: Record<string, number> = {};
  let uniquePlaceCount = 0;
  let photoCount = 0;
  let meaningfulMomentCount = 0;
  let voiceMemoryCount = 0;
  let foodMemoryCount = 0;
  let bigMomentCount = 0;
  const bigMomentTypes = new Set<string>();
  let maxStepsInADay = 0;
  let reflectionCount = 0;
  let calmDayCount = 0;
  let finalisedPatchCount = 0;
  let legendaryPatchCount = 0;

  for (const day of days) {
    // Exploration. NOTE: confirmedPlaces have no cross-day place identity (the id is
    // a per-day map-node id), so this counts marked place-visits, not strictly
    // unique venues — a fair v1 proxy; revisit if a place registry lands.
    const places = day.confirmedPlaces ?? [];
    uniquePlaceCount += places.length;
    for (const place of places) {
      placeCategoryCounts[place.category] = (placeCategoryCounts[place.category] ?? 0) + 1;
    }

    // Memory
    const meanings = day.capturedMeanings ?? [];
    photoCount += meanings.length + (day.heroPhoto ? 1 : 0);
    const voice = (day.notes ?? []).filter((note) => note.kind === 'voice').length;
    voiceMemoryCount += voice;
    const foods = (day.foodMoments ?? []).length;
    foodMemoryCount += foods;

    // Life
    const bigs = day.bigMoments ?? [];
    bigMomentCount += bigs.length;
    for (const big of bigs) bigMomentTypes.add(big.type);

    // "Meaningful moments" = every meaning-tagged entry the user chose to keep.
    meaningfulMomentCount += meanings.length + places.length + foods + bigs.length + voice;

    // Journey
    maxStepsInADay = Math.max(maxStepsInADay, day.stepsCount ?? 0);

    // Reflection
    reflectionCount += (day.promptAnswers ?? []).filter(
      (answer) => !answer.dismissed && REFLECTION_KINDS.has(answer.kind)
    ).length;
    if (isCalmDay(day)) calmDayCount += 1;

    // World
    if (day.state === 'hatched') {
      finalisedPatchCount += 1;
      if (day.creature?.rarity === 'legendary') legendaryPatchCount += 1;
    }
  }

  return {
    now,
    dayCount: days.length,
    uniquePlaceCount,
    placeCategoryCounts,
    countryCount: undefined,
    photoCount,
    meaningfulMomentCount,
    voiceMemoryCount,
    foodMemoryCount,
    bigMomentCount,
    bigMomentTypes,
    maxStepsInADay,
    walkingStreak: longestWalkingStreak(days),
    totalDistanceMeters: health.totalDistanceMeters,
    reflectionCount,
    calmDayCount,
    finalisedPatchCount,
    legendaryPatchCount,
  };
}
