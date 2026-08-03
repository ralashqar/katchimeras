import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';
import type { GoalTaskSourceRect } from './goal-task-row';

export function BondRewardFlightOverlay({
  from,
  onFinish,
  points,
  to,
}: {
  from: GoalTaskSourceRect;
  onFinish: () => void;
  points: number;
  to: GoalTaskSourceRect;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const startX = from.x + from.width / 2 - 23;
  const startY = from.y + from.height / 2 - 23;
  const endX = to.x + to.width / 2 - 23;
  const endY = to.y + to.height * 0.42 - 23;

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: reduceMotion ? 260 : 620,
      easing: Easing.inOut(Easing.cubic),
    }, (finished) => {
      if (finished) runOnJS(onFinish)();
    });
  }, [onFinish, progress, reduceMotion]);

  const moteStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const arc = reduceMotion ? 0 : -Math.sin(p * Math.PI) * 72;
    return {
      opacity: interpolate(p, [0, 0.1, 0.82, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: interpolate(p, [0, 1], [startX, endX]) },
        { translateY: interpolate(p, [0, 1], [startY, endY]) + arc },
        { scale: interpolate(p, [0, 0.15, 0.8, 1], [0.78, 1, 0.92, 0.6]) },
      ],
    };
  });
  const arrivalStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.78, 0.9, 1], [0, 0, 0.85, 0]),
    transform: [
      { translateX: endX - 17 },
      { translateY: endY - 17 },
      { scale: interpolate(progress.value, [0.78, 1], [0.55, 2.15]) },
    ],
  }));

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.arrival, arrivalStyle]} />
      <Animated.View style={[styles.mote, moteStyle]}>
        <IconSymbol color="#FFF8E7" name="heart.fill" size={16} />
        <ThemedText style={styles.points} lightColor="#FFF8E7" darkColor="#FFF8E7">+{points}</ThemedText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  mote: {
    alignItems: 'center', backgroundColor: '#5E8C58', borderColor: '#F5D887', borderRadius: 999,
    borderWidth: 2, boxShadow: '0 5px 14px rgba(36,60,31,0.34)', flexDirection: 'row', gap: 3,
    height: 46, justifyContent: 'center', left: 0, position: 'absolute', top: 0, width: 46,
  },
  points: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, fontWeight: '900' },
  arrival: {
    borderColor: 'rgba(245,216,135,0.9)', borderRadius: 999, borderWidth: 3, height: 80,
    left: 0, position: 'absolute', top: 0, width: 80,
  },
});
