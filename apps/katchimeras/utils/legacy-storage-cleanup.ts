import { companionHasPage } from '@/features/companion/companion-page-policy';
import { getStoredKeys, removeStoredValue } from '@/utils/app-storage';

/**
 * Stores the retired companion interaction generation wrote, removed once at
 * boot: the discovery-prompt answers, and the daily conversation records of
 * every family that no longer has a page. The stores of Mossprout and the
 * hatchable friends are untouched; their own normalisers drop retired fields.
 */
const RETIRED_KEYS = ['katchadeck.companion-discovery-v1'];
const DAILY_CONVERSATION_KEY = /^katchadeck\.daily-conversation\.([a-z-]+)\.v1$/;

export function runLegacyStorageCleanup(): string[] {
  const removed: string[] = [];
  let keys: string[];
  try { keys = getStoredKeys(); } catch { return removed; }
  for (const key of keys) {
    const daily = DAILY_CONVERSATION_KEY.exec(key);
    if (!RETIRED_KEYS.includes(key) && !(daily && !companionHasPage(daily[1]))) continue;
    try { removeStoredValue(key); removed.push(key); } catch { /* a key that cannot be removed stays; nothing reads it. */ }
  }
  return removed;
}
