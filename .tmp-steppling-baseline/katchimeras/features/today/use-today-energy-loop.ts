import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { TodayCareCompletionEvent } from '@/components/katchadeck/home/today-nurture-experience';
import type { RankedTodayCareAction } from '@/utils/today-care';
import {
  markTodayEnergyPhase,
  startTodayEnergyTrace,
} from '@/utils/today-energy-loop-performance';

export type TodayEnergyLoopStatus =
  | 'idle'
  | 'launching'
  | 'awaiting_completion'
  | 'rewarding'
  | 'entering';

const ACTION_INTRO_SETTLE_MS = 340;
const REWARD_LOCK_TIMEOUT_MS = 5_000;

export function useTodayEnergyLoop() {
  const [pendingIntent, setPendingIntentState] = useState<RankedTodayCareAction | null>(null);
  const [completionEvent, setCompletionEvent] = useState<TodayCareCompletionEvent | null>(null);
  const [status, setStatus] = useState<TodayEnergyLoopStatus>('idle');
  const sequenceRef = useRef(0);
  const rewardRequestKeyAtStartRef = useRef(0);
  const flowWasBusyRef = useRef(false);
  const traceIdRef = useRef<string | null>(null);
  const handoffFrameRef = useRef<number | null>(null);
  const introTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (handoffFrameRef.current != null) cancelAnimationFrame(handoffFrameRef.current);
    if (introTimerRef.current) clearTimeout(introTimerRef.current);
    if (rewardLockTimerRef.current) clearTimeout(rewardLockTimerRef.current);
    if (traceIdRef.current) markTodayEnergyPhase(traceIdRef.current, 'cancelled', { reason: 'unmount' });
  }, []);

  const startIntent = useCallback((action: RankedTodayCareAction, rewardRequestKey: number) => {
    if (handoffFrameRef.current != null) cancelAnimationFrame(handoffFrameRef.current);
    if (introTimerRef.current) clearTimeout(introTimerRef.current);
    if (rewardLockTimerRef.current) clearTimeout(rewardLockTimerRef.current);
    handoffFrameRef.current = null;
    introTimerRef.current = null;
    rewardLockTimerRef.current = null;
    if (traceIdRef.current) markTodayEnergyPhase(traceIdRef.current, 'cancelled', { reason: 'replaced' });
    traceIdRef.current = startTodayEnergyTrace(action.id);
    rewardRequestKeyAtStartRef.current = rewardRequestKey;
    flowWasBusyRef.current = false;
    setPendingIntentState(action);
    setStatus('launching');
  }, []);

  const markDestinationOpen = useCallback(() => {
    if (traceIdRef.current) markTodayEnergyPhase(traceIdRef.current, 'destination_open');
    setStatus('awaiting_completion');
  }, []);

  const setPendingIntent = useCallback((action: RankedTodayCareAction | null) => {
    if (action) {
      startIntent(action, rewardRequestKeyAtStartRef.current);
      return;
    }
    setPendingIntentState(null);
    setStatus('idle');
  }, [startIntent]);

  const clearIntent = useCallback((reason = 'cancelled') => {
    if (handoffFrameRef.current != null) cancelAnimationFrame(handoffFrameRef.current);
    if (introTimerRef.current) clearTimeout(introTimerRef.current);
    if (rewardLockTimerRef.current) clearTimeout(rewardLockTimerRef.current);
    handoffFrameRef.current = null;
    introTimerRef.current = null;
    rewardLockTimerRef.current = null;
    if (traceIdRef.current) markTodayEnergyPhase(traceIdRef.current, 'cancelled', { reason });
    traceIdRef.current = null;
    flowWasBusyRef.current = false;
    setPendingIntentState(null);
    setStatus('idle');
  }, []);

  const queueCompletion = useCallback((action: RankedTodayCareAction, rewardAlreadyAnimated: boolean) => {
    sequenceRef.current += 1;
    if (traceIdRef.current) markTodayEnergyPhase(traceIdRef.current, 'artifact_complete', { rewardAlreadyAnimated });
    setCompletionEvent({
      action,
      id: `${action.instanceId}:${sequenceRef.current}`,
      rewardAlreadyAnimated,
    });
    setPendingIntentState(null);
    flowWasBusyRef.current = false;
    setStatus('rewarding');
  }, []);

  const finishRewardHandoff = useCallback((onHandoff?: () => void) => {
    // The outgoing row has completed its UI-thread transform. Do not remove it,
    // derive the replacement list, and mount the incoming row in that same
    // frame; that synchronized React/layout boundary caused a visible hitch on
    // slower devices. Give the compositor one clean frame, then publish the
    // incoming slot. The entering phase remains active while its short intro
    // settles, while the presentation layer animates the new geometry.
    if (handoffFrameRef.current != null) return;
    if (rewardLockTimerRef.current) clearTimeout(rewardLockTimerRef.current);
    rewardLockTimerRef.current = null;
    setStatus('entering');
    handoffFrameRef.current = requestAnimationFrame(() => {
      handoffFrameRef.current = null;
      onHandoff?.();
      introTimerRef.current = setTimeout(() => {
        introTimerRef.current = null;
        if (traceIdRef.current) markTodayEnergyPhase(traceIdRef.current, 'egg_settled');
        traceIdRef.current = null;
        setStatus('idle');
      }, ACTION_INTRO_SETTLE_MS);
    });
  }, []);

  const finishCompletion = useCallback((eventId: string, onHandoff?: () => void) => {
    finishRewardHandoff(() => {
      setCompletionEvent((current) => current?.id === eventId ? null : current);
      onHandoff?.();
    });
  }, [finishRewardHandoff]);

  const finishRewardOnly = useCallback(() => {
    // Quick goals animate and remove their originating row directly, so they
    // have no TodayCareCompletionEvent whose outro can finish the shared loop.
    // Still run the same entering/idle handoff so replacement (or empty) state
    // can settle and interactions are always restored.
    finishRewardHandoff();
  }, [finishRewardHandoff]);

  const markRewardLaunch = useCallback(() => {
    if (traceIdRef.current) markTodayEnergyPhase(traceIdRef.current, 'reward_launch');
    setStatus('rewarding');
    if (rewardLockTimerRef.current) clearTimeout(rewardLockTimerRef.current);
    rewardLockTimerRef.current = setTimeout(() => {
      rewardLockTimerRef.current = null;
      if (traceIdRef.current) markTodayEnergyPhase(traceIdRef.current, 'cancelled', { reason: 'reward_timeout' });
      traceIdRef.current = null;
      flowWasBusyRef.current = false;
      setPendingIntentState(null);
      setCompletionEvent(null);
      setStatus('idle');
    }, REWARD_LOCK_TIMEOUT_MS);
  }, []);

  const markTokenArrival = useCallback((index: number, count: number) => {
    if (traceIdRef.current) markTodayEnergyPhase(traceIdRef.current, 'token_arrival', { count, index });
  }, []);

  const markDomainCommit = useCallback(() => {
    if (traceIdRef.current) markTodayEnergyPhase(traceIdRef.current, 'domain_commit');
  }, []);

  const noteFlowBusy = useCallback((busy: boolean) => {
    if (busy) flowWasBusyRef.current = true;
  }, []);

  const rewardAlreadyAnimated = useCallback(
    (currentRewardRequestKey: number) => currentRewardRequestKey !== rewardRequestKeyAtStartRef.current,
    [],
  );

  return useMemo(() => ({
    clearIntent,
    completionEvent,
    finishCompletion,
    finishRewardOnly,
    flowWasBusyRef,
    markDestinationOpen,
    markDomainCommit,
    markRewardLaunch,
    markTokenArrival,
    noteFlowBusy,
    pendingIntent,
    queueCompletion,
    rewardAlreadyAnimated,
    setPendingIntent,
    startIntent,
    status,
  }), [
    clearIntent,
    completionEvent,
    finishCompletion,
    finishRewardOnly,
    markDestinationOpen,
    markDomainCommit,
    markRewardLaunch,
    markTokenArrival,
    noteFlowBusy,
    pendingIntent,
    queueCompletion,
    rewardAlreadyAnimated,
    setPendingIntent,
    startIntent,
    status,
  ]);
}
