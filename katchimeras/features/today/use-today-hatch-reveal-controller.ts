import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { AppState } from 'react-native';

import type { HomeDayRecord, HomeTimelineDay } from '@/types/home';
import type { HatchCommitResult } from '@/features/today/use-hatch-controller';
import {
  IDLE_TODAY_HATCH_PRESENTATION,
  todayHatchPresentationReducer,
} from '@/utils/today-hatch-presentation';

type UseTodayHatchRevealControllerParams = {
  selectedDay: HomeTimelineDay | null;
  triggerHatchIfReady: () => Promise<HatchCommitResult>;
};

const HATCH_REVEAL_WATCHDOG_MS = 12_000;
const PHASE_DELAYS_MS = {
  revealing: 300,
  worldShift: 560,
  settling: 1_080,
  tomorrowArrival: 1_340,
  complete: 1_680,
} as const;

export function useTodayHatchRevealController({
  selectedDay,
  triggerHatchIfReady,
}: UseTodayHatchRevealControllerParams) {
  const [presentation, dispatch] = useReducer(
    todayHatchPresentationReducer,
    IDLE_TODAY_HATCH_PRESENTATION,
  );
  const hatchingActiveRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const runIdRef = useRef(0);
  const committedRunIdRef = useRef(0);
  const presentationScheduledRef = useRef(false);
  const appIsActiveRef = useRef(AppState.currentState === 'active');

  const clearTimers = useCallback(() => {
    if (watchdogRef.current !== null) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    phaseTimersRef.current.forEach(clearTimeout);
    phaseTimersRef.current = [];
  }, []);

  const handleHatchComplete = useCallback(() => {
    if (!hatchingActiveRef.current) return;
    hatchingActiveRef.current = false;
    committedRunIdRef.current = 0;
    presentationScheduledRef.current = false;
    clearTimers();
    dispatch({ type: 'reset' });
  }, [clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      appIsActiveRef.current = state === 'active';
      if (state !== 'active' && committedRunIdRef.current > 0) handleHatchComplete();
    });
    return () => subscription.remove();
  }, [handleHatchComplete]);

  const schedulePresentation = useCallback((runId: number) => {
    if (presentationScheduledRef.current || committedRunIdRef.current !== runId) return;
    presentationScheduledRef.current = true;
    const schedule = (delay: number, callback: () => void) => {
      phaseTimersRef.current.push(setTimeout(() => {
        if (runIdRef.current === runId && hatchingActiveRef.current) callback();
      }, delay));
    };
    schedule(PHASE_DELAYS_MS.revealing, () => {
      dispatch({ type: 'advance', phase: 'revealing' });
      if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    });
    schedule(PHASE_DELAYS_MS.worldShift, () => dispatch({ type: 'advance', phase: 'world_shift' }));
    schedule(PHASE_DELAYS_MS.settling, () => {
      dispatch({ type: 'advance', phase: 'settling' });
      if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
    schedule(PHASE_DELAYS_MS.tomorrowArrival, () => dispatch({ type: 'advance', phase: 'tomorrow_arrival' }));
    schedule(PHASE_DELAYS_MS.complete, handleHatchComplete);
  }, [handleHatchComplete]);

  const handleHatchAssetsReady = useCallback(() => {
    const runId = committedRunIdRef.current;
    if (runId > 0) schedulePresentation(runId);
  }, [schedulePresentation]);

  const handleReveal = useCallback(async () => {
    if (hatchingActiveRef.current || selectedDay?.kind !== 'day' || !selectedDay.canHatch) {
      return;
    }

    const daySnapshot = selectedDay as HomeDayRecord;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    committedRunIdRef.current = 0;
    presentationScheduledRef.current = false;
    hatchingActiveRef.current = true;
    dispatch({ type: 'begin', day: daySnapshot });
    watchdogRef.current = setTimeout(() => {
      if (runIdRef.current !== runId) return;
      hatchingActiveRef.current = false;
      committedRunIdRef.current = 0;
      presentationScheduledRef.current = false;
      dispatch({ type: 'failed', reason: 'The hatch took too long. Please try again.' });
    }, HATCH_REVEAL_WATCHDOG_MS);

    const result = await triggerHatchIfReady();
    if (runIdRef.current !== runId || !hatchingActiveRef.current) return;
    if (result.status !== 'hatched') {
      hatchingActiveRef.current = false;
      committedRunIdRef.current = 0;
      clearTimers();
      dispatch({
        type: 'failed',
        reason: result.status === 'failed' ? result.reason : 'This egg is not ready to hatch yet.',
      });
      return;
    }
    if (watchdogRef.current !== null) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    dispatch({ type: 'committed', day: result.day });
    committedRunIdRef.current = runId;
    if (!appIsActiveRef.current) {
      handleHatchComplete();
      return;
    }
    // Bundled art normally decodes while the crack stage is appearing. The
    // fallback prevents a malformed asset from holding interaction forever.
    phaseTimersRef.current.push(setTimeout(() => schedulePresentation(runId), 1_200));
  }, [clearTimers, handleHatchComplete, schedulePresentation, selectedDay, triggerHatchIfReady]);

  return {
    isHatching: presentation.phase !== 'idle',
    presentation,
    handleHatchAssetsReady,
    handleReveal,
    handleHatchComplete,
  };
}
