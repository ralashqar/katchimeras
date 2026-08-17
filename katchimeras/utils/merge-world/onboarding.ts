import { MERGE_GENERATORS_BY_ID, MERGE_WORLD_SIZE, MOSSPROUT_DREAM_ECHOES, MOSSPROUT_FTUE_OPEN_CELLS } from '@/constants/merge-world-catalog';
import type { MergeBoardCell, MergeWorldState } from '@/types/merge-world';
import type { WispId } from '@/types/wisp';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { mossproutChapterZeroOrder } from '@/utils/merge-world/chapter-zero-policy';

export function createMossproutChapterZeroState(now = Date.now(), rewardWispId: WispId = 'sprout'): MergeWorldState {
  let state = reduceMergeWorld(createInitialMergeWorldState(now), { type: 'reconcileCharacters', characterIds: ['mossprout'], now }).state;
  const garden = MERGE_GENERATORS_BY_ID.get('wild-garden')!;
  const board: MergeBoardCell[] = Array.from({ length: MERGE_WORLD_SIZE }, (_, index) => ({
    locked: !MOSSPROUT_FTUE_OPEN_CELLS.has(index),
    blocker: MOSSPROUT_FTUE_OPEN_CELLS.has(index) ? null : 'clouds',
    regionId: MOSSPROUT_FTUE_OPEN_CELLS.has(index) ? 'central-clearing' : 'inner-mist',
    mist: MOSSPROUT_FTUE_OPEN_CELLS.has(index) ? null : { kind: 'dormant' },
    occupant: null,
  }));
  board[31].occupant = { kind: 'generator', generatorId: garden.id };
  board[30].occupant = { kind: 'item', instanceId: 'onboarding-seed-a', definitionId: 'nature:garden:1' };
  board[32].occupant = { kind: 'item', instanceId: 'onboarding-seed-b', definitionId: 'nature:garden:1' };
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
    generators: { [garden.id]: { id: garden.id, name: garden.name, level: 1, upgradeFragments: 0, chainIds: garden.chainIds, tierOneDropDefinitionIds: [...garden.tierOneDropDefinitionIds], forcedDropDefinitionId: 'nature:garden:1' } },
    energy: { value: 4, regenCap: 50, lastRegenAt: now, regenPaused: true },
    coins: 100,
    discoveries: ['nature:garden:1'],
    unlockedFamilies: ['nature'],
    unlockedChains: ['nature:garden'],
    unlockedCharacters: ['mossprout'],
    companionDiscovery: {
      records: [{
        characterId: 'mossprout', source: 'ftue_hatch', gateId: 'gate-1-mossprout', pathId: null,
        discoveredAt: now, revealSeenAt: now, permanentFeatureId: 'wild-garden',
      }],
      openedGateIds: ['gate-1-mossprout'],
      completedGateIds: ['gate-1-mossprout'],
      queuedGateIds: [],
      active: null,
      lastStartedDayId: null,
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
