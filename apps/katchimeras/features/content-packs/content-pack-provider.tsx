import { useEffect } from 'react';

import { CONTENT_SCHEMA_VERSION } from '@/types/content-pack';
import { supabase } from '@/utils/supabase';
import { activateContentReleaseDocuments } from './content-pack-activation';
import { APP_VERSION } from './prime';

/**
 * Keeps the stored pack in step with the server, after the first render and
 * never in the player's way: a newer pack is fetched, checked whole, its art
 * downloaded, and saved for the next launch; a pack the server no longer
 * offers (disabled, or its window closed) is put away for the next launch.
 * The pack the app is playing right now is never swapped mid-session.
 */
export function ContentPackProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      let { data, error } = await supabase.rpc('get_content_release_v2', { app_version: APP_VERSION, schema_version: CONTENT_SCHEMA_VERSION });
      // Older deployments remain readable. Network/permission failures are not an empty release.
      let legacy = false;
      if (error?.code === 'PGRST202' || error?.code === '42883') {
        legacy = true;
        ({ data, error } = await supabase.rpc('get_content_pack_v1', { app_version: APP_VERSION, schema_version: CONTENT_SCHEMA_VERSION }));
      }
      if (cancelled || error) return;
      const offered = data && typeof data === 'object' ? data as { pack?: unknown; packs?: unknown[] } : null;
      if (!legacy && !Array.isArray(offered?.packs)) return;
      const result = await activateContentReleaseDocuments(legacy ? offered?.pack ? [offered.pack] : [] : offered!.packs!);
      if (!result.ok && __DEV__) console.warn(`[content-packs] the offered pack was refused: ${result.issues.join('; ')}`);
    };
    void sync().catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  return <>{children}</>;
}
