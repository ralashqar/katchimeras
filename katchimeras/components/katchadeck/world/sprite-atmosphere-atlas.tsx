import {
  Atlas,
  rect,
  useImage,
  useRSXformBuffer,
  type SkRect,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import type {
  AtmosphereParticle,
  AtmospherePresetId,
} from '@/utils/atmosphere';

const PARTICLE_ATLAS = require('../../../assets/images/katchimeras/atmosphere/particle-atlas-v1.png');
const ATLAS_COLUMNS = 4;
const ATLAS_ROWS = 4;

type SpriteAtmosphereAtlasProps = {
  elapsed: SharedValue<number>;
  height: number;
  intensity: number;
  particles: AtmosphereParticle[];
  preset: AtmospherePresetId;
  reduceMotion: boolean;
  width: number;
  wind: number;
};

type SpritePreset = {
  baseCellSize: number;
  fallSpeed: number;
  rotationSpeed: number;
  spriteIndices: readonly number[];
  sway: number;
};

const SPRITE_PRESETS: Partial<Record<AtmospherePresetId, SpritePreset>> = {
  celebration_drift: {
    baseCellSize: 48,
    fallSpeed: 0.018,
    rotationSpeed: 0.00046,
    spriteIndices: [8, 9, 10, 11],
    sway: 28,
  },
  dandelion_seeds: {
    baseCellSize: 54,
    fallSpeed: 0.009,
    rotationSpeed: 0.00009,
    spriteIndices: [12, 13, 14, 15],
    sway: 34,
  },
  falling_leaves: {
    baseCellSize: 66,
    fallSpeed: 0.014,
    rotationSpeed: 0.00032,
    spriteIndices: [0, 1, 2, 3],
    sway: 42,
  },
  petal_drift: {
    baseCellSize: 48,
    fallSpeed: 0.012,
    rotationSpeed: 0.00024,
    // The first pink petal is intentionally omitted: its source highlight is
    // too close to the matte key colour. The remaining three are clean.
    spriteIndices: [5, 6, 7],
    sway: 36,
  },
};

/**
 * Draws every authored particle in one Skia Atlas call. Position, flutter,
 * depth and rotation stay on the UI thread; React never rerenders per frame.
 */
export function SpriteAtmosphereAtlas({
  elapsed,
  height,
  intensity,
  particles,
  preset,
  reduceMotion,
  width,
  wind,
}: SpriteAtmosphereAtlasProps) {
  const image = useImage(PARTICLE_ATLAS);
  const config = SPRITE_PRESETS[preset];
  const cellWidth = image ? image.width() / ATLAS_COLUMNS : 0;
  const cellHeight = image ? image.height() / ATLAS_ROWS : 0;

  const sprites = useMemo<SkRect[]>(() => {
    if (!image || !config) return [];
    return particles.map((_, index) => {
      const spriteIndex = config.spriteIndices[index % config.spriteIndices.length];
      const column = spriteIndex % ATLAS_COLUMNS;
      const row = Math.floor(spriteIndex / ATLAS_COLUMNS);
      return rect(column * cellWidth, row * cellHeight, cellWidth, cellHeight);
    });
  }, [cellHeight, cellWidth, config, image, particles]);

  const transforms = useRSXformBuffer(particles.length, (transform, index) => {
    'worklet';
    const particle = particles[index];
    if (!config || cellWidth <= 0 || cellHeight <= 0) {
      transform.set(0, 0, -10_000, -10_000);
      return;
    }

    const time = reduceMotion ? 0 : elapsed.value;
    const depth = 0.52 + particle.depth * 0.48;
    const targetCellSize = config.baseCellSize * particle.size * depth;
    const scale = targetCellSize / cellWidth;
    const travel = height + targetCellSize * 2;
    const rawY = particle.y * height + time * config.fallSpeed * particle.speed * depth;
    const centerY = ((rawY % travel) + travel) % travel - targetCellSize;
    const flutter = Math.sin(time * 0.0011 * particle.drift + particle.phase);
    const secondaryFlutter = Math.sin(time * 0.00047 + particle.phase * 1.7);
    const rawX = particle.x * width
      + flutter * config.sway * depth
      + secondaryFlutter * 8
      + time * wind * 0.012 * particle.drift;
    const horizontalTravel = width + targetCellSize * 2;
    const centerX = ((rawX % horizontalTravel) + horizontalTravel) % horizontalTravel - targetCellSize;
    const angle = particle.phase
      + time * config.rotationSpeed * particle.drift
      + flutter * (preset === 'dandelion_seeds' ? 0.12 : 0.48);
    const scos = Math.cos(angle) * scale;
    const ssin = Math.sin(angle) * scale;
    const pivotX = cellWidth / 2;
    const pivotY = cellHeight / 2;
    const tx = centerX - scos * pivotX + ssin * pivotY;
    const ty = centerY - ssin * pivotX - scos * pivotY;
    transform.set(scos, ssin, tx, ty);
  });

  if (!image || !config || sprites.length === 0) return null;

  return (
    <Atlas
      image={image}
      opacity={Math.min(1, 0.64 + intensity * 0.34)}
      sprites={sprites}
      transforms={transforms}
    />
  );
}
