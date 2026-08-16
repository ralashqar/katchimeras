import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeFtueInteractionKey, MergeFtueInteractionCoordinator } from '@/features/onboarding/merge-ftue-interaction-coordinator';
import type { FtueEvent } from '@/features/onboarding/ftue-types';

const EVENT: FtueEvent = {
  type: 'item_spawned',
  definitionId: 'nature:garden:1',
  generatorId: 'wild-garden',
  instanceId: 'spawned-seed',
  resultCell: 4,
  revision: 12,
};

test('Merge FTUE command remains leased until the replacement gate commits', () => {
  const coordinator = new MergeFtueInteractionCoordinator('session-b');
  const token = coordinator.begin('merge.energy.finish_seed', 11);
  assert.ok(token);
  assert.equal(coordinator.leased, true);
  assert.equal(coordinator.begin('duplicate', 11), null);
  assert.equal(coordinator.recordEvent(token, EVENT), true);
  const transaction = coordinator.settle({ operationId: 7, revision: 12, sessionId: 'session-b' });
  assert.deepEqual(transaction, { event: EVENT, token });
  assert.equal(coordinator.phase, 'advancing');
  assert.equal(coordinator.awaitGate(token, 'run:next:active'), true);
  assert.equal(coordinator.leased, true);
  assert.equal(coordinator.acknowledgeGate({ interactionKey: 'run:old:active', sessionId: 'session-b' }), false);
  assert.equal(coordinator.acknowledgeGate({ interactionKey: 'run:next:active', sessionId: 'session-b' }), true);
  assert.equal(coordinator.phase, 'ready');
  assert.equal(coordinator.leased, false);
});

test('callbacks from a disposed or previous board session cannot advance the active session', () => {
  const oldCoordinator = new MergeFtueInteractionCoordinator('session-a');
  const oldToken = oldCoordinator.begin('merge.energy.finish_seed', 11);
  assert.ok(oldToken);
  assert.equal(oldCoordinator.recordEvent(oldToken, EVENT), true);
  oldCoordinator.dispose();
  assert.equal(oldCoordinator.settle({ operationId: 1, revision: 12, sessionId: 'session-a' }), null);
  assert.equal(oldCoordinator.phase, 'disposed');
  assert.equal(oldCoordinator.leased, true);
  assert.equal(oldCoordinator.begin('stale-command', 12), null);

  const current = new MergeFtueInteractionCoordinator('session-b');
  const currentToken = current.begin('merge.energy.finish_seed', 11);
  assert.ok(currentToken);
  assert.equal(current.recordEvent(currentToken, EVENT), true);
  assert.equal(current.settle({ operationId: 1, revision: 12, sessionId: 'session-a' }), null);
  assert.equal(current.phase, 'command_running');
  assert.ok(current.settle({ operationId: 2, revision: 12, sessionId: 'session-b' }));
});

test('failed commands release their lease synchronously', () => {
  const coordinator = new MergeFtueInteractionCoordinator('session-a');
  const token = coordinator.begin('merge.seed_spawn', 2);
  assert.ok(token);
  assert.equal(coordinator.abort(token), true);
  assert.equal(coordinator.phase, 'ready');
  assert.ok(coordinator.begin('merge.seed_spawn', 2));
});

test('multi-count progress creates a new interaction gate without changing FTUE step', () => {
  const baseRun = {
    runId: 'run-a',
    stepId: 'merge.energy.spawn_pair',
    objectiveProgress: {},
  };
  const firstGate = mergeFtueInteractionKey(baseRun, true);
  const secondGate = mergeFtueInteractionKey({
    ...baseRun,
    objectiveProgress: { 'merge.energy.spawn_pair:merge.energy.spawn_pair': 1 },
  }, true);
  assert.notEqual(firstGate, secondGate);
  assert.equal(
    secondGate,
    mergeFtueInteractionKey({
      ...baseRun,
      objectiveProgress: { 'merge.energy.spawn_pair:merge.energy.spawn_pair': 1 },
    }, true),
  );
});

test('a replacement gate committed during synchronous FTUE publication is consumed after advancement', () => {
  const coordinator = new MergeFtueInteractionCoordinator('session-a');
  const token = coordinator.begin('merge.energy.spawn_pair', 11);
  assert.ok(token);
  assert.equal(coordinator.recordEvent(token, EVENT), true);
  assert.ok(coordinator.settle({ operationId: 3, revision: 12, sessionId: 'session-a' }));

  // useSyncExternalStore can synchronously commit the next board props before
  // dispatchFtueEvent returns and awaitGate has installed its expected key.
  assert.equal(coordinator.acknowledgeGate({
    interactionKey: 'run-a:merge.energy.first_sprout:complete:active',
    sessionId: 'session-a',
  }), false);
  assert.equal(coordinator.phase, 'advancing');

  assert.equal(coordinator.awaitGate(token, 'run-a:merge.energy.first_sprout:complete:active'), true);
  assert.equal(coordinator.phase, 'ready');
  assert.equal(coordinator.leased, false);
});
