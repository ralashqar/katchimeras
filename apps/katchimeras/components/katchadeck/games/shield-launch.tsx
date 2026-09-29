import { memo, useEffect } from 'react';
import { Image } from 'expo-image';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { mergeWorldItemArt } from '@/constants/merge-world-art';

/** One owner for the armed shield: wind-up, recoil, then a one-cell homing lunge. */
export const ShieldLaunch = memo(function ShieldLaunch({ definitionId, left, top, size, dx, dy, elapsed, duration, paused, reduceMotion }: {
  definitionId: string; left: number; top: number; size: number; dx: number; dy: number;
  elapsed: number; duration: number; paused: boolean; reduceMotion: boolean;
}) {
  const progress = useSharedValue(Math.min(1, elapsed / duration));
  useEffect(() => {
    cancelAnimation(progress);
    if (!paused) progress.value = withTiming(1, { duration: Math.max(0, duration * (1 - progress.value)), easing: Easing.linear });
    return () => cancelAnimation(progress);
  }, [paused, duration, progress]);
  const sprite = useAnimatedStyle(() => {
    const p = progress.value;
    const launch = Math.max(0, (p - 0.68) / 0.32);
    const wind = Math.min(1, p / 0.68);
    return { opacity: p > 0.94 ? Math.max(0.15, (1 - p) / 0.06) : 1, transform: [
      { translateX: reduceMotion ? 0 : dx * launch * launch + (launch ? 0 : Math.sin(wind * Math.PI * 8) * wind * 2) },
      { translateY: reduceMotion ? 0 : dy * launch * launch + Math.sin(wind * Math.PI) * size * 0.08 },
      { scaleX: reduceMotion ? 1 : launch ? 1 - launch * 0.25 : 1 + wind * 0.2 },
      { scaleY: reduceMotion ? 1 : launch ? 1 + launch * 0.35 : 1 - wind * 0.22 },
    ] };
  });
  const glow = useAnimatedStyle(() => ({ opacity: reduceMotion ? 0.3 : Math.sin(progress.value * Math.PI) * 0.65,
    transform: [{ scale: reduceMotion ? 1 : 1.25 - progress.value * 0.4 }] }));
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', left, top, width: size, height: size, zIndex: 111 }}>
    <Animated.View style={[{ position: 'absolute', inset: 2, borderRadius: size, borderWidth: 3, borderColor: '#FFE4A0', backgroundColor: '#D7F99D77' }, glow]} />
    <Animated.View style={[{ width: size, height: size }, sprite]}>
      <Image source={mergeWorldItemArt(definitionId)} contentFit="contain" transition={0} style={{ width: size, height: size }} />
    </Animated.View>
  </Animated.View>;
});
