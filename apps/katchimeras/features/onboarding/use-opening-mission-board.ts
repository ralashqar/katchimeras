import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import type { MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import { getStoredJson, removeStoredValue, setStoredJson } from '@/utils/app-storage';
import { normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { createOpeningMissionState, OPENING_MISSION_STORAGE_KEY, type StoredOpeningMission } from './opening-mission-state';

/**
 * A mist mission's board lives in its own store: the run it belongs to, the
 * board, and how many merges it has counted (a board with a spawner cannot
 * derive that from what is left on it). Nothing the persistent board does
 * between sessions can change what a mission shows.
 */
export type StoredMission = StoredOpeningMission & { merges?: number };
export type LoadedMission = { state: MergeWorldState; merges: number };

export function loadMission(storageKey: string, runId: string, now = Date.now()): LoadedMission | null {
  const stored = getStoredJson<StoredMission | null>(storageKey, null);
  if (!stored || stored.runId !== runId) return null;
  try {
    return { state: normalizeMergeWorldState(stored.state, now), merges: Math.max(0, Math.floor(stored.merges ?? 0)) };
  } catch {
    return null;
  }
}

export function saveMission(storageKey: string, runId: string, state: MergeWorldState, merges: number) {
  setStoredJson<StoredMission>(storageKey, { runId, state, merges });
}

export function clearMission(storageKey: string) {
  removeStoredValue(storageKey);
}

/**
 * One mission board: loaded from its store (or seeded fresh for a new run),
 * reduced by the ordinary engine, and written back synchronously after every
 * command, so a kill at any moment resumes to the board the player last saw.
 * Every merge is counted as it lands; `mergesRef` reads that count in the
 * same tick. Pass `null` as the run while no mission is active.
 */
export function useMissionBoard(storageKey: string, runId: string | null, create: (now: number) => MergeWorldState) {
  const [state, setState] = useState<MergeWorldState | null>(null);
  const [merges, setMerges] = useState(0);
  const stateRef = useRef<MergeWorldState | null>(null);
  const mergesRef = useRef(0);
  const runIdRef = useRef(runId);
  runIdRef.current = runId;
  const createRef = useRef(create);
  createRef.current = create;
  useEffect(() => {
    if (!runId) {
      stateRef.current = null;
      mergesRef.current = 0;
      setState(null);
      setMerges(0);
      return;
    }
    const loaded = loadMission(storageKey, runId) ?? { state: createRef.current(Date.now()), merges: 0 };
    saveMission(storageKey, runId, loaded.state, loaded.merges);
    stateRef.current = loaded.state;
    mergesRef.current = loaded.merges;
    setState(loaded.state);
    setMerges(loaded.merges);
  }, [runId, storageKey]);
  const send = useCallback((command: MergeWorldCommand): MergeWorldCommandResult | null => {
    const current = stateRef.current;
    const activeRunId = runIdRef.current;
    if (!current || !activeRunId) return null;
    const result = reduceMergeWorld(current, command);
    if (result.changed) {
      const merged = command.type === 'move' && result.mergedCell != null;
      const nextMerges = merged ? mergesRef.current + 1 : mergesRef.current;
      stateRef.current = result.state;
      mergesRef.current = nextMerges;
      saveMission(storageKey, activeRunId, result.state, nextMerges);
      setState(result.state);
      if (merged) setMerges(nextMerges);
    }
    return result;
  }, [storageKey]);
  return { state, merges, mergesRef: mergesRef as RefObject<number>, send };
}

export function loadOpeningMission(runId: string, now = Date.now()): MergeWorldState | null {
  return loadMission(OPENING_MISSION_STORAGE_KEY, runId, now)?.state ?? null;
}

export function saveOpeningMission(runId: string, state: MergeWorldState) {
  saveMission(OPENING_MISSION_STORAGE_KEY, runId, state, loadMission(OPENING_MISSION_STORAGE_KEY, runId)?.merges ?? 0);
}

export function clearOpeningMission() {
  clearMission(OPENING_MISSION_STORAGE_KEY);
}

/** The opening's mission board, for one FTUE run. */
export function useOpeningMissionBoard(runId: string | null) {
  return useMissionBoard(OPENING_MISSION_STORAGE_KEY, runId, createOpeningMissionState);
}
