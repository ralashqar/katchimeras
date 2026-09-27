/** One JS timer for logical effect callbacks, independent of available visual slots. */
export function createEffectDeadlines(batch: (work: () => void) => void = (work) => work()) {
  const pending = new Map<number, { at: number; run: () => void }>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let nextAt: number | undefined;
  let sequence = 0;
  const arm = () => {
    let earliest = Infinity;
    for (const task of pending.values()) earliest = Math.min(earliest, task.at);
    if (nextAt === earliest) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    nextAt = earliest;
    if (!Number.isFinite(earliest)) return;
    timer = setTimeout(() => {
      timer = undefined;
      nextAt = undefined;
      const now = Date.now();
      const due = [...pending.entries()].filter(([, task]) => task.at <= now).sort((a, b) => a[1].at - b[1].at);
      try {
        batch(() => {
          for (const [id, task] of due) {
            // A preceding callback may cancel another hit or dispose the scene.
            if (!pending.delete(id)) continue;
            task.run();
          }
        });
      } finally { arm(); }
    }, Math.max(0, earliest - Date.now()));
  };
  return {
    schedule(delay: number, run: () => void) {
      const id = ++sequence;
      const at = Date.now() + Math.max(0, delay);
      pending.set(id, { at, run });
      if (nextAt === undefined || at < nextAt) arm();
      return id;
    },
    cancel(id: number) {
      const at = pending.get(id)?.at;
      if (pending.delete(id) && at === nextAt) arm();
    },
    clear() {
      pending.clear();
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      nextAt = undefined;
    },
  };
}
