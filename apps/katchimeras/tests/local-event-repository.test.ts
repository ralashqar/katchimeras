import assert from 'node:assert/strict';
import test from 'node:test';
// eslint-disable-next-line import/no-unresolved -- Built-in module available in the test runner's Node version.
import { DatabaseSync } from 'node:sqlite';
import { loadNativeModule } from './helpers/native-motion-harness';
import { createInitialMergeWorldState } from '@/utils/merge-world/engine';
import { createLocalEventPilot } from '@/features/live-ops/local-catalog';
import { primeContentRegistry } from '@/features/content-packs/active-pack';
import * as writeGuard from '@/utils/merge-world/write-guard';
import { emptyRelationshipProgressState } from '@/game/katchimeras/relationship-progression';

test('real repository atomically rolls back failed local claims and preserves local progress across provider writes', async () => {
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
  const pack = createLocalEventPilot(new Date(now - 86400000).toISOString());
  pack.liveEvents = pack.liveEvents!.map(e => ({ ...e, enabled: true }));
  primeContentRegistry({ version: 2, revision: 1, packs: [{ pack, artUris: {}, activatedAt: now }] });
  let world = createInitialMergeWorldState(now);
  world.haven.tileStages.mossprout = 1;
  world.mossproutResidentSkinIds = ['mossprout'];
  await repository.saveMergeWorldState(world);
  const eventId = pack.liveEvents[0].id;
  await repository.applyStoredLocalEvent({ type: 'join', eventId }, now);
  await repository.appendSourceGameplayEvents([{ version: 1, id: 'five-orders', kind: 'order_completed', source: 'merge-world', sourceRevision: 1, occurredAt: now, contentRevision: 1, quantity: 5, context: {} }]);
  world = await repository.loadMergeWorldState();
  const coins = world.coins;
  failSnapshot = true;
  await assert.rejects(repository.applyStoredLocalEvent({ type: 'claim', eventId, tierId: 'first-light' }, now), /disk failure/);
  const failed = await repository.loadMergeWorldState();
  assert.equal(failed.coins, coins);
  assert.equal(failed.localLiveOps.runs[eventId].claims['first-light'], undefined);
  await Promise.all([repository.applyStoredLocalEvent({ type: 'claim', eventId, tierId: 'first-light' }, now), repository.applyStoredLocalEvent({ type: 'claim', eventId, tierId: 'first-light' }, now)]);
  world = await repository.loadMergeWorldState();
  assert.equal(world.coins, coins + 25);
  const revision = world.revision;
  // Ordinary providers do not own the local event state. A coalesced snapshot cannot erase it.
  await repository.saveMergeWorldState({ ...world, localLiveOps: undefined, revision: revision + 1 }, undefined, { baseRevision: revision });
  const reloaded = await repository.loadMergeWorldState();
  assert.equal(reloaded.localLiveOps.runs[eventId].progress.points, 100);
  assert.ok(reloaded.localLiveOps.runs[eventId].claims['first-light']);
  const relationships = { ...emptyRelationshipProgressState(), journeyEpisodes: {
    'feastle:day-2': { familyId: 'feastle', episodeId: 'day-2', completedAt: now, answers: {}, facts: {} },
  } };
  await repository.ensureStoredJourneyGardenOrders(relationships, now);
  const repaired = await repository.loadMergeWorldState();
  assert.ok(repaired.activeOrders.some((order: { id: string }) => order.id === 'feastle:chapter-1:doorstep-snacks'));
  assert.equal(repaired.coins, reloaded.coins);
  assert.ok(repaired.localLiveOps.runs[eventId].claims['first-light']);
  const again = await repository.ensureStoredJourneyGardenOrders(relationships, now);
  assert.equal(again.changed, false, 'repair persists once without replacing inventory or replaying rewards');
  db.close();
});
