import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import {
  deleteTodayTravelMemoryPlaces,
  disableTravelMemoryMode,
  enableTravelMemoryMode,
  isTravelMemoryModeActive,
  loadTravelMemoryModeState,
  pauseTravelMemoryModeForToday,
  subscribeTravelMemoryModeChanges,
  syncTravelMemoryLocationTask,
} from '@/utils/travel-memory-mode';

export function useTravelMemoryMode() {
  const [state, setState] = useState(() => loadTravelMemoryModeState());

  const refresh = useCallback(() => setState(loadTravelMemoryModeState()), []);

  useEffect(() => subscribeTravelMemoryModeChanges(refresh), [refresh]);

  useEffect(() => {
    void syncTravelMemoryLocationTask(state);
  }, [state.status, state.pausedIsoDate]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refresh();
        void syncTravelMemoryLocationTask();
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  const enable = useCallback(async () => {
    const next = await enableTravelMemoryMode();
    setState(next);
    return next;
  }, []);

  const pauseToday = useCallback(async () => {
    const next = await pauseTravelMemoryModeForToday();
    setState(next);
    return next;
  }, []);

  const disable = useCallback(async () => {
    const next = await disableTravelMemoryMode();
    setState(next);
    return next;
  }, []);

  const deleteTodayPlaces = useCallback(() => {
    deleteTodayTravelMemoryPlaces();
  }, []);

  return useMemo(
    () => ({
      state,
      isActive: isTravelMemoryModeActive(state),
      enable,
      pauseToday,
      disable,
      deleteTodayPlaces,
      refresh,
    }),
    [deleteTodayPlaces, disable, enable, pauseToday, refresh, state]
  );
}
