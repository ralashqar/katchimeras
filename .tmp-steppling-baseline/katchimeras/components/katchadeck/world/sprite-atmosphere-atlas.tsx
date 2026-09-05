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
const JOURNEY_BREEZE_ATLAS = require('../../../assets/images/katchimeras/atmosphere/journey-breeze-atlas-v1.webp');
const DREAM_WISPS_ATLAS = require('../../../assets/images/katchimeras/atmosphere/dream-wisps-atlas-v2.png');
const SOCIAL_RIBBONS_ATLAS = require('../../../assets/images/katchimeras/atmosphere/social-ribbons-atlas-v1.png');
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
  axis?: 'horizontal' | 'vertical';
  baseCellSize: number;
  flowSpeed: number;
  rotationSpeed: number;
  spriteIndices: readonly number[];
  sway: number;
};

const SPRITE_PRESETS: Partial<Record<AtmospherePresetId, SpritePreset>> = {
  celebration_drift: {
    axis: 'vertical',
    baseCellSize: 48,
    flowSpeed: 0.018,
    rotationSpeed: 0.00046,
    spriteIndices: [8, 9, 10, 11],
    sway: 28,
  },
  dandelion_seeds: {
    axis: 'vertical',
    baseCellSize: 54,
    flowSpeed: 0.009,
    rotationSpeed: 0.00009,
    spriteIndices: [12, 13, 14, 15],
    sway: 34,
  },
  falling_leaves: {
    axis: 'vertical',
    baseCellSize: 66,
    flowSpeed: 0.014,
    rotationSpeed: 0.00032,
    spriteIndices: [0, 1, 2, 3],
    sway: 42,
  },
  petal_drift: {
    axis: 'vertical',
    baseCellSize: 48,
    flowSpeed: 0.012,
    rotationSpeed: 0.00024,
    // The first pink petal is intentionally omitted: its source highlight is
    // too close to the matte key colour. The remaining three are clean.
    spriteIndices: [5, 6, 7],
    sway: 36,
  },
  journey_breeze: {
    axis: 'horizontal',
    baseCellSize: 38,
    flowSpeed: 0.028,
    rotationSpeed: 0.0001,
    // The curled and small warm leaves read as carried accents instead of an
    // autumn shower. Wind trails are rendered separately underneath.
    spriteIndices: [3, 2, 1],
    sway: 20,
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
    const flutter = Math.sin(time * 0.0011 * particle.drift + particle.phase);
    const secondaryFlutter = Math.sin(time * 0.00047 + particle.phase * 1.7);
    const horizontal = config.axis === 'horizontal';
    let centerX: number;
    let centerY: number;
    let angle: number;
    if (horizontal) {
      const direction = wind < -0.08 ? -1 : 1;
      const travel = width + targetCellSize * 2;
      const rawX = particle.x * width
        + time * config.flowSpeed * particle.speed * depth * direction;
      centerX = ((rawX % travel) + travel) % travel - targetCellSize;
      centerY = particle.y * height
        + flutter * config.sway * depth
        + secondaryFlutter * 7;
      angle = direction < 0 ? Math.PI : 0;
      angle += time * config.rotationSpeed * particle.drift + flutter * 0.28;
    } else {
      const travel = height + targetCellSize * 2;
      const rawY = particle.y * height + time * config.flowSpeed * particle.speed * depth;
      centerY = ((rawY % travel) + travel) % travel - targetCellSize;
      const rawX = particle.x * width
        + flutter * config.sway * depth
        + secondaryFlutter * 8
        + time * wind * 0.012 * particle.drift;
      const horizontalTravel = width + targetCellSize * 2;
      centerX = ((rawX % horizontalTravel) + horizontalTravel) % horizontalTravel - targetCellSize;
      angle = particle.phase
        + time * config.rotationSpeed * particle.drift
        + flutter * (preset === 'dandelion_seeds' ? 0.12 : 0.48);
    }
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
      opacity={preset === 'journey_breeze'
        ? Math.min(0.78, 0.4 + intensity * 0.32)
        : Math.min(1, 0.64 + intensity * 0.34)}
      sprites={sprites}
      transforms={transforms}
    />
  );
}

/**
 * Rendered gust artwork for Journey Breeze. The atlas contains four broad,
 * dimensional wind forms; a sparse subset is animated in one draw call while
 * the regular sprite atlas supplies the smaller carried leaves.
 */
