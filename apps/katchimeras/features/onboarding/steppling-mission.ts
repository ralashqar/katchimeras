import type { FtueCameraDirective, FtueStepDefinition, FtueTarget } from './ftue-types';
import type { MergeBoardCell, MergeWorldState } from '@/types/merge-world';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { createOpeningMissionState } from './opening-mission-state';
import { closestOpeningPair, MISSION_CAMERA_ANCHOR_Y, MISSION_CAMERA_ZOOM, OPENING_MERGE_WINDOW_CELLS } from './opening-mist';

/**
 * Steppling's mist mission: the second misted tile is cleared on a small docked
 * board under it, like the first, with no spawner (the Garden board teaches
 * that, by parcel). What is here is walking gear the Mist left lying about, one
 * sleeping cell under a lower band of mist, and above it cells the Mist holds
 * completely. A sleeping piece wakes when its match is dropped on it, and when
 * it does, the full mist beside it bursts and shows the next sleeper. The chain
 * snakes up and across the window: merge two Socks into a Shoe, wake the
 * sleeping Shoe into a Boot (the cell above bursts), wake that into Hiking Gear
 * (two cells burst: the one above wants an Adventure Pack you cannot make yet,
 * the one beside wants the Sock you still have), wake that into a Shoe, the
 * next into a Boot, the next into Hiking Gear, merge the two Hiking Gears into
 * the Pack, and wake the top cell with it into an Expedition Kit. Eight strikes,
 * two per wisp, and the bar is full; the Glow discovery story then continues
 * exactly as before (the reveal, the Egg, the hatch).
 *
 * The board holds exactly what the chain consumes, and at every moment there is
 * one thing to do: every sleeper wants a piece only one step can make, and no
 * two loose pieces share a tier until the two Hiking Gears are meant to meet.
 * That is what makes it impossible to strand: a loose pair below a sleeper's
 * tier would let the player merge past it and stop.
 */
export const STEPPLING_MISSION_ID = 'mission:steppling';
/** v3: no spawner, veiled cells; a v2 board saved mid-mission (the Locker's trail) is left behind. */
export const STEPPLING_MISSION_STORAGE_KEY = 'katchimeras.mist-mission.steppling.v3';
/** Two merges and six wakings: eight strikes, two per wisp. */
export const STEPPLING_MISSION_MERGE_REQUIRED = 8;
export const STEPPLING_MISSION_SOCK_ID = 'adventure:trail:1';
/** The gear the Mist left on the board: three Socks along the bottom, two of them side by side. */
export const STEPPLING_MISSION_ITEMS: readonly { cell: number; definitionId: string }[] = [
  { cell: 36, definitionId: 'adventure:trail:1' },
  { cell: 37, definitionId: 'adventure:trail:1' },
  { cell: 40, definitionId: 'adventure:trail:1' },
];
/** The one sleeper the player can see: a Shoe under a lower band of mist, bottom middle, that wakes as a Boot. */
export const STEPPLING_MISSION_ECHOES: readonly { cell: number; id: string; definitionId: string }[] = [
  { cell: 38, id: 'steppling-trail-1', definitionId: 'adventure:trail:2' },
];
/**
 * The cells the Mist holds completely. Each hides the next sleeper and bursts
 * open the moment a sleeper beside it wakes, in the order the chain climbs:
 * 31 above the first sleeper; 24 and 30 above and beside that; 23 above 30;
 * 22 beside 23. The top one (24) wants the Pack the two Hiking Gears make.
 */
export const STEPPLING_MISSION_VEILED: readonly { cell: number; id: string; definitionId: string }[] = [
  { cell: 31, id: 'steppling-trail-2', definitionId: 'adventure:trail:3' },
  { cell: 24, id: 'steppling-trail-3', definitionId: 'adventure:trail:5' },
  { cell: 30, id: 'steppling-trail-4', definitionId: 'adventure:trail:1' },
  { cell: 23, id: 'steppling-trail-5', definitionId: 'adventure:trail:2' },
  { cell: 22, id: 'steppling-trail-6', definitionId: 'adventure:trail:3' },
];
/** How long the board waits, with nothing spotlit, before the finger shows the next move. */
export const STEPPLING_MISSION_HINT_DELAY_MS = 2_000;
/** The overlay's theme for the board's free beats: the finger is a nudge for a pause, not a lead. */
export const STEPPLING_MISSION_HINT_THEME = { fingerDelayMs: STEPPLING_MISSION_HINT_DELAY_MS };
/** Steppling's tile close, the board beneath, the rest of the map faded. */
export const STEPPLING_MISSION_CAMERA: FtueCameraDirective = {
  kind: 'focus_target', target: { kind: 'haven_gateway' }, zoom: MISSION_CAMERA_ZOOM, anchorY: MISSION_CAMERA_ANCHOR_Y, durationMs: 900,
};

/**
 * The mission board: the opening's empty window, the gear on it, the sleeper and
 * the veiled cells above it. Nothing else: no spawner, no orders, no Energy.
 */
