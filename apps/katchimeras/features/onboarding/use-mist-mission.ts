import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';

import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import type { RewardFlightPoint } from '@/components/katchadeck/ui/reward-token-flight';
import type { CorruptionWispTarget } from '@/components/katchadeck/world/corruption-wisp-layer';
import type { useOpeningGlow } from '@/components/katchadeck/world/kingdom-opening-merge-dock';
import { abilityFor, abilityReady, abilityTargets } from '@/features/encounter/abilities';
import { encounterMechanicHost } from '@/features/encounter/adapt';
import { createEncounterState } from '@/features/encounter/create-state';
import { encounterLine, KEEP_GOING_RESOLVE, LOW_RESOLVE } from '@/features/encounter/encounter-copy';
import { resolveLeft, type EncounterStatus } from '@/features/encounter/encounter-run';
import { encounterOutcome, type EncounterOutcome } from '@/features/encounter/outcome';
import { encounterRunId } from '@/features/encounter/run-id';
import { encounterProfile } from '@/features/encounter/spawner-profile';
import { missionPairs, missionWakes, missionWindow } from '@/features/mission-mechanics/board-window';
import { mechanicComplete, resolveMechanic } from '@/features/mission-mechanics/mechanic';
import { resolveEncounterForPlay, resolveMissionForPlay } from '@/features/mission-mechanics/preview';
import { missionWispTarget } from '@/features/mission-mechanics/wisp-target';
import { useDevMissionMechanicPreview } from '@/hooks/use-dev-mission-mechanic-preview';
import type { CompanionAbilityDefinition, CompanionAbilityTier } from '@/types/companion-ability';
import type { EncounterDefinition, EncounterLoadout } from '@/types/encounter';
import type { HatchableMissionDefinition } from '@/types/hatchable-companion';
import type { MergeCharacterId, MergeWorldCommand, MergeWorldState } from '@/types/merge-world';
import type { MechanicEffect, MissionMechanicLive, MissionMechanicState, MissionStrike } from '@/types/mission-mechanic';
import { createMissionState, missionBoardStep } from './steppling-mission';
import { useMissionBoard, type MissionCommandResult } from './use-opening-mission-board';

/** After a finale lands: the struck wisp's fall (shrink, burst) before the mission is declared over. */
export const WISP_FALL_MS = 640;
/** A docked board with no state for this long is a save that could not be read: offer a fresh one. */
const STALLED_MS = 3000;
/** A stuck encounter opens its cache after this beat, so the player sees the board is spent first. */
const CACHE_DELAY_MS = 900;
const NO_MISSION_STORAGE_KEY = 'katchimeras.mist-mission.none.v1';
/** An authored encounter with no guides of its own is free from the first move. */
const FREE_GUIDES: HatchableMissionDefinition['guides'] = { firstMerge: { eyebrow: '', title: '', body: '' }, wake: { eyebrow: '', title: '', body: '' }, merge: { eyebrow: '', title: '', body: '' }, mergeFallbackTitle: '', free: { eyebrow: '', title: '', body: '' } };

export { missionWispTarget };

export type MistMissionGlow = Pick<ReturnType<typeof useOpeningGlow>, 'launch' | 'launchItem' | 'launchShot' | 'launchFinale' | 'finaleLandedId'>;

/** A mission as `Omit<HatchableMissionDefinition, 'camera'>`: a friend's, or a journey tile's. */
export type MistMissionDefinition = Omit<HatchableMissionDefinition, 'camera'>;

/** What the dock shows and does for an encounter: the budget, the ability, the cache, the ways on from a loss. */
export type EncounterDockState = {
  definition: EncounterDefinition;
  resolveLeft: number | null;
  status: EncounterStatus | null;
  outcome: EncounterOutcome | null;
  ability: { definition: CompanionAbilityDefinition; tier: CompanionAbilityTier; charge: number; ready: boolean; targets: number[] } | null;
  /** What the friend says right now, or nothing. */
  speech: string | null;
  effects: MechanicEffect[];
  onUseAbility: (target: number | null) => void;
  onKeepGoing: () => void;
  onRetry: () => void;
  onLeave: (() => void) | null;
};

