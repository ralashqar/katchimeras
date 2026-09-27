import assert from 'node:assert/strict';
import test from 'node:test';
import { createEncounterWriteQueue } from '@/features/encounter/write-queue';

test('combat writes keep the first deadline under continuous commands', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const writes: unknown[] = [];
  const queue = createEncounterWriteQueue(async (_, value) => { writes.push(value); });
  queue.put('battle', 1);
  t.mock.timers.tick(100);
  queue.put('battle', 2);
  t.mock.timers.tick(50);
  assert.deepEqual(writes, [2], 'the original deadline fires without an explicit flush');
  await queue.flush('battle');
  assert.deepEqual(writes, [2]);
});

test('one writer serializes in-flight snapshots, and a clear cannot be overwritten', async () => {
  const writes: unknown[] = [];
  let unlock: () => void = () => {};
  const blocked = new Promise<void>((resolve) => { unlock = resolve; });
  const queue = createEncounterWriteQueue(async (_, value) => { if (value === 1) await blocked; writes.push(value); });
  queue.put('battle', 1);
  const saving = queue.flush('battle');
  queue.put('battle', 2);
  queue.put('battle', null);
  assert.equal(queue.read('battle', () => 'stale'), null);
  unlock();
  await saving;
  assert.deepEqual(writes, [1, null]);
  await queue.flushAll();
});

test('failed writes preserve readable state and reject barriers until retry succeeds', async () => {
  let fail = true;
  const queue = createEncounterWriteQueue(async () => { if (fail) throw new Error('disk'); });
  queue.put('battle', { clock: 3000, damage: 7 });
  await assert.rejects(queue.flush('battle'), /disk/);
  assert.deepEqual(queue.read('battle', () => null), { clock: 3000, damage: 7 });
  fail = false;
  await queue.flush('battle');
  queue.release('battle');
  assert.equal(queue.read('battle', () => 'from disk'), 'from disk');
});

test('independent battle keys do not wait on each other', async () => {
  let unlock: () => void = () => {};
  const blocked = new Promise<void>((resolve) => { unlock = resolve; });
  const written: string[] = [];
  const queue = createEncounterWriteQueue(async (key) => { if (key === 'old') await blocked; written.push(key); });
  queue.put('old', 1);
  const old = queue.flush('old');
  queue.put('new', 2);
  await queue.flush('new');
  assert.deepEqual(written, ['new']);
  unlock(); await old;
});

test('reset serializes tombstones after in-flight writes without dropping newly created boards', async () => {
  let unlock: () => void = () => {};
  const blocked = new Promise<void>((resolve) => { unlock = resolve; });
  const disk = new Map<string, unknown>();
  const queue = createEncounterWriteQueue(async (key, value) => {
    if (value === 'old') await blocked;
    disk.set(key, value);
  });
  queue.put('old-board', 'old');
  const saving = queue.flush('old-board');
  const resetting = queue.reset();
  queue.put('new-board', 'new');
  unlock();
  await Promise.all([saving, resetting]);
  assert.equal(disk.get('old-board'), null);
  assert.equal(queue.read('new-board', () => null), 'new');
  await queue.flushAll();
  assert.equal(disk.get('new-board'), 'new');
});
