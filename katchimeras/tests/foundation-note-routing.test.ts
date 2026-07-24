import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyNoteRouteWithRunner,
  type StructuredNoteTask,
  type StructuredNoteTaskRunner,
} from '@/utils/foundation-note-routing';

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

test('strict Foundation routing rereads a movie note in an independent studio subcategory pass', async () => {
  const calls: StructuredNoteTask[] = [];
  const result = await classifyNoteRouteWithRunner(
    'I watched X movie',
    9000,
    scriptedRunner({
      'note.flow.v1': { flowId: 'studio', confidence: 'high' },
      'note.child-route.v1': { routeKey: 'studio.film', confidence: 'high' },
    }, calls)
  );

  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.taskId, 'note.flow.v1');
  assert.equal(calls[1]?.taskId, 'note.child-route.v1');
  assert.equal(calls[0]?.sampling, 'greedy');
  assert.equal(calls[1]?.sampling, 'greedy');
  assert.match(calls[1]?.prompt ?? '', /Original note: "I watched X movie"/);
  assert.doesNotMatch(calls[1]?.prompt ?? '', /\bhigh\b/);
  assert.deepEqual(
    calls[1]?.fields.find((field) => field.name === 'routeKey')?.values,
    ['studio.book', 'studio.film', 'studio.show', 'studio.game', 'studio.music', 'studio.podcast', 'studio.art', 'studio.other_media']
  );
  assert.equal(result.raw?.routeKey, 'studio.film');
  assert.equal(result.topLevelConfidence, 'high');
  assert.equal(result.subcategoryConfidence, 'high');
});

test('medium top-level confidence stops before the subcategory pass', async () => {
  const calls: StructuredNoteTask[] = [];
  const result = await classifyNoteRouteWithRunner(
    'A thing happened',
    9000,
    scriptedRunner({
      'note.flow.v1': { flowId: 'general', confidence: 'medium' },
      'note.child-route.v1': { routeKey: 'general.other', confidence: 'high' },
    }, calls)
  );

  assert.equal(calls.length, 1);
  assert.equal(result.raw, null);
  assert.equal(result.suggestedFlowId, 'general');
  assert.equal(result.topLevelConfidence, 'medium');
  assert.equal(result.subcategoryConfidence, null);
});

test('subcategory confidence is preserved independently and never promoted by a high top level', async () => {
  const calls: StructuredNoteTask[] = [];
  const result = await classifyNoteRouteWithRunner(
    'I watched something',
    9000,
    scriptedRunner({
      'note.flow.v1': { flowId: 'studio', confidence: 'high' },
      'note.child-route.v1': { routeKey: 'studio.show', confidence: 'low' },
    }, calls)
  );

  assert.equal(result.topLevelConfidence, 'high');
  assert.equal(result.subcategoryConfidence, 'low');
  assert.equal(result.raw?.routeKey, 'studio.show');
});

test('subcategory output cannot escape the selected top-level section', async () => {
  const calls: StructuredNoteTask[] = [];
  const result = await classifyNoteRouteWithRunner(
    'I watched a movie',
    9000,
    scriptedRunner({
      'note.flow.v1': { flowId: 'studio', confidence: 'high' },
      'note.child-route.v1': { routeKey: 'food.meal', confidence: 'high' },
    }, calls)
  );

  assert.equal(result.failure, 'error');
  assert.equal(result.raw, null);
  assert.equal(result.suggestedFlowId, 'studio');
});
