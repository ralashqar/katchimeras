import {
  FEASTLE_STORY_REQUESTS,
  MERGE_ENERGY_CAP,
  MERGE_INITIAL_ENERGY,
  MERGE_ENERGY_REGEN_MS,
  MERGE_EXPANSIONS,
  MERGE_GENERATORS,
  MERGE_GENERATORS_BY_ID,
  MERGE_HYBRID_RECIPES,
  MERGE_ITEM_CATALOG,
  MERGE_ITEMS_BY_ID,
  MERGE_ORDER_TEMPLATES,
  MERGE_STARTING_OPEN_CELLS,
  MERGE_WORLD_SIZE,
  mergeLevelForXp,
} from '@/constants/merge-world-catalog';
import { FEASTLE_ACT_TWO_ORDER_POOL } from '@/utils/companion-story';
import type {
  MergeBoardCell,
  MergeBoardItem,
  MergeCharacterId,
  MergeExternalRewardReceipt,
  MergeGeneratorState,
  MergeOrder,
  MergeWorldCommand,
  MergeWorldCommandResult,
  MergeWorldState,
} from '@/types/merge-world';

const KNOWN_CHARACTERS = new Set<MergeCharacterId>(['feastle', 'mossprout', 'steppling', 'shellio', 'voyagle']);
const RECENT_ORDER_LIMIT = 8;
const STORY_GENERATOR_BY_CHARACTER: Record<MergeCharacterId, string> = {
  feastle: 'starter-pantry',
  mossprout: 'nature-pot',
  shellio: 'waterside-pail',
  steppling: 'adventure-pack',
  voyagle: 'travel-trunk',
};

export function createInitialMergeWorldState(now = Date.now(), characterIds: string[] = []): MergeWorldState {
  const board: MergeBoardCell[] = Array.from({ length: MERGE_WORLD_SIZE }, (_, index) => ({
    locked: !MERGE_STARTING_OPEN_CELLS.has(index),
    blocker: MERGE_STARTING_OPEN_CELLS.has(index) ? null : index % 3 === 0 ? 'rocks' : index % 3 === 1 ? 'clouds' : 'vines',
    occupant: null,
  }));
  let state: MergeWorldState = {
    version: 3,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    nextInstance: 1,
    board,
    storage: [],
    storageCapacity: 5,
    rewardInbox: [],
    generatorUnlockReceipts: [],
    generators: {},
    energy: { value: MERGE_INITIAL_ENERGY, cap: MERGE_ENERGY_CAP, lastRegenAt: now },
    coins: 100,
    mergeXp: 0,
    mergeLevel: 1,
    discoveries: [],
    unlockedFamilies: [],
    unlockedCharacters: [],
    favouriteCharacterId: null,
    activeOrders: [],
    completedOrderCount: 0,
    recentOrderKeys: [],
    expansions: [],
    processedActivityReceiptIds: [],
    activityEnergyByDay: {},
    lastFreeRerollDayId: null,
    characterProgress: { feastle: { friendshipLevel: 1, completedChapterIds: [] } },
    externalRewardReceipts: [],
  };
  state = reconcileCharacters(state, characterIds, now);
  return state;
}

export function reduceMergeWorld(state: MergeWorldState, command: MergeWorldCommand): MergeWorldCommandResult {
  const current = refreshTime(state, command.now);
  switch (command.type) {
    case 'refreshTime':
      return result(state, current, current === state ? undefined : 'Energy refreshed.');
    case 'tapGenerator':
      return tapGenerator(current, command.generatorId, command.now, command.seed);
    case 'move':
      return moveItem(current, command.from, command.to, command.now);
    case 'serveOrder':
      return serveOrder(current, command.orderId, command.now);
    case 'storeItem':
      return storeItem(current, command.cell, command.now);
    case 'restoreItem':
      return restoreItem(current, command.storageIndex, command.cell, command.now);
    case 'sellItem':
      return sellItem(current, command.cell, command.now);
    case 'claimInbox':
      return claimInbox(current, command.entryId, command.now);
    case 'unlockExpansion':
      return unlockExpansion(current, command.expansionId, command.now);
    case 'grantActivityRewardsBatch':
      return grantActivityRewardsBatch(current, command.rewards, command.now);
    case 'ackGeneratorUnlock': {
      const receipts = current.generatorUnlockReceipts.map((receipt) => receipt.id === command.receiptId && receipt.seenAt == null
        ? { ...receipt, seenAt: command.now }
        : receipt);
      if (receipts.every((receipt, index) => receipt === current.generatorUnlockReceipts[index])) return unchanged(current);
      return changed(touch({ ...current, generatorUnlockReceipts: receipts }, command.now));
    }
    case 'rerollOrder':
      return rerollOrder(current, command.orderId, command.now);
    case 'reconcileCharacters': {
      const next = reconcileCharacters(current, command.characterIds, command.now);
      return result(state, next, next === current ? undefined : 'Merge World welcomed new visitors.');
    }
    case 'reconcileFriendship': {
      const next = reconcileFriendship(current, command.levels, command.now);
      return result(state, next, next === current ? undefined : 'Friendship opened new Feastle requests.');
    }
    case 'reconcileStory': {
      const next = reconcileStory(current, command, command.now);
      return result(state, next, next === current ? undefined : 'Story request refreshed.');
    }
    case 'ackExternalReward': {
      const receipts = current.externalRewardReceipts.map((receipt) => receipt.id === command.receiptId && receipt.appliedAt == null
        ? { ...receipt, appliedAt: command.now }
        : receipt);
      if (receipts.every((receipt, index) => receipt === current.externalRewardReceipts[index])) return unchanged(current);
      return changed(touch({ ...current, externalRewardReceipts: receipts }, command.now));
    }
  }
}

