/** Latest-snapshot persistence with a non-sliding deadline and one writer per key. */
export function createEncounterWriteQueue(write: (key: string, value: unknown | null) => Promise<void>, delay = 150) {
  type Entry = { value: unknown | null; version: number; saved: number; timer?: ReturnType<typeof setTimeout>; running?: Promise<void> };
  const entries = new Map<string, Entry>();
  const flush = async (key: string): Promise<void> => {
    const entry = entries.get(key);
    if (!entry) return;
    if (entry.timer) { clearTimeout(entry.timer); entry.timer = undefined; }
    if (entry.running) { await entry.running; return flush(key); }
    if (entry.saved === entry.version) return;
    const version = entry.version;
    const value = entry.value;
    entry.running = write(key, value).then(() => { entry.saved = version; });
    try { await entry.running; } finally { entry.running = undefined; }
    if (entry.saved !== entry.version) await flush(key);
  };
  return {
    put(key: string, value: unknown | null) {
      let entry = entries.get(key);
      if (!entry) { entry = { value, version: 0, saved: 0 }; entries.set(key, entry); }
      entry.value = value;
      entry.version++;
      if (!entry.timer) entry.timer = setTimeout(() => {
        entry!.timer = undefined;
        // Preserve the dirty snapshot on failure; an explicit barrier reports the error.
        void flush(key).catch(() => undefined);
      }, delay);
    },
    read<T>(key: string, fallback: () => T): T {
      const entry = entries.get(key);
      return entry ? entry.value as T : fallback();
    },
    flush,
    async flushAll() { await Promise.all([...entries.keys()].map(flush)); },
    /** Tombstones follow any already-started write so a reset cannot resurrect old progress. */
    async reset() {
      const keys = [...entries.keys()];
      for (const entry of entries.values()) { entry.value = null; entry.version++; }
      await Promise.all(keys.map(flush));
      for (const key of keys) {
        const entry = entries.get(key);
        if (entry && entry.saved === entry.version && !entry.running && !entry.timer) entries.delete(key);
      }
    },
    /** Release clean snapshots on scene teardown; dirty/in-flight writes stay owned. */
    release(key: string) {
      const entry = entries.get(key);
      if (entry && entry.saved === entry.version && !entry.running && !entry.timer) entries.delete(key);
    },
  };
}
