import { createOrderQueries } from '@incubator/merge/orders';
const { mergeOrderReady, mergeOrderRequirementReadiness, mergeOrderItemReadiness, mergeOrderServingCells, readyMergeOrderIds, boardItemCounts } = createOrderQueries();
export { mergeOrderReady, mergeOrderRequirementReadiness, mergeOrderItemReadiness, mergeOrderServingCells, readyMergeOrderIds };
import { prepareStepplingGarden, stepplingGardenDrop, stepplingShoeServed } from '@/features/onboarding/steppling-garden-lesson';
import { ensureOrdersRequireMerge } from './order-requirements';
import { ensureCompanionDailyGarden, completeDailyGardenOrder, DAILY_GARDEN_ARC, DAILY_GARDEN_BONUS } from './companion-daily-garden';
import {
  FEASTLE_STORY_REQUESTS,
  GENERATOR_BY_CHAIN,
  MERGE_GENERATORS,
  MERGE_GENERATORS_BY_ID,
  MERGE_GENERATOR_MIGRATION_ALIASES,
  MERGE_HYBRID_RECIPES,
  MERGE_ITEM_CATALOG,
  MERGE_ITEMS_BY_ID,
  MERGE_ORDER_TEMPLATES,
  MERGE_REPEATABLE_ORDER_TEMPLATES,
  MERGE_CHAIN_IDS,
  MERGE_CHAPTER_LANDMARKS,
  MERGE_CHARACTER_NAMES,
  KATCHIMERA_MERGE_PROFILES,
  MERGE_STARTING_OPEN_CELLS,
  MOSSPROUT_STORY_AWAKENINGS,
  MERGE_WORLD_SIZE,
  MOSSPROUT_ROOTBOUND_GATES_BY_ID,
  mergeLevelForXp,
} from '@/constants/merge-world-catalog';
import { advanceGlowRequests, glowTutorialDrop, normalizeGlowDiscoveryFields, reduceGlowDiscovery } from './glow-discovery-policy';
import { normalizeStepplingEgg, reduceStepplingEgg } from '@/features/onboarding/steppling-egg-policy';
import { sharedWorldPurchase } from '@/constants/shared-world';
import { COMPANION_JOURNEY_PROFILES, JOURNEY_MEDITATION_ORDER_GLOW, JOURNEY_MEDITATION_ORDER_MINUTES } from '@/constants/companion-journey-profiles';
import {
  MERGE_ENERGY_REGEN_CAP,
  MERGE_ENERGY_REGEN_MS,
  MERGE_GENERATORS_UNLIMITED,
  MERGE_INITIAL_ENERGY,
  STEPS_PER_MERGE_ENERGY,
} from '@/utils/merge-world/economy-policy';
import { AUTHORED_COHORT_ORDER_POOLS, BARISTABBIT_CHAPTER_ONE_ORDER_POOL, FEASTLE_ACT_TWO_ORDER_POOL, type AuthoredCohortFamilyId } from '@/utils/companion-story';
import type {
  MergeBoardCell,
  MergeBoardId,
  MergeBoardItem,
  HavenResidentMergeBoardState,
  MergeCharacterId,
  MergeExternalRewardReceipt,
  MergeGeneratorState,
  MergeOrder,
  MergeWorldArrival,
  MergeWorldLandmark,
  MergeWorldCommand,
  MergeWorldCommandResult,
  MergeWorldState,
  MossproutNatureIslandId,
  MossproutNatureIslandLevel,
  MossproutGardenPlantSlotId,
  PlantableMemoryInstance,
  StoryWorldMutationReceipt,
} from '@/types/merge-world';

const MOSSPROUT_GARDEN_PLANT_SLOTS: readonly MossproutGardenPlantSlotId[] = [
  'back-left', 'back-centre', 'back-right', 'front-left', 'front-centre', 'front-right',
];

const STEPPLING_HAVEN_BOARD_SIZE = 42;

function createStepplingHavenBoard(now: number): HavenResidentMergeBoardState {
  const board: MergeBoardCell[] = Array.from({ length: STEPPLING_HAVEN_BOARD_SIZE }, () => ({
    blocker: null,
    locked: false,
    mist: null,
    occupant: null,
    regionId: 'central-clearing',
  }));
  board[22] = { ...board[22], occupant: { kind: 'item', definitionId: 'adventure:trail:1', instanceId: 'haven:steppling:starter:sock:1' } };
  board[23] = { ...board[23], occupant: { kind: 'item', definitionId: 'adventure:trail:1', instanceId: 'haven:steppling:starter:sock:2' } };
  board[25] = { ...board[25], occupant: { kind: 'item', definitionId: 'adventure:travel:1', instanceId: 'haven:steppling:starter:ticket:1' } };
  board[26] = { ...board[26], occupant: { kind: 'item', definitionId: 'adventure:travel:1', instanceId: 'haven:steppling:starter:ticket:2' } };
  board[31] = { ...board[31], occupant: { kind: 'generator', generatorId: 'journey-locker' } };
  return {
    board,
    createdAt: now,
    generators: { 'journey-locker': generatorState('journey-locker') },
    revision: 0,
    storage: [],
    storageCapacity: 8,
    updatedAt: now,
  };
}

export function mergeWorldStateForBoard(state: MergeWorldState, boardId: MergeBoardId): MergeWorldState {
  if (boardId === 'mossprout') return state;
  const board = state.haven.residentMergeBoards.steppling ?? createStepplingHavenBoard(state.createdAt);
  return {
    ...state,
    board: board.board,
    generators: board.generators,
    storage: board.storage,
    storageCapacity: board.storageCapacity,
  };
}
import { advanceMossproutChapterZero, enforceMossproutChapterZeroDropOverride, isMossproutChapterZeroActive, migrateMossproutGardenMissionOrder } from '@/utils/merge-world/chapter-zero-policy';
import { havenStageDefinition, type HavenStage } from '@/constants/haven-catalog';
import {
  MOSSPROUT_NATURE_ISLAND_IDS,
  emptyMossproutNatureIslandLevels,
  mossproutNatureIslandById,
  mossproutNatureIslandLevelDefinition,
} from '@/constants/mossprout-nature-islands';
import {
  COMPANION_DISCOVERIES_BY_ID,
  DISCOVERY_FORK_ANCHOR_CELL,
  STEPPLING_DISCOVERY_ANCHOR_CELL,
  STEPPLING_DISCOVERY_GATE_ID,
  STEPPLING_DISCOVERY_ID,
} from '@/constants/companion-discovery-catalog';
import type { CompanionDiscoveryDefinition } from '@/constants/companion-discovery-catalog';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { MEMORY_CARDS_BY_ID } from '@/constants/memory-card-catalog';
import { mossproutWorldChapterForActiveDays, type MossproutWorldChapter } from '@/constants/mossprout-world-chapters';
import { MOSSPROUT_EXTENDED_JOURNEY_BEATS, mossproutExtendedBeatByObjectiveId } from '@/constants/mossprout-journey-chapters';
import { mossproutCampaignEpisodeByBeatId, mossproutCampaignEpisodeByObjectiveId } from '@/constants/mossprout-campaign';
import { MOSSPROUT_GARDEN_RESIDENT_IDS, MOSSPROUT_RESIDENT_IDS, MOSSPROUT_WEATHER_RESIDENT_IDS, mossproutResidentById } from '@/constants/mossprout-residents';
import {
  MOSSPROUT_RESIDENT_CARD_NODE_BY_GATE,
  MOSSPROUT_RESIDENT_CARD_NODE_BY_RESIDENT,
  MOSSPROUT_RESIDENT_CARD_NODES,
  LEGACY_RESIDENT_CARD_KEY_DEFINITION_ID,
  RESIDENT_CARD_DEFINITION_ID,
  RETIRED_RESIDENT_NODE_ROOT_GATE_IDS,
  residentDiscoveryOrders,
} from '@/constants/resident-card-discovery';
import type { KatchimeraSkinId } from '@/types/katchimera';
import {
  awakenMossproutRoot,
  emptyMossproutBoardProgression,
  installMossproutRootboundEchoes,
  migrateMossproutRootParcels,
  normalizeMossproutBoardProgression,
  reconcileMossproutBoardProgression,
  useGrovelightResonance as applyGrovelightResonance,
  unlockMemoryNursery,
} from '@/utils/merge-world/mossprout-board-progression';
import {
  allocateCompanionDiscoveryPath,
  allocateDiscoveryForkAnchor,
  authoredDormantMistForCell,
  boardMistPartitionIssues,
  reconcileDiscoveryMist,
} from '@/utils/merge-world/board-mist-progression';
import { isDevHavenOrderFiller } from '@/utils/merge-world/dev-haven-order-fillers';

const KNOWN_CHARACTERS = new Set<MergeCharacterId>(Object.keys(KATCHIMERA_MERGE_PROFILES) as MergeCharacterId[]);
const RECENT_ORDER_LIMIT = 8;
const DISCOVERY_EVENT_LIMIT = 100;
const DISCOVERY_FIRST_ORDER_COPY: Partial<Record<MergeCharacterId, { title: string; description: string }>> = {
  steppling: { title: 'Something for the trail', description: 'Make a Shoe from the Journey Locker and help Steppling set out.' },
  feastle: { title: 'Set the first table', description: 'Make a Snack from the Hearth Pantry for Feastle’s first table.' },
  baristabbit: { title: 'Warm the first cup', description: 'Make a Tea Cup from the Ritual Bar and welcome Baristabbit.' },
  bedrotte: { title: 'A place to settle', description: 'Make a Cushion from the Comfort Chest so Bedrotte can finally rest.' },
};

function recordDiscoveryEvent(
  progress: MergeWorldState['companionDiscovery'],
  event: MergeWorldState['companionDiscovery']['events'][number],
): MergeWorldState['companionDiscovery'] {
  if (progress.events.some((candidate) => candidate.id === event.id)) return progress;
  return { ...progress, events: [...progress.events, event].slice(-DISCOVERY_EVENT_LIMIT) };
}

export function createInitialMergeWorldState(now = Date.now(), characterIds: string[] = []): MergeWorldState {
  const board: MergeBoardCell[] = Array.from({ length: MERGE_WORLD_SIZE }, (_, index) => ({
    locked: !MERGE_STARTING_OPEN_CELLS.has(index),
    blocker: MERGE_STARTING_OPEN_CELLS.has(index) ? null : index % 3 === 0 ? 'rocks' : index % 3 === 1 ? 'clouds' : 'vines',
    regionId: regionForCell(index),
    mist: MERGE_STARTING_OPEN_CELLS.has(index) ? null : authoredDormantMistForCell(index),
    occupant: null,
  }));
  let state: MergeWorldState = {
    version: 22,
    ownerCharacterId: 'mossprout',
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
    energy: { value: MERGE_INITIAL_ENERGY, regenCap: MERGE_ENERGY_REGEN_CAP, lastRegenAt: now, regenPaused: false },
    coins: 0,
    mergeXp: 0,
    mergeLevel: 1,
    discoveries: [],
    unlockedFamilies: [],
    unlockedChains: [],
    unlockedCharacters: [],
    favouriteCharacterId: null,
    activeOrders: [],
    companionDailyGardenVersion: 1,
    companionDailyGarden: {},
    mossproutDailyGardenOrders: null,
    characterActivityOpportunities: [],
    ownedKatchimeraCards: [],
    mossproutResidentSkinIds: ['mossprout'],
    ownedMemoryCards: [],
    completedOrderCount: 0,
    recentOrderKeys: [],
    expansions: [],
    unlockedRegions: ['central-clearing', 'inner-mist'],
    boardAwakeningReceipts: [],
    processedActivityReceiptIds: [],
    activityEnergyByDay: {},
    stepEnergyByDay: {},
    lastFreeRerollDayId: null,
    characterProgress: { feastle: { friendshipLevel: 1, completedChapterIds: [] } },
    externalRewardReceipts: [],
    storyWorldMutationReceipts: [],
    companionDiscovery: {
      records: [], openedGateIds: [], completedGateIds: [], queuedGateIds: [], active: null, lastStartedDayId: null, events: [],
    },
    residentCardDiscovery: { records: [], campaignMilestoneReceiptIds: [] },
    mossproutBoardProgression: emptyMossproutBoardProgression(),
    haven: {
      tileStages: {},
      mossproutNatureIslands: emptyMossproutNatureIslandLevels(),
      revealState: 'hidden',
      mossproutStoryLevel: 0,
      nextProceduralOrder: 1,
      residentMergeBoards: { steppling: createStepplingHavenBoard(now) },
      structures: { mossproutGarden: { level: 0, featureLevels: { spring: 0, path: 0 } } },
      plantableMemories: [],
      mutationReceipts: [],
      movementEgg: { status: 'hidden', observedSteps: 0, manualMovementLogs: 0, updatedAt: null },
    },
  };
  state = reconcileCharacters(state, characterIds, now);
  if (state.unlockedCharacters.includes('mossprout')) {
    state = { ...state, board: installMossproutRootboundEchoes(state.board, state.mossproutBoardProgression) };
  }
  state = { ...state, board: installResidentCardNodes(state.board, state.residentCardDiscovery) };
  return state;
}

export function reduceMergeWorld(state: MergeWorldState, command: MergeWorldCommand): MergeWorldCommandResult {
  // Normalize before serving as well as after generating/reconciling requests.
  // This also upgrades an old in-memory request without consuming its tier-one item.
  const prepared = ensureOrdersRequireMerge(state);
  const result = reduceMergeWorldCommand(prepared, command);
  const next = ensureOrdersRequireMerge(result.state);
  if (prepared === state && next === result.state) return result;
  return { ...result, state: result.changed ? next : touch(next, command.now), changed: true };
}

function reduceMergeWorldCommand(state: MergeWorldState, command: MergeWorldCommand): MergeWorldCommandResult {
  const boardId = 'boardId' in command ? command.boardId : undefined;
  if (boardId === 'steppling') {
    const previousBoard = state.haven.residentMergeBoards.steppling ?? createStepplingHavenBoard(state.createdAt);
    const projected = mergeWorldStateForBoard(state, boardId);
    const reduced = reduceMergeWorld(projected, { ...command, boardId: 'mossprout' } as MergeWorldCommand);
    if (!reduced.changed) return { ...reduced, state };
    const nextBoard = {
      board: reduced.state.board,
      createdAt: previousBoard.createdAt,
      generators: reduced.state.generators,
      revision: previousBoard.revision + 1,
      storage: reduced.state.storage,
      storageCapacity: reduced.state.storageCapacity,
      updatedAt: command.now,
    };
    return {
      ...reduced,
      state: {
        ...reduced.state,
        board: state.board,
        generators: state.generators,
        storage: state.storage,
        storageCapacity: state.storageCapacity,
        haven: {
          ...reduced.state.haven,
          residentMergeBoards: {
            ...reduced.state.haven.residentMergeBoards,
            steppling: nextBoard,
          },
        },
      },
    };
  }
  const current = refreshTime(state, command.now);
  switch (command.type) {
    case 'refreshTime':
      return result(state, current, current === state ? undefined : 'The garden is ready again.');
    case 'tapGenerator': {
      const result = tapGenerator(current, command.generatorId, command.now, command.seed, command.activityOpportunityId);
      if (result.changed && command.generatorId === 'wild-garden' && result.state.glowDiscoveryLesson && !result.state.glowDiscoveryLesson.spawnedAt) {
        return { ...result, state: { ...result.state, glowDiscoveryLesson: { ...result.state.glowDiscoveryLesson, spawnedAt: command.now } } };
      }
      return result;
    }
    case 'setGeneratorForcedDrop':
      return setGeneratorForcedDrop(current, command.generatorId, command.definitionId, command.now);
    case 'upgradeGenerator':
      return upgradeGenerator(current, command.generatorId, command.now);
    case 'move':
      return moveItem(current, command.from, command.to, command.now);
    case 'serveOrder':
      return serveOrder(current, command.orderId, command.now);
    case 'serveDevHavenOrder':
      return serveDevHavenOrder(current, command.order, command.now);
    case 'storeItem':
      return storeItem(current, command.cell, command.now);
    case 'restoreItem':
      return restoreItem(current, command.storageIndex, command.cell, command.now);
    case 'sellItem':
      return sellItem(current, command.cell, command.now);
    case 'claimInbox':
      return claimInbox(current, command.entryId, command.now);
    case 'stepplingEgg':
      return reduceStepplingEgg(current, command.action, command.now);
    case 'grantGeneratorParcel': {
      const definition = MERGE_GENERATORS_BY_ID.get(command.generatorId);
      if (!definition || current.arrivals.some((arrival) => arrival.id === command.rewardId) || current.generators[command.generatorId]) return unchanged(current);
      const item = MERGE_ITEMS_BY_ID.get(definition.tierOneDropDefinitionIds[0])!;
      return changed(touch({ ...current, arrivals: [...current.arrivals, {
        id: command.rewardId, kind: 'contextual_parcel', generatorId: command.generatorId, createdAt: command.now, dayId: command.dayId,
        label: definition.name, theme: 'memory', familyId: item.familyId, chainId: definition.chainIds[0],
        source: 'companion_story', itemDefinitionIds: [], claimedAt: null, seenAt: null,
      }] }, command.now));
    }
    case 'prepareStepplingGardenLesson': {
      const next = prepareStepplingGarden(current, command.now);
      return next === current ? unchanged(current) : changed(touch(next, command.now));
    }
    case 'ensureCompanionDailyGarden': {
      const next = ensureProceduralOrders(ensureCompanionDailyGarden(current, command.familyId, command.now), command.now);
      return next === current ? unchanged(current) : changed(touch(next, command.now));
    }
    case 'reconcileJourneyMeditation': {
      const { cycle, now } = command;
      if (cycle.familyId !== 'steppling' && cycle.familyId !== 'mossprout') return unchanged(current);
      const characterId = cycle.familyId;
      const prefix = `journey-cycle:${characterId}:`;
      const kept = current.activeOrders.filter((order) => !order.id.startsWith(prefix));
      const orders: MergeOrder[] = now < command.availableAt && cycle.returnedAt == null ? cycle.requests.flatMap((request) => {
        if (request.kind !== 'merge' || !request.orderId || !request.definitionId || request.completedAt != null || current.externalRewardReceipts.some((receipt) => receipt.id === `merge-story-served:${request.orderId}`)) return [];
        const saved = current.activeOrders.find((order) => order.id === request.orderId);
        const rewarded = saved ? ensureOrderGlowReward(saved) : undefined;
        const description = 'Optional: brings your companion back ' + JOURNEY_MEDITATION_ORDER_MINUTES + ' minutes sooner.';
        const existing = rewarded && rewarded.description !== description ? { ...rewarded, description } : rewarded;
        return [existing ? (existing.expiresAt === command.availableAt ? existing : { ...existing, expiresAt: command.availableAt }) : { id: request.orderId, characterId, title: request.title, description, difficulty: 'small', expiresAt: command.availableAt,
          requirements: [{ definitionId: request.definitionId, quantity: 1 }], reward: { coins: JOURNEY_MEDITATION_ORDER_GLOW, mergeXp: 0, friendshipXp: 0, energy: 0 }, createdAt: cycle.completedAt,
          signature: false, purpose: 'normal', storyArcId: `${cycle.id}:meditation`, storyTargetLevel: 0 }];
      }) : [];
      const activeOrders = [...kept, ...orders];
      if (activeOrders.length === current.activeOrders.length && activeOrders.every((order, index) => order === current.activeOrders[index])) return unchanged(current);
      return changed(touch({ ...current, activeOrders }, now));
    }
    case 'grantJourneyReturn': {
      const { cycle } = command;
      const profile = COMPANION_JOURNEY_PROFILES[cycle.familyId];
      if (!profile) return unchanged(current);
      if (cycle.finale || cycle.migrated || current.processedActivityReceiptIds.includes(cycle.rewardId) || current.arrivals.some((arrival) => arrival.id === cycle.rewardId)) return unchanged(current);
      const definitionId = `${profile.mergeChainId}:1`;
      const item = MERGE_ITEMS_BY_ID.get(definitionId)!;
      return changed(touch({ ...current, processedActivityReceiptIds: [...current.processedActivityReceiptIds, cycle.rewardId], arrivals: [...current.arrivals, {
        id: cycle.rewardId, kind: 'contextual_parcel', createdAt: command.now, dayId: command.dayId,
        label: `${cycle.title} — a little gift`, theme: profile.theme,
        familyId: item.familyId, chainId: item.chainId, characterId: cycle.familyId as MergeCharacterId,
        source: 'companion_story', itemDefinitionIds: [definitionId, definitionId], claimedAt: null, seenAt: null,
      }] }, command.now));
    }
    case 'claimArrival':
      return claimArrival(current, command.arrivalId, command.now);
    case 'viewMemoryArrival':
      return viewMemoryArrival(current, command.arrivalId, command.now);
    case 'grantActivityRewardsBatch':
      return grantActivityRewardsBatch(current, command.rewards, command.now);
    case 'claimStepEnergy':
      return claimStepEnergy(current, command, command.now);
    case 'setEnergyRegenPaused': {
      if (Boolean(current.energy.regenPaused) === command.paused) return unchanged(current);
      return changed(touch({
        ...current,
        energy: { ...current.energy, regenPaused: command.paused, lastRegenAt: command.now },
      }, command.now));
    }
    case 'featureCharacter': {
      if (!current.unlockedCharacters.includes(command.characterId)) return unchanged(current);
      // Featuring controls presentation order and the companion return route.
      // Orders belong to the shared board, so changing focus must never erase
      // another Katchimera's active requests.
      if (current.favouriteCharacterId === command.characterId) return unchanged(current);
      return changed(touch({ ...current, favouriteCharacterId: command.characterId }, command.now));
    }
    case 'reconcileCharacterActivity':
      return reconcileCharacterActivity(current, command, command.now);
    case 'grantKatchimeraCard':
      return grantKatchimeraCard(current, command.cardId, command.familyId, command.sourceReceiptId, command.now);
    case 'purchaseKatchimeraCard':
      return purchaseKatchimeraCard(current, command.cardId, command.familyId, command.cost, command.purchaseId, command.now);
    case 'ackGeneratorUnlock': {
      const receipts = current.generatorUnlockReceipts.map((receipt) => receipt.id === command.receiptId && receipt.seenAt == null
        ? { ...receipt, seenAt: command.now }
        : receipt);
      if (receipts.every((receipt, index) => receipt === current.generatorUnlockReceipts[index])) return unchanged(current);
      return changed(touch({ ...current, generatorUnlockReceipts: receipts }, command.now));
    }
    case 'rerollOrder':
      return rerollOrder(current, command.orderId, command.now);
    case 'startStepplingDiscovery':
      return startStepplingDiscovery(current, command.now);
    case 'openCompanionDiscoveryGate':
      return openCompanionDiscoveryGate(current, command.gateId, command.candidateIds, command.recommendedCharacterId, command.now);
    case 'selectCompanionDiscoveryPath':
      return selectCompanionDiscoveryPath(current, command.characterId, command.now);
    case 'ackCompanionDiscoveryReveal': {
      let updated = false;
      const records = current.companionDiscovery.records.map((record) => {
        if (record.characterId !== command.characterId || record.revealSeenAt != null) return record;
        updated = true;
        return { ...record, revealSeenAt: command.now };
      });
      return updated ? changed(touch({
        ...current,
        companionDiscovery: { ...current.companionDiscovery, records },
      }, command.now)) : unchanged(current);
    }
    case 'activateResidentCardDiscovery':
      return activateResidentCardDiscovery(current, command, command.now);
    case 'ackResidentCardDialogue':
      return ackResidentCardDialogue(current, command.discoveryId, command.now);
    case 'ackResidentCardReveal':
      return ackResidentCardReveal(current, command.discoveryId, command.now);
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
    case 'reconcileMossproutBoardProgression': {
      const roots = reconcileMossproutBoardProgression(current, command.signals, command.dayId, command.now);
      const next = grantRetiredRootMilestones(roots, command.signals.activeJourneyDayIds.length, command.now);
      return result(current, next === current ? current : touch(next, command.now), next === current ? undefined : 'Mossprout’s roots shifted beneath the Mist.');
    }
    case 'useGrovelightResonance': {
      const next = applyGrovelightResonance(current, command.gateId, command.dayId, command.now);
      return next ? changed(touch(next, command.now), 'Grovelight found the matching memory.') : unchanged(current, 'Grovelight cannot resonate here yet.');
    }
    case 'revealMemoryCard': {
      let updated = false;
      const ownedMemoryCards = current.ownedMemoryCards.map((card) => {
        if (card.cardId !== command.cardId || card.revealedAt != null) return card;
        updated = true;
        return { ...card, revealedAt: command.now };
      });
      return updated ? changed(touch({ ...current, ownedMemoryCards }, command.now), 'A Memory Card revealed itself.') : unchanged(current);
    }
    case 'reconcileHavenStory': {
      if (command.characterId !== 'mossprout' || command.storyLevel <= current.haven.mossproutStoryLevel) return unchanged(current);
      return changed(touch({
        ...current,
        haven: { ...current.haven, mossproutStoryLevel: Math.max(0, Math.floor(command.storyLevel)) },
      }, command.now));
    }
    case 'upgradeHavenTile':
      return upgradeHavenTile(current, command.characterId, command.stage, command.now, command.receiptId, command.economyMode, command.grantedCoins);
    case 'upgradeMossproutNatureIsland':
      return upgradeMossproutNatureIsland(current, command.islandId, command.level, command.now, command.receiptId, command.economyMode, command.grantedCoins);
    case 'revealHaven': {
      if (current.haven.revealState === 'revealed') return unchanged(current);
      return changed(touch({ ...current, haven: { ...current.haven, revealState: 'revealed' } }, command.now), 'The Haven awakens.');
    }
    case 'grantPlantableMemory':
      return grantPlantableMemory(current, command);
    case 'placePlantableMemory':
      return placePlantableMemory(current, command);
    case 'growPlantableMemory':
      return growPlantableMemory(current, command);
    case 'upgradeHavenStructure':
      return upgradeHavenStructure(current, command);
    case 'upgradeHavenFeature':
      return upgradeHavenFeature(current, command);
    case 'unlockWorldTarget':
    case 'transferDiscoveryEgg':
    case 'hatchWorldEgg':
    case 'prepareGlowDiscoveryLesson':
      return reduceGlowDiscovery(current, command);
    case 'revealMovementEgg':
      return mutateMovementEgg(current, command.receiptId, command.now, (egg) => ({ ...egg, status: 'revealed', updatedAt: command.now }));
    case 'recordMovementEggProgress':
      return mutateMovementEgg(current, command.receiptId, command.now, (egg) => {
        const observedSteps = Math.max(egg.observedSteps, Math.floor(command.observedSteps ?? egg.observedSteps));
        const manualMovementLogs = egg.manualMovementLogs + (command.manualMovement ? 1 : 0);
        return {
          ...egg,
          observedSteps,
          manualMovementLogs,
          status: observedSteps >= 500 || manualMovementLogs > 0 ? 'stirring' : egg.status === 'hidden' ? 'revealed' : egg.status,
          updatedAt: command.now,
        };
      });
    case 'ackExternalReward': {
      const receipts = current.externalRewardReceipts.map((receipt) => receipt.id === command.receiptId && receipt.appliedAt == null
        ? { ...receipt, appliedAt: command.now }
        : receipt);
      if (receipts.every((receipt, index) => receipt === current.externalRewardReceipts[index])) return unchanged(current);
      return changed(touch({ ...current, externalRewardReceipts: receipts }, command.now));
    }
  }
}

