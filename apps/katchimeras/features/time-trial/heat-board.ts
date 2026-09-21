import { createOpeningMissionState } from '@/features/onboarding/opening-mission-state';
import { OPENING_MERGE_WINDOW_CELLS } from '@/features/onboarding/opening-mist';
import type { MergeBoardCell, MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import { reduceMergeWorld } from '@/utils/merge-world/engine';
import { startHeat, strikeHeat, tickHeat, type HeatEvent, type HeatPiece, type HeatSpec, type HeatState, type HeatStrike } from './heat';

/**
 * A heat on the game's own mini board. The docked board draws a Merge world and sends board commands, so a heat is
 * given one: the 5 x 4 window of a mission board, holding the heat's pieces as ordinary Merge items. Every move goes
 * through the real Merge engine (so dragging, swapping, merging and their animations are exactly the game's), and the
 * heat's rules are told what happened: a merge strikes the nearest wisp and frees a cell; time deals new pieces in
 * and brings new wisps. The world is the truth for where pieces are; the heat is the truth for everything else.
 * Pure: time is passed in, nothing is stored.
 */
export type RushBoard = { world: MergeWorldState; heat: HeatState; nextInstance: number };

const CELLS = OPENING_MERGE_WINDOW_CELLS;
const definitionId = (piece: HeatPiece) => `${piece.chainId}:${piece.tier}`;
const pieceOf = (id: string): HeatPiece => ({ chainId: id.slice(0, id.lastIndexOf(':')), tier: Number(id.slice(id.lastIndexOf(':') + 1)) });

function place(board: RushBoard, cells: MergeBoardCell[], slot: number, piece: HeatPiece) {
  const cell = CELLS[slot]!;
  cells[cell] = { ...cells[cell]!, locked: false, blocker: null, mist: null, occupant: { kind: 'item', instanceId: `rush-${board.nextInstance++}`, definitionId: definitionId(piece) } };
}

export function startRushBoard(spec: HeatSpec, now: number): RushBoard {
  const heat = startHeat(spec);
  const base = createOpeningMissionState(now);
  const board: RushBoard = { world: base, heat, nextInstance: 1 };
  const cells = base.board.map((cell, index) => (CELLS.includes(index) ? { ...cell, locked: false, blocker: null, mist: null, occupant: null } : cell));
  heat.slots.forEach((piece, slot) => { if (piece) place(board, cells, slot, piece); });
  board.world = { ...base, board: cells, generators: {}, activeOrders: [] };
  return board;
}

/** Where the pieces are, read back off the board. */
function slotsOf(world: MergeWorldState): (HeatPiece | null)[] {
  return CELLS.map((cell) => {
    const occupant = world.board[cell]?.occupant;
    return occupant?.kind === 'item' ? pieceOf(occupant.definitionId) : null;
  });
}

/** What time did to the board: new pieces. */
function applyEvents(board: RushBoard, events: readonly HeatEvent[]): MergeWorldState {
  if (!events.some((event) => event.type === 'dealt')) return board.world;
  const cells = [...board.world.board];
  for (const event of events) if (event.type === 'dealt') place(board, cells, event.slot, event.piece);
  return { ...board.world, board: cells, revision: board.world.revision + 1 };
}

export function tickRushBoard(input: RushBoard, atMs: number): { board: RushBoard; events: HeatEvent[] } {
  const ticked = tickHeat(input.heat, atMs);
  if (ticked.state === input.heat || (!ticked.events.length && ticked.state.finishedMs === input.heat.finishedMs)) return { board: input, events: [] };
  const board: RushBoard = { ...input, heat: ticked.state };
  board.world = applyEvents(board, ticked.events);
  return { board, events: ticked.events };
}

export type RushCommandResult = { board: RushBoard; result: MergeWorldCommandResult; strike: HeatStrike | null; events: HeatEvent[] };

/** A board command during a heat. Only moves mean anything here; a finished heat takes none. */
export function commandRushBoard(input: RushBoard, command: MergeWorldCommand, atMs: number): RushCommandResult {
  const settled = tickRushBoard(input, atMs);
  let board = settled.board;
  if (command.type !== 'move' || board.heat.finishedMs != null) return { board, result: { state: board.world, changed: false }, strike: null, events: settled.events };
  const result = reduceMergeWorld(board.world, command);
  if (!result.changed) return { board, result, strike: null, events: settled.events };
  board = { ...board, world: result.state };
  const slots = slotsOf(result.state);
  const merged = result.mergedCell != null ? result.state.board[result.mergedCell]?.occupant : null;
  if (merged?.kind !== 'item') return { board: { ...board, heat: { ...board.heat, slots } }, result, strike: null, events: settled.events };
  const struck = strikeHeat(board.heat, slots, pieceOf(merged.definitionId), CELLS.indexOf(result.mergedCell!), atMs);
  board = { ...board, heat: struck.state };
  board.world = applyEvents(board, struck.events);
  return { board, result: { ...result, state: board.world }, strike: struck.strike, events: [...settled.events, ...struck.events] };
}
