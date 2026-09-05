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
  hatchReflectionMoments,
  rankedHatchCheckInFlows,
  repairGeneratedHatchCheckInAnchor,
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
  return {
    id,
    source: { kind: 'manual', sourceId: id },
    flowId,
    categoryId,
    fields: { specific },
    createdAt: now.toISOString(),
  } as unknown as JournalRecord;
}

function companionCheckInJournal(id: string): JournalRecord {
  return {
    ...journal(id, 'general', 'other', 'I spent time reading or learning. It supported what I want. Next: Build on it with one small step.'),
    source: {
      kind: 'text_note',
      sourceId: `companion-reflection:tasklet:${day().isoDate}`,
      origin: {
        kind: 'companion_reflection',
        creatureId: 'companion:tasklet',
        familyId: 'tasklet',
        goalId: 'goal:study',
        checkInId: 'journey-check-in:companion:tasklet:2026-07-20',
        answerIds: ['moment:read', 'effect:supported', 'next:build'],
        promptId: 'companion-check-in:tasklet',
        promptText: 'Three-question companion check-in',
      },
    },
  } as JournalRecord;
}

function quickGoalJournal(id: string): JournalRecord {
  return {
    ...journal(id, 'work', 'learning', 'Study for an exam'),
    source: {
      kind: 'text_note',
      sourceId: `quick-goal-completion:goal:study:${day().isoDate}`,
      origin: {
        kind: 'quick_goal_completion',
        creatureId: 'tasklet',
        familyId: 'tasklet',
        goalId: 'goal:study',
        completionId: 'completion:study',
        goalTitle: 'Study for an exam',
      },
    },
  } as JournalRecord;
}

