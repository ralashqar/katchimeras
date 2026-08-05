import assert from 'node:assert/strict';
import test from 'node:test';

import type { StoredHomeDayRecord } from '../types/home';
import {
  activeGrowthEnergy,
  awardGrowth,
  earlyHatchMinutesForEnergy,
  todayGrowthSummary,
} from '../utils/today-growth';
import { rankTodayCareActions } from '../utils/today-care';
import { buildTodayPhotoRollSuggestion } from '../utils/today-photo-roll-suggestion';
import {
  cancelTodayCareGameRound,
  completeTodayCareGameRound,
  consumeTodayCareGameRoundCompletion,
  consumeTodayCareGameRoundLaunch,
  requestTodayCareGameRound,
} from '../utils/today-care-game-round';

function day(overrides: Partial<StoredHomeDayRecord> = {}): StoredHomeDayRecord {
  return {
    id: 'day-2026-08-05',
    isoDate: '2026-08-05',
    state: 'forming',
    stepsCount: 0,
    visitedPlaceCount: 0,
    newPlaceCount: 0,
    locationSampleCount: 0,
    shareReadyAt: null,
    moments: [],
    locations: [],
    healthRouteImport: null,
    exactRouteSegments: [],
    selectedPathId: null,
    creature: null,
    card: null,
    promptAnswers: [],
    heroPhoto: null,
    growth: { schemaVersion: 1, events: [], careActions: [] },
    ...overrides,
  };
}

test('Growth awards are source-id idempotent', () => {
  const first = awardGrowth(day(), { source: 'photo', sourceId: 'asset-1', awardedAt: new Date('2026-08-05T12:00:00') });
  const second = awardGrowth(first.day, { source: 'photo', sourceId: 'asset-1', awardedAt: new Date('2026-08-05T12:01:00') });
  assert.equal(first.awarded, true);
  assert.equal(second.awarded, false);
  assert.equal(activeGrowthEnergy(second.day), 15);
});

test('Growth can move hatch forward by at most one hour', () => {
  assert.equal(earlyHatchMinutesForEnergy(0), 0);
  assert.equal(earlyHatchMinutesForEnergy(20), 30);
  assert.equal(earlyHatchMinutesForEnergy(40), 60);
  assert.equal(earlyHatchMinutesForEnergy(400), 60);
});

test('Passive Growth reaches ready at the configured time without interaction', () => {
  const before = todayGrowthSummary(day(), 20, new Date(2026, 7, 5, 19, 59));
  const ready = todayGrowthSummary(day(), 20, new Date(2026, 7, 5, 20, 0));
  assert.equal(before.isReady, false);
  assert.equal(ready.isReady, true);
  assert.equal(Math.round(ready.progress), 100);
});

test('Active Growth visibly advances the egg before hatch time', () => {
  const growingDay = day();
  const baseline = todayGrowthSummary(growingDay, 21, new Date(2026, 7, 5, 12, 0));
  growingDay.growth = {
    schemaVersion: 1,
    careActions: [],
    events: [{
      id: 'growth:journal:entry-1',
      source: 'journal',
      sourceId: 'entry-1',
      actionId: 'journal',
      amount: 20,
      awardedAt: new Date(2026, 7, 5, 12, 0).toISOString(),
    }],
  };
  const nurtured = todayGrowthSummary(growingDay, 21, new Date(2026, 7, 5, 12, 0));
  assert.ok(nurtured.progress >= baseline.progress + 12);
  assert.ok(nurtured.effectiveHatchAt.getTime() < baseline.effectiveHatchAt.getTime());
});

test('Care queue is memory-first, bounded, and respects Not today', () => {
  const base = day();
  const first = rankTodayCareActions({ day: base, now: new Date(2026, 7, 5, 13, 0) });
  assert.equal(first.active.length, 5);
  assert.equal(first.active[0]?.id, 'mood');
  assert.equal(first.active[1]?.id, 'sleep');
  assert.ok(first.active.slice(2).filter((action) => action.journalFocused).length >= 2);
  const dismissed = day({
    growth: {
      schemaVersion: 1,
      events: [],
      careActions: [{
        instanceId: 'care:2026-08-05:mood',
        definitionId: 'mood',
        status: 'not_today',
        dismissedAt: '2026-08-05T13:01:00.000Z',
        updatedAt: '2026-08-05T13:01:00.000Z',
      }],
    },
  });
  const next = rankTodayCareActions({ day: dismissed, now: new Date(2026, 7, 5, 13, 2) });
  assert.equal(next.active.some((item) => item.id === 'mood'), false);
});

