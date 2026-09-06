import assert from 'node:assert/strict';
import test from 'node:test';

import { reduceActionPresentationController } from '../hooks/use-action-presentation';

test('presentation controller settles without an awaiting-source or global-lock phase', () => {
  const idle = { id: null, phase: 'idle' as const, revealingSlotId: null };
  const animating = reduceActionPresentationController(idle, { type: 'present', id: 'one' });
  assert.deepEqual(animating, { id: 'one', phase: 'animating', revealingSlotId: null });
  const revealing = reduceActionPresentationController(animating, { type: 'finish', id: 'one', slotId: 'together' });
  assert.deepEqual(revealing, { id: null, phase: 'revealing', revealingSlotId: 'together' });
  assert.deepEqual(reduceActionPresentationController(revealing, { type: 'reveal_finished', id: 'together' }), idle);
});

test('late animation callbacks and replacement presentations are idempotent', () => {
  const animating = { id: 'one', phase: 'animating' as const, revealingSlotId: null };
  assert.equal(reduceActionPresentationController(animating, { type: 'finish', id: 'other', slotId: 'field' }), animating);
  assert.equal(reduceActionPresentationController(animating, { type: 'present', id: 'two' }), animating);
  const revealing = reduceActionPresentationController(animating, { type: 'finish', id: 'one', slotId: 'field' });
  assert.deepEqual(reduceActionPresentationController(revealing, { type: 'finish', id: 'one', slotId: 'field' }), revealing);
});

test('presentation can finish cleanly when no replacement is available', () => {
  const animating = { id: 'one', phase: 'animating' as const, revealingSlotId: null };
  assert.deepEqual(
    reduceActionPresentationController(animating, { type: 'finish', id: 'one', slotId: null }),
    { id: null, phase: 'idle', revealingSlotId: null },
  );
});
