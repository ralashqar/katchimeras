import { Image } from 'expo-image';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { splitEnergyAcrossTokens } from '@/utils/energy-payout';

import { PersistentMergeItemArt } from './feastle-persistent-merge-board';

const COIN_ART = require('../../../assets/images/katchimeras/merge-world/ui/coin.webp');
const ENERGY_ART = require('../../../assets/images/katchimeras/merge-world/ui/energy.webp');
const ITEM_SIZE = 38;
const REWARD_TOKEN_SIZE = 35;
const ITEM_FLIGHT_MS = 390;
const ITEM_STAGGER_MS = 55;
const COIN_RISE_MS = 140;
const COIN_HOVER_MS = 150;
const COIN_FLIGHT_MS = 380;
const COIN_STAGGER_MS = 65;

const COIN_BURST = [
  { rotation: -13, x: -29, y: -45 },
  { rotation: -6, x: -14, y: -55 },
  { rotation: 0, x: 0, y: -60 },
  { rotation: 7, x: 15, y: -54 },
  { rotation: 13, x: 29, y: -44 },
] as const;

export type MergeScreenPoint = { x: number; y: number };
export type MergeServeItemFlight = {
  definitionId: string;
  from: MergeScreenPoint;
  instanceId: string;
  to: MergeScreenPoint;
};
export type MergeServeRewardFlight = {
  coinAmount: number;
  coinFrom: MergeScreenPoint;
  coinTo: MergeScreenPoint;
  energyAmount: number;
  energyTo: MergeScreenPoint;
  items: readonly MergeServeItemFlight[];
  nonce: number;
  phase: 'items' | 'rewards';
};

export function MergeServeRewardOverlay({ flight, onCoinArrive, onEnergyArrive, onFinish, onItemsArrive }: {
  flight: MergeServeRewardFlight | null;
  onCoinArrive: (amount: number) => void;
  onEnergyArrive: (amount: number) => void;
  onFinish: () => void;
  onItemsArrive: () => void;
}) {
  if (!flight) return null;
  return (
    <View accessibilityLabel="Serving order" pointerEvents="auto" style={styles.overlay}>
      {flight.phase === 'items' ? flight.items.map((item, index) => (
        <ServingItem
          count={flight.items.length}
          index={index}
          item={item}
          key={`${flight.nonce}:item:${index}`}
          onItemsArrive={onItemsArrive}
        />
      )) : null}
      {flight.phase === 'rewards' ? (
        <ParallelRewardPayout
          flight={flight}
          onCoinArrive={onCoinArrive}
          onEnergyArrive={onEnergyArrive}
          onFinish={onFinish}
        />
      ) : null}
    </View>
  );
}

function ServingItem({ count, index, item, onItemsArrive }: {
  count: number;
  index: number;
  item: MergeServeItemFlight;
  onItemsArrive: () => void;
}) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const delay = reduceMotion ? index * 22 : index * ITEM_STAGGER_MS;
    progress.value = withDelay(delay, withTiming(1, {
      duration: reduceMotion ? 190 : ITEM_FLIGHT_MS,
      easing: Easing.inOut(Easing.cubic),
    }, (finished) => {
      if (finished && index === count - 1) runOnJS(onItemsArrive)();
    }));
    return () => cancelAnimation(progress);
  }, [count, index, onItemsArrive, progress, reduceMotion]);

  const motionStyle = useAnimatedStyle(() => {
    const value = progress.value;
    const inverse = 1 - value;
    const controlX = (item.from.x + item.to.x) / 2 + (index % 2 === 0 ? -18 : 18);
    const controlY = Math.min(item.from.y, item.to.y) - (reduceMotion ? 24 : 58);
    const x = inverse * inverse * item.from.x + 2 * inverse * value * controlX + value * value * item.to.x;
    const y = inverse * inverse * item.from.y + 2 * inverse * value * controlY + value * value * item.to.y;
    return {
      opacity: value < 0.93 ? 1 : Math.max(0, (1 - value) / 0.07),
      transform: [
        { translateX: x - ITEM_SIZE / 2 },
        { translateY: y - ITEM_SIZE / 2 },
        { rotateZ: `${interpolate(value, [0, 0.72, 1], [0, index % 2 === 0 ? -7 : 7, 0])}deg` },
        { scale: interpolate(value, [0, 0.78, 0.94, 1], [0.96, 1.08, 1.02, 0.92]) },
      ],
    };
  }, [index, item.from.x, item.from.y, item.to.x, item.to.y, reduceMotion]);

  return (
    <Animated.View style={[styles.servingItem, motionStyle]}>
      <PersistentMergeItemArt definitionId={item.definitionId} size={ITEM_SIZE} />
    </Animated.View>
  );
}

function ParallelRewardPayout({ flight, onCoinArrive, onEnergyArrive, onFinish }: {
  flight: MergeServeRewardFlight;
  onCoinArrive: (amount: number) => void;
  onEnergyArrive: (amount: number) => void;
  onFinish: () => void;
}) {
  const requiredGroups = Number(flight.coinAmount > 0) + Number(flight.energyAmount > 0);
  const completedGroupsRef = useRef(0);
  const finishGroup = useCallback(() => {
    completedGroupsRef.current += 1;
    if (completedGroupsRef.current >= requiredGroups) onFinish();
  }, [onFinish, requiredGroups]);

  useEffect(() => {
    if (requiredGroups > 0) return;
    const frame = requestAnimationFrame(onFinish);
    return () => cancelAnimationFrame(frame);
  }, [onFinish, requiredGroups]);

  return <>
    {flight.coinAmount > 0 ? <RewardPayout
      amount={flight.coinAmount}
      art={COIN_ART}
      from={flight.coinFrom}
      nonce={`${flight.nonce}:coin`}
      onArrive={onCoinArrive}
      onFinish={finishGroup}
      to={flight.coinTo}
      variant="coin"
    /> : null}
    {flight.energyAmount > 0 ? <RewardPayout
      amount={flight.energyAmount}
      art={ENERGY_ART}
      from={flight.coinFrom}
      nonce={`${flight.nonce}:energy`}
      onArrive={onEnergyArrive}
      onFinish={finishGroup}
      to={flight.energyTo}
      variant="energy"
    /> : null}
  </>;
}

