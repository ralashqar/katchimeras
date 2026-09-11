import { COMPANION_DISCOVERIES_BY_ID, type CompanionDiscoveryDefinition } from '@/constants/companion-discovery-catalog';
import type { StoredHomeDayRecord, StoredHomeState } from '@/types/home';
import type { MergeBoardItem, MergeCharacterId, MergeWorldState } from '@/types/merge-world';
import type { PlayerProfileSnapshot } from '@/types/player-profile-snapshot';
import { MOSSPROUT_FTUE_SCRIPT } from '@/features/onboarding/mossprout-ftue-script';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { createMossproutChapterZeroState } from '@/utils/merge-world/onboarding';
import { isMossproutOpeningStep } from '@/features/onboarding/opening-mist';
import { createOpeningMissionState, OPENING_MISSION_STORAGE_KEY } from '@/features/onboarding/opening-mission-state';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import type { ContentFlowDefinition, ContentFlowRun } from '@/types/content-flow';
import { createContentFlowRun, stabilizeContentFlow } from '@/features/content-flow/content-flow-interpreter';
import { GLOW_DISCOVERY_FLOW, GLOW_DISCOVERY_RUN_ID } from '@/features/onboarding/glow-discovery-flow';
import { STEPPLING_GARDEN_FLOW, STEPPLING_GARDEN_RUN_ID, STEPPLING_PARCEL_ID, STEPPLING_SHOE_ORDER_ID } from '@/features/onboarding/steppling-garden-lesson';
import { STEPPLING_DAY_ONE_FLOW, STEPPLING_DAY_ONE_RUN_ID, STEPPLING_PARCEL_REWARD_ID } from '@/features/content-flow/steppling-day-one-flow';
import { advanceGlowRequests, GLOW_GATEWAY_ID, GLOW_ORDER_IDS, GLOW_SINGLE_ECHO_IDS } from '@/utils/merge-world/glow-discovery-policy';
import { islandCampaignChapterOrder } from '@/constants/island-campaigns/helpers';
import { PETALIMP_BLOOM_CAMPAIGN, PETALIMP_ISLAND_CAMPAIGN_ID, PETALIMP_ISLAND_ID } from '@/constants/island-campaigns/petalimp-bloom';

const DAY = 86_400_000;
const COMPLETE_PROFILE: OnboardingProfile = {
  schemaVersion: 3,
  completed: true,
  aspirationId: 'feel-more-present',
  painPointIds: ['days-blur-together'],
  preferenceIds: ['small-daily-steps'],
  completedAt: 'relative',
  hatchHour: 20,
  playerNickname: null,
  mossproutAnswers: { desiredFeelingId: null, mainDifficultyId: null, supportStyleId: null, lifePriorityId: null, companionPlaceId: null },
  matchedResidentId: null,
};
const FRESH_PROFILE: OnboardingProfile = {
  schemaVersion: 3,
  completed: false,
  aspirationId: null,
  painPointIds: [],
  preferenceIds: [],
  completedAt: null,
  hatchHour: null,
  playerNickname: null,
  mossproutAnswers: { desiredFeelingId: null, mainDifficultyId: null, supportStyleId: null, lifePriorityId: null, companionPlaceId: null },
  matchedResidentId: null,
};

type FixtureDefinition = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  ftueStep: string | null;
  launchRoute?: PlayerProfileSnapshot['launchRoute'];
  buildWorld: (now: number) => MergeWorldState;
  /** Durable story runs the snapshot restores alongside the world (the Glow story, Steppling's lesson). */
  contentFlowRuns?: (now: number) => ContentFlowRun[];
  meaningfulDays?: number;
};

function fixtureSummary(state: MergeWorldState, ftueStep: string | null) {
  return {
    ftueStep,
    unlockedCharacters: [...state.unlockedCharacters],
    activeGateId: state.companionDiscovery.active?.gateId ?? null,
    selectedCharacterId: state.companionDiscovery.active?.selectedCharacterId ?? null,
    discoveryStage: state.companionDiscovery.active?.stage ?? null,
    pendingParcelCount: state.arrivals.filter((arrival) => arrival.kind === 'discovery_parcel' && arrival.claimedAt == null).length,
  };
}

