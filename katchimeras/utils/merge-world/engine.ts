import {
  MERGE_ENERGY_CAP,
  MERGE_ENERGY_REGEN_MS,
  MERGE_EXPANSIONS,
  MERGE_GENERATOR_CHARGES,
  MERGE_GENERATOR_COOLDOWN_MS,
  MERGE_GENERATORS,
  MERGE_GENERATORS_BY_ID,
  MERGE_HYBRID_RECIPES,
  MERGE_ITEM_CATALOG,
  MERGE_ITEMS_BY_ID,
  MERGE_ORDER_TEMPLATES,
  MERGE_STARTING_OPEN_CELLS,
  MERGE_WORLD_SIZE,
  mergeLevelForXp,
  type MergeOrderTemplate,
} from '@/constants/merge-world-catalog';
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

export function createInitialMergeWorldState(now = Date.now(), characterIds: string[] = []): MergeWorldState {
  const board: MergeBoardCell[] = Array.from({ length: MERGE_WORLD_SIZE }, (_, index) => ({
    locked: !MERGE_STARTING_OPEN_CELLS.has(index),
    blocker: MERGE_STARTING_OPEN_CELLS.has(index) ? null : index % 3 === 0 ? 'rocks' : index % 3 === 1 ? 'clouds' : 'vines',
    occupant: null,
  }));
  board[31] = { ...board[31], occupant: { kind: 'generator', generatorId: 'starter-pantry' } };
  const starter = generatorState('starter-pantry');
  let state: MergeWorldState = {
    version: 1,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    nextInstance: 1,
    board,
    storage: [],
    storageCapacity: 5,
    rewardInbox: [],
    generators: { [starter.id]: starter },
    energy: { value: MERGE_ENERGY_CAP, cap: MERGE_ENERGY_CAP, lastRegenAt: now },
    coins: 100,
    mergeXp: 0,
    mergeLevel: 1,
    discoveries: [],
    unlockedFamilies: ['food'],
    unlockedCharacters: [],
    favouriteCharacterId: null,
    activeOrders: [],
    completedOrderCount: 0,
    recentOrderKeys: [],
    expansions: [],
    processedActivityReceiptIds: [],
    externalRewardReceipts: [],
  };
  state = reconcileCharacters(state, characterIds, now);
  while (state.activeOrders.length < 3) state = appendOrder(state, now + state.activeOrders.length);
  return state;
}

