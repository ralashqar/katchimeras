import assert from 'node:assert/strict';
import test from 'node:test';
// eslint-disable-next-line import/no-unresolved -- Built-in module available in the test runner's Node version.
import { DatabaseSync } from 'node:sqlite';
import { loadNativeModule } from './helpers/native-motion-harness';
import { createInitialMergeWorldState } from '@/utils/merge-world/engine';
import * as writeGuard from '@/utils/merge-world/write-guard';

test('shared adventure transactions survive duplicate taps, disk failure and provider interleaving', async () => {
  const db = new DatabaseSync(':memory:');
  let failSnapshot = false;
  const adapter = {
    execAsync: async (sql: string) => db.exec(sql),
    getFirstAsync: async (sql: string, args: never[] = []) => db.prepare(sql).get(...args),
    getAllAsync: async (sql: string, args: never[] = []) => db.prepare(sql).all(...args),
    runAsync: async (sql: string, args: never[] = []) => {
      if (failSnapshot && sql.includes('INSERT INTO merge_world_snapshot')) { failSnapshot = false; throw new Error('simulated disk failure'); }
      return db.prepare(sql).run(...args);
    },
    withTransactionAsync: async (work: () => Promise<void>) => {
      db.exec('BEGIN');
      try { await work(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
  const repository = loadNativeModule('utils/merge-world/repository.ts', {
    'expo-sqlite': { openDatabaseAsync: async () => adapter },
    '@/features/onboarding/hatch-profile-storage': {},
    '@/constants/dev': { DEV_TOOLS_ENABLED: false },
    './performance': { measureMergeWork: () => () => {} },
    './writer-flush': { flushMergeWorldWriters: async () => {} },
    './write-guard': writeGuard,
  });

  const now = Date.now();
  let world = createInitialMergeWorldState(now);
  world.kingdomGoal = { introducedAt: now, coachmarkSeenAt: null };
  await repository.saveMergeWorldState(world);
  failSnapshot = true;
  await assert.rejects(repository.applyStoredAdventure({ type: 'acknowledge', beatId: 'wish', promise: 'rest' }, now), /disk failure/);
  assert.equal((await repository.loadMergeWorldState()).sharedAdventure, undefined);
  await Promise.all([1, 2].map(() => repository.applyStoredAdventure({ type: 'acknowledge', beatId: 'wish', promise: 'rest' }, now)));
  await repository.applyStoredAdventure({ type: 'acknowledge', beatId: 'trail' }, now);
  world = await repository.loadMergeWorldState();
  assert.equal(world.activeOrders.filter((o: { id: string }) => o.id === 'shared:first-answer:preparation').length, 1);
  assert.equal(world.sharedAdventure!.activity.filter((e: { target: string }) => e.target === 'wish').length, 1);
  await repository.saveMergeWorldState({ ...world, sharedAdventure: undefined, revision: world.revision + 1 }, undefined, { baseRevision: world.revision });
  const reloaded = await repository.loadMergeWorldState();
  assert.equal(reloaded.sharedAdventure.promise, 'rest');
  assert.equal(reloaded.sharedAdventure.acknowledged.trail, now);
  await assert.rejects(repository.saveMergeWorldState({ ...world, revision: world.revision + 1 }, undefined, { baseRevision: world.revision }), /stale|newer|changed/i);
  // A failed supply write cannot leave a receipt without its parcel.
  failSnapshot = true;
  await assert.rejects(repository.applyStoredAdventure({ type: 'sync_heartwood' }, now), /disk failure/);
  assert.equal((await repository.loadMergeWorldState()).sharedAdventure.gardenSupply, undefined);
  await Promise.all([1, 2].map(() => repository.applyStoredAdventure({ type: 'sync_heartwood' }, now)));
  const initialSupplies = (await repository.loadMergeWorldState()).arrivals.filter((a: { id: string }) => a.id.startsWith('heartwood:garden:'));
  assert.equal(initialSupplies.length, 1);
  const later = now + 48 * 60 * 60 * 1000;
  failSnapshot = true;
  await assert.rejects(repository.applyStoredAdventure({ type: 'collect_garden_supply' }, later), /disk failure/);
  await Promise.all([1, 2].map(() => repository.applyStoredAdventure({ type: 'collect_garden_supply' }, later)));
  const supplies = (await repository.loadMergeWorldState()).arrivals.filter((a: { id: string }) => a.id.startsWith('heartwood:garden:'));
  assert.equal(supplies.length, 3);
  assert.equal(new Set(supplies.map((a: { id: string }) => a.id)).size, 3);
  // Delivery, plant state and receipt are one transaction, including retries.
  world = await repository.loadMergeWorldState();
  world.board[0] = { ...world.board[0], locked: false, mist: null, blocker: null, occupant: { kind: 'item', instanceId: 'heartwood-delivery', definitionId: 'nature:garden:3' } };
  await repository.saveMergeWorldState({ ...world, revision: world.revision + 1 }, undefined, { baseRevision: world.revision });
  const plant = { type: 'tend_heartwood', category: 'connection', expectedGrowth: -1, slotId: 'front-left' };
  failSnapshot = true;
  await assert.rejects(repository.applyStoredAdventure(plant, later), /disk failure/);
  assert.equal((await repository.loadMergeWorldState()).board[0].occupant.instanceId, 'heartwood-delivery');
  await Promise.all([1, 2].map(() => repository.applyStoredAdventure(plant, later)));
  const planted = await repository.loadMergeWorldState();
  assert.equal(planted.board[0].occupant, null);
  assert.equal(planted.haven.plantableMemories.filter((memory: { definitionId: string }) => memory.definitionId === 'connection').length, 1);
  assert.equal(planted.haven.plantableMemories.find((memory: { definitionId: string }) => memory.definitionId === 'connection').slotId, 'front-left');
  planted.board[0] = { ...planted.board[0], locked: false, mist: null, blocker: null, occupant: { kind: 'item', instanceId: 'swap-delivery', definitionId: 'nature:garden:3' } };
  await repository.saveMergeWorldState({ ...planted, revision: planted.revision + 1 }, undefined, { baseRevision: planted.revision });
  const swap = { type: 'place_heartwood', category: 'warmth', slotId: 'front-left', expectedOccupantId: 'heartwood:plant:connection' };
  failSnapshot = true;
  await assert.rejects(repository.applyStoredAdventure(swap, later), /disk failure/);
  const failedSwap = await repository.loadMergeWorldState();
  assert.equal(failedSwap.board[0].occupant.instanceId, 'swap-delivery');
  assert.equal(failedSwap.haven.plantableMemories.find((memory: { definitionId: string }) => memory.definitionId === 'connection').status, 'planted');
  await Promise.all([1, 2].map(() => repository.applyStoredAdventure(swap, later)));
  const swapped = await repository.loadMergeWorldState();
  assert.equal(swapped.board[0].occupant, null);
  assert.equal(swapped.haven.plantableMemories.find((memory: { definitionId: string }) => memory.definitionId === 'connection').status, 'earned');
  assert.equal(swapped.haven.plantableMemories.filter((memory: { status: string }) => memory.status === 'planted').length, 1);
  db.close();
});
