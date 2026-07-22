import { useIsFocused } from '@react-navigation/native';
import { createContext, type ReactNode, use, useEffect, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import todayScene from '@/data/today-scene.json';
import { TODAY_KINGDOM_STAGE_HEIGHT } from '@/utils/today-kingdom-hero-layout';

type TodayEnvironmentMotion = {
  hoverY: SharedValue<number>;
  pinchScale: SharedValue<number>;
};

type MotionControllerOptions = {
  enabled: boolean;
};

const MotionContext = createContext<TodayEnvironmentMotion | null>(null);

export function useTodayEnvironmentMotion({ enabled }: MotionControllerOptions) {
  const isFocused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const hoverY = useSharedValue(0);
  const pinchScale = useSharedValue(1);
  const pinchStartScale = useSharedValue(1);
  const motion = todayScene.homeEnvironment.motion;

  useEffect(() => {
    cancelAnimation(hoverY);
    if (!enabled || !isFocused || reduceMotion || !motion.hoverEnabled) {
      hoverY.value = withTiming(0, { duration: 180 });
      return;
    }
    hoverY.value = 0;
    hoverY.value = withRepeat(
      withSequence(
        withTiming(-motion.hoverDistance, {
          duration: motion.hoverHalfCycleMs,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: motion.hoverHalfCycleMs,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(hoverY);
  }, [enabled, hoverY, isFocused, motion.hoverDistance, motion.hoverEnabled, motion.hoverHalfCycleMs, reduceMotion]);

  useEffect(() => {
    if (enabled) return;
    cancelAnimation(pinchScale);
    pinchScale.value = withSpring(1, motion.resetSpring);
  }, [enabled, motion.resetSpring, pinchScale]);

  const pinchGesture = useMemo(
    () => Gesture.Pinch()
      .enabled(enabled)
      .onBegin(() => {
        cancelAnimation(pinchScale);
        pinchStartScale.value = pinchScale.value;
      })
      .onUpdate((event) => {
        pinchScale.value = Math.min(
          motion.maxPinchScale,
          Math.max(1, pinchStartScale.value * event.scale),
        );
      })
      .onFinalize(() => {
        pinchScale.value = withSpring(1, motion.resetSpring);
      }),
    [enabled, motion.maxPinchScale, motion.resetSpring, pinchScale, pinchStartScale],
  );

  return {
    environmentGesture: pinchGesture,
    environmentMotion: { hoverY, pinchScale },
  };
}

export function TodayEnvironmentMotionProvider({
  children,
  motion,
}: {
  children: ReactNode;
  motion: TodayEnvironmentMotion;
}) {
  return <MotionContext value={motion}>{children}</MotionContext>;
}

/** Keeps environment and resident layers on the same transform without
 * placing them in one z-plane; foreground atmosphere can still sit between. */
export function TodayEnvironmentMotionLayer({
  children,
  focusY,
  pinchStrength = 1,
}: {
  children: ReactNode;
  focusY: number;
  pinchStrength?: number;
}) {
  const motion = use(MotionContext);
  const pivotOffsetY = focusY - TODAY_KINGDOM_STAGE_HEIGHT / 2;
  const resolvedPinchStrength = Math.min(1, Math.max(0, pinchStrength));
  const anchorStyle = useAnimatedStyle(() => {
    const sharedScale = motion?.pinchScale.value ?? 1;
    const scale = 1 + (sharedScale - 1) * resolvedPinchStrength;
    return {
      // A normal scale uses the stage centre. This compensating translation
      // keeps the supplied subject centre fixed while the scale changes.
      transform: [{
        translateY: (motion?.hoverY.value ?? 0) + (1 - scale) * pivotOffsetY,
      }],
    };
  }, [pivotOffsetY, resolvedPinchStrength]);
  const scaleStyle = useAnimatedStyle(() => {
    const sharedScale = motion?.pinchScale.value ?? 1;
    return {
      transform: [{ scale: 1 + (sharedScale - 1) * resolvedPinchStrength }],
    };
  }, [resolvedPinchStrength]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          bottom: 0,
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0,
        },
        anchorStyle,
      ]}>
      <Animated.View
        pointerEvents="box-none"
        style={[
          {
            bottom: 0,
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0,
          },
          scaleStyle,
        ]}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}
