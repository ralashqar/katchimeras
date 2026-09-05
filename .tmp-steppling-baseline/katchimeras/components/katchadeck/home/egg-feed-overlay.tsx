import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import {
  REWARD_TOKEN_MAX_COUNT,
  REWARD_TOKEN_PAYOUT_DURATION_MS,
  RewardTokenFlight,
} from '@/components/katchadeck/ui/reward-token-flight';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { Lantern } from '@/constants/theme';
import { splitEnergyAcrossTokens } from '@/utils/energy-payout';

export type EggFeed = {
  energyAmount?: number;
  energyOnly?: boolean;
  energyToX?: number;
  energyToY?: number;
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
  mergeEnergyAmount?: number;
  photoUri?: string;
  tint: string;
};

type EggFeedOverlayProps = {
  feed: EggFeed | null;
  onArrive: (feedNonce: number) => void;
  onEnergyTokenArrive?: (amount: number, index: number, count: number) => void;
  onMergeEnergyTokenArrive?: (amount: number, index: number, count: number) => void;
};

const SOURCE_FLIGHT_MS = 460;
const TOKEN_SIZE = 46;

/** Full five-token payout, from burst start through the final landing. */
export const EGG_FEED_PAYOUT_DURATION_MS = REWARD_TOKEN_PAYOUT_DURATION_MS;

export function EggFeedOverlay({ feed, onArrive, onEnergyTokenArrive, onMergeEnergyTokenArrive }: EggFeedOverlayProps) {
  if (!feed) return null;
  return (
    <FeedPayout
      feed={feed}
      key={feed.nonce}
      onArrive={() => onArrive(feed.nonce)}
      onEnergyTokenArrive={onEnergyTokenArrive}
      onMergeEnergyTokenArrive={onMergeEnergyTokenArrive}
    />
  );
}

function FeedPayout({ feed, onArrive, onEnergyTokenArrive, onMergeEnergyTokenArrive }: {
  feed: EggFeed;
  onArrive: () => void;
  onEnergyTokenArrive?: (amount: number, index: number, count: number) => void;
  onMergeEnergyTokenArrive?: (amount: number, index: number, count: number) => void;
}) {
  const tokenAmounts = splitEnergyAcrossTokens(feed.energyAmount ?? 0, REWARD_TOKEN_MAX_COUNT);
  const mergeTokenAmounts = splitEnergyAcrossTokens(feed.mergeEnergyAmount ?? 0, REWARD_TOKEN_MAX_COUNT);
  const hasEnergyPayout = tokenAmounts.length > 0;
  const hasMergeEnergyPayout = mergeTokenAmounts.length > 0 && feed.energyToX != null && feed.energyToY != null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {!feed.energyOnly ? (
        <SourceMote feed={feed} completesFeed={!hasEnergyPayout && !hasMergeEnergyPayout} onArrive={onArrive} />
      ) : null}
      {tokenAmounts.map((amount, index) => (
        <EnergyToken
          amount={amount}
          completesFeed={!hasMergeEnergyPayout && index === tokenAmounts.length - 1}
          count={tokenAmounts.length}
          destination="egg"
          feed={feed}
          index={index}
          key={`${feed.nonce}:energy:${index}`}
          onArrive={onArrive}
          onEnergyTokenArrive={onEnergyTokenArrive}
        />
      ))}
      {hasMergeEnergyPayout ? mergeTokenAmounts.map((amount, index) => <EnergyToken
        amount={amount}
        completesFeed={index === mergeTokenAmounts.length - 1}
        count={mergeTokenAmounts.length}
        destination="currency"
        feed={feed}
        index={index}
        key={`${feed.nonce}:merge-energy:${index}`}
        onArrive={onArrive}
        onEnergyTokenArrive={onMergeEnergyTokenArrive}
      />) : null}
      {feed.energyOnly && !hasEnergyPayout && !hasMergeEnergyPayout ? <ImmediateArrival onArrive={onArrive} /> : null}
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

function EnergyToken({ amount, completesFeed = false, count, destination, feed, index, onArrive, onEnergyTokenArrive }: {
  amount: number;
  completesFeed?: boolean;
  count: number;
  destination: 'currency' | 'egg';
  feed: EggFeed;
  index: number;
  onArrive?: () => void;
  onEnergyTokenArrive?: (amount: number, index: number, count: number) => void;
}) {
  const start = { x: feed.currencyFromX ?? feed.fromX, y: feed.currencyFromY ?? feed.fromY };
  const target = destination === 'currency'
    ? { x: feed.energyToX ?? feed.toX, y: feed.energyToY ?? feed.toY }
    : { x: feed.toX, y: feed.toY };

  return (
    <RewardTokenFlight
      count={count}
      from={start}
      index={index}
      onArrive={() => {
        onEnergyTokenArrive?.(amount, index, count);
        if (completesFeed) onArrive?.();
      }}
      to={target}
      tokenSize={TOKEN_SIZE}>
      <Image contentFit="contain" source={GAME_CURRENCY_ART.energy} style={styles.energyTokenArt} transition={0} />
    </RewardTokenFlight>
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
  energyTokenArt: {
    height: '100%',
    width: '100%',
  },
});
