import { Image } from 'expo-image';
import { forwardRef, useEffect } from 'react';
import { Pressable, StyleSheet, View, type View as NativeView } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';
import type { MergeWorldArrival } from '@/types/merge-world';

import { PersistentMergeItemArt } from './feastle-persistent-merge-board';
import type { MergeScreenPoint } from './merge-serve-reward-overlay';

const PARCEL_ART = require('../../../assets/images/katchimeras/world/objects_lod/gift_crate/gift_crate_pick__medium.webp');
const PARCEL_TRAY_ART = require('../../../assets/images/katchimeras/merge-world/ui/order-service-tray.webp');
const PARCEL_SIZE = 64;
const PARCEL_TRAY_SIZE = 120;
const FLIGHT_ITEM_SIZE = 42;

export type MergeParcelFlight = {
  nonce: number;
  from: MergeScreenPoint;
  items: { instanceId: string; definitionId: string; to: MergeScreenPoint }[];
};

export const MergeParcelTrayCard = forwardRef<NativeView, {
  arrival: MergeWorldArrival;
  count: number;
  disabled: boolean;
  onPress: () => void;
  shakeNonce: number;
}>(function MergeParcelTrayCard({ arrival, count, disabled, onPress, shakeNonce }, ref) {
  const shake = useSharedValue(0);

  useEffect(() => {
    if (!shakeNonce) return;
    shake.value = withSequence(
      withTiming(-5, { duration: 45 }),
      withTiming(5, { duration: 70 }),
      withTiming(-3, { duration: 60 }),
      withTiming(0, { duration: 55 }),
    );
    return () => cancelAnimation(shake);
  }, [shake, shakeNonce]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }), [shake]);
  const character = arrival.characterId ? `${arrival.label}, ` : '';
  return (
    <Pressable
      accessibilityHint="Opens the parcel and sends its items into open board spaces"
      accessibilityLabel={`${character}${arrival.itemDefinitionIds.length} items. ${count} ${count === 1 ? 'parcel' : 'parcels'} waiting`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.parcelCard, pressed && styles.parcelPressed]}>
      <Animated.View ref={ref} style={[styles.parcelCrate, shakeStyle]}>
        <View pointerEvents="none" style={styles.parcelGlow} />
        <Image accessibilityIgnoresInvertColors contentFit="contain" source={PARCEL_ART} style={styles.parcelArt} transition={0} />
        {arrival.kind === 'goal_chest' ? <View pointerEvents="none" style={styles.goalBadge}><IconSymbol color="#FFF5D8" name="star.fill" size={10} /></View> : null}
        <View accessibilityElementsHidden pointerEvents="none" style={styles.countBadge}>
          <ThemedText darkColor="#4A291B" lightColor="#4A291B" style={styles.countText}>{count}</ThemedText>
        </View>
      </Animated.View>
      <Image accessibilityIgnoresInvertColors contentFit="contain" pointerEvents="none" source={PARCEL_TRAY_ART} style={styles.parcelTrayArt} transition={0} />
    </Pressable>
  );
});

export function MergeParcelFlightOverlay({ flight, onFinish, onItemArrive }: {
  flight: MergeParcelFlight | null;
  onFinish: () => void;
  onItemArrive: (instanceId: string) => void;
}) {
  if (!flight) return null;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={styles.flightOverlay}>
      <ParcelOpening from={flight.from} />
      {flight.items.map((item, index) => <ParcelFlyingItem
        count={flight.items.length}
        flightNonce={flight.nonce}
        from={flight.from}
        index={index}
        item={item}
        key={`${flight.nonce}:${item.instanceId}`}
        onFinish={onFinish}
        onItemArrive={onItemArrive}
      />)}
    </View>
  );
}

function ParcelOpening({ from }: { from: MergeScreenPoint }) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    progress.value = withTiming(1, { duration: reduceMotion ? 150 : 280, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.55, 1], [1, 0.88, 0]),
    transform: [
      { translateX: from.x - PARCEL_SIZE / 2 },
      { translateY: from.y - PARCEL_SIZE / 2 },
      { scale: interpolate(progress.value, [0, 0.3, 1], [1, 1.12, 0.72]) },
      { rotateZ: `${interpolate(progress.value, [0, 0.35, 1], [0, -5, 3])}deg` },
    ],
  }), [from.x, from.y]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.2, 1], [0, 0.9, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.45, 1.75]) }],
  }));
  return <Animated.View style={[styles.openingCrate, style]}><Animated.View style={[styles.openingGlow, glowStyle]} /><Image accessibilityIgnoresInvertColors contentFit="contain" source={PARCEL_ART} style={styles.openingArt} transition={0} /></Animated.View>;
}

