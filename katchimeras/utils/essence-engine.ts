import type { HomeDayRecord } from '@/types/home';
import type { DiscoveryDef, DiscoveryRarity } from '@/types/discoveries';

// Pure Essence economy. Earned is DERIVED from immutable history (each real event
// pays once → can't be farmed, survives reinstall); spent is passed in. No side
// effects, inject nothing time-dependent. See progression-customisation-design §3.

// Per-event awards (mirror the signals discoveries-context reads).
export const ESSENCE_AWARD = {
  photoWithMeaning: 5,
  heroPhoto: 5,
  voice: 8,
  reflection: 4,
  place: 6,
  newPlaceBonus: 4, // makes the first `newPlaceCount` confirmed places effectively +10
  food: 5,
  studio: 5,
  bigMoment: 15,
  weeklyRecap: 25,
  questComplete: 12, // a companion quest fulfilled (docs/katchimera-engagement-v1.md)
  zodiacRitual: 1, // first completed Zodiac ritual per local day
} as const;

// Discovery essence by rarity (a def may override via essenceReward).
const RARITY_ESSENCE: Record<DiscoveryRarity, number> = {
  common: 20,
  rare: 40,
  epic: 70,
  legendary: 100,
};

const REFLECTION_KINDS = new Set(['feeling', 'inner_weather', 'day_word', 'meaning', 'gratitude', 'highlight']);

// Every 7 finalised days earns one weekly-recap reward (a simple, deterministic
// proxy for "a week of patches" — avoids calendar-week edge cases).
const DAYS_PER_RECAP = 7;

export function discoveryEssence(def: Pick<DiscoveryDef, 'rarity' | 'essenceReward'>): number {
  return def.essenceReward ?? RARITY_ESSENCE[def.rarity] ?? 0;
}

// Essence a single day's recorded events are worth. Pure over the day's signals.
export function essenceAwardsForDay(day: HomeDayRecord): number {
  let total = 0;
  total += (day.capturedMeanings?.length ?? 0) * ESSENCE_AWARD.photoWithMeaning;
  if (day.heroPhoto) total += ESSENCE_AWARD.heroPhoto;
  total += (day.notes ?? []).filter((note) => note.kind === 'voice').length * ESSENCE_AWARD.voice;
  total +=
    (day.promptAnswers ?? []).filter((answer) => !answer.dismissed && REFLECTION_KINDS.has(answer.kind)).length *
    ESSENCE_AWARD.reflection;
  const places = day.confirmedPlaces?.length ?? 0;
  total += places * ESSENCE_AWARD.place;
  total += Math.min(day.newPlaceCount ?? 0, places) * ESSENCE_AWARD.newPlaceBonus;
  total += (day.foodMoments?.length ?? 0) * ESSENCE_AWARD.food;
  total += (day.studioMoments?.length ?? 0) * ESSENCE_AWARD.studio;
  total += (day.bigMoments?.length ?? 0) * ESSENCE_AWARD.bigMoment;
  return total;
}

// Total essence EARNED across all of history: per-day events + unlocked-discovery
// rewards + weekly recaps. Deterministic — identical history always yields the same
// total (the anti-farm / reinstall-safe guarantee).
export function earnedTotal(
  days: HomeDayRecord[],
  unlockedDiscoveries: DiscoveryDef[],
  // Completed companion quests each pay once (the ledger persists completedAt,
  // so this stays deterministic + anti-farm like the rest of `earned`).
  completedQuestCount = 0,
  zodiacRitualCompletionCount = 0,
  streakMilestoneEssence = 0,
): number {
  let total = 0;
  for (const day of days) total += essenceAwardsForDay(day);
  for (const def of unlockedDiscoveries) total += discoveryEssence(def);
  const finalised = days.filter((day) => day.state === 'hatched').length;
  total += Math.floor(finalised / DAYS_PER_RECAP) * ESSENCE_AWARD.weeklyRecap;
  total += completedQuestCount * ESSENCE_AWARD.questComplete;
  total += zodiacRitualCompletionCount * ESSENCE_AWARD.zodiacRitual;
  total += Math.max(0, streakMilestoneEssence);
  return total;
}

export function essenceBalance(earned: number, spent: number): number {
  return Math.max(0, earned - spent);
}
