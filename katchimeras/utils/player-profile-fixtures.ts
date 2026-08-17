import { COMPANION_DISCOVERIES_BY_ID, type CompanionDiscoveryDefinition } from '@/constants/companion-discovery-catalog';
import type { StoredHomeDayRecord, StoredHomeState } from '@/types/home';
import type { MergeBoardItem, MergeCharacterId, MergeWorldState } from '@/types/merge-world';
import type { PlayerProfileSnapshot } from '@/types/player-profile-snapshot';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { createMossproutChapterZeroState } from '@/utils/merge-world/onboarding';
import type { OnboardingProfile } from '@/utils/onboarding-state';

const DAY = 86_400_000;
const COMPLETE_PROFILE: OnboardingProfile = {
  completed: true,
  aspirationId: 'feel-more-present',
  painPointIds: ['days-blur-together'],
  preferenceIds: ['small-daily-steps'],
  completedAt: 'relative',
  hatchHour: 20,
};
const FRESH_PROFILE: OnboardingProfile = {
  completed: false,
  aspirationId: null,
  painPointIds: [],
  preferenceIds: [],
  completedAt: null,
  hatchHour: null,
};

type FixtureDefinition = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  ftueStep: string | null;
  buildWorld: (now: number) => MergeWorldState;
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
    scriptVersion: 13,
    stepId,
    status: complete ? 'complete' : 'active',
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: complete ? timestamp : null,
    answers: {},
    receipts: [],
    mergeInstalled: stepId.startsWith('merge.') || stepId.startsWith('discovery.') || complete,
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
  { id: 'mossprout-merge-start', name: 'Mossprout · Merge begins', description: 'The first Mossprout board interaction.', tags: ['FTUE', 'Mossprout'], ftueStep: 'merge.seed_drag', buildWorld: (now) => createMossproutChapterZeroState(now) },
  { id: 'steppling-parcel', name: 'Steppling · Parcel waiting', description: 'Tests the forced parcel spotlight and tap.', tags: ['FTUE', 'Steppling', 'Parcel'], ftueStep: 'discovery.steppling.parcel', buildWorld: (now) => stepplingAtStage(-1, now) },
  { id: 'steppling-final-clue', name: 'Steppling · Final clue', description: 'One Dreambound merge before Steppling appears.', tags: ['FTUE', 'Steppling', 'Reveal'], ftueStep: 'discovery.steppling.boot', buildWorld: (now) => stepplingAtStage(2, now) },
  { id: 'steppling-first-order', name: 'Steppling · First order', description: 'Steppling is revealed; Gate 3 remains blocked until the first order.', tags: ['FTUE', 'Steppling', 'Order'], ftueStep: 'discovery.steppling.spawn', buildWorld: (now) => stepplingAtStage(3, now) },
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
      launchRoute: fixture.ftueStep == null ? '/(tabs)/today' : '/(tabs)/games',
      summary: fixtureSummary(state, fixture.ftueStep),
      domains: {
        keyValue: { schemaVersion: 1, values: fixtureKeyValues(now, fixture.ftueStep, fixture.meaningfulDays ?? 4) },
        mergeWorld: { schemaVersion: 1, state },
      },
    };
  });
}

export const PLAYER_PROFILE_FIXTURE_COUNT = FIXTURE_DEFINITIONS.length;
