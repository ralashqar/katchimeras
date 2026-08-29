import { useMemo, useSyncExternalStore } from 'react';

import {
  getHavenOrderFillerSlotSeeds,
  isHavenOrderFillersEnabled,
  subscribeHavenOrderFillers,
} from '@/utils/dev-settings';

export function useDevHavenOrderFillers(): boolean {
  return useSyncExternalStore(
    subscribeHavenOrderFillers,
    isHavenOrderFillersEnabled,
    () => false,
  );
}

export function useDevHavenOrderFillerSlotSeeds(): readonly [number, number, number] {
  const first = useSyncExternalStore(subscribeHavenOrderFillers, () => getHavenOrderFillerSlotSeeds()[0], () => 1);
  const second = useSyncExternalStore(subscribeHavenOrderFillers, () => getHavenOrderFillerSlotSeeds()[1], () => 2);
  const third = useSyncExternalStore(subscribeHavenOrderFillers, () => getHavenOrderFillerSlotSeeds()[2], () => 3);
  return useMemo(() => [first, second, third] as const, [first, second, third]);
}
