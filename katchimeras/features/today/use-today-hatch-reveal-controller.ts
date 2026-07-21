import { useCallback, useEffect, useRef, useState } from 'react';

import { markArrivalPending } from '@/utils/kingdom-arrival';
import type { EggVisualState, HomeTimelineDay } from '@/types/home';

type UseTodayHatchRevealControllerParams = {
  selectedDay: HomeTimelineDay | null;
  triggerHatchIfReady: () => Promise<void>;
  refreshState: () => void;
};

const HATCH_REVEAL_WATCHDOG_MS = 10_500;

export function useTodayHatchRevealController({
  selectedDay,
  triggerHatchIfReady,
  refreshState,
}: UseTodayHatchRevealControllerParams) {
  const [isHatching, setIsHatching] = useState(false);
  const [hatchingEgg, setHatchingEgg] = useState<EggVisualState | null>(null);
  const [hatchingDayId, setHatchingDayId] = useState<string | null>(null);
  const hatchingActiveRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHatchComplete = useCallback(() => {
    if (!hatchingActiveRef.current) return;
    hatchingActiveRef.current = false;
    if (watchdogRef.current !== null) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    setIsHatching(false);
    setHatchingEgg(null);
    setHatchingDayId(null);
    refreshState();
    markArrivalPending();
  }, [refreshState]);

  useEffect(() => () => {
    if (watchdogRef.current !== null) clearTimeout(watchdogRef.current);
  }, []);

  const handleReveal = useCallback(async () => {
    if (isHatching || selectedDay?.kind !== 'day' || !selectedDay.canHatch) {
      return;
    }

    setHatchingEgg(selectedDay.egg);
    setHatchingDayId(selectedDay.id);
    hatchingActiveRef.current = true;
    setIsHatching(true);
    watchdogRef.current = setTimeout(handleHatchComplete, HATCH_REVEAL_WATCHDOG_MS);
    try {
      await triggerHatchIfReady();
    } catch (error) {
      console.warn('Hatch reveal failed to finalize', error);
    }
  }, [handleHatchComplete, isHatching, selectedDay, triggerHatchIfReady]);

  return {
    isHatching,
    hatchingEgg,
    hatchingDayId,
    handleReveal,
    handleHatchComplete,
  };
}
