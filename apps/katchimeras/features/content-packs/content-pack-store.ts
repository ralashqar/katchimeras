import type { ActiveContentPack, ContentRegistrySnapshot } from '@/types/content-pack';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { installContentRecord } from './release';

/**
 * The pack the app keeps between launches: the last one accepted whole, with
 * its art already on the device. Read once at launch before any registry is
 * built (`prime.ts`); written by activation; retained on retirement. Nothing
 * else touches it, so a launch never sees a half-written pack.
 */
const ACTIVE_PACK_KEY = 'katchimeras.content-pack.active.v1';
const REGISTRY_KEY = 'katchimeras.content-registry.v2';

export function loadContentRegistry(): ContentRegistrySnapshot {
  const stored = getStoredJson<ContentRegistrySnapshot | null>(REGISTRY_KEY, null);
  if (stored?.version === 2 && Array.isArray(stored.packs)) return stored;
  const legacy = loadLegacyContentPack();
  return { version: 2, revision: 0, packs: legacy ? [legacy] : [] };
}

export function saveContentRegistry(snapshot: ContentRegistrySnapshot): void {
  // One SQLite-backed value is the activation pointer. Assets are staged first.
  setStoredJson(REGISTRY_KEY, snapshot);
}

export function loadStoredContentPack(): ActiveContentPack | null {
  return loadContentRegistry().packs.at(-1) ?? null;
}

function loadLegacyContentPack(): ActiveContentPack | null {
  const stored = getStoredJson<ActiveContentPack | null>(ACTIVE_PACK_KEY, null);
  if (!stored || typeof stored !== 'object' || !stored.pack || typeof stored.pack !== 'object' || typeof stored.pack.id !== 'string') return null;
  return { pack: stored.pack, artUris: stored.artUris && typeof stored.artUris === 'object' ? stored.artUris : {}, activatedAt: Number(stored.activatedAt) || 0, ...(stored.source === 'remote' || stored.source === 'dev' ? { source: stored.source } : {}) };
}

export function saveStoredContentPack(record: ActiveContentPack): void {
  saveContentRegistry(installContentRecord(loadContentRegistry(), record));
}

export function clearStoredContentPack(): void {
  const snapshot = loadContentRegistry();
  saveContentRegistry({ ...snapshot, revision: snapshot.revision + 1, packs: snapshot.packs.map((record) => ({ ...record, retiredAt: record.retiredAt ?? Date.now() })) });
}
