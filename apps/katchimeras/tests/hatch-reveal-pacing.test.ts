import { sharedEggZoom } from '@incubator/environments/resident-presentation';
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNativeModule } from './helpers/native-motion-harness';
import * as timing from '@incubator/environments/upgrade-presentation';

test('mission reveal skips the empty payment window and retains ordered reveal before completion', () => {
  const scheduled: { callback: () => void; delay: number }[] = [];
  const phases: string[] = [];
  const { playUpgradeSequence } = loadNativeModule('../../packages/environments/src/upgrade-sequence.ts', {
    './upgrade-presentation': timing,
  }, {
    setTimeout: (callback: () => void, delay: number) => { scheduled.push({ callback, delay }); return scheduled.length; },
    clearTimeout: () => {},
  });
  playUpgradeSequence({ reduced: false, quickReveal: true, focus: (done: () => void) => done(),
    onPhase: (phase: string) => phases.push(phase), onComplete: () => phases.push('complete') });
  assert.deepEqual(phases, ['focus', 'cover']);
  assert.deepEqual(scheduled.map((item) => item.delay), [200, 730, 1100]);
  scheduled.forEach((item) => item.callback());
  assert.deepEqual(phases, ['focus', 'cover', 'reveal', 'react', 'complete']);
});


test('each answer pulls back from the close-up toward the resting composition', () => {
  assert.equal(sharedEggZoom(0), 3);
  assert.ok(sharedEggZoom(1) < sharedEggZoom(0));
  assert.ok(sharedEggZoom(1) > sharedEggZoom(2));
  assert.ok(Math.abs(sharedEggZoom(2) - 1.95) < 0.001);
  assert.equal(sharedEggZoom(-1), sharedEggZoom(0));
  assert.equal(sharedEggZoom(3), sharedEggZoom(2));
});
