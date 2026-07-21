import { getStoredJson, getStoredRaw, removeStoredValue, setStoredJson, setStoredJsonAsync } from '@/utils/app-storage';
import { HOME_STORAGE_KEY } from '@/constants/home-mvp';
import type { StoredHomeState } from '@/types/home';
import { preserveFinalizedHatches } from '@/game/days/state-integrity';

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

export type HomeSaveOptions = { notify?: boolean; allowHatchDowngrade?: boolean };

export function saveStoredHomeState(state: StoredHomeState, options?: HomeSaveOptions) {
  const currentState = loadStoredHomeState();
  const protectedState = options?.allowHatchDowngrade
    ? state
    : preserveFinalizedHatches(currentState, state);
  warnIfHatchDowngradeWasPrevented(state, protectedState);
  cachedHomeState = protectedState;
  setStoredJson(HOME_STORAGE_KEY, protectedState);
  // A pre-hatch async write may already be inside native storage. Queue the
  // protected state behind it so the older write cannot become the final value.
  if (deferredWrite) pendingDeferredState = protectedState;
  if (options?.notify !== false) {
    notifyHomeStateListeners();
  }
}

// The native localStorage shim writes to SQLite synchronously. Large home
// archives can therefore block the JS thread for seconds. Hot UI mutations use
// this coalescing async writer while reads are served immediately from memory.
export function saveStoredHomeStateDeferred(state: StoredHomeState, options?: HomeSaveOptions) {
  const currentState = loadStoredHomeState();
  const protectedState = options?.allowHatchDowngrade
    ? state
    : preserveFinalizedHatches(currentState, state);
  warnIfHatchDowngradeWasPrevented(state, protectedState);
  cachedHomeState = protectedState;
  pendingDeferredState = protectedState;
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

function warnIfHatchDowngradeWasPrevented(
  requested: StoredHomeState,
  protectedState: StoredHomeState
) {
  if (!__DEV__ || requested === protectedState) return;
  const requestedDays = new Map(
    [...requested.archivedDays, requested.today, ...(requested.tomorrow ? [requested.tomorrow] : [])]
      .map((day) => [day.id, day] as const)
  );
  const repairedIds = [
    ...protectedState.archivedDays,
    protectedState.today,
    ...(protectedState.tomorrow ? [protectedState.tomorrow] : []),
  ]
    .filter((day) => day.creature && !requestedDays.get(day.id)?.creature)
    .map((day) => day.id);
  if (repairedIds.length > 0) {
    console.warn(`[Home storage] Prevented stale writer from unhatching: ${repairedIds.join(', ')}`);
  }
}
