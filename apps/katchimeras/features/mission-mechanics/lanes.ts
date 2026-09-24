import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { MergeItemDefinition, MergeWorldState } from '@/types/merge-world';
import type { LaneShot, LaneWispState, MechanicEffect, MissionMechanicDefinition, MissionMechanicState, MissionWispView } from '@/types/mission-mechanic';
import type { MissionWindow } from './board-window';

/**
 * Lanes (`docs/encounter-lanes.md`): a real-time battle on the docked board.
 *
 * - Wisps arrive high over the board's columns and drift down steadily, a row every `stepMs`. Every few cells one
 *   leaves Mist on the free cell it has just left.
 * - Every piece of Sprout size or bigger fires Glow straight up its own column on its own beat, at the lowest wisp
 *   over it or, with none, off the top of the board; bigger pieces fire faster and hit harder. A merged piece fires at once. Moving pieces is how the player aims.
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
/** Keep going: every wisp still standing is pushed back up this many rows. */
export const LANE_KEEP_GOING_ROWS = 3;

const startRow = (mechanic: LanesMechanic, index: number) => -Math.max(1, Math.floor(mechanic.wisps[index]?.startRow ?? LANE_START_ROW));

export function createLanesState(mechanic: LanesMechanic): LanesState {
  return {
    kind: 'lanes', strikes: 0, clock: 0, ready: {}, shots: [], seq: 0, breached: null,
    wisps: mechanic.wisps.map((_, index) => ({ row: startRow(mechanic, index), damage: 0, holdUntil: 0, cells: 0 })),
  };
}

export const laneArrived = (mechanic: LanesMechanic, state: LanesState, index: number) => state.clock >= (mechanic.wisps[index]?.at ?? 0);
export const laneAlive = (mechanic: LanesMechanic, state: LanesState, index: number) => (state.wisps[index]?.damage ?? 0) < (mechanic.wisps[index]?.hp ?? 0);

export const lanesTotalHp = (mechanic: LanesMechanic) => mechanic.wisps.reduce((sum, wisp) => sum + wisp.hp, 0);
export function lanesProgress(mechanic: LanesMechanic, state: LanesState) {
  return { current: mechanic.wisps.reduce((sum, wisp, index) => sum + Math.min(wisp.hp, state.wisps[index]?.damage ?? 0), 0), total: lanesTotalHp(mechanic) };
}
export const lanesComplete = (mechanic: LanesMechanic, state: LanesState) => mechanic.wisps.every((_, index) => !laneAlive(mechanic, state, index));

