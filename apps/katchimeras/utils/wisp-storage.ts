import type { WispCollectionState, WispGrantSource, WispId } from '@/types/wisp';
import { getStoredJson, getStoredRaw, setStoredJson } from '@/utils/app-storage';
import { applyWispGrant, EMPTY_WISP_STATE, normalizeWispState } from '@/utils/wisp-state';

export const WISP_STORAGE_KEY = 'katchimera.wisps.v2';
const LEGACY_WISP_STORAGE_KEY = 'katchimera.wisps.v1';
const listeners = new Set<(state: WispCollectionState) => void>();

export function loadWispState() {
  const source = getStoredRaw(WISP_STORAGE_KEY) ? WISP_STORAGE_KEY : LEGACY_WISP_STORAGE_KEY;
  return normalizeWispState(getStoredJson<unknown>(source, EMPTY_WISP_STATE));
}

export function saveWispState(state: WispCollectionState) {
  const normalized = normalizeWispState(state);
  setStoredJson(WISP_STORAGE_KEY, normalized);
  listeners.forEach((listener) => listener(normalized));
  return normalized;
}

export function subscribeWispState(listener: (state: WispCollectionState) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function grantStoredWisp(
  id: WispId,
  receiptId: string,
  source: WispGrantSource,
  options?: { increaseResonance?: boolean; now?: number; sourceDayId?: string | null },
) {
  const result = applyWispGrant(loadWispState(), id, receiptId, source, options);
  if (result.applied) saveWispState(result.state);
  return result;
}

export function grantStoredJourneyWisp(input: {
  rewardId: string;
  wispId: WispId;
  choiceIds: readonly string[];
  now?: number;
}) {
  const current = loadWispState();
  const existingReceipt = current.journeyRewards?.[input.rewardId];
  if (existingReceipt) return { applied: false, receipt: existingReceipt, state: current };
  const now = input.now ?? Date.now();
  const result = applyWispGrant(current, input.wispId, `journey-wisp:${input.rewardId}`, 'journey', { increaseResonance: true, now });
  const receipt = {
    rewardId: input.rewardId,
    wispId: input.wispId,
    choiceIds: [...new Set(input.choiceIds)],
    grantedAt: now,
    discovered: result.discovered,
    previousCount: result.previousCount,
    nextCount: Math.max(1, result.nextCount),
    seenReveal: false,
  };
  const state = saveWispState({ ...result.state, journeyRewards: { ...(result.state.journeyRewards ?? {}), [input.rewardId]: receipt } });
  return { applied: result.applied, receipt, state };
}

export function acknowledgeStoredJourneyWispReward(rewardId: string) {
  const current = loadWispState();
  const receipt = current.journeyRewards?.[rewardId];
  if (!receipt || receipt.seenReveal) return current;
  const unlock = current.unlocked[receipt.wispId];
  return saveWispState({
    ...current,
    unlocked: unlock ? { ...current.unlocked, [receipt.wispId]: { ...unlock, seenReveal: true } } : current.unlocked,
    journeyRewards: { ...(current.journeyRewards ?? {}), [rewardId]: { ...receipt, seenReveal: true } },
    pendingResonance: current.pendingResonance?.wispId === receipt.wispId ? null : current.pendingResonance,
  });
}
