import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeFtueInteractionKey, MergeFtueInteractionCoordinator } from '@/features/onboarding/merge-ftue-interaction-coordinator';
test('Merge FTUE command lease ends with the synchronous narrative commit', () => {
  const coordinator = new MergeFtueInteractionCoordinator('session-b');
  const token = coordinator.begin('merge.energy.finish_seed', 11);
  assert.ok(token);
  assert.equal(coordinator.leased, true);
  assert.equal(coordinator.begin('duplicate', 11), null);
  assert.equal(coordinator.complete(token), true);
  assert.equal(coordinator.phase, 'ready');
  assert.equal(coordinator.leased, false);
  assert.ok(coordinator.begin('second-tap-before-animation-settles', 12));
});

test('tokens from a disposed or previous board session cannot release the active session', () => {
  const oldCoordinator = new MergeFtueInteractionCoordinator('session-a');
  const oldToken = oldCoordinator.begin('merge.energy.finish_seed', 11);
  assert.ok(oldToken);
  oldCoordinator.dispose();
  assert.equal(oldCoordinator.complete(oldToken), false);
  assert.equal(oldCoordinator.phase, 'disposed');
  assert.equal(oldCoordinator.leased, true);
  assert.equal(oldCoordinator.begin('stale-command', 12), null);

  const current = new MergeFtueInteractionCoordinator('session-b');
  const currentToken = current.begin('merge.energy.finish_seed', 11);
  assert.ok(currentToken);
  assert.equal(current.complete(oldToken), false);
  assert.equal(current.phase, 'command_running');
  assert.equal(current.complete(currentToken), true);
});

test('failed commands release their lease synchronously', () => {
  const coordinator = new MergeFtueInteractionCoordinator('session-a');
  const token = coordinator.begin('merge.seed_spawn', 2);
  assert.ok(token);
  assert.equal(coordinator.abort(token), true);
  assert.equal(coordinator.phase, 'ready');
  assert.ok(coordinator.begin('merge.seed_spawn', 2));
});

test('multi-count progress does not remount the interaction gate', () => {
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
  assert.equal(firstGate, secondGate);
  assert.notEqual(firstGate, mergeFtueInteractionKey({ ...baseRun, stepId: 'merge.energy.first_sprout' }, true));
});

test('stale command tokens cannot complete a newer transaction', () => {
  const coordinator = new MergeFtueInteractionCoordinator('session-a');
  const first = coordinator.begin('merge.energy.spawn_pair', 11);
  assert.ok(first);
  assert.equal(coordinator.complete(first), true);
  const second = coordinator.begin('merge.energy.spawn_pair', 12);
  assert.ok(second);
  assert.equal(coordinator.complete(first), false);
  assert.equal(coordinator.phase, 'command_running');
  assert.equal(coordinator.complete(second), true);
});
