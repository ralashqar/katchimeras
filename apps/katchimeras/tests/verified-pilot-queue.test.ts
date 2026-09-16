import { test } from 'node:test';
import assert from 'node:assert/strict';
// Node's experimental SQLite builtin is not yet in eslint-import's resolver.
// eslint-disable-next-line import/no-unresolved
import { DatabaseSync } from 'node:sqlite';
import { createPilotQueue, PilotError, type PilotReply } from '../features/live-ops/pilot-queue';
import { initialVerifiedWorld, parseReplayBatch, replayVerifiedBatch, rulesetId } from '../features/live-ops/generated/replay';
import { replayRulesets, resolveReplayRuleset } from '../features/live-ops/generated/registry';
import type { ReplayBatch, ReplayCheckpoint } from '../features/live-ops/replay';
import { openLocalProfile } from '../features/live-ops/local-profile';
import { withPilotDeadline } from '../features/live-ops/pilot-deadline';

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec('create table kv (key text primary key, value text not null)');
  let cp: ReplayCheckpoint = { rulesetId, sequence: 0, epoch: 1, deviceId: 'device', seed: 'seed', state: initialVerifiedWorld(1000) };
  let writesFail = false, loseReply = false, failAfterCommit = false, calls = 0, transfers = 0;
  const receipts = new Map<string, number>();
  let changeReply: (reply: PilotReply) => PilotReply = (r) => r;
  const read = () => (db.prepare('select value from kv where key = ?').get('account') as { value: string } | undefined)?.value ?? null;
  const deps = {
    rulesetId, predict: replayVerifiedBatch, read,
    write: (value: string) => { if (writesFail) throw new Error('disk failure'); db.prepare('insert or replace into kv values (?,?)').run('account', value); },
    begin: async (): Promise<PilotReply> => cp.deviceId === 'device' ? { ok: true, checkpoint: cp } : { ok: false, reason: 'device_conflict', epoch: cp.epoch },
    submit: async (batch: ReplayBatch): Promise<PilotReply> => {
      calls++;
      assert.equal(JSON.parse(read()!).pending.phase, 'submitted');
      const key = JSON.stringify(batch);
      if (!receipts.has(key)) {
        const replay = replayVerifiedBatch(cp, batch, 2000);
        cp = { ...cp, sequence: replay.sequence, state: replay.state };
        receipts.set(key, cp.sequence);
      }
      if (failAfterCommit) writesFail = true;
      if (loseReply) throw new Error('response lost');
      return changeReply({ ok: true, acceptedThrough: receipts.get(key), checkpoint: cp });
    },
    transfer: async (epoch: number): Promise<PilotReply> => {
      transfers++;
      assert.equal(epoch, cp.epoch);
      cp = { ...cp, deviceId: 'device', epoch: cp.epoch + 1 };
      if (loseReply) throw new Error('transfer response lost');
      return { ok: true, checkpoint: cp };
    },
  };
  return { load: () => createPilotQueue('account', 'device', deps), read, deps,
    failDisk: (value: boolean) => { writesFail = value; }, loseReply: (value: boolean) => { loseReply = value; },
    failAfterCommit: (value = true) => { failAfterCommit = value; }, mutateReply: (fn: typeof changeReply) => { changeReply = fn; },
    moveDevice: () => { cp = { ...cp, deviceId: 'other', epoch: cp.epoch + 1 }; },
    calls: () => calls, transfers: () => transfers, checkpoint: () => cp };
}
const move = { type: 'move', from: 29, to: 30 } as const;

