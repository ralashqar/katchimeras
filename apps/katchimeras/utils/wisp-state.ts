import { WISP_CATALOG_VERSION, WISPS_BY_ID } from '@/constants/wisps';
import type { WispCollectionState, WispGrantSource, WispId } from '@/types/wisp';

export type WispGrantResult = {
  applied: boolean;
  discovered: boolean;
  previousCount: number;
  nextCount: number;
  state: WispCollectionState;
};

export const EMPTY_WISP_STATE: WispCollectionState = {
  version: 2,
  equippedWispId: null,
  unlocked: {},
  inventory: {},
  baselinedCatalogVersion: 0,
  appliedGrantReceiptIds: [],
  resonanceCounts: {},
  pendingResonance: null,
  journeyRewards: {},
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
    resonanceCounts: Object.fromEntries(Object.entries(candidate.resonanceCounts ?? {})
      .filter(([id, count]) => WISPS_BY_ID.has(id as WispId) && Number.isFinite(count))
      .map(([id, count]) => [id, Math.max(0, Math.floor(Number(count)))])),
    pendingResonance: candidate.pendingResonance
      && WISPS_BY_ID.has(candidate.pendingResonance.wispId)
      && Number.isFinite(candidate.pendingResonance.previousCount)
      && Number.isFinite(candidate.pendingResonance.nextCount)
      ? {
          wispId: candidate.pendingResonance.wispId,
          previousCount: Math.max(1, Math.floor(candidate.pendingResonance.previousCount)),
          nextCount: Math.max(2, Math.floor(candidate.pendingResonance.nextCount)),
        }
      : null,
    journeyRewards: Object.fromEntries(Object.entries(candidate.journeyRewards ?? {}).filter(([rewardId, receipt]) => (
      Boolean(rewardId)
      && Boolean(receipt)
      && WISPS_BY_ID.has(receipt.wispId)
      && Number.isFinite(receipt.grantedAt)
    )).map(([rewardId, receipt]) => [rewardId, {
      rewardId,
      wispId: receipt!.wispId,
      choiceIds: Array.isArray(receipt!.choiceIds) ? receipt!.choiceIds.filter((id): id is string => typeof id === 'string') : [],
      grantedAt: receipt!.grantedAt,
      discovered: Boolean(receipt!.discovered),
      previousCount: Math.max(0, Math.floor(Number(receipt!.previousCount) || 0)),
      nextCount: Math.max(1, Math.floor(Number(receipt!.nextCount) || 1)),
      seenReveal: Boolean(receipt!.seenReveal),
    }])),
  };
}

/** Pure, receipt-idempotent grant shared by UI and story-flow reward effects. */
export function applyWispGrant(
  input: WispCollectionState,
  id: WispId,
  receiptId: string,
  source: WispGrantSource,
  options: { increaseResonance?: boolean; now?: number; sourceDayId?: string | null } = {},
): WispGrantResult {
  const state = normalizeWispState(input);
  const existing = state.inventory[id];
  // An already-owned Wisp represents its first point of Resonance even when
  // it predates the Resonance counter. This keeps migrated saves and modern
  // Journey rewards on the same 1 -> 2 duplicate progression.
  const previousCount = existing ? Math.max(1, state.resonanceCounts?.[id] ?? 0) : 0;
  if (!receiptId || (state.appliedGrantReceiptIds ?? []).includes(receiptId)) {
    return { applied: false, discovered: !existing, previousCount, nextCount: previousCount, state };
  }
  const now = options.now ?? Date.now();
  const quantity = (existing?.quantity ?? 0) + 1;
  const nextCount = options.increaseResonance ? previousCount + 1 : previousCount;
  const next = normalizeWispState({
    ...state,
    unlocked: {
      ...state.unlocked,
      [id]: state.unlocked[id] ?? { wispId: id, unlockedAt: now, sourceDayId: options.sourceDayId ?? null, seenReveal: false },
    },
    inventory: {
      ...state.inventory,
      [id]: {
        wispId: id,
        quantity,
        sources: [...new Set([...(existing?.sources ?? []), source])],
        firstGrantedAt: existing?.firstGrantedAt ?? now,
        giftableQuantity: Math.max(existing?.giftableQuantity ?? 0, quantity - 1),
      },
    },
    appliedGrantReceiptIds: [...(state.appliedGrantReceiptIds ?? []), receiptId],
    resonanceCounts: options.increaseResonance ? { ...(state.resonanceCounts ?? {}), [id]: nextCount } : state.resonanceCounts,
    pendingResonance: options.increaseResonance && existing
      ? { wispId: id, previousCount: Math.max(1, previousCount), nextCount: Math.max(2, nextCount) }
      : state.pendingResonance,
  });
  return { applied: true, discovered: !existing, previousCount, nextCount, state: next };
}
