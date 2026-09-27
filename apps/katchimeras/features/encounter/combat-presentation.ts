import { useSyncExternalStore } from 'react';

/** Lean lane wisps are the default. The profiler can compare the old presentation in the same build. */
let detailed = process.env.EXPO_PUBLIC_RICH_COMBAT_WISPS === '1';
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useDetailedCombatWisps = () => useSyncExternalStore(subscribe, () => detailed, () => detailed);
export function setDetailedCombatWisps(value: boolean) {
  if (detailed === value) return;
  detailed = value;
  listeners.forEach((listener) => listener());
}
