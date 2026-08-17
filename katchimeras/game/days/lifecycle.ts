import { HOME_HATCH_HOUR } from '@/constants/hatch';
import type { HomeDayState, StoredHomeDayRecord } from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { resolveDayLifecycleState } from '@/utils/day-state';
import { toLocalDateId } from './date';
import { todayGrowthActivation } from '@/utils/today-growth';
import { finalizeDailyWispHatch } from '@/utils/daily-wisp-hatch';

export function resolveHatchHour(profile: OnboardingProfile) {
  const hour = profile.hatchHour ?? HOME_HATCH_HOUR;
  return Math.min(Math.max(Math.round(hour), 17), 23);
}

export function resolveDayState(day: StoredHomeDayRecord, now: Date, hatchHour: number): HomeDayState {
  if (day.dailyHatch) return day.dailyHatch.revealedAt ? 'hatched' : 'sealed';
  if (day.devForceReadyToHatch && !day.creature) return 'ready_to_hatch';
  const isToday = day.isoDate === toLocalDateId(now);
  const resolved = resolveDayLifecycleState({
    hasCreature: Boolean(day.creature),
    storedState: day.state,
    isSameDay: isToday,
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds(),
    millisecond: now.getMilliseconds(),
    hatchHour,
  });
  return resolved === 'ready_to_hatch' && !todayGrowthActivation(day).isActivated
    ? 'forming'
    : resolved;
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
