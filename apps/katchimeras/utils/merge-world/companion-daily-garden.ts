import { COMPANION_JOURNEY_PROFILES } from '@/constants/companion-journey-profiles';
import { GENERATOR_BY_CHAIN, KATCHIMERA_MERGE_PROFILES, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { MergeOrder, MergeWorldState } from '@/types/merge-world';
import { localDayId } from '@/utils/world-identity-rules';

export type DailyGardenFamily = 'mossprout' | 'steppling';
export type CompanionDailyGardenBatch = {
  dayId: string;
  orders: MergeOrder[];
  served: Record<string, number>;
  bonusReceiptId: string | null;
};
export const DAILY_GARDEN_GLOW = 8;
export const DAILY_GARDEN_BONUS = 8;
export const DAILY_GARDEN_ARC = 'companion:daily-garden';

/** Orders are frozen against the generators actually owned when the batch opens. */
export function ensureCompanionDailyGarden(state: MergeWorldState, familyId: DailyGardenFamily, now: number): MergeWorldState {
  const dayId = localDayId(new Date(now));
  if (!state.unlockedCharacters.includes(familyId)) return state;
  const previous = state.companionDailyGarden?.[familyId];
  if (previous?.dayId === dayId) {
    const missing = previous.orders.filter((order) => previous.served[order.id] == null && !state.activeOrders.some((item) => item.id === order.id));
    return missing.length ? { ...state, activeOrders: [...state.activeOrders, ...missing] } : state;
  }
  // Existing players finish the already offered legacy batch on its original day.
  if (!previous && familyId === 'mossprout' && state.mossproutDailyGardenOrders?.dayId === dayId) return state.companionDailyGardenVersion ? state : { ...state, companionDailyGardenVersion: 1 };
  const chains = KATCHIMERA_MERGE_PROFILES[familyId].coreChains.filter((chain) => {
    const generator = state.generators[GENERATOR_BY_CHAIN[chain]] ?? (familyId === 'steppling' ? state.haven.residentMergeBoards.steppling?.generators[GENERATOR_BY_CHAIN[chain]] : undefined);
    const drops = generator?.forcedDropDefinitionId ? [generator.forcedDropDefinitionId] : generator?.tierOneDropDefinitionIds ?? [];
    return drops.some((id) => id.startsWith(`${chain}:`));
  });
  if (!chains.length) return state;
  const progress = familyId === 'mossprout' ? state.mossproutBoardProgression.activeDayIds.length : state.characterProgress.steppling?.friendshipLevel ?? 1;
  const band = progress >= 12 ? 2 : progress >= 4 ? 1 : 0;
  const shift = [...dayId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % chains.length;
  const primary = chains[shift]!;
  const secondary = chains[(shift + 1) % chains.length]!;
  const tier = (chain: typeof primary, desired: number) => {
    while (desired > 1 && !MERGE_ITEMS_BY_ID.has(`${chain}:${desired}`)) desired--;
    return `${chain}:${desired}`;
  };
  const combo = [{ definitionId: tier(primary, 3 + band), quantity: 1 }, { definitionId: tier(secondary, band === 2 ? 4 : 3), quantity: 1 }];
  const combined = combo[0].definitionId === combo[1].definitionId ? [{ definitionId: combo[0].definitionId, quantity: 2 }] : combo;
  const requirements = [combined, [{ definitionId: tier(primary, 4 + band), quantity: 1 }]];
  const orders: MergeOrder[] = requirements.map((items, index) => ({
    id: `daily-garden:${familyId}:${dayId}:${index + 1}`, characterId: familyId,
    title: COMPANION_JOURNEY_PROFILES[familyId]!.dailyGardenTitles[index]!,
    description: 'Today’s garden · new requests each day', difficulty: index === 0 ? 'medium' : 'major',
    requirements: items, reward: { coins: DAILY_GARDEN_GLOW, mergeXp: 0, friendshipXp: 0, energy: 0 },
    createdAt: now, signature: false, purpose: 'normal', storyArcId: DAILY_GARDEN_ARC, storyBeatId: dayId,
  }));
  const served = Object.fromEntries(orders.flatMap((order) => {
    const receipt = state.externalRewardReceipts.find((item) => item.id === `merge-story-served:${order.id}`);
    return receipt ? [[order.id, receipt.createdAt]] : [];
  }));
  const bonusId = `daily-garden-bonus:${familyId}:${dayId}`;
  const bonusReceiptId = state.processedActivityReceiptIds.includes(bonusId) ? bonusId : null;
  return { ...state, companionDailyGardenVersion: 1,
    companionDailyGarden: { ...state.companionDailyGarden, [familyId]: { dayId, orders, served, bonusReceiptId } },
    activeOrders: [...state.activeOrders.filter((order) => order.characterId !== familyId || (order.storyArcId !== DAILY_GARDEN_ARC && order.storyArcId !== 'mossprout:casual-garden')), ...orders.filter((order) => served[order.id] == null)],
  };
}

/** Called in the same board transaction as item consumption and the order reward. */
export function completeDailyGardenOrder(state: MergeWorldState, order: MergeOrder, now: number): MergeWorldState {
  const familyId = order.characterId as DailyGardenFamily;
  const batch = state.companionDailyGarden?.[familyId];
  if (!batch || !batch.orders.some((item) => item.id === order.id) || batch.served[order.id] != null) return state;
  const served = { ...batch.served, [order.id]: now };
  const bonus = !batch.bonusReceiptId && batch.orders.every((item) => served[item.id] != null);
  return { ...state, coins: state.coins + (bonus ? DAILY_GARDEN_BONUS : 0),
    processedActivityReceiptIds: bonus ? [...state.processedActivityReceiptIds, `daily-garden-bonus:${familyId}:${batch.dayId}`] : state.processedActivityReceiptIds,
    companionDailyGarden: { ...state.companionDailyGarden, [familyId]: { ...batch, served,
      bonusReceiptId: bonus ? `daily-garden-bonus:${familyId}:${batch.dayId}` : batch.bonusReceiptId } },
    externalRewardReceipts: [...state.externalRewardReceipts, { id: `merge-story-served:${order.id}`, kind: 'story_order_served', characterId: familyId, amount: 0, sourceId: DAILY_GARDEN_ARC, createdAt: now, appliedAt: null }],
  };
}
