import type { StoredHomeDayRecord, StoredHomeState } from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';

import { normalizeStoredHomeState } from './state-normalization';

/** Reveals an already-finalized Daily Wisp. It never creates a same-day hatch. */
export function triggerHatchForDay(
  state: StoredHomeState,
  dayId: string,
  profile: OnboardingProfile,
  now: Date,
): StoredHomeState {
  if (state.today.id === dayId) {
    if (!isRevealableDailyHatch(state.today)) return state;
    return normalizeStoredHomeState(
      { ...state, today: revealSealedDay(state.today, now) },
      profile,
      now,
    );
  }

  const archivedIndex = state.archivedDays.findIndex((day) => day.id === dayId);
  if (archivedIndex < 0 || !isRevealableDailyHatch(state.archivedDays[archivedIndex])) {
    return state;
  }

  const archivedDays = [...state.archivedDays];
  archivedDays[archivedIndex] = revealSealedDay(archivedDays[archivedIndex], now);
  return normalizeStoredHomeState({ ...state, archivedDays }, profile, now);
}

function isRevealableDailyHatch(day: StoredHomeDayRecord): boolean {
  return day.state === 'sealed'
    && Boolean(day.dailyHatch)
    && !day.dailyHatch?.revealedAt
    && !day.dailyHatch?.claimedAt;
}

function revealSealedDay(day: StoredHomeDayRecord, now: Date): StoredHomeDayRecord {
  if (!day.dailyHatch) return day;
  return {
    ...day,
    state: 'sealed',
    dailyHatch: { ...day.dailyHatch, revealedAt: now.toISOString() },
  };
}