function RewardPayout({ amount, art, from, nonce, onArrive, onFinish, to, variant }: {
  amount: number;
  art: number;
  from: MergeScreenPoint;
  nonce: string;
  onArrive: (amount: number) => void;
  onFinish: () => void;
  to: MergeScreenPoint;
  variant: 'coin' | 'energy';
}) {
  const tokenAmounts = splitEnergyAcrossTokens(amount, 5);

  useEffect(() => {
    if (tokenAmounts.length) return;
    const frame = requestAnimationFrame(onFinish);
    return () => cancelAnimationFrame(frame);
  }, [onFinish, tokenAmounts.length]);

  return tokenAmounts.map((tokenAmount, index) => (
    <RewardToken
      amount={tokenAmount}
      art={art}
      count={tokenAmounts.length}
      from={from}
      index={index}
      key={`${nonce}:coin:${index}`}
      onArrive={onArrive}
      onFinish={onFinish}
      to={to}
      variant={variant}
    />
  ));
}

function RewardToken({ amount, art, count, from, index, onArrive, onFinish, to, variant }: {
  amount: number;
  art: number;
  count: number;
  from: MergeScreenPoint;
  index: number;
  onArrive: (amount: number) => void;
  onFinish: () => void;
  to: MergeScreenPoint;
  variant: 'coin' | 'energy';
}) {
  const rise = useSharedValue(0);
  const flight = useSharedValue(0);
  const hover = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const baseVector = COIN_BURST[index] ?? COIN_BURST[COIN_BURST.length - 1];
  const vector = variant === 'energy'
    ? { ...baseVector, rotation: -baseVector.rotation, x: baseVector.x + 8, y: baseVector.y + 5 }
    : baseVector;

  useEffect(() => {
    const riseMs = reduceMotion ? 90 : COIN_RISE_MS;
    const hoverMs = reduceMotion ? 70 : COIN_HOVER_MS;
    const staggerOffset = variant === 'energy' ? 28 : 0;
    const stagger = (reduceMotion ? index * 25 : index * COIN_STAGGER_MS) + staggerOffset;
    rise.value = withTiming(1, { duration: riseMs, easing: Easing.out(Easing.cubic) });
    hover.value = reduceMotion
      ? withTiming(1, { duration: 450, easing: Easing.linear })
      : withRepeat(withTiming(1, { duration: 720, easing: Easing.linear }), -1, false);
    flight.value = withDelay(riseMs + hoverMs + stagger, withTiming(1, {
      duration: reduceMotion ? 240 : COIN_FLIGHT_MS,
      easing: Easing.in(Easing.cubic),
    }, (finished) => {
      if (!finished) return;
      runOnJS(onArrive)(amount);
      if (index === count - 1) runOnJS(onFinish)();
    }));
    return () => {
      cancelAnimation(flight);
      cancelAnimation(hover);
      cancelAnimation(rise);
    };
  }, [amount, count, flight, hover, index, onArrive, onFinish, reduceMotion, rise, variant]);

  const motionStyle = useAnimatedStyle(() => {
    const stagedX = from.x + vector.x * rise.value;
    const stagedY = from.y + vector.y * rise.value;
    const value = flight.value;
    const inverse = 1 - value;
    const controlX = (stagedX + to.x) / 2 + (index % 2 === 0 ? -22 : 22);
    const controlY = Math.min(stagedY, to.y) - 76 - index * 2;
    const baseX = value === 0 ? stagedX : inverse * inverse * stagedX + 2 * inverse * value * controlX + value * value * to.x;
    const baseY = value === 0 ? stagedY : inverse * inverse * stagedY + 2 * inverse * value * controlY + value * value * to.y;
    const phase = hover.value * Math.PI * 2 + index * 0.92;
    const hoverEnvelope = rise.value * inverse;
    const x = baseX + Math.cos(phase) * 3 * hoverEnvelope;
    const y = baseY + Math.sin(phase) * 4 * hoverEnvelope;
    return {
      opacity: value < 0.9 ? rise.value : Math.max(0, (1 - value) / 0.1),
      transform: [
        { translateX: x - REWARD_TOKEN_SIZE / 2 },
        { translateY: y - REWARD_TOKEN_SIZE / 2 },
        { rotateZ: `${vector.rotation * inverse}deg` },
        { scale: (0.58 + rise.value * 0.48) * (1 - value * 0.72) },
      ],
    };
  }, [from.x, from.y, index, reduceMotion, to.x, to.y]);

  return <Animated.View style={[styles.rewardToken, motionStyle]}><Image accessibilityIgnoresInvertColors contentFit="contain" source={art} style={styles.rewardTokenArt} transition={0} /></Animated.View>;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, overflow: 'visible', zIndex: 120 },
  servingItem: { height: ITEM_SIZE, left: 0, position: 'absolute', top: 0, width: ITEM_SIZE },
  rewardToken: { height: REWARD_TOKEN_SIZE, left: 0, position: 'absolute', top: 0, width: REWARD_TOKEN_SIZE },
  rewardTokenArt: { height: '100%', width: '100%' },
});
