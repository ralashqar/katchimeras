import type { StoredHomeDayRecord, StoredHomeState } from '@/types/home';
import { beginFreshEggCycle } from '@/utils/today-growth';

export function claimDailyHatchForDay(
  state: StoredHomeState,
  dayId: string,
  now: Date,
): StoredHomeState {
  const claim = (day: StoredHomeDayRecord): StoredHomeDayRecord => {
    if (!day.dailyHatch || !day.dailyHatch.revealedAt || day.dailyHatch.claimedAt) return day;
    return {
      ...day,
      state: 'hatched',
      dailyHatch: { ...day.dailyHatch, claimedAt: now.toISOString() },
    };
  };
  if (state.today.id === dayId) {
    const today = claim(state.today);
    return today === state.today ? state : { ...state, today };
  }
  const index = state.archivedDays.findIndex((day) => day.id === dayId);
  if (index < 0) return state;
  const claimed = claim(state.archivedDays[index]);
  if (claimed === state.archivedDays[index]) return state;
  const archivedDays = [...state.archivedDays];
  archivedDays[index] = claimed;
  return {
    ...state,
    archivedDays,
    // A past-day claim is the explicit handoff to the new Today Egg. Always
    // begin that Egg at zero, including developer/recovery replays whose target
    // may be older than yesterday. Receipts stay stored, but the new cycle
    // boundary prevents them driving its size or progress label.
    today: beginFreshEggCycle(state.today, now),
  };
}