export function reduceMergeWorld(state: MergeWorldState, command: MergeWorldCommand): MergeWorldCommandResult {
  const current = refreshTime(state, command.now);
  switch (command.type) {
    case 'refreshTime':
      return result(state, current, current === state ? undefined : 'Energy and generators refreshed.');
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
    case 'grantActivityEnergy':
      return grantActivityEnergy(current, command.receiptId, command.amount, command.now);
    case 'grantActivityEnergyBatch':
      return grantActivityEnergyBatch(current, command.rewards, command.now);
    case 'reconcileCharacters': {
      const next = reconcileCharacters(current, command.characterIds, command.now);
      return result(state, next, next === current ? undefined : 'Merge World welcomed new visitors.');
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
  const counts = boardItemCounts(state);
  return order.requirements.every((requirement) => (counts.get(requirement.definitionId) ?? 0) >= requirement.quantity);
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
  const source = value as Partial<MergeWorldState>;
  if (source.version !== 1 || !Array.isArray(source.board) || source.board.length !== MERGE_WORLD_SIZE) {
    return createInitialMergeWorldState(now);
  }
  const fallback = createInitialMergeWorldState(now);
  const normalized: MergeWorldState = {
    ...fallback,
    ...source,
    version: 1,
    revision: finite(source.revision, 0),
    createdAt: finite(source.createdAt, now),
    updatedAt: finite(source.updatedAt, now),
    nextInstance: Math.max(1, finite(source.nextInstance, 1)),
    board: source.board.map((cell, index) => normalizeCell(cell, fallback.board[index])),
    storage: Array.isArray(source.storage) ? source.storage.filter(validBoardItem) : [],
    storageCapacity: Math.max(5, finite(source.storageCapacity, 5)),
    rewardInbox: Array.isArray(source.rewardInbox) ? source.rewardInbox : [],
    generators: source.generators && typeof source.generators === 'object' ? source.generators : fallback.generators,
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
    activeOrders: Array.isArray(source.activeOrders) ? source.activeOrders.slice(0, 3) : [],
    completedOrderCount: Math.max(0, finite(source.completedOrderCount, 0)),
    recentOrderKeys: uniqueStrings(source.recentOrderKeys).slice(-RECENT_ORDER_LIMIT),
    expansions: uniqueStrings(source.expansions),
    processedActivityReceiptIds: uniqueStrings(source.processedActivityReceiptIds),
    externalRewardReceipts: Array.isArray(source.externalRewardReceipts) ? source.externalRewardReceipts : [],
  };
  return refreshTime(normalized, now);
}

function tapGenerator(state: MergeWorldState, generatorId: string, now: number, seed: string): MergeWorldCommandResult {
  const generator = state.generators[generatorId];
  if (!generator) return unchanged(state, 'That generator is not unlocked.');
  if (state.energy.value < 1) return unchanged(state, 'You need more Merge Energy.');
  if (generator.charges < 1) return unchanged(state, 'This generator is resting.');
  const cell = firstEmptyCell(state.board, hash(`${seed}:cell`));
  if (cell < 0) return unchanged(state, 'The board is full. Merge or store an item first.');
  const random = randomUnit(`${seed}:drop:${state.revision}`);
  const tier = random < 0.7 ? 1 : random < 0.95 ? 2 : 3;
  const branch = generator.enabledBranches[Math.floor(randomUnit(`${seed}:branch`) * generator.enabledBranches.length)] ?? generator.enabledBranches[0];
  const definitionId = `${generator.familyId}:${branch}:${tier}`;
  if (!MERGE_ITEMS_BY_ID.has(definitionId)) return unchanged(state, 'This generator has no available drops.');
  const item: MergeBoardItem = { kind: 'item', instanceId: `merge-item:${state.nextInstance}`, definitionId };
  const board = [...state.board];
  board[cell] = { ...board[cell], occupant: item };
  const charges = generator.charges - 1;
  const generators = {
    ...state.generators,
    [generatorId]: {
      ...generator,
      charges,
      readyAt: charges === 0 ? now + MERGE_GENERATOR_COOLDOWN_MS : generator.readyAt,
    },
  };
  let next = touch({
    ...state,
    board,
    generators,
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
  const externalRewardReceipts: MergeExternalRewardReceipt[] = [
    ...state.externalRewardReceipts,
    ...(state.unlockedCharacters.includes(order.characterId) ? [{
      id: `merge-friendship:${order.id}`,
      kind: 'friendship' as const,
      characterId: order.characterId,
      amount: order.reward.friendshipXp,
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
  ];
  let next: MergeWorldState = {
    ...state,
    board,
    coins: state.coins + order.reward.coins,
    mergeXp,
    mergeLevel: mergeLevelForXp(mergeXp),
    storageCapacity: storageCapacityForLevel(mergeLevelForXp(mergeXp)),
    energy: { ...state.energy, value: Math.min(state.energy.cap, state.energy.value + order.reward.energy) },
    completedOrderCount,
    activeOrders: state.activeOrders.filter((item) => item.id !== orderId),
    recentOrderKeys: [...state.recentOrderKeys, templateKeyForOrder(order)].slice(-RECENT_ORDER_LIMIT),
    externalRewardReceipts,
  };
  next = appendOrder(next, now);
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

function grantActivityEnergy(state: MergeWorldState, receiptId: string, amount: number, now: number): MergeWorldCommandResult {
  if (!receiptId || state.processedActivityReceiptIds.includes(receiptId)) return unchanged(state);
  const safeAmount = Math.max(0, Math.floor(amount));
  return changed(touch({
    ...state,
    energy: { ...state.energy, value: Math.min(state.energy.cap, state.energy.value + safeAmount) },
    processedActivityReceiptIds: [...state.processedActivityReceiptIds, receiptId],
  }, now), `Real life added ${safeAmount} Merge Energy.`);
}

function grantActivityEnergyBatch(state: MergeWorldState, rewards: Array<{ receiptId: string; amount: number }>, now: number): MergeWorldCommandResult {
  if (!rewards.length) return unchanged(state);
  const processed = new Set(state.processedActivityReceiptIds);
  let amount = 0;
  let changedState = false;
  for (const reward of rewards) {
    if (!reward.receiptId || processed.has(reward.receiptId)) continue;
    processed.add(reward.receiptId);
    amount += Math.max(0, Math.floor(reward.amount));
    changedState = true;
  }
  if (!changedState) return unchanged(state);
  return changed(touch({
    ...state,
    energy: { ...state.energy, value: Math.min(state.energy.cap, state.energy.value + amount) },
    processedActivityReceiptIds: [...processed],
  }, now), `Real life added ${amount} Merge Energy.`);
}

function reconcileCharacters(state: MergeWorldState, ids: string[], now: number): MergeWorldState {
  const additions = ids.filter((id): id is MergeCharacterId => KNOWN_CHARACTERS.has(id as MergeCharacterId) && !state.unlockedCharacters.includes(id as MergeCharacterId));
  if (!additions.length) return state;
  let next = { ...state, unlockedCharacters: [...state.unlockedCharacters, ...additions] };
  if (additions.some((id) => id === 'mossprout' || id === 'shellio')) next = ensureGenerator(next, 'nature-pot');
  if (additions.some((id) => id === 'steppling' || id === 'voyagle')) next = ensureGenerator(next, 'adventure-pack');
  if (additions.includes('shellio')) next = enableBranch(next, 'nature-pot', 'waterside');
  if (additions.includes('voyagle')) next = enableBranch(next, 'adventure-pack', 'travel');
  if (additions.includes('feastle')) {
    next = { ...next, generators: { ...next.generators, 'starter-pantry': { ...next.generators['starter-pantry'], name: 'Feastle’s Picnic Basket', level: Math.max(2, next.generators['starter-pantry'].level) } } };
  }
  return touch(next, now);
}

function ensureGenerator(state: MergeWorldState, generatorId: string): MergeWorldState {
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
  return {
    ...state,
    board,
    generators: { ...state.generators, [generatorId]: generatorState(generatorId) },
    unlockedFamilies: state.unlockedFamilies.includes(definition.familyId) ? state.unlockedFamilies : [...state.unlockedFamilies, definition.familyId],
  };
}

function enableBranch(state: MergeWorldState, generatorId: string, branchId: string): MergeWorldState {
  const generator = state.generators[generatorId];
  if (!generator || generator.enabledBranches.includes(branchId)) return state;
  return { ...state, generators: { ...state.generators, [generatorId]: { ...generator, enabledBranches: [...generator.enabledBranches, branchId], level: generator.level + 1 } } };
}

function appendOrder(state: MergeWorldState, now: number): MergeWorldState {
  const available = eligibleTemplates(state);
  if (!available.length) return state;
  const unseen = available.filter((template) => !state.recentOrderKeys.includes(template.key));
  const pool = unseen.length ? unseen : available;
  const favourite = state.favouriteCharacterId ? pool.filter((item) => item.characterId === state.favouriteCharacterId) : [];
  const selectionPool = favourite.length && randomUnit(`${now}:${state.completedOrderCount}:favourite`) < 0.55 ? favourite : pool;
  const template = selectionPool[hash(`${now}:${state.completedOrderCount}:${state.activeOrders.length}`) % selectionPool.length];
  const order = orderFromTemplate(template, now, state.completedOrderCount, state.activeOrders.length);
  return { ...state, activeOrders: [...state.activeOrders, order] };
}

function eligibleTemplates(state: MergeWorldState): MergeOrderTemplate[] {
  const characters = state.unlockedCharacters.length ? new Set(state.unlockedCharacters) : new Set<MergeCharacterId>(['feastle']);
  const branches = new Set(Object.values(state.generators).flatMap((generator) => generator.enabledBranches.map((branch) => `${generator.familyId}:${branch}`)));
  return MERGE_ORDER_TEMPLATES.filter((template) => {
    if (!characters.has(template.characterId)) return false;
    if (template.difficulty === 'major' && state.mergeLevel < 10) return false;
    return template.requirements.every((requirement) => {
      if (requirement.definitionId === 'hybrid:picnic-pack') return state.unlockedCharacters.includes('voyagle');
      const definition = MERGE_ITEMS_BY_ID.get(requirement.definitionId);
      return Boolean(definition && branches.has(`${definition.familyId}:${definition.branchId}`));
    });
  });
}

function orderFromTemplate(template: MergeOrderTemplate, now: number, count: number, slot: number): MergeOrder {
  return {
    id: `merge-order:${count}:${slot}:${now.toString(36)}:${template.key}`,
    characterId: template.characterId,
    title: template.title,
    difficulty: template.difficulty,
    requirements: template.requirements.map((item) => ({ ...item })),
    reward: { ...template.reward },
    createdAt: now,
    signature: Boolean(template.signature),
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
      energy: { ...state.energy, value: Math.min(state.energy.cap, state.energy.value + 1) },
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
  const generators = { ...state.generators };
  for (const generator of Object.values(generators)) {
    if (generator.readyAt != null && now >= generator.readyAt) {
      generators[generator.id] = { ...generator, charges: generator.maxCharges, readyAt: null };
      changedState = true;
    }
  }
  return changedState ? touch({ ...state, energy, generators }, now) : state;
}

function generatorState(id: string): MergeGeneratorState {
  const definition = MERGE_GENERATORS_BY_ID.get(id) ?? MERGE_GENERATORS[0];
  return {
    id: definition.id,
    familyId: definition.familyId,
    name: definition.name,
    charges: MERGE_GENERATOR_CHARGES,
    maxCharges: MERGE_GENERATOR_CHARGES,
    readyAt: null,
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
