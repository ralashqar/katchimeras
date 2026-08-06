import assert from 'node:assert/strict';
import test from 'node:test';

import { prepareTodayForDevRehatch } from '@/game/days/dev';
import { withStartedHatchCheckIn } from '@/game/days/mutations/day-fields';
import { preserveVisibleHatchForMap } from '@/game/days/map-hatch-invariant';
import {
  preserveActiveTodayFromEmptyDowngrade,
  preserveFinalizedHatches,
} from '@/game/days/state-integrity';
import type { HomeDayRecord, StoredHomeState } from '@/types/home';
import { buildHatchCheckInPlan, currentHatchCheckInQuestion, hatchCheckInEligibility, hatchReflectionMoments } from '@/utils/hatch-check-in';
import { dayForDevHatchSelection } from '@/utils/forced-low-signal-hatch';

function state(): StoredHomeState {
  return {
    version: 14,
    archivedDays: [],
    encounterHistory: {},
    personalEntities: [],
    today: {
      id: 'today',
      isoDate: '2026-07-20',
      state: 'hatched',
      creature: { id: 'creature' },
      shareReadyAt: '2026-07-20T21:00:00.000Z',
      stepsCount: 8200,
      moments: [],
      locations: [],
      promptAnswers: [],
      journalRecords: [{ id: 'book', flowId: 'studio', categoryId: 'book', fields: { specific: 'A Brief History of Time' } }],
      hatchCheckIn: { status: 'completed' },
    },
  } as unknown as StoredHomeState;
}

test('adaptive replay unhatches while preserving the day evidence', () => {
  const next = prepareTodayForDevRehatch(state(), 'adaptive');
  assert.equal(next.today.state, 'ready_to_hatch');
  assert.equal(next.today.creature, null);
  assert.equal(next.today.card, null);
  assert.equal(next.today.hatchCheckIn, undefined);
  assert.equal(next.today.stepsCount, 8200);
  assert.equal(next.today.journalRecords?.[0]?.fields.specific, 'A Brief History of Time');
  assert.equal(next.today.devHatchReflectionMode, undefined);
  assert.equal(hatchCheckInEligibility(next.today), 'regular');
  const started = withStartedHatchCheckIn(next.today, 'regular', new Date('2026-07-20T21:01:00.000Z'));
  assert.equal(currentHatchCheckInQuestion(started)?.kind, 'meaning');
  assert.match(currentHatchCheckInQuestion(started)?.title ?? '', /Brief History of Time/);
});

test('forced low-signal replay bypasses the clock and chooses the hierarchy', () => {
  const next = prepareTodayForDevRehatch(state(), 'force_low_signal');
  assert.equal(next.today.devHatchReflectionMode, 'force_low_signal');
  assert.equal(next.today.devForceReadyToHatch, true);
  assert.equal(hatchCheckInEligibility(next.today), 'empty');
  assert.deepEqual(buildHatchCheckInPlan(next.today, 'empty').questionPlan, [
    'reconstruct.focus',
    'reconstruct.category',
    'reflection.meaning',
  ]);
  assert.deepEqual(hatchReflectionMoments(next.today), []);
  const started = withStartedHatchCheckIn(next.today, 'empty', new Date('2026-07-20T21:01:00.000Z'));
  const question = currentHatchCheckInQuestion(started);
  assert.equal(question?.kind, 'flow');
  assert.equal(question?.suggestedId, null);
  assert.equal(question?.subtitle, undefined);
  assert.equal(question?.choices[0]?.id, 'people');
  assert.doesNotMatch(question?.title ?? '', /Brief History|8,200|steps/i);
});

test('forced low-signal hatch input retains only its questionnaire evidence', () => {
  const forced = prepareTodayForDevRehatch(state(), 'force_low_signal').today;
  forced.promptAnswers = [{ id: 'old-prompt' }] as never;
  forced.placeCategorySeeds = ['museum'];
  forced.weather = { condition: 'storm', source: 'vision' };
  forced.hatchCheckIn = {
    status: 'completed', eligibilityReason: 'empty', flowId: 'food', flowLabel: 'Food & drink',
    categoryId: 'meal', categoryLabel: 'A meal', moodId: null, moodLabel: null,
    anchorId: 'reconstructed:food:meal', anchorLabel: 'A meal', meaningId: 'comfort', meaningLabel: 'Comfort',
    answeredQuestionIds: ['reconstruct.focus', 'reconstruct.category', 'reflection.meaning'],
    semanticTags: ['activity:food'], scoreBias: { calm: 0.32 },
    encounterSeedBias: [{ seedId: 'feast', intensity: 0.58 }],
    startedAt: '2026-07-20T21:00:00.000Z', updatedAt: '2026-07-20T21:01:00.000Z', completedAt: '2026-07-20T21:01:00.000Z',
  };

  const input = dayForDevHatchSelection(forced);
  assert.equal(input.stepsCount, 0);
  assert.deepEqual(input.journalRecords, []);
  assert.deepEqual(input.promptAnswers, []);
  assert.deepEqual(input.placeCategorySeeds, []);
  assert.equal(input.weather, undefined);
  assert.deepEqual(input.hatchCheckIn?.encounterSeedBias, [{ seedId: 'feast', intensity: 0.58 }]);
  assert.equal(forced.stepsCount, 8200);
  assert.equal(forced.journalRecords?.[0]?.categoryId, 'book');
});

