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
