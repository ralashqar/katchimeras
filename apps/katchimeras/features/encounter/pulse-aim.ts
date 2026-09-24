import { useSyncExternalStore } from 'react';

/**
 * Where a held piece would land and what its merge would make (territory battles, `docs/encounter-territory.md`),
 * while it is held over a twin on the board: the board's dock sets it, draws the Harmony pulse's reach over the board,
 * and the wisp layer rings the wisp that merge would strike. Null when nothing is held over a twin. One at a time:
 * only one board is docked.
 */
export type PulseAim = { cell: number; tier: number; /** What the merge would make (Merge vs Mist: whose Glow is previewed). */ definitionId?: string };

let current: PulseAim | null = null;
const listeners = new Set<() => void>();

export const pulseAim = {
  get: (): PulseAim | null => current,
  set(next: PulseAim | null) {
    if (next === current || (next && current && next.cell === current.cell && next.tier === current.tier && next.definitionId === current.definitionId)) return;
    current = next;
    for (const listener of [...listeners]) listener();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

export function usePulseAim(): PulseAim | null {
  return useSyncExternalStore(pulseAim.subscribe, pulseAim.get, pulseAim.get);
}