test('lost reply survives SQLite reload and retries without a second award', async () => {
  const f = fixture(); let queue = f.load(); await queue.connect(); queue.enqueue(move);
  f.loseReply(true); await assert.rejects(queue.submit(), /response lost/);
  const saved = queue.snapshot().pending;
  queue = f.load(); queue.enqueue({ type: 'move', from: 32, to: 33 });
  await queue.connect(); assert.deepEqual(queue.snapshot().pending, saved);
  assert.equal(queue.snapshot().checkpoint!.sequence, 0);
  f.loseReply(false); await queue.submit();
  assert.equal(queue.snapshot().pending?.batch.fromSequence, 1); assert.equal(f.checkpoint().sequence, 1); assert.equal(f.calls(), 2);
  await queue.sync(); assert.equal(queue.snapshot().pending, null); assert.equal(f.checkpoint().sequence, 2);
});
test('failed durable write prevents submission and leaves draft intact', async () => {
  const f = fixture(); const queue = f.load(); await queue.connect(); queue.enqueue(move);
  f.failDisk(true); await assert.rejects(queue.submit(), /disk failure/);
  assert.equal(f.calls(), 0); assert.equal(queue.snapshot().pending!.phase, 'draft');
});
test('failed receipt persistence leaves an immutable retryable batch', async () => {
  const f = fixture(); const queue = f.load(); await queue.connect(); queue.enqueue(move);
  f.failAfterCommit(); await assert.rejects(queue.submit(), /disk failure/);
  assert.equal(queue.snapshot().pending!.phase, 'submitted');
  assert.equal(f.load().snapshot().checkpoint!.sequence, 0);
  f.failAfterCommit(false); f.failDisk(false);
  const reopened = f.load(); await reopened.submit();
  assert.equal(reopened.snapshot().pending, null); assert.equal(f.checkpoint().sequence, 1);
});
test('incorrect receipt cannot clear commands', async () => {
  const f = fixture(); const queue = f.load(); await queue.connect(); queue.enqueue(move);
  f.mutateReply((reply) => ({ ...reply, acceptedThrough: 50 }));
  await assert.rejects(queue.submit(), /Invalid batch receipt/); assert.ok(queue.snapshot().pending);
});
test('device transfer response loss is resolved by ownership confirmation and archives old work', async () => {
  const f = fixture(); let queue = f.load(); await queue.connect(); queue.enqueue(move); f.moveDevice();
  await assert.rejects(queue.connect(), PilotError);
  f.loseReply(true); await assert.rejects(queue.recover(2), /transfer response lost/);
  queue = f.load(); assert.equal(queue.snapshot().recovery, 2); assert.ok(queue.snapshot().pending);
  f.loseReply(false); await queue.recover(2);
  assert.equal(f.transfers(), 1); assert.equal(queue.snapshot().archived.length, 1);
  assert.equal(queue.snapshot().pending, null); assert.equal(queue.snapshot().checkpoint!.epoch, 3);
});
test('parallel submissions are rejected but new moves survive an in-flight acknowledgment', async () => {
  const f = fixture(); const queue = f.load(); await queue.connect(); queue.enqueue(move);
  const first = queue.submit();
  queue.enqueue({ type: 'move', from: 32, to: 33 }); await assert.rejects(queue.submit(), /already running/);
  await first; assert.equal(f.calls(), 1); assert.equal(queue.snapshot().pending?.batch.fromSequence, 1);
  await queue.sync(); assert.equal(f.checkpoint().sequence, 2); assert.equal(queue.snapshot().pending, null);
});
test('corrupt or differently scoped storage fails closed', async () => {
  const f = fixture(); const queue = f.load(); await queue.connect();
  assert.throws(() => createPilotQueue('different-account', 'device', f.deps), /Invalid saved/);
  f.deps.write('{broken'); assert.throws(f.load);
});
test('invalid prediction never persists and snapshots cannot mutate the queue', async () => {
  const f = fixture(); const queue = f.load(); await queue.connect(); const before = f.read();
  assert.throws(() => queue.enqueue({ type: 'move', from: 900, to: 0 })); assert.equal(f.read(), before);
  queue.snapshot().checkpoint!.sequence = 999;
  assert.equal(queue.snapshot().checkpoint!.sequence, 0);
});
test('recovery cannot discard a batch while its ownership is still valid', async () => {
  const f = fixture(); const queue = f.load(); await queue.connect(); queue.enqueue(move);
  await assert.rejects(queue.recover(1), /not been fenced/);
  assert.equal(f.transfers(), 0); assert.ok(queue.snapshot().pending);
});
test('incompatible native ruleset preserves the stored envelope and refuses to load', async () => {
  const f = fixture(); const queue = f.load(); await queue.connect(); queue.enqueue(move);
  const before = f.read();
  assert.throws(() => createPilotQueue('account', 'device', { ...f.deps, rulesetId: 'new-rules' }), /original ruleset/);
  assert.equal(f.read(), before);
});

test('more than 100 offline moves split into ordered batches and survive restart', async () => {
  const f = fixture(); let queue = f.load(); await queue.connect(); queue.enqueue(move);
  for (let index = 0; index < 205; index++) queue.enqueue({ type: 'move', from: index % 2 ? 29 : 30, to: index % 2 ? 30 : 29 });
  assert.deepEqual([queue.snapshot().pending!, ...queue.snapshot().queued].map((p) => p.batch.actions.length), [100, 100, 6]);
  const preview = queue.preview(); queue = f.load(); assert.deepEqual(queue.preview(), preview);
  await queue.sync(); assert.equal(f.checkpoint().sequence, 206); assert.equal(f.calls(), 3); assert.equal(queue.snapshot().pending, null);
  assert.deepEqual(queue.preview()!.board, preview!.board);
});

