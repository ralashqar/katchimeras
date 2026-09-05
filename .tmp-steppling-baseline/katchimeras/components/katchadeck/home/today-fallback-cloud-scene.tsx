import { useIsFocused } from '@react-navigation/native';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Fragment, memo, type ReactNode, useEffect, useState } from 'react';
import { AppState, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { TodayEnvironmentMotionLayer } from '@/components/katchadeck/home/today-environment-motion';
import todayScene from '@/data/today-scene.json';
import { TODAY_KINGDOM_TILE_CENTER_Y } from '@/utils/today-kingdom-hero-layout';

const CLOUDS = {
  far: require('../../../assets/images/katchimeras/world/sky/kingdom-cloud-far-bank-512.webp'),
  middle: require('../../../assets/images/katchimeras/world/sky/kingdom-cloud-mid-wide-512.webp'),
  tall: require('../../../assets/images/katchimeras/world/sky/kingdom-cloud-mid-tall-512.webp'),
  near: require('../../../assets/images/katchimeras/world/sky/kingdom-cloud-near-bank-1024.webp'),
} as const;

type CloudTrackSpec = {
  durationMs: number;
  mirrored?: boolean;
  opacity: number;
  phase: number;
  source: ImageSource;
  widthRatio: number;
  yRatio: number;
};

const REAR_TRACKS: readonly CloudTrackSpec[] = [
  {
    durationMs: 31_000,
    opacity: 1,
    phase: 0.12,
    source: CLOUDS.middle,
    widthRatio: 0.48,
    yRatio: -0.18,
  },
  {
    durationMs: 39_000,
    mirrored: true,
    opacity: 1,
    phase: 0.64,
    source: CLOUDS.tall,
    widthRatio: 0.34,
    yRatio: 0,
  },
  {
    durationMs: 47_000,
    opacity: 1,
    phase: 0.86,
    source: CLOUDS.far,
    widthRatio: 0.56,
    yRatio: -0.27,
  },
] as const;

const FRONT_TRACKS: readonly CloudTrackSpec[] = [
  {
    durationMs: 24_000,
    opacity: 1,
    phase: 0.18,
    source: CLOUDS.near,
    widthRatio: 0.78,
    yRatio: -0.22,
  },
  {
    durationMs: 33_000,
    mirrored: true,
    opacity: 1,
    phase: 0.72,
    source: CLOUDS.far,
    widthRatio: 0.6,
    yRatio: -0.27,
  },
] as const;

type TodayFallbackCloudSceneProps = {
  children: ReactNode;
  enabled?: boolean;
  environment: ReactNode;
  focusY?: number;
  frontTop: number;
  pinchStrength?: number;
};

/**
 * Adds depth only to ordinary Today hex scenes. Bespoke full-spread scenes
 * bypass this wrapper so their authored atmosphere remains untouched.
 */
export const TodayFallbackCloudScene = memo(function TodayFallbackCloudScene({
  children,
  enabled = true,
  environment,
  focusY = TODAY_KINGDOM_TILE_CENTER_Y,
  frontTop,
  pinchStrength = 1,
}: TodayFallbackCloudSceneProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const isFocused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === 'active');
  const cloudsEnabled = enabled && todayScene.homeEnvironment.cloudsEnabled;
  const motionEnabled = cloudsEnabled && isFocused && appIsActive && !reduceMotion;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppIsActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  if (!cloudsEnabled || viewportWidth <= 0) {
    return (
      <>
        <TodayEnvironmentMotionLayer focusY={focusY} pinchStrength={pinchStrength}>{environment}</TodayEnvironmentMotionLayer>
        <TodayEnvironmentMotionLayer focusY={focusY} pinchStrength={pinchStrength}>{children}</TodayEnvironmentMotionLayer>
      </>
    );
  }

  return (
    <Fragment>
      <CloudLayer
        active={motionEnabled}
        height={Math.max(150, frontTop + 18)}
        tracks={REAR_TRACKS}
        viewportWidth={viewportWidth}
      />
      <TodayEnvironmentMotionLayer focusY={focusY} pinchStrength={pinchStrength}>{environment}</TodayEnvironmentMotionLayer>
      <LinearGradient
        colors={[
          'rgba(7, 17, 38, 0.36)',
          'rgba(9, 25, 48, 0.16)',
          'rgba(255, 241, 205, 0.025)',
          'rgba(255, 244, 211, 0.075)',
        ]}
        end={{ x: 0.5, y: 1 }}
        locations={[0, 0.44, 0.76, 1]}
        pointerEvents="none"
        start={{ x: 0.5, y: 0 }}
        style={[
          styles.environmentGrade,
          {
            height: frontTop + 190,
            marginLeft: -viewportWidth / 2,
            width: viewportWidth,
          },
        ]}
      />
      <CloudLayer
        active={motionEnabled}
        foreground
        height={Math.max(180, viewportWidth * 0.44)}
        top={frontTop}
        tracks={FRONT_TRACKS}
        viewportWidth={viewportWidth}
      />
      {/* Subjects remain above the lower mist; the cloud plane masks the tile
          and stair base, not the creature or interactive egg. */}
      <TodayEnvironmentMotionLayer focusY={focusY} pinchStrength={pinchStrength}>{children}</TodayEnvironmentMotionLayer>
    </Fragment>
  );
});

