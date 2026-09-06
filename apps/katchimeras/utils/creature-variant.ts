import type { ImageSourcePropType } from 'react-native';

import type { HomeVisualKey } from '@/types/home';

// Pre-rendered 4x4 expression grids, sliced into `<mood>_<bondDepth>` true-alpha
// cutouts (see data/katchimeras/creature-variants.json +
// scripts/slice-variant-grid.py). The day's mood (its emotional read) and bond
// depth (how it fits your history) — both from utils/reflection-context.ts —
// index the cell. Only creatures with a generated grid appear here; every other
// creature falls back to the single base cutout in homeCreatureVisuals.

const bedrotteVariants: Record<string, ImageSourcePropType> = {
  cozy_fresh: require('@incubator/art-cutouts/variants/bedrotte/cozy_fresh.png'),
  cozy_familiar: require('@incubator/art-cutouts/variants/bedrotte/cozy_familiar.png'),
  cozy_deep: require('@incubator/art-cutouts/variants/bedrotte/cozy_deep.png'),
  cozy_knowing: require('@incubator/art-cutouts/variants/bedrotte/cozy_knowing.png'),
  restless_fresh: require('@incubator/art-cutouts/variants/bedrotte/restless_fresh.png'),
  restless_familiar: require('@incubator/art-cutouts/variants/bedrotte/restless_familiar.png'),
  restless_deep: require('@incubator/art-cutouts/variants/bedrotte/restless_deep.png'),
  restless_knowing: require('@incubator/art-cutouts/variants/bedrotte/restless_knowing.png'),
  tender_fresh: require('@incubator/art-cutouts/variants/bedrotte/tender_fresh.png'),
  tender_familiar: require('@incubator/art-cutouts/variants/bedrotte/tender_familiar.png'),
  tender_deep: require('@incubator/art-cutouts/variants/bedrotte/tender_deep.png'),
  tender_knowing: require('@incubator/art-cutouts/variants/bedrotte/tender_knowing.png'),
  defiant_fresh: require('@incubator/art-cutouts/variants/bedrotte/defiant_fresh.png'),
  defiant_familiar: require('@incubator/art-cutouts/variants/bedrotte/defiant_familiar.png'),
  defiant_deep: require('@incubator/art-cutouts/variants/bedrotte/defiant_deep.png'),
  defiant_knowing: require('@incubator/art-cutouts/variants/bedrotte/defiant_knowing.png'),
};

export const creatureVariantSources: Partial<Record<HomeVisualKey, Record<string, ImageSourcePropType>>> = {
  bedrotte: bedrotteVariants,
};

export function resolveVariantCellId(
  mood?: string | null,
  bondDepth?: string | null
): string | null {
  if (!mood || !bondDepth) return null;
  return `${mood}_${bondDepth}`;
}

// The expression cutout for a creature's resolved cell, or null when that
// creature has no grid (or no cell was resolved) — callers fall back to base.
export function resolveCreatureVariantSource(
  visualKey: HomeVisualKey,
  cell?: string | null
): ImageSourcePropType | null {
  if (!cell) return null;
  return creatureVariantSources[visualKey]?.[cell] ?? null;
}