function ParcelFlyingItem({ count, flightNonce, from, index, item, onFinish, onItemArrive }: {
  count: number;
  flightNonce: number;
  from: MergeScreenPoint;
  index: number;
  item: MergeParcelFlight['items'][number];
  onFinish: () => void;
  onItemArrive: (instanceId: string) => void;
}) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    progress.value = withDelay(reduceMotion ? index * 28 : 95 + index * 72, withTiming(1, {
      duration: reduceMotion ? 170 : 430,
      easing: Easing.inOut(Easing.cubic),
    }, (finished) => {
      if (!finished) return;
      runOnJS(onItemArrive)(item.instanceId);
      if (index === count - 1) runOnJS(onFinish)();
    }));
    return () => cancelAnimation(progress);
  }, [count, flightNonce, index, item.instanceId, onFinish, onItemArrive, progress, reduceMotion]);

  const style = useAnimatedStyle(() => {
    const value = progress.value;
    const inverse = 1 - value;
    const midpointX = (from.x + item.to.x) / 2;
    const curveX = midpointX + (index % 2 === 0 ? -34 : 34);
    const curveY = Math.min(from.y, item.to.y) - 62;
    const x = inverse * inverse * from.x + 2 * inverse * value * curveX + value * value * item.to.x;
    const y = inverse * inverse * from.y + 2 * inverse * value * curveY + value * value * item.to.y;
    return {
      // Keep the flight copy opaque at the destination. onItemArrive reveals
      // the already-committed board sprite underneath it, and the overlay is
      // then removed. Fading the flight copy before that handoff looked like
      // the board item was playing a second entrance animation.
      opacity: interpolate(value, [0, 0.08, 1], [0, 1, 1]),
      transform: [
        { translateX: x - FLIGHT_ITEM_SIZE / 2 },
        { translateY: y - FLIGHT_ITEM_SIZE / 2 },
        { rotateZ: `${interpolate(value, [0, 1], [index % 2 === 0 ? -8 : 8, 0])}deg` },
        { scale: interpolate(value, [0, 0.18, 0.86, 1], [0.6, 1.1, 1, 0.92]) },
      ],
    };
  }, [from.x, from.y, index, item.to.x, item.to.y]);

  const landingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.82, 0.92, 1], [0, 0, 0.78, 0]),
    transform: [{ scale: interpolate(progress.value, [0.82, 1], [0.5, 1.45]) }],
  }));

  return <Animated.View style={[styles.flyingItem, { left: 0, top: 0 }, style]}>
    <Animated.View style={[styles.landingGlow, landingStyle]} />
    <PersistentMergeItemArt definitionId={item.definitionId} size={FLIGHT_ITEM_SIZE} />
  </Animated.View>;
}

const styles = StyleSheet.create({
  parcelCard: { height: PARCEL_TRAY_SIZE, overflow: 'visible', position: 'relative', width: PARCEL_TRAY_SIZE },
  parcelCrate: { alignItems: 'center', bottom: 25, height: 70, justifyContent: 'center', left: 25, position: 'absolute', width: 70, zIndex: 3 },
  parcelPressed: { opacity: 0.86, transform: [{ scale: 0.94 }, { translateY: 1 }] },
  parcelGlow: { backgroundColor: 'rgba(255,218,121,0.25)', borderRadius: 999, boxShadow: '0 0 18px rgba(255,202,91,0.55)', height: 48, position: 'absolute', width: 48 },
  parcelArt: { height: PARCEL_SIZE, width: PARCEL_SIZE },
  parcelTrayArt: { bottom: 0, height: 58, left: -2, position: 'absolute', width: 124, zIndex: 2 },
  countBadge: { alignItems: 'center', backgroundColor: '#F6D993', borderColor: '#6A4123', borderRadius: 999, borderWidth: 1.5, height: 22, justifyContent: 'center', position: 'absolute', right: -1, top: 0, width: 22, zIndex: 5 },
  countText: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 11, fontVariant: ['tabular-nums'], includeFontPadding: false, lineHeight: 14, minWidth: 18, textAlign: 'center', textAlignVertical: 'center', transform: [{ translateY: -0.5 }] },
  goalBadge: { alignItems: 'center', backgroundColor: '#8A5A38', borderColor: '#FFE1A2', borderRadius: 999, borderWidth: 1, bottom: 1, height: 20, justifyContent: 'center', position: 'absolute', left: 1, width: 20 },
  flightOverlay: { ...StyleSheet.absoluteFillObject, overflow: 'visible', zIndex: 115 },
  openingCrate: { height: PARCEL_SIZE, left: 0, position: 'absolute', top: 0, width: PARCEL_SIZE },
  openingGlow: { backgroundColor: 'rgba(255,222,132,0.38)', borderRadius: 999, height: 48, left: 4, position: 'absolute', top: 4, width: 48 },
  openingArt: { height: PARCEL_SIZE, position: 'absolute', width: PARCEL_SIZE },
  flyingItem: { height: FLIGHT_ITEM_SIZE, position: 'absolute', width: FLIGHT_ITEM_SIZE },
  landingGlow: { backgroundColor: 'rgba(255,225,139,0.42)', borderColor: 'rgba(255,246,208,0.82)', borderRadius: 999, borderWidth: 1.5, height: FLIGHT_ITEM_SIZE + 6, left: -3, position: 'absolute', top: -3, width: FLIGHT_ITEM_SIZE + 6 },
});
