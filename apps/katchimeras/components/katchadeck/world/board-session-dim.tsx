import { memo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

/** How dark the Kingdom goes behind a docked board, and how long it takes to go dark and to come back. */
const DIM_OPACITY = 0.34;
const DIM_IN_MS = 420;
const DIM_OUT_MS = 520;

/**
 * While a mini board is docked, the Kingdom behind it (the island tile and the map) dims a little, so the board and
 * the wisps over it read clearly. It eases in when the board comes up and back out when it goes, never snapping.
 * Over the map and its markers, under the wisps over a tile (58), the docked board (60) and wisps on the board (61).
 */
export const BoardSessionDim = memo(function BoardSessionDim({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion();
  const shade = useSharedValue(0);
  useEffect(() => {
    shade.value = withTiming(active ? DIM_OPACITY : 0, { duration: reduceMotion ? 120 : active ? DIM_IN_MS : DIM_OUT_MS, easing: Easing.inOut(Easing.quad) });
  }, [active, reduceMotion, shade]);
  const style = useAnimatedStyle(() => ({ opacity: shade.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim, style]} />;
});

const styles = StyleSheet.create({
  dim: { backgroundColor: '#0B0A1C', zIndex: 50 },
});
