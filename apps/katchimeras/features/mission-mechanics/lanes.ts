import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { MergeItemDefinition, MergeWorldState } from '@/types/merge-world';
import type { LaneShot, LaneSpit, LaneWispState, MechanicEffect, MissionMechanicDefinition, MissionMechanicState, MissionWispView } from '@/types/mission-mechanic';
import type { MissionWindow } from './board-window';
import { seededUnit } from '@/features/encounter/seed';
import { wispWeapon, bulwarkBlast, mergeAttack, rippleFalloff, combatChain, combatFire, newCombatState, normalizeCombatState, shieldCapacity, type PlantVitality } from './combat-rules';

/**
 * Lanes (`docs/encounter-lanes.md`): a real-time battle on the docked board.
 *
 * - Wisps arrive high over the board's columns and drift down steadily, a row every `stepMs`. Every few cells one
 *   leaves Mist on the free cell it has just left.
 * - Every piece of Sprout size or bigger fires Glow straight up its own column on its own beat, at the lowest wisp
 *   over it or, with none, off the top of the board; bigger pieces fire faster and hit harder. A merged piece fires at once. Moving pieces is how the player aims.
 * - Pieces arrive on their own (`seeds`): every few seconds a Seed lands on a random empty cell (by the player's luck,
 *   a Sprout). There is nothing to tap: the player only moves and merges.
 * - A wisp still over the board spits Mist down its column now and then (`spitEvery`): the top-most free cell there
 *   mists over (it never lands on a piece; reaching one is what puts it under Mist).
 * - A wisp that reaches a piece puts it under Mist (it stops firing until its Mist is cleared) and holds for a beat.
 *   A wisp that drifts past the bottom row gets through: the level is lost.
 * - Every wisp down is the win.
 *
 * Time is the level's own clock (`state.clock`, ms of play), advanced by `lanesTick`; nothing here reads the wall
 * clock, so a tick is pure and a paused board simply stops. Glow is resolved when it lands (`landsAt`), and the board
 * flies each shot for exactly that long, so a wisp takes its damage as the player sees it hit.
 */
export type LanesMechanic = Extract<MissionMechanicDefinition, { kind: 'lanes' }>;
export type LanesState = Extract<MissionMechanicState, { kind: 'lanes' }>;

/** How often a piece fires and what each shot deals, by tier. A Seed (tier 1) does not fire: merge it up. */
export function laneFire(tier: number): { periodMs: number; damage: number } | null {
  if (tier >= 5) return { periodMs: 1_300, damage: 5 };
  if (tier >= 4) return { periodMs: 1_600, damage: 3 };
  if (tier >= 3) return { periodMs: 2_000, damage: 2 };
  if (tier >= 2) return { periodMs: 2_500, damage: 1 };
  return null;
}

/** The Spark chain (the Storm Pot's plants): they zap instead of shooting up their column. */
export const STORM_CHAIN = 'nature:storm';
export const STORM_POT_ID = 'storm-pot';

/**
 * A Spark plant's zap (`docs/lanes-variety-design.md`): every `periodMs` it strikes the nearest wisp within `reach`
 * cells in any direction (over the board's edge too, never high in the sky), then jumps on `jumps` times to the next
 * nearest within reach of the last; the Tempest Bloom's also stuns. A Spark Seed does not zap.
 */
export function laneZap(tier: number): { periodMs: number; reach: number; jumps: number; damage: number; stunMs: number } | null {
  if (tier >= 5) return { periodMs: 2_000, reach: 2, jumps: 2, damage: 4, stunMs: 1_000 };
  if (tier >= 4) return { periodMs: 2_200, reach: 2, jumps: 2, damage: 3, stunMs: 0 };
  if (tier >= 3) return { periodMs: 2_400, reach: 1, jumps: 1, damage: 2, stunMs: 0 };
  if (tier >= 2) return { periodMs: 2_600, reach: 1, jumps: 0, damage: 1, stunMs: 0 };
  return null;
}

/** How long Glow takes to fly up this many rows. */
export const laneFlightMs = (rows: number) => 160 + Math.max(1, rows) * 70;
/** A merged piece fires this soon after it is made. */
export const LANE_MERGE_SHOT_MS = 120;
/** Rows over the board a wisp arrives at, when its level does not say. */
export const LANE_START_ROW = 4;
/** A shot with nothing over it flies this many rows over the board, fading. */
export const LANE_MISS_ROW = 5;
/** A wisp's spat Mist lands this long after it is spat: when the board's bolt strikes (`MIST_BOLT_MS` x `MIST_BOLT_REACH`). */
export const LANE_SPIT_MS = 130;
/** Keep going: every wisp still standing is pushed back up this many rows. */
export const LANE_KEEP_GOING_ROWS = 3;
/** A dasher's lunge lasts this long. */
export const LANE_DASH_MS = 450;
/** A frozen plant cannot shoot for this long. */
export const LANE_FROST_MS = 4_000;
/** A spawned wisp holds a beat where it appears before it comes on. */
const LANE_SPAWN_HOLD_MS = 500;
/** A weaver weaves: its own column, the one to its right, its own, the one to its left (the other way at an edge). */
const WEAVE = [0, 1, 0, -1] as const;

const startRow = (mechanic: LanesMechanic, index: number) => -Math.max(1, Math.floor(mechanic.wisps[index]?.startRow ?? LANE_START_ROW));

export function createLanesState(mechanic: LanesMechanic): LanesState {
  return {
    kind: 'lanes', strikes: 0, clock: 0, ready: {}, shots: [], seq: 0, breached: null,
    wisps: mechanic.wisps.map((_, index) => ({ row: startRow(mechanic, index), damage: 0, holdUntil: 0, cells: 0 })),
    ...(mechanic.rulesVersion === 2 ? { combat: newCombatState(mechanic.breachBudget ?? 3) } : {}),
  };
}

/**
 * When a wisp arrives, in level time: its authored `at`, brought forward by however much the level has skipped ahead
 * (`state.advance`): whenever the board is left with no wisp, the next one comes at once rather than after a gap.
 */
export const laneArrivalAt = (mechanic: LanesMechanic, state: Pick<LanesState, 'advance'> & Partial<Pick<LanesState, 'wisps' | 'combat'>>, index: number) => {
  const spec = mechanic.wisps[index];
  // A spawned wisp (a splitter's shard, a caller's mistling) arrives when it is brought, and not before.
  if (spec?.spawn) return state.wisps?.[index]?.bornAt ?? Infinity;
  if (state.combat) return (spec?.wave ?? 0) > state.combat.wave ? Infinity : (spec?.at ?? 0) + (state.combat.waveStartedAt ?? 0);
  return (spec?.at ?? 0) - (state.advance ?? 0);
};
/** The column a wisp is in now: a weaver's changes, every other stays in its own. */
export const laneColumn = (mechanic: LanesMechanic, state: Pick<LanesState, 'wisps'>, index: number) => state.wisps[index]?.column ?? mechanic.wisps[index]?.column ?? 0;
export const laneArrived = (mechanic: LanesMechanic, state: LanesState, index: number) => state.clock >= laneArrivalAt(mechanic, state, index) && (!state.combat || (mechanic.wisps[index]?.wave ?? 0) <= state.combat.wave);
/** The board left with no wisp: the next one arrives this soon (and every later one as much sooner). */
export const LANE_REFILL_MS = 500;
export const laneAlive = (mechanic: LanesMechanic, state: LanesState, index: number) => (state.wisps[index]?.damage ?? 0) < (mechanic.wisps[index]?.hp ?? 0);

export const lanesTotalHp = (mechanic: LanesMechanic) => mechanic.wisps.reduce((sum, wisp) => sum + wisp.hp, 0);
export function lanesProgress(mechanic: LanesMechanic, state: LanesState) {
  return { current: mechanic.wisps.reduce((sum, wisp, index) => sum + Math.min(wisp.hp, state.wisps[index]?.damage ?? 0), 0), total: lanesTotalHp(mechanic) };
}
export const lanesComplete = (mechanic: LanesMechanic, state: LanesState) => mechanic.wisps.every((_, index) => !laneAlive(mechanic, state, index));

export function lanesViews(mechanic: LanesMechanic, state: LanesState): MissionWispView[] {
  const shields = new Map<number, number>();
  mechanic.wisps.forEach((wisp, index) => {
    if (!wisp.shield || !laneArrived(mechanic, state, index) || !laneAlive(mechanic, state, index)) return;
    const column = laneColumn(mechanic, state, index);
    shields.set(column, (shields.get(column) ?? 0) + 1);
  });
  return mechanic.wisps.map((wisp, index) => {
    const standing: Partial<LaneWispState> & { row: number; damage: number } = state.wisps[index] ?? { row: startRow(mechanic, index), damage: 0 };
    // A dasher mid-lunge drifts at its lunge's pace.
    const dashing = standing.dashUntil != null && state.clock < standing.dashUntil;
    const column = laneColumn(mechanic, state, index);
    const guarding = (shields.get(column - 1) ?? 0) + (shields.get(column) ?? 0) + (shields.get(column + 1) ?? 0)
      - (wisp.shield && laneArrived(mechanic, state, index) && laneAlive(mechanic, state, index) ? 1 : 0);
    return {
      id: wisp.id, hp: wisp.hp, damage: Math.min(wisp.hp, standing.damage),
      // Not here yet: drawn as not standing, so it arrives (grows in) the moment it is.
      alive: laneArrived(mechanic, state, index) && standing.damage < wisp.hp,
      placement: { kind: 'lane', column, row: standing.row },
      enterDelayMs: 0,
      drift: laneArrived(mechanic, state, index) && standing.damage < wisp.hp && state.breached == null && (standing.holdUntil ?? 0) <= state.clock && standing.engagedCell == null ? (dashing ? Math.max(1, wisp.dashRows ?? 2) / LANE_DASH_MS : 1 / Math.max(250, wisp.stepMs)) : 0,
      ...(wisp.look ? { look: wisp.look } : {}),
      // A bulwark beside it (and standing) shields it: its ring shows it.
      ...(guarding > 0 || (wisp.attack === 'mirror' && Math.floor(state.clock / 4000) % 2 === 0) ? { guarded: true } : {}),
    };
  });
}