export function createStepplingMissionState(now = Date.now()): MergeWorldState {
  const base = createOpeningMissionState(now);
  const board: MergeBoardCell[] = base.board.map((cell) => (cell.occupant ? { ...cell, occupant: null } : cell));
  STEPPLING_MISSION_ITEMS.forEach(({ cell, definitionId }, index) => {
    board[cell] = { ...board[cell], occupant: { kind: 'item', instanceId: `steppling-mission-${index}`, definitionId } };
  });
  for (const echo of STEPPLING_MISSION_ECHOES) {
    board[echo.cell] = {
      ...board[echo.cell], locked: true, blocker: null, occupant: null,
      mist: { kind: 'echo', id: echo.id, definitionId: echo.definitionId, ownerCharacterId: 'steppling' },
    };
  }
  for (const veiled of STEPPLING_MISSION_VEILED) {
    board[veiled.cell] = {
      ...board[veiled.cell], locked: true, blocker: null, occupant: null,
      mist: { kind: 'veiled', echo: { id: veiled.id, definitionId: veiled.definitionId, ownerCharacterId: 'steppling' } },
    };
  }
  return { ...base, board, generators: {} };
}

/** Items on the mission board's window right now (sleeping and veiled cells hold none until they wake). */
export function stepplingMissionItemsOnBoard(state: MergeWorldState): number {
  return OPENING_MERGE_WINDOW_CELLS.reduce((count, index) => count + (state.board[index]?.occupant?.kind === 'item' ? 1 : 0), 0);
}

/** Merges counted toward the bar, clamped to the requirement. */
export function stepplingMissionProgress(merges: number): number {
  return Math.max(0, Math.min(STEPPLING_MISSION_MERGE_REQUIRED, Math.floor(merges)));
}

/**
 * A sleeping cell whose match is on the board: the drag that wakes it. The
 * lowest sleeper first, so the column is climbed in order when two are awake.
 */
export function stepplingMissionWake(state: MergeWorldState): { from: number; to: number; definitionId: string } | null {
  const sleepers = OPENING_MERGE_WINDOW_CELLS
    .filter((index) => state.board[index]?.mist?.kind === 'echo')
    .sort((a, b) => b - a);
  for (const to of sleepers) {
    const mist = state.board[to]!.mist;
    if (mist?.kind !== 'echo') continue;
    const wanted = mist.definitionId;
    const from = OPENING_MERGE_WINDOW_CELLS.find((index) => {
      const candidate = state.board[index];
      return candidate && !candidate.mist && candidate.occupant?.kind === 'item' && candidate.occupant.definitionId === wanted;
    });
    if (from != null) return { from, to, definitionId: wanted };
  }
  return null;
}

/**
 * The beat the mission board projects. There is no spawner to introduce, so
 * the board opens on the one thing the opening taught: the first merge is
 * spotlit and nothing else is allowed. After that nothing is spotlit and the
 * board is free; the finger only shows the next move (a match to wake a
 * sleeper, or a pair to merge) once the player has paused for a couple of
 * seconds. Waking a sleeper bursts the mist above it open on its own.
 */
export function stepplingMissionBoardStep(state: MergeWorldState | null, merges: number): FtueStepDefinition | null {
  if (!state) return null;
  const wake = stepplingMissionWake(state);
  const pair = closestOpeningPair(state);
  if (merges === 0 && !wake && pair) {
    const from: FtueTarget = { kind: 'board_cell', cell: pair.from };
    const to: FtueTarget = { kind: 'board_cell', cell: pair.to };
    return {
      id: 'mission.steppling.first_merge', surface: 'merge', actions: [],
      guide: { eyebrow: 'Left on the trail', title: 'Two Socks. Together.', body: 'Every merge strikes a wisp.' },
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from, to } },
      cue: { kind: 'drag', from, to },
      spotlight: { targets: [from, to], grouping: 'bounding_rect', padding: 3, radius: 11, dimOpacity: 0.62 },
    };
  }
  if (wake) {
    const name = MERGE_ITEMS_BY_ID.get(wake.definitionId)?.name ?? 'match';
    const article = /^[aeiou]/i.test(name) ? 'an' : 'a';
    return {
      id: 'mission.steppling.wake', surface: 'merge', actions: [],
      guide: { eyebrow: 'Asleep under the Mist', title: `Something under there wants ${article} ${name}.`, body: 'Give it its match. What it was hiding comes with it.' },
      interaction: { mode: 'none' },
      cue: { kind: 'drag', from: { kind: 'board_cell', cell: wake.from }, to: { kind: 'board_cell', cell: wake.to } },
    };
  }
  if (pair) {
    const occupant = state.board[pair.from]?.occupant;
    const definition = occupant?.kind === 'item' ? MERGE_ITEMS_BY_ID.get(occupant.definitionId) : null;
    const next = definition?.nextItemId ? MERGE_ITEMS_BY_ID.get(definition.nextItemId) : null;
    return {
      id: 'mission.steppling.merge', surface: 'merge', actions: [],
      guide: {
        eyebrow: 'Two of a kind',
        title: definition && next ? `Two of the same make ${/^[aeiou]/i.test(next.name) ? 'an' : 'a'} ${next.name}.` : 'Two of the same make the next one up.',
        body: 'Drag one onto the other. Every merge strikes a wisp.',
      },
      interaction: { mode: 'none' },
      cue: { kind: 'drag', from: { kind: 'board_cell', cell: pair.from }, to: { kind: 'board_cell', cell: pair.to } },
    };
  }
  return {
    id: 'mission.steppling.free', surface: 'merge', actions: [],
    guide: { eyebrow: 'Keep striking', title: 'Keep merging.', body: 'Two of the same, together.' },
    interaction: { mode: 'none' },
  };
}
