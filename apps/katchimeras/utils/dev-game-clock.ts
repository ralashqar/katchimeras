import { getStoredJson, setStoredJson, removeStoredValue } from '@/utils/app-storage';
import { gameClock } from '@/utils/game-clock';
import { DEV_TOOLS_ENABLED } from '@/constants/dev';

const KEY = 'katchadeck.dev.game-clock-offset-v1';
// Imported at app startup before gameplay providers initialise.
gameClock.setOffset(getStoredJson<number>(KEY, 0));

export function advanceDevGameTime(milliseconds: number) {
  if (!DEV_TOOLS_ENABLED || !Number.isSafeInteger(milliseconds) || milliseconds <= 0) return;
  const next = gameClock.offset() + milliseconds;
  if (!Number.isSafeInteger(next)) return;
  setStoredJson(KEY, next);
  gameClock.setOffset(next);
}

export function resetDevGameTime() {
  removeStoredValue(KEY);
  gameClock.setOffset(0);
}
