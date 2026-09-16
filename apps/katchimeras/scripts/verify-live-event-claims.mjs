import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const { emptyEventProgress, scoreGameplayEvent } = createRequire(import.meta.url)('tsx/cjs/api').require('../features/live-ops/rules.ts', import.meta.url);

const { PGlite } = await import(process.env.KATCHIMERAS_PGLITE_MODULE ? pathToFileURL(process.env.KATCHIMERAS_PGLITE_MODULE).href : '@electric-sql/pglite');
const db = new PGlite();
const foundation = readFileSync('supabase/migrations/20260809131842_create_economy_foundation.sql', 'utf8');
const seasons = readFileSync('supabase/migrations/20260813112651_add_season_progression_and_gems.sql', 'utf8');
const migration = readFileSync('supabase/migrations/20260916135221_verified_live_event_claims.sql', 'utf8');
const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const rpc = async (sql, args = []) => (await query(`select ${sql} as result`, args))[0].result;
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
    grant usage on schema auth,private to authenticated,service_role;`);
  for (const [source, table] of [[foundation, 'economy_collectible_grants'], [seasons, 'economy_gem_ledger']]) {
    const ddl = source.match(new RegExp(`create table public.${table} \\([\\s\\S]*?\\n\\);`))?.[0];
    assert.ok(ddl); await db.exec(ddl);
  }
  await db.exec(migration);
  await query('insert into auth.users values ($1),($2)', [user, other]);
  await query("select set_config('test.user',$1,false)", [user]);
  const now = Date.now();
  const definition = {
    id: 'moonlit', version: 1, title: 'Moonlit Mist', description: 'Restore the Grove', enabled: true, minHarmony: 0,
    startsAt: new Date(now - 3600000).toISOString(), endsAt: new Date(now + 3600000).toISOString(), claimEndsAt: new Date(now + 7200000).toISOString(),
    rules: [{ id: 'restore', kind: 'hex_restored', points: 100, limit: 3, filter: { regionId: 'grove', tags: ['seasonal'] } }],
    tiers: [{ id: 'one', points: 100, free: { id: 'gift', items: [{ kind: 'gems', amount: 20 }, { kind: 'wisp', id: 'sprout' }] } },
      { id: 'unsupported', points: 200, free: { id: 'later', items: [{ kind: 'gems', amount: 99 }, { kind: 'glow', amount: 50 }] } },
      { id: 'too-high', points: 9999, free: { id: 'big', items: [{ kind: 'gems', amount: 100 }] } }],
  };
  const addDefinition = async (d) => query('insert into private.live_event_definitions(id,definition,enabled,starts_at,ends_at,claim_ends_at) values($1,$2,true,$3,$4,$5)', [d.id, JSON.stringify(d), d.startsAt, d.endsAt, d.claimEndsAt]);
  await addDefinition(definition);
  await assert.rejects(addDefinition({ ...definition, id: 'invalid-threshold', tiers: [{ id:'bad',free:{items:[{kind:'gems',amount:9}]}}] }), /Invalid reward tier/);
  await db.exec('set role service_role');
  const stage = (d) => rpc('public.stage_live_event_definition_v1($1)', [JSON.stringify(d)]);
  assert.equal((await stage({ ...definition, id:'staged' })).ok, true);
  assert.equal((await stage({ ...definition, id:'staged' })).ok, true);
  await assert.rejects(stage({ ...definition, id:'staged',minHarmony:999 }), /identity conflict/);
  await db.exec('reset role');
  assert.equal((await query("select enabled from private.live_event_definitions where id='staged'"))[0].enabled, false);
  await addDefinition({ ...definition, id: 'overlap', rules: [{ id: 'all', kind: 'hex_restored', points: 5, limit: 10 }] });
  await addDefinition({ ...definition, id: 'gated', minHarmony: 100 });
  assert.equal((await rpc("public.enroll_live_event_v1('gated')")).reason, 'harmony_required');
  assert.equal((await rpc("public.claim_live_event_reward_v1('moonlit','one','free')")).reason, 'not_enrolled');
  await db.exec('set role authenticated');
  assert.equal((await rpc("public.enroll_live_event_v1('moonlit')")).ok, true);
  assert.equal((await rpc("public.enroll_live_event_v1('overlap')")).ok, true);
  assert.equal((await rpc("public.claim_live_event_reward_v1('moonlit','one','free')")).reason, 'not_eligible');
  await assert.rejects(query('update private.live_event_progress set points=9999'));
  await assert.rejects(rpc('public.record_verified_live_action_v1($1,$2)', [user, '{}']));
  await db.exec('reset role');
  await query("update private.live_event_progress set enrolled_at = now() - interval '1 minute'");
  const action = { version: 1, id: 'restore-1', kind: 'hex_restored', occurredAt: Date.now(), quantity: 1, context: { targetId: 'spring', level: 1, regionId: 'grove', tags: ['seasonal'] } };
  const record = (a) => rpc('public.record_verified_live_action_v1($1,$2)', [user, JSON.stringify(a)]);
  await db.exec('set role service_role');
  assert.equal((await record(action)).duplicate, false);
  assert.equal((await record(action)).duplicate, true);
  await assert.rejects(record({ ...action, quantity: 2 }), /identity conflict/);
  await db.exec('reset role');
  let state = await rpc('public.get_live_event_state_v1()');
  assert.equal(state.harmony, 25);
  assert.equal(state.events.find((e) => e.definition.id === 'moonlit').points, 100);
  assert.equal(state.events.find((e) => e.definition.id === 'overlap').points, 5);
  await record({ ...action, id: 'wrong-region', context: { ...action.context, regionId: 'elsewhere' } });
  await record({ ...action, id: 'pre-enrollment', occurredAt: now - 1800000 });
  await record({ ...action, id: 'historic', historical: true });
  await record({ ...action, id: 'many', quantity: 100 });
  state = await rpc('public.get_live_event_state_v1()');
  assert.equal(state.harmony, 25, 'milestone identity caps permanent progress');
  assert.equal(state.events.find((e) => e.definition.id === 'moonlit').points, 300);
  await db.exec('set role authenticated');
  const claim = () => rpc("public.claim_live_event_reward_v1('moonlit','one','free')");
  assert.equal((await claim()).duplicate, false);
  assert.equal((await claim()).duplicate, true);
  assert.equal((await rpc("public.claim_live_event_reward_v1('moonlit','one','premium')")).reason, 'premium_disabled');
  assert.equal((await rpc("public.claim_live_event_reward_v1('moonlit','too-high','free')")).reason, 'not_eligible');
  assert.equal((await rpc("public.claim_live_event_reward_v1('moonlit','unsupported','free')")).reason, 'unsupported_reward');
  await db.exec('reset role');
  assert.equal((await query('select sum(delta)::integer as total from economy_gem_ledger'))[0].total, 20);
  assert.equal((await query('select count(*)::integer as n from economy_collectible_grants'))[0].n, 1);
  assert.equal((await query('select count(*)::integer as n from private.live_event_claims'))[0].n, 1);
  // A failure in the second reward rolls the first ledger write AND receipt back.
  await addDefinition({ ...definition, id:'rollback' });
  await rpc("public.enroll_live_event_v1('rollback')");
  await query("update private.live_event_progress set points=100 where event_id='rollback'");
  await db.exec(`create function public.reject_test_wisp() returns trigger language plpgsql as $$ begin raise exception 'injected delivery failure'; end $$;
    create trigger test_delivery_failure before insert on public.economy_collectible_grants for each row execute function public.reject_test_wisp();`);
  await assert.rejects(rpc("public.claim_live_event_reward_v1('rollback','one','free')"), /injected delivery failure/);
  assert.equal((await query("select count(*)::integer as n from private.live_event_claims where event_id='rollback'"))[0].n, 0);
  assert.equal((await query('select sum(delta)::integer as total from economy_gem_ledger'))[0].total, 20);
  await db.exec('drop trigger test_delivery_failure on public.economy_collectible_grants');
  assert.equal((await rpc("public.claim_live_event_reward_v1('rollback','one','free')")).ok, true);
  for (const [id, close] of [['grace', now + 7200000], ['expired', now - 1000]]) {
    await addDefinition({ ...definition, id, endsAt:new Date(now-2000).toISOString(),claimEndsAt:new Date(close).toISOString() });
    await query('insert into private.live_event_progress(user_id,event_id,points) values($1,$2,100)',[user,id]);
  }
  assert.equal((await rpc("public.claim_live_event_reward_v1('grace','one','free')")).ok, true);
  assert.equal((await rpc("public.claim_live_event_reward_v1('expired','one','free')")).reason, 'claims_closed');
  await assert.rejects(query("update private.live_event_definitions set definition=jsonb_set(definition,'{minHarmony}','99') where id='moonlit'"), /immutable/);
  await query("update private.live_event_definitions set enabled=false where id='moonlit'");
  assert.equal((await claim()).duplicate, true, 'receipt recovery survives retirement');
  await query("select set_config('test.user',$1,false)", [other]);
  state = await rpc('public.get_live_event_state_v1()');
  assert.equal(state.harmony, 0);
  assert.ok(state.events.every((e) => e.points === 0 && e.claims.length === 0));
  assert.equal((await claim()).reason, 'not_enrolled');
  // Executable parity contract: SQL scoring must agree with the Studio engine.
  await query("select set_config('test.user',$1,false)", [user]);
  const parity = { ...definition, id:'parity', rules:[
    {id:'region',kind:'merge',points:2,limit:3,filter:{regionId:'grove'}},
    {id:'target',kind:'merge',points:7,limit:2,filter:{companionId:'mossprout',targetId:'spring'}},
    {id:'constructor',kind:'merge',points:11,limit:3,filter:{minItemTier:5,tags:['moon','mist']}},
  ] };
  await addDefinition(parity);
  await rpc("public.enroll_live_event_v1('parity')");
  await query("update private.live_event_progress set enrolled_at=now()-interval '1 minute' where event_id='parity'");
  let preview = emptyEventProgress(parity);
  const contexts = [{}, {regionId:'grove'}, {regionId:'grove',companionId:'mossprout',targetId:'spring'},
    {itemTier:4,tags:['moon','mist']},{itemTier:5,tags:['moon']},{itemTier:5,tags:['mist','moon','extra']},
    {regionId:'grove',companionId:'mossprout',targetId:'spring',itemTier:9,tags:['moon','mist']}];
  for (const [index,context] of contexts.entries()) {
    const a = {...action,id:`parity-${index}`,kind:'merge',context,quantity:index===6?100:1};
    preview = scoreGameplayEvent(preview,parity,a);
    await record(a);
    const actual = (await rpc('public.get_live_event_state_v1()')).events.find((e)=>e.definition.id==='parity');
    assert.equal(actual.points,preview.points);
    assert.deepEqual(actual.ruleCounts,preview.ruleCounts);
  }
  await db.exec('set role anon');
  await assert.rejects(rpc('public.get_live_event_state_v1()'));
  await db.exec('reset role');
  console.log('PASS: trusted-only scoring, enrollment, caps, filters, replay protection, atomic bundles, retry, retirement and account isolation');
} catch (error) { console.error(error.message, error.where ?? ''); process.exitCode = 1; }
finally { await db.close(); }
