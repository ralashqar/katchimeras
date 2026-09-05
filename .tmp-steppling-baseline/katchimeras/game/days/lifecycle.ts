import type { HomeDayState, StoredHomeDayRecord } from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { todayGrowthActivation } from '@/utils/today-growth';
import { finalizeDailyWispHatch } from '@/utils/daily-wisp-hatch';

export function resolveDayState(day: StoredHomeDayRecord, _now: Date): HomeDayState {
  if (day.dailyHatch) return day.dailyHatch.claimedAt ? 'hatched' : 'sealed';
  if (day.creature) return 'hatched';
  // Today only gathers context. Its Wisp is finalized on rollover and revealed
  // from the archive the next time the player visits; no clock can hatch it.
  return 'forming';
}

export function resolveRolledPastDay(
  day: StoredHomeDayRecord,
  profile: OnboardingProfile,
  now: Date
): StoredHomeDayRecord {
  if (day.state === 'hatched' || day.state === 'sealed' || day.dailyHatch || day.creature) {
    return day;
  }

  if (todayGrowthActivation(day).isActivated) {
    const daily = finalizeDailyWispHatch({
      day,
      now: new Date(`${day.isoDate}T23:59:59`),
      pastDays: [],
      provenance: 'rollover',
      revealed: false,
    });
    return {
      ...day,
      state: 'sealed',
      shareReadyAt: daily.hatch.sealedAt,
      creature: null,
      dailyHatch: daily.hatch,
      card: daily.card,
    };
  }

  // A day with no meaningful context stays an honest, unhatched journal day.
  // Retrospective input can still activate and finalize it later.
  return { ...day, state: 'forming' };
}
