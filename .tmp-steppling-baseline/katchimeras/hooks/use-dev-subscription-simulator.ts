import { useSyncExternalStore } from 'react';

import { getDevSubscriptionSimulatorState, subscribeDevSubscriptionSimulator } from '@/utils/dev-subscription-simulator';

export function useDevSubscriptionSimulator() {
  return useSyncExternalStore(
    subscribeDevSubscriptionSimulator,
    getDevSubscriptionSimulatorState,
    getDevSubscriptionSimulatorState,
  );
}
