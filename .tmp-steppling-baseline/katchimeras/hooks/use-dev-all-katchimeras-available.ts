import { useSyncExternalStore } from 'react';

import {
  isAllKatchimerasAvailableEnabled,
  subscribeAllKatchimerasAvailable,
} from '@/utils/dev-settings';

export function useDevAllKatchimerasAvailable(): boolean {
  return useSyncExternalStore(
    subscribeAllKatchimerasAvailable,
    isAllKatchimerasAvailableEnabled,
    () => false,
  );
}
