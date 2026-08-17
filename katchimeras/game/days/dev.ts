import type { StoredHomeState } from '@/types/home';

export type DevDailyHatchReplay = {
  dayId: string;
  state: StoredHomeState;
};

/** Re-seals the newest collectible day so the complete reveal/claim ritual can be replayed. */
export function prepareLatestDailyHatchForDevReplay(state: StoredHomeState): DevDailyHatchReplay | null {
  const candidates = [state.today, ...(state.tomorrow ? [state.tomorrow] : []), ...state.archivedDays]
    .filter((day) => Boolean(day.dailyHatch && day.card))
    .sort((left, right) => right.isoDate.localeCompare(left.isoDate));
  const target = candidates[0];
  if (!target?.dailyHatch) return null;

  const reseal = (day: typeof target) => day.id !== target.id ? day : {
    ...day,
    state: 'sealed' as const,
    dailyHatch: {
      ...day.dailyHatch!,
      revealedAt: null,
      claimedAt: null,
    },
    devForceReadyToHatch: undefined,
    devHatchReflectionMode: undefined,
  };

  return {
    dayId: target.id,
    state: {
      ...state,
      today: reseal(state.today),
      tomorrow: state.tomorrow ? reseal(state.tomorrow) : undefined,
      archivedDays: state.archivedDays.map(reseal),
    },
  };
}
