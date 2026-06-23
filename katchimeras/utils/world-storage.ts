import { WORLD_STORAGE_KEY } from '@/constants/world';
import type { WorldState } from '@/types/world';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { EMPTY_WORLD } from '@/utils/world-build';

export function loadWorldState(): WorldState {
  const state = getStoredJson<WorldState>(WORLD_STORAGE_KEY, EMPTY_WORLD);
  if (!state || state.version !== 1 || !Array.isArray(state.patches)) {
    return EMPTY_WORLD;
  }
  return state;
}

export function saveWorldState(state: WorldState) {
  setStoredJson(WORLD_STORAGE_KEY, state);
}
