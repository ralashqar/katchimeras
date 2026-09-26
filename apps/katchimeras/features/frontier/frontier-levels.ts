import { FRONTIER_VARIANT_NAMES, frontierMissionId, type FrontierTile, type FrontierVariant } from '@/constants/frontier-tiles';
import { islandLevel, waves, type IslandLaneSpec, type IslandLevelSpec } from '@/constants/island-campaigns/island-levels';
import type { RegionMissionDefinition } from '@/constants/island-campaigns/types';

/**
 * A Frontier tile's battle (`constants/frontier-tiles.ts`): one Lanes level, generated from the tile's power and its
 * land. The land sets the wrinkle, so the ring never plays the same twice in a row: the Copse hides strikers (a wisp
 * that knocks a plant down a size), the Brook's wisps spit Mist down their column, the Meadow sends quick ones, the
 * Standing Stones a big slow warden. Power sets the numbers. The Hollow Tree's doorstep (power 6) is a boss.
 */
const PATTERNS: Readonly<Record<FrontierVariant, readonly (readonly number[])[]>> = {
  meadow: [[3], [2], [4], [1, 5], [2, 4]],
  copse: [[2], [4], [3], [2, 4], [1, 5]],
  brook: [[1], [5], [3], [1, 5], [2, 4]],
  stones: [[3], [1], [5], [2, 4], [1, 5]],
};

const OBJECTIVES: Readonly<Record<FrontierVariant, string>> = {
  meadow: 'The Mist holds the Meadow. Some of its wisps come down fast: have a plant under every lane.',
  copse: 'Something in the Copse knocks plants down a size. Merge them back up and keep shooting.',
  brook: 'The Brook’s wisps spit Mist down their lane. Clear it, or your plants go quiet.',
  stones: 'A warden sleeps among the Stones: big and slow. Put your strongest plants under it.',
};

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function frontierLevelSpec(tile: FrontierTile): IslandLevelSpec {
  const power = tile.power;
  const hp = 3 + power;
  const step = Math.max(3.2, 4.8 - power * 0.3);
  const count = power <= 1 ? 3 : power === 2 ? 4 : 5;
  const spit = tile.variant === 'brook' && power >= 2 ? Math.max(6, 10 - power) : power >= 4 ? Math.max(6, 11 - power) : undefined;
  const lanes: IslandLaneSpec[] = [
    ...waves('wisp', { first: 2, gap: power <= 1 ? 9 : 8, hp, step, grow: power >= 2 ? 1 : 0, drop: power >= 3 ? 2 : 3, ...(spit ? { spit } : {}) }, PATTERNS[tile.variant].slice(0, count)),
  ];
  if ((tile.variant === 'copse' && power >= 2) || power >= 4) lanes.push({ id: 'nibbler', column: tile.variant === 'copse' ? 5 : 1, at: 12, hp: hp + 1, step, look: 'nibbler', strike: 5 });
  if (tile.variant === 'meadow' && power >= 2) lanes.push({ id: 'quick', column: 1, at: 14, hp, step: 2.6, look: 'snuffer' });
  if (tile.variant === 'stones' && power >= 2 && power < 6) lanes.push({ id: 'warden', column: 3, at: 18, hp: 8 + power * 2, step: 6.5, look: 'warden' });
  const boss = power >= 6;
  if (boss) lanes.push({ id: 'heart', column: 3, at: 3, hp: 24, step: 6, drop: 1, look: 'warden', spit: 6 });
  // The first tile plays like the first boards: sleepers and veiled pieces to wake. After it, a garden already growing.
  const first = power <= 1;
  return {
    title: `Take back ${FRONTIER_VARIANT_NAMES[tile.variant]}`,
    objective: boss ? 'The Mist’s oldest keeper guards the way to the Hollow Tree. It comes down the middle with others at its side.' : OBJECTIVES[tile.variant],
    difficulty: boss ? 'boss' : power <= 2 ? 'calm' : power <= 4 ? 'thick' : 'dark',
    pieces: [[36, 1], [37, 1], [39, 1], [40, 1], [44, 1], [46, 1]],
    sleepers: [[38, 1]],
    veiled: first ? [[31, 1], [30, 1], [32, 1], [24, 2], [23, 1], [25, 1], [29, 2], [33, 2]] : [[31, 1], [30, 1], [32, 1], [24, 2], [29, 2], [33, 2]],
    mist: [], seeds: { every: first ? 3 : 3.2 }, wisps: [],
    lanes,
    rewards: { glow: 20 + power * 6, xp: 12 + power * 5 },
  };
}

const cache = new Map<string, RegionMissionDefinition>();

/** A Frontier tile's battle, as a mission the island dock plays (id `frontier:<tile>`, the ledger's key). */
export function frontierMission(tile: FrontierTile): RegionMissionDefinition {
  const cached = cache.get(tile.id);
  if (cached) return cached;
  const mission = islandLevel('frontier', tile.id, frontierLevelSpec(tile));
  if (mission.id !== frontierMissionId(tile.id)) throw new Error(`frontier mission id drifted: ${mission.id}`);
  const named = { ...mission, title: capitalised(mission.title) };
  cache.set(tile.id, named);
  return named;
}
