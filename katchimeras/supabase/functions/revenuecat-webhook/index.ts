import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

type RevenueCatEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  product_id?: string;
  entitlement_ids?: string[];
  environment?: string;
  event_timestamp_ms?: number;
  purchased_at_ms?: number;
  expiration_at_ms?: number | null;
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);
  const rawBody = await request.text();
  const authorized = await verifyRequest(request.headers, rawBody);
  if (!authorized) return response({ error: 'Unauthorized' }, 401);

  let payload: { event?: RevenueCatEvent };
  try { payload = JSON.parse(rawBody); } catch { return response({ error: 'Invalid JSON' }, 400); }
  const event = payload.event;
  if (!event?.id || !event.type || !event.app_user_id || !event.event_timestamp_ms) return response({ error: 'Invalid event' }, 400);
  if (!/^[0-9a-f-]{36}$/i.test(event.app_user_id)) return response({ error: 'Unknown app user' }, 202);

  const admin = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const { error: receiptError } = await admin.from('revenuecat_webhook_events').insert({
    event_id: event.id,
    event_type: event.type,
    app_user_id: event.app_user_id,
    event_timestamp_ms: event.event_timestamp_ms,
    environment: event.environment ?? null,
    payload,
  });
  if (receiptError?.code === '23505') return response({ ok: true, idempotent: true });
  if (receiptError) return response({ error: 'Receipt failed' }, 500);

  const entitlementIds = event.entitlement_ids ?? [];
  const affectsPlus = entitlementIds.includes('plus')
    || ['katchimeras_plus_monthly', 'katchimeras_plus_annual'].includes(event.product_id ?? '');
  if (affectsPlus) {
    // Cancellation and billing issues can remain entitled until expiration.
    const active = !['EXPIRATION', 'REFUND', 'TRANSFER'].includes(event.type)
      && (!event.expiration_at_ms || event.expiration_at_ms > Date.now());
    const lastEventAt = new Date(event.event_timestamp_ms).toISOString();
    const { data: existing } = await admin.from('economy_subscriptions').select('last_event_at').eq('user_id', event.app_user_id).maybeSingle();
    if (!existing?.last_event_at || Date.parse(existing.last_event_at) <= event.event_timestamp_ms) {
      await admin.from('economy_subscriptions').upsert({
        user_id: event.app_user_id,
        revenuecat_app_user_id: event.app_user_id,
        entitlement_id: 'plus',
        product_id: event.product_id ?? null,
        active,
        environment: event.environment ?? null,
        original_purchase_at: event.purchased_at_ms ? new Date(event.purchased_at_ms).toISOString() : null,
        expires_at: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
        last_event_at: lastEventAt,
        updated_at: new Date().toISOString(),
      });
    }
  }
  await admin.from('revenuecat_webhook_events').update({ processed_at: new Date().toISOString() }).eq('event_id', event.id);
  return response({ ok: true });
});

async function verifyRequest(headers: Headers, rawBody: string) {
  const expectedAuthorization = Deno.env.get('REVENUECAT_WEBHOOK_AUTHORIZATION');
  if (expectedAuthorization && !constantTimeEqual(headers.get('authorization') ?? '', expectedAuthorization)) return false;
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SIGNING_SECRET');
  if (!secret) return Boolean(expectedAuthorization);
  const signatureHeader = headers.get('x-revenuecat-webhook-signature') ?? '';
  const parts = Object.fromEntries(signatureHeader.split(',').map((part) => part.split('=', 2)));
  const timestamp = parts.t;
  const supplied = parts.v1;
  if (!timestamp || !supplied || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const calculated = [...new Uint8Array(signed)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return constantTimeEqual(calculated, supplied);
}

function constantTimeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a[index] ^ b[index];
  return result === 0;
}

function required(name: string) { const value = Deno.env.get(name); if (!value) throw new Error(`Missing ${name}`); return value; }
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