test('Mood and sleep remain the first care choices throughout the day', () => {
  const evening = rankTodayCareActions({ day: day(), now: new Date(2026, 7, 5, 20, 0) });
  assert.deepEqual(evening.active.slice(0, 2).map((action) => action.id), ['mood', 'sleep']);
});

test('Today care reserves two rotating slots for memories and caps quick goals at one', () => {
  const ranked = rankTodayCareActions({
    day: day(),
    now: new Date(2026, 7, 5, 16, 0),
    quickGoals: [
      { id: 'goal-1', title: 'Water the herbs', familyId: 'mossprout', completed: false },
      { id: 'goal-2', title: 'Step outside', familyId: 'mossprout', completed: false },
    ],
  });
  const rotating = ranked.active.filter((action) => action.category !== 'check_in');
  assert.equal(rotating.length, 3);
  assert.ok(rotating.filter((action) => action.journalFocused).length >= 2);
  assert.equal(rotating.filter((action) => action.destination.kind === 'quick_goal').length, 1);
  const goal = rotating.find((action) => action.destination.kind === 'quick_goal');
  assert.equal(goal?.destination.kind, 'quick_goal');
  if (goal?.destination.kind === 'quick_goal') {
    assert.ok(['goal-1', 'goal-2'].includes(goal.destination.goalId));
    assert.equal(goal.destination.familyId, 'mossprout');
  }
});

test('Today care can fill a fourth rotating slot without adding another quick goal', () => {
  const ranked = rankTodayCareActions({
    day: day(),
    now: new Date(2026, 7, 5, 16, 0),
    quickGoals: [
      { id: 'goal-1', title: 'Water the herbs', familyId: 'mossprout', completed: false },
      { id: 'goal-2', title: 'Step outside', familyId: 'mossprout', completed: false },
    ],
    rotatingLimit: 4,
  });
  const rotating = ranked.active.filter((action) => action.category !== 'check_in');
  assert.equal(rotating.length, 4);
  assert.ok(rotating.filter((action) => action.journalFocused).length >= 3);
  assert.equal(rotating.filter((action) => action.destination.kind === 'quick_goal').length, 1);
});

test('Today care surfaces a playable mini-game while preserving two journal actions', () => {
  const ranked = rankTodayCareActions({
    day: day(),
    memoryQuests: [
      {
        id: 'quest-2026-08-05-captureMoment',
        type: 'captureMoment',
        emoji: 'camera',
        title: 'Capture something that stood out',
        rewardLabel: 'a memory',
        targetCell: 'memory',
        essenceReward: 5,
        completed: false,
      },
      {
        id: 'quest-2026-08-05-answerReflection',
        type: 'answerReflection',
        emoji: 'leaf',
        title: 'Give today a meaning',
        rewardLabel: 'your reflection',
        targetCell: 'reflection',
        essenceReward: 4,
        completed: false,
      },
    ],
    miniGameSuggestion: {
      companionName: 'Cheerlet',
      familyId: 'cheerlet',
      questId: 'quest-cheerlet-block-party',
      title: 'Cheerlet\u2019s Block Party',
    },
    quickGoals: [{ id: 'goal-1', title: 'Celebrate one small win', familyId: 'cheerlet', completed: false }],
    now: new Date(2026, 7, 5, 13, 0),
    rotatingLimit: 4,
  });
  const rotating = ranked.active.filter((action) => action.category !== 'check_in');
  const game = rotating.find((action) => action.destination.kind === 'mini_game');
  assert.equal(rotating.length, 4);
  assert.ok(rotating.filter((action) => action.journalFocused).length >= 2);
  assert.equal(game?.title, 'Play Cheerlet\u2019s Block Party');
  assert.equal(game?.familyId, 'cheerlet');
  assert.deepEqual(game?.destination, { kind: 'mini_game', questId: 'quest-cheerlet-block-party' });
  assert.equal(game?.growthReward, 10);
  assert.equal(game?.completionMode, 'external_activity');
});

