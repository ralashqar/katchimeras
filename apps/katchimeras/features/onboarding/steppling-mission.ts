import type { FtueCameraDirective, FtueStepDefinition, FtueTarget } from './ftue-types';
import type { MergeWorldState } from '@/types/merge-world';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { createGeneratorState } from '@/utils/merge-world/engine';
import { createOpeningMissionState } from './opening-mission-state';
import { closestOpeningPair, MISSION_CAMERA_ANCHOR_Y, MISSION_CAMERA_ZOOM, OPENING_MERGE_WINDOW_CELLS } from './opening-mist';

/**
 * Steppling's mist mission: the second misted tile is cleared on a small docked
 * board under it, like the first, but this board teaches two things the
 * opening did not. It starts with nothing but the Journey Locker, found in the
 * mist, which makes Socks; and above it a short trail of cells asleep under the
 * Mist, each holding the next piece of walking gear up. A sleeping piece wakes
 * when its match is dropped on it, and wakes as the piece above it, which is the
 * match the next sleeping cell wants. So: tap for two Socks, merge them into a
 * Shoe, wake the sleeping Shoe into a Boot, the Boot into Hiking Gear, the Gear
 * into an Adventure Pack. Four strikes, one per wisp, and the bar is full; the
 * Glow discovery story then continues exactly as before (the reveal, the Egg,
 * the hatch).
 */
export const STEPPLING_MISSION_ID = 'mission:steppling';
/** v2: the sleeping-trail board; a v1 board saved mid-mission (walking gear, no sleepers) is left behind. */
export const STEPPLING_MISSION_STORAGE_KEY = 'katchimeras.mist-mission.steppling.v2';
/** One merge and three wakings: a strike per wisp. Fewer than the opening; this board is a lesson, not a grind. */
export const STEPPLING_MISSION_MERGE_REQUIRED = 4;
export const STEPPLING_MISSION_GENERATOR_ID = 'journey-locker';
export const STEPPLING_MISSION_SOCK_ID = 'adventure:trail:1';
/** The Locker sits in the bottom row's middle; the trail climbs straight up from it. */
export const STEPPLING_MISSION_LOCKER_CELL = 38;
/**
 * The sleeping trail, bottom to top: a Shoe that wakes as a Boot, a Boot that
 * wakes as Hiking Gear, Hiking Gear that wakes as an Adventure Pack. Each one's
 * match is exactly what the one below it wakes into.
 */
export const STEPPLING_MISSION_ECHOES: readonly { cell: number; id: string; definitionId: string }[] = [
  { cell: 31, id: 'steppling-trail-1', definitionId: 'adventure:trail:2' },
  { cell: 24, id: 'steppling-trail-2', definitionId: 'adventure:trail:3' },
  { cell: 17, id: 'steppling-trail-3', definitionId: 'adventure:trail:4' },
];
/** How long the board waits, with nothing spotlit, before the finger shows the next move. */
export const STEPPLING_MISSION_HINT_DELAY_MS = 2_000;
/** The overlay's theme for the board's free beats: the finger is a nudge for a pause, not a lead. */
export const STEPPLING_MISSION_HINT_THEME = { fingerDelayMs: STEPPLING_MISSION_HINT_DELAY_MS };
/** Steppling's tile close, the board beneath, the rest of the map faded. */
export const STEPPLING_MISSION_CAMERA: FtueCameraDirective = {
  kind: 'focus_target', target: { kind: 'haven_gateway' }, zoom: MISSION_CAMERA_ZOOM, anchorY: MISSION_CAMERA_ANCHOR_Y, durationMs: 900,
};

const LOCKER_TARGET: FtueTarget = { kind: 'board_generator', generatorId: STEPPLING_MISSION_GENERATOR_ID };

/**
 * The mission board: the opening's empty window, the Journey Locker as a board
 * piece that only ever makes Socks and never rests, and the three sleeping
 * cells of the trail. Nothing else: no items to start with, no orders, no Energy.
 */
export function createStepplingMissionState(now = Date.now()): MergeWorldState {
  const base = createOpeningMissionState(now);
  const board = base.board.map((cell) => (cell.occupant ? { ...cell, occupant: null } : cell));
  board[STEPPLING_MISSION_LOCKER_CELL] = { ...board[STEPPLING_MISSION_LOCKER_CELL], occupant: { kind: 'generator', generatorId: STEPPLING_MISSION_GENERATOR_ID } };
  for (const echo of STEPPLING_MISSION_ECHOES) {
    board[echo.cell] = {
      ...board[echo.cell], locked: true, blocker: null, occupant: null,
      mist: { kind: 'echo', id: echo.id, definitionId: echo.definitionId, ownerCharacterId: 'steppling' },
    };
  }
  const locker = createGeneratorState(STEPPLING_MISSION_GENERATOR_ID);
  return {
    ...base,
    board,
    generators: { [STEPPLING_MISSION_GENERATOR_ID]: { ...locker, forcedDropDefinitionId: STEPPLING_MISSION_SOCK_ID, capacity: 99, charges: 99 } },
  };
}

