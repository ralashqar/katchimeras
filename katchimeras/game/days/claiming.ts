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
    // Claiming yesterday closes its full Egg cycle and begins today's at zero.
    // Keep all receipts and journal artifacts, but do not let yesterday-era
    // Growth continue driving the returning Egg's size or progress label.
    today: isImmediatelyPreviousDay(claimed.isoDate, state.today.isoDate)
      ? beginFreshEggCycle(state.today, now)
      : state.today,
  };
}

function isImmediatelyPreviousDay(candidateIsoDate: string, currentIsoDate: string): boolean {
  const [year, month, day] = currentIsoDate.split('-').map(Number);
  const previous = new Date(year, Math.max(0, month - 1), day - 1, 12, 0, 0, 0);
  const yyyy = previous.getFullYear();
  const mm = String(previous.getMonth() + 1).padStart(2, '0');
  const dd = String(previous.getDate()).padStart(2, '0');
  return candidateIsoDate === `${yyyy}-${mm}-${dd}`;
}
