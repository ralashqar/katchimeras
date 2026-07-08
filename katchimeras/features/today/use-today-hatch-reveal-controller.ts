import { useCallback, useState } from 'react';

import { markArrivalPending } from '@/utils/kingdom-arrival';
import type { EggVisualState, HomeTimelineDay } from '@/types/home';

type UseTodayHatchRevealControllerParams = {
  selectedDay: HomeTimelineDay | null;
  triggerHatchIfReady: () => Promise<void>;
  refreshState: () => void;
};

export function useTodayHatchRevealController({
  selectedDay,
  triggerHatchIfReady,
  refreshState,
}: UseTodayHatchRevealControllerParams) {
  const [isHatching, setIsHatching] = useState(false);
  const [hatchingEgg, setHatchingEgg] = useState<EggVisualState | null>(null);

  const handleReveal = useCallback(async () => {
    if (selectedDay?.kind !== 'day' || !selectedDay.canHatch) {
      return;
    }

    setHatchingEgg(selectedDay.egg);
    setIsHatching(true);
    try {
      await triggerHatchIfReady();
    } catch (error) {
      console.warn('Hatch reveal failed to finalize', error);
    }
  }, [selectedDay, triggerHatchIfReady]);

  const handleHatchComplete = useCallback(() => {
    setIsHatching(false);
    setHatchingEgg(null);
    refreshState();
    markArrivalPending();
  }, [refreshState]);

  return {
    isHatching,
    hatchingEgg,
    handleReveal,
    handleHatchComplete,
  };
}
