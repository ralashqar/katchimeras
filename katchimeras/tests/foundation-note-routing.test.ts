import assert from 'node:assert/strict';
import test from 'node:test';

import { JOURNAL_CLASSIFICATION_CATALOG } from '@/utils/journal-classification-catalog';
import { journalModelFlowIdForInternalFlow } from '@/utils/journal-model-flow';
import {
  classifyNoteRouteWithRunner,
  type StructuredNoteTask,
  type StructuredNoteTaskRunner,
} from '@/utils/foundation-note-routing';

const MODEL_AREA_IDS = [...new Set(
  JOURNAL_CLASSIFICATION_CATALOG.map((entry) => journalModelFlowIdForInternalFlow(entry.flowId))
)];

function scriptedRunner(
  responses: Record<string, Record<string, unknown>>,
  calls: StructuredNoteTask[]
): StructuredNoteTaskRunner {
  return async (task) => {
    calls.push(task);
    return {
      response: responses[task.taskId] ?? null,
      failure: responses[task.taskId] ? null : 'error',
    };
  };
}

function areaThenCategory(area: string, alternativeArea: string, routeKey: string, confidence = 'high') {
  return {
    'note.area.v1': { area, alternativeArea, confidence },
    'note.category.v2': { routeKey, confidence, alternativeRouteKey: 'none', alternativeConfidence: 'low', thirdRouteKey: 'none', thirdConfidence: 'low' },
  };
}

test('a note is routed by area first, then by category inside that area', async () => {
  const calls: StructuredNoteTask[] = [];
  const result = await classifyNoteRouteWithRunner(
    'I studied for a math exam',
    9000,
    scriptedRunner(areaThenCategory('work', 'none', 'work.learning'), calls)
  );

  assert.deepEqual(calls.map((call) => call.taskId), ['note.area.v1', 'note.category.v2']);
  assert.ok(calls.every((call) => call.sampling === 'greedy'));
  assert.equal(result.raw?.routeKey, 'work.learning');
  assert.equal(result.raw?.routeStrategy, 'two_stage_v1');
  assert.equal(result.suggestedFlowId, 'work');
  assert.equal(result.topLevelConfidence, 'high');
  assert.equal(result.subcategoryConfidence, 'high');
});

test('the model only ever sees the clear model vocabulary, never internal flow ids', async () => {
  const calls: StructuredNoteTask[] = [];
  await classifyNoteRouteWithRunner(
    'I studied for a math exam',
    9000,
    scriptedRunner(areaThenCategory('work', 'media', 'work.learning'), calls)
  );

  const areaValues = calls[0]?.fields.find((field) => field.name === 'area')?.values ?? [];
  assert.deepEqual(areaValues, MODEL_AREA_IDS);
  assert.deepEqual(areaValues, ['place', 'food', 'media', 'movement', 'people', 'work', 'event', 'other']);

  const everything = calls.flatMap((call) => [
    call.instructions,
    call.prompt,
    ...call.fields.flatMap((field) => field.values ?? []),
  ]).join('\n');
  // `studio` shares a stem with "studied" and is the internal id the model must
  // never see; the other internal ids are equally unnatural as prompt tokens.
  for (const internalId of ['studio', 'went_somewhere', 'big_event', 'firstTime', 'newHome', 'newJob']) {
    assert.doesNotMatch(everything, new RegExp(internalId), `${internalId} leaked to the model`);
  }
  assert.match(everything, /media\.book:/);
  assert.match(everything, /^work\.learning: .*“I studied for an exam”/m);
});

test('every area carries a boundary description, and both passes stay small', async () => {
  const calls: StructuredNoteTask[] = [];
  await classifyNoteRouteWithRunner(
    'anything at all',
    9000,
    scriptedRunner(areaThenCategory('place', 'event', 'place.city'), calls)
  );

  const areaInstructions = calls[0]?.instructions ?? '';
  for (const areaId of MODEL_AREA_IDS) {
    assert.match(areaInstructions, new RegExp(`^${areaId} — .{40,}`, 'm'), `${areaId} description`);
  }
  // The boundary clauses are the whole point of splitting the passes.
  assert.match(areaInstructions, /media — .*Not studying, revising or learning a subject/);
  assert.match(areaInstructions, /work — .*All studying, revision, homework, courses and preparing for exams belong here/);
  assert.match(areaInstructions, /place — .*not the activity you did there/);
  // The native structured bridge rejects instructions over 16k characters, and
  // small passes are the reason a 75-way choice was split in the first place.
  for (const call of calls) {
    assert.ok(call.instructions.length < 6000, `${call.taskId} instructions were ${call.instructions.length} chars`);
    assert.equal(call.prompt, 'Note: "anything at all"');
  }
});

test('the second pass can recover a wrong area from the alternative', async () => {
  const calls: StructuredNoteTask[] = [];
  const result = await classifyNoteRouteWithRunner(
    'I studied for a math exam',
    9000,
    scriptedRunner(areaThenCategory('media', 'work', 'work.learning'), calls)
  );

  const routeKeys = calls[1]?.fields.find((field) => field.name === 'routeKey')?.values ?? [];
  assert.ok(routeKeys.includes('work.learning'), 'alternative area categories are offered');
  assert.ok(routeKeys.includes('media.book'), 'primary area categories are still offered');
  assert.match(calls[1]?.instructions ?? '', /The note belongs to media or work/);
  assert.equal(result.raw?.routeKey, 'work.learning');
  assert.equal(result.raw?.routeStrategy, 'two_stage_alternative_area_v1');
  assert.equal(result.suggestedFlowId, 'work');
  // Stage 1 was wrong, so the result is a suggestion rather than a filing.
  assert.equal(result.subcategoryConfidence, 'medium');
});

