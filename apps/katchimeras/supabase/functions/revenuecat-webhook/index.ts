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
  const { data, error } = await admin.rpc('process_revenuecat_event_v2', { payload });
  // A missing migration or a failed entitlement write must be retried by the provider.
  if (error) return response({ error: 'Purchase event processing failed' }, 500);
  return response(data ?? { ok: true });
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
