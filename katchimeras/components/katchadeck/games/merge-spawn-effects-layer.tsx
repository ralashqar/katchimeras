import { Image } from 'expo-image';
import { memo, useEffect, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { mergeCellCenter, type MergeBoardGeometry } from '@/utils/merge-world/board-geometry';
import { MERGE_EFFECT_SLOT_IDS, mergeEffectRetentionMs, type MergeBoardEffect, type MergeBoardEffectKind, type MergeBoardEffects } from '@/utils/merge-world/board-effects';
import { recordMergeRender } from '@/utils/merge-world/performance';
import { useDisposableTimers } from '@/hooks/use-disposable-timers';

const AnimatedImage = Animated.createAnimatedComponent(Image);
const SOFT_GLOW = require('../../../assets/images/katchimeras/soft-glow.png');

export { MERGE_EFFECT_SLOT_IDS } from '@/utils/merge-world/board-effects';

export const MERGE_EFFECT_PARTICLES = [
  { angle: -2.68, distance: 0.72, size: 5 },
  { angle: -1.72, distance: 0.88, size: 4 },
  { angle: -0.72, distance: 0.78, size: 5 },
  { angle: 0.28, distance: 0.66, size: 4 },
  { angle: 1.28, distance: 0.58, size: 5 },
  { angle: 2.3, distance: 0.68, size: 4 },
] as const;

export type { MergeBoardEffect, MergeBoardEffectKind } from '@/utils/merge-world/board-effects';

/** Fixed native/Reanimated slots shared by generator, landing, and merge feedback. */
export const MergeBoardEffectsLayer = memo(function MergeBoardEffectsLayer({
  controller,
  activity,
  geometry,
  reduceMotion,
  size,
}: {
  controller: MergeBoardEffects;
  activity: SharedValue<number>;
  geometry: MergeBoardGeometry;
  reduceMotion: boolean;
  size: number;
}) {
  recordMergeRender('effects-layer');
  const effects = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const active = effects.length > 0;
  useEffect(() => { activity.value = active ? 1 : 0; }, [active, activity]);
  useEffect(() => () => { controller.clear(); activity.value = 0; }, [activity, controller]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {MERGE_EFFECT_SLOT_IDS.map((slotId) => (
        <MergeBoardEffectSlot
          effect={effects.find((entry) => entry.id % MERGE_EFFECT_SLOT_IDS.length === slotId) ?? null}
          geometry={geometry}
          key={slotId}
          onRetire={controller.retire}
          reduceMotion={reduceMotion}
          size={size}
        />
      ))}
    </View>
  );
});

const MergeBoardEffectSlot = memo(function MergeBoardEffectSlot({ effect, geometry, onRetire, reduceMotion, size }: {
  effect: MergeBoardEffect | null;
  geometry: MergeBoardGeometry;
  onRetire: (id: number) => void;
  reduceMotion: boolean;
  size: number;
}) {
  recordMergeRender('effect-slot');
  const timers = useDisposableTimers('merge:effect-slot');
  const progress = useSharedValue(0);
  // Keep the particle pool mounted, but do not subscribe landing particles to
  // the running clock. Their zero progress is fully transparent and idle.
  const idleParticleProgress = useSharedValue(0);
  const particleProgress = !effect || effect.kind === 'spawn-settle' || reduceMotion ? idleParticleProgress : progress;
  const center = effect ? mergeCellCenter(geometry, effect.cell) : { x: 0, y: 0 };
  const centerX = center.x;
  const centerY = center.y;

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (effect) {
      const duration = reduceMotion ? 180 : effect.kind === 'spawn-origin' ? 450 : effect.kind === 'merge' ? 620 : 560;
      progress.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
    }
    return () => cancelAnimation(progress);
  }, [effect, progress, reduceMotion]);

  useEffect(() => {
    if (!effect) return;
    const timer = timers.schedule(() => onRetire(effect.id), mergeEffectRetentionMs(effect.kind, reduceMotion));
    return () => timers.cancel(timer);
  }, [effect, onRetire, reduceMotion, timers]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <MergeEffectGlow centerX={centerX} centerY={centerY} kind={effect?.kind ?? 'spawn-origin'} progress={progress} reduceMotion={reduceMotion} size={size} />
      <MergeEffectRing centerX={centerX} centerY={centerY} kind={effect?.kind ?? 'spawn-origin'} progress={progress} reduceMotion={reduceMotion} size={size} />
      {MERGE_EFFECT_PARTICLES.map((particle, index) => (
        <MergeEffectParticle
          centerX={centerX}
          centerY={centerY}
          index={index}
          key={index}
          kind={effect?.kind ?? 'spawn-origin'}
          particle={particle}
          progress={particleProgress}
          reduceMotion={reduceMotion}
          size={size}
        />
      ))}
    </View>
  );
});

