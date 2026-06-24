import { WORLD_STORAGE_KEY } from '@/constants/world';
import type { WorldState } from '@/types/world';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { EMPTY_WORLD, WORLD_VERSION } from '@/utils/world-build';

export function loadWorldState(): WorldState {
  const state = getStoredJson<WorldState>(WORLD_STORAGE_KEY, EMPTY_WORLD);
  // A stale-version world (v1 archetype-anchor patches) is discarded so buildWorld
  // re-derives every day as a unified cell-based capsule on next sync.
  if (!state || state.version !== WORLD_VERSION || !Array.isArray(state.patches)) {
    return EMPTY_WORLD;
  }
  return state;
}

export function saveWorldState(state: WorldState) {
  setStoredJson(WORLD_STORAGE_KEY, state);
}
