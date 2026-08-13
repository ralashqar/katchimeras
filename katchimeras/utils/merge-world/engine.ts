import {
  FEASTLE_STORY_REQUESTS,
  MERGE_EXPANSIONS,
  GENERATOR_BY_CHAIN,
  MERGE_GENERATORS,
  MERGE_GENERATORS_BY_ID,
  MERGE_GENERATOR_MIGRATION_ALIASES,
  MERGE_HYBRID_RECIPES,
  MERGE_ITEM_CATALOG,
  MERGE_ITEMS_BY_ID,
  MERGE_ORDER_TEMPLATES,
  MERGE_CHAIN_IDS,
  MERGE_CHAPTER_LANDMARKS,
  MERGE_CHARACTER_NAMES,
  KATCHIMERA_MERGE_PROFILES,
  MERGE_STARTING_OPEN_CELLS,
  MERGE_WORLD_SIZE,
  mergeLevelForXp,
} from '@/constants/merge-world-catalog';
import {
  MERGE_DAILY_ACTIVITY_ENERGY_LIMIT,
  MERGE_ENERGY_REGEN_CAP,
  MERGE_ENERGY_REGEN_MS,
  MERGE_INITIAL_ENERGY,
} from '@/utils/merge-world/economy-policy';
import { AUTHORED_COHORT_ORDER_POOLS, BARISTABBIT_CHAPTER_ONE_ORDER_POOL, FEASTLE_ACT_TWO_ORDER_POOL, type AuthoredCohortFamilyId } from '@/utils/companion-story';
import type {
  MergeBoardCell,
  MergeBoardItem,
  MergeCharacterId,
  MergeExternalRewardReceipt,
  MergeGeneratorState,
  MergeOrder,
  MergeWorldArrival,
  MergeWorldLandmark,
  MergeWorldCommand,
  MergeWorldCommandResult,
  MergeWorldState,
} from '@/types/merge-world';
import { advanceMossproutChapterZero } from '@/utils/merge-world/chapter-zero-policy';

const KNOWN_CHARACTERS = new Set<MergeCharacterId>(Object.keys(KATCHIMERA_MERGE_PROFILES) as MergeCharacterId[]);
const RECENT_ORDER_LIMIT = 8;