/** The board cell at a column and row of the window, or null off the board. */
export function laneCell(window: MissionWindow, column: number, row: number): number | null {
  if (row < 0 || row >= window.rows || column < 0 || column >= window.columns) return null;
  return window.cellIndices[row * window.columns + column] ?? null;
}

/** A cell's column and row in the window, or null outside it. */
export function laneOf(window: MissionWindow, cell: number): { column: number; row: number } | null {
  const index = window.cellIndices.indexOf(cell);
  return index < 0 ? null : { column: index % window.columns, row: Math.floor(index / window.columns) };
}

const looseItem = (board: MergeWorldState, cell: number) => {
  const entry = board.board[cell];
  return entry && !entry.locked && !entry.mist && entry.occupant?.kind === 'item' ? entry.occupant : null;
};

/** A piece goes under Mist: bound, not lost (merging beside it or its twin in frees it). */
function bindPiece(cells: MergeWorldState['board'], cell: number, definitionId: string, instanceId?: string) {
  cells[cell] = { ...cells[cell]!, locked: true, blocker: null, occupant: null, mist: { kind: 'encounter', type: 'bound', hp: 1, holds: { kind: 'item', definitionId, ...(instanceId ? { instanceId } : {}) } } };
}

export type LanesTickResult = {
  state: LanesState;
  board: MergeWorldState;
  /** Glow fired this tick, for the board to fly; `wisp` -1 is a shot with nothing over it, flying off the top. */
  fired: LaneShot[];
  effects: MechanicEffect[];
  /** Something the board or the level's outcome depends on happened (a wisp fell, a piece went under Mist, Mist fell, a wisp got through): the store commits. */
  changed: boolean;
  /** A wisp moved, arrived or was hit: only the wisps need drawing again. */
  moved: boolean;
  /** A hit landed this tick: the wisps show it at once rather than on their next movement update. */
  hit: boolean;
  /** Mist wisps spat this tick, for the board to strike. */
  spat: LaneSpit[];
  /** Seeds the Sprinkler launched this tick: from its cell, arcing to theirs (the board flies them). */
  /** The Sprinkler's sparks this tick: from its cell at a wisp, for how much (it lands with `shots`). */
  sparks: { from: number; wisp: number; damage: number }[];
  /** Spark plants' zaps: from which cell, at which wisps in turn (the first, then each it jumped to). */
  zaps: { from: number; wisps: number[]; damage: number; simultaneous?: boolean }[];
};

/** The board row a wisp is over: the cell its centre is in. */
export const laneRowOf = (row: number) => Math.floor(row + 0.5);

/**
 * The level moves on by `dt` ms: Glow that has flown lands, wisps drift down (a wisp entering a cell with a piece
 * puts it under Mist and holds for a beat; one whose centre leaves the bottom row gets through), and every piece
 * due to fire fires, at the lowest wisp over it or, with none, off the top of the board. Pure.
 */
/** The tier below a piece in its chain (a Striker's hit), or null for a chain's first (a Seed is knocked off). */
function previousTier(items: ReadonlyMap<string, MergeItemDefinition>, definitionId: string): string | null {
  for (const [id, item] of items) if (item.nextItemId === definitionId) return id;
  return null;
}

/** What the player brings to the level: the chance a piece that arrives on its own is the better one (the Seed Nursery). */
export type LanesLuck = { chains?: import('@/features/encounter/encounter-run').EncounterProfile['chains']; tierTwoChance?: number; /** The Bloom House: Seeds land this much sooner (a fraction). */ seedPace?: number; /** The lead hero's level: added to every shot. */ shotPower?: number;
  damageMultiplier?: number;
  shieldBonus?: number; healBonus?: number; supportPace?: number; openingShield?: boolean;
  warningMs?: number;
  /** The Seed Sprinkler's spark (the Seed Nursery's level): every this many launches, for this much. */ sparkEvery?: number; sparkDamage?: number };

/** The Seed Sprinkler's generator: the Seeds come out of the cell it stands on. */
export const SEED_SPRINKLER_ID = 'seed-sprinkler';
/** A spark's bolt reaches its wisp this soon after it leaves the Sprinkler. */
export const LANE_SPARK_MS = 180;
export const DEFAULT_SPARK_EVERY = 3;
export const DEFAULT_SPARK_DAMAGE = 1;

/** Where the Seed Sprinkler (or another engine: the Storm Pot) stands on the board, or null. */
export function sprinklerCell(board: MergeWorldState, window: MissionWindow, generatorId: string = SEED_SPRINKLER_ID): number | null {
  for (const cell of window.cellIndices) {
    const occupant = board.board[cell]?.occupant;
    if (occupant?.kind === 'generator' && occupant.generatorId === generatorId) return cell;
  }
  return null;
}
const chebyshev = (a: { column: number; row: number }, b: { column: number; row: number }) => Math.max(Math.abs(a.column - b.column), Math.abs(a.row - b.row));

/**
 * Where the Sprinkler's next Seed lands: a free cell within its reach (never one a wisp is on), else any free cell of
 * the Seeds' area; one of them by `key`. Null when there is no room.
 */
export function sprinklerLanding(mechanic: LanesMechanic, state: LanesState, board: MergeWorldState, window: MissionWindow, key: string, also: number | null = null, engine: { generatorId: string; reach: number } | null = null): number | null {
  const occupied = new Set(mechanic.wisps.flatMap((_, index) => {
    if (!laneArrived(mechanic, state, index) || !laneAlive(mechanic, state, index)) return [];
    const cell = laneCell(window, laneColumn(mechanic, state, index), laneRowOf(state.wisps[index]!.row));
    return cell == null ? [] : [cell];
  }));
  const anywhere = (mechanic.seeds?.area ?? window.cellIndices).filter((cell) => window.cellIndices.includes(cell) && (cell === also || isFree(board, cell)) && !occupied.has(cell));
  const source = engine ?? (mechanic.sprinkler ? { generatorId: SEED_SPRINKLER_ID, reach: mechanic.sprinkler.reach } : null);
  const sprinkler = source ? sprinklerCell(board, window, source.generatorId) : null;
  const at = sprinkler != null ? laneOf(window, sprinkler) : null;
  const near = at && source ? anywhere.filter((cell) => chebyshev(laneOf(window, cell)!, at) <= Math.max(1, source.reach)) : [];
  const free = near.length ? near : anywhere;
  return free.length ? free[Math.min(free.length - 1, Math.floor(seededUnit(key) * free.length))]! : null;
}

/** The wisp a Sprinkler spark strikes: the nearest standing within its reach of it, or null. */
function sprinklerSparkTarget(mechanic: LanesMechanic, state: LanesState, board: MergeWorldState, window: MissionWindow): { from: number; wisp: number } | null {
  const from = mechanic.sprinkler ? sprinklerCell(board, window) : null;
  const at = from != null ? laneOf(window, from) : null;
  if (from == null || !at) return null;
  let target = -1;
  let best = Infinity;
  mechanic.wisps.forEach((_, index) => {
    if (!laneArrived(mechanic, state, index) || !laneAlive(mechanic, state, index)) return;
    const distance = chebyshev({ column: laneColumn(mechanic, state, index), row: laneRowOf(state.wisps[index]!.row) }, at);
    if (distance <= mechanic.sprinkler!.sparkReach && distance < best) { best = distance; target = index; }
  });
  return target >= 0 ? { from, wisp: target } : null;
}

/**
 * A tap on the Seed Sprinkler (a tapped one): the Seed the tap made lands where the Sprinkler sends it (the board flies
 * it there from the Sprinkler, as any spawner's piece), the launch is counted, and every few launches a spark is queued
 * at the nearest wisp in reach (it flies on the next tick).
 */
export function lanesSprinklerTapped(mechanic: LanesMechanic, state: LanesState, board: MergeWorldState, window: MissionWindow, spawnedCell: number | null, luck: Pick<LanesLuck, 'sparkEvery' | 'sparkDamage'> = {}): { state: LanesState; board: MergeWorldState; landed: number | null } {
  const seed = spawnedCell != null ? board.board[spawnedCell]?.occupant : null;
  if (spawnedCell == null || seed?.kind !== 'item') return { state, board, landed: spawnedCell };
  const launches = (state.launches ?? 0) + 1;
  const landed = sprinklerLanding(mechanic, state, board, window, `lanes-sprinkler:${launches}:${Math.round(state.clock)}`, spawnedCell) ?? spawnedCell;
  let next = board;
  if (landed !== spawnedCell) {
    const cells = [...board.board];
    cells[landed] = { ...cells[landed]!, occupant: seed };
    cells[spawnedCell] = { ...cells[spawnedCell]!, occupant: null };
    next = { ...board, board: cells };
  }
  const every = Math.max(1, Math.floor(luck.sparkEvery ?? state.sparkEvery ?? DEFAULT_SPARK_EVERY));
  const damage = Math.max(1, Math.floor(luck.sparkDamage ?? state.sparkDamage ?? DEFAULT_SPARK_DAMAGE));
  const target = launches % every === 0 ? sprinklerSparkTarget(mechanic, state, next, window) : null;
  return { state: { ...state, launches, ...(target ? { sparkQueue: [...(state.sparkQueue ?? []), { ...target, damage }] } : {}) }, board: next, landed };
}

/**
 * A tap on the Storm Pot: the Spark Seed the tap made lands on a free cell within its reach, clear of every wisp (the
 * board flies it there, as any spawner's piece).
 */
