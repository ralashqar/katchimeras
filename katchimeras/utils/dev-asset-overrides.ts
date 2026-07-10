import type { ImageSourcePropType } from 'react-native';

import { getStoredJson, setStoredJson } from '@/utils/app-storage';

// DEV-ONLY live overrides for world assets: the Asset Lab points an assetKey at
// a locally-saved draft (documents dir) so the real Kingdom renders it without
// a rebuild. worldAssetSource consults this FIRST in dev builds; production
// builds always resolve the bundled art. Hydrated from the Asset Lab manifest
// (utils/asset-lab.ts) — opening the lab (or saving from it) applies them.
let overrides: Record<string, string> = {};

export function setDevAssetOverridesMap(next: Record<string, string>): void {
  overrides = { ...next };
}

export function getDevAssetOverrideUri(assetKey: string): string | null {
  if (!__DEV__) return null;
  return overrides[assetKey] ?? null;
}

export function getDevAssetOverrideSource(assetKey: string): ImageSourcePropType | null {
  const uri = getDevAssetOverrideUri(assetKey);
  return uri ? { uri } : null;
}

// --- Kingdom base override (dev) --------------------------------------------
// The Asset Lab can point the CENTRE island at any registered base id for live
// comparison. Persisted so it survives reloads; production always ignores it.
// v2: retired the pre-residents override (it pinned every tile to one debug
// base, hiding the nest-capital + garden-ring defaults on existing installs).
const DEV_BASE_KEY = 'katchadeck.dev-kingdom-base-v2';
let devKingdomBaseId: string | null | undefined;

export function getDevKingdomBaseId(): string | null {
  if (!__DEV__) return null;
  if (devKingdomBaseId === undefined) {
    devKingdomBaseId = getStoredJson<string | null>(DEV_BASE_KEY, null);
  }
  return devKingdomBaseId ?? null;
}

export function setDevKingdomBaseId(baseId: string | null): void {
  devKingdomBaseId = baseId;
  setStoredJson(DEV_BASE_KEY, baseId);
}

// --- Kingdom hex tile overrides (dev) ---------------------------------------
// The Asset Lab can switch center and resident/base hex tile art independently.
// null = bundled default variant. Production always ignores it.
const DEV_HEX_TILE_SET_KEY = 'katchadeck.dev-kingdom-hex-tile-set-v1';
const DEV_HEX_CENTER_TILE_KEY = 'katchadeck.dev-kingdom-hex-center-tile-v2';
const DEV_HEX_BASE_TILE_KEY = 'katchadeck.dev-kingdom-hex-base-tile-v1';
let devKingdomHexCenterTileId: string | null | undefined;
let devKingdomHexBaseTileId: string | null | undefined;

export function getDevKingdomHexTileSetId(): string | null {
  return getDevKingdomHexBaseTileId();
}

export function setDevKingdomHexTileSetId(tileSetId: string | null): void {
  setDevKingdomHexBaseTileId(tileSetId);
}

export function getDevKingdomHexCenterTileId(): string | null {
  if (!__DEV__) return null;
  if (devKingdomHexCenterTileId === undefined) {
    devKingdomHexCenterTileId = getStoredJson<string | null>(DEV_HEX_CENTER_TILE_KEY, null);
    if (devKingdomHexCenterTileId === null) {
      const legacySetId = getStoredJson<string | null>(DEV_HEX_TILE_SET_KEY, null);
      if (legacySetId === 'plaza_grass_v2' || legacySetId === 'plaza_dense_grass_v2') {
        devKingdomHexCenterTileId = 'plaza';
      }
    }
  }
  return devKingdomHexCenterTileId ?? null;
}

export function setDevKingdomHexCenterTileId(tileId: string | null): void {
  devKingdomHexCenterTileId = tileId;
  setStoredJson(DEV_HEX_CENTER_TILE_KEY, tileId);
}

export function getDevKingdomHexBaseTileId(): string | null {
  if (!__DEV__) return null;
  if (devKingdomHexBaseTileId === undefined) {
    devKingdomHexBaseTileId = getStoredJson<string | null>(DEV_HEX_BASE_TILE_KEY, null);
    if (devKingdomHexBaseTileId === null) {
      const legacySetId = getStoredJson<string | null>(DEV_HEX_TILE_SET_KEY, null);
      if (legacySetId === 'plaza_grass_v2') {
        devKingdomHexBaseTileId = 'smooth_grass';
      } else if (legacySetId === 'plaza_dense_grass_v2') {
        devKingdomHexBaseTileId = 'dense_grass';
      }
    }
  }
  return devKingdomHexBaseTileId ?? null;
}

export function setDevKingdomHexBaseTileId(tileId: string | null): void {
  devKingdomHexBaseTileId = tileId;
  setStoredJson(DEV_HEX_BASE_TILE_KEY, tileId);
}
