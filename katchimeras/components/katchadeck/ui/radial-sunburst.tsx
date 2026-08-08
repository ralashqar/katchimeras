import {
  Canvas,
  Path,
  RadialGradient as SkiaRadialGradient,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const RAY_COUNT = 16;
const WEDGE_COVERAGE = 0.56;
const PRIMARY_COLORS = [
  'rgba(255, 246, 190, 0.52)',
  'rgba(255, 237, 157, 0.42)',
  'rgba(255, 221, 112, 0.18)',
  'rgba(255, 214, 92, 0)',
];
const SECONDARY_COLORS = [
  'rgba(255, 228, 139, 0.38)',
  'rgba(255, 220, 112, 0.3)',
  'rgba(255, 207, 83, 0.12)',
  'rgba(255, 201, 69, 0)',
];

type RadialSunburstCanvasProps = {
  primaryColors?: string[];
  secondaryColors?: string[];
  size: number;
};

export const RadialSunburstCanvas = memo(function RadialSunburstCanvas({
  primaryColors = PRIMARY_COLORS,
  secondaryColors = SECONDARY_COLORS,
  size,
}: RadialSunburstCanvasProps) {
  const center = size / 2;
  const fadeRadius = size * 0.47;
  const paths = useMemo(() => {
    const radius = size * 0.5;
    const step = Math.PI * 2 / RAY_COUNT;
    const halfWedge = step * WEDGE_COVERAGE / 2;
    const nextPaths = [Skia.Path.Make(), Skia.Path.Make()];

    for (let index = 0; index < RAY_COUNT; index += 1) {
      const angle = -Math.PI / 2 + index * step;
      const path = nextPaths[index % nextPaths.length];
      path.moveTo(center, center);
      path.lineTo(
        center + Math.cos(angle - halfWedge) * radius,
        center + Math.sin(angle - halfWedge) * radius,
      );
      path.lineTo(
        center + Math.cos(angle + halfWedge) * radius,
        center + Math.sin(angle + halfWedge) * radius,
      );
      path.close();
    }

    return nextPaths;
  }, [center, size]);

  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      {paths.map((path, index) => (
        <Path key={`radial-sunburst-${index}`} path={path}>
          <SkiaRadialGradient
            c={vec(center, center)}
            colors={index === 0 ? primaryColors : secondaryColors}
            positions={[0, 0.42, 0.72, 1]}
            r={fadeRadius}
          />
        </Path>
      ))}
    </Canvas>
  );
});

export const RotatingRadialSunburst = memo(function RotatingRadialSunburst({
  baseOpacity = 0.76,
  rotationDurationMs = 32_000,
  size,
  style,
}: {
  baseOpacity?: number;
  rotationDurationMs?: number;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  const breath = useSharedValue(reduceMotion ? 0.45 : 0);

  useEffect(() => {
    cancelAnimation(rotation);
    cancelAnimation(breath);
    if (reduceMotion) {
      rotation.value = 0;
      breath.value = 0.45;
      return;
    }
    rotation.value = withRepeat(
      withTiming(1, { duration: rotationDurationMs, easing: Easing.linear }),
      -1,
      false,
    );
    breath.value = withRepeat(
      withTiming(1, { duration: 2_800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(rotation);
      cancelAnimation(breath);
    };
  }, [breath, reduceMotion, rotation, rotationDurationMs]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, baseOpacity + breath.value * 0.1),
    transform: [
      { rotate: `${rotation.value * 360}deg` },
      { scale: 0.985 + breath.value * 0.03 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
      style={[styles.field, { height: size, width: size }, style, animatedStyle]}>
      <RadialSunburstCanvas size={size} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  field: { position: 'absolute' },
});
