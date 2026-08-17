import type { ImageSourcePropType } from 'react-native';

import {
  CREATURE_HATCHLING_SOURCES,
  type CreatureHatchlingLod,
} from '@/constants/creature-hatchling-sources.gen';
import { CREATURE_LOD_SOURCES } from '@/constants/creature-lod-sources.gen';
import { homeCreatureVisuals } from '@/constants/home-mvp';
import type { HomeVisualKey } from '@/types/home';
import { resolveCreatureVariantSource } from '@/utils/creature-variant';

export type CreatureGrowthStage = 'hatchling' | 'grown';

type CreatureArtOptions = {
  lod?: CreatureHatchlingLod;
  stage?: CreatureGrowthStage;
  variantCell?: string | null;
};

function hatchlingSource(
  visualKey: HomeVisualKey,
  lod: CreatureHatchlingLod,
): ImageSourcePropType | null {
  if (lod === 'thumb') {
    return CREATURE_HATCHLING_SOURCES.thumb[visualKey]
      ?? CREATURE_HATCHLING_SOURCES.medium[visualKey]
      ?? CREATURE_HATCHLING_SOURCES.full[visualKey]
      ?? null;
  }
  if (lod === 'medium') {
    return CREATURE_HATCHLING_SOURCES.medium[visualKey]
      ?? CREATURE_HATCHLING_SOURCES.full[visualKey]
      ?? null;
  }
  return CREATURE_HATCHLING_SOURCES.full[visualKey] ?? null;
}

function grownSource(
  visualKey: HomeVisualKey,
  lod: CreatureHatchlingLod,
  variantCell?: string | null,
): ImageSourcePropType {
  const expression = resolveCreatureVariantSource(visualKey, variantCell);
  if (expression) return expression;
  if (lod === 'thumb') {
    return CREATURE_LOD_SOURCES.thumb[visualKey]
      ?? CREATURE_LOD_SOURCES.medium[visualKey]
      ?? homeCreatureVisuals[visualKey].source;
  }
  if (lod === 'medium') {
    return CREATURE_LOD_SOURCES.medium[visualKey]
      ?? homeCreatureVisuals[visualKey].source;
  }
  return homeCreatureVisuals[visualKey].source;
}

export function hasCreatureHatchlingArt(visualKey: HomeVisualKey): boolean {
  return CREATURE_HATCHLING_SOURCES.full[visualKey] != null;
}

/**
 * Runtime source of truth for creature art. Persistent companions use their
 * original Katchimera cutout by default. Hatchling art remains available only
 * to a caller that explicitly owns a hatch-specific presentation.
 */
export function resolveCreatureArtSource(
  visualKey: HomeVisualKey,
  {
    lod = 'full',
    stage = 'grown',
    variantCell = null,
  }: CreatureArtOptions = {},
): ImageSourcePropType {
  if (stage === 'hatchling') {
    const source = hatchlingSource(visualKey, lod);
    if (source) return source;
  }
  return grownSource(visualKey, lod, variantCell);
}
