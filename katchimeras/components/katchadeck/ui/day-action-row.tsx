import * as Haptics from 'expo-haptics';
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type View as ViewType } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  LinearTransition,
  runOnJS,
  SlideInLeft,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';

import { DayActionCardSurface, DayActionCompletedTick } from './day-action-card';

export type DayActionSourceRect = { x: number; y: number; width: number; height: number };

export const DAY_ACTION_MOTION = {
  batchSettleMs: 680,
  entryBaseDelayMs: 55,
  entryDurationMs: 300,
  entryStaggerMs: 45,
  layoutDurationMs: 300,
  revealWidth: 96,
} as const;

const REVEAL_WIDTH = DAY_ACTION_MOTION.revealWidth;
const UNDERLAY_OVERLAP = 36;
const ACTIVATION_DISTANCE = 6;
const SECOND_SWIPE_DISMISS_DISTANCE = 22;
const CLOSE_DISTANCE = 22;
const REWARD_REPLAY_GUARD_MS = 12_000;
const recentRewardAnimations = new Map<string, number>();

export function useDayActionStackPresentation<T>({
  frozen = false,
  getId,
  items,
}: {
  frozen?: boolean;
  getId: (item: T) => string;
  items: readonly T[];
}) {
  const reduceMotion = useReducedMotion();
  const settledItemsRef = useRef<readonly T[]>(items);
  const settledPositionsRef = useRef(new Map(items.map((item, index) => [getId(item), index])));
  const presentedItems = frozen ? settledItemsRef.current : items;
  const currentPositions = useMemo(
    () => new Map(presentedItems.map((item, index) => [getId(item), index])),
    [getId, presentedItems],
  );
  const newlyIntroducedIds = new Set(
    [...currentPositions.keys()].filter((id) => !settledPositionsRef.current.has(id)),
  );
  const movingIds = new Set(
    [...currentPositions].filter(([id, index]) => {
      const previousIndex = settledPositionsRef.current.get(id);
      return previousIndex != null && previousIndex !== index;
    }).map(([id]) => id),
  );

  useLayoutEffect(() => {
    if (frozen) return;
    settledItemsRef.current = items;
    settledPositionsRef.current = currentPositions;
  }, [currentPositions, frozen, items]);

  return {
    entryDelayMs(id: string, index: number) {
      if (reduceMotion) return 0;
      return newlyIntroducedIds.has(id)
        ? DAY_ACTION_MOTION.batchSettleMs + index * DAY_ACTION_MOTION.entryStaggerMs
        : DAY_ACTION_MOTION.entryBaseDelayMs + Math.min(index, 5) * DAY_ACTION_MOTION.entryStaggerMs;
    },
    isMoving(id: string) {
      return movingIds.has(id);
    },
    newlyIntroducedIds,
    presentedItems,
  };
}

function claimRewardAnimation(rewardAnimationId?: string) {
  if (!rewardAnimationId) return true;
  const now = Date.now();
  for (const [id, claimedAt] of recentRewardAnimations) {
    if (now - claimedAt >= REWARD_REPLAY_GUARD_MS) recentRewardAnimations.delete(id);
  }
  if (recentRewardAnimations.has(rewardAnimationId)) return false;
  recentRewardAnimations.set(rewardAnimationId, now);
  return true;
}

