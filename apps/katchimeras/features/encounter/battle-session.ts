import { useSyncExternalStore } from 'react';
import type { RegionMissionDefinition } from '@/constants/island-campaigns/types';
import type { EncounterDefinition, EncounterLoadout } from '@/types/encounter';
import type { DayBackgroundSceneId } from '@/types/home';
import type { MergeWorldState } from '@/types/merge-world';
import type { EncounterOutcome } from './outcome';
import { getStoredJson, onStorageReset, setStoredJson } from '@/utils/app-storage';
import { encounterRunId } from './run-id';
import { encounterProfile } from './spawner-profile';
import type { BattleTileScene } from './battle-tile';
import type { BattleTileFraming } from './battle-framing';

/** Rollback preserves the existing saves and embedded encounter path. */
export const BATTLE_SCENE_ENABLED = process.env.EXPO_PUBLIC_BATTLE_SCENE !== '0';
const KEY = 'katchimeras.battle-session.v1';
export type IslandBattleContext = { campaignId?: string; islandId?: string; frontierTileId?: string; structureId?: string; mission: RegionMissionDefinition; loadout: EncounterLoadout };
export type BattleSource = { kind: 'island'; context: IslandBattleContext }
  | { kind: 'first'; run: string }
  | { kind: 'trail'; run: string; index: number }
  | { kind: 'rescue'; companion: string; run: string };
export type BattleSession = {
  prepared?: boolean;
  version: 1;
  id: string;
  sourceKey: string;
  source: BattleSource;
  encounter: EncounterDefinition;
  loadout: EncounterLoadout;
  world: Pick<MergeWorldState, 'heartwoodBuildings' | 'chapterOpeningsSeen'> & Partial<Pick<MergeWorldState, 'heroBuildings' | 'chaptersClaimed'>>;
  backdrop: DayBackgroundSceneId;
  tileScene?: BattleTileScene;
  tileFraming?: BattleTileFraming;
  status: 'playing' | 'returning' | 'returned';
  result?: { kind: 'won'; outcome: EncounterOutcome; runId: string } | { kind: 'left' };
};
let current: BattleSession | null | undefined;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
onStorageReset(() => { current = null; listeners.forEach((listener) => listener()); });
export function getBattleSession(): BattleSession | null {
  if (current === undefined) {
    const saved = getStoredJson<BattleSession | null>(KEY, null);
    current = saved?.version === 1 && saved.encounter?.storageKey && saved.sourceKey && saved.id
      && saved.world && saved.loadout && saved.source && ['island', 'first', 'trail', 'rescue'].includes(saved.source.kind)
      && ['playing', 'returning', 'returned'].includes(saved.status)
      && (saved.status === 'playing' || saved.result?.kind === 'left' || (saved.result?.kind === 'won' && saved.result.runId && saved.result.outcome)) ? saved : null;
  }
  return current;
}
export function saveBattleSession(session: BattleSession) {
  // Persist before publishing: return/reward recovery survives process death.
  setStoredJson(KEY, session);
  current = session;
  listeners.forEach((listener) => listener());
}
export function startBattleSession(input: Omit<BattleSession, 'id' | 'status' | 'version' | 'result'>): BattleSession {
  const previous = getBattleSession();
  if (previous?.sourceKey === input.sourceKey && previous.status === 'playing' && previous.encounter.mechanic?.kind === 'lanes' && previous.encounter.mechanic.rulesVersion === 2) return previous;
  const loadout = input.encounter.mechanic?.kind === 'lanes' && input.encounter.mechanic.rulesVersion === 2
    ? { ...input.loadout, combatProfile: input.loadout.combatProfile ?? encounterProfile(input.world, input.loadout) } : input.loadout;
  const session: BattleSession = { ...input, loadout, version: 1, id: previous?.sourceKey === input.sourceKey ? previous.id : `${input.encounter.id}:${Date.now()}`, status: 'playing' };
  saveBattleSession(session);
  return session;
}
/** Restore retries only when the persisted board belongs to this encounter and loadout. */
export function battleResumeAttempt(session: BattleSession, saved: { runId?: string; run?: { attempt?: number } } | null): number {
  const attempt = saved?.run?.attempt;
  return Number.isSafeInteger(attempt) && attempt! > 0 && saved?.runId === encounterRunId(session.encounter, attempt!, session.loadout) ? attempt! : 1;
}
const noBattleSession = () => null;
export function useBattleSession(enabled = true) {
  // Embedded battles must use their own outcomes, even with a dedicated result on disk.
  const snapshot = enabled ? getBattleSession : noBattleSession;
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