/** Items on the mission board's window right now (sleeping cells hold none until they wake). */
export function stepplingMissionItemsOnBoard(state: MergeWorldState): number {
  return OPENING_MERGE_WINDOW_CELLS.reduce((count, index) => count + (state.board[index]?.occupant?.kind === 'item' ? 1 : 0), 0);
}

/** Merges counted toward the bar, clamped to the requirement. */
export function stepplingMissionProgress(merges: number): number {
  return Math.max(0, Math.min(STEPPLING_MISSION_MERGE_REQUIRED, Math.floor(merges)));
}

/**
 * A sleeping cell whose match is on the board: the drag that wakes it. The
 * lowest sleeper first, so the trail is climbed in order even when two matches
 * are around.
 */
export function stepplingMissionWake(state: MergeWorldState): { from: number; to: number; definitionId: string } | null {
  for (const echo of STEPPLING_MISSION_ECHOES) {
    const cell = state.board[echo.cell];
    if (cell?.mist?.kind !== 'echo') continue;
    const wanted = cell.mist.definitionId;
    const from = OPENING_MERGE_WINDOW_CELLS.find((index) => {
      const candidate = state.board[index];
      return candidate && !candidate.mist && candidate.occupant?.kind === 'item' && candidate.occupant.definitionId === wanted;
    });
    if (from != null) return { from, to: echo.cell, definitionId: wanted };
  }
  return null;
}

function spawnStep(id: string, title: string, body: string): FtueStepDefinition {
  return {
    id, surface: 'merge', actions: [],
    guide: { eyebrow: 'Left in the Mist', title, body },
    interaction: { mode: 'exclusive', allowed: { kind: 'generator_tap', target: LOCKER_TARGET } },
    cue: { kind: 'tap', target: LOCKER_TARGET },
    spotlight: { targets: [LOCKER_TARGET], padding: 4, radius: 12, dimOpacity: 0.62 },
  };
}

/**
 * The beat the mission board projects. The Locker is the one new thing here,
 * so its first two taps are spotlit and nothing else is allowed. After that
 * nothing is spotlit and the board is free; the finger only shows the next
 * move (a match to wake a sleeper, a pair to merge, or the Locker when the
 * board has run dry) once the player has paused on it for a couple of seconds.
 */
export function stepplingMissionBoardStep(state: MergeWorldState | null, merges: number): FtueStepDefinition | null {
  if (!state) return null;
  const items = stepplingMissionItemsOnBoard(state);
  if (merges === 0 && items < 2) {
    return items === 0
      ? spawnStep('mission.steppling.spawn', 'A Journey Locker, still packed.', 'Tap it. Whoever packed it isn’t far.')
      : spawnStep('mission.steppling.spawn_again', 'One Sock. Nobody walks far on one.', 'Tap it again.');
  }
  const wake = stepplingMissionWake(state);
  if (wake) {
    const name = MERGE_ITEMS_BY_ID.get(wake.definitionId)?.name ?? 'match';
    return {
      id: 'mission.steppling.wake', surface: 'merge', actions: [],
      guide: { eyebrow: 'Asleep on the trail', title: `Something under the Mist wants a ${name}.`, body: 'Drop it on the sleeping one. It wakes as the next thing up the trail.' },
      interaction: { mode: 'none' },
      cue: { kind: 'drag', from: { kind: 'board_cell', cell: wake.from }, to: { kind: 'board_cell', cell: wake.to } },
    };
  }
  const pair = closestOpeningPair(state);
  if (pair) {
    const occupant = state.board[pair.from]?.occupant;
    const definition = occupant?.kind === 'item' ? MERGE_ITEMS_BY_ID.get(occupant.definitionId) : null;
    const next = definition?.nextItemId ? MERGE_ITEMS_BY_ID.get(definition.nextItemId) : null;
    return {
      id: 'mission.steppling.merge', surface: 'merge', actions: [],
      guide: {
        eyebrow: 'Four of them hold the trail',
        title: definition && next ? `Two of the same make a ${next.name}.` : 'Two of the same make the next one up.',
        body: 'Drag one onto the other. Every merge strikes a wisp.',
      },
      interaction: { mode: 'none' },
      cue: { kind: 'drag', from: { kind: 'board_cell', cell: pair.from }, to: { kind: 'board_cell', cell: pair.to } },
    };
  }
  return {
    id: 'mission.steppling.free', surface: 'merge', actions: [],
    guide: { eyebrow: 'Keep climbing', title: 'Run short? The Locker has more.', body: 'Tap it for another Sock.' },
    interaction: { mode: 'none' },
    cue: { kind: 'tap', target: LOCKER_TARGET },
  };
}
