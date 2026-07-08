import type { StoredHomeDayRecord } from '@/types/home';
import type { WorldObjectCategory } from '@/types/world';

// Daily Seeds (Today Patch V2) — tiny, never-mandatory suggested actions that
// grow the patch when done. Inspired by Finch's micro-actions, but a completed
// seed plants a real object instead of feeding a pet. Two completion styles:
//   - 'passive': satisfied automatically from the day's signals (a walk, a new
//     place, a meaningful capture) — these double as passive "Life" signals.
//   - 'manual':  a gentle one-tap "I did this" (water, a calm pause, a hello)
//     that can't be sensed.
// Pure + dependency-light so the patch engine and the headless harness share it.

export type SeedArchetype = 'calm' | 'water' | 'movement' | 'exploration' | 'social' | 'reflection';

export type DailySeed = {
  id: string;
  emoji: string;
  label: string;
  archetype: SeedArchetype;
  // The object a completed seed grows (resolves to a cutout via world-visuals).
  reward: { assetKey: string; label: string };
  // Which patch CELL the seed contributes to (memory / places / journey / reflection).
  slot: WorldObjectCategory;
  completion: 'manual' | 'passive';
};

// Only the fields a seed reads — keeps the engine testable with plain objects.
type SeedDayInput = Pick<
  StoredHomeDayRecord,
  'isoDate' | 'seedCompletions' | 'stepsCount' | 'newPlaceCount' | 'capturedMeanings' | 'heroPhoto'
>;

type SeedDef = DailySeed & { passiveSatisfied?: (day: SeedDayInput) => boolean };

// The catalog. Rewards reuse existing world art where possible; `seed_water_lily`
// is the one new cutout (falls back to a placeholder until generated).
const SEED_CATALOG: SeedDef[] = [
  {
    id: 'calm',
    emoji: '🌿',
    label: 'Notice something peaceful',
    archetype: 'calm',
    reward: { assetKey: 'prop_flower', label: 'Flower Patch' },
    slot: 'reflection',
    completion: 'manual',
  },
  {
    id: 'water',
    emoji: '💧',
    label: 'Drink a glass of water',
    archetype: 'water',
    reward: { assetKey: 'seed_water_lily', label: 'Water Lily' },
    slot: 'journey',
    completion: 'manual',
  },
  {
    id: 'social',
    emoji: '🧑‍🤝‍🧑',
    label: 'Connect with someone',
    archetype: 'social',
    reward: { assetKey: 'prop_lantern', label: 'Lantern' },
    slot: 'reflection',
    completion: 'manual',
  },
  {
    id: 'movement',
    emoji: '⚡',
    label: 'Take a short walk',
    archetype: 'movement',
    reward: { assetKey: 'active_trail_marker', label: 'Trail Marker' },
    slot: 'journey',
    completion: 'passive',
    passiveSatisfied: (day) => (day.stepsCount ?? 0) >= 1000,
  },
  {
    id: 'exploration',
    emoji: '🌍',
    label: 'Step somewhere new',
    archetype: 'exploration',
    reward: { assetKey: 'exploration_tower', label: 'Watchtower' },
    slot: 'places',
    completion: 'passive',
    passiveSatisfied: (day) => (day.newPlaceCount ?? 0) > 0,
  },
  {
    id: 'reflection',
    emoji: '✨',
    label: 'Capture something meaningful',
    archetype: 'reflection',
    reward: { assetKey: 'memory_crystal', label: 'Memory Crystal' },
    slot: 'memory',
    completion: 'passive',
    passiveSatisfied: (day) =>
      (day.capturedMeanings ?? []).some((m) => m.archetype === 'meaningful') || !!day.heroPhoto,
  },
];

export const DAILY_SEEDS: DailySeed[] = SEED_CATALOG.map(({ passiveSatisfied: _omit, ...seed }) => seed);

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// A seed is "earned" — and so grows its reward — when manually completed, or
// (for passive seeds) once its signal is satisfied.
export function isSeedEarned(seed: SeedDef, day: SeedDayInput): boolean {
  if ((day.seedCompletions ?? []).includes(seed.id)) return true;
  return seed.completion === 'passive' && (seed.passiveSatisfied?.(day) ?? false);
}

// Every seed whose reward should appear on the patch right now.
export function earnedSeeds(day: SeedDayInput): DailySeed[] {
  return SEED_CATALOG.filter((seed) => isSeedEarned(seed, day)).map(
    ({ passiveSatisfied: _omit, ...seed }) => seed
  );
}

// The ≤3 seeds suggested for the day — a STABLE set per date (deterministic), so
// the strip doesn't reshuffle as the day goes; the UI marks each done via
// isSeedEarned. Manual seeds are preferred (passive ones grow on their own).
export function selectDailySeeds(day: SeedDayInput, max = 3): DailySeed[] {
  const rng = mulberry32(hashSeed(`seeds:${day.isoDate}`));
  const ordered = shuffle(SEED_CATALOG, rng).sort((a, b) => {
    // Manual first (they need a tap), then by shuffled order (stable per day).
    if (a.completion !== b.completion) return a.completion === 'manual' ? -1 : 1;
    return 0;
  });
  return ordered.slice(0, max).map(({ passiveSatisfied: _omit, ...seed }) => seed);
}

// Day-completion proxy: share of the offered seeds that are earned. Drives the
// "10% → 100%" fullness read alongside the patch's objects.
export function seedCompletionRatio(day: SeedDayInput): number {
  const offered = selectDailySeeds(day);
  if (offered.length === 0) return 0;
  const earned = offered.filter((seed) => {
    const def = SEED_CATALOG.find((s) => s.id === seed.id);
    return def ? isSeedEarned(def, day) : false;
  }).length;
  return earned / offered.length;
}
