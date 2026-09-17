import { useSyncExternalStore } from 'react';
import { gameClock } from '@/utils/game-clock';
export function useGameClockOffset() {
  return useSyncExternalStore(gameClock.subscribe, gameClock.offset, gameClock.offset);
}
