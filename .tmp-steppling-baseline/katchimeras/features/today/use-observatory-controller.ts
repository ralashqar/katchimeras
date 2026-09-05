import { useCallback, useMemo, useState } from 'react';

import { useTravelMemoryMode } from '@/hooks/use-travel-memory-mode';
import type { HomeDayRecord } from '@/types/home';
import { deriveContinuityMotifs } from '@/utils/continuity-engine';
import { deriveObservations } from '@/utils/observations-engine';
import { travelMemoryBody, travelMemoryStatusLabel } from '@/utils/travel-memory-mode';

type UseObservatoryControllerParams = {
  allDays: HomeDayRecord[];
  formingDay: HomeDayRecord | null;
  refreshState: () => void;
  setMicrocopy: (message: string | null) => void;
};

export function useObservatoryController({
  allDays,
  formingDay,
  refreshState,
  setMicrocopy,
}: UseObservatoryControllerParams) {
  const [observatoryOpen, setObservatoryOpen] = useState(false);
  const {
    state: travelMemoryState,
    isActive: travelMemoryActive,
    enable: enableTravelMemory,
    pauseToday: pauseTravelMemoryToday,
    disable: disableTravelMemory,
    deleteTodayPlaces: deleteTodayTravelMemoryPlaces,
  } = useTravelMemoryMode();

  const backgroundPlaceCount = useMemo(
    () => formingDay?.locations.filter((point) => point.source === 'background').length ?? 0,
    [formingDay?.locations]
  );

  const observations = useMemo(
    () =>
      observatoryOpen
        ? deriveObservations({ days: allDays, selectedDay: formingDay ?? null, motifs: deriveContinuityMotifs(allDays, 6) })
        : [],
    [allDays, formingDay, observatoryOpen]
  );

  const handleEnableTravelMemory = useCallback(async () => {
    setMicrocopy('Asking for Travel Memory permission...');
    const next = await enableTravelMemory();
    if (next.status === 'enabled') setMicrocopy('Travel Memory Mode is on');
    else if (next.status === 'denied') setMicrocopy('Background location permission is needed');
    else if (next.status === 'unavailable') setMicrocopy('Travel Memory is not available here');
  }, [enableTravelMemory, setMicrocopy]);

  const handlePauseTravelMemoryToday = useCallback(async () => {
    await pauseTravelMemoryToday();
    setMicrocopy('Travel Memory paused for today');
  }, [pauseTravelMemoryToday, setMicrocopy]);

  const handleDisableTravelMemory = useCallback(async () => {
    await disableTravelMemory();
    setMicrocopy('Travel Memory turned off');
  }, [disableTravelMemory, setMicrocopy]);

  const handleDeleteTodayTravelMemoryPlaces = useCallback(() => {
    deleteTodayTravelMemoryPlaces();
    refreshState();
    setMicrocopy("Today's background places deleted");
  }, [deleteTodayTravelMemoryPlaces, refreshState, setMicrocopy]);

  const travelMemory = useMemo(
    () => ({
      statusLabel: travelMemoryStatusLabel(travelMemoryState),
      body: travelMemoryBody(travelMemoryState),
      enabled: travelMemoryActive,
      backgroundPlaceCount,
      onEnable: handleEnableTravelMemory,
      onPauseToday: travelMemoryActive ? handlePauseTravelMemoryToday : undefined,
      onDisable: travelMemoryActive ? handleDisableTravelMemory : undefined,
      onDeleteTodayPlaces: backgroundPlaceCount > 0 ? handleDeleteTodayTravelMemoryPlaces : undefined,
    }),
    [
      backgroundPlaceCount,
      handleDeleteTodayTravelMemoryPlaces,
      handleDisableTravelMemory,
      handleEnableTravelMemory,
      handlePauseTravelMemoryToday,
      travelMemoryActive,
      travelMemoryState,
    ]
  );

  return {
    observatoryOpen,
    setObservatoryOpen,
    observations,
    travelMemory,
  };
}
