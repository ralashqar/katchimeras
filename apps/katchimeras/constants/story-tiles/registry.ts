import { markRegistryBuilt, packEntries } from '@/features/content-packs/active-pack';
import type { HexCoord } from '@incubator/environments/hex';
import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';
import { MOSSPROUT_OLD_GROVE } from './mossprout-old-grove';

/**
 * Story tiles: places in the shared world a friend's journey chapter reveals.
 * A story tile sits under the Mist like a hatchable friend's tile, but it has
 * no marker, no price and no Egg: the only way through its mist is an
 * episode's consequence (`reveal_story_tile`, or a `mist_mission` cleared on
 * a board docked beneath it). Its unlock is recorded in `worldUnlocks` like
 * every shared-world tile, so the engine, the receipts and the reveal
 * presentation need nothing new. The art lives in `tile-art.ts`, by tile id.
 */
export type StoryTileDefinition = {
  /** The shared-world tile id and the story target's structure id. */
  id: string;
  coord: HexCoord;
  /** The world unlock the reveal records (`worldUnlocks[unlockId]`). */
  unlockId: string;
  name: string;
  /** Whose story keeps this place; also the unlock's destination in the catalog. */
  companion: MergeCharacterId;
  revealPreset: 'mist-clear';
  /** The key its revealed art's alpha bounds are generated under. */
  alphaBoundsKey: string;
  lines: {
    /** Said as the mist clears. */
    reveal: string;
  };
};

export type StoryTileState = 'misted' | 'revealed';

export const STORY_TILES_BUNDLED: readonly StoryTileDefinition[] = [MOSSPROUT_OLD_GROVE];
export const STORY_TILES: readonly StoryTileDefinition[] = [...STORY_TILES_BUNDLED, ...packEntries('storyTiles')];
markRegistryBuilt('storyTiles');

const byId = new Map(STORY_TILES.map((tile) => [tile.id, tile]));
const byUnlock = new Map(STORY_TILES.map((tile) => [tile.unlockId, tile]));

export const storyTileById = (tileId: string) => byId.get(tileId) ?? null;
export const storyTileByUnlock = (unlockId: string) => byUnlock.get(unlockId) ?? null;
export const storyTileStoryTarget = (tile: StoryTileDefinition) => ({ kind: 'haven_structure' as const, structureId: tile.id });

export function storyTileRevealed(world: MergeWorldState, tile: StoryTileDefinition): boolean {
  return Boolean(world.worldUnlocks?.[tile.unlockId]);
}

export function storyTileState(world: MergeWorldState, tile: StoryTileDefinition): StoryTileState {
  return storyTileRevealed(world, tile) ? 'revealed' : 'misted';
}

/** Every story tile's state by tile id, for the scene. */
export function storyTileStates(world: MergeWorldState): Partial<Record<string, StoryTileState>> {
  return Object.fromEntries(STORY_TILES.map((tile) => [tile.id, storyTileState(world, tile)]));
}
