import { WISP_CATALOG_VERSION, WISPS_BY_ID } from '@/constants/wisps';
import type { WispCollectionState, WispId } from '@/types/wisp';

export const EMPTY_WISP_STATE: WispCollectionState = {
  version: 1,
  equippedWispId: null,
  unlocked: {},
  baselinedCatalogVersion: 0,
};

export function normalizeWispState(value: unknown): WispCollectionState {
  if (!value || typeof value !== 'object') return EMPTY_WISP_STATE;
  const candidate = value as Partial<WispCollectionState>;
  const unlocked: WispCollectionState['unlocked'] = {};
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
  const equipped = candidate.equippedWispId && unlocked[candidate.equippedWispId] && WISPS_BY_ID.has(candidate.equippedWispId)
    ? candidate.equippedWispId : null;
  return {
    version: 1,
    equippedWispId: equipped,
    unlocked,
    baselinedCatalogVersion: Math.max(0, Math.min(Number(candidate.baselinedCatalogVersion) || 0, WISP_CATALOG_VERSION)),
  };
}