export function DayActionActiveRow({
  animateLayout = true,
  children,
  disabled = false,
  enteringEnabled = true,
  entryDelayMs = 0,
  externalGesture,
  label,
  onSkip,
}: {
  animateLayout?: boolean;
  children: ReactNode;
  disabled?: boolean;
  enteringEnabled?: boolean;
  entryDelayMs?: number;
  externalGesture?: GestureType;
  label: string;
  onSkip?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const entryAnimation = !enteringEnabled
    ? undefined
    : reduceMotion
      ? FadeIn.delay(entryDelayMs).duration(80)
      : SlideInLeft.delay(entryDelayMs).duration(DAY_ACTION_MOTION.entryDurationMs).easing(Easing.out(Easing.cubic));
  const content = onSkip ? (
    <DayActionSwipeShell
      disabled={disabled}
      externalGesture={externalGesture}
      label={label}
      onDismiss={onSkip}>
      {children}
    </DayActionSwipeShell>
  ) : children;

  return (
    <Animated.View layout={animateLayout ? LinearTransition.duration(reduceMotion ? 100 : DAY_ACTION_MOTION.layoutDurationMs).easing(Easing.inOut(Easing.cubic)) : undefined}>
      <Animated.View entering={entryAnimation}>
        {content}
      </Animated.View>
    </Animated.View>
  );
}

export function DayActionCompletedRow({
  animateLayout = true,
  artwork,
  enteringEnabled = false,
  entryDelayMs = 0,
  onFinished,
  onRewardRequest,
  reward,
  rewardAnimationId,
  rewardAlreadyAnimated = false,
  start = true,
  subtitle,
  title,
}: {
  animateLayout?: boolean;
  artwork: ReactNode;
  enteringEnabled?: boolean;
  entryDelayMs?: number;
  onFinished: () => void;
  onRewardRequest?: (source: DayActionSourceRect, onArrive: () => void) => void;
  reward?: ReactNode;
  rewardAnimationId?: string;
  rewardAlreadyAnimated?: boolean;
  start?: boolean;
  subtitle?: string | null;
  title: string;
}) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const motionViewportStyle = useMemo(() => ({
    marginHorizontal: -windowWidth,
    paddingHorizontal: windowWidth,
  }), [windowWidth]);
  const reduceMotion = useReducedMotion();
  const sourceRef = useRef<ViewType | null>(null);
  const finishedRef = useRef(false);
  const rewardStartedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  const onRewardRequestRef = useRef(onRewardRequest);
  const rewardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowX = useSharedValue(0);
  const rowOpacity = useSharedValue(1);
  const rowScale = useSharedValue(0.985);
  const tickScale = useSharedValue(0.72);
  const artX = useSharedValue(0);
  const artRotation = useSharedValue(0);
  const artScale = useSharedValue(1);
  const chargeGlow = useSharedValue(0);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: rowOpacity.value,
    transform: [{ translateX: rowX.value }, { scale: rowScale.value }],
  }));
  const tickStyle = useAnimatedStyle(() => ({ transform: [{ scale: tickScale.value }] }));
  const artStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: artX.value },
      { rotate: `${artRotation.value}deg` },
      { scale: artScale.value },
    ],
  }));
  const chargeGlowStyle = useAnimatedStyle(() => ({
    opacity: chargeGlow.value,
    transform: [{ scale: 0.985 + chargeGlow.value * 0.025 }],
  }));

  onFinishedRef.current = onFinished;
  onRewardRequestRef.current = onRewardRequest;
  const notifyFinished = useCallback(() => onFinishedRef.current(), []);
  const entryAnimation = !enteringEnabled
    ? undefined
    : reduceMotion
      ? FadeIn.delay(entryDelayMs).duration(80)
      : SlideInLeft.delay(entryDelayMs).duration(DAY_ACTION_MOTION.entryDurationMs).easing(Easing.out(Easing.cubic));

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    const exitDelay = reduceMotion ? 0 : 155;
    if (!reduceMotion) {
      chargeGlow.value = withSequence(
        withTiming(1, { duration: 90, easing: Easing.out(Easing.cubic) }),
        withDelay(70, withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) })),
      );
      rowScale.value = withSequence(
        withTiming(1.04, { duration: 105, easing: Easing.out(Easing.cubic) }),
        withTiming(0.985, { duration: 270, easing: Easing.in(Easing.cubic) }),
      );
    }
    rowX.value = withDelay(exitDelay, withTiming(windowWidth + 24, {
      duration: reduceMotion ? 100 : 320,
      easing: Easing.in(Easing.cubic),
    }, (animationFinished) => {
      if (animationFinished) runOnJS(notifyFinished)();
    }));
    rowOpacity.value = withDelay(
      exitDelay + (reduceMotion ? 0 : 90),
      withTiming(0, { duration: reduceMotion ? 80 : 185, easing: Easing.in(Easing.quad) }),
    );
  }, [chargeGlow, notifyFinished, reduceMotion, rowOpacity, rowScale, rowX, windowWidth]);

  useEffect(() => {
    if (!start) return;
    const frame = requestAnimationFrame(() => {
      const requestReward = (source: DayActionSourceRect) => {
        rewardTimerRef.current = setTimeout(() => {
          if (rewardStartedRef.current) return;
          rewardStartedRef.current = true;
          const request = onRewardRequestRef.current;
          if (rewardAlreadyAnimated || !request || !claimRewardAnimation(rewardAnimationId)) finish();
          else {
            watchdogRef.current = setTimeout(finish, 2_800);
            request(source, finish);
          }
        }, reduceMotion ? 30 : 90);
      };
      if (sourceRef.current) {
        sourceRef.current.measureInWindow((x, y, width, height) => requestReward({ height, width, x, y }));
      } else {
        requestReward({ height: 36, width: 36, x: windowWidth / 2 - 18, y: windowHeight * 0.68 });
      }
    });

    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (reduceMotion) {
      rowScale.value = withTiming(1, { duration: 80 });
      tickScale.value = withTiming(1, { duration: 100 });
      artScale.value = withSequence(withTiming(1.06, { duration: 80 }), withTiming(1, { duration: 110 }));
    } else {
      chargeGlow.value = withSequence(
        withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) }),
        withTiming(0.62, { duration: 320, easing: Easing.out(Easing.cubic) }),
      );
      rowScale.value = withSequence(
        withTiming(1.03, { duration: 110, easing: Easing.out(Easing.cubic) }),
        withTiming(1.015, { duration: 190, easing: Easing.out(Easing.cubic) }),
      );
      tickScale.value = withSequence(
        withTiming(1.12, { duration: 120, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 170, easing: Easing.out(Easing.back(1.05)) }),
      );
      artScale.value = withSequence(
        withTiming(1.1, { duration: 100, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 170, easing: Easing.out(Easing.cubic) }),
      );
      artX.value = withSequence(
        withTiming(-3, { duration: 45 }),
        withTiming(4, { duration: 55 }),
        withTiming(-2, { duration: 50 }),
        withTiming(0, { duration: 70, easing: Easing.out(Easing.cubic) }),
      );
      artRotation.value = withSequence(
        withTiming(-3, { duration: 45 }),
        withTiming(4, { duration: 55 }),
        withTiming(-1.5, { duration: 50 }),
        withTiming(0, { duration: 70, easing: Easing.out(Easing.cubic) }),
      );
    }

    return () => {
      cancelAnimationFrame(frame);
      if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current);
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
    };
  }, [artRotation, artScale, artX, chargeGlow, finish, reduceMotion, rewardAlreadyAnimated, rewardAnimationId, rowScale, start, tickScale, windowHeight, windowWidth]);

  return (
    <Animated.View
      entering={entryAnimation}
      layout={animateLayout ? LinearTransition.duration(reduceMotion ? 100 : DAY_ACTION_MOTION.layoutDurationMs).easing(Easing.inOut(Easing.cubic)) : undefined}
      style={[styles.motionViewport, motionViewportStyle]}>
      <Animated.View style={[styles.completedRow, rowStyle]}>
        <DayActionCardSurface
          artwork={<Animated.View style={artStyle}>{artwork}</Animated.View>}
          completed
          overlay={<Animated.View pointerEvents="none" style={[styles.completionGlow, chargeGlowStyle]} />}
          reward={reward ? <View collapsable={false} ref={sourceRef}>{reward}</View> : undefined}
          subtitle={subtitle}
          title={title}
          trailing={<Animated.View style={tickStyle}><DayActionCompletedTick /></Animated.View>}
        />
      </Animated.View>
    </Animated.View>
  );
}

