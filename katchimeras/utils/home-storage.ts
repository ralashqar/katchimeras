import { getStoredJson, getStoredRaw, removeStoredValue, setStoredJson, setStoredJsonAsync } from '@/utils/app-storage';
import { HOME_STORAGE_KEY } from '@/constants/home-mvp';
import type { StoredHomeState } from '@/types/home';

const listeners = new Set<() => void>();
let cachedHomeState: StoredHomeState | null | undefined;
let pendingDeferredState: StoredHomeState | null = null;
let deferredWrite: Promise<void> | null = null;

export function loadStoredHomeState() {
  if (cachedHomeState === undefined) {
    cachedHomeState = getStoredJson<StoredHomeState | null>(HOME_STORAGE_KEY, null);
  }
  return cachedHomeState;
}

// The raw persisted JSON string — a cheap identity check for caches (same
// string ⇒ same state) without paying the parse.
export function loadStoredHomeStateRaw(): string | null {
  return getStoredRaw(HOME_STORAGE_KEY);
}

export function saveStoredHomeState(state: StoredHomeState, options?: { notify?: boolean }) {
  cachedHomeState = state;
  setStoredJson(HOME_STORAGE_KEY, state);
  if (options?.notify !== false) {
    notifyHomeStateListeners();
  }
}

// The native localStorage shim writes to SQLite synchronously. Large home
// archives can therefore block the JS thread for seconds. Hot UI mutations use
// this coalescing async writer while reads are served immediately from memory.
export function saveStoredHomeStateDeferred(state: StoredHomeState, options?: { notify?: boolean }) {
  cachedHomeState = state;
  pendingDeferredState = state;
  if (options?.notify !== false) {
    notifyHomeStateListeners();
  }
  if (!deferredWrite) {
    deferredWrite = drainDeferredWrites();
  }
  return deferredWrite;
}

async function drainDeferredWrites() {
  // Yield to navigation/rendering before serialization and native I/O.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  try {
    while (pendingDeferredState) {
      const state = pendingDeferredState;
      pendingDeferredState = null;
      await setStoredJsonAsync(HOME_STORAGE_KEY, state);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[Home storage] Deferred save failed', error);
    }
  } finally {
    deferredWrite = null;
    if (pendingDeferredState) {
      deferredWrite = drainDeferredWrites();
    }
  }
}

export function clearStoredHomeState() {
  cachedHomeState = null;
  pendingDeferredState = null;
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
