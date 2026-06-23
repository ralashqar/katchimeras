import type { HomeDayRecord } from '@/types/home';
import type { WorldPatch, WorldState } from '@/types/world';
import { spiralCoord } from '@/utils/world-iso';
import { buildPatchInputFromDay, generatePatch } from '@/utils/world-patch-engine';

// Deterministic RNG seeded from the day's nonce, so a patch is reproducible
// across re-derivations yet unique per day — same contract as the hatch engine.
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const EMPTY_WORLD: WorldState = { version: 1, patches: [], builtDayIds: [] };

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
    const input = buildPatchInputFromDay(day);
    const rng = mulberry32(hashSeed(`${input.nonce}:${day.id}`));
    const patch = generatePatch(input, rng);
    const coord = spiralCoord(patches.length);
    patch.gridCol = coord.gridCol;
    patch.gridRow = coord.gridRow;
    patches.push(patch);
    builtDayIds.push(day.id);
    built.add(day.id);
  }

  return { version: 1, patches, builtDayIds };
}
