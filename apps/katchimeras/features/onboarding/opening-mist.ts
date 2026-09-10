import type { FtueRunState, FtueStepDefinition, FtueTarget } from './ftue-types';
import type { MergeWorldState } from '@/types/merge-world';
import type { AtmosphereSettings } from '@/utils/atmosphere';
import type { DayBackgroundSceneId } from '@/types/home';

/**
 * The mist-veiled opening: every tile under mist, a docked board under
 * Mossprout's tile, merges filling the "Clear the Mist" bar, then the veil
 * lifting to reveal the Egg. Pure helpers shared by the Kingdom screen, the
 * canvas and the docked board.
 */
export const OPENING_MIST_OPEN_STEP_ID = 'world.mist_open';
export const OPENING_MIST_CLEAR_STEP_ID = 'world.mist_clear';
export const OPENING_MIST_LIFT_STEP_ID = 'world.mist_lift';
export const OPENING_CLEAR_ACTION_ID = 'world.clear_mist';
export const OPENING_LIFTED_ACTION_ID = 'world.mist_lifted';
export const MOSSPROUT_OPENING_STEP_IDS: readonly string[] = [OPENING_MIST_OPEN_STEP_ID, OPENING_MIST_CLEAR_STEP_ID, OPENING_MIST_LIFT_STEP_ID];

/** Merges that fill the bar: two chains of three, then the one merge that joins them. The board ends empty. */
export const OPENING_MERGE_REQUIRED = 7;
/**
 * The first merges are guided the way the original full-board lesson was:
 * an exclusive drag of one pair, nothing else allowed. The first shows the
 * spotlight and the finger, the second only the finger, then the board is free.
 */
export const OPENING_GUIDED_MERGES = 2;
/**
 * The opening camera: Mossprout's veiled tile close, its resting marker
 * sitting just above the "Clear the Mist" bar, the board beneath.
 */
export const OPENING_CAMERA_ZOOM = 0.81;
export const OPENING_CAMERA_ANCHOR_Y = 0.36;
/** The first beat starts a little further out and glides in while the captions run. */
export const OPENING_CAMERA_ENTRY_ZOOM = 0.67;
/**
 * Every later docked board (Steppling's mission, a friend's restoration) sits
 * closer to its tile than the opening did, with the rest of the map faded out.
 */
export const MISSION_CAMERA_ZOOM = 0.96;
export const MISSION_CAMERA_ANCHOR_Y = OPENING_CAMERA_ANCHOR_Y;

/** The opening's sky: twilight, until the hatch. */
export const OPENING_SKY_SCENE_ID: DayBackgroundSceneId = 'twilight_reflective';
/** Rain over the veiled world; it thins away with the lift. */
export const OPENING_RAIN: AtmosphereSettings = { intensity: 0.55, paused: false, preset: 'rain', quality: 'auto', seed: 11, wind: 0.18 };
/**
 * The reveal's own rising embers, looping quietly over the veiled tile in the
 * mist's colours: pale sky, blue glow, lavender. `intensity` is peak opacity.
 */
export const OPENING_TILE_EMBERS = {
  intensity: 0.75,
  palette: { accent: '#EAF8FF', glow: '#9FD8FF', mist: 'rgba(214,229,238,0.92)', primary: '#CDB8FF' },
} as const;
export const OPENING_CAMERA_ENTRY_MS = 4_800;

/** The 5×4 window of the canonical 7×9 board: columns 1–5, rows 2–5. */
export const OPENING_MERGE_WINDOW_COLUMNS = 5;
export const OPENING_MERGE_WINDOW_ROWS = 4;
export const OPENING_MERGE_WINDOW_CELLS: readonly number[] = [
  15, 16, 17, 18, 19,
  22, 23, 24, 25, 26,
  29, 30, 31, 32, 33,
  36, 37, 38, 39, 40,
];

export type HomeVeilState = 'veiled' | 'lifting' | 'none';

/** Mossprout's tile stays under mist until the bar is full; the lift beat crossblends it away. */
export function homeVeilForStep(stepId: string | null | undefined): HomeVeilState {
  if (stepId === OPENING_MIST_OPEN_STEP_ID || stepId === OPENING_MIST_CLEAR_STEP_ID) return 'veiled';
  if (stepId === OPENING_MIST_LIFT_STEP_ID) return 'lifting';
  return 'none';
}

export function isMossproutOpeningStep(stepId: string | null | undefined): boolean {
  return MOSSPROUT_OPENING_STEP_IDS.includes(stepId ?? '');
}

/**
 * Mossprout's tile stands alone until the Egg has hatched: the mist beats, the
 * Egg intro and the Egg's questions. The sleeping islands are met afterwards.
 */
export function homeSoloForStep(stepId: string | null | undefined): boolean {
  if (!stepId) return false;
  return isMossproutOpeningStep(stepId) || stepId === 'world.egg_intro' || stepId.startsWith('egg.');
}

