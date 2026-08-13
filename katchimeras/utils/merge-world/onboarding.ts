import { MERGE_GENERATORS_BY_ID, MERGE_STARTING_OPEN_CELLS, MERGE_WORLD_SIZE } from '@/constants/merge-world-catalog';
import type { MergeBoardCell, MergeWorldState } from '@/types/merge-world';
import type { WispId } from '@/types/wisp';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { mossproutChapterZeroOrder } from '@/utils/merge-world/chapter-zero-policy';

const TUTORIAL_OPEN_CELLS = new Set([...MERGE_STARTING_OPEN_CELLS].slice(0, 18));

export function createMossproutChapterZeroState(now = Date.now(), rewardWispId: WispId = 'sprout'): MergeWorldState {
  let state = reduceMergeWorld(createInitialMergeWorldState(now), { type: 'reconcileCharacters', characterIds: ['mossprout'], now }).state;
  const garden = MERGE_GENERATORS_BY_ID.get('wild-garden')!;
  const board: MergeBoardCell[] = Array.from({ length: MERGE_WORLD_SIZE }, (_, index) => ({
    locked: !TUTORIAL_OPEN_CELLS.has(index),
    blocker: TUTORIAL_OPEN_CELLS.has(index) ? null : 'clouds',
    occupant: null,
  }));
  const open = [...TUTORIAL_OPEN_CELLS];
  board[open[0]].occupant = { kind: 'generator', generatorId: garden.id };
  board[open[1]].occupant = { kind: 'item', instanceId: 'onboarding-seed-a', definitionId: 'nature:garden:1' };
  board[open[2]].occupant = { kind: 'item', instanceId: 'onboarding-seed-b', definitionId: 'nature:garden:1' };
  return {
    ...state,
    board,
    generators: { [garden.id]: { id: garden.id, name: garden.name, level: 1, upgradeFragments: 0, chainIds: garden.chainIds, tierOneDropDefinitionIds: ['nature:garden:1', 'nature:garden:1'] } },
    energy: { value: 50, regenCap: 50, lastRegenAt: now },
    coins: 100,
    discoveries: ['nature:garden:1'],
    unlockedFamilies: ['nature'],
    unlockedChains: ['nature:garden'],
    unlockedCharacters: ['mossprout'],
    favouriteCharacterId: 'mossprout',
    activeOrders: [mossproutChapterZeroOrder(now, rewardWispId)],
    completedOrderCount: 0,
    recentOrderKeys: [`ftue-wisp:${rewardWispId}`],
    expansions: [],
    processedActivityReceiptIds: [],
    activityEnergyByDay: {},
  };
}
