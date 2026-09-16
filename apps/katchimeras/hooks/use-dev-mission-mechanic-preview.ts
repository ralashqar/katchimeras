import { useSyncExternalStore } from 'react';

import type { MissionMechanicPreview } from '@/features/mission-mechanics/preview';
import { getDevMissionMechanicPreview, subscribeDevMissionMechanicPreview } from '@/utils/dev-settings';

/** The mechanic Developer Tools lays over every docked mission board, or none. */
export function useDevMissionMechanicPreview(): MissionMechanicPreview {
  return useSyncExternalStore(subscribeDevMissionMechanicPreview, getDevMissionMechanicPreview, () => null);
}
