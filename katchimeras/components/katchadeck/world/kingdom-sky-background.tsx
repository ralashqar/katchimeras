import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  KINGDOM_SKY_LAYERS,
  kingdomSkyMotionEnabled,
  type KingdomSkyLayerId,
  wrapKingdomCloudX,
} from '@/utils/kingdom-sky';

const CLOUDS = {
  farBank: require('../../../assets/images/katchimeras/world/sky/kingdom-cloud-far-bank-512.webp'),
  midWide: require('../../../assets/images/katchimeras/world/sky/kingdom-cloud-mid-wide-512.webp'),
  midTall: require('../../../assets/images/katchimeras/world/sky/kingdom-cloud-mid-tall-512.webp'),
  nearBank: require('../../../assets/images/katchimeras/world/sky/kingdom-cloud-near-bank-1024.webp'),
} as const;

type SkyCamera = {
  originX: SharedValue<number>;
  originY: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
};

type Props = {
  camera: SkyCamera;
  viewport: { height: number; width: number };
};

type CloudProps = {
  baseX: number;
  baseY: number;
  camera: SkyCamera;
  layer: KingdomSkyLayerId;
  opacity: number;
  parallaxEnabled: boolean;
  progress: SharedValue<number>;
  source: number;
  viewport: Props['viewport'];
  widthRatio: number;
  mirrored?: boolean;
};

const Cloud = memo(function Cloud({
  baseX,
  baseY,
  camera,
  layer,
  mirrored = false,
  opacity,
  parallaxEnabled,
  progress,
  source,
  viewport,
  widthRatio,
}: CloudProps) {
  const cloudWidth = viewport.width * widthRatio;
  const overscan = viewport.width * 0.14;
  const settings = KINGDOM_SKY_LAYERS[layer];
  const animatedStyle = useAnimatedStyle(() => {
    const cameraX = parallaxEnabled
      ? (camera.translateX.value - camera.originX.value) * settings.horizontalParallax
      : 0;
    const cameraY = parallaxEnabled
      ? (camera.translateY.value - camera.originY.value) * settings.verticalParallax
      : 0;
    const span = viewport.width + cloudWidth + overscan * 2;
    const x = wrapKingdomCloudX(baseX * viewport.width + progress.value * span + cameraX, viewport.width, cloudWidth, overscan);
    return {
      opacity,
      transform: [
        { translateX: x },
        { translateY: baseY * viewport.height + cameraY },
        { scaleX: mirrored ? -1 : 1 },
      ],
    };
  }, [baseX, baseY, cloudWidth, mirrored, opacity, overscan, parallaxEnabled, settings.horizontalParallax, settings.verticalParallax, viewport.height, viewport.width]);

  return (
    <Animated.View style={[styles.cloud, { height: cloudWidth, width: cloudWidth }, animatedStyle]}>
      <Image contentFit="contain" source={source} style={StyleSheet.absoluteFill} transition={0} />
    </Animated.View>
  );
});

export const KingdomSkyBackground = memo(function KingdomSkyBackground({ camera, viewport }: Props) {
  const isFocused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === 'active');
  const farProgress = useSharedValue(0);
  const middleProgress = useSharedValue(0);
  const nearProgress = useSharedValue(0);
  const motionEnabled = kingdomSkyMotionEnabled(isFocused, appIsActive, reduceMotion);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppIsActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const values = [farProgress, middleProgress, nearProgress];
    if (!motionEnabled) {
      values.forEach(cancelAnimation);
      return;
    }
    farProgress.value = withRepeat(withTiming(1, { duration: KINGDOM_SKY_LAYERS.far.durationMs, easing: Easing.linear }), -1, false);
    middleProgress.value = withRepeat(withTiming(1, { duration: KINGDOM_SKY_LAYERS.middle.durationMs, easing: Easing.linear }), -1, false);
    nearProgress.value = withRepeat(withTiming(1, { duration: KINGDOM_SKY_LAYERS.near.durationMs, easing: Easing.linear }), -1, false);
    return () => values.forEach(cancelAnimation);
  }, [farProgress, middleProgress, motionEnabled, nearProgress]);

  return (
    <View pointerEvents="none" style={styles.root}>
      <LinearGradient colors={['#2379C6', '#55A9E2', '#BFEAF6']} locations={[0, 0.56, 1]} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']} start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0.18 }} style={StyleSheet.absoluteFill} />
      {viewport.width > 0 && viewport.height > 0 ? (
        <>
          <Cloud baseX={-0.36} baseY={0.08} camera={camera} layer="far" opacity={1} parallaxEnabled={motionEnabled} progress={farProgress} source={CLOUDS.farBank} viewport={viewport} widthRatio={0.62} />
          <Cloud baseX={0.52} baseY={0.43} camera={camera} layer="far" mirrored opacity={1} parallaxEnabled={motionEnabled} progress={farProgress} source={CLOUDS.farBank} viewport={viewport} widthRatio={0.56} />
          <Cloud baseX={0.58} baseY={0.04} camera={camera} layer="middle" opacity={1} parallaxEnabled={motionEnabled} progress={middleProgress} source={CLOUDS.midTall} viewport={viewport} widthRatio={0.46} />
          <Cloud baseX={-0.25} baseY={0.34} camera={camera} layer="middle" mirrored opacity={1} parallaxEnabled={motionEnabled} progress={middleProgress} source={CLOUDS.midWide} viewport={viewport} widthRatio={0.58} />
          <Cloud baseX={0.62} baseY={0.66} camera={camera} layer="middle" opacity={1} parallaxEnabled={motionEnabled} progress={middleProgress} source={CLOUDS.midWide} viewport={viewport} widthRatio={0.54} />
          <Cloud baseX={-0.46} baseY={0.72} camera={camera} layer="near" opacity={1} parallaxEnabled={motionEnabled} progress={nearProgress} source={CLOUDS.nearBank} viewport={viewport} widthRatio={0.9} />
          <Cloud baseX={0.72} baseY={0.51} camera={camera} layer="near" mirrored opacity={1} parallaxEnabled={motionEnabled} progress={nearProgress} source={CLOUDS.nearBank} viewport={viewport} widthRatio={0.84} />
        </>
      ) : null}
    </View>
  );
});

// Surfaces outside the pannable Kingdom map can share the exact sky direction
// and autonomous cloud drift without inventing a fake gesture camera. Shared
// values remain stable for the lifetime of the screen, so the sky never resets
// when the Today content changes.
export function StaticKingdomSkyBackground() {
  const { height, width } = useWindowDimensions();
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const camera = useMemo(
    () => ({ originX, originY, translateX, translateY }),
    [originX, originY, translateX, translateY],
  );
  const viewport = useMemo(() => ({ height, width }), [height, width]);

  return <KingdomSkyBackground camera={camera} viewport={viewport} />;
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  cloud: { left: 0, position: 'absolute', top: 0 },
});
