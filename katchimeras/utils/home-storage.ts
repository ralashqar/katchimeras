import { getStoredJson, removeStoredValue, setStoredJson } from '@/utils/app-storage';
import { HOME_STORAGE_KEY } from '@/constants/home-mvp';
import type { StoredHomeState } from '@/types/home';

export function loadStoredHomeState() {
  return getStoredJson<StoredHomeState | null>(HOME_STORAGE_KEY, null);
}

export function saveStoredHomeState(state: StoredHomeState) {
  setStoredJson(HOME_STORAGE_KEY, state);
}

export function clearStoredHomeState() {
  removeStoredValue(HOME_STORAGE_KEY);
}
