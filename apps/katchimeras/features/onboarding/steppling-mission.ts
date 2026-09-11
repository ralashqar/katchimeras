import type { FtueCameraDirective, FtueStepDefinition, FtueTarget } from './ftue-types';
import type { MergeWorldState } from '@/types/merge-world';
import { createGeneratorState } from '@/utils/merge-world/engine';
import { createOpeningMissionState } from './opening-mission-state';
import { closestOpeningPair, MISSION_CAMERA_ANCHOR_Y, MISSION_CAMERA_ZOOM, OPENING_MERGE_WINDOW_CELLS } from './opening-mist';

/**
 * Steppling's mist mission: the second misted tile is cleared the way the
 * first was, on a small docked board under the tile, except this one has
 * Steppling's own things on it (walking gear) and, found in the mist, the
 * Journey Locker that makes Socks, so the bar can ask for more merges than
 * the placed pieces alone could give. Filling the bar is what clears the mist;
 * the Glow discovery story then continues exactly as before (the reveal, the
 * Egg, the hatch).
 */
export const STEPPLING_MISSION_ID = 'mission:steppling';
export const STEPPLING_MISSION_STORAGE_KEY = 'katchimeras.mist-mission.steppling.v1';
/** More than the opening asked for: the Locker keeps the board supplied. */
export const STEPPLING_MISSION_MERGE_REQUIRED = 12;
export const STEPPLING_MISSION_GENERATOR_ID = 'journey-locker';
export const STEPPLING_MISSION_SOCK_ID = 'adventure:trail:1';
/** The Locker sits in the bottom row's middle, under the walking gear. */
export const STEPPLING_MISSION_LOCKER_CELL = 38;
/** Two Socks, two Shoes and a Boot, placed as two short chains around the middle. */
export const STEPPLING_MISSION_ITEMS: readonly { cell: number; definitionId: string }[] = [
  { cell: 16, definitionId: 'adventure:trail:1' },
  { cell: 18, definitionId: 'adventure:trail:1' },
  { cell: 22, definitionId: 'adventure:trail:2' },
  { cell: 26, definitionId: 'adventure:trail:2' },
  { cell: 24, definitionId: 'adventure:trail:3' },
];
/** Steppling's tile close, the board beneath, the rest of the map faded. */
export const STEPPLING_MISSION_CAMERA: FtueCameraDirective = {
  kind: 'focus_target', target: { kind: 'haven_gateway' }, zoom: MISSION_CAMERA_ZOOM, anchorY: MISSION_CAMERA_ANCHOR_Y, durationMs: 900,
};

const LOCKER_TARGET: FtueTarget = { kind: 'board_generator', generatorId: STEPPLING_MISSION_GENERATOR_ID };

/**
 * The mission board: the opening's empty window, Steppling's pieces on it and
 * the Journey Locker as a board piece that only ever makes Socks and never
 * rests. Nothing else: no orders, no Energy, no echoes.
 */
export function createStepplingMissionState(now = Date.now()): MergeWorldState {
  const base = createOpeningMissionState(now);
  const board = base.board.map((cell) => (cell.occupant ? { ...cell, occupant: null } : cell));
  board[STEPPLING_MISSION_LOCKER_CELL] = { ...board[STEPPLING_MISSION_LOCKER_CELL], occupant: { kind: 'generator', generatorId: STEPPLING_MISSION_GENERATOR_ID } };
  STEPPLING_MISSION_ITEMS.forEach(({ cell, definitionId }, index) => {
    board[cell] = { ...board[cell], occupant: { kind: 'item', instanceId: `steppling-mission-${index}`, definitionId } };
  });
  const locker = createGeneratorState(STEPPLING_MISSION_GENERATOR_ID);
  return {
    ...base,
    board,
    generators: { [STEPPLING_MISSION_GENERATOR_ID]: { ...locker, forcedDropDefinitionId: STEPPLING_MISSION_SOCK_ID, capacity: 99, charges: 99 } },
  };
}

/** Items on the mission board's window right now. */
export function stepplingMissionItemsOnBoard(state: MergeWorldState): number {
  return OPENING_MERGE_WINDOW_CELLS.reduce((count, index) => count + (state.board[index]?.occupant?.kind === 'item' ? 1 : 0), 0);
}

/** Merges counted toward the bar, clamped to the requirement. */
export function stepplingMissionProgress(merges: number): number {
  return Math.max(0, Math.min(STEPPLING_MISSION_MERGE_REQUIRED, Math.floor(merges)));
}

/**
 * The beat the mission board projects. The Locker is the one new thing here,
 * so the first tap is spotlit and nothing else is allowed; the first merge
 * after that gets only the finger on the closest pair; then the board is free
 * and the guide just says what the bar wants.
 */
export function stepplingMissionBoardStep(state: MergeWorldState | null, merges: number): FtueStepDefinition | null {
  if (!state) return null;
  const spawnedOnce = merges > 0 || stepplingMissionItemsOnBoard(state) > STEPPLING_MISSION_ITEMS.length;
  if (!spawnedOnce) {
    return {
      id: 'mission.steppling.spawn', surface: 'merge', actions: [],
      guide: { eyebrow: 'Left in the Mist', title: 'A Journey Locker, still packed.', body: 'Tap it. Whoever packed it isn’t far.' },
      interaction: { mode: 'exclusive', allowed: { kind: 'generator_tap', target: LOCKER_TARGET } },
      cue: { kind: 'tap', target: LOCKER_TARGET },
      spotlight: { targets: [LOCKER_TARGET], padding: 4, radius: 12, dimOpacity: 0.62 },
    };
  }
  const pair = merges === 0 ? closestOpeningPair(state) : null;
  if (pair) {
    const from: FtueTarget = { kind: 'board_cell', cell: pair.from };
    const to: FtueTarget = { kind: 'board_cell', cell: pair.to };
    return {
      id: 'mission.steppling.merge', surface: 'merge', actions: [],
      guide: { eyebrow: 'Four of them hold the trail', title: 'Walking gear, put together.', body: 'Every merge strikes one. The Locker makes more Socks.' },
      interaction: { mode: 'none' },
      cue: { kind: 'drag', from, to },
    };
  }
  return {
    id: 'mission.steppling.free', surface: 'merge', actions: [],
    guide: { eyebrow: 'Keep striking', title: 'Keep merging.', body: 'Tap the Locker whenever you run short.' },
    interaction: { mode: 'none' },
  };
}
