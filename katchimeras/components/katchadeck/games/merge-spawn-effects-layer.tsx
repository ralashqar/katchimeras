import { memo, useEffect } from 'react';
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

import { mergeCellOrigin, type MergeBoardGeometry } from '@/utils/merge-world/board-geometry';

export const NATIVE_SPAWN_BURST_SLOT_IDS = [0, 1, 2, 3, 4, 5] as const;

export const NATIVE_SPAWN_PARTICLES = [
  { angle: -2.74, distance: 0.64, color: '#FFE7A5', size: 5 },
  { angle: -2.05, distance: 0.78, color: '#FFBF68', size: 4 },
  { angle: -1.46, distance: 0.86, color: '#FFF2C6', size: 6 },
  { angle: -0.82, distance: 0.76, color: '#FFCF74', size: 4 },
  { angle: -0.18, distance: 0.68, color: '#FFE9AE', size: 5 },
  { angle: 0.58, distance: 0.58, color: '#F8B95E', size: 4 },
  { angle: 1.34, distance: 0.52, color: '#FFF0BE', size: 5 },
  { angle: 2.36, distance: 0.6, color: '#FFD47D', size: 4 },
] as const;

type SpawnBurst = { id: number; cell: number };

/** Six reusable native-view particle slots; no Canvas is created or torn down. */
export const MergeSpawnEffectsLayer = memo(function MergeSpawnEffectsLayer({
  bursts,
  geometry,
  size,
}: {
  bursts: readonly SpawnBurst[];
  geometry: MergeBoardGeometry;
  size: number;
}) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {NATIVE_SPAWN_BURST_SLOT_IDS.map((slotId) => (
        <NativeSpawnBurstSlot
          burst={bursts.find((burst) => burst.id % NATIVE_SPAWN_BURST_SLOT_IDS.length === slotId) ?? null}
          geometry={geometry}
          key={slotId}
          size={size}
        />
      ))}
    </View>
  );
});

function NativeSpawnBurstSlot({ burst, geometry, size }: {
  burst: SpawnBurst | null;
  geometry: MergeBoardGeometry;
  size: number;
}) {
  const progress = useSharedValue(0);
  const origin = burst ? mergeCellOrigin(geometry, burst.cell) : { x: 0, y: 0 };
  const centerX = origin.x + size / 2;
  const centerY = origin.y + size / 2;

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (burst) {
      progress.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) });
    }
    return () => cancelAnimation(progress);
  }, [burst, progress]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <NativeSpawnHalo centerX={centerX} centerY={centerY} progress={progress} size={size} />
      {NATIVE_SPAWN_PARTICLES.map((particle, index) => (
        <NativeSpawnParticle
          centerX={centerX}
          centerY={centerY}
          index={index}
          key={index}
          particle={particle}
          progress={progress}
          size={size}
        />
      ))}
    </View>
  );
}

function NativeSpawnHalo({ centerX, centerY, progress, size }: {
  centerX: number;
  centerY: number;
  progress: SharedValue<number>;
  size: number;
}) {
  const diameter = size * 0.78;
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.14, 0.7, 1], [0, 0.72, 0.22, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.35, 1.55]) }],
  }), []);
  return (
    <Animated.View
      style={[
        styles.halo,
        {
          height: diameter,
          left: centerX - diameter / 2,
          top: centerY - diameter / 2,
          width: diameter,
        },
        style,
      ]}
    />
  );
}

function NativeSpawnParticle({ centerX, centerY, index, particle, progress, size }: {
  centerX: number;
  centerY: number;
  index: number;
  particle: (typeof NATIVE_SPAWN_PARTICLES)[number];
  progress: SharedValue<number>;
  size: number;
}) {
  const style = useAnimatedStyle(() => {
    const delayed = Math.max(0, Math.min(1, (progress.value - index * 0.018) / (1 - index * 0.018)));
    const travel = interpolate(delayed, [0, 1], [size * 0.08, size * particle.distance]);
    return {
      opacity: interpolate(delayed, [0, 0.16, 0.72, 1], [0, 1, 0.72, 0]),
      transform: [
        { translateX: Math.cos(particle.angle) * travel },
        { translateY: Math.sin(particle.angle) * travel + delayed * delayed * size * 0.12 },
        { scale: interpolate(delayed, [0, 0.24, 1], [0.3, 1.1, 0.25]) },
      ],
    };
  }, [index, particle.angle, particle.distance, size]);
  return (
    <Animated.View
      style={[
        styles.particle,
        {
          backgroundColor: particle.color,
          height: particle.size,
          left: centerX - particle.size / 2,
          top: centerY - particle.size / 2,
          width: particle.size,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  halo: {
    backgroundColor: 'rgba(255,205,112,0.18)',
    borderColor: 'rgba(255,239,190,0.78)',
    borderRadius: 999,
    borderWidth: 1.5,
    boxShadow: '0 0 10px rgba(255,205,112,0.48)',
    position: 'absolute',
  },
  particle: {
    borderRadius: 999,
    boxShadow: '0 0 6px rgba(255,231,165,0.62)',
    position: 'absolute',
  },
});