export function createInitialMergeWorldState(now = Date.now(), characterIds: string[] = []): MergeWorldState {
  const board: MergeBoardCell[] = Array.from({ length: MERGE_WORLD_SIZE }, (_, index) => ({
    locked: !MERGE_STARTING_OPEN_CELLS.has(index),
    blocker: MERGE_STARTING_OPEN_CELLS.has(index) ? null : index % 3 === 0 ? 'rocks' : index % 3 === 1 ? 'clouds' : 'vines',
    occupant: null,
  }));
  let state: MergeWorldState = {
    version: 8,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    nextInstance: 1,
    board,
    storage: [],
    storageCapacity: 8,
    rewardInbox: [],
    arrivals: [],
    landmarks: [],
    generatorUnlockReceipts: [],
    generators: {},
    energy: { value: MERGE_INITIAL_ENERGY, regenCap: MERGE_ENERGY_REGEN_CAP, lastRegenAt: now },
    coins: 100,
    mergeXp: 0,
    mergeLevel: 1,
    discoveries: [],
    unlockedFamilies: [],
    unlockedChains: [],
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
    case 'upgradeGenerator':
      return upgradeGenerator(current, command.generatorId, command.now);
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
    case 'claimArrival':
      return claimArrival(current, command.arrivalId, command.now);
    case 'viewMemoryArrival':
      return viewMemoryArrival(current, command.arrivalId, command.now);
    case 'unlockExpansion':
      return unlockExpansion(current, command.expansionId, command.now);
    case 'grantActivityRewardsBatch':
      return grantActivityRewardsBatch(current, command.rewards, command.now);
    case 'featureCharacter': {
      if (!current.unlockedCharacters.includes(command.characterId)) return unchanged(current);
      // Featuring controls presentation order and the companion return route.
      // Orders belong to the shared board, so changing focus must never erase
      // another Katchimera's active requests.
      if (current.favouriteCharacterId === command.characterId) return unchanged(current);
      return changed(touch({ ...current, favouriteCharacterId: command.characterId }, command.now));
    }
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

/** Clears only the idempotency records that cap real-life Energy for one day. */
export function resetMergeActivityForDay(state: MergeWorldState, dayId: string, now = Date.now()): MergeWorldState {
  const receiptIds = new Set([
    `activity:egg-journal:${dayId}`,
    `activity:egg-companion:${dayId}`,
    `activity:daily-quest:${dayId}`,
    `activity:contextual-parcel:${dayId}`,
    `activity:memory-arrival:${dayId}`,
  ]);
  const processedActivityReceiptIds = state.processedActivityReceiptIds.filter((id) => !receiptIds.has(id)
    && !(id.startsWith('activity:goal-chest:') && id.endsWith(`:${dayId}`)));
  const arrivals = state.arrivals.filter((arrival) => arrival.dayId !== dayId);
  const activityEnergyByDay = { ...state.activityEnergyByDay };
  const hadDailyTotal = Object.prototype.hasOwnProperty.call(activityEnergyByDay, dayId);
  delete activityEnergyByDay[dayId];
  if (!hadDailyTotal && processedActivityReceiptIds.length === state.processedActivityReceiptIds.length && arrivals.length === state.arrivals.length) return state;
  return touch({ ...state, processedActivityReceiptIds, activityEnergyByDay, arrivals }, now);
}

export function availableExpansion(state: MergeWorldState) {
  return MERGE_EXPANSIONS.find((expansion) => !state.expansions.includes(expansion.id)) ?? null;
}

export function normalizeMergeWorldState(value: unknown, now = Date.now()): MergeWorldState {
  if (!value || typeof value !== 'object') return createInitialMergeWorldState(now);
  const rawVersion = (value as { version?: unknown }).version;
  const source = value as Partial<MergeWorldState>;
  if ((rawVersion !== 1 && rawVersion !== 2 && rawVersion !== 3 && rawVersion !== 4 && rawVersion !== 5 && rawVersion !== 6 && rawVersion !== 7 && rawVersion !== 8) || !Array.isArray(source.board) || source.board.length !== MERGE_WORLD_SIZE) {
    return createInitialMergeWorldState(now);
  }
  const fallback = createInitialMergeWorldState(now);
  let normalized: MergeWorldState = {
    ...fallback,
    ...source,
    version: 8,
    revision: finite(source.revision, 0),
    createdAt: finite(source.createdAt, now),
    updatedAt: finite(source.updatedAt, now),
    nextInstance: Math.max(1, finite(source.nextInstance, 1)),
    board: dedupeMigratedGenerators(source.board.map((cell, index) => normalizeCell(cell, fallback.board[index]))),
    storage: Array.isArray(source.storage) ? source.storage.filter(validBoardItem) : [],
    storageCapacity: Math.max(8, finite(source.storageCapacity, 8)),
    rewardInbox: Array.isArray(source.rewardInbox) ? source.rewardInbox : [],
    arrivals: normalizeArrivals(source.arrivals),
    landmarks: normalizeLandmarks(source.landmarks),
    generatorUnlockReceipts: uniqueGeneratorUnlockReceipts(source.generatorUnlockReceipts),
    generators: source.generators && typeof source.generators === 'object'
      ? normalizeGenerators(source.generators)
      : fallback.generators,
    energy: {
      value: Math.max(0, finite(source.energy?.value, MERGE_INITIAL_ENERGY)),
      regenCap: MERGE_ENERGY_REGEN_CAP,
      lastRegenAt: finite(source.energy?.lastRegenAt, now),
    },
    coins: Math.max(0, finite(source.coins, 0)),
    mergeXp: Math.max(0, finite(source.mergeXp, 0)),
    mergeLevel: mergeLevelForXp(Math.max(0, finite(source.mergeXp, 0))),
    discoveries: uniqueStrings(source.discoveries).filter((id) => MERGE_ITEMS_BY_ID.has(id)),
    unlockedFamilies: uniqueStrings(source.unlockedFamilies).filter((id): id is MergeWorldState['unlockedFamilies'][number] => ['food', 'drink', 'adventure', 'nature', 'comfort', 'social', 'mind', 'creative'].includes(id)),
    unlockedChains: uniqueStrings(source.unlockedChains).filter((id): id is MergeWorldState['unlockedChains'][number] => MERGE_CHAIN_IDS.includes(id as MergeWorldState['unlockedChains'][number])),
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
  normalized = reconcileUnlockedCatalog(normalized);
  normalized = migrateActivityInbox(normalized);
  // Version 1/2 Pantry charges, cooldowns, and parcels intentionally disappear.
  // Version 3's five single-chain generators migrate into the shared eight.
  return refreshTime(normalized, now);
}

function tapGenerator(state: MergeWorldState, generatorId: string, now: number, seed: string): MergeWorldCommandResult {
  const generator = state.generators[generatorId];
  if (!generator) return unchanged(state, 'That generator is not unlocked.');
  if (state.energy.value < 1) return unchanged(state, 'You need more Merge Energy.');
  const cell = firstEmptyCell(state.board, hash(`${seed}:cell`));
  if (cell < 0) return unchanged(state, 'The board is full. Merge or store an item first.');
  // Level one always starts at tier one. Upgrades add a bounded chance of a
  // better seed without changing which authored chains the generator owns.
  const dropIndex = randomUnit(`${seed}:chain:${state.revision}`) < 0.5 ? 0 : 1;
  const baseDefinitionId = generator.tierOneDropDefinitionIds[dropIndex];
  const betterDropRoll = randomUnit(`${seed}:upgrade:${state.revision}`);
  const bonusTier = generator.level >= 4 && betterDropRoll < 0.05
    ? 2
    : betterDropRoll < Math.max(0, generator.level - 1) * 0.1 ? 1 : 0;
  const definitionId = bonusTier ? baseDefinitionId.replace(/:1$/, `:${1 + bonusTier}`) : baseDefinitionId;
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

export function mergeGeneratorUpgradeCost(level: number): number | null {
  return level >= 4 ? null : [0, 3, 6, 10][Math.max(1, level)] ?? null;
}

function upgradeGenerator(state: MergeWorldState, generatorId: string, now: number): MergeWorldCommandResult {
  const generator = state.generators[generatorId];
  if (!generator) return unchanged(state, 'That generator is not unlocked.');
  const cost = mergeGeneratorUpgradeCost(generator.level);
  if (cost == null) return unchanged(state, 'This generator is fully upgraded.');
  if (generator.upgradeFragments < cost) return unchanged(state, `Find ${cost - generator.upgradeFragments} more generator fragments.`);
  const upgraded = { ...generator, level: generator.level + 1, upgradeFragments: generator.upgradeFragments - cost };
  return changed(touch({ ...state, generators: { ...state.generators, [generatorId]: upgraded } }, now), `${generator.name} reached level ${upgraded.level}.`);
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
  const landmarkDefinition = order.signature ? MERGE_CHAPTER_LANDMARKS[order.characterId] : null;
  const landmarks = landmarkDefinition && !state.landmarks.some((landmark) => landmark.id === landmarkDefinition.id)
    ? [...state.landmarks, { id: landmarkDefinition.id, characterId: order.characterId, chapterId: order.chapterId ?? `${order.characterId}-chapter-1`, unlockedAt: now }]
    : state.landmarks;
  const energyRefund = mergeOrderEnergyRefund(order);
  const fragmentGeneratorId = GENERATOR_BY_CHAIN[KATCHIMERA_MERGE_PROFILES[order.characterId].coreChains[0]];
  const fragmentGenerator = state.generators[fragmentGeneratorId];
  const generators = fragmentGenerator ? {
    ...state.generators,
    [fragmentGeneratorId]: {
      ...fragmentGenerator,
      upgradeFragments: fragmentGenerator.upgradeFragments + (order.signature || order.storyArcId ? 2 : 1),
    },
  } : state.generators;
  let next: MergeWorldState = {
    ...state,
    board,
    coins: state.coins + order.reward.coins,
    mergeXp,
    mergeLevel: mergeLevelForXp(mergeXp),
    storageCapacity: storageCapacityForLevel(mergeLevelForXp(mergeXp)),
    energy: { ...state.energy, value: state.energy.value + energyRefund },
    completedOrderCount,
    activeOrders: state.activeOrders.filter((item) => item.id !== orderId),
    recentOrderKeys: [...state.recentOrderKeys, templateKeyForOrder(order)].slice(-RECENT_ORDER_LIMIT),
    externalRewardReceipts,
    characterProgress,
    landmarks,
    generators,
  };
  next = advanceMossproutChapterZero(next, order.id, now);
  next = touch(next, now);
  return { state: next, changed: true, servedOrderId: order.id, energyGranted: energyRefund, message: `${order.title} served.` };
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

function claimArrival(state: MergeWorldState, arrivalId: string, now: number): MergeWorldCommandResult {
  const arrival = state.arrivals.find((item) => item.id === arrivalId);
  if (!arrival || arrival.claimedAt != null) return unchanged(state);
  if (arrival.kind === 'memory_arrival') {
    return changed(touch({
      ...state,
      arrivals: state.arrivals.map((item) => item.id === arrivalId ? { ...item, claimedAt: now, seenAt: item.seenAt ?? now } : item),
    }, now), 'Memory saved to the shelf.');
  }
  const openCells = state.board.flatMap((cell, index) => !cell.locked && !cell.occupant ? [index] : []);
  if (openCells.length < arrival.itemDefinitionIds.length) return unchanged(state, `Make ${arrival.itemDefinitionIds.length - openCells.length} more board spaces first.`);
  const board = [...state.board];
  let nextInstance = state.nextInstance;
  const spawnedItems: NonNullable<MergeWorldCommandResult['spawnedItems']> = [];
  arrival.itemDefinitionIds.forEach((definitionId, index) => {
    const instanceId = `merge-item:${nextInstance++}`;
    const cell = openCells[index];
    board[cell] = { ...board[cell], occupant: { kind: 'item', instanceId, definitionId } };
    spawnedItems.push({ instanceId, definitionId, cell });
  });
  return {
    ...changed(touch({
    ...state,
    board,
    nextInstance,
    arrivals: state.arrivals.map((item) => item.id === arrivalId ? { ...item, claimedAt: now, seenAt: item.seenAt ?? now } : item),
    }, now), `${arrival.label} placed on the board.`),
    spawnedItems,
  };
}

function viewMemoryArrival(state: MergeWorldState, arrivalId: string, now: number): MergeWorldCommandResult {
  const arrival = state.arrivals.find((item) => item.id === arrivalId && item.kind === 'memory_arrival');
  if (!arrival || arrival.seenAt != null) return unchanged(state);
  return changed(touch({
    ...state,
    arrivals: state.arrivals.map((item) => item.id === arrivalId ? { ...item, seenAt: now } : item),
  }, now));
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
  rewards: Extract<MergeWorldCommand, { type: 'grantActivityRewardsBatch' }>['rewards'],
  now: number,
): MergeWorldCommandResult {
  if (!rewards.length) return unchanged(state);
  const processed = new Set(state.processedActivityReceiptIds);
  const activityEnergyByDay = { ...state.activityEnergyByDay };
  let arrivals = state.arrivals;
  let amount = 0;
  let changedState = false;
  let queuedItemCount = 0;
  for (const reward of rewards) {
    if (!reward.receiptId || processed.has(reward.receiptId)) continue;
    processed.add(reward.receiptId);
    changedState = true;
    const requested = Math.max(0, Math.floor(reward.amount));
    const awarded = Math.min(requested, Math.max(0, MERGE_DAILY_ACTIVITY_ENERGY_LIMIT - (activityEnergyByDay[reward.grantDayId] ?? 0)));
    amount += awarded;
    activityEnergyByDay[reward.grantDayId] = (activityEnergyByDay[reward.grantDayId] ?? 0) + awarded;
    if (reward.arrival && !arrivals.some((arrival) => arrival.id === reward.arrival!.id)) {
      const itemDefinitionIds = reward.arrival.itemDefinitionIds.filter((id) => MERGE_ITEMS_BY_ID.has(id));
      arrivals = [...arrivals, { ...reward.arrival, itemDefinitionIds, createdAt: now, claimedAt: null, seenAt: null }];
      queuedItemCount += itemDefinitionIds.length;
    }
  }
  if (!changedState) return unchanged(state);
  const energyValue = state.energy.value + amount;
  const actualEnergyAward = amount;
  const next = touch({
    ...state,
    energy: { ...state.energy, value: energyValue },
    processedActivityReceiptIds: [...processed],
    activityEnergyByDay,
    rewardInbox: state.rewardInbox,
    arrivals,
  }, now);
  return { state: next, changed: true, energyGranted: actualEnergyAward, itemsQueued: queuedItemCount, message: actualEnergyAward > 0
    ? `Real life added ${actualEnergyAward} Merge Energy${queuedItemCount ? ' and companion starter supplies.' : '.'}`
    : queuedItemCount ? 'Your companion starter supplies are waiting in Merge World.' : undefined };
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
  for (const [characterId, rawLevel] of Object.entries(levels) as [MergeCharacterId, number | undefined][]) {
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
  // A midpoint return is an interlude inside the five-order bundle, not the
  // end of it. Keep the unserved requests on the rail while the companion's
  // note is waiting or open; only the served IDs should rotate out.
  const keepsMidpointOrders = story.actPhase === 'midpoint_return'
    && (story.status === 'return_available' || story.status === 'conversation_active');
  const showsStoryOrders = story.status === 'order_active' || keepsMidpointOrders;
  const effectiveActPhase = keepsMidpointOrders ? 'regular_orders' : story.actPhase;
  let next = showsStoryOrders
    ? ensureCharacterGenerators(state, story.familyId, now)
    : state;
  if (story.familyId !== 'feastle') {
    const existing = next.activeOrders.filter((order) => order.characterId === story.familyId);
    const servedIds = new Set([
      ...next.externalRewardReceipts
        .filter((receipt) => receipt.kind === 'story_order_served')
        .map((receipt) => receipt.id.replace('merge-story-served:', '')),
      ...(story.servedOrderIds ?? []),
    ]);
    const wanted = showsStoryOrders
      ? (story.familyId === 'baristabbit' || story.familyId === 'steppling' || story.familyId === 'voyagle' || story.familyId === 'flexel' || story.familyId === 'bedrotte'
          ? authoredCohortStoryOrders(next, story.familyId, now, effectiveActPhase, story.orderTemplateKeys)
          : genericFamilyStoryOrders(next, story.familyId, story.targetLevel, now, effectiveActPhase, story.orderTemplateKeys))
          .filter((order) => !servedIds.has(order.id))
          .slice(0, effectiveActPhase === 'regular_orders' ? 3 : undefined)
      : [];
    const keep = next.activeOrders.filter((order) => order.characterId !== story.familyId);
    const activeOrders = [...keep, ...wanted.map((order) => existing.find((item) => item.id === order.id
      && JSON.stringify(item.requirements) === JSON.stringify(order.requirements)) ?? order)];
    if (activeOrders.length !== next.activeOrders.length || activeOrders.some((order, index) => order.id !== next.activeOrders[index]?.id)) {
      next = { ...next, activeOrders };
    }
    return next === state ? state : touch(next, now);
  }
  const feastleOrders = state.activeOrders.filter((order) => order.characterId === 'feastle');
  const servedStoryOrderIds = new Set(state.externalRewardReceipts
    .filter((receipt) => receipt.kind === 'story_order_served')
    .map((receipt) => receipt.id.replace('merge-story-served:', '')));
  for (const orderId of story.servedOrderIds ?? []) servedStoryOrderIds.add(orderId);
  const wanted = showsStoryOrders
    ? feastleStoryOrders(next, story.targetLevel, now, effectiveActPhase, story.orderTemplateKeys)
        .filter((order) => !servedStoryOrderIds.has(order.id))
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

function baristabbitStoryOrders(state: MergeWorldState, now: number, actPhase?: string, orderTemplateKeys: string[] = []): MergeOrder[] {
  if (actPhase === 'signature_order') return [{
    id: 'merge-story:baristabbit:chapter-1:pause-table',
    characterId: 'baristabbit',
    title: 'The Pause Table',
    description: "A warm ritual, a bright reset, and, when Feastle's Pantry is open, something sweet to share.",
    narrativeSignal: 'connection', difficulty: 'major',
    requirements: [
      { definitionId: 'drink:hot:5', quantity: 1 },
      { definitionId: 'drink:refresh:4', quantity: 1 },
      ...(state.generators['hearth-pantry'] ? [{ definitionId: 'food:dessert:3', quantity: 1 }] : []),
    ],
    reward: { coins: 90, mergeXp: 70, friendshipXp: 30, energy: 5 },
    createdAt: now, signature: true, purpose: 'signature', chapterId: 'baristabbit-chapter-1',
    storyArcId: 'baristabbit:pause-story', storyBeatId: 'baristabbit:chapter-1:signature',
    storyTargetLevel: 8, storyStep: 1, storyStepCount: 1,
  }];
  if (actPhase !== 'regular_orders') return [];
  return orderTemplateKeys.flatMap((key, index) => {
    const template = BARISTABBIT_CHAPTER_ONE_ORDER_POOL.find((item) => item.key === key);
    if (!template) return [];
    const energy = template.difficulty === 'small' ? 2 : template.difficulty === 'medium' ? 3 : 5;
    return [{
      id: `merge-story:baristabbit:chapter-1:${template.key}`,
      characterId: 'baristabbit' as const,
      title: template.title, description: template.description,
      narrativeSignal: template.signal, difficulty: template.difficulty,
      requirements: [
        { definitionId: template.definitionId, quantity: 1 },
        ...('secondaryDefinitionId' in template
          ? [{ definitionId: template.secondaryDefinitionId, quantity: 1 }]
          : 'guestDefinitionId' in template && 'guestGeneratorId' in template && state.generators[template.guestGeneratorId]
            ? [{ definitionId: template.guestDefinitionId, quantity: 1 }]
            : []),
      ],
      reward: { coins: 22 + index * 7, mergeXp: 18 + index * 5, friendshipXp: 8, energy },
      createdAt: now, signature: false, purpose: 'normal' as const,
      storyArcId: 'baristabbit:pause-story', storyBeatId: 'baristabbit:chapter-1:regular-orders',
      storyTargetLevel: 7, storyStep: index + 1, storyStepCount: orderTemplateKeys.length,
    }];
  });
}

const AUTHORED_MERGE_CHAPTERS = {
  steppling: {
    arcId: 'steppling:path-outside-story', chapterId: 'steppling-chapter-1', signatureKey: 'path-outside',
    signatureTitle: 'The Path Outside',
    signatureDescription: 'A landmark trail and a travel journal for a path that can hold purpose, curiosity, and an unhurried pace.',
    signatureRequirements: [{ definitionId: 'adventure:trail:5', quantity: 1 }, { definitionId: 'adventure:travel:4', quantity: 1 }],
  },
  voyagle: {
    arcId: 'voyagle:blank-spaces-story', chapterId: 'voyagle-chapter-1', signatureKey: 'map-with-blank-spaces',
    signatureTitle: 'The Map with Blank Spaces',
    signatureDescription: 'A memory-worthy journey and a confident trail, leaving one part of the map deliberately unwritten.',
    signatureRequirements: [{ definitionId: 'adventure:travel:5', quantity: 1 }, { definitionId: 'adventure:trail:4', quantity: 1 }],
  },
  flexel: {
    arcId: 'flexel:rhythm-that-holds-story', chapterId: 'flexel-chapter-1', signatureKey: 'rhythm-that-holds',
    signatureTitle: 'The Rhythm That Holds',
    signatureDescription: 'A meaningful route and a complete care station for movement that gives enough back to return to.',
    signatureRequirements: [{ definitionId: 'adventure:trail:5', quantity: 1 }, { definitionId: 'comfort:care:5', quantity: 1 }],
  },
  bedrotte: {
    arcId: 'bedrotte:room-that-asks-nothing-story', chapterId: 'bedrotte-chapter-1', signatureKey: 'room-that-asks-nothing',
    signatureTitle: 'The Room That Asks Nothing',
    signatureDescription: 'A complete rest nest and sanctuary kit with no productivity waiting at the door.',
    signatureRequirements: [{ definitionId: 'comfort:rest:5', quantity: 1 }, { definitionId: 'comfort:care:5', quantity: 1 }],
  },
} as const;

function authoredCohortStoryOrders(state: MergeWorldState, familyId: AuthoredCohortFamilyId, now: number, actPhase?: string, orderTemplateKeys: string[] = []): MergeOrder[] {
  if (familyId === 'baristabbit') return baristabbitStoryOrders(state, now, actPhase, orderTemplateKeys);
  const chapter = AUTHORED_MERGE_CHAPTERS[familyId];
  if (actPhase === 'signature_order') return [{
    id: `merge-story:${familyId}:chapter-1:${chapter.signatureKey}`,
    characterId: familyId,
    title: chapter.signatureTitle,
    description: chapter.signatureDescription,
    narrativeSignal: 'connection', difficulty: 'major',
    requirements: [...chapter.signatureRequirements],
    reward: { coins: 90, mergeXp: 70, friendshipXp: 30, energy: 5 },
    createdAt: now, signature: true, purpose: 'signature', chapterId: chapter.chapterId,
    storyArcId: chapter.arcId, storyBeatId: `${familyId}:chapter-1:signature`,
    storyTargetLevel: 8, storyStep: 1, storyStepCount: 1,
  }];
  if (actPhase !== 'regular_orders') return [];
  const pool = AUTHORED_COHORT_ORDER_POOLS[familyId];
  return orderTemplateKeys.flatMap((key, index) => {
    const template = pool.find((item) => item.key === key);
    if (!template) return [];
    const secondaryDefinitionId = 'secondaryDefinitionId' in template ? template.secondaryDefinitionId : null;
    const energy = template.difficulty === 'small' ? 2 : template.difficulty === 'medium' ? 3 : 5;
    return [{
      id: `merge-story:${familyId}:chapter-1:${template.key}`,
      characterId: familyId,
      title: template.title, description: template.description,
      narrativeSignal: template.signal, difficulty: template.difficulty,
      requirements: [
        { definitionId: template.definitionId, quantity: 1 },
        ...(secondaryDefinitionId ? [{ definitionId: secondaryDefinitionId, quantity: 1 }] : []),
      ],
      reward: { coins: 22 + index * 7, mergeXp: 18 + index * 5, friendshipXp: 8, energy },
      createdAt: now, signature: false, purpose: 'normal' as const,
      storyArcId: chapter.arcId, storyBeatId: `${familyId}:chapter-1:regular-orders`,
      storyTargetLevel: 7, storyStep: index + 1, storyStepCount: orderTemplateKeys.length,
    }];
  });
}

function genericFamilyStoryOrders(
  state: MergeWorldState,
  characterId: MergeCharacterId,
  targetLevel: number,
  now: number,
  actPhase?: string,
  requestedTemplateKeys: string[] = [],
): MergeOrder[] {
  const profile = KATCHIMERA_MERGE_PROFILES[characterId];
  const [first, second] = profile.coreChains;
  const unlockedGuest = profile.guestChains.find((chainId) => state.generators[GENERATOR_BY_CHAIN[chainId]]);
  const guestOrCore = unlockedGuest ?? second;
  const tier = Math.max(2, Math.min(6, 2 + Math.floor((targetLevel - 2) / 2)));
  const arcId = `${characterId}:merge-story`;
  const order = (
    key: string,
    title: string,
    requirements: MergeOrder['requirements'],
    step: number,
    count: number,
    signature = false,
  ): MergeOrder => ({
    id: `merge-story:${characterId}:${key}`,
    characterId,
    title,
    description: profile.narrativeTheme,
    narrativeSignal: targetLevel % 4 === 0 ? 'connection' : targetLevel % 3 === 0 ? 'curiosity' : 'comfort',
    difficulty: signature ? 'major' : requirements.length > 1 || tier >= 4 ? 'medium' : 'small',
    requirements,
    reward: { coins: 22 + tier * 10, mergeXp: 18 + tier * 8, friendshipXp: signature ? 32 : 12, energy: signature ? 5 : requirements.length > 1 ? 3 : 2 },
    createdAt: now,
    signature,
    purpose: signature ? 'signature' : 'normal',
    chapterId: signature ? `${characterId}-merge-chapter-${Math.max(1, Math.floor(targetLevel / 4))}` : undefined,
    storyArcId: arcId,
    storyBeatId: `${arcId}:level-${targetLevel}`,
    storyTargetLevel: targetLevel,
    storyStep: step,
    storyStepCount: count,
  });

  if (actPhase === 'regular_orders') {
    const keys = requestedTemplateKeys.length ? requestedTemplateKeys.slice(0, 5) : Array.from({ length: 5 }, (_, index) => `regular-${index + 1}`);
    return keys.map((key, index) => {
      const primary = index % 2 === 0 ? first : second;
      const secondary = index % 3 === 2 ? guestOrCore : index % 2 === 0 ? second : first;
      const requirements = index < 1
        ? [{ definitionId: `${primary}:${tier}`, quantity: 1 }]
        : [{ definitionId: `${primary}:${tier}`, quantity: 1 }, { definitionId: `${secondary}:${Math.max(2, tier - 1)}`, quantity: 1 }];
      return order(`regular:${key}`, `Request ${index + 1}: a lived-in detail`, requirements, index + 1, keys.length);
    });
  }

  if (actPhase === 'signature_order' || targetLevel > 3 && targetLevel % 4 === 0) {
    return [order(`level-${targetLevel}:signature`, 'A chapter worth remembering', [
      { definitionId: `${first}:${Math.min(6, tier + 1)}`, quantity: 1 },
      { definitionId: `${second}:${tier}`, quantity: 1 },
    ], 1, 1, true)];
  }

  return [order(`level-${targetLevel}`, 'Something from today', targetLevel <= 2
    ? [{ definitionId: `${first}:2`, quantity: 1 }]
    : [
        { definitionId: `${first}:${tier}`, quantity: 1 },
        { definitionId: `${targetLevel >= 5 ? guestOrCore : second}:${Math.max(2, tier - 1)}`, quantity: 1 },
      ], 1, 1)];
}

function feastleStoryOrders(state: MergeWorldState, targetLevel: number, now: number, actPhase?: string, orderTemplateKeys: string[] = []): MergeOrder[] {
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
            : 'guestDefinitionId' in template && 'guestGeneratorId' in template && state.generators[template.guestGeneratorId]
              ? [{ definitionId: template.guestDefinitionId, quantity: 1 }]
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
      description: 'A generous shared table and celebration cake made from everything the Pantry has taught us.',
      narrativeSignal: 'connection',
      difficulty: 'major',
      requirements: [{ definitionId: 'food:table:5', quantity: 1 }, { definitionId: 'food:dessert:5', quantity: 1 }],
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
      requirements: [
        { definitionId: dish.definitionId, quantity: dish.quantity },
        ...(dish.secondaryDefinitionId ? [{ definitionId: dish.secondaryDefinitionId, quantity: 1 }] : []),
      ],
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
  const isCakeRequest = targetLevel % 2 === 1;
  return {
    title: isCakeRequest ? 'A village cake request' : 'A village table request',
    definitionId: `food:${isCakeRequest ? 'dessert' : 'table'}:${tier}`,
    quantity: targetLevel >= 16 ? 2 : 1,
  };
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
    unlockedFamilies: [...new Set([...state.unlockedFamilies, ...definition.chainIds.map((chainId) => MERGE_ITEMS_BY_ID.get(`${chainId}:1`)?.familyId).filter((id): id is MergeWorldState['unlockedFamilies'][number] => Boolean(id))])],
    unlockedChains: [...new Set([...state.unlockedChains, ...definition.chainIds])],
  };
}

function ensureCharacterGenerators(state: MergeWorldState, characterId: MergeCharacterId, now: number): MergeWorldState {
  const generatorIds = [...new Set(KATCHIMERA_MERGE_PROFILES[characterId].coreChains.map((chainId) => GENERATOR_BY_CHAIN[chainId]))];
  return generatorIds.reduce((current, generatorId) => ensureGenerator(current, generatorId, now), state);
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
  if (energy.value < energy.regenCap && now > energy.lastRegenAt) {
    const ticks = Math.floor((now - energy.lastRegenAt) / MERGE_ENERGY_REGEN_MS);
    if (ticks > 0) {
      const value = Math.min(energy.regenCap, energy.value + ticks);
      energy = { ...energy, value, lastRegenAt: value >= energy.regenCap ? now : energy.lastRegenAt + ticks * MERGE_ENERGY_REGEN_MS };
      changedState = true;
    }
  } else if (energy.value >= energy.regenCap && energy.lastRegenAt !== now) {
    energy = { ...energy, lastRegenAt: now };
    changedState = true;
  }
  return changedState ? touch({ ...state, energy }, now) : state;
}

function generatorState(id: string): MergeGeneratorState {
  const definition = MERGE_GENERATORS_BY_ID.get(id) ?? MERGE_GENERATORS[0];
  return {
    id: definition.id,
    name: definition.name,
    level: 1,
    upgradeFragments: 0,
    chainIds: [...definition.chainIds],
    tierOneDropDefinitionIds: [...definition.tierOneDropDefinitionIds],
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
  if (level >= 15) return 16;
  if (level >= 11) return 14;
  if (level >= 7) return 12;
  if (level >= 3) return 10;
  return 8;
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

function normalizeArrivals(value: unknown): MergeWorldArrival[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate): MergeWorldArrival[] => {
    if (!candidate || typeof candidate !== 'object') return [];
    const arrival = candidate as Partial<MergeWorldArrival>;
    if (typeof arrival.id !== 'string'
      || (arrival.kind !== 'contextual_parcel' && arrival.kind !== 'memory_arrival' && arrival.kind !== 'goal_chest')
      || typeof arrival.dayId !== 'string'
      || typeof arrival.label !== 'string'
      || !MERGE_CHAIN_IDS.includes(arrival.chainId as MergeWorldArrival['chainId'])) return [];
    const item = MERGE_ITEMS_BY_ID.get(`${arrival.chainId}:1`);
    if (!item) return [];
    const memoryRef = arrival.memoryRef && typeof arrival.memoryRef.dayId === 'string' && typeof arrival.memoryRef.journalRecordId === 'string'
      && (arrival.memoryRef.sourceKind === 'manual' || arrival.memoryRef.sourceKind === 'photo' || arrival.memoryRef.sourceKind === 'text_note' || arrival.memoryRef.sourceKind === 'voice_note')
      ? arrival.memoryRef
      : undefined;
    return [{
      id: arrival.id,
      kind: arrival.kind,
      createdAt: finite(arrival.createdAt, 0),
      dayId: arrival.dayId,
      label: arrival.label,
      theme: arrival.theme ?? 'memory',
      familyId: item.familyId,
      chainId: arrival.chainId as MergeWorldArrival['chainId'],
      characterId: arrival.characterId && KNOWN_CHARACTERS.has(arrival.characterId) ? arrival.characterId : undefined,
      source: arrival.source === 'journal' || arrival.source === 'companion_story' || arrival.source === 'goal' || arrival.source === 'legacy'
        ? arrival.source
        : arrival.kind === 'goal_chest'
          ? 'goal'
          : arrival.id.includes('companion-story-starter') ? 'companion_story' : arrival.kind === 'memory_arrival' ? 'journal' : 'legacy',
      itemDefinitionIds: uniqueStrings(arrival.itemDefinitionIds).filter((id) => MERGE_ITEMS_BY_ID.has(id)),
      memoryRef,
      claimedAt: arrival.claimedAt == null ? null : finite(arrival.claimedAt, 0),
      seenAt: arrival.seenAt == null ? null : finite(arrival.seenAt, 0),
    }];
  }).slice(-40);
}

function migrateActivityInbox(state: MergeWorldState): MergeWorldState {
  const activityEntries = state.rewardInbox.filter((entry) => entry.source === 'activity');
  if (!activityEntries.length) return state;
  const fallbackCharacterId = state.favouriteCharacterId
    ?? (state.unlockedCharacters.includes('feastle') ? 'feastle' : state.unlockedCharacters[0])
    ?? 'feastle';
  let arrivals = state.arrivals;
  for (const entry of activityEntries) {
    const encodedFamilyId = entry.id.match(/^activity:companion-story-starter:([^:]+)$/)?.[1] as MergeCharacterId | undefined;
    const hasKnownEncodedFamily = Boolean(encodedFamilyId && KNOWN_CHARACTERS.has(encodedFamilyId));
    const characterId = hasKnownEncodedFamily ? encodedFamilyId : fallbackCharacterId;
    const profile = characterId ? KATCHIMERA_MERGE_PROFILES[characterId] : null;
    if (!characterId || !profile) continue;
    const itemDefinitionIds = profile.coreChains.map((chainId) => `${chainId}:1`).filter((id) => MERGE_ITEMS_BY_ID.has(id));
    const chainId = profile.coreChains[0];
    const primaryItem = MERGE_ITEMS_BY_ID.get(`${chainId}:1`);
    const arrivalId = `arrival:migrated:${entry.id}`;
    if (!primaryItem || arrivals.some((arrival) => arrival.id === arrivalId)) continue;
    arrivals = [...arrivals, {
      id: arrivalId,
      kind: 'contextual_parcel',
      createdAt: entry.createdAt,
      dayId: localDayId(entry.createdAt),
      label: `${MERGE_CHARACTER_NAMES[characterId]}'s parcel`,
      theme: primaryItem.familyId === 'food' ? 'food'
        : primaryItem.familyId === 'drink' ? 'ritual'
          : primaryItem.familyId === 'adventure' ? 'movement'
            : primaryItem.familyId === 'nature' ? 'nature'
              : primaryItem.familyId === 'comfort' ? 'rest'
                : primaryItem.familyId === 'social' ? 'connection'
                  : primaryItem.familyId === 'mind' ? 'focus' : 'creativity',
      familyId: primaryItem.familyId,
      chainId,
      characterId,
      source: hasKnownEncodedFamily ? 'companion_story' : 'legacy',
      itemDefinitionIds,
      claimedAt: null,
      seenAt: null,
    }];
  }
  return { ...state, arrivals, rewardInbox: state.rewardInbox.filter((entry) => entry.source !== 'activity') };
}

function normalizeLandmarks(value: unknown): MergeWorldLandmark[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((candidate): MergeWorldLandmark[] => {
    if (!candidate || typeof candidate !== 'object') return [];
    const landmark = candidate as Partial<MergeWorldLandmark>;
    if (typeof landmark.id !== 'string' || seen.has(landmark.id)
      || !landmark.characterId || !KNOWN_CHARACTERS.has(landmark.characterId)
      || typeof landmark.chapterId !== 'string') return [];
    seen.add(landmark.id);
    return [{ id: landmark.id, characterId: landmark.characterId, chapterId: landmark.chapterId, unlockedAt: finite(landmark.unlockedAt, 0) }];
  });
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
        ? { kind: 'generator', generatorId: migrateGeneratorId(occupant.generatorId) }
        : null,
  };
}

function dedupeMigratedGenerators(board: MergeBoardCell[]): MergeBoardCell[] {
  const seen = new Set<string>();
  return board.map((cell) => {
    if (cell.occupant?.kind !== 'generator') return cell;
    if (seen.has(cell.occupant.generatorId)) return { ...cell, occupant: null };
    seen.add(cell.occupant.generatorId);
    return cell;
  });
}

function migrateGeneratorId(id: string): string {
  return MERGE_GENERATOR_MIGRATION_ALIASES[id] ?? id;
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
    && MERGE_GENERATORS_BY_ID.has(migrateGeneratorId(receipt.generatorId))
    && Number.isFinite(receipt.createdAt)
    && (receipt.seenAt == null || Number.isFinite(receipt.seenAt));
}

function uniqueGeneratorUnlockReceipts(value: unknown): MergeWorldState['generatorUnlockReceipts'] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, MergeWorldState['generatorUnlockReceipts'][number]>();
  for (const receipt of value) {
    if (!validGeneratorUnlockReceipt(receipt)) continue;
    const generatorId = migrateGeneratorId(receipt.generatorId);
    const normalized = { ...receipt, id: `generator-unlock:${generatorId}`, generatorId };
    const existing = byId.get(normalized.id);
    // Preserve an acknowledgement if either duplicate was already seen.
    if (!existing || (existing.seenAt == null && normalized.seenAt != null)) byId.set(normalized.id, normalized);
  }
  return [...byId.values()];
}

function normalizeGenerator(value: unknown, id: string): MergeGeneratorState {
  const migratedId = migrateGeneratorId(id);
  const fallback = generatorState(migratedId);
  if (!value || typeof value !== 'object') return fallback;
  const generator = value as Partial<MergeGeneratorState>;
  return {
    id: fallback.id,
    name: typeof generator.name === 'string' ? generator.name : fallback.name,
    level: Math.max(1, Math.floor(finite(generator.level, 1))),
    upgradeFragments: Math.max(0, Math.floor(finite(generator.upgradeFragments, 0))),
    chainIds: [...fallback.chainIds],
    tierOneDropDefinitionIds: [...fallback.tierOneDropDefinitionIds],
  };
}

function normalizeGenerators(value: object): Record<string, MergeGeneratorState> {
  const normalized: Record<string, MergeGeneratorState> = {};
  for (const [legacyId, generator] of Object.entries(value)) {
    const id = migrateGeneratorId(legacyId);
    if (!MERGE_GENERATORS_BY_ID.has(id)) continue;
    const candidate = normalizeGenerator(generator, id);
    const existing = normalized[id];
    normalized[id] = existing && existing.level > candidate.level ? existing : candidate;
  }
  return normalized;
}

function reconcileUnlockedCatalog(state: MergeWorldState): MergeWorldState {
  const unlockedChains = [...new Set([
    ...state.unlockedChains,
    ...Object.keys(state.generators).flatMap((generatorId) => MERGE_GENERATORS_BY_ID.get(generatorId)?.chainIds ?? []),
  ])];
  const unlockedFamilies = [...new Set([
    ...state.unlockedFamilies,
    ...unlockedChains.map((chainId) => MERGE_ITEMS_BY_ID.get(`${chainId}:1`)?.familyId).filter((id): id is MergeWorldState['unlockedFamilies'][number] => Boolean(id)),
  ])];
  return unlockedChains.length === state.unlockedChains.length && unlockedFamilies.length === state.unlockedFamilies.length
    ? state
    : { ...state, unlockedChains, unlockedFamilies };
}

export function mergeOrderEnergyRefund(order: MergeOrder): number {
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
