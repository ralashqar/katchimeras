import { islandLevel, waves, type IslandLevelSpec } from '@/constants/island-campaigns/island-levels';
import type { RegionMissionDefinition } from '@/constants/island-campaigns/types';
import { HOLLOW_TREE_FINALE_ID } from '@/constants/finale';

/**
 * The finale (Chapter 10, `docs/cozy-4x-ftue-v2-wayfinders-road.md`): the Hollow Tree was the first Sanctuary, and the
 * Mist is a forgetting; its keeper forgot first. One battle in three phases, docked under the Hollow Tree:
 * - The Hollow Heart, guarded by two bulwarks (nothing beside them can be hurt while they stand), forgotten wisps on
 *   the edges.
 * - It falls, and remembers: it weaves between the lanes and calls its mistlings down.
 * - The Forgotten Light, the last of it: quick, and lunging for the bottom of the board.
 * Won, the Hollow Tree wakes (its restored art), and the world beyond it is waiting.
 */
export { HOLLOW_TREE_FINALE_ID, HOLLOW_TREE_STRUCTURE_ID, hollowTreeRestored } from '@/constants/finale';

const light = (cell: number) => ({ cell, type: 'light' as const });

export const HOLLOW_TREE_FINALE_SPEC: IslandLevelSpec = {
  title: 'The Hollow Heart',
  objective: 'Its keeper forgot why it keeps. Two bulwarks guard it: bring them down first. Then it remembers, and it changes.',
  difficulty: 'boss',
  pieces: [[36, 2], [37, 1], [38, 2], [39, 1], [40, 2], [44, 1]], mist: [light(22), light(26)], seeds: { every: 3.2 }, wisps: [],
  lanes: [
    { id: 'heart', column: 3, at: 3, hp: 22, step: 7.5, drop: 2, look: 'hollow', spit: 8 },
    { id: 'bulwark-left', column: 2, at: 5, hp: 8, step: 7, look: 'bulwark', shield: true },
    { id: 'bulwark-right', column: 4, at: 5, hp: 8, step: 7, look: 'bulwark', shield: true },
    ...waves('forgotten', { first: 14, gap: 10, hp: 5, step: 4, grow: 1, drop: 2 }, [[1], [5], [1, 5]]),
    // It remembers: weaving between the lanes, calling its mistlings down.
    { id: 'remembering', column: 3, at: 0, hp: 18, step: 6.5, look: 'hollow', weave: 3, calls: { every: 7, count: 3, hp: 3 }, after: 'heart' },
    // The last of it: the Forgotten Light, quick and lunging.
    { id: 'light', column: 3, at: 0, hp: 14, step: 5, look: 'forgotten', dash: { every: 4.5 }, after: 'remembering' },
  ],
  rewards: { glow: 150, xp: 80 },
};

let finale: RegionMissionDefinition | null = null;
export function hollowTreeFinaleMission(): RegionMissionDefinition {
  finale ??= islandLevel('finale', 'hollow-tree', HOLLOW_TREE_FINALE_SPEC);
  if (finale.id !== HOLLOW_TREE_FINALE_ID) throw new Error(`finale id drifted: ${finale.id}`);
  return finale;
}
