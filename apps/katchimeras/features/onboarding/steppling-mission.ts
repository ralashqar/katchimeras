import type { FtueCameraDirective, FtueGuide, FtueStepDefinition, FtueTarget } from './ftue-types';
import type { MergeBoardCell, MergeCharacterId, MergeWorldState } from '@/types/merge-world';
import type { HatchableMissionDefinition, HatchableMissionSeed } from '@/types/hatchable-companion';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/steppling';
import { createOpeningMissionState } from './opening-mission-state';
import { closestOpeningPair, OPENING_MERGE_WINDOW_CELLS } from './opening-mist';

/**
 * A hatchable companion's mist mission: the misted tile is cleared on a small
 * docked board under it, like the opening's, with no spawner (the Garden board
 * teaches that, by parcel). What is on it is authored in the companion's
 * definition: loose pieces to merge, sleeping cells under a lower band of mist,
 * and cells the Mist holds completely. A sleeping piece wakes when its match is
 * dropped on it, and when it does, the full mist beside it bursts and shows the
 * next sleeper. Every strike, merge or waking, hits a wisp; when the bar is
 * full the last piece flies into the mist and the discovery story continues.
 *
 * Steppling's board snakes up and across the window: merge two Socks into a
 * Shoe, wake the sleeping Shoe into a Boot (the cell above bursts), wake that
 * into Hiking Gear (two cells burst: the one above wants an Adventure Pack you
 * cannot make yet, the one beside wants the Sock you still have), wake that
 * into a Shoe, the next into a Boot, the next into Hiking Gear, merge the two
 * Hiking Gears into the Pack, and wake the top cell with it into an Expedition
 * Kit. Eight strikes, two per wisp.
 *
 * A board holds exactly what its chain consumes, and at every moment there is
 * one thing to do: every sleeper wants a piece only one step can make, and no
 * two loose pieces share a tier until they are meant to meet. That is what
 * makes it impossible to strand, and the registry test proves it for every
 * definition.
 */
const STEPPLING_MISSION = STEPPLING_HATCHABLE.mission;
export const STEPPLING_MISSION_ID = STEPPLING_MISSION.id;
export const STEPPLING_MISSION_STORAGE_KEY = STEPPLING_MISSION.storageKey;
export const STEPPLING_MISSION_MERGE_REQUIRED = STEPPLING_MISSION.required;
export const STEPPLING_MISSION_SOCK_ID = 'adventure:trail:1';
export const STEPPLING_MISSION_ITEMS = STEPPLING_MISSION.seed.items;
export const STEPPLING_MISSION_ECHOES = STEPPLING_MISSION.seed.echoes;
export const STEPPLING_MISSION_VEILED = STEPPLING_MISSION.seed.veiled;
/** How long the board waits, with nothing spotlit, before the finger shows the next move. */
export const STEPPLING_MISSION_HINT_DELAY_MS = 2_000;
/** The overlay's theme for the board's free beats: the finger is a nudge for a pause, not a lead. */
export const STEPPLING_MISSION_HINT_THEME = { fingerDelayMs: STEPPLING_MISSION_HINT_DELAY_MS };
/** The companion's tile close, the board beneath, the rest of the map faded. */
export const STEPPLING_MISSION_CAMERA: FtueCameraDirective = STEPPLING_MISSION.camera;

/**
 * A mission board from its seed: the opening's empty window, the loose pieces,
 * the sleepers and the veiled cells. Nothing else: no spawner, no orders, no Energy.
 */
export function createMissionState(seed: HatchableMissionSeed, owner: MergeCharacterId, now = Date.now()): MergeWorldState {
  const base = createOpeningMissionState(now);
  const board: MergeBoardCell[] = base.board.map((cell) => (cell.occupant ? { ...cell, occupant: null } : cell));
  seed.items.forEach(({ cell, definitionId }, index) => {
    board[cell] = { ...board[cell], occupant: { kind: 'item', instanceId: `${owner}-mission-${index}`, definitionId } };
  });
  for (const echo of seed.echoes) {
    board[echo.cell] = {
      ...board[echo.cell], locked: true, blocker: null, occupant: null,
      mist: { kind: 'echo', id: echo.id, definitionId: echo.definitionId, ownerCharacterId: owner },
    };
  }
  for (const veiled of seed.veiled) {
    board[veiled.cell] = {
      ...board[veiled.cell], locked: true, blocker: null, occupant: null,
      mist: { kind: 'veiled', echo: { id: veiled.id, definitionId: veiled.definitionId, ownerCharacterId: owner } },
    };
  }
  return { ...base, board, generators: {} };
}
export function createStepplingMissionState(now = Date.now()): MergeWorldState {
  return createMissionState(STEPPLING_MISSION.seed, STEPPLING_HATCHABLE.companion, now);
}

