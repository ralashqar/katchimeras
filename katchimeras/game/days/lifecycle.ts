import { HOME_HATCH_HOUR } from '@/constants/home-mvp';
import type { HomeDayState, StoredHomeDayRecord } from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { resolveDayLifecycleState } from '@/utils/day-state';
import { todayGrowthSummary } from '@/utils/today-growth';
import { toLocalDateId } from './date';
import { dayHasShape } from './shape';

export function resolveHatchHour(profile: OnboardingProfile) {
  const hour = profile.hatchHour ?? HOME_HATCH_HOUR;
  return Math.min(Math.max(Math.round(hour), 17), 23);
}

export function resolveDayState(day: StoredHomeDayRecord, now: Date, hatchHour: number): HomeDayState {
  if (day.devForceReadyToHatch && !day.creature) return 'ready_to_hatch';
  const growth = todayGrowthSummary(day, hatchHour, now);
  const isToday = day.isoDate === toLocalDateId(now);
  if (isToday && !growth.isActivated) return 'forming';
  return resolveDayLifecycleState({
    hasCreature: Boolean(day.creature),
    storedState: day.state,
    hasShape: dayHasShape(day),
    isSameDay: isToday,
    hour: now.getHours(),
    minute: now.getMinutes(),
    hatchHour,
    earlyHatchMinutes: growth.savedMinutes,
  });
}

export function resolveRolledPastDay(
  day: StoredHomeDayRecord,
  profile: OnboardingProfile,
  now: Date
): StoredHomeDayRecord {
  if (day.state === 'hatched') {
    return day;
  }

  if (!dayHasShape(day)) {
    return {
      ...day,
      state: 'forming',
    };
  }

  if (resolveDayState(day, now, resolveHatchHour(profile)) === 'ready_to_hatch') {
    return day;
  }

  return {
    ...day,
    state: 'ready_to_hatch',
  };
}