/** Merges counted so far toward the bar, clamped to the requirement. */
export function openingMistProgress(run: Pick<FtueRunState, 'status' | 'stepId' | 'objectiveProgress'> | null): number {
  if (!run || run.status !== 'active') return 0;
  if (run.stepId === OPENING_MIST_LIFT_STEP_ID) return OPENING_MERGE_REQUIRED;
  if (run.stepId !== OPENING_MIST_CLEAR_STEP_ID) return 0;
  const count = run.objectiveProgress[`${OPENING_MIST_CLEAR_STEP_ID}:${OPENING_CLEAR_ACTION_ID}`] ?? 0;
  return Math.max(0, Math.min(OPENING_MERGE_REQUIRED, Math.floor(count)));
}

/** The docked board's window over the canonical board: the Merge page's own frame, no stretched base art. */
export const OPENING_BOARD_LAYOUT = {
  accessibilityLabel: 'Merge board, five columns by four rows',
  columns: OPENING_MERGE_WINDOW_COLUMNS,
  rows: OPENING_MERGE_WINDOW_ROWS,
  cellIndices: OPENING_MERGE_WINDOW_CELLS,
  transparentSurface: false,
  // The page's base art is a 7×9 checkerboard image that would stretch over a
  // 5×4 window; the native per-cell checker gives the same read at any size.
  baseArtOpacity: 0,
  checkerboardCellColor: 'rgba(222,232,170,0.17)',
  contentInset: 6,
} as const;

/** The closest two cells in the window holding the same item; the guided drag points at these. */
export function closestOpeningPair(state: MergeWorldState, cells: readonly number[] = OPENING_MERGE_WINDOW_CELLS): { from: number; to: number } | null {
  const byDefinition = new Map<string, number[]>();
  for (const index of cells) {
    const cell = state.board[index];
    if (!cell || cell.locked || cell.mist || cell.occupant?.kind !== 'item') continue;
    byDefinition.set(cell.occupant.definitionId, [...(byDefinition.get(cell.occupant.definitionId) ?? []), index]);
  }
  let best: { from: number; to: number; distance: number } | null = null;
  for (const indices of byDefinition.values()) {
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const [ax, ay] = [indices[a] % 7, Math.floor(indices[a] / 7)];
        const [bx, by] = [indices[b] % 7, Math.floor(indices[b] / 7)];
        const distance = Math.hypot(ax - bx, ay - by);
        if (!best || distance < best.distance) best = { from: indices[a], to: indices[b], distance };
      }
    }
  }
  return best ? { from: best.from, to: best.to } : null;
}

/** Items placed on the opening board; every merge removes exactly one, and nothing else adds any. */
export const OPENING_ITEMS_AT_START = 8;
/** What the last merge makes and the Mist takes. */
export const OPENING_FINAL_ITEM_ID = 'nature:garden:5';

/** Merges the board itself shows: the checkpoint can trail this after a kill, never lead it by more than one. */
export function openingMergesOnBoard(state: MergeWorldState): number {
  const items = OPENING_MERGE_WINDOW_CELLS.reduce((count, index) => count + (state.board[index]?.occupant?.kind === 'item' ? 1 : 0), 0);
  return Math.max(0, Math.min(OPENING_MERGE_REQUIRED, OPENING_ITEMS_AT_START - items));
}

/**
 * The beat the docked board projects. For the first guided merges it is a
 * merge-surface step that allows exactly one drag (the closest pair), with the
 * spotlight and finger on the first and only the finger on the second, the
 * same constraints the original full-board lesson used; then the authored
 * haven step with its guidance removed, so the board is free. A board that
 * ran ahead of the checkpoint is caught up by `openingMergesOnBoard`, not by
 * a refill, so nothing else ever needs to be on the board.
 */
export function openingMistBoardStep(
  authored: FtueStepDefinition | null,
  state: MergeWorldState | null,
  count: number,
): FtueStepDefinition | null {
  if (!authored || !state) return authored;
  const pair = count < OPENING_MERGE_REQUIRED ? closestOpeningPair(state) : null;
  if (pair && count < OPENING_GUIDED_MERGES) {
    const from: FtueTarget = { kind: 'board_cell', cell: pair.from };
    const to: FtueTarget = { kind: 'board_cell', cell: pair.to };
    const first = count === 0;
    return {
      ...authored, id: `${authored.id}.guided-${count + 1}`, surface: 'merge',
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from, to } },
      cue: { kind: 'drag', from, to },
      spotlight: first ? { targets: [from, to], grouping: 'bounding_rect', padding: 3, radius: 11, dimOpacity: 0.64 } : undefined,
    };
  }
  if (!authored.cue && !authored.spotlight) return authored;
  return { ...authored, cue: undefined, spotlight: undefined };
}
