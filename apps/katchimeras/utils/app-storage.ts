import 'expo-sqlite/localStorage/install';
import Storage from 'expo-sqlite/kv-store';

function getStorage() {
  return globalThis.localStorage ?? null;
}

/**
 * Writes held back for a moment. The localStorage adapter is synchronous SQLite: every write is
 * a transaction on the JS thread, several milliseconds on a phone. A board that saves after each
 * command paid that on the very frame the merge animation was starting. A deferred write keeps the
 * value here (reads see it at once), coalesces repeats on the same key, and lands after `delayMs`,
 * on a flush, or before any synchronous write or removal of the same key.
 */
const deferredWrites = new Map<string, { value: unknown; timer: ReturnType<typeof setTimeout> }>();

export function setStoredJsonDeferred<T>(key: string, value: T, delayMs = 120) {
  const pending = deferredWrites.get(key);
  if (pending) clearTimeout(pending.timer);
  const timer = setTimeout(() => flushDeferredStoredWrites(key), delayMs);
  deferredWrites.set(key, { value, timer });
}

/** Lands every deferred write now (or one key's), in the order they were scheduled. */
export function flushDeferredStoredWrites(key?: string) {
  const keys = key == null ? [...deferredWrites.keys()] : deferredWrites.has(key) ? [key] : [];
  for (const pendingKey of keys) {
    const pending = deferredWrites.get(pendingKey);
    if (!pending) continue;
    deferredWrites.delete(pendingKey);
    clearTimeout(pending.timer);
    setStoredJson(pendingKey, pending.value);
  }
}

export function hasDeferredStoredWrite(key: string) {
  return deferredWrites.has(key);
}

function dropDeferredWrite(key: string) {
  const pending = deferredWrites.get(key);
  if (!pending) return;
  clearTimeout(pending.timer);
  deferredWrites.delete(key);
}

export function getStoredJson<T>(key: string, fallback: T): T {
  const pending = deferredWrites.get(key);
  if (pending) return pending.value as T;
  const storage = getStorage();

  if (!storage) {
    return fallback;
  }

  try {
    const rawValue = storage.getItem(key);

    if (!rawValue) {
      return fallback;
    }

    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

export function getStoredRaw(key: string): string | null {
  const pending = deferredWrites.get(key);
  if (pending) return JSON.stringify(pending.value);
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function setStoredJson<T>(key: string, value: T) {
  // A synchronous write is newer than anything still held back for the key.
  dropDeferredWrite(key);
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(value));
}

export async function setStoredJsonAsync<T>(key: string, value: T) {
  await Storage.setItemAsync(key, JSON.stringify(value));
}

export function setStoredRaw(key: string, value: string) {
  dropDeferredWrite(key);
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(key, value);
}

export async function setStoredRawAsync(key: string, value: string) {
  await Storage.setItemAsync(key, value);
}

export function removeStoredValue(key: string) {
  dropDeferredWrite(key);
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(key);
}

export function getStoredKeys(): string[] {
  const storage = getStorage();
  if (!storage) return [];
  const keys: string[] = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key) keys.push(key);
    }
  } catch {
    return [];
  }
  return keys;
}

// Wipes ALL locally-stored app data in one shot — onboarding profile, home/day
// state, dev overrides, consent + backfill flags, etc. Used by the dev "full
// reset" to return to a genuinely fresh first-run. Does not touch native OS
// permissions (camera / photos).
export function clearAllStoredValues() {
  for (const pending of deferredWrites.values()) clearTimeout(pending.timer);
  deferredWrites.clear();
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    if (typeof storage.clear === 'function') {
      storage.clear();
      return;
    }
    // Fallback for shims without clear(): collect keys, then remove them.
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key) {
        keys.push(key);
      }
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // best-effort
  }
}
