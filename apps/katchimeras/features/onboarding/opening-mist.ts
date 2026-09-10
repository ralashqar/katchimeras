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

/** Merges that fill the bar. Eight is what the opening board can make from its placed pieces. */
export const OPENING_MERGE_REQUIRED = 8;
/** The first merges keep the authored spotlight and finger; after that the board is free. */
export const OPENING_GUIDED_MERGES = 2;
/**
 * The opening camera: Mossprout's veiled tile close, its resting marker
 * sitting just above the "Clear the Mist" bar, the board beneath.
 */
export const OPENING_CAMERA_ZOOM = 0.81;
export const OPENING_CAMERA_ANCHOR_Y = 0.36;
/** The first beat starts a little further out and glides in while the captions run. */
export const OPENING_CAMERA_ENTRY_ZOOM = 0.67;

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
  baseArtOpacity: 0,
  contentInset: 6,
} as const;

function pairExists(state: MergeWorldState, cells: readonly number[]) {
  const counts = new Map<string, number>();
  for (const index of cells) {
    const cell = state.board[index];
    if (!cell || cell.locked || cell.mist || cell.occupant?.kind !== 'item') continue;
    counts.set(cell.occupant.definitionId, (counts.get(cell.occupant.definitionId) ?? 0) + 1);
  }
  return [...counts.values()].some((count) => count >= 2);
}

/**
 * The beat the docked board projects. The authored step (spotlight and finger
 * on the first pair) for the first guided merges, then the same step with its
 * guidance removed so the board is free; when the window holds nothing that
 * can be merged before the bar is full (a kill left the board one merge ahead
 * of the checkpoint), the Basket refills it. The refill is a merge-surface
 * step so the board's gates and finger apply to it.
 */
export function openingMistBoardStep(
  authored: FtueStepDefinition | null,
  state: MergeWorldState | null,
  count: number,
): FtueStepDefinition | null {
  if (!authored || !state) return authored;
  if (count >= OPENING_MERGE_REQUIRED || pairExists(state, OPENING_MERGE_WINDOW_CELLS)) {
    if (count < OPENING_GUIDED_MERGES || (!authored.cue && !authored.spotlight)) return authored;
    return { ...authored, cue: undefined, spotlight: undefined };
  }
  const basket = state.board.findIndex((cell) => cell.occupant?.kind === 'generator' && cell.occupant.generatorId === 'wild-garden');
  if (basket < 0 || !OPENING_MERGE_WINDOW_CELLS.includes(basket)) return authored;
  const target: FtueTarget = { kind: 'board_generator', generatorId: 'wild-garden' };
  if (!OPENING_MERGE_WINDOW_CELLS.some((index) => { const cell = state.board[index]; return cell && !cell.locked && !cell.mist && !cell.occupant; })) return {
    id: `${authored.id}.refill`, surface: 'merge', actions: [],
    guide: { eyebrow: 'A little room', title: 'Make space first.', body: 'Merge two of the same, then we’ll continue.' },
  };
  return {
    id: `${authored.id}.refill`, surface: 'merge', actions: [],
    guide: { eyebrow: 'Making light', title: 'Nothing left to pair. Tap the Basket.', body: 'It grows another Seed.' },
    cue: { kind: 'tap', target }, spotlight: { targets: [target] },
    interaction: { mode: 'exclusive', allowed: { kind: 'generator_tap', target } },
  };
}
