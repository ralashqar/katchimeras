import type { HexCoord } from '@incubator/environments/hex';
import { heartTreeLevel } from '@/constants/heart-tree';
import type { MergeWorldState } from '@/types/merge-world';

/**
 * The Frontier (cozy 4X v2, `docs/cozy-4x-ftue-v2-wayfinders-road.md` Part D3): wild land around the Sanctuary, under
 * the Mist, taken back one Lanes battle at a time. It fills every empty cell of the second ring and all of the third,
 * so the map itself is the progress bar. The Heart Tree's light decides how far out a battle can be fought: each tile
 * wakes at a Tree level, the ones nearest home first and the ones toward the Hollow Tree last. Reclaimed land is won
 * for good (its battle's first clear, in the encounter ledger: nothing else is stored), and it feeds the Lodge.
 *
 * Coordinates are world cells (the scene's placed positions), never the source coordinates the friends' tiles are
 * laid out from: the Frontier goes around whatever the rings already hold.
 */
export type FrontierVariant = 'meadow' | 'copse' | 'brook' | 'stones';

export type FrontierTile = {
  id: string;
  /** The world cell (already placed: not mapped through the Heartwood spiral). */
  coord: HexCoord;
  ring: 2 | 3;
  variant: FrontierVariant;
  /** The Heart Tree level whose light first reaches it. */
  tree: number;
  /** How hard its battle is, 1 (the first, near home) to 6 (the Hollow Tree's doorstep). */
  power: number;
};

export type FrontierTileState = 'dark' | 'misted' | 'reclaimed';

export const FRONTIER_VARIANT_NAMES: Readonly<Record<FrontierVariant, string>> = {
  meadow: 'the Wild Meadow',
  copse: 'the Quiet Copse',
  brook: 'the Cold Brook',
  stones: 'the Standing Stones',
};

/** Where the Hollow Tree stands (`HOLLOW_TREE_COORD` in the scene): the Frontier's far end. */
const HOLLOW_TREE: HexCoord = { q: 0, r: -4 };
const distance = (a: HexCoord, b: HexCoord) => Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r));

/**
 * The second ring's empty cells, in the order they are met: the first beside Steppling's trailhead (his trail's edge),
 * then around toward the Hollow Tree.
 */
const RING_TWO: readonly HexCoord[] = [{ q: -2, r: 1 }, { q: -2, r: 0 }, { q: -1, r: -1 }, { q: 0, r: -2 }, { q: 1, r: -2 }];
const RING_THREE: readonly HexCoord[] = [
  { q: -3, r: 3 }, { q: -2, r: 3 }, { q: -1, r: 3 }, { q: 0, r: 3 }, { q: 1, r: 2 }, { q: 2, r: 1 },
  { q: 3, r: 0 }, { q: 3, r: -1 }, { q: 3, r: -2 }, { q: 3, r: -3 }, { q: 2, r: -3 }, { q: 1, r: -3 },
  { q: 0, r: -3 }, { q: -1, r: -2 }, { q: -2, r: -1 }, { q: -3, r: 0 }, { q: -3, r: 1 }, { q: -3, r: 2 },
];
/** The third ring's light, nearest home first: this many tiles wake at each Tree level (the last is the Hollow Tree's doorstep). */
const RING_THREE_WAKES: readonly (readonly [tree: number, count: number, power: number])[] = [[2, 6, 2], [3, 5, 3], [4, 4, 4], [5, 2, 5], [7, 1, 6]];
const VARIANTS: readonly FrontierVariant[] = ['meadow', 'copse', 'brook', 'stones'];

function buildFrontier(): FrontierTile[] {
  const tiles: FrontierTile[] = RING_TWO.map((coord, index) => ({
    id: `frontier-${index + 1}`, coord, ring: 2, variant: VARIANTS[index % VARIANTS.length]!, tree: 1, power: index === 0 ? 1 : index < 3 ? 1 : 2,
  }));
  // Farthest from the Hollow Tree first; ties keep the ring's own order, so neighbours differ in look.
  const outer = RING_THREE.map((coord, index) => ({ coord, index })).sort((a, b) => distance(b.coord, HOLLOW_TREE) - distance(a.coord, HOLLOW_TREE) || a.index - b.index);
  let at = 0;
  for (const [tree, count, power] of RING_THREE_WAKES) {
    for (const { coord, index } of outer.slice(at, at + count)) {
      tiles.push({ id: `frontier-${RING_TWO.length + index + 1}`, coord, ring: 3, variant: VARIANTS[(index + 2) % VARIANTS.length]!, tree, power });
    }
    at += count;
  }
  return tiles;
}

