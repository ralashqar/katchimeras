import * as Haptics from 'expo-haptics';
import { BlurMask, Canvas, Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  maxPullDistance: 74,
  rippleDurationMs: 860,
  particleCount: 5,
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
  const nucleusRadius = 66;
  const touchRadius = auraRadius + 22;
  const idlePulse = useSharedValue(0);
  const thresholdTriggered = useSharedValue(0);
  const panActive = useSharedValue(0);
  const releaseVelocityRef = useRef(0);
  const waveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [waveNow, setWaveNow] = useState(() => Date.now());

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

  useEffect(() => {
    if (ripples.length === 0) {
      if (waveIntervalRef.current) {
        clearInterval(waveIntervalRef.current);
        waveIntervalRef.current = null;
      }
      return;
    }

    waveIntervalRef.current = setInterval(() => {
      setWaveNow(Date.now());
    }, 33);

    return () => {
      if (waveIntervalRef.current) {
        clearInterval(waveIntervalRef.current);
        waveIntervalRef.current = null;
      }
    };
  }, [ripples.length]);

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

  const boundaryPath = useMemo(() => {
    const baseBoundaryRadius = auraRadius * 0.93;
    const path = Skia.Path.Make();
    const steps = 48;
    const tapStackBoost = 1 + Math.min(0.5, ripples.length * 0.1);

    for (let index = 0; index <= steps; index += 1) {
      const angle = (Math.PI * 2 * index) / steps;
      let waveOffset = 0;

      ripples.forEach((ripple) => {
        const progress = Math.max(0, Math.min(1, (waveNow - ripple.startedAt) / auraConfig.rippleDurationMs));
        if (progress >= 1) {
          return;
        }

        const rippleAngle = Math.atan2(ripple.originY - center, ripple.originX - center);
        const angleDelta = normalizeAngle(angle - rippleAngle);
        const angularDistance = Math.abs(angleDelta);
        const angularInfluence = Math.exp(-((angularDistance * angularDistance) / 0.6));
        const amplitude = 8.4 * (1 - progress) * tapStackBoost;
        const primaryOscillation = Math.sin(progress * 5.4 - angleDelta * 3.1);
        const trailingOscillation = Math.sin(progress * 3.2 - angleDelta * 2.2 - 0.85);
        waveOffset += amplitude * angularInfluence * (primaryOscillation * 0.74 + trailingOscillation * 0.26);
      });

      const radius = baseBoundaryRadius + waveOffset;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;

      if (index === 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }

    path.close();
    return path;
  }, [auraRadius, center, ripples, waveNow]);

  const outerAuraStyle = useAnimatedStyle(() => {
    const dragMagnitude = Math.min(1, Math.hypot(motion.dragX.value, motion.dragY.value) / auraConfig.maxPullDistance);

    return {
      opacity: 0.62 + idlePulse.value * 0.1 + motion.pressProgress.value * 0.18,
      transform: [
        { translateX: motion.dragX.value * 0.12 },
        { translateY: motion.dragY.value * 0.12 },
        { scaleX: 1 + dragMagnitude * 0.1 + motion.pressProgress.value * 0.04 },
        { scaleY: 1 - dragMagnitude * 0.056 + motion.pressProgress.value * 0.06 + idlePulse.value * 0.03 },
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const firePullHaptic = () => {
    if (process.env.EXPO_OS === 'ios' && auraConfig.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    }
  };

  const emitRipple = useCallback((originX: number, originY: number) => {
    onRipple({
      id: `ripple-${Date.now().toString(36)}-${Math.round(originX)}-${Math.round(originY)}`,
      originX,
      originY,
      startedAt: Date.now(),
    });
  }, [onRipple]);

  const updateEnergy = useCallback((value: number) => {
    onInteractionEnergyChange?.(value);
  }, [onInteractionEnergyChange]);

  const triggerTapCluster = useCallback(
    (touches: { x: number; y: number }[]) => {
      const validTouches = touches.filter((touch) => {
        const dx = touch.x - center;
        const dy = touch.y - center;
        const distance = Math.hypot(dx, dy);
        return distance <= touchRadius && distance >= nucleusRadius;
      });

      if (validTouches.length === 0) {
        return;
      }

      validTouches.forEach((touch) => {
        emitRipple(touch.x, touch.y);
      });

      const centroid = validTouches.reduce(
        (sum, touch) => ({
          x: sum.x + touch.x,
          y: sum.y + touch.y,
        }),
        { x: 0, y: 0 }
      );
      const centroidX = centroid.x / validTouches.length;
      const centroidY = centroid.y / validTouches.length;
      const dx = centroidX - center;
      const dy = centroidY - center;
      const tapStrength = Math.min(1, 0.72 + (validTouches.length - 1) * 0.14);

      motion.pressProgress.value = withSequence(
        withTiming(1, { duration: 110, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 560, easing: Easing.out(Easing.cubic) })
      );
      motion.interactionEnergy.value = withSequence(
        withTiming(tapStrength, { duration: 120, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 720, easing: Easing.out(Easing.cubic) })
      );
      motion.glowLagX.value = withSequence(
        withTiming(dx * 0.28, { duration: 120 }),
        withTiming(0, { duration: 660, easing: Easing.out(Easing.cubic) })
      );
      motion.glowLagY.value = withSequence(
        withTiming(dy * 0.28, { duration: 120 }),
        withTiming(0, { duration: 660, easing: Easing.out(Easing.cubic) })
      );
      fireSelectionHaptic();
      updateEnergy(tapStrength);
    },
    [center, emitRipple, motion, nucleusRadius, touchRadius, updateEnergy]
  );

  const longPressGesture = Gesture.LongPress()
    .enabled(enabled)
    .minDuration(220)
    .onStart((event) => {
      const dx = event.x - center;
      const dy = event.y - center;
      const distance = Math.hypot(dx, dy);
      if (distance > touchRadius || distance < nucleusRadius) {
        return;
      }

      motion.pressProgress.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
      motion.interactionEnergy.value = withTiming(0.58, { duration: 180, easing: Easing.out(Easing.cubic) });
      runOnJS(updateEnergy)(0.58);
    })
    .onFinalize(() => {
      motion.pressProgress.value = withTiming(0, { duration: 260 });
      motion.interactionEnergy.value = withTiming(0, { duration: 360 });
      runOnJS(updateEnergy)(0);
    });

  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .maxPointers(1)
    .onBegin((event) => {
      thresholdTriggered.value = 0;
      const dx = event.x - center;
      const dy = event.y - center;
      const distance = Math.hypot(dx, dy);
      panActive.value = distance <= touchRadius && distance >= nucleusRadius ? 1 : 0;
      releaseVelocityRef.current = 0;
    })
    .onChange((event) => {
      if (panActive.value === 0) {
        return;
      }

      const translationDistance = Math.hypot(event.translationX, event.translationY);
      const clampedDistance = Math.min(translationDistance, auraConfig.maxPullDistance);
      const directionX = translationDistance > 0 ? event.translationX / translationDistance : 0;
      const directionY = translationDistance > 0 ? event.translationY / translationDistance : 0;
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
        Math.hypot(event.velocityX, event.velocityY) / 700
      );
      releaseVelocityRef.current = motion.releaseVelocity.value;
      runOnJS(updateEnergy)(energy);

      if (energy > 0.58 && thresholdTriggered.value === 0) {
        thresholdTriggered.value = 1;
        runOnJS(firePullHaptic)();
      }
    })
    .onFinalize(() => {
      panActive.value = 0;
      const releaseVelocity = releaseVelocityRef.current;
      motion.dragX.value = withSpring(0, {
        damping: 13,
        stiffness: 160,
        velocity: releaseVelocity * 34,
      });
      motion.dragY.value = withSpring(0, {
        damping: 13,
        stiffness: 160,
        velocity: releaseVelocity * 34,
      });
      motion.glowLagX.value = withSpring(0, {
        damping: 14,
        stiffness: 180,
      });
      motion.glowLagY.value = withSpring(0, {
        damping: 14,
        stiffness: 180,
      });
      motion.pressProgress.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
      motion.interactionEnergy.value = withTiming(0, { duration: 360, easing: Easing.out(Easing.cubic) });
      motion.releaseVelocity.value = withTiming(0, { duration: 220 });
      runOnJS(updateEnergy)(0);
    });

  const gesture = Gesture.Simultaneous(longPressGesture, panGesture);

  return (
    <GestureDetector gesture={gesture}>
      <View
        onTouchStart={(event) => {
          if (!enabled) {
            return;
          }

          const touches = event.nativeEvent.changedTouches.map((touch) => ({
            x: touch.locationX,
            y: touch.locationY,
          }));

          triggerTapCluster(touches);
        }}
        pointerEvents="box-only"
        style={[styles.shell, { height: size, width: size }]}>
        <Animated.View pointerEvents="none" style={[styles.layerFill, outerAuraStyle]}>
          <Canvas style={{ height: size, width: size }}>
            <Group clip={boundaryPath}>
              <Circle color={`${egg.haloColor}26`} cx={center} cy={center} r={auraRadius * 0.98}>
                <BlurMask blur={32} style="solid" />
              </Circle>
              <Circle color={`${egg.accentColor}1A`} cx={center} cy={center} r={auraRadius * 1.08}>
                <BlurMask blur={48} style="solid" />
              </Circle>
              <Circle color="rgba(255,255,255,0.07)" cx={center} cy={center} r={auraRadius * 0.98} />
            </Group>
            <Path color={`${egg.accentColor}AA`} path={boundaryPath} style="stroke" strokeWidth={2.1}>
              <BlurMask blur={4} style="solid" />
            </Path>
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
    opacity: 0.68 - progress.value * 0.68,
    transform: [{ scale: 0.22 + progress.value * 2.2 }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    opacity: 0.22 - progress.value * 0.22,
    transform: [{ scale: 0.34 + progress.value * 1.16 }],
  }));

  const secondRingStyle = useAnimatedStyle(() => ({
    opacity: 0.42 - progress.value * 0.42,
    transform: [{ scale: 0.16 + progress.value * 2.86 }],
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
          styles.rippleRingSecondary,
          {
            borderColor: `${color}44`,
            left: originX - 18,
            top: originY - 18,
          },
          secondRingStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.rippleRing,
          {
            borderColor: `${color}AA`,
            left: originX - 18,
            top: originY - 18,
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

function normalizeAngle(angle: number) {
  let nextAngle = angle;
  while (nextAngle > Math.PI) {
    nextAngle -= Math.PI * 2;
  }
  while (nextAngle < -Math.PI) {
    nextAngle += Math.PI * 2;
  }
  return nextAngle;
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    overflow: 'hidden',
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
    height: 36,
    position: 'absolute',
    width: 36,
  },
  rippleRing: {
    borderRadius: 999,
    borderWidth: 1.8,
    height: 36,
    position: 'absolute',
    width: 36,
  },
  rippleRingSecondary: {
    borderRadius: 999,
    borderWidth: 1.1,
    height: 36,
    position: 'absolute',
    width: 36,
  },
});
