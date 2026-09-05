import { BlurMask, Canvas, Group, RoundedRect, SweepGradient, vec } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const DEFAULT_COLORS = [
  'rgba(255, 244, 210, 0)',
  'rgba(255, 244, 210, 0)',
  'rgba(229, 185, 91, 0.18)',
  'rgba(255, 220, 139, 0.62)',
  'rgba(255, 251, 231, 1)',
  'rgba(255, 220, 139, 0.62)',
  'rgba(229, 185, 91, 0.18)',
  'rgba(255, 244, 210, 0)',
  'rgba(255, 244, 210, 0)',
];
const DEFAULT_POSITIONS = [0, 0.27, 0.37, 0.45, 0.5, 0.55, 0.63, 0.73, 1];

export type AnimatedBorderHighlightProps = {
  borderRadius: number;
  colors?: string[];
  containerStyle?: StyleProp<ViewStyle>;
  fadeDurationMs?: number;
  glowBlur?: number;
  glowStrokeWidth?: number;
  inset?: number;
  orbitDurationMs?: number;
  pauseDurationMs?: number;
  paused?: SharedValue<number>;
  positions?: number[];
  staticAngle?: number;
  strokeWidth?: number;
};

/**
 * A non-interactive rim light for rounded cards and buttons. The highlight
 * fades in while beginning an orbit, fades out while completing it, pauses,
 * then repeats. Its parent should use `position: 'relative'`.
 */
export function AnimatedBorderHighlight({
  borderRadius,
  colors = DEFAULT_COLORS,
  containerStyle,
  fadeDurationMs = 300,
  glowBlur = 2.4,
  glowStrokeWidth = 3,
  inset = 2,
  orbitDurationMs = 3000,
  pauseDurationMs = 1000,
  paused,
  positions = DEFAULT_POSITIONS,
  staticAngle = 0.1,
  strokeWidth = 1.25,
}: AnimatedBorderHighlightProps) {
  const orbitDuration = Math.max(1, orbitDurationMs);
  const pauseDuration = Math.max(0, pauseDurationMs);
  const fadeDuration = Math.min(Math.max(0, fadeDurationMs), orbitDuration / 2);
  const cycleDuration = orbitDuration + pauseDuration;
  const progress = useSharedValue(0);
  const [size, setSize] = useState({ height: 0, width: 0 });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    progress.value = 0;
    if (!reduceMotion) {
      progress.value = withRepeat(withTiming(1, { duration: cycleDuration, easing: Easing.linear }), -1);
    }
    return () => cancelAnimation(progress);
  }, [cycleDuration, progress, reduceMotion]);

  useAnimatedReaction(
    () => paused?.value ?? 0,
    (isPaused, wasPaused) => {
      if (isPaused === wasPaused || reduceMotion) return;
      cancelAnimation(progress);
      if (isPaused === 0) progress.value = withRepeat(withTiming(1, { duration: cycleDuration, easing: Easing.linear }), -1);
    },
    [cycleDuration, reduceMotion],
  );

  const gradientTransform = useDerivedValue(() => {
    if (reduceMotion) return [{ rotate: staticAngle * Math.PI * 2 }];
    const elapsed = progress.value * cycleDuration;
    const orbitProgress = Math.min(elapsed / orbitDuration, 1);
    return [{ rotate: orbitProgress * Math.PI * 2 }];
  });
  const rimOpacity = useDerivedValue(() => {
    if (reduceMotion) return 1;
    const elapsed = progress.value * cycleDuration;
    if (fadeDuration === 0) return elapsed < orbitDuration ? 1 : 0;
    if (elapsed < fadeDuration) return elapsed / fadeDuration;
    const fadeOutStartsAt = orbitDuration - fadeDuration;
    if (elapsed < fadeOutStartsAt) return 1;
    if (elapsed < orbitDuration) return 1 - (elapsed - fadeOutStartsAt) / fadeDuration;
    return 0;
  });

  const safeInset = Math.max(0, inset);
  const width = Math.max(0, size.width - safeInset * 2);
  const height = Math.max(0, size.height - safeInset * 2);
  const center = vec(size.width / 2, size.height / 2);
  const radius = Math.max(0, borderRadius - safeInset);
  const gradientPositions = positions.length === colors.length ? positions : undefined;

  return (
    <View
      onLayout={(event) => {
        const { height: nextHeight, width: nextWidth } = event.nativeEvent.layout;
        setSize((current) => current.height === nextHeight && current.width === nextWidth
          ? current
          : { height: nextHeight, width: nextWidth });
      }}
      pointerEvents="none"
      style={[styles.container, { borderRadius }, containerStyle]}>
      {width > 0 && height > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Group opacity={rimOpacity}>
            {glowStrokeWidth > 0 && glowBlur > 0 ? (
              <RoundedRect
                x={safeInset}
                y={safeInset}
                width={width}
                height={height}
                r={radius}
                style="stroke"
                strokeWidth={glowStrokeWidth}>
                <SweepGradient c={center} colors={colors} positions={gradientPositions} origin={center} transform={gradientTransform} />
                <BlurMask blur={glowBlur} style="solid" />
              </RoundedRect>
            ) : null}
            <RoundedRect
              x={safeInset}
              y={safeInset}
              width={width}
              height={height}
              r={radius}
              style="stroke"
              strokeWidth={strokeWidth}>
              <SweepGradient c={center} colors={colors} positions={gradientPositions} origin={center} transform={gradientTransform} />
            </RoundedRect>
          </Group>
        </Canvas>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    position: 'absolute',
    zIndex: 1,
  },
});