test('version one migration preserves submitted commands exactly', async () => {
  const f = fixture(); let queue = f.load(); await queue.connect(); queue.enqueue(move);
  f.loseReply(true); await assert.rejects(queue.submit());
  const { queued: _queued, reconciliation: _reconciliation, ...legacy } = queue.snapshot();
  const bytes = JSON.stringify(legacy.pending!.batch);
  f.deps.write(JSON.stringify({ ...legacy, version: 1 }));
  queue = f.load(); assert.equal(queue.snapshot().version, 2); assert.equal(JSON.stringify(queue.snapshot().pending!.batch), bytes);
  f.loseReply(false); await queue.sync(); assert.equal(f.checkpoint().sequence, 1);
});

test('recovery archives the whole dependent queue', async () => {
  const f = fixture(); const queue = f.load(); await queue.connect(); queue.enqueue(move);
  f.loseReply(true); await assert.rejects(queue.submit());
  queue.enqueue({ type: 'move', from: 32, to: 33 }); f.moveDevice(); f.loseReply(false);
  await queue.recover(2); assert.equal(queue.snapshot().archived.length, 2);
  assert.equal(queue.snapshot().queued.length, 0); assert.equal(queue.snapshot().pending, null);
});

test('server divergence retains later commands and their local preview for reconciliation', async () => {
  const f = fixture(); let queue = f.load(); await queue.connect(); queue.enqueue(move);
  f.loseReply(true); await assert.rejects(queue.submit()); queue.enqueue({ type: 'move', from: 32, to: 33 });
  const preview = queue.preview();
  f.mutateReply((reply) => {
    const altered = JSON.parse(JSON.stringify(reply)); altered.checkpoint.state.board[32].occupant = null;
    return altered;
  });
  f.loseReply(false); await queue.submit();
  assert.ok(queue.snapshot().reconciliation); assert.equal(queue.snapshot().checkpoint!.sequence, 1);
  queue = f.load(); assert.deepEqual(queue.preview(), preview); assert.equal(queue.snapshot().pending!.batch.fromSequence, 1);
  assert.throws(() => queue.enqueue(move), /reconciliation/); await assert.rejects(queue.sync(), /reconciliation/);
});

test('expired local identity loads without auth refresh; switching and signing out never select another save', () => {
  const first = '11111111-1111-4111-8111-111111111111', second = '22222222-2222-4222-8222-222222222222';
  let raw: string | null = JSON.stringify({ user: { id: first }, expires_at: 1, access_token: 'expired' });
  const opened: string[] = [];
  const open = () => openLocalProfile(() => raw, (id) => { opened.push(id); return id; });
  assert.equal(open(), first); // Synchronous return: no authentication dependency exists on this path.
  raw = JSON.stringify({ user: { id: second }, expires_at: 1 }); assert.equal(open(), second);
  raw = null; assert.throws(open, /No local account/);
  raw = '{broken'; assert.throws(open, /unreadable/);
  assert.deepEqual(opened, [first, second]);
});

test('a stalled request times out without freezing play or allowing its late reply to clear new work', async () => {
  const f = fixture(); let release!: (reply: PilotReply) => void;
  const request = f.deps.submit;
  let lateReply!: PilotReply;
  f.deps.submit = (batch) => withPilotDeadline(async () => {
    lateReply = await request(batch);
    return new Promise<PilotReply>((resolve) => { release = resolve; });
  }, 10);
  const queue = f.load(); await queue.connect(); queue.enqueue(move);
  await assert.rejects(queue.submit(), /timed out/);
  queue.enqueue({ type: 'move', from: 32, to: 33 }); const saved = f.read();
  release(lateReply); await Promise.resolve(); await Promise.resolve(); assert.equal(f.read(), saved);
  f.deps.submit = request; await queue.sync(); assert.equal(f.checkpoint().sequence, 2);
});

test('failed disk write while appending behind an uncertain batch preserves both prior batches', async () => {
  const f = fixture(); const queue = f.load(); await queue.connect(); queue.enqueue(move);
  f.loseReply(true); await assert.rejects(queue.submit()); queue.enqueue({ type: 'move', from: 32, to: 33 });
  const saved = f.read(); f.failDisk(true);
  assert.throws(() => queue.enqueue({ type: 'move', from: 30, to: 29 }), /disk failure/);
  assert.equal(f.read(), saved); assert.equal(queue.snapshot().queued[0].batch.actions.length, 1);
});

