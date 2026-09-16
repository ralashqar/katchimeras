import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveEventClient } from '@/features/live-ops/client';

test('claims send only identity, never local points or a client reward', async () => {
  const calls: unknown[] = [];
  const client = createLiveEventClient(async (name, args) => {
    calls.push([name,args]);
    return { data: { ok: true, duplicate: true }, error: null };
  });
  assert.deepEqual(await client.claim('moonlit','tier-1'), { ok: true, duplicate: true });
  assert.deepEqual(calls, [['claim_live_event_reward_v1', { event_id: 'moonlit', tier_id: 'tier-1', track: 'free' }]]);
  assert.equal('score' in client, false);
});

test('eligibility refusals are not presented as successful claims', async () => {
  const client = createLiveEventClient(async () => ({ data: { ok: false, reason: 'not_eligible' }, error: null }));
  assert.deepEqual(await client.claim('moonlit','one'), { ok: false, reason: 'not_eligible' });
  assert.deepEqual(await client.enroll('moonlit'), { ok: false, reason: 'not_eligible' });
});

test('network and malformed responses fail without fabricated progress or success', async () => {
  const offline = createLiveEventClient(async () => ({ data: null, error: { message: 'Offline' } }));
  await assert.rejects(offline.load(), /Offline/);
  await assert.rejects(offline.claim('moonlit','one'), /Offline/);
  const bad = createLiveEventClient(async () => ({ data: { ok: true, points: 9999 }, error: null }));
  await assert.rejects(bad.load(), /Invalid/);
  await assert.rejects(bad.claim('moonlit','one'), /Invalid/);
});

test('server availability is separate from the immutable authored definition', async () => {
  const definition = { id:'moonlit',version:1,title:'Moonlit',description:'Silver Mist',enabled:false,minHarmony:0,
    startsAt:'2026-10-01T00:00:00Z',endsAt:'2026-10-08T00:00:00Z',claimEndsAt:'2026-10-10T00:00:00Z',
    rules:[{id:'merge',kind:'merge',points:1,limit:20}],tiers:[] };
  const client = createLiveEventClient(async () => ({ data: {serverTime:'2026-10-02T00:00:00Z',harmony:100,
    events:[{definition,enabled:true,enrolledAt:null,points:0,ruleCounts:{},claims:[]}]}, error:null }));
  const state = await client.load();
  assert.equal(state.events[0]?.enabled,true);
  assert.equal(state.events[0]?.definition.enabled,false);
});
