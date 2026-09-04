import * as Haptics from 'expo-haptics';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type View as ViewType } from 'react-native';
import type { GestureType } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GoalCompletionCelebration } from '@/components/katchadeck/goals/goal-completion-celebration';

import { DayActionCardSurface, DayActionCompletedTick } from './day-action-card';
import { DayActionActiveRow, type DayActionSourceRect } from './day-action-row';

const REWARD_REQUEST_DELAY_MS = 190;
const COMPLETION_WATCHDOG_MS = 3_200;

export function DayActionGoalRow({
  animateLayout,
  autoComplete = false,
  progress,
  accessibilityHint,
  completeOnPress = false,
  hideCompletionControl = completeOnPress,
  artwork,
  disabled = false,
  enteringEnabled = true,
  entryDelayMs,
  externalGesture,
  label,
  onBeginCompletion,
  onCompletionRequest,
  onFinished,
  onOpen,
  onSkip,
  reward,
  title,
  subtitle,
}: {
  animateLayout: boolean;
  autoComplete?: boolean;
  progress?: ReactNode;
  accessibilityHint?: string;
  completeOnPress?: boolean;
  hideCompletionControl?: boolean;
  artwork: ReactNode;
  disabled?: boolean;
  enteringEnabled?: boolean;
  entryDelayMs: number;
  externalGesture?: GestureType;
  label: string;
  onBeginCompletion?: () => void;
  onCompletionRequest: (source: DayActionSourceRect | null, onRewardArrive: () => void) => void;
  onFinished?: () => void;
  onOpen: (completeFromOrigin: () => void) => void;
  onSkip?: () => void;
  reward?: ReactNode;
  title: string;
  subtitle?: string;
}) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const rewardRef = useRef<ViewType | null>(null);
  const completionControlRef = useRef<ViewType | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completingRef = useRef(false);
  const exitFinishedRef = useRef(false);
  const rewardArrivedRef = useRef(false);
  const finishedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  const [completing, setCompleting] = useState(false);
  const [celebrationSource, setCelebrationSource] = useState<DayActionSourceRect | null>(null);
  const rowX = useSharedValue(0);
  const rowOpacity = useSharedValue(1);
  const rowScale = useSharedValue(1);
  const artX = useSharedValue(0);
  const artRotation = useSharedValue(0);
  const artScale = useSharedValue(1);
  const tickScale = useSharedValue(1);
  const chargeGlow = useSharedValue(0);

  onFinishedRef.current = onFinished;
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const motionViewportStyle = useMemo(() => ({
    marginHorizontal: -windowWidth,
    paddingHorizontal: windowWidth,
  }), [windowWidth]);
  const rowStyle = useAnimatedStyle(() => ({
    opacity: rowOpacity.value,
    transform: [{ translateX: rowX.value }, { scale: rowScale.value }],
  }));
  const artStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: artX.value },
      { rotate: `${artRotation.value}deg` },
      { scale: artScale.value },
    ],
  }));
  const tickStyle = useAnimatedStyle(() => ({ transform: [{ scale: tickScale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: chargeGlow.value,
    transform: [{ scale: 0.985 + chargeGlow.value * 0.025 }],
  }));

  const finishIfReady = useCallback(() => {
    if (finishedRef.current || !exitFinishedRef.current || !rewardArrivedRef.current) return;
    finishedRef.current = true;
    onFinishedRef.current?.();
  }, []);
  const markExitFinished = useCallback(() => {
    exitFinishedRef.current = true;
    finishIfReady();
  }, [finishIfReady]);
  const markRewardArrived = useCallback(() => {
    if (rewardArrivedRef.current) return;
    rewardArrivedRef.current = true;
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    finishIfReady();
  }, [finishIfReady]);
  const schedule = (callback: () => void, delay: number) => {
    timersRef.current.push(setTimeout(callback, delay));
  };

  const beginCompletionFromSource = (source: DayActionSourceRect | null) => {
    if (completingRef.current) return;
    completingRef.current = true;
    setCompleting(true);
    setCelebrationSource(source);
    onBeginCompletion?.();
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (reduceMotion) {
      rowScale.value = withTiming(0.99, { duration: 90 });
      rowOpacity.value = withDelay(90, withTiming(0, { duration: 100 }, (finished) => {
        if (finished) runOnJS(markExitFinished)();
      }));
      tickScale.value = withSequence(withTiming(1.1, { duration: 80 }), withTiming(1, { duration: 100 }));
    } else {
      chargeGlow.value = withSequence(
        withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) }),
        withTiming(0.62, { duration: 300, easing: Easing.out(Easing.cubic) }),
        withDelay(100, withTiming(1, { duration: 90, easing: Easing.out(Easing.cubic) })),
        withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) }),
      );
      rowScale.value = withSequence(
        withTiming(1.027, { duration: 120, easing: Easing.out(Easing.cubic) }),
        withTiming(1.014, { duration: 180, easing: Easing.out(Easing.cubic) }),
        withDelay(220, withTiming(1.04, { duration: 100, easing: Easing.out(Easing.cubic) })),
        withTiming(0.985, { duration: 260, easing: Easing.in(Easing.cubic) }),
      );
      artScale.value = withSequence(
        withTiming(1.1, { duration: 100, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 170, easing: Easing.out(Easing.cubic) }),
      );
      artX.value = withSequence(
        withTiming(-5, { duration: 55, easing: Easing.inOut(Easing.quad) }),
        withTiming(6, { duration: 70, easing: Easing.inOut(Easing.quad) }),
        withTiming(-3, { duration: 60, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 85, easing: Easing.out(Easing.cubic) }),
      );
      artRotation.value = withSequence(
        withTiming(-4, { duration: 55, easing: Easing.inOut(Easing.quad) }),
        withTiming(5, { duration: 70, easing: Easing.inOut(Easing.quad) }),
        withTiming(-2.5, { duration: 60, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 85, easing: Easing.out(Easing.cubic) }),
      );
      tickScale.value = withSequence(
        withTiming(1.14, { duration: 120, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 170, easing: Easing.out(Easing.back(1.05)) }),
      );
      rowX.value = withDelay(620, withTiming(windowWidth + 24, {
        duration: 320,
        easing: Easing.in(Easing.cubic),
      }, (finished) => {
        if (finished) runOnJS(markExitFinished)();
      }));
      rowOpacity.value = withDelay(710, withTiming(0, { duration: 185, easing: Easing.in(Easing.quad) }));
    }

    schedule(() => onCompletionRequest(source, markRewardArrived), reduceMotion ? 40 : REWARD_REQUEST_DELAY_MS);
    schedule(markRewardArrived, COMPLETION_WATCHDOG_MS);
  };

  const beginCompletion = () => {
    const measureSource = rewardRef.current ?? completionControlRef.current;
    if (measureSource) {
      measureSource.measureInWindow((x, y, width, height) => {
        beginCompletionFromSource({ height, width, x, y });
      });
      return;
    }
    beginCompletionFromSource({
      height: 38,
      width: 38,
      x: windowWidth - 64,
      y: windowHeight * 0.68,
    });
  };

  const beginCompletionRef = useRef(beginCompletion);
  beginCompletionRef.current = beginCompletion;
  useEffect(() => {
    if (autoComplete && !disabled) beginCompletionRef.current();
  }, [autoComplete, disabled]);

  return (
    <DayActionActiveRow
      animateLayout={animateLayout}
      disabled={completing || disabled}
      enteringEnabled={enteringEnabled}
      entryDelayMs={entryDelayMs}
      externalGesture={externalGesture}
      label={label}
      onSkip={onSkip}>
      <Animated.View style={[styles.motionViewport, motionViewportStyle]}>
        <Animated.View style={rowStyle}>
          <Pressable
            accessibilityHint={accessibilityHint ?? (completeOnPress ? (onSkip ? "Completes this task. Swipe right to skip." : "Completes this task.") : "Opens goal options")}
            accessibilityLabel={title}
            accessibilityRole="button"
            disabled={completing || disabled}
            onPress={() => completeOnPress ? beginCompletion() : onOpen(beginCompletion)}
            style={({ pressed }) => pressed && styles.pressed}>
            <DayActionCardSurface
              artwork={<Animated.View style={artStyle}>{artwork}</Animated.View>}
              overlay={<Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />}
              reward={reward ? <View collapsable={false} ref={rewardRef}>{reward}</View> : undefined}
              title={title}
              progress={progress}
              subtitle={subtitle}
              titleNumberOfLines={completeOnPress ? 0 : 2}
              trailing={hideCompletionControl ? false : (
                <View collapsable={false} ref={completionControlRef}>
                  <Pressable
                    accessibilityHint="Completes this goal now"
                    accessibilityLabel={`Complete ${title}`}
                    accessibilityRole="button"
                    disabled={completing || disabled}
                    hitSlop={8}
                    onPress={(event) => {
                      event.stopPropagation();
                      beginCompletion();
                    }}
                    style={({ pressed }) => [styles.completeControl, pressed && styles.completePressed]}>
                    <Animated.View style={tickStyle}><DayActionCompletedTick /></Animated.View>
                  </Pressable>
                </View>
              )}
            />
          </Pressable>
        </Animated.View>
      </Animated.View>
      {completing ? <GoalCompletionCelebration reducedMotion={reduceMotion} source={celebrationSource} /> : null}
    </DayActionActiveRow>
  );
}

const styles = StyleSheet.create({
  completeControl: { borderCurve: 'continuous', borderRadius: 999 },
  completePressed: { opacity: 0.72, transform: [{ scale: 0.94 }] },
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,225,126,0.18)',
    borderColor: 'rgba(255,229,137,0.82)',
    borderCurve: 'continuous',
    borderRadius: 15,
    borderWidth: 1.5,
    boxShadow: '0 0 22px rgba(255,210,91,0.64), inset 0 0 15px rgba(255,244,190,0.36)',
  },
  motionViewport: { overflow: 'hidden' },
  pressed: { opacity: 0.93 },
});
