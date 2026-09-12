import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import type { MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import { flushDeferredStoredWrites, getStoredJson, removeStoredValue, setStoredJsonDeferred } from '@/utils/app-storage';
import { normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { createOpeningMissionState, OPENING_MISSION_STORAGE_KEY, type StoredOpeningMission } from './opening-mission-state';

/**
 * A mist mission's board lives in its own store: the run it belongs to, the
 * board, and how many merges it has counted (a board with a spawner cannot
 * derive that from what is left on it). Nothing the persistent board does
 * between sessions can change what a mission shows.
 */
export type StoredMission = StoredOpeningMission & { merges?: number; placedDeliveries?: number };
export type LoadedMission = { state: MergeWorldState; merges: number; placedDeliveries: number };

export function loadMission(storageKey: string, runId: string, now = Date.now()): LoadedMission | null {
  const stored = getStoredJson<StoredMission | null>(storageKey, null);
  if (!stored || stored.runId !== runId) return null;
  try {
    return { state: normalizeMergeWorldState(stored.state, now), merges: Math.max(0, Math.floor(stored.merges ?? 0)), placedDeliveries: Math.max(0, Math.floor(stored.placedDeliveries ?? 0)) };
  } catch {
    return null;
  }
}

/**
 * Written behind the frame: the board is saved a beat after each command rather than on it, so the
 * synchronous SQLite write never lands on the frame a merge animation starts. Reads see the pending
 * board at once; it is flushed on a timer, when the board unmounts, and when the app leaves the foreground.
 */
export function saveMission(storageKey: string, runId: string, state: MergeWorldState, merges: number, placedDeliveries = 0) {
  setStoredJsonDeferred<StoredMission>(storageKey, { runId, state, merges, placedDeliveries }, MISSION_SAVE_DELAY_MS);
}
const MISSION_SAVE_DELAY_MS = 150;

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
export function useMissionBoard(storageKey: string, runId: string | null, create: (now: number) => MergeWorldState, repair?: (state: MergeWorldState) => MergeWorldState) {
  const [state, setState] = useState<MergeWorldState | null>(null);
  const [merges, setMerges] = useState(0);
  const [placedDeliveries, setPlacedDeliveries] = useState(0);
  const stateRef = useRef<MergeWorldState | null>(null);
  const mergesRef = useRef(0);
  const placedRef = useRef(0);
  const runIdRef = useRef(runId);
  runIdRef.current = runId;
  const createRef = useRef(create);
  createRef.current = create;
  const repairRef = useRef(repair);
  repairRef.current = repair;
  useEffect(() => {
    if (!runId) {
      stateRef.current = null;
      mergesRef.current = 0;
      placedRef.current = 0;
      setState(null);
      setMerges(0);
      setPlacedDeliveries(0);
      return;
    }
    const stored = loadMission(storageKey, runId);
    // A saved board passes through the repair (authored pieces a stale save lost); a fresh one never needs it.
    const loaded = stored ? { ...stored, state: repairRef.current ? repairRef.current(stored.state) : stored.state } : { state: createRef.current(Date.now()), merges: 0, placedDeliveries: 0 };
    saveMission(storageKey, runId, loaded.state, loaded.merges, loaded.placedDeliveries);
    stateRef.current = loaded.state;
    mergesRef.current = loaded.merges;
    placedRef.current = loaded.placedDeliveries;
    setState(loaded.state);
    setMerges(loaded.merges);
    setPlacedDeliveries(loaded.placedDeliveries);
    // A board put away or a run that ends lands its last save at once.
    return () => flushDeferredStoredWrites(storageKey);
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
      saveMission(storageKey, activeRunId, result.state, nextMerges, placedRef.current);
      setState(result.state);
      if (merged) setMerges(nextMerges);
    }
    return result;
  }, [storageKey]);
  /**
   * Delivered items land on the board directly (no engine command makes an
   * item appear): each entry goes into its cell, and the count of placed
   * deliveries is saved with the board so a relaunch never places one twice.
   */
  const place = useCallback((entries: readonly { cell: number; definitionId: string }[]) => {
    const current = stateRef.current;
    const activeRunId = runIdRef.current;
    if (!current || !activeRunId || !entries.length) return;
    const board = [...current.board];
    let nextInstance = current.nextInstance;
    let landed = 0;
    for (const entry of entries) {
      const cell = board[entry.cell];
      if (!cell || cell.locked || cell.mist || cell.occupant) continue;
      board[entry.cell] = { ...cell, occupant: { kind: 'item', instanceId: `delivery:${nextInstance}`, definitionId: entry.definitionId } };
      nextInstance += 1;
      landed += 1;
    }
    // Nothing landed (the cell was taken meanwhile): no revision bump, nothing counted, so guidance does not re-lay out.
    if (!landed) return;
    const next: MergeWorldState = { ...current, board, nextInstance, revision: current.revision + 1 };
    const placed = placedRef.current + landed;
    stateRef.current = next;
    placedRef.current = placed;
    saveMission(storageKey, activeRunId, next, mergesRef.current, placed);
    setState(next);
    setPlacedDeliveries(placed);
  }, [storageKey]);
  return { state, merges, mergesRef: mergesRef as RefObject<number>, placedDeliveries, send, place };
}

export function loadOpeningMission(runId: string, now = Date.now()): MergeWorldState | null {
  return loadMission(OPENING_MISSION_STORAGE_KEY, runId, now)?.state ?? null;
}

export function saveOpeningMission(runId: string, state: MergeWorldState) {
  const existing = loadMission(OPENING_MISSION_STORAGE_KEY, runId);
  saveMission(OPENING_MISSION_STORAGE_KEY, runId, state, existing?.merges ?? 0, existing?.placedDeliveries ?? 0);
}

export function clearOpeningMission() {
  clearMission(OPENING_MISSION_STORAGE_KEY);
}

/** The opening's mission board, for one FTUE run. */
export function useOpeningMissionBoard(runId: string | null) {
  return useMissionBoard(OPENING_MISSION_STORAGE_KEY, runId, createOpeningMissionState);
}
