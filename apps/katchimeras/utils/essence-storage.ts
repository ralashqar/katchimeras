import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import type { EssenceState } from '@/types/essence';

// Persists only what's NOT derivable: spent essence + the purchase receipt. Earned
// is recomputed from history by the engine. See progression-customisation-design §3.
const STORAGE_KEY = 'katchimera.essence.v1';
const EMPTY: EssenceState = { version: 1, spent: 0, purchases: [] };

export function loadEssenceState(): EssenceState {
  const stored = getStoredJson<EssenceState>(STORAGE_KEY, EMPTY);
  if (
    !stored ||
    stored.version !== 1 ||
    typeof stored.spent !== 'number' ||
    !Array.isArray(stored.purchases)
  ) {
    return EMPTY;
  }
  return stored;
}

export function saveEssenceState(state: EssenceState): void {
  setStoredJson(STORAGE_KEY, state);
}

// Records a purchase: adds the cost to `spent` and the id to the receipt. Pure
// (caller persists). Idempotent on the receipt — buying the same id twice won't
// double-charge.
export function recordSpend(state: EssenceState, cosmeticId: string, cost: number): EssenceState {
  if (state.purchases.includes(cosmeticId)) return state;
  return {
    version: 1,
    spent: state.spent + Math.max(0, Math.round(cost)),
    purchases: [...state.purchases, cosmeticId],
  };
}
