import { MERGE_GENERATORS, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { MergeOrder, MergeWorldState } from '@/types/merge-world';
import { openDefinitionFor } from './generator-branches';

const spawnableTierOneIds = new Set(MERGE_GENERATORS.flatMap((generator) =>
  generator.tierOneDropDefinitionIds.filter((id) => MERGE_ITEMS_BY_ID.get(id)?.tier === 1)));

/**
 * When a closed branch collapses onto its basket's other chain, a request
 * that named two different chains at the same tier collides into two lines
 * of the identical item. Prefer a different tier of that chain instead —
 * one tier up if the chain reaches that far, else one down — so the order
 * still reads as two distinct things to bring, not "2 of the same tier".
 * Only true duplicates (the request already asked for this exact item) fall
 * back to combining into one line with the summed quantity.
 */
function distinctTierNearby(definitionId: string, taken: ReadonlySet<string>): string | null {
  const item = MERGE_ITEMS_BY_ID.get(definitionId);
  if (!item) return null;
  for (const tier of [item.tier + 1, item.tier - 1]) {
    const candidate = `${item.chainId}:${tier}`;
    if (tier >= 1 && MERGE_ITEMS_BY_ID.has(candidate) && !taken.has(candidate)) return candidate;
  }
  return null;
}

/**
 * No request may name a chain this world cannot make yet. Authored beats and
 * procedural batches alike are routed onto the founding chain of the same
 * basket, which also repairs saves written before a branch had a gate.
 */
export function openOrderChains(state: Pick<MergeWorldState, 'unlockedCharacters'>, order: MergeOrder): MergeOrder {
  const requirements: MergeOrder['requirements'] = [];
  const taken = new Set<string>();
  let rewritten = false;
  for (const item of order.requirements) {
    let definitionId = openDefinitionFor(state, item.definitionId);
    const wasRewritten = definitionId !== item.definitionId;
    if (wasRewritten) rewritten = true;
    if (taken.has(definitionId)) {
      // Only a genuine chain swap earns a nearby-tier substitute; an order
      // that already asked for the same item twice keeps meaning that.
      const varied = wasRewritten ? distinctTierNearby(definitionId, taken) : null;
      if (varied) { definitionId = varied; rewritten = true; }
    }
    const existing = requirements.find((candidate) => candidate.definitionId === definitionId);
    if (existing) {
      existing.quantity += item.quantity;
      rewritten = true;
    } else requirements.push({ ...item, definitionId });
    taken.add(definitionId);
  }
  return rewritten ? { ...order, requirements } : order;
}

/** Every ordinary request must include a merge result, not only generator drops. */
export function ensureOrderRequiresMerge(order: MergeOrder): MergeOrder {
  if (!order.requirements.length || !order.requirements.every((item) => spawnableTierOneIds.has(item.definitionId))) return order;
  const first = order.requirements[0];
  const nextId = MERGE_ITEMS_BY_ID.get(first.definitionId)?.nextItemId;
  if (!nextId || !MERGE_ITEMS_BY_ID.has(nextId)) return order;
  return { ...order, requirements: [{ ...first, definitionId: nextId }, ...order.requirements.slice(1)] };
}

/**
 * Runs on every single command, live during play — never route a per-state
 * scan like `openOrderChains` through here. Even a scan that settles after
 * one pass still means every companion's orders get walked on every tap,
 * and any command that only settles (never actually changes anything) still
 * forces `reduceMergeWorld` to report `changed: true` — a false "something
 * happened" signal to whatever is watching for real player actions. Chain
 * repair belongs at load, in `normalizeMergeWorldState`, run once per open —
 * see `repairOrderChains` below.
 */
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

/**
 * The one-time repair: run only when a save is loaded (`normalizeMergeWorldState`),
 * not on every command. Fixes any order left over from before a branch had a
 * gate, or from a branch that has since closed again in some other way.
 */
export function repairOrderChains(state: MergeWorldState): MergeWorldState {
  const settle = (order: MergeOrder) => openOrderChains(state, order);
  const activeOrders = state.activeOrders.map(settle);
  let changed = activeOrders.some((order, index) => order !== state.activeOrders[index]);
  let companionDailyGarden = state.companionDailyGarden;
  for (const familyId of ['mossprout', 'steppling'] as const) {
    const batch = companionDailyGarden?.[familyId];
    if (!batch) continue;
    const orders = batch.orders.map((order) => batch.served[order.id] != null ? order : settle(order));
    if (orders.some((order, index) => order !== batch.orders[index])) {
      companionDailyGarden = { ...companionDailyGarden, [familyId]: { ...batch, orders } };
      changed = true;
    }
  }
  return changed ? { ...state, activeOrders, companionDailyGarden } : state;
}
