import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { KatchaDeckUI } from '@/constants/theme';

type ProgressBarProps = {
  current: number;
  total: number;
  color?: string;
  trackColor?: string;
  minimumPercent?: number;
  variant?: 'flat' | 'egg';
};

export function ProgressBar({ current, total, color, trackColor, minimumPercent = 6, variant = 'flat' }: ProgressBarProps) {
  const progress = useSharedValue(total > 0 ? Math.min(1, Math.max(0, current / total)) : 0);

  useEffect(() => {
    progress.value = withTiming(total > 0 ? Math.min(1, Math.max(0, current / total)) : 0, {
      duration: KatchaDeckUI.motion.base,
    });
  }, [current, progress, total]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.min(100, Math.max(progress.value * 100, minimumPercent))}%`,
  }));

  return (
    <View style={[styles.track, variant === 'egg' && styles.eggTrack, trackColor ? { backgroundColor: trackColor } : undefined]}>
      <Animated.View style={[styles.fill, variant === 'egg' && styles.eggFill, color ? { backgroundColor: color } : undefined, fillStyle]} />
      {variant === 'egg' ? <View pointerEvents="none" style={styles.eggShine} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Compact version of the legacy GrowthMeter above the egg.
  eggTrack: {
    height: 12, borderWidth: 1.5, borderColor: 'rgba(255,239,196,0.72)',
    backgroundColor: 'rgba(31,27,19,0.72)',
    boxShadow: '0 2px 4px rgba(20,16,9,0.24), inset 0 1px 3px rgba(0,0,0,0.30)',
  },
  eggFill: { backgroundColor: '#82B94D' },
  eggShine: {
    position: 'absolute', top: 1, left: 3, right: 3, height: 2.5,
    borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.25)',
  },
  track: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 6,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    backgroundColor: '#C8D8FF',
    borderRadius: 999,
    height: '100%',
  },
});
