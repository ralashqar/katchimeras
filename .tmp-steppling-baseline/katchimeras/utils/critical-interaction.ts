let activeCount = 0;
const idleWaiters = new Set<() => void>();

export function beginCriticalInteractionWork(): () => void {
  activeCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeCount = Math.max(0, activeCount - 1);
    if (activeCount !== 0) return;
    const waiters = [...idleWaiters];
    idleWaiters.clear();
    waiters.forEach((resolve) => resolve());
  };
}

export function criticalInteractionWorkActive(): boolean {
  return activeCount > 0;
}

export async function waitForCriticalInteractionIdle(signal?: AbortSignal): Promise<void> {
  while (activeCount > 0 && !signal?.aborted) {
    await new Promise<void>((resolve) => {
      const done = () => {
        idleWaiters.delete(done);
        signal?.removeEventListener('abort', done);
        resolve();
      };
      idleWaiters.add(done);
      signal?.addEventListener('abort', done, { once: true });
      if (signal?.aborted) done();
    });
  }
}
