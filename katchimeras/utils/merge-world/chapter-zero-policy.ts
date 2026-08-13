import type { MergeOrder, MergeWorldState } from '@/types/merge-world';
import type { WispId } from '@/types/wisp';

const ORDER_PREFIX = 'mossprout:chapter-0:';

export function mossproutChapterZeroOrder(now: number, rewardWispId: WispId = 'sprout'): MergeOrder {
  return {
    id: `${ORDER_PREFIX}first-sprout`,
    characterId: 'mossprout',
    title: 'Something to plant',
    description: 'Drag the two matching Seeds together.',
    difficulty: 'small',
    requirements: [{ definitionId: 'nature:garden:2', quantity: 1 }],
    reward: { coins: 40, mergeXp: 30, friendshipXp: 16, energy: 0, wispId: rewardWispId },
    createdAt: now,
    signature: false,
    purpose: 'normal',
    chapterId: 'mossprout-chapter-0',
    storyArcId: 'mossprout-chapter-0',
  };
}

export function advanceMossproutChapterZero(state: MergeWorldState, servedOrderId: string, _now: number): MergeWorldState {
  if (servedOrderId !== `${ORDER_PREFIX}first-sprout`) return state;
  let remaining = 4;
  const board = state.board.map((cell) => {
    if (!cell.locked || remaining <= 0) return cell;
    remaining -= 1;
    return { ...cell, blocker: null, locked: false };
  });
  return {
    ...state,
    board,
    activeOrders: state.activeOrders,
  };
}

export function isMossproutChapterZeroActive(state: MergeWorldState) {
  return state.activeOrders.some((order) => order.id.startsWith(ORDER_PREFIX));
}