function hasHavenMutationReceipt(state: MergeWorldState, receiptId: string) {
  return state.haven.mutationReceipts.some((receipt) => receipt.id === receiptId);
}

function withHavenMutationReceipt(
  state: MergeWorldState,
  input: { id: string; kind: MergeWorldState['haven']['mutationReceipts'][number]['kind']; targetId: string; createdAt: number },
) {
  return {
    ...state.haven,
    mutationReceipts: [...state.haven.mutationReceipts, input],
  };
}

function grantPlantableMemory(
  state: MergeWorldState,
  command: Extract<MergeWorldCommand, { type: 'grantPlantableMemory' }>,
): MergeWorldCommandResult {
  if (hasHavenMutationReceipt(state, command.receiptId)) return unchanged(state, 'This memory was already gathered.');
  const instanceId = `memory-plant:${command.receiptId}`;
  const plant: PlantableMemoryInstance = {
    id: instanceId,
    definitionId: command.definitionId,
    status: 'earned',
    slotId: null,
    growthPoints: 0,
    source: command.source,
    earnedAt: command.now,
    plantedAt: null,
  };
  const haven = withHavenMutationReceipt(state, {
    id: command.receiptId, kind: 'plantable_grant', targetId: instanceId, createdAt: command.now,
  });
  return changed(touch({
    ...state,
    haven: { ...haven, plantableMemories: [...haven.plantableMemories, plant] },
  }, command.now), `${command.definitionId} Seed gathered.`);
}

function placePlantableMemory(
  state: MergeWorldState,
  command: Extract<MergeWorldCommand, { type: 'placePlantableMemory' }>,
): MergeWorldCommandResult {
  if (hasHavenMutationReceipt(state, command.receiptId)) return unchanged(state, 'This planting was already saved.');
  if (!MOSSPROUT_GARDEN_PLANT_SLOTS.includes(command.slotId)) return unchanged(state, 'That Garden plot does not exist.');
  const selected = state.haven.plantableMemories.find((plant) => plant.id === command.instanceId);
  if (!selected) return unchanged(state, 'That memory Seed is not available.');
  const displaced = state.haven.plantableMemories.find((plant) => plant.slotId === command.slotId && plant.id !== command.instanceId);
  const previousSlot = selected.slotId;
  const plantableMemories = state.haven.plantableMemories.map((plant): PlantableMemoryInstance => {
    if (plant.id === selected.id) return { ...plant, status: 'planted', slotId: command.slotId, plantedAt: plant.plantedAt ?? command.now };
    if (plant.id === displaced?.id) return previousSlot
      ? { ...plant, status: 'planted', slotId: previousSlot }
      : { ...plant, status: 'earned', slotId: null };
    return plant;
  });
  const haven = withHavenMutationReceipt(state, {
    id: command.receiptId, kind: 'plantable_place', targetId: `${selected.id}:${command.slotId}`, createdAt: command.now,
  });
  return changed(touch({ ...state, haven: { ...haven, plantableMemories } }, command.now), 'The memory Seed is planted.');
}

function growPlantableMemory(
  state: MergeWorldState,
  command: Extract<MergeWorldCommand, { type: 'growPlantableMemory' }>,
): MergeWorldCommandResult {
  if (hasHavenMutationReceipt(state, command.receiptId)) return unchanged(state, 'This growth was already counted.');
  if (!Number.isFinite(command.amount) || command.amount <= 0) return unchanged(state, 'Growth must be positive.');
  const selected = state.haven.plantableMemories.find((plant) => plant.id === command.instanceId);
  if (!selected) return unchanged(state, 'That memory plant is not available.');
  const plantableMemories = state.haven.plantableMemories.map((plant) => plant.id === selected.id
    ? { ...plant, growthPoints: plant.growthPoints + Math.floor(command.amount) }
    : plant);
  const haven = withHavenMutationReceipt(state, {
    id: command.receiptId, kind: 'plantable_growth', targetId: selected.id, createdAt: command.now,
  });
  return changed(touch({ ...state, haven: { ...haven, plantableMemories } }, command.now), 'A small thing helped this memory grow.');
}

function upgradeHavenStructure(
  state: MergeWorldState,
  command: Extract<MergeWorldCommand, { type: 'upgradeHavenStructure' }>,
): MergeWorldCommandResult {
  if (hasHavenMutationReceipt(state, command.receiptId)) return unchanged(state, 'This Garden restoration was already applied.');
  const current = state.haven.structures.mossproutGarden.level;
  if (command.level !== current + 1) return unchanged(state, 'Garden structures restore one level at a time.');
  const haven = withHavenMutationReceipt(state, {
    id: command.receiptId, kind: 'structure_upgrade', targetId: command.structureId, createdAt: command.now,
  });
  return changed(touch({
    ...state,
    haven: { ...haven, structures: { ...haven.structures, mossproutGarden: { ...haven.structures.mossproutGarden, level: command.level } } },
  }, command.now), 'The Garden has somewhere good for memories to grow.');
}

function upgradeHavenFeature(
  state: MergeWorldState,
  command: Extract<MergeWorldCommand, { type: 'upgradeHavenFeature' }>,
): MergeWorldCommandResult {
  if (hasHavenMutationReceipt(state, command.receiptId)) return unchanged(state, 'This Garden feature was already restored.');
  const garden = state.haven.structures.mossproutGarden;
  const current = garden.featureLevels[command.featureId];
  if (garden.level < 1) return unchanged(state, 'Restore the Garden before repairing its features.');
  if (command.level !== current + 1) return unchanged(state, 'Garden features restore one level at a time.');
  const haven = withHavenMutationReceipt(state, {
    id: command.receiptId, kind: 'feature_upgrade', targetId: `${command.structureId}:${command.featureId}`, createdAt: command.now,
  });
  return changed(touch({
    ...state,
    haven: {
      ...haven,
      structures: {
        ...haven.structures,
        mossproutGarden: { ...garden, featureLevels: { ...garden.featureLevels, [command.featureId]: command.level } },
      },
    },
  }, command.now), `The Garden ${command.featureId} is flowing again.`);
}

function mutateMovementEgg(
  state: MergeWorldState,
  receiptId: string,
  now: number,
  mutate: (current: MergeWorldState['haven']['movementEgg']) => MergeWorldState['haven']['movementEgg'],
): MergeWorldCommandResult {
  if (hasHavenMutationReceipt(state, receiptId)) return unchanged(state, 'This movement was already noticed.');
  const movementEgg = mutate(state.haven.movementEgg);
  const haven = withHavenMutationReceipt(state, { id: receiptId, kind: 'movement_egg', targetId: 'movement-egg', createdAt: now });
  return changed(touch({ ...state, haven: { ...haven, movementEgg } }, now), 'Something inside the egg moved.');
}

function grantRetiredRootMilestones(state: MergeWorldState, activeDays: number, now: number): MergeWorldState {
  const receipts = new Set(state.residentCardDiscovery.campaignMilestoneReceiptIds);
  let next = state;
  const grant = (id: string, day: number, apply: (current: MergeWorldState) => MergeWorldState) => {
    if (activeDays < day || receipts.has(id)) return;
    next = apply(next);
    receipts.add(id);
  };
  grant('retired-root:day-7-two-shores', 7, (current) => {
    const installed = ensureCharacterGenerators(current, 'mossprout', now);
    const generator = installed.generators['wild-garden'];
    return generator && generator.level < 2 ? { ...installed, generators: { ...installed.generators, 'wild-garden': { ...generator, level: 2 } } } : installed;
  });
  grant('retired-root:memory-two-days', 12, (current) => current.externalRewardReceipts.some((receipt) => receipt.id === 'retired-root:wisp:fern') ? current : {
    ...current,
    externalRewardReceipts: [...current.externalRewardReceipts, { id: 'retired-root:wisp:fern', kind: 'wisp', characterId: 'mossprout', amount: 1, wispId: 'fern', sourceId: 'resident-node-migration', createdAt: now, appliedAt: null }],
  });
  grant('retired-root:focus-first', 14, (current) => {
    const installed = ensureCharacterGenerators(current, 'mossprout', now);
    const generator = installed.generators['wild-garden'];
    return generator && generator.level < 3 ? { ...installed, generators: { ...installed.generators, 'wild-garden': { ...generator, level: 3 } } } : installed;
  });
  grant('retired-root:nursery-key', 15, (current) => unlockMemoryNursery(current, now));
  grant('retired-root:memory-three-days', 17, (current) => current.rewardInbox.some((entry) => entry.id === 'retired-root:keepsake') ? current : {
    ...current,
    rewardInbox: [...current.rewardInbox, { id: 'retired-root:keepsake', createdAt: now, items: ['nature:keepsake:2'], source: 'activity' }],
  });
  const campaignMilestoneReceiptIds = [...receipts];
  return campaignMilestoneReceiptIds.length === state.residentCardDiscovery.campaignMilestoneReceiptIds.length && next === state
    ? state
    : { ...next, residentCardDiscovery: { ...next.residentCardDiscovery, campaignMilestoneReceiptIds } };
}

/**
 * Clears only the idempotency records that cap real-life Energy for one day.
 * Debug Today reset may also reopen the preceding source day's one-time Steps
 * conversion without taking back Energy that was already awarded.
 */
export function resetMergeActivityForDay(
  state: MergeWorldState,
  dayId: string,
  now = Date.now(),
  stepEnergyDayId?: string,
): MergeWorldState {
  const residentDiscoveries = state.residentCardDiscovery.records.filter((record) => record.journeyDayId === dayId);
  const residentDiscoveryIds = new Set(residentDiscoveries.map((record) => record.id));
  const residentGateIds = new Set(residentDiscoveries.map((record) => record.nodeGateId));
  const residentIds = new Set(residentDiscoveries.map((record) => record.residentId));
  const receiptIds = new Set([
    `activity:egg-journal:${dayId}`,
    `activity:egg-companion:${dayId}`,
    `activity:daily-quest:${dayId}`,
    `activity:contextual-parcel:${dayId}`,
    `activity:memory-arrival:${dayId}`,
  ]);
  const processedActivityReceiptIds = state.processedActivityReceiptIds.filter((id) => !receiptIds.has(id)
    && !(id.startsWith('activity:goal-chest:') && id.endsWith(`:${dayId}`)));
  const arrivals = state.arrivals.filter((arrival) => arrival.dayId !== dayId && !residentDiscoveryIds.has(arrival.discoveryId ?? ''));
  const activityEnergyByDay = { ...state.activityEnergyByDay };
  const hadDailyTotal = Object.prototype.hasOwnProperty.call(activityEnergyByDay, dayId);
  delete activityEnergyByDay[dayId];
  const stepEnergyByDay = { ...state.stepEnergyByDay };
  const hadStepClaim = Boolean(stepEnergyDayId && Object.prototype.hasOwnProperty.call(stepEnergyByDay, stepEnergyDayId));
  if (stepEnergyDayId) delete stepEnergyByDay[stepEnergyDayId];
  const resetsMossproutGarden = state.unlockedCharacters.includes('mossprout');
  const gardenChapter = mossproutWorldChapterForActiveDays(state.mossproutBoardProgression.activeDayIds.length);
  const freshGardenOrders = resetsMossproutGarden ? mossproutDailyGardenOrderBatch(dayId, now, gardenChapter.id, state.mossproutResidentSkinIds) : [];
  const visibleGardenOrders = freshGardenOrders.slice(0, mossproutDailyGardenOrderWindow(gardenChapter.id));
  let activeOrders = resetsMossproutGarden
    ? [
        ...state.activeOrders.filter((order) => (
          order.characterId !== 'mossprout'
          || (order.storyArcId !== 'mossprout:casual-garden'
            && order.storyArcId !== 'mossprout:dry-pond'
            && !order.storyArcId?.startsWith('mossprout:chapter:'))
        )),
        ...visibleGardenOrders,
      ]
    : state.activeOrders;
  activeOrders = activeOrders.filter((order) => !residentDiscoveryIds.has(order.storyArcId ?? ''));
  const mossproutDailyGardenOrders = resetsMossproutGarden ? {
    dayId,
    chapterId: gardenChapter.id,
    activeOrderId: freshGardenOrders[0]!.id,
    offeredOrderIds: freshGardenOrders.map((order) => order.id),
    servedOrderIds: [],
    complete: false,
    nextOrderSequence: 4,
    tailServedCount: 0,
    activeTailSequences: [],
    lastRecipientSkinId: null,
  } : state.mossproutDailyGardenOrders;
  const residentCardDiscovery = residentDiscoveries.length === 0 ? state.residentCardDiscovery : {
    ...state.residentCardDiscovery,
    records: state.residentCardDiscovery.records.filter((record) => !residentDiscoveryIds.has(record.id)),
  };
  const ownedKatchimeraCards = residentDiscoveries.length === 0 ? state.ownedKatchimeraCards : state.ownedKatchimeraCards.filter((card) => (
    !residentIds.has(card.cardId) || card.acquisition !== 'resident_discovery'
  ));
  const mossproutResidentSkinIds = MOSSPROUT_RESIDENT_IDS.filter((residentId) => (
    residentId === 'mossprout' || ownedKatchimeraCards.some((card) => card.cardId === residentId)
  ));
  let board = residentDiscoveries.length === 0 ? state.board : state.board.map((cell) => (
    cell.occupant?.kind === 'item' && residentGateIds.has(cell.occupant.progressionGateId ?? '')
      ? { ...cell, occupant: null }
      : cell
  ));
  board = installResidentCardNodes(board, residentCardDiscovery);
  if (
    !hadDailyTotal
    && !hadStepClaim
    && !resetsMossproutGarden
    && processedActivityReceiptIds.length === state.processedActivityReceiptIds.length
    && arrivals.length === state.arrivals.length
    && residentDiscoveries.length === 0
  ) return state;
  return touch({
    ...state,
    processedActivityReceiptIds,
    activityEnergyByDay,
    stepEnergyByDay,
    arrivals,
    activeOrders,
    mossproutDailyGardenOrders,
    board,
    residentCardDiscovery,
    ownedKatchimeraCards,
    mossproutResidentSkinIds,
  }, now);
}