function ftueRun(stepId: string, now: number) {
  const complete = stepId === 'complete';
  const timestamp = new Date(now).toISOString();
  return {
    schemaVersion: 6,
    runId: `fixture-ftue-${stepId.replaceAll('.', '-')}`,
    scriptId: 'mossprout-first-session',
    scriptVersion: MOSSPROUT_FTUE_SCRIPT.version,
    stepId,
    status: complete ? 'complete' : 'active',
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: complete ? timestamp : null,
    answers: {},
    receipts: [],
    mergeInstalled: stepId.startsWith('merge.') || stepId.startsWith('discovery.') || stepId.startsWith('haven.') || complete,
    awardedMergeEnergy: null,
    objectiveProgress: {},
  };
}

function fixtureKeyValues(now: number, ftueStep: string | null, meaningfulDays: number) {
  const profile = ftueStep ? COMPLETE_PROFILE : FRESH_PROFILE;
  const home = fixtureHomeState(now, meaningfulDays);
  const values: Record<string, string> = {
    'katchadeck.onboarding-profile': JSON.stringify({
      ...profile,
      completedAt: profile.completed ? new Date(now - 6 * DAY).toISOString() : null,
    }),
  };
  if (ftueStep) values['katchimeras.ftue-run.v4'] = JSON.stringify(ftueRun(ftueStep, now));
  // The opening's mission board lives in its own store, keyed to the run.
  if (ftueStep && isMossproutOpeningStep(ftueStep)) values[OPENING_MISSION_STORAGE_KEY] = JSON.stringify({ runId: ftueRun(ftueStep, now).runId, state: createOpeningMissionState(now) });
  if (meaningfulDays > 0) values['katchadeck.home-v1'] = JSON.stringify(home);
  return values;
}

function fixtureHomeState(now: number, meaningfulDays: number): StoredHomeState {
  const todayDate = new Date(now);
  const archivedDays = Array.from({ length: meaningfulDays }, (_, index) => {
    const dayDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - meaningfulDays + index, 12);
    const day = emptyFixtureDay(dayDate);
    return {
      ...day,
      state: 'hatched' as const,
      moments: [{
        id: `fixture-moment-${index}`,
        type: 'walk' as const,
        label: 'A short walk',
        icon: 'figure.walk' as const,
        accentColor: '#5FA87B',
        createdAt: dayDate.toISOString(),
        source: 'quick_tag' as const,
      }],
    };
  });
  return {
    version: 22,
    locationPermission: 'unknown',
    activityPermission: 'unknown',
    healthPermission: 'unknown',
    encounterHistory: {},
    aspectHistory: {},
    skinHistory: {},
    personalEntities: [],
    cloudIntelligenceEnabled: false,
    archivedDays,
    today: emptyFixtureDay(todayDate),
  };
}

function emptyFixtureDay(date: Date): StoredHomeDayRecord {
  const isoDate = [date.getFullYear(), `${date.getMonth() + 1}`.padStart(2, '0'), `${date.getDate()}`.padStart(2, '0')].join('-');
  return {
    id: `day-${isoDate}`,
    isoDate,
    state: 'forming',
    stepsCount: 0,
    stepsCountDayId: isoDate,
    stepsUpdatedAt: null,
    visitedPlaceCount: 0,
    newPlaceCount: 0,
    locationSampleCount: 0,
    shareReadyAt: null,
    moments: [],
    locations: [],
    healthRouteImport: null,
    exactRouteSegments: [],
    selectedPathId: null,
    promptAnswers: [],
    creature: null,
    dailyHatch: null,
    legacyEncounter: null,
    card: null,
    heroPhoto: null,
    growth: { schemaVersion: 1, events: [], careActions: [] },
    storedNonce: `fixture-${isoDate}`,
  };
}

function chapterZeroReady(now: number) {
  const state = createMossproutChapterZeroState(now);
  return {
    ...state,
    activeOrders: [],
    characterProgress: {
      ...state.characterProgress,
      mossprout: { friendshipLevel: 1, completedChapterIds: ['mossprout-chapter-0'] },
    },
  };
}

