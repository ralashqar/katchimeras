import { useCallback, useEffect, useRef, useState } from 'react';
import type { View } from 'react-native';
import * as Haptics from 'expo-haptics';

import type { EggFeed } from '@/components/katchadeck/home/egg-feed-overlay';
import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { Lantern } from '@/constants/theme';
import { publishTodayEnergyFeedback } from '@/features/today/today-energy-feedback';

type EggFeedPayload = {
  currencyFrom?: FeedSourceRect;
  energyAmount?: number;
  energyOnly?: boolean;
  framelessImage?: boolean;
  imageSource?: number;
  label?: string;
  photoUri?: string;
  tint?: string;
};

type EggFeedRequest = {
  from: FeedSourceRect;
  payload: EggFeedPayload;
  commit: () => void;
};

const EGG_FEED_TARGET_Y_RATIO = 0.64;
const FEED_ARRIVAL_WATCHDOG_MS = 2_500;

export function useEggFeedController() {
  const [eggFeed, setEggFeed] = useState<EggFeed | null>(null);
  const [eggFeedKey, setEggFeedKey] = useState(0);
  const [eggFeedRewardRequestKey, setEggFeedRewardRequestKey] = useState(0);
  const eggTargetRef = useRef<View | null>(null);
  const heroStageRef = useRef<View | null>(null);
  const pendingFeedCommit = useRef<(() => void) | null>(null);
  const nextEnergyCurrencySourceRef = useRef<FeedSourceRect | null>(null);
  const feedNonce = useRef(0);
  const eggFeedRef = useRef<EggFeed | null>(null);
  const queuedFeedsRef = useRef<EggFeedRequest[]>([]);
  const launchPendingRef = useRef(false);
  const launchRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedArrivalWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleActiveFeedRef = useRef<(feedNonce?: number) => void>(() => {});
  const growthHapticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalEnergyFeedbackFrameRef = useRef<number | null>(null);
  const pendingFinalEnergyFeedbackRef = useRef<{ amount: number; count: number; index: number } | null>(null);

  useEffect(() => () => {
    if (launchRetryTimerRef.current) clearTimeout(launchRetryTimerRef.current);
    if (feedArrivalWatchdogRef.current) clearTimeout(feedArrivalWatchdogRef.current);
    if (growthHapticTimerRef.current) clearTimeout(growthHapticTimerRef.current);
    if (finalEnergyFeedbackFrameRef.current != null) cancelAnimationFrame(finalEnergyFeedbackFrameRef.current);
    launchRetryTimerRef.current = null;
    feedArrivalWatchdogRef.current = null;
    growthHapticTimerRef.current = null;
    finalEnergyFeedbackFrameRef.current = null;
    pendingFinalEnergyFeedbackRef.current = null;
    launchPendingRef.current = false;
    queuedFeedsRef.current = [];
    pendingFeedCommit.current = null;
  }, []);

  const clearFeed = useCallback(() => {
    eggFeedRef.current = null;
    setEggFeed(null);
  }, []);

  const pulseEgg = useCallback(() => {
    setEggFeedKey((key) => key + 1);
  }, []);

  const setNextEnergyCurrencySource = useCallback((source: FeedSourceRect | null) => {
    nextEnergyCurrencySourceRef.current = source;
  }, []);

  const launchFeedRequest = useCallback(function launchFeedRequest(
    { from, payload, commit }: EggFeedRequest,
    targetAttempt = 0,
  ) {
    launchPendingRef.current = true;
    const launch = (toX: number, toY: number) => {
      launchPendingRef.current = false;
      launchRetryTimerRef.current = null;
      feedNonce.current += 1;
      pendingFeedCommit.current = commit;
      const nextFeed: EggFeed = {
        nonce: feedNonce.current,
        fromX: from.x + from.w / 2,
        fromY: from.y + from.h / 2,
        currencyFromX: payload.currencyFrom ? payload.currencyFrom.x + payload.currencyFrom.w / 2 : undefined,
        currencyFromY: payload.currencyFrom ? payload.currencyFrom.y + payload.currencyFrom.h / 2 : undefined,
        energyAmount: payload.energyAmount,
        energyOnly: payload.energyOnly,
        framelessImage: payload.framelessImage,
        imageSource: payload.imageSource,
        toX,
        toY,
        label: payload.label,
        photoUri: payload.photoUri,
        tint: payload.tint ?? Lantern.ember300,
      };
      eggFeedRef.current = nextFeed;
      setEggFeed(nextFeed);
      if (feedArrivalWatchdogRef.current) clearTimeout(feedArrivalWatchdogRef.current);
      feedArrivalWatchdogRef.current = setTimeout(() => {
        feedArrivalWatchdogRef.current = null;
        settleActiveFeedRef.current(nextFeed.nonce);
      }, FEED_ARRIVAL_WATCHDOG_MS);
    };

    const eggDestination = eggTargetRef.current;
    const destination = eggDestination ?? heroStageRef.current;
    if (destination) {
      // The egg scales around its bottom edge. Aim below the layout centre so
      // rewards still disappear into the shell at its half-size starting state.
      const targetYRatio = eggDestination ? EGG_FEED_TARGET_Y_RATIO : 0.5;
      destination.measureInWindow((x, y, w, h) => launch(x + w / 2, y + h * targetYRatio));
      return;
    }

    // Navigation focus runs before child refs are guaranteed to have mounted.
    // Hold the one-shot reward long enough for the Today egg target to return
    // instead of consuming the receipt with no visible payout.
    if (targetAttempt < 16) {
      launchRetryTimerRef.current = setTimeout(
        () => launchFeedRequest({ from, payload, commit }, targetAttempt + 1),
        32,
      );
      return;
    }

    launchPendingRef.current = false;
    launchRetryTimerRef.current = null;
    commit();
    const next = queuedFeedsRef.current.shift();
    if (next) launchFeedRequest(next);
  }, []);

  const startEggFeed = useCallback((from: FeedSourceRect, payload: EggFeedPayload, commit: () => void) => {
    const hasEnergy = (payload.energyAmount ?? 0) > 0;
    const resolvedPayload = hasEnergy && !payload.currencyFrom && nextEnergyCurrencySourceRef.current
      ? { ...payload, currencyFrom: nextEnergyCurrencySourceRef.current }
      : payload;
    const request = { commit, from, payload: resolvedPayload };
    if (hasEnergy) {
      nextEnergyCurrencySourceRef.current = null;
      setEggFeedRewardRequestKey((key) => key + 1);
    }
    if (eggFeedRef.current || launchPendingRef.current) {
      queuedFeedsRef.current.push(request);
      return;
    }
    launchFeedRequest(request);
  }, [launchFeedRequest]);

  const handleEggFeedArrive = useCallback((feedNonce?: number) => {
    if (feedNonce != null && eggFeedRef.current?.nonce !== feedNonce) return;
    if (feedArrivalWatchdogRef.current) clearTimeout(feedArrivalWatchdogRef.current);
    feedArrivalWatchdogRef.current = null;
    // Mood and sleep commit on the fifth token. Publish that final arrival on
    // the next frame so React has first rendered the newly earned Energy. The
    // egg then grows and pulses from the same up-to-date value instead of
    // pulsing at its old size and falling back to a delayed reconciliation.
    pendingFeedCommit.current?.();
    pendingFeedCommit.current = null;
    if (pendingFinalEnergyFeedbackRef.current) {
      if (finalEnergyFeedbackFrameRef.current != null) {
        cancelAnimationFrame(finalEnergyFeedbackFrameRef.current);
      }
      finalEnergyFeedbackFrameRef.current = requestAnimationFrame(() => {
        finalEnergyFeedbackFrameRef.current = null;
        const feedback = pendingFinalEnergyFeedbackRef.current;
        pendingFinalEnergyFeedbackRef.current = null;
        if (feedback) publishTodayEnergyFeedback(feedback.amount, feedback.index, feedback.count);
      });
    }
    clearFeed();
    const next = queuedFeedsRef.current.shift();
    if (next) launchFeedRequest(next);
  }, [clearFeed, launchFeedRequest]);
  settleActiveFeedRef.current = handleEggFeedArrive;

  const handleEnergyTokenArrive = useCallback((amount: number, index: number, count: number) => {
    if (index === count - 1) {
      pendingFinalEnergyFeedbackRef.current = { amount, count, index };
    } else {
      publishTodayEnergyFeedback(amount, index, count);
    }
    // Token-by-token meter and egg feedback stay on the focused external
    // channel. The forming egg subscribes directly, so the final token no
    // longer forces the entire Today route through a React render merely to
    // start a UI-thread pulse.
    if (process.env.EXPO_OS === 'ios') {
      const finalToken = index === count - 1;
      const style = finalToken
        ? Haptics.ImpactFeedbackStyle.Medium
        : index >= Math.ceil(count / 2)
          ? Haptics.ImpactFeedbackStyle.Light
          : Haptics.ImpactFeedbackStyle.Soft;
      void Haptics.impactAsync(style);
      if (finalToken) {
        if (growthHapticTimerRef.current) clearTimeout(growthHapticTimerRef.current);
        growthHapticTimerRef.current = setTimeout(() => {
          growthHapticTimerRef.current = null;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
        }, 170);
      }
    }
  }, []);

  return {
    eggFeed,
    eggFeedKey,
    eggFeedRewardRequestKey,
    eggTargetRef,
    heroStageRef,
    startEggFeed,
    handleEggFeedArrive,
    handleEnergyTokenArrive,
    pulseEgg,
    setNextEnergyCurrencySource,
  };
}
