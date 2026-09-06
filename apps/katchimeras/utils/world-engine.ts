import type { HomeDayRecord } from '@/types/home';
import type { WorldState } from '@/types/world';
import { buildWorld } from '@/utils/world-build';
import { loadWorldState, saveWorldState } from '@/utils/world-storage';

// The one call the app makes: fold any newly-hatched days into the persisted
// world and return the fresh state. Idempotent — days already built are skipped.
// Called by the World tab on focus and by the post-hatch "your world grew" beat.
export function syncWorldFromDays(days: HomeDayRecord[]): WorldState {
  const next = buildWorld(loadWorldState(), days);
  saveWorldState(next);
  return next;
}
