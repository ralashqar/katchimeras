import type { MergeOrder, MergeWorldState } from '@/types/merge-world';
import type { WispId } from '@/types/wisp';

const ORDER_PREFIX = 'mossprout:chapter-0:';
const FTUE_GARDEN_GENERATOR_ID = 'wild-garden';
const FTUE_SEED_DEFINITION_ID = 'nature:garden:1';

export const MOSSPROUT_CHAPTER_ZERO_REQUESTS = [
  {
    id: `${ORDER_PREFIX}first-sprout`,
    badge: 'FIRST',
    title: 'A First Sprout',
    description: 'Merge the two Seeds Mossprout brought.',
    definitionId: 'nature:garden:2',
  },
  {
    id: `${ORDER_PREFIX}home-plant`,
    badge: 'THEN',
    title: 'A Patch of Home',
    description: 'Grow fresh Seeds, make two Sprouts, then merge them.',
    definitionId: 'nature:garden:3',
  },
  {
    id: `${ORDER_PREFIX}energy-plant`,
    badge: 'ONE MORE',
    title: 'One More Plant',
    description: 'Grow one more Plant for Mossproutâ€™s new home.',
    definitionId: 'nature:garden:3',
  },
] as const;

export function mossproutChapterZeroOrder(now: number, rewardWispId: WispId = 'sprout'): MergeOrder {
  return {
    id: MOSSPROUT_CHAPTER_ZERO_REQUESTS[0].id,
    characterId: 'mossprout',
    title: 'Something to plant',
    description: 'Drag the two matching Seeds together.',
    difficulty: 'small',
    requirements: [{ definitionId: 'nature:garden:2', quantity: 1 }],
    reward: { coins: 20, mergeXp: 15, friendshipXp: 8, energy: 0 },
    createdAt: now,
    signature: false,
    purpose: 'normal',
    storyArcId: 'mossprout-chapter-0',
  };
}

export function mossproutChapterZeroHomePlantOrder(now: number): MergeOrder {
  return {
    id: MOSSPROUT_CHAPTER_ZERO_REQUESTS[1].id,
    characterId: 'mossprout',
    title: 'A Patch of Home',
    description: 'Merge two Sprouts into a Plant.',
    difficulty: 'small',
    requirements: [{ definitionId: 'nature:garden:3', quantity: 1 }],
    reward: { coins: 30, mergeXp: 25, friendshipXp: 10, energy: 0 },
    createdAt: now,
    signature: false,
    purpose: 'normal',
    storyArcId: 'mossprout-chapter-0',
  };
}

export function mossproutChapterZeroEnergyPlantOrder(now: number, rewardWispId: WispId = 'sprout'): MergeOrder {
  return {
    id: MOSSPROUT_CHAPTER_ZERO_REQUESTS[2].id,
    characterId: 'mossprout',
    title: 'One More Plant',
    description: 'Grow one last Plant for Mossproutâ€™s home.',
    difficulty: 'small',
    requirements: [{ definitionId: 'nature:garden:3', quantity: 1 }],
    reward: { coins: 40, mergeXp: 30, friendshipXp: 16, energy: 0, wispId: rewardWispId },
    createdAt: now,
    signature: false,
    purpose: 'normal',
    chapterId: 'mossprout-chapter-0',
    storyArcId: 'mossprout-chapter-0',
  };
}

export function advanceMossproutChapterZero(state: MergeWorldState, servedOrderId: string, now: number): MergeWorldState {
  if (servedOrderId === MOSSPROUT_CHAPTER_ZERO_REQUESTS[2].id) {
    const garden = state.generators[FTUE_GARDEN_GENERATOR_ID];
    return {
      ...state,
      energy: { ...state.energy, regenPaused: false, lastRegenAt: now },
      generators: {
        ...state.generators,
        ...(garden ? { [FTUE_GARDEN_GENERATOR_ID]: { ...garden, forcedDropDefinitionId: null } } : {}),
      },
    };
  }
  if (servedOrderId === MOSSPROUT_CHAPTER_ZERO_REQUESTS[1].id) {
    return {
      ...state,
      activeOrders: [
        ...state.activeOrders,
        mossproutChapterZeroEnergyPlantOrder(now, mossproutChapterZeroRewardWisp(state)),
      ],
    };
  }
  if (servedOrderId !== MOSSPROUT_CHAPTER_ZERO_REQUESTS[0].id) return state;
  let remaining = 4;
  const board = state.board.map((cell) => {
    if (!cell.locked || remaining <= 0) return cell;
    remaining -= 1;
    return { ...cell, blocker: null, locked: false };
  });
  return {
    ...state,
    board,
    activeOrders: [
      ...state.activeOrders,
      mossproutChapterZeroHomePlantOrder(now),
    ],
  };
}

/** Repairs persisted mid-tutorial boards so the authored Seed-only drop remains enforced. */
export function enforceMossproutChapterZeroDropOverride(state: MergeWorldState): MergeWorldState {
  if (!isMossproutChapterZeroActive(state)) return state;
  const garden = state.generators[FTUE_GARDEN_GENERATOR_ID];
  if (!garden || garden.forcedDropDefinitionId === FTUE_SEED_DEFINITION_ID) return state;
  if (!garden.tierOneDropDefinitionIds.includes(FTUE_SEED_DEFINITION_ID)) return state;
  return {
    ...state,
    generators: {
      ...state.generators,
      [FTUE_GARDEN_GENERATOR_ID]: { ...garden, forcedDropDefinitionId: FTUE_SEED_DEFINITION_ID },
    },
  };
}

function mossproutChapterZeroRewardWisp(state: MergeWorldState): WispId {
  const receipt = state.recentOrderKeys.find((key) => key.startsWith('ftue-wisp:'));
  return (receipt?.slice('ftue-wisp:'.length) || 'sprout') as WispId;
}

export function isMossproutChapterZeroActive(state: MergeWorldState) {
  return state.activeOrders.some((order) => order.id.startsWith(ORDER_PREFIX));
}
