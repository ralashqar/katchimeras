import { MERGE_GENERATORS, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { MergeOrder, MergeWorldState } from '@/types/merge-world';

const spawnableTierOneIds = new Set(MERGE_GENERATORS.flatMap((generator) =>
  generator.tierOneDropDefinitionIds.filter((id) => MERGE_ITEMS_BY_ID.get(id)?.tier === 1)));

/** Every ordinary request must include a merge result, not only generator drops. */
export function ensureOrderRequiresMerge(order: MergeOrder): MergeOrder {
  if (!order.requirements.length || !order.requirements.every((item) => spawnableTierOneIds.has(item.definitionId))) return order;
  const first = order.requirements[0];
  const nextId = MERGE_ITEMS_BY_ID.get(first.definitionId)?.nextItemId;
  if (!nextId || !MERGE_ITEMS_BY_ID.has(nextId)) return order;
  return { ...order, requirements: [{ ...first, definitionId: nextId }, ...order.requirements.slice(1)] };
}

export function ensureOrdersRequireMerge(state: MergeWorldState): MergeWorldState {
  const activeOrders = state.activeOrders.map(ensureOrderRequiresMerge);
  let changed = activeOrders.some((order, index) => order !== state.activeOrders[index]);
  let companionDailyGarden = state.companionDailyGarden;
  for (const familyId of ['mossprout', 'steppling'] as const) {
    const batch = companionDailyGarden?.[familyId];
    if (!batch) continue;
    const orders = batch.orders.map((order) => batch.served[order.id] != null ? order : ensureOrderRequiresMerge(order));
    if (orders.some((order, index) => order !== batch.orders[index])) {
      companionDailyGarden = { ...companionDailyGarden, [familyId]: { ...batch, orders } };
      changed = true;
    }
  }
  return changed ? { ...state, activeOrders, companionDailyGarden } : state;
}
