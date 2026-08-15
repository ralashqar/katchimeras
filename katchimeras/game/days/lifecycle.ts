import { HOME_HATCH_HOUR } from '@/constants/hatch';
import type { HomeDayState, StoredHomeDayRecord } from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { resolveDayLifecycleState } from '@/utils/day-state';
import { toLocalDateId } from './date';

export function resolveHatchHour(profile: OnboardingProfile) {
  const hour = profile.hatchHour ?? HOME_HATCH_HOUR;
  return Math.min(Math.max(Math.round(hour), 17), 23);
}

export function resolveDayState(day: StoredHomeDayRecord, now: Date, hatchHour: number): HomeDayState {
  if (day.devForceReadyToHatch && !day.creature) return 'ready_to_hatch';
  const isToday = day.isoDate === toLocalDateId(now);
  return resolveDayLifecycleState({
    hasCreature: Boolean(day.creature),
    storedState: day.state,
    isSameDay: isToday,
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds(),
    millisecond: now.getMilliseconds(),
    hatchHour,
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

  if (resolveDayState(day, now, resolveHatchHour(profile)) === 'ready_to_hatch') {
    return day;
  }

  return {
    ...day,
    state: 'ready_to_hatch',
  };
}