type CloudLayerProps = {
  active: boolean;
  foreground?: boolean;
  height: number;
  top?: number;
  tracks: readonly CloudTrackSpec[];
  viewportWidth: number;
};

function CloudLayer({
  active,
  foreground = false,
  height,
  top = 0,
  tracks,
  viewportWidth,
}: CloudLayerProps) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.layer,
        foreground ? styles.foregroundLayer : styles.rearLayer,
        {
          height,
          marginLeft: -viewportWidth / 2,
          top,
          width: viewportWidth,
        },
      ]}>
      {tracks.map((track, index) => (
        <CloudTrack
          active={active}
          key={`${foreground ? 'front' : 'rear'}-${index}`}
          spec={track}
          viewportWidth={viewportWidth}
        />
      ))}
    </View>
  );
}

type CloudTrackProps = {
  active: boolean;
  spec: CloudTrackSpec;
  viewportWidth: number;
};

const CloudTrack = memo(function CloudTrack({ active, spec, viewportWidth }: CloudTrackProps) {
  const progress = useSharedValue(0);
  const cloudWidth = viewportWidth * spec.widthRatio;
  const travel = viewportWidth + cloudWidth;
  const baseX = -cloudWidth + spec.phase * travel;

  useEffect(() => {
    if (!active) {
      cancelAnimation(progress);
      return;
    }

    progress.value = withRepeat(
      withTiming(1, { duration: spec.durationMs, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [active, progress, spec.durationMs]);

  const motionStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * travel }],
  }), [travel]);

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, motionStyle]}>
      <CloudImage baseX={baseX} cloudWidth={cloudWidth} spec={spec} />
      {/* The preceding copy reaches the first copy's starting position at the
          exact frame progress wraps to zero, so recycling never pops. */}
      <CloudImage baseX={baseX - travel} cloudWidth={cloudWidth} spec={spec} />
    </Animated.View>
  );
});

function CloudImage({
  baseX,
  cloudWidth,
  spec,
}: {
  baseX: number;
  cloudWidth: number;
  spec: CloudTrackSpec;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.cloud,
        {
          height: cloudWidth,
          left: baseX,
          opacity: spec.opacity,
          // Keep enough transparent source padding above the first opaque
          // pixels at every screen width. The layer may clip at its measured
          // stair boundary, but the cloud silhouette itself never does.
          top: cloudWidth * spec.yRatio,
          transform: [{ scaleX: spec.mirrored ? -1 : 1 }],
          width: cloudWidth,
        },
      ]}>
      <Image
        cachePolicy="disk"
        contentFit="contain"
        pointerEvents="none"
        source={spec.source}
        style={StyleSheet.absoluteFill}
        transition={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cloud: {
    position: 'absolute',
  },
  foregroundLayer: {
    zIndex: 2,
  },
  environmentGrade: {
    left: '50%',
    position: 'absolute',
    top: -190,
    zIndex: 1,
  },
  layer: {
    left: '50%',
    overflow: 'hidden',
    position: 'absolute',
  },
  rearLayer: {
    zIndex: 0,
  },
});
