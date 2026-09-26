import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { MergeItemDefinition, MergeWorldState } from '@/types/merge-world';
import type { LaneShot, LaneSpit, LaneWispState, MechanicEffect, MissionMechanicDefinition, MissionMechanicState, MissionWispView } from '@/types/mission-mechanic';
import type { MissionWindow } from './board-window';
import { seededUnit } from '@/features/encounter/seed';

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
  };
}

/**
 * When a wisp arrives, in level time: its authored `at`, brought forward by however much the level has skipped ahead
 * (`state.advance`): whenever the board is left with no wisp, the next one comes at once rather than after a gap.
 */
export const laneArrivalAt = (mechanic: LanesMechanic, state: Pick<LanesState, 'advance'> & Partial<Pick<LanesState, 'wisps'>>, index: number) => {
  const spec = mechanic.wisps[index];
  // A spawned wisp (a splitter's shard, a caller's mistling) arrives when it is brought, and not before.
  if (spec?.spawn) return state.wisps?.[index]?.bornAt ?? Infinity;
  return (spec?.at ?? 0) - (state.advance ?? 0);
};
/** The column a wisp is in now: a weaver's changes, every other stays in its own. */
export const laneColumn = (mechanic: LanesMechanic, state: Pick<LanesState, 'wisps'>, index: number) => state.wisps[index]?.column ?? mechanic.wisps[index]?.column ?? 0;
export const laneArrived = (mechanic: LanesMechanic, state: LanesState, index: number) => state.clock >= laneArrivalAt(mechanic, state, index);
/** The board left with no wisp: the next one arrives this soon (and every later one as much sooner). */
export const LANE_REFILL_MS = 500;
export const laneAlive = (mechanic: LanesMechanic, state: LanesState, index: number) => (state.wisps[index]?.damage ?? 0) < (mechanic.wisps[index]?.hp ?? 0);

export const lanesTotalHp = (mechanic: LanesMechanic) => mechanic.wisps.reduce((sum, wisp) => sum + wisp.hp, 0);
export function lanesProgress(mechanic: LanesMechanic, state: LanesState) {
  return { current: mechanic.wisps.reduce((sum, wisp, index) => sum + Math.min(wisp.hp, state.wisps[index]?.damage ?? 0), 0), total: lanesTotalHp(mechanic) };
}
export const lanesComplete = (mechanic: LanesMechanic, state: LanesState) => mechanic.wisps.every((_, index) => !laneAlive(mechanic, state, index));

