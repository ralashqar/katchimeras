import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Safety sweep for the day-comic generator. generate-day-comic deletes its temp
// input photos in a `finally` after every request, so storage stays flat at any
// volume. This only catches ORPHANS — inputs left behind when a request was hard-
// killed (timeout / OOM) before its finally ran. It lists the flat comic-inputs
// prefix, pages through it, and removes anything older than the cutoff. Schedule
// it (e.g. hourly via pg_cron) for belt-and-suspenders cleanup.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const bucketName = 'katchimera-art-dev';
const prefix = 'comic-inputs';
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour — far longer than any generation
const PAGE_SIZE = 1000;

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing Supabase service role configuration.' }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const cutoff = Date.now() - MAX_AGE_MS;
  let scanned = 0;
  let removed = 0;
  let offset = 0;

  try {
    for (;;) {
      const { data, error } = await supabaseAdmin.storage.from(bucketName).list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) {
        return jsonResponse({ error: error.message, removed }, 500);
      }
      if (!data || data.length === 0) {
        break;
      }
      scanned += data.length;

      const stale = data
        .filter((item) => {
          const ts = item.created_at ?? (item as { updated_at?: string }).updated_at;
          return ts ? new Date(ts).getTime() < cutoff : false;
        })
        .map((item) => `${prefix}/${item.name}`);

      if (stale.length > 0) {
        const { error: removeError } = await supabaseAdmin.storage.from(bucketName).remove(stale);
        if (!removeError) {
          removed += stale.length;
        }
      }

      if (data.length < PAGE_SIZE) {
        break;
      }
      offset += PAGE_SIZE;
    }

    return jsonResponse({ status: 'ok', scanned, removed });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error', removed }, 500);
  }
});
