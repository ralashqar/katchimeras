import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { build } from 'esbuild';
import { createReplayHandler, replayVerifiedBatch, parseReplayBatch } from '../supabase/functions/verify-merge/generated/replay.mjs';
import { replayRulesets } from '../supabase/functions/verify-merge/generated/registry.mjs';

const db = new PGlite();
const queueBundle = await build({ entryPoints: ['features/live-ops/pilot-queue.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { createPilotQueue } = await import(`data:text/javascript;base64,${Buffer.from(queueBundle.outputFiles[0].text).toString('base64')}`);
const user = '11111111-1111-4111-8111-111111111111';
const first = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const second = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const { rulesetId } = JSON.parse(readFileSync('supabase/functions/verify-merge/generated/ruleset.json','utf8'));
const query = async (sql,args=[]) => (await db.query(sql,args)).rows;
let lastRpcError;
const rpc = async (name,args) => {
  const keys = Object.keys(args);
  // Handler names/keys are trusted source constants, not request strings.
  try {
    const values = Object.values(args).map((v)=>v && typeof v==='object'?JSON.stringify(v):v);
    const data = (await query(`select public.${name}(${keys.map((k,i)=>`${k} => $${i+1}`).join(',')}) as result`,values))[0].result;
    return {data,error:null};
  } catch (error) { lastRpcError=error.message; return {data:null,error:error.message}; }
};
const handlerFor = (account) => createReplayHandler({ rulesetId, rulesets: replayRulesets, authenticate:async(token)=>token==='Bearer test'?account:null,
  rpc:async(name,args)=>{
    await db.exec('set role service_role');
    try { return await rpc(name,args); } finally { await db.exec('reset role'); }
  } });
const handler = handlerFor(user);
const request = async (body,token='Bearer test') => {
  const response = await handler(new Request('https://test.invalid/verify-merge',{method:'POST',headers:{authorization:token,'content-type':'application/json'},body:JSON.stringify(body)}));
  return {status:response.status,...await response.json()};
};
const foundation = readFileSync('supabase/migrations/20260809131842_create_economy_foundation.sql','utf8');
const seasons = readFileSync('supabase/migrations/20260813112651_add_season_progression_and_gems.sql','utf8');
try {
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create schema private;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
    grant usage on schema auth,private to authenticated,service_role;`);
  for (const [source,table] of [[foundation,'economy_collectible_grants'],[seasons,'economy_gem_ledger']]) {
    await db.exec(source.match(new RegExp(`create table public.${table} \\([\\s\\S]*?\\n\\);`))[0]);
  }
  for (const migration of ['20260916135221_verified_live_event_claims.sql','20260916144019_verified_merge_checkpoints.sql']) await db.exec(readFileSync(`supabase/migrations/${migration}`,'utf8'));
  await query('insert into auth.users values($1)',[user]);
  await query("select set_config('test.user',$1,false)",[user]);
  const now=Date.now();
  const event={id:'replay-pilot',version:1,title:'Replay pilot',description:'Verified merges',enabled:true,minHarmony:0,
    startsAt:new Date(now-3600000).toISOString(),endsAt:new Date(now+3600000).toISOString(),claimEndsAt:new Date(now+7200000).toISOString(),
    rules:[{id:'merge',kind:'merge',points:10,limit:10}],tiers:[{id:'one',points:10,free:{id:'reward',items:[{kind:'gems',amount:5}]}}]};
  await query('insert into private.live_event_definitions(id,definition,enabled,starts_at,ends_at,claim_ends_at) values($1,$2,true,$3,$4,$5)',[event.id,JSON.stringify(event),event.startsAt,event.endsAt,event.claimEndsAt]);
  await rpc('enroll_live_event_v1',{event_id:event.id});
  assert.equal((await request({operation:'begin',deviceId:first},'Bearer forged')).status,401);
  assert.equal((await request({operation:'begin',deviceId:first,initial_state:{coins:99999}})).status,400);
  let begun=await request({operation:'begin',deviceId:first});
  assert.equal(begun.ok,true);
  assert.equal(begun.checkpoint.sequence,0);
  assert.equal(begun.checkpoint.state.coins,0);
  const generatorBatch={rulesetId,epoch:1,deviceId:first,fromSequence:0,actions:[{type:'tapGenerator',generatorId:'wild-garden'}]};
  const replayTime=Date.now();
  assert.deepEqual(replayVerifiedBatch(begun.checkpoint,generatorBatch,replayTime),replayVerifiedBatch(structuredClone(begun.checkpoint),generatorBatch,replayTime),'generator randomness is checkpoint/sequence-derived');
  assert.throws(()=>parseReplayBatch({...generatorBatch,actions:Array(101).fill(generatorBatch.actions[0])}),/Invalid replay batch/);
  assert.equal((await request({operation:'begin',deviceId:first,padding:'x'.repeat(65536)})).status,400);
  const batch={rulesetId,epoch:1,deviceId:first,fromSequence:0,actions:[{type:'move',from:29,to:30}]};
  let localEnvelope = null, losePilotResponse = true;
  const openQueue = () => createPilotQueue(user, first, {
    rulesetId, predict: replayVerifiedBatch, read: () => localEnvelope, write: (value) => { localEnvelope = value; },
    begin: () => request({ operation: 'begin', deviceId: first }),
    submit: async (queuedBatch) => {
      const response = await request({ operation: 'submit', batch: queuedBatch });
      assert.equal(response.ok, true);
      if (losePilotResponse) throw new Error('Simulated lost HTTP response after PostgreSQL commit');
      return response;
    },
    transfer: async () => { throw new Error('Unexpected transfer'); },
  });
  let pilotQueue = openQueue(); await pilotQueue.connect(); pilotQueue.enqueue(batch.actions[0]);
  await assert.rejects(pilotQueue.submit(), /lost HTTP response/);
  pilotQueue = openQueue(); await pilotQueue.connect();
  assert.equal(pilotQueue.snapshot().checkpoint.sequence, 0, 'reconnect must preserve the uncertain base');
  losePilotResponse = false; await pilotQueue.submit();
  assert.equal(pilotQueue.snapshot().pending, null);
  assert.equal(pilotQueue.snapshot().checkpoint.sequence, 1);
  const submitted=await request({operation:'submit',batch});
  assert.equal(submitted.ok,true,`${JSON.stringify(submitted)} ${lastRpcError}`);
  assert.equal(submitted.acceptedThrough,1);
  assert.equal(submitted.checkpoint.state.board[30].occupant.definitionId,'nature:garden:2');
  const duplicate=await request({operation:'submit',batch});
  assert.equal(duplicate.duplicate,true);
  assert.equal((await request({operation:'submit',batch:{...batch,actions:[{type:'move',from:32,to:33}]}})).status,409);
  assert.equal((await request({operation:'submit',batch:{...batch,fromSequence:20}})).status,409);
  for (const bad of [{type:'grantOpeningGlow',amount:9999},{type:'move',from:32,to:33,now:now-100000},{type:'tapGenerator',generatorId:'wild-garden',seed:'chosen'}]) {
    assert.throws(()=>parseReplayBatch({...batch,actions:[bad]}));
    assert.equal((await request({operation:'submit',batch:{...batch,fromSequence:1,actions:[bad]}})).status,400);
  }
  assert.equal((await request({operation:'submit',batch:{...batch,fromSequence:1,actions:[{type:'move',from:999,to:33}]}})).status,409);
  const state=await rpc('get_live_event_state_v1',{});
  assert.equal(state.data.events[0].points,10);
  const claim=await rpc('claim_live_event_reward_v1',{event_id:event.id,tier_id:'one',track:'free'});
  assert.equal(claim.data.ok,true);
  assert.equal((await query('select sum(delta)::integer as n from economy_gem_ledger'))[0].n,5);

  // A later failure must roll back scoring, checkpoint and the batch receipt.
  await db.exec(`create function public.fail_batch_test() returns trigger language plpgsql as $$ begin raise exception 'injected batch failure';end $$;
    create trigger reject_batch before insert on private.verified_merge_batches for each row execute function public.fail_batch_test();`);
  const next={...batch,fromSequence:1,actions:[{type:'move',from:32,to:33}]};
  assert.equal((await request({operation:'submit',batch:next})).status,409);
  assert.equal((await query('select sequence from private.verified_merge_checkpoints'))[0].sequence,1);
  assert.equal((await rpc('get_live_event_state_v1',{})).data.events[0].points,10);
  await db.exec('drop trigger reject_batch on private.verified_merge_batches');
  assert.equal((await request({operation:'submit',batch:next})).ok,true);
  assert.equal((await rpc('get_live_event_state_v1',{})).data.events[0].points,20);
  const oldRetry=await request({operation:'submit',batch});
  assert.equal(oldRetry.acceptedThrough,1);
  assert.equal(oldRetry.checkpoint.sequence,2,'an old retry must return the latest checkpoint, never roll back the client');

  assert.equal((await request({operation:'begin',deviceId:second})).reason,'device_conflict');
  const loaded=await rpc('load_verified_merge_v1',{target_user:user,device_id:first});
  const pending={...batch,fromSequence:2,actions:[{type:'move',from:30,to:33}]};
  const replayed=replayVerifiedBatch(loaded.data.checkpoint,pending,loaded.data.serverNow);
  await db.exec('set role authenticated');
  assert.equal((await rpc('commit_verified_merge_v1',{target_user:user,batch:pending,next_state:replayed.state,verified_events:replayed.events})).data,null);
  assert.equal((await rpc('begin_verified_merge_v1',{target_user:user,device_id:first,ruleset_id:rulesetId,initial_state:{},random_seed:'1234567890123456'})).data,null);
  const transferred=await rpc('transfer_verified_merge_v1',{new_device_id:second,expected_epoch:1});
  assert.equal(transferred.data.checkpoint.epoch,2);
  assert.equal(transferred.data.checkpoint.sequence,2);
  await db.exec('reset role');
  assert.match((await rpc('commit_verified_merge_v1',{target_user:user,batch:pending,next_state:replayed.state,verified_events:replayed.events})).error,/ownership changed/);
  assert.equal((await request({operation:'submit',batch:pending})).reason,'device_conflict');
  begun=await request({operation:'begin',deviceId:second});
  assert.equal(begun.checkpoint.sequence,2,'recovery does not reset the world');
  const resumed={...pending,epoch:2,deviceId:second};
  assert.equal((await request({operation:'submit',batch:resumed})).ok,true);
  assert.equal((await rpc('get_live_event_state_v1',{})).data.events[0].points,30);
  assert.equal((await request({operation:'submit',batch:{...resumed,fromSequence:3,rulesetId:'wrong'}})).status,409);
  await query("update private.verified_merge_checkpoints set expires_at=now()-interval '1 second'");
  assert.equal((await request({operation:'submit',batch:{...resumed,fromSequence:3}})).reason,'lease_expired');
  assert.equal((await request({operation:'begin',deviceId:second})).checkpoint.sequence,3,'reconnecting renews the lease without resetting progress');
  // Long offline session, expired lease, restart, then ordered multi-batch catch-up.
  let offlineEnvelope = null;
  const reopenOffline = () => createPilotQueue(user, second, {
    rulesetId, predict: replayVerifiedBatch, read: () => offlineEnvelope, write: (value) => { offlineEnvelope = value; },
    begin: () => request({ operation: 'begin', deviceId: second }),
    submit: (queuedBatch) => request({ operation: 'submit', batch: queuedBatch }),
    transfer: async () => { throw new Error('Unexpected transfer'); },
  });
  let offlineQueue = reopenOffline(); await offlineQueue.connect();
  for (let index = 0; index < 131; index++) offlineQueue.enqueue({ type: 'move', from: index % 2 ? 30 : 33, to: index % 2 ? 33 : 30 });
  await query("update private.verified_merge_checkpoints set expires_at=now()-interval '1 second'");
  await assert.rejects(offlineQueue.sync(), /lease_expired/);
  offlineQueue.enqueue({ type: 'move', from: 30, to: 33 });
  const offlineBoard = offlineQueue.preview().board;
  offlineQueue = reopenOffline(); await offlineQueue.connect(); await offlineQueue.sync();
  assert.equal(offlineQueue.snapshot().checkpoint.sequence, 135);
  assert.equal(offlineQueue.snapshot().pending, null);
  assert.deepEqual(offlineQueue.preview().board, offlineBoard);
  assert.equal((await rpc('get_live_event_state_v1',{})).data.events[0].points,30,'plain moves and retries never create extra event points');
  assert.equal((await query('select sum(delta)::integer as n from economy_gem_ledger'))[0].n,5);
  const other='22222222-2222-4222-8222-222222222222';
  await query('insert into auth.users values($1)',[other]);
  await query("select set_config('test.user',$1,false)",[other]);
  await db.exec('set role authenticated');
  assert.equal((await rpc('transfer_verified_merge_v1',{new_device_id:first,expected_epoch:2})).data.reason,'checkpoint_required');
  await assert.rejects(query('select * from private.verified_merge_checkpoints'));
  await db.exec('reset role');
  await db.exec('set role anon');
  assert.equal((await rpc('transfer_verified_merge_v1',{new_device_id:first,expected_epoch:2})).data,null);
  await db.exec('reset role');
  // The deployed dispatcher must reconnect old saves to their exact archived reducer.
  const archived = replayRulesets.find((runtime) => !runtime.replayTiming);
  assert.ok(archived);
  const seed = await rpc('begin_verified_merge_v1', { target_user: other, device_id: first,
    ruleset_id: archived.rulesetId, initial_state: archived.initialVerifiedWorld(Date.now()-1000), random_seed: 'archived-seed-123456789' });
  assert.equal(seed.data.ok, true);
  const oldHandler = handlerFor(other);
  const oldRequest = async (body) => (await oldHandler(new Request('https://test.invalid/verify-merge', {
    method: 'POST', headers: { authorization: 'Bearer test', 'content-type': 'application/json' }, body: JSON.stringify(body),
  }))).json();
  const oldBegin = await oldRequest({ operation: 'begin', deviceId: first });
  assert.equal(oldBegin.checkpoint.rulesetId, archived.rulesetId);
  const oldBatch = { rulesetId: archived.rulesetId, epoch: 1, deviceId: first, fromSequence: 0, actions: [{ type: 'move', from: 29, to: 30 }] };
  assert.equal((await oldRequest({ operation: 'submit', batch: { ...oldBatch, actionTimes: [oldBegin.checkpoint.state.updatedAt] } })).reason, 'replay_rejected');
  assert.equal((await oldRequest({ operation: 'submit', batch: oldBatch })).acceptedThrough, 1);
  assert.equal((await oldRequest({ operation: 'submit', batch: oldBatch })).duplicate, true);

  // Current runtime accepts a bounded action timeline, but never future time or backdated event eligibility.
  const timedBase = (await request({ operation: 'begin', deviceId: second })).checkpoint;
  const timedBatch = { rulesetId, epoch: timedBase.epoch, deviceId: second, fromSequence: timedBase.sequence,
    actions: [{ type: 'move', from: 33, to: 30 }], actionTimes: [timedBase.state.updatedAt] };
  assert.equal((await request({ operation: 'submit', batch: { ...timedBatch, actionTimes: [Date.now()+3600000] } })).reason, 'action_time_outside_window');
  assert.equal((await request({ operation: 'begin', deviceId: second })).checkpoint.sequence, timedBase.sequence);
  const timedResult = await request({ operation: 'submit', batch: timedBatch });
  assert.equal(timedResult.ok, true);
  assert.equal(timedResult.checkpoint.state.updatedAt, timedBatch.actionTimes[0]);
  assert.equal((await request({ operation: 'submit', batch: timedBatch })).duplicate, true);
  console.log('PASS: reducer -> handler -> PostgreSQL -> rewards; offline restart, lease recovery, bounded timelines and archived ruleset routing');
} catch(error) { console.error(error.message,error.where??'');process.exitCode=1; }
finally {await db.close();}