export function normalizeMergeWorldState(value: unknown, now = Date.now()): MergeWorldState {
  if (!value || typeof value !== 'object') return createInitialMergeWorldState(now);
  const rawVersion = (value as { version?: unknown }).version;
  const source = value as Partial<MergeWorldState>;
  // v18 intentionally starts the first personal Merge World cleanly. Earlier
  // snapshots are shared-board prototypes and cannot be assigned safely to a
  // single companion without carrying their ownership compromises forward.
  if ((rawVersion !== 18 && rawVersion !== 19 && rawVersion !== 20 && rawVersion !== 21 && rawVersion !== 22) || !Array.isArray(source.board) || source.board.length !== MERGE_WORLD_SIZE) {
    return createInitialMergeWorldState(now);
  }
  const fallback = createInitialMergeWorldState(now);
  let normalized: MergeWorldState = {
    ...fallback,
    ...source,
    ...normalizeGlowDiscoveryFields(source),
    companionDailyGardenVersion: source.companionDailyGardenVersion,
    stepplingEgg: normalizeStepplingEgg(source.stepplingEgg),
    version: 22,
    ownerCharacterId: 'mossprout',
    revision: finite(source.revision, 0),
    createdAt: finite(source.createdAt, now),
    updatedAt: finite(source.updatedAt, now),
    nextInstance: Math.max(1, finite(source.nextInstance, 1)),
    board: dedupeMigratedGenerators(source.board.map((cell, index) => normalizeCell(cell, fallback.board[index], index))),
    storage: Array.isArray(source.storage) ? source.storage.filter(validBoardItem) : [],
    storageCapacity: Math.max(8, finite(source.storageCapacity, 8)),
    rewardInbox: Array.isArray(source.rewardInbox) ? source.rewardInbox : [],
    arrivals: normalizeArrivals(source.arrivals),
    landmarks: normalizeLandmarks(source.landmarks),
    generatorUnlockReceipts: uniqueGeneratorUnlockReceipts(source.generatorUnlockReceipts),
    stepplingGardenLesson: source.stepplingGardenLesson && Number.isFinite(source.stepplingGardenLesson.preparedAt)
      ? { preparedAt: source.stepplingGardenLesson.preparedAt, servedAt: source.stepplingGardenLesson.servedAt } : undefined,
    generators: source.generators && typeof source.generators === 'object'
      ? normalizeGenerators(source.generators)
      : fallback.generators,
    energy: {
      value: Math.max(0, finite(source.energy?.value, MERGE_INITIAL_ENERGY)),
      regenCap: MERGE_ENERGY_REGEN_CAP,
      lastRegenAt: finite(source.energy?.lastRegenAt, now),
      regenPaused: Boolean(source.energy?.regenPaused),
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
    activeOrders: Array.isArray(source.activeOrders) ? source.activeOrders.map(normalizeOrder).map(migrateMossproutGardenMissionOrder) : [],
    mossproutDailyGardenOrders: normalizeMossproutDailyGardenOrders(source.mossproutDailyGardenOrders),
    characterActivityOpportunities: Array.isArray(source.characterActivityOpportunities)
      ? source.characterActivityOpportunities.filter((opportunity) => (
          opportunity
          && typeof opportunity.id === 'string'
          && typeof opportunity.familyId === 'string'
          && typeof opportunity.dayId === 'string'
          && typeof opportunity.generatorId === 'string'
          && Array.isArray(opportunity.dropDefinitionIds)
        )).map((opportunity) => ({
          ...opportunity,
          dropDefinitionIds: opportunity.dropDefinitionIds.filter((definitionId) => typeof definitionId === 'string' && MERGE_ITEMS_BY_ID.has(definitionId)),
          usedCount: Math.max(0, Math.floor(finite(opportunity.usedCount, 0))),
          createdAt: finite(opportunity.createdAt, now),
        }))
      : [],
    ownedKatchimeraCards: Array.isArray(source.ownedKatchimeraCards)
      ? source.ownedKatchimeraCards.filter((card) => {
          const definition = card && typeof card.cardId === 'string' ? katchimeraSkinById.get(card.cardId) : null;
          return Boolean(
            definition
            && definition.familyId === card.familyId
            && KNOWN_CHARACTERS.has(card.familyId)
            && (card.acquisition === 'journey_match' || card.acquisition === 'story_resident' || card.acquisition === 'resident_discovery' || card.acquisition === 'coins')
            && typeof card.sourceReceiptId === 'string'
          );
        }).map((card) => ({
          ...card,
          acquiredAt: finite(card.acquiredAt, now),
          coinCost: Math.max(0, Math.floor(finite(card.coinCost, 0))),
        }))
      : [],
    mossproutResidentSkinIds: normalizeMossproutResidentSkinIds(source.mossproutResidentSkinIds, source.ownedKatchimeraCards),
    ownedMemoryCards: normalizeOwnedMemoryCards(source.ownedMemoryCards, now),
    completedOrderCount: Math.max(0, finite(source.completedOrderCount, 0)),
    recentOrderKeys: uniqueStrings(source.recentOrderKeys).slice(-RECENT_ORDER_LIMIT),
    expansions: uniqueStrings(source.expansions),
    unlockedRegions: uniqueStrings(source.unlockedRegions).filter((id): id is MergeWorldState['unlockedRegions'][number] => (
      ['central-clearing', 'inner-mist', 'mid-mist', 'deep-mist', 'ancient-dream'] as const
    ).includes(id as MergeWorldState['unlockedRegions'][number])),
    boardAwakeningReceipts: normalizeBoardAwakeningReceipts(source.boardAwakeningReceipts),
    processedActivityReceiptIds: uniqueStrings(source.processedActivityReceiptIds),
    activityEnergyByDay: source.activityEnergyByDay && typeof source.activityEnergyByDay === 'object' ? source.activityEnergyByDay : {},
    stepEnergyByDay: normalizeStepEnergyByDay(source.stepEnergyByDay),
    lastFreeRerollDayId: typeof source.lastFreeRerollDayId === 'string' ? source.lastFreeRerollDayId : null,
    characterProgress: source.characterProgress && typeof source.characterProgress === 'object'
      ? source.characterProgress
      : fallback.characterProgress,
    externalRewardReceipts: Array.isArray(source.externalRewardReceipts) ? source.externalRewardReceipts : [],
    storyWorldMutationReceipts: normalizeStoryWorldMutationReceipts(source.storyWorldMutationReceipts),
    companionDiscovery: normalizeCompanionDiscovery(source.companionDiscovery, source.unlockedCharacters, source.activeOrders, rawVersion, now),
    residentCardDiscovery: normalizeResidentCardDiscovery(source.residentCardDiscovery, source.ownedKatchimeraCards, now),
    mossproutBoardProgression: normalizeMossproutBoardProgression(source.mossproutBoardProgression),
    haven: normalizeHaven(source.haven, source, rawVersion, now),
  };
  normalized = {
    ...normalized,
    unlockedCharacters: [...new Set(normalized.companionDiscovery.records.map((record) => record.characterId))],
  };
  normalized = restoreActiveDreamboundDiscovery(normalized, rawVersion, now);
  normalized = reconcileUnlockedCatalog(normalized);
  normalized = {
    ...normalized,
    unlockedRegions: [...new Set(['central-clearing', 'inner-mist', ...normalized.unlockedRegions])] as MergeWorldState['unlockedRegions'],
  };
  normalized = enforceMossproutChapterZeroDropOverride(normalized);
  normalized = migrateActivityInbox(normalized);
  normalized = migrateMossproutRootParcels(normalized, rawVersion, now);
  normalized = migrateRetiredRootsToResidentNodes(normalized);
  normalized = migrateResidentCardItems(normalized);
  normalized = recoverResidentCardDiscovery(normalized, now);
  if (normalized.unlockedCharacters.includes('mossprout')) {
    normalized = { ...normalized, board: installMossproutRootboundEchoes(normalized.board, normalized.mossproutBoardProgression) };
  }
  normalized = { ...normalized, board: installResidentCardNodes(normalized.board, normalized.residentCardDiscovery) };
  normalized = reconcileDiscoveryMist(normalized, now);
  // Version 1/2 Pantry charges, cooldowns, and parcels intentionally disappear.
  // Version 3's five single-chain generators migrate into the shared eight.
  normalized = ensureProceduralOrders(normalized, now);
  return ensureOrdersRequireMerge(refreshTime(normalized, now));
}

function upgradeHavenTile(
  state: MergeWorldState,
  characterId: MergeCharacterId,
  requestedStage: HavenStage,
  now: number,
  receiptId?: string,
  economyMode: 'normal' | 'free' | 'grant' = 'normal',
  grantedCoins = 0,
): MergeWorldCommandResult {
  const existingReceipt = receiptId ? state.storyWorldMutationReceipts.find((receipt) => receipt.id === receiptId) : null;
  if (existingReceipt) {
    return {
      ...unchanged(state, 'This story upgrade was already applied.'),
      havenUpgrade: { characterId, stage: existingReceipt.toLevel as HavenStage, coinCost: existingReceipt.coinCost },
      storyWorldMutationReceipt: existingReceipt,
    };
  }
  if (characterId === 'mossprout' && requestedStage > 1) {
    return unchanged(state, 'Grow Mossprout’s six nature islands to deepen the Haven.');
  }
  const currentStage = state.haven.tileStages[characterId] ?? 0;
  // A released story may have applied this level before world-upgrade receipts
  // existed. Adopt the already-satisfied state into the new effect journal so
  // recovery can still play its reveal without charging or mutating twice.
  if (receiptId && requestedStage === currentStage) {
    const receipt: StoryWorldMutationReceipt = {
      id: receiptId,
      kind: 'haven_upgrade',
      target: { kind: 'haven_tile', characterId },
      fromLevel: currentStage,
      toLevel: requestedStage,
      economyMode,
      coinCost: 0,
      createdAt: now,
    };
    const next = touch({
      ...state,
      storyWorldMutationReceipts: [...state.storyWorldMutationReceipts, receipt],
    }, now);
    return {
      state: next,
      changed: true,
      havenUpgrade: { characterId, stage: requestedStage, coinCost: 0 },
      storyWorldMutationReceipt: receipt,
      message: 'This story upgrade was already present and has been recovered.',
    };
  }
  if (requestedStage !== currentStage + 1) return unchanged(state, 'Haven environments grow one stage at a time.');
  const definition = havenStageDefinition(characterId, requestedStage);
  if (!definition) return unchanged(state, 'This environment is not ready yet.');
  const grant = economyMode === 'grant' ? Math.max(0, Math.floor(grantedCoins)) : 0;
  const coinCost = economyMode === 'free' ? 0 : definition.coinCost;
  if (state.coins + grant < coinCost) return unchanged(state, 'Earn a few more Glow through Merge orders.');
  const revealState = characterId === 'mossprout' && requestedStage === 1 && state.haven.revealState === 'hidden'
    ? 'first_restore_complete' as const
    : state.haven.revealState;
  // Restoration improves this tile only. Each mist-covered neighbour is a
  // separate, explicit Glow purchase; existing unlocked neighbours stay intact.
  const mossproutNatureIslands = state.haven.mossproutNatureIslands;
  const structures = characterId === 'mossprout' && requestedStage === 1
    ? {
        ...state.haven.structures,
        mossproutGarden: { ...state.haven.structures.mossproutGarden, level: Math.max(1, state.haven.structures.mossproutGarden.level) },
      }
    : state.haven.structures;
  const receipt: StoryWorldMutationReceipt | null = receiptId ? {
    id: receiptId,
    kind: 'haven_upgrade',
    target: { kind: 'haven_tile', characterId },
    fromLevel: currentStage,
    toLevel: requestedStage,
    economyMode,
    coinCost,
    createdAt: now,
  } : null;
  const next = touch({
    ...state,
    coins: state.coins + grant - coinCost,
    storyWorldMutationReceipts: receipt ? [...state.storyWorldMutationReceipts, receipt] : state.storyWorldMutationReceipts,
    haven: {
      ...state.haven,
      tileStages: { ...state.haven.tileStages, [characterId]: requestedStage },
      mossproutNatureIslands,
      structures,
      revealState,
    },
  }, now);
  return { state: next, changed: true, havenUpgrade: { characterId, stage: requestedStage, coinCost }, storyWorldMutationReceipt: receipt ?? undefined, message: `${definition.name} restored.` };
}

function upgradeMossproutNatureIsland(
  state: MergeWorldState,
  islandId: MossproutNatureIslandId,
  requestedLevel: MossproutNatureIslandLevel,
  now: number,
  receiptId?: string,
  economyMode: 'normal' | 'free' | 'grant' = 'normal',
  grantedCoins = 0,
): MergeWorldCommandResult {
  const existingReceipt = receiptId ? state.storyWorldMutationReceipts.find((receipt) => receipt.id === receiptId) : null;
  if (existingReceipt) {
    return {
      ...unchanged(state, 'This story upgrade was already applied.'),
      natureIslandUpgrade: { islandId, level: existingReceipt.toLevel as MossproutNatureIslandLevel, coinCost: existingReceipt.coinCost, completedTier: false },
      storyWorldMutationReceipt: existingReceipt,
    };
  }
  const island = mossproutNatureIslandById.get(islandId);
  if (!island) return unchanged(state, 'That part of the garden is not available.');
  const currentLevel = state.haven.mossproutNatureIslands[islandId] ?? 0;
  if (requestedLevel !== currentLevel + 1 || requestedLevel < 1 || requestedLevel > 4) {
    return unchanged(state, 'Nature islands grow one level at a time.');
  }
  const definition = mossproutNatureIslandLevelDefinition(islandId, requestedLevel);
  if (!definition) return unchanged(state, 'This island cannot grow any further.');
  const grant = economyMode === 'grant' ? Math.max(0, Math.floor(grantedCoins)) : 0;
  const coinCost = economyMode === 'free' ? 0 : definition.coinCost;
  if (state.coins + grant < coinCost) {
    return unchanged(state, 'Earn a few more Glow through Merge orders.');
  }

  const mossproutNatureIslands = {
    ...state.haven.mossproutNatureIslands,
    [islandId]: requestedLevel,
  };
  const completedTier = MOSSPROUT_NATURE_ISLAND_IDS.every((id) => mossproutNatureIslands[id] >= requestedLevel);
  const existingStage = state.haven.tileStages.mossprout ?? 1;
  const aggregateStage = completedTier ? Math.max(existingStage, requestedLevel) as HavenStage : existingStage;
  const receipt: StoryWorldMutationReceipt | null = receiptId ? {
    id: receiptId,
    kind: 'haven_upgrade',
    target: { kind: 'haven_nature_island', islandId },
    fromLevel: currentLevel,
    toLevel: requestedLevel,
    economyMode,
    coinCost,
    createdAt: now,
  } : null;
  const next = touch({
    ...state,
    coins: state.coins + grant - coinCost,
    storyWorldMutationReceipts: receipt ? [...state.storyWorldMutationReceipts, receipt] : state.storyWorldMutationReceipts,
    haven: {
      ...state.haven,
      mossproutNatureIslands,
      tileStages: { ...state.haven.tileStages, mossprout: aggregateStage },
    },
  }, now);
  return {
    state: next,
    changed: true,
    message: `${island.name} grew into ${definition.name}.`,
    natureIslandUpgrade: { islandId, level: requestedLevel, coinCost, completedTier },
    storyWorldMutationReceipt: receipt ?? undefined,
  };
}

function normalizeStoryWorldMutationReceipts(value: unknown): StoryWorldMutationReceipt[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const receipt = candidate as Partial<StoryWorldMutationReceipt>;
    if (typeof receipt.id !== 'string' || !receipt.id || ids.has(receipt.id) || receipt.kind !== 'haven_upgrade') return [];
    const target = receipt.target;
    const normalizedTarget: StoryWorldMutationReceipt['target'] | null = target?.kind === 'haven_tile'
      && typeof target.characterId === 'string'
      && KNOWN_CHARACTERS.has(target.characterId as MergeCharacterId)
      ? { kind: 'haven_tile', characterId: target.characterId as MergeCharacterId }
      : target?.kind === 'haven_nature_island'
        && MOSSPROUT_NATURE_ISLAND_IDS.includes(target.islandId as MossproutNatureIslandId)
        ? { kind: 'haven_nature_island', islandId: target.islandId as MossproutNatureIslandId }
        : target?.kind === 'haven_structure' && typeof target.structureId === 'string' && sharedWorldPurchase(target.structureId)
          ? { kind: 'haven_structure', structureId: target.structureId }
          : null;
    if (!normalizedTarget || !Number.isInteger(receipt.fromLevel) || !Number.isInteger(receipt.toLevel)) return [];
    if (receipt.economyMode !== 'normal' && receipt.economyMode !== 'free' && receipt.economyMode !== 'grant') return [];
    ids.add(receipt.id);
    return [{
      id: receipt.id,
      kind: 'haven_upgrade' as const,
      target: normalizedTarget,
      fromLevel: receipt.fromLevel!,
      toLevel: receipt.toLevel!,
      economyMode: receipt.economyMode,
      coinCost: Math.max(0, Math.floor(Number(receipt.coinCost) || 0)),
      createdAt: Number(receipt.createdAt) || 0,
    }];
  });
}

function normalizeHaven(value: unknown, source: Partial<MergeWorldState>, rawVersion: unknown, now: number): MergeWorldState['haven'] {
  const raw = value && typeof value === 'object' ? value as Partial<MergeWorldState['haven']> : {};
  const tileStages: MergeWorldState['haven']['tileStages'] = {};
  if (raw.tileStages && typeof raw.tileStages === 'object') {
    for (const [characterId, stage] of Object.entries(raw.tileStages)) {
      if (KNOWN_CHARACTERS.has(characterId as MergeCharacterId) && Number.isInteger(stage) && Number(stage) >= 0 && Number(stage) <= 4) {
        tileStages[characterId as MergeCharacterId] = Number(stage) as HavenStage;
      }
    }
  }
  if (source.unlockedCharacters?.includes('mossprout') && tileStages.mossprout == null) {
    const chapters = source.characterProgress?.mossprout?.completedChapterIds ?? [];
    tileStages.mossprout = chapters.includes('mossprout-chapter-0') && rawVersion !== 16 && rawVersion !== 17 ? 1 : 0;
  }
  const revealState = raw.revealState === 'revealed' || raw.revealState === 'first_restore_complete'
    ? raw.revealState
    : tileStages.mossprout && tileStages.mossprout > 0 && rawVersion !== 16 && rawVersion !== 17 ? 'revealed' : 'hidden';
  const baselineIslandLevel: MossproutNatureIslandLevel = revealState === 'hidden' ? 0 : 1;
  const mossproutNatureIslands = emptyMossproutNatureIslandLevels(baselineIslandLevel);
  // v18-v20 deliberately restart the new satellite tracks at Level 1. v21+
  // snapshots preserve their independent levels.
  if ((rawVersion === 21 || rawVersion === 22) && raw.mossproutNatureIslands && typeof raw.mossproutNatureIslands === 'object') {
    for (const islandId of MOSSPROUT_NATURE_ISLAND_IDS) {
      const level = raw.mossproutNatureIslands[islandId];
      if (Number.isInteger(level) && Number(level) >= 0 && Number(level) <= 4) {
        mossproutNatureIslands[islandId] = Number(level) as MossproutNatureIslandLevel;
      }
    }
  }
  const stepplingFallback = createStepplingHavenBoard(now)!;
  const rawSteppling = raw.residentMergeBoards?.steppling;
  const steppling = rawSteppling && typeof rawSteppling === 'object'
    && Array.isArray(rawSteppling.board) && rawSteppling.board.length === STEPPLING_HAVEN_BOARD_SIZE
    ? {
        board: rawSteppling.board.map((cell, index) => normalizeCell(cell, stepplingFallback.board[index], index)),
        createdAt: finite(rawSteppling.createdAt, now),
        generators: rawSteppling.generators && typeof rawSteppling.generators === 'object'
          ? normalizeGenerators(rawSteppling.generators)
          : stepplingFallback.generators,
        revision: Math.max(0, Math.floor(finite(rawSteppling.revision, 0))),
        storage: Array.isArray(rawSteppling.storage) ? rawSteppling.storage.filter(validBoardItem) : [],
        storageCapacity: Math.max(8, Math.floor(finite(rawSteppling.storageCapacity, 8))),
        updatedAt: finite(rawSteppling.updatedAt, now),
      }
    : stepplingFallback;
  const structures = normalizeHavenStructures(raw.structures);
  if ((tileStages.mossprout ?? 0) > 0 && structures.mossproutGarden.level === 0) {
    structures.mossproutGarden.level = 1;
  }
  return {
    tileStages,
    mossproutNatureIslands,
    revealState,
    mossproutStoryLevel: Math.max(0, Math.floor(finite(raw.mossproutStoryLevel, 0))),
    nextProceduralOrder: Math.max(1, Math.floor(finite(raw.nextProceduralOrder, 1))),
    residentMergeBoards: { steppling },
    structures,
    plantableMemories: normalizePlantableMemories(raw.plantableMemories),
    mutationReceipts: normalizeHavenMutationReceipts(raw.mutationReceipts),
    movementEgg: normalizeMovementEgg(raw.movementEgg),
  };
}

function normalizeHavenStructures(value: unknown): MergeWorldState['haven']['structures'] {
  const raw = value && typeof value === 'object' ? value as Partial<MergeWorldState['haven']['structures']> : {};
  const garden = raw.mossproutGarden && typeof raw.mossproutGarden === 'object' ? raw.mossproutGarden : null;
  return {
    mossproutGarden: {
      level: Math.max(0, Math.floor(finite(garden?.level, 0))),
      featureLevels: {
        spring: Math.max(0, Math.floor(finite(garden?.featureLevels?.spring, 0))),
        path: Math.max(0, Math.floor(finite(garden?.featureLevels?.path, 0))),
      },
    },
  };
}

function normalizePlantableMemories(value: unknown): MergeWorldState['haven']['plantableMemories'] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const slots = new Set<string>();
  return value.flatMap((candidate): PlantableMemoryInstance[] => {
    if (!candidate || typeof candidate !== 'object') return [];
    const raw = candidate as Partial<PlantableMemoryInstance>;
    if (typeof raw.id !== 'string' || ids.has(raw.id)) return [];
    if (!['momentum', 'stillness', 'renewal', 'warmth', 'curiosity'].includes(raw.definitionId ?? '')) return [];
    const requestedSlot = raw.slotId && MOSSPROUT_GARDEN_PLANT_SLOTS.includes(raw.slotId) ? raw.slotId : null;
    const slotId = requestedSlot && !slots.has(requestedSlot) ? requestedSlot : null;
    ids.add(raw.id);
    if (slotId) slots.add(slotId);
    return [{
      id: raw.id,
      definitionId: raw.definitionId!,
      status: slotId ? 'planted' : 'earned',
      slotId,
      growthPoints: Math.max(0, Math.floor(finite(raw.growthPoints, 0))),
      source: raw.source && ['ftue', 'journey', 'tending', 'moment'].includes(raw.source.kind) && typeof raw.source.sourceId === 'string'
        ? raw.source
        : { kind: 'journey', sourceId: 'migration' },
      earnedAt: finite(raw.earnedAt, 0),
      plantedAt: slotId ? finite(raw.plantedAt, 0) : null,
    }];
  });
}

function normalizeHavenMutationReceipts(value: unknown): MergeWorldState['haven']['mutationReceipts'] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.flatMap((candidate): MergeWorldState['haven']['mutationReceipts'] => {
    if (!candidate || typeof candidate !== 'object') return [];
    const raw = candidate as MergeWorldState['haven']['mutationReceipts'][number];
    if (typeof raw.id !== 'string' || ids.has(raw.id) || typeof raw.targetId !== 'string') return [];
    if (!['plantable_grant', 'plantable_place', 'plantable_growth', 'structure_upgrade', 'feature_upgrade', 'movement_egg'].includes(raw.kind)) return [];
    ids.add(raw.id);
    return [{ ...raw, createdAt: finite(raw.createdAt, 0) }];
  });
}

function normalizeMovementEgg(value: unknown): MergeWorldState['haven']['movementEgg'] {
  const raw = value && typeof value === 'object' ? value as Partial<MergeWorldState['haven']['movementEgg']> : {};
  return {
    status: raw.status === 'revealed' || raw.status === 'stirring' ? raw.status : 'hidden',
    observedSteps: Math.max(0, Math.floor(finite(raw.observedSteps, 0))),
    manualMovementLogs: Math.max(0, Math.floor(finite(raw.manualMovementLogs, 0))),
    updatedAt: raw.updatedAt == null ? null : finite(raw.updatedAt, 0),
  };
}

