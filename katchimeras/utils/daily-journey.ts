import type { StoredHomeDayRecord, TodayGrowthSource } from '@/types/home';
import type { DailyJourneyMilestone, DailyJourneyState } from '@/types/meta-game';
import { normalizeDayGrowthState } from '@/utils/today-growth';

export const DAILY_JOURNEY_TARGET = 100;

export const DAILY_JOURNEY_MILESTONES: readonly DailyJourneyMilestone[] = [
  { id: 'first_gift', points: 25, label: 'A little gift' },
  { id: 'memory_gift', points: 60, label: 'A memory gift' },
  { id: 'hatch', points: 100, label: 'Daily Hatch' },
];

const JOURNEY_POINTS: Readonly<Record<TodayGrowthSource, number>> = {
  mood: 5,
  sleep: 8,
  movement: 10,
  place: 10,
  photo: 15,
  voice_note: 18,
  journal: 20,
  quest: 12,
  reflection: 15,
  daily_seed: 0,
  quick_goal: 20,
  mini_game: 8,
};

const SOURCE_CAPS: Readonly<Partial<Record<TodayGrowthSource, number>>> = {
  mini_game: 16,
  mood: 5,
  movement: 10,
  quick_goal: 40,
  sleep: 8,
};

/**
 * Derives the daily path from the existing Growth receipt ledger. This keeps
 * captures idempotent and prevents repetitive game actions from becoming the
 * dominant way to hatch.
 */
export function dailyJourneyForDay(day: Pick<StoredHomeDayRecord, 'isoDate' | 'growth'>): DailyJourneyState {
  const sourcePoints: DailyJourneyState['sourcePoints'] = {};
  for (const event of normalizeDayGrowthState(day.growth).events) {
    const source = event.source;
    const current = sourcePoints[source] ?? 0;
    const cap = SOURCE_CAPS[source] ?? Number.POSITIVE_INFINITY;
    sourcePoints[source] = Math.min(cap, current + JOURNEY_POINTS[source]);
  }
  const points = Math.min(DAILY_JOURNEY_TARGET, Object.values(sourcePoints).reduce((sum, value) => sum + (value ?? 0), 0));
  return {
    dayId: day.isoDate,
    points,
    target: DAILY_JOURNEY_TARGET,
    reachedMilestones: DAILY_JOURNEY_MILESTONES.filter((milestone) => points >= milestone.points).map((milestone) => milestone.id),
    hatchReady: points >= DAILY_JOURNEY_TARGET,
    sourcePoints,
  };
}

export function nextDailyJourneyMilestone(state: DailyJourneyState): DailyJourneyMilestone | null {
  return DAILY_JOURNEY_MILESTONES.find((milestone) => state.points < milestone.points) ?? null;
}
