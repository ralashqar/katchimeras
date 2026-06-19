import 'expo-sqlite/localStorage/install';

function getStorage() {
  return globalThis.localStorage ?? null;
}

export function getStoredJson<T>(key: string, fallback: T): T {
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

export function setStoredJson<T>(key: string, value: T) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(value));
}

export function removeStoredValue(key: string) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(key);
}

// Wipes ALL locally-stored app data in one shot — onboarding profile, home/day
// state, dev overrides, consent + backfill flags, etc. Used by the dev "full
// reset" to return to a genuinely fresh first-run. Does not touch native OS
// permissions (camera / photos).
export function clearAllStoredValues() {
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
