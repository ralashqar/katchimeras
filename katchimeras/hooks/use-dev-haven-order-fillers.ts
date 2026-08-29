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

export function useDevHavenOrderFillerSlotSeeds(boardId = 'mossprout'): readonly [number, number, number] {
  const first = useSyncExternalStore(subscribeHavenOrderFillers, () => getHavenOrderFillerSlotSeeds(boardId)[0], () => 1);
  const second = useSyncExternalStore(subscribeHavenOrderFillers, () => getHavenOrderFillerSlotSeeds(boardId)[1], () => 2);
  const third = useSyncExternalStore(subscribeHavenOrderFillers, () => getHavenOrderFillerSlotSeeds(boardId)[2], () => 3);
  return useMemo(() => [first, second, third] as const, [first, second, third]);
}
