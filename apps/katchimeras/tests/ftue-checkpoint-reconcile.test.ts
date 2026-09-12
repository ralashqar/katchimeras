import assert from 'node:assert/strict';
import test from 'node:test';
import { MOSSPROUT_FTUE_FLOW } from '@/features/onboarding/mossprout-ftue-flow';
import { MOSSPROUT_FTUE_SCRIPT } from '@/features/onboarding/mossprout-ftue-script';
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

/** Every task node on the shipping path with the legacy receipt that proves it. */
const TASK_COMMITS: Record<string, string> = Object.fromEntries(MOSSPROUT_FTUE_FLOW.nodes
  .filter((node) => node.kind === 'task')
  .map((node) => [node.id, MOSSPROUT_FTUE_SCRIPT.steps.find((step) => step.id === node.id)?.edges?.[0]?.commitActionId ?? node.id]));
const taskCount = (nodeId: string) => {
  const node = MOSSPROUT_FTUE_FLOW.nodes.find((candidate) => candidate.id === nodeId);
  return node?.kind === 'task' ? node.requirements.reduce((total, requirement) => total + (requirement.count ?? 1), 0) : 0;
};

function ftueAt(runId: string, stepId: string, completedSteps: readonly string[]): FtueRunState {
  const now = new Date(1_000).toISOString();
  return {
    schemaVersion: 6, runId, scriptId: MOSSPROUT_FTUE_SCRIPT.id, scriptVersion: MOSSPROUT_FTUE_SCRIPT.version, stepId, status: 'active',
    startedAt: now, updatedAt: now, completedAt: null, answers: {}, mergeInstalled: true, awardedMergeEnergy: null, objectiveProgress: {},
    receipts: completedSteps.map((step) => ({
      clientEventId: `${runId}:${TASK_COMMITS[step]}`, actionId: TASK_COMMITS[step], stepId: step, scriptId: MOSSPROUT_FTUE_SCRIPT.id, scriptVersion: MOSSPROUT_FTUE_SCRIPT.version,
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

test('a checkpoint that outran the journal replays every task it proves, counted requirements included, then waits at the next scene work', async () => {
  // The Chapter 0 request is gone (the first restore is paid with granted light): the mist clear is the flow's task.
  assert.equal(MOSSPROUT_FTUE_FLOW.nodes.some((node) => node.id === 'merge.serve_sprout'), false, 'no Merge visit before the first restore: the profile starts with its Glow');
  assert.equal(taskCount('world.mist_clear'), 7, 'the opening counts seven merges');
  const ftue = ftueAt('ftue-ahead', 'world.mist_lift', ['world.mist_clear']);
  await parkFlowAt(ftue.runId, 'world.mist_clear');
  const run = await runtime.reconcileFtueCheckpoint(ftue);
  assert.equal(run.status, 'active');
  assert.equal(run.nodeId, 'world.mist_lift', 'the clear replayed in full; the lift is the Kingdom screen’s to acknowledge');
  assert.equal([...events].filter((id) => id.includes(':reconcile:')).length, 7);
  const again = await runtime.reconcileFtueCheckpoint(ftue);
  assert.equal(again.nodeId, run.nodeId, 'reconcile is idempotent');
});

test('every counted task on the shipping path is replayed in full when the checkpoint is past it', async () => {
  const counted = MOSSPROUT_FTUE_FLOW.nodes.filter((node) => node.kind === 'task' && node.requirements.some((requirement) => (requirement.count ?? 1) > 1));
  for (const node of counted) {
    const after = MOSSPROUT_FTUE_FLOW.nodes[MOSSPROUT_FTUE_FLOW.nodes.findIndex((candidate) => candidate.id === node.id) + 1]!;
    const ftue = ftueAt(`ftue-counted-${node.id}`, after.id, [node.id]);
    await parkFlowAt(ftue.runId, node.id);
    const run = await runtime.reconcileFtueCheckpoint(ftue);
    assert.notEqual(run.nodeId, node.id, `${node.id}: a partially replayed counted task would park the flow forever`);
    assert.equal([...events].filter((id) => id.startsWith(`ftue:${ftue.runId}:${node.id}:`)).length, taskCount(node.id));
  }
});

test('replay stops exactly at the checkpoint and never fabricates evidence the checkpoint does not prove', async () => {
  const inStep = ftueAt('ftue-in-step', 'world.mist_clear', []);
  await parkFlowAt(inStep.runId, 'world.mist_clear');
  const unchanged = await runtime.reconcileFtueCheckpoint(inStep);
  assert.equal(unchanged.nodeId, 'world.mist_clear');
  assert.equal(unchanged.phase, 'awaiting_event');

  // A rewound checkpoint (board write lost) sits before the flow; the flow
  // waits where it is and the live merges catch it up.
  const behind = ftueAt('ftue-behind', 'world.mist_open', []);
  await parkFlowAt(behind.runId, 'world.mist_clear');
  const parked = await runtime.reconcileFtueCheckpoint(behind);
  assert.equal(parked.nodeId, 'world.mist_clear');
  assert.equal([...events].filter((id) => id.startsWith('ftue:ftue-behind')).length, 0);
});
