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
  db.close();
});
