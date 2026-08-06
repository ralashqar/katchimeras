import { useCallback, useEffect, useRef, useState } from 'react';
import type { View } from 'react-native';
import * as Haptics from 'expo-haptics';

import type { EggFeed } from '@/components/katchadeck/home/egg-feed-overlay';
import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { Lantern } from '@/constants/theme';

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

export function useEggFeedController() {
  const [eggFeed, setEggFeed] = useState<EggFeed | null>(null);
  const [eggFeedKey, setEggFeedKey] = useState(0);
  const [eggFeedRewardKey, setEggFeedRewardKey] = useState(0);
  const [eggFeedRewardAmount, setEggFeedRewardAmount] = useState(0);
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

  useEffect(() => () => {
    if (launchRetryTimerRef.current) clearTimeout(launchRetryTimerRef.current);
    launchRetryTimerRef.current = null;
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
    };

    const destination = eggTargetRef.current ?? heroStageRef.current;
    if (destination) {
      destination.measureInWindow((x, y, w, h) => launch(x + w / 2, y + h / 2));
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

  const handleEggFeedArrive = useCallback(() => {
    pendingFeedCommit.current?.();
    pendingFeedCommit.current = null;
    clearFeed();
    const next = queuedFeedsRef.current.shift();
    if (next) launchFeedRequest(next);
  }, [clearFeed, launchFeedRequest]);

  const handleEnergyTokenArrive = useCallback((amount: number, index: number, count: number) => {
    setEggFeedRewardAmount(amount);
    setEggFeedRewardKey((key) => key + 1);
    pulseEgg();
    if (process.env.EXPO_OS === 'ios') {
      if (index === count - 1) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else void Haptics.selectionAsync();
    }
  }, [pulseEgg]);

  return {
    eggFeed,
    eggFeedKey,
    eggFeedRewardKey,
    eggFeedRewardAmount,
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
