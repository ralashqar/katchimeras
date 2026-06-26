import type { HomeDayRecord } from '@/types/home';
import type { WorldPatch } from '@/types/world';
import { getStoredJson, removeStoredValue, setStoredJson } from '@/utils/app-storage';
import { deriveTodayPatch } from '@/utils/today-patch-engine';

// Stored separately from the world (utils/world-storage) so growing today's live
// preview never round-trips through buildWorld's WorldState. One patch, for the
// current day only; replaced wholesale when the calendar rolls over.
export const TODAY_PATCH_STORAGE_KEY = 'katchadeck.today-patch-v1';

export function loadTodayPatch(): WorldPatch | null {
  const patch = getStoredJson<WorldPatch | null>(TODAY_PATCH_STORAGE_KEY, null);
  if (!patch || typeof patch !== 'object' || !Array.isArray(patch.objects)) return null;
  return patch;
}

export function saveTodayPatch(patch: WorldPatch) {
  setStoredJson(TODAY_PATCH_STORAGE_KEY, patch);
}

// Dev-only: drop the stored live patch so today's tile rebuilds from a bare patch.
export function clearTodayPatch() {
  removeStoredValue(TODAY_PATCH_STORAGE_KEY);
}

// The one call the app makes: grow today's live patch from the day and persist
// it. The previous patch is reused only when it belongs to the same day, so a
// calendar rollover starts the new day from a bare patch. Returns null once the
// day has hatched — the finalized tile lives in the world from then on.
export function syncTodayPatch(day: HomeDayRecord): WorldPatch | null {
  if (day.state === 'hatched') return null;
  const stored = loadTodayPatch();
  const prev = stored && stored.dayId === day.id ? stored : null;
  const next = deriveTodayPatch(day, prev);
  saveTodayPatch(next);
  return next;
}
