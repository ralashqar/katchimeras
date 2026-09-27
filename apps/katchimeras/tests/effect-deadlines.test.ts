import assert from 'node:assert/strict';
import test from 'node:test';
import { createEffectDeadlines } from '@/features/encounter/effect-deadlines';

test('one deadline timer batches simultaneous effects, orders earlier hits, and supports cancellation', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const delivered: number[] = [];
  let batches = 0;
  const deadlines = createEffectDeadlines((work) => { batches++; work(); });
  for (let id = 0; id < 160; id++) deadlines.schedule(300, () => delivered.push(id));
  const cancelled = deadlines.schedule(100, () => delivered.push(-1));
  deadlines.cancel(cancelled);
  deadlines.schedule(80, () => delivered.push(-2));
  t.mock.timers.tick(80);
  assert.deepEqual(delivered, [-2]);
  t.mock.timers.tick(220);
  assert.deepEqual(delivered, [-2, ...Array.from({ length: 160 }, (_, id) => id)]);
  assert.equal(batches, 2);
  t.mock.timers.tick(1000);
  assert.equal(batches, 2, 'an empty queue does not keep a timer running');
});

test('disposing in a callback prevents other due hits and a new session can reuse the queue', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const deadlines = createEffectDeadlines();
  const delivered: number[] = [];
  deadlines.schedule(100, () => { delivered.push(1); deadlines.clear(); });
  deadlines.schedule(100, () => delivered.push(2));
  t.mock.timers.tick(100);
  assert.deepEqual(delivered, [1]);
  deadlines.schedule(10, () => delivered.push(3));
  t.mock.timers.tick(10);
  assert.deepEqual(delivered, [1, 3]);
  deadlines.clear();
});
