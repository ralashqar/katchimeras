import { MOSSPROUT_LAYOUT } from '@incubator/environments/mossprout-layout';
import type { HexCoord } from '@incubator/environments/hex';
import type { MergeCharacterId } from '@/types/merge-world';
import { HATCHABLE_COMPANIONS } from './hatchable-companions/registry';
import { STORY_TILES } from './story-tiles/registry';

export type SharedWorldPurchase = { tileId: string; unlockId: string; companion: MergeCharacterId; price: number; name: string; revealPreset: string; /** A story tile: free, revealed by an episode, no marker. */ story?: boolean };
export type SharedWorldTile = {
  companion: MergeCharacterId; coord: HexCoord;
  /** Discovery tiles hide their resident until the tile is open. */
  residentVisible?: boolean;
  unlockId?: string; price?: number; name?: string; revealPreset?: string;
  /** A story tile: revealed by a journey episode, never offered on a marker. */
  story?: boolean;
};
export type HatchableSharedWorldTile = Required<Omit<SharedWorldTile, 'story'>> & { story?: boolean };

/**
 * Stable world objects, independent of companion ownership or story checkpoints.
 * Mossprout's home is fixed; every other tile is a hatchable companion's or a
 * story tile's, read from the registries so a new friend or place is a
 * definition, not an entry here.
 */
export const SHARED_WORLD_TILES: { readonly 'mossprout-home': SharedWorldTile; readonly 'steppling-home': HatchableSharedWorldTile } & Readonly<Record<string, SharedWorldTile>> = {
  'mossprout-home': { companion: 'mossprout', coord: MOSSPROUT_LAYOUT.home.coord },
  ...Object.fromEntries(HATCHABLE_COMPANIONS.map((definition): [string, HatchableSharedWorldTile] => [definition.tile.id, {
    residentVisible: false,
    companion: definition.companion, coord: definition.tile.coord,
    unlockId: definition.tile.unlockId, price: definition.tile.price,
    name: definition.tile.name, revealPreset: definition.tile.revealPreset,
  }])),
  ...Object.fromEntries(STORY_TILES.map((tile): [string, SharedWorldTile] => [tile.id, {
    residentVisible: false, story: true,
    companion: tile.companion, coord: tile.coord,
    unlockId: tile.unlockId, price: 0, name: tile.name, revealPreset: tile.revealPreset,
  }])),
} as { readonly 'mossprout-home': SharedWorldTile; readonly 'steppling-home': HatchableSharedWorldTile } & Readonly<Record<string, SharedWorldTile>>;
export const STEPPLING_TILE = SHARED_WORLD_TILES['steppling-home'];
export const STEPPLING_STORY_TARGET = { kind: 'haven_structure', structureId: 'steppling-home' } as const;
export const sharedWorldIncludesCompanion = (familyId: string) => Object.values(SHARED_WORLD_TILES).some((tile) => tile.companion === familyId);
export const SHARED_WORLD_PURCHASES: readonly SharedWorldPurchase[] = Object.entries(SHARED_WORLD_TILES).flatMap(([tileId, tile]) => tile.unlockId ? [{ tileId, unlockId: tile.unlockId, companion: tile.companion, price: tile.price!, name: tile.name!, revealPreset: tile.revealPreset!, ...(tile.story ? { story: true } : {}) }] : []);
export const sharedWorldPurchase = (tileId: string) => SHARED_WORLD_PURCHASES.find((entry) => entry.tileId === tileId);
