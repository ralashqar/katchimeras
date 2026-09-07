export interface ProfileStorage<T> {
  read(): Promise<T | null>;
  write(value: T): Promise<void>;
}

/** Per-game serialized writes. Failed writes never notify consumers. */
export function createVersionedProfileRepository<T>(options: {
  storage: ProfileStorage<T>;
  fresh: () => T;
  migrate: (value: T) => T;
}) {
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<(value: T) => void>();
  const update = (change: (value: T) => T) => {
    const work = queue.then(async () => {
      const saved = await options.storage.read();
      const current = saved === null ? options.fresh() : options.migrate(saved);
      const next = change(current);
      if (saved === null || next !== saved) await options.storage.write(next);
      listeners.forEach(listener => listener(next));
      return next;
    });
    queue = work.catch(() => {});
    return work;
  };
  return {
    update,
    load: () => update(value => value),
    flush: async () => { await queue; },
    subscribe: (listener: (value: T) => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
