import type { HomeDayRecord, StoredHomeDayRecord, StoredHomeState } from '@/types/home';

export function preserveVisibleHatchForMap(state: StoredHomeState, visibleDay: HomeDayRecord): StoredHomeState {
  if (!visibleDay.creature) return state;
  const target = state.today.id === visibleDay.id
    ? state.today
    : state.tomorrow?.id === visibleDay.id
      ? state.tomorrow
      : state.archivedDays.find((item) => item.id === visibleDay.id) ?? null;
  if (!target || target.creature || target.devForceReadyToHatch) return state;
  const repaired: StoredHomeDayRecord = {
    ...target,
    state: 'hatched',
    creature: visibleDay.creature,
    shareReadyAt: visibleDay.shareReadyAt,
    hatchCheckIn: visibleDay.hatchCheckIn,
    devForceReadyToHatch: undefined,
    devHatchReflectionMode: undefined,
  };
  if (state.today.id === visibleDay.id) return { ...state, today: repaired };
  if (state.tomorrow?.id === visibleDay.id) return { ...state, tomorrow: repaired };
  return { ...state, archivedDays: state.archivedDays.map((item) => item.id === visibleDay.id ? repaired : item) };
}
