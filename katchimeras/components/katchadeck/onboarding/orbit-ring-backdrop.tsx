import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { BlurMask, Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';

import type { HeroArcLayer } from '@/constants/onboarding-hero';

type OrbitRingBackdropProps = {
  size: number;
  layers: readonly HeroArcLayer[];
  delay?: number;
};

export function OrbitRingBackdrop({ size, layers, delay = 0 }: OrbitRingBackdropProps) {
  const center = size / 2;
  const fade = useSharedValue(0);

  useEffect(() => {
    fade.value = withDelay(delay, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [delay, fade]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: 0.96 + fade.value * 0.04 }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.shell, { height: size, width: size }, fadeStyle]}>
      <Canvas style={{ height: size, width: size }}>
        <Circle color="rgba(200,216,255,0.12)" cx={center} cy={center} r={size * 0.18}>
          <BlurMask blur={24} style="solid" />
        </Circle>
        <Circle color="rgba(106,95,232,0.08)" cx={center} cy={center} r={size * 0.34}>
          <BlurMask blur={36} style="solid" />
        </Circle>
      </Canvas>
      {layers.map((layer) => (
        <RotatingArcLayer key={layer.id} layer={layer} size={size} />
      ))}
    </Animated.View>
  );
}

function RotatingArcLayer({ size, layer }: { size: number; layer: HeroArcLayer }) {
  const rotation = useSharedValue(0);
  const paths = useMemo(() => {
    const center = size / 2;
    const rect = Skia.XYWHRect(center - layer.radius, center - layer.radius, layer.radius * 2, layer.radius * 2);

    return layer.segmentStarts.map((segmentStart) => {
      const path = Skia.Path.Make();
      path.addArc(rect, segmentStart, layer.sweepSize);
      return path;
    });
  }, [layer.radius, layer.segmentStarts, layer.sweepSize, size]);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: layer.rotationDuration,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [layer.rotationDuration, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: layer.opacity,
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.arcLayer, { height: size, width: size }, animatedStyle]}>
      <Canvas style={{ height: size, width: size }}>
        {paths.map((path, index) => (
          <Path
            color={layer.color}
            key={`${layer.id}-${index}`}
            path={path}
            strokeCap="round"
            strokeWidth={layer.strokeWidth}
            style="stroke"
          />
        ))}
      </Canvas>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  arcLayer: {
    position: 'absolute',
  },
});
