import { useIsFocused } from '@react-navigation/native';
import { createContext, type ReactNode, use, useEffect, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
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
  allowGestureAtScriptedRest?: boolean;
  deferScriptedChangesWhileDisabled?: boolean;
  enabled: boolean;
  frozen?: boolean;
  hoverEnabled?: boolean;
  maxPinchScale?: number;
  pinchSoftLimitRange?: number;
  scriptedPinchDurationMs?: number;
  scriptedPinchStartScale?: number | null;
  scriptedPinchScale?: number | null;
};

const MotionContext = createContext<TodayEnvironmentMotion | null>(null);

export function useTodayEnvironmentMotion({
  allowGestureAtScriptedRest = false,
  deferScriptedChangesWhileDisabled = false,
  enabled,
  frozen = false,
  hoverEnabled = enabled,
  maxPinchScale,
  pinchSoftLimitRange = 0,
  scriptedPinchDurationMs = 800,
  scriptedPinchStartScale = null,
  scriptedPinchScale = null,
}: MotionControllerOptions) {
  const isFocused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const hoverY = useSharedValue(0);
  const motion = todayScene.homeEnvironment.motion;
  // An explicitly authored starting scale must exist on the very first native
  // frame. Applying it only from an effect briefly exposes the default camera
  // before a fresh Egg snaps or animates into its close-up.
  const pinchScale = useSharedValue(scriptedPinchStartScale ?? 1);
  const pinchStartScale = useSharedValue(scriptedPinchStartScale ?? 1);
  const resolvedMaxPinchScale = Math.max(
    1,
    Math.min(maxPinchScale ?? motion.maxPinchScale, motion.maxPinchScale),
  );
  const resolvedSoftLimitRange = Math.max(
    0,
    Math.min(pinchSoftLimitRange, resolvedMaxPinchScale - 1),
  );
  const resolvedScriptedPinchScale = scriptedPinchScale == null
    ? null
    : Math.max(1, Math.min(scriptedPinchScale, resolvedMaxPinchScale));
  const scriptedGestureLocked = resolvedScriptedPinchScale != null
    && !(allowGestureAtScriptedRest && resolvedScriptedPinchScale === 1);

  useEffect(() => {
    cancelAnimation(hoverY);
    if (frozen) return;
    if (!enabled || !hoverEnabled || !isFocused || reduceMotion || !motion.hoverEnabled) {
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
  }, [enabled, frozen, hoverEnabled, hoverY, isFocused, motion.hoverDistance, motion.hoverEnabled, motion.hoverHalfCycleMs, reduceMotion]);

  useEffect(() => {
    if (frozen) {
      cancelAnimation(pinchScale);
      return;
    }
    if (resolvedScriptedPinchScale != null) return;
    if (enabled) return;
    cancelAnimation(pinchScale);
    pinchScale.value = withSpring(1, motion.resetSpring);
  }, [enabled, frozen, motion.resetSpring, pinchScale, resolvedScriptedPinchScale]);

  useEffect(() => {
    if (
      frozen
      || resolvedScriptedPinchScale == null
      || (deferScriptedChangesWhileDisabled && !enabled)
    ) return;
    cancelAnimation(pinchScale);
    if (scriptedPinchStartScale != null) {
      pinchScale.value = Math.max(1, Math.min(scriptedPinchStartScale, resolvedMaxPinchScale));
    }
    pinchScale.value = reduceMotion
      ? resolvedScriptedPinchScale
      : withTiming(resolvedScriptedPinchScale, {
          duration: scriptedPinchDurationMs,
          easing: Easing.inOut(Easing.cubic),
        });
  }, [
    deferScriptedChangesWhileDisabled,
    enabled,
    frozen,
    pinchScale,
    reduceMotion,
    resolvedMaxPinchScale,
    resolvedScriptedPinchScale,
    scriptedPinchDurationMs,
    scriptedPinchStartScale,
  ]);

  const pinchGesture = useMemo(
    () => Gesture.Pinch()
      .enabled(enabled && !frozen && !scriptedGestureLocked)
      .onBegin(() => {
        cancelAnimation(pinchScale);
        pinchStartScale.value = pinchScale.value;
      })
      .onUpdate((event) => {
        const rawScale = Math.max(1, pinchStartScale.value * event.scale);
        if (resolvedSoftLimitRange <= 0) {
          pinchScale.value = Math.min(resolvedMaxPinchScale, rawScale);
          return;
        }

        const softLimitStart = resolvedMaxPinchScale - resolvedSoftLimitRange;
        if (rawScale <= softLimitStart) {
          pinchScale.value = rawScale;
          return;
        }

        // Preserve a 1:1 response through most of the zoom, then progressively
        // resist the final portion. The asymptote prevents a perceptible stop.
        const overshoot = rawScale - softLimitStart;
        pinchScale.value = softLimitStart
          + resolvedSoftLimitRange
            * (1 - Math.exp(-overshoot / resolvedSoftLimitRange));
      })
      .onFinalize(() => {
        pinchScale.value = withSpring(1, motion.resetSpring);
      }),
    [
      enabled,
      frozen,
      motion.resetSpring,
      pinchScale,
      pinchStartScale,
      resolvedMaxPinchScale,
      resolvedSoftLimitRange,
      scriptedGestureLocked,
    ],
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

export function useTodayEnvironmentMotionValues() {
  return use(MotionContext);
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

/** Applies the shared pinch to a full-screen environment plane. Its vertical
 * pivot matches the resident's global centre while Today chrome stays fixed. */
export function TodayEnvironmentViewportMotionLayer({
  additionalScale,
  children,
  focusY,
  viewportHeight,
}: {
  additionalScale?: SharedValue<number>;
  children: ReactNode;
  focusY: number;
  viewportHeight: number;
}) {
  const motion = use(MotionContext);
  const pivotOffsetY = focusY - viewportHeight / 2;
  const anchorStyle = useAnimatedStyle(() => {
    const scale = (motion?.pinchScale.value ?? 1) * (additionalScale?.value ?? 1);
    return {
      transform: [{ translateY: (1 - scale) * pivotOffsetY }],
    };
  }, [additionalScale, pivotOffsetY]);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: (motion?.pinchScale.value ?? 1) * (additionalScale?.value ?? 1) }],
  }), [additionalScale]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, anchorStyle]}>
      <Animated.View
        pointerEvents="box-none"
        style={[StyleSheet.absoluteFill, scaleStyle]}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}
