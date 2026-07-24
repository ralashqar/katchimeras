import assert from 'node:assert/strict';
import test from 'node:test';

import { JOURNAL_ROUTE_KEYS } from '@/utils/journal-classification-catalog';
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

test('Foundation note routing chooses an atomic category in one concise pass', async () => {
  const calls: StructuredNoteTask[] = [];
  const result = await classifyNoteRouteWithRunner(
    'I watched X movie',
    9000,
    scriptedRunner({
      'note.atomic-route.v3': { routeKey: 'studio.film', confidence: 'high' },
    }, calls)
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.taskId, 'note.atomic-route.v3');
  assert.equal(calls[0]?.sampling, 'greedy');
  assert.deepEqual(
    calls[0]?.fields.find((field) => field.name === 'routeKey')?.values,
    JOURNAL_ROUTE_KEYS
  );
  assert.equal(result.raw?.routeKey, 'studio.film');
  assert.equal(result.raw?.routeStrategy, 'atomic_single_pass_v3');
  assert.equal(result.suggestedFlowId, 'studio');
  assert.equal(result.topLevelResponse?.derivedFrom, 'atomic_route');
  assert.equal(result.topLevelConfidence, 'high');
  assert.equal(result.subcategoryConfidence, 'high');
});

test('atomic prompt distinguishes relationship play from video games', async () => {
  const calls: StructuredNoteTask[] = [];
  const result = await classifyNoteRouteWithRunner(
    'I played Lego with son',
    9000,
    scriptedRunner({
      'note.atomic-route.v3': { routeKey: 'people.my_child', confidence: 'high' },
    }, calls)
  );

  const task = calls[0];
  assert.equal(calls.length, 1);
  assert.match(task?.prompt ?? '', /^Note: "I played Lego with son"/);
  assert.match(task?.prompt ?? '', /^people\.my_child:/m);
  assert.match(task?.prompt ?? '', /^studio\.game:/m);
  assert.match(task?.instructions ?? '', /not toys, building sets or board games/i);
  assert.doesNotMatch(task?.prompt ?? '', /\bExamples:/);
  assert.ok((task?.instructions.length ?? Infinity) < 600);
  assert.ok((task?.prompt.length ?? Infinity) < 8000);
  assert.equal(result.raw?.routeKey, 'people.my_child');
  assert.equal(result.suggestedFlowId, 'people');
});

test('medium atomic confidence returns a candidate without auto-resolving it', async () => {
  const calls: StructuredNoteTask[] = [];
  const result = await classifyNoteRouteWithRunner(
    'I watched something',
    9000,
    scriptedRunner({
      'note.atomic-route.v3': { routeKey: 'studio.show', confidence: 'medium' },
    }, calls)
  );

  assert.equal(calls.length, 1);
  assert.equal(result.raw?.routeKey, 'studio.show');
  assert.equal(result.suggestedFlowId, 'studio');
  assert.equal(result.topLevelConfidence, 'medium');
  assert.equal(result.subcategoryConfidence, 'medium');
});

test('atomic output must be a known category', async () => {
  const calls: StructuredNoteTask[] = [];
  const result = await classifyNoteRouteWithRunner(
    'I watched a movie',
    9000,
    scriptedRunner({
      'note.atomic-route.v3': { routeKey: 'not.a.route', confidence: 'high' },
    }, calls)
  );

  assert.equal(result.failure, 'error');
  assert.equal(result.raw, null);
  assert.equal(result.suggestedFlowId, null);
});