export function lanesStormPotTapped(mechanic: LanesMechanic, state: LanesState, board: MergeWorldState, window: MissionWindow, spawnedCell: number | null): { board: MergeWorldState; landed: number | null } {
  const seed = spawnedCell != null ? board.board[spawnedCell]?.occupant : null;
  const engine = mechanic.generators?.find(g => g.generatorId !== SEED_SPRINKLER_ID && seed?.kind === 'item' && combatChain(seed.definitionId) === ({ 'storm-pot': 'storm', 'ward-planter': 'bulwark', 'dew-well': 'dew', 'lantern-post': 'lantern' } as Record<string, string>)[g.generatorId]) ?? mechanic.secondary ?? (mechanic.stormPot ? { ...mechanic.stormPot, generatorId: STORM_POT_ID } : null);
  if (!engine || spawnedCell == null || seed?.kind !== 'item') return { board, landed: spawnedCell };
  const landed = sprinklerLanding({ ...mechanic, seeds: undefined }, state, board, window, `lanes-storm:${spawnedCell}:${Math.round(state.clock)}:${board.nextInstance}`, spawnedCell, engine) ?? spawnedCell;
  if (landed === spawnedCell) return { board, landed };
  const cells = [...board.board];
  cells[landed] = { ...cells[landed]!, occupant: seed };
  cells[spawnedCell] = { ...cells[spawnedCell]!, occupant: null };
  return { board: { ...board, board: cells }, landed };
}

