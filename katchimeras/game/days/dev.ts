import type { StoredHomeState } from '@/types/home';

export type DevRehatchMode = 'adaptive' | 'force_low_signal';

export function prepareTodayForDevRehatch(state: StoredHomeState, mode: DevRehatchMode): StoredHomeState {
  return {
    ...state,
    today: {
      ...state.today,
      state: 'ready_to_hatch',
      creature: null,
      card: null,
      shareReadyAt: null,
      hatchCheckIn: undefined,
      devForceReadyToHatch: true,
      devHatchReflectionMode: mode === 'force_low_signal' ? 'force_low_signal' : undefined,
    },
  };
}
