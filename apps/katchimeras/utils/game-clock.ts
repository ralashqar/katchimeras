import { DEV_TOOLS_ENABLED } from '@/constants/dev';

/** Gameplay wall time only. Never override Date, animation timers or server time. */
export function createGameClock(enabled: boolean, realNow: () => number = () => Date.now()) {
  let offset = 0;
  const listeners = new Set<() => void>();
  return {
    now: () => realNow() + offset,
    offset: () => offset,
    setOffset(value: number) {
      const next = enabled && Number.isSafeInteger(value) && value >= 0 ? value : 0;
      if (offset === next) return;
      offset = next;
      listeners.forEach(listener => listener());
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

export const gameClock = createGameClock(DEV_TOOLS_ENABLED);
export const gameNow = gameClock.now;
