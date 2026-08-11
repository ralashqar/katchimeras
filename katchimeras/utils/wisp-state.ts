import { WISP_CATALOG_VERSION, WISPS_BY_ID } from '@/constants/wisps';
import type { WispCollectionState, WispId } from '@/types/wisp';

export const EMPTY_WISP_STATE: WispCollectionState = {
  version: 2,
  equippedWispId: null,
  unlocked: {},
  inventory: {},
  baselinedCatalogVersion: 0,
  appliedGrantReceiptIds: [],
};

export function normalizeWispState(value: unknown): WispCollectionState {
  if (!value || typeof value !== 'object') return EMPTY_WISP_STATE;
  const candidate = value as Partial<WispCollectionState>;
  const unlocked: WispCollectionState['unlocked'] = {};
  const inventory: WispCollectionState['inventory'] = {};
  if (candidate.unlocked && typeof candidate.unlocked === 'object') {
    for (const [id, record] of Object.entries(candidate.unlocked)) {
      if (!WISPS_BY_ID.has(id as WispId) || !record || typeof record !== 'object') continue;
      unlocked[id as WispId] = {
        wispId: id as WispId,
        unlockedAt: Number.isFinite(record.unlockedAt) ? record.unlockedAt : 0,
        sourceDayId: typeof record.sourceDayId === 'string' ? record.sourceDayId : null,
        seenReveal: Boolean(record.seenReveal),
      };
    }
  }
  if (candidate.inventory && typeof candidate.inventory === 'object') {
    for (const [id, record] of Object.entries(candidate.inventory)) {
      if (!WISPS_BY_ID.has(id as WispId) || !record || typeof record !== 'object') continue;
      const quantity = Math.max(0, Math.floor(Number(record.quantity) || 0));
      if (!quantity) continue;
      inventory[id as WispId] = {
        wispId: id as WispId,
        quantity,
        sources: Array.isArray(record.sources) ? [...new Set(record.sources)] : ['migration'],
        firstGrantedAt: Number.isFinite(record.firstGrantedAt) ? record.firstGrantedAt : unlocked[id as WispId]?.unlockedAt ?? 0,
        giftableQuantity: Math.max(0, Math.min(quantity - 1, Math.floor(Number(record.giftableQuantity) || 0))),
      };
    }
  }
  for (const [id, record] of Object.entries(unlocked)) {
    if (!record || inventory[id as WispId]) continue;
    inventory[id as WispId] = { wispId: id as WispId, quantity: 1, sources: ['migration'], firstGrantedAt: record.unlockedAt, giftableQuantity: 0 };
  }
  const equipped = candidate.equippedWispId && unlocked[candidate.equippedWispId] && WISPS_BY_ID.has(candidate.equippedWispId)
    ? candidate.equippedWispId : null;
  return {
    version: 2,
    equippedWispId: equipped,
    unlocked,
    inventory,
    baselinedCatalogVersion: Math.max(0, Math.min(Number(candidate.baselinedCatalogVersion) || 0, WISP_CATALOG_VERSION)),
    appliedGrantReceiptIds: Array.isArray(candidate.appliedGrantReceiptIds)
      ? [...new Set(candidate.appliedGrantReceiptIds.filter((id): id is string => typeof id === 'string'))]
      : [],
  };
}
