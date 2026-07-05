import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Asset Lab promotion drop-box: the dev app uploads an APPROVED draft here
// (assetKey encoded in the filename), and scripts/promote-dev-assets.py pulls
// the folder, optimizes (trim → resize → WebP), and writes bundled assets.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const bucketName = 'katchimera-art-dev';
const APPROVED_PREFIX = 'asset-lab-approved';

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing Supabase service configuration.' }, 500);
  }

  let body: { assetKey?: string; base64?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const assetKey = typeof body.assetKey === 'string' ? body.assetKey : '';
  if (!/^[a-z0-9_:-]+$/.test(assetKey) || typeof body.base64 !== 'string' || body.base64.length === 0) {
    return jsonResponse({ error: 'Provide assetKey ([a-z0-9_:-]+) and base64.' }, 400);
  }

  try {
    const bytes = Uint8Array.from(atob(body.base64), (char) => char.charCodeAt(0));
    // '__' separates assetKey from the stamp so the promote script can parse it
    // back (assetKeys themselves never contain '__').
    const safeKey = assetKey.replace(/:/g, '-');
    const path = `${APPROVED_PREFIX}/${safeKey}__${Date.now()}.png`;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(path, bytes.buffer as ArrayBuffer, { contentType: 'image/png', upsert: false });
    if (error) {
      throw new Error(error.message);
    }
    return jsonResponse({ status: 'approved', path });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Approve failed.';
    return jsonResponse({ error: message }, 502);
  }
});
