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

/** `contested`: land taken back that a Mist Surge has taken again (its battle is a retake; it feeds nothing meanwhile). */
export type FrontierTileState = 'dark' | 'misted' | 'reclaimed' | 'contested';

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

type FrontierWorld = Pick<MergeWorldState, 'encounters' | 'heartTree'> & Partial<Pick<MergeWorldState, 'frontierSurges'>>;

/** A contested tile's battle: taking it back again (`retake:<tile>`), its own ledger key. */
export const FRONTIER_RETAKE_PREFIX = 'retake:';
export const frontierRetakeMissionId = (tileId: string) => `${FRONTIER_RETAKE_PREFIX}${tileId}`;
export const frontierTileIdForRetake = (missionId: string): string | null => missionId.startsWith(FRONTIER_RETAKE_PREFIX) ? missionId.slice(FRONTIER_RETAKE_PREFIX.length) : null;

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

/** A tile a Mist Surge has taken back (`world.frontierSurges.contested`). */
export function frontierTileContested(world: Partial<Pick<MergeWorldState, 'frontierSurges'>>, tileId: string): boolean {
  return world.frontierSurges?.contested?.[tileId] != null;
}

export function frontierTileState(world: FrontierWorld, tile: FrontierTile): FrontierTileState {
  if (frontierTileReclaimed(world, tile.id)) return frontierTileContested(world, tile.id) ? 'contested' : 'reclaimed';
  return frontierTileLit(world, tile) ? 'misted' : 'dark';
}

/** Every Frontier tile's state by id, for the scene. */
export function frontierTileStates(world: FrontierWorld): Record<string, FrontierTileState> {
  return Object.fromEntries(FRONTIER_TILES.map((tile) => [tile.id, frontierTileState(world, tile)]));
}

/** Every tile ever taken back (the chapters count these: a Surge never undoes a goal). */
export function frontierReclaimedCount(world: Pick<MergeWorldState, 'encounters'>): number {
  return FRONTIER_TILES.filter((tile) => frontierTileReclaimed(world, tile.id)).length;
}

/** The land held right now: taken back and not contested. What feeds the Lodge. */
export function frontierHeldCount(world: Pick<MergeWorldState, 'encounters'> & Partial<Pick<MergeWorldState, 'frontierSurges'>>): number {
  return FRONTIER_TILES.filter((tile) => frontierTileReclaimed(world, tile.id) && !frontierTileContested(world, tile.id)).length;
}

export function frontierContestedTiles(world: FrontierWorld): FrontierTile[] {
  return FRONTIER_TILES.filter((tile) => frontierTileState(world, tile) === 'contested');
}

/** The next tile to fight for: land the Mist took again first, then the first in the light still under the Mist. */
export function nextFrontierTile(world: FrontierWorld): FrontierTile | null {
  return frontierContestedTiles(world)[0] ?? FRONTIER_TILES.find((tile) => frontierTileState(world, tile) === 'misted') ?? null;
}

/** The Heart Tree level that lights the next dark tile, or null once every tile is in the light. */
export function nextFrontierTreeLevel(world: FrontierWorld): number | null {
  const dark = FRONTIER_TILES.filter((tile) => frontierTileState(world, tile) === 'dark').map((tile) => tile.tree);
  return dark.length ? Math.min(...dark) : null;
}

/** Timber from taking a tile back, once (the land's store, paid with its battle's first clear). */
export const frontierReclaimTimber = (tile: FrontierTile) => 1 + Math.ceil(tile.power / 2);

/** Timber from taking contested land back again: a little (the land's store was there all along). */
export const FRONTIER_RETAKE_TIMBER = 1;

/**
 * Mist Surges (`docs/cozy-4x-ftue-v2-wayfinders-road.md`, Part D3): the Mist pushes back. The first comes in Chapter 4,
 * straight at the Heart Tree (`SURGE_DEFENCE_MISSION_ID`); while it is held, the Mist takes back two edge tiles. From
 * then on, each new day it takes one (two once ten are held), never more than three contested at once. An edge tile is
 * held land beside open Mist: a Frontier tile not held, or past the third ring. Which ones is seeded by the day.
 */
export const SURGE_DEFENCE_MISSION_ID = 'surge:heart-tree';
export const FIRST_SURGE_TAKES = 2;
export const SURGE_MAX_CONTESTED = 3;
export const dailySurgeTakes = (held: number) => (held >= 10 ? 2 : 1);

export function frontierSurgesStarted(world: Partial<Pick<MergeWorldState, 'frontierSurges'>>): boolean {
  return world.frontierSurges?.firstHeldAt != null;
}

const NEIGHBOURS: readonly HexCoord[] = [{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }];
const byCell = new Map(FRONTIER_TILES.map((tile) => [`${tile.coord.q},${tile.coord.r}`, tile]));
const radius = (coord: HexCoord) => Math.max(Math.abs(coord.q), Math.abs(coord.r), Math.abs(coord.q + coord.r));
function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return value >>> 0;
}

/** Held land beside open Mist: where a Surge can strike. */
export function frontierEdgeTiles(world: FrontierWorld): FrontierTile[] {
  const held = (tile: FrontierTile) => frontierTileReclaimed(world, tile.id) && !frontierTileContested(world, tile.id);
  return FRONTIER_TILES.filter((tile) => held(tile) && NEIGHBOURS.some((step) => {
    const cell = { q: tile.coord.q + step.q, r: tile.coord.r + step.r };
    if (radius(cell) > 3) return true;
    const neighbour = byCell.get(`${cell.q},${cell.r}`);
    return Boolean(neighbour && !held(neighbour));
  }));
}

/** The tiles a Surge on this day takes (at most `count`, never past the cap), the same every time it is asked. */
export function mistSurgePicks(world: FrontierWorld, dayId: string, count: number): string[] {
  const room = Math.max(0, SURGE_MAX_CONTESTED - frontierContestedTiles(world).length);
  return frontierEdgeTiles(world).map((tile) => ({ id: tile.id, rank: hash(`${dayId}:${tile.id}`) })).sort((a, b) => a.rank - b.rank)
    .slice(0, Math.min(count, room)).map((entry) => entry.id);
}

/** Reclaimed land feeds the Lodge (`lodgeTimberWaiting`): one more Timber in its store per tile, a faster stream per three. */
export const frontierLodgeStoreBonus = (reclaimed: number) => reclaimed;
export const frontierLodgeRateBonus = (reclaimed: number) => Math.floor(reclaimed / 3);
