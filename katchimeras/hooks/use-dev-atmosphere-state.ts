import { useSyncExternalStore } from 'react';

import {
  getDevAtmosphereState,
  subscribeDevAtmosphere,
  type DevAtmosphereState,
} from '@/utils/dev-atmosphere-settings';

export function useDevAtmosphereState(): DevAtmosphereState {
  return useSyncExternalStore(
    subscribeDevAtmosphere,
    getDevAtmosphereState,
    getDevAtmosphereState,
  );
}
