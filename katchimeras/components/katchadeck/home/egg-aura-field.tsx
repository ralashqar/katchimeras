import * as Haptics from 'expo-haptics';
import { BlurMask, Canvas, Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { EggAuraMotionValues } from '@/components/katchadeck/home/egg-shell';
import type {
  EggAuraConfig,
  EggForceImpulse,
  EggInteriorFieldConfig,
  EggMembraneConfig,
  EggMembranePoint,
  EggRippleEvent,
  EggVisualState,
} from '@/types/home';

type EggAuraFieldProps = {
  egg: EggVisualState;
  enabled: boolean;
  motion: EggAuraMotionValues;
  onInteractionEnergyChange?: (value: number) => void;
  onRipple: (event: EggRippleEvent) => void;
  ripples: EggRippleEvent[];
  size: number;
};

type MembraneSnapshot = {
  points: EggMembranePoint[];
  impulses: EggForceImpulse[];
  charge: number;
  dragStrength: number;
};

const auraConfig: EggAuraConfig = {
  baseRadius: 116,
  membraneThickness: 2,
  maxPullDistance: 74,
  rippleDurationMs: 860,
  particleCount: 5,
  hapticsEnabled: true,
};

const membraneConfig: EggMembraneConfig = {
  pointCount: 24,
  springStrength: 0.14,
  damping: 0.84,
  neighborInfluence: 0.18,
  maxPullDistance: auraConfig.maxPullDistance,
};

const interiorFieldConfig: EggInteriorFieldConfig = {
  glowStrength: 0.34,
  wakeBlur: 16,
  chargeDecay: 0.94,
  shaderEnabled: false,
};

const TAP_DURATION_MS = 900;
const WAKE_DURATION_MS = 320;
const TRAIL_SAMPLE_DISTANCE = 14;
const MAX_FORCE_IMPULSES = 16;

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
  const visualCharge = useSharedValue(0);
  const releaseVelocityRef = useRef(0);
  const lastTrailSampleRef = useRef<{ x: number; y: number } | null>(null);
  const activeDragRef = useRef({
    x: 0,
    y: 0,
    strength: 0,
    velocity: 0,
  });
  const impulsesRef = useRef<EggForceImpulse[]>([]);
  const membranePointsRef = useRef<EggMembranePoint[]>(createMembranePoints(membraneConfig.pointCount, auraRadius * 0.93));
  const chargeRef = useRef(0);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const [snapshot, setSnapshot] = useState<MembraneSnapshot>(() => ({
    points: membranePointsRef.current.map((point) => ({ ...point })),
    impulses: [],
    charge: 0,
    dragStrength: 0,
  }));

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
    membranePointsRef.current = createMembranePoints(membraneConfig.pointCount, auraRadius * 0.93);
    setSnapshot((current) => ({
      ...current,
      points: membranePointsRef.current.map((point) => ({ ...point })),
    }));
  }, [auraRadius]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const step = () => {
      const timestamp = Date.now();
      const lastTimestamp = lastTimestampRef.current ?? timestamp;
      const dt = Math.min(0.033, (timestamp - lastTimestamp) / 1000 || 0.016);
      lastTimestampRef.current = timestamp;

      const now = Date.now();
      impulsesRef.current = impulsesRef.current.filter((impulse) => now - impulse.createdAt < impulse.durationMs);
      chargeRef.current *= Math.pow(interiorFieldConfig.chargeDecay, dt * 60);
      if (chargeRef.current < 0.01) {
        chargeRef.current = 0;
      }

      const substeps = Math.max(1, Math.min(3, Math.round(dt / 0.016)));
      const substepDt = dt / substeps;
      for (let index = 0; index < substeps; index += 1) {
        advanceMembrane(
          membranePointsRef.current,
          impulsesRef.current,
          activeDragRef.current,
          center,
          now,
          substepDt
        );
      }

      setSnapshot({
        points: membranePointsRef.current.map((point) => ({ ...point })),
        impulses: impulsesRef.current.map((impulse) => ({ ...impulse })),
        charge: chargeRef.current,
        dragStrength: activeDragRef.current.strength,
      });
      visualCharge.value = chargeRef.current;
    };

    frameIntervalRef.current = setInterval(step, 33);
    step();

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
      frameIntervalRef.current = null;
      lastTimestampRef.current = null;
    };
  }, [center, enabled, visualCharge]);

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
          opacity: 0.14 + (index % 4) * 0.04,
        };
      }),
    [auraRadius, center]
  );

  const boundaryPath = useMemo(
    () => buildSplinePath(snapshot.points, center),
    [center, snapshot.points]
  );

  const wakeCircles = useMemo(() => {
    return snapshot.impulses
      .filter((impulse) => impulse.kind === 'wake')
      .flatMap((impulse) => {
        const progress = clamp01((Date.now() - impulse.createdAt) / impulse.durationMs);
        const angle = Math.atan2(impulse.y - center, impulse.x - center);
        const tangentX = -Math.sin(angle);
        const tangentY = Math.cos(angle);
        const wakeOffset = (1 - progress) * 10 * impulse.strength;
        const primaryRadius = 10 + impulse.strength * 14 + progress * 7;
        const secondaryRadius = 5 + impulse.strength * 9 + progress * 4;
        const alpha = 0.18 * (1 - progress) * impulse.strength;

        return [
          {
            id: `${impulse.id}-primary`,
            blur: interiorFieldConfig.wakeBlur,
            color: withAlpha(egg.accentColor, alpha),
            radius: primaryRadius,
            x: impulse.x,
            y: impulse.y,
          },
          {
            id: `${impulse.id}-secondary`,
            blur: 10,
            color: withAlpha(egg.coreColor, alpha * 0.8),
            radius: secondaryRadius,
            x: impulse.x - tangentX * wakeOffset,
            y: impulse.y - tangentY * wakeOffset,
          },
        ];
      });
  }, [center, egg.accentColor, egg.coreColor, snapshot.impulses]);

  const tapPressureCircles = useMemo(() => {
    return snapshot.impulses
      .filter((impulse) => impulse.kind === 'tap')
      .map((impulse) => {
        const progress = clamp01((Date.now() - impulse.createdAt) / impulse.durationMs);
        return {
          id: impulse.id,
          color: withAlpha(egg.haloColor, (1 - progress) * 0.12 * impulse.strength),
          radius: 18 + progress * 28 + impulse.strength * 10,
          x: impulse.x,
          y: impulse.y,
        };
      });
  }, [egg.haloColor, snapshot.impulses]);

  const outerAuraStyle = useAnimatedStyle(() => {
    const dragMagnitude = Math.min(1, Math.hypot(motion.dragX.value, motion.dragY.value) / auraConfig.maxPullDistance);

    return {
      opacity: 0.58 + idlePulse.value * 0.1 + motion.pressProgress.value * 0.18 + visualCharge.value * 0.14,
      transform: [
        { translateX: motion.dragX.value * 0.12 },
        { translateY: motion.dragY.value * 0.12 },
        { scaleX: 1 + dragMagnitude * 0.08 + motion.pressProgress.value * 0.04 },
        { scaleY: 1 - dragMagnitude * 0.045 + motion.pressProgress.value * 0.05 + idlePulse.value * 0.03 },
      ],
    };
  });

  const innerGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.34 + motion.interactionEnergy.value * 0.22 + idlePulse.value * 0.08 + visualCharge.value * 0.12,
    transform: [
      { translateX: motion.glowLagX.value * 0.4 },
      { translateY: motion.glowLagY.value * 0.4 },
      { scale: 0.98 + motion.interactionEnergy.value * 0.09 + idlePulse.value * 0.03 + visualCharge.value * 0.05 },
    ],
  }));

  const particleLayerStyle = useAnimatedStyle(() => ({
    opacity: 0.74 + motion.interactionEnergy.value * 0.18 + visualCharge.value * 0.08,
    transform: [
      { translateX: motion.dragX.value * 0.12 },
      { translateY: motion.dragY.value * 0.12 },
      { scale: 1 + motion.pressProgress.value * 0.02 + visualCharge.value * 0.02 },
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

  const emitRipple = useCallback(
    (originX: number, originY: number) => {
      onRipple({
        id: `ripple-${Date.now().toString(36)}-${Math.round(originX)}-${Math.round(originY)}`,
        originX,
        originY,
        startedAt: Date.now(),
      });
    },
    [onRipple]
  );

  const addImpulse = useCallback((kind: EggForceImpulse['kind'], x: number, y: number, strength: number, durationMs: number) => {
    const nextImpulse: EggForceImpulse = {
      id: `${kind}-${Date.now().toString(36)}-${Math.round(x)}-${Math.round(y)}`,
      kind,
      x,
      y,
      strength,
      createdAt: Date.now(),
      durationMs,
    };

    impulsesRef.current = [...impulsesRef.current.slice(-(MAX_FORCE_IMPULSES - 1)), nextImpulse];
  }, []);

  const updateEnergy = useCallback(
    (value: number) => {
      onInteractionEnergyChange?.(value);
    },
    [onInteractionEnergyChange]
  );

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
        addImpulse('tap', touch.x, touch.y, Math.min(1, 0.72 + (validTouches.length - 1) * 0.08), TAP_DURATION_MS);
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

      chargeRef.current = Math.min(1, chargeRef.current + tapStrength * 0.24);
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
    [addImpulse, center, emitRipple, motion, nucleusRadius, touchRadius, updateEnergy]
  );

  const longPressGesture = Gesture.LongPress()
    .enabled(enabled)
    .runOnJS(true)
    .minDuration(220)
    .onStart((event) => {
      const dx = event.x - center;
      const dy = event.y - center;
      const distance = Math.hypot(dx, dy);
      if (distance > touchRadius || distance < nucleusRadius) {
        return;
      }

      chargeRef.current = Math.min(1, chargeRef.current + 0.16);
      motion.pressProgress.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
      motion.interactionEnergy.value = withTiming(0.58, { duration: 180, easing: Easing.out(Easing.cubic) });
      updateEnergy(0.58);
    })
    .onFinalize(() => {
      motion.pressProgress.value = withTiming(0, { duration: 260 });
      motion.interactionEnergy.value = withTiming(0, { duration: 360 });
      updateEnergy(0);
    });

  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .runOnJS(true)
    .maxPointers(1)
    .onBegin((event) => {
      thresholdTriggered.value = 0;
      const dx = event.x - center;
      const dy = event.y - center;
      const distance = Math.hypot(dx, dy);
      panActive.value = distance <= touchRadius && distance >= nucleusRadius ? 1 : 0;
      releaseVelocityRef.current = 0;
      activeDragRef.current = { x: 0, y: 0, strength: 0, velocity: 0 };
      lastTrailSampleRef.current = null;
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
      const currentX = center + nextDragX;
      const currentY = center + nextDragY;
      const releaseVelocity = Math.min(1, Math.hypot(event.velocityX, event.velocityY) / 700);

      motion.dragX.value = nextDragX;
      motion.dragY.value = nextDragY;
      motion.glowLagX.value = nextDragX * 0.55;
      motion.glowLagY.value = nextDragY * 0.55;
      motion.pressProgress.value = 0.42 + energy * 0.54;
      motion.interactionEnergy.value = energy;
      motion.releaseVelocity.value = releaseVelocity;
      releaseVelocityRef.current = releaseVelocity;
      activeDragRef.current = {
        x: nextDragX,
        y: nextDragY,
        strength: energy,
        velocity: releaseVelocity,
      };
      chargeRef.current = Math.min(1, chargeRef.current + energy * 0.02);
      updateEnergy(energy);

      const lastSample = lastTrailSampleRef.current;
      if (!lastSample || Math.hypot(currentX - lastSample.x, currentY - lastSample.y) >= TRAIL_SAMPLE_DISTANCE) {
        lastTrailSampleRef.current = { x: currentX, y: currentY };
        addImpulse(
          'wake',
          currentX,
          currentY,
          Math.max(0.28, Math.min(1, energy * 0.86 + releaseVelocity * 0.22)),
          WAKE_DURATION_MS
        );
      }

      if (energy > 0.58 && thresholdTriggered.value === 0) {
        thresholdTriggered.value = 1;
        firePullHaptic();
      }
    })
    .onFinalize(() => {
      panActive.value = 0;
      const releaseVelocity = releaseVelocityRef.current;
      const finalDrag = activeDragRef.current;
      activeDragRef.current = { x: 0, y: 0, strength: 0, velocity: 0 };
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
      if (finalDrag.strength > 0.08) {
        addImpulse(
          'wake',
          center + finalDrag.x,
          center + finalDrag.y,
          Math.min(1, finalDrag.strength * 0.7 + releaseVelocity * 0.34),
          WAKE_DURATION_MS + 80
        );
      }
      lastTrailSampleRef.current = null;
      updateEnergy(0);
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
              <Circle color={withAlpha(egg.haloColor, 0.15 + snapshot.charge * 0.08)} cx={center} cy={center} r={auraRadius * 1.02}>
                <BlurMask blur={40} style="solid" />
              </Circle>
              <Circle color={withAlpha(egg.accentColor, 0.12 + snapshot.dragStrength * 0.08)} cx={center} cy={center} r={auraRadius * 1.08}>
                <BlurMask blur={54} style="solid" />
              </Circle>
              <Circle color="rgba(255,255,255,0.06)" cx={center} cy={center} r={auraRadius} />
            </Group>
            <Path color={withAlpha(egg.accentColor, 0.74)} path={boundaryPath} style="stroke" strokeWidth={2.1}>
              <BlurMask blur={4} style="solid" />
            </Path>
          </Canvas>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.layerFill, innerGlowStyle]}>
          <Canvas style={{ height: size, width: size }}>
            <Group clip={boundaryPath}>
              <Circle color={withAlpha(egg.coreColor, 0.24 + snapshot.charge * interiorFieldConfig.glowStrength)} cx={center} cy={center} r={auraRadius * 0.44}>
                <BlurMask blur={24} style="solid" />
              </Circle>
              <Circle
                color={withAlpha(egg.accentColor, 0.14 + snapshot.dragStrength * 0.1)}
                cx={center + activeDragRef.current.x * 0.22}
                cy={center + activeDragRef.current.y * 0.22}
                r={auraRadius * (0.24 + snapshot.dragStrength * 0.08)}>
                <BlurMask blur={22} style="solid" />
              </Circle>
              {tapPressureCircles.map((pressure) => (
                <Circle color={pressure.color} cx={pressure.x} cy={pressure.y} key={pressure.id} r={pressure.radius}>
                  <BlurMask blur={18} style="solid" />
                </Circle>
              ))}
            </Group>
          </Canvas>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.layerFill, particleLayerStyle]}>
          <Canvas style={{ height: size, width: size }}>
            {particles.map((particle) => (
              <Circle
                color={withAlpha(egg.accentColor, particle.opacity)}
                cx={particle.x}
                cy={particle.y}
                key={particle.id}
                r={particle.radius}>
                <BlurMask blur={8} style="solid" />
              </Circle>
            ))}
          </Canvas>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.layerFill, styles.wakeLayer]}>
          <Canvas style={{ height: size, width: size }}>
            <Group clip={boundaryPath}>
              {wakeCircles.map((wake) => (
                <Circle color={wake.color} cx={wake.x} cy={wake.y} key={wake.id} r={wake.radius}>
                  <BlurMask blur={wake.blur} style="solid" />
                </Circle>
              ))}
            </Group>
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
            backgroundColor: withAlpha(color, 0.1),
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
            borderColor: withAlpha(color, 0.27),
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
            borderColor: withAlpha(color, 0.66),
            left: originX - 18,
            top: originY - 18,
          },
          ringStyle,
        ]}
      />
    </>
  );
}

