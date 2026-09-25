import type { HeartwoodStage } from '@/features/shared-adventure/heartwood-progression';
import type { MergeWorldState } from '@/types/merge-world';

/**
 * The Heart Tree, the Sanctuary's Furnace (cozy 4X, Phase 2): the centre everything else grows around. It is woken in
 * the first session (level 1) and grows with Glow and Timber, through the Heartwood's stages of art. Its level caps
 * every other building's: nothing in the Sanctuary may stand more than one level past the Tree.
 */
export const HEART_TREE_MAX_LEVEL = 8;

/** Glow and Timber to grow from each level (index = the level it is at; the first session wakes it to 1). */
const GLOW_COSTS = [0, 40, 80, 140, 220, 320, 450, 600] as const;
const TIMBER_COSTS = [0, 5, 10, 16, 24, 34, 46, 60] as const;

/** What the Tree is called at each stage of its growth, by the Heartwood art stage it shows. */
export const HEART_TREE_STAGE_NAMES: Readonly<Record<HeartwoodStage, string>> = {
  dormant: 'Sleeping Tree', stirring: 'Stirring Tree', rooted: 'Rooted Tree', blooming: 'Blooming Tree', awakened: 'Awakened Heart Tree',
};

export function heartTreeLevel(world: Pick<MergeWorldState, 'heartTree'> | null | undefined): number {
  if (!world?.heartTree) return 0;
  return Math.max(1, Math.min(HEART_TREE_MAX_LEVEL, Math.floor(world.heartTree.level ?? 1)));
}

/** What growing from `level` takes, or null at the top (or before the Tree is woken: the first session does that). */
export function heartTreeCost(level: number): { glow: number; timber: number } | null {
  if (level < 1 || level >= HEART_TREE_MAX_LEVEL) return null;
  return { glow: GLOW_COSTS[level]!, timber: TIMBER_COSTS[level]! };
}

/** The Heartwood art a Tree level shows: two levels to each stage past the first. */
export function heartTreeStage(level: number): HeartwoodStage {
  if (level >= 7) return 'awakened';
  if (level >= 5) return 'blooming';
  if (level >= 3) return 'rooted';
  return level >= 1 ? 'stirring' : 'dormant';
}

/** The highest level any other building may reach: one past the Tree. */
export const buildingLevelCap = (treeLevel: number) => treeLevel + 1;
