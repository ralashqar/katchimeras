import assert from 'node:assert/strict';
import test from 'node:test';
import { createContentFlowRun, stabilizeContentFlow } from '@/features/content-flow/content-flow-interpreter';
import type { ContentFlowDefinition, ContentFlowRun } from '@/types/content-flow';

// Exercise the real repository against an in-memory SQLite boundary. Native
// database timing still needs device profiling; SQL writes/notifications do not.
test('repeated no-op resumes and duplicate events do not write or notify subscribers', async () => {
  const rows = new Map<string, string>();
  const events = new Set<string>();
  let writes = 0;
  let receiptInserts = 0;
  const db = {
    async execAsync() {},
    async withTransactionAsync(work: () => Promise<void>) { await work(); },
    async getFirstAsync(sql: string, params: string[]) {
      if (sql.includes('content_flow_events')) return events.has(params[0]) ? { event_id: params[0] } : null;
      const json = rows.get(params[0]);
      return json ? { run_json: json } : null;
    },
    async runAsync(sql: string, params: (string | number | null)[]) {
      writes++;
      if (sql.includes('INSERT INTO content_flow_runs')) rows.set(String(params[0]), String(params[8]));
      if (sql.includes('INTO content_flow_events')) events.add(String(params[0]));
      if (sql.includes('INTO content_flow_effect_receipts')) receiptInserts++;
    },
  };
  const sqlitePath = require.resolve('expo-sqlite');
  const previous = require.cache[sqlitePath];
  require.cache[sqlitePath] = { exports: { openDatabaseAsync: async () => db } } as NodeModule;
  const repository = require('../features/content-flow/content-flow-repository') as typeof import('../features/content-flow/content-flow-repository');
  const definition: ContentFlowDefinition = {
    id: 'test:resume', version: 1, entryNodeId: 'wait', nodes: [
      { id: 'wait', kind: 'scene', capability: 'story.conversation', surface: 'companion', sceneId: 'wait', actions: [{ id: 'next', next: 'done' }] },
      { id: 'done', kind: 'complete' },
    ],
  };
  let notifications = 0;
  const unsubscribe = repository.subscribeContentFlowJournal(() => { notifications++; });
  try {
    const run = stabilizeContentFlow(definition, createContentFlowRun(definition, { runId: 'test', now: 1 }), 2).run;
    run.effectReceipts['test:wait:effect:old'] = { completedAt: 1 };
    await repository.saveContentFlowTransition(run);
    writes = 0;
    receiptInserts = 0;
    notifications = 0;
    for (let cycle = 0; cycle < 30; cycle++) {
      const result = await repository.reduceContentFlowRunAtomically({
        runId: run.runId, reduce: (current) => stabilizeContentFlow(definition, current, cycle + 10).run,
      });
      assert.equal(result.run?.revision, run.revision);
      assert.equal(result.run?.updatedAt, run.updatedAt);
    }
    await repository.reduceContentFlowRunAtomically({ runId: run.runId, reduce: (current) => ({ ...current }) });
    assert.equal(writes, 0);
    assert.equal(notifications, 0);
    const event = { eventId: 'event:1', type: 'test.event', runId: run.runId, nodeId: 'wait', occurredAt: 10, payload: {} };
    const changed = await repository.reduceContentFlowRunAtomically({ runId: run.runId, event, reduce: (current) => ({
      ...current, variables: { answer: 'yes' }, effectReceipts: { ...current.effectReceipts, 'test:wait:effect:new': { completedAt: 10 } },
    }) });
    assert.equal(changed.run?.revision, run.revision + 1);
    assert.equal(changed.eventRecorded, true);
    assert.equal(receiptInserts, 1, 'only the new receipt is inserted');
    assert.equal(notifications, 1);
    const written = writes;
    await repository.reduceContentFlowRunAtomically({ runId: run.runId, event, reduce: () => assert.fail('duplicate reducer') });
    assert.equal(writes, written);
    assert.equal(notifications, 1);
    await repository.reduceContentFlowRunAtomically({ runId: run.runId, reduce: (current): ContentFlowRun => ({ ...current, status: 'completed', phase: 'completed' }) });
    writes = 0;
    notifications = 0;
    for (let cycle = 0; cycle < 30; cycle++) {
      await repository.reduceContentFlowRunAtomically({ runId: run.runId, reduce: (current) => current.status === 'completed' ? current : { ...current, status: 'completed' } });
    }
    assert.equal(writes, 0, 'already dismissed FTUE is not rewritten');
    assert.equal(notifications, 0);
  } finally {
    unsubscribe();
    if (previous) require.cache[sqlitePath] = previous;
    else delete require.cache[sqlitePath];
  }
});
