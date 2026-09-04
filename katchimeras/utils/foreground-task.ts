/** One foreground worker, with at most one trailing request. No work is queued
 * while backgrounded; a brief inactive/active bounce is debounced. */
export function createForegroundTask(
  work: (isActive: () => boolean) => Promise<void>,
  options: {
    onError: (error: unknown) => void;
    delayMs?: number;
    schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
    cancel?: (timer: ReturnType<typeof setTimeout>) => void;
  },
) {
  const schedule = options.schedule ?? setTimeout;
  const cancel = options.cancel ?? clearTimeout;
  let active = false;
  let disposed = false;
  let running = false;
  let requested = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const isActive = () => active && !disposed;
  const enqueue = () => {
    if (!isActive() || running || timer != null || !requested) return;
    timer = schedule(() => {
      timer = null;
      if (!isActive()) return;
      requested = false;
      running = true;
      void Promise.resolve().then(() => {
        if (isActive()) return work(isActive);
      }).catch(options.onError).finally(() => {
        running = false;
        enqueue();
      });
    }, options.delayMs ?? 150);
  };
  return {
    setActive(next: boolean) {
      if (disposed || active === next) return;
      active = next;
      requested = next;
      if (!next && timer != null) { cancel(timer); timer = null; }
      enqueue();
    },
    dispose() {
      disposed = true;
      active = false;
      requested = false;
      if (timer != null) cancel(timer);
      timer = null;
    },
  };
}