function createMembranePoints(pointCount: number, baseRadius: number): EggMembranePoint[] {
  return Array.from({ length: pointCount }, (_, index) => ({
    angle: (-Math.PI / 2) + (Math.PI * 2 * index) / pointCount,
    baseRadius,
    offset: 0,
    velocity: 0,
  }));
}

function advanceMembrane(
  points: EggMembranePoint[],
  impulses: EggForceImpulse[],
  activeDrag: { x: number; y: number; strength: number; velocity: number },
  center: number,
  now: number,
  dt: number
) {
  if (points.length === 0) {
    return;
  }

  const previousOffsets = points.map((point) => point.offset);

  points.forEach((point, index) => {
    const previousIndex = (index - 1 + points.length) % points.length;
    const nextIndex = (index + 1) % points.length;
    const prevOffset = previousOffsets[previousIndex];
    const nextOffset = previousOffsets[nextIndex];
    let force = -point.offset * membraneConfig.springStrength;

    force += (prevOffset + nextOffset - point.offset * 2) * membraneConfig.neighborInfluence;

    impulses.forEach((impulse) => {
      const progress = clamp01((now - impulse.createdAt) / impulse.durationMs);
      if (progress >= 1) {
        return;
      }

      const impulseAngle = Math.atan2(impulse.y - center, impulse.x - center);
      const angleDelta = normalizeAngle(point.angle - impulseAngle);
      const angularFalloff =
        impulse.kind === 'tap'
          ? Math.exp(-((angleDelta * angleDelta) / 0.42))
          : Math.exp(-((angleDelta * angleDelta) / 0.64));
      const amplitudeBase =
        impulse.kind === 'tap'
          ? 22
          : impulse.kind === 'drag'
            ? 18
            : 12;
      const oscillation =
        impulse.kind === 'tap'
          ? Math.sin(progress * Math.PI * 2.35)
          : 1 - progress;

      force += amplitudeBase * impulse.strength * angularFalloff * oscillation * 0.18;
    });

    if (activeDrag.strength > 0.01) {
      const dragAngle = Math.atan2(activeDrag.y, activeDrag.x);
      const dragAngleDelta = normalizeAngle(point.angle - dragAngle);
      const dragFalloff = Math.exp(-((dragAngleDelta * dragAngleDelta) / 0.28));
      force += 28 * activeDrag.strength * dragFalloff * 0.16;
    }

    point.velocity += force * dt * 60;
    point.velocity *= Math.pow(membraneConfig.damping, dt * 60);
    point.offset += point.velocity * dt * 60;
    point.offset = clamp(point.offset, -18, 34);
  });
}

