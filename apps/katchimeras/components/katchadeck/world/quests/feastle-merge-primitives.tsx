import { Image } from 'expo-image';
import { memo, type ReactNode, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { FEASTLE_MERGE_ART } from '@/constants/feastle-merge-art';
import { Lantern } from '@/constants/theme';

export type FeastleMergeFlightKind = 'move' | 'swap' | 'spawn' | 'merge' | 'serve';

export const FeastleMergeItemArt = memo(function FeastleMergeItemArt({ artKey, tier, color, size, bare = false }: {
  artKey: string;
  tier: number;
  color: string;
  size: number;
  bare?: boolean;
}) {
  const source = FEASTLE_MERGE_ART[artKey] ?? FEASTLE_MERGE_ART.pantry;
  return <View style={[
    styles.foodArt,
    { height: size, width: size },
    bare ? styles.foodArtBare : { backgroundColor: `${color}20`, borderColor: `${color}55` },
  ]}>
    <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" recyclingKey={`feastle-merge-${artKey}`} source={source} style={[styles.foodImage, bare && styles.foodImageBare]} transition={0} />
    <View style={[styles.tierBadge, { backgroundColor: color }]}><ThemedText darkColor={Lantern.emberInk} lightColor={Lantern.emberInk} style={styles.tierText}>{tier}</ThemedText></View>
  </View>;
});

export function FeastleMergeFlight({ children, startX, startY, endX, endY, kind, reduceMotion, size, durationMs, arcHeight = 0, onComplete }: {
  children: ReactNode;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  kind: FeastleMergeFlightKind;
  reduceMotion: boolean;
  size: number;
  durationMs?: number;
  arcHeight?: number;
  onComplete: () => void;
}) {
  const progress = useSharedValue(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const finish = useCallback(() => onCompleteRef.current(), []);
  useEffect(() => {
    const defaultDuration = kind === 'merge' ? 185 : kind === 'swap' ? 285 : kind === 'spawn' ? 300 : kind === 'move' ? 155 : 155;
    progress.value = withTiming(1, {
      duration: reduceMotion ? 1 : durationMs ?? defaultDuration,
      easing: kind === 'spawn'
        ? Easing.bezier(0.20, 0.78, 0.24, 1)
        : Easing.bezier(0.22, 1, 0.36, 1),
    }, (finished) => {
      if (finished) runOnJS(finish)();
    });
  }, [durationMs, finish, kind, progress, reduceMotion]);
  const style = useAnimatedStyle(() => {
    const value = progress.value;
    const linearY = interpolate(value, [0, 1], [startY, endY]);
    const jump = kind === 'spawn' ? Math.sin(Math.PI * value) * arcHeight : 0;
    const scale = kind === 'merge'
      ? interpolate(value, [0, 0.72, 1], [1.035, 0.94, 0.42])
      : kind === 'spawn'
        ? interpolate(value, [0, 0.24, 0.82, 1], [0.68, 1.13, 1.025, 1])
        : interpolate(value, [0, 0.82, 1], [1.035, 1.012, 1]);
    return {
      opacity: kind === 'merge'
        ? interpolate(value, [0, 0.72, 1], [1, 1, 0])
        : kind === 'serve' ? interpolate(value, [0, 1], [1, 0]) : 1,
      transform: [
        { translateX: interpolate(value, [0, 1], [startX, endX]) },
        { translateY: linearY - jump },
        { scale },
        { rotate: kind === 'spawn' ? `${interpolate(value, [0, 1], [-7, 0])}deg` : '0deg' },
      ],
    };
  });
  return <Animated.View pointerEvents="none" renderToHardwareTextureAndroid shouldRasterizeIOS style={[styles.flight, { height: size, width: size }, style]}>{children}</Animated.View>;
}

export function FeastleMergeCelebration({ size }: { size: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [progress]);
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.18, 0.72, 1], [0, 0.92, 0.38, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.42, 1.48]) }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.12, 0.8, 1], [0, 1, 0.45, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 0.35, 1], [0.55, 1.04, 1.34]) }],
  }));
  return <Animated.View entering={FadeIn.duration(40)} exiting={FadeOut.duration(80)} pointerEvents="none" style={styles.burst}>
    <Animated.View style={[styles.mergeHalo, { height: size * 0.86, width: size * 0.86 }, haloStyle]} />
    <Animated.View style={[styles.mergeRing, { height: size * 0.72, width: size * 0.72 }, ringStyle]} />
    {[0, 1, 2, 3, 4, 5].map((index) => <MergeParticle index={index} key={index} progress={progress} />)}
  </Animated.View>;
}

function MergeParticle({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const angle = (Math.PI * 2 * index) / 6;
  const style = useAnimatedStyle(() => {
    const travel = interpolate(progress.value, [0, 1], [4, 31]);
    return {
      opacity: interpolate(progress.value, [0, 0.22, 1], [0, 1, 0]),
      transform: [
        { translateX: Math.cos(angle) * travel },
        { translateY: Math.sin(angle) * travel },
        { scale: interpolate(progress.value, [0, 0.3, 1], [0.4, 1, 0.3]) },
      ],
    };
  });
  return <Animated.View style={[styles.crumb, style]} />;
}

const styles = StyleSheet.create({
  burst: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  crumb: { backgroundColor: '#FFE1AE', borderRadius: 999, boxShadow: '0 1px 4px rgba(255,195,107,0.42)', height: 5, position: 'absolute', width: 5 },
  flight: { alignItems: 'center', justifyContent: 'center', left: 0, position: 'absolute', top: 0, zIndex: 3000 },
  foodArt: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, justifyContent: 'center' },
  foodArtBare: { backgroundColor: 'transparent', borderRadius: 0, borderWidth: 0 },
  foodImage: { height: '96%', width: '96%' },
  foodImageBare: { height: '100%', width: '100%' },
  mergeHalo: { backgroundColor: 'rgba(255,195,107,0.30)', borderRadius: 999, position: 'absolute' },
  mergeRing: { borderColor: 'rgba(255,225,174,0.92)', borderRadius: 999, borderWidth: 2, position: 'absolute' },
  tierBadge: { alignItems: 'center', borderColor: 'rgba(91,51,25,0.42)', borderRadius: 999, borderWidth: 1, bottom: 2, height: 18, justifyContent: 'center', position: 'absolute', right: 2, width: 18 },
  tierText: { fontSize: 9, fontVariant: ['tabular-nums'], fontWeight: '900', height: 16, includeFontPadding: false, lineHeight: 16, textAlign: 'center', textAlignVertical: 'center', width: 16 },
});
