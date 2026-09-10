/**
 * The Merge world has more than one writer: every mounted MergeWorldProvider
 * holds an optimistic in-memory board that it persists a moment later, while
 * story effects and world screens reduce the SQLite snapshot directly. A
 * direct write that starts from a snapshot the provider has already moved past
 * silently loses the provider's commands, and a provider save that lands after
 * the direct write silently loses the story's change (a cleared island, the
 * Kingdom wish, a prepared lesson).
 *
 * Providers register their flush here. Direct readers and writers drain every
 * registered writer before touching the database, so the store they reduce is
 * the one the player is actually looking at.
 */
const hooks = new Set<() => Promise<void>>();

export function registerMergeWorldWriterFlush(hook: () => Promise<void>): () => void {
  hooks.add(hook);
  return () => { hooks.delete(hook); };
}

let draining: Promise<void> | null = null;

/** Drains every registered writer once; concurrent callers share the drain. */
export function flushMergeWorldWriters(): Promise<void> {
  if (draining) return draining;
  if (!hooks.size) return Promise.resolve();
  draining = Promise.all([...hooks].map((hook) => hook().catch(() => undefined)))
    .then(() => undefined)
    .finally(() => { draining = null; });
  return draining;
}

export function mergeWorldWriterCountForTests() {
  return hooks.size;
}
