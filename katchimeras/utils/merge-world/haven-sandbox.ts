import type { MergeWorldState } from '@/types/merge-world';
import { MERGE_WORLD_COLUMNS } from '@/constants/merge-world-catalog';
import { createMossproutChapterZeroState } from '@/utils/merge-world/onboarding';
import { normalizeMergeWorldState } from '@/utils/merge-world/engine';

const HAVEN_VISIBLE_ROWS = [1, 2, 3, 4, 5, 6] as const;
const HAVEN_VISIBLE_COLUMNS = [0, 1, 2, 3, 4, 5, 6] as const;

// Preserve the same 42 persisted cells in their native seven-cell row order.
// The broad island uses the resulting seven-column, six-row composition.
export const HAVEN_MERGE_BOARD_COLUMNS = 7;
export const HAVEN_MERGE_BOARD_ROWS = 6;
export const HAVEN_MERGE_BOARD_CELL_INDICES = HAVEN_VISIBLE_ROWS.flatMap((row) => (
  HAVEN_VISIBLE_COLUMNS.map((column) => row * MERGE_WORLD_COLUMNS + column)
));

const HAVEN_VISIBLE_CELL_SET = new Set(HAVEN_MERGE_BOARD_CELL_INDICES);

function isolateHavenBoard(state: MergeWorldState): MergeWorldState {
  return {
    ...state,
    activeOrders: [],
    arrivals: [],
    board: state.board.map((cell, index) => HAVEN_VISIBLE_CELL_SET.has(index) ? cell : ({
      ...cell,
      blocker: 'clouds' as const,
      locked: true,
      occupant: null,
    })),
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
