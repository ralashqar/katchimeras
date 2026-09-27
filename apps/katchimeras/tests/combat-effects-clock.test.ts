import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceCombatEffects, type CombatEffect } from '@/features/encounter/combat-effects-clock';

const shot = (id: number, overrides: Partial<CombatEffect> = {}): CombatEffect => ({
  id, kind: 'bullet', tone: 0, from: { x: 0, y: 0 }, to: { x: 10, y: 10 }, size: 20,
  delay: 0, duration: 400, miss: false, start: 0, impacted: false, ...overrides,
});
test('overflow beyond the 64 visual slots delivers every arrival exactly once', () => {
  const events = Array.from({ length: 160 }, (_, i) => shot(i));
  const messages = [100, 400, 400, 600, 1000].flatMap((clock) => advanceCombatEffects(events, clock));
  assert.equal(new Set(messages.filter((m) => !m.done).map((m) => m.id)).size, 160);
  assert.equal(messages.filter((m) => !m.done).length, 160);
  assert.equal(messages.filter((m) => m.done).length, 160);
  assert.equal(events.length, 0);
});
test('a paused clock does not advance effects or repeat impacts', () => {
  const events = [shot(1, { delay: 200 })];
  assert.deepEqual(advanceCombatEffects(events, 500), []);
  assert.deepEqual(advanceCombatEffects(events, 500), []);
  assert.deepEqual(advanceCombatEffects(events, 600), [{ id: 1, done: false }]);
  assert.deepEqual(advanceCombatEffects(events, 600), []);
});
test('a delayed frame delivers impact before retirement, for lightning and misses too', () => {
  for (const overrides of [{}, { kind: 'lightning' as const }, { miss: true }]) {
    const events = [shot(1, overrides)];
    assert.deepEqual(advanceCombatEffects(events, 2000), [{ id: 1, done: false }, { id: 1, done: true }]);
    assert.deepEqual(events, []);
  }
});
