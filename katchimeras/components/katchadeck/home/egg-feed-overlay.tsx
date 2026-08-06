import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { GROWTH_ENERGY_ART } from '@/constants/today-care-art';
import { Lantern } from '@/constants/theme';
import { splitEnergyAcrossTokens } from '@/utils/energy-payout';

export type EggFeed = {
  energyAmount?: number;
  energyOnly?: boolean;
  framelessImage?: boolean;
  nonce: number;
  fromX: number;
  fromY: number;
  currencyFromX?: number;
  currencyFromY?: number;
  imageSource?: number;
  toX: number;
  toY: number;
  label?: string;
  photoUri?: string;
  tint: string;
};

type EggFeedOverlayProps = {
  feed: EggFeed | null;
  onArrive: () => void;
  onEnergyTokenArrive?: (amount: number, index: number, count: number) => void;
};

const SOURCE_FLIGHT_MS = 500;
const TOKEN_COUNT = 5;
const TOKEN_RISE_MS = 180;
const TOKEN_HOVER_MS = 260;
const TOKEN_FLIGHT_MS = 440;
const TOKEN_STAGGER_MS = 78;
const TOKEN_SIZE = 46;

const BURST_VECTORS = [
  { x: -31, y: -48, rotation: -12 },
  { x: -16, y: -57, rotation: -6 },
  { x: 0, y: -62, rotation: 0 },
  { x: 16, y: -57, rotation: 6 },
  { x: 31, y: -48, rotation: 12 },
] as const;

export function EggFeedOverlay({ feed, onArrive, onEnergyTokenArrive }: EggFeedOverlayProps) {
  if (!feed) return null;
  return (
    <FeedPayout
      feed={feed}
      key={feed.nonce}
      onArrive={onArrive}
      onEnergyTokenArrive={onEnergyTokenArrive}
    />
  );
}

function FeedPayout({ feed, onArrive, onEnergyTokenArrive }: {
  feed: EggFeed;
  onArrive: () => void;
  onEnergyTokenArrive?: (amount: number, index: number, count: number) => void;
}) {
  const tokenAmounts = splitEnergyAcrossTokens(feed.energyAmount ?? 0, TOKEN_COUNT);
  const hasEnergyPayout = tokenAmounts.length > 0;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {!feed.energyOnly ? (
        <SourceMote feed={feed} completesFeed={!hasEnergyPayout} onArrive={onArrive} />
      ) : null}
      {tokenAmounts.map((amount, index) => (
        <EnergyToken
          amount={amount}
          count={tokenAmounts.length}
          feed={feed}
          index={index}
          key={`${feed.nonce}:energy:${index}`}
          onArrive={onArrive}
          onEnergyTokenArrive={onEnergyTokenArrive}
        />
      ))}
      {feed.energyOnly && !hasEnergyPayout ? <ImmediateArrival onArrive={onArrive} /> : null}
    </View>
  );
}

function ImmediateArrival({ onArrive }: { onArrive: () => void }) {
  useEffect(() => {
    const frame = requestAnimationFrame(onArrive);
    return () => cancelAnimationFrame(frame);
  }, [onArrive]);
  return null;
}

function SourceMote({ feed, completesFeed, onArrive }: {
  feed: EggFeed;
  completesFeed: boolean;
  onArrive: () => void;
}) {
  const progress = useSharedValue(0);
  const isPhoto = Boolean(feed.photoUri);
  const isIcon = feed.imageSource != null;
  const isFramelessIcon = isIcon && feed.framelessImage;
  const [dims, setDims] = useState({ w: isPhoto ? 64 : isIcon ? 54 : 120, h: isPhoto ? 64 : isIcon ? 54 : 40 });

  useEffect(() => {
    progress.value = withTiming(1, { duration: SOURCE_FLIGHT_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished && completesFeed) runOnJS(onArrive)();
    });
  }, [completesFeed, onArrive, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const cx = feed.fromX + (feed.toX - feed.fromX) * p;
    const cy = feed.fromY + (feed.toY - feed.fromY) * p - Math.sin(Math.PI * p) * 52;
    return {
      opacity: p < 0.82 ? 1 : Math.max(0, 1 - (p - 0.82) / 0.18),
      transform: [
        { translateX: cx - dims.w / 2 },
        { translateY: cy - dims.h / 2 },
        { scale: 1 - 0.64 * p },
      ],
    };
  });

  return (
    <Animated.View
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width && height) setDims({ w: width, h: height });
      }}
      style={[
        styles.mote,
        isPhoto
          ? styles.photoMote
          : isFramelessIcon
            ? styles.framelessIconMote
            : isIcon
              ? [styles.iconMote, { borderColor: `${feed.tint}99` }]
              : { backgroundColor: `${feed.tint}E6` },
        animatedStyle,
      ]}>
      {isPhoto ? (
        <Image contentFit="cover" source={{ uri: feed.photoUri }} style={styles.photo} transition={0} />
      ) : isIcon ? (
        <Image contentFit="contain" source={feed.imageSource} style={styles.feedIcon} transition={0} />
      ) : (
        <ThemedText numberOfLines={1} style={styles.label} lightColor={Lantern.ink900} darkColor={Lantern.ink900}>
          {feed.label}
        </ThemedText>
      )}
    </Animated.View>
  );
}

