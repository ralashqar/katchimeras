import { GLOW } from '@/constants/glow';
import { MERGE_WORLD_COLUMNS, MOSSPROUT_DREAM_ECHOES } from '@/constants/merge-world-catalog';
import { SHARED_WORLD_PURCHASES } from '@/constants/shared-world';
import { tutorialGeneratorDrop, type TutorialGeneratorRule } from './tutorial-generator-policy';
import type { MergeOrder, MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';

export const GLOW_GATEWAY_ID = 'mossprout:overgrown-trail' as const;
export const GLOW_ORDER_IDS = ['mossprout:glow:plant-1', 'mossprout:glow:plant-2'] as const;
export const GLOW_ECHO_IDS = ['glow:seed', 'glow:sprout'] as const;
export const GLOW_REPEAT_ECHO_IDS = ['glow:repeat:seed', 'glow:repeat:sprout', 'glow:repeat:plant', 'glow:repeat:flower', 'glow:repeat:rare-flower'] as const;
export const GLOW_GENERATOR_RULE: TutorialGeneratorRule = {
  generatorId: 'wild-garden', defaultDefinitionId: 'nature:garden:1',
  matches: GLOW_ECHO_IDS.map((echoId, index) => ({ echoId, definitionId: `nature:garden:${index + 1}` })),
  orderId: GLOW_ORDER_IDS[0], orderDefinitionId: 'nature:garden:3',
};
export const GLOW_REPEAT_GENERATOR_RULE: TutorialGeneratorRule = {
  generatorId: 'wild-garden', defaultDefinitionId: 'nature:garden:1',
  matches: GLOW_REPEAT_ECHO_IDS.map((echoId, index) => ({ echoId, definitionId: `nature:garden:${index + 1}` })),
  orderId: GLOW_ORDER_IDS[1], orderDefinitionId: 'nature:garden:6',
};

export function glowGeneratorRule(state: MergeWorldState) {
  return state.glowDiscoveryLesson?.servedOrderIds.includes(GLOW_ORDER_IDS[0]) ? GLOW_REPEAT_GENERATOR_RULE : GLOW_GENERATOR_RULE;
}

export function glowTutorialDrop(state: MergeWorldState, generatorId: string) {
  const lesson = state.glowDiscoveryLesson;
  if (!lesson || generatorId !== GLOW_GENERATOR_RULE.generatorId || GLOW_ORDER_IDS.every((id) => lesson.servedOrderIds.includes(id))) return null;
  return tutorialGeneratorDrop(state, glowGeneratorRule(state), lesson.servedOrderIds);
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
    id: GLOW_ORDER_IDS[index], characterId: 'mossprout', title: index === 0 ? 'A little light' : 'Keep the Garden growing',
    description: index === 0 ? 'Grow a Plant to earn 20 Glow.' : 'Free the bound pieces and grow a Magical Plant for 20 more Glow.', difficulty: index === 0 ? 'small' : 'medium',
    requirements: [{ definitionId: index === 0 ? 'nature:garden:3' : 'nature:garden:6', quantity: 1 }],
    reward: { coins: GLOW.tutorialRequestReward, energy: 0, mergeXp: 15, friendshipXp: 0 },
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
    const orderIndex = lesson?.servedOrderIds.includes(GLOW_ORDER_IDS[0]) ? 1 : 0;
    if (lesson && (lesson.servedOrderIds.includes(GLOW_ORDER_IDS[1]) || (lesson.guidedOrderIndex ?? 0) === orderIndex)) return no();
    const generator = state.generators['wild-garden'];
    if (!generator) return no('Open the Garden first.');
    const board = state.board.map((cell) => ({ ...cell }));
    const echoIds = orderIndex === 0 ? GLOW_ECHO_IDS : GLOW_REPEAT_ECHO_IDS;
    for (const [index, id] of echoIds.entries()) {
      if (board.some((cell) => cell.mist?.kind === 'echo' && cell.mist.id === id)) continue;
      const existing = board.findIndex((cell) => !cell.occupant && cell.mist?.kind === 'echo' && cell.mist.id === MOSSPROUT_DREAM_ECHOES[index].id);
      // Expand nearby mist first: do not re-lock the spaces just freed by request one.
      const anchor = MOSSPROUT_DREAM_ECHOES[index].cell;
      const distance = (slot: number) => Math.abs(slot % MERGE_WORLD_COLUMNS - anchor % MERGE_WORLD_COLUMNS) + Math.abs(Math.floor(slot / MERGE_WORLD_COLUMNS) - Math.floor(anchor / MERGE_WORLD_COLUMNS));
      const candidates = board.flatMap((cell, slot) => !cell.occupant && (!cell.mist || cell.mist.kind === 'dormant') ? [slot] : []);
      candidates.sort((a, b) => Number(board[b].mist?.kind === 'dormant') - Number(board[a].mist?.kind === 'dormant') || distance(a) - distance(b));
      const slot = existing >= 0 ? existing : candidates[0] ?? -1;
      if (slot < 0) return no('Make room in the Garden, then try again.');
      board[slot] = { ...board[slot], locked: true, blocker: 'vines', mist: { kind: 'echo', id, definitionId: `nature:garden:${index + 1}`, ownerCharacterId: 'mossprout' } };
    }
    return changed(state, {
      ...state, board, glowDiscoveryLesson: { preparedAt: lesson?.preparedAt ?? command.now, servedOrderIds: lesson?.servedOrderIds ?? [], guidedOrderIndex: orderIndex },
      generators: { ...state.generators, 'wild-garden': { ...generator, forcedDropDefinitionId: 'nature:garden:1' } },
      activeOrders: [...state.activeOrders.filter((order) => order.id !== 'mossprout:ftue:help-garden-wake' && order.id !== GLOW_ORDER_IDS[orderIndex]), glowDiscoveryOrder(orderIndex, command.now)],
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
