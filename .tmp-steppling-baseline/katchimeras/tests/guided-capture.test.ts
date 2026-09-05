import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { withManualJournalEntry } from '@/game/days/mutations/manual-journal';
import type { StoredHomeDayRecord } from '@/types/home';
import {
  buildGuidedCaptureSubmission,
  GUIDED_CAPTURE_FLOWS,
  guidedCaptureFlowForCareAction,
  guidedCaptureFlowForManualFlowId,
  guidedCaptureFlowForQuickCategory,
  guidedFollowUpOptions,
  guidedRefinementOptions,
} from '@/utils/guided-capture';
import { MANUAL_JOURNAL_FLOWS, manualJournalFlow } from '@/utils/manual-journal-registry';
import { journalHatchContributions } from '@/utils/journal-hatch-contributions';
import { pendingGrowthAwards } from '@/utils/today-growth';

const NOW = new Date('2026-08-12T12:00:00.000Z');

function day(): StoredHomeDayRecord {
  return {
    id: 'day-2026-08-12',
    isoDate: '2026-08-12',
    state: 'forming',
    moments: [],
    locations: [],
    promptAnswers: [],
    evidence: [],
    classifiedMemories: [],
    manualJournalEntries: [],
    journalRecords: [],
    notes: [],
    foodMoments: [],
    studioMoments: [],
    bigMoments: [],
  } as unknown as StoredHomeDayRecord;
}

test('every guided answer resolves to a canonical journal route', () => {
  for (const prompt of GUIDED_CAPTURE_FLOWS) {
    assert.ok(prompt.options.length >= 3 && prompt.options.length <= 6);
    for (const option of prompt.options) {
      const flow = manualJournalFlow(option.flowId);
      assert.ok(flow, `${prompt.id}.${option.id} has a flow`);
      assert.ok(
        flow?.choices.some((choice) => choice.id === option.categoryId),
        `${prompt.id}.${option.id} has a category`,
      );
      for (const refinement of guidedRefinementOptions(option)) {
        assert.equal(refinement.flowId, option.flowId);
        assert.ok(
          flow?.choices.some((choice) => choice.id === refinement.categoryId),
          `${prompt.id}.${option.id}.${refinement.id} has a canonical category`,
        );
      }
    }
  }
});

test('guided choices expose every legacy journal subcategory', () => {
  const reachable = new Set(GUIDED_CAPTURE_FLOWS.flatMap((prompt) => prompt.options.flatMap((option) => [
    `${option.flowId}.${option.categoryId}`,
    ...guidedRefinementOptions(option).map((refinement) => `${refinement.flowId}.${refinement.categoryId}`),
  ])));

  for (const flow of MANUAL_JOURNAL_FLOWS) {
    for (const choice of flow.choices) {
      assert.ok(reachable.has(`${flow.id}.${choice.id}`), `${flow.id}.${choice.id} is reachable`);
    }
  }
});

test('Movement exposes Sport directly and keeps its specific sport choices', () => {
  const movement = GUIDED_CAPTURE_FLOWS.find((prompt) => prompt.id === 'movement')!;
  const exercise = movement.options.find((option) => option.id === 'exercise')!;
  const sport = movement.options.find((option) => option.id === 'sport')!;

  assert.equal(sport.categoryId, 'sport');
  assert.equal(guidedRefinementOptions(exercise).some((option) => option.categoryId === 'sport'), false);
  assert.deepEqual(
    guidedFollowUpOptions(sport).map((option) => option.id),
    ['football', 'basketball', 'tennis', 'swimming', 'other_sport'],
  );
});

