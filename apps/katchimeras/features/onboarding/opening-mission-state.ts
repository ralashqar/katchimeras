import type { MergeWorldState } from '@/types/merge-world';
import { createMossproutOpeningState } from '@/utils/merge-world/onboarding';
import { OPENING_MERGE_WINDOW_CELLS } from './opening-mist';

/**
 * The opening's mission board is its own board, not a window into the
 * persistent one: it has its own state and its own storage, so nothing the
 * persistent board does between sessions can change what the opening shows,
 * and nothing the opening does leaves anything on the persistent board.
 * Clearing the mist is a self-contained mini-game.
 *
 * The engine still reasons about a 7×9 grid, so the mission state is a full
 * board with only the 5×4 window open and populated; everything outside the
 * window is empty and never drawn.
 */
export const OPENING_MISSION_STORAGE_KEY = 'katchimeras.opening-mission.v1';

export type StoredOpeningMission = { runId: string; state: MergeWorldState };

export function createOpeningMissionState(now = Date.now()): MergeWorldState {
  const base = createMossproutOpeningState(now);
  const window = new Set(OPENING_MERGE_WINDOW_CELLS);
  const board = base.board.map((cell, index) => (window.has(index) ? cell : { ...cell, occupant: null }));
  return {
    ...base,
    board,
    // No Basket, no orders, no echoes to wake: the mission is the placed pieces and nothing else.
    generators: {},
    activeOrders: [],
    arrivals: [],
    rewardInbox: [],
  };
}
