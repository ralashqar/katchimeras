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
const DEV_BASE_KEY = 'katchadeck.dev-kingdom-base-v1';
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