export function JourneyBreezeSpriteAtlas({
  elapsed,
  height,
  intensity,
  particles,
  reduceMotion,
  width,
  wind,
}: Omit<SpriteAtmosphereAtlasProps, 'preset'>) {
  const image = useImage(JOURNEY_BREEZE_ATLAS);
  const gusts = useMemo(
    () => particles.filter((_, index) => index % 2 === 0),
    [particles],
  );
  const cellWidth = image ? image.width() / 2 : 0;
  const cellHeight = image ? image.height() / 2 : 0;
  const sprites = useMemo<SkRect[]>(() => {
    if (!image) return [];
    return gusts.map((_, index) => {
      const spriteIndex = index % 4;
      return rect(
        (spriteIndex % 2) * cellWidth,
        Math.floor(spriteIndex / 2) * cellHeight,
        cellWidth,
        cellHeight,
      );
    });
  }, [cellHeight, cellWidth, gusts, image]);

  const transforms = useRSXformBuffer(gusts.length, (transform, index) => {
    'worklet';
    const particle = gusts[index];
    if (cellWidth <= 0 || cellHeight <= 0) {
      transform.set(0, 0, -10_000, -10_000);
      return;
    }

    const time = reduceMotion ? 0 : elapsed.value;
    const depth = 0.58 + particle.depth * 0.42;
    // These are ambient wind traces, not foreground characters. The authored
    // atlas has a very readable silhouette, so the previous ~120–210 px draw
    // size overwhelmed the Today scene on phones. Keep each gust near the
    // scale of the carried leaves instead.
    const targetCellSize = (54 + particle.size * 14) * depth;
    const scale = targetCellSize / cellWidth;
    const direction = wind < -0.08 ? -1 : 1;
    const travel = width + targetCellSize * 2;
    const rawX = particle.x * width
      + time * (0.022 + Math.abs(wind) * 0.008) * particle.speed * depth * direction;
    const centerX = ((rawX % travel) + travel) % travel - targetCellSize;
    const flutter = Math.sin(time * 0.00072 * particle.drift + particle.phase);
    const centerY = particle.y * height + flutter * (8 + particle.depth * 10);
    const angle = (direction < 0 ? Math.PI : 0) + flutter * 0.035;
    const scos = Math.cos(angle) * scale;
    const ssin = Math.sin(angle) * scale;
    const pivotX = cellWidth / 2;
    const pivotY = cellHeight / 2;
    transform.set(
      scos,
      ssin,
      centerX - scos * pivotX + ssin * pivotY,
      centerY - ssin * pivotX - scos * pivotY,
    );
  });

  if (!image || sprites.length === 0) return null;

  return (
    <Atlas
      image={image}
      opacity={Math.min(0.62, 0.34 + intensity * 0.24)}
      sprites={sprites}
      transforms={transforms}
    />
  );
}

/**
 * Premium rendered Dream Wisp artwork. The four soft 3D forms live in their
 * own 2x2 atlas, while a sparse particle subset keeps the scene calm and
 * avoids the old procedural line effect.
 */
