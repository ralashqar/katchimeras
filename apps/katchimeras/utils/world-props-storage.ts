import { getStoredJson, setStoredJson } from '@/utils/app-storage';

const STORAGE_KEY = 'katchadeck.world-props-v1';

export type WorldPropsState = {
  version: 1;
  starterPropId: string | null;
  seenPropIds: string[];
};

export const defaultWorldPropsState: WorldPropsState = {
  version: 1,
  starterPropId: null,
  seenPropIds: [],
};

export function loadWorldPropsState(): WorldPropsState {
  const stored = getStoredJson<Partial<WorldPropsState>>(STORAGE_KEY, defaultWorldPropsState);
  return {
    ...defaultWorldPropsState,
    ...stored,
    version: 1,
    starterPropId: stored?.starterPropId ?? null,
    seenPropIds: Array.isArray(stored?.seenPropIds) ? stored.seenPropIds : [],
  };
}

export function saveWorldPropsState(state: WorldPropsState) {
  setStoredJson(STORAGE_KEY, { ...state, version: 1 });
}

export function chooseStarterProp(state: WorldPropsState, starterPropId: string): WorldPropsState {
  return {
    ...state,
    version: 1,
    starterPropId,
    seenPropIds: Array.from(new Set([...state.seenPropIds, starterPropId])),
  };
}

export function markWorldPropSeen(state: WorldPropsState, propId: string): WorldPropsState {
  if (state.seenPropIds.includes(propId)) return state;
  return {
    ...state,
    version: 1,
    seenPropIds: [...state.seenPropIds, propId],
  };
}
