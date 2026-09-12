import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNativeModule } from './helpers/native-motion-harness';
import * as script from '@/features/onboarding/mossprout-ftue-script';
import * as migrationPolicy from '@/features/onboarding/ftue-migration-policy';
import * as navigationPolicy from '@/features/onboarding/ftue-navigation-policy';

/** The legacy FTUE runtime over a Map, with the journal and relationship side effects stubbed. */
function loadRuntime() {
  const storage = new Map<string, unknown>();
  const flowDispatches: string[] = [];
  return { storage, flowDispatches, runtime: loadNativeModule('features/onboarding/ftue-runtime.ts', {
    react: { useSyncExternalStore: () => null },
    './mossprout-ftue-script': script,
    './ftue-migration-policy': migrationPolicy,
    './ftue-navigation-policy': navigationPolicy,
    '@/utils/client-id': { createClientId: (prefix: string) => `${prefix}-test` },
    '@/utils/app-storage': {
      getStoredJson: (key: string, fallback: unknown) => storage.has(key) ? storage.get(key) : fallback,
      setStoredJson: (key: string, value: unknown) => { storage.set(key, JSON.parse(JSON.stringify(value))); },
      setStoredJsonDeferred: (key: string, value: unknown) => { storage.set(key, JSON.parse(JSON.stringify(value))); },
      flushDeferredStoredWrites: () => {},
    },
    '@/features/content-flow/ftue-content-flow-runtime': {
      dismissFtueContentFlow: async () => undefined,
      dispatchFtueActionToContentFlow: async (_run: unknown, actionId: string) => { flowDispatches.push(`action:${actionId}`); },
      dispatchFtueEventToContentFlow: async (_run: unknown, event: { type: string }) => { flowDispatches.push(`event:${event.type}`); },
    },
    '@/game/katchimeras/action-runtime': { completeDayOneLesson: (state: unknown) => state },
    '@/storage/repositories/relationship-progression-repository': { relationshipProgressionRepository: { update() {} } },
    './ftue-sync': { scheduleFtueReceiptSync() {} },
  }, { process: { env: {} } }) as unknown as {
    beginFtueRun: (options?: { restart?: boolean }) => unknown;
    jumpFtueToStep: (stepId: string) => unknown;
    dispatchFtueEvent: (event: unknown) => { stepId: string } | null;
    loadFtueRun: () => { stepId: string; receipts: { stepId: string }[]; objectiveProgress: Record<string, number> } | null;
    repairFtueStep: (expected: string, target: string, options?: { clearStepIds?: readonly string[] }) => { stepId: string; receipts: unknown[]; objectiveProgress: Record<string, number> } | null;
  } };
}

const sprout = (revision: number) => ({ type: 'merge_completed', fromInstanceId: `a${revision}`, targetInstanceId: `b${revision}`, resultDefinitionId: 'nature:garden:2', resultCell: revision, revision });

test('rewinding the merge lesson clears the beats it will replay, so their edges fire again', () => {
  const { runtime } = loadRuntime();
  runtime.beginFtueRun({ restart: true });
  runtime.jumpFtueToStep('merge.seed_drag');
  // Play the first two beats for real; the run now holds committed receipts for both.
  assert.equal(runtime.dispatchFtueEvent(sprout(1))!.stepId, 'merge.second_seed_drag');
  assert.equal(runtime.dispatchFtueEvent(sprout(2))!.stepId, 'merge.first_bloom');
  const before = runtime.loadFtueRun()!;
  // Sandbox arrays carry another realm's prototype; compare by value.
  assert.equal(before.receipts.map((receipt) => receipt.stepId).join(','), 'merge.seed_drag,merge.second_seed_drag');

  // The board write for both merges was lost: the board still shows four Seeds.
  const rewound = runtime.repairFtueStep('merge.first_bloom', 'merge.seed_drag', { clearStepIds: ['merge.second_seed_drag', 'merge.first_bloom', 'merge.serve_sprout'] })!;
  assert.equal(rewound.stepId, 'merge.seed_drag');
  assert.equal(rewound.receipts.length, 0, 'every replayed beat lost its receipt, not only the target');
  assert.equal(Object.keys(rewound.objectiveProgress).length, 0);

  // Without the clear, the second merge would hit its stale receipt and never advance.
  assert.equal(runtime.dispatchFtueEvent(sprout(3))!.stepId, 'merge.second_seed_drag');
  assert.equal(runtime.dispatchFtueEvent(sprout(4))!.stepId, 'merge.first_bloom');
  assert.equal(runtime.dispatchFtueEvent({ ...sprout(5), resultDefinitionId: 'nature:garden:3' })!.stepId, 'merge.serve_sprout');
});

test('a stale receipt on a replayed beat blocks progress (the bug the clear exists for)', () => {
  const { runtime } = loadRuntime();
  runtime.beginFtueRun({ restart: true });
  runtime.jumpFtueToStep('merge.seed_drag');
  runtime.dispatchFtueEvent(sprout(1));
  runtime.dispatchFtueEvent(sprout(2));
  runtime.repairFtueStep('merge.first_bloom', 'merge.seed_drag');
  runtime.dispatchFtueEvent(sprout(3));
  assert.equal(runtime.loadFtueRun()!.stepId, 'merge.second_seed_drag');
  runtime.dispatchFtueEvent(sprout(4));
  assert.equal(runtime.loadFtueRun()!.stepId, 'merge.second_seed_drag', 'target-only clearing leaves the next beat stuck');
});

test('repair only applies to the step the caller observed', () => {
  const { runtime } = loadRuntime();
  runtime.beginFtueRun({ restart: true });
  runtime.jumpFtueToStep('merge.second_seed_drag');
  const unchanged = runtime.repairFtueStep('merge.first_bloom', 'merge.seed_drag', { clearStepIds: ['merge.first_bloom'] })!;
  assert.equal(unchanged.stepId, 'merge.second_seed_drag');
});
