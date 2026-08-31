import type { MergeWorldState } from '@/types/merge-world';
import { MERGE_WORLD_COLUMNS, MERGE_WORLD_ROWS, MERGE_WORLD_SIZE } from '@/constants/merge-world-catalog';
import { createMossproutChapterZeroState } from '@/utils/merge-world/onboarding';
import { normalizeMergeWorldState } from '@/utils/merge-world/engine';

// The portrait island presents the complete canonical board. The identity
// mapping preserves every existing occupant and authored Mist cell.
export const HAVEN_MERGE_BOARD_COLUMNS = MERGE_WORLD_COLUMNS;
export const HAVEN_MERGE_BOARD_ROWS = MERGE_WORLD_ROWS;
export const HAVEN_MERGE_BOARD_CELL_INDICES = Array.from(
  { length: MERGE_WORLD_SIZE },
  (_, index) => index,
);

const HAVEN_VISIBLE_CELL_SET = new Set(HAVEN_MERGE_BOARD_CELL_INDICES);

function isolateHavenBoard(state: MergeWorldState): MergeWorldState {
  return {
    ...state,
    activeOrders: [],
    arrivals: [],
    board: state.board,
    externalRewardReceipts: [],
    recentOrderKeys: [],
    rewardInbox: [],
  };
}

export function createHavenMergeSandboxState(now = Date.now()): MergeWorldState {
  return isolateHavenBoard(createMossproutChapterZeroState(now));
}

export function normalizeHavenMergeSandboxState(value: unknown, now = Date.now()): MergeWorldState {
  return isolateHavenBoard(normalizeMergeWorldState(value, now));
}

export function havenMergeCellIsVisible(cell: number): boolean {
  return HAVEN_VISIBLE_CELL_SET.has(cell);
}