function effectProgress(value: number, kind: MergeBoardEffectKind) {
  'worklet';
  if (kind !== 'merge') return value;
  return Math.max(0, Math.min(1, (value - 0.1) / 0.9));
}

const MergeEffectGlow = memo(function MergeEffectGlow({ centerX, centerY, kind, progress, reduceMotion, size }: {
  centerX: number;
  centerY: number;
  kind: MergeBoardEffectKind;
  progress: SharedValue<number>;
  reduceMotion: boolean;
  size: number;
}) {
  const diameter = size * (kind === 'merge' ? 1.72 : kind === 'spawn-settle' ? 1.42 : 1.05);
  const style = useAnimatedStyle(() => {
    const p = effectProgress(progress.value, kind);
    return {
      opacity: interpolate(p, [0, 0.12, 0.58, 1], [0, kind === 'merge' ? 0.9 : 0.7, 0.34, 0]),
      transform: [{ scale: reduceMotion ? 1 : interpolate(p, [0, 0.22, 1], [0.46, 1.04, kind === 'merge' ? 1.62 : 1.42]) }],
    };
  }, [kind, reduceMotion]);
  return (
    <AnimatedImage
      accessibilityIgnoresInvertColors
      contentFit="contain"
      source={SOFT_GLOW}
      style={[styles.glow, {
        height: diameter,
        left: centerX - diameter / 2,
        top: centerY - diameter / 2,
        width: diameter,
      }, style]}
      tintColor={kind === 'merge' ? '#FFD46F' : '#FFE7A5'}
      transition={0}
    />
  );
});

const MergeEffectRing = memo(function MergeEffectRing({ centerX, centerY, kind, progress, reduceMotion, size }: {
  centerX: number;
  centerY: number;
  kind: MergeBoardEffectKind;
  progress: SharedValue<number>;
  reduceMotion: boolean;
  size: number;
}) {
  const diameter = size * (kind === 'merge' ? 0.86 : 0.72);
  const style = useAnimatedStyle(() => {
    const p = effectProgress(progress.value, kind);
    return {
      opacity: interpolate(p, [0, 0.12, 0.72, 1], [0, reduceMotion ? 0.52 : 0.94, 0.32, 0]),
      transform: [{ scale: reduceMotion ? 1 : interpolate(p, [0, 0.28, 1], [0.48, 1.02, kind === 'merge' ? 1.72 : 1.38]) }],
    };
  }, [kind, reduceMotion]);
  return <Animated.View style={[styles.ring, {
    borderColor: kind === 'merge' ? 'rgba(255,238,174,0.96)' : 'rgba(255,239,190,0.8)',
    height: diameter,
    left: centerX - diameter / 2,
    top: centerY - diameter / 2,
    width: diameter,
  }, style]} />;
});

const MergeEffectParticle = memo(function MergeEffectParticle({ centerX, centerY, index, kind, particle, progress, reduceMotion, size }: {
  centerX: number;
  centerY: number;
  index: number;
  kind: MergeBoardEffectKind;
  particle: (typeof MERGE_EFFECT_PARTICLES)[number];
  progress: SharedValue<number>;
  reduceMotion: boolean;
  size: number;
}) {
  const directionX = Math.cos(particle.angle);
  const directionY = Math.sin(particle.angle);
  const distanceScale = kind === 'merge' ? 1.18 : kind === 'spawn-settle' ? 0.82 : 1;
  const travelEnd = size * particle.distance * distanceScale;
  const style = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 0 }] };
    const base = effectProgress(progress.value, kind);
    const delayed = Math.max(0, Math.min(1, (base - index * 0.014) / (1 - index * 0.014)));
    const travel = interpolate(delayed, [0, 1], [size * 0.06, travelEnd]);
    return {
      opacity: interpolate(delayed, [0, 0.16, 0.7, 1], [0, 1, 0.68, 0]),
      transform: [
        { translateX: directionX * travel },
        { translateY: directionY * travel + delayed * delayed * size * 0.08 },
        { scale: interpolate(delayed, [0, 0.24, 1], [0.3, kind === 'merge' ? 1.24 : 1.06, 0.2]) },
      ],
    };
  }, [directionX, directionY, index, kind, reduceMotion, size, travelEnd]);
  return <Animated.View style={[styles.particle, {
    backgroundColor: kind === 'merge' ? '#FFF0B0' : '#FFE4A0',
    height: particle.size,
    left: centerX - particle.size / 2,
    top: centerY - particle.size / 2,
    width: particle.size,
  }, style]} />;
});

const styles = StyleSheet.create({
  glow: { position: 'absolute' },
  // The shared glow sprite supplies the halo; avoid a blurred shadow on every
  // moving particle and ring (up to 42 simultaneous shadow-bearing views).
  particle: { borderRadius: 999, position: 'absolute' },
  ring: { borderRadius: 999, borderWidth: 1.5, position: 'absolute' },
});
