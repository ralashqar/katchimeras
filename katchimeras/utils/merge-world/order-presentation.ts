import type { MergeOrder, MergeWorldState } from '@/types/merge-world';

export type MergeOrderPresentationContext = {
  activeResidentDiscoveryId?: string | null;
  characterId?: string | null;
  exclusiveJourney?: boolean;
  focusOrderId?: string | null;
  journeyOrderIds?: ReadonlySet<string>;
};

/**
 * One current request. Keep the remaining requests in saved state so serving
 * advances the queue without regenerating the day's batch or its bonus.
 * Parcels and return notes remain presentation-specific.
 */
export function prioritizedVisibleMergeOrders(
  state: MergeWorldState,
  context: MergeOrderPresentationContext = {},
): MergeOrder[] {
  const focusedCharacterId = context.focusOrderId
    ? state.activeOrders.find((order) => order.id === context.focusOrderId)?.characterId ?? null
    : null;
  const characterId = focusedCharacterId ?? context.characterId ?? state.favouriteCharacterId;
  const families = [...new Set(state.activeOrders.map((order) => order.characterId))];
  const familyRank = (order: MergeOrder) => order.characterId === characterId ? -1 : families.indexOf(order.characterId);
  const journeyIds = [...(context.journeyOrderIds ?? [])];
  const priority = (order: MergeOrder) => {
    if (order.id.startsWith('mossprout:chapter-0:')) return 0;
    if (order.storyArcId === 'mossprout:glow-discovery') return 1;
    if (context.activeResidentDiscoveryId && order.storyArcId === context.activeResidentDiscoveryId) return 2;
    if (context.journeyOrderIds?.has(order.id)) return 3;
    if (order.storyArcId && order.storyArcId !== 'companion:daily-garden' && order.storyArcId !== 'mossprout:casual-garden') return 4;
    if (order.id.startsWith('journey-cycle:')) return 4;
    if (order.storyArcId === 'companion:daily-garden') return 5;
    if (state.mossproutDailyGardenOrders?.offeredOrderIds.includes(order.id)) return 5;
    return 6;
  };
  const position = (order: MergeOrder, sourceIndex: number) => {
    const journeyIndex = journeyIds.indexOf(order.id);
    if (journeyIndex >= 0) return journeyIndex;
    const batch = state.companionDailyGarden?.[order.characterId as 'mossprout' | 'steppling'];
    const dailyIndex = batch?.orders.findIndex((candidate) => candidate.id === order.id) ?? -1;
    if (dailyIndex >= 0) return dailyIndex;
    const legacyIndex = state.mossproutDailyGardenOrders?.offeredOrderIds.indexOf(order.id) ?? -1;
    if (legacyIndex >= 0) return legacyIndex;
    return order.storyStep ?? sourceIndex;
  };

  return state.activeOrders
    .map((order, sourceIndex) => ({ order, sourceIndex }))
    .sort((left, right) => {
      const leftPriority = priority(left.order);
      const rightPriority = priority(right.order);
      // Tutorials first, then each companion's listed requests, then free play.
      const bucket = (value: number) => value < 3 ? value : value < 6 ? 3 : 6;
      const category = bucket(leftPriority) - bucket(rightPriority);
      // Tutorials stay global. Otherwise finish the selected companion's queue,
      // including their repeatable request, before switching to another family.
      if (leftPriority >= 3 && rightPriority >= 3) {
        const selectedFamily = Number(right.order.characterId === characterId) - Number(left.order.characterId === characterId);
        if (selectedFamily) return selectedFamily;
      }
      if (category) return category;
      // Opening a later preview may choose a companion, never skip their queue.
      const family = familyRank(left.order) - familyRank(right.order);
      if (family) return family;
      const group = leftPriority - rightPriority;
      if (group) return group;
      if (leftPriority < 6) {
        return position(left.order, left.sourceIndex) - position(right.order, right.sourceIndex) || left.sourceIndex - right.sourceIndex;
      }
      return left.sourceIndex - right.sourceIndex;
    })
    .slice(0, 1)
    .map(({ order }) => order);
}
