import { useCallback, useEffect, useMemo, useRef } from 'react';

import { acquireLifecycleResource } from '@/utils/lifecycle-performance';

type Timer = ReturnType<typeof setTimeout>;

export function useDisposableTimers(owner: string) {
  const timers = useRef(new Map<Timer, () => void>());

  const cancel = useCallback((timer: Timer | null | undefined) => {
    if (timer == null) return;
    clearTimeout(timer);
    timers.current.get(timer)?.();
    timers.current.delete(timer);
  }, []);

  const cancelAll = useCallback(() => {
    timers.current.forEach((release, timer) => {
      clearTimeout(timer);
      release();
    });
    timers.current.clear();
  }, []);

  const schedule = useCallback((callback: () => void, delayMs: number) => {
    let timer: Timer;
    const release = acquireLifecycleResource('timer', owner);
    timer = setTimeout(() => {
      timers.current.delete(timer);
      release();
      callback();
    }, delayMs);
    timers.current.set(timer, release);
    return timer;
  }, [owner]);

  useEffect(() => cancelAll, [cancelAll]);

  return useMemo(() => ({ cancel, cancelAll, schedule }), [cancel, cancelAll, schedule]);
}