test('the category pass returns three distinct ranked canonical candidates for review', async () => {
  const calls: StructuredNoteTask[] = [];
  const result = await classifyNoteRouteWithRunner(
    'I had lunch with my partner at a cafe',
    9000,
    scriptedRunner({
      'note.area.v1': { area: 'people', alternativeArea: 'food', confidence: 'medium' },
      'note.category.v2': {
        routeKey: 'people.partner',
        confidence: 'high',
        alternativeRouteKey: 'food.meal',
        alternativeConfidence: 'medium',
        thirdRouteKey: 'food.coffee',
        thirdConfidence: 'low',
      },
    }, calls)
  );

  assert.equal(result.raw?.routeKey, 'people.partner');
  assert.equal(result.raw?.alternativeRouteKey, 'food.meal');
  assert.equal(result.raw?.thirdRouteKey, 'food.coffee');
  assert.ok(Number(result.raw?.routeConfidence) > Number(result.raw?.alternativeRouteConfidence));
  assert.ok(Number(result.raw?.alternativeRouteConfidence) > Number(result.raw?.thirdRouteConfidence));
  assert.deepEqual(calls[1]?.fields.map((field) => field.name), [
    'routeKey', 'confidence', 'alternativeRouteKey', 'alternativeConfidence', 'thirdRouteKey', 'thirdConfidence',
  ]);
});

test('without an alternative the second pass sees only the chosen area', async () => {
  const calls: StructuredNoteTask[] = [];
  await classifyNoteRouteWithRunner(
    'I read a book',
    9000,
    scriptedRunner(areaThenCategory('media', 'none', 'media.book'), calls)
  );

  const routeKeys = calls[1]?.fields.find((field) => field.name === 'routeKey')?.values ?? [];
  assert.ok(routeKeys.every((key) => key.startsWith('media.')));
  assert.match(calls[1]?.instructions ?? '', /The note belongs to media\. Choose one category from that area/);
});

test('a failed category pass keeps the area so the composer opens in the right place', async () => {
  const calls: StructuredNoteTask[] = [];
  const result = await classifyNoteRouteWithRunner(
    'I studied for a math exam',
    9000,
    scriptedRunner({ 'note.area.v1': { area: 'work', alternativeArea: 'none', confidence: 'high' } }, calls)
  );

  assert.equal(calls.length, 2);
  assert.equal(result.raw, null);
  assert.equal(result.suggestedFlowId, 'work');
  assert.equal(result.topLevelConfidence, 'high');
  assert.equal(result.subcategoryConfidence, null);
});

test('medium area confidence never auto-resolves the note', async () => {
  const calls: StructuredNoteTask[] = [];
  const result = await classifyNoteRouteWithRunner(
    'I watched something',
    9000,
    scriptedRunner(areaThenCategory('media', 'none', 'media.show', 'medium'), calls)
  );

  assert.equal(result.raw?.routeKey, 'studio.show');
  assert.equal(result.suggestedFlowId, 'studio');
  assert.equal(result.topLevelConfidence, 'medium');
  assert.equal(result.subcategoryConfidence, 'medium');
});

test('an unusable area response fails closed', async () => {
  const calls: StructuredNoteTask[] = [];
  const result = await classifyNoteRouteWithRunner(
    'I watched a movie',
    9000,
    scriptedRunner({ 'note.area.v1': { area: 'not_an_area', alternativeArea: 'none', confidence: 'high' } }, calls)
  );

  assert.equal(calls.length, 1);
  assert.equal(result.failure, 'error');
  assert.equal(result.raw, null);
  assert.equal(result.suggestedFlowId, null);
});

test('a category outside the offered areas is rejected', async () => {
  const calls: StructuredNoteTask[] = [];
  const result = await classifyNoteRouteWithRunner(
    'I watched a movie',
    9000,
    scriptedRunner(areaThenCategory('media', 'none', 'not.a.route'), calls)
  );

  assert.equal(result.raw, null);
  assert.equal(result.suggestedFlowId, 'studio');
  assert.equal(result.subcategoryConfidence, null);
});

test('model route keys map back onto every catalog entry exactly once', async () => {
  const seen = new Set<string>();
  for (const entry of JOURNAL_CLASSIFICATION_CATALOG) {
    const areaId = journalModelFlowIdForInternalFlow(entry.flowId);
    assert.ok(areaId, `${entry.routeKey} has a model area`);
    const modelKey = `${areaId}.${entry.categoryId.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()}`;
    assert.ok(!seen.has(modelKey), `${modelKey} is unique`);
    seen.add(modelKey);

    const calls: StructuredNoteTask[] = [];
    const result = await classifyNoteRouteWithRunner(
      'a note',
      9000,
      scriptedRunner(areaThenCategory(areaId, 'none', modelKey), calls)
    );
    assert.equal(result.raw?.routeKey, entry.routeKey, `${modelKey} resolves to ${entry.routeKey}`);
    assert.equal(result.suggestedFlowId, entry.flowId);
  }
  assert.equal(seen.size, JOURNAL_CLASSIFICATION_CATALOG.length);
});
