import * as Haptics from 'expo-haptics';
import { BlurMask, Canvas, Circle } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { EggAuraConfig, EggRippleEvent, EggVisualState } from '@/types/home';
import type { EggAuraMotionValues } from '@/components/katchadeck/home/egg-shell';

type EggAuraFieldProps = {
  egg: EggVisualState;
  enabled: boolean;
  motion: EggAuraMotionValues;
  onInteractionEnergyChange?: (value: number) => void;
  onRipple: (event: EggRippleEvent) => void;
  ripples: EggRippleEvent[];
  size: number;
};

const auraConfig: EggAuraConfig = {
  baseRadius: 116,
  membraneThickness: 2,
  maxPullDistance: 58,
  rippleDurationMs: 720,
  particleCount: 7,
  hapticsEnabled: true,
};

export function EggAuraField({
  egg,
  enabled,
  motion,
  onInteractionEnergyChange,
  onRipple,
  ripples,
  size,
}: EggAuraFieldProps) {
  const center = size / 2;
  const auraRadius = auraConfig.baseRadius + egg.intensity * 32;
  const idlePulse = useSharedValue(0);
  const thresholdTriggered = useSharedValue(0);
  const releaseVelocityRef = useRef(0);

  useEffect(() => {
    idlePulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [idlePulse]);

  const particles = useMemo(
    () =>
      Array.from({ length: auraConfig.particleCount }, (_, index) => {
        const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / auraConfig.particleCount;
        const ringRadius = auraRadius * (0.7 + (index % 3) * 0.12);
        return {
          id: `particle-${index}`,
          x: center + Math.cos(angle) * ringRadius,
          y: center + Math.sin(angle) * ringRadius,
          radius: 3 + (index % 3),
          opacity: 0.18 + (index % 4) * 0.04,
        };
      }),
    [auraRadius, center]
  );

  const outerAuraStyle = useAnimatedStyle(() => {
    const dragMagnitude = Math.min(1, Math.hypot(motion.dragX.value, motion.dragY.value) / auraConfig.maxPullDistance);

    return {
      opacity: 0.58 + idlePulse.value * 0.08 + motion.pressProgress.value * 0.12,
      transform: [
        { translateX: motion.dragX.value * 0.08 },
        { translateY: motion.dragY.value * 0.08 },
        { scaleX: 1 + dragMagnitude * 0.06 + motion.pressProgress.value * 0.02 },
        { scaleY: 1 - dragMagnitude * 0.032 + motion.pressProgress.value * 0.03 + idlePulse.value * 0.02 },
      ],
    };
  });

  const innerGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.36 + motion.interactionEnergy.value * 0.18 + idlePulse.value * 0.08,
    transform: [
      { translateX: motion.glowLagX.value * 0.36 },
      { translateY: motion.glowLagY.value * 0.36 },
      { scale: 0.98 + motion.interactionEnergy.value * 0.08 + idlePulse.value * 0.03 },
    ],
  }));

  const particleLayerStyle = useAnimatedStyle(() => ({
    opacity: 0.8 + motion.interactionEnergy.value * 0.16,
    transform: [
      { translateX: motion.dragX.value * 0.12 },
      { translateY: motion.dragY.value * 0.12 },
      { scale: 1 + motion.pressProgress.value * 0.018 },
    ],
  }));

  const fireSelectionHaptic = () => {
    if (process.env.EXPO_OS === 'ios' && auraConfig.hapticsEnabled) {
      Haptics.selectionAsync();
    }
  };

  const firePullHaptic = () => {
    if (process.env.EXPO_OS === 'ios' && auraConfig.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    }
  };

  const emitRipple = (originX: number, originY: number) => {
    onRipple({
      id: `ripple-${Date.now().toString(36)}-${Math.round(originX)}-${Math.round(originY)}`,
      originX,
      originY,
      startedAt: Date.now(),
    });
  };

  const updateEnergy = (value: number) => {
    onInteractionEnergyChange?.(value);
  };

  const tapGesture = Gesture.Tap()
    .enabled(enabled)
    .maxDuration(260)
    .onStart((event) => {
      const dx = event.x - center;
      const dy = event.y - center;
      const distance = Math.hypot(dx, dy);
      if (distance > auraRadius) {
        return;
      }

      motion.pressProgress.value = withSequence(
        withTiming(0.8, { duration: 120, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) })
      );
      motion.interactionEnergy.value = withSequence(
        withTiming(0.44, { duration: 120, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 560, easing: Easing.out(Easing.cubic) })
      );
      motion.glowLagX.value = withSequence(
        withTiming(dx * 0.16, { duration: 120 }),
        withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) })
      );
      motion.glowLagY.value = withSequence(
        withTiming(dy * 0.16, { duration: 120 }),
        withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) })
      );
      runOnJS(emitRipple)(event.x, event.y);
      runOnJS(fireSelectionHaptic)();
      runOnJS(updateEnergy)(0.44);
    });

  const longPressGesture = Gesture.LongPress()
    .enabled(enabled)
    .minDuration(220)
    .onStart((event) => {
      const dx = event.x - center;
      const dy = event.y - center;
      if (Math.hypot(dx, dy) > auraRadius) {
        return;
      }

      motion.pressProgress.value = withTiming(0.9, { duration: 180, easing: Easing.out(Easing.cubic) });
      motion.interactionEnergy.value = withTiming(0.5, { duration: 180, easing: Easing.out(Easing.cubic) });
      runOnJS(updateEnergy)(0.5);
    })
    .onFinalize(() => {
      motion.pressProgress.value = withTiming(0, { duration: 260 });
      motion.interactionEnergy.value = withTiming(0, { duration: 360 });
      runOnJS(updateEnergy)(0);
    });

  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .maxPointers(1)
    .onBegin(() => {
      thresholdTriggered.value = 0;
      releaseVelocityRef.current = 0;
    })
    .onChange((event) => {
      const dx = event.x - center;
      const dy = event.y - center;
      const distance = Math.hypot(dx, dy);
      if (distance > auraRadius * 1.08) {
        return;
      }

      const clampedDistance = Math.min(distance, auraConfig.maxPullDistance);
      const directionX = distance > 0 ? dx / distance : 0;
      const directionY = distance > 0 ? dy / distance : 0;
      const nextDragX = directionX * clampedDistance;
      const nextDragY = directionY * clampedDistance;
      const energy = clamp01(clampedDistance / auraConfig.maxPullDistance);

      motion.dragX.value = nextDragX;
      motion.dragY.value = nextDragY;
      motion.glowLagX.value = nextDragX * 0.55;
      motion.glowLagY.value = nextDragY * 0.55;
      motion.pressProgress.value = 0.42 + energy * 0.54;
      motion.interactionEnergy.value = energy;
      motion.releaseVelocity.value = Math.min(
        1,
        Math.hypot(event.velocityX, event.velocityY) / 780
      );
      releaseVelocityRef.current = motion.releaseVelocity.value;
      runOnJS(updateEnergy)(energy);

      if (energy > 0.58 && thresholdTriggered.value === 0) {
        thresholdTriggered.value = 1;
        runOnJS(firePullHaptic)();
      }
    })
    .onFinalize(() => {
      const releaseVelocity = releaseVelocityRef.current;
      motion.dragX.value = withSpring(0, {
        damping: 15,
        stiffness: 140,
        velocity: releaseVelocity * 28,
      });
      motion.dragY.value = withSpring(0, {
        damping: 15,
        stiffness: 140,
        velocity: releaseVelocity * 28,
      });
      motion.glowLagX.value = withSpring(0, {
        damping: 16,
        stiffness: 160,
      });
      motion.glowLagY.value = withSpring(0, {
        damping: 16,
        stiffness: 160,
      });
      motion.pressProgress.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
      motion.interactionEnergy.value = withTiming(0, { duration: 360, easing: Easing.out(Easing.cubic) });
      motion.releaseVelocity.value = withTiming(0, { duration: 220 });
      runOnJS(updateEnergy)(0);
    });

  const gesture = Gesture.Simultaneous(longPressGesture, Gesture.Race(panGesture, tapGesture));

  return (
    <GestureDetector gesture={gesture}>
      <View pointerEvents="box-only" style={[styles.shell, { height: size, width: size }]}>
        <Animated.View pointerEvents="none" style={[styles.layerFill, outerAuraStyle]}>
          <Canvas style={{ height: size, width: size }}>
            <Circle color={`${egg.haloColor}18`} cx={center} cy={center} r={auraRadius * 0.94}>
              <BlurMask blur={26} style="solid" />
            </Circle>
            <Circle color={`${egg.accentColor}12`} cx={center} cy={center} r={auraRadius * 1.06}>
              <BlurMask blur={34} style="solid" />
            </Circle>
            <Circle color="rgba(255,255,255,0.04)" cx={center} cy={center} r={auraRadius * 0.96} />
            <Circle
              color={`${egg.accentColor}4E`}
              cx={center}
              cy={center}
              r={auraRadius * 0.92}
              style="stroke"
              strokeWidth={auraConfig.membraneThickness}
            />
          </Canvas>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.layerFill, innerGlowStyle]}>
          <Canvas style={{ height: size, width: size }}>
            <Circle color={`${egg.coreColor}28`} cx={center} cy={center} r={auraRadius * 0.46}>
              <BlurMask blur={18} style="solid" />
            </Circle>
          </Canvas>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.layerFill, particleLayerStyle]}>
          <Canvas style={{ height: size, width: size }}>
            {particles.map((particle) => (
              <Circle
                color={`${egg.accentColor}${Math.round(particle.opacity * 255)
                  .toString(16)
                  .padStart(2, '0')}`}
                cx={particle.x}
                cy={particle.y}
                key={particle.id}
                r={particle.radius}>
                <BlurMask blur={8} style="solid" />
              </Circle>
            ))}
          </Canvas>
        </Animated.View>

        <View pointerEvents="none" style={styles.rippleLayer}>
          {ripples.map((ripple) => (
            <AuraRipple
              color={egg.accentColor}
              durationMs={auraConfig.rippleDurationMs}
              key={ripple.id}
              originX={ripple.originX}
              originY={ripple.originY}
            />
          ))}
        </View>
      </View>
    </GestureDetector>
  );
}

function AuraRipple({
  color,
  durationMs,
  originX,
  originY,
}: {
  color: string;
  durationMs: number;
  originX: number;
  originY: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [durationMs, progress]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.34 - progress.value * 0.34,
    transform: [{ scale: 0.16 + progress.value * 1.28 }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    opacity: 0.14 - progress.value * 0.14,
    transform: [{ scale: 0.2 + progress.value * 0.76 }],
  }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.rippleFill,
          {
            backgroundColor: `${color}1A`,
            left: originX - 14,
            top: originY - 14,
          },
          fillStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.rippleRing,
          {
            borderColor: `${color}66`,
            left: originX - 14,
            top: originY - 14,
          },
          ringStyle,
        ]}
      />
    </>
  );
}

function clamp01(value: number) {
  'worklet';
  return Math.max(0, Math.min(1, value));
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  layerFill: {
    ...StyleSheet.absoluteFillObject,
  },
  rippleLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  rippleFill: {
    borderRadius: 999,
    height: 28,
    position: 'absolute',
    width: 28,
  },
  rippleRing: {
    borderRadius: 999,
    borderWidth: 1.4,
    height: 28,
    position: 'absolute',
    width: 28,
  },
});
