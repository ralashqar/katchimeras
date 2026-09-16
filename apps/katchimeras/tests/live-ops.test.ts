import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { appendGameplayEvents, GAMEPLAY_JOURNAL_SCHEMA } from '@/features/live-ops/journal';
import { activeIncursionNodes, applyHarmonyEvent, emptyEventProgress, emptyHarmony, eventPhase, scoreGameplayEvent } from '@/features/live-ops/rules';
import { mergeWorldPendingPersistence } from '@/utils/merge-world/persistence-buffer';
import { createInitialMergeWorldState } from '@/utils/merge-world/engine';
import { newWorldMilestones } from '@/features/live-ops/merge-events';
import type { GameplayEvent } from '@/types/gameplay-event';
import type { LiveEventDefinition } from '@/types/live-ops';

const now = Date.parse('2026-10-03T12:00:00Z');
const action: GameplayEvent = { version: 1, id: 'restore:1', kind: 'hex_restored', source: 'merge-world', sourceRevision: 3, occurredAt: now, contentRevision: 1, quantity: 1, context: { targetId: 'spring', level: 1 } };
const definition: LiveEventDefinition = {
  id: 'moonlit', version: 1, title: 'Moonlit Mist', description: 'A silver mist', enabled: true,
  startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-10-08T00:00:00Z', claimEndsAt: '2026-10-10T00:00:00Z', minHarmony: 0,
  rules: [{ id: 'restore', kind: 'hex_restored', points: 100, limit: 3 }], tiers: [],
  incursion: { regionId: 'grove', nodes: [{ id: 'node-1', hexId: 'spring', missionId: 'spring-mist' }], keepsakeId: 'observatory' },
};

test('one action advances independent event projections; caps and filters constrain unlimited play', () => {
  const other = { ...definition, id: 'incursion', rules: [{ ...definition.rules[0]!, points: 25 }] };
  assert.equal(scoreGameplayEvent(emptyEventProgress(definition), definition, action).points, 100);
  assert.equal(scoreGameplayEvent(emptyEventProgress(other), other, action).points, 25);
  assert.equal(scoreGameplayEvent(emptyEventProgress(definition), definition, { ...action, quantity: 100 }).points, 300);
  assert.equal(scoreGameplayEvent(emptyEventProgress(definition), definition, { ...action, historical: true }).points, 0);
  assert.equal(scoreGameplayEvent(emptyEventProgress(definition), definition, { ...action, quantity: NaN }).points, 0);
  const filtered = { ...definition, rules: [{ ...definition.rules[0]!, filter: { regionId: 'elsewhere' } }] };
  assert.equal(scoreGameplayEvent(emptyEventProgress(filtered), filtered, action).points, 0);
  assert.throws(() => scoreGameplayEvent(emptyEventProgress(definition), { ...definition, version: 2 }, action), /changed/);
});

test('closure stops incursions and scoring while leaving a separate claim window', () => {
  const close = Date.parse(definition.endsAt);
  assert.equal(eventPhase(definition, close), 'claim');
  assert.equal(scoreGameplayEvent(emptyEventProgress(definition), definition, { ...action, occurredAt: close }).points, 0);
  assert.equal(activeIncursionNodes(definition, new Set(), now).length, 1);
  assert.deepEqual(activeIncursionNodes(definition, new Set(), close), []);
  assert.equal(definition.incursion?.nodes.length, 1, 'permanent definitions are untouched');
});

test('authored rule IDs cannot inherit counters from JavaScript object prototypes', () => {
  for (const id of ['constructor', '__proto__', 'toString']) {
    const authored = { ...definition, rules: [{ ...definition.rules[0]!, id }] };
    const first = scoreGameplayEvent(emptyEventProgress(authored), authored, action);
    assert.equal(first.points, 100);
    const restored = JSON.parse(JSON.stringify(first));
    assert.equal(scoreGameplayEvent(restored, authored, action).points, 200);
  }
});

test('Harmony is earned once per world milestone, even across backfill and new event IDs', () => {
  const first = applyHarmonyEvent(emptyHarmony(), { ...action, historical: true });
  assert.equal(first.points, 25);
  assert.equal(applyHarmonyEvent(first, { ...action, id: 'replayed' }), first);
  assert.equal(applyHarmonyEvent(first, { ...action, kind: 'merge' }), first);
});

test('coalesced board writes retain every action and retry does not multiply receipts', () => {
  const state = createInitialMergeWorldState(now);
  const one = mergeWorldPendingPersistence(null, state, [], [action]);
  const two = mergeWorldPendingPersistence(one, { ...state, revision: state.revision + 1 }, [], [{ ...action, id: 'restore:2' }]);
  const retry = mergeWorldPendingPersistence(two, state, [], [action]);
  assert.deepEqual(retry.gameplayEvents.map((event) => event.id), ['restore:1', 'restore:2']);
  assert.equal(retry.state.revision, two.state.revision);
});

test('first-save backfill cannot score a current event; unchanged world has no new milestones', () => {
  const state = createInitialMergeWorldState(now);
  state.haven.tileStages.mossprout = 1;
  assert.ok(newWorldMilestones(null, state, 1).every((event) => event.historical));
  assert.deepEqual(newWorldMilestones(state, state, 1), []);
});

test('SQLite commits events and Harmony together; duplicate delivery and rollback are safe', async () => {
  // Node 22 requires --experimental-sqlite (provided by test:live-ops).
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(GAMEPLAY_JOURNAL_SCHEMA);
  const adapter = {
    getFirstAsync: async (sql: string, args: unknown[]) => sqlite.prepare(sql).get(...args) ?? null,
    runAsync: async (sql: string, args: unknown[]) => sqlite.prepare(sql).run(...args),
  } as unknown as Parameters<typeof appendGameplayEvents>[0];
  try {
    sqlite.exec('BEGIN');
    await appendGameplayEvents(adapter, [action]);
    sqlite.exec('ROLLBACK');
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM gameplay_events').get().n, 0);
    sqlite.exec('BEGIN');
    await appendGameplayEvents(adapter, [action, action]);
    sqlite.exec('COMMIT');
    await appendGameplayEvents(adapter, [action]);
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM gameplay_events').get().n, 1);
    const row = sqlite.prepare('SELECT payload_json FROM gameplay_projections').get();
    assert.equal(JSON.parse(row.payload_json).points, 25);
  } finally { sqlite.close(); }
});
