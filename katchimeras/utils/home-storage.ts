import { getStoredJson, removeStoredValue, setStoredJson } from '@/utils/app-storage';
import { HOME_STORAGE_KEY } from '@/constants/home-mvp';
import type { StoredHomeState } from '@/types/home';

const listeners = new Set<() => void>();

export function loadStoredHomeState() {
  return getStoredJson<StoredHomeState | null>(HOME_STORAGE_KEY, null);
}

export function saveStoredHomeState(state: StoredHomeState) {
  setStoredJson(HOME_STORAGE_KEY, state);
  notifyHomeStateListeners();
}

export function clearStoredHomeState() {
  removeStoredValue(HOME_STORAGE_KEY);
  notifyHomeStateListeners();
}

export function subscribeHomeStateChanges(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyHomeStateListeners() {
  listeners.forEach((listener) => listener());
}
