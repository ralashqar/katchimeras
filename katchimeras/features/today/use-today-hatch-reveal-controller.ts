import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useReducer, useRef, type RefObject } from 'react';
import { AppState } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import type { HomeDayRecord, HomeTimelineDay, LocalCreatureRecord } from '@/types/home';
import type { HatchCommitResult } from '@/features/today/use-hatch-controller';
import {
  IDLE_TODAY_HATCH_PRESENTATION,
  todayHatchPresentationReducer,
} from '@/utils/today-hatch-presentation';

type UseTodayHatchRevealControllerParams = {
  selectedDay: HomeTimelineDay | null;
  triggerHatchIfReady: () => Promise<HatchCommitResult>;
  acceleratedReadyRef?: RefObject<boolean>;
  allowDailyHatch?: boolean;
  onDiscoveryAnimationComplete?: () => void;
};

const HATCH_REVEAL_WATCHDOG_MS = 12_000;
const DISCOVERY_ASSET_WATCHDOG_MS = 8_000;
const PHASE_DELAYS_MS = {
  shaking: 80,
  cracking: 500,
  crossfadingSubject: 1_050,
  subjectSettling: 1_550,
  postReveal: 1_750,
  complete: 2_450,
} as const;
const REDUCED_PHASE_DELAYS_MS = {
  shaking: 20,
  cracking: 70,
  crossfadingSubject: 150,
  subjectSettling: 360,
  postReveal: 500,
  complete: 760,
} as const;

