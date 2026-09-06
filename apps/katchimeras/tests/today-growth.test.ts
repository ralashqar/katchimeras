import assert from 'node:assert/strict';
import { readFileSync } from './helpers/content-fs';
import path from 'node:path';
import test from 'node:test';

import type { StoredHomeDayRecord } from '../types/home';
import { aboutTodayPromptKinds, dayPromptRegistry } from '../constants/day-prompts';
import {
  activeGrowthEnergy,
  awardGrowth,
  completeEnergyAction,
  eggScaleForEnergyRatio,
  eggVisualGrowthForEnergyRatio,
  growthStageForEnergy,
  TODAY_ENERGY_TARGET,
  todayGrowthSummary,
  pendingGrowthAwards,
} from '../utils/today-growth';
import { journalFlowCompletesTodayCareAction, rankTodayCareActions } from '../utils/today-care';
import { buildTodayPhotoRollSuggestion } from '../utils/today-photo-roll-suggestion';
import { splitEnergyAcrossTokens } from '../utils/energy-payout';
import { resolveDayLifecycleState } from '../utils/day-state';
import { regularTodayCameraPinchTarget } from '../features/today/regular-today-camera';
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

test('the first three normal Today actions retreat the camera in equal logarithmic steps', () => {
  const maximum = 2;
  const targets = [0, 1, 2, 3, 4].map((count) => regularTodayCameraPinchTarget(count, maximum));

  assert.equal(targets[0], maximum);
  assert.ok(Math.abs(targets[0] / targets[1] - targets[1] / targets[2]) < 1e-9);
  assert.ok(Math.abs(targets[1] / targets[2] - targets[2] / targets[3]) < 1e-9);
  assert.equal(targets[3], 1);
  assert.equal(targets[4], 1);
});

