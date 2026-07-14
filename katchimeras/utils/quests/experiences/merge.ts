export type MergePackId = 'feastle-kitchen';
export type MergeChainId = 'pasta' | 'stew' | 'dessert';
export const MERGE_BOARD_COLUMNS = 6;
export const MERGE_BOARD_ROWS = 6;
export const MERGE_BOARD_SIZE = MERGE_BOARD_COLUMNS * MERGE_BOARD_ROWS;

export type MergeBoardHitTest = {
  absoluteX: number;
  absoluteY: number;
  boardX: number;
  boardY: number;
  boardWidth: number;
  boardHeight: number;
  inset: number;
  gap: number;
  cellSize: number;
};

/** Maps a finger's screen position to the nearest cell, while rejecting drops outside the board. */
export function mergeBoardCellFromPoint({
  absoluteX,
  absoluteY,
  boardX,
  boardY,
  boardWidth,
  boardHeight,
  inset,
  gap,
  cellSize,
}: MergeBoardHitTest): number | null {
  const localX = absoluteX - boardX;
  const localY = absoluteY - boardY;
  if (localX < 0 || localY < 0 || localX >= boardWidth || localY >= boardHeight) return null;

  const pitch = cellSize + gap;
  const column = Math.max(0, Math.min(
    MERGE_BOARD_COLUMNS - 1,
    Math.round((localX - inset - cellSize / 2) / pitch),
  ));
  const row = Math.max(0, Math.min(
    MERGE_BOARD_ROWS - 1,
    Math.round((localY - inset - cellSize / 2) / pitch),
  ));
  return row * MERGE_BOARD_COLUMNS + column;
}

export type MergeItemDefinition = {
  id: string;
  chainId: MergeChainId;
  tier: 1 | 2 | 3 | 4 | 5;
  name: string;
  artKey: string;
};

export type MergeBoardItem = {
  instanceId: string;
  definitionId: string;
};

export type MergeOrder = {
  id: string;
  targetId: string;
  completed: boolean;
};

export type MergeRoundConfig = {
  packId: MergePackId;
  tier: 1 | 2 | 3;
  orderCount: 2;
  targetTiers: [number, number];
  initialItemCount: number;
  moveBudget: number;
};

export type MergeRoundState = {
  board: (MergeBoardItem | null)[];
  pantry: MergeBoardItem[];
  orders: MergeOrder[];
  movesUsed: number;
  mergeCount: number;
  highestTier: number;
  status: 'playing' | 'won' | 'lost';
  nextInstance: number;
};

export type MergeAction =
  | { type: 'spawn'; cell: number }
  | { type: 'move'; from: number; to: number }
  | { type: 'serve'; cell: number; orderId: string };

const ITEMS: MergeItemDefinition[] = [
  ['pasta', 1, 'Wheat', 'wheat'],
  ['pasta', 2, 'Flour', 'flour'],
  ['pasta', 3, 'Dough', 'dough'],
  ['pasta', 4, 'Fresh noodles', 'noodles'],
  ['pasta', 5, 'Feastle pasta', 'pasta'],
  ['stew', 1, 'Carrot', 'carrot'],
  ['stew', 2, 'Chopped vegetables', 'vegetables'],
  ['stew', 3, 'Broth', 'broth'],
  ['stew', 4, 'Soup pot', 'soup-pot'],
  ['stew', 5, 'Feastle stew', 'stew'],
  ['dessert', 1, 'Berries', 'berries'],
  ['dessert', 2, 'Compote', 'compote'],
  ['dessert', 3, 'Tartlet', 'tartlet'],
  ['dessert', 4, 'Berry tart', 'berry-tart'],
  ['dessert', 5, 'Celebration cake', 'cake'],
].map(([chainId, tier, name, artKey]) => ({
  id: `${chainId}:${tier}`,
  chainId: chainId as MergeChainId,
  tier: tier as MergeItemDefinition['tier'],
  name: String(name),
  artKey: String(artKey),
}));

