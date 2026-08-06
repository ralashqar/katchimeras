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

export function waitForCriticalInteractionIdle(): Promise<void> {
  if (activeCount === 0) return Promise.resolve();
  return new Promise((resolve) => idleWaiters.add(resolve));
}
