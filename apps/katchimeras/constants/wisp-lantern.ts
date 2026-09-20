import type { WispPackDefinition } from '@/types/wisp-lantern';
import type { WispCollectionDefinition } from '@/types/wisp-collections';
import type { WispCatalogItem } from '@/types/wisp';
export const WISP_LANTERN_ENABLED = true;
export const LANTERN_VISITORS = ['dewdrop', 'bubble', 'nimbus', 'clover', 'pebble', 'crystal'] as const;
export const LANTERN_COLLECTION: WispCollectionDefinition = {
  id: 'little-lantern-visitors', name: 'Little Lantern Visitors', description: 'Six small lights looking for somewhere to belong.',
  wispIds: LANTERN_VISITORS, rewardLabel: 'First Gathering habitat', seasonal: false,
};
export const WELCOME_PACK = 'lantern-welcome';
export const WELCOME_RECEIPT = 'lantern:welcome:v2';
export const LANTERN_PATCH = 'front-right' as const;
export const ORDINARY_PACK = 'lantern-pouch';
export const LANTERN_PACKS: readonly WispPackDefinition[] = [
  { id: WELCOME_PACK, version: 2, collectionId: LANTERN_COLLECTION.id, scope: 'local-lantern-v1', slots: 1,
    pool: LANTERN_VISITORS.slice(0, 5).map(id => ({ id, weight: 20 })), distinct: true, guaranteeAfterDryPacks: null },
  { id: WELCOME_PACK, version: 1, collectionId: LANTERN_COLLECTION.id, scope: 'local-lantern-v1', slots: 3,
    pool: LANTERN_VISITORS.slice(0, 5).map(id => ({ id, weight: 20 })), distinct: true, guaranteeAfterDryPacks: null },
  { id: ORDINARY_PACK, version: 1, collectionId: LANTERN_COLLECTION.id, scope: 'local-lantern-v1', slots: 3,
    pool: LANTERN_VISITORS.map(id => ({ id, weight: id === 'crystal' ? 10 : 18 })), distinct: false, guaranteeAfterDryPacks: 2 },
];
export function lanternPackDefinition(id: string, version = id === WELCOME_PACK ? 2 : 1) {
  const definition = LANTERN_PACKS.find(p => p.id === id && p.version === version);
  if (!definition) throw new Error('This pack needs a newer version of the game.');
  return definition;
}
export function validateLanternPacks(catalog: readonly WispCatalogItem[]) {
  for (const pack of LANTERN_PACKS) {
    if (pack.slots < 1 || (pack.distinct && pack.pool.length < pack.slots)) throw new Error('Impossible pack guarantee');
    if (new Set(pack.pool.map(p => p.id)).size !== pack.pool.length) throw new Error('Duplicate pack identity');
    for (const entry of pack.pool) {
      const wisp = catalog.find(item => item.id === entry.id);
      if (!wisp || wisp.availability !== 'ready' || !wisp.packEligible || wisp.semanticClass !== 'cosmetic' || entry.weight <= 0) throw new Error(`Invalid visitor pack entry: ${entry.id}`);
    }
  }
}
