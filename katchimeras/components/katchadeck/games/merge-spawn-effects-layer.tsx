import { Canvas, Path, usePathValue } from '@shopify/react-native-skia';
import { memo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import {
  cancelAnimation,
  Easing,
  interpolate,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { mergeCellOrigin, type MergeBoardGeometry } from '@/utils/merge-world/board-geometry';

export const GPU_SPAWN_BURST_SLOT_IDS = [0, 1, 2, 3, 4, 5] as const;

export const GPU_SPAWN_PARTICLES = [
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

/** A permanent GPU particle surface; spawn events update six reusable slots. */
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
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      {GPU_SPAWN_BURST_SLOT_IDS.map((slotId) => (
        <GpuSpawnBurstSlot
          burst={bursts.find((burst) => burst.id % GPU_SPAWN_BURST_SLOT_IDS.length === slotId) ?? null}
          geometry={geometry}
          key={slotId}
          size={size}
        />
      ))}
    </Canvas>
  );
});

function GpuSpawnBurstSlot({ burst, geometry, size }: {
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
    if (burst) progress.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(progress);
  }, [burst, progress]);

  const haloPath = usePathValue((path) => {
    'worklet';
    const p = progress.value;
    if (p <= 0 || p >= 1) return;
    const scale = interpolate(p, [0, 1], [0.35, 1.55]);
    path.addCircle(centerX, centerY, size * 0.39 * scale);
  });
  const haloOpacity = useDerivedValue(() => interpolate(
    progress.value,
    [0, 0.14, 0.7, 1],
    [0, 0.72, 0.22, 0],
  ));

  return (
    <>
      <Path color="rgba(255,205,112,0.24)" opacity={haloOpacity} path={haloPath} />
      <Path color="rgba(255,239,190,0.72)" opacity={haloOpacity} path={haloPath} style="stroke" strokeWidth={1.5} />
      {GPU_SPAWN_PARTICLES.map((particle, index) => (
        <GpuSpawnParticle
          centerX={centerX}
          centerY={centerY}
          index={index}
          key={index}
          particle={particle}
          progress={progress}
          size={size}
        />
      ))}
    </>
  );
}

function GpuSpawnParticle({ centerX, centerY, index, particle, progress, size }: {
  centerX: number;
  centerY: number;
  index: number;
  particle: (typeof GPU_SPAWN_PARTICLES)[number];
  progress: SharedValue<number>;
  size: number;
}) {
  const particlePath = usePathValue((path) => {
    'worklet';
    const delayed = Math.max(0, Math.min(1, (progress.value - index * 0.018) / (1 - index * 0.018)));
    if (delayed <= 0 || delayed >= 1) return;
    const travel = interpolate(delayed, [0, 1], [size * 0.08, size * particle.distance]);
    const x = centerX + Math.cos(particle.angle) * travel;
    const y = centerY + Math.sin(particle.angle) * travel + delayed * delayed * size * 0.12;
    const scale = interpolate(delayed, [0, 0.24, 1], [0.3, 1.1, 0.25]);
    path.addCircle(x, y, particle.size * scale / 2);
  });
  const opacity = useDerivedValue(() => {
    const delayed = Math.max(0, Math.min(1, (progress.value - index * 0.018) / (1 - index * 0.018)));
    return interpolate(delayed, [0, 0.16, 0.72, 1], [0, 1, 0.72, 0]);
  });
  return <Path color={particle.color} opacity={opacity} path={particlePath} />;
}