export function DayActionSwipeShell({
  children,
  disabled = false,
  externalGesture,
  label,
  onDismiss,
}: {
  children: ReactNode;
  disabled?: boolean;
  externalGesture?: GestureType;
  label: string;
  onDismiss: () => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const motionViewportStyle = useMemo(() => ({
    marginHorizontal: -windowWidth,
    paddingHorizontal: windowWidth,
  }), [windowWidth]);
  const skipFramePositionStyle = useMemo(() => ({ left: windowWidth }), [windowWidth]);
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const gestureStartX = useSharedValue(0);
  const gestureStartedOpen = useSharedValue(0);
  const gestureEnded = useSharedValue(0);
  const revealed = useSharedValue(0);
  const dismissing = useSharedValue(0);
  const dismissDistance = windowWidth + 24;
  const settleDuration = reduceMotion ? 80 : 165;
  const dismissDuration = reduceMotion ? 100 : 230;

  const notifyDismiss = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  }, []);
  const finishDismiss = useCallback(() => onDismiss(), [onDismiss]);
  const animateDismiss = useCallback(() => {
    if (dismissing.value > 0) return;
    dismissing.value = 1;
    revealed.value = 0;
    notifyDismiss();
    translateX.value = withTiming(dismissDistance, {
      duration: dismissDuration,
      easing: Easing.inOut(Easing.cubic),
    }, (finished) => {
      if (finished) runOnJS(finishDismiss)();
    });
  }, [dismissDistance, dismissDuration, dismissing, finishDismiss, notifyDismiss, revealed, translateX]);

  useEffect(() => {
    if (!disabled || dismissing.value > 0) return;
    revealed.value = 0;
    translateX.value = withTiming(0, {
      duration: reduceMotion ? 60 : 120,
      easing: Easing.out(Easing.cubic),
    });
  }, [disabled, dismissing, reduceMotion, revealed, translateX]);

  const gesture = useMemo(() => {
    let pan = Gesture.Pan()
      .enabled(!disabled)
      .maxPointers(1)
      .activeOffsetX([-ACTIVATION_DISTANCE, ACTIVATION_DISTANCE])
      .failOffsetY([-14, 14])
      .onBegin(() => {
        if (dismissing.value > 0) return;
        cancelAnimation(translateX);
        gestureStartX.value = translateX.value;
        gestureStartedOpen.value = revealed.value;
        gestureEnded.value = 0;
      })
      .onUpdate((event) => {
        if (dismissing.value > 0) return;
        const rawX = gestureStartX.value + event.translationX;
        if (rawX < 0) {
          translateX.value = Math.max(-8, rawX * 0.12);
          return;
        }
        if (gestureStartedOpen.value > 0) {
          translateX.value = Math.min(dismissDistance, rawX);
          return;
        }
        translateX.value = rawX <= REVEAL_WIDTH
          ? rawX
          : REVEAL_WIDTH + (rawX - REVEAL_WIDTH) * 0.14;
      })
      .onEnd((event) => {
        gestureEnded.value = 1;
        if (dismissing.value > 0) return;
        const commitsSecondSwipe = gestureStartedOpen.value > 0
          && (event.translationX >= SECOND_SWIPE_DISMISS_DISTANCE || event.velocityX >= 420);
        if (commitsSecondSwipe) {
          dismissing.value = 1;
          revealed.value = 0;
          runOnJS(notifyDismiss)();
          translateX.value = withTiming(dismissDistance, {
            duration: dismissDuration,
            easing: Easing.inOut(Easing.cubic),
          }, (finished) => {
            if (finished) runOnJS(finishDismiss)();
          });
          return;
        }
        if (gestureStartedOpen.value > 0) {
          const shouldClose = event.translationX <= -CLOSE_DISTANCE || event.velocityX <= -360;
          revealed.value = shouldClose ? 0 : 1;
          translateX.value = withTiming(shouldClose ? 0 : REVEAL_WIDTH, {
            duration: settleDuration,
            easing: Easing.out(Easing.cubic),
          });
          return;
        }
        const shouldReveal = translateX.value >= REVEAL_WIDTH * 0.32 || event.velocityX >= 360;
        revealed.value = shouldReveal ? 1 : 0;
        translateX.value = withTiming(shouldReveal ? REVEAL_WIDTH : 0, {
          duration: settleDuration,
          easing: Easing.out(Easing.cubic),
        });
      })
      .onFinalize(() => {
        if (gestureEnded.value > 0 || dismissing.value > 0) return;
        translateX.value = withTiming(
          gestureStartedOpen.value > 0 ? REVEAL_WIDTH : 0,
          { duration: settleDuration, easing: Easing.out(Easing.cubic) },
        );
      });
    if (externalGesture) pan = pan.blocksExternalGesture(externalGesture);
    return pan;
  }, [disabled, dismissDistance, dismissDuration, dismissing, externalGesture, finishDismiss, gestureEnded, gestureStartX, gestureStartedOpen, notifyDismiss, revealed, settleDuration, translateX]);

  const rowStyle = useAnimatedStyle(() => {
    const dismissProgress = Math.max(0, Math.min(1, (translateX.value - REVEAL_WIDTH) / Math.max(1, dismissDistance - REVEAL_WIDTH)));
    return { opacity: 1 - dismissProgress, transform: [{ translateX: translateX.value }] };
  });
  const actionStyle = useAnimatedStyle(() => {
    const revealProgress = Math.max(0, Math.min(1, translateX.value / REVEAL_WIDTH));
    const dismissProgress = Math.max(0, Math.min(1, (translateX.value - REVEAL_WIDTH) / Math.max(1, dismissDistance - REVEAL_WIDTH)));
    return {
      opacity: revealProgress * (1 - dismissProgress),
      transform: [{ translateX: -8 + revealProgress * 8 }, { scale: 0.96 + revealProgress * 0.04 }],
    };
  });

  return (
    <View style={[styles.swipeContainer, motionViewportStyle]}>
      <Animated.View style={[styles.skipFrame, skipFramePositionStyle, actionStyle]}>
        <Pressable
          accessibilityLabel={`Skip ${label} for today`}
          accessibilityRole="button"
          hitSlop={6}
          onPress={animateDismiss}
          style={({ pressed }) => [styles.skipAction, pressed && styles.skipPressed]}>
          <IconSymbol color="#FFF9E9" name="xmark" size={16} />
          <ThemedText style={styles.skipLabel} lightColor="#FFF9E9" darkColor="#FFF9E9">Skip</ThemedText>
        </Pressable>
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  completedRow: { borderCurve: 'continuous', borderRadius: 20, overflow: 'hidden' },
  completionGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,225,126,0.18)',
    borderColor: 'rgba(255,229,137,0.82)',
    borderCurve: 'continuous',
    borderRadius: 15,
    borderWidth: 1.5,
    boxShadow: '0 0 22px rgba(255,210,91,0.64), inset 0 0 15px rgba(255,244,190,0.36)',
  },
  motionViewport: { overflow: 'hidden' },
  swipeContainer: { backgroundColor: 'transparent', borderCurve: 'continuous', borderRadius: 20, overflow: 'hidden', position: 'relative' },
  skipFrame: { backgroundColor: '#8F6046', borderCurve: 'continuous', borderRadius: 20, bottom: 0, overflow: 'hidden', position: 'absolute', top: 0, width: REVEAL_WIDTH + UNDERLAY_OVERLAP },
  skipAction: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 20, flexDirection: 'row', gap: 5, height: '100%', justifyContent: 'center', overflow: 'hidden', paddingHorizontal: 10, width: REVEAL_WIDTH },
  skipPressed: { backgroundColor: '#744A35' },
  skipLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '900' },
});
