import { getStoredKeys, removeStoredValue } from '@/utils/app-storage';

/** Clear every day, including legacy counters stored outside companion state. */
export function resetCompanionWaterCounts() {
  for (const key of getStoredKeys()) {
    if (key.startsWith('companion:water-count:')) removeStoredValue(key);
  }
}
