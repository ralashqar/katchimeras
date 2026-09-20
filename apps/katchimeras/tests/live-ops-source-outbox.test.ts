import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNativeModule } from './helpers/native-motion-harness';
import type { GameplayEvent } from '@/types/gameplay-event';

function harness() {
  const storage = new Map<string, unknown>();
  const module = loadNativeModule('features/live-ops/source-outbox.ts', {
    '@/utils/app-storage': {
      getStoredJson: (key: string, fallback: unknown) => structuredClone(storage.get(key) ?? fallback),
      setStoredJson: (key: string, value: unknown) => storage.set(key, structuredClone(value)),
    },
  }, { queueMicrotask });
  return { storage, module };
}

test('visitor ownership grants no Harmony facts while personal discoveries still do', async () => {
  const { module } = harness();
  module.saveWithGameplayOutbox('katchimera.wisps.v2', { unlocked: {}, inventory: {} });
  module.saveWithGameplayOutbox('katchimera.wisps.v2', {
    unlocked: { dewdrop: { unlockedAt: 10 }, sprout: { unlockedAt: 11 } },
    inventory: { dewdrop: { sources: ['visitor'] }, sprout: { sources: ['journey'] } },
  });
  const delivered: GameplayEvent[] = [];
  await module.drainGameplaySourceOutboxes(async (events: GameplayEvent[]) => { delivered.push(...events); });
  assert.deepEqual(delivered.map(event => event.context.targetId), ['sprout']);
});

test('source facts baseline historically, retain new actions on failed delivery, and deduplicate acknowledgement', async () => {
  const { storage, module } = harness();
  const key = 'katchadeck.companion-bond-v1';
  const old = { id: 'old', points: 2, occurredAt: 1, creatureId: 'companion:mossprout' };
  storage.set(key, { events: [old] });
  module.saveWithGameplayOutbox(key, { events: [old, { ...old, id: 'new', occurredAt: 2 }] });
  let batch: GameplayEvent[] = [];
  await assert.rejects(module.drainGameplaySourceOutboxes(async (events: GameplayEvent[]) => { batch = events; throw new Error('disk full'); }), /disk full/);
  assert.equal(batch.length, 2);
  assert.equal(batch[0].historical, true);
  assert.equal(batch[1].historical, undefined);
  await module.drainGameplaySourceOutboxes(async (events: GameplayEvent[]) => { assert.equal(events.length, 2); });
  let deliveries = 0;
  await module.drainGameplaySourceOutboxes(async () => { deliveries++; });
  assert.equal(deliveries, 0);
});

test('concurrent source writes are retained while an earlier batch is acknowledged', async () => {
  const { module } = harness();
  const key = 'katchimera.wisps.v2';
  module.saveWithGameplayOutbox(key, { unlocked: { fern: { unlockedAt: 10 } } });
  await module.drainGameplaySourceOutboxes(async () => {
    module.saveWithGameplayOutbox(key, { unlocked: { fern: { unlockedAt: 10 }, sprout: { unlockedAt: 20 } } });
  });
  const delivered: GameplayEvent[] = [];
  await module.drainGameplaySourceOutboxes(async (events: GameplayEvent[]) => { delivered.push(...events); });
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].context.targetId, 'sprout');
});

test('Journey actions contain identifiers and completion time, never private answers or facts', () => {
  const { module } = harness();
  const events = module.sourceGameplayFacts('katchimeras.relationship-progression-v2', { journeyEpisodes: { 'feastle:day-2': { familyId: 'feastle', completedAt: 20, answers: { secret: 'private' }, facts: { photo: 'private' } } } });
  assert.equal(events[0].kind, 'journey_completed');
  assert.equal(events[0].context.companionId, 'feastle');
  assert.ok(!JSON.stringify(events).includes('private'));
});
