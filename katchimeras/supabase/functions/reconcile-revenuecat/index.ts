import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authorization = request.headers.get('authorization');
  if (!authorization) return json({ error: 'Authentication required' }, 401);
  const url = required('SUPABASE_URL');
  const publishable = required('SUPABASE_ANON_KEY');
  const userClient = createClient(url, publishable, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return json({ error: 'Authentication required' }, 401);

  const revenueCatKey = required('REVENUECAT_SECRET_API_KEY');
  const subscriberResponse = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`, {
    headers: { Authorization: `Bearer ${revenueCatKey}`, 'Content-Type': 'application/json' },
  });
  if (!subscriberResponse.ok) return json({ error: 'Purchase status unavailable' }, 502);
  const subscriberPayload = await subscriberResponse.json();
  const plus = subscriberPayload?.subscriber?.entitlements?.plus ?? null;
  const expiresAt = plus?.expires_date ?? null;
  const active = Boolean(plus && (!expiresAt || Date.parse(expiresAt) > Date.now()));
  const admin = createClient(url, required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  await admin.from('economy_subscriptions').upsert({
    user_id: user.id,
    revenuecat_app_user_id: user.id,
    entitlement_id: 'plus',
    product_id: plus?.product_identifier ?? null,
    active,
    original_purchase_at: plus?.purchase_date ?? null,
    expires_at: expiresAt,
    last_event_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return json({ ok: true, activePlus: active });
});

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info' };
function required(name: string) { const value = Deno.env.get(name); if (!value) throw new Error(`Missing ${name}`); return value; }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }); }