test('passive signals become selectable evidence without pretending they are journal entries', () => {
  const passive = {
    ...day(), stepsCount: 8400, visitedPlaceCount: 2, newPlaceCount: 1, locationSampleCount: 8,
    locations: [{ id: 'point', lat: 51.5, lng: -0.1, capturedAt: now.toISOString(), type: 'unknown', hasPhoto: false, source: 'foreground' }],
  } as StoredHomeDayRecord;
  assert.equal(hatchCheckInEligibility(passive), 'thin');
  assert.equal(rankedHatchCheckInFlows(passive)[0]?.id, 'movement');
  const started = withStartedHatchCheckIn(passive, 'thin', now);
  assert.deepEqual(started.hatchCheckIn?.questionPlan, ['reflection.moment', 'evidence.category', 'reflection.meaning']);
  assert.equal(currentHatchCheckInQuestion(started)?.kind, 'moment');
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

test('companion goals never become pre-hatch meaning anchors', () => {
  for (const generated of [companionCheckInJournal('check-in'), quickGoalJournal('quick-goal')]) {
    const goalOnlyDay = {
      ...day(),
      journalRecords: [generated],
      manualJournalEntries: [{
        id: `manual-${generated.id}`,
        flowId: generated.flowId,
        categoryId: generated.categoryId,
        fields: generated.fields,
        createdAt: generated.createdAt,
      }],
      notes: [{ id: generated.source.sourceId, label: generated.fields.specific }],
    } as unknown as StoredHomeDayRecord;

    assert.equal(hatchCheckInEligibility(goalOnlyDay), 'empty');
    const started = withStartedHatchCheckIn(goalOnlyDay, 'empty', now);
    const question = currentHatchCheckInQuestion(started);
    assert.equal(question?.kind, 'flow');
    assert.match(question?.title ?? '', /What was the highlight/);
    assert.doesNotMatch(question?.title ?? '', /reading|exam|goal/i);
  }
});

test('real journal entries still drive reflection when companion goals are also present', () => {
  const mixedDay = {
    ...day(),
    journalRecords: [companionCheckInJournal('check-in'), journal('walk', 'movement', 'walk', 'Evening walk')],
  } as StoredHomeDayRecord;

  assert.equal(hatchCheckInEligibility(mixedDay), 'regular');
  const started = withStartedHatchCheckIn(mixedDay, 'regular', now);
  assert.equal(currentHatchCheckInQuestion(started)?.kind, 'meaning');
  assert.match(currentHatchCheckInQuestion(started)?.title ?? '', /Evening walk/);
  assert.doesNotMatch(currentHatchCheckInQuestion(started)?.title ?? '', /reading or learning/i);
});

test('a user-authored companion reflection remains a real journal entry', () => {
  const reflection = {
    ...journal('reflection', 'general', 'other', 'The quiet path by the pond'),
    source: {
      kind: 'text_note',
      sourceId: 'companion-reflection:mossprout:2026-07-20',
      origin: {
        kind: 'companion_reflection',
        creatureId: 'mossprout',
        promptId: 'reflection:park',
        promptText: 'What pulls you back?',
      },
    },
  } as JournalRecord;
  const reflectionDay = { ...day(), journalRecords: [reflection] } as StoredHomeDayRecord;

  assert.equal(hatchCheckInEligibility(reflectionDay), 'regular');
  const started = withStartedHatchCheckIn(reflectionDay, 'regular', now);
  assert.match(currentHatchCheckInQuestion(started)?.title ?? '', /quiet path by the pond/i);
});

test('an already-open generated-goal meaning prompt is repaired to the no-journal route', () => {
  const originalJournal = journal('check-in', 'general', 'other', 'I spent time reading or learning');
  const originallyStarted = withStartedHatchCheckIn({ ...day(), journalRecords: [originalJournal] }, 'regular', now);
  assert.equal(currentHatchCheckInQuestion(originallyStarted)?.kind, 'meaning');

  const stale = {
    ...originallyStarted,
    journalRecords: [companionCheckInJournal('check-in')],
  } as StoredHomeDayRecord;
  const repaired = repairGeneratedHatchCheckInAnchor(stale);

  assert.equal(repaired.hatchCheckIn?.eligibilityReason, 'empty');
  assert.deepEqual(repaired.hatchCheckIn?.questionPlan, ['reconstruct.focus', 'reconstruct.category', 'reflection.meaning']);
  assert.equal(currentHatchCheckInQuestion(repaired)?.kind, 'flow');
  assert.match(currentHatchCheckInQuestion(repaired)?.title ?? '', /What was the highlight/);
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

test('a museum day with 20k steps offers both concrete interpretations', () => {
  const museumDay = {
    ...day(),
    stepsCount: 20_000,
    placeCategorySeeds: ['museum'],
    visitedPlaceCount: 1,
  } as StoredHomeDayRecord;

  const choices = hatchReflectionMoments(museumDay);
  assert.deepEqual(choices.map((choice) => choice.label), ['Museum or gallery', '20,000 steps']);
  const started = withStartedHatchCheckIn(museumDay, 'thin', now);
  assert.equal(currentHatchCheckInQuestion(started)?.title, 'What best holds this day?');

  const museum = withHatchCheckInAnswer(started, { kind: 'moment', id: 'detected:museum' }, new Date(now.getTime() + 1));
  assert.equal(currentHatchCheckInQuestion(museum)?.kind, 'meaning');
  assert.equal(museum.hatchCheckIn?.categoryId, 'museum');
  assert.equal(museum.hatchCheckIn?.encounterSeedBias[0]?.seedId, 'museum');
});

test('choosing raw steps asks what kind of movement before asking its meaning', () => {
  const activeDay = { ...day(), stepsCount: 20_000, placeCategorySeeds: ['museum'] } as StoredHomeDayRecord;
  const started = withStartedHatchCheckIn(activeDay, 'thin', now);
  const steps = withHatchCheckInAnswer(started, { kind: 'moment', id: 'steps:significant' }, new Date(now.getTime() + 1));
  assert.equal(currentHatchCheckInQuestion(steps)?.kind, 'category');
  assert.match(currentHatchCheckInQuestion(steps)?.title ?? '', /movement/i);
  const hike = withHatchCheckInAnswer(steps, { kind: 'category', id: 'hike' }, new Date(now.getTime() + 2));
  assert.equal(currentHatchCheckInQuestion(hike)?.kind, 'meaning');
  assert.equal(hike.hatchCheckIn?.encounterSeedBias[0]?.seedId, 'high_steps_day');
});

test('canonical journal affinities resolve museum rather than the old generic park fallback', () => {
  const started = withStartedHatchCheckIn(day(), 'empty', now);
  const somewhere = withHatchCheckInAnswer(started, { kind: 'flow', id: 'went_somewhere' }, new Date(now.getTime() + 1));
  const museum = withHatchCheckInAnswer(somewhere, { kind: 'category', id: 'museum' }, new Date(now.getTime() + 2));
  assert.equal(museum.hatchCheckIn?.encounterSeedBias[0]?.seedId, 'museum');
});

test('selecting an existing journal moment marks it key without creating another record', () => {
  const journalDay = {
    ...day(),
    journalRecords: [journal('book', 'studio', 'book', 'A novel'), journal('walk', 'movement', 'walk', 'Riverside walk')],
  } as StoredHomeDayRecord;
  const started = withStartedHatchCheckIn(journalDay, 'rich', now);
  const selected = withHatchCheckInAnswer(started, { kind: 'moment', id: 'journal:walk' }, new Date(now.getTime() + 1));
  assert.equal(selected.keyJournalRecordId, 'walk');
  assert.equal(selected.journalRecords?.length, 2);
});