test('map refresh repairs a stale egg snapshot but respects an intentional dev unhatch', () => {
  const hatched = state();
  const visible = { ...hatched.today, kind: 'day' } as unknown as HomeDayRecord;
  const stale = {
    ...hatched,
    today: { ...hatched.today, state: 'ready_to_hatch' as const, creature: null },
  };
  const repaired = preserveVisibleHatchForMap(stale, visible);
  assert.equal(repaired.today.state, 'hatched');
  assert.equal(repaired.today.creature?.id, 'creature');

  const intentional = prepareTodayForDevRehatch(hatched, 'adaptive');
  const untouched = preserveVisibleHatchForMap(intentional, visible);
  assert.equal(untouched.today.creature, null);
  assert.equal(untouched.today.devForceReadyToHatch, true);
});

test('a delayed pre-hatch full-state writer cannot remove a finalized hatch', () => {
  const hatched = state();
  const staleWriter = {
    ...hatched,
    encounterHistory: {},
    today: {
      ...hatched.today,
      state: 'ready_to_hatch' as const,
      creature: null,
      shareReadyAt: null,
      locations: [{ id: 'late-map-photo' }],
    },
  } as unknown as StoredHomeState;

  const reconciled = preserveFinalizedHatches(hatched, staleWriter);
  assert.equal(reconciled.today.state, 'hatched');
  assert.equal(reconciled.today.creature?.id, 'creature');
  assert.equal(reconciled.today.shareReadyAt, '2026-07-20T21:00:00.000Z');
  assert.equal(reconciled.today.locations[0]?.id, 'late-map-photo');
});

test('hatch finality follows a day id across today, tomorrow, and archive slots', () => {
  const current = state();
  current.encounterHistory = {
    moth: { count: 2, lastSeenIsoDate: '2026-07-20' },
  };
  const stale = {
    ...current,
    encounterHistory: {
      moth: { count: 1, lastSeenIsoDate: '2026-07-19' },
    },
    today: { ...current.today, id: 'new-today', isoDate: '2026-07-21', state: 'forming' as const, creature: null },
    archivedDays: [{ ...current.today, state: 'ready_to_hatch' as const, creature: null }],
  } as StoredHomeState;

  const reconciled = preserveFinalizedHatches(current, stale);
  assert.equal(reconciled.today.creature, null);
  assert.equal(reconciled.archivedDays[0]?.state, 'hatched');
  assert.equal(reconciled.archivedDays[0]?.creature?.id, 'creature');
  assert.deepEqual(reconciled.encounterHistory.moth, {
    count: 2,
    lastSeenIsoDate: '2026-07-20',
  });
});

test('a stale camera-route writer cannot replace Today progress with an empty day', () => {
  const current = state();
  current.today.state = 'forming';
  current.today.creature = null;
  current.today.card = null;
  current.today.growth = {
    schemaVersion: 1,
    events: [{
      id: 'mood-reward',
      source: 'mood',
      sourceId: 'mood-answer',
      amount: 20,
      awardedAt: '2026-07-20T09:00:00.000Z',
    }],
    careActions: [],
  };
  current.today.promptAnswers = [{ id: 'mood-answer' }] as never;
  const stale = {
    ...current,
    today: {
      ...current.today,
      growth: { schemaVersion: 1 as const, events: [], careActions: [] },
      journalRecords: [],
      promptAnswers: [],
    },
  };

  const reconciled = preserveActiveTodayFromEmptyDowngrade(current, stale);
  assert.equal(reconciled.today.growth?.events[0]?.id, 'mood-reward');
  assert.equal(reconciled.today.promptAnswers[0]?.id, 'mood-answer');
});
