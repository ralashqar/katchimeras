import { Image } from 'expo-image';
import { useEffect } from 'react';
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
const ITEM_SIZE = 38;
const COIN_SIZE = 35;
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
  items: readonly MergeServeItemFlight[];
  nonce: number;
  phase: 'items' | 'coins';
};

export function MergeServeRewardOverlay({ flight, onCoinArrive, onFinish, onItemsArrive }: {
  flight: MergeServeRewardFlight | null;
  onCoinArrive: (amount: number) => void;
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
      {flight.phase === 'coins' ? (
        <CoinPayout
          amount={flight.coinAmount}
          from={flight.coinFrom}
          nonce={flight.nonce}
          onArrive={onCoinArrive}
          onFinish={onFinish}
          to={flight.coinTo}
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

function CoinPayout({ amount, from, nonce, onArrive, onFinish, to }: {
  amount: number;
  from: MergeScreenPoint;
  nonce: number;
  onArrive: (amount: number) => void;
  onFinish: () => void;
  to: MergeScreenPoint;
}) {
  const tokenAmounts = splitEnergyAcrossTokens(amount, 5);

  useEffect(() => {
    if (tokenAmounts.length) return;
    const frame = requestAnimationFrame(onFinish);
    return () => cancelAnimationFrame(frame);
  }, [onFinish, tokenAmounts.length]);

  return tokenAmounts.map((tokenAmount, index) => (
    <CoinToken
      amount={tokenAmount}
      count={tokenAmounts.length}
      from={from}
      index={index}
      key={`${nonce}:coin:${index}`}
      onArrive={onArrive}
      onFinish={onFinish}
      to={to}
    />
  ));
}

function CoinToken({ amount, count, from, index, onArrive, onFinish, to }: {
  amount: number;
  count: number;
  from: MergeScreenPoint;
  index: number;
  onArrive: (amount: number) => void;
  onFinish: () => void;
  to: MergeScreenPoint;
}) {
  const rise = useSharedValue(0);
  const flight = useSharedValue(0);
  const hover = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const vector = COIN_BURST[index] ?? COIN_BURST[COIN_BURST.length - 1];

  useEffect(() => {
    const riseMs = reduceMotion ? 90 : COIN_RISE_MS;
    const hoverMs = reduceMotion ? 70 : COIN_HOVER_MS;
    const stagger = reduceMotion ? index * 25 : index * COIN_STAGGER_MS;
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
  }, [amount, count, flight, hover, index, onArrive, onFinish, reduceMotion, rise]);

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
        { translateX: x - COIN_SIZE / 2 },
        { translateY: y - COIN_SIZE / 2 },
        { rotateZ: `${vector.rotation * inverse}deg` },
        { scale: (0.58 + rise.value * 0.48) * (1 - value * 0.72) },
      ],
    };
  }, [from.x, from.y, index, reduceMotion, to.x, to.y]);

  return <Animated.View style={[styles.coin, motionStyle]}><Image accessibilityIgnoresInvertColors contentFit="contain" source={COIN_ART} style={styles.coinArt} transition={0} /></Animated.View>;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, overflow: 'visible', zIndex: 120 },
  servingItem: { height: ITEM_SIZE, left: 0, position: 'absolute', top: 0, width: ITEM_SIZE },
  coin: { height: COIN_SIZE, left: 0, position: 'absolute', top: 0, width: COIN_SIZE },
  coinArt: { height: '100%', width: '100%' },
});