function startSteppling(now: number) {
  return reduceMergeWorld(chapterZeroReady(now), { type: 'startStepplingDiscovery', now: now + 1 }).state;
}

function mossproutHavenRestore(now: number) {
  const state = startSteppling(now);
  return {
    ...state,
    coins: Math.max(state.coins, 170),
    haven: {
      ...state.haven,
      tileStages: { ...state.haven.tileStages, mossprout: 0 as const },
      revealState: 'hidden' as const,
    },
  };
}

/** Mossprout's FTUE over: chapter zero done, the Little Garden restored. */
function gardenRestored(now: number) {
  const base = { ...chapterZeroReady(now - 6 * DAY), coins: 200 };
  return reduceMergeWorld(base, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 1, economyMode: 'free', now: now - 6 * DAY + 1 }).state;
}

/** The Glow lesson played out on the Garden: both requests served, its misted cells matched, the Glow for the mist in hand. */
function glowLessonServed(now: number) {
  const at = now - 5 * DAY;
  let state = reduceMergeWorld(gardenRestored(now), { type: 'prepareGlowDiscoveryLesson', now: at }).state;
  state = advanceGlowRequests(advanceGlowRequests(state, GLOW_ORDER_IDS[0], at + 1), GLOW_ORDER_IDS[1], at + 2);
  const echoIds: readonly string[] = GLOW_SINGLE_ECHO_IDS;
  return {
    ...state,
    coins: Math.max(state.coins, 90),
    board: state.board.map((cell) => (cell.mist?.kind === 'echo' && echoIds.includes(cell.mist.id) ? { ...cell, locked: false, blocker: null, mist: null } : cell)),
    activeOrders: state.activeOrders.filter((order) => !(GLOW_ORDER_IDS as readonly string[]).includes(order.id)),
  };
}

function step(state: MergeWorldState, command: Parameters<typeof reduceMergeWorld>[1], label: string): MergeWorldState {
  const result = reduceMergeWorld(state, command);
  if (!result.changed) throw new Error(`Fixture step "${label}" did not apply: ${result.message ?? 'no change'}`);
  return result.state;
}

/**
 * Steppling home through the mist, played out with the real commands: the
 * clearing paid for, the Egg carried home and hatched, his day-one parcel
 * opened so the Journey Locker stands on the Main Board, two Socks made from
 * it and merged, and the Shoe served for its receipt and Glow.
 */
function stepplingHome(now: number) {
  const at = now - 4 * DAY;
  const dayId = new Date(at).toISOString().slice(0, 10);
  let state = glowLessonServed(now);
  state = step(state, { type: 'unlockWorldTarget', targetId: GLOW_GATEWAY_ID, receiptId: 'fixture:steppling:mist', now: at }, 'clear the mist');
  state = step(state, { type: 'transferDiscoveryEgg', targetId: GLOW_GATEWAY_ID, now: at + 1 }, 'carry the Egg home');
  state = step(state, { type: 'hatchWorldEgg', targetId: GLOW_GATEWAY_ID, now: at + 2 }, 'hatch Steppling');
  state = step(state, { type: 'grantGeneratorParcel', generatorId: 'journey-locker', rewardId: STEPPLING_PARCEL_REWARD_ID, dayId, now: at + 3 }, 'grant the Locker parcel');
  state = step(state, { type: 'prepareStepplingGardenLesson', now: at + 4 }, 'prepare the garden lesson');
  state = step(state, { type: 'claimArrival', arrivalId: STEPPLING_PARCEL_ID, now: at + 5 }, 'open the parcel');
  state = step(state, { type: 'tapGenerator', generatorId: 'journey-locker', now: at + 6, seed: 'fixture:sock:1', spendEnergy: false }, 'make the first Sock');
  state = step(state, { type: 'tapGenerator', generatorId: 'journey-locker', now: at + 7, seed: 'fixture:sock:2', spendEnergy: false }, 'make the second Sock');
  const socks = state.board.flatMap((cell, index) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === 'adventure:trail:1' ? [index] : []);
  if (socks.length < 2) throw new Error('Fixture could not find two Socks to merge.');
  state = step(state, { type: 'move', from: socks[0]!, to: socks[1]!, now: at + 8 }, 'merge the Socks');
  state = step(state, { type: 'serveOrder', orderId: STEPPLING_SHOE_ORDER_ID, now: at + 9 }, 'serve the Shoe');
  return { ...state, coins: Math.max(state.coins, 90) };
}

