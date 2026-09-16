import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createReplayHandler } from './generated/replay.mjs';
import ruleset from './generated/ruleset.json' with { type: 'json' };
import { replayRulesets } from './generated/registry.mjs';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info' };
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (Deno.env.get('VERIFIED_MERGE_PILOT_ENABLED') !== 'true') return Response.json({ ok: false, reason: 'pilot_disabled' }, { status: 503, headers: cors });
  const url = required('SUPABASE_URL');
  const admin = createClient(url, required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const handler = createReplayHandler({
    rulesetId: ruleset.rulesetId,
    rulesets: replayRulesets,
    authenticate: async (authorization: string) => {
      const client = createClient(url, required('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
      const { data, error } = await client.auth.getUser();
      return error ? null : data.user?.id ?? null;
    },
    rpc: (name: string, args: Record<string, unknown>) => admin.rpc(name, args),
  });
  const response = await handler(request);
  for (const [name,value] of Object.entries(cors)) response.headers.set(name,value);
  return response;
});
function required(name: string) { const value = Deno.env.get(name); if (!value) throw new Error(`Missing ${name}`); return value; }