function tapGenerator(state: MergeWorldState, generatorId: string, now: number, seed: string, activityOpportunityId?: string): MergeWorldCommandResult {
  const generator = state.generators[generatorId];
  if (!generator) return unchanged(state, 'That item maker is not available yet.');
  const tutorialDrop = stepplingGardenDrop(state, generatorId) ?? glowTutorialDrop(state, generatorId);
  if (generatorId === 'journey-locker' && state.stepplingGardenLesson && !stepplingShoeServed(state) && !tutorialDrop) {
    return unchanged(state, 'Merge your Socks and serve Steppling’s Shoe first.');
  }
  const opportunity = activityOpportunityId && !tutorialDrop
    ? state.characterActivityOpportunities.find((candidate) => candidate.id === activityOpportunityId)
    : null;
  if (!tutorialDrop && activityOpportunityId && (!opportunity || opportunity.generatorId !== generatorId)) {
    return unchanged(state, 'Mossprout has not found anything else for the Garden today.');
  }
  if (opportunity && !MERGE_GENERATORS_UNLIMITED && opportunity.usedCount >= opportunity.dropDefinitionIds.length) {
    return unchanged(state, "That's everything Mossprout found today.");
  }
  if (!tutorialDrop && !MERGE_GENERATORS_UNLIMITED && !opportunity && generator.charges < 1) {
    return unchanged(state, `${generator.name} is growing more supplies.`, 'generator_resting');
  }
  const cell = firstEmptyCell(state.board, hash(`${seed}:cell`));
  if (cell < 0) return unchanged(state, 'The board is full. Merge or store an item first.', 'board_full');
  // Level one always starts at tier one. Upgrades add a bounded chance of a
  // better seed without changing which authored chains the generator owns.
  const dropIndex = randomUnit(`${seed}:chain:${state.revision}`) < 0.5 ? 0 : 1;
  const authoredDropIndex = opportunity?.dropDefinitionIds.length
    ? opportunity.usedCount % opportunity.dropDefinitionIds.length
    : -1;
  const authoredDefinitionId = authoredDropIndex >= 0
    ? opportunity?.dropDefinitionIds[authoredDropIndex]
    : undefined;
  const baseDefinitionId = tutorialDrop ?? authoredDefinitionId ?? generator.forcedDropDefinitionId ?? generator.tierOneDropDefinitionIds[dropIndex];
  const betterDropRoll = randomUnit(`${seed}:upgrade:${state.revision}`);
  const bonusTier = tutorialDrop || authoredDefinitionId || generator.forcedDropDefinitionId ? 0 : generator.level >= 4 && betterDropRoll < 0.05
    ? 2
    : betterDropRoll < Math.max(0, generator.level - 1) * 0.1 ? 1 : 0;
  const definitionId = bonusTier ? baseDefinitionId.replace(/:1$/, `:${1 + bonusTier}`) : baseDefinitionId;
  if (!MERGE_ITEMS_BY_ID.has(definitionId)) return unchanged(state, 'This item maker has nothing to make right now.');
  const item: MergeBoardItem = { kind: 'item', instanceId: `merge-item:${state.nextInstance}`, definitionId };
  const board = [...state.board];
  board[cell] = { ...board[cell], occupant: item };
  const usesCapacity = !tutorialDrop && !MERGE_GENERATORS_UNLIMITED && !opportunity;
  const charges = usesCapacity ? Math.max(0, generator.charges - 1) : generator.charges;
  const nextGenerator = usesCapacity ? {
    ...generator,
    charges,
    restStartedAt: charges === 0 ? now : generator.restStartedAt,
  } : generator;
  let next = touch({
    ...state,
    board,
    nextInstance: state.nextInstance + 1,
    generators: { ...state.generators, [generatorId]: nextGenerator },
    characterActivityOpportunities: opportunity
      ? state.characterActivityOpportunities.map((candidate) => candidate.id === opportunity.id
          ? { ...candidate, usedCount: candidate.usedCount + 1 }
          : candidate)
      : state.characterActivityOpportunities,
  }, now);
  const discovery = applyDiscovery(next, definitionId, now);
  next = discovery.state;
  return { state: next, changed: true, spawnedCell: cell, discoveryId: discovery.newDiscovery ? definitionId : undefined, message: `${MERGE_ITEMS_BY_ID.get(definitionId)?.name ?? 'Item'} added.` };
}

function setGeneratorForcedDrop(state: MergeWorldState, generatorId: string, definitionId: string | null, now: number): MergeWorldCommandResult {
  const generator = state.generators[generatorId];
  if (!generator) return unchanged(state, 'That item maker is not available yet.');
  if (definitionId != null && !generator.tierOneDropDefinitionIds.includes(definitionId)) {
    return unchanged(state, 'That item does not come from this item maker.');
  }
  if (generator.forcedDropDefinitionId === definitionId) return unchanged(state);
  const nextGenerator = { ...generator, forcedDropDefinitionId: definitionId };
  return changed(touch({ ...state, generators: { ...state.generators, [generatorId]: nextGenerator } }, now));
}

export function mergeGeneratorUpgradeCost(level: number): number | null {
  return level >= 4 ? null : [0, 3, 6, 10][Math.max(1, level)] ?? null;
}

function upgradeGenerator(state: MergeWorldState, generatorId: string, now: number): MergeWorldCommandResult {
  const generator = state.generators[generatorId];
  if (!generator) return unchanged(state, 'That item maker is not available yet.');
  const cost = mergeGeneratorUpgradeCost(generator.level);
  if (cost == null) return unchanged(state, 'This item maker cannot improve any further.');
  if (generator.upgradeFragments < cost) return unchanged(state, 'Serve more requests before improving this item maker.');
  const upgraded = { ...generator, level: generator.level + 1, upgradeFragments: generator.upgradeFragments - cost };
  return changed(touch({ ...state, generators: { ...state.generators, [generatorId]: upgraded } }, now), `${generator.name} can now find better items more often.`);
}

function openCompanionDiscoveryGate(
  state: MergeWorldState,
  gateId: string,
  requestedCandidates: MergeCharacterId[],
  recommendedCharacterId: MergeCharacterId | null,
  now: number,
): MergeWorldCommandResult {
  if (state.companionDiscovery.active || state.companionDiscovery.completedGateIds.includes(gateId)) return unchanged(state);
  if (state.companionDiscovery.lastStartedDayId === localDayId(now)) {
    if (state.companionDiscovery.queuedGateIds.includes(gateId)) return unchanged(state, 'The Dream Mist needs a little time before another mystery appears.');
    const queuedDiscovery = recordDiscoveryEvent({
      ...state.companionDiscovery,
      queuedGateIds: [...state.companionDiscovery.queuedGateIds, gateId],
    }, { id: `discovery-event:eligible:${gateId}`, kind: 'gate_eligible', gateId, createdAt: now });
    return changed(touch({
      ...state,
      companionDiscovery: queuedDiscovery,
    }, now), 'A new mystery is gathering in the Dream Mist.');
  }
  const candidateIds = [...new Set(requestedCandidates)].filter((characterId) => (
    KNOWN_CHARACTERS.has(characterId)
    && !state.unlockedCharacters.includes(characterId)
    && [...COMPANION_DISCOVERIES_BY_ID.values()].some((definition) => definition.characterId === characterId)
  )).slice(0, 3);
  if (!candidateIds.length) return unchanged(state);
  const anchorCell = allocateDiscoveryForkAnchor(state.board, DISCOVERY_FORK_ANCHOR_CELL);
  if (anchorCell < 0) return unchanged(state, 'Make one empty board space for the next discovery.');
  const board = [...state.board];
  board[anchorCell] = {
    ...board[anchorCell], locked: true, blocker: 'clouds', occupant: null,
    mist: { kind: 'discovery_fork', gateId, candidateIds, recommendedCharacterId: candidateIds.includes(recommendedCharacterId!) ? recommendedCharacterId : null },
  };
  const recommendation = candidateIds.includes(recommendedCharacterId!) ? recommendedCharacterId : null;
  let discoveryProgress: MergeWorldState['companionDiscovery'] = {
    ...state.companionDiscovery,
    openedGateIds: [...new Set([...state.companionDiscovery.openedGateIds, gateId])],
    queuedGateIds: state.companionDiscovery.queuedGateIds.filter((id) => id !== gateId),
    active: {
      discoveryId: `fork:${gateId}`, gateId, anchorCell, pathCells: [], candidateIds,
      recommendedCharacterId: recommendation, selectedCharacterId: null, pathId: null, stage: 0, startedAt: now,
    },
    lastStartedDayId: localDayId(now),
  };
  discoveryProgress = recordDiscoveryEvent(discoveryProgress, {
    id: `discovery-event:eligible:${gateId}`, kind: 'gate_eligible', gateId, createdAt: now,
  });
  discoveryProgress = recordDiscoveryEvent(discoveryProgress, {
    id: `discovery-event:activated:${gateId}`, kind: 'gate_activated', gateId, createdAt: now,
  });
  return changed(touch({
    ...state,
    board,
    companionDiscovery: discoveryProgress,
  }, now), 'The Dream Mist is pointing in several directions.');
}

function selectCompanionDiscoveryPath(state: MergeWorldState, characterId: MergeCharacterId, now: number): MergeWorldCommandResult {
  const active = state.companionDiscovery.active;
  if (!active || active.selectedCharacterId || !active.candidateIds.includes(characterId)) return unchanged(state);
  const definition = [...COMPANION_DISCOVERIES_BY_ID.values()].find((candidate) => candidate.characterId === characterId);
  if (!definition) return unchanged(state);
  const board = [...state.board];
  board[active.anchorCell] = { ...board[active.anchorCell], locked: false, blocker: null, occupant: null, mist: null };
  const pathCells = allocateCompanionDiscoveryPath(board, definition);
  if (!pathCells) return unchanged(state, 'Make three empty board spaces for this discovery trail.');
  installDreamboundPath(board, definition, active.gateId, pathCells);
  const arrival = discoveryArrival(definition, now);
  const discoveryProgress = recordDiscoveryEvent({
    ...state.companionDiscovery,
    active: {
      ...active, discoveryId: definition.id, anchorCell: pathCells.at(-1)!, pathCells,
      selectedCharacterId: characterId, pathId: definition.pathId, stage: 0,
    },
  }, {
    id: `discovery-event:path:${active.gateId}:${characterId}`, kind: 'path_chosen', gateId: active.gateId,
    discoveryId: definition.id, characterId, createdAt: now,
  });
  return changed(touch({
    ...state,
    board,
    arrivals: state.arrivals.some((candidate) => candidate.id === arrival.id) ? state.arrivals : [arrival, ...state.arrivals],
    companionDiscovery: discoveryProgress,
  }, now), `We’ll follow the ${definition.pathName} first.`);
}

function startStepplingDiscovery(state: MergeWorldState, now: number): MergeWorldCommandResult {
  if (state.unlockedCharacters.includes('steppling')) return unchanged(state, 'Steppling has already been discovered.');
  if (state.companionDiscovery.active) return unchanged(state, 'Another mystery is already active.');
  if (!state.characterProgress.mossprout?.completedChapterIds.includes('mossprout-chapter-0')) {
    return unchanged(state, 'Finish Mossprout\'s garden first.');
  }
  const definition = COMPANION_DISCOVERIES_BY_ID.get(STEPPLING_DISCOVERY_ID);
  const garden = state.generators['wild-garden'];
  if (!definition || !garden) return unchanged(state, 'Finish Mossprout\'s garden first.');
  const anchorCell = STEPPLING_DISCOVERY_ANCHOR_CELL;
  const board = [...state.board];
  const pathCells = allocateCompanionDiscoveryPath(board, definition);
  if (!pathCells) return unchanged(state, 'Make three empty board spaces for Stepplingâ€™s trail.');
  installDreamboundPath(board, definition, definition.gateId, pathCells);
  const arrival = discoveryArrival(definition, now);
  let discoveryProgress: MergeWorldState['companionDiscovery'] = {
    ...state.companionDiscovery,
    openedGateIds: [...new Set([...state.companionDiscovery.openedGateIds, STEPPLING_DISCOVERY_GATE_ID])],
    active: {
      discoveryId: definition.id,
      gateId: definition.gateId,
      anchorCell: pathCells.at(-1) ?? anchorCell,
      pathCells,
      candidateIds: ['steppling' as const],
      recommendedCharacterId: 'steppling' as const,
      selectedCharacterId: 'steppling' as const,
      pathId: definition.pathId,
      stage: 0,
      startedAt: now,
    },
    lastStartedDayId: localDayId(now),
  };
  discoveryProgress = recordDiscoveryEvent(discoveryProgress, {
    id: `discovery-event:eligible:${definition.gateId}`, kind: 'gate_eligible', gateId: definition.gateId, createdAt: now,
  });
  discoveryProgress = recordDiscoveryEvent(discoveryProgress, {
    id: `discovery-event:activated:${definition.gateId}`, kind: 'gate_activated', gateId: definition.gateId, createdAt: now,
  });
  discoveryProgress = recordDiscoveryEvent(discoveryProgress, {
    id: `discovery-event:path:${definition.gateId}:steppling`, kind: 'path_chosen', gateId: definition.gateId,
    discoveryId: definition.id, characterId: 'steppling', createdAt: now,
  });
  return changed(touch({
    ...state,
    board,
    arrivals: state.arrivals.some((candidate) => candidate.id === arrival.id) ? state.arrivals : [arrival, ...state.arrivals],
    companionDiscovery: discoveryProgress,
  }, now), 'Something moved in the Dream Mist.');
}

function advanceCompanionDiscovery(state: MergeWorldState, from: number, to: number, now: number): MergeWorldCommandResult | null {
  const mist = state.board[to].mist;
  if (mist?.kind !== 'dreambound_item') return null;
  const active = state.companionDiscovery.active;
  const source = state.board[from].occupant;
  const definition = COMPANION_DISCOVERIES_BY_ID.get(mist.discoveryId);
  if (!active || !definition || active.discoveryId !== mist.discoveryId || source?.kind !== 'item') {
    return unchanged(state, 'This mystery is not ready yet.', 'sealed_mist');
  }
  if (!mist.active) return unchanged(state, 'The trail has not reached this item yet.', 'sealed_mist');
  if (source.definitionId !== mist.boundDefinitionId) {
    return unchanged(state, 'Find the matching item.', 'wrong_echo_match');
  }
  const nextStage = mist.sequenceIndex + 1;
  const completesDiscovery = nextStage >= definition.stages.length;
  const upgradedDefinitionId = MERGE_ITEMS_BY_ID.get(source.definitionId)?.nextItemId;
  if (!upgradedDefinitionId) return unchanged(state, 'This item cannot merge any further.');
  const board = [...state.board];
  board[from] = { ...board[from], occupant: null };
  if (!completesDiscovery) {
    const nextCell = active.pathCells[nextStage];
    if (!validCell(nextCell)) return unchanged(state, 'The discovery trail needs another board space.');
    board[to] = { ...board[to], locked: false, blocker: null, mist: null, occupant: { kind: 'item', instanceId: `merge-item:${state.nextInstance}`, definitionId: upgradedDefinitionId } };
    const nextMist = board[nextCell].mist;
    if (nextMist?.kind === 'dreambound_item') board[nextCell] = { ...board[nextCell], mist: { ...nextMist, active: true } };
    const discoveryProgress = recordDiscoveryEvent({
      ...state.companionDiscovery,
      active: { ...active, stage: nextStage },
    }, {
      id: `discovery-event:stage:${definition.id}:${nextStage}`, kind: 'stage_advanced', gateId: active.gateId,
      discoveryId: definition.id, characterId: definition.characterId, stage: nextStage, createdAt: now,
    });
    return {
      state: touch({
        ...state,
        board,
        nextInstance: state.nextInstance + 1,
        companionDiscovery: discoveryProgress,
      }, now),
      changed: true,
      mergedCell: to,
      companionDiscoveryAdvanced: { discoveryId: definition.id, stage: nextStage },
      message: `${definition.stages[nextStage].clue} stirred in the Mist.`,
    };
  }

  const generator = definition.permanentGeneratorId ? MERGE_GENERATORS_BY_ID.get(definition.permanentGeneratorId) : null;
  if (!generator) return unchanged(state, 'The trail cannot open yet.');
  board[to] = { ...board[to], locked: false, blocker: null, mist: null, occupant: { kind: 'generator', generatorId: generator.id } };
  const record = {
    characterId: definition.characterId,
    source: 'board_discovery' as const,
    gateId: active.gateId,
    pathId: definition.pathId,
    discoveredAt: now,
    revealSeenAt: null,
    firstOrderCompletedAt: null,
    permanentFeatureId: generator.id,
  };
  const primaryChain = KATCHIMERA_MERGE_PROFILES[definition.characterId].coreChains[0];
  const primaryTierOne = `${primaryChain}:1`;
  const primaryTierTwo = `${primaryChain}:2`;
  const firstOrderId = definition.characterId === 'steppling' ? 'steppling:discovery:first-trail' : `${definition.characterId}:discovery:first-order`;
  const firstOrderCopy = DISCOVERY_FIRST_ORDER_COPY[definition.characterId];
  const firstOrder: MergeOrder = {
    id: firstOrderId,
    characterId: definition.characterId,
    title: firstOrderCopy?.title ?? `${MERGE_CHARACTER_NAMES[definition.characterId]}'s first request`,
    description: firstOrderCopy?.description ?? `Make ${MERGE_ITEMS_BY_ID.get(primaryTierTwo)?.name ?? 'something new'} from the ${generator.name}.`,
    difficulty: 'small',
    requirements: [{ definitionId: primaryTierTwo, quantity: 1 }],
    reward: { coins: 20, mergeXp: 18, friendshipXp: 12, energy: 2 },
    createdAt: now,
    signature: false,
    purpose: 'normal',
    storyArcId: `${definition.characterId}:discovery`,
  };
  const garden = state.generators['wild-garden'];
  const receiptId = `generator-unlock:${generator.id}`;
  let discoveryProgress: MergeWorldState['companionDiscovery'] = {
    ...state.companionDiscovery,
    records: [...state.companionDiscovery.records.filter((candidate) => candidate.characterId !== definition.characterId), record],
    completedGateIds: [...new Set([...state.companionDiscovery.completedGateIds, active.gateId])],
    queuedGateIds: state.companionDiscovery.queuedGateIds.filter((id) => id !== active.gateId),
    active: null,
  };
  discoveryProgress = recordDiscoveryEvent(discoveryProgress, {
    id: `discovery-event:stage:${definition.id}:${nextStage}`, kind: 'stage_advanced', gateId: active.gateId,
    discoveryId: definition.id, characterId: definition.characterId, stage: nextStage, createdAt: now,
  });
  discoveryProgress = recordDiscoveryEvent(discoveryProgress, {
    id: `discovery-event:reveal:${definition.id}`, kind: 'character_revealed', gateId: active.gateId,
    discoveryId: definition.id, characterId: definition.characterId, stage: nextStage, createdAt: now,
  });
  const completedState = reconcileDiscoveryMist(touch({
    ...state,
    board,
    generators: {
      ...state.generators,
      ...(garden ? { 'wild-garden': { ...garden, forcedDropDefinitionId: null } } : {}),
      [generator.id]: { ...generatorState(generator.id), forcedDropDefinitionId: primaryTierOne },
    },
    generatorUnlockReceipts: state.generatorUnlockReceipts.some((receipt) => receipt.id === receiptId)
      ? state.generatorUnlockReceipts
      : [...state.generatorUnlockReceipts, { id: receiptId, generatorId: generator.id, createdAt: now, seenAt: null }],
    unlockedFamilies: [...new Set([...state.unlockedFamilies, MERGE_ITEMS_BY_ID.get(primaryTierOne)!.familyId])],
    unlockedChains: [...new Set([...state.unlockedChains, primaryChain])],
    unlockedCharacters: [...new Set([...state.unlockedCharacters, definition.characterId])],
    favouriteCharacterId: definition.characterId,
    activeOrders: [...state.activeOrders, firstOrder],
    characterProgress: {
      ...state.characterProgress,
      [definition.characterId]: state.characterProgress[definition.characterId] ?? { friendshipLevel: 1, completedChapterIds: [] },
    },
    companionDiscovery: discoveryProgress,
  }, now), now);
  return {
    state: completedState,
    changed: true,
    mergedCell: to,
    companionDiscoveryAdvanced: { discoveryId: definition.id, stage: nextStage, completedCharacterId: definition.characterId },
    message: `${MERGE_CHARACTER_NAMES[definition.characterId]} found a way through the Dream Mist.`,
  };
}

function installDreamboundPath(board: MergeBoardCell[], definition: CompanionDiscoveryDefinition, gateId: string, pathCells: readonly number[], activeStage = 0) {
  pathCells.forEach((cell, sequenceIndex) => {
    const stage = definition.stages[sequenceIndex];
    board[cell] = {
      ...board[cell], locked: true, blocker: 'clouds', occupant: null,
      mist: {
        kind: 'dreambound_item', discoveryId: definition.id, gateId, pathId: definition.pathId,
        sequenceIndex, boundDefinitionId: stage.boundDefinitionId, active: sequenceIndex === activeStage,
      },
    };
  });
}

function themeForFamily(familyId: MergeWorldArrival['familyId']): MergeWorldArrival['theme'] {
  if (familyId === 'drink') return 'ritual';
  if (familyId === 'adventure') return 'movement';
  if (familyId === 'comfort') return 'rest';
  if (familyId === 'social') return 'connection';
  if (familyId === 'mind') return 'focus';
  if (familyId === 'creative') return 'creativity';
  return familyId;
}

function discoveryArrival(definition: CompanionDiscoveryDefinition, now: number): MergeWorldArrival {
  const item = MERGE_ITEMS_BY_ID.get(definition.entryDefinitionId)!;
  return {
    id: `arrival:discovery:${definition.id}`, kind: 'discovery_parcel', createdAt: now,
    dayId: localDayId(now), label: `${definition.pathName} parcel`, theme: themeForFamily(item.familyId),
    familyId: item.familyId, chainId: item.chainId, characterId: definition.characterId, source: 'discovery',
    discoveryId: definition.id, itemDefinitionIds: [definition.entryDefinitionId], claimedAt: null, seenAt: null,
  };
}

function normalizeResidentCardDiscovery(
  value: unknown,
  ownedCards: MergeWorldState['ownedKatchimeraCards'] | undefined,
  now: number,
): MergeWorldState['residentCardDiscovery'] {
  const raw = value && typeof value === 'object' ? value as Partial<MergeWorldState['residentCardDiscovery']> : {};
  const records = Array.isArray(raw.records) ? raw.records.filter((record) => (
    record && typeof record.id === 'string' && typeof record.residentId === 'string'
    && MOSSPROUT_RESIDENT_CARD_NODE_BY_RESIDENT.has(record.residentId)
  )).map((record) => ({
    ...record,
    campaignId: typeof record.campaignId === 'string' ? record.campaignId : 'mossprout:journey',
    journeyDayId: typeof record.journeyDayId === 'string' ? record.journeyDayId : 'legacy',
    servedOrderIds: uniqueStrings(record.servedOrderIds),
    revealedAt: record.revealedAt == null ? null : finite(record.revealedAt, now),
    dialogueSeenAt: record.dialogueSeenAt == null ? null : finite(record.dialogueSeenAt, now),
    earnedAt: record.earnedAt == null ? null : finite(record.earnedAt, now),
    cardRevealSeenAt: record.cardRevealSeenAt == null ? null : finite(record.cardRevealSeenAt, now),
  })) : [];
  const byResident = new Map(records.map((record) => [record.residentId, record]));
  for (const card of ownedCards ?? []) {
    const node = MOSSPROUT_RESIDENT_CARD_NODE_BY_RESIDENT.get(card.cardId);
    if (!node || byResident.has(card.cardId)) continue;
    const record = {
      id: `resident-discovery:legacy:${card.cardId}`,
      campaignId: 'legacy', journeyDayId: 'legacy', residentId: card.cardId,
      nodeGateId: node.gateId, nodeCell: node.cell, status: 'card_earned' as const,
      parcelId: null, revealedAt: card.acquiredAt, dialogueSeenAt: card.acquiredAt,
      servedOrderIds: [], earnedAt: card.acquiredAt, cardRevealSeenAt: card.acquiredAt,
    };
    records.push(record);
    byResident.set(card.cardId, record);
  }
  return { records, campaignMilestoneReceiptIds: uniqueStrings(raw.campaignMilestoneReceiptIds) };
}