/** Puts finished items on free Main Board cells, the way a player would have made them. */
function placeFixtureItems(state: MergeWorldState, definitionIds: readonly string[]): MergeWorldState {
  const board = [...state.board];
  let nextInstance = state.nextInstance;
  for (const definitionId of definitionIds) {
    const cell = board.findIndex((candidate) => !candidate.locked && !candidate.mist && !candidate.blocker && !candidate.occupant);
    if (cell < 0) throw new Error(`Fixture has no free cell for ${definitionId}.`);
    board[cell] = { ...board[cell]!, occupant: { kind: 'item', instanceId: `fixture-item-${nextInstance}`, definitionId } };
    nextInstance += 1;
  }
  return { ...state, board, nextInstance };
}

/**
 * Petalimp home, played out with the real commands: Mossprout's wish told,
 * Bloom Garden's mist paid for, and each of her four stages opened, its board
 * spent, its request served on the Main Board, its bar filled, the garden
 * grown and the chapter resolved. Her card is revealed; Wildgrowth Grove,
 * next in the wake order, is open and still misted.
 */
function petalimpHome(now: number) {
  const at = now - 3 * DAY;
  let state: MergeWorldState = { ...stepplingHome(now), coins: 900 };
  state = step(state, { type: 'introduceKingdomGoal', now: at }, 'tell Mossprout’s wish');
  state = step(state, { type: 'ackKingdomGoalCoachmark', now: at + 1 }, 'see the wish');
  state = step(state, { type: 'revealMossproutNatureIsland', islandId: PETALIMP_ISLAND_ID, campaignId: PETALIMP_ISLAND_CAMPAIGN_ID, residentSkinId: 'petalimp', cost: 40, receiptId: 'fixture:bloom:reveal', now: at + 2 }, 'clear Bloom Garden’s mist');
  state = step(state, { type: 'ackIslandCampaignResidentDiscovery', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID, now: at + 3 }, 'meet Petalimp');
  PETALIMP_BLOOM_CAMPAIGN.chapters.forEach((chapter, index) => {
    const base = at + 10 * (index + 1);
    const { level } = chapter;
    const choice = chapter.choices[index % chapter.choices.length]!;
    const order = islandCampaignChapterOrder(PETALIMP_BLOOM_CAMPAIGN, level, choice.id, base)!;
    state = step(state, { type: 'activateIslandCampaignChapter', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID, islandId: PETALIMP_ISLAND_ID, residentSkinId: 'petalimp', level, selectedOptionId: choice.id, orders: [order], now: base }, `open Petalimp stage ${level}`);
    state = step(state, { type: 'requestIslandCampaignDelivery', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID, level, orders: [order], now: base + 1 }, `request stage ${level}`);
    state = placeFixtureItems(state, order.requirements.flatMap((requirement) => Array.from({ length: requirement.quantity }, () => requirement.definitionId)));
    state = step(state, { type: 'serveOrder', orderId: order.id, now: base + 2 }, `serve stage ${level}`);
    const merges = chapter.restoration!.merges;
    state = step(state, { type: 'recordIslandRestorationProgress', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID, level, current: merges, total: merges, now: base + 3 }, `fill stage ${level}`);
    state = step(state, { type: 'completeIslandRestoration', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID, level, now: base + 4 }, `clear stage ${level}`);
    state = step(state, { type: 'upgradeMossproutNatureIsland', islandId: PETALIMP_ISLAND_ID, level, economyMode: 'free', receiptId: `fixture:bloom:restore:${level}`, now: base + 5 }, `grow stage ${level}`);
    state = step(state, { type: 'completeIslandCampaignChapter', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID, level, now: base + 6 }, `resolve stage ${level}`);
  });
  state = step(state, { type: 'ackIslandCampaignResidentCardReveal', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID, now: at + 60 }, 'reveal Petalimp’s card');
  // Enough Glow for the grove's mist, and no more: the next arc starts where a player would.
  return { ...state, coins: 90 };
}