function buildSplinePath(points: EggMembranePoint[], center: number) {
  const path = Skia.Path.Make();
  if (points.length < 2) {
    return path;
  }

  const controlPoints = points.map((point) => {
    const radius = point.baseRadius + point.offset;
    return {
      offset: point.offset,
      x: center + Math.cos(point.angle) * radius,
      y: center + Math.sin(point.angle) * radius,
    };
  });

  const renderPoints: { x: number; y: number }[] = [];
  for (let index = 0; index < controlPoints.length; index += 1) {
    const p0 = controlPoints[(index - 1 + controlPoints.length) % controlPoints.length];
    const p1 = controlPoints[index];
    const p2 = controlPoints[(index + 1) % controlPoints.length];
    const p3 = controlPoints[(index + 2) % controlPoints.length];
    const segmentLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const offsetDelta = Math.abs(p2.offset - p1.offset);
    const subdivisions = clamp(
      5 + Math.ceil(segmentLength / 18) + Math.ceil(offsetDelta / 3.5),
      6,
      14
    );

    for (let step = 0; step < subdivisions; step += 1) {
      const t = step / subdivisions;
      renderPoints.push(catmullRomPoint(p0, p1, p2, p3, t));
    }
  }

  const first = renderPoints[0];
  if (!first) {
    return path;
  }

  path.moveTo(first.x, first.y);
  for (let index = 1; index < renderPoints.length; index += 1) {
    const point = renderPoints[index];
    path.lineTo(point.x, point.y);
  }
  path.close();
  return path;
}

function catmullRomPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
) {
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x:
      0.5 *
      ((2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      ((2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function withAlpha(color: string, alpha: number) {
  const normalized = clamp01(alpha);
  if (color.startsWith('#')) {
    const base = color.length === 9 ? color.slice(0, 7) : color;
    return `${base}${Math.round(normalized * 255)
      .toString(16)
      .padStart(2, '0')}`;
  }

  return `${color}${Math.round(normalized * 255)
    .toString(16)
    .padStart(2, '0')}`;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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
  wakeLayer: {
    opacity: 1,
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
