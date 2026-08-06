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
  | 'settling';

export function useTodayEnergyLoop() {
  const [pendingIntent, setPendingIntentState] = useState<RankedTodayCareAction | null>(null);
  const [completionEvent, setCompletionEvent] = useState<TodayCareCompletionEvent | null>(null);
  const [status, setStatus] = useState<TodayEnergyLoopStatus>('idle');
  const sequenceRef = useRef(0);
  const rewardRequestKeyAtStartRef = useRef(0);
  const flowWasBusyRef = useRef(false);
  const traceIdRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (traceIdRef.current) markTodayEnergyPhase(traceIdRef.current, 'cancelled', { reason: 'unmount' });
  }, []);

  const startIntent = useCallback((action: RankedTodayCareAction, rewardRequestKey: number) => {
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

  const finishCompletion = useCallback((eventId: string) => {
    setCompletionEvent((current) => current?.id === eventId ? null : current);
    if (traceIdRef.current) markTodayEnergyPhase(traceIdRef.current, 'egg_settled');
    traceIdRef.current = null;
    setStatus('idle');
  }, []);

  const markRewardLaunch = useCallback(() => {
    if (traceIdRef.current) markTodayEnergyPhase(traceIdRef.current, 'reward_launch');
    setStatus('rewarding');
  }, []);

  const markTokenArrival = useCallback((index: number, count: number) => {
    if (traceIdRef.current) markTodayEnergyPhase(traceIdRef.current, 'token_arrival', { count, index });
    if (index === count - 1) setStatus('settling');
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
