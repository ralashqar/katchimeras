import { HOME_HATCH_HOUR } from '@/constants/hatch';
import type { StoredHomeState } from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { todayGrowthSummary } from '@/utils/today-growth';

export type HatchNotificationPlan = {
  dayId: string;
  targetAt: Date;
  isReady: boolean;
};

export function resolveHatchNotificationPlan(
  state: StoredHomeState,
  profile: OnboardingProfile,
  now = new Date(),
): HatchNotificationPlan {
  const hatchHour = Math.min(Math.max(Math.round(profile.hatchHour ?? HOME_HATCH_HOUR), 17), 23);

  if (state.today.state !== 'hatched') {
    const targetAt = todayGrowthSummary(state.today, hatchHour, now).effectiveHatchAt;
    return {
      dayId: state.today.isoDate,
      targetAt,
      isReady: targetAt.getTime() <= now.getTime(),
    };
  }

  // Once today is hatched, prepare exactly one alert for tomorrow. Prefer the
  // real tomorrow record so future lifecycle changes keep the correct day key.
  const tomorrow = state.tomorrow;
  if (tomorrow) {
    const targetAt = todayGrowthSummary(tomorrow, hatchHour, now).effectiveHatchAt;
    return { dayId: tomorrow.isoDate, targetAt, isReady: targetAt.getTime() <= now.getTime() };
  }

  const tomorrowTarget = new Date(now);
  tomorrowTarget.setDate(tomorrowTarget.getDate() + 1);
  tomorrowTarget.setHours(hatchHour, 0, 0, 0);
  return {
    dayId: localDateId(tomorrowTarget),
    targetAt: tomorrowTarget,
    isReady: false,
  };
}

function localDateId(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