/**
 * One docked mist mission: its own board and store under its tile, played by
 * the mission's mechanic. The bar filling is what moves the story on,
 * recorded once the final item has struck the last wisp and the wisp has
 * fallen; a board saved with its bar already full (killed while the item
 * flew) clears on arrival. Developer Tools may lay a preview mechanic over
 * the mission, under its own storage key.
 *
 * Given an encounter (an authored one, or the Dark Wisps preview laid over
 * the mission), the board plays by the encounter's rules too: Resolve, the
 * Katchimera's ability, spawners, Mist, the cache, a loss the player can
 * retry or push through.
 */
export function useMistMission({ active, mission, encounter: authored, owner, loadout, world, tileNode, boardMetrics, cameraSettled, glow, complete, onLeave }: {
  active: boolean;
  mission: MistMissionDefinition | null;
  /** An authored encounter to play instead of the mission's own board. */
  encounter?: EncounterDefinition | null;
  /** Whose pieces the seed's sleepers belong to. */
  owner: MergeCharacterId | null;
  /** The Katchimera brought in, and the helper Wisp; Mossprout at level one when absent. */
  loadout?: EncounterLoadout | null;
  /** The world whose Haven shapes the encounter (its buildings). */
  world?: Pick<MergeWorldState, 'heartwoodBuildings'> | null;
  tileNode: View | null;
  boardMetrics: MergeBoardScreenMetrics | null;
  cameraSettled: boolean;
  glow: MistMissionGlow;
  /** Records the mission cleared; the run moves on. */
  complete: () => Promise<unknown>;
  /** Puts the board away from a loss, when the board can be put away. */
  onLeave?: () => void;
}) {
  const preview = useDevMissionMechanicPreview();
  const encounter = useMemo(() => authored ?? (mission ? resolveEncounterForPlay(mission, preview) : null), [authored, mission, preview]);
  // What the dock and the guidance read: the encounter carries every field a mission has, with guides of its own or the mission's.
  const played = useMemo((): MistMissionDefinition | null => (encounter ? { ...encounter, guides: encounter.guides ?? mission?.guides ?? FREE_GUIDES } : mission ? resolveMissionForPlay(mission, preview) : null), [encounter, mission, preview]);
  const effectiveLoadout = useMemo((): EncounterLoadout | null => encounter ? loadout ?? { companionId: 'mossprout', level: 1 } : null, [encounter, loadout]);
  const profile = useMemo(() => encounterProfile(world ?? null, effectiveLoadout), [effectiveLoadout, world]);
  const window = useMemo(() => missionWindow(encounter?.rows ?? 4), [encounter?.rows]);
  const host = useMemo(() => (encounter ? encounterMechanicHost(encounter) : played), [encounter, played]);
  const [attempt, setAttempt] = useState(1);
  useEffect(() => { setAttempt(1); }, [encounter?.id]);
  const binding = useMemo(() => host ? { host, window, ...(encounter ? { encounter, loadout: effectiveLoadout, profile, attempt } : {}) } : null, [attempt, effectiveLoadout, encounter, host, profile, window]);
  const create = useCallback((now: number) => (encounter ? createEncounterState(encounter, owner!, now, profile) : createMissionState(played!.seed, owner!, now)), [encounter, owner, played, profile]);
  const runId = active && played && owner ? (encounter ? encounterRunId(encounter, attempt, effectiveLoadout) : played.id) : null;
  const store = useMissionBoard(played?.storageKey ?? NO_MISSION_STORAGE_KEY, runId, create, undefined, binding);
  const step = useMemo(() => active && played ? missionBoardStep(played, store.state, store.merges, store.mechanicState) : null, [active, played, store.mechanicState, store.merges, store.state]);
  const guidanceVisible = Boolean(step && (step.cue || step.spotlight));
  const mechanic = host ? resolveMechanic(host) : null;
  const cleared = encounter ? store.status === 'cleared' : Boolean(played && mechanic && store.mechanicState && mechanicComplete(mechanic, played, store.mechanicState));
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!active || store.state) { setStalled(false); return; }
    const timer = setTimeout(() => setStalled(true), STALLED_MS);
    return () => clearTimeout(timer);
  }, [active, store.state]);
  // Every shot spent with wisps still standing (a board where a miss is lost): more pieces are offered, the damage dealt stays.
  const stuck = useMemo(() => Boolean(active && !encounter && store.state && store.mechanicState && !cleared && !missionPairs(store.state, window.cellIndices).length && !missionWakes(store.state, window.cellIndices).length), [active, cleared, encounter, store.mechanicState, store.state, window]);
  // A board's finale is its last item striking the last wisp. Nothing moves on until that landing,
  // and then only once the wisp has fallen: the mission is over when the player has seen it end.
  const finaleIdRef = useRef<number | null>(null);
  const finaleLanded = finaleIdRef.current != null && glow.finaleLandedId === finaleIdRef.current;
  // An objective other than every wisp down (a named wisp, the cache) has no finale flight to wait for.
  const landed = encounter && encounter.objective.kind !== 'wisps' ? true : finaleLanded;
  const { launch, launchItem, launchShot, launchFinale } = glow;
  const onFinale = useCallback((from: RewardFlightPoint, definitionId: string, strike: MissionStrike) => {
    finaleIdRef.current = launchFinale(from, definitionId, strike);
  }, [launchFinale]);
  // What flies at the wisps is the mechanic's: a burst of Glow, the item itself, or a shot straight up its column.
  const flight = mechanic?.kind === 'column-shot' ? 'shot' : mechanic?.kind === 'glow-strikes' && mechanic.flight === 'item' ? 'item' : 'glow';
  const onStrike = useCallback((from: RewardFlightPoint, strike: MissionStrike) => {
    if (flight === 'shot') launchShot(from, strike);
    else if (flight === 'item') launchItem(from, strike.resultDefinitionId, strike);
    else launch(from, undefined, strike);
  }, [flight, launch, launchItem, launchShot]);
  const doneRef = useRef(false);
  useEffect(() => { if (!active) doneRef.current = false; }, [active]);
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    void complete().catch((error) => {
      doneRef.current = false;
      console.warn('The mist could not clear', error);
    });
  }, [complete]);
  // Live: the mist clears when the mission's own final item has struck the last wisp and the wisp has fallen.
  useEffect(() => {
    if (!(active && cleared && landed)) return;
    const timer = setTimeout(finish, WISP_FALL_MS);
    return () => clearTimeout(timer);
  }, [active, cleared, finish, landed]);
  // Resume: a board saved with its bar already full clears the mist on arrival.
  const checkedRef = useRef(false);
  useEffect(() => {
    if (!active || !store.state) { checkedRef.current = false; return; }
    if (checkedRef.current) return;
    checkedRef.current = true;
    if (cleared) finish();
  }, [active, cleared, finish, store.state]);
  // Full mist bursting open on the board: the wisps get a line for the first one.
  const [revealNonce, setRevealNonce] = useState(0);
  const bumpReveal = useCallback(() => setRevealNonce((nonce) => nonce + 1), []);
  // Dark Wisps mend and act between strikes: the wisp layer's own copy follows the board's state through a live store.
  const liveRef = useRef<MissionMechanicState | null>(null);
  const liveListeners = useRef(new Set<() => void>());
  liveRef.current = store.mechanicState;
  useEffect(() => { for (const listener of [...liveListeners.current]) listener(); }, [store.mechanicState]);
  const live = useMemo((): MissionMechanicLive => ({
    get: () => liveRef.current ?? { kind: 'glow-strikes', strikes: 0 },
    subscribe: (listener) => { liveListeners.current.add(listener); return () => { liveListeners.current.delete(listener); }; },
  }), []);
  const wispTarget = useMemo((): CorruptionWispTarget | null => active && played && host && store.mechanicState
    ? missionWispTarget({ key: encounter ? `${encounter.id}:${attempt}` : played.id, host, mechanicState: store.mechanicState, node: tileNode, boardMetrics, window, lines: played.lines, settled: cameraSettled, revealNonce, ...(mechanic?.kind === 'dark-wisps' ? { live } : {}) })
    : null, [active, attempt, boardMetrics, cameraSettled, encounter, host, live, mechanic?.kind, played, revealNonce, store.mechanicState, tileNode, window]);
  // The encounter's own beats: what the last command did to the board, the cache opening on a spent board, the friend's line.
  const [effects, setEffects] = useState<MechanicEffect[]>([]);
  const [cacheLine, setCacheLine] = useState(false);
  const send = useCallback((command: MergeWorldCommand): MissionCommandResult | null => {
    const result = store.send(command);
    if (result?.effects?.length) setEffects(result.effects);
    return result;
  }, [store.send]);
  const { openCache, useAbility, keepGoing } = store;
  useEffect(() => {
    if (!active || !encounter || store.status !== 'stuck') return;
    const timer = setTimeout(() => { if (openCache().length) setCacheLine(true); }, CACHE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [active, encounter, openCache, store.status]);
  useEffect(() => { setCacheLine(false); setEffects([]); }, [runId]);
  const ability = useMemo(() => {
    if (!encounter || !store.run || !store.state) return null;
    const found = abilityFor(effectiveLoadout);
    if (!found) return null;
    return { definition: found.definition, tier: found.tier, charge: store.run.ability?.charge ?? 0, ready: abilityReady(store.run, found.tier), targets: abilityTargets(found.definition, found.tier, store.state, window) };
  }, [effectiveLoadout, encounter, store.run, store.state, window]);
  const outcome = useMemo(() => (encounter && store.run && store.status ? encounterOutcome(encounter, store.run, store.status) : null), [encounter, store.run, store.status]);
  const speech = useMemo(() => {
    if (!encounter || !store.run) return null;
    const facts = { remaining: resolveLeft(store.run), katchimera: effectiveLoadout?.companionId ?? null, ability: ability?.definition.name ?? null };
    if (cacheLine) return encounterLine('cacheFound', facts);
    if (store.status === 'playing' && ability?.ready) return encounterLine('abilityReady', facts) || null;
    if (store.status === 'playing' && Number.isFinite(facts.remaining) && facts.remaining <= LOW_RESOLVE) return encounterLine('lowResolve', facts);
    if (store.status === 'playing' && store.run.actions === 0) return encounterLine('enter', facts);
    return null;
  }, [ability, cacheLine, effectiveLoadout?.companionId, encounter, store.run, store.status]);
  const onRetry = useCallback(() => setAttempt((value) => value + 1), []);
  const onKeepGoing = useCallback(() => keepGoing(KEEP_GOING_RESOLVE), [keepGoing]);
  const onUseAbility = useCallback((target: number | null) => { useAbility(target); }, [useAbility]);
  const encounterDock = useMemo((): EncounterDockState | null => encounter && store.run ? {
    definition: encounter, resolveLeft: store.run.resolve.budget == null ? null : resolveLeft(store.run), status: store.status, outcome, ability, speech, effects,
    onUseAbility, onKeepGoing, onRetry, onLeave: onLeave ?? null,
  } : null, [ability, effects, encounter, onKeepGoing, onLeave, onRetry, onUseAbility, outcome, speech, store.run, store.status]);
  return {
    /** The mission as played: itself, or with the preview mechanic laid over it. */
    mission: played,
    /** The encounter played, if the board is one. */
    encounter: encounterDock,
    /** The run the board is saved under: the attempt's, for an encounter. */
    runId,
    store: { ...store, send }, step, guidanceVisible, cleared, landed,
    /** Until the finale has landed: the map stays faded while the last item is still in the air. */
    busy: active && !landed,
    stalled,
    /** Nothing left to merge and wisps still standing: offer the seed again (`store.reseed`). */
    stuck,
    wispTarget, revealNonce, bumpReveal, onStrike, onFinale,
  };
}
