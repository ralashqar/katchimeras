import type { SpeechLine } from '@/components/katchadeck/world/friend-speech-bubble';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';

import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import type { RewardFlightPoint } from '@/components/katchadeck/ui/reward-token-flight';
import type { CorruptionWispTarget } from '@/components/katchadeck/world/corruption-wisp-layer';
import type { useOpeningGlow } from '@/components/katchadeck/world/kingdom-opening-merge-dock';
import { abilityFor, abilityReady, partnerAbilityFor, partnerAbilityReady, abilityTargets } from '@/features/encounter/abilities';
import { encounterMechanicHost } from '@/features/encounter/adapt';
import { createEncounterState } from '@/features/encounter/create-state';
import { encounterLine, WISP_KIND_LINES, EXPOSED_WISP_LINE, GATHER_LINE, SPREAD_LINE, KEEP_GOING_RESOLVE, LOW_RESOLVE, THREAT_LINE, WISP_ACT_LINES, WISP_ACT_ORDER } from '@/features/encounter/encounter-copy';
import { lossReason as encounterLossReason, resolveLeft, type EncounterLossReason, type EncounterStatus } from '@/features/encounter/encounter-run';
import { encounterOutcome, type EncounterOutcome } from '@/features/encounter/outcome';
import { encounterRunId } from '@/features/encounter/run-id';
import { encounterProfile } from '@/features/encounter/spawner-profile';
import { missionPairs, missionWakes, missionWindow } from '@/features/mission-mechanics/board-window';
import { mechanicComplete, mechanicIsTactics, resolveMechanic, wispViews } from '@/features/mission-mechanics/mechanic';
import { wispExposed } from '@/features/mission-mechanics/dark-wisps';
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
import { laneAlive, laneArrived } from '@/features/mission-mechanics/lanes';
import { katchimeraSkinById } from '@/constants/katchimera-skins';

/** How long a hero's ability callout stays in the battle's speech bubble. */
const ABILITY_CALL_MS = 1_800;