test('Today care surfaces a detected Photo Library journaling action', () => {
  const suggestion = buildTodayPhotoRollSuggestion(day(), [{
    assetId: 'library-photo-1',
    capturedAt: '2026-08-05T12:30:00.000Z',
    dayIsoDate: '2026-08-05',
    source: 'camera_roll',
    thumbnailUri: 'ph://library-photo-1',
  }]);
  assert.deepEqual(suggestion, {
    assetIds: ['library-photo-1'],
    title: 'Journal a detected photo',
  });

  const ranked = rankTodayCareActions({
    day: day(),
    now: new Date(2026, 7, 5, 13, 0),
    photoRollSuggestion: suggestion,
    rotatingLimit: 4,
  });
  const action = ranked.active.find((candidate) => candidate.destination.kind === 'photo_roll');
  assert.equal(action?.title, 'Journal a detected photo');
  assert.equal(action?.growthReward, 15);
  assert.deepEqual(action?.destination, { kind: 'photo_roll', assetIds: ['library-photo-1'] });
});

test('Detected Photo Library suggestions prefer a geolocation cluster', () => {
  const suggestion = buildTodayPhotoRollSuggestion({
    isoDate: '2026-08-05',
    dayMap: {
      nodes: [{
        id: 'cluster-park',
        latitude: 51.5,
        longitude: -0.12,
        type: 'park',
        importance: 3,
        hasPhoto: true,
        linkedMomentId: null,
        photoThumbnailUri: 'ph://library-photo-1',
        photos: [
          { id: 'camera-roll-photo-library-photo-1', sourceId: 'library-photo-1', thumbnailUri: 'ph://library-photo-1', capturedAt: '2026-08-05T12:30:00.000Z', momentId: null },
          { id: 'camera-roll-photo-library-photo-2', sourceId: 'library-photo-2', thumbnailUri: 'ph://library-photo-2', capturedAt: '2026-08-05T12:35:00.000Z', momentId: null },
        ],
        startedAt: '2026-08-05T12:30:00.000Z',
        endedAt: '2026-08-05T12:35:00.000Z',
        sampleCount: 2,
        label: 'Riverside Park',
      }],
      path: [],
      primaryLocationId: 'cluster-park',
      viewport: null,
      totalSamples: 2,
    },
  }, [
    { assetId: 'library-photo-1', capturedAt: '2026-08-05T12:30:00.000Z', dayIsoDate: '2026-08-05', source: 'camera_roll', thumbnailUri: 'ph://library-photo-1' },
    { assetId: 'library-photo-2', capturedAt: '2026-08-05T12:35:00.000Z', dayIsoDate: '2026-08-05', source: 'camera_roll', thumbnailUri: 'ph://library-photo-2' },
    { assetId: 'library-photo-3', capturedAt: '2026-08-05T18:00:00.000Z', dayIsoDate: '2026-08-05', source: 'camera_roll', thumbnailUri: 'ph://library-photo-3' },
  ]);

  assert.deepEqual(suggestion, {
    assetIds: ['library-photo-1', 'library-photo-2'],
    title: 'Journal a photo from Riverside Park',
  });
});

test('Mini-game care completion requires a consumed launch and successful attempt receipt', () => {
  cancelTodayCareGameRound();
  const action = rankTodayCareActions({
    day: day(),
    miniGameSuggestion: {
      companionName: 'Cheerlet',
      familyId: 'cheerlet',
      questId: 'quest-cheerlet-block-party',
      title: 'Cheerlet\u2019s Block Party',
    },
    now: new Date(2026, 7, 5, 13, 0),
    rotatingLimit: 4,
  }).active.find((candidate) => candidate.destination.kind === 'mini_game');
  assert.ok(action);
  requestTodayCareGameRound(action);
  assert.equal(completeTodayCareGameRound('attempt-before-launch'), false);
  assert.equal(consumeTodayCareGameRoundLaunch()?.action.instanceId, action.instanceId);
  assert.equal(completeTodayCareGameRound('attempt-success', 1_754_396_400_000), true);
  const completion = consumeTodayCareGameRoundCompletion();
  assert.equal(completion?.attemptId, 'attempt-success');
  assert.equal(completion?.action.instanceId, action.instanceId);
  assert.equal(consumeTodayCareGameRoundCompletion(), null);
});

