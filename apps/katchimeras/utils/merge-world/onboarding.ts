import { MERGE_GENERATORS_BY_ID, MERGE_WORLD_SIZE, MOSSPROUT_DREAM_ECHOES, MOSSPROUT_FTUE_OPEN_CELLS } from '@/constants/merge-world-catalog';
import type { MergeBoardCell, MergeWorldState } from '@/types/merge-world';
import type { WispId } from '@/types/wisp';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { mossproutChapterZeroOrder } from '@/utils/merge-world/chapter-zero-policy';
import { authoredDormantMistForCell } from '@/utils/merge-world/board-mist-progression';

export function createMossproutChapterZeroState(now = Date.now(), rewardWispId: WispId = 'sprout'): MergeWorldState {
  let state = reduceMergeWorld(createInitialMergeWorldState(now), { type: 'reconcileCharacters', characterIds: ['mossprout'], now }).state;
  const garden = MERGE_GENERATORS_BY_ID.get('wild-garden')!;
  const board: MergeBoardCell[] = Array.from({ length: MERGE_WORLD_SIZE }, (_, index) => ({
    locked: !MOSSPROUT_FTUE_OPEN_CELLS.has(index),
    blocker: MOSSPROUT_FTUE_OPEN_CELLS.has(index) ? null : 'clouds',
    regionId: MOSSPROUT_FTUE_OPEN_CELLS.has(index) ? 'central-clearing' : 'inner-mist',
    mist: MOSSPROUT_FTUE_OPEN_CELLS.has(index) ? null : authoredDormantMistForCell(index),
    occupant: null,
  }));
  board[31].occupant = { kind: 'generator', generatorId: garden.id };
  board[29].occupant = { kind: 'item', instanceId: 'onboarding-seed-a', definitionId: 'nature:garden:1' };
  board[30].occupant = { kind: 'item', instanceId: 'onboarding-seed-b', definitionId: 'nature:garden:1' };
  board[32].occupant = { kind: 'item', instanceId: 'onboarding-seed-c', definitionId: 'nature:garden:1' };
  board[33].occupant = { kind: 'item', instanceId: 'onboarding-seed-d', definitionId: 'nature:garden:1' };
  for (const echo of MOSSPROUT_DREAM_ECHOES) {
    board[echo.cell] = {
      ...board[echo.cell],
      regionId: 'inner-mist',
      mist: { kind: 'echo', id: echo.id, definitionId: echo.definitionId, ownerCharacterId: 'mossprout' },
    };
  }
  return {
    ...state,
    board,
    generators: { [garden.id]: {
      id: garden.id, name: garden.name, level: 1, upgradeFragments: 0,
      chainIds: garden.chainIds, tierOneDropDefinitionIds: [...garden.tierOneDropDefinitionIds],
      forcedDropDefinitionId: 'nature:garden:1', capacity: 12, charges: 12,
      restDurationMs: 18 * 60_000, restStartedAt: null,
    } },
    energy: { value: 0, regenCap: 0, lastRegenAt: now, regenPaused: false },
    coins: 0,
    discoveries: ['nature:garden:1'],
    unlockedFamilies: ['nature'],
    unlockedChains: ['nature:garden'],
    unlockedCharacters: ['mossprout'],
    companionDiscovery: {
      records: [{
        characterId: 'mossprout', source: 'ftue_hatch', gateId: 'gate-1-mossprout', pathId: null,
        discoveredAt: now, revealSeenAt: now, firstOrderCompletedAt: now, permanentFeatureId: 'wild-garden',
      }],
      openedGateIds: ['gate-1-mossprout'],
      completedGateIds: ['gate-1-mossprout'],
      queuedGateIds: [],
      active: null,
      lastStartedDayId: null,
      events: [],
    },
    favouriteCharacterId: 'mossprout',
    activeOrders: [mossproutChapterZeroOrder(now, rewardWispId)],
    completedOrderCount: 0,
    recentOrderKeys: [`ftue-wisp:${rewardWispId}`],
    expansions: [],
    unlockedRegions: ['central-clearing', 'inner-mist'],
    boardAwakeningReceipts: [],
    processedActivityReceiptIds: [],
    activityEnergyByDay: {},
  };
}

/**
 * The mist-veiled opening's board: the Chapter 0 board with eight Seeds and
 * two Sprouts placed inside the docked 5×4 window (columns 1–5, rows 2–5).
 * Merging everything that is placed makes exactly eight merges and leaves one
 * Plant (for "The First Bloom") and one Flower. The Basket stays as slack.
 *
 * The window shows plain cells only: its three misted cells open with the
 * clearing, and the four dream echoes that sat inside it move to free cells
 * just above and below it, where the full Merge page still finds them.
 */
export const MOSSPROUT_OPENING_SEED_CELLS: readonly number[] = [16, 17, 18, 22, 29, 30, 32, 33];
export const MOSSPROUT_OPENING_SPROUT_CELLS: readonly number[] = [24, 36];
export const MOSSPROUT_OPENING_WINDOW_CELLS: readonly number[] = [15, 16, 17, 18, 19, 22, 23, 24, 25, 26, 29, 30, 31, 32, 33, 36, 37, 38, 39, 40];
const OPENING_ECHO_CELLS: Record<number, number> = { 23: 9, 25: 10, 37: 11, 39: 47 };

export function createMossproutOpeningState(now = Date.now(), rewardWispId: WispId = 'sprout'): MergeWorldState {
  const state = createMossproutChapterZeroState(now, rewardWispId);
  const board = state.board.map((cell) => (cell.occupant?.kind === 'item' ? { ...cell, occupant: null } : cell));
  for (const [from, to] of Object.entries(OPENING_ECHO_CELLS).map(([from, to]) => [Number(from), to] as const)) {
    board[to] = { ...board[to], locked: false, blocker: null, regionId: 'inner-mist', mist: board[from].mist, occupant: null };
  }
  for (const cell of MOSSPROUT_OPENING_WINDOW_CELLS) {
    if (cell === 31) continue;
    board[cell] = { ...board[cell], locked: false, blocker: null, regionId: 'central-clearing', mist: null, occupant: null };
  }
  const legacyIds: Record<number, string> = { 29: 'onboarding-seed-a', 30: 'onboarding-seed-b', 32: 'onboarding-seed-c', 33: 'onboarding-seed-d' };
  MOSSPROUT_OPENING_SEED_CELLS.forEach((cell, index) => {
    board[cell] = { ...board[cell], occupant: { kind: 'item', instanceId: legacyIds[cell] ?? `opening-seed-${index}`, definitionId: 'nature:garden:1' } };
  });
  MOSSPROUT_OPENING_SPROUT_CELLS.forEach((cell, index) => {
    board[cell] = { ...board[cell], occupant: { kind: 'item', instanceId: `opening-sprout-${index}`, definitionId: 'nature:garden:2' } };
  });
  return { ...state, board };
}