/** Items on the mission board's window right now (sleeping and veiled cells hold none until they wake). */
export function stepplingMissionItemsOnBoard(state: MergeWorldState): number {
  return OPENING_MERGE_WINDOW_CELLS.reduce((count, index) => count + (state.board[index]?.occupant?.kind === 'item' ? 1 : 0), 0);
}

/** Merges counted toward the bar, clamped to the requirement. */
export function missionProgress(merges: number, required: number): number {
  return Math.max(0, Math.min(required, Math.floor(merges)));
}
export function stepplingMissionProgress(merges: number): number {
  return missionProgress(merges, STEPPLING_MISSION_MERGE_REQUIRED);
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

const article = (name: string) => (/^[aeiou]/i.test(name) ? 'an' : 'a');
const fill = (guide: FtueGuide, name: string): FtueGuide => ({
  ...guide, title: guide.title.replace('{a}', article(name)).replace('{name}', name),
});

/**
 * The beat a mission board projects. There is no spawner to introduce, so the
 * board opens on the one thing the opening taught: the first merge is spotlit
 * and nothing else is allowed. After that nothing is spotlit and the board is
 * free; the finger only shows the next move (a match to wake a sleeper, or a
 * pair to merge) once the player has paused for a couple of seconds. Waking a
 * sleeper bursts the mist beside it open on its own.
 */
export function missionBoardStep(mission: HatchableMissionDefinition, state: MergeWorldState | null, merges: number): FtueStepDefinition | null {
  if (!state) return null;
  const { guides } = mission;
  const idPrefix = `mission.${mission.id.replace(/^mission:/, '')}`;
  const wake = stepplingMissionWake(state);
  const pair = closestOpeningPair(state);
  if (merges === 0 && !wake && pair) {
    const from: FtueTarget = { kind: 'board_cell', cell: pair.from };
    const to: FtueTarget = { kind: 'board_cell', cell: pair.to };
    return {
      id: `${idPrefix}.first_merge`, surface: 'merge', actions: [],
      guide: guides.firstMerge,
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from, to } },
      cue: { kind: 'drag', from, to },
      spotlight: { targets: [from, to], grouping: 'bounding_rect', padding: 3, radius: 11, dimOpacity: 0.62 },
    };
  }
  if (wake) {
    const name = MERGE_ITEMS_BY_ID.get(wake.definitionId)?.name ?? 'match';
    return {
      id: `${idPrefix}.wake`, surface: 'merge', actions: [],
      guide: fill(guides.wake, name),
      interaction: { mode: 'none' },
      cue: { kind: 'drag', from: { kind: 'board_cell', cell: wake.from }, to: { kind: 'board_cell', cell: wake.to } },
    };
  }
  if (pair) {
    const occupant = state.board[pair.from]?.occupant;
    const definition = occupant?.kind === 'item' ? MERGE_ITEMS_BY_ID.get(occupant.definitionId) : null;
    const next = definition?.nextItemId ? MERGE_ITEMS_BY_ID.get(definition.nextItemId) : null;
    return {
      id: `${idPrefix}.merge`, surface: 'merge', actions: [],
      guide: next ? fill(guides.merge, next.name) : { ...guides.merge, title: guides.mergeFallbackTitle },
      interaction: { mode: 'none' },
      cue: { kind: 'drag', from: { kind: 'board_cell', cell: pair.from }, to: { kind: 'board_cell', cell: pair.to } },
    };
  }
  return {
    id: `${idPrefix}.free`, surface: 'merge', actions: [],
    guide: guides.free,
    interaction: { mode: 'none' },
  };
}
export function stepplingMissionBoardStep(state: MergeWorldState | null, merges: number): FtueStepDefinition | null {
  return missionBoardStep(STEPPLING_MISSION, state, merges);
}
