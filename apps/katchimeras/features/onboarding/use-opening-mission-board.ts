import { useCallback, useEffect, useRef, useState } from 'react';

import type { MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import { getStoredJson, removeStoredValue, setStoredJson } from '@/utils/app-storage';
import { normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { createOpeningMissionState, OPENING_MISSION_STORAGE_KEY, type StoredOpeningMission } from './opening-mission-state';

export function loadOpeningMission(runId: string, now = Date.now()): MergeWorldState | null {
  const stored = getStoredJson<StoredOpeningMission | null>(OPENING_MISSION_STORAGE_KEY, null);
  if (!stored || stored.runId !== runId) return null;
  try {
    return normalizeMergeWorldState(stored.state, now);
  } catch {
    return null;
  }
}

export function saveOpeningMission(runId: string, state: MergeWorldState) {
  setStoredJson<StoredOpeningMission>(OPENING_MISSION_STORAGE_KEY, { runId, state });
}

export function clearOpeningMission() {
  removeStoredValue(OPENING_MISSION_STORAGE_KEY);
}

/**
 * The mission board for one FTUE run: loaded from its own store (or seeded
 * fresh for a new run), reduced by the ordinary engine, and written back
 * synchronously after every command, so a kill at any moment resumes to the
 * board the player last saw. Pass `null` when no opening run is active.
 */
export function useOpeningMissionBoard(runId: string | null) {
  const [state, setState] = useState<MergeWorldState | null>(null);
  const stateRef = useRef<MergeWorldState | null>(null);
  const runIdRef = useRef(runId);
  runIdRef.current = runId;
  useEffect(() => {
    if (!runId) {
      stateRef.current = null;
      setState(null);
      return;
    }
    const loaded = loadOpeningMission(runId) ?? createOpeningMissionState(Date.now());
    saveOpeningMission(runId, loaded);
    stateRef.current = loaded;
    setState(loaded);
  }, [runId]);
  const send = useCallback((command: MergeWorldCommand): MergeWorldCommandResult | null => {
    const current = stateRef.current;
    const activeRunId = runIdRef.current;
    if (!current || !activeRunId) return null;
    const result = reduceMergeWorld(current, command);
    if (result.changed) {
      stateRef.current = result.state;
      saveOpeningMission(activeRunId, result.state);
      setState(result.state);
    }
    return result;
  }, []);
  return { state, send };
}
