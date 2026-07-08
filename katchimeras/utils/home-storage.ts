import { getStoredJson, getStoredRaw, removeStoredValue, setStoredJson } from '@/utils/app-storage';
import { HOME_STORAGE_KEY } from '@/constants/home-mvp';
import type { StoredHomeState } from '@/types/home';

const listeners = new Set<() => void>();

export function loadStoredHomeState() {
  return getStoredJson<StoredHomeState | null>(HOME_STORAGE_KEY, null);
}

// The raw persisted JSON string — a cheap identity check for caches (same
// string ⇒ same state) without paying the parse.
export function loadStoredHomeStateRaw(): string | null {
  return getStoredRaw(HOME_STORAGE_KEY);
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
