import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Use an isolated PGlite installation; this script never connects to Supabase.
const modulePath = process.env.KATCHIMERAS_PGLITE_MODULE;
const { PGlite } = await import(modulePath ? pathToFileURL(modulePath).href : '@electric-sql/pglite');
const db = new PGlite();
const foundation = readFileSync('supabase/migrations/20260809131842_create_economy_foundation.sql', 'utf8');
const migration = readFileSync('supabase/migrations/20260916133000_live_ops_release_and_delivery.sql', 'utf8');
try {
  await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);');
  for (const table of ['economy_subscriptions', 'revenuecat_webhook_events']) {
    const definition = foundation.match(new RegExp(`create table public.${table} \\([\\s\\S]*?\\n\\);`))?.[0];
    assert.ok(definition, `${table} baseline exists`);
    await db.exec(definition);
  }
  await db.exec(migration);
  await db.exec(migration); // migration is safe after the out-of-order content baseline
  const user = '11111111-1111-4111-8111-111111111111';
  await db.query('insert into auth.users values ($1)', [user]);
  await db.exec(`insert into public.content_packs(id,version,content_schema_version,manifest,enabled) values
    ('a',1,1,'{"id":"a","version":1}',true), ('b',1,2,'{"id":"b","version":1}',true),
    ('off',1,1,'{}',false), ('future-schema',1,99,'{}',true);`);
  const release = (await db.query("select public.get_content_release_v2('1.0.0',2) as result")).rows[0].result;
  assert.deepEqual(release.packs.map((pack) => pack.id), ['a', 'b']);
  const older = (await db.query("select public.get_content_release_v2('1.0.0',1) as result")).rows[0].result;
  assert.deepEqual(older.packs.map((pack) => pack.id), ['a']);
  const event = { id: 'purchase-1', type: 'INITIAL_PURCHASE', app_user_id: user, product_id: 'katchimeras_plus_monthly', entitlement_ids: ['plus'], environment: 'SANDBOX', event_timestamp_ms: Date.now(), expiration_at_ms: Date.now() + 86_400_000 };
  const processEvent = async (e) => (await db.query('select public.process_revenuecat_event_v2($1::jsonb) as result', [JSON.stringify({ event: e })])).rows[0].result;
  assert.equal((await processEvent(event)).idempotent, false);
  assert.equal((await processEvent(event)).idempotent, true);
  await processEvent({ ...event, id: 'late-expiry', type: 'EXPIRATION', event_timestamp_ms: event.event_timestamp_ms - 1 });
  assert.equal((await db.query('select active from economy_subscriptions')).rows[0].active, true);
  const pending = { ...event, id: 'previously-received' };
  await db.query('insert into revenuecat_webhook_events(event_id,event_type,app_user_id,event_timestamp_ms,payload) values($1,$2,$3,$4,$5)', [pending.id, pending.type, user, pending.event_timestamp_ms, JSON.stringify({ event: pending })]);
  assert.equal((await processEvent(pending)).idempotent, false);
  const broken = { ...event, id: 'missing-account', app_user_id: '22222222-2222-4222-8222-222222222222' };
  await assert.rejects(processEvent(broken));
  assert.equal((await db.query("select count(*)::integer as n from revenuecat_webhook_events where event_id='missing-account'")).rows[0].n, 0);
  const grants = (await db.query("select has_function_privilege('authenticated','public.process_revenuecat_event_v2(jsonb)','execute') as client, has_function_privilege('service_role','public.process_revenuecat_event_v2(jsonb)','execute') as server")).rows[0];
  assert.equal(grants.client, false);
  assert.equal(grants.server, true);
  console.log('PASS: release compatibility, overlapping packs, transactional purchase retry, rollback, ordering and permissions');
} finally { await db.close(); }
