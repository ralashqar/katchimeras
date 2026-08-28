import type { MergeOrder, MergeWorldState } from '@/types/merge-world';

export type MergeOrderPresentationContext = {
  activeResidentDiscoveryId?: string | null;
  exclusiveJourney?: boolean;
  focusOrderId?: string | null;
  journeyOrderIds?: ReadonlySet<string>;
};

/**
 * Canonical ordering shared by the dedicated Merge rail and compact Haven
 * order islands. Non-order rail entries (parcels and return notes) deliberately
 * remain presentation-specific.
 */
export function prioritizedVisibleMergeOrders(
  state: MergeWorldState,
  context: MergeOrderPresentationContext = {},
): MergeOrder[] {
  const chapterZeroOrders = state.activeOrders.filter((order) => order.id.startsWith('mossprout:chapter-0:'));
  const visibleOrders = chapterZeroOrders.length > 0
    ? chapterZeroOrders.slice(0, 1)
    : context.exclusiveJourney
      ? state.activeOrders.filter((order) => (
          context.journeyOrderIds?.has(order.id)
          || order.storyArcId === context.activeResidentDiscoveryId
        ))
      : state.activeOrders;
  const focusCharacterId = context.focusOrderId
    ? state.activeOrders.find((order) => order.id === context.focusOrderId)?.characterId ?? null
    : null;
  const featured = state.favouriteCharacterId;

  return visibleOrders
    .map((order, sourceIndex) => ({ order, sourceIndex }))
    .sort((left, right) => {
      const priority = (order: MergeOrder) => {
        if (context.focusOrderId && order.id === context.focusOrderId) return 0;
        if (focusCharacterId && order.characterId === focusCharacterId) return 1;
        if (featured && order.characterId === featured) return focusCharacterId ? 2 : 0;
        return focusCharacterId ? 3 : 1;
      };
      return priority(left.order) - priority(right.order) || left.sourceIndex - right.sourceIndex;
    })
    .map(({ order }) => order);
}
