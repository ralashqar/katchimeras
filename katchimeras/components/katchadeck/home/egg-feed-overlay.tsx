import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';

// A single "feeding" flight: the essence of the answer the user tapped — a
// tinted mote carrying a word, or a small photo — arcs up from the chip and is
// drawn down into the egg, accelerating as it lands so it reads as absorbed. A
// short comet trail of fading sparks follows the same arc just behind it.
export type EggFeed = {
  nonce: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  label?: string;
  photoUri?: string;
  tint: string;
};

type EggFeedOverlayProps = {
  feed: EggFeed | null;
  onArrive: () => void;
};

const FLIGHT_MS = 560;
const ARC_LIFT = 52;
const SPARK_COUNT = 5;
const SPARK_LAG = 0.07;

export function EggFeedOverlay({ feed, onArrive }: EggFeedOverlayProps) {
  if (!feed) {
    return null;
  }
  return <FeedMote key={feed.nonce} feed={feed} onArrive={onArrive} />;
}

// The arced flight path, shared by the mote and every trailing spark so the
// trail rides exactly behind the mote.
function pathPoint(feed: EggFeed, p: number) {
  'worklet';
  const clamped = Math.max(0, Math.min(1, p));
  return {
    cx: feed.fromX + (feed.toX - feed.fromX) * clamped,
    cy: feed.fromY + (feed.toY - feed.fromY) * clamped - Math.sin(Math.PI * clamped) * ARC_LIFT,
  };
}

function FeedMote({ feed, onArrive }: { feed: EggFeed; onArrive: () => void }) {
  const progress = useSharedValue(0);
  const isPhoto = !!feed.photoUri;
  const [dims, setDims] = useState({ w: isPhoto ? 64 : 120, h: isPhoto ? 64 : 40 });

  useEffect(() => {
    progress.value = withTiming(
      1,
      // Ease IN so the mote speeds up as it reaches the egg — a "drawn in" feel.
      { duration: FLIGHT_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(onArrive)();
        }
      }
    );
  }, [onArrive, progress]);

  const moteStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const { cx, cy } = pathPoint(feed, p);
    const scale = 1 - 0.64 * p;
    const opacity = p < 0.82 ? 1 : Math.max(0, 1 - (p - 0.82) / 0.18);
    return {
      opacity,
      transform: [{ translateX: cx - dims.w / 2 }, { translateY: cy - dims.h / 2 }, { scale }],
    };
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: SPARK_COUNT }).map((_, index) => (
        <Spark key={index} feed={feed} progress={progress} index={index} />
      ))}
      <Animated.View
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width && height) setDims({ w: width, h: height });
        }}
        style={[
          styles.mote,
          isPhoto
            ? styles.photoMote
            : { backgroundColor: `${feed.tint}E6`, boxShadow: `0 0 22px ${feed.tint}AA` },
          moteStyle,
        ]}>
        {isPhoto ? (
          <Image contentFit="cover" source={{ uri: feed.photoUri }} style={styles.photo} transition={0} />
        ) : (
          <ThemedText style={styles.label} lightColor={Lantern.ink900} darkColor={Lantern.ink900} numberOfLines={1}>
            {feed.label}
          </ThemedText>
        )}
      </Animated.View>
    </View>
  );
}

// One trailing spark — a small tinted dot that follows the flight path a few
// frames behind the mote and shrinks/fades the further back it is.
function Spark({ feed, progress, index }: { feed: EggFeed; progress: SharedValue<number>; index: number }) {
  const size = 13 - index * 1.6;
  const trail = (index + 1) * SPARK_LAG;

  const sparkStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const { cx, cy } = pathPoint(feed, p - trail);
    // Hidden before launch and once the head has landed; brightest mid-flight.
    const visible = p > trail && p < 0.92 ? 1 : 0;
    const fade = (1 - index / SPARK_COUNT) * 0.7;
    return {
      opacity: visible * fade,
      transform: [{ translateX: cx - size / 2 }, { translateY: cy - size / 2 }, { scale: 1 - 0.4 * p }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.spark,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: feed.tint, boxShadow: `0 0 10px ${feed.tint}` },
        sparkStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
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
    boxShadow: '0 0 24px rgba(255,195,107,0.7)',
    height: 64,
    overflow: 'hidden',
    padding: 0,
    width: 64,
  },
  photo: {
    height: '100%',
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
  },
  spark: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
});
