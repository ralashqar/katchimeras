import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canPresentTodayFollowUp,
  initialTodaySurfaceState,
  todaySurfaceReducer,
} from '../features/today/today-surface-state';

test('Today surfaces are exclusive and replacement preserves the new payload', () => {
  const memory = todaySurfaceReducer(initialTodaySurfaceState, {
    type: 'open',
    surface: { kind: 'memory-vault', tab: 'notes' },
  });
  const food = todaySurfaceReducer(memory, { type: 'replace', surface: { kind: 'food-picker' } });

  assert.deepEqual(food.active, { kind: 'food-picker' });
  assert.equal(food.lastCloseReason, 'replaced');
});

test('Memory payload updates without changing the active surface', () => {
  const opened = todaySurfaceReducer(initialTodaySurfaceState, {
    type: 'open',
    surface: { kind: 'memory-vault', tab: 'photos' },
  });
  const updated = todaySurfaceReducer(opened, { type: 'set-memory-tab', tab: 'notes' });

  assert.deepEqual(updated.active, { kind: 'memory-vault', tab: 'notes' });
});

test('Dismissal reasons are retained and follow-ups wait for blocking UI', () => {
  const opened = todaySurfaceReducer(initialTodaySurfaceState, {
    type: 'open',
    surface: { kind: 'sleep' },
  });
  assert.equal(canPresentTodayFollowUp(opened.active), false);

  const closed = todaySurfaceReducer(opened, { type: 'close', reason: 'backdrop' });
  assert.equal(closed.lastCloseReason, 'backdrop');
  assert.equal(canPresentTodayFollowUp(closed.active), true);
});
