export type OrderRequirement = {definitionId:string;quantity:number};
export type Order = {id:string;requirements:readonly OrderRequirement[]};
export type BoardCell = {occupant: {kind:'item';definitionId:string;instanceId:string} | {kind:'generator'} | null};
type MergeWorldState = {board:readonly BoardCell[];activeOrders:readonly Order[]};
type MergeOrder = Order;
export function createOrderQueries() {
const boardCountsCache = new WeakMap<MergeWorldState['board'], Map<string, number>>();
function boardItemCounts(state: MergeWorldState) {
  const cached = boardCountsCache.get(state.board);
  if (cached) return cached;
  const counts = new Map<string, number>();
  for (const cell of state.board) {
    if (cell.occupant?.kind !== 'item') continue;
    counts.set(cell.occupant.definitionId, (counts.get(cell.occupant.definitionId) ?? 0) + 1);
  }
  boardCountsCache.set(state.board, counts);
  return counts;
}

function mergeOrderReady(state: MergeWorldState, order: MergeOrder): boolean {
  return mergeOrderRequirementReadiness(state, order).every(Boolean);
}

function mergeOrderRequirementReadiness(state: MergeWorldState, order: MergeOrder): boolean[] {
  const counts = boardItemCounts(state);
  return order.requirements.map((requirement) => (counts.get(requirement.definitionId) ?? 0) >= requirement.quantity);
}

function mergeOrderItemReadiness(state: MergeWorldState, order: MergeOrder): boolean[] {
  const counts = boardItemCounts(state);
  return order.requirements.flatMap((requirement) => Array.from(
    { length: requirement.quantity },
    (_, index) => (counts.get(requirement.definitionId) ?? 0) > index,
  ));
}

function mergeOrderServingCells(state: MergeWorldState, order: MergeOrder): { cell: number; definitionId: string; instanceId: string }[] {
  const available = new Map<string, { cell: number; instanceId: string }[]>();
  state.board.forEach((cell, index) => {
    const occupant = cell.occupant;
    if (occupant?.kind !== 'item') return;
    const cells = available.get(occupant.definitionId) ?? [];
    cells.push({ cell: index, instanceId: occupant.instanceId });
    available.set(occupant.definitionId, cells);
  });
  return order.requirements.flatMap((requirement) => {
    const cells = available.get(requirement.definitionId) ?? [];
    return cells.slice(0, requirement.quantity).map((item) => ({ ...item, definitionId: requirement.definitionId }));
  });
}

function readyMergeOrderIds(state: MergeWorldState): Set<string> {
  const counts = boardItemCounts(state);
  return new Set(state.activeOrders
    .filter((order) => order.requirements.every((requirement) => (counts.get(requirement.definitionId) ?? 0) >= requirement.quantity))
    .map((order) => order.id));
}


return { mergeOrderReady, mergeOrderRequirementReadiness, mergeOrderItemReadiness, mergeOrderServingCells, readyMergeOrderIds, boardItemCounts };
}