export const FEASTLE_MERGE_ITEMS = ITEMS;
const BY_ID = new Map(ITEMS.map((item) => [item.id, item]));
const CHAINS: MergeChainId[] = ['pasta', 'stew', 'dessert'];

export function mergeItemDefinition(id: string): MergeItemDefinition {
  const item = BY_ID.get(id);
  if (!item) throw new Error(`Unknown merge item: ${id}`);
  return item;
}

export function nextMergeItem(id: string): MergeItemDefinition | null {
  const item = mergeItemDefinition(id);
  return item.tier === 5 ? null : mergeItemDefinition(`${item.chainId}:${item.tier + 1}`);
}

export function canMergeItems(left: MergeBoardItem | null, right: MergeBoardItem | null): boolean {
  return Boolean(left && right && left.definitionId === right.definitionId && nextMergeItem(left.definitionId));
}

export function resolveMergeConfig(completedCount: number): MergeRoundConfig {
  const tier = Math.min(3, 1 + Math.floor(completedCount / 2)) as 1 | 2 | 3;
  const targetTiers: [number, number] = tier === 1 ? [3, 4] : tier === 2 ? [4, 4] : [4, 5];
  const initialItemCount = 8;
  const requiredLeaves = targetTiers.reduce((sum, value) => sum + 2 ** (value - 1), 0);
  const requiredMerges = targetTiers.reduce((sum, value) => sum + 2 ** (value - 1) - 1, 0);
  const requiredSpawns = Math.max(0, requiredLeaves - initialItemCount);
  return {
    packId: 'feastle-kitchen',
    tier,
    orderCount: 2,
    targetTiers,
    initialItemCount,
    moveBudget: requiredMerges + requiredSpawns + [6, 8, 10][tier - 1],
  };
}

export function createMergeRound(
  seed: string,
  config: MergeRoundConfig,
  recentOrderIds: string[] = [],
): MergeRoundState {
  const recent = new Set(recentOrderIds);
  const chainOrder = seededShuffle(CHAINS, `${seed}:chains`);
  const pairs = chainOrder.flatMap((first) => chainOrder.filter((second) => second !== first).map((second) => [first, second] as const));
  const chains = pairs.sort((left, right) => {
    const leftRecent = Number(recent.has(`${left[0]}:${config.targetTiers[0]}`)) + Number(recent.has(`${left[1]}:${config.targetTiers[1]}`));
    const rightRecent = Number(recent.has(`${right[0]}:${config.targetTiers[0]}`)) + Number(recent.has(`${right[1]}:${config.targetTiers[1]}`));
    return leftRecent - rightRecent;
  })[0];
  const orders = config.targetTiers.map((targetTier, index) => {
    const targetId = `${chains[index]}:${targetTier}`;
    return { id: `order:${index}:${targetId}`, targetId, completed: false };
  });

  let nextInstance = 0;
  const leaves = orders.flatMap((order) => {
    const target = mergeItemDefinition(order.targetId);
    return Array.from({ length: 2 ** (target.tier - 1) }, () => ({
      instanceId: `item:${nextInstance++}`,
      definitionId: `${target.chainId}:1`,
    }));
  });
  const shuffled = seededShuffle(leaves, `${seed}:items`);
  const initial = shuffled.slice(0, config.initialItemCount);
  const pantry = shuffled.slice(config.initialItemCount);
  const boardSlots = seededShuffle(Array.from({ length: MERGE_BOARD_SIZE }, (_, index) => index), `${seed}:cells`);
  const board: (MergeBoardItem | null)[] = Array.from({ length: MERGE_BOARD_SIZE }, () => null);
  initial.forEach((item, index) => { board[boardSlots[index]] = item; });

  return {
    board,
    pantry,
    orders,
    movesUsed: 0,
    mergeCount: 0,
    highestTier: 1,
    status: 'playing',
    nextInstance,
  };
}

