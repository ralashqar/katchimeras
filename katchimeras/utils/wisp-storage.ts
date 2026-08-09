import type { WispCollectionState } from '@/types/wisp';
import { getStoredJson, getStoredRaw, setStoredJson } from '@/utils/app-storage';
import { EMPTY_WISP_STATE, normalizeWispState } from '@/utils/wisp-state';

export const WISP_STORAGE_KEY = 'katchimera.wisps.v2';
const LEGACY_WISP_STORAGE_KEY = 'katchimera.wisps.v1';

export function loadWispState() {
  const source = getStoredRaw(WISP_STORAGE_KEY) ? WISP_STORAGE_KEY : LEGACY_WISP_STORAGE_KEY;
  return normalizeWispState(getStoredJson<unknown>(source, EMPTY_WISP_STATE));
}

export function saveWispState(state: WispCollectionState) {
  const normalized = normalizeWispState(state);
  setStoredJson(WISP_STORAGE_KEY, normalized);
  return normalized;
}
