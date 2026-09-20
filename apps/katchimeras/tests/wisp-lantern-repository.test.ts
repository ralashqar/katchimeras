import assert from 'node:assert/strict';
import test from 'node:test';
// eslint-disable-next-line import/no-unresolved -- Node test runtime.
import { DatabaseSync } from 'node:sqlite';
import { loadNativeModule } from './helpers/native-motion-harness';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { mergeCommandEvents } from '@/features/live-ops/merge-events';
import { WELCOME_ORDER_IDS } from '@/features/wisps/lantern-world';
import type { MergeWorldState } from '@/types/merge-world';
import * as writeGuard from '@/utils/merge-world/write-guard';

test('SQLite commits item consumption and pouch receipt together, survives retry, and preserves the next request', async () => {
  const db = new DatabaseSync(':memory:');
  let fail = false;
  const adapter = {
    execAsync: async (sql: string) => db.exec(sql),
    getFirstAsync: async (sql: string, args: never[] = []) => db.prepare(sql).get(...args),
    getAllAsync: async (sql: string, args: never[] = []) => db.prepare(sql).all(...args),
    runAsync: async (sql: string, args: never[] = []) => {
      if (fail && sql.includes('INSERT INTO merge_world_snapshot')) { fail = false; throw new Error('disk failure'); }
      return db.prepare(sql).run(...args);
    },
    withTransactionAsync: async (work: () => Promise<void>) => { db.exec('BEGIN'); try { await work(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } },
  };
  const repository = loadNativeModule('utils/merge-world/repository.ts', {
    'expo-sqlite': { openDatabaseAsync: async () => adapter }, '@/features/onboarding/hatch-profile-storage': {},
    '@/constants/dev': { DEV_TOOLS_ENABLED: false }, './performance': { measureMergeWork: () => () => {} },
    './writer-flush': { flushMergeWorldWriters: async () => {} }, './write-guard': writeGuard,
  });
  const now = Date.now();
  let world = createInitialMergeWorldState(now);
  world.kingdomGoal = { introducedAt: now, coachmarkSeenAt: null };
  world.gardenLessons = { feastle: { preparedAt: now, servedAt: now } };
  await repository.saveMergeWorldState(world);
  fail = true;
  await assert.rejects(repository.plantStoredWispLantern(now), /disk failure/);
  assert.equal((await repository.loadMergeWorldState()).wispLanternPlacement, undefined);
  await repository.plantStoredWispLantern(now);
  await repository.plantStoredWispLantern(now + 1);
  assert.deepEqual(JSON.parse(JSON.stringify((await repository.loadMergeWorldState()).wispLanternPlacement)), { slotId: 'front-right', plantedAt: now });
  await repository.activateStoredWispLantern(now);
  world = await repository.loadMergeWorldState();
  world.board[0] = { ...world.board[0], locked: false, mist: null, blocker: null, occupant: { kind: 'item', definitionId: 'nature:garden:3', instanceId: 'gift' } };
  await repository.saveMergeWorldState(world);
  const command = { type: 'serveOrder' as const, orderId: WELCOME_ORDER_IDS[0], now };
  const result = reduceMergeWorld(world, command);
  const events = mergeCommandEvents(world, command, result, 1);
  assert.equal(result.changed, true);
  fail = true;
  await assert.rejects(repository.saveMergeWorldState(result.state, undefined, { baseRevision: world.revision, gameplayEvents: events }), /disk failure/);
  let restored: MergeWorldState = await repository.loadMergeWorldState();
  assert.equal(Object.keys(restored.wispLanternProgress!.rewards).length, 0);
  assert.ok(restored.board[0].occupant?.kind === 'item');
  assert.equal(restored.board[0].occupant.instanceId, 'gift');
  await repository.saveMergeWorldState(result.state, undefined, { baseRevision: world.revision, gameplayEvents: events });
  restored = await repository.loadMergeWorldState();
  assert.equal(Object.keys(restored.wispLanternProgress!.rewards).length, 1);
  assert.ok(restored.activeOrders.some(order => order.id === WELCOME_ORDER_IDS[1]));
  assert.ok(!restored.board[0].occupant);
  // Replay the event and an older provider's Lantern fields at a newer revision.
  await repository.saveMergeWorldState({ ...restored, wispLanternPlacement: undefined, wispLanternProgress: undefined, activeOrders: [], revision: restored.revision + 1 }, undefined, { baseRevision: restored.revision, gameplayEvents: events });
  restored = await repository.loadMergeWorldState();
  assert.equal(Object.keys(restored.wispLanternProgress!.rewards).length, 1);
  assert.equal(restored.activeOrders.filter(order => order.id === WELCOME_ORDER_IDS[1]).length, 1);
  assert.ok(!restored.activeOrders.some(order => order.id === WELCOME_ORDER_IDS[0]));
  assert.equal(restored.wispLanternPlacement?.slotId, 'front-right');
  db.close();
});