export function mergeOrderReady(state: MergeWorldState, order: MergeOrder): boolean {
  return mergeOrderRequirementReadiness(state, order).every(Boolean);
}

export function mergeOrderRequirementReadiness(state: MergeWorldState, order: MergeOrder): boolean[] {
  const counts = boardItemCounts(state);
  return order.requirements.map((requirement) => (counts.get(requirement.definitionId) ?? 0) >= requirement.quantity);
}

export function mergeOrderItemReadiness(state: MergeWorldState, order: MergeOrder): boolean[] {
  const counts = boardItemCounts(state);
  return order.requirements.flatMap((requirement) => Array.from(
    { length: requirement.quantity },
    (_, index) => (counts.get(requirement.definitionId) ?? 0) > index,
  ));
}

export function mergeOrderServingCells(state: MergeWorldState, order: MergeOrder): { cell: number; definitionId: string; instanceId: string }[] {
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

export function readyMergeOrderIds(state: MergeWorldState): Set<string> {
  const counts = boardItemCounts(state);
  return new Set(state.activeOrders
    .filter((order) => order.requirements.every((requirement) => (counts.get(requirement.definitionId) ?? 0) >= requirement.quantity))
    .map((order) => order.id));
}

export function availableExpansion(state: MergeWorldState) {
  return MERGE_EXPANSIONS.find((expansion) => !state.expansions.includes(expansion.id)) ?? null;
}

export function normalizeMergeWorldState(value: unknown, now = Date.now()): MergeWorldState {
  if (!value || typeof value !== 'object') return createInitialMergeWorldState(now);
  const rawVersion = (value as { version?: unknown }).version;
  const source = value as Partial<MergeWorldState>;
  if ((rawVersion !== 1 && rawVersion !== 2 && rawVersion !== 3) || !Array.isArray(source.board) || source.board.length !== MERGE_WORLD_SIZE) {
    return createInitialMergeWorldState(now);
  }
  const fallback = createInitialMergeWorldState(now);
  let normalized: MergeWorldState = {
    ...fallback,
    ...source,
    version: 3,
    revision: finite(source.revision, 0),
    createdAt: finite(source.createdAt, now),
    updatedAt: finite(source.updatedAt, now),
    nextInstance: Math.max(1, finite(source.nextInstance, 1)),
    board: source.board.map((cell, index) => normalizeCell(cell, fallback.board[index])),
    storage: Array.isArray(source.storage) ? source.storage.filter(validBoardItem) : [],
    storageCapacity: Math.max(5, finite(source.storageCapacity, 5)),
    rewardInbox: Array.isArray(source.rewardInbox) ? source.rewardInbox : [],
    generatorUnlockReceipts: uniqueGeneratorUnlockReceipts(source.generatorUnlockReceipts),
    generators: source.generators && typeof source.generators === 'object'
      ? Object.fromEntries(Object.entries(source.generators).map(([id, generator]) => [id, normalizeGenerator(generator, id)]))
      : fallback.generators,
    energy: {
      value: Math.max(0, Math.min(MERGE_ENERGY_CAP, finite(source.energy?.value, MERGE_ENERGY_CAP))),
      cap: MERGE_ENERGY_CAP,
      lastRegenAt: finite(source.energy?.lastRegenAt, now),
    },
    coins: Math.max(0, finite(source.coins, 0)),
    mergeXp: Math.max(0, finite(source.mergeXp, 0)),
    mergeLevel: mergeLevelForXp(Math.max(0, finite(source.mergeXp, 0))),
    discoveries: uniqueStrings(source.discoveries).filter((id) => MERGE_ITEMS_BY_ID.has(id)),
    unlockedFamilies: uniqueStrings(source.unlockedFamilies).filter((id): id is MergeWorldState['unlockedFamilies'][number] => ['food', 'nature', 'adventure'].includes(id)),
    unlockedCharacters: uniqueStrings(source.unlockedCharacters).filter((id): id is MergeCharacterId => KNOWN_CHARACTERS.has(id as MergeCharacterId)),
    favouriteCharacterId: source.favouriteCharacterId && KNOWN_CHARACTERS.has(source.favouriteCharacterId) ? source.favouriteCharacterId : null,
    // Order capacity is a presentation concern: the horizontal rail can hold
    // every authored request, so normalization must never silently discard
    // off-screen orders.
    activeOrders: Array.isArray(source.activeOrders) ? source.activeOrders.map(normalizeOrder) : [],
    completedOrderCount: Math.max(0, finite(source.completedOrderCount, 0)),
    recentOrderKeys: uniqueStrings(source.recentOrderKeys).slice(-RECENT_ORDER_LIMIT),
    expansions: uniqueStrings(source.expansions),
    processedActivityReceiptIds: uniqueStrings(source.processedActivityReceiptIds),
    activityEnergyByDay: source.activityEnergyByDay && typeof source.activityEnergyByDay === 'object' ? source.activityEnergyByDay : {},
    lastFreeRerollDayId: typeof source.lastFreeRerollDayId === 'string' ? source.lastFreeRerollDayId : null,
    characterProgress: source.characterProgress && typeof source.characterProgress === 'object'
      ? source.characterProgress
      : fallback.characterProgress,
    externalRewardReceipts: Array.isArray(source.externalRewardReceipts) ? source.externalRewardReceipts : [],
  };
  // Version 1/2 Pantry charges, cooldowns, and parcels intentionally disappear.
  // Existing Energy is preserved only up to the new 40-point cap.
  return refreshTime(normalized, now);
}

function tapGenerator(state: MergeWorldState, generatorId: string, now: number, seed: string): MergeWorldCommandResult {
  const generator = state.generators[generatorId];
  if (!generator) return unchanged(state, 'That generator is not unlocked.');
  if (state.energy.value < 1) return unchanged(state, 'You need more Merge Energy.');
  const cell = firstEmptyCell(state.board, hash(`${seed}:cell`));
  if (cell < 0) return unchanged(state, 'The board is full. Merge or store an item first.');
  const random = randomUnit(`${seed}:drop:${state.revision}`);
  // Tier 2 is a lucky shortcut; tier 3 and above must come from merging.
  const tier = random < 0.85 ? 1 : 2;
  const branch = generator.enabledBranches[Math.floor(randomUnit(`${seed}:branch`) * generator.enabledBranches.length)] ?? generator.enabledBranches[0];
  const definitionId = `${generator.familyId}:${branch}:${tier}`;
  if (!MERGE_ITEMS_BY_ID.has(definitionId)) return unchanged(state, 'This generator has no available drops.');
  const item: MergeBoardItem = { kind: 'item', instanceId: `merge-item:${state.nextInstance}`, definitionId };
  const board = [...state.board];
  board[cell] = { ...board[cell], occupant: item };
  let next = touch({
    ...state,
    board,
    nextInstance: state.nextInstance + 1,
    energy: { ...state.energy, value: state.energy.value - 1 },
  }, now);
  const discovery = applyDiscovery(next, definitionId, now);
  next = discovery.state;
  return { state: next, changed: true, spawnedCell: cell, discoveryId: discovery.newDiscovery ? definitionId : undefined, message: `${MERGE_ITEMS_BY_ID.get(definitionId)?.name ?? 'Item'} added.` };
}

function moveItem(state: MergeWorldState, from: number, to: number, now: number): MergeWorldCommandResult {
  if (!validCell(from) || !validCell(to) || from === to || state.board[to].locked) return unchanged(state, 'Choose an open board space.');
  const source = state.board[from].occupant;
  const target = state.board[to].occupant;
  if (!source) return unchanged(state);
  const board = [...state.board];
  if (!target) {
    board[from] = { ...board[from], occupant: null };
    board[to] = { ...board[to], occupant: source };
    return changed(touch({ ...state, board }, now));
  }
  if (source.kind === 'generator' || target.kind === 'generator') {
    board[from] = { ...board[from], occupant: target };
    board[to] = { ...board[to], occupant: source };
    return changed(touch({ ...state, board }, now));
  }
  const sourceDefinition = MERGE_ITEMS_BY_ID.get(source.definitionId);
  let resultId = source.definitionId === target.definitionId ? sourceDefinition?.nextItemId ?? null : null;
  if (!resultId) resultId = MERGE_HYBRID_RECIPES.get([source.definitionId, target.definitionId].sort().join('+')) ?? null;
  if (!resultId) {
    board[from] = { ...board[from], occupant: target };
    board[to] = { ...board[to], occupant: source };
    return changed(touch({ ...state, board }, now));
  }
  board[from] = { ...board[from], occupant: null };
  board[to] = {
    ...board[to],
    occupant: { kind: 'item', instanceId: `merge-item:${state.nextInstance}`, definitionId: resultId },
  };
  let next = touch({ ...state, board, nextInstance: state.nextInstance + 1 }, now);
  const discovery = applyDiscovery(next, resultId, now);
  next = discovery.state;
  return {
    state: next,
    changed: true,
    mergedCell: to,
    discoveryId: discovery.newDiscovery ? resultId : undefined,
    message: `${MERGE_ITEMS_BY_ID.get(resultId)?.name ?? 'New item'} created.`,
  };
}

function serveOrder(state: MergeWorldState, orderId: string, now: number): MergeWorldCommandResult {
  const order = state.activeOrders.find((item) => item.id === orderId);
  if (!order || !mergeOrderReady(state, order)) return unchanged(state, 'The requested items are not ready yet.');
  const remaining = new Map(order.requirements.map((requirement) => [requirement.definitionId, requirement.quantity]));
  const board = state.board.map((cell) => {
    const occupant = cell.occupant;
    if (!occupant || occupant.kind !== 'item') return cell;
    const needed = remaining.get(occupant.definitionId) ?? 0;
    if (needed < 1) return cell;
    remaining.set(occupant.definitionId, needed - 1);
    return { ...cell, occupant: null };
  });
  const completedOrderCount = state.completedOrderCount + 1;
  const mergeXp = state.mergeXp + order.reward.mergeXp;
  const completesStoryBundle = !order.storyStepCount
    || state.activeOrders.filter((item) => item.storyArcId === order.storyArcId && item.storyTargetLevel === order.storyTargetLevel).length <= 1;
  const externalRewardReceipts: MergeExternalRewardReceipt[] = [
    ...state.externalRewardReceipts,
    ...(state.unlockedCharacters.includes(order.characterId) ? [{
      id: `merge-friendship:${order.id}`,
      kind: 'friendship' as const,
      characterId: order.characterId,
      amount: order.reward.friendshipXp,
      presentation: order.storyArcId ? 'quiet_summary' as const : 'celebration' as const,
      sourceId: order.storyArcId,
      storyStep: order.storyStep,
      storyStepCount: order.storyStepCount,
      createdAt: now,
      appliedAt: null,
    }] : []),
    ...(order.reward.wispId ? [{
      id: `merge-wisp:${order.id}:${order.reward.wispId}`,
      kind: 'wisp' as const,
      characterId: order.characterId,
      amount: 1,
      wispId: order.reward.wispId,
      createdAt: now,
      appliedAt: null,
    }] : []),
    ...(order.chapterId && completesStoryBundle ? [{
      id: `merge-conversation:${order.chapterId}`,
      kind: 'conversation' as const,
      characterId: order.characterId,
      amount: 1,
      sourceId: order.chapterId,
      createdAt: now,
      appliedAt: null,
    }] : []),
    ...(order.storyArcId && order.storyTargetLevel ? [{
      id: `merge-story-served:${order.id}`,
      kind: 'story_order_served' as const,
      characterId: order.characterId,
      amount: order.storyTargetLevel,
      sourceId: order.storyArcId,
      storyStep: order.storyStep,
      storyStepCount: order.storyStepCount,
      createdAt: now,
      appliedAt: null,
    }] : []),
  ];
  const currentProgress = state.characterProgress[order.characterId] ?? { friendshipLevel: 1, completedChapterIds: [] };
  const characterProgress = order.chapterId && completesStoryBundle
    ? {
        ...state.characterProgress,
        [order.characterId]: {
          ...currentProgress,
          completedChapterIds: [...new Set([...currentProgress.completedChapterIds, order.chapterId])],
        },
      }
    : state.characterProgress;
  let next: MergeWorldState = {
    ...state,
    board,
    coins: state.coins + order.reward.coins,
    mergeXp,
    mergeLevel: mergeLevelForXp(mergeXp),
    storageCapacity: storageCapacityForLevel(mergeLevelForXp(mergeXp)),
    energy: { ...state.energy, value: Math.min(state.energy.cap, state.energy.value + orderEnergyRefund(order)) },
    completedOrderCount,
    activeOrders: state.activeOrders.filter((item) => item.id !== orderId),
    recentOrderKeys: [...state.recentOrderKeys, templateKeyForOrder(order)].slice(-RECENT_ORDER_LIMIT),
    externalRewardReceipts,
    characterProgress,
  };
  next = touch(next, now);
  return { state: next, changed: true, servedOrderId: order.id, message: `${order.title} served.` };
}

function storeItem(state: MergeWorldState, cell: number, now: number): MergeWorldCommandResult {
  if (!validCell(cell) || state.storage.length >= state.storageCapacity) return unchanged(state, 'Storage is full.');
  const occupant = state.board[cell].occupant;
  if (!occupant || occupant.kind !== 'item') return unchanged(state, 'Only merge items can be stored.');
  const board = [...state.board];
  board[cell] = { ...board[cell], occupant: null };
  return changed(touch({ ...state, board, storage: [...state.storage, occupant] }, now), 'Item stored.');
}

function restoreItem(state: MergeWorldState, storageIndex: number, requestedCell: number | undefined, now: number): MergeWorldCommandResult {
  const item = state.storage[storageIndex];
  const cell = requestedCell != null && validCell(requestedCell) && !state.board[requestedCell].locked && !state.board[requestedCell].occupant
    ? requestedCell
    : firstEmptyCell(state.board, 0);
  if (!item || cell < 0) return unchanged(state, 'No open board space is available.');
  const board = [...state.board];
  board[cell] = { ...board[cell], occupant: item };
  return changed(touch({ ...state, board, storage: state.storage.filter((_, index) => index !== storageIndex) }, now), 'Item returned to the board.');
}

function sellItem(state: MergeWorldState, cell: number, now: number): MergeWorldCommandResult {
  if (!validCell(cell)) return unchanged(state);
  const occupant = state.board[cell].occupant;
  if (!occupant || occupant.kind !== 'item') return unchanged(state, 'Only merge items can be sold.');
  const definition = MERGE_ITEMS_BY_ID.get(occupant.definitionId);
  const board = [...state.board];
  board[cell] = { ...board[cell], occupant: null };
  return changed(touch({ ...state, board, coins: state.coins + (definition?.sellValue ?? 1) }, now), `Sold for ${definition?.sellValue ?? 1} Coins.`);
}

function claimInbox(state: MergeWorldState, entryId: string, now: number): MergeWorldCommandResult {
  const entry = state.rewardInbox.find((item) => item.id === entryId);
  if (!entry) return unchanged(state);
  const openCells = state.board.flatMap((cell, index) => !cell.locked && !cell.occupant ? [index] : []);
  if (openCells.length < entry.items.length) return unchanged(state, `Make ${entry.items.length - openCells.length} more board spaces first.`);
  const board = [...state.board];
  let nextInstance = state.nextInstance;
  entry.items.forEach((definitionId, index) => {
    board[openCells[index]] = { ...board[openCells[index]], occupant: { kind: 'item', instanceId: `merge-item:${nextInstance++}`, definitionId } };
  });
  return changed(touch({ ...state, board, nextInstance, rewardInbox: state.rewardInbox.filter((item) => item.id !== entryId) }, now), 'Rewards placed on the board.');
}

function unlockExpansion(state: MergeWorldState, expansionId: string, now: number): MergeWorldCommandResult {
  const expansion = MERGE_EXPANSIONS.find((item) => item.id === expansionId);
  if (!expansion || state.expansions.includes(expansion.id)) return unchanged(state);
  if (state.mergeLevel < expansion.requiredLevel) return unchanged(state, `Reach Merge Level ${expansion.requiredLevel} first.`);
  if (state.coins < expansion.coinCost) return unchanged(state, `You need ${expansion.coinCost} Coins.`);
  const cells = new Set<number>(expansion.cells);
  const board = state.board.map((cell, index) => cells.has(index) ? { ...cell, locked: false, blocker: null } : cell);
  return changed(touch({ ...state, board, coins: state.coins - expansion.coinCost, expansions: [...state.expansions, expansion.id] }, now), 'New board spaces opened.');
}

function grantActivityRewardsBatch(
  state: MergeWorldState,
  rewards: Array<{ receiptId: string; amount: number; grantDayId: string; rewardClass: 'daily_journal' | 'daily_quest' | 'food_basket'; itemDefinitionIds?: string[] }>,
  now: number,
): MergeWorldCommandResult {
  if (!rewards.length) return unchanged(state);
  const processed = new Set(state.processedActivityReceiptIds);
  const activityEnergyByDay = { ...state.activityEnergyByDay };
  let rewardInbox = state.rewardInbox;
  let amount = 0;
  let changedState = false;
  let basketAdded = false;
  for (const reward of rewards) {
    if (!reward.receiptId || processed.has(reward.receiptId)) continue;
    processed.add(reward.receiptId);
    changedState = true;
    const requested = Math.max(0, Math.floor(reward.amount));
    const awarded = Math.min(requested, Math.max(0, 12 - (activityEnergyByDay[reward.grantDayId] ?? 0)));
    amount += awarded;
    activityEnergyByDay[reward.grantDayId] = (activityEnergyByDay[reward.grantDayId] ?? 0) + awarded;
    const validItems = (reward.itemDefinitionIds ?? []).filter((id) => MERGE_ITEMS_BY_ID.has(id));
    if (reward.rewardClass === 'food_basket' && validItems.length && !rewardInbox.some((entry) => entry.id === reward.receiptId)) {
      rewardInbox = [...rewardInbox, { id: reward.receiptId, createdAt: now, items: validItems, source: 'activity' }];
      basketAdded = true;
    }
  }
  if (!changedState) return unchanged(state);
  const energyValue = Math.min(state.energy.cap, state.energy.value + amount);
  const actualEnergyAward = energyValue - state.energy.value;
  return changed(touch({
    ...state,
    energy: { ...state.energy, value: energyValue },
    processedActivityReceiptIds: [...processed],
    activityEnergyByDay,
    rewardInbox,
  }, now), actualEnergyAward > 0
    ? `Real life added ${actualEnergyAward} Merge Energy${basketAdded ? ' and a Pantry Basket.' : '.'}`
    : basketAdded ? 'Your Pantry Basket is waiting in Merge World.' : undefined);
}

function rerollOrder(state: MergeWorldState, orderId: string, now: number): MergeWorldCommandResult {
  const order = state.activeOrders.find((item) => item.id === orderId);
  const dayId = localDayId(now);
  if (!order || order.purpose === 'signature' || order.storyArcId) return unchanged(state, 'Story requests stay until you are ready.');
  if ((order.rerollAvailableAt ?? order.createdAt + 86_400_000) > now) return unchanged(state, 'This request can be changed after it has had a day on the table.');
  if (state.lastFreeRerollDayId === dayId) return unchanged(state, 'Your free request change has already been used today.');
  const next: MergeWorldState = { ...state, activeOrders: state.activeOrders.filter((item) => item.id !== orderId), lastFreeRerollDayId: dayId, recentOrderKeys: [...state.recentOrderKeys, templateKeyForOrder(order)].slice(-RECENT_ORDER_LIMIT) };
  return changed(touch(next, now), 'Feastle brought a different request.');
}

function reconcileCharacters(state: MergeWorldState, ids: string[], now: number): MergeWorldState {
  const additions = ids.filter((id): id is MergeCharacterId => KNOWN_CHARACTERS.has(id as MergeCharacterId) && !state.unlockedCharacters.includes(id as MergeCharacterId));
  if (!additions.length) return state;
  return touch({ ...state, unlockedCharacters: [...state.unlockedCharacters, ...additions] }, now);
}

function reconcileFriendship(state: MergeWorldState, levels: Partial<Record<MergeCharacterId, number>>, now: number): MergeWorldState {
  let changedState = false;
  const characterProgress = { ...state.characterProgress };
  for (const [characterId, rawLevel] of Object.entries(levels) as Array<[MergeCharacterId, number | undefined]>) {
    if (!KNOWN_CHARACTERS.has(characterId) || !Number.isFinite(rawLevel)) continue;
    const current = characterProgress[characterId] ?? { friendshipLevel: 1, completedChapterIds: [] };
    const friendshipLevel = Math.max(1, Math.min(20, Math.floor(rawLevel ?? 1)));
    if (current.friendshipLevel === friendshipLevel) continue;
    characterProgress[characterId] = { ...current, friendshipLevel };
    changedState = true;
  }
  const next = changedState ? { ...state, characterProgress } : state;
  return next === state ? state : touch(next, now);
}

function reconcileStory(
  state: MergeWorldState,
  story: Extract<MergeWorldCommand, { type: 'reconcileStory' }>,
  now: number,
): MergeWorldState {
  let next = story.status === 'order_active'
    ? ensureGenerator(state, STORY_GENERATOR_BY_CHARACTER[story.familyId], now)
    : state;
  if (story.familyId !== 'feastle') return next === state ? state : touch(next, now);
  const feastleOrders = state.activeOrders.filter((order) => order.characterId === 'feastle');
  const servedStoryOrderIds = new Set(state.externalRewardReceipts
    .filter((receipt) => receipt.kind === 'story_order_served')
    .map((receipt) => receipt.id.replace('merge-story-served:', '')));
  for (const orderId of story.servedOrderIds ?? []) servedStoryOrderIds.add(orderId);
  const wanted = story.status === 'order_active'
    ? feastleStoryOrders(story.targetLevel, now, story.actPhase, story.orderTemplateKeys)
        .filter((order) => !servedStoryOrderIds.has(order.id))
        .slice(0, story.actPhase === 'regular_orders' ? 3 : undefined)
    : [];
  // Ownership unlocks a character, but only an authored story beat may create
  // an order. Generic legacy orders are removed during story reconciliation.
  const keepOrders = state.activeOrders.filter((order) => order.characterId !== 'feastle' && order.storyArcId);
  const activeOrders = [...keepOrders, ...wanted.map((order) => feastleOrders.find((existing) => existing.id === order.id) ?? order)];
  if (activeOrders.length !== state.activeOrders.length || activeOrders.some((order, index) => order.id !== state.activeOrders[index]?.id)) {
    next = { ...next, activeOrders };
  }
  return next === state ? state : touch(next, now);
}

function feastleStoryOrders(targetLevel: number, now: number, actPhase?: string, orderTemplateKeys: string[] = []): MergeOrder[] {
  if (actPhase === 'regular_orders') {
    return orderTemplateKeys.flatMap((key, index) => {
      const template = FEASTLE_ACT_TWO_ORDER_POOL.find((item) => item.key === key);
      if (!template) return [];
      const energy = template.difficulty === 'small' ? 2 : template.difficulty === 'medium' ? 3 : 5;
      return [{
        id: `merge-story:feastle:act-2:${template.key}`,
        characterId: 'feastle' as const,
        title: template.title,
        description: template.description,
        narrativeSignal: template.signal,
        difficulty: template.difficulty,
        requirements: [
          { definitionId: template.definitionId, quantity: 1 },
          ...('secondaryDefinitionId' in template
            ? [{ definitionId: template.secondaryDefinitionId, quantity: 1 }]
            : []),
        ],
        reward: { coins: 24 + index * 4, mergeXp: 18 + index * 3, friendshipXp: 8, energy },
        createdAt: now,
        signature: false,
        purpose: 'normal' as const,
        storyArcId: 'feastle:table-story',
        storyBeatId: 'feastle:act-2:regular-orders',
        storyTargetLevel: 7,
        storyStep: index + 1,
        storyStepCount: orderTemplateKeys.length,
      }];
    });
  }
  if (actPhase === 'signature_order') {
    return [{
      id: 'merge-story:feastle:act-2:first-feast',
      characterId: 'feastle',
      title: "Feastle's First Feast",
      description: 'A generous centrepiece made from everything the table has taught us.',
      narrativeSignal: 'connection',
      difficulty: 'major',
      requirements: [{ definitionId: 'food:table:6', quantity: 1 }, { definitionId: 'food:table:3', quantity: 1 }],
      reward: { coins: 80, mergeXp: 60, friendshipXp: 30, energy: 5 },
      createdAt: now,
      signature: true,
      purpose: 'signature',
      chapterId: 'feastle-chapter-8',
      storyArcId: 'feastle:table-story',
      storyBeatId: 'feastle:act-2:signature',
      storyTargetLevel: 8,
      storyStep: 1,
      storyStepCount: 1,
    }];
  }
  if (targetLevel === 4) {
    const dishes = FEASTLE_STORY_REQUESTS[4];
    return dishes.map((dish, index) => ({
      id: `merge-story:feastle:chapter-1:level-4:order-${index + 1}`,
      characterId: 'feastle',
      title: dish.title,
      difficulty: index === 2 ? 'major' : index === 1 ? 'medium' : 'small',
      requirements: [{ definitionId: dish.definitionId, quantity: 1 }],
      reward: { coins: 20, mergeXp: 16, friendshipXp: 10, energy: 2 },
      createdAt: now, signature: true, purpose: 'signature', chapterId: 'feastle-chapter-4',
      storyArcId: 'feastle:table-story', storyBeatId: 'feastle-story:level-3',
      storyTargetLevel: 4, storyStep: index + 1, storyStepCount: dishes.length,
    }));
  }
  const request = FEASTLE_STORY_REQUESTS[targetLevel]?.[0] ?? scaledFeastleRequest(targetLevel);
  const spec = { ...request, friendshipXp: targetLevel === 2 ? 20 : 30 };
  return [{
    id: `merge-story:feastle:chapter-1:level-${targetLevel}`,
    characterId: 'feastle', title: spec.title,
    difficulty: targetLevel >= 4 ? 'major' : targetLevel === 3 ? 'medium' : 'small',
    requirements: [{ definitionId: spec.definitionId, quantity: spec.quantity }],
    reward: { coins: 20 + targetLevel * 10, mergeXp: 18 + targetLevel * 8, friendshipXp: spec.friendshipXp, energy: 4 },
    createdAt: now, signature: targetLevel === 4, purpose: targetLevel === 4 ? 'signature' : 'normal',
    chapterId: targetLevel === 4 ? 'feastle-chapter-4' : undefined,
    storyArcId: 'feastle:table-story', storyBeatId: `feastle-story:level-${targetLevel - 1}`,
    storyTargetLevel: targetLevel, storyStep: 1, storyStepCount: 1,
  }];
}

function scaledFeastleRequest(targetLevel: number) {
  const tier = targetLevel >= 16 ? 6 : targetLevel >= 12 ? 5 : targetLevel >= 8 ? 4 : 3;
  return { title: 'A village table request', definitionId: `food:table:${tier}`, quantity: targetLevel >= 16 ? 2 : 1 };
}

function ensureGenerator(state: MergeWorldState, generatorId: string, now: number): MergeWorldState {
  if (state.generators[generatorId]) return state;
  const definition = MERGE_GENERATORS_BY_ID.get(generatorId);
  if (!definition) return state;
  const board = [...state.board];
  const preferred = definition.initialCell;
  const cell = !board[preferred].locked && !board[preferred].occupant ? preferred : firstEmptyCell(board, preferred);
  if (cell < 0) return {
    ...state,
    rewardInbox: [...state.rewardInbox, { id: `generator:${generatorId}`, createdAt: state.updatedAt, items: [], source: 'chest' }],
  };
  board[cell] = { ...board[cell], occupant: { kind: 'generator', generatorId } };
  const unlockReceiptId = `generator-unlock:${generatorId}`;
  const generatorUnlockReceipts = state.generatorUnlockReceipts.some((receipt) => receipt.id === unlockReceiptId)
    ? state.generatorUnlockReceipts
    : [...state.generatorUnlockReceipts, {
        id: unlockReceiptId,
        generatorId,
        createdAt: now,
        seenAt: null,
      }];
  return {
    ...state,
    board,
    generators: { ...state.generators, [generatorId]: generatorState(generatorId) },
    generatorUnlockReceipts,
    unlockedFamilies: state.unlockedFamilies.includes(definition.familyId) ? state.unlockedFamilies : [...state.unlockedFamilies, definition.familyId],
  };
}

function templateKeyForOrder(order: MergeOrder) {
  return order.id.split(':').slice(4).join(':') || order.title;
}

function applyDiscovery(state: MergeWorldState, definitionId: string, now: number) {
  if (state.discoveries.includes(definitionId)) return { state, newDiscovery: false };
  const mergeXp = state.mergeXp + 6;
  return {
    state: touch({
      ...state,
      discoveries: [...state.discoveries, definitionId],
      coins: state.coins + 5,
      mergeXp,
      mergeLevel: mergeLevelForXp(mergeXp),
    }, now),
    newDiscovery: true,
  };
}

function refreshTime(state: MergeWorldState, now: number): MergeWorldState {
  let changedState = false;
  let energy = state.energy;
  if (energy.value < energy.cap && now > energy.lastRegenAt) {
    const ticks = Math.floor((now - energy.lastRegenAt) / MERGE_ENERGY_REGEN_MS);
    if (ticks > 0) {
      const value = Math.min(energy.cap, energy.value + ticks);
      energy = { ...energy, value, lastRegenAt: value >= energy.cap ? now : energy.lastRegenAt + ticks * MERGE_ENERGY_REGEN_MS };
      changedState = true;
    }
  } else if (energy.value >= energy.cap && energy.lastRegenAt !== now) {
    energy = { ...energy, lastRegenAt: now };
    changedState = true;
  }
  return changedState ? touch({ ...state, energy }, now) : state;
}

function generatorState(id: string): MergeGeneratorState {
  const definition = MERGE_GENERATORS_BY_ID.get(id) ?? MERGE_GENERATORS[0];
  return {
    id: definition.id,
    familyId: definition.familyId,
    name: definition.name,
    level: 1,
    enabledBranches: [...definition.baseBranches],
  };
}

function boardItemCounts(state: MergeWorldState) {
  const counts = new Map<string, number>();
  for (const cell of state.board) {
    if (cell.occupant?.kind !== 'item') continue;
    counts.set(cell.occupant.definitionId, (counts.get(cell.occupant.definitionId) ?? 0) + 1);
  }
  return counts;
}

function firstEmptyCell(board: MergeBoardCell[], offset: number) {
  for (let step = 0; step < board.length; step += 1) {
    const index = (Math.abs(offset) + step) % board.length;
    if (!board[index].locked && !board[index].occupant) return index;
  }
  return -1;
}

function storageCapacityForLevel(level: number) {
  if (level >= 15) return 20;
  if (level >= 11) return 16;
  if (level >= 7) return 12;
  if (level >= 3) return 8;
  return 5;
}

function touch(state: MergeWorldState, now: number): MergeWorldState {
  return { ...state, revision: state.revision + 1, updatedAt: now };
}

function result(original: MergeWorldState, state: MergeWorldState, message?: string): MergeWorldCommandResult {
  return { state, changed: state !== original, message };
}

function changed(state: MergeWorldState, message?: string): MergeWorldCommandResult {
  return { state, changed: true, message };
}

function unchanged(state: MergeWorldState, message?: string): MergeWorldCommandResult {
  return { state, changed: false, message };
}

function validCell(index: number) {
  return Number.isInteger(index) && index >= 0 && index < MERGE_WORLD_SIZE;
}

function finite(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function uniqueStrings(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string'))] : [];
}

function normalizeCell(value: unknown, fallback: MergeBoardCell): MergeBoardCell {
  if (!value || typeof value !== 'object') return fallback;
  const cell = value as Partial<MergeBoardCell>;
  const occupant = cell.occupant && typeof cell.occupant === 'object' ? cell.occupant : null;
  return {
    locked: Boolean(cell.locked),
    blocker: cell.blocker === 'vines' || cell.blocker === 'rocks' || cell.blocker === 'clouds' ? cell.blocker : null,
    occupant: occupant?.kind === 'item' && validBoardItem(occupant)
      ? occupant
      : occupant?.kind === 'generator' && typeof occupant.generatorId === 'string'
        ? occupant
        : null,
  };
}

function validBoardItem(value: unknown): value is MergeBoardItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<MergeBoardItem>;
  return item.kind === 'item' && typeof item.instanceId === 'string' && typeof item.definitionId === 'string' && MERGE_ITEMS_BY_ID.has(item.definitionId);
}

function validGeneratorUnlockReceipt(value: unknown): value is MergeWorldState['generatorUnlockReceipts'][number] {
  if (!value || typeof value !== 'object') return false;
  const receipt = value as Partial<MergeWorldState['generatorUnlockReceipts'][number]>;
  return typeof receipt.id === 'string'
    && typeof receipt.generatorId === 'string'
    && MERGE_GENERATORS_BY_ID.has(receipt.generatorId)
    && Number.isFinite(receipt.createdAt)
    && (receipt.seenAt == null || Number.isFinite(receipt.seenAt));
}

function uniqueGeneratorUnlockReceipts(value: unknown): MergeWorldState['generatorUnlockReceipts'] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, MergeWorldState['generatorUnlockReceipts'][number]>();
  for (const receipt of value) {
    if (!validGeneratorUnlockReceipt(receipt)) continue;
    const existing = byId.get(receipt.id);
    // Preserve an acknowledgement if either duplicate was already seen.
    if (!existing || (existing.seenAt == null && receipt.seenAt != null)) byId.set(receipt.id, receipt);
  }
  return [...byId.values()];
}