test('Food keeps drinks as a distinct first-level branch with drink-only refinement', () => {
  const food = GUIDED_CAPTURE_FLOWS.find((prompt) => prompt.id === 'food')!;
  const drink = food.options.find((option) => option.id === 'a_drink')!;

  assert.deepEqual(
    food.options.map((option) => option.id),
    ['meal', 'snack', 'dessert', 'a_drink', 'made', 'other'],
  );
  assert.equal(food.options.some((option) => /food\s*(or|&)\s*drink/i.test(option.label)), false);
  assert.equal(drink.categoryId, 'drink');
  assert.deepEqual(
    guidedRefinementOptions(drink).map((option) => option.categoryId),
    ['coffee', 'tea', 'drink'],
  );
  assert.deepEqual(
    food.options.filter((option) => option.id !== 'a_drink').map((option) => option.categoryId),
    ['meal', 'snack', 'dessert', 'cooking', 'other_food'],
  );

  const place = GUIDED_CAPTURE_FLOWS.find((prompt) => prompt.id === 'place')!;
  assert.equal(place.options.some((option) => /food\s*(or|&)\s*drink/i.test(option.label)), false);
  assert.deepEqual(
    guidedRefinementOptions(place.options.find((option) => option.id === 'cafe_or_restaurant')!)
      .map((option) => option.categoryId),
    ['cafe', 'restaurant'],
  );
});

test('Places groups every legacy subcategory once in a coherent hierarchy', () => {
  const place = GUIDED_CAPTURE_FLOWS.find((prompt) => prompt.id === 'place')!;
  const flow = manualJournalFlow('went_somewhere')!;

  assert.deepEqual(
    place.options.map((option) => option.id),
    ['outdoors', 'around_town', 'culture', 'cafe_or_restaurant', 'home', 'trip_or_elsewhere'],
  );
  assert.deepEqual(
    place.options.map((option) => option.label),
    ['Outdoors', 'Town or neighbourhood', 'Culture or entertainment', 'Cafe or restaurant', 'At home', 'A trip or somewhere else'],
  );

  const routedCategories = place.options.flatMap((option) => {
    const refinements = guidedRefinementOptions(option);
    return refinements.length ? refinements.map((refinement) => refinement.categoryId) : [option.categoryId];
  });
  assert.deepEqual(
    routedCategories,
    ['park', 'forest', 'garden', 'beach', 'city', 'street', 'museum', 'cinema', 'cafe', 'restaurant', 'home', 'travel', 'other_place'],
  );
  assert.equal(new Set(routedCategories).size, routedCategories.length);
  assert.deepEqual(new Set(routedCategories), new Set(flow.choices.map((choice) => choice.id)));
});

test('every manual journal topic and every journaling hub action has a guided route', () => {
  for (const flow of MANUAL_JOURNAL_FLOWS) {
    assert.ok(guidedCaptureFlowForManualFlowId(flow.id), `${flow.id} has a guided replacement`);
  }

  for (const categoryId of [
    'manual_journal',
    'people',
    'place',
    'movement',
    'food',
    'studio',
    'work',
    'life_event',
    'reflection',
  ]) {
    assert.ok(guidedCaptureFlowForQuickCategory(categoryId), `${categoryId} opens guided capture`);
  }

  assert.equal(guidedCaptureFlowForQuickCategory('studio')?.id, 'inspiration');
  assert.equal(guidedCaptureFlowForQuickCategory('life_event')?.id, 'big_event');
});

test('bespoke one-answer care prompts bypass the journal hierarchy', () => {
  assert.equal(guidedCaptureFlowForCareAction('about_today:day_character'), null);
  assert.equal(guidedCaptureFlowForCareAction('about_today:activity'), null);
  assert.equal(guidedCaptureFlowForCareAction('reflection'), null);
  assert.equal(guidedCaptureFlowForCareAction('food')?.id, 'food');
  assert.equal(guidedCaptureFlowForCareAction('people')?.id, 'people');
});

