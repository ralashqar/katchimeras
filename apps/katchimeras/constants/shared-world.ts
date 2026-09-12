import { MOSSPROUT_LAYOUT } from '@incubator/environments/mossprout-layout';
import type { HexCoord } from '@incubator/environments/hex';
import type { MergeCharacterId } from '@/types/merge-world';
import { HATCHABLE_COMPANIONS } from './hatchable-companions/registry';

export type SharedWorldPurchase = { tileId: string; unlockId: string; companion: MergeCharacterId; price: number; name: string; revealPreset: string };
export type SharedWorldTile = {
  companion: MergeCharacterId; coord: HexCoord;
  /** Discovery tiles hide their resident until the tile is open. */
  residentVisible?: boolean;
  unlockId?: string; price?: number; name?: string; revealPreset?: string;
};
export type HatchableSharedWorldTile = Required<SharedWorldTile>;

/**
 * Stable world objects, independent of companion ownership or story checkpoints.
 * Mossprout's home is fixed; every other tile is a hatchable companion's, read
 * from the registry so a new friend is a definition, not an entry here.
 */
export const SHARED_WORLD_TILES: { readonly 'mossprout-home': SharedWorldTile; readonly 'steppling-home': HatchableSharedWorldTile } & Readonly<Record<string, SharedWorldTile>> = {
  'mossprout-home': { companion: 'mossprout', coord: MOSSPROUT_LAYOUT.home.coord },
  ...Object.fromEntries(HATCHABLE_COMPANIONS.map((definition): [string, HatchableSharedWorldTile] => [definition.tile.id, {
    residentVisible: false,
    companion: definition.companion, coord: definition.tile.coord,
    unlockId: definition.tile.unlockId, price: definition.tile.price,
    name: definition.tile.name, revealPreset: definition.tile.revealPreset,
  }])),
} as { readonly 'mossprout-home': SharedWorldTile; readonly 'steppling-home': HatchableSharedWorldTile } & Readonly<Record<string, SharedWorldTile>>;
export const STEPPLING_TILE = SHARED_WORLD_TILES['steppling-home'];
export const STEPPLING_STORY_TARGET = { kind: 'haven_structure', structureId: 'steppling-home' } as const;
export const sharedWorldIncludesCompanion = (familyId: string) => Object.values(SHARED_WORLD_TILES).some((tile) => tile.companion === familyId);
export const SHARED_WORLD_PURCHASES: readonly SharedWorldPurchase[] = Object.entries(SHARED_WORLD_TILES).flatMap(([tileId, tile]) => tile.unlockId ? [{ tileId, unlockId: tile.unlockId, companion: tile.companion, price: tile.price!, name: tile.name!, revealPreset: tile.revealPreset! }] : []);
export const sharedWorldPurchase = (tileId: string) => SHARED_WORLD_PURCHASES.find((entry) => entry.tileId === tileId);
