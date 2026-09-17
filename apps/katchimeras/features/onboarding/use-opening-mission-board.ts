import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import type { MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import type { MissionMechanicState, MissionStrike } from '@/types/mission-mechanic';
import type { MissionWindow } from '@/features/mission-mechanics/board-window';
import { createMechanicState, mechanicSaveState, normalizeMechanicState, resolveMechanic, strikeFor, type MissionMechanicHost, type MissionStrikeEvent } from '@/features/mission-mechanics/mechanic';
import { flushDeferredStoredWrites, getStoredJson, removeStoredValue, setStoredJsonDeferred } from '@/utils/app-storage';
import { normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { createOpeningMissionState, OPENING_MISSION_STORAGE_KEY, type StoredOpeningMission } from './opening-mission-state';

/**
 * A mist mission's board lives in its own store: the run it belongs to, the
 * board, how many merges it has counted (a board with a spawner cannot
 * derive that from what is left on it), and what its mechanic remembers (a
 * column-shot board's damage on each wisp). Nothing the persistent board does
 * between sessions can change what a mission shows.
 */
export type StoredMission = StoredOpeningMission & { merges?: number; placedDeliveries?: number; mechanic?: { damage: number[] } };
export type LoadedMission = { state: MergeWorldState; merges: number; placedDeliveries: number; mechanicState: MissionMechanicState | null };

/** What the board plays by: the mission (or restoration) it is authored on and the window it shows. */
export type MissionMechanicBinding = { host: MissionMechanicHost; window: MissionWindow };

/** A board command's result, with the strike it produced on the wisps when the board has a mechanic bound. */
export type MissionCommandResult = MergeWorldCommandResult & { strike?: MissionStrike | null };

export function loadMission(storageKey: string, runId: string, now = Date.now(), mechanic?: MissionMechanicBinding | null): LoadedMission | null {
  const stored = getStoredJson<StoredMission | null>(storageKey, null);
  if (!stored || stored.runId !== runId) return null;
  try {
    const merges = Math.max(0, Math.floor(stored.merges ?? 0));
    // A mechanic that cannot read what the board saved: the board is not readable either, and is seeded fresh.
    const mechanicState = mechanic ? normalizeMechanicState(resolveMechanic(mechanic.host), stored.mechanic, merges) : null;
    if (mechanic && !mechanicState) return null;
    return { state: normalizeMergeWorldState(stored.state, now), merges, placedDeliveries: Math.max(0, Math.floor(stored.placedDeliveries ?? 0)), mechanicState };
  } catch {
    return null;
  }
}

/**
 * Written behind the frame: the board is saved a beat after each command rather than on it, so the
 * synchronous SQLite write never lands on the frame a merge animation starts. Reads see the pending
 * board at once; it is flushed on a timer, when the board unmounts, and when the app leaves the foreground.
 */
export function saveMission(storageKey: string, runId: string, state: MergeWorldState, merges: number, placedDeliveries = 0, mechanic?: { damage: number[] }) {
  setStoredJsonDeferred<StoredMission>(storageKey, { runId, state, merges, placedDeliveries, ...(mechanic ? { mechanic } : {}) }, MISSION_SAVE_DELAY_MS);
}
const MISSION_SAVE_DELAY_MS = 150;

export function clearMission(storageKey: string) {
  removeStoredValue(storageKey);
}

/** The strike a command's result describes: the cell holding what a merge or waking made. */
export function missionStrikeEvent(result: MergeWorldCommandResult): MissionStrikeEvent | null {
  if (result.mergedCell == null) return null;
  const made = result.state.board[result.mergedCell]?.occupant;
  if (made?.kind !== 'item') return null;
  return { type: result.dreamEchoClearedId ? 'dream_echo_cleared' : 'merge_completed', resultCell: result.mergedCell, resultDefinitionId: made.definitionId };
}

/**
 * One mission board: loaded from its store (or seeded fresh for a new run),
 * reduced by the ordinary engine, and written back synchronously after every
 * command, so a kill at any moment resumes to the board the player last saw.
 * Every merge is counted as it lands; `mergesRef` reads that count in the
 * same tick. With a mechanic bound, every merge is also resolved into the
 * strike it makes on the wisps, saved with the board and returned with the
 * command's result. Pass `null` as the run while no mission is active.
 */
export function useMissionBoard(storageKey: string, runId: string | null, create: (now: number) => MergeWorldState, repair?: (state: MergeWorldState) => MergeWorldState, mechanic?: MissionMechanicBinding | null) {
  const [state, setState] = useState<MergeWorldState | null>(null);
  const [merges, setMerges] = useState(0);
  const [placedDeliveries, setPlacedDeliveries] = useState(0);
  const [mechanicState, setMechanicState] = useState<MissionMechanicState | null>(null);
  // Bumped by `reset`: the saved board is cleared and the store loads again (a fresh seed).
  const [revision, setRevision] = useState(0);
  const stateRef = useRef<MergeWorldState | null>(null);
  const mergesRef = useRef(0);
  const placedRef = useRef(0);
  const mechanicStateRef = useRef<MissionMechanicState | null>(null);
  const runIdRef = useRef(runId);
  runIdRef.current = runId;
  const createRef = useRef(create);
  createRef.current = create;
  const repairRef = useRef(repair);
  repairRef.current = repair;
  const mechanicRef = useRef(mechanic ?? null);
  mechanicRef.current = mechanic ?? null;
  useEffect(() => {
    if (!runId) {
      stateRef.current = null;
      mergesRef.current = 0;
      placedRef.current = 0;
      mechanicStateRef.current = null;
      setState(null);
      setMerges(0);
      setPlacedDeliveries(0);
      setMechanicState(null);
      return;
    }
    const binding = mechanicRef.current;
    const stored = loadMission(storageKey, runId, Date.now(), binding);
    // A saved board passes through the repair (authored pieces a stale save lost); a fresh one never needs it.
    const loaded: LoadedMission = stored
      ? { ...stored, state: repairRef.current ? repairRef.current(stored.state) : stored.state }
      : { state: createRef.current(Date.now()), merges: 0, placedDeliveries: 0, mechanicState: binding ? createMechanicState(resolveMechanic(binding.host)) : null };
    saveMission(storageKey, runId, loaded.state, loaded.merges, loaded.placedDeliveries, mechanicSaveState(loaded.mechanicState));
    stateRef.current = loaded.state;
    mergesRef.current = loaded.merges;
    placedRef.current = loaded.placedDeliveries;
    mechanicStateRef.current = loaded.mechanicState;
    setState(loaded.state);
    setMerges(loaded.merges);
    setPlacedDeliveries(loaded.placedDeliveries);
    setMechanicState(loaded.mechanicState);
    // A board put away or a run that ends lands its last save at once.
    return () => flushDeferredStoredWrites(storageKey);
  }, [runId, storageKey, revision]);
  /** Throws the saved board away and seeds a fresh one: the way out when a save cannot be read. */
  const reset = useCallback(() => { clearMission(storageKey); setRevision((value) => value + 1); }, [storageKey]);
  /** Seeds the board again and keeps what the wisps have taken: the way on when every shot has been spent with wisps still standing. */
  const reseed = useCallback(() => {
    const activeRunId = runIdRef.current;
    if (!activeRunId || !stateRef.current) return;
    const next = createRef.current(Date.now());
    stateRef.current = next;
    saveMission(storageKey, activeRunId, next, mergesRef.current, placedRef.current, mechanicSaveState(mechanicStateRef.current));
    setState(next);
  }, [storageKey]);
  const send = useCallback((command: MergeWorldCommand): MissionCommandResult | null => {
    const current = stateRef.current;
    const activeRunId = runIdRef.current;
    if (!current || !activeRunId) return null;
    const result = reduceMergeWorld(current, command);
    if (result.changed) {
      const merged = command.type === 'move' && result.mergedCell != null;
      const nextMerges = merged ? mergesRef.current + 1 : mergesRef.current;
      // The strike this merge makes on the wisps, by the board's mechanic: resolved once, here, and saved with the board.
      const binding = mechanicRef.current;
      const before = mechanicStateRef.current;
      const resolved = binding && before && merged ? strikeFor(resolveMechanic(binding.host), binding.host, binding.window, before, missionStrikeEvent(result)) : null;
      const nextMechanic = resolved ? resolved.next : before;
      stateRef.current = result.state;
      mergesRef.current = nextMerges;
      mechanicStateRef.current = nextMechanic;
      saveMission(storageKey, activeRunId, result.state, nextMerges, placedRef.current, mechanicSaveState(nextMechanic));
      setState(result.state);
      if (merged) setMerges(nextMerges);
      if (resolved) setMechanicState(resolved.next);
      return resolved ? { ...result, strike: resolved.strike } : result;
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
    saveMission(storageKey, activeRunId, next, mergesRef.current, placed, mechanicSaveState(mechanicStateRef.current));
    setState(next);
    setPlacedDeliveries(placed);
  }, [storageKey]);
  return { state, merges, mergesRef: mergesRef as RefObject<number>, placedDeliveries, mechanicState, mechanicStateRef: mechanicStateRef as RefObject<MissionMechanicState | null>, send, place, reset, reseed };
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