export function DreamWispSpriteAtlas({
  elapsed,
  height,
  intensity,
  particles,
  reduceMotion,
  width,
  wind,
}: Omit<SpriteAtmosphereAtlasProps, 'preset'>) {
  const image = useImage(DREAM_WISPS_ATLAS);
  const wisps = useMemo(
    () => particles.filter((_, index) => index % 2 === 0),
    [particles],
  );
  const cellWidth = image ? image.width() / 2 : 0;
  const cellHeight = image ? image.height() / 2 : 0;
  const sprites = useMemo<SkRect[]>(() => {
    if (!image) return [];
    return wisps.map((_, index) => {
      const spriteIndex = index % 4;
      return rect(
        (spriteIndex % 2) * cellWidth,
        Math.floor(spriteIndex / 2) * cellHeight,
        cellWidth,
        cellHeight,
      );
    });
  }, [cellHeight, cellWidth, image, wisps]);

  const transforms = useRSXformBuffer(wisps.length, (transform, index) => {
    'worklet';
    const particle = wisps[index];
    if (cellWidth <= 0 || cellHeight <= 0) {
      transform.set(0, 0, -10_000, -10_000);
      return;
    }

    const time = reduceMotion ? 0 : elapsed.value;
    const depth = 0.62 + particle.depth * 0.38;
    const breathe = 1 + Math.sin(time * 0.00072 + particle.phase) * 0.045;
    const targetCellSize = (92 + particle.size * 46) * depth * breathe;
    const scale = targetCellSize / cellWidth;
    const travelY = height + targetCellSize * 2;
    const rawY = particle.y * height
      - time * (0.006 + particle.speed * 0.008) * depth;
    const centerY = ((rawY % travelY) + travelY) % travelY - targetCellSize;
    const drift = Math.sin(time * 0.00048 * particle.drift + particle.phase);
    const secondaryDrift = Math.sin(time * 0.00021 + particle.phase * 1.8);
    const rawX = particle.x * width
      + drift * (16 + particle.depth * 20)
      + secondaryDrift * 8
      + time * wind * 0.003;
    const travelX = width + targetCellSize * 2;
    const centerX = ((rawX % travelX) + travelX) % travelX - targetCellSize;
    const angle = Math.sin(time * 0.00031 + particle.phase) * 0.11
      + wind * 0.025;
    const scos = Math.cos(angle) * scale;
    const ssin = Math.sin(angle) * scale;
    const pivotX = cellWidth / 2;
    const pivotY = cellHeight / 2;
    transform.set(
      scos,
      ssin,
      centerX - scos * pivotX + ssin * pivotY,
      centerY - ssin * pivotX - scos * pivotY,
    );
  });

  if (!image || sprites.length === 0) return null;

  return (
    <Atlas
      image={image}
      opacity={Math.min(0.92, 0.56 + intensity * 0.32)}
      sprites={sprites}
      transforms={transforms}
    />
  );
}

/**
 * Authored satin streamers for Social Ribbons. A sparse subset moves mostly
 * horizontally with restrained roll and lift, keeping the effect readable as
 * an atmospheric accent rather than a full-screen celebration overlay.
 */
export function SocialRibbonSpriteAtlas({
  elapsed,
  height,
  intensity,
  particles,
  reduceMotion,
  width,
  wind,
}: Omit<SpriteAtmosphereAtlasProps, 'preset'>) {
  const image = useImage(SOCIAL_RIBBONS_ATLAS);
  const ribbons = useMemo(
    () => particles.filter((_, index) => index % 2 === 0),
    [particles],
  );
  const cellWidth = image ? image.width() / 2 : 0;
  const cellHeight = image ? image.height() / 2 : 0;
  const sprites = useMemo<SkRect[]>(() => {
    if (!image) return [];
    return ribbons.map((_, index) => {
      const spriteIndex = index % 4;
      return rect(
        (spriteIndex % 2) * cellWidth,
        Math.floor(spriteIndex / 2) * cellHeight,
        cellWidth,
        cellHeight,
      );
    });
  }, [cellHeight, cellWidth, image, ribbons]);

  const transforms = useRSXformBuffer(ribbons.length, (transform, index) => {
    'worklet';
    const particle = ribbons[index];
    if (cellWidth <= 0 || cellHeight <= 0) {
      transform.set(0, 0, -10_000, -10_000);
      return;
    }

    const time = reduceMotion ? 0 : elapsed.value;
    const depth = 0.58 + particle.depth * 0.42;
    const targetCellSize = (70 + particle.size * 34) * depth;
    const scale = targetCellSize / cellWidth;
    const direction = wind < -0.08 ? -1 : 1;
    const travelX = width + targetCellSize * 2;
    const rawX = particle.x * width
      + time * (0.012 + Math.abs(wind) * 0.005) * particle.speed * depth * direction;
    const centerX = ((rawX % travelX) + travelX) % travelX - targetCellSize;
    const float = Math.sin(time * 0.00062 * particle.drift + particle.phase);
    const centerY = particle.y * height
      + float * (10 + particle.depth * 12);
    const angle = (direction < 0 ? Math.PI : 0)
      + Math.sin(time * 0.00028 + particle.phase) * 0.14;
    const scos = Math.cos(angle) * scale;
    const ssin = Math.sin(angle) * scale;
    const pivotX = cellWidth / 2;
    const pivotY = cellHeight / 2;
    transform.set(
      scos,
      ssin,
      centerX - scos * pivotX + ssin * pivotY,
      centerY - ssin * pivotX - scos * pivotY,
    );
  });

  if (!image || sprites.length === 0) return null;

  return (
    <Atlas
      image={image}
      opacity={Math.min(0.88, 0.5 + intensity * 0.3)}
      sprites={sprites}
      transforms={transforms}
    />
  );
}
