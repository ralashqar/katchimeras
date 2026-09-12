import { localDayId } from '@/utils/world-identity-rules';
import { GLOW } from '@/constants/glow';
import { MOSSPROUT_DREAM_ECHOES, MERGE_GENERATORS_BY_ID, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { SHARED_WORLD_PURCHASES } from '@/constants/shared-world';
import type { TutorialGeneratorRule } from './tutorial-generator-policy';
import type { MergeOrder, MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';

export const GLOW_GATEWAY_ID = 'mossprout:overgrown-trail' as const;
export const GLOW_ORDER_IDS = ['mossprout:glow:plant-1', 'mossprout:glow:plant-2'] as const;
/** The parcel the Garden Basket arrives in: the first thing the player opens on the Garden board. */
export const MOSSPROUT_BASKET_ARRIVAL_ID = 'arrival:ftue:garden-basket';
/** The lesson's board layout: 3 is the Basket by parcel on a board with no loose items. An older layout is re-prepared. */
export const GLOW_LESSON_LAYOUT_VERSION = 3 as const;
export const GLOW_ECHO_IDS = ['glow:seed', 'glow:sprout'] as const;
export const GLOW_REPEAT_ECHO_IDS = ['glow:repeat:seed', 'glow:repeat:sprout', 'glow:repeat:plant', 'glow:repeat:flower', 'glow:repeat:rare-flower'] as const;
export const GLOW_SINGLE_ECHO_IDS = GLOW_REPEAT_ECHO_IDS.slice(1, 4);
export const GLOW_GENERATOR_RULE: TutorialGeneratorRule = {
  generatorId: 'wild-garden', defaultDefinitionId: 'nature:garden:1',
  matches: GLOW_ECHO_IDS.map((echoId, index) => ({ echoId, definitionId: `nature:garden:${index + 1}` })),
  orderId: GLOW_ORDER_IDS[0], orderDefinitionId: 'nature:garden:3',
};
/** The Garden lesson: Seeds only from the Basket, grown the player's way into the Plant the request asks for. */
export const GLOW_REPEAT_GENERATOR_RULE: TutorialGeneratorRule = {
  generatorId: 'wild-garden', defaultDefinitionId: 'nature:garden:1',
  matches: [],
  orderId: GLOW_ORDER_IDS[1], orderDefinitionId: 'nature:garden:3',
};

export function glowGeneratorRule() {
  return GLOW_REPEAT_GENERATOR_RULE;
}

export function glowTutorialDrop(state: MergeWorldState, generatorId: string) {
  const lesson = state.glowDiscoveryLesson;
  if (!lesson || generatorId !== GLOW_GENERATOR_RULE.generatorId || lesson.servedOrderIds.includes(GLOW_ORDER_IDS[1])) return null;
  // Seeds, and only Seeds, until the request is served: the Plant is grown, never dropped.
  return glowGeneratorRule().defaultDefinitionId;
}
export const WORLD_UNLOCK_CATALOG = Object.fromEntries(SHARED_WORLD_PURCHASES.map((tile) => [tile.unlockId, { ...tile, destination: tile.companion }]));

/** Paid exploration is independent of relationship-based environment stages. */
export function glowGatewayState(state: MergeWorldState): 'egg' | 'open' | 'locked' | undefined {
  if (state.companionDiscovery.records.some((record) => record.characterId === 'steppling')) return 'open';
  if (state.worldUnlocks?.[GLOW_GATEWAY_ID]) return 'egg';
  return 'locked';
}

export function glowDiscoveryOrder(index: 0 | 1, now: number): MergeOrder {
  return {
    id: GLOW_ORDER_IDS[index], characterId: 'mossprout', title: index === 0 ? 'A little light' : 'Light for the trail',
    description: index === 0 ? 'Grow a Plant to earn 20 Glow.' : 'Grow a Plant. The trail needs forty Glow.', difficulty: 'small',
    requirements: [{ definitionId: 'nature:garden:3', quantity: 1 }],
    reward: { coins: index === 0 ? GLOW.tutorialRequestReward : GLOW.mistUnlockCost, energy: 0, mergeXp: 15, friendshipXp: 0 },
    createdAt: now, signature: false, purpose: 'normal', storyArcId: 'mossprout:glow-discovery',
  };
}

function changed(state: MergeWorldState, next: MergeWorldState, now: number): MergeWorldCommandResult {
  return { state: { ...next, revision: state.revision + 1, updatedAt: now }, changed: true };
}

export function reduceGlowDiscovery(state: MergeWorldState, command: Extract<MergeWorldCommand, { type: 'unlockWorldTarget' | 'transferDiscoveryEgg' | 'hatchWorldEgg' | 'prepareGlowDiscoveryLesson' }>): MergeWorldCommandResult {
  const no = (message?: string): MergeWorldCommandResult => ({ state, changed: false, message });
  if (command.type === 'prepareGlowDiscoveryLesson') {
    const lesson = state.glowDiscoveryLesson;
    const orderIndex = 1;
    if (lesson && (lesson.servedOrderIds.includes(GLOW_ORDER_IDS[1]) || lesson.layoutVersion === GLOW_LESSON_LAYOUT_VERSION)) return no();
    // The Basket may still be in its parcel: the lesson's first beat opens it, and the claim installs the generator.
    let generators = state.generators;
    let arrivals = state.arrivals;
    const board = state.board.map((cell) => ({ ...cell }));
    // The board the lesson starts on is empty: only the parcel brings the spawner in. A profile from
    // before that (the Basket already on the board, or an older lesson under way with its Seeds and
    // sleepers), or one whose Basket was put on the board while its parcel still waited on the tray,
    // is brought to the same start, as long as it has earned nothing else yet: the Basket goes back
    // into its parcel, the loose items on the open cells go, and the Basket's reward page is owed
    // again, so the parcel is opened and greeted the way it is meant to be. Once the parcel has been
    // opened the Basket is the player's, and nothing here touches it.
    const basketCell = board.findIndex((cell) => cell.occupant?.kind === 'generator' && cell.occupant.generatorId === 'wild-garden');
    const basketArrival = arrivals.find((arrival) => arrival.id === MOSSPROUT_BASKET_ARRIVAL_ID);
    const preEconomy = Object.keys(state.generators).every((id) => id === 'wild-garden') && (!basketArrival || basketArrival.claimedAt == null);
    let generatorUnlockReceipts = state.generatorUnlockReceipts;
    if (preEconomy) {
      const definition = MERGE_GENERATORS_BY_ID.get('wild-garden')!;
      const item = MERGE_ITEMS_BY_ID.get(definition.tierOneDropDefinitionIds[0])!;
      if (basketCell >= 0) board[basketCell] = { ...board[basketCell], occupant: null };
      for (const cell of board) {
        if (!cell.locked && !cell.mist && cell.occupant?.kind === 'item') cell.occupant = null;
      }
      generators = Object.fromEntries(Object.entries(state.generators).filter(([id]) => id !== 'wild-garden'));
      generatorUnlockReceipts = state.generatorUnlockReceipts.filter((receipt) => receipt.generatorId !== 'wild-garden');
      if (!basketArrival) {
        arrivals = [...arrivals, {
          id: MOSSPROUT_BASKET_ARRIVAL_ID, kind: 'contextual_parcel', generatorId: 'wild-garden', createdAt: command.now, dayId: localDayId(new Date(command.now)),
          label: definition.name, theme: 'memory', familyId: item.familyId, chainId: definition.chainIds[0], source: 'companion_story', itemDefinitionIds: [], claimedAt: null, seenAt: null,
        }];
      }
    }
    const generator = generators['wild-garden'];
    // Retire the old lessons' sleeping targets without touching owned items; nothing new is planted, the
    // sleepers were taught on Steppling's board and the Plant is grown from Seeds alone.
    const retiredIds: readonly string[] = [...GLOW_ECHO_IDS, ...GLOW_REPEAT_ECHO_IDS, MOSSPROUT_DREAM_ECHOES[0].id];
    for (const cell of board) {
      if (!cell.occupant && cell.mist?.kind === 'echo' && retiredIds.includes(cell.mist.id)) cell.mist = { kind: 'dormant' };
    }
    return changed(state, {
      ...state, board, arrivals, generatorUnlockReceipts,
      glowDiscoveryLesson: { preparedAt: lesson?.preparedAt ?? command.now, servedOrderIds: lesson?.servedOrderIds ?? [], guidedOrderIndex: orderIndex, layoutVersion: GLOW_LESSON_LAYOUT_VERSION },
      generators: generator ? { ...generators, 'wild-garden': { ...generator, forcedDropDefinitionId: 'nature:garden:1' } } : generators,
      activeOrders: [...state.activeOrders.filter((order) => order.id !== 'mossprout:ftue:help-garden-wake' && !(GLOW_ORDER_IDS as readonly string[]).includes(order.id)), glowDiscoveryOrder(orderIndex, command.now)],
    }, command.now);
  }
  const definition = Object.prototype.hasOwnProperty.call(WORLD_UNLOCK_CATALOG, command.targetId) ? WORLD_UNLOCK_CATALOG[command.targetId] : undefined;
  if (!definition) return no('This path is not available.');
  const existing = state.worldUnlocks?.[command.targetId];
  if (command.type === 'unlockWorldTarget') {
    const savedReceipt = command.receiptId ? state.storyWorldMutationReceipts.find((receipt) => receipt.id === command.receiptId) : undefined;
    if (savedReceipt) return { ...no(), storyWorldMutationReceipt: savedReceipt };
    if (existing && !command.receiptId) return no();
    const owned = state.companionDiscovery.records.some((record) => record.characterId === definition.destination);
    const cost = existing || owned ? 0 : definition.price;
    if (state.coins < cost) return no('Complete requests to earn more Glow.');
    const receipt = command.receiptId ? {
      id: command.receiptId, kind: 'haven_upgrade' as const,
      target: { kind: 'haven_structure' as const, structureId: definition.tileId },
      fromLevel: existing || owned ? 1 : 0, toLevel: 1,
      economyMode: 'normal' as const, coinCost: cost, createdAt: command.now,
    } : undefined;
    return { ...changed(state, { ...state, coins: state.coins - cost,
      storyWorldMutationReceipts: receipt ? [...state.storyWorldMutationReceipts, receipt] : state.storyWorldMutationReceipts,
      worldUnlocks: {
        ...state.worldUnlocks, [command.targetId]: existing ?? { unlockedAt: command.now, paid: cost, destination: definition.destination, transferredAt: owned ? command.now : null, hatchedAt: owned ? command.now : null },
      },
    }, command.now), storyWorldMutationReceipt: receipt };
  }
  if (!existing) return no('Clear the mist first.');
  if (command.type === 'transferDiscoveryEgg') {
    if (existing.transferredAt) return no();
    return changed(state, { ...state, worldUnlocks: { ...state.worldUnlocks, [command.targetId]: { ...existing, transferredAt: command.now } } }, command.now);
  }
  if (!existing.transferredAt) return no('Follow the glow to this Egg’s home first.');
  if (existing.hatchedAt) return no();
  const records = state.companionDiscovery.records;
  return changed(state, {
    ...state, worldUnlocks: { ...state.worldUnlocks, [command.targetId]: { ...existing, hatchedAt: command.now } },
    unlockedCharacters: [...new Set([...state.unlockedCharacters, definition.destination])],
    companionDiscovery: {
      ...state.companionDiscovery,
      records: records.some((record) => record.characterId === definition.destination) ? records : [...records, {
        characterId: definition.destination, source: 'ftue_hatch', gateId: 'gate-2-steppling', pathId: 'overgrown-trail',
        discoveredAt: command.now, revealSeenAt: command.now, firstOrderCompletedAt: null, permanentFeatureId: null,
      }],
      openedGateIds: [...new Set([...state.companionDiscovery.openedGateIds, 'gate-2-steppling'])],
      completedGateIds: [...new Set([...state.companionDiscovery.completedGateIds, 'gate-2-steppling'])],
    },
  }, command.now);
}

/** Validate additive save fields without changing balances or existing ownership. */
export function normalizeGlowDiscoveryFields(source: Partial<MergeWorldState>): Pick<MergeWorldState, 'worldUnlocks' | 'glowDiscoveryLesson'> {
  const time = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const worldUnlocks: MergeWorldState['worldUnlocks'] = {};
  for (const tile of SHARED_WORLD_PURCHASES) {
    const raw = source.worldUnlocks?.[tile.unlockId];
    if (raw && raw.destination === tile.companion && time(raw.unlockedAt)) worldUnlocks[tile.unlockId] = {
      ...raw, paid: time(raw.paid) ? raw.paid : 0,
      transferredAt: time(raw.transferredAt) ? raw.transferredAt : null,
      hatchedAt: time(raw.hatchedAt) ? raw.hatchedAt : null,
    };
    // A durable paid receipt can repair older snapshots missing the unlock field.
    // This does not charge again or infer ownership/hatching from story completion.
    const receipts = Array.isArray(source.storyWorldMutationReceipts) ? source.storyWorldMutationReceipts : [];
    const receipt = receipts.find((entry) => entry?.kind === 'haven_upgrade'
      && entry.target?.kind === 'haven_structure' && entry.target.structureId === tile.tileId
      && entry.toLevel === 1 && entry.economyMode === 'normal' && time(entry.createdAt));
    if (!worldUnlocks[tile.unlockId] && receipt) worldUnlocks[tile.unlockId] = {
      unlockedAt: receipt.createdAt, paid: time(receipt.coinCost) ? receipt.coinCost : 0,
      destination: tile.companion, transferredAt: null, hatchedAt: null,
    };
  }
  const lesson = source.glowDiscoveryLesson;
  return { worldUnlocks, glowDiscoveryLesson: lesson && time(lesson.preparedAt) ? {
    preparedAt: lesson.preparedAt, spawnedAt: time(lesson.spawnedAt) ? lesson.spawnedAt : undefined,
    guidedOrderIndex: lesson.guidedOrderIndex === 1 ? 1 : 0,
    layoutVersion: lesson.layoutVersion === 3 ? 3 : lesson.layoutVersion === 2 ? 2 : undefined,
    servedOrderIds: Array.isArray(lesson.servedOrderIds) ? [...new Set(lesson.servedOrderIds.filter((id) => (GLOW_ORDER_IDS as readonly string[]).includes(id)))] : [],
  } : undefined };
}

/** A delivered request pays through the normal Serve reducer, then queues the next request. */
export function advanceGlowRequests(state: MergeWorldState, orderId: string, now: number): MergeWorldState {
  if (!(GLOW_ORDER_IDS as readonly string[]).includes(orderId) || !state.glowDiscoveryLesson) return state;
  const servedOrderIds = [...new Set([...state.glowDiscoveryLesson.servedOrderIds, orderId])];
  const generator = state.generators['wild-garden'];
  return {
    ...state, glowDiscoveryLesson: { ...state.glowDiscoveryLesson, servedOrderIds },
    activeOrders: orderId === GLOW_ORDER_IDS[0] && !servedOrderIds.includes(GLOW_ORDER_IDS[1]) && !state.activeOrders.some((order) => order.id === GLOW_ORDER_IDS[1])
      ? [...state.activeOrders, glowDiscoveryOrder(1, now)] : state.activeOrders,
    generators: orderId === GLOW_ORDER_IDS[1] && generator ? { ...state.generators, 'wild-garden': { ...generator, forcedDropDefinitionId: null } } : state.generators,
  };
}
