import assert from 'node:assert/strict';
import test from 'node:test';
import { MOSSPROUT_FTUE_FLOW } from '@/features/onboarding/mossprout-ftue-flow';
import type { FtueRunState } from '@/features/onboarding/ftue-types';
import { createContentFlowRun, stabilizeContentFlow } from '@/features/content-flow/content-flow-interpreter';

// The real journal repository over an in-memory SQLite boundary, so the real
// director, interpreter and manifest drive the reconcile exactly as on device.
const rows = new Map<string, string>();
const events = new Set<string>();
const db = {
  async execAsync() {},
  async withTransactionAsync(work: () => Promise<void>) { await work(); },
  async getFirstAsync(sql: string, params: string[]) {
    if (sql.includes('content_flow_events')) return events.has(params[0]) ? { event_id: params[0] } : null;
    const json = rows.get(params[0]);
    return json ? { run_json: json } : null;
  },
  async getAllAsync() { return [...rows.values()].map((run_json) => ({ run_json })); },
  async runAsync(sql: string, params: (string | number | null)[]) {
    if (sql.includes('INSERT INTO content_flow_runs')) rows.set(String(params[0]), String(params[8]));
    if (sql.includes('INTO content_flow_events')) events.add(String(params[0]));
  },
};
const sqlitePath = require.resolve('expo-sqlite');
require.cache[sqlitePath] = { exports: { openDatabaseAsync: async () => db } } as NodeModule;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const repository = require('../features/content-flow/content-flow-repository') as typeof import('../features/content-flow/content-flow-repository');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const runtime = require('../features/content-flow/ftue-content-flow-runtime') as typeof import('../features/content-flow/ftue-content-flow-runtime');

const MERGE_STEPS = ['merge.seed_drag', 'merge.second_seed_drag', 'merge.first_bloom', 'merge.serve_sprout'] as const;
const COMMIT_ACTIONS: Record<string, string> = {
  'merge.seed_drag': 'merge.create_sprout', 'merge.second_seed_drag': 'merge.create_second_sprout',
  'merge.first_bloom': 'merge.create_first_bloom', 'merge.serve_sprout': 'merge.serve_sprout',
};

function ftueAt(runId: string, stepId: string, completedSteps: readonly string[]): FtueRunState {
  const now = new Date(1_000).toISOString();
  return {
    schemaVersion: 6, runId, scriptId: 'mossprout-first-session', scriptVersion: 48, stepId, status: 'active',
    startedAt: now, updatedAt: now, completedAt: null, answers: {}, mergeInstalled: true, awardedMergeEnergy: null, objectiveProgress: {},
    receipts: completedSteps.map((step) => ({
      clientEventId: `${runId}:${COMMIT_ACTIONS[step]}`, actionId: COMMIT_ACTIONS[step], stepId: step, scriptId: 'mossprout-first-session', scriptVersion: 48,
      surface: 'merge', status: 'committed', startedAt: now, committedAt: now, presentedAt: null, evidenceRef: null, syncAttempts: 0, syncedAt: null,
    })),
  };
}

async function parkFlowAt(runId: string, nodeId: string) {
  const run = stabilizeContentFlow(MOSSPROUT_FTUE_FLOW, {
    ...createContentFlowRun(MOSSPROUT_FTUE_FLOW, { runId: `flow:${runId}`, variables: { ftueRunId: runId }, now: 1_000 }),
    nodeId, phase: 'entering',
  }, 1_000).run;
  assert.equal(run.phase, 'awaiting_event');
  await repository.saveContentFlowTransition(run);
  return run;
}

test('a checkpoint that outran the journal replays every task it proves, then waits at the next scene work', async () => {
  const ftue = ftueAt('ftue-ahead', 'world.first_bloom_offer', MERGE_STEPS);
  await parkFlowAt(ftue.runId, 'merge.seed_drag');
  const run = await runtime.reconcileFtueCheckpoint(ftue);
  assert.equal(run.status, 'active');
  assert.equal(run.nodeId, 'garden.first-bloom-offer.focus', 'all four merge tasks replayed; the camera beat is the Kingdom screen’s to acknowledge');
  assert.equal([...events].filter((id) => id.includes(':reconcile:')).length, 4);
  const again = await runtime.reconcileFtueCheckpoint(ftue);
  assert.equal(again.nodeId, run.nodeId, 'reconcile is idempotent');
});

test('replay stops exactly at the checkpoint and never fabricates evidence the checkpoint does not prove', async () => {
  const partial = ftueAt('ftue-partial', 'merge.second_seed_drag', ['merge.seed_drag']);
  await parkFlowAt(partial.runId, 'merge.seed_drag');
  const run = await runtime.reconcileFtueCheckpoint(partial);
  assert.equal(run.nodeId, 'merge.second_seed_drag');
  assert.equal(run.phase, 'awaiting_event');

  const inStep = ftueAt('ftue-in-step', 'merge.seed_drag', []);
  await parkFlowAt(inStep.runId, 'merge.seed_drag');
  const unchanged = await runtime.reconcileFtueCheckpoint(inStep);
  assert.equal(unchanged.nodeId, 'merge.seed_drag');

  // A rewound checkpoint (board write lost) sits before the flow; the flow
  // waits where it is and the live merge catches it up.
  const behind = ftueAt('ftue-behind', 'merge.seed_drag', []);
  await parkFlowAt(behind.runId, 'merge.first_bloom');
  const parked = await runtime.reconcileFtueCheckpoint(behind);
  assert.equal(parked.nodeId, 'merge.first_bloom');
  assert.equal([...events].filter((id) => id.startsWith('ftue:ftue-behind')).length, 0);
});
