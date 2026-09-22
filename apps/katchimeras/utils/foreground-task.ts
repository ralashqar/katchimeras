/** A scheduled timer's handle, whatever the platform's `setTimeout` returns. */
export type TimerHandle = ReturnType<typeof setTimeout>;

/** One foreground worker, with at most one trailing request. No work is queued
 * while backgrounded; a brief inactive/active bounce is debounced. */
export function createForegroundTask(
  work: (isActive: () => boolean) => Promise<void>,
  options: {
    onError: (error: unknown) => void;
    delayMs?: number;
    schedule?: (callback: () => void, delay: number) => TimerHandle;
    cancel?: (timer: TimerHandle) => void;
  },
) {
  // The timer's handle is whatever the platform's setTimeout returns: a number on the web, an object in Node.
  // Both globals are typed here as one shape so the type checker never sees a union of the two.
  const schedule: (callback: () => void, delay: number) => TimerHandle = options.schedule ?? ((callback, delay) => setTimeout(callback, delay) as unknown as TimerHandle);
  const cancel: (timer: TimerHandle) => void = options.cancel ?? ((timer) => clearTimeout(timer as unknown as Parameters<typeof clearTimeout>[0]));
  let active = false;
  let disposed = false;
  let running = false;
  let requested = false;
  let timer: TimerHandle | null = null;
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
