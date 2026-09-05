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
};

export function ProgressBar({ current, total, color, trackColor, minimumPercent = 6 }: ProgressBarProps) {
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
    <View style={[styles.track, trackColor ? { backgroundColor: trackColor } : undefined]}>
      <Animated.View style={[styles.fill, color ? { backgroundColor: color } : undefined, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
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