test('regular Today wires a fresh sleeping Egg to the full authored camera journey', () => {
  const route = readFileSync(path.join(process.cwd(), 'app/(tabs)/today.tsx'), 'utf8');
  const nurture = readFileSync(path.join(process.cwd(), 'components/katchadeck/home/today-nurture-experience.tsx'), 'utf8');
  const motion = readFileSync(path.join(process.cwd(), 'components/katchadeck/home/today-environment-motion.tsx'), 'utf8');

  assert.match(route, /regularTodayCameraPinchTarget\([\s\S]*?nurtureGrowth\.qualifyingActionCount,[\s\S]*?motion\.maxPinchScale/);
  assert.match(route, /scriptedPinchStartScale: regularCameraStartsAtTarget \? regularCameraPinchTarget : null/);
  assert.match(route, /scriptedCameraOwnsFullZoom[\s\S]*?maxPinchScale: scriptedCameraOwnsFullZoom/);
  assert.match(nurture, /regularEggSleeping = Boolean\(!onboardingFocus && growth\.energyRatio <= 0\)/);
  assert.match(nurture, /forceSleeping=\{eggSleeping\}/);
  assert.match(nurture, /!hatchReadyFocus && regularEggSleeping/);
  assert.match(motion, /useSharedValue\(scriptedPinchStartScale \?\? 1\)/);
});

test('claiming yesterday starts Today care from Mood and ignores pre-cycle artifacts', () => {
  const cycleStartedAt = '2026-08-05T09:00:00.000Z';
  const oldMood = {
    id: 'old-mood',
    kind: 'feeling' as const,
    choiceIds: ['good'],
    labels: ['Good'],
    createdAt: '2026-08-05T08:00:00.000Z',
    source: 'prompt_chip' as const,
    semanticTags: ['feeling:good'],
    scoreBias: {},
  };
  const freshCycle = day({
    growth: { schemaVersion: 1, cycleStartedAt, events: [], careActions: [] },
    promptAnswers: [oldMood],
    sleep: { quality: 'good', source: 'manual', recordedAt: '2026-08-05T08:10:00.000Z' },
    stepsCount: 8_000,
    stepsUpdatedAt: '2026-08-05T08:20:00.000Z',
  });

  const first = rankTodayCareActions({ day: freshCycle, now: new Date('2026-08-05T09:05:00.000Z') });
  assert.deepEqual(first.active.map((action) => action.id), ['mood']);

  const afterMood = {
    ...freshCycle,
    promptAnswers: [{ ...oldMood, id: 'new-mood', createdAt: '2026-08-05T09:06:00.000Z' }],
  };
  const second = rankTodayCareActions({ day: afterMood, now: new Date('2026-08-05T09:07:00.000Z') });
  assert.deepEqual(second.active.map((action) => action.id), ['sleep']);

  const afterSleep = {
    ...afterMood,
    sleep: { quality: 'good' as const, source: 'manual' as const, recordedAt: '2026-08-05T09:08:00.000Z' },
  };
  const rotating = rankTodayCareActions({
    day: afterSleep,
    now: new Date('2026-08-05T09:09:00.000Z'),
    rotatingLimit: 10,
  });
  assert.ok(rotating.active.some((action) => action.id === 'movement'));
  assert.ok(!rotating.completed.some((action) => action.id === 'movement'));
});

test('the current day never becomes hatchable from the clock', () => {
  assert.equal(resolveDayLifecycleState({
    hasCreature: false,
    hatchHour: 18,
    hour: 18,
    isSameDay: true,
    minute: 0,
    second: 0,
    storedState: 'forming',
  }), 'forming');
});

test('past dates cannot bypass Daily Wisp finalization', () => {
  const base = {
    hasCreature: false,
    hatchHour: 20,
    isSameDay: true,
    minute: 0,
    second: 0,
    storedState: 'forming' as const,
  };
  assert.equal(resolveDayLifecycleState({ ...base, hour: 19 }), 'forming');
  assert.equal(resolveDayLifecycleState({ ...base, hour: 20 }), 'forming');
  assert.equal(resolveDayLifecycleState({ ...base, hour: 8, isSameDay: false }), 'forming');
});

function afterCareCheckIns(record: StoredHomeDayRecord = day()): StoredHomeDayRecord {
  return {
    ...record,
    promptAnswers: [
      ...record.promptAnswers.filter((answer) => answer.kind !== 'feeling'),
      {
        id: `care-mood-${record.isoDate}`,
        kind: 'feeling',
        choiceIds: ['good'],
        labels: ['Good'],
        createdAt: `${record.isoDate}T08:00:00.000Z`,
        source: 'prompt_chip',
        semanticTags: ['feeling:good'],
        scoreBias: {},
      },
    ],
    sleep: record.sleep ?? { quality: 'good', source: 'manual', recordedAt: `${record.isoDate}T08:00:00.000Z` },
  };
}

test('Energy payouts use five arrivals and preserve the exact reward', () => {
  for (const amount of [5, 8, 10, 15, 18, 20, 25]) {
    const tokens = splitEnergyAcrossTokens(amount);
    assert.equal(tokens.length, 5);
    assert.equal(tokens.reduce((sum, token) => sum + token, 0), amount);
    assert.ok(tokens.every((token) => token > 0));
  }
});

test('egg grows continuously from half size and reaches its existing maximum at half energy', () => {
  assert.equal(eggScaleForEnergyRatio(-1), 0.5);
  assert.equal(eggScaleForEnergyRatio(0), 0.5);
  assert.equal(eggScaleForEnergyRatio(0.25), 0.75);
  assert.equal(eggScaleForEnergyRatio(0.5), 1);
  assert.equal(eggScaleForEnergyRatio(1), 1);
  assert.equal(eggVisualGrowthForEnergyRatio(0.25), 0.5);
  assert.equal(eggVisualGrowthForEnergyRatio(0.5), 1);
  assert.equal(eggVisualGrowthForEnergyRatio(2), 1);
});

test('Growth awards are source-id idempotent', () => {
  const first = awardGrowth(day(), { source: 'photo', sourceId: 'asset-1', awardedAt: new Date('2026-08-05T12:00:00') });
  const second = awardGrowth(first.day, { source: 'photo', sourceId: 'asset-1', awardedAt: new Date('2026-08-05T12:01:00') });
  assert.equal(first.awarded, true);
  assert.equal(second.awarded, false);
  assert.equal(activeGrowthEnergy(second.day), 15);
});

test('energy action completion updates reward and care state atomically and idempotently', () => {
  const input = {
    growth: { source: 'mini_game' as const, sourceId: 'attempt-1', actionId: 'game-1', amount: 10 },
    careAction: {
      instanceId: 'care:2026-08-05:game-1',
      definitionId: 'game-1',
      sourceId: 'attempt-1',
      completedAt: '2026-08-05T12:00:00.000Z',
      deferredUntil: null,
      dismissedAt: null,
    },
  };
  const first = completeEnergyAction(day(), input, new Date('2026-08-05T12:00:00.000Z'));
  const second = completeEnergyAction(first.day, input, new Date('2026-08-05T12:01:00.000Z'));
  assert.equal(first.awarded, true);
  assert.equal(first.changed, true);
  assert.equal(activeGrowthEnergy(first.day), 10);
  assert.equal(first.day.growth?.careActions[0]?.status, 'completed');
  assert.equal(second.changed, false);
  assert.equal(second.day, first.day);
});

test('Egg art stages advance directly at Energy thresholds', () => {
  assert.deepEqual(
    [0, 14, 15, 34, 35, 54, 55, 69, 70, 84, 85, 99, 100, 140].map(growthStageForEnergy),
    [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6],
  );
});

test('Waiting does not change context progress or the Energy-driven egg stage', () => {
  let growingDay = awardGrowth(day(), {
    source: 'journal', sourceId: 'entry-1', awardedAt: new Date(2026, 7, 5, 8, 0),
  }).day;
  growingDay = awardGrowth(growingDay, {
    source: 'sleep', sourceId: 'sleep-1', awardedAt: new Date(2026, 7, 5, 8, 5),
  }).day;
  const morning = todayGrowthSummary(growingDay, 20, new Date(2026, 7, 5, 9, 0));
  const evening = todayGrowthSummary(growingDay, 20, new Date(2026, 7, 5, 19, 0));
  assert.equal(evening.progress, morning.progress);
  assert.equal(morning.activeEnergy, 28);
  assert.equal(morning.stage, 1);
  assert.equal(evening.stage, morning.stage);
});

test('Meaningful memories activate context but never a same-day hatch', () => {
  const first = awardGrowth(day(), {
    source: 'journal',
    sourceId: 'entry-1',
    awardedAt: new Date(2026, 7, 5, 8, 0),
  }).day;
  const dormant = todayGrowthSummary(first, 20, new Date(2026, 7, 5, 21, 0));
  assert.equal(dormant.isActivated, true);
  assert.equal(dormant.qualifyingActionCount, 1);
  assert.equal(dormant.isReady, false);

  const second = awardGrowth(first, {
    source: 'sleep',
    sourceId: 'sleep-1',
    awardedAt: new Date(2026, 7, 5, 21, 1),
  }).day;
  const activated = todayGrowthSummary(second, 20, new Date(2026, 7, 5, 21, 1));
  assert.equal(activated.isActivated, true);
  assert.equal(activated.incubationStartedAt?.getTime(), new Date(2026, 7, 5, 8, 0).getTime());
  assert.equal(activated.isReady, false);
});

test('A low-context day remains forming regardless of clock time', () => {
  let seeded = awardGrowth(day(), {
    source: 'daily_seed', sourceId: 'seed', awardedAt: new Date(2026, 7, 5, 7, 0),
  }).day;
  seeded = awardGrowth(seeded, {
    source: 'mood', sourceId: 'mood-1', awardedAt: new Date(2026, 7, 5, 7, 5),
  }).day;
  const summary = todayGrowthSummary(seeded, 20, new Date(2026, 7, 5, 21, 0));
  assert.equal(summary.activeEnergy, 10);
  assert.equal(summary.qualifyingActionCount, 1);
  assert.equal(summary.isActivated, false);
  assert.equal(summary.isReady, false);
  assert.equal(summary.contextState, 'stirring');
  assert.equal(summary.contextBand, 'low');
});

test('A full-context Egg waits for rollover rather than an evening deadline', () => {
  let growingDay = awardGrowth(day(), {
    source: 'journal', sourceId: 'entry-1', amount: 40, awardedAt: new Date(2026, 7, 5, 8, 0),
  }).day;
  growingDay = awardGrowth(growingDay, {
    source: 'sleep', sourceId: 'sleep-1', amount: 60, awardedAt: new Date(2026, 7, 5, 8, 0),
  }).day;
  const summary = todayGrowthSummary(growingDay, 20, new Date(2026, 7, 5, 12, 0));
  assert.equal(summary.activeEnergy, TODAY_ENERGY_TARGET);
  assert.equal(summary.effectiveHatchAt.getTime(), new Date(2026, 7, 6, 0, 0).getTime());
  assert.equal(summary.savedMinutes, 0);
  assert.equal(summary.contextState, 'full_of_memories');
  assert.equal(summary.contextBand, 'full');
  assert.equal(summary.isContextFull, true);
  assert.equal(summary.isReady, false);
});

test('Egg context changes richness without changing the scheduled hatch time', () => {
  const makeGrowthDay = (energy: number) => day({
    growth: {
      schemaVersion: 1,
      careActions: [],
      events: [
        { id: 'growth:journal:first', source: 'journal', sourceId: 'first', actionId: 'journal', amount: 20, awardedAt: new Date(2026, 7, 5, 8, 0).toISOString() },
        { id: 'growth:sleep:second', source: 'sleep', sourceId: 'second', actionId: 'sleep', amount: Math.max(0, energy - 20), awardedAt: new Date(2026, 7, 5, 8, 5).toISOString() },
      ],
    },
  });
  const fifty = todayGrowthSummary(makeGrowthDay(50), 20, new Date(2026, 7, 5, 12, 0));
  const hundred = todayGrowthSummary(makeGrowthDay(100), 20, new Date(2026, 7, 5, 12, 0));
  const overflow = todayGrowthSummary(makeGrowthDay(140), 20, new Date(2026, 7, 5, 12, 0));
  assert.equal(hundred.effectiveHatchAt.getTime(), fifty.effectiveHatchAt.getTime());
  assert.equal(overflow.activeEnergy, 140);
  assert.equal(overflow.energyRatio, 1);
  assert.equal(overflow.effectiveHatchAt.getTime(), hundred.effectiveHatchAt.getTime());
  assert.equal(fifty.contextBand, 'medium');
  assert.equal(hundred.contextBand, 'full');
  assert.equal(overflow.contextBand, 'full');
});

test('Tomorrow context can grow before rollover without becoming hatchable', () => {
  let tomorrow = awardGrowth(day({ isoDate: '2026-08-06', id: 'day-2026-08-06' }), {
    source: 'journal', sourceId: 'entry-1', awardedAt: new Date(2026, 7, 5, 21, 0),
  }).day;
  tomorrow = awardGrowth(tomorrow, {
    source: 'photo', sourceId: 'photo-1', awardedAt: new Date(2026, 7, 5, 21, 5),
  }).day;
  const dayStart = new Date(2026, 7, 6, 0, 0);
  const preview = todayGrowthSummary(
    tomorrow,
    20,
    new Date(2026, 7, 5, 22, 0),
    { incubationNotBefore: dayStart },
  );

  assert.equal(preview.activeEnergy, 35);
  assert.equal(preview.stage, 2);
  assert.equal(preview.isActivated, true);
  assert.equal(preview.incubationStartedAt?.getTime(), dayStart.getTime());
  assert.equal(preview.progress, 35);
  assert.equal(preview.isReady, false);
});

test('Care queue presents mood then sleep sequentially before rotating actions', () => {
  const base = day();
  const first = rankTodayCareActions({ day: base, now: new Date(2026, 7, 5, 13, 0) });
  assert.deepEqual(first.active.map((item) => item.id), ['mood']);
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
  assert.deepEqual(next.active.map((item) => item.id), ['sleep']);
});

test('A reset day starts with a category-specific action instead of generic journaling', () => {
  const ranked = rankTodayCareActions({
    day: afterCareCheckIns(),
    now: new Date(2026, 7, 5, 13, 0),
    rotatingLimit: 3,
  });
  const rotating = ranked.active.filter((action) => action.category !== 'check_in');

  assert.equal(rotating.some((action) => action.id === 'journal'), false);
  assert.equal(
    rotating.some((action) => ['place', 'movement', 'food', 'studio', 'people', 'work'].includes(action.completionKey)),
    true,
  );
});

test('Contextual care replaces generic journaling and may fill all three rotating slots', () => {
  const ranked = rankTodayCareActions({
    day: afterCareCheckIns(),
    contextualCategories: ['food', 'place', 'people'],
    now: new Date(2026, 7, 5, 16, 0),
    rotatingLimit: 3,
  });
  const rotating = ranked.active.filter((action) => action.category !== 'check_in');

  assert.deepEqual(
    new Set(rotating.map((action) => action.completionKey)),
    new Set(['food', 'place', 'people']),
  );
  assert.equal(rotating.some((action) => action.id === 'journal'), false);
  assert.deepEqual(
    rotating.find((action) => action.id === 'people')?.destination,
    { kind: 'quick_category', category: 'people' },
  );
});

test('Skipping generic journaling keeps it dismissed while other memory actions replace it', () => {
  const skipped = day({
    growth: {
      schemaVersion: 1,
      events: [],
      careActions: [{
        instanceId: 'care:2026-08-05:journal',
        definitionId: 'journal',
        status: 'not_today',
        dismissedAt: '2026-08-05T13:00:00.000Z',
        updatedAt: '2026-08-05T13:00:00.000Z',
      }],
    },
  });
  const ranked = rankTodayCareActions({ day: afterCareCheckIns(skipped), now: new Date(2026, 7, 5, 13, 1) });
  const rotating = ranked.active.filter((action) => action.category !== 'check_in');

  assert.equal(rotating.length, 3);
  assert.equal(rotating.some((action) => action.completionKey === 'journal'), false);
  assert.ok(rotating.every((action) => action.completionKey !== 'journal'));
});

test('Skipping a category suppresses concrete quest aliases for the rest of the day', () => {
  const skipped = day({
    growth: {
      schemaVersion: 1,
      events: [],
      careActions: [{
        instanceId: 'care:2026-08-05:food',
        definitionId: 'food',
        status: 'not_today',
        dismissedAt: '2026-08-05T13:00:00.000Z',
        updatedAt: '2026-08-05T13:00:00.000Z',
      }],
    },
  });
  const ranked = rankTodayCareActions({
    day: afterCareCheckIns(skipped),
    contextualCategories: ['food'],
    memoryQuests: [{
      id: 'quest-2026-08-05-saveFoodMemory',
      type: 'saveFoodMemory',
      emoji: 'food',
      title: 'Save lunch',
      rewardLabel: 'the food vault',
      targetCell: 'foodVault',
      essenceReward: 5,
      completed: false,
    }],
    now: new Date(2026, 7, 5, 13, 1),
  });

  assert.equal(ranked.active.some((action) => action.completionKey === 'food'), false);
});

test('A completed journal category does not repeat and another memory action replaces it', () => {
  const withFoodJournal = day({
    journalRecords: [{
      id: 'journal-food-1',
      schemaVersion: 1,
      idempotencyKey: 'journal-food-1',
      source: { kind: 'manual', sourceId: 'manual-food-1' },
      flowId: 'food',
      flowVersion: 1,
      categoryId: 'meal',
      canonicalQualityIds: [],
      fields: { specific: 'Lunch' },
      feeling: null,
      note: null,
      attachments: [],
      confirmedFacets: [],
      createdAt: '2026-08-05T12:30:00.000Z',
    }],
  });
  const ranked = rankTodayCareActions({
    day: afterCareCheckIns(withFoodJournal),
    now: new Date(2026, 7, 5, 13, 0),
    rotatingLimit: 4,
  });

  assert.equal(ranked.active.some((action) => action.completionKey === 'food'), false);
  assert.equal(ranked.active.filter((action) => action.category !== 'check_in').length, 4);
  assert.equal(ranked.active.some((action) => action.id === 'journal'), false);
});

test('Photo and voice journal artifacts remain available to the care completion animator', () => {
  const journalBase = {
    schemaVersion: 1 as const,
    flowId: 'general',
    flowVersion: 1,
    categoryId: 'general',
    canonicalQualityIds: [],
    fields: {},
    feeling: null,
    note: null,
    attachments: [],
    confirmedFacets: [],
    createdAt: '2026-08-05T12:30:00.000Z',
  };
  const withMediaJournals = day({
    journalRecords: [
      {
        ...journalBase,
        id: 'journal-photo-1',
        idempotencyKey: 'journal-photo-1',
        source: { kind: 'photo', sourceId: 'photo-1', thumbnailUri: 'ph://photo-1' },
      },
      {
        ...journalBase,
        id: 'journal-voice-1',
        idempotencyKey: 'journal-voice-1',
        source: { kind: 'voice_note', sourceId: 'voice-1', audioUri: 'file://voice-1.m4a', durationMs: 1200 },
      },
    ],
  });
  const ranked = rankTodayCareActions({
    day: afterCareCheckIns(withMediaJournals),
    now: new Date(2026, 7, 5, 13, 0),
    rotatingLimit: 4,
  });

  assert.equal(ranked.active.some((action) => action.completionKey === 'photo'), false);
  assert.equal(ranked.active.some((action) => action.completionKey === 'voice'), false);
  assert.equal(ranked.completed.some((action) => action.instanceId === 'care:2026-08-05:photo'), true);
  assert.equal(ranked.completed.some((action) => action.instanceId === 'care:2026-08-05:voice'), true);
});

test('An artifact completes the exact concrete care action that launched its capture flow', () => {
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
  const captured = day({
    journalRecords: [{
      id: 'journal-photo-quest',
      schemaVersion: 1,
      idempotencyKey: 'journal-photo-quest',
      source: { kind: 'photo', sourceId: 'photo-quest', thumbnailUri: 'ph://photo-quest' },
      flowId: 'general',
      flowVersion: 1,
      categoryId: 'general',
      canonicalQualityIds: [],
      fields: {},
      feeling: null,
      note: null,
      attachments: [],
      confirmedFacets: [],
      createdAt: '2026-08-05T12:30:00.000Z',
    }],
  });
  const ranked = rankTodayCareActions({
    day: afterCareCheckIns(captured),
    memoryQuests: [quest],
    now: new Date(2026, 7, 5, 13, 0),
  });

  assert.equal(
    ranked.completed.some((action) => action.instanceId === 'care:2026-08-05:memory-quest:photo'),
    true,
  );
});

test('Dismissing a concrete category suppresses its aliases and selects another specific category', () => {
  const dismissedPhotoQuest = day({
    growth: {
      schemaVersion: 1,
      events: [],
      careActions: [{
        instanceId: 'care:2026-08-05:memory-quest:photo',
        definitionId: 'memory-quest:photo',
        sourceId: 'quest-photo-1',
        status: 'not_today',
        dismissedAt: '2026-08-05T13:00:00.000Z',
        updatedAt: '2026-08-05T13:00:00.000Z',
      }],
    },
  });
  const ranked = rankTodayCareActions({
    day: afterCareCheckIns(dismissedPhotoQuest),
    memoryQuests: [{
      id: 'quest-photo-2',
      type: 'captureMoment',
      emoji: 'camera',
      title: 'Capture another moment',
      rewardLabel: 'a memory',
      targetCell: 'memory',
      essenceReward: 5,
      completed: false,
    }],
    now: new Date(2026, 7, 5, 13, 1),
    rotatingLimit: 4,
  });

  assert.equal(ranked.active.some((action) => action.completionKey === 'photo'), false);
  assert.equal(ranked.active.some((action) => action.completionKey === 'journal'), false);
  assert.equal(
    ranked.active.some((action) => ['place', 'movement', 'food', 'studio', 'people', 'work'].includes(action.completionKey)),
    true,
  );
});

test('Mood remains the first sequential check-in throughout the day', () => {
  const evening = rankTodayCareActions({ day: day(), now: new Date(2026, 7, 5, 20, 0) });
  assert.deepEqual(evening.active.map((action) => action.id), ['mood']);
});

test('Today care reserves two rotating slots for memories and caps quick goals at one', () => {
  const ranked = rankTodayCareActions({
    day: afterCareCheckIns(),
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
    day: afterCareCheckIns(),
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
    day: afterCareCheckIns(),
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

test('Today care never repeats a completed mini-game but may offer a different one', () => {
  const completedQuestId = 'quest-cheerlet-block-party';
  const completedGameDay = day({
    growth: {
      schemaVersion: 1,
      events: [],
      careActions: [{
        instanceId: `care:2026-08-05:mini_game_round:${completedQuestId}`,
        definitionId: `mini_game_round:${completedQuestId}`,
        sourceId: 'attempt-1',
        status: 'completed',
        completedAt: '2026-08-05T13:05:00.000Z',
        updatedAt: '2026-08-05T13:05:00.000Z',
      }],
    },
  });
  const same = rankTodayCareActions({
    day: afterCareCheckIns(completedGameDay),
    miniGameSuggestion: {
      companionName: 'Cheerlet', familyId: 'cheerlet', questId: completedQuestId, title: 'Cheerlet’s Block Party',
    },
    now: new Date(2026, 7, 5, 13, 6),
    rotatingLimit: 4,
  });
  assert.equal(same.active.some((action) => action.destination.kind === 'mini_game'), false);

  const different = rankTodayCareActions({
    day: afterCareCheckIns(completedGameDay),
    miniGameSuggestion: {
      companionName: 'Cheerlet', familyId: 'cheerlet', questId: 'quest-cheerlet-parade-sort', title: 'Cheerlet’s Parade Sort',
    },
    now: new Date(2026, 7, 5, 13, 6),
    rotatingLimit: 4,
  });
  assert.equal(
    different.active.find((action) => action.destination.kind === 'mini_game')?.destination.kind,
    'mini_game',
  );
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
    day: afterCareCheckIns(),
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
    placeName: 'Riverside Park',
    startedAt: '2026-08-05T12:30:00.000Z',
    endedAt: '2026-08-05T12:35:00.000Z',
  });
});

test('Mini-game care completion requires a consumed launch and successful attempt receipt', () => {
  cancelTodayCareGameRound();
  const action = rankTodayCareActions({
    day: afterCareCheckIns(),
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

  requestTodayCareGameRound(action);
  consumeTodayCareGameRoundLaunch();
  assert.equal(completeTodayCareGameRound('attempt-reset-before-return'), true);
  cancelTodayCareGameRound();
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
  const ranked = rankTodayCareActions({ day: afterCareCheckIns(), memoryQuests: [quest], now: new Date(2026, 7, 5, 13, 0) });
  const photoActions = ranked.active.filter((action) => action.completionKey === 'photo');
  assert.equal(photoActions.length, 1);
  assert.equal(photoActions[0]?.source, 'memory_quest');
  assert.equal(photoActions[0]?.description, 'Take a photo of something that stood out today.');
  assert.deepEqual(photoActions[0]?.destination, { kind: 'memory_quest', questType: 'captureMoment' });
  assert.equal(ranked.active.some((action) => action.id === 'quest'), false);
});

test('Today care excludes the big-moment quest and does not force generic journaling', () => {
  const ranked = rankTodayCareActions({
    day: afterCareCheckIns(),
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
  assert.equal(ranked.active.some((action) => action.sourceId === 'quest-2026-08-05-markBigMoment'), false);
  assert.equal(ranked.active.some((action) => action.id === 'journal'), false);
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

test('Two supported lightweight actions activate incubation', () => {
  let record = awardGrowth(day(), { source: 'mood', sourceId: 'mood', awardedAt: new Date(2026, 7, 5, 8, 0) }).day;
  record = awardGrowth(record, { source: 'sleep', sourceId: 'sleep', awardedAt: new Date(2026, 7, 5, 8, 5) }).day;
  const summary = todayGrowthSummary(record, 20, new Date(2026, 7, 5, 9, 0));
  assert.equal(summary.isActivated, true);
  assert.equal(summary.incubationStartedAt?.getTime(), new Date(2026, 7, 5, 8, 5).getTime());
});

test('About Today rotates one stable one-tap prompt at a time through the full pool', () => {
  const base = afterCareCheckIns();
  const now = new Date(2026, 7, 5, 13, 0);
  const first = rankTodayCareActions({ day: base, now });
  const firstAbout = first.active.filter((action) => action.id.startsWith('about_today:'));
  assert.equal(firstAbout.length, 1);
  assert.equal(firstAbout[0]?.id, 'about_today:day_focus');

  const people = dayPromptRegistry.day_focus.options.find((option) => option.id === 'people')!;
  const afterFirst = {
    ...base,
    promptAnswers: [...base.promptAnswers, {
      id: 'about-1', kind: 'day_focus' as const, choiceIds: [people.id], labels: [people.label],
      createdAt: '2026-08-05T13:01:00.000Z', source: 'prompt_chip' as const,
      semanticTags: people.semanticTags, scoreBias: people.scoreBias,
      encounterSeedBias: people.encounterSeedBias,
    }],
  };
  const second = rankTodayCareActions({ day: afterFirst, now });
  assert.equal(second.completed.some((action) => action.id === 'about_today:day_focus'), true);
  assert.equal(second.active.filter((action) => action.id.startsWith('about_today:')).length, 1);

  const shape = dayPromptRegistry.day_character.options[0]!;
  const afterSecond = {
    ...afterFirst,
    promptAnswers: [...afterFirst.promptAnswers, {
      id: 'about-2', kind: 'day_character' as const, choiceIds: [shape.id], labels: [shape.label],
      createdAt: '2026-08-05T13:02:00.000Z', source: 'prompt_chip' as const,
      semanticTags: shape.semanticTags, scoreBias: shape.scoreBias,
      encounterSeedBias: shape.encounterSeedBias,
    }],
  };
  const finished = rankTodayCareActions({ day: afterSecond, now });
  assert.equal(finished.active.filter((action) => action.id.startsWith('about_today:')).length, 1);

  const allAnswered = {
    ...base,
    promptAnswers: [
      ...base.promptAnswers,
      ...aboutTodayPromptKinds.map((kind, index) => {
        const option = dayPromptRegistry[kind].options[0]!;
        return {
          id: `about-all-${index}`,
          kind,
          choiceIds: [option.id],
          labels: [option.label],
          createdAt: `2026-08-05T13:${String(index).padStart(2, '0')}:00.000Z`,
          source: 'prompt_chip' as const,
          semanticTags: option.semanticTags,
          scoreBias: option.scoreBias,
          encounterSeedBias: option.encounterSeedBias,
        };
      }),
    ],
  };
  const exhausted = rankTodayCareActions({ day: allAnswered, now });
  assert.equal(exhausted.active.some((action) => action.id.startsWith('about_today:')), false);
});

test('cycling the late-night action list reaches every journal category and every bespoke prompt', () => {
  let current = afterCareCheckIns();
  const categories = new Set<string>();
  const bespokePrompts = new Set<string>();

  for (let cycle = 0; cycle < 12; cycle += 1) {
    const ranked = rankTodayCareActions({ day: current, now: new Date(2026, 7, 6, 1, cycle), rotatingLimit: 3 });
    const actions = ranked.active.filter((action) => action.category !== 'check_in');
    if (!actions.length) break;
    for (const action of actions) {
      if (['place', 'movement', 'food', 'studio', 'people', 'work', 'event'].includes(action.completionKey)) {
        categories.add(action.completionKey);
      }
      if (action.id.startsWith('about_today:')) bespokePrompts.add(action.id.slice('about_today:'.length));
    }
    const timestamp = `2026-08-06T01:${String(cycle).padStart(2, '0')}:00.000Z`;
    current = {
      ...current,
      growth: {
        schemaVersion: 1,
        events: current.growth?.events ?? [],
        careActions: [
          ...(current.growth?.careActions ?? []),
          ...actions.map((action) => ({
            instanceId: action.instanceId,
            definitionId: action.id,
            sourceId: action.sourceId ?? null,
            status: 'not_today' as const,
            dismissedAt: timestamp,
            updatedAt: timestamp,
          })),
        ],
      },
    };
  }

  assert.deepEqual(categories, new Set(['place', 'movement', 'food', 'studio', 'people', 'work', 'event']));
  assert.deepEqual(bespokePrompts, new Set(aboutTodayPromptKinds));
});

test('About Today options carry hatch trait signal and produce distinct reflection rewards', () => {
  const option = dayPromptRegistry.day_focus.options.find((candidate) => candidate.id === 'people')!;
  const answered = day({ promptAnswers: [{
    id: 'about-people', kind: 'day_focus', choiceIds: [option.id], labels: [option.label],
    createdAt: '2026-08-05T13:00:00.000Z', source: 'prompt_chip', semanticTags: option.semanticTags,
    scoreBias: option.scoreBias, encounterSeedBias: option.encounterSeedBias,
  }] });
  assert.ok((option.scoreBias.social ?? 0) >= 0.26);
  assert.equal(option.encounterSeedBias?.[0]?.seedId, 'social_gathering');
  assert.deepEqual(
    pendingGrowthAwards(answered).map((award) => [award.source, award.actionId]),
    [['reflection', 'about_today:day_focus']],
  );
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
    day: afterCareCheckIns(),
    memoryQuests: [reflectionQuest],
    now: new Date(2026, 7, 5, 20, 0),
    reflectionAvailable: false,
  });
  assert.equal(ranked.active.some((action) => action.completionKey === 'reflection'), false);
});

test('Morning still has three journal-focused rotating actions', () => {
  const ranked = rankTodayCareActions({ day: afterCareCheckIns(), now: new Date(2026, 7, 5, 9, 0) });
  const rotating = ranked.active.filter((action) => action.category !== 'check_in');
  assert.equal(rotating.length, 3);
  assert.equal(rotating.every((action) => action.journalFocused), true);
});

test('journal care rewards defer only when the saved flow completes the originating action', () => {
  assert.equal(journalFlowCompletesTodayCareAction('studio', 'studio'), true);
  assert.equal(journalFlowCompletesTodayCareAction('food', 'food'), true);
  assert.equal(journalFlowCompletesTodayCareAction('general', 'journal'), true);
  assert.equal(journalFlowCompletesTodayCareAction('studio', 'journal'), false);
  assert.equal(journalFlowCompletesTodayCareAction('general', 'studio'), false);
});