function EnergyToken({ amount, count, feed, index, onArrive, onEnergyTokenArrive }: {
  amount: number;
  count: number;
  feed: EggFeed;
  index: number;
  onArrive: () => void;
  onEnergyTokenArrive?: (amount: number, index: number, count: number) => void;
}) {
  const riseProgress = useSharedValue(0);
  const flightProgress = useSharedValue(0);
  const hoverPhase = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const vector = BURST_VECTORS[index] ?? BURST_VECTORS[BURST_VECTORS.length - 1];

  useEffect(() => {
    const riseDuration = reduceMotion ? 100 : TOKEN_RISE_MS;
    const hoverDuration = reduceMotion ? 90 : TOKEN_HOVER_MS;
    const stagger = reduceMotion ? index * 28 : index * TOKEN_STAGGER_MS;
    const flightDuration = reduceMotion ? 250 : TOKEN_FLIGHT_MS;
    // All five tokens rise on the same frame and settle into one readable
    // hover cluster. Only the homing flights are staggered.
    riseProgress.value = withTiming(1, {
      duration: riseDuration,
      easing: Easing.out(Easing.cubic),
    });
    hoverPhase.value = reduceMotion
      ? withTiming(1, { duration: 560, easing: Easing.linear })
      : withRepeat(
          withTiming(1, { duration: 720, easing: Easing.linear }),
          -1,
          false,
        );
    flightProgress.value = withDelay(riseDuration + hoverDuration + stagger, withTiming(1, {
      duration: flightDuration,
      easing: Easing.in(Easing.cubic),
    }, (finished) => {
      if (!finished) return;
      if (onEnergyTokenArrive) runOnJS(onEnergyTokenArrive)(amount, index, count);
      if (index === count - 1) runOnJS(onArrive)();
    }));
    return () => {
      cancelAnimation(flightProgress);
      cancelAnimation(hoverPhase);
      cancelAnimation(riseProgress);
    };
  }, [amount, count, flightProgress, hoverPhase, index, onArrive, onEnergyTokenArrive, reduceMotion, riseProgress]);

  const animatedStyle = useAnimatedStyle(() => {
    const startX = feed.currencyFromX ?? feed.fromX;
    const startY = feed.currencyFromY ?? feed.fromY;
    const rise = riseProgress.value;
    const q = flightProgress.value;
    const burstX = startX + vector.x;
    const burstY = startY + vector.y;
    const inverse = 1 - q;
    const controlX = (burstX + feed.toX) / 2 + (index % 2 === 0 ? -24 : 24);
    const controlY = Math.min(burstY, feed.toY) - 82 - index * 3;
    const stagedX = startX + vector.x * rise;
    const stagedY = startY + vector.y * rise;
    const baseX = q === 0
      ? stagedX
      : inverse * inverse * burstX + 2 * inverse * q * controlX + q * q * feed.toX;
    const baseY = q === 0
      ? stagedY
      : inverse * inverse * burstY + 2 * inverse * q * controlY + q * q * feed.toY;
    const hoverEnvelope = rise * inverse;
    const phase = hoverPhase.value * Math.PI * 2 + index * 0.92;
    const hoverStrength = reduceMotion ? 0.5 : 1;
    const cx = baseX + Math.cos(phase) * 3 * hoverEnvelope * hoverStrength;
    const cy = baseY + Math.sin(phase) * 4 * hoverEnvelope * hoverStrength;
    const scale = q > 0 ? 1.06 - q * 0.80 : 0.54 + rise * 0.52;
    const hoverScale = 1 + Math.sin(phase + 0.6) * 0.035 * hoverEnvelope * hoverStrength;
    const opacity = rise <= 0.04
      ? rise / 0.04
      : q < 0.88
        ? 1
        : Math.max(0, (1 - q) / 0.12);
    return {
      opacity,
      transform: [
        { translateX: cx - TOKEN_SIZE / 2 },
        { translateY: cy - TOKEN_SIZE / 2 },
        { rotate: `${vector.rotation * (1 - q)}deg` },
        { scale: scale * hoverScale },
      ],
    };
  });

  return (
    <Animated.View style={[styles.energyToken, animatedStyle]}>
      <Image contentFit="contain" source={GROWTH_ENERGY_ART} style={styles.energyTokenArt} transition={0} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 60 },
  mote: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    justifyContent: 'center',
    left: 0,
    maxWidth: 180,
    paddingHorizontal: 14,
    paddingVertical: 9,
    position: 'absolute',
    top: 0,
  },
  photoMote: {
    borderColor: 'rgba(255,241,228,0.5)',
    borderRadius: 18,
    borderWidth: 1.5,
    height: 64,
    overflow: 'hidden',
    padding: 0,
    width: 64,
  },
  photo: { height: '100%', width: '100%' },
  iconMote: {
    backgroundColor: 'rgba(255,248,226,0.94)',
    borderRadius: 18,
    borderWidth: 1.5,
    height: 54,
    padding: 4,
    width: 54,
  },
  framelessIconMote: {
    height: 54,
    padding: 0,
    width: 54,
  },
  feedIcon: { height: '100%', width: '100%' },
  label: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
  energyToken: {
    alignItems: 'center',
    height: TOKEN_SIZE,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 0,
    width: TOKEN_SIZE,
  },
  energyTokenArt: {
    height: '100%',
    width: '100%',
  },
});
