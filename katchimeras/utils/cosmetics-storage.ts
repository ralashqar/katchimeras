import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import type { CosmeticState, CosmeticType } from '@/types/cosmetics';
import { lanternColourValue } from '@/utils/cosmetics-engine';
import { loadDiscoveryState } from '@/utils/discoveries-storage';
import { loadEssenceState } from '@/utils/essence-storage';

// Persistence for the user's cosmetic selections (which lantern colour, etc.).
const STORAGE_KEY = 'katchimera.cosmetics.v1';
const EMPTY: CosmeticState = { version: 1, selected: {} };

export function loadCosmeticState(): CosmeticState {
  const stored = getStoredJson<CosmeticState>(STORAGE_KEY, EMPTY);
  if (!stored || stored.version !== 1 || typeof stored.selected !== 'object' || stored.selected === null) {
    return EMPTY;
  }
  return stored;
}

export function saveCosmeticState(state: CosmeticState): void {
  setStoredJson(STORAGE_KEY, state);
}

export function setCosmeticSelection(state: CosmeticState, type: CosmeticType, id: string): CosmeticState {
  return { version: 1, selected: { ...state.selected, [type]: id } };
}

// Synchronous resolver of the active lantern colour for screens outside the World
// tab (today page, hatch reveals) that don't run the discoveries/cosmetics hooks.
// Reads both stores directly; undefined = the egg's natural day colour.
export function currentLanternColour(): string | undefined {
  const unlocked = new Set(Object.keys(loadDiscoveryState().unlocked));
  const purchases = loadEssenceState().purchases;
  return lanternColourValue(loadCosmeticState(), unlocked, purchases);
}