export function lanesTick(mechanic: LanesMechanic, input: LanesState, board: MergeWorldState, dt: number, window: MissionWindow, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID, luck: LanesLuck = {}): LanesTickResult {
  if (input.breached != null || lanesComplete(mechanic, input)) return { state: input, board, fired: [], effects: [], changed: false, moved: false, hit: false, spat: [], sparks: [], zaps: [] };
  const modern = mechanic.rulesVersion === 2;
  const combat = modern ? normalizeCombatState(input.combat, mechanic.breachBudget ?? 3) : null;
  if (combat) combat.warnings = combat.warnings.filter((warning) => warning.wisp < mechanic.wisps.length && warning.cells.every((cell) => window.cellIndices.includes(cell)));
  if (combat && combat.preparingMs > 0) {
    combat.preparingMs = Math.max(0, combat.preparingMs - Math.max(0, dt));
    return { state: { ...input, combat }, board, fired: [], effects: [], changed: true, moved: false, hit: false, spat: [], sparks: [], zaps: [] };
  }
  const from = input.clock;
  const clock = from + Math.max(0, dt);
  const wisps: LaneWispState[] = input.wisps.map((wisp) => ({ ...wisp }));
  let cells: MergeWorldState['board'] | null = null;
  const current = (): MergeWorldState => (cells ? { ...board, board: cells } : board);
  const effects: MechanicEffect[] = [];
  let changed = false;
  let moved = false;
  let hit = false;
  let pushedBack = input.pushedBack ?? 0;
  let lastPushAt = input.lastPushAt;
  let breached: number | null = null;
  let strikes = input.strikes;
  const alive = (index: number) => wisps[index]!.damage < mechanic.wisps[index]!.hp;
  let advance = input.advance ?? 0;
  const arrivalAt = (index: number) => laneArrivalAt(mechanic, { wisps, advance, ...(combat ? { combat } : {}) }, index);
  const arrived = (index: number) => clock >= arrivalAt(index) && (!combat || (mechanic.wisps[index]!.wave ?? 0) <= combat.wave);
  const col = (index: number) => wisps[index]!.column ?? mechanic.wisps[index]!.column;
  const frozen: Record<string, number> = Object.fromEntries(Object.entries(input.frozen ?? {}).filter(([, until]) => until > clock));
  let seq = input.seq;
  const multiplier = modern ? Math.max(1, luck.damageMultiplier ?? 1) : 1;
  const damageOf = (damage: number, chain = 'garden') => modern ? damage * multiplier * (luck.chains?.[chain as keyof NonNullable<LanesLuck['chains']>]?.power ?? 1) : damage + Math.max(0, Math.floor(luck.shotPower ?? 0));
  const vitality = (cell: number): PlantVitality | null => {
    const piece = looseItem(current(), cell);
    if (!combat || !piece) return null;
    const tier = items.get(piece.definitionId)?.tier ?? 1;
    const old = combat.plants[piece.instanceId];
    if (old?.tier === tier) return old;
    return combat.plants[piece.instanceId] = { hearts: tier, tier, shield: combatChain(piece.definitionId) === 'bulwark' ? Math.min(3, shieldCapacity(tier) + (tier >= 2 ? luck.shieldBonus ?? 0 : 0)) : luck.openingShield && clock < 1000 ? 1 : 0, immuneUntil: 0, shieldAt: clock + 8000, interceptAt: 0 };
  };
  const protect = (cell: number): boolean => {
    if (!combat) return false;
    const p = looseItem(current(), cell);
    if (!p) return false;
    const at = laneOf(window, cell)!;
    const candidates = [cell, ...window.cellIndices.filter((other) => other !== cell && chebyshev(laneOf(window, other)!, at) <= 1)];
    for (const other of candidates) {
      const guard = looseItem(current(), other);
      if (!guard || (other !== cell && combatChain(guard.definitionId) !== 'bulwark')) continue;
      const v = vitality(other)!;
      if (v.shield > 0) { v.shield -= 1; combat.prevented += 1; changed = true; return true; }
    }
    return false;
  };
  const hurt = (cell: number, amount: number, wisp: number) => {
    const piece = looseItem(current(), cell);
    if (!piece) return;
    const health = vitality(cell);
    if (health?.charge) return;
    if (health && (health.immuneUntil > clock || protect(cell))) return;
    if (health) { health.hearts = Math.max(0, health.hearts - amount); changed = true; if (health.hearts > 0) return; }
    const lower = previousTier(items, piece.definitionId);
    cells ??= [...board.board];
    cells[cell] = { ...cells[cell]!, occupant: lower ? { ...piece, definitionId: lower } : null };
    if (health) { health.tier = items.get(lower ?? '')?.tier ?? 1; health.hearts = health.tier; health.immuneUntil = clock + 750; health.shield = Math.min(health.shield, shieldCapacity(health.tier)); }
    effects.push({ kind: 'corrupted', wisp, cell }); changed = true;
  };
  const breach = (index: number) => {
    effects.push({ kind: 'breached', wisp: index }); changed = true;
    if (!combat) { breached = index; return; }
    combat.breaches += mechanic.wisps[index]!.breachDamage ?? 1;
    combat.hearts = Math.max(0, combat.hearts - (mechanic.wisps[index]!.breachDamage ?? 1));
    if (combat.hearts === 0) { breached = index; return; }
    wisps[index]!.damage = mechanic.wisps[index]!.hp;
    // Breached parents do not produce additional children beyond the boundary.
    mechanic.wisps.forEach((child, other) => { if (child.spawn?.by === index) wisps[other]!.damage = child.hp; });
  };
  if (combat) for (const cell of window.cellIndices) vitality(cell);
  // Spawned wisps: a splitter's shards come the moment it falls (however it fell), where it fell; a caller's mistlings
  // it never called fade with it.
  const reconcileSpawns = () => {
    mechanic.wisps.forEach((spec, index) => {
      const wisp = wisps[index]!;
      if (!spec.spawn || wisp.bornAt != null || wisp.damage >= spec.hp) return;
      const parent = spec.spawn.by;
      if (alive(parent)) return;
      if (spec.spawn.on === 'death' && clock >= arrivalAt(parent)) {
        wisp.bornAt = clock;
        wisp.row = wisps[parent]!.row;
        wisp.holdUntil = clock + LANE_SPAWN_HOLD_MS;
        effects.push({ kind: 'split', wisp: parent, twin: index, cell: -1 });
      } else {
        wisp.damage = spec.hp;
      }
      moved = true;
      changed = true;
    });
  };
  reconcileSpawns();
  // A bulwark shields the wisps in the columns beside it: the one standing guard over this one, if any.
  const shieldFor = (target: number): number => modern && mechanic.wisps[target]?.shield ? -1 : mechanic.wisps.findIndex((spec, index) => index !== target && spec.shield && arrived(index) && alive(index) && Math.abs(col(index) - col(target)) <= 1);
  const pulse = (cell: number, tier: number, instanceId: string, primary = -1, merge = false, destination?: { column: number; row: number }) => {
    if (tier < 2) return;
    const origin = destination ?? laneOf(window, cell)!;
    const hitWisps: number[] = [];
    const blast = bulwarkBlast(tier);
    const echo = merge && mechanic.terrain?.some(t => t.cell === cell && t.kind === 'echo') ? 1.5 : 1;
    mechanic.wisps.forEach((spec, index) => {
      if (!alive(index) || !arrived(index)) return;
      const distance = Math.hypot(col(index) - origin.column, wisps[index]!.row - origin.row);
      const falloff = rippleFalloff(distance, blast.radius);
      if (!falloff) return;
      hitWisps.push(index);
      const damage = damageOf(blast.damage * (merge ? 0.45 : index === primary ? 1.5 : 1), 'bulwark') * falloff * echo;
      wisps[index]!.damage = Math.min(spec.hp, wisps[index]!.damage + damage * (shieldFor(index) >= 0 ? 0.5 : 1));
      if (alive(index)) {
        wisps[index]!.row -= blast.pushRows * (merge ? 0.45 : 1);
        wisps[index]!.holdUntil = Math.max(wisps[index]!.holdUntil, clock + 450 + tier * 75);
        delete wisps[index]!.dashFrom; delete wisps[index]!.dashUntil;
        if (spec.dashEvery) wisps[index]!.dashAt = clock + spec.dashEvery;
      }
      strikes += 1; hit = true; moved = true;
    });
    effects.push({ kind: 'wall-impact', cell, tier, instanceId, wisp: primary, radius: blast.radius, hitWisps, consumed: !merge, toColumn: origin.column, toRow: origin.row });
    changed = true;
  };
  const wallImpact = (cell: number, index: number, contactRow = wisps[index]!.row): boolean => {
    const piece = looseItem(current(), cell);
    if (!combat || !piece || combatChain(piece.definitionId) !== 'bulwark' || frozen[piece.instanceId] > clock) return false;
    const health = vitality(cell)!;
    if (health.tier < 2) return false;
    wisps[index]!.row = contactRow;
    if (!health.charge) {
      const origin = laneOf(window, cell)!;
      const dx = col(index) - origin.column, dy = contactRow - origin.row;
      const distance = Math.max(1, Math.hypot(dx, dy));
      health.charge = { at: clock + bulwarkBlast(health.tier).chargeMs, startedAt: clock, target: index,
        toColumn: origin.column + dx / distance, toRow: origin.row + dy / distance };
      effects.push({ kind: 'wall-impact', cell, tier: health.tier, instanceId: piece.instanceId, wisp: index, radius: 1, charge: true });
      changed = true;
    }
    wisps[index]!.holdUntil = Math.max(wisps[index]!.holdUntil, health.charge.at);
    delete wisps[index]!.dashFrom; delete wisps[index]!.dashUntil;
    return true;
  };
  // An extended proximity fuse, including adjacent lanes, followed by a one-cell lunge. Once armed it always detonates.
  if (combat) for (const cell of window.cellIndices) {
    const piece = looseItem(current(), cell);
    if (!piece || combatChain(piece.definitionId) !== 'bulwark') continue;
    const health = vitality(cell)!;
    if (health.tier < 2) continue;
    if (health.charge && health.charge.at <= clock) {
      const origin = laneOf(window, cell)!;
      pulse(cell, health.tier, piece.instanceId, health.charge.target, false, {
        column: health.charge.toColumn ?? origin.column, row: health.charge.toRow ?? origin.row });
      cells ??= [...board.board]; cells[cell] = { ...cells[cell]!, occupant: null };
      delete combat.plants[piece.instanceId];
      continue;
    }
    const origin = laneOf(window, cell)!;
    const closest = mechanic.wisps.map((_, i) => i).filter(i => arrived(i) && alive(i))
      .sort((a, b) => Math.hypot(col(a) - origin.column, wisps[a]!.row - origin.row) - Math.hypot(col(b) - origin.column, wisps[b]!.row - origin.row))[0];
    if (closest != null && Math.hypot(col(closest) - origin.column, wisps[closest]!.row - origin.row) <= bulwarkBlast(health.tier).triggerRange) wallImpact(cell, closest);
  }

  // Glow that has landed.
  const shots: LaneShot[] = [];
  for (const shot of input.shots) {
    if (shot.landsAt > clock) { shots.push(shot); continue; }
    const wisp = wisps[shot.wisp];
    if (!wisp || !alive(shot.wisp)) continue;
    // A hit is the wisps' own business (only they show it); the one that brings a wisp down changes the level.
    moved = true;
    hit = true;
    const guard = shieldFor(shot.wisp);
    if (guard >= 0) { effects.push({ kind: 'shielded', wisp: guard, target: shot.wisp, amount: shot.damage }); if (!modern) continue; }
    if (combat && mechanic.wisps[shot.wisp]?.attack === 'mirror' && Math.floor(clock / 4000) % 2 === 0 && (!shot.kind || shot.kind === 'projectile')) {
      const key = `reflect:${shot.wisp}`;
      if ((combat.nextAttack[key] ?? 0) <= clock) { hurt(shot.fromCell, 1, shot.wisp); combat.nextAttack[key] = clock + 1000; }
      continue;
    }
    wisp.damage = Math.min(mechanic.wisps[shot.wisp]!.hp, wisp.damage + shot.damage * (guard >= 0 ? 0.5 : 1));
    if (!alive(shot.wisp)) changed = true;
    strikes += 1;
  }
  reconcileSpawns();

  // Spat Mist that has fallen: a cell still free mists over; one taken meanwhile (a piece put there) is left alone.
  const spits: LaneSpit[] = [];
  for (const spit of input.spits ?? []) {
    if (spit.landsAt > clock) { spits.push(spit); continue; }
    if (spit.frost) {
      // A frost bolt: the plant it was aimed at cannot shoot for a while.
      const piece = looseItem(current(), spit.cell);
      if (piece && !protect(spit.cell)) { frozen[piece.instanceId] = clock + LANE_FROST_MS; effects.push({ kind: 'frozen', wisp: spit.wisp, cell: spit.cell }); changed = true; }
      continue;
    }
    if (spit.snatch) {
      // A snatcher's grab: the piece is gone.
      const piece = looseItem(current(), spit.cell);
      if (piece && !protect(spit.cell)) {
        cells ??= [...board.board];
        cells[spit.cell] = { ...cells[spit.cell]!, occupant: null };
        effects.push({ kind: 'snatched', wisp: spit.wisp, cell: spit.cell, definitionId: piece.definitionId });
        changed = true;
      }
      continue;
    }
    if (spit.strike) {
      if (modern) { hurt(spit.cell, spit.damage ?? 2, spit.wisp); continue; }
      // A striker's bolt: the plant it was aimed at drops a tier (a Seed is knocked off the board); gone, nothing.
      const piece = looseItem(current(), spit.cell);
      if (piece) {
        const lower = previousTier(items, piece.definitionId);
        cells ??= [...board.board];
        cells[spit.cell] = { ...cells[spit.cell]!, occupant: lower ? { ...piece, definitionId: lower } : null };
        effects.push({ kind: 'corrupted', wisp: spit.wisp, cell: spit.cell });
        changed = true;
      }
      continue;
    }
    if (isFree(current(), spit.cell)) {
      cells ??= [...board.board];
      cells[spit.cell] = { ...cells[spit.cell]!, locked: true, blocker: null, occupant: null, mist: { kind: 'encounter', type: 'light', hp: 1 } };
      effects.push({ kind: 'corrupted', wisp: spit.wisp, cell: spit.cell });
      changed = true;
    }
  }

  // Warnings are fixed board targets: moving a plant out of a marked cell genuinely dodges the hit.
  if (combat) {
    for (const terrain of mechanic.terrain ?? []) {
      if (terrain.kind !== 'vent') continue;
      const key = `vent:${terrain.cell}`;
      const due = combat.nextAttack[key] ?? 12000;
      if (clock < due) continue;
      combat.nextAttack[key] = clock + 12000;
      const plant = looseItem(current(), terrain.cell);
      if (plant) { if (!protect(terrain.cell)) { frozen[plant.instanceId] = clock + 2000; changed = true; } }
      else if (isFree(current(), terrain.cell)) {
        cells ??= [...board.board];
        cells[terrain.cell] = { ...cells[terrain.cell]!, locked: true, mist: { kind: 'encounter', type: 'light', hp: 1 } };
        changed = true;
      }
    }
    const waiting = combat.warnings.filter((warning) => warning.landsAt > clock);
    for (const warning of combat.warnings.filter((warning) => warning.landsAt <= clock)) {
      if (!alive(warning.wisp)) continue;
      if (warning.kind === 'gunner') hurt(warning.cells[0]!, 1, warning.wisp);
      if (warning.kind === 'bomber') for (const cell of warning.cells) {
        const piece = looseItem(current(), cell);
        if (piece && protect(cell)) continue;
        if (!piece && !isFree(current(), cell)) continue;
        cells ??= [...board.board];
        if (piece) bindPiece(cells, cell, piece.definitionId, piece.instanceId);
        else cells[cell] = { ...cells[cell]!, locked: true, mist: { kind: 'encounter', type: 'light', hp: 1 } };
        effects.push({ kind: 'corrupted', wisp: warning.wisp, cell }); changed = true;
      }
      if (warning.kind === 'burrower') {
        const target = laneOf(window, warning.cells[0]!);
        if (target) { wisps[warning.wisp]!.row = target.row - 0.6; wisps[warning.wisp]!.column = target.column; wisps[warning.wisp]!.holdUntil = clock + 1000; moved = true; changed = true; }
      }
    }
    combat.warnings = waiting;
    mechanic.wisps.forEach((spec, index) => {
      if (!spec.attack || spec.attack === 'mirror' || !alive(index) || !arrived(index)) return;
      const key = `attack:${index}`;
      combat.nextAttack[key] ??= arrivalAt(index) + (spec.attackEveryMs ?? 7000);
      if (combat.nextAttack[key]! > clock) return;
      combat.nextAttack[key] = clock + (spec.attackEveryMs ?? 7000);
      let target = window.cellIndices.find((cell) => laneOf(window, cell)!.column === col(index) && looseItem(current(), cell));
      if (spec.attack === 'burrower') {
        const column = col(index) === window.columns - 1 ? col(index) - 1 : col(index) + 1;
        target = laneCell(window, column, Math.min(window.rows - 2, Math.max(0, laneRowOf(wisps[index]!.row) + 2))) ?? undefined;
        wisps[index]!.holdUntil = clock + 2000;
      }
      if (target == null) return;
      const at = laneOf(window, target)!;
      const targets = spec.attack === 'bomber' ? window.cellIndices.filter((cell) => { const p = laneOf(window, cell)!; return Math.abs(p.row - at.row) + Math.abs(p.column - at.column) <= 1; }) : [target];
      combat.warnings.push({ id: ++seq, wisp: index, cells: targets, kind: spec.attack, landsAt: clock + (luck.warningMs ?? 2000) }); changed = true;
    });
    for (const cell of window.cellIndices) {
      const piece = looseItem(current(), cell);
      if (!piece) continue;
      const chain = combatChain(piece.definitionId);
      const tier = items.get(piece.definitionId)?.tier ?? 1;
      if (tier < 2 || frozen[piece.instanceId] > clock) continue;
      const health = vitality(cell)!;
      if (chain === 'bulwark' && tier >= 2 && health.shieldAt <= clock) {
        health.shield = Math.min(3, shieldCapacity(tier) + (luck.shieldBonus ?? 0), health.shield + 1); health.shieldAt = clock + 8000 * (1 - (luck.supportPace ?? 0)); changed = true;
      }
      if (chain !== 'dew') continue;
      const key = `heal:${piece.instanceId}`;
      combat.nextAttack[key] ??= clock + 3000;
      if (combat.nextAttack[key]! > clock) continue;
      combat.nextAttack[key] = clock + 3000;
      const at = laneOf(window, cell)!;
      const neighbours = window.cellIndices.filter((other) => other !== cell && chebyshev(laneOf(window, other)!, at) <= 1);
      const injured = neighbours.map((other) => ({ cell: other, health: vitality(other) })).filter((p) => p.health && p.health.hearts < p.health.tier).sort((a, b) => (b.health!.tier - b.health!.hearts) - (a.health!.tier - a.health!.hearts) || a.cell - b.cell)[0];
      if (injured) { injured.health!.hearts = Math.min(injured.health!.tier, injured.health!.hearts + (1 + (luck.healBonus ?? 0)) * (luck.chains?.dew?.power ?? 1)); changed = true; }
      if (tier >= 3) for (const other of neighbours) {
        const neighbour = looseItem(current(), other);
        if (neighbour && frozen[neighbour.instanceId]) { delete frozen[neighbour.instanceId]; changed = true; break; }
        const mist = current().board[other]?.mist;
        if (mist?.kind !== 'encounter' || !['light', 'bound'].includes(mist.type)) continue;
        cells ??= [...board.board];
        const holds = mist.holds;
        cells[other] = { ...cells[other]!, mist: null, locked: false, occupant: holds?.kind === 'item' ? { kind: 'item', definitionId: holds.definitionId, instanceId: holds.instanceId ?? `dew:${piece.instanceId}:${seq++}` } : null };
        changed = true; break;
      }
    }
  }

  const weaponTarget = (index: number, range: number) => window.cellIndices
    .filter(cell => { const at = laneOf(window, cell)!; return at.column === col(index) && at.row >= wisps[index]!.row
      && at.row - wisps[index]!.row <= range && looseItem(current(), cell); })
    .sort((a, b) => laneOf(window, a)!.row - laneOf(window, b)!.row)[0];
  // Wisps drift down, a row every `stepMs`, from the moment they arrive; a hold after reaching a piece pauses them.
  for (let index = 0; index < mechanic.wisps.length && breached == null; index += 1) {
    const spec = mechanic.wisps[index]!;
    const wisp = wisps[index]!;
    if (!arrived(index) || !alive(index)) continue;
    if (from < arrivalAt(index)) moved = true;
    // A crawler climbs out of the Mist on its cell, then creeps across the board toward the nearest plant.
    if (spec.crawlEvery) {
      if (wisp.crawlAt == null) {
        const place = spec.crawlFrom != null ? laneOf(window, spec.crawlFrom) : null;
        wisp.column = place?.column ?? spec.column;
        wisp.row = place?.row ?? 0;
        wisp.crawlAt = clock + spec.crawlEvery;
        moved = true;
        changed = true;
        continue;
      }
      if (wisp.holdUntil > clock || wisp.crawlAt > clock) continue;
      wisp.crawlAt = clock + spec.crawlEvery;
      const here = { column: col(index), row: laneRowOf(wisp.row) };
      const boardNow = current();
      let goal: { cell: number; column: number; row: number; distance: number } | null = null;
      for (const cell of window.cellIndices) {
        if (!looseItem(boardNow, cell)) continue;
        const at = laneOf(window, cell)!;
        const distance = Math.abs(at.column - here.column) + Math.abs(at.row - here.row);
        if (!goal || distance < goal.distance) goal = { cell, ...at, distance };
      }
      if (goal && goal.distance <= 1) {
        if (modern) { if (!wallImpact(goal.cell, index)) hurt(goal.cell, 2, index); continue; }
        // Beside a plant: it knocks it down a tier (a Seed off the board).
        const piece = looseItem(boardNow, goal.cell)!;
        const lower = previousTier(items, piece.definitionId);
        cells ??= [...board.board];
        cells[goal.cell] = { ...cells[goal.cell]!, occupant: lower ? { ...piece, definitionId: lower } : null };
        effects.push({ kind: 'corrupted', wisp: index, cell: goal.cell });
        moved = true;
        changed = true;
        continue;
      }
      const toward = (delta: number) => Math.sign(delta);
      const steps = goal
        ? (Math.abs(goal.row - here.row) >= Math.abs(goal.column - here.column)
          ? [{ column: 0, row: toward(goal.row - here.row) }, { column: toward(goal.column - here.column), row: 0 }]
          : [{ column: toward(goal.column - here.column), row: 0 }, { column: 0, row: toward(goal.row - here.row) }])
        : [{ column: 0, row: 1 }, { column: here.column < window.columns / 2 ? 1 : -1, row: 0 }];
      for (const step of steps) {
        if (!step.column && !step.row) continue;
        const next = { column: here.column + step.column, row: here.row + step.row };
        if (next.row >= window.rows) {
          // Off the bottom row: it got through (a forgiving level sends it back to the top).
          if (mechanic.forgiving) { wisp.row = 0; pushedBack += 1; lastPushAt = clock; changed = true; break; }
          breach(index);
          break;
        }
        const cell = laneCell(window, next.column, next.row);
        if (cell == null || boardNow.board[cell]?.occupant) continue;
        wisp.column = next.column;
        wisp.row = next.row;
        moved = true;
        changed = true;
        break;
      }
      continue;
    }
    const weaponForMove = modern ? wispWeapon(spec) : null;
    const engaged = weaponForMove && !weaponForMove.moving ? weaponTarget(index, weaponForMove.range) : undefined;
    if (wisp.engagedCell !== engaged) { moved = true; changed = true; }
    wisp.engagedCell = engaged;
    if (engaged != null) {
      delete wisp.dashFrom; delete wisp.dashUntil;
      continue;
    }
    // A weaver slides a column over now and then, once it is near the board; a piece in its way goes under Mist.
    if (spec.weaveEvery && wisp.row >= -1.5) {
      const due = wisp.weaveAt ?? clock + spec.weaveEvery;
      if (due <= clock) {
        const weaves = (wisp.weaves ?? 0) + 1;
        const offset = WEAVE[weaves % WEAVE.length]!;
        let column = spec.column + offset;
        if (column < 0 || column >= window.columns) column = spec.column - offset;
        wisp.column = Math.max(0, Math.min(window.columns - 1, column));
        wisp.weaves = weaves;
        wisp.weaveAt = clock + spec.weaveEvery;
        moved = true;
        changed = true;
        const cell = laneRowOf(wisp.row) >= 0 ? laneCell(window, wisp.column, laneRowOf(wisp.row)) : null;
        const piece = cell != null ? looseItem(current(), cell) : null;
        if (cell != null && piece) {
          if (wallImpact(cell, index)) continue;
          cells ??= [...board.board];
          if (combat) hurt(cell, 1, index);
          else { bindPiece(cells, cell, piece.definitionId); effects.push({ kind: 'bound', wisp: index, cell, definitionId: piece.definitionId }); }
          wisp.holdUntil = clock + spec.stepMs;
        }
      } else wisp.weaveAt = due;
    }
    // A dasher lunges now and then once it is near the board: a couple of rows in a moment.
    if (spec.dashEvery && wisp.row >= -1.5 && wisp.holdUntil <= clock && !(wisp.dashUntil != null && wisp.dashUntil > clock)) {
      const due = wisp.dashAt ?? clock + spec.dashEvery;
      if (due <= clock) { wisp.dashFrom = clock; wisp.dashUntil = clock + LANE_DASH_MS; wisp.dashAt = clock + spec.dashEvery; changed = true; }
      else wisp.dashAt = due;
    }
    const hereCell = laneCell(window, col(index), laneRowOf(wisp.row));
    if (hereCell != null && wallImpact(hereCell, index)) continue;
    const start = Math.max(from, arrivalAt(index), wisp.holdUntil);
    if (clock <= start) continue;
    const wet = modern && mechanic.terrain?.some((t) => t.cell === hereCell && t.kind === 'puddle');
    let target = wisp.row + (clock - start) / Math.max(250, spec.stepMs * (wet ? 1.35 : 1));
    if (wisp.dashFrom != null && wisp.dashUntil != null) {
      const lunge = Math.max(0, Math.min(clock, wisp.dashUntil) - Math.max(start, wisp.dashFrom));
      target += lunge * (Math.max(1, spec.dashRows ?? 2) / LANE_DASH_MS - 1 / Math.max(250, spec.stepMs));
    }
    const weapon = modern ? wispWeapon(spec) : null;
    if (weapon && !weapon.moving) {
      const ahead = weaponTarget(index, Infinity);
      if (ahead != null) {
        const stopRow = laneOf(window, ahead)!.row - weapon.range;
        if (target >= stopRow) {
          target = stopRow; wisp.engagedCell = ahead; changed = true;
          delete wisp.dashFrom; delete wisp.dashUntil;
        }
      }
    }
    moved = true;
    // Each cell its centre enters on the way, in order.
    let row = wisp.row;
    while (breached == null) {
      const next = laneRowOf(row) + 1;
      if (next - 0.5 > target) { row = target; break; }
      if (next >= window.rows) {
        // A forgiving level (the first battle) cannot be lost: the wisp is pushed back over the board, to try again.
        if (mechanic.forgiving) {
          row = -2;
          wisp.holdUntil = clock + spec.stepMs;
          pushedBack += 1;
          lastPushAt = clock;
          changed = true;
          break;
        }
        breach(index); row = next - 0.5; break;
      }
      const cell = next >= 0 ? laneCell(window, col(index), next) : null;
      const piece = cell != null ? looseItem(current(), cell) : null;
      if (cell != null && piece) {
        if (wallImpact(cell, index, next - 0.5)) { row = wisp.row; break; }
        // It reaches a piece: the piece goes under Mist, and the wisp holds at the cell's edge for a beat.
        cells ??= [...board.board];
        if (combat) hurt(cell, 1, index);
        else { bindPiece(cells, cell, piece.definitionId); effects.push({ kind: 'bound', wisp: index, cell, definitionId: piece.definitionId }); }
        changed = true;
        row = next - 0.5;
        wisp.holdUntil = clock + (combat ? 400 : spec.stepMs);
        break;
      }
      const left = next - 1 >= 0 ? laneCell(window, col(index), next - 1) : null;
      wisp.cells += 1;
      row = next - 0.5;
      // Every so many cells it leaves Mist on the free cell it has just left.
      const drop = Math.max(0, Math.floor(spec.dropEvery ?? 0));
      if (drop && wisp.cells % drop === 0 && left != null && isFree(current(), left)) {
        cells ??= [...board.board];
        cells[left] = { ...cells[left]!, locked: true, blocker: null, occupant: null, mist: { kind: 'encounter', type: 'light', hp: 1 } };
        effects.push({ kind: 'corrupted', wisp: index, cell: left });
        changed = true;
      }
    }
    wisp.row = row;
  }

  reconcileSpawns();
  // Wisps still over the board spit Mist down their column now and then: onto its top-most free cell (never a piece).
  const spat: LaneSpit[] = [];
  if (breached == null) {
    for (let index = 0; index < mechanic.wisps.length; index += 1) {
      const spec = mechanic.wisps[index]!;
      const wisp = wisps[index]!;
      if (!spec.spitEvery || !arrived(index) || !alive(index) || wisp.row >= -0.5) continue;
      const due = wisp.spitAt ?? arrivalAt(index) + spec.spitEvery;
      if (due > clock) { wisp.spitAt = due; continue; }
      wisp.spitAt = clock + spec.spitEvery;
      let cell: number | null = null;
      for (let row = 0; row < window.rows && cell == null; row += 1) {
        const candidate = laneCell(window, col(index), row);
        if (candidate == null) continue;
        if (isFree(current(), candidate)) cell = candidate;
      }
      if (cell == null) continue;
      const spit: LaneSpit = { id: ++seq, wisp: index, cell, firedAt: clock, landsAt: clock + LANE_SPIT_MS };
      spits.push(spit);
      spat.push(spit);
    }
    if (modern) for (let index = 0; index < mechanic.wisps.length; index++) {
      const spec = mechanic.wisps[index]!, wisp = wisps[index]!;
      const weapon = wispWeapon(spec);
      if (!weapon || !arrived(index) || !alive(index) || wisp.holdUntil > clock) continue;
      const cell = weaponTarget(index, weapon.range + 0.001);
      if (cell == null) continue;
      // First shot has a readable wind-up; changing targets cannot reset an existing cooldown.
      wisp.strikeAt ??= Math.max(clock + 600, arrivalAt(index) + (spec.strikeEvery ?? 0));
      if (clock < wisp.strikeAt) continue;
      wisp.strikeAt = clock + weapon.everyMs;
      const zap = weapon.mode === 'zap';
      const bolt: LaneSpit = { id: ++seq, wisp: index, cell, firedAt: clock, landsAt: clock + (zap ? LANE_SPIT_MS : 360),
        strike: true, weapon: zap ? 'zap' : 'bullet', damage: weapon.damage };
      spits.push(bolt); spat.push(bolt); changed = true;
    }
    // Strikers strike the nearest plant under them in their column (over the board or on it), now and then.
    for (let index = 0; index < mechanic.wisps.length; index += 1) {
      const spec = mechanic.wisps[index]!;
      const wisp = wisps[index]!;
      if ((modern && wispWeapon(spec)) || !spec.strikeEvery || !arrived(index) || !alive(index)) continue;
      const due = wisp.strikeAt ?? arrivalAt(index) + spec.strikeEvery;
      if (due > clock) { wisp.strikeAt = due; continue; }
      wisp.strikeAt = clock + spec.strikeEvery;
      let cell: number | null = null;
      for (let row = Math.max(0, laneRowOf(wisp.row) + 1); row < window.rows && cell == null; row += 1) {
        const candidate = laneCell(window, col(index), row);
        if (candidate != null && looseItem(current(), candidate)) cell = candidate;
      }
      if (cell == null) continue;
      const bolt: LaneSpit = { id: ++seq, wisp: index, cell, firedAt: clock, landsAt: clock + LANE_SPIT_MS, strike: true };
      spits.push(bolt);
      spat.push(bolt);
    }
    // The rest of what wisps do to the board and to each other, each on its own clock.
    const below = (index: number) => {
      const found: { cell: number; tier: number; instanceId: string }[] = [];
      for (let row = Math.max(0, laneRowOf(wisps[index]!.row) + 1); row < window.rows; row += 1) {
        const candidate = laneCell(window, col(index), row);
        const piece = candidate != null ? looseItem(current(), candidate) : null;
        if (candidate != null && piece) found.push({ cell: candidate, tier: Math.floor(items.get(piece.definitionId)?.tier ?? 1), instanceId: piece.instanceId });
      }
      return found;
    };
    const dueNow = (index: number, every: number | undefined, key: 'mendAt' | 'frostAt' | 'snatchAt' | 'callAt') => {
      if (!every || !arrived(index) || !alive(index)) return false;
      const wisp = wisps[index]!;
      const due = wisp[key] ?? arrivalAt(index) + every;
      if (due > clock) { wisp[key] = due; return false; }
      wisp[key] = clock + every;
      return true;
    };
    for (let index = 0; index < mechanic.wisps.length; index += 1) {
      const spec = mechanic.wisps[index]!;
      // A mender mends every wisp within a column of it, itself too.
      if (dueNow(index, spec.mendEvery, 'mendAt')) {
        const amount = Math.max(1, spec.mendAmount ?? 1);
        let mended = false;
        mechanic.wisps.forEach((_, other) => {
          if (!arrived(other) || !alive(other) || Math.abs(col(other) - col(index)) > 1 || wisps[other]!.damage <= 0) return;
          wisps[other]!.damage = Math.max(0, wisps[other]!.damage - amount);
          mended = true;
        });
        if (mended) { effects.push({ kind: 'mended', wisp: index, amount }); moved = true; hit = true; changed = true; }
      }
      // A frost wisp freezes the nearest shooting plant under it that is not frozen already.
      if (dueNow(index, spec.frostEvery, 'frostAt')) {
        const target = below(index).find((piece) => piece.tier >= 2 && !(frozen[piece.instanceId] > clock));
        if (target) { const bolt: LaneSpit = { id: ++seq, wisp: index, cell: target.cell, firedAt: clock, landsAt: clock + LANE_SPIT_MS, frost: true }; spits.push(bolt); spat.push(bolt); }
      }
      // A snatcher takes the smallest piece under it.
      if (dueNow(index, spec.snatchEvery, 'snatchAt')) {
        const target = below(index).sort((a, b) => a.tier - b.tier)[0];
        if (target) { const bolt: LaneSpit = { id: ++seq, wisp: index, cell: target.cell, firedAt: clock, landsAt: clock + LANE_SPIT_MS, snatch: true }; spits.push(bolt); spat.push(bolt); }
      }
      // A caller calls its next mistling down its own column.
      if (dueNow(index, spec.callEvery, 'callAt')) {
        const called = mechanic.wisps.findIndex((child, other) => child.spawn?.by === index && child.spawn.on === 'call' && wisps[other]!.bornAt == null && wisps[other]!.damage < child.hp);
        if (called >= 0) {
          const child = wisps[called]!;
          child.bornAt = clock;
          child.row = startRow(mechanic, called);
          child.column = col(index);
          effects.push({ kind: 'called', wisp: called, caller: index });
          moved = true;
          changed = true;
        }
      }
    }
  }

  // The Seed Sprinkler (`docs/lanes-variety-design.md`): every Seed a Lanes board gets flies out of it on a tap (the
  // board's spawn flight); here a charge comes back to it every beat, up to what it holds, and the sparks its taps
  // queued fly.
  let nextSeedAt = input.nextSeedAt;
  const seeded = input.seeded ?? 0;
  const nextInstance = board.nextInstance;
  const pendingSparks: LaneShot[] = [];
  const sparks: LanesTickResult['sparks'] = [];
  const seeds = mechanic.seeds;
  // The Storm Pot: a charge back every beat, up to what it holds.
  const generatorReady = { ...input.generatorReady };
  const engines = mechanic.generators ?? (mechanic.secondary ? [mechanic.secondary] : mechanic.stormPot ? [{ ...mechanic.stormPot, generatorId: STORM_POT_ID }] : []);
  for (const engine of engines) if (breached == null) {
    const chain = ({ 'seed-sprinkler': 'garden', 'storm-pot': 'storm', 'ward-planter': 'bulwark', 'dew-well': 'dew', 'lantern-post': 'lantern' } as Record<string, import('./combat-rules').CombatChain>)[engine.generatorId] ?? 'garden';
    const homeRecharge = luck.chains?.[chain]?.recharge;
    const pace = homeRecharge == null ? (luck.seedPace ?? 0) + (luck.supportPace ?? 0)
      : homeRecharge + (chain === 'garden' ? luck.seedPace ?? 0 : 0) + (luck.supportPace ?? 0);
    const everyMs = engine.everyMs * (1 - Math.max(0, Math.min(0.6, pace)));
    const due = generatorReady[engine.generatorId] ?? input.nextStormAt ?? everyMs;
    generatorReady[engine.generatorId] = due;
    if (clock >= due) {
      const generator = board.generators[engine.generatorId];
      if (generator && generator.charges < generator.capacity) {
        board = { ...board, generators: { ...board.generators, [engine.generatorId]: { ...generator, charges: generator.charges + 1 } } };
        changed = true;
      }
      generatorReady[engine.generatorId] = clock + everyMs;
    }
  }
  if (seeds && mechanic.sprinkler && !mechanic.generators && breached == null) {
    const everyMs = seeds.everyMs * (1 - Math.max(0, Math.min(0.6, luck.seedPace ?? 0)));
    nextSeedAt ??= everyMs;
    if (clock >= nextSeedAt) {
      const generator = board.generators[SEED_SPRINKLER_ID];
      if (generator && generator.charges < generator.capacity) {
        board = { ...board, generators: { ...board.generators, [SEED_SPRINKLER_ID]: { ...generator, charges: generator.charges + 1 } } };
        changed = true;
      }
      nextSeedAt = clock + everyMs;
    }
  }
  if (mechanic.sprinkler && breached == null) {
    for (const queued of input.sparkQueue ?? []) {
      if (!alive(queued.wisp) || !arrived(queued.wisp)) continue;
      pendingSparks.push({ id: ++seq, fromCell: queued.from, wisp: queued.wisp, damage: queued.damage, firedAt: clock, landsAt: clock + LANE_SPARK_MS });
      sparks.push(queued);
      changed = true;
    }
  }

  shots.push(...pendingSparks);
  // Every piece due to fire fires: up its column at the lowest wisp over it, or off the top with nothing there.
  const ready: Record<string, number> = {};
  const fired: LaneShot[] = [];
  const zaps: LanesTickResult['zaps'] = [];
  const mergeAttacks = (input.mergeAttacks ?? []).filter(attack => attack.at > clock);
  if (breached == null) for (const attack of input.mergeAttacks ?? []) {
    if (attack.at > clock) continue;
    const { cell, tier, chain, instanceId } = attack;
    const origin = laneOf(window, cell);
    if (!origin) continue;
    const bonus = mergeAttack(tier);
    const echo = mechanic.terrain?.some(t => t.cell === cell && t.kind === 'echo') ? 1.5 : 1;
    if (chain === 'bulwark') { pulse(cell, tier, instanceId, -1, true); continue; }
    if (chain === 'dew') {
      for (const other of window.cellIndices) {
        const at = laneOf(window, other)!;
        if (Math.hypot(at.column - origin.column, at.row - origin.row) > bonus.reach) continue;
        const p = looseItem(current(), other); const health = vitality(other);
        if (health) health.hearts = Math.min(health.tier, health.hearts + (Math.max(1, tier - 1) + (luck.healBonus ?? 0)) * (luck.chains?.dew?.power ?? 1));
        if (p) delete frozen[p.instanceId];
      }
      effects.push({ kind: 'wall-impact', cell, tier, instanceId, wisp: -1, radius: bonus.reach, healing: true }); changed = true;
      continue;
    }
    const targets = mechanic.wisps.map((_, i) => i).filter(i => arrived(i) && alive(i));
    if (chain === 'storm') {
      const struck = targets.filter(i => Math.hypot(col(i) - origin.column, wisps[i]!.row - origin.row) <= bonus.reach)
        .sort((a,b) => Math.hypot(col(a) - origin.column, wisps[a]!.row - origin.row) - Math.hypot(col(b) - origin.column, wisps[b]!.row - origin.row)).slice(0, bonus.targets);
      struck.forEach(wisp => shots.push({ id: ++seq, fromCell: cell, wisp, damage: damageOf(bonus.damage * 2 * echo, chain), kind: 'zap', firedAt: clock, landsAt: clock + LANE_SPARK_MS }));
      if (struck.length) zaps.push({ from: cell, wisps: struck, damage: bonus.damage * 2, simultaneous: true });
    } else {
      const ahead = targets.filter(i => col(i) === origin.column && wisps[i]!.row < origin.row).sort((a,b) => wisps[b]!.row - wisps[a]!.row);
      const struck = chain === 'lantern' ? ahead.slice(0, bonus.targets + 1) : ahead.slice(0, 1);
      for (const wisp of struck.length ? struck : [-1]) {
        const shot: LaneShot = { id: ++seq, fromCell: cell, wisp, damage: damageOf(bonus.damage * echo, chain), kind: 'projectile', firedAt: clock,
          landsAt: clock + laneFlightMs(origin.row - (wisp < 0 ? -LANE_MISS_ROW : wisps[wisp]!.row)) };
        fired.push(shot); if (wisp >= 0) shots.push(shot);
      }
    }
    changed = true;
  }
  if (breached == null) {
    const boardNow = current();
    for (const cell of window.cellIndices) {
      const piece = looseItem(boardNow, cell);
      if (!piece) continue;
      const made = items.get(piece.definitionId);
      if (made?.chainId === STORM_CHAIN) {
        // A Spark plant zaps the nearest wisp within its reach, any direction, and jumps on from it.
        const zap = laneZap(Math.floor(made.tier ?? 1));
        if (!zap) continue;
        if (frozen[piece.instanceId] > clock) { ready[piece.instanceId] = Math.max(input.ready[piece.instanceId] ?? 0, frozen[piece.instanceId]!); continue; }
        const due = input.ready[piece.instanceId] ?? clock + zap.periodMs / 2;
        if (due > clock) { ready[piece.instanceId] = due; continue; }
        const struck: number[] = [];
        let origin = laneOf(window, cell)!;
        for (let jump = 0; jump <= zap.jumps; jump += 1) {
          let target = -1;
          let best = Infinity;
          mechanic.wisps.forEach((_, index) => {
            if (struck.includes(index) || !arrived(index) || !alive(index)) return;
            const distance = chebyshev({ column: col(index), row: laneRowOf(wisps[index]!.row) }, origin);
            if (distance <= zap.reach && distance < best) { best = distance; target = index; }
          });
          if (target < 0) break;
          struck.push(target);
          origin = { column: col(target), row: laneRowOf(wisps[target]!.row) };
        }
        // Nothing in reach: it zaps the moment something comes.
        if (!struck.length) { ready[piece.instanceId] = clock; continue; }
        ready[piece.instanceId] = clock + zap.periodMs;
        struck.forEach((wisp, order) => {
          const wet = modern && mechanic.terrain?.some((t) => t.cell === cell && t.kind === 'puddle');
          shots.push({ id: ++seq, fromCell: cell, wisp, damage: damageOf(zap.damage, 'storm') * (wet ? 1.25 : 1), kind: 'zap', firedAt: clock, landsAt: clock + LANE_SPARK_MS * (order + 1) });
          if (zap.stunMs) wisps[wisp]!.holdUntil = Math.max(wisps[wisp]!.holdUntil, clock + zap.stunMs);
        });
        zaps.push({ from: cell, wisps: struck, damage: zap.damage });
        changed = true;
        continue;
      }
      const chain = combatChain(piece.definitionId) ?? 'garden';
      const fire = modern ? combatFire(Math.floor(made?.tier ?? 1), chain) : laneFire(Math.floor(made?.tier ?? 1));
      if (!fire) continue;
      // Frozen: it holds its fire until it thaws.
      if (frozen[piece.instanceId] > clock) { ready[piece.instanceId] = Math.max(input.ready[piece.instanceId] ?? 0, frozen[piece.instanceId]!); continue; }
      const at = laneOf(window, cell)!;
      // A piece first seen waits half its beat, so a fresh drop never fires on the spot.
      const due = input.ready[piece.instanceId] ?? clock + fire.periodMs / 2;
      if (due > clock) { ready[piece.instanceId] = due; continue; }
      const sunny = mechanic.terrain?.some((terrain) => terrain.cell === cell && terrain.kind === 'sunny') ? 1.2 : 1;
      const dewAura = modern && window.cellIndices.some((other) => {
        const p = looseItem(current(), other); return p && combatChain(p.definitionId) === 'dew' && (items.get(p.definitionId)?.tier ?? 0) >= 5 && !(frozen[p.instanceId] > clock) && chebyshev(laneOf(window, other)!, at) <= 1;
      }) ? 1.15 : 1;
      ready[piece.instanceId] = clock + fire.periodMs / (sunny * dewAura);
      let target = -1;
      for (let index = 0; index < mechanic.wisps.length; index += 1) {
        if (col(index) !== at.column || !arrived(index) || !alive(index)) continue;
        const row = wisps[index]!.row;
        if (row >= at.row) continue;
        if (target < 0 || row > wisps[target]!.row) target = index;
      }
      const rows = at.row - (target < 0 ? -LANE_MISS_ROW : wisps[target]!.row);
      const shot: LaneShot = { id: ++seq, fromCell: cell, wisp: target, damage: target < 0 ? 0 : damageOf(fire.damage, chain), kind: 'projectile', firedAt: clock, landsAt: clock + laneFlightMs(rows) };
      fired.push(shot);
      // A miss has nothing to land on: it is only flown.
      if (target >= 0) shots.push(shot);
      if (modern && chain === 'lantern' && target >= 0) {
        const count = (made?.tier ?? 0) >= 4 ? 2 : 1;
        const behind = mechanic.wisps.map((_, index) => index).filter((index) => index !== target && arrived(index) && alive(index) && col(index) === at.column && wisps[index]!.row < wisps[target]!.row).sort((a, b) => wisps[b]!.row - wisps[a]!.row).slice(0, count);
        for (const index of behind) { const pierced = { ...shot, id: ++seq, wisp: index, damage: shot.damage * 0.65, landsAt: clock + laneFlightMs(at.row - wisps[index]!.row) }; shots.push(pierced); fired.push(pierced); }
      }
    }
  }

  // No wisp standing but more to come: the next arrives almost at once, and every later one as much sooner, so the
  // player never waits on an empty sky (a strong board simply wins faster).
  if (combat && breached == null && !mechanic.wisps.some((spec, index) => (spec.wave ?? 0) <= combat.wave && alive(index))) {
    const pendingWaves = mechanic.wisps.flatMap((spec, index) => alive(index) && (spec.wave ?? 0) > combat.wave ? [spec.wave!] : []);
    if (pendingWaves.length) { combat.wave = Math.min(...pendingWaves); combat.waveStartedAt = clock; combat.preparingMs = mechanic.preparationMs ?? 5000; changed = true; }
  }
  if (breached == null && !combat) {
    const standing = mechanic.wisps.some((_, index) => arrived(index) && alive(index));
    // Spawned wisps come when they are brought: they never call the next wave in early.
    const pending = mechanic.wisps.flatMap((_, index) => (!arrived(index) && alive(index) && Number.isFinite(arrivalAt(index)) ? [arrivalAt(index)] : []));
    const next = pending.length ? Math.min(...pending) : null;
    if (!standing && next != null && next > clock + LANE_REFILL_MS) {
      advance += next - (clock + LANE_REFILL_MS);
      changed = true;
    }
  }
  if (combat) {
    const kept = new Set(window.cellIndices.flatMap((cell) => {
      const entry = current().board[cell]!;
      if (entry.occupant?.kind === 'item') return [entry.occupant.instanceId];
      const mist = entry.mist;
      return mist?.kind === 'encounter' && mist.holds?.kind === 'item' && mist.holds.instanceId ? [mist.holds.instanceId] : [];
    }));
    for (const id of Object.keys(combat.plants)) if (!kept.has(id)) { delete combat.plants[id]; delete combat.nextAttack[`heal:${id}`]; }
    combat.warnings = combat.warnings.filter((warning) => alive(warning.wisp));
  }
  const state: LanesState = {
    kind: 'lanes', strikes, clock, wisps, ready, shots, mergeAttacks, seq, breached: breached ?? input.breached,
    ...(combat ? { combat } : {}),
    ...(spits.length ? { spits } : {}), ...(advance ? { advance } : {}), ...(nextSeedAt != null ? { nextSeedAt, seeded } : {}),
    ...(pushedBack ? { pushedBack, ...(lastPushAt != null ? { lastPushAt } : {}) } : {}),
    ...(Object.keys(frozen).length ? { frozen } : {}),
    ...(input.launches ? { launches: input.launches } : {}),
    ...(Object.keys(generatorReady).length ? { generatorReady } : {}),
    ...(mechanic.sprinkler ? { sparkEvery: Math.max(1, Math.floor(luck.sparkEvery ?? DEFAULT_SPARK_EVERY)), sparkDamage: Math.max(1, Math.floor(luck.sparkDamage ?? DEFAULT_SPARK_DAMAGE)) } : {}),
  };
  const next = current();
  return { state, board: next === board && nextInstance === next.nextInstance ? next : { ...next, nextInstance, revision: board.revision + 1 }, fired, effects, changed, moved, hit, spat, sparks, zaps };
}