function storyRunAt(definition: ContentFlowDefinition, runId: string, nodeId: string, now: number): ContentFlowRun {
  return stabilizeContentFlow(definition, { ...createContentFlowRun(definition, { runId, now }), nodeId }, now).run;
}

function claimDiscoveryParcel(state: MergeWorldState, discoveryId: string, now: number) {
  return reduceMergeWorld(state, { type: 'claimArrival', arrivalId: `arrival:discovery:${discoveryId}`, now }).state;
}

function advanceDiscovery(state: MergeWorldState, definition: CompanionDiscoveryDefinition, stages: number, now: number) {
  let next = state;
  for (const stage of definition.stages.slice(0, stages)) {
    const from = next.board.findIndex((cell) => cell.occupant?.kind === 'item' && cell.occupant.definitionId === stage.boundDefinitionId);
    const to = next.board.findIndex((cell) => cell.mist?.kind === 'dreambound_item' && cell.mist.discoveryId === definition.id && cell.mist.active);
    if (from < 0 || to < 0) throw new Error(`Fixture could not advance ${definition.id} with ${stage.boundDefinitionId}.`);
    next = reduceMergeWorld(next, { type: 'move', from, to, now: ++now }).state;
  }
  return next;
}

function stepplingAtStage(stage: -1 | 0 | 2 | 3, now: number) {
  let state = startSteppling(now - 5 * DAY);
  if (stage === -1) return state;
  const definition = COMPANION_DISCOVERIES_BY_ID.get('discovery:ftue-steppling')!;
  state = claimDiscoveryParcel(state, definition.id, now - 5 * DAY + 2);
  return advanceDiscovery(state, definition, stage, now - 5 * DAY + 2);
}

function placeOrderRequirements(state: MergeWorldState, orderId: string) {
  const order = state.activeOrders.find((candidate) => candidate.id === orderId);
  if (!order) throw new Error(`Fixture order ${orderId} is missing.`);
  const board = state.board.map((cell) => ({ ...cell }));
  let nextInstance = state.nextInstance;
  for (const requirement of order.requirements) {
    for (let count = 0; count < requirement.quantity; count += 1) {
      const cell = board.findIndex((candidate) => !candidate.locked && candidate.mist == null && candidate.occupant == null);
      if (cell < 0) throw new Error(`Fixture has no room for ${requirement.definitionId}.`);
      const item: MergeBoardItem = { kind: 'item', instanceId: `fixture-item-${nextInstance++}`, definitionId: requirement.definitionId };
      board[cell] = { ...board[cell], occupant: item };
    }
  }
  return { ...state, board, nextInstance };
}

function completeFirstOrder(state: MergeWorldState, characterId: MergeCharacterId, now: number) {
  const order = state.activeOrders.find((candidate) => candidate.storyArcId === `${characterId}:discovery`);
  if (!order) throw new Error(`Fixture first order for ${characterId} is missing.`);
  const supplied = placeOrderRequirements(state, order.id);
  return reduceMergeWorld(supplied, { type: 'serveOrder', orderId: order.id, now }).state;
}

function completeSteppling(now: number) {
  const revealed = stepplingAtStage(3, now);
  return completeFirstOrder(revealed, 'steppling', now - 4 * DAY);
}

function withGateThresholds(state: MergeWorldState, gateId: string) {
  if (gateId === 'gate-3-first-choice') return { ...state, mergeLevel: Math.max(3, state.mergeLevel), mergeXp: Math.max(100, state.mergeXp), completedOrderCount: Math.max(6, state.completedOrderCount) };
  if (gateId === 'gate-4-expanding-world') return { ...state, mergeLevel: Math.max(5, state.mergeLevel), mergeXp: Math.max(400, state.mergeXp), completedOrderCount: Math.max(15, state.completedOrderCount), expansions: ['fixture-expansion-1'] };
  return { ...state, mergeLevel: Math.max(7, state.mergeLevel), mergeXp: Math.max(900, state.mergeXp), completedOrderCount: Math.max(28, state.completedOrderCount), expansions: ['fixture-expansion-1', 'fixture-expansion-2'] };
}

