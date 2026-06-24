import type { HomeDayRecord } from '@/types/home';
import type { WorldPatch, WorldState } from '@/types/world';
import { finalizeDayPatch } from '@/utils/today-patch-engine';
import { spiralCoord } from '@/utils/world-iso';

// v2: patches are the unified DIORAMA TIME CAPSULE (four leveling cells +
// creature). Bumping the version migrates any v1 (archetype-anchor) world — the
// loader discards it and buildWorld re-derives every day fresh, deterministically.
export const WORLD_VERSION = 2;
export const EMPTY_WORLD: WorldState = { version: WORLD_VERSION, patches: [], builtDayIds: [] };

// Fold any newly-hatched days into the world: one patch per day, placed on the
// next free spiral cell. Pure — takes the previous state + the day list and
// returns the next state, so it is unit-testable headless and storage-agnostic.
export function buildWorld(prev: WorldState, days: HomeDayRecord[]): WorldState {
  const built = new Set(prev.builtDayIds);
  const patches: WorldPatch[] = [...prev.patches];
  const builtDayIds: string[] = [...prev.builtDayIds];

  const hatched = days
    .filter((day) => day.state === 'hatched' && day.creature && !built.has(day.id))
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate));

  for (const day of hatched) {
    const patch = finalizeDayPatch(day);
    const coord = spiralCoord(patches.length);
    patch.gridCol = coord.gridCol;
    patch.gridRow = coord.gridRow;
    patches.push(patch);
    builtDayIds.push(day.id);
    built.add(day.id);
  }

  return { version: WORLD_VERSION, patches, builtDayIds };
}
