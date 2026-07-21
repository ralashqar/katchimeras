import assert from 'node:assert/strict';
import test from 'node:test';

import {
  withFinishedHatchCheckIn,
  withHatchCheckInAnswer,
  withStartedHatchCheckIn,
} from '@/game/days/mutations/day-fields';
import type { JournalRecord, StoredHomeDayRecord } from '@/types/home';
import {
  currentHatchCheckInQuestion,
  hatchCheckInEligibility,
  rankedHatchCheckInFlows,
} from '@/utils/hatch-check-in';
import { buildMomentTimeline } from '@/utils/moment-timeline';

const now = new Date('2026-07-20T21:00:00.000Z');

function day(): StoredHomeDayRecord {
  return {
    id: 'day-2026-07-20', isoDate: '2026-07-20', state: 'ready_to_hatch', stepsCount: 0,
    visitedPlaceCount: 0, newPlaceCount: 0, locationSampleCount: 0, moments: [], locations: [],
    promptAnswers: [], heroPhoto: null, creature: null,
  } as unknown as StoredHomeDayRecord;
}

function journal(id: string, flowId: string, categoryId: string, specific: string): JournalRecord {
  return { id, flowId, categoryId, fields: { specific }, createdAt: now.toISOString() } as unknown as JournalRecord;
}

test('passive signals suggest context without replacing the empty-day hierarchy', () => {
  const passive = {
    ...day(), stepsCount: 8400, visitedPlaceCount: 2, newPlaceCount: 1, locationSampleCount: 8,
    locations: [{ id: 'point', lat: 51.5, lng: -0.1, capturedAt: now.toISOString(), type: 'unknown', hasPhoto: false, source: 'foreground' }],
  } as StoredHomeDayRecord;
  assert.equal(hatchCheckInEligibility(passive), 'empty');
  assert.equal(rankedHatchCheckInFlows(passive)[0]?.id, 'movement');
  const started = withStartedHatchCheckIn(passive, 'empty', now);
  assert.deepEqual(started.hatchCheckIn?.questionPlan, ['reconstruct.focus', 'reconstruct.category', 'reflection.meaning']);
  assert.equal(currentHatchCheckInQuestion(started)?.kind, 'flow');
});

test('planner distinguishes thin, regular, and rich days', () => {
  const thin = {
    ...day(),
    promptAnswers: [{ id: 'mood', kind: 'feeling', choiceIds: ['good'], labels: ['Light'], createdAt: now.toISOString(), source: 'prompt_chip', semanticTags: [], scoreBias: {} }],
  } as StoredHomeDayRecord;
  assert.equal(hatchCheckInEligibility(thin), 'thin');
  assert.equal(hatchCheckInEligibility({ ...day(), journalRecords: [journal('book', 'studio', 'book', 'Harry Potter')] }), 'regular');
  assert.equal(hatchCheckInEligibility({
    ...day(),
    journalRecords: [journal('book', 'studio', 'book', 'Harry Potter'), journal('walk', 'movement', 'walk', 'Evening walk')],
  }), 'rich');
});

test('low-signal day drills from highlight to detail and meaning in three taps', () => {
  const started = withStartedHatchCheckIn(day(), 'empty', now);
  const focus = withHatchCheckInAnswer(started, { kind: 'flow', id: 'movement' }, new Date(now.getTime() + 1));
  assert.equal(currentHatchCheckInQuestion(focus)?.kind, 'category');
  const detail = withHatchCheckInAnswer(focus, { kind: 'category', id: 'walk' }, new Date(now.getTime() + 2));
  assert.equal(currentHatchCheckInQuestion(detail)?.kind, 'meaning');
  const meaning = withHatchCheckInAnswer(detail, { kind: 'meaning', id: 'reset' }, new Date(now.getTime() + 3));
  const completed = withFinishedHatchCheckIn(meaning, 'completed', new Date(now.getTime() + 4));

  assert.equal(completed.hatchCheckIn?.status, 'completed');
  assert.equal(completed.hatchCheckIn?.anchorLabel, 'Walk');
  assert.equal(completed.hatchCheckIn?.meaningLabel, 'A reset');
  assert.ok((completed.hatchCheckIn?.scoreBias.energy ?? 0) > 0);
  assert.ok((completed.hatchCheckIn?.scoreBias.calm ?? 0) > 0);
  const rows = buildMomentTimeline(completed as never).filter((item) => item.category === 'Daily reflection');
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.label, 'Walk · A reset');
});

test('journaled days ask about actual moments instead of repeating factual classification', () => {
  const regularDay = { ...day(), journalRecords: [journal('book', 'studio', 'book', 'Harry Potter')] };
  const regular = withStartedHatchCheckIn(regularDay, 'regular', now);
  assert.equal(currentHatchCheckInQuestion(regular)?.kind, 'meaning');
  assert.match(currentHatchCheckInQuestion(regular)?.title ?? '', /Harry Potter/);

  const richDay = {
    ...day(),
    journalRecords: [journal('book', 'studio', 'book', 'Harry Potter'), journal('walk', 'movement', 'walk', 'Evening walk')],
  };
  const rich = withStartedHatchCheckIn(richDay, 'rich', now);
  const momentQuestion = currentHatchCheckInQuestion(rich);
  assert.equal(momentQuestion?.kind, 'moment');
  assert.deepEqual(momentQuestion?.choices.map((item) => item.label), ['Harry Potter', 'Evening walk']);
  const selected = withHatchCheckInAnswer(rich, { kind: 'moment', id: 'journal:walk' }, new Date(now.getTime() + 1));
  assert.equal(currentHatchCheckInQuestion(selected)?.kind, 'meaning');
  assert.match(currentHatchCheckInQuestion(selected)?.title ?? '', /Evening walk/);
});

test('hatch now records skipped or partial and never creates empty recap noise', () => {
  const started = withStartedHatchCheckIn(day(), 'empty', now);
  const skipped = withFinishedHatchCheckIn(started, 'partial', new Date(now.getTime() + 1));
  assert.equal(skipped.hatchCheckIn?.status, 'skipped');
  assert.equal(buildMomentTimeline(skipped as never).some((item) => item.category === 'Daily reflection'), false);

  const focus = withHatchCheckInAnswer(started, { kind: 'flow', id: 'people' }, new Date(now.getTime() + 1));
  const partial = withFinishedHatchCheckIn(focus, 'partial', new Date(now.getTime() + 2));
  assert.equal(partial.hatchCheckIn?.status, 'partial');
  assert.equal(buildMomentTimeline(partial as never).filter((item) => item.category === 'Daily reflection').length, 1);
});