test('guided capture records its entry point and keeps optional detail structured', () => {
  const prompt = GUIDED_CAPTURE_FLOWS.find((candidate) => candidate.id === 'inspiration')!;
  const option = prompt.options.find((candidate) => candidate.id === 'book')!;
  const feeling = guidedFollowUpOptions(option).find((candidate) => candidate.kind === 'feeling')!;
  const submission = buildGuidedCaptureSubmission({
    sessionId: 'guided:2026-08-12:inspiration',
    promptId: prompt.id,
    option,
    contextId: feeling.id,
    specific: 'The Left Hand of Darkness',
    entryPoint: 'plus',
  });

  assert.equal(submission.fields.specific, 'The Left Hand of Darkness');
  assert.equal(submission.fields.context, null);
  assert.equal(submission.feeling, feeling.id);
  assert.equal(submission.journalSource?.origin?.kind, 'guided_capture');
  if (submission.journalSource?.origin?.kind === 'guided_capture') {
    assert.equal(submission.journalSource.origin.entryPoint, 'plus');
    assert.equal(submission.journalSource.origin.captureMode, 'choice');
  }
});

test('one tap is a valid journal memory and contextual detail enriches the same record', () => {
  const prompt = GUIDED_CAPTURE_FLOWS.find((candidate) => candidate.id === 'people')!;
  const option = prompt.options.find((candidate) => candidate.id === 'family')!;
  const context = guidedFollowUpOptions(option)[0]!;
  const sessionId = 'guided:2026-08-12:people';

  const first = withManualJournalEntry(day(), buildGuidedCaptureSubmission({
    sessionId,
    promptId: prompt.id,
    option,
  }), NOW);
  assert.equal(first.journalRecords?.length, 1);
  assert.equal(first.journalRecords?.[0]?.source.origin?.kind, 'guided_capture');
  assert.deepEqual(first.journalRecords?.[0]?.fields.guided_answers, ['family']);
  assert.equal(pendingGrowthAwards(first).find((award) => award.source === 'journal')?.amount, 10);

  const enriched = withManualJournalEntry(first, buildGuidedCaptureSubmission({
    sessionId,
    promptId: prompt.id,
    option,
    contextId: context.id,
    note: 'Sunday lunch',
  }), new Date(NOW.getTime() + 1_000));
  assert.equal(enriched.journalRecords?.length, 1);
  assert.equal(enriched.journalRecords?.[0]?.fields.context, context.id);
  assert.equal(enriched.journalRecords?.[0]?.note, 'Sunday lunch');
  assert.deepEqual(enriched.journalRecords?.[0]?.source.origin?.kind === 'guided_capture'
    ? enriched.journalRecords[0].source.origin.answerIds
    : [], ['family', context.id]);
  assert.equal(pendingGrowthAwards(enriched).find((award) => award.source === 'journal')?.amount, 20);
});

test('a broad people answer upgrades to the selected relationship and Hatch affinity', () => {
  const prompt = GUIDED_CAPTURE_FLOWS.find((candidate) => candidate.id === 'standout')!;
  const people = prompt.options.find((candidate) => candidate.id === 'people')!;
  const child = guidedRefinementOptions(people).find((candidate) => candidate.categoryId === 'my_child')!;
  const playtime = guidedFollowUpOptions(child).find((candidate) => candidate.id === 'playtime')!;
  const sessionId = 'guided:2026-08-12:people-hierarchy';

  const broad = withManualJournalEntry(day(), buildGuidedCaptureSubmission({
    sessionId,
    promptId: prompt.id,
    option: people,
  }), NOW);
  assert.equal(broad.journalRecords?.[0]?.categoryId, 'group');

  const refined = withManualJournalEntry(broad, buildGuidedCaptureSubmission({
    sessionId,
    promptId: prompt.id,
    option: child,
    contextId: playtime.id,
  }), new Date(NOW.getTime() + 1_000));
  assert.equal(refined.journalRecords?.length, 1);
  assert.equal(refined.journalRecords?.[0]?.categoryId, 'my_child');
  assert.equal(refined.journalRecords?.[0]?.fields.context, 'playtime');
  assert.deepEqual(refined.journalRecords?.[0]?.fields.guided_answers, ['people', 'my_child', 'playtime']);
  assert.ok(journalHatchContributions(refined).some((item) => item.familyId === 'snuglet' && item.seedId === 'parenting_care'));
});

