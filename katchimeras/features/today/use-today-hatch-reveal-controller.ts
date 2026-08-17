import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useReducer, useRef, type RefObject } from 'react';
import { AppState } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import type { HomeDayRecord, HomeTimelineDay, LocalCreatureRecord } from '@/types/home';
import type { HatchClaimResult, HatchCommitResult } from '@/features/today/use-hatch-controller';
import {
  IDLE_TODAY_HATCH_PRESENTATION,
  todayHatchPresentationReducer,
} from '@/utils/today-hatch-presentation';

type UseTodayHatchRevealControllerParams = {
  selectedDay: HomeTimelineDay | null;
  triggerHatchIfReady: () => Promise<HatchCommitResult>;
  claimHatch?: () => Promise<HatchClaimResult>;
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
  formCard: 2_050,
  assembleDeck: 2_650,
  awaitClaim: 3_300,
} as const;
const REDUCED_PHASE_DELAYS_MS = {
  shaking: 20,
  cracking: 70,
  crossfadingSubject: 150,
  subjectSettling: 360,
  postReveal: 500,
  formCard: 580,
  assembleDeck: 680,
  awaitClaim: 760,
} as const;

export function useTodayHatchRevealController({
  selectedDay,
  triggerHatchIfReady,
  claimHatch,
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
  const presentationPolicyRef = useRef<'daily' | 'ftue_discovery'>('daily');
  const restoreSuppressedDayIdRef = useRef<string | null>(null);
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

  const failHatchReveal = useCallback((reason: string, suppressAutomaticRestore = false) => {
    if (!hatchingActiveRef.current) return;
    if (suppressAutomaticRestore && presentationPolicyRef.current === 'daily') {
      restoreSuppressedDayIdRef.current = selectedDay?.id ?? null;
    }
    hatchingActiveRef.current = false;
    committedRunIdRef.current = 0;
    presentationScheduledRef.current = false;
    assetsReadyRef.current = { environment: false, subject: false };
    discoveryMinimumReadyRef.current = false;
    clearTimers();
    dispatch({ type: 'failed', reason });
  }, [clearTimers, selectedDay?.id]);

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
    if (
      presentationScheduledRef.current
      || committedRunIdRef.current !== runId
      || !assetsReadyRef.current.subject
    ) return;
    presentationScheduledRef.current = true;
    if (watchdogRef.current !== null) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
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
    schedule(phaseDelays.formCard, () => dispatch({ type: 'advance', phase: 'forming_card' }));
    schedule(phaseDelays.assembleDeck, () => dispatch({ type: 'advance', phase: 'assembling_deck' }));
    schedule(phaseDelays.awaitClaim, () => {
      dispatch({ type: 'advance', phase: 'awaiting_claim' });
      hatchingActiveRef.current = false;
      clearTimers();
    });
  }, [clearTimers, reduceMotion]);

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
    () => failHatchReveal(
      presentationPolicyRef.current === 'daily'
        ? 'Today’s Wisp could not appear. Tap Reveal to try again.'
        : 'Mossprout could not appear. Tap Hatch to try again.',
      presentationPolicyRef.current === 'daily',
    ),
    [failHatchReveal],
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
    restoreSuppressedDayIdRef.current = null;
    hatchingActiveRef.current = true;
    presentationPolicyRef.current = 'daily';
    dispatch({ type: 'begin', animationKey: runId, day: daySnapshot });
    watchdogRef.current = setTimeout(() => {
      if (runIdRef.current !== runId) return;
      failHatchReveal('The hatch took too long. Tap Reveal to try again.', committedRunIdRef.current === runId);
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
    dispatch({ type: 'committed', day: result.day });
    committedRunIdRef.current = runId;
    if (!appIsActiveRef.current) {
      handleHatchComplete();
      return;
    }
  }, [acceleratedReadyRef, allowDailyHatch, clearTimers, failHatchReveal, handleHatchComplete, selectedDay, triggerHatchIfReady]);

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
    dispatch({ type: 'begin_discovery', animationKey: runId, day: daySnapshot, creature });
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
      if (runIdRef.current === runId) failHatchReveal('Mossprout could not appear. Tap Hatch to try again.');
    }, DISCOVERY_ASSET_WATCHDOG_MS);
  }, [failHatchReveal, reduceMotion, scheduleDiscoveryReveal, selectedDay]);

  const restoreDiscoveryReveal = useCallback((creature: LocalCreatureRecord) => {
    if (selectedDay?.kind !== 'day') return;
    presentationPolicyRef.current = 'ftue_discovery';
    const animationKey = runIdRef.current + 1;
    runIdRef.current = animationKey;
    hatchingActiveRef.current = false;
    clearTimers();
    dispatch({ type: 'restore_discovery', animationKey, day: selectedDay as HomeDayRecord, creature });
  }, [clearTimers, selectedDay]);

  useEffect(() => {
    if (
      presentation.phase === 'idle'
      && selectedDay?.kind === 'day'
      && selectedDay.dailyHatch?.revealedAt
      && !selectedDay.dailyHatch.claimedAt
      && restoreSuppressedDayIdRef.current !== selectedDay.id
    ) {
      const animationKey = runIdRef.current + 1;
      runIdRef.current = animationKey;
      dispatch({ type: 'restore_daily', animationKey, day: selectedDay });
    }
  }, [presentation.phase, selectedDay]);

  const handleClaim = useCallback(async () => {
    if (presentation.phase !== 'awaiting_claim' || !claimHatch) return;
    hatchingActiveRef.current = true;
    dispatch({ type: 'advance', phase: 'claiming' });
    const result = await claimHatch();
    if (result.status !== 'claimed') {
      dispatch({ type: 'failed', reason: result.status === 'failed' ? result.reason : 'This card is not ready to claim.' });
      return;
    }
    dispatch({ type: 'advance', phase: 'new_day_intro' });
    const restoreDelay = reduceMotion ? 900 : 3_000;
    phaseTimersRef.current.push(setTimeout(() => dispatch({ type: 'advance', phase: 'restoring_today' }), restoreDelay));
    phaseTimersRef.current.push(setTimeout(handleHatchComplete, restoreDelay + (reduceMotion ? 180 : 380)));
  }, [claimHatch, handleHatchComplete, presentation.phase, reduceMotion]);

  return {
    isHatching: presentation.phase !== 'idle',
    presentation,
    handleHatchEnvironmentReady,
    handleHatchSubjectReady,
    handleHatchSubjectError,
    handleReveal,
    handleClaim,
    handleDiscoveryReveal,
    restoreDiscoveryReveal,
    handleHatchComplete,
  };
}