export function useTodayHatchRevealController({
  selectedDay,
  triggerHatchIfReady,
  acceleratedReadyRef,
  allowDailyHatch = true,
  onDiscoveryAnimationComplete,
}: UseTodayHatchRevealControllerParams) {
  const reduceMotion = useReducedMotion();
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
  const assetsReadyRef = useRef({ environment: false, subject: false });
  const discoveryMinimumReadyRef = useRef(false);
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
    assetsReadyRef.current = { environment: false, subject: false };
    discoveryMinimumReadyRef.current = false;
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

  const failDiscoveryReveal = useCallback((reason: string) => {
    if (!hatchingActiveRef.current || presentationPolicyRef.current !== 'ftue_discovery') return;
    hatchingActiveRef.current = false;
    committedRunIdRef.current = 0;
    presentationScheduledRef.current = false;
    assetsReadyRef.current = { environment: false, subject: false };
    discoveryMinimumReadyRef.current = false;
    clearTimers();
    dispatch({ type: 'failed', reason });
  }, [clearTimers]);

  const scheduleDiscoveryReveal = useCallback((runId: number) => {
    if (
      presentationScheduledRef.current
      || committedRunIdRef.current !== runId
      || !assetsReadyRef.current.subject
      || !discoveryMinimumReadyRef.current
    ) return;
    presentationScheduledRef.current = true;
    const phaseDelays = reduceMotion ? REDUCED_PHASE_DELAYS_MS : PHASE_DELAYS_MS;
    const schedule = (delay: number, callback: () => void) => {
      phaseTimersRef.current.push(setTimeout(() => {
        if (runIdRef.current === runId && hatchingActiveRef.current) callback();
      }, delay));
    };
    schedule(0, () => {
      dispatch({ type: 'advance', phase: 'crossfading_subject' });
      if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    });
    schedule(phaseDelays.subjectSettling - phaseDelays.crossfadingSubject, () => {
      dispatch({ type: 'advance', phase: 'subject_settling' });
      if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
    schedule(phaseDelays.postReveal - phaseDelays.crossfadingSubject, () => {
      dispatch({ type: 'advance', phase: 'awaiting_interaction' });
      hatchingActiveRef.current = false;
      clearTimers();
      onDiscoveryAnimationComplete?.();
    });
  }, [clearTimers, onDiscoveryAnimationComplete, reduceMotion]);

  const schedulePresentation = useCallback((runId: number) => {
    if (presentationScheduledRef.current || committedRunIdRef.current !== runId) return;
    presentationScheduledRef.current = true;
    const schedule = (delay: number, callback: () => void) => {
      phaseTimersRef.current.push(setTimeout(() => {
        if (runIdRef.current === runId && hatchingActiveRef.current) callback();
      }, delay));
    };
    const phaseDelays = reduceMotion ? REDUCED_PHASE_DELAYS_MS : PHASE_DELAYS_MS;
    schedule(phaseDelays.shaking, () => dispatch({ type: 'advance', phase: 'shaking' }));
    schedule(phaseDelays.cracking, () => dispatch({ type: 'advance', phase: 'cracking' }));
    schedule(phaseDelays.crossfadingSubject, () => {
      dispatch({ type: 'advance', phase: 'crossfading_subject' });
      if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    });
    schedule(phaseDelays.subjectSettling, () => {
      dispatch({ type: 'advance', phase: 'subject_settling' });
      if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
    schedule(phaseDelays.postReveal, () => dispatch({ type: 'advance', phase: 'world_shift' }));
    schedule(phaseDelays.complete - 250, () => dispatch({ type: 'advance', phase: 'dashboard_settling' }));
    schedule(phaseDelays.complete, handleHatchComplete);
  }, [handleHatchComplete, reduceMotion]);

  const markHatchAssetReady = useCallback((kind: 'environment' | 'subject') => {
    const runId = committedRunIdRef.current;
    assetsReadyRef.current[kind] = true;
    if (presentationPolicyRef.current === 'ftue_discovery') {
      scheduleDiscoveryReveal(runId);
      return;
    }
    if (runId > 0 && assetsReadyRef.current.subject) {
      schedulePresentation(runId);
    }
  }, [scheduleDiscoveryReveal, schedulePresentation]);
  const handleHatchEnvironmentReady = useCallback(
    () => markHatchAssetReady('environment'),
    [markHatchAssetReady],
  );
  const handleHatchSubjectReady = useCallback(
    () => markHatchAssetReady('subject'),
    [markHatchAssetReady],
  );
  const handleHatchSubjectError = useCallback(
    () => failDiscoveryReveal('Mossprout could not appear. Tap Hatch to try again.'),
    [failDiscoveryReveal],
  );

  const handleReveal = useCallback(async () => {
    if (
      !allowDailyHatch
      ||
      hatchingActiveRef.current
      || selectedDay?.kind !== 'day'
      || (!selectedDay.canHatch && !acceleratedReadyRef?.current)
    ) {
      return;
    }

    const daySnapshot = selectedDay as HomeDayRecord;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    committedRunIdRef.current = 0;
    presentationScheduledRef.current = false;
    assetsReadyRef.current = { environment: false, subject: false };
    hatchingActiveRef.current = true;
    presentationPolicyRef.current = 'daily';
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
  }, [acceleratedReadyRef, allowDailyHatch, clearTimers, handleHatchComplete, schedulePresentation, selectedDay, triggerHatchIfReady]);

  const presentationPolicyRef = useRef<'daily' | 'ftue_discovery'>('daily');

  const handleDiscoveryReveal = useCallback((creature: LocalCreatureRecord) => {
    if (hatchingActiveRef.current || selectedDay?.kind !== 'day') return;
    const daySnapshot = selectedDay as HomeDayRecord;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    committedRunIdRef.current = runId;
    presentationScheduledRef.current = false;
    discoveryMinimumReadyRef.current = false;
    assetsReadyRef.current = { environment: true, subject: false };
    presentationPolicyRef.current = 'ftue_discovery';
    hatchingActiveRef.current = true;
    dispatch({ type: 'begin_discovery', day: daySnapshot, creature });
    const phaseDelays = reduceMotion ? REDUCED_PHASE_DELAYS_MS : PHASE_DELAYS_MS;
    phaseTimersRef.current.push(setTimeout(() => {
      if (runIdRef.current === runId && hatchingActiveRef.current) dispatch({ type: 'advance', phase: 'shaking' });
    }, phaseDelays.shaking));
    phaseTimersRef.current.push(setTimeout(() => {
      if (runIdRef.current === runId && hatchingActiveRef.current) dispatch({ type: 'advance', phase: 'cracking' });
    }, phaseDelays.cracking));
    phaseTimersRef.current.push(setTimeout(() => {
      if (runIdRef.current !== runId || !hatchingActiveRef.current) return;
      discoveryMinimumReadyRef.current = true;
      scheduleDiscoveryReveal(runId);
    }, phaseDelays.crossfadingSubject));
    watchdogRef.current = setTimeout(() => {
      if (runIdRef.current === runId) failDiscoveryReveal('Mossprout could not appear. Tap Hatch to try again.');
    }, DISCOVERY_ASSET_WATCHDOG_MS);
  }, [failDiscoveryReveal, reduceMotion, scheduleDiscoveryReveal, selectedDay]);

  const restoreDiscoveryReveal = useCallback((creature: LocalCreatureRecord) => {
    if (selectedDay?.kind !== 'day') return;
    presentationPolicyRef.current = 'ftue_discovery';
    hatchingActiveRef.current = false;
    clearTimers();
    dispatch({ type: 'restore_discovery', day: selectedDay as HomeDayRecord, creature });
  }, [clearTimers, selectedDay]);

  return {
    isHatching: presentation.phase !== 'idle',
    presentation,
    handleHatchEnvironmentReady,
    handleHatchSubjectReady,
    handleHatchSubjectError,
    handleReveal,
    handleDiscoveryReveal,
    restoreDiscoveryReveal,
    handleHatchComplete,
  };
}