export function mergeRoundReducer(state: MergeRoundState, action: MergeAction, moveBudget: number): MergeRoundState {
  if (state.status !== 'playing') return state;
  if (action.type === 'spawn') {
    if (!validCell(action.cell) || state.board[action.cell] || !state.pantry.length || state.movesUsed >= moveBudget) return state;
    const board = [...state.board];
    board[action.cell] = state.pantry[0];
    return withRoundStatus({ ...state, board, pantry: state.pantry.slice(1), movesUsed: state.movesUsed + 1 }, moveBudget);
  }
  if (action.type === 'serve') {
    if (!validCell(action.cell)) return state;
    const item = state.board[action.cell];
    const orderIndex = state.orders.findIndex((order) => order.id === action.orderId && !order.completed && order.targetId === item?.definitionId);
    if (!item || orderIndex < 0) return state;
    const board = [...state.board];
    board[action.cell] = null;
    const orders = state.orders.map((order, index) => index === orderIndex ? { ...order, completed: true } : order);
    return withRoundStatus({ ...state, board, orders }, moveBudget);
  }

  if (!validCell(action.from) || !validCell(action.to) || action.from === action.to) return state;
  const source = state.board[action.from];
  if (!source) return state;
  const target = state.board[action.to];
  const board = [...state.board];
  if (!target) {
    board[action.to] = source;
    board[action.from] = null;
    return { ...state, board };
  }
  if (!canMergeItems(source, target) || state.movesUsed >= moveBudget) return state;
  const upgraded = nextMergeItem(source.definitionId)!;
  board[action.from] = null;
  board[action.to] = { instanceId: `item:${state.nextInstance}`, definitionId: upgraded.id };
  return withRoundStatus({
    ...state,
    board,
    movesUsed: state.movesUsed + 1,
    mergeCount: state.mergeCount + 1,
    highestTier: Math.max(state.highestTier, upgraded.tier),
    nextInstance: state.nextInstance + 1,
  }, moveBudget);
}

export function readyOrderForItem(state: MergeRoundState, cell: number): MergeOrder | null {
  const item = validCell(cell) ? state.board[cell] : null;
  return state.orders.find((order) => !order.completed && order.targetId === item?.definitionId) ?? null;
}

export function selectPantrySpawnCell(board: readonly (MergeBoardItem | null)[], seed: string): number {
  const emptyCells = board.flatMap((item, index) => item ? [] : [index]);
  return seededShuffle(emptyCells, seed)[0] ?? -1;
}

export function mergeRoundMinimumActions(config: MergeRoundConfig): number {
  const leaves = config.targetTiers.reduce((sum, tier) => sum + 2 ** (tier - 1), 0);
  const merges = config.targetTiers.reduce((sum, tier) => sum + 2 ** (tier - 1) - 1, 0);
  return Math.max(0, leaves - config.initialItemCount) + merges;
}

export function validateMergePack(): string[] {
  const errors: string[] = [];
  for (const chain of CHAINS) {
    const chainItems = ITEMS.filter((item) => item.chainId === chain);
    if (chainItems.length !== 5) errors.push(`${chain} must contain five tiers`);
    for (let tier = 1; tier <= 5; tier += 1) {
      if (!chainItems.some((item) => item.tier === tier)) errors.push(`${chain} is missing tier ${tier}`);
    }
  }
  if (new Set(ITEMS.map((item) => item.id)).size !== ITEMS.length) errors.push('Merge item IDs must be unique');
  return errors;
}

function withRoundStatus(state: MergeRoundState, moveBudget: number): MergeRoundState {
  if (state.orders.every((order) => order.completed)) return { ...state, status: 'won' };
  const hasReadyOrder = state.orders.some((order) => !order.completed && state.board.some((item) => item?.definitionId === order.targetId));
  if (state.movesUsed >= moveBudget && !hasReadyOrder) return { ...state, status: 'lost' };
  return state;
}

function validCell(cell: number): boolean {
  return Number.isInteger(cell) && cell >= 0 && cell < MERGE_BOARD_SIZE;
}

function seededShuffle<T>(values: readonly T[], seed: string): T[] {
  const output = [...values];
  let state = stableHash(seed) || 1;
  for (let index = output.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const target = state % (index + 1);
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
