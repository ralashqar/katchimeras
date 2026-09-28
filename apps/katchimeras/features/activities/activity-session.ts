import { useSyncExternalStore } from 'react';
import { getStoredJson, onStorageReset, setStoredJson } from '@/utils/app-storage';
import type { BattleTileScene } from '@/features/encounter/battle-tile';
import type { BattleTileFraming } from '@/features/encounter/battle-framing';
import type { DayBackgroundSceneId } from '@/types/home';
import type { HeatOutcome } from '@/features/time-trial/trial-world';

export type ActivitySource = { kind: 'cafe'; kitchen: boolean; goalId: string | null }
  | { kind: 'event'; eventId: string; nodeId: string }
  | { kind: 'rush'; dayId: string; index: number; attempt: number };
export type ActivityResult = { goalCompleted?: boolean; eventComplete?: boolean;
  rush?: { index: number; score: number; outcome: HeatOutcome }; notice?: string };
export type ActivitySession = {
  version: 1; id: string; source: ActivitySource; status: 'playing' | 'returning';
  tileLayerId: string; tileScene: BattleTileScene; tileFraming: BattleTileFraming;
  backdrop: DayBackgroundSceneId; result?: ActivityResult;
};
const KEY = 'katchimeras.activity-session.v1';
let current: ActivitySession | null | undefined;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
onStorageReset(() => { current = null; listeners.forEach(listener => listener()); });
export function getActivitySession(): ActivitySession | null {
  if (current === undefined) {
    const saved = getStoredJson<ActivitySession | null>(KEY, null);
    current = saved?.version === 1 && saved.id && ['cafe', 'event', 'rush'].includes(saved.source?.kind)
      && ['playing', 'returning'].includes(saved.status) && saved.tileLayerId && saved.tileScene
      && saved.tileFraming?.viewport.width > 0 && saved.tileFraming.viewport.height > 0 ? saved : null;
  }
  return current;
}
export function saveActivitySession(session: ActivitySession | null) {
  setStoredJson(KEY, session);
  current = session;
  listeners.forEach(listener => listener());
}
export function startActivitySession(input: Omit<ActivitySession, 'id' | 'version' | 'status' | 'result'>) {
  const session: ActivitySession = { ...input, id: `${input.source.kind}:${Date.now()}`, version: 1, status: 'playing' };
  saveActivitySession(session);
  return session;
}
export const useActivitySession = () => useSyncExternalStore(subscribe, getActivitySession, getActivitySession);
