import type { WispCollectionState } from '@/types/wisp';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { EMPTY_WISP_STATE, normalizeWispState } from '@/utils/wisp-state';

export const WISP_STORAGE_KEY = 'katchimera.wisps.v1';

export function loadWispState() {
  return normalizeWispState(getStoredJson<unknown>(WISP_STORAGE_KEY, EMPTY_WISP_STATE));
}

export function saveWispState(state: WispCollectionState) {
  const normalized = normalizeWispState(state);
  setStoredJson(WISP_STORAGE_KEY, normalized);
  return normalized;
}
