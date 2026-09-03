import { GLOW } from './glow';
import type { MergeCharacterId } from '@/types/merge-world';

export type SharedWorldPurchase = { tileId: string; unlockId: string; companion: MergeCharacterId; price: number; name: string; revealPreset: string };

/** Stable world objects, independent of companion ownership or story checkpoints. */
export const SHARED_WORLD_TILES = {
  'mossprout-home': { companion: 'mossprout', coord: { q: 0, r: 1 } },
  'steppling-home': {
    residentVisible: false,
    companion: 'steppling', coord: { q: 0, r: 0 },
    unlockId: 'mossprout:overgrown-trail', price: GLOW.mistUnlockCost,
    name: 'Misty clearing', revealPreset: 'mist-clear',
  },
} as const;
export const STEPPLING_TILE = SHARED_WORLD_TILES['steppling-home'];
export const STEPPLING_STORY_TARGET = { kind: 'haven_structure', structureId: 'steppling-home' } as const;
export const sharedWorldIncludesCompanion = (familyId: string) => Object.values(SHARED_WORLD_TILES).some((tile) => tile.companion === familyId);
export const SHARED_WORLD_PURCHASES: readonly SharedWorldPurchase[] = Object.entries(SHARED_WORLD_TILES).flatMap(([tileId, tile]) => 'unlockId' in tile ? [{ tileId, ...tile }] : []);
export const sharedWorldPurchase = (tileId: string) => SHARED_WORLD_PURCHASES.find((entry) => entry.tileId === tileId);