function migrateRetiredRootsToResidentNodes(state: MergeWorldState): MergeWorldState {
  const board = state.board.map((cell) => cell.occupant?.kind === 'item' && cell.occupant.progressionGateId && RETIRED_RESIDENT_NODE_ROOT_GATE_IDS.has(cell.occupant.progressionGateId)
    ? { ...cell, occupant: null }
    : cell);
  const storage = state.storage.filter((item) => !item.progressionGateId || !RETIRED_RESIDENT_NODE_ROOT_GATE_IDS.has(item.progressionGateId));
  const arrivals = state.arrivals.filter((arrival) => arrival.claimedAt != null || !arrival.progressionGateId || !RETIRED_RESIDENT_NODE_ROOT_GATE_IDS.has(arrival.progressionGateId));
  return board.every((cell, index) => cell === state.board[index]) && storage.length === state.storage.length && arrivals.length === state.arrivals.length
    ? state
    : { ...state, board, storage, arrivals };
}

function migrateResidentCardItems(state: MergeWorldState): MergeWorldState {
  const migrateItem = (item: MergeBoardItem): MergeBoardItem => item.definitionId === LEGACY_RESIDENT_CARD_KEY_DEFINITION_ID
    ? { ...item, definitionId: RESIDENT_CARD_DEFINITION_ID }
    : item;
  const board = state.board.map((cell) => cell.occupant?.kind === 'item'
    ? { ...cell, occupant: migrateItem(cell.occupant) }
    : cell);
  const storage = state.storage.map(migrateItem);
  const arrivals = state.arrivals.map((arrival) => arrival.kind === 'resident_card_parcel'
    ? { ...arrival, itemDefinitionIds: arrival.itemDefinitionIds.map((id) => id === LEGACY_RESIDENT_CARD_KEY_DEFINITION_ID ? RESIDENT_CARD_DEFINITION_ID : id) }
    : arrival);
  return { ...state, board, storage, arrivals };
}