function openGate(state: MergeWorldState, gateId: string, candidateIds: MergeCharacterId[], now: number) {
  return reduceMergeWorld(withGateThresholds(state, gateId), {
    type: 'openCompanionDiscoveryGate', gateId, candidateIds, recommendedCharacterId: candidateIds[0] ?? null, now,
  }).state;
}

function selectPath(state: MergeWorldState, characterId: MergeCharacterId, now: number) {
  return reduceMergeWorld(state, { type: 'selectCompanionDiscoveryPath', characterId, now }).state;
}

function pathDefinition(characterId: MergeCharacterId) {
  const definition = [...COMPANION_DISCOVERIES_BY_ID.values()].find((candidate) => candidate.characterId === characterId);
  if (!definition) throw new Error(`No discovery definition for ${characterId}.`);
  return definition;
}

function selectedPathAtStage(state: MergeWorldState, characterId: MergeCharacterId, stage: -1 | 2 | 3, now: number) {
  const definition = pathDefinition(characterId);
  let next = selectPath(state, characterId, now);
  if (stage === -1) return next;
  next = claimDiscoveryParcel(next, definition.id, now + 1);
  return advanceDiscovery(next, definition, stage, now + 1);
}

function completePath(state: MergeWorldState, characterId: MergeCharacterId, now: number) {
  return completeFirstOrder(selectedPathAtStage(state, characterId, 3, now), characterId, now + 10);
}

function gateThree(now: number) {
  return openGate(completeSteppling(now), 'gate-3-first-choice', ['feastle', 'baristabbit', 'bedrotte'], now - 3 * DAY);
}

function feastleComplete(now: number) {
  return completePath(gateThree(now), 'feastle', now - 3 * DAY + 10);
}

function gateFour(now: number) {
  return openGate(feastleComplete(now), 'gate-4-expanding-world', ['baristabbit', 'bedrotte'], now - 2 * DAY);
}

function baristabbitComplete(now: number) {
  return completePath(gateFour(now), 'baristabbit', now - 2 * DAY + 10);
}

function gateFive(now: number) {
  return openGate(baristabbitComplete(now), 'gate-5-complete-foundations', ['bedrotte'], now - DAY);
}

