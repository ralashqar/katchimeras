import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';
import type { GoalTaskSourceRect } from './goal-task-row';

export function BondRewardFlightOverlay({ from, onFinish, onTokenArrive, points, to }: {
  from: GoalTaskSourceRect;
  onFinish: () => void;
  onTokenArrive?: (amount: number, index: number, count: number) => void;
  points: number;
  to: GoalTaskSourceRect;
}) {
  const reduceMotion = useReducedMotion();
  const count = reduceMotion ? 1 : Math.min(5, Math.max(1, points));
  const amounts = useMemo(() => Array.from({ length: count }, (_, index) =>
    Math.floor(points / count) + (index < points % count ? 1 : 0)
  ), [count, points]);

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(120)} style={[styles.rewardLabel, {
        left: from.x + from.width / 2 - 46,
        top: from.y + from.height / 2 - 21,
      }]}>
        <IconSymbol color="#FFF8E7" name="heart.fill" size={15} />
        <ThemedText style={styles.points} lightColor="#FFF8E7" darkColor="#FFF8E7">+{points} Bond</ThemedText>
      </Animated.View>
      {amounts.map((amount, index) => (
        <BondHeartToken
          amount={amount}
          count={count}
          from={from}
          index={index}
          key={`${index}:${amount}`}
          onArrive={() => {
            onTokenArrive?.(amount, index, count);
            if (process.env.EXPO_OS === 'ios') {
              void Haptics.impactAsync(index === count - 1
                ? Haptics.ImpactFeedbackStyle.Medium
                : index >= Math.ceil(count / 2)
                  ? Haptics.ImpactFeedbackStyle.Light
                  : Haptics.ImpactFeedbackStyle.Soft);
              if (index === count - 1) setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft), 170);
            }
            if (index === count - 1) onFinish();
          }}
          reduceMotion={reduceMotion}
          to={to}
        />
      ))}
    </View>
  );
}

function BondHeartToken({ count, from, index, onArrive, reduceMotion, to }: {
  amount: number;
  count: number;
  from: GoalTaskSourceRect;
  index: number;
  onArrive: () => void;
  reduceMotion: boolean;
  to: GoalTaskSourceRect;
}) {
  const progress = useSharedValue(0);
  const onArriveRef = useRef(onArrive);
  onArriveRef.current = onArrive;
  const arrive = useCallback(() => onArriveRef.current(), []);
  const startX = from.x + from.width / 2 - 14 + (index - (count - 1) / 2) * 7;
  const startY = from.y + from.height / 2 - 14;
  const endX = to.x + to.width / 2 - 14;
  const endY = to.y + to.height * 0.42 - 14;

  useEffect(() => {
    progress.value = withDelay(reduceMotion ? 0 : index * 92, withTiming(1, {
      duration: reduceMotion ? 220 : 620,
      easing: Easing.inOut(Easing.cubic),
    }, (finished) => {
      if (finished) runOnJS(arrive)();
    }));
  }, [arrive, index, progress, reduceMotion]);

  const tokenStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const arc = reduceMotion ? 0 : -Math.sin(p * Math.PI) * (62 + index * 7);
    return {
      opacity: interpolate(p, [0, 0.08, 0.84, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: interpolate(p, [0, 1], [startX, endX]) },
        { translateY: interpolate(p, [0, 1], [startY, endY]) + arc },
        { rotate: `${interpolate(p, [0, 1], [-12 + index * 5, 16 - index * 3])}deg` },
        { scale: interpolate(p, [0, 0.2, 0.82, 1], [0.66, 1, 0.9, 0.45]) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.token, tokenStyle]}>
      <IconSymbol color="#FFF8E7" name="heart.fill" size={17} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rewardLabel: {
    alignItems: 'center', backgroundColor: '#5E8C58', borderColor: '#F5D887', borderRadius: 999,
    borderWidth: 2, boxShadow: '0 5px 14px rgba(36,60,31,0.34)', flexDirection: 'row', gap: 5,
    height: 42, justifyContent: 'center', position: 'absolute', width: 92,
  },
  points: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '900' },
  token: {
    alignItems: 'center', backgroundColor: '#A95043', borderColor: '#F5D887', borderRadius: 999,
    borderWidth: 2, boxShadow: '0 4px 10px rgba(92,42,35,0.3)', height: 28, justifyContent: 'center',
    left: 0, position: 'absolute', top: 0, width: 28,
  },
});
