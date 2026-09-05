import { type ReactNode, useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const BACKGROUND_SCALE = 1.065;
const SAFE_DRIFT_FRACTION = 0.85;
const DEFAULT_LEG_DURATION = 22_000;

/** Slow UI-thread drift for full-screen environment artwork. */
export function AmbientEnvironmentDrift({ children, paused }: { children: ReactNode; paused?: SharedValue<number> }) {
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const safeDistance = width * ((BACKGROUND_SCALE - 1) / 2) * SAFE_DRIFT_FRACTION;
  const translateX = useSharedValue(reduceMotion ? 0 : -safeDistance);

  useEffect(() => {
    cancelAnimation(translateX);
    if (reduceMotion) {
      translateX.value = 0;
      return;
    }

    translateX.value = -safeDistance;
    translateX.value = withRepeat(
      withTiming(safeDistance, {
        duration: DEFAULT_LEG_DURATION,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );

    return () => cancelAnimation(translateX);
  }, [reduceMotion, safeDistance, translateX]);

  useAnimatedReaction(
    () => paused?.value ?? 0,
    (isPaused, wasPaused) => {
      if (isPaused === wasPaused || reduceMotion) return;
      cancelAnimation(translateX);
      if (isPaused === 0) {
        translateX.value = withRepeat(
          withTiming(safeDistance, { duration: DEFAULT_LEG_DURATION, easing: Easing.inOut(Easing.sin) }),
          -1,
          true,
        );
      }
    },
    [reduceMotion, safeDistance],
  );

  const driftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, driftStyle]}>
      <View style={styles.overscannedArtwork}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overscannedArtwork: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: BACKGROUND_SCALE }],
  },
});