const FIXTURE_DEFINITIONS: readonly FixtureDefinition[] = [
  { id: 'fresh-first-launch', name: 'Fresh first launch', description: 'Before onboarding begins.', tags: ['FTUE'], ftueStep: null, meaningfulDays: 0, buildWorld: (now) => createInitialMergeWorldState(now) },
  { id: 'mossprout-opening', name: 'Mossprout · Clear the Mist', description: 'The veiled opening with its own mission board under Mossprout’s tile.', tags: ['FTUE', 'Mossprout'], ftueStep: 'world.mist_clear', buildWorld: (now) => createMossproutChapterZeroState(now) },
  { id: 'mossprout-merge-start', name: 'Mossprout · Merge begins', description: 'The first Mossprout board interaction.', tags: ['FTUE', 'Mossprout'], ftueStep: 'merge.seed_drag', buildWorld: (now) => createMossproutChapterZeroState(now) },
  { id: 'mossprout-haven-restore', name: 'Mossprout · Restore Haven', description: 'Right before restoring the Forgotten Clearing into the First Garden.', tags: ['FTUE', 'Mossprout', 'Haven'], ftueStep: 'haven.mossprout.restore', launchRoute: '/(tabs)/katchimeras', buildWorld: mossproutHavenRestore },
  { id: 'steppling-parcel', name: 'Steppling · Parcel waiting', description: 'Tests the forced parcel spotlight and tap.', tags: ['FTUE', 'Steppling', 'Parcel'], ftueStep: 'discovery.steppling.parcel', buildWorld: (now) => stepplingAtStage(-1, now) },
  { id: 'steppling-final-clue', name: 'Steppling · Final clue', description: 'One Dreambound merge before Steppling appears.', tags: ['FTUE', 'Steppling', 'Reveal'], ftueStep: 'discovery.steppling.boot', buildWorld: (now) => stepplingAtStage(2, now) },
  { id: 'steppling-first-order', name: 'Steppling · First order', description: 'Steppling is revealed; Gate 3 remains blocked until the first order.', tags: ['FTUE', 'Steppling', 'Order'], ftueStep: 'discovery.steppling.spawn', buildWorld: (now) => stepplingAtStage(3, now) },
  { id: 'steppling-mist-ready', name: 'Steppling · Before the reveal', description: 'The Garden lesson done and the Glow earned; the misted clearing’s bubble waits to be tapped and open its mission board.', tags: ['Kingdom', 'Steppling', 'Mist'], ftueStep: 'complete', launchRoute: '/(tabs)/katchimeras', buildWorld: glowLessonServed,
    contentFlowRuns: (now) => [storyRunAt(GLOW_DISCOVERY_FLOW, GLOW_DISCOVERY_RUN_ID, 'gateway.offer', now - 5 * DAY + 3)] },
  { id: 'kingdom-before-petalimp', name: 'Kingdom · Before Petalimp', description: 'The first session over: Steppling home and his first Shoe served. Mossprout’s wish and Bloom Garden come next.', tags: ['Kingdom', 'Petalimp'], ftueStep: 'complete', launchRoute: '/(tabs)/katchimeras', buildWorld: stepplingHome,
    contentFlowRuns: (now) => [
      storyRunAt(GLOW_DISCOVERY_FLOW, GLOW_DISCOVERY_RUN_ID, 'complete', now - 4 * DAY + 5),
      storyRunAt(STEPPLING_DAY_ONE_FLOW, STEPPLING_DAY_ONE_RUN_ID, 'complete', now - 4 * DAY + 6),
      storyRunAt(STEPPLING_GARDEN_FLOW, STEPPLING_GARDEN_RUN_ID, 'complete', now - 4 * DAY + 10),
    ] },
  { id: 'kingdom-before-fernip', name: 'Kingdom · Before Fernip', description: 'Petalimp home and her card revealed after all four Bloom Garden stages. Wildgrowth Grove’s mist is next, with the Glow to clear it.', tags: ['Kingdom', 'Fernip'], ftueStep: 'complete', launchRoute: '/(tabs)/katchimeras', buildWorld: petalimpHome,
    contentFlowRuns: (now) => [
      storyRunAt(GLOW_DISCOVERY_FLOW, GLOW_DISCOVERY_RUN_ID, 'complete', now - 4 * DAY + 5),
      storyRunAt(STEPPLING_DAY_ONE_FLOW, STEPPLING_DAY_ONE_RUN_ID, 'complete', now - 4 * DAY + 6),
      storyRunAt(STEPPLING_GARDEN_FLOW, STEPPLING_GARDEN_RUN_ID, 'complete', now - 4 * DAY + 10),
    ] },
  { id: 'gate-3-fork', name: 'Gate 3 · Choose a mystery', description: 'Feastle, Baristabbit, and Bedrotte paths are visible.', tags: ['Gate 3', 'Choice'], ftueStep: 'complete', buildWorld: gateThree },
  { id: 'gate-3-feastle-parcel', name: 'Gate 3 · Feastle parcel', description: 'Warm Table selected; discovery parcel awaits.', tags: ['Gate 3', 'Feastle', 'Parcel'], ftueStep: 'complete', buildWorld: (now) => selectedPathAtStage(gateThree(now), 'feastle', -1, now - 3 * DAY + 10) },
  { id: 'gate-3-feastle-final', name: 'Gate 3 · Feastle final clue', description: 'One merge before Feastle appears.', tags: ['Gate 3', 'Feastle', 'Reveal'], ftueStep: 'complete', buildWorld: (now) => selectedPathAtStage(gateThree(now), 'feastle', 2, now - 3 * DAY + 10) },
  { id: 'gate-4-queued', name: 'Gate 4 · Queued', description: 'Feastle’s introduction is complete; the next mystery is paced.', tags: ['Gate 4', 'Feastle'], ftueStep: 'complete', buildWorld: (now) => openGate(feastleComplete(now), 'gate-4-expanding-world', ['baristabbit', 'bedrotte'], now - 3 * DAY + 30) },
  { id: 'gate-4-fork', name: 'Gate 4 · Choose a mystery', description: 'Baristabbit and Bedrotte paths remain.', tags: ['Gate 4', 'Choice'], ftueStep: 'complete', buildWorld: gateFour },
  { id: 'gate-4-baristabbit-parcel', name: 'Gate 4 · Baristabbit parcel', description: 'Warm Light selected; discovery parcel awaits.', tags: ['Gate 4', 'Baristabbit', 'Parcel'], ftueStep: 'complete', buildWorld: (now) => selectedPathAtStage(gateFour(now), 'baristabbit', -1, now - 2 * DAY + 10) },
  { id: 'gate-4-baristabbit-final', name: 'Gate 4 · Baristabbit final clue', description: 'One merge before Baristabbit appears.', tags: ['Gate 4', 'Baristabbit', 'Reveal'], ftueStep: 'complete', buildWorld: (now) => selectedPathAtStage(gateFour(now), 'baristabbit', 2, now - 2 * DAY + 10) },
  { id: 'gate-5-queued', name: 'Gate 5 · Queued', description: 'Baristabbit’s introduction is complete; the last early path is paced.', tags: ['Gate 5', 'Baristabbit'], ftueStep: 'complete', buildWorld: (now) => openGate(baristabbitComplete(now), 'gate-5-complete-foundations', ['bedrotte'], now - 2 * DAY + 30) },
  { id: 'gate-5-bedrotte-parcel', name: 'Gate 5 · Bedrotte parcel', description: 'The final early mystery parcel awaits.', tags: ['Gate 5', 'Bedrotte', 'Parcel'], ftueStep: 'complete', buildWorld: (now) => selectedPathAtStage(gateFive(now), 'bedrotte', -1, now - DAY + 10) },
  { id: 'gate-5-bedrotte-final', name: 'Gate 5 · Bedrotte final clue', description: 'One merge before Bedrotte appears.', tags: ['Gate 5', 'Bedrotte', 'Reveal'], ftueStep: 'complete', buildWorld: (now) => selectedPathAtStage(gateFive(now), 'bedrotte', 2, now - DAY + 10) },
  { id: 'early-pool-complete', name: 'Early discovery pool complete', description: 'Mossprout, Steppling, Feastle, Baristabbit, and Bedrotte are established.', tags: ['Gate 5', 'Complete'], ftueStep: 'complete', buildWorld: (now) => completePath(gateFive(now), 'bedrotte', now - DAY + 10) },
];

export function buildPlayerProfileFixtures(now = Date.now()): PlayerProfileSnapshot[] {
  return FIXTURE_DEFINITIONS.map((fixture) => {
    const state = fixture.buildWorld(now);
    return {
      schemaVersion: 1,
      id: `fixture:${fixture.id}`,
      name: fixture.name,
      description: fixture.description,
      source: 'fixture',
      timePolicy: 'relative',
      createdAt: new Date(now).toISOString(),
      tags: fixture.tags,
      launchRoute: fixture.launchRoute ?? (fixture.ftueStep == null ? '/(tabs)/today' : '/(tabs)/games'),
      summary: fixtureSummary(state, fixture.ftueStep),
      domains: {
        keyValue: { schemaVersion: 1, values: fixtureKeyValues(now, fixture.ftueStep, fixture.meaningfulDays ?? 4) },
        mergeWorld: { schemaVersion: 1, state },
        ...(fixture.contentFlowRuns ? { contentFlow: { schemaVersion: 1 as const, runs: fixture.contentFlowRuns(now) } } : {}),
      },
    };
  });
}

export const PLAYER_PROFILE_FIXTURE_COUNT = FIXTURE_DEFINITIONS.length;