export function lanesViews(mechanic: LanesMechanic, state: LanesState): MissionWispView[] {
  return mechanic.wisps.map((wisp, index) => {
    const standing = state.wisps[index] ?? { row: startRow(mechanic, index), damage: 0 };
    return {
      id: wisp.id, hp: wisp.hp, damage: Math.min(wisp.hp, standing.damage),
      // Not here yet: drawn as not standing, so it arrives (grows in) the moment it is.
      alive: laneArrived(mechanic, state, index) && standing.damage < wisp.hp,
      placement: { kind: 'lane', column: wisp.column, row: standing.row },
      enterDelayMs: 0,
      drift: laneArrived(mechanic, state, index) && standing.damage < wisp.hp && state.breached == null && ('holdUntil' in standing ? standing.holdUntil : 0) <= state.clock ? 1 / Math.max(250, wisp.stepMs) : 0,
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
  /** Something the board or the level's outcome depends on happened (a hit landed, a piece went under Mist, Mist fell, a wisp got through). */
  changed: boolean;
  /** A wisp moved or arrived: only the wisps need drawing again. */
  moved: boolean;
};

/** The board row a wisp is over: the cell its centre is in. */
export const laneRowOf = (row: number) => Math.floor(row + 0.5);

/**
 * The level moves on by `dt` ms: Glow that has flown lands, wisps drift down (a wisp entering a cell with a piece
 * puts it under Mist and holds for a beat; one whose centre leaves the bottom row gets through), and every piece
 * due to fire fires, at the lowest wisp over it or, with none, off the top of the board. Pure.
 */
export function lanesTick(mechanic: LanesMechanic, input: LanesState, board: MergeWorldState, dt: number, window: MissionWindow, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): LanesTickResult {
  if (input.breached != null || lanesComplete(mechanic, input)) return { state: input, board, fired: [], effects: [], changed: false, moved: false };
  const from = input.clock;
  const clock = from + Math.max(0, dt);
  const wisps: LaneWispState[] = input.wisps.map((wisp) => ({ ...wisp }));
  let cells: MergeWorldState['board'] | null = null;
  const current = (): MergeWorldState => (cells ? { ...board, board: cells } : board);
  const effects: MechanicEffect[] = [];
  let changed = false;
  let moved = false;
  let breached: number | null = null;
  let strikes = input.strikes;
  const alive = (index: number) => wisps[index]!.damage < mechanic.wisps[index]!.hp;
  const arrived = (index: number) => clock >= mechanic.wisps[index]!.at;

  // Glow that has landed.
  const shots: LaneShot[] = [];
  for (const shot of input.shots) {
    if (shot.landsAt > clock) { shots.push(shot); continue; }
    const wisp = wisps[shot.wisp];
    if (!wisp || !alive(shot.wisp)) continue;
    changed = true;
    wisp.damage = Math.min(mechanic.wisps[shot.wisp]!.hp, wisp.damage + shot.damage);
    strikes += 1;
  }

  // Wisps drift down, a row every `stepMs`, from the moment they arrive; a hold after reaching a piece pauses them.
  for (let index = 0; index < mechanic.wisps.length && breached == null; index += 1) {
    const spec = mechanic.wisps[index]!;
    const wisp = wisps[index]!;
    if (!arrived(index) || !alive(index)) continue;
    if (from < spec.at) moved = true;
    const start = Math.max(from, spec.at, wisp.holdUntil);
    if (clock <= start) continue;
    const target = wisp.row + (clock - start) / Math.max(250, spec.stepMs);
    moved = true;
    // Each cell its centre enters on the way, in order.
    let row = wisp.row;
    while (breached == null) {
      const next = laneRowOf(row) + 1;
      if (next - 0.5 > target) { row = target; break; }
      if (next >= window.rows) { breached = index; changed = true; effects.push({ kind: 'breached', wisp: index }); row = next - 0.5; break; }
      const cell = next >= 0 ? laneCell(window, spec.column, next) : null;
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
      const left = next - 1 >= 0 ? laneCell(window, spec.column, next - 1) : null;
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

  // Every piece due to fire fires: up its column at the lowest wisp over it, or off the top with nothing there.
  const ready: Record<string, number> = {};
  const fired: LaneShot[] = [];
  let seq = input.seq;
  if (breached == null) {
    const boardNow = current();
    for (const cell of window.cellIndices) {
      const piece = looseItem(boardNow, cell);
      if (!piece) continue;
      const fire = laneFire(Math.floor(items.get(piece.definitionId)?.tier ?? 1));
      if (!fire) continue;
      const at = laneOf(window, cell)!;
      // A piece first seen waits half its beat, so a fresh drop never fires on the spot.
      const due = input.ready[piece.instanceId] ?? clock + fire.periodMs / 2;
      if (due > clock) { ready[piece.instanceId] = due; continue; }
      ready[piece.instanceId] = clock + fire.periodMs;
      let target = -1;
      for (let index = 0; index < mechanic.wisps.length; index += 1) {
        if (mechanic.wisps[index]!.column !== at.column || !arrived(index) || !alive(index)) continue;
        const row = wisps[index]!.row;
        if (row >= at.row) continue;
        if (target < 0 || row > wisps[target]!.row) target = index;
      }
      const rows = at.row - (target < 0 ? -LANE_MISS_ROW : wisps[target]!.row);
      const shot: LaneShot = { id: ++seq, fromCell: cell, wisp: target, damage: target < 0 ? 0 : fire.damage, firedAt: clock, landsAt: clock + laneFlightMs(rows) };
      fired.push(shot);
      // A miss has nothing to land on: it is only flown.
      if (target >= 0) shots.push(shot);
    }
  }

  const state: LanesState = { kind: 'lanes', strikes, clock, wisps, ready, shots, seq, breached: breached ?? input.breached };
  return { state, board: current(), fired, effects, changed, moved };
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
    const cell = laneCell(window, spec.column, laneRowOf(state.wisps[index]!.row));
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
  const wisps = raw.wisps.map((wisp) => ({ row: Number(wisp?.row) || 0, damage: Math.max(0, Number(wisp?.damage) || 0), holdUntil: Number(wisp?.holdUntil) || 0, cells: Math.max(0, Math.floor(Number(wisp?.cells) || 0)) }));
  return {
    kind: 'lanes', strikes: Math.max(0, Math.floor(Number(raw.strikes) || strikes)), clock: Number(raw.clock), wisps,
    ready: raw.ready && typeof raw.ready === 'object' ? { ...raw.ready } : {},
    shots: Array.isArray(raw.shots) ? raw.shots.filter((shot) => shot && Number.isFinite(shot.landsAt)).map((shot) => ({ ...shot })) : [],
    seq: Math.max(0, Math.floor(Number(raw.seq) || 0)),
    breached: raw.breached == null ? null : Math.floor(Number(raw.breached)),
  };
}