function recoverResidentCardDiscovery(state: MergeWorldState, now: number): MergeWorldState {
  let arrivals = state.arrivals;
  let records = state.residentCardDiscovery.records;
  for (const record of state.residentCardDiscovery.records) {
    if (record.status !== 'parcel_ready' && record.status !== 'parcel_claimed') continue;
    const cardExists = state.board.some((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === RESIDENT_CARD_DEFINITION_ID && cell.occupant.progressionGateId === record.nodeGateId)
      || state.storage.some((item) => item.definitionId === RESIDENT_CARD_DEFINITION_ID && item.progressionGateId === record.nodeGateId);
    const unclaimed = arrivals.find((arrival) => arrival.kind === 'resident_card_parcel' && arrival.discoveryId === record.id && arrival.claimedAt == null);
    if (cardExists || unclaimed) continue;
    const parcelId = `${record.parcelId ?? `arrival:${record.id}`}:reissue`;
    arrivals = [...arrivals, {
      id: parcelId, kind: 'resident_card_parcel', createdAt: now, dayId: localDayId(now), label: 'A veiled resident parcel',
      theme: 'nature', familyId: 'nature', chainId: 'nature:root-memory', characterId: 'mossprout', source: 'companion_progression',
      discoveryId: record.id, progressionGateId: record.nodeGateId, itemDefinitionIds: [RESIDENT_CARD_DEFINITION_ID], claimedAt: null, seenAt: null,
    }];
    records = records.map((candidate) => candidate.id === record.id ? { ...candidate, parcelId, status: 'parcel_ready' as const } : candidate);
  }
  return arrivals === state.arrivals && records === state.residentCardDiscovery.records ? state : {
    ...state, arrivals, residentCardDiscovery: { ...state.residentCardDiscovery, records },
  };
}

function installResidentCardNodes(
  board: MergeWorldState['board'],
  progress: MergeWorldState['residentCardDiscovery'],
): MergeWorldState['board'] {
  let next = board;
  const activeRecord = [...progress.records].reverse().find((record) => record.status === 'parcel_ready' || record.status === 'parcel_claimed') ?? null;
  for (const node of MOSSPROUT_RESIDENT_CARD_NODES) {
    // A resident occupies the physical card cell the player actually chose.
    // Resident identity is authored by the Journey and is deliberately not
    // hard-wired to a particular locked card position.
    const openedRecord = progress.records.find((candidate) => candidate.nodeCell === node.cell
      && (candidate.status === 'revealed' || candidate.status === 'orders_active' || candidate.status === 'card_earned'));
    const opened = Boolean(openedRecord);
    const cell = next[node.cell];
    if (!cell || cell.occupant) continue;
    if (opened) {
      if (!cell.locked && !cell.mist) continue;
      if (next === board) next = [...board];
      next[node.cell] = { ...cell, locked: false, blocker: null, mist: null };
      continue;
    }
    const ready = Boolean(activeRecord);
    const residentId = ready ? activeRecord!.residentId : null;
    const discoveryId = activeRecord?.id ?? `resident-node:${node.residentId}`;
    if (cell.mist?.kind === 'resident_card' && cell.mist.gateId === node.gateId && cell.mist.discoveryId === discoveryId && cell.mist.ready === ready && cell.mist.residentId === residentId) continue;
    if (next === board) next = [...board];
    next[node.cell] = {
      ...cell,
      locked: true,
      blocker: 'vines',
      mist: { kind: 'resident_card', discoveryId, gateId: node.gateId, residentId, ready },
    };
  }
  return next;
}

function activateResidentCardDiscovery(
  state: MergeWorldState,
  command: Extract<MergeWorldCommand, { type: 'activateResidentCardDiscovery' }>,
  now: number,
): MergeWorldCommandResult {
  const node = MOSSPROUT_RESIDENT_CARD_NODE_BY_RESIDENT.get(command.residentId);
  if (!node || command.residentId === 'mossprout') return unchanged(state, 'This resident does not have a campaign card node.');
  const existing = state.residentCardDiscovery.records.find((record) => record.residentId === command.residentId);
  if (existing) return unchanged({ ...state, board: installResidentCardNodes(state.board, state.residentCardDiscovery) });
  const occupiedCells = new Set(state.residentCardDiscovery.records
    .filter((record) => record.status === 'revealed' || record.status === 'orders_active' || record.status === 'card_earned')
    .map((record) => record.nodeCell));
  const allocatedNode = !occupiedCells.has(node.cell)
    ? node
    : MOSSPROUT_RESIDENT_CARD_NODES.find((candidate) => !occupiedCells.has(candidate.cell));
  if (!allocatedNode) return unchanged(state, 'Every resident card space has already been revealed.');
  const id = `resident-discovery:${command.journeyDayId}:${command.residentId}`;
  const parcelId = `arrival:${id}`;
  const record: MergeWorldState['residentCardDiscovery']['records'][number] = {
    id, campaignId: command.campaignId, journeyDayId: command.journeyDayId, residentId: command.residentId,
    nodeGateId: allocatedNode.gateId, nodeCell: allocatedNode.cell, status: 'parcel_ready', parcelId,
    revealedAt: null, dialogueSeenAt: null, servedOrderIds: [], earnedAt: null, cardRevealSeenAt: null,
  };
  const arrival: MergeWorldArrival = {
    id: parcelId, kind: 'resident_card_parcel', createdAt: now, dayId: localDayId(now),
    label: 'A veiled resident parcel', theme: 'nature', familyId: 'nature', chainId: 'nature:root-memory',
    characterId: 'mossprout', source: 'companion_progression', discoveryId: id, progressionGateId: allocatedNode.gateId,
    itemDefinitionIds: [RESIDENT_CARD_DEFINITION_ID], claimedAt: null, seenAt: null,
  };
  const residentCardDiscovery = { ...state.residentCardDiscovery, records: [...state.residentCardDiscovery.records, record] };
  const next = touch({
    ...state,
    residentCardDiscovery,
    arrivals: state.arrivals.some((candidate) => candidate.id === parcelId) ? state.arrivals : [...state.arrivals, arrival],
    board: installResidentCardNodes(state.board, residentCardDiscovery),
  }, now);
  return changed(next, 'A veiled card parcel is waiting for you.');
}

function ackResidentCardDialogue(state: MergeWorldState, discoveryId: string, now: number): MergeWorldCommandResult {
  const record = state.residentCardDiscovery.records.find((candidate) => candidate.id === discoveryId);
  if (!record || (record.status !== 'revealed' && record.status !== 'orders_active')) return unchanged(state);
  const orders = residentDiscoveryOrders(discoveryId, record.residentId, now);
  const first = orders[0];
  const activeOrders = state.activeOrders.some((order) => order.id === first.id) || record.servedOrderIds.includes(first.id)
    ? state.activeOrders
    : [...state.activeOrders.filter((order) => order.storyArcId !== discoveryId), first];
  const records = state.residentCardDiscovery.records.map((candidate) => candidate.id === discoveryId
    ? { ...candidate, status: 'orders_active' as const, dialogueSeenAt: candidate.dialogueSeenAt ?? now }
    : candidate);
  const garden = state.generators['wild-garden'];
  const generators = record.residentId === 'petalimp' && garden
    ? { ...state.generators, 'wild-garden': { ...garden, forcedDropDefinitionId: 'nature:garden:1' } }
    : state.generators;
  return changed(touch({
    ...state,
    activeOrders,
    generators,
    residentCardDiscovery: { ...state.residentCardDiscovery, records },
  }, now), `${record.residentId} has a garden request.`);
}

function ackResidentCardReveal(state: MergeWorldState, discoveryId: string, now: number): MergeWorldCommandResult {
  let updated = false;
  const records = state.residentCardDiscovery.records.map((record) => {
    if (record.id !== discoveryId || record.status !== 'card_earned' || record.cardRevealSeenAt != null) return record;
    updated = true;
    return { ...record, cardRevealSeenAt: now };
  });
  return updated ? changed(touch({ ...state, residentCardDiscovery: { ...state.residentCardDiscovery, records } }, now)) : unchanged(state);
}

function moveItem(state: MergeWorldState, from: number, to: number, now: number): MergeWorldCommandResult {
  if (!validCell(from) || !validCell(to) || from === to) return unchanged(state, 'Choose an open board space.');
  const source = state.board[from].occupant;
  const target = state.board[to].occupant;
  if (!source) return unchanged(state);
  const companionDiscoveryResult = advanceCompanionDiscovery(state, from, to, now);
  if (companionDiscoveryResult) return companionDiscoveryResult;
  const residentCard = state.board[to].mist?.kind === 'resident_card' ? state.board[to].mist : null;
  if (residentCard) {
    if (!residentCard.ready) return unchanged(state, 'This card is still veiled.', 'sealed_mist');
    const record = state.residentCardDiscovery.records.find((candidate) => candidate.id === residentCard.discoveryId
      && candidate.status === 'parcel_claimed');
    if (source.kind !== 'item' || source.definitionId !== RESIDENT_CARD_DEFINITION_ID || !record || source.progressionGateId !== record.nodeGateId) {
      return unchanged(state, 'Bring a sealed resident card from its parcel to this card.', 'wrong_echo_match');
    }
    if (!record) return unchanged(state);
    const board = [...state.board];
    board[from] = { ...board[from], occupant: null };
    board[to] = { ...board[to], locked: false, blocker: null, mist: null, occupant: null };
    const records = state.residentCardDiscovery.records.map((candidate) => candidate.id === record.id
      ? { ...candidate, nodeCell: to, nodeGateId: residentCard.gateId, status: 'revealed' as const, revealedAt: candidate.revealedAt ?? now }
      : candidate);
    const residentCardDiscovery = { ...state.residentCardDiscovery, records };
    const settledBoard = installResidentCardNodes(board, residentCardDiscovery);
    return {
      state: touch({ ...state, board: settledBoard, residentCardDiscovery }, now),
      changed: true, mergedCell: to, clearedMistCells: [to],
      residentCardRevealed: { discoveryId: record.id, residentId: record.residentId },
      message: `${record.residentId} was hiding behind the card.`,
    };
  }
  const rootbound = state.board[to].mist?.kind === 'rootbound_echo' ? state.board[to].mist : null;
  if (rootbound) {
    if (!rootbound.ready) return unchanged(state, 'This root is still listening for its condition.', 'sealed_mist');
    if (source.kind !== 'item' || source.definitionId !== rootbound.definitionId || source.progressionGateId !== rootbound.gateId) {
      return unchanged(state, 'Bring this root’s own Root Memory from Mossprout’s parcel.', 'wrong_echo_match');
    }
    const board = [...state.board];
    board[from] = { ...board[from], occupant: null };
    board[to] = { ...board[to], locked: false, blocker: null, mist: null, occupant: null };
    const receipt = { id: `rootbound:${rootbound.gateId}`, source: 'dream_echo' as const, clearedCells: [to], createdAt: now };
    let next = awakenMossproutRoot({
      ...state,
      board,
      boardAwakeningReceipts: state.boardAwakeningReceipts.some((entry) => entry.id === receipt.id) ? state.boardAwakeningReceipts : [...state.boardAwakeningReceipts, receipt],
    }, rootbound.gateId, now);
    next = touch(next, now);
    return {
      state: next, changed: true, mergedCell: to, dreamEchoClearedId: rootbound.id,
      clearedMistCells: [to],
      message: `${MOSSPROUT_ROOTBOUND_GATES_BY_ID.get(rootbound.gateId)?.title ?? 'A root'} awakened.`,
    };
  }
  const echo = state.board[to].mist?.kind === 'echo' ? state.board[to].mist : null;
  if (echo) {
    if (source.kind !== 'item' || source.definitionId !== echo.definitionId) return unchanged(state, 'Find its match.', 'wrong_echo_match');
    const resultId = MERGE_ITEMS_BY_ID.get(echo.definitionId)?.nextItemId ?? null;
    if (!resultId) return unchanged(state, 'This Dream Echo cannot grow any further.');
    const board = [...state.board];
    board[from] = { ...board[from], occupant: null };
    board[to] = {
      ...board[to],
      locked: false,
      blocker: null,
      mist: null,
      occupant: { kind: 'item', instanceId: `merge-item:${state.nextInstance}`, definitionId: resultId },
    };
    const receipt = { id: `dream-echo:${echo.id}`, source: 'dream_echo' as const, clearedCells: [to], createdAt: now };
    let next = touch({
      ...state,
      board,
      boardAwakeningReceipts: state.boardAwakeningReceipts.some((entry) => entry.id === receipt.id)
        ? state.boardAwakeningReceipts
        : [...state.boardAwakeningReceipts, receipt],
      nextInstance: state.nextInstance + 1,
    }, now);
    const discovery = applyDiscovery(next, resultId, now);
    next = discovery.state;
    return {
      state: next,
      changed: true,
      mergedCell: to,
      dreamEchoClearedId: echo.id,
      clearedMistCells: [to],
      discoveryId: discovery.newDiscovery ? resultId : undefined,
      message: `${MERGE_ITEMS_BY_ID.get(resultId)?.name ?? 'New item'} woke from the Dream Mist.`,
    };
  }
  if (state.board[to].locked) return unchanged(state, 'Choose an open board space.', 'locked_cell');
  const board = [...state.board];
  if (!target) {
    board[from] = { ...board[from], occupant: null };
    board[to] = { ...board[to], occupant: source };
    return changed(touch({ ...state, board }, now));
  }
  const progressionMergeGateId = source.kind === 'item' && target.kind === 'item'
    && source.progressionGateId && source.progressionGateId === target.progressionGateId
    && source.definitionId === target.definitionId
    && MERGE_ITEMS_BY_ID.get(source.definitionId)?.nextItemId === MOSSPROUT_ROOTBOUND_GATES_BY_ID.get(source.progressionGateId)?.rootMemoryDefinitionId
    ? source.progressionGateId
    : null;
  if (!progressionMergeGateId && ((source.kind === 'item' && isProgressionItem(source)) || (target.kind === 'item' && isProgressionItem(target)))) {
    return unchanged(state, 'A Root Memory only merges with its own Rootbound Echo.', 'wrong_echo_match');
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
    occupant: {
      kind: 'item', instanceId: `merge-item:${state.nextInstance}`, definitionId: resultId,
      ...(progressionMergeGateId ? { progressionGateId: progressionMergeGateId } : {}),
    },
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
  const storedOrder = state.activeOrders.find((item) => item.id === orderId);
  const order = storedOrder ? ensureOrderGlowReward(storedOrder) : undefined;
  if (orderId.startsWith('journey-cycle:') && (!order?.expiresAt || now >= order.expiresAt)) {
    return unchanged(state, 'Your companion is ready to return. These items are yours to keep.');
  }
  if (!order || !mergeOrderReady(state, order)) return unchanged(state, 'The requested items are not ready yet.');
  if (order.storyArcId === DAILY_GARDEN_ARC && order.storyBeatId !== localDayId(now)) return unchanged(state, 'New garden requests are ready for today. Your items are yours to keep.');
  const board = boardAfterServingOrder(state, order);
  if (order.storyArcId === DAILY_GARDEN_ARC) {
    const next = completeDailyGardenOrder({ ...state, board, coins: state.coins + order.reward.coins, completedOrderCount: state.completedOrderCount + 1, activeOrders: state.activeOrders.filter((item) => item.id !== orderId) }, order, now);
    const bonus = next.coins - state.coins > order.reward.coins;
    return { ...changed(touch(ensureProceduralOrders(next, now), now), bonus ? `Today’s garden complete! +${order.reward.coins} Glow + ${DAILY_GARDEN_BONUS} bonus Glow.` : `+${order.reward.coins} Glow`), servedOrderId: order.id };
  }
  if (orderId.startsWith('journey-cycle:')) return { ...changed(touch({
    ...state, board, coins: state.coins + order.reward.coins, activeOrders: state.activeOrders.filter((item) => item.id !== orderId),
    externalRewardReceipts: [...state.externalRewardReceipts, {
      id: `merge-story-served:${orderId}`, kind: 'story_order_served', characterId: order.characterId,
      amount: 0, sourceId: order.storyArcId ?? orderId, createdAt: now, appliedAt: null,
    }],
  }, now), `+${order.reward.coins} Glow and a little help for your companion’s return.`), servedOrderId: order.id };
  const completedOrderCount = state.completedOrderCount + 1;
  const mergeXp = state.mergeXp + order.reward.mergeXp;
  const completesStoryBundle = !order.storyStepCount
    || state.activeOrders.filter((item) => item.storyArcId === order.storyArcId && item.storyTargetLevel === order.storyTargetLevel).length <= 1;
  const externalRewardReceipts: MergeExternalRewardReceipt[] = [
    ...state.externalRewardReceipts,
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
  const fragmentGeneratorId = GENERATOR_BY_CHAIN[KATCHIMERA_MERGE_PROFILES[order.characterId].coreChains[0]];
  const fragmentGenerator = state.generators[fragmentGeneratorId];
  const generators = fragmentGenerator ? {
    ...state.generators,
    [fragmentGeneratorId]: {
      ...fragmentGenerator,
      upgradeFragments: fragmentGenerator.upgradeFragments + (order.signature || order.storyArcId ? 2 : 1),
    },
  } : state.generators;
  let residentCardEarned: MergeWorldCommandResult['residentCardEarned'];
  let next: MergeWorldState = {
    ...state,
    board,
    coins: state.coins + order.reward.coins,
    mergeXp,
    mergeLevel: mergeLevelForXp(mergeXp),
    storageCapacity: storageCapacityForLevel(mergeLevelForXp(mergeXp)),
    completedOrderCount,
    activeOrders: state.activeOrders.filter((item) => item.id !== orderId),
    recentOrderKeys: [...state.recentOrderKeys, templateKeyForOrder(order)].slice(-RECENT_ORDER_LIMIT),
    externalRewardReceipts,
    characterProgress,
    landmarks,
    generators,
  };
  const rewardCardId = order.reward.katchimeraCardId;
  if (rewardCardId) {
    const sourceReceiptId = `resident-order:${order.id}:${rewardCardId}`;
    const alreadyOwned = next.ownedKatchimeraCards.some((card) => (
      card.cardId === rewardCardId || card.sourceReceiptId === sourceReceiptId
    ));
    const residentIds = new Set<KatchimeraSkinId>(next.mossproutResidentSkinIds);
    residentIds.add(rewardCardId);
    next = {
      ...next,
      mossproutResidentSkinIds: MOSSPROUT_RESIDENT_IDS.filter((id) => residentIds.has(id)),
      ownedKatchimeraCards: alreadyOwned ? next.ownedKatchimeraCards : [...next.ownedKatchimeraCards, {
        cardId: rewardCardId,
        familyId: order.characterId,
        acquisition: 'story_resident',
        sourceReceiptId,
        acquiredAt: now,
        coinCost: 0,
      }],
    };
  }
  if (
    order.storyArcId === 'mossprout:casual-garden'
    && next.mossproutDailyGardenOrders?.dayId === order.storyBeatId
  ) {
    const currentDaily = next.mossproutDailyGardenOrders!;
    const tailSequence = mossproutTailSequence(order.id);
    const servedOrderIds = tailSequence == null
      ? [...new Set([...currentDaily.servedOrderIds, order.id])].slice(-3)
      : currentDaily.servedOrderIds;
    const chapterId = currentDaily.chapterId ?? mossproutWorldChapterForActiveDays(state.mossproutBoardProgression.activeDayIds.length).id;
    const dailyAfterServe = {
      ...currentDaily,
      servedOrderIds,
      activeTailSequences: (currentDaily.activeTailSequences ?? []).filter((sequence) => sequence !== tailSequence),
      tailServedCount: (currentDaily.tailServedCount ?? 0) + (tailSequence == null ? 0 : 1),
      lastRecipientSkinId: order.recipientSkinId ?? 'mossprout',
    };
    const queue = mossproutRoutineQueue(
      dailyAfterServe,
      now,
      chapterId,
      next.mossproutResidentSkinIds,
      next.activeOrders.filter((candidate) => candidate.storyArcId === 'mossprout:casual-garden'),
    );
    next = {
      ...next,
      activeOrders: [
        ...next.activeOrders.filter((candidate) => candidate.storyArcId !== 'mossprout:casual-garden'),
        ...queue.orders,
      ],
      mossproutDailyGardenOrders: queue.daily,
    };
  }
  next = advanceMossproutChapterZero(next, order.id, now);
  next = advanceGlowRequests(next, order.id, now);
  if (order.storyArcId === `${order.characterId}:discovery`) {
    const discoveryRecord = next.companionDiscovery.records.find((record) => record.characterId === order.characterId);
    const discoveryProgress = recordDiscoveryEvent({
      ...next.companionDiscovery,
      records: next.companionDiscovery.records.map((record) => record.characterId === order.characterId
        ? { ...record, firstOrderCompletedAt: record.firstOrderCompletedAt ?? now }
        : record),
    }, {
      id: `discovery-event:first-order:${order.characterId}`, kind: 'first_order_completed',
      gateId: discoveryRecord?.gateId ?? 'unknown', characterId: order.characterId, createdAt: now,
    });
    next = {
      ...next,
      companionDiscovery: discoveryProgress,
    };
  }
  if (order.id === 'steppling:discovery:first-trail' && next.generators['journey-locker']) {
    next = {
      ...next,
      stepplingGardenLesson: next.stepplingGardenLesson ? { ...next.stepplingGardenLesson, servedAt: now } : undefined,
      generators: {
        ...next.generators,
        'journey-locker': { ...next.generators['journey-locker'], forcedDropDefinitionId: null },
      },
    };
  }
  if (order.id.endsWith(':discovery:first-order')) {
    const generatorId = GENERATOR_BY_CHAIN[KATCHIMERA_MERGE_PROFILES[order.characterId].coreChains[0]];
    const discoveryGenerator = next.generators[generatorId];
    if (discoveryGenerator) next = {
      ...next,
      generators: { ...next.generators, [generatorId]: { ...discoveryGenerator, forcedDropDefinitionId: null } },
    };
  }
  const residentDiscovery = order.storyArcId
    ? next.residentCardDiscovery.records.find((record) => record.id === order.storyArcId && record.status === 'orders_active')
    : null;
  if (residentDiscovery) {
    const authoredOrders = residentDiscoveryOrders(residentDiscovery.id, residentDiscovery.residentId, now);
    const servedOrderIds = [...new Set([...residentDiscovery.servedOrderIds, order.id])];
    const nextAuthoredOrder = authoredOrders.find((candidate) => !servedOrderIds.includes(candidate.id));
    let ownedKatchimeraCards = next.ownedKatchimeraCards;
    let mossproutResidentSkinIds = next.mossproutResidentSkinIds;
    const earned = !nextAuthoredOrder;
    if (earned) {
      const sourceReceiptId = `resident-discovery-card:${residentDiscovery.id}`;
      if (!ownedKatchimeraCards.some((card) => card.cardId === residentDiscovery.residentId || card.sourceReceiptId === sourceReceiptId)) {
        ownedKatchimeraCards = [...ownedKatchimeraCards, {
          cardId: residentDiscovery.residentId,
          familyId: 'mossprout',
          acquisition: 'resident_discovery',
          sourceReceiptId,
          acquiredAt: now,
          coinCost: 0,
        }];
      }
      mossproutResidentSkinIds = MOSSPROUT_RESIDENT_IDS.filter((id) => id === 'mossprout' || ownedKatchimeraCards.some((card) => card.cardId === id));
      residentCardEarned = { discoveryId: residentDiscovery.id, residentId: residentDiscovery.residentId };
    }
    const records = next.residentCardDiscovery.records.map((record) => record.id === residentDiscovery.id
      ? {
          ...record,
          servedOrderIds,
          status: earned ? 'card_earned' as const : 'orders_active' as const,
          earnedAt: earned ? record.earnedAt ?? now : record.earnedAt,
        }
      : record);
    next = {
      ...next,
      activeOrders: nextAuthoredOrder && !next.activeOrders.some((candidate) => candidate.id === nextAuthoredOrder.id)
        ? [...next.activeOrders.filter((candidate) => candidate.storyArcId !== residentDiscovery.id), nextAuthoredOrder]
        : next.activeOrders,
      ownedKatchimeraCards,
      mossproutResidentSkinIds,
      residentCardDiscovery: { ...next.residentCardDiscovery, records },
    };
  }
  const awakening = MOSSPROUT_STORY_AWAKENINGS[order.id as keyof typeof MOSSPROUT_STORY_AWAKENINGS];
  let clearedMistCells: number[] | undefined;
  if (awakening && !next.boardAwakeningReceipts.some((receipt) => receipt.id === awakening.id)) {
    clearedMistCells = awakening.cells.filter((cell) => next.board[cell]?.mist != null && next.board[cell]?.mist?.kind !== 'echo');
    if (clearedMistCells.length) {
      const cells = new Set(clearedMistCells);
      next = touch({
        ...next,
        board: next.board.map((cell, index) => cells.has(index)
          ? { ...cell, locked: false, blocker: null, mist: null }
          : cell),
        boardAwakeningReceipts: [...next.boardAwakeningReceipts, {
          id: awakening.id,
          source: 'story',
          clearedCells: clearedMistCells,
          createdAt: now,
        }],
      }, now);
    }
  }
  const residentSequenceActive = next.residentCardDiscovery.records.some((record) => record.status !== 'locked' && record.status !== 'card_earned');
  if (!residentSequenceActive) next = ensureProceduralOrders(next, now);
  next = touch(next, now);
  return {
    state: next,
    changed: true,
    servedOrderId: order.id,
    energyGranted: 0,
    clearedMistCells,
    residentCardEarned,
    message: `${order.title} served.`,
  };
}

/**
 * Dev Haven fillers are intentionally absent from the persistent order queue.
 * Serving one still consumes its board items and grants its ordinary currency
 * rewards, but cannot advance story, resident, discovery, or order-deck state.
 */
function serveDevHavenOrder(state: MergeWorldState, order: MergeOrder, now: number): MergeWorldCommandResult {
  if (!isDevHavenOrderFiller(order) || !mergeOrderReady(state, order)) {
    return unchanged(state, 'The requested items are not ready yet.');
  }
  const mergeXp = state.mergeXp + order.reward.mergeXp;
  const mergeLevel = mergeLevelForXp(mergeXp);
  const next = touch({
    ...state,
    board: boardAfterServingOrder(state, order),
    coins: state.coins + order.reward.coins,
    mergeXp,
    mergeLevel,
    storageCapacity: storageCapacityForLevel(mergeLevel),
  }, now);
  return {
    state: next,
    changed: true,
    servedOrderId: order.id,
    energyGranted: 0,
    message: `${order.title} served.`,
  };
}

function boardAfterServingOrder(state: MergeWorldState, order: MergeOrder): MergeBoardCell[] {
  const remaining = new Map(order.requirements.map((requirement) => [requirement.definitionId, requirement.quantity]));
  return state.board.map((cell) => {
    const occupant = cell.occupant;
    if (!occupant || occupant.kind !== 'item') return cell;
    const needed = remaining.get(occupant.definitionId) ?? 0;
    if (needed < 1) return cell;
    remaining.set(occupant.definitionId, needed - 1);
    return { ...cell, occupant: null };
  });
}

function storeItem(state: MergeWorldState, cell: number, now: number): MergeWorldCommandResult {
  if (!validCell(cell) || state.storage.length >= state.storageCapacity) return unchanged(state, 'Storage is full.');
  const occupant = state.board[cell].occupant;
  if (!occupant || occupant.kind !== 'item') return unchanged(state, 'Only merge items can be stored.');
  if (isProgressionItem(occupant)) return unchanged(state, 'Root Memories stay on the board until they find their root.');
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
  if (isProgressionItem(occupant)) return unchanged(state, 'Root Memories cannot be sold.');
  const definition = MERGE_ITEMS_BY_ID.get(occupant.definitionId);
  const board = [...state.board];
  board[cell] = { ...board[cell], occupant: null };
  return changed(touch({ ...state, board, coins: state.coins + (definition?.sellValue ?? 1) }, now), `Sold for ${definition?.sellValue ?? 1} Glow.`);
}

function claimInbox(state: MergeWorldState, entryId: string, now: number): MergeWorldCommandResult {
  const entry = state.rewardInbox.find((item) => item.id === entryId);
  if (!entry) return unchanged(state);
  const openCells = state.board.flatMap((cell, index) => !cell.locked && !cell.mist && !cell.occupant ? [index] : []);
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
  if (arrival.generatorId) {
    const generatorId = arrival.generatorId;
    if (!MERGE_GENERATORS_BY_ID.has(generatorId)) return unchanged(state, 'This parcel could not be opened.');
    const alreadyInstalled = Boolean(state.generators[generatorId]) || state.board.some((cell) => cell.occupant?.kind === 'generator' && cell.occupant.generatorId === generatorId);
    const cell = state.board.findIndex((entry) => !entry.locked && !entry.mist && !entry.occupant);
    if (!alreadyInstalled && cell < 0) return unchanged(state, `Make one space in the Garden for the ${MERGE_GENERATORS_BY_ID.get(generatorId)!.name}.`);
    const board = [...state.board];
    if (!alreadyInstalled) board[cell] = { ...board[cell], occupant: { kind: 'generator', generatorId } };
    const installed = reconcileUnlockedCatalog({ ...state, board,
      generators: state.generators[generatorId] ? state.generators : { ...state.generators, [generatorId]: generatorState(generatorId) },
      arrivals: state.arrivals.map((entry) => entry.id === arrivalId ? { ...entry, claimedAt: now, seenAt: now } : entry),
    });
    return { ...changed(touch(ensureProceduralOrders(installed, now), now)), spawnedGenerator: alreadyInstalled ? undefined : { generatorId, cell } };
  }
  if (arrival.kind === 'memory_arrival') {
    return changed(touch({
      ...state,
      arrivals: state.arrivals.map((item) => item.id === arrivalId ? { ...item, claimedAt: now, seenAt: item.seenAt ?? now } : item),
    }, now), 'Memory saved to the shelf.');
  }
  const openCells = state.board.flatMap((cell, index) => !cell.locked && !cell.mist && !cell.occupant ? [index] : []);
  if (openCells.length < arrival.itemDefinitionIds.length) return unchanged(state, `Make ${arrival.itemDefinitionIds.length - openCells.length} more board spaces first.`);
  const board = [...state.board];
  let nextInstance = state.nextInstance;
  const spawnedItems: NonNullable<MergeWorldCommandResult['spawnedItems']> = [];
  arrival.itemDefinitionIds.forEach((definitionId, index) => {
    const instanceId = `merge-item:${nextInstance++}`;
    const cell = openCells[index];
    const progressionGateId = arrival.kind === 'root_match_parcel' || arrival.kind === 'resident_card_parcel' ? arrival.progressionGateId : undefined;
    board[cell] = { ...board[cell], occupant: { kind: 'item', instanceId, definitionId, ...(progressionGateId ? { progressionGateId } : {}) } };
    spawnedItems.push({ instanceId, definitionId, ...(progressionGateId ? { progressionGateId } : {}), cell });
  });
  const companionDiscovery = arrival.kind === 'discovery_parcel' && arrival.discoveryId
    ? recordDiscoveryEvent(state.companionDiscovery, {
        id: `discovery-event:parcel:${arrival.discoveryId}`, kind: 'parcel_claimed',
        gateId: state.companionDiscovery.active?.gateId ?? COMPANION_DISCOVERIES_BY_ID.get(arrival.discoveryId)?.gateId ?? 'unknown',
        discoveryId: arrival.discoveryId, characterId: arrival.characterId, createdAt: now,
      })
    : state.companionDiscovery;
  const residentCardDiscovery = arrival.kind === 'resident_card_parcel' && arrival.discoveryId
    ? {
        ...state.residentCardDiscovery,
        records: state.residentCardDiscovery.records.map((record) => record.id === arrival.discoveryId && record.status === 'parcel_ready'
          ? { ...record, status: 'parcel_claimed' as const }
          : record),
      }
    : state.residentCardDiscovery;
  return {
    ...changed(touch({
    ...state,
    board,
    nextInstance,
    arrivals: state.arrivals.map((item) => item.id === arrivalId ? { ...item, claimedAt: now, seenAt: item.seenAt ?? now } : item),
    companionDiscovery,
    residentCardDiscovery,
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
    // Receipt identity prevents duplicate grants. Do not impose a second daily
    // ceiling here: the reward policy already tapers repeat journal actions to
    // one Energy, and earned Energy is intentionally allowed above regen cap.
    const awarded = requested;
    amount += awarded;
    activityEnergyByDay[reward.grantDayId] = (activityEnergyByDay[reward.grantDayId] ?? 0) + awarded;
    // Activity rewards may retain non-item memory markers, but item-bearing
    // parcels are now authored exclusively by companion discovery gates.
    if (reward.arrival?.kind === 'memory_arrival' && !arrivals.some((arrival) => arrival.id === reward.arrival!.id)) {
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

function claimStepEnergy(
  state: MergeWorldState,
  command: Extract<MergeWorldCommand, { type: 'claimStepEnergy' }>,
  now: number,
): MergeWorldCommandResult {
  const observedSteps = Math.max(0, Math.floor(command.observedSteps));
  const existing = state.stepEnergyByDay[command.dayId];
  if (existing?.receiptIds.includes(command.receiptId) || (existing?.bootstrapClaimed && command.allowBootstrap)) {
    return {
      state,
      changed: false,
      energyGranted: 0,
      stepEnergyClaim: {
        consumedSteps: 0,
        remainingClaimableSteps: existing.remainderSteps,
        beforeEnergy: state.energy.value,
        afterEnergy: state.energy.value,
        status: 'duplicate',
      },
    };
  }
  const bootstrap = !existing && command.allowBootstrap;
  const highestObservedSteps = Math.max(existing?.highestObservedSteps ?? 0, observedSteps);
  const newSteps = bootstrap
    ? observedSteps
    : Math.max(0, observedSteps - (existing?.accountedSteps ?? observedSteps));
  const availableSteps = (existing?.remainderSteps ?? 0) + newSteps;
  const energyGranted = Math.floor(availableSteps / STEPS_PER_MERGE_ENERGY);
  const consumedSteps = energyGranted * STEPS_PER_MERGE_ENERGY;
  const remainderSteps = Math.max(0, availableSteps - consumedSteps);
  const nextDay = {
    highestObservedSteps,
    accountedSteps: highestObservedSteps,
    remainderSteps,
    energyAwarded: (existing?.energyAwarded ?? 0) + energyGranted,
    bootstrapClaimed: Boolean(existing?.bootstrapClaimed || bootstrap),
    lastObservedAt: command.observedAt,
    receiptIds: [...(existing?.receiptIds ?? []), command.receiptId],
  };
  const beforeEnergy = state.energy.value;
  const next = touch({
    ...state,
    energy: { ...state.energy, value: beforeEnergy + energyGranted },
    stepEnergyByDay: { ...state.stepEnergyByDay, [command.dayId]: nextDay },
  }, now);
  return {
    state: next,
    changed: true,
    energyGranted,
    stepEnergyClaim: {
      consumedSteps,
      remainingClaimableSteps: remainderSteps,
      beforeEnergy,
      afterEnergy: beforeEnergy + energyGranted,
      status: energyGranted > 0 ? 'awarded' : 'below_threshold',
    },
  };
}

function rerollOrder(state: MergeWorldState, orderId: string, now: number): MergeWorldCommandResult {
  const order = state.activeOrders.find((item) => item.id === orderId);
  const dayId = localDayId(now);
  if (!order || order.purpose === 'signature' || (order.storyArcId && order.storyArcId !== 'mossprout:casual-garden')) {
    return unchanged(state, 'Story requests stay until you are ready.');
  }
  if (order.storyArcId === 'mossprout:casual-garden') {
    if (state.lastFreeRerollDayId === dayId) return unchanged(state, 'Your free request change has already been used today.');
    const residents = MOSSPROUT_RESIDENT_IDS.filter((id) => state.mossproutResidentSkinIds.includes(id));
    const currentRecipient = (order.recipientSkinId ?? 'mossprout') as (typeof MOSSPROUT_RESIDENT_IDS)[number];
    const currentIndex = Math.max(0, residents.indexOf(currentRecipient));
    const recipientSkinId = residents.length > 1 ? residents[(currentIndex + 1) % residents.length]! : residents[0] ?? 'mossprout';
    const resident = mossproutResidentById.get(recipientSkinId)!;
    const copyIndex = proceduralOrderRank(`${order.id}:reroll:${dayId}`, 37) % resident.requestCopy.length;
    const replacement: MergeOrder = {
      ...order,
      recipientSkinId,
      title: resident.requestCopy[copyIndex]!.title,
      description: resident.requestCopy[copyIndex]!.description,
      createdAt: now,
      rerollAvailableAt: now + 86_400_000,
    };
    return changed(touch({
      ...state,
      activeOrders: state.activeOrders.map((candidate) => candidate.id === orderId ? replacement : candidate),
      lastFreeRerollDayId: dayId,
      mossproutDailyGardenOrders: state.mossproutDailyGardenOrders ? {
        ...state.mossproutDailyGardenOrders,
        lastRecipientSkinId: recipientSkinId,
      } : null,
    }, now), 'A different garden resident has a request.');
  }
  if ((order.rerollAvailableAt ?? order.createdAt + 86_400_000) > now) return unchanged(state, 'This request can be changed after it has had a day on the table.');
  if (state.lastFreeRerollDayId === dayId) return unchanged(state, 'Your free request change has already been used today.');
  const next: MergeWorldState = { ...state, activeOrders: state.activeOrders.filter((item) => item.id !== orderId), lastFreeRerollDayId: dayId, recentOrderKeys: [...state.recentOrderKeys, templateKeyForOrder(order)].slice(-RECENT_ORDER_LIMIT) };
  return changed(touch(ensureProceduralOrders(next, now), now), 'A different request drifted in.');
}

function reconcileCharacters(state: MergeWorldState, ids: string[], now: number): MergeWorldState {
  const additions = ids.filter((id): id is MergeCharacterId => KNOWN_CHARACTERS.has(id as MergeCharacterId) && !state.unlockedCharacters.includes(id as MergeCharacterId));
  if (!additions.length) return reconcileDiscoveryMist(state, now);
  const reconciled = touch(ensureProceduralOrders({
    ...state,
    unlockedCharacters: [...state.unlockedCharacters, ...additions],
    companionDiscovery: {
      ...state.companionDiscovery,
      records: [
        ...state.companionDiscovery.records,
        ...additions.map((characterId) => ({
          characterId,
          source: 'legacy_grandfather' as const,
          gateId: `legacy:${characterId}`,
          pathId: null,
          discoveredAt: now,
          revealSeenAt: now,
          firstOrderCompletedAt: now,
          permanentFeatureId: null,
        })),
      ],
    },
  }, now), now);
  return reconcileDiscoveryMist(reconciled, now);
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
  return next === state ? state : touch(ensureProceduralOrders(next, now), now);
}

function reconcileMossproutResidents(
  state: MergeWorldState,
  signals: Extract<MergeWorldCommand, { type: 'reconcileCharacterActivity' }>['residentSignals'],
  now: number,
): MergeWorldState {
  if (!signals) return state;
  // Relationship signals choose and schedule residents, but never grant cards.
  // Parcel -> locked node -> dialogue -> two orders is the only new-card path.
  const orderedResidentIds = MOSSPROUT_RESIDENT_IDS.filter((residentId) => (
    residentId === 'mossprout' || state.ownedKatchimeraCards.some((card) => card.cardId === residentId)
  ));
  const residentsChanged = orderedResidentIds.length !== state.mossproutResidentSkinIds.length
    || orderedResidentIds.some((id, index) => id !== state.mossproutResidentSkinIds[index]);
  if (!residentsChanged) return state;
  return touch({ ...state, mossproutResidentSkinIds: orderedResidentIds }, now);
}

function reconcileCharacterActivity(
  state: MergeWorldState,
  command: Extract<MergeWorldCommand, { type: 'reconcileCharacterActivity' }>,
  now: number,
): MergeWorldCommandResult {
  if (command.familyId !== 'mossprout') return unchanged(state);
  let next = reconcileMossproutResidents(ensureCharacterGenerators(state, 'mossprout', now), command.residentSignals, now);
  const journeyExclusive = command.status !== 'idle' && command.status !== 'complete';
  const showsOrder = (command.status === 'activity_available' || command.status === 'activity_in_progress') && command.activity != null;
  const keepOrders = next.activeOrders.filter((order) => (
    order.characterId !== 'mossprout'
    || ((order.storyArcId !== 'mossprout:dry-pond' && !order.storyArcId?.startsWith('mossprout:chapter:'))
      && (order.storyArcId !== 'mossprout:casual-garden' || !journeyExclusive))
  ));
  const activity = command.activity;
  const episodeDefinition = activity ? mossproutCampaignEpisodeByObjectiveId.get(activity.objectiveId) : null;
  const extendedStoryBeat = activity ? mossproutExtendedBeatByObjectiveId.get(activity.objectiveId) : null;
  const legacyRequirements = extendedStoryBeat ? [...extendedStoryBeat.requirements]
    : activity?.objectiveId === 'mossprout:objective:place-for-rain'
    ? [{ definitionId: 'nature:waterside:2', quantity: 1 }]
    : activity?.objectiveId === 'mossprout:objective:bank-that-holds'
      ? [{ definitionId: 'nature:garden:3', quantity: 1 }]
      : activity?.objectiveId === 'mossprout:objective:little-rain-garden'
        ? [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:waterside:3', quantity: 1 }]
        : [];
  const legacyTitle = extendedStoryBeat?.title ?? (activity?.objectiveId === 'mossprout:objective:place-for-rain'
    ? 'A Place for Rain'
    : activity?.objectiveId === 'mossprout:objective:bank-that-holds'
      ? 'A Bank That Holds'
      : 'The Little Rain Garden');
  const legacyCoinReward = activity?.objectiveId === 'mossprout:objective:place-for-rain' ? 20
    : activity?.objectiveId === 'mossprout:objective:bank-that-holds' ? 30 : 50;
  const authoredOrders = episodeDefinition?.mergeOrders.length
    ? episodeDefinition.mergeOrders
    : activity ? [{ id: activity.mergeOrderId, title: legacyTitle, description: extendedStoryBeat?.description ?? 'Make this living piece for the Garden.', requirements: legacyRequirements, coins: legacyCoinReward }] : [];
  const servedOrderIds = new Set(activity?.servedOrderIds ?? []);
  const activeOrderDefinition = authoredOrders.find((order) => !servedOrderIds.has(order.id)) ?? null;
  const existingOrder = activeOrderDefinition ? next.activeOrders.find((order) => order.id === activeOrderDefinition.id) : null;
  const guestSkinId = episodeDefinition?.guestSkinId === 'matched'
    ? command.residentSignals?.firstResidentSkinId ?? null
    : episodeDefinition?.guestSkinId ?? null;
  const authoredStoryOrder: MergeOrder | null = showsOrder && activity && activeOrderDefinition ? {
    id: activeOrderDefinition.id,
    characterId: 'mossprout',
    recipientSkinId: guestSkinId ?? undefined,
    title: activeOrderDefinition.title,
    description: activeOrderDefinition.description,
    difficulty: activeOrderDefinition.requirements.length > 1 ? 'major' : 'small',
    requirements: [...activeOrderDefinition.requirements],
    reward: {
      coins: activeOrderDefinition.coins,
      mergeXp: 0,
      friendshipXp: 0,
      energy: 0,
      katchimeraCardId: undefined,
    },
    createdAt: now,
    signature: false,
    purpose: 'normal',
    storyArcId: episodeDefinition?.chapterId ?? extendedStoryBeat?.chapterId ?? 'mossprout:dry-pond',
    storyBeatId: activity.objectiveId,
    storyStep: Math.max(1, authoredOrders.findIndex((order) => order.id === activeOrderDefinition.id) + 1),
    storyStepCount: authoredOrders.length,
  } : null;
  // Re-author the active activity order on reconciliation so a Journey result
  // that arrives after the order shell was first created cannot leave a stale
  // Mossprout recipient or omit the card reward.
  const storyOrder = authoredStoryOrder && existingOrder
    ? { ...existingOrder, ...authoredStoryOrder, createdAt: existingOrder.createdAt }
    : authoredStoryOrder;
  let activeOrders = storyOrder ? [...keepOrders, storyOrder] : keepOrders;
  let dailyGarden = next.mossproutDailyGardenOrders;
  if (!showsOrder && !journeyExclusive && !next.companionDailyGarden?.mossprout && (!next.companionDailyGardenVersion || next.mossproutDailyGardenOrders?.dayId === localDayId(now))) {
    const sameDay = dailyGarden?.dayId === command.dayId;
    const chapterId = sameDay && dailyGarden?.chapterId
      ? dailyGarden.chapterId
      : mossproutWorldChapterForActiveDays(next.mossproutBoardProgression.activeDayIds.length).id;
    const baseDaily: NonNullable<MergeWorldState['mossproutDailyGardenOrders']> = sameDay ? dailyGarden! : {
      dayId: command.dayId,
      chapterId,
      activeOrderId: null,
      offeredOrderIds: [],
      servedOrderIds: [],
      complete: false,
      nextOrderSequence: 4,
      tailServedCount: 0,
      activeTailSequences: [],
      lastRecipientSkinId: null,
    };
    const queue = mossproutRoutineQueue(
      baseDaily,
      now,
      chapterId,
      next.mossproutResidentSkinIds,
      activeOrders.filter((order) => order.storyArcId === 'mossprout:casual-garden'),
    );
    activeOrders = [
      ...activeOrders.filter((order) => order.storyArcId !== 'mossprout:casual-garden'),
      ...queue.orders,
    ];
    dailyGarden = queue.daily;
  }
  let opportunities = next.characterActivityOpportunities;
  if (activity && activity.dropDefinitionIds.length > 0) {
    const existingOpportunity = opportunities.find((opportunity) => opportunity.id === activity.opportunityId);
    if (!existingOpportunity) {
      opportunities = [...opportunities, {
        id: activity.opportunityId,
        familyId: 'mossprout',
        dayId: command.dayId,
        generatorId: activity.generatorId,
        dropDefinitionIds: [...activity.dropDefinitionIds],
        usedCount: 0,
        createdAt: now,
      }];
    } else if (
      existingOpportunity.dropDefinitionIds.length !== activity.dropDefinitionIds.length
      || existingOpportunity.dropDefinitionIds.some((definitionId, index) => definitionId !== activity.dropDefinitionIds[index])
    ) {
      // Repair active saves created before multi-order Journey baskets carried
      // enough authored ingredients for every required order.
      opportunities = opportunities.map((opportunity) => opportunity.id === activity.opportunityId ? {
        ...opportunity,
        dropDefinitionIds: [...activity.dropDefinitionIds],
        usedCount: Math.min(opportunity.usedCount, activity.dropDefinitionIds.length),
      } : opportunity);
    }
  }
  const changedState = next !== state
    || activeOrders.length !== next.activeOrders.length
    || activeOrders.some((order, index) => order.id !== next.activeOrders[index]?.id)
    || dailyGarden !== next.mossproutDailyGardenOrders
    || opportunities !== next.characterActivityOpportunities;
  if (!changedState) return unchanged(state);
  next = touch({
    ...next,
    activeOrders,
    mossproutDailyGardenOrders: dailyGarden,
    characterActivityOpportunities: opportunities,
  }, now);
  return changed(next, "Mossprout's Garden is ready.");
}

type MossproutChapterId = MossproutWorldChapter['id'];

function mossproutDailyGardenOrderWindow(chapterId: MossproutChapterId) {
  return chapterId === 'quiet-patch' ? 1 : chapterId === 'returning-pond' ? 2 : 3;
}

function mossproutResidentForOrder(
  dayId: string,
  sequence: number,
  residentSkinIds: readonly KatchimeraSkinId[],
): KatchimeraSkinId {
  const available = MOSSPROUT_RESIDENT_IDS.filter((id) => residentSkinIds.includes(id));
  const pool = available.length ? available : ['mossprout'];
  const start = proceduralOrderRank(dayId, 11) % pool.length;
  return pool[(start + sequence - 1) % pool.length]!;
}

function mossproutDailyGardenOrder(
  dayId: string,
  sequence: number,
  now: number,
  chapterId: MossproutChapterId,
  residentSkinIds: readonly KatchimeraSkinId[],
): MergeOrder {
  const authored = sequence <= 3;
  // Follow-up requests alternate combinations and higher tiers; never restart
  // the easy introductory request after the daily batch has been served.
  const step = authored ? sequence : 2 + ((sequence - 4) % 2);
  const recipientSkinId = mossproutResidentForOrder(dayId, sequence, residentSkinIds);
  const resident = mossproutResidentById.get(recipientSkinId) ?? mossproutResidentById.get('mossprout')!;
  const theme = resident.requestThemes[proceduralOrderRank(`${dayId}:${sequence}`, 17) % resident.requestThemes.length];
  const gardenFirst = theme === 'garden' ? true : theme === 'waterside' ? false : proceduralOrderRank(dayId, sequence) % 2 === 0;
  const primary = gardenFirst ? 'nature:garden' : 'nature:waterside';
  const secondary = gardenFirst ? 'nature:waterside' : 'nature:garden';
  const requirements = authored && chapterId === 'heartwood' && step === 2
    ? [{ definitionId: 'nature:keepsake:4', quantity: 1 }, { definitionId: `${primary}:5`, quantity: 1 }]
    : authored && chapterId === 'heartwood' && step === 3
      ? [{ definitionId: 'nature:keepsake:5', quantity: 1 }, { definitionId: `${primary}:6`, quantity: 1 }]
      : authored && chapterId === 'memory-nursery' && step === 2
      ? [{ definitionId: 'nature:keepsake:2', quantity: 1 }, { definitionId: `${primary}:3`, quantity: 1 }]
      : authored && chapterId === 'memory-nursery' && step === 3
        ? [{ definitionId: 'hybrid:memory-bloom', quantity: 1 }, { definitionId: `${secondary}:4`, quantity: 1 }]
        : step === 1
          ? [{ definitionId: `${primary}:${chapterId === 'quiet-patch' ? 2 : chapterId === 'returning-pond' ? 3 : 4}`, quantity: 1 }]
          : step === 2
            ? [{ definitionId: `${secondary}:${authored && chapterId === 'quiet-patch' ? 2 : 3}`, quantity: 1 }, { definitionId: `${primary}:${authored && chapterId === 'quiet-patch' ? 2 : 3}`, quantity: 1 }]
            : [{ definitionId: `${primary}:${chapterId === 'quiet-patch' ? 4 : 5}`, quantity: 1 }, { definitionId: `${secondary}:${chapterId === 'quiet-patch' ? 3 : 4}`, quantity: 1 }];
  const difficulty = step === 1 ? 'small' as const : step === 2 ? 'medium' as const : 'major' as const;
  const copy = resident.requestCopy[proceduralOrderRank(`${dayId}:${sequence}`, 29) % resident.requestCopy.length]!;
  const fullReward = step === 1
    ? { coins: 20, mergeXp: 18, friendshipXp: 0, energy: 2 }
    : step === 2
      ? { coins: 45, mergeXp: 36, friendshipXp: 0, energy: 3 }
      : { coins: 80, mergeXp: 64, friendshipXp: 0, energy: 4 };
  return {
    id: authored
      ? `merge-order:mossprout:daily:${dayId}:${sequence}`
      : `merge-order:mossprout:daily:${dayId}:tail:${sequence}`,
    characterId: 'mossprout',
    recipientSkinId,
    title: copy.title,
    description: copy.description,
    difficulty,
    requirements,
    reward: authored ? fullReward : {
      coins: Math.max(1, Math.round(fullReward.coins * 0.4)),
      mergeXp: Math.max(1, Math.round(fullReward.mergeXp * 0.4)),
      friendshipXp: 0,
      energy: 0,
    },
    createdAt: now,
    signature: false,
    purpose: 'normal',
    storyArcId: 'mossprout:casual-garden',
    storyBeatId: dayId,
    storyStep: sequence,
    storyStepCount: authored ? 3 : undefined,
  };
}

function mossproutDailyGardenOrderBatch(
  dayId: string,
  now: number,
  chapterId: MossproutChapterId,
  residentSkinIds: readonly KatchimeraSkinId[] = ['mossprout'],
): MergeOrder[] {
  return [1, 2, 3].map((step) => mossproutDailyGardenOrder(dayId, step, now, chapterId, residentSkinIds));
}

function mossproutTailSequence(orderId: string): number | null {
  const match = orderId.match(/:tail:(\d+)$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value >= 4 ? value : null;
}

function mossproutRoutineQueue(
  daily: NonNullable<MergeWorldState['mossproutDailyGardenOrders']>,
  now: number,
  chapterId: MossproutChapterId,
  residentSkinIds: readonly KatchimeraSkinId[],
  existingOrders: readonly MergeOrder[] = [],
) {
  const window = mossproutDailyGardenOrderWindow(chapterId);
  const authored = [1, 2, 3].filter((sequence) => !daily.servedOrderIds.includes(`merge-order:mossprout:daily:${daily.dayId}:${sequence}`));
  const activeTailSequences = [...new Set((daily.activeTailSequences ?? []).filter((sequence) => Number.isInteger(sequence) && sequence >= 4))];
  let nextOrderSequence = Math.max(4, daily.nextOrderSequence ?? 4);
  const sequences = [...authored, ...activeTailSequences].slice(0, window);
  while (sequences.length < window) {
    sequences.push(nextOrderSequence);
    activeTailSequences.push(nextOrderSequence);
    nextOrderSequence += 1;
  }
  const existingById = new Map(existingOrders.map((order) => [order.id, order]));
  const orders = sequences.map((sequence) => {
    const generated = mossproutDailyGardenOrder(daily.dayId, sequence, now, chapterId, residentSkinIds);
    return existingById.get(generated.id) ?? generated;
  });
  return {
    orders,
    daily: {
      ...daily,
      chapterId,
      activeOrderId: orders[0]?.id ?? null,
      offeredOrderIds: [1, 2, 3].map((sequence) => `merge-order:mossprout:daily:${daily.dayId}:${sequence}`),
      complete: daily.servedOrderIds.length >= 3,
      nextOrderSequence,
      activeTailSequences: sequences.filter((sequence) => sequence >= 4),
    },
  };
}

function grantKatchimeraCard(
  state: MergeWorldState,
  cardId: string,
  familyId: MergeCharacterId,
  sourceReceiptId: string,
  now: number,
): MergeWorldCommandResult {
  const definition = katchimeraSkinById.get(cardId);
  if (!definition || definition.familyId !== familyId || !definition.visualKey || !KNOWN_CHARACTERS.has(familyId)) {
    return unchanged(state, 'That card is not ready yet.');
  }
  if (familyId === 'mossprout' && MOSSPROUT_RESIDENT_CARD_NODE_BY_RESIDENT.has(cardId)) {
    return unchanged(state, 'Meet this resident through its veiled garden card.');
  }
  if (state.ownedKatchimeraCards.some((card) => card.cardId === cardId || card.sourceReceiptId === sourceReceiptId)) {
    return unchanged(state, 'That card is already in your collection.');
  }
  return changed(touch({
    ...state,
    ownedKatchimeraCards: [...state.ownedKatchimeraCards, {
      cardId,
      familyId,
      acquisition: 'journey_match',
      sourceReceiptId,
      acquiredAt: now,
      coinCost: 0,
    }],
  }, now), `${definition.displayName} joined your card collection.`);
}

function purchaseKatchimeraCard(
  state: MergeWorldState,
  cardId: string,
  familyId: MergeCharacterId,
  cost: number,
  purchaseId: string,
  now: number,
): MergeWorldCommandResult {
  const definition = katchimeraSkinById.get(cardId);
  const coinCost = Math.max(0, Math.floor(cost));
  if (!definition || definition.familyId !== familyId || !definition.visualKey || !KNOWN_CHARACTERS.has(familyId)) {
    return unchanged(state, 'That card is not ready yet.');
  }
  if (familyId === 'mossprout' && MOSSPROUT_RESIDENT_CARD_NODE_BY_RESIDENT.has(cardId)) {
    return unchanged(state, 'Meet this resident through its veiled garden card.');
  }
  if (state.ownedKatchimeraCards.some((card) => card.cardId === cardId || card.sourceReceiptId === purchaseId)) {
    return unchanged(state, 'That card is already in your collection.');
  }
  const familyCollectionOpen = state.ownedKatchimeraCards.some((card) => card.familyId === familyId && card.acquisition === 'journey_match');
  if (!familyCollectionOpen) return unchanged(state, 'Discover your matched card first.');
  if (state.coins < coinCost) return unchanged(state, `You need ${coinCost} Glow for this card.`);
  return changed(touch({
    ...state,
    coins: state.coins - coinCost,
    ownedKatchimeraCards: [...state.ownedKatchimeraCards, {
      cardId,
      familyId,
      acquisition: 'coins',
      sourceReceiptId: purchaseId,
      acquiredAt: now,
      coinCost,
    }],
  }, now), `${definition.displayName} joined your card collection.`);
}

function reconcileStory(
  state: MergeWorldState,
  story: Extract<MergeWorldCommand, { type: 'reconcileStory' }>,
  now: number,
): MergeWorldState {
  // This discovery path delivers the generator through Day 1's parcel, not
  // through the retired companion story's automatic starter installation.
  if (story.familyId === 'steppling' && state.stepplingEgg && !state.generators['journey-locker']) return state;
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
    const existing = next.activeOrders.filter((order) => order.characterId === story.familyId && Boolean(order.storyArcId));
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
    const keep = next.activeOrders.filter((order) => order.characterId !== story.familyId || !order.storyArcId || order.storyArcId === DAILY_GARDEN_ARC || order.id.startsWith('journey-cycle:'));
    const activeOrders = [...keep, ...wanted.map((order) => existing.find((item) => item.id === order.id
      && JSON.stringify(item.requirements) === JSON.stringify(order.requirements)) ?? order)];
    if (activeOrders.length !== next.activeOrders.length || activeOrders.some((order, index) => order.id !== next.activeOrders[index]?.id)) {
      next = { ...next, activeOrders };
    }
    return next === state ? state : touch(next, now);
  }
  const feastleOrders = state.activeOrders.filter((order) => order.characterId === 'feastle' && Boolean(order.storyArcId));
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
  const keepOrders = state.activeOrders.filter((order) => order.characterId !== 'feastle' || !order.storyArcId);
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

  if (characterId === 'mossprout') {
    if (targetLevel <= 2) return [order('level-2', 'A Place for Rain', [
      { definitionId: 'nature:waterside:2', quantity: 1 },
    ], 1, 1)];
    if (targetLevel === 3) return [order('level-3', 'A Bank That Holds', [
      { definitionId: 'nature:garden:3', quantity: 1 },
      { definitionId: 'nature:waterside:2', quantity: 1 },
    ], 1, 1)];
    return [order('level-4:signature', 'The Little Rain Garden', [
      { definitionId: 'nature:garden:4', quantity: 1 },
      { definitionId: 'nature:waterside:3', quantity: 1 },
    ], 1, 1, true)];
  }

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
  const cell = !board[preferred].locked && !board[preferred].mist && !board[preferred].occupant ? preferred : firstEmptyCell(board, preferred);
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

function ensureProceduralOrders(state: MergeWorldState, now: number): MergeWorldState {
  // Chapter 0 is still teaching the authored loop. The repeatable economy
  // begins after the first non-Mossprout companion completes their introduction.
  const unlocked = state.companionDiscovery.records.some((record) => record.characterId !== 'mossprout' && record.firstOrderCompletedAt != null)
    || stepplingShoeServed(state)
    || Object.values(state.companionDailyGarden ?? {}).some((batch) => Boolean(batch?.bonusReceiptId))
    || Boolean(state.stepplingEgg?.hatchedAt && state.arrivals.some((arrival) => arrival.generatorId === 'journey-locker' && arrival.claimedAt != null));
  if (!unlocked) return state;
  // Rehydrate the same batches displayed by Tend garden, including older saves
  // whose daily requests were removed by story reconciliation.
  for (const familyId of ['mossprout', 'steppling'] as const) state = ensureCompanionDailyGarden(state, familyId, now);
  const procedural = state.activeOrders.filter((order) => !order.storyArcId);
  const existingKeys = new Set(procedural.map(templateKeyForOrder));
  const recent = new Set(state.recentOrderKeys);
  const eligible = MERGE_REPEATABLE_ORDER_TEMPLATES.filter((template) => {
    if (template.signature || template.chapterId || !state.unlockedCharacters.includes(template.characterId)) return false;
    if (existingKeys.has(template.key)) return false;
    const friendship = state.characterProgress[template.characterId]?.friendshipLevel ?? 1;
    if (template.minimumFriendshipLevel && friendship < template.minimumFriendshipLevel) return false;
    if (template.maximumFriendshipLevel && friendship > template.maximumFriendshipLevel) return false;
    return template.requirements.every((requirement) => {
      const definition = MERGE_ITEMS_BY_ID.get(requirement.definitionId);
      return Boolean(definition && state.unlockedChains.includes(definition.chainId));
    });
  });
  const ranked = [...eligible].sort((left, right) => {
    const leftRecent = recent.has(left.key) ? 1 : 0;
    const rightRecent = recent.has(right.key) ? 1 : 0;
    if (leftRecent !== rightRecent) return leftRecent - rightRecent;
    const leftFavourite = left.characterId === state.favouriteCharacterId ? 0 : 1;
    const rightFavourite = right.characterId === state.favouriteCharacterId ? 0 : 1;
    if (leftFavourite !== rightFavourite) return leftFavourite - rightFavourite;
    return proceduralOrderRank(left.key, state.completedOrderCount + state.haven.nextProceduralOrder)
      - proceduralOrderRank(right.key, state.completedOrderCount + state.haven.nextProceduralOrder);
  });
  const represented = new Set(procedural.map((order) => order.characterId));
  const guaranteed = ranked.filter((template) => {
    if (represented.has(template.characterId)) return false;
    represented.add(template.characterId);
    return true;
  });
  const selected = [...guaranteed, ...ranked.filter((template) => !guaranteed.includes(template))]
    .slice(0, Math.max(guaranteed.length, 3 - procedural.length));
  const count = selected.length;
  if (count < 1) return state;
  const orders = selected.map((template, index): MergeOrder => ({
    id: `merge-order:${state.haven.nextProceduralOrder + index}:${template.key}`,
    characterId: template.characterId,
    title: template.title,
    difficulty: template.difficulty,
    requirements: template.requirements.map((requirement) => ({ ...requirement })),
    reward: { ...template.reward },
    createdAt: now,
    rerollAvailableAt: now + 86_400_000,
    signature: false,
    purpose: 'normal',
  })).map(ensureOrderGlowReward);
  return {
    ...state,
    activeOrders: [...state.activeOrders, ...orders],
    haven: { ...state.haven, nextProceduralOrder: state.haven.nextProceduralOrder + count },
  };
}

function proceduralOrderRank(key: string, seed: number) {
  let hash = seed | 0;
  for (let index = 0; index < key.length; index += 1) hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  return hash >>> 0;
}

function templateKeyForOrder(order: MergeOrder) {
  if (order.id.startsWith('merge-order:')) return order.id.split(':').slice(2).join(':');
  return order.id.split(':').slice(4).join(':') || order.title;
}

function applyDiscovery(state: MergeWorldState, definitionId: string, now: number) {
  if (state.discoveries.includes(definitionId)) return { state, newDiscovery: false };
  const mergeXp = state.mergeXp + 6;
  return {
    state: touch({
      ...state,
      discoveries: [...state.discoveries, definitionId],
      // The first lesson teaches one explicit source: serving a request.
      // Retain the established discovery bonus after that introduction.
      coins: state.coins + (isMossproutChapterZeroActive(state) ? 0 : 5),
      mergeXp,
      mergeLevel: mergeLevelForXp(mergeXp),
    }, now),
    newDiscovery: true,
  };
}

function refreshTime(state: MergeWorldState, now: number): MergeWorldState {
  let changedState = false;
  const generators = Object.fromEntries(Object.entries(state.generators).map(([id, generator]) => {
    if (generator.charges > 0 || generator.restStartedAt == null) return [id, generator];
    if (now - generator.restStartedAt < generator.restDurationMs) return [id, generator];
    changedState = true;
    return [id, { ...generator, charges: generator.capacity, restStartedAt: null }];
  }));
  return changedState ? touch({ ...state, generators }, now) : state;
}

function normalizeStepEnergyByDay(value: unknown): MergeWorldState['stepEnergyByDay'] {
  if (!value || typeof value !== 'object') return {};
  const normalized: MergeWorldState['stepEnergyByDay'] = {};
  for (const [dayId, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== 'object') continue;
    const source = raw as Partial<MergeWorldState['stepEnergyByDay'][string]>;
    const energyAwarded = Math.max(0, Math.floor(finite(source.energyAwarded, 0)));
    normalized[dayId] = {
      highestObservedSteps: Math.max(0, Math.floor(finite(source.highestObservedSteps, 0))),
      accountedSteps: Math.max(0, Math.floor(finite(source.accountedSteps, 0))),
      remainderSteps: Math.max(0, Math.floor(finite(source.remainderSteps, 0))) % STEPS_PER_MERGE_ENERGY,
      energyAwarded,
      bootstrapClaimed: Boolean(source.bootstrapClaimed),
      lastObservedAt: typeof source.lastObservedAt === 'string' ? source.lastObservedAt : '',
      receiptIds: uniqueStrings(source.receiptIds),
    };
  }
  return normalized;
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
    forcedDropDefinitionId: null,
    capacity: 12,
    charges: 12,
    restDurationMs: 18 * 60_000,
    restStartedAt: null,
  };
}

function firstEmptyCell(board: MergeBoardCell[], offset: number) {
  for (let step = 0; step < board.length; step += 1) {
    const index = (Math.abs(offset) + step) % board.length;
    if (!board[index].locked && !board[index].mist && !board[index].occupant) return index;
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

function unchanged(state: MergeWorldState, message?: string, failureReason?: MergeWorldCommandResult['failureReason']): MergeWorldCommandResult {
  return { state, changed: false, message, failureReason };
}

function validCell(index: number) {
  return Number.isInteger(index) && index >= 0 && index < MERGE_WORLD_SIZE;
}

function regionForCell(index: number): MergeBoardCell['regionId'] {
  const row = Math.floor(index / 7);
  const column = index % 7;
  const distance = Math.max(Math.abs(row - 4), Math.abs(column - 3));
  if (distance <= 1) return 'central-clearing';
  if (distance <= 2) return 'inner-mist';
  if (distance <= 3) return 'mid-mist';
  if (row === 0 || row === 8) return 'ancient-dream';
  return 'deep-mist';
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
      || (arrival.kind !== 'contextual_parcel' && arrival.kind !== 'memory_arrival' && arrival.kind !== 'goal_chest' && arrival.kind !== 'discovery_parcel' && arrival.kind !== 'root_match_parcel' && arrival.kind !== 'resident_card_parcel')
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
      source: arrival.source === 'journal' || arrival.source === 'companion_story' || arrival.source === 'goal' || arrival.source === 'legacy' || arrival.source === 'discovery' || arrival.source === 'companion_progression'
        ? arrival.source
        : arrival.kind === 'goal_chest'
          ? 'goal'
          : arrival.id.includes('companion-story-starter') ? 'companion_story' : arrival.kind === 'memory_arrival' ? 'journal' : 'legacy',
      itemDefinitionIds: (arrival.id.startsWith('journey-cycle:') && Array.isArray(arrival.itemDefinitionIds)
        ? arrival.itemDefinitionIds.filter((id): id is string => typeof id === 'string') : uniqueStrings(arrival.itemDefinitionIds)).filter((id) => MERGE_ITEMS_BY_ID.has(id)),
      generatorId: typeof arrival.generatorId === 'string' && MERGE_GENERATORS_BY_ID.has(arrival.generatorId) ? arrival.generatorId : undefined,
      discoveryId: typeof arrival.discoveryId === 'string' ? arrival.discoveryId : undefined,
      progressionGateId: typeof arrival.progressionGateId === 'string' && (MOSSPROUT_ROOTBOUND_GATES_BY_ID.has(arrival.progressionGateId) || MOSSPROUT_RESIDENT_CARD_NODE_BY_GATE.has(arrival.progressionGateId)) ? arrival.progressionGateId : undefined,
      memoryRef,
      claimedAt: arrival.claimedAt == null ? null : finite(arrival.claimedAt, 0),
      seenAt: arrival.seenAt == null ? null : finite(arrival.seenAt, 0),
    }];
  }).filter((arrival, index, arrivals) => arrival.claimedAt == null || index >= arrivals.length - 40);
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

function normalizeOwnedMemoryCards(value: unknown, now: number): MergeWorldState['ownedMemoryCards'] {
  if (!Array.isArray(value)) return [];
  const receipts = new Set<string>();
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const card = candidate as Partial<MergeWorldState['ownedMemoryCards'][number]>;
    const definition = typeof card.cardId === 'string' ? MEMORY_CARDS_BY_ID.get(card.cardId) : null;
    if (!definition || typeof card.sourceReceiptId !== 'string' || receipts.has(card.sourceReceiptId)) return [];
    receipts.add(card.sourceReceiptId);
    return [{
      cardId: definition.id,
      poolId: definition.poolId,
      rarity: definition.rarity,
      sourceReceiptId: card.sourceReceiptId,
      acquiredAt: finite(card.acquiredAt, now),
      revealedAt: card.revealedAt == null ? null : finite(card.revealedAt, now),
    }];
  });
}

function normalizeCell(value: unknown, fallback: MergeBoardCell, index: number): MergeBoardCell {
  if (!value || typeof value !== 'object') return fallback;
  const cell = value as Partial<MergeBoardCell>;
  const occupant = cell.occupant && typeof cell.occupant === 'object' ? cell.occupant : null;
  return {
    locked: Boolean(cell.locked),
    blocker: cell.blocker === 'vines' || cell.blocker === 'rocks' || cell.blocker === 'clouds' ? cell.blocker : null,
    regionId: cell.regionId === 'central-clearing' || cell.regionId === 'inner-mist' || cell.regionId === 'mid-mist' || cell.regionId === 'deep-mist' || cell.regionId === 'ancient-dream'
      ? cell.regionId
      : fallback.regionId,
    mist: normalizeDreamMist(cell.mist, Boolean(cell.locked), index),
    occupant: occupant?.kind === 'item' && validBoardItem(occupant)
      ? occupant
      : occupant?.kind === 'generator' && typeof occupant.generatorId === 'string'
        ? { kind: 'generator', generatorId: migrateGeneratorId(occupant.generatorId) }
        : null,
  };
}

function normalizeDreamMist(value: unknown, legacyLocked: boolean, index: number): MergeBoardCell['mist'] {
  if (!value || typeof value !== 'object') return legacyLocked ? authoredDormantMistForCell(index) : null;
  const mist = value as { kind?: unknown; id?: unknown; definitionId?: unknown; generatorId?: unknown; ownerCharacterId?: unknown; discoveryId?: unknown; gateId?: unknown; residentId?: unknown; pathId?: unknown; sequenceIndex?: unknown; boundDefinitionId?: unknown; active?: unknown; candidateIds?: unknown; characterIds?: unknown; clearingId?: unknown; revealDay?: unknown; recommendedCharacterId?: unknown; chapter?: unknown; ready?: unknown };
  if (mist.kind === 'dormant') return authoredDormantMistForCell(index);
  if (mist.kind === 'garden_growth') {
    const authored = authoredDormantMistForCell(index);
    if (authored.kind === 'garden_growth') return authored;
  }
  if (mist.kind === 'discovery_dormant') {
    const authored = authoredDormantMistForCell(index);
    if (authored.kind === 'discovery_dormant') return authored;
  }
  if (mist.kind === 'rootbound_echo' && typeof mist.gateId === 'string') {
    const definition = MOSSPROUT_ROOTBOUND_GATES_BY_ID.get(mist.gateId);
    if (definition) return {
      kind: 'rootbound_echo', id: definition.id, gateId: definition.id, definitionId: definition.rootMemoryDefinitionId,
      chapter: definition.chapter, ready: Boolean(mist.ready),
    };
  }
  if (mist.kind === 'resident_card' && typeof mist.gateId === 'string') {
    const node = MOSSPROUT_RESIDENT_CARD_NODE_BY_GATE.get(mist.gateId);
    const residentId = typeof mist.residentId === 'string' && MOSSPROUT_RESIDENT_CARD_NODE_BY_RESIDENT.has(mist.residentId as KatchimeraSkinId)
      ? mist.residentId as KatchimeraSkinId
      : null;
    if (node) return {
      kind: 'resident_card', discoveryId: typeof mist.discoveryId === 'string' ? mist.discoveryId : `resident-node:${node.residentId}`,
      gateId: node.gateId, residentId, ready: Boolean(mist.ready),
    };
  }
  if (mist.kind === 'echo' && typeof mist.id === 'string' && typeof mist.definitionId === 'string' && MERGE_ITEMS_BY_ID.has(mist.definitionId)) {
    const ownerCharacterId = typeof mist.ownerCharacterId === 'string' && KNOWN_CHARACTERS.has(mist.ownerCharacterId as MergeCharacterId)
      ? mist.ownerCharacterId as MergeCharacterId
      : null;
    if (ownerCharacterId) return { kind: 'echo', id: mist.id, definitionId: mist.definitionId, ownerCharacterId };
  }
  if (mist.kind === 'dreambound_item' && typeof mist.discoveryId === 'string' && COMPANION_DISCOVERIES_BY_ID.has(mist.discoveryId)) {
    const definition = COMPANION_DISCOVERIES_BY_ID.get(mist.discoveryId)!;
    const sequenceIndex = Math.max(0, Math.min(definition.stages.length - 1, Math.floor(finite(mist.sequenceIndex, 0))));
    return {
      kind: 'dreambound_item',
      discoveryId: definition.id,
      gateId: typeof mist.gateId === 'string' ? mist.gateId : definition.gateId,
      pathId: definition.pathId,
      sequenceIndex,
      boundDefinitionId: definition.stages[sequenceIndex].boundDefinitionId,
      active: Boolean(mist.active),
    };
  }
  if (mist.kind === 'discovery_fork' && typeof mist.gateId === 'string' && Array.isArray(mist.candidateIds)) {
    const candidateIds = uniqueStrings(mist.candidateIds).filter((id): id is MergeCharacterId => KNOWN_CHARACTERS.has(id as MergeCharacterId)).slice(0, 3);
    const recommendedCharacterId = typeof mist.recommendedCharacterId === 'string' && candidateIds.includes(mist.recommendedCharacterId as MergeCharacterId)
      ? mist.recommendedCharacterId as MergeCharacterId
      : null;
    if (candidateIds.length) return { kind: 'discovery_fork', gateId: mist.gateId, candidateIds, recommendedCharacterId };
  }
  return legacyLocked ? authoredDormantMistForCell(index) : null;
}

function normalizeMossproutDailyGardenOrders(value: unknown): MergeWorldState['mossproutDailyGardenOrders'] {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<NonNullable<MergeWorldState['mossproutDailyGardenOrders']>>;
  if (typeof candidate.dayId !== 'string') return null;
  return {
    dayId: candidate.dayId,
    chapterId: candidate.chapterId === 'quiet-patch' || candidate.chapterId === 'returning-pond'
      || candidate.chapterId === 'memory-nursery' || candidate.chapterId === 'heartwood'
      ? candidate.chapterId
      : undefined,
    activeOrderId: typeof candidate.activeOrderId === 'string' ? candidate.activeOrderId : null,
    offeredOrderIds: uniqueStrings(candidate.offeredOrderIds).slice(-3),
    servedOrderIds: uniqueStrings(candidate.servedOrderIds).slice(-3),
    complete: Boolean(candidate.complete),
    nextOrderSequence: Math.max(4, Math.floor(finite(candidate.nextOrderSequence, 4))),
    tailServedCount: Math.max(0, Math.floor(finite(candidate.tailServedCount, 0))),
    activeTailSequences: Array.isArray(candidate.activeTailSequences)
      ? [...new Set(candidate.activeTailSequences
          .map((sequence) => Math.floor(finite(sequence, 0)))
          .filter((sequence) => sequence >= 4))].slice(0, 3)
      : [],
    lastRecipientSkinId: typeof candidate.lastRecipientSkinId === 'string' && mossproutResidentById.has(candidate.lastRecipientSkinId as KatchimeraSkinId)
      ? candidate.lastRecipientSkinId as KatchimeraSkinId
      : null,
  };
}

function normalizeMossproutResidentSkinIds(value: unknown, rawCards: unknown): KatchimeraSkinId[] {
  const valid = new Set<KatchimeraSkinId>(MOSSPROUT_RESIDENT_IDS);
  const stored = uniqueStrings(value).filter((id): id is KatchimeraSkinId => valid.has(id as KatchimeraSkinId));
  const legacyJourneyMatches = Array.isArray(rawCards) ? rawCards.flatMap((card): KatchimeraSkinId[] => {
    if (!card || typeof card !== 'object') return [];
    const candidate = card as Partial<MergeWorldState['ownedKatchimeraCards'][number]>;
    return candidate.acquisition === 'journey_match' && typeof candidate.cardId === 'string' && valid.has(candidate.cardId as KatchimeraSkinId)
      ? [candidate.cardId as KatchimeraSkinId]
      : [];
  }) : [];
  return [...new Set<KatchimeraSkinId>(['mossprout', ...stored, ...legacyJourneyMatches])];
}

function normalizeCompanionDiscovery(
  value: unknown,
  legacyUnlockedCharacters: unknown,
  legacyActiveOrders: unknown,
  rawVersion: unknown,
  now: number,
): MergeWorldState['companionDiscovery'] {
  const candidate = value && typeof value === 'object' ? value as Partial<MergeWorldState['companionDiscovery']> : null;
  const legacyCharacters = uniqueStrings(legacyUnlockedCharacters).filter((id): id is MergeCharacterId => KNOWN_CHARACTERS.has(id as MergeCharacterId));
  const activeDiscoveryOrderCharacters = new Set((Array.isArray(legacyActiveOrders) ? legacyActiveOrders : []).flatMap((order): MergeCharacterId[] => {
    if (!order || typeof order !== 'object') return [];
    const candidateOrder = order as Partial<MergeOrder>;
    return candidateOrder.characterId && KNOWN_CHARACTERS.has(candidateOrder.characterId)
      && candidateOrder.storyArcId === `${candidateOrder.characterId}:discovery`
      ? [candidateOrder.characterId]
      : [];
  }));
  const records = Array.isArray(candidate?.records)
    ? candidate.records.flatMap((record): MergeWorldState['companionDiscovery']['records'] => {
        if (!record || typeof record !== 'object' || !KNOWN_CHARACTERS.has(record.characterId)) return [];
        const source = record.source === 'ftue_hatch' || record.source === 'board_discovery' || record.source === 'legacy_grandfather'
          ? record.source
          : 'legacy_grandfather';
        return [{
          characterId: record.characterId,
          source,
          gateId: typeof record.gateId === 'string' ? record.gateId : `legacy:${record.characterId}`,
          pathId: typeof record.pathId === 'string' ? record.pathId : null,
          discoveredAt: finite(record.discoveredAt, now),
          revealSeenAt: record.revealSeenAt == null ? null : finite(record.revealSeenAt, now),
          firstOrderCompletedAt: record.firstOrderCompletedAt == null
            ? rawVersion !== 13 && source === 'board_discovery' && !activeDiscoveryOrderCharacters.has(record.characterId) ? now : null
            : finite(record.firstOrderCompletedAt, now),
          permanentFeatureId: typeof record.permanentFeatureId === 'string' ? record.permanentFeatureId : null,
        }];
      })
    : legacyCharacters.map((characterId) => ({
        characterId,
        source: 'legacy_grandfather' as const,
        gateId: `legacy:${characterId}`,
        pathId: null,
        discoveredAt: now,
        revealSeenAt: now,
        firstOrderCompletedAt: now,
        permanentFeatureId: null,
      }));
  const byCharacter = new Map(records.map((record) => [record.characterId, record]));
  if (rawVersion !== 13) {
    for (const characterId of legacyCharacters) if (!byCharacter.has(characterId)) byCharacter.set(characterId, {
      characterId, source: 'legacy_grandfather', gateId: `legacy:${characterId}`, pathId: null,
      discoveredAt: now, revealSeenAt: now, firstOrderCompletedAt: now, permanentFeatureId: null,
    });
  }
  const rawActive = candidate?.active && typeof candidate.active === 'object'
    && typeof candidate.active.discoveryId === 'string'
    && (COMPANION_DISCOVERIES_BY_ID.has(candidate.active.discoveryId) || candidate.active.discoveryId.startsWith('fork:'))
      ? candidate.active
      : null;
  const activeDefinition = rawActive && COMPANION_DISCOVERIES_BY_ID.get(rawActive.discoveryId);
  const active = rawActive ? {
    ...rawActive,
    pathCells: Array.isArray(rawActive.pathCells)
      ? rawActive.pathCells.filter(validCell)
      : activeDefinition ? [...activeDefinition.pathCells] : [],
  } : null;
  const eventKinds = new Set<MergeWorldState['companionDiscovery']['events'][number]['kind']>([
    'gate_eligible', 'gate_activated', 'path_chosen', 'parcel_claimed', 'stage_advanced', 'character_revealed', 'first_order_completed',
  ]);
  const events = (Array.isArray(candidate?.events) ? candidate.events : []).flatMap((event): MergeWorldState['companionDiscovery']['events'] => {
    if (!event || typeof event !== 'object' || typeof event.id !== 'string' || typeof event.gateId !== 'string' || !eventKinds.has(event.kind)) return [];
    return [{
      id: event.id,
      kind: event.kind,
      gateId: event.gateId,
      discoveryId: typeof event.discoveryId === 'string' ? event.discoveryId : undefined,
      characterId: event.characterId && KNOWN_CHARACTERS.has(event.characterId) ? event.characterId : undefined,
      stage: typeof event.stage === 'number' ? Math.max(0, Math.floor(event.stage)) : undefined,
      createdAt: finite(event.createdAt, now),
    }];
  }).slice(-DISCOVERY_EVENT_LIMIT);
  return {
    records: [...byCharacter.values()],
    openedGateIds: uniqueStrings(candidate?.openedGateIds),
    completedGateIds: uniqueStrings(candidate?.completedGateIds),
    queuedGateIds: uniqueStrings(candidate?.queuedGateIds),
    active,
    lastStartedDayId: typeof candidate?.lastStartedDayId === 'string' ? candidate.lastStartedDayId : null,
    events,
  };
}

function restoreActiveDreamboundDiscovery(state: MergeWorldState, rawVersion: unknown, now: number): MergeWorldState {
  const active = state.companionDiscovery.active;
  if (!active || active.discoveryId.startsWith('fork:')) return state;
  const definition = COMPANION_DISCOVERIES_BY_ID.get(active.discoveryId);
  if (!definition) return state;
  const hasPath = state.board.some((cell) => cell.mist?.kind === 'dreambound_item' && cell.mist.discoveryId === definition.id);
  const arrival = discoveryArrival(definition, now);
  const arrivals = active.stage === 0 && !state.arrivals.some((candidate) => candidate.id === arrival.id)
    ? [arrival, ...state.arrivals]
    : state.arrivals;
  if (hasPath) return arrivals === state.arrivals ? state : { ...state, arrivals };
  const board = [...state.board];
  const pathCells = allocateCompanionDiscoveryPath(board, definition);
  if (!pathCells) return arrivals === state.arrivals ? state : { ...state, arrivals };
  const restoredStage = rawVersion === 12 || rawVersion === 13 ? active.stage : 0;
  installDreamboundPath(board, definition, active.gateId, pathCells, restoredStage);
  return {
    ...state,
    board,
    arrivals,
    companionDiscovery: {
      ...state.companionDiscovery,
      active: {
        ...active, anchorCell: pathCells.at(-1)!, pathCells,
        stage: restoredStage,
      },
    },
  };
}

function normalizeBoardAwakeningReceipts(value: unknown): MergeWorldState['boardAwakeningReceipts'] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((candidate): MergeWorldState['boardAwakeningReceipts'] => {
    if (!candidate || typeof candidate !== 'object') return [];
    const receipt = candidate as Partial<MergeWorldState['boardAwakeningReceipts'][number]>;
    if (typeof receipt.id !== 'string' || seen.has(receipt.id) || (receipt.source !== 'dream_echo' && receipt.source !== 'story')) return [];
    seen.add(receipt.id);
    return [{
      id: receipt.id,
      source: receipt.source,
      clearedCells: Array.isArray(receipt.clearedCells) ? receipt.clearedCells.filter((cell) => typeof cell === 'number' && validCell(cell)) : [],
      createdAt: finite(receipt.createdAt, 0),
    }];
  });
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
  if (item.kind !== 'item' || typeof item.instanceId !== 'string' || typeof item.definitionId !== 'string' || !MERGE_ITEMS_BY_ID.has(item.definitionId)) return false;
  if (item.progressionGateId == null) return true;
  const gate = MOSSPROUT_ROOTBOUND_GATES_BY_ID.get(item.progressionGateId);
  if (gate && (gate.rootMemoryDefinitionId === item.definitionId || gate.fragmentDefinitionId === item.definitionId)) return true;
  return MOSSPROUT_RESIDENT_CARD_NODE_BY_GATE.has(item.progressionGateId)
    && (item.definitionId === RESIDENT_CARD_DEFINITION_ID || item.definitionId === LEGACY_RESIDENT_CARD_KEY_DEFINITION_ID);
}

function isProgressionItem(item: MergeBoardItem) {
  return Boolean(item.progressionGateId) || Boolean(MERGE_ITEMS_BY_ID.get(item.definitionId)?.progressionOnly);
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
    forcedDropDefinitionId: typeof generator.forcedDropDefinitionId === 'string'
      && fallback.tierOneDropDefinitionIds.includes(generator.forcedDropDefinitionId)
      ? generator.forcedDropDefinitionId
      : null,
    capacity: Math.max(1, Math.floor(finite(generator.capacity, fallback.capacity))),
    charges: Math.max(0, Math.min(
      Math.max(1, Math.floor(finite(generator.capacity, fallback.capacity))),
      Math.floor(finite(generator.charges, fallback.charges)),
    )),
    restDurationMs: Math.max(60_000, finite(generator.restDurationMs, fallback.restDurationMs)),
    restStartedAt: generator.restStartedAt == null ? null : finite(generator.restStartedAt, 0),
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
  // Chapter 0 deliberately pays no Energy so its journal shortage lands on
  // the scripted value. Preserve the established economy for all other orders.
  if (order.id.startsWith('mossprout:chapter-0:')) return Math.max(0, Math.floor(order.reward.energy));
  if (mossproutTailSequence(order.id) != null) return 0;
  if (order.signature || order.purpose === 'signature') return 5;
  return order.difficulty === 'medium' ? 3 : order.difficulty === 'major' ? 5 : 2;
}

function ensureOrderGlowReward(order: MergeOrder): MergeOrder {
  if (Number.isFinite(order.reward.coins) && order.reward.coins > 0) return order;
  return { ...order, reward: { ...order.reward, coins: JOURNEY_MEDITATION_ORDER_GLOW } };
}

function normalizeOrder(value: MergeOrder): MergeOrder {
  value = ensureOrderGlowReward(value);
  const recipientSkinId = value.characterId === 'mossprout'
    && typeof value.recipientSkinId === 'string'
    && mossproutResidentById.has(value.recipientSkinId)
    ? value.recipientSkinId
    : value.characterId === 'mossprout' ? 'mossprout' : undefined;
  return {
    ...value,
    recipientSkinId,
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
  const issues: string[] = [...boardMistPartitionIssues()];
  for (const item of MERGE_ITEM_CATALOG) {
    if (item.nextItemId && !MERGE_ITEMS_BY_ID.has(item.nextItemId)) issues.push(`${item.id} has missing next item ${item.nextItemId}`);
  }
  for (const template of [...MERGE_ORDER_TEMPLATES, ...MERGE_REPEATABLE_ORDER_TEMPLATES]) {
    if (!Number.isFinite(template.reward.coins) || template.reward.coins <= 0) issues.push(`${template.key} must award Glow`);
    for (const requirement of template.requirements) {
      if (!MERGE_ITEMS_BY_ID.has(requirement.definitionId)) issues.push(`${template.key} requests missing ${requirement.definitionId}`);
    }
  }
  return issues;
}
