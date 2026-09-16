import { supabase } from '@/utils/supabase';
import { ensureStreakIdentity } from '@/utils/streak-sync';
import { isDevProfileSandboxActive } from '@/utils/dev-profile-sandbox';
import { createLiveEventClient } from './client';

/** Account-scoped online operations. Local preview points never cross this boundary. */
export const liveEventService = createLiveEventClient(async (name, args) => {
  if (isDevProfileSandboxActive()) throw new Error('Online event claims are unavailable in a sandbox profile.');
  if (!await ensureStreakIdentity()) throw new Error('Sign in to use online events.');
  return supabase.rpc(name, args);
});