test('Concrete memory quests replace duplicate generic actions and route directly', () => {
  const quest = {
    id: 'quest-2026-08-05-captureMoment',
    type: 'captureMoment' as const,
    emoji: 'camera',
    title: 'Keep one moment from lunch',
    rewardLabel: 'a linked memory',
    targetCell: 'memory' as const,
    essenceReward: 5,
    completed: false,
  };
  const ranked = rankTodayCareActions({ day: day(), memoryQuests: [quest], now: new Date(2026, 7, 5, 13, 0) });
  const photoActions = ranked.active.filter((action) => action.completionKey === 'photo');
  assert.equal(photoActions.length, 1);
  assert.equal(photoActions[0]?.source, 'memory_quest');
  assert.equal(photoActions[0]?.description, 'Take a photo of something that stood out today.');
  assert.deepEqual(photoActions[0]?.destination, { kind: 'memory_quest', questType: 'captureMoment' });
  assert.equal(ranked.active.some((action) => action.id === 'quest'), false);
});

test('Today care excludes the big-moment quest and labels manual journaling clearly', () => {
  const ranked = rankTodayCareActions({
    day: day(),
    memoryQuests: [{
      id: 'quest-2026-08-05-markBigMoment',
      type: 'markBigMoment',
      emoji: 'star',
      title: 'Mark today as a big moment',
      rewardLabel: 'a landmark',
      targetCell: 'chronicle',
      essenceReward: 15,
      completed: false,
    }],
    now: new Date(2026, 7, 5, 13, 0),
  });
  const journal = ranked.active.find((action) => action.id === 'journal');

  assert.equal(ranked.active.some((action) => action.sourceId === 'quest-2026-08-05-markBigMoment'), false);
  assert.equal(journal?.title, "Write in today's journal");
  assert.deepEqual(journal?.destination, { kind: 'quick_category', category: 'manual_journal' });
});

test('Completed concrete quests remain available to the completion animator', () => {
  const quest = {
    id: 'quest-2026-08-05-answerReflection',
    type: 'answerReflection' as const,
    emoji: 'leaf',
    title: 'Give today a meaning',
    rewardLabel: 'your reflection',
    targetCell: 'reflection' as const,
    essenceReward: 4,
    completed: true,
  };
  const ranked = rankTodayCareActions({ day: day(), memoryQuests: [quest], now: new Date(2026, 7, 5, 20, 0) });
  assert.equal(ranked.active.some((action) => action.sourceId === quest.id), false);
  assert.equal(ranked.completed.some((action) => action.sourceId === quest.id), true);
});

test('Reflection actions are withheld when no working reflection flow exists', () => {
  const reflectionQuest = {
    id: 'quest-2026-08-05-answerReflection',
    type: 'answerReflection' as const,
    emoji: 'leaf',
    title: 'Give today a meaning',
    rewardLabel: 'your reflection',
    targetCell: 'reflection' as const,
    essenceReward: 4,
    completed: false,
  };
  const ranked = rankTodayCareActions({
    day: day(),
    memoryQuests: [reflectionQuest],
    now: new Date(2026, 7, 5, 20, 0),
    reflectionAvailable: false,
  });
  assert.equal(ranked.active.some((action) => action.completionKey === 'reflection'), false);
});

test('Morning still has three journal-focused rotating actions', () => {
  const ranked = rankTodayCareActions({ day: day(), now: new Date(2026, 7, 5, 9, 0) });
  const rotating = ranked.active.filter((action) => action.category !== 'check_in');
  assert.equal(rotating.length, 3);
  assert.equal(rotating.every((action) => action.journalFocused), true);
});