const isFree = (board: MergeWorldState, cell: number) => { const entry = board.board[cell]; return Boolean(entry) && !entry!.locked && !entry!.mist && !entry!.occupant; };

/** A merge: the piece it made fires almost at once. */
export function lanesAfterMerge(state: LanesState, resultInstanceId: string | null): LanesState {
  if (!resultInstanceId) return state;
  const plants = { ...state.combat?.plants }; delete plants[resultInstanceId];
  const frozen = { ...state.frozen };
  if (state.combat) delete frozen[resultInstanceId];
  return { ...state, frozen, ready: { ...state.ready, [resultInstanceId]: state.clock + LANE_MERGE_SHOT_MS }, ...(state.combat ? { combat: { ...state.combat, plants } } : {}) };
}

/**
 * After any command: a piece put (or dropped by the Seed Pod) on the cell a wisp is on goes under Mist at once, as if
 * the wisp had come down onto it.
 */
export function lanesCrash(mechanic: LanesMechanic, state: LanesState, board: MergeWorldState, window: MissionWindow): { board: MergeWorldState; effects: MechanicEffect[] } {
  // Modern contact is resolved on the combat clock, with hearts and shields.
  if (mechanic.rulesVersion === 2) return { board, effects: [] };
  let cells: MergeWorldState['board'] | null = null;
  const effects: MechanicEffect[] = [];
  mechanic.wisps.forEach((spec, index) => {
    if (!laneArrived(mechanic, state, index) || !laneAlive(mechanic, state, index)) return;
    const cell = laneCell(window, laneColumn(mechanic, state, index), laneRowOf(state.wisps[index]!.row));
    if (cell == null) return;
    const piece = looseItem(cells ? { ...board, board: cells } : board, cell);
    if (!piece) return;
    cells ??= [...board.board];
    bindPiece(cells, cell, piece.definitionId);
    effects.push({ kind: 'bound', wisp: index, cell, definitionId: piece.definitionId });
  });
  return { board: cells ? { ...board, board: cells } : board, effects };
}