test('write detail leaves the guided panel and reuses the focused note composer', () => {
  const guidedSheet = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'guided-capture-sheet.tsx'),
    'utf8',
  );
  const todayScreen = fs.readFileSync(path.join(process.cwd(), 'app', '(tabs)', 'today.tsx'), 'utf8');

  assert.doesNotMatch(guidedSheet, /<TextInput/);
  assert.match(guidedSheet, /onClose\(\);[\s\S]*onAddText\(\{/);
  assert.match(todayScreen, /onSubmit=\{guidedTextDetail \? handleGuidedTextDetailSubmit : handleQuickNoteSubmit\}/);
  assert.match(todayScreen, /\.\.\.guidedTextDetail\.submission/);
  assert.match(todayScreen, /contextKicker=\{guidedTextDetail \? 'ADD A DETAIL'/);
  assert.match(todayScreen, /showVoiceOption=\{!guidedTextDetail\}/);
});

test('guided category pages keep the bespoke journal artwork identity', () => {
  const guidedSheet = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'guided-capture-sheet.tsx'),
    'utf8',
  );

  assert.match(guidedSheet, /standout: 'general'/);
  assert.match(guidedSheet, /place: 'went_somewhere'/);
  assert.match(guidedSheet, /inspiration: 'studio'/);
  assert.match(guidedSheet, /manualJournalArt\(GUIDED_FLOW_ART_ID\[flow\.id\] \?\? 'general'\)/);
});

test('guided follow-up removes explanatory copy and uses a compact detail grid', () => {
  const guidedSheet = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'guided-capture-sheet.tsx'),
    'utf8',
  );

  assert.doesNotMatch(guidedSheet, /Saved to the Egg/);
  assert.doesNotMatch(guidedSheet, /That is enough\. Add one more detail/);
  assert.doesNotMatch(guidedSheet, /\{selected \? 'Saved to the Egg' : 'Choose one'\}/);
  assert.match(guidedSheet, /detailActions: \{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 \}/);
  assert.match(guidedSheet, /detailAction: \{[\s\S]*?minHeight: 58,[\s\S]*?width: '48%'/);
  assert.match(guidedSheet, /refinementGrid: \{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 \}/);
  assert.match(guidedSheet, /awaitingRefinement[\s\S]*guidedRefinementTitle\(selected\)/);
  assert.match(guidedSheet, /refinedSelection \? changeRefinement : undefined/);
});

test('guided Today actions persist their originating row and defer its exit until the sheet closes', () => {
  const todayScreen = fs.readFileSync(path.join(process.cwd(), 'app', '(tabs)', 'today.tsx'), 'utf8');

  assert.match(
    todayScreen,
    /onCommit=\{\(submission\) => \{[\s\S]*?deferredJournalCareCompletionRef\.current = guidedCapture\.action\.instanceId;[\s\S]*?updateCareAction\([\s\S]*?instanceId: guidedCapture\.action\.instanceId,[\s\S]*?status: 'completed',[\s\S]*?\}, guidedCapture\.target\);[\s\S]*?addManualJournalEntry\(submission, guidedCapture\.target\)/,
  );
  assert.match(
    todayScreen,
    /onClose=\{\(\) => \{[\s\S]*?deferredCareMergeEnergyRef\.current = guidedCapture\.mergeEnergyAmount \?\? 0;[\s\S]*?queueCareCompletionAfterJournalDismiss\(guidedCapture\.action\)/,
  );
  assert.match(
    todayScreen,
    /onFeed=\{\(option: GuidedCaptureOption, from\) => \{[\s\S]*?label: `\$\{option\.emoji\} \$\{option\.label\}`,[\s\S]*?tint: eggReactionTint\(option\.reaction\)/,
  );
  assert.doesNotMatch(
    todayScreen,
    /onFeed=\{\(option: GuidedCaptureOption, from\) => \{[\s\S]*?mergeEnergyAmount:[\s\S]*?\}, \(\) => \{\}\);/,
  );
  assert.match(todayScreen, /todayPhotoLibrarySheet !== null \|\|[\s\S]*?guidedCapture !== null \|\|/);
});
