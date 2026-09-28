import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { AppState } from 'react-native';
import { missionWrites, readMissionSnapshot } from '@/features/encounter/mission-persistence';
import { measureMergeOperation, measureMergeWork } from '@/utils/merge-world/performance';
import { lanesKeepGoing, lanesTick, type LanesTickResult } from '@/features/mission-mechanics/lanes';

import type { MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import type { EncounterDefinition, EncounterLoadout } from '@/types/encounter';
import type { MechanicEffect, MissionMechanicState, MissionStrike } from '@/types/mission-mechanic';
import type { MissionWindow } from '@/features/mission-mechanics/board-window';
import { createMechanicState, mechanicSaveState, normalizeMechanicState, resolveMechanic, strikeFor, type MechanicSaveState, type MissionMechanicHost, type MissionStrikeEvent } from '@/features/mission-mechanics/mechanic';
import { abilityFor, applyBattleAbility, applyPartnerBattleAbility, partnerAbilityFor, type AbilityEffect } from '@/features/encounter/abilities';
import { canOpenCache, openCache } from '@/features/encounter/cache';
import { createEncounterRun, encounterStatus, keepGoing as keepGoingOn, normalizeEncounterRun, type EncounterProfile, type EncounterRunState, type EncounterStatus } from '@/features/encounter/encounter-run';
import type { GlowShot, MistOpened } from '@/features/encounter/mist';
import { settleAction, strikeEventFor, tapSeed } from '@/features/encounter/settle';
import { DEFAULT_ENCOUNTER_PROFILE } from '@/features/encounter/encounter-run';
import { dropProfileFor } from '@/features/encounter/spawner-profile';
import { normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { createOpeningMissionState, OPENING_MISSION_STORAGE_KEY, type StoredOpeningMission } from './opening-mission-state';

/**
 * A mist mission's board lives in its own store: the run it belongs to, the
 * board, how many merges it has counted (a board with a spawner cannot
 * derive that from what is left on it), what its mechanic remembers (a
 * column-shot board's damage on each wisp), and, on an encounter, the
 * attempt (Resolve spent, charges, the ability's charge). Nothing the
 * persistent board does between sessions can change what a mission shows.
 */
export type StoredMission = StoredOpeningMission & { merges?: number; placedDeliveries?: number; mechanic?: MechanicSaveState; run?: EncounterRunState };
export type LoadedMission = { state: MergeWorldState; merges: number; placedDeliveries: number; mechanicState: MissionMechanicState | null; run: EncounterRunState | null };

/**
 * What the board plays by: the mission (or restoration) it is authored on
 * and the window it shows; on an encounter, the encounter itself, the
 * loadout brought in, what the Haven adds, and which attempt this is.
 */
export type MissionMechanicBinding = { host: MissionMechanicHost; window: MissionWindow; encounter?: EncounterDefinition; loadout?: EncounterLoadout | null; profile?: EncounterProfile; attempt?: number };

/** A board command's result, with the strike it produced on the wisps when the board has a mechanic bound, and what an encounter settled. */
export type MissionCommandResult = MergeWorldCommandResult & { strike?: MissionStrike | null; effects?: MechanicEffect[]; opened?: MistOpened[]; status?: EncounterStatus; /** Merge vs Mist: the Glow the merge fired. */ shots?: GlowShot[] };

export function loadMission(storageKey: string, runId: string, now = Date.now(), mechanic?: MissionMechanicBinding | null): LoadedMission | null {
  const stored = readMissionSnapshot<StoredMission>(storageKey);
  if (!stored || stored.runId !== runId) return null;
  try {
    const merges = Math.max(0, Math.floor(stored.merges ?? 0));
    // A mechanic that cannot read what the board saved: the board is not readable either, and is seeded fresh.
    const mechanicState = mechanic ? normalizeMechanicState(resolveMechanic(mechanic.host), stored.mechanic, merges) : null;
    if (mechanic && !mechanicState) return null;
    const run = mechanic?.encounter ? normalizeEncounterRun(stored.run, mechanic.encounter) : null;
    if (mechanic?.encounter && !run) return null;
    return { state: normalizeMergeWorldState(stored.state, now), merges, placedDeliveries: Math.max(0, Math.floor(stored.placedDeliveries ?? 0)), mechanicState, run };
  } catch {
    return null;
  }
}

/**
 * Written behind the frame: the board is saved a beat after each command rather than on it, so the
 * SQLite transaction runs asynchronously after the merge starts. Reads see the pending
 * board at once; it is flushed on a timer, when the board unmounts, and when the app leaves the foreground.
 */
export function saveMission(storageKey: string, runId: string, state: MergeWorldState, merges: number, placedDeliveries = 0, mechanic?: MechanicSaveState, run?: EncounterRunState | null) {
  missionWrites.put(storageKey, { runId, state, merges, placedDeliveries, ...(mechanic ? { mechanic } : {}), ...(run ? { run } : {}) } satisfies StoredMission);
}

export function clearMission(storageKey: string) {
  missionWrites.put(storageKey, null);
  void missionWrites.flush(storageKey).catch(() => undefined);
}

/** The strike a command's result describes: the cell holding what a merge or waking made. */
export function missionStrikeEvent(result: MergeWorldCommandResult): MissionStrikeEvent | null {
  return strikeEventFor(result);
}

const NO_RESOLVE_MESSAGE = 'No Resolve left.';

/**
 * One mission board: loaded from its store (or seeded fresh for a new run),
 * reduced by the ordinary engine, and queued for persistence after every
 * command. Lifecycle boundaries explicitly flush the latest snapshot.
 * Every merge is counted as it lands; `mergesRef` reads that count in the
 * same tick. With a mechanic bound, every merge is also resolved into the
 * strike it makes on the wisps, saved with the board and returned with the
 * command's result. With an encounter bound, every command is settled by
 * the encounter's rules too (Resolve, Mist, spawners, the wisps' turn), and
 * the attempt is saved beside the board. Pass `null` as the run while no
 * mission is active.
 */
export function useMissionBoard(storageKey: string, runId: string | null, create: (now: number) => MergeWorldState, repair?: (state: MergeWorldState) => MergeWorldState, mechanic?: MissionMechanicBinding | null) {
  const [state, setState] = useState<MergeWorldState | null>(null);
  const [merges, setMerges] = useState(0);
  const [placedDeliveries, setPlacedDeliveries] = useState(0);
  const [mechanicState, setMechanicState] = useState<MissionMechanicState | null>(null);
  const [run, setRun] = useState<EncounterRunState | null>(null);
  // Bumped by `reset`: the saved board is cleared and the store loads again (a fresh seed).
  const [revision, setRevision] = useState(0);
  // Which board the values above belong to. The load below runs after the render that changed the key, so for that
  // render (and every effect in its commit) the state is still the PREVIOUS board's. One screen hosts every friend's
  // restoration through this hook: without an owner, a friend's board opened while another's was mid-way read the
  // other's progress (3 / 5, its checkpoint reached) and asked for its delivery before a single merge.
  const boardKey = runId ? `${storageKey}\u0000${runId}` : null;
  const [owner, setOwner] = useState<string | null>(null);
  const ownerRef = useRef<string | null>(null);
  const boardKeyRef = useRef(boardKey);
  boardKeyRef.current = boardKey;
  const stateRef = useRef<MergeWorldState | null>(null);
  const mergesRef = useRef(0);
  const placedRef = useRef(0);
  const mechanicStateRef = useRef<MissionMechanicState | null>(null);
  const runRef = useRef<EncounterRunState | null>(null);
  const runIdRef = useRef(runId);
  runIdRef.current = runId;
  const createRef = useRef(create);
  createRef.current = create;
  const repairRef = useRef(repair);
  repairRef.current = repair;
  const mechanicRef = useRef(mechanic ?? null);
  mechanicRef.current = mechanic ?? null;
  const flush = useCallback(async () => {
    // Include quiet ticks, but never resurrect a cleared/replaced run on teardown.
    const saved = readMissionSnapshot<StoredMission>(storageKey);
    if (stateRef.current && runIdRef.current && saved?.runId === runIdRef.current) {
      saveMission(storageKey, runIdRef.current, stateRef.current, mergesRef.current, placedRef.current, mechanicSaveState(mechanicStateRef.current), runRef.current);
    }
    await missionWrites.flush(storageKey);
  }, [storageKey]);
  useEffect(() => {
    if (!runId) return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void flush().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [flush, runId]);
  const commit = useCallback((next: { state: MergeWorldState; merges?: number; placed?: number; mechanicState?: MissionMechanicState | null; run?: EncounterRunState | null }) => {
    const activeRunId = runIdRef.current;
    if (!activeRunId) return;
    stateRef.current = next.state;
    if (next.merges != null) mergesRef.current = next.merges;
    if (next.placed != null) placedRef.current = next.placed;
    if (next.mechanicState !== undefined) mechanicStateRef.current = next.mechanicState;
    if (next.run !== undefined) runRef.current = next.run;
    measureMergeOperation('battle.snapshot', () => saveMission(storageKey, activeRunId, stateRef.current!, mergesRef.current, placedRef.current, mechanicSaveState(mechanicStateRef.current), runRef.current));
    setState(stateRef.current);
    if (next.merges != null) setMerges(next.merges);
    if (next.placed != null) setPlacedDeliveries(next.placed);
    if (next.mechanicState !== undefined) setMechanicState(next.mechanicState);
    if (next.run !== undefined) setRun(next.run);
  }, [storageKey]);
  useEffect(() => {
    if (!runId) {
      stateRef.current = null;
      mergesRef.current = 0;
      placedRef.current = 0;
      mechanicStateRef.current = null;
      runRef.current = null;
      ownerRef.current = null;
      setOwner(null);
      setState(null);
      setMerges(0);
      setPlacedDeliveries(0);
      setMechanicState(null);
      setRun(null);
      return;
    }
    const binding = mechanicRef.current;
    const stored = loadMission(storageKey, runId, Date.now(), binding);
    // A saved board passes through the repair (authored pieces a stale save lost); a fresh one never needs it.
    const loaded: LoadedMission = stored
      ? { ...stored, state: repairRef.current ? repairRef.current(stored.state) : stored.state }
      : {
          state: createRef.current(Date.now()), merges: 0, placedDeliveries: 0,
          mechanicState: binding ? createMechanicState(resolveMechanic(binding.host)) : null,
          run: binding?.encounter ? createEncounterRun(binding.encounter, { loadout: binding.loadout ?? null, profile: binding.profile, attempt: binding.attempt, ability: Boolean(abilityFor(binding.loadout ?? null)), partnerAbility: Boolean(partnerAbilityFor(binding.loadout ?? null)) }) : null,
        };
    saveMission(storageKey, runId, loaded.state, loaded.merges, loaded.placedDeliveries, mechanicSaveState(loaded.mechanicState), loaded.run);
    stateRef.current = loaded.state;
    mergesRef.current = loaded.merges;
    placedRef.current = loaded.placedDeliveries;
    mechanicStateRef.current = loaded.mechanicState;
    runRef.current = loaded.run;
    ownerRef.current = `${storageKey}\u0000${runId}`;
    setOwner(ownerRef.current);
    setState(loaded.state);
    setMerges(loaded.merges);
    setPlacedDeliveries(loaded.placedDeliveries);
    setMechanicState(loaded.mechanicState);
    setRun(loaded.run);
    // A board put away or a run that ends lands its last save at once.
    return () => {
      // Capture this owner's last ref before the next owner's load effect runs.
      if (stateRef.current && readMissionSnapshot<StoredMission>(storageKey)?.runId === runId) {
        saveMission(storageKey, runId, stateRef.current, mergesRef.current, placedRef.current, mechanicSaveState(mechanicStateRef.current), runRef.current);
      }
      void missionWrites.flush(storageKey).then(() => missionWrites.release(storageKey)).catch(() => undefined);
    };
  }, [runId, storageKey, revision]);
  const mine = () => Boolean(stateRef.current && runIdRef.current && ownerRef.current === boardKeyRef.current);
  /** Throws the saved board away and seeds a fresh one: the way out when a save cannot be read. */
  const reset = useCallback(() => { clearMission(storageKey); setRevision((value) => value + 1); }, [storageKey]);
  /** Seeds the board again and keeps what the wisps have taken: the way on when every shot has been spent with wisps still standing. */
  const reseed = useCallback(() => {
    if (!mine()) return;
    commit({ state: createRef.current(Date.now()) });
  }, [commit]);
  const send = useCallback((command: MergeWorldCommand): MissionCommandResult | null => {
    const current = stateRef.current;
    // Never play (or save) one board's state under another board's key.
    if (!current || !mine()) return null;
    const binding = mechanicRef.current;
    const activeRun = runRef.current;
    // An encounter's spawner draws from the attempt's seed and spends its charges; its odds are the Haven's.
    const effective: MergeWorldCommand = binding?.encounter && activeRun && command.type === 'tapGenerator'
      ? { ...command, seed: tapSeed(activeRun), enforceCharges: true, dropProfile: dropProfileFor(activeRun, command.generatorId, binding.profile ?? DEFAULT_ENCOUNTER_PROFILE) }
      : command;
    const result = measureMergeOperation('battle.command.reduce', () => reduceMergeWorld(current, effective));
    if (!result.changed) return result;
    if (binding?.encounter && activeRun && mechanicStateRef.current) {
      const settled = measureMergeOperation('battle.command.settle', () => settleAction({ encounter: binding.encounter!, host: binding.host, window: binding.window }, { state: current, run: activeRun, mechanicState: mechanicStateRef.current! }, effective, result));
      if (settled.refused) return { state: current, changed: false, failureReason: settled.refused, message: NO_RESOLVE_MESSAGE };
      commit({ state: settled.state, merges: settled.run.merges, mechanicState: settled.mechanicState, run: settled.run });
      return { ...result, state: settled.state, strike: settled.strike, effects: settled.effects, opened: settled.opened, status: settled.status, ...(settled.shots ? { shots: settled.shots } : {}), ...(settled.spawnedCell != null ? { spawnedCell: settled.spawnedCell } : {}) };
    }
    const merged = command.type === 'move' && result.mergedCell != null;
    const nextMerges = merged ? mergesRef.current + 1 : mergesRef.current;
    // The strike this merge makes on the wisps, by the board's mechanic: resolved once, here, and saved with the board.
    const before = mechanicStateRef.current;
    const resolved = binding && before && merged ? strikeFor(resolveMechanic(binding.host), binding.host, binding.window, before, missionStrikeEvent(result)) : null;
    commit({ state: result.state, merges: nextMerges, mechanicState: resolved ? resolved.next : before });
    return resolved ? { ...result, strike: resolved.strike } : result;
  }, [commit]);
  /**
   * Delivered items land on the board directly (no engine command makes an
   * item appear): each entry goes into its cell, and the count of placed
   * deliveries is saved with the board so a relaunch never places one twice.
   */
  const place = useCallback((entries: readonly { cell: number; definitionId: string }[]) => {
    const current = stateRef.current;
    if (!current || !entries.length || !mine()) return;
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
    commit({ state: { ...current, board, nextInstance, revision: current.revision + 1 }, placed: placedRef.current + landed });
  }, [commit]);
  /** The Katchimera's ability, on a cell when it takes one; what it did, or null when it could not be used. */
  const useAbility = useCallback((target: number | null = null, slot: 0 | 1 = 0): AbilityEffect[] | null => {
    const current = stateRef.current;
    const binding = mechanicRef.current;
    const activeRun = runRef.current;
    if (!current || !mine() || !binding?.encounter || !activeRun) return null;
    // Slot 1 is the partner's (the second hero): their own ability on their own meter.
    const ability = slot === 1 ? partnerAbilityFor(binding.loadout ?? null) : abilityFor(binding.loadout ?? null);
    if (!ability) return null;
    // A Lanes battle's own state goes with it: the friends' abilities act on the wisps in play.
    const mechanic = resolveMechanic(binding.host);
    const lanesState = mechanicStateRef.current;
    const lanes = mechanic.kind === 'lanes' && lanesState?.kind === 'lanes' ? { mechanic, state: lanesState } : null;
    const applied = slot === 1
      ? applyPartnerBattleAbility(ability.definition, ability.tier, current, binding.window, activeRun, target, lanes)
      : applyBattleAbility(ability.definition, ability.tier, current, binding.window, activeRun, target, lanes);
    if (!applied) return null;
    commit({ state: applied.board, run: applied.run, ...(applied.lanes ? { mechanicState: applied.lanes } : {}) });
    return applied.effects;
  }, [commit]);
  /** The cache opened on a stuck board: what landed, or nothing when it could not open. */
  const openBoardCache = useCallback((): { cell: number; definitionId: string }[] => {
    const current = stateRef.current;
    const binding = mechanicRef.current;
    const activeRun = runRef.current;
    if (!current || !mine() || !binding?.encounter || !activeRun || !mechanicStateRef.current) return [];
    const status = encounterStatus(binding.encounter, binding.host, mechanicStateRef.current, activeRun, current, binding.window);
    if (!canOpenCache(status, activeRun)) return [];
    const opened = openCache(binding.encounter, current, binding.window, activeRun);
    commit({ state: opened.board, run: opened.run });
    return opened.placed;
  }, [commit]);
  /** Keep going: more Resolve on this attempt, or on a territory battle the Mist pulled back and the spawners topped up. */
  const keepGoing = useCallback((amount: number) => {
    const activeRun = runRef.current;
    const binding = mechanicRef.current;
    if (!stateRef.current || !mine() || !activeRun || !binding) return;
    const kept = keepGoingOn(stateRef.current, activeRun, binding.window, amount);
    // Lanes: the wisps still standing go back up a few rows too.
    const mechanic = resolveMechanic(binding.host);
    const lanes = mechanic.kind === 'lanes' && mechanicStateRef.current?.kind === 'lanes' ? lanesKeepGoing(mechanic, mechanicStateRef.current) : undefined;
    commit({ state: kept.board, run: kept.run, ...(lanes ? { mechanicState: lanes } : {}) });
  }, [commit]);
  /**
   * Lanes (`docs/encounter-lanes.md`): the level's clock moves on by `dt` ms. Only a tick where something happened (a
   * shot, a landing, a wisp stepping) is committed and saved; the clock alone moves in the ref, so a quiet tick never
   * re-renders the screen. Null on any other board.
   */
  const tick = useCallback((dt: number): LanesTickResult | null => {
    const current = stateRef.current;
    const binding = mechanicRef.current;
    const activeRun = runRef.current;
    const before = mechanicStateRef.current;
    if (!current || !mine() || !binding?.encounter || !activeRun || before?.kind !== 'lanes') return null;
    const mechanic = resolveMechanic(binding.host);
    if (mechanic.kind !== 'lanes') return null;
    // The Haven's Seed Nursery: the chance a piece that arrives on its own is a Sprout.
    const done = measureMergeWork('battle.tick');
    const result = lanesTick(mechanic, before, current, dt, binding.window, undefined, binding.profile ?? {});
    done();
    if (!result.changed) { mechanicStateRef.current = result.state; return result; }
    commit({ state: result.board, mechanicState: result.state });
    return result;
  }, [commit]);
  const startWave = useCallback(() => {
    const current = mechanicStateRef.current;
    if (!mine() || current?.kind !== 'lanes' || !current.combat?.preparingMs) return;
    if (stateRef.current) commit({ state: stateRef.current, mechanicState: { ...current, combat: { ...current.combat, preparingMs: 0 } } });
  }, [commit]);
  // Until this board's own save has loaded, there is no board: never the last one's.
  const owned = owner != null && owner === boardKey;
  const status = useMemo((): EncounterStatus | null => {
    const binding = mechanicRef.current;
    if (!owned || !state || !binding?.encounter || !run || !mechanicState) return null;
    return encounterStatus(binding.encounter, binding.host, mechanicState, run, state, binding.window);
  }, [mechanicState, owned, run, state]);
  return {
    state: owned ? state : null, merges: owned ? merges : 0, mergesRef: mergesRef as RefObject<number>, placedDeliveries: owned ? placedDeliveries : 0,
    mechanicState: owned ? mechanicState : null, mechanicStateRef: mechanicStateRef as RefObject<MissionMechanicState | null>,
    run: owned ? run : null, status,
    send, place, reset, reseed, useAbility, openCache: openBoardCache, keepGoing, tick, startWave, flush,
  };
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