/** Keep going after a wisp got through: every wisp still standing goes back up a few rows and waits a full beat. */
export function lanesKeepGoing(mechanic: LanesMechanic, state: LanesState): LanesState {
  return {
    ...state, breached: null, ...(state.combat ? { combat: { ...state.combat, hearts: mechanic.breachBudget ?? 3 } } : {}),
    wisps: state.wisps.map((wisp, index) => (laneAlive(mechanic, state, index)
      ? { ...wisp, row: Math.max(startRow(mechanic, index), wisp.row - LANE_KEEP_GOING_ROWS), holdUntil: state.clock + (mechanic.wisps[index]?.stepMs ?? 0) }
      : wisp)),
  };
}

/** A saved level's lanes, or null when it cannot be read. */
export function normalizeLanesState(mechanic: LanesMechanic, value: unknown, strikes: number): LanesState | null {
  if (value == null) return strikes === 0 ? createLanesState(mechanic) : null;
  if (typeof value !== 'object') return null;
  const raw = value as Partial<LanesState>;
  if (!Array.isArray(raw.wisps) || raw.wisps.length !== mechanic.wisps.length || !Number.isFinite(raw.clock)) return null;
  const optional = (wisp: Partial<LaneWispState> | undefined) => Object.fromEntries((['engagedCell', 'spitAt', 'strikeAt', 'column', 'weaveAt', 'weaves', 'dashAt', 'dashFrom', 'dashUntil', 'mendAt', 'frostAt', 'snatchAt', 'callAt', 'bornAt', 'crawlAt'] as const)
    .filter((key) => Number.isFinite(wisp?.[key])).map((key) => [key, Number(wisp![key])]));
  const wisps = raw.wisps.map((wisp) => ({ row: Number(wisp?.row) || 0, damage: Math.max(0, Number(wisp?.damage) || 0), holdUntil: Number(wisp?.holdUntil) || 0, cells: Math.max(0, Math.floor(Number(wisp?.cells) || 0)), ...optional(wisp) }));
  return {
    kind: 'lanes', strikes: Math.max(0, Math.floor(Number(raw.strikes) || strikes)), clock: Number(raw.clock), wisps,
    ...(mechanic.rulesVersion === 2 ? { combat: normalizeCombatState(raw.combat, mechanic.breachBudget ?? 3) } : {}),
    ready: raw.ready && typeof raw.ready === 'object' ? { ...raw.ready } : {},
    shots: Array.isArray(raw.shots) ? raw.shots.filter((shot) => shot && Number.isFinite(shot.landsAt)).map((shot) => ({ ...shot })) : [],
    mergeAttacks: Array.isArray(raw.mergeAttacks) ? raw.mergeAttacks.filter(a => a && Number.isInteger(a.cell) && a.cell >= 0 && a.cell < 63 && Number.isFinite(a.at) && a.at >= 0 && Number.isInteger(a.tier) && a.tier >= 1 && a.tier <= 7 && typeof a.instanceId === 'string' && ['garden', 'storm', 'bulwark', 'dew', 'lantern'].includes(a.chain)).map(a => ({ ...a })) : [],
    seq: Math.max(0, Math.floor(Number(raw.seq) || 0)),
    breached: raw.breached == null ? null : Math.floor(Number(raw.breached)),
    ...(Number.isFinite(raw.advance) && Number(raw.advance) > 0 ? { advance: Number(raw.advance) } : {}),
    ...(Number.isFinite(raw.nextSeedAt) ? { nextSeedAt: Number(raw.nextSeedAt), seeded: Math.max(0, Math.floor(Number(raw.seeded) || 0)) } : {}),
    ...(Array.isArray(raw.spits) ? { spits: raw.spits.filter((spit) => spit && Number.isFinite(spit.landsAt)).map((spit) => ({ ...spit })) } : {}),
    ...(raw.frozen && typeof raw.frozen === 'object' ? { frozen: Object.fromEntries(Object.entries(raw.frozen).filter(([, until]) => Number.isFinite(until))) } : {}),
    ...(Number.isFinite(raw.launches) ? { launches: Math.max(0, Math.floor(Number(raw.launches))) } : {}),
    ...(raw.generatorReady ? { generatorReady: Object.fromEntries(Object.entries(raw.generatorReady).filter(([, value]) => Number.isFinite(value))) } : {}),
    ...(Number.isFinite(raw.nextStormAt) ? { nextStormAt: Number(raw.nextStormAt) } : {}),
  };
}
