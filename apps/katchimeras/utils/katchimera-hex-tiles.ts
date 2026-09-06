import type { ImageSourcePropType } from 'react-native';

import { DEV_TOOLS_ENABLED } from '@/constants/dev';
import { KATCHIMERA_HEX_TILE_CATALOG, KATCHIMERA_HEX_TILE_SOURCES } from '@/constants/katchimera-hex-tile-sources.gen';
import type { HomeVisualKey } from '@/types/home';
import type { KingdomCreature } from '@/types/kingdom';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import type { AssetLabIteration } from '@/utils/asset-lab';
import type { KingdomHexTileSpec } from '@/utils/world-visuals';

export type KatchimeraHexTileOverride = {
  uri: string;
  alphaBounds: KingdomHexTileSpec['alphaBounds'];
  prompt?: string;
  updatedAt: string;
};

export type KatchimeraHexTileOverrideManifest = {
  byCreatureId: Record<string, KatchimeraHexTileOverride>;
  byVisualKey: Partial<Record<HomeVisualKey, KatchimeraHexTileOverride>>;
  selectedVariantByVisualKey: Partial<Record<HomeVisualKey, string>>;
  history: Record<string, AssetLabIteration[]>;
};

const EMPTY_MANIFEST: KatchimeraHexTileOverrideManifest = {
  byCreatureId: {},
  byVisualKey: {},
  selectedVariantByVisualKey: {},
  history: {},
};
const OVERRIDE_KEY = 'katchadeck.dev-katchimera-hex-tile-overrides-v1';

let overrideManifest: KatchimeraHexTileOverrideManifest | undefined;

function manifest(): KatchimeraHexTileOverrideManifest {
  if (!DEV_TOOLS_ENABLED) return EMPTY_MANIFEST;
  if (!overrideManifest) {
    overrideManifest = getStoredJson<KatchimeraHexTileOverrideManifest>(OVERRIDE_KEY, EMPTY_MANIFEST);
  }
  return overrideManifest;
}

export function loadKatchimeraHexTileOverrides(): KatchimeraHexTileOverrideManifest {
  return manifest();
}

export function saveKatchimeraHexTileOverrides(next: KatchimeraHexTileOverrideManifest): void {
  if (!DEV_TOOLS_ENABLED) return;
  overrideManifest = {
    byCreatureId: { ...next.byCreatureId },
    byVisualKey: { ...next.byVisualKey },
    selectedVariantByVisualKey: { ...(next.selectedVariantByVisualKey ?? {}) },
    history: { ...(next.history ?? {}) },
  };
  setStoredJson(OVERRIDE_KEY, overrideManifest);
}

export function setKatchimeraHexTileOverride(
  scope: { creatureId?: string | null; visualKey: HomeVisualKey },
  override: KatchimeraHexTileOverride | null
): KatchimeraHexTileOverrideManifest {
  if (!DEV_TOOLS_ENABLED) return EMPTY_MANIFEST;
  const current = manifest();
  const next: KatchimeraHexTileOverrideManifest = {
    byCreatureId: { ...current.byCreatureId },
    byVisualKey: { ...current.byVisualKey },
    selectedVariantByVisualKey: { ...(current.selectedVariantByVisualKey ?? {}) },
    history: { ...(current.history ?? {}) },
  };
  if (scope.creatureId) {
    if (override) next.byCreatureId[scope.creatureId] = override;
    else delete next.byCreatureId[scope.creatureId];
  } else if (override) {
    next.byVisualKey[scope.visualKey] = override;
  } else {
    delete next.byVisualKey[scope.visualKey];
  }
  saveKatchimeraHexTileOverrides(next);
  return next;
}

export function setKatchimeraHexTileVariantSelection(
  visualKey: HomeVisualKey,
  variantId: string | null
): KatchimeraHexTileOverrideManifest {
  if (!DEV_TOOLS_ENABLED) return EMPTY_MANIFEST;
  const current = manifest();
  const next: KatchimeraHexTileOverrideManifest = {
    byCreatureId: { ...current.byCreatureId },
    byVisualKey: { ...current.byVisualKey },
    selectedVariantByVisualKey: { ...(current.selectedVariantByVisualKey ?? {}) },
    history: { ...(current.history ?? {}) },
  };
  if (variantId) {
    next.selectedVariantByVisualKey[visualKey] = variantId;
  } else {
    delete next.selectedVariantByVisualKey[visualKey];
  }
  saveKatchimeraHexTileOverrides(next);
  return next;
}

function overrideToSpec(override: KatchimeraHexTileOverride): KingdomHexTileSpec {
  return {
    source: { uri: override.uri },
    alphaBounds: override.alphaBounds,
  };
}

function bundledTileForVisualKey(visualKey: HomeVisualKey): KingdomHexTileSpec | null {
  const catalogEntry = KATCHIMERA_HEX_TILE_CATALOG[visualKey];
  const selectedVariantId = manifest().selectedVariantByVisualKey?.[visualKey] ?? catalogEntry?.selectedVariantId;
  const selected =
    catalogEntry?.variants.find((variant) => variant.id === selectedVariantId) ??
    catalogEntry?.variants.find((variant) => variant.id === catalogEntry.defaultVariantId);
  if (selected) {
    return { source: selected.source, sources: selected.sources, alphaBounds: selected.alphaBounds };
  }
  const bundled = KATCHIMERA_HEX_TILE_SOURCES[visualKey];
  return bundled ?? null;
}

export function katchimeraHexTileForCreature(creature: KingdomCreature): KingdomHexTileSpec | null {
  return katchimeraHexTileForIdentity(creature);
}

export function katchimeraHexTileForIdentity(
  creature: Pick<KingdomCreature, 'creatureId' | 'visualKey'>
): KingdomHexTileSpec | null {
  const overrides = manifest();
  const creatureOverride = overrides.byCreatureId[creature.creatureId];
  if (creatureOverride) return overrideToSpec(creatureOverride);
  const visualOverride = overrides.byVisualKey[creature.visualKey];
  if (visualOverride) return overrideToSpec(visualOverride);
  return bundledTileForVisualKey(creature.visualKey);
}

export function katchimeraHexTileSourceForVisualKey(visualKey: HomeVisualKey): ImageSourcePropType | null {
  const override = manifest().byVisualKey[visualKey];
  if (override) return { uri: override.uri };
  return bundledTileForVisualKey(visualKey)?.source ?? null;
}
