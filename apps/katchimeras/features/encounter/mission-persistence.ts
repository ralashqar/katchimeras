import { getStoredJson, onStorageReset, removeStoredValue, setStoredJsonAsync } from '@/utils/app-storage';
import { createEncounterWriteQueue } from './write-queue';
import { measureMergeWork } from '@/utils/merge-world/performance';

export const missionWrites = createEncounterWriteQueue(async (key, value) => {
  const done = measureMergeWork('battle.save');
  try {
    if (value === null) removeStoredValue(key);
    else await setStoredJsonAsync(key, value);
  } finally { done(); }
});
onStorageReset(() => { void missionWrites.reset().catch(() => undefined); });
export function readMissionSnapshot<T>(key: string): T | null {
  return missionWrites.read<T | null>(key, () => getStoredJson<T | null>(key, null));
}
export const flushMissionWrites = () => missionWrites.flushAll();