export function lanesViews(mechanic: LanesMechanic, state: LanesState): MissionWispView[] {
  return mechanic.wisps.map((wisp, index) => {
    const standing: Partial<LaneWispState> & { row: number; damage: number } = state.wisps[index] ?? { row: startRow(mechanic, index), damage: 0 };
    // A dasher mid-lunge drifts at its lunge's pace.
    const dashing = standing.dashUntil != null && state.clock < standing.dashUntil;
    return {
      id: wisp.id, hp: wisp.hp, damage: Math.min(wisp.hp, standing.damage),
      // Not here yet: drawn as not standing, so it arrives (grows in) the moment it is.
      alive: laneArrived(mechanic, state, index) && standing.damage < wisp.hp,
      placement: { kind: 'lane', column: laneColumn(mechanic, state, index), row: standing.row },
      enterDelayMs: 0,
      drift: laneArrived(mechanic, state, index) && standing.damage < wisp.hp && state.breached == null && (standing.holdUntil ?? 0) <= state.clock ? (dashing ? Math.max(1, wisp.dashRows ?? 2) / LANE_DASH_MS : 1 / Math.max(250, wisp.stepMs)) : 0,
      ...(wisp.look ? { look: wisp.look } : {}),
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
function bindPiece(cells: MergeWorldState['board'], cell: number, definitionId: string) {
  cells[cell] = { ...cells[cell]!, locked: true, blocker: null, occupant: null, mist: { kind: 'encounter', type: 'bound', hp: 1, holds: { kind: 'item', definitionId } } };
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
export type LanesLuck = { tierTwoChance?: number; /** The Bloom House: Seeds land this much sooner (a fraction). */ seedPace?: number; /** The lead hero's level: added to every shot. */ shotPower?: number };

export function lanesTick(mechanic: LanesMechanic, input: LanesState, board: MergeWorldState, dt: number, window: MissionWindow, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID, luck: LanesLuck = {}): LanesTickResult {
  if (input.breached != null || lanesComplete(mechanic, input)) return { state: input, board, fired: [], effects: [], changed: false, moved: false, hit: false, spat: [] };
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
  const arrivalAt = (index: number) => (mechanic.wisps[index]!.spawn ? wisps[index]!.bornAt ?? Infinity : mechanic.wisps[index]!.at - advance);
  const arrived = (index: number) => clock >= arrivalAt(index);
  const col = (index: number) => wisps[index]!.column ?? mechanic.wisps[index]!.column;
  const frozen: Record<string, number> = Object.fromEntries(Object.entries(input.frozen ?? {}).filter(([, until]) => until > clock));
  let seq = input.seq;
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
  const shieldFor = (target: number): number => mechanic.wisps.findIndex((spec, index) => index !== target && spec.shield && arrived(index) && alive(index) && Math.abs(col(index) - col(target)) <= 1);

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
    if (guard >= 0) { effects.push({ kind: 'shielded', wisp: guard, target: shot.wisp, amount: shot.damage }); continue; }
    wisp.damage = Math.min(mechanic.wisps[shot.wisp]!.hp, wisp.damage + shot.damage);
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
      if (piece) { frozen[piece.instanceId] = clock + LANE_FROST_MS; effects.push({ kind: 'frozen', wisp: spit.wisp, cell: spit.cell }); changed = true; }
      continue;
    }
    if (spit.snatch) {
      // A snatcher's grab: the piece is gone.
      const piece = looseItem(current(), spit.cell);
      if (piece) {
        cells ??= [...board.board];
        cells[spit.cell] = { ...cells[spit.cell]!, occupant: null };
        effects.push({ kind: 'snatched', wisp: spit.wisp, cell: spit.cell, definitionId: piece.definitionId });
        changed = true;
      }
      continue;
    }
    if (spit.strike) {
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

  // Wisps drift down, a row every `stepMs`, from the moment they arrive; a hold after reaching a piece pauses them.
  for (let index = 0; index < mechanic.wisps.length && breached == null; index += 1) {
    const spec = mechanic.wisps[index]!;
    const wisp = wisps[index]!;
    if (!arrived(index) || !alive(index)) continue;
    if (from < arrivalAt(index)) moved = true;
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
          cells ??= [...board.board];
          bindPiece(cells, cell, piece.definitionId);
          effects.push({ kind: 'bound', wisp: index, cell, definitionId: piece.definitionId });
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
    const start = Math.max(from, arrivalAt(index), wisp.holdUntil);
    if (clock <= start) continue;
    let target = wisp.row + (clock - start) / Math.max(250, spec.stepMs);
    if (wisp.dashFrom != null && wisp.dashUntil != null) {
      const lunge = Math.max(0, Math.min(clock, wisp.dashUntil) - Math.max(start, wisp.dashFrom));
      target += lunge * (Math.max(1, spec.dashRows ?? 2) / LANE_DASH_MS - 1 / Math.max(250, spec.stepMs));
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
        breached = index; changed = true; effects.push({ kind: 'breached', wisp: index }); row = next - 0.5; break;
      }
      const cell = next >= 0 ? laneCell(window, col(index), next) : null;
      const piece = cell != null ? looseItem(current(), cell) : null;
      if (cell != null && piece) {
        // It reaches a piece: the piece goes under Mist, and the wisp holds at the cell's edge for a beat.
        cells ??= [...board.board];
        bindPiece(cells, cell, piece.definitionId);
        effects.push({ kind: 'bound', wisp: index, cell, definitionId: piece.definitionId });
        changed = true;
        row = next - 0.5;
        wisp.holdUntil = clock + spec.stepMs;
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
    // Strikers strike the nearest plant under them in their column (over the board or on it), now and then.
    for (let index = 0; index < mechanic.wisps.length; index += 1) {
      const spec = mechanic.wisps[index]!;
      const wisp = wisps[index]!;
      if (!spec.strikeEvery || !arrived(index) || !alive(index)) continue;
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

  // Pieces arrive on their own: every so often one lands on a random empty cell (never the one a wisp is on). A
  // full board waits and the piece lands the moment a cell is free.
  let nextSeedAt = input.nextSeedAt;
  let seeded = input.seeded ?? 0;
  let nextInstance = board.nextInstance;
  const seeds = mechanic.seeds;
  if (seeds && breached == null) {
    const everyMs = seeds.everyMs * (1 - Math.max(0, Math.min(0.6, luck.seedPace ?? 0)));
    nextSeedAt ??= everyMs;
    if (clock >= nextSeedAt) {
      const occupied = new Set(mechanic.wisps.flatMap((spec, index) => {
        if (!arrived(index) || !alive(index)) return [];
        const cell = laneCell(window, col(index), laneRowOf(wisps[index]!.row));
        return cell == null ? [] : [cell];
      }));
      const free = (seeds.area ?? window.cellIndices).filter((cell) => window.cellIndices.includes(cell) && isFree(current(), cell) && !occupied.has(cell));
      if (free.length) {
        const cell = free[Math.min(free.length - 1, Math.floor(seededUnit(`lanes-seed:${seeded}:${Math.round(nextSeedAt)}`) * free.length))]!;
        const lucky = seededUnit(`lanes-luck:${seeded}`) < Math.max(0, Math.min(1, luck.tierTwoChance ?? 0));
        cells ??= [...board.board];
        cells[cell] = { ...cells[cell]!, occupant: { kind: 'item', instanceId: `merge-item:${nextInstance}`, definitionId: lucky ? seeds.drops[1] : seeds.drops[0] } };
        nextInstance += 1;
        seeded += 1;
        nextSeedAt = clock + everyMs;
        changed = true;
      }
    }
  }

  // Every piece due to fire fires: up its column at the lowest wisp over it, or off the top with nothing there.
  const ready: Record<string, number> = {};
  const fired: LaneShot[] = [];
  if (breached == null) {
    const boardNow = current();
    for (const cell of window.cellIndices) {
      const piece = looseItem(boardNow, cell);
      if (!piece) continue;
      const fire = laneFire(Math.floor(items.get(piece.definitionId)?.tier ?? 1));
      if (!fire) continue;
      // Frozen: it holds its fire until it thaws.
      if (frozen[piece.instanceId] > clock) { ready[piece.instanceId] = Math.max(input.ready[piece.instanceId] ?? 0, frozen[piece.instanceId]!); continue; }
      const at = laneOf(window, cell)!;
      // A piece first seen waits half its beat, so a fresh drop never fires on the spot.
      const due = input.ready[piece.instanceId] ?? clock + fire.periodMs / 2;
      if (due > clock) { ready[piece.instanceId] = due; continue; }
      ready[piece.instanceId] = clock + fire.periodMs;
      let target = -1;
      for (let index = 0; index < mechanic.wisps.length; index += 1) {
        if (col(index) !== at.column || !arrived(index) || !alive(index)) continue;
        const row = wisps[index]!.row;
        if (row >= at.row) continue;
        if (target < 0 || row > wisps[target]!.row) target = index;
      }
      const rows = at.row - (target < 0 ? -LANE_MISS_ROW : wisps[target]!.row);
      const shot: LaneShot = { id: ++seq, fromCell: cell, wisp: target, damage: target < 0 ? 0 : fire.damage + Math.max(0, Math.floor(luck.shotPower ?? 0)), firedAt: clock, landsAt: clock + laneFlightMs(rows) };
      fired.push(shot);
      // A miss has nothing to land on: it is only flown.
      if (target >= 0) shots.push(shot);
    }
  }

  // No wisp standing but more to come: the next arrives almost at once, and every later one as much sooner, so the
  // player never waits on an empty sky (a strong board simply wins faster).
  if (breached == null) {
    const standing = mechanic.wisps.some((_, index) => arrived(index) && alive(index));
    // Spawned wisps come when they are brought: they never call the next wave in early.
    const pending = mechanic.wisps.flatMap((_, index) => (!arrived(index) && alive(index) && Number.isFinite(arrivalAt(index)) ? [arrivalAt(index)] : []));
    const next = pending.length ? Math.min(...pending) : null;
    if (!standing && next != null && next > clock + LANE_REFILL_MS) {
      advance += next - (clock + LANE_REFILL_MS);
      changed = true;
    }
  }
  const state: LanesState = {
    kind: 'lanes', strikes, clock, wisps, ready, shots, seq, breached: breached ?? input.breached,
    ...(spits.length ? { spits } : {}), ...(advance ? { advance } : {}), ...(nextSeedAt != null ? { nextSeedAt, seeded } : {}),
    ...(pushedBack ? { pushedBack, ...(lastPushAt != null ? { lastPushAt } : {}) } : {}),
    ...(Object.keys(frozen).length ? { frozen } : {}),
  };
  const next = current();
  return { state, board: nextInstance === next.nextInstance ? next : { ...next, nextInstance }, fired, effects, changed, moved, hit, spat };
}

const isFree = (board: MergeWorldState, cell: number) => { const entry = board.board[cell]; return Boolean(entry) && !entry!.locked && !entry!.mist && !entry!.occupant; };

/** A merge: the piece it made fires almost at once. */
export function lanesAfterMerge(state: LanesState, resultInstanceId: string | null): LanesState {
  if (!resultInstanceId) return state;
  return { ...state, ready: { ...state.ready, [resultInstanceId]: state.clock + LANE_MERGE_SHOT_MS } };
}

/**
 * After any command: a piece put (or dropped by the Seed Pod) on the cell a wisp is on goes under Mist at once, as if
 * the wisp had come down onto it.
 */
export function lanesCrash(mechanic: LanesMechanic, state: LanesState, board: MergeWorldState, window: MissionWindow): { board: MergeWorldState; effects: MechanicEffect[] } {
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
    ...state, breached: null,
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
  const optional = (wisp: Partial<LaneWispState> | undefined) => Object.fromEntries((['spitAt', 'strikeAt', 'column', 'weaveAt', 'weaves', 'dashAt', 'dashFrom', 'dashUntil', 'mendAt', 'frostAt', 'snatchAt', 'callAt', 'bornAt'] as const)
    .filter((key) => Number.isFinite(wisp?.[key])).map((key) => [key, Number(wisp![key])]));
  const wisps = raw.wisps.map((wisp) => ({ row: Number(wisp?.row) || 0, damage: Math.max(0, Number(wisp?.damage) || 0), holdUntil: Number(wisp?.holdUntil) || 0, cells: Math.max(0, Math.floor(Number(wisp?.cells) || 0)), ...optional(wisp) }));
  return {
    kind: 'lanes', strikes: Math.max(0, Math.floor(Number(raw.strikes) || strikes)), clock: Number(raw.clock), wisps,
    ready: raw.ready && typeof raw.ready === 'object' ? { ...raw.ready } : {},
    shots: Array.isArray(raw.shots) ? raw.shots.filter((shot) => shot && Number.isFinite(shot.landsAt)).map((shot) => ({ ...shot })) : [],
    seq: Math.max(0, Math.floor(Number(raw.seq) || 0)),
    breached: raw.breached == null ? null : Math.floor(Number(raw.breached)),
    ...(Number.isFinite(raw.advance) && Number(raw.advance) > 0 ? { advance: Number(raw.advance) } : {}),
    ...(Number.isFinite(raw.nextSeedAt) ? { nextSeedAt: Number(raw.nextSeedAt), seeded: Math.max(0, Math.floor(Number(raw.seeded) || 0)) } : {}),
    ...(Array.isArray(raw.spits) ? { spits: raw.spits.filter((spit) => spit && Number.isFinite(spit.landsAt)).map((spit) => ({ ...spit })) } : {}),
    ...(raw.frozen && typeof raw.frozen === 'object' ? { frozen: Object.fromEntries(Object.entries(raw.frozen).filter(([, until]) => Number.isFinite(until))) } : {}),
  };
}