/** After a finale lands: the struck wisp's fall (shrink, burst) before the mission is declared over. */
export const WISP_FALL_MS = 640;
/** Lanes: plain drifting reaches the wisp layer at most this often (hits and falls go at once). */
const LANE_DRIFT_PUBLISH_MS = 200;
/** A docked board with no state for this long is a save that could not be read: offer a fresh one. */
const STALLED_MS = 3000;
/** A stuck encounter opens its cache after this beat, so the player sees the board is spent first. */
const CACHE_DELAY_MS = 900;
/** How long a wisp's act is said over the board. */
const ACT_LINE_MS = 2200;
/** A new kind of wisp's line stays up long enough to read. */
const KIND_LINE_MS = 3_400;
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
  /**
   * A territory battle: the Mist's cells now, the count that loses the level, and the board's cells; turns taken; why
   * the attempt was lost. Null on a board played by Resolve.
   */
  territory: { mist: number; overrun: number; cells: number } | null;
  /** Lanes (`docs/encounter-lanes.md`): the wisps still to bring down (those yet to arrive too). */
  lanes?: { left: number } | null;
  /** Lanes: moves the level's clock on (the dock calls it while the level is up). */
  tick?: ((dt: number) => import('@/features/mission-mechanics/lanes').LanesTickResult | null) | null;
  turns: number;
  lossReason: EncounterLossReason | null;
  /** Keep going's price in Glow (0: free). */
  keepGoingCost: number;
  status: EncounterStatus | null;
  outcome: EncounterOutcome | null;
  ability: { definition: CompanionAbilityDefinition; tier: CompanionAbilityTier; charge: number; ready: boolean; targets: number[] } | null;
  /** The partner's ability (the second hero slot), with who they are; null without a partner. */
  partnerAbility: { definition: CompanionAbilityDefinition; tier: CompanionAbilityTier; charge: number; ready: boolean; targets: number[]; companionId: string } | null;
  /** What the friend says right now, or nothing. */
  speech: SpeechLine | null;
  effects: MechanicEffect[];
  onUseAbility: (target: number | null, slot?: 0 | 1) => void;
  /** Focus / Ripple: the next merge (the next Water merge) clears as if this many steps bigger. */
  boost: { next: number; water: number };
  /** Scout: Mist cells whose hidden contents are shown. */
  revealed: number[];
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
export function useMistMission({ guided = true, active, mission, encounter: authored, owner, loadout, world, tileNode, boardMetrics, cameraSettled, glow, complete, onLeave, keepGoingCost, payKeepGoing, speechFor }: {
  /** Whether the host draws the board's guidance (hand, spotlight). A board with none is free from the first move:
   * a first-merge lesson nobody can see would refuse every other touch. */
  guided?: boolean;
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
  /** Keep going's price in Glow, and the payment (resolves true once paid); absent, Keep going is free. */
  keepGoingCost?: number;
  payKeepGoing?: (receiptId: string) => Promise<boolean>;
  /** A scripted battle's own lines over the board (the Last Clearing's first battle), from how it stands. */
  speechFor?: (input: { mechanicState: MissionMechanicState; merges: number; board: MergeWorldState }) => SpeechLine | null;
}) {
  const preview = useDevMissionMechanicPreview();
  const encounter = useMemo(() => authored ?? (mission ? resolveEncounterForPlay(mission, preview) : null), [authored, mission, preview]);
  // What the dock and the guidance read: the encounter carries every field a mission has, with guides of its own or the mission's.
  const played = useMemo((): MistMissionDefinition | null => (encounter ? { ...encounter, guides: guided ? encounter.guides ?? mission?.guides ?? FREE_GUIDES : FREE_GUIDES } : mission ? resolveMissionForPlay(mission, preview) : null), [encounter, guided, mission, preview]);
  const effectiveLoadout = useMemo((): EncounterLoadout | null => encounter ? loadout ?? { companionId: 'mossprout', level: 1 } : null, [encounter, loadout]);
  const profile = useMemo(() => encounterProfile(world ?? null, effectiveLoadout), [effectiveLoadout, world]);
  const window = useMemo(() => missionWindow(encounter?.rows ?? 4), [encounter?.rows]);
  const wispSlow = profile.wispSlow ?? 0;
  const host = useMemo(() => (encounter ? encounterMechanicHost(encounter, { wispSlow }) : played), [encounter, played, wispSlow]);
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
  // Lanes: the last wisp falls to the pieces' own Glow on the level's clock; there is no finale flight to wait for.
  const landed = encounter && (encounter.objective.kind !== 'wisps' || mechanic?.kind === 'lanes') ? true : finaleLanded;
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
  // Lanes move on their own clock between commits: the ref is the newest state, not the last one rendered.
  liveRef.current = store.mechanicState?.kind === 'lanes' ? store.mechanicStateRef.current ?? store.mechanicState : store.mechanicState;
  useEffect(() => { for (const listener of [...liveListeners.current]) listener(); }, [store.mechanicState]);
  // Lanes: what the wisps do between commits reaches the wisp layer alone; the screen re-renders only on a commit.
  // A hit, a fall or a board change goes at once; plain drifting at most every LANE_DRIFT_PUBLISH_MS (each wisp
  // glides on its own between updates, aiming ahead at its own speed, so fewer updates look the same).
  const storeTick = store.tick;
  const lastDriftRef = useRef(0);
  const laneTick = useCallback((dt: number) => {
    const result = storeTick(dt);
    if (!result || !(result.moved || result.changed)) return result;
    const now = Date.now();
    if (!result.changed && !result.hit && now - lastDriftRef.current < LANE_DRIFT_PUBLISH_MS) return result;
    lastDriftRef.current = now;
    liveRef.current = result.state;
    for (const listener of [...liveListeners.current]) listener();
    return result;
  }, [storeTick]);
  const live = useMemo((): MissionMechanicLive => ({
    get: () => liveRef.current ?? { kind: 'glow-strikes', strikes: 0 },
    subscribe: (listener) => { liveListeners.current.add(listener); return () => { liveListeners.current.delete(listener); }; },
  }), []);
  const wispTarget = useMemo((): CorruptionWispTarget | null => active && played && host && store.mechanicState
    ? missionWispTarget({ key: encounter ? `${encounter.id}:${attempt}` : played.id, host, mechanicState: store.mechanicState, node: tileNode, boardMetrics, window, lines: played.lines, settled: cameraSettled, revealNonce, ...(mechanic?.kind === 'dark-wisps' || mechanic?.kind === 'lanes' ? { live } : {}) })
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
  // v2: what the wisps just did, said for a beat before the friend's own line comes back.
  const [actLine, setActLine] = useState<string | null>(null);
  // Lanes: the first of each kind of wisp to come down in this battle is named, once, with what it does.
  const [kindLine, setKindLine] = useState<SpeechLine | null>(null);
  const kindsSeenRef = useRef<{ runId: string | null; seen: Set<string> }>({ runId: null, seen: new Set() });
  useEffect(() => {
    const state = store.mechanicState;
    if (!host || state?.kind !== 'lanes') return;
    const mechanic = resolveMechanic(host);
    if (mechanic.kind !== 'lanes') return;
    if (kindsSeenRef.current.runId !== runId) kindsSeenRef.current = { runId: runId ?? null, seen: new Set() };
    const seen = kindsSeenRef.current.seen;
    const arrived = mechanic.wisps.find((wisp, index) => wisp.look && WISP_KIND_LINES[wisp.look] && !seen.has(wisp.look) && laneArrived(mechanic, state, index) && laneAlive(mechanic, state, index));
    if (!arrived?.look) return;
    seen.add(arrived.look);
    setKindLine({ speaker: 'Mossprout', text: WISP_KIND_LINES[arrived.look]! });
  }, [host, runId, store.mechanicState]);
  useEffect(() => {
    if (!kindLine) return;
    const timer = setTimeout(() => setKindLine(null), KIND_LINE_MS);
    return () => clearTimeout(timer);
  }, [kindLine]);
  useEffect(() => {
    const kinds = new Set(effects.map((effect) => effect.kind));
    const act = WISP_ACT_ORDER.find((kind) => kinds.has(kind));
    if (!act) return;
    setActLine(WISP_ACT_LINES[act]);
    const timer = setTimeout(() => setActLine(null), ACT_LINE_MS);
    return () => clearTimeout(timer);
  }, [effects]);
  const ability = useMemo(() => {
    if (!encounter || !store.run || !store.state) return null;
    const found = abilityFor(effectiveLoadout);
    if (!found) return null;
    return { definition: found.definition, tier: found.tier, charge: store.run.ability?.charge ?? 0, ready: abilityReady(store.run, found.tier), targets: abilityTargets(found.definition, found.tier, store.state, window) };
  }, [effectiveLoadout, encounter, store.run, store.state, window]);
  const partnerAbility = useMemo(() => {
    if (!encounter || !store.run || !store.state || !effectiveLoadout?.partner) return null;
    const found = partnerAbilityFor(effectiveLoadout);
    if (!found) return null;
    return { definition: found.definition, tier: found.tier, charge: store.run.partnerAbility?.charge ?? 0, ready: partnerAbilityReady(store.run, found.tier), targets: abilityTargets(found.definition, found.tier, store.state, window), companionId: effectiveLoadout.partner.companionId };
  }, [effectiveLoadout, encounter, store.run, store.state, window]);
  const outcome = useMemo(() => (encounter && store.run && store.status ? encounterOutcome(encounter, store.run, store.status) : null), [encounter, store.run, store.status]);
  // A hero using their ability says so, for a moment, in the battle's speech bubble.
  const [abilityCall, setAbilityCall] = useState<SpeechLine | null>(null);
  const speech = useMemo(() => {
    if (!encounter || !store.run) return null;
    const facts = { remaining: resolveLeft(store.run), katchimera: effectiveLoadout?.companionId ?? null, ability: ability?.definition.name ?? null };
    if (abilityCall && store.status === 'playing') return abilityCall;
    if (kindLine && store.status === 'playing') return kindLine;
    if (cacheLine) return encounterLine('cacheFound', facts);
    if (actLine && store.status === 'playing') return actLine;
    // A scripted battle says its own lines; otherwise a Lanes sky is where the wisps come from, and nothing is said over it.
    if (speechFor && store.state && store.mechanicState) {
      const line = speechFor({ mechanicState: store.mechanicState, merges: store.merges, board: store.state });
      if (line || (host && resolveMechanic(host).kind === 'lanes')) return line;
    }
    if (host && resolveMechanic(host).kind === 'lanes') return null;
    // Merge vs Mist: a wisp with nothing but clear ground beside it is what the friend points at first; until the
    // first merges, the rule itself.
    if (store.status === 'playing' && store.state && host && mechanicIsTactics(resolveMechanic(host))) {
      const board = store.state;
      const exposed = wispViews(resolveMechanic(host), host, store.mechanicState ?? { kind: 'glow-strikes', strikes: 0 }).some((wisp) => wisp.alive && wisp.placement.kind === 'cell' && wispExposed(board, wisp.placement.cell, window));
      if (exposed) return EXPOSED_WISP_LINE;
      if (store.run.merges > 0 && store.run.merges <= 2) return SPREAD_LINE;
    }
    // Territory: a wisp one turn from spreading (or ending a gather) is what the friend points at first.
    if (store.status === 'playing' && store.run.territory && store.mechanicState && host) {
      const threat = wispViews(resolveMechanic(host), host, store.mechanicState).find((wisp) => wisp.alive && wisp.intent && wisp.intent.countdown <= 1 && (wisp.intent.kind === 'surge' || wisp.intent.kind === 'snuff' || wisp.intent.kind === 'gather'));
      if (threat) return threat.intent!.kind === 'gather' ? GATHER_LINE : THREAT_LINE;
    }
    if (store.status === 'playing' && ability?.ready) return encounterLine('abilityReady', facts) || null;
    if (store.status === 'playing' && Number.isFinite(facts.remaining) && facts.remaining <= LOW_RESOLVE) return encounterLine('lowResolve', facts);
    if (store.status === 'playing' && store.run.actions === 0) return encounterLine('enter', facts);
    return null;
  }, [ability, abilityCall, kindLine, actLine, cacheLine, effectiveLoadout?.companionId, encounter, host, store.mechanicState, store.run, store.status]);
  const onRetry = useCallback(() => setAttempt((value) => value + 1), []);
  const continues = store.run?.resolve.continues ?? 0;
  const onKeepGoing = useCallback(() => {
    if (!payKeepGoing || !runId) { keepGoing(KEEP_GOING_RESOLVE); return; }
    // Paid once per loss of this attempt: the receipt names the attempt and which continue it is.
    void payKeepGoing(`continue:${runId}:${continues}`).then((paid) => { if (paid) keepGoing(KEEP_GOING_RESOLVE); }).catch(() => undefined);
  }, [continues, keepGoing, payKeepGoing, runId]);
  const onUseAbility = useCallback((target: number | null, slot: 0 | 1 = 0) => {
    const effects = useAbility(target, slot);
    const used = slot === 1 ? partnerAbility : ability;
    if (!effects || !used?.definition.callout) return;
    const who = slot === 1 ? partnerAbility?.companionId : effectiveLoadout?.companionId;
    const speaker = (who ? katchimeraSkinById.get(who)?.displayName : null) ?? used.definition.name;
    setAbilityCall({ speaker, text: used.definition.callout });
  }, [ability, effectiveLoadout?.companionId, partnerAbility, useAbility]);
  useEffect(() => {
    if (!abilityCall) return;
    const timer = setTimeout(() => setAbilityCall(null), ABILITY_CALL_MS);
    return () => clearTimeout(timer);
  }, [abilityCall]);
  const lossReason = useMemo(() => (encounter && store.run && store.state && store.mechanicState && host && store.status === 'failed'
    ? encounterLossReason(encounter, host, store.mechanicState, store.run, store.state, window) : null), [encounter, host, store.mechanicState, store.run, store.state, store.status, window]);
  const lanes = mechanic?.kind === 'lanes' ? mechanic : null;
  const encounterDock = useMemo((): EncounterDockState | null => encounter && store.run ? {
    definition: encounter, resolveLeft: store.run.resolve.budget == null ? null : resolveLeft(store.run), status: store.status, outcome, ability, partnerAbility, speech, effects,
    // Lanes are never lost to the Mist's hold: no meter.
    territory: store.run.territory && !lanes ? { mist: store.run.territory.last, overrun: store.run.territory.overrun, cells: encounter.rows * 5 } : null,
    lanes: lanes && store.mechanicState?.kind === 'lanes' ? { left: wispViews(lanes, host!, store.mechanicState).filter((wisp) => wisp.damage < wisp.hp).length } : null,
    tick: lanes ? laneTick : null,
    // Merge tactics: every action is a turn.
    turns: host && mechanicIsTactics(resolveMechanic(host)) ? store.run.actions : store.run.merges, lossReason, keepGoingCost: payKeepGoing ? keepGoingCost ?? 0 : 0,
    boost: store.run.boost ?? { next: 0, water: 0 }, revealed: store.run.revealed ?? [],
    onUseAbility, onKeepGoing, onRetry, onLeave: onLeave ?? null,
  } : null, [ability, effects, encounter, host, lanes, lossReason, onKeepGoing, onLeave, onRetry, onUseAbility, outcome, partnerAbility, speech, laneTick, store.mechanicState, store.run, store.status]);
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
