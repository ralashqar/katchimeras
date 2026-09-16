import Storage from 'expo-sqlite/kv-store';
import { openDatabaseSync } from 'expo-sqlite';
import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_AUTH_STORAGE_KEY } from '@/utils/supabase';
import { ensureStreakIdentity } from '@/utils/streak-sync';
import { isDevProfileSandboxActive } from '@/utils/dev-profile-sandbox';
import { createPilotQueue, type PilotQueue, type PilotReply } from './pilot-queue';
import { resolveReplayRuleset, rulesetId } from './generated/registry';
import { openLocalProfile } from './local-profile';
import { withPilotDeadline } from './pilot-deadline';

const queues = new Map<string, PilotQueue>();
function deviceIdentity() {
  const key = 'verified-merge-device-v1';
  const stored = Storage.getItemSync(key);
  if (stored) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(stored)) throw new Error('Invalid pilot device identity');
    return stored;
  }
  // Identity is a public identifier, not an authentication secret. Use SQLite's native RNG.
  const db = openDatabaseSync('verified-merge-identity.db');
  let hex: string;
  try { hex = db.getFirstSync<{ value: string }>('select lower(hex(randomblob(16))) as value')!.value; }
  finally { db.closeSync(); }
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
  Storage.setItemSync(key, id);
  return id;
}

/** No auth calls, refresh, requests or anonymous account creation on the local path. */
export function openPilotQueue() {
  return openLocalProfile(() => localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY), queueForAccount);
}

/** Explicit first-time online setup, separate from opening an existing save. */
export async function setupPilotQueueOnline() {
  if (isDevProfileSandboxActive()) throw new Error('Leave the sandbox profile to use the verified pilot');
  const accountId = await withPilotDeadline(ensureStreakIdentity);
  if (!accountId) throw new Error('Connection required to set up the verified pilot');
  const opened = openPilotQueue();
  if (opened.accountId !== accountId) throw new Error('Account changed; reopen the pilot');
  return opened;
}

function queueForAccount(accountId: string) {
  if (isDevProfileSandboxActive()) throw new Error('Leave the sandbox profile to use the verified pilot');
  const cached = queues.get(accountId);
  if (cached) return { accountId, queue: cached };
  const deviceId = deviceIdentity();
  const key = `verified-merge-queue-v1:${accountId}`;
  async function client() {
    const { data: { session } } = await supabase.auth.getSession();
    if (isDevProfileSandboxActive() || session?.user.id !== accountId) throw new Error('Account changed; reopen the pilot');
    // Capture this account's token; a concurrent sign-out cannot redirect an operation to another account.
    return createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!,
      (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_KEY)!, {
        global: {
          headers: { Authorization: `Bearer ${session.access_token}` },
          // A hung request must not retain the sync lock indefinitely. Its batch stays retryable.
          fetch: async (input, init) => {
            const controller = new AbortController();
            const abort = () => controller.abort();
            init?.signal?.addEventListener('abort', abort, { once: true });
            if (init?.signal?.aborted) controller.abort();
            const timer = setTimeout(abort, 20000);
            try { return await fetch(input, { ...init, signal: controller.signal }); }
            finally { clearTimeout(timer); init?.signal?.removeEventListener('abort', abort); }
          },
        },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
  }
  async function invoke(body: Record<string, unknown>): Promise<PilotReply> {
    const scoped = await client();
    const { data, error } = await scoped.functions.invoke('verify-merge', { body });
    if (error) {
      if (error.context instanceof Response) {
        const reply = await error.context.json();
        if (reply?.ok === false) return reply;
      }
      throw new Error('Pilot unavailable; saved commands can be retried');
    }
    return data;
  }
  const queue = createPilotQueue(accountId, deviceId, {
    read: () => Storage.getItemSync(key), write: (value) => Storage.setItemSync(key, value),
    rulesetId,
    supportsRuleset: (id) => Boolean(resolveReplayRuleset(id)),
    supportsTiming: (id) => resolveReplayRuleset(id)?.replayTiming === 'bounded-action-times-v1',
    predict: (checkpoint, batch, now) => {
      const runtime = resolveReplayRuleset(checkpoint.rulesetId);
      if (!runtime) throw new Error('Original ruleset is unavailable; saved moves are preserved');
      return runtime.replayVerifiedBatch(checkpoint, batch, now);
    },
    begin: () => withPilotDeadline(() => invoke({ operation: 'begin', deviceId })),
    submit: (batch) => withPilotDeadline(() => invoke({ operation: 'submit', batch })),
    transfer: (epoch) => withPilotDeadline(async () => {
      const scoped = await client();
      const { data, error } = await scoped.rpc('transfer_verified_merge_v1', { new_device_id: deviceId, expected_epoch: epoch });
      if (error) throw new Error('Recovery response unavailable; retry recovery to check ownership');
      return data;
    }),
  });
  queues.set(accountId, queue);
  return { accountId, queue };
}