function normalizeGenerator(value: unknown, id: string): MergeGeneratorState {
  const fallback = generatorState(id);
  if (!value || typeof value !== 'object') return fallback;
  const generator = value as Partial<MergeGeneratorState>;
  return {
    id: typeof generator.id === 'string' ? generator.id : fallback.id,
    familyId: generator.familyId === 'food' || generator.familyId === 'nature' || generator.familyId === 'adventure'
      ? generator.familyId
      : fallback.familyId,
    name: typeof generator.name === 'string' ? generator.name : fallback.name,
    level: Math.max(1, Math.floor(finite(generator.level, 1))),
    enabledBranches: uniqueStrings(generator.enabledBranches).length
      ? uniqueStrings(generator.enabledBranches)
      : fallback.enabledBranches,
  };
}

function orderEnergyRefund(order: MergeOrder): number {
  if (order.signature || order.purpose === 'signature') return 5;
  return order.difficulty === 'medium' ? 3 : order.difficulty === 'major' ? 5 : 2;
}

function normalizeOrder(value: MergeOrder): MergeOrder {
  return {
    ...value,
    purpose: value.purpose ?? (value.signature ? 'signature' : 'normal'),
    rerollAvailableAt: value.signature ? undefined : value.rerollAvailableAt ?? value.createdAt + 86_400_000,
  };
}

function localDayId(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function hash(value: string) {
  let output = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    output ^= value.charCodeAt(index);
    output = Math.imul(output, 16777619);
  }
  return output >>> 0;
}

function randomUnit(value: string) {
  return hash(value) / 0xffffffff;
}

export function mergeWorldCatalogIssues(): string[] {
  const issues: string[] = [];
  for (const item of MERGE_ITEM_CATALOG) {
    if (item.nextItemId && !MERGE_ITEMS_BY_ID.has(item.nextItemId)) issues.push(`${item.id} has missing next item ${item.nextItemId}`);
  }
  for (const template of MERGE_ORDER_TEMPLATES) {
    for (const requirement of template.requirements) {
      if (!MERGE_ITEMS_BY_ID.has(requirement.definitionId)) issues.push(`${template.key} requests missing ${requirement.definitionId}`);
    }
  }
  return issues;
}