export const FRONTIER_TILES: readonly FrontierTile[] = buildFrontier();
const byId = new Map(FRONTIER_TILES.map((tile) => [tile.id, tile]));
export const frontierTileById = (id: string): FrontierTile | null => byId.get(id) ?? null;

/** A Frontier tile's battle: its mission id (the encounter ledger's key, and the engine's sign it is Frontier land). */
export const FRONTIER_MISSION_PREFIX = 'frontier:';
export const frontierMissionId = (tileId: string) => `${FRONTIER_MISSION_PREFIX}${tileId}`;
export const frontierTileIdForMission = (missionId: string): string | null => missionId.startsWith(FRONTIER_MISSION_PREFIX) ? missionId.slice(FRONTIER_MISSION_PREFIX.length) : null;

type FrontierWorld = Pick<MergeWorldState, 'encounters' | 'heartTree'>;

/** The Frontier opens with Chapter 2 ("Push It Back"): once Chapter 1 (the lit window) is claimed. */
export const FRONTIER_OPENS_AFTER_CHAPTER = 'home-for-two';
export function frontierOpen(world: Pick<MergeWorldState, 'chaptersClaimed'>): boolean {
  return Boolean(world.chaptersClaimed?.includes(FRONTIER_OPENS_AFTER_CHAPTER));
}

export function frontierTileReclaimed(world: Pick<MergeWorldState, 'encounters'>, tileId: string): boolean {
  return Boolean(world.encounters?.clears?.[frontierMissionId(tileId)]);
}

/** Within the Heart Tree's light: a battle can be fought there. */
export function frontierTileLit(world: Pick<MergeWorldState, 'heartTree'>, tile: FrontierTile): boolean {
  return heartTreeLevel(world) >= tile.tree;
}

export function frontierTileState(world: FrontierWorld, tile: FrontierTile): FrontierTileState {
  if (frontierTileReclaimed(world, tile.id)) return 'reclaimed';
  return frontierTileLit(world, tile) ? 'misted' : 'dark';
}

/** Every Frontier tile's state by id, for the scene. */
export function frontierTileStates(world: FrontierWorld): Record<string, FrontierTileState> {
  return Object.fromEntries(FRONTIER_TILES.map((tile) => [tile.id, frontierTileState(world, tile)]));
}

export function frontierReclaimedCount(world: Pick<MergeWorldState, 'encounters'>): number {
  return FRONTIER_TILES.filter((tile) => frontierTileReclaimed(world, tile.id)).length;
}

/** The next tile to take back: the first in the light still under the Mist (the order they are met), or null. */
export function nextFrontierTile(world: FrontierWorld): FrontierTile | null {
  return FRONTIER_TILES.find((tile) => frontierTileState(world, tile) === 'misted') ?? null;
}

/** The Heart Tree level that lights the next dark tile, or null once every tile is in the light. */
export function nextFrontierTreeLevel(world: FrontierWorld): number | null {
  const dark = FRONTIER_TILES.filter((tile) => frontierTileState(world, tile) === 'dark').map((tile) => tile.tree);
  return dark.length ? Math.min(...dark) : null;
}

/** Timber from taking a tile back, once (the land's store, paid with its battle's first clear). */
export const frontierReclaimTimber = (tile: FrontierTile) => 1 + Math.ceil(tile.power / 2);

/** Reclaimed land feeds the Lodge (`lodgeTimberWaiting`): one more Timber in its store per tile, a faster stream per three. */
export const frontierLodgeStoreBonus = (reclaimed: number) => reclaimed;
export const frontierLodgeRateBonus = (reclaimed: number) => Math.floor(reclaimed / 3);