test('bounded action timeline preserves offline elapsed time through restart and replay', async () => {
  const f = fixture(); let deviceNow = 50000;
  const open = () => createPilotQueue('account', 'device', { ...f.deps, supportsTiming: () => true, now: () => deviceNow });
  let queue = open(); await queue.connect(); queue.enqueue(move);
  deviceNow += 600; queue.enqueue({ type: 'move', from: 32, to: 33 });
  assert.deepEqual(queue.snapshot().pending!.batch.actionTimes, [1000, 1600]);
  const preview = queue.preview(); queue = open(); assert.deepEqual(queue.preview(), preview);
  const replay = replayVerifiedBatch(f.checkpoint(), queue.snapshot().pending!.batch, 2000);
  assert.equal(replay.state.updatedAt, 1600);
  assert.ok(replay.events.every((event) => event.occurredAt === 2000), 'event eligibility uses server time');
  await queue.sync(); assert.deepEqual(queue.preview(), preview);
});

test('timestamps cannot be decreasing, outside the server window, or mismatched to actions', async () => {
  const f = fixture(); const cp = f.checkpoint();
  const batch = { rulesetId, deviceId: 'device', epoch: 1, fromSequence: 0, actions: [move] };
  assert.throws(() => parseReplayBatch({ ...batch, actionTimes: [] }), /timeline/);
  assert.throws(() => parseReplayBatch({ ...batch, actionTimes: [NaN] }), /timeline/);
  assert.throws(() => parseReplayBatch({ ...batch, actions: [move, move], actionTimes: [1500, 1400] }), /timeline/);
  for (const time of [999, 2001]) assert.throws(() => replayVerifiedBatch(cp, { ...batch, actionTimes: [time] }, 2000), /window/);
  assert.equal(replayVerifiedBatch(cp, batch, 2000).state.updatedAt, 2000, 'untimed batches retain their existing semantics');
});

test('clock rollback never moves a queued timeline backwards and reconnect cannot rewrite submitted times', async () => {
  const f = fixture(); let deviceNow = 50000;
  const queue = createPilotQueue('account', 'device', { ...f.deps, supportsTiming: () => true, now: () => deviceNow });
  await queue.connect(); queue.enqueue(move); deviceNow -= 10000;
  queue.enqueue({ type: 'move', from: 32, to: 33 }); assert.deepEqual(queue.snapshot().pending!.batch.actionTimes, [1000, 1000]);
  f.loseReply(true); await assert.rejects(queue.submit()); const pending = queue.snapshot().pending;
  await queue.connect(); assert.deepEqual(queue.snapshot().pending, pending);
});

test('an archived native ruleset can load and continue its pinned save unchanged', () => {
  const old = replayRulesets.find((runtime) => !runtime.replayTiming)!; assert.ok(old);
  const f = fixture();
  f.deps.write(JSON.stringify({ version: 2, accountId: 'account', deviceId: 'device', checkpoint: {
    rulesetId: old.rulesetId, sequence: 0, epoch: 1, deviceId: 'device', seed: 'seed', state: old.initialVerifiedWorld(1000),
  }, pending: null, queued: [], archived: [], recovery: null, reconciliation: null }));
  const queue = createPilotQueue('account', 'device', { ...f.deps,
    supportsRuleset: (id) => Boolean(resolveReplayRuleset(id)),
    supportsTiming: (id) => Boolean(resolveReplayRuleset(id)?.replayTiming),
    predict: (cp, batch, now) => resolveReplayRuleset(cp.rulesetId)!.replayVerifiedBatch(cp, batch, now),
  });
  queue.enqueue(move); assert.equal(queue.snapshot().pending!.batch.rulesetId, old.rulesetId);
  assert.equal(queue.snapshot().pending!.batch.actionTimes, undefined);
  assert.equal(queue.preview()!.board[30].occupant?.kind, 'item');
});

test('timed offline moves retain their schedule across batch boundaries and server acknowledgments', async () => {
  const f = fixture(); let deviceNow = 50000;
  const open = () => createPilotQueue('account', 'device', { ...f.deps, supportsTiming: () => true, now: () => deviceNow });
  let queue = open(); await queue.connect(); queue.enqueue(move);
  for (let index = 0; index < 205; index++) {
    deviceNow++;
    queue.enqueue({ type: 'move', from: index % 2 ? 29 : 30, to: index % 2 ? 30 : 29 });
  }
  const preview = queue.preview();
  const batches = [queue.snapshot().pending!, ...queue.snapshot().queued];
  assert.deepEqual(batches.map((p) => p.batch.actionTimes?.length), [100, 100, 6]);
  assert.equal(batches[1].batch.actionTimes![0], 1100);
  queue = open(); await queue.sync(); assert.deepEqual(queue.preview(), preview);
  assert.equal(f.checkpoint().state.updatedAt, 1205);
});
