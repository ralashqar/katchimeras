import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type View as ViewType } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { cancelAnimation, Easing, FadeIn, FadeOut, ZoomIn, ZoomOut, useAnimatedStyle, withDelay, withRepeat, useReducedMotion, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';

import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import type { RewardFlightPoint } from '@/components/katchadeck/ui/reward-token-flight';
import { AppFontFamilies } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image } from 'expo-image';
import { DARK_WISP_LOOK_ART } from '@/constants/dark-wisp-look-art';
import { isDarkWispLook } from '@/constants/dark-wisp-looks';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { OPENING_BOARD_LAYOUT } from '@/features/onboarding/opening-mist';
import { encounterWindow } from '@/features/encounter/create-state';
import { pulseAim, usePulseAim } from '@/features/encounter/pulse-aim';
import { pulseArea } from '@/features/encounter/pulse';
import { chainRole } from '@/features/encounter/chains';
import { glowShots, type GlowShot } from '@/features/encounter/mist';
import { ENCOUNTER_LOSS, ENCOUNTER_LOSS_V2, gradeLabel, outcomeLine } from '@/features/encounter/encounter-copy';
import { mechanicIsTactics, mechanicPlan, mechanicPlans, mechanicProgress, mechanicTurnStrip, resolveMechanic, wispViews } from '@/features/mission-mechanics/mechanic';
import { mergeWorldItemArt } from '@/constants/merge-world-art';
import type { WispPlan } from '@/types/mission-mechanic';
import type { MissionWindow } from '@/features/mission-mechanics/board-window';
import { mergeFtueAllowsCommand } from '@/features/onboarding/merge-ftue';
import { createMergeBoardSession } from '@/features/onboarding/merge-ftue-interaction-coordinator';
import { missionBoardStep } from '@/features/onboarding/steppling-mission';
import type { EncounterDockState } from '@/features/onboarding/use-mist-mission';
import type { MissionCommandResult } from '@/features/onboarding/use-opening-mission-board';
import type { HatchableMissionDefinition } from '@/types/hatchable-companion';
import type { MergeWorldCommand, MergeWorldState } from '@/types/merge-world';
import type { MissionMechanicState, MissionStrike } from '@/types/mission-mechanic';
import { mergeCellCenter, mergeCellFrame } from '@/utils/merge-world/board-geometry';
import { FriendSpeechBubble } from './friend-speech-bubble';
import { MIST_BOLT_LEAD_MS, MIST_BOLT_STAGGER_MS, MistLightning, type MistBolt } from '@/components/katchadeck/games/mist-lightning';
import { MistMissionDock, type GlowLandingSource, type OpeningGlowStore } from './kingdom-opening-merge-dock';
import { laneWispPoint } from './corruption-wisp-layer';
import { LANE_MISS_ROW, laneOf } from '@/features/mission-mechanics/lanes';
import { RECOIL_SQUASH_MS, spriteRecoil } from '@/components/katchadeck/games/sprite-recoil';

/** Lanes: the round Glow seed a shooter plant fires, and where its mouth is (a fraction down its cell). */
const GLOW_SEED_BULLET = require('@incubator/art-merge-world/items/glow-seed-bullet.webp');
const LANE_MOUTH_Y = 0.24;

type HatchableMissionDockProps = {
  /** Whose mission: the board's seed, bar, guidance and mechanic come from the definition (a friend's, or a journey tile's without a camera). */
  mission: Omit<HatchableMissionDefinition, 'camera'>;
  state: MergeWorldState;
  send: (command: MergeWorldCommand) => MissionCommandResult | null;
  merges: number;
  /** Where the board's strikes stand, by its mechanic: the bar and the guidance read it. */
  mechanicState: MissionMechanicState | null;
  /** The board is an encounter: its Resolve, ability, cache and loss are shown and driven here. */
  encounter?: EncounterDockState | null;
  width: number;
  bottomInset: number;
  /** The Glow's store: the bar flashes on its landings, and Merge vs Mist fires its Glow shots through it. */
  landings?: GlowLandingSource & { launchVolley?: OpeningGlowStore['launchVolley']; launchBolts?: OpeningGlowStore['launchBolts']; sinkRef?: OpeningGlowStore['sinkRef'] };
  /** A strike on the wisps: what flies is the mechanic's to say. */
  onStrike?: (from: RewardFlightPoint, strike: MissionStrike) => void;
  /** The strike that fills the bar: its item leaves the board for the mist. */
  onFinale?: (from: RewardFlightPoint, definitionId: string, strike: MissionStrike) => void;
  /** Veiled cells that burst open because a sleeper beside them woke. */
  onReveal?: (count: number) => void;
  onBoardMetrics?: (metrics: MergeBoardScreenMetrics | null) => void;
  onBlockedInteraction?: () => void;
  onEntranceSettled?: () => void;
};

/** Where the dock's overlay sits against the board: the board's frame in the dock's own coordinates. */
type BoardOffset = { x: number; y: number };

/**
 * A hatchable companion's mission board under their misted tile: the same
 * dock the opening used, on the companion's own board. Progress is the
 * mission store's own count, resolved by the board's mechanic, not an FTUE
 * run: the discovery story only hears about the bar filling.
 *
 * On an encounter the header shows the Resolve left and the Katchimera's
 * ability (tap it, then a plant or a spawner when it wants one); a spent
 * budget lays the loss over the board with the ways on.
 */
/**
 * The Mist's hold on the board (territory battles): how many cells it covers against the line where the level is
 * lost. When it spreads, the bar swells with a buzz; pulled back (a merge's pulse, Keep going), it settles. Reduced
 * motion: it simply changes.
 */
const MistMeter = memo(function MistMeter({ mist, overrun, cells, turns, reduceMotion }: { mist: number; overrun: number; cells: number; turns: number; reduceMotion: boolean }) {
  const swell = useSharedValue(0);
  const was = useRef(mist);
  useEffect(() => {
    if (was.current === mist) return;
    const rose = mist > was.current;
    was.current = mist;
    if (reduceMotion || !rose) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    swell.value = 0;
    swell.value = withSequence(withTiming(1, { duration: 160 }), withTiming(0, { duration: 380 }));
  }, [mist, reduceMotion, swell]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + swell.value * 0.12 }] }));
  const close = overrun - mist <= 2;
  const share = (value: number) => `${Math.max(0, Math.min(100, (value / Math.max(1, cells)) * 100))}%` as const;
  const control = Math.round((mist / Math.max(1, cells)) * 100);
  return <Animated.View accessibilityRole="text" accessibilityLabel={`Mist Control ${control} percent. At ${Math.round((overrun / Math.max(1, cells)) * 100)} percent it takes over. Turn ${turns}`} style={[styles.pill, styles.meterPill, close ? styles.pillLow : null, style]}>
    <IconSymbol name="cloud.fog.fill" size={15} color={close ? '#B0567A' : '#7A6A9E'} />
    <View style={styles.meterTrack}>
      <View style={[styles.meterFill, close ? styles.meterFillClose : null, { width: share(mist) }]} />
      <View style={[styles.meterLine, { left: share(overrun) }]} />
    </View>
    <Text style={styles.pillLabel}>{`Mist ${control}%`}</Text>
    <Text style={styles.pillLabel}>{`Turn ${turns}`}</Text>
  </Animated.View>;
});

/** Lanes: the level's clock ticks this often, and never moves on more than this in one tick. */
const LANE_TICK_MS = 100;
const LANE_TICK_MAX_MS = 250;

/** Merge vs Mist: held Mist lets go by this long after a volley even if a landing never arrives (a store torn down mid-flight). */
const HELD_MIST_SAFETY_MS = 4_000;

/** A cell the Mist takes next: it breathes dark, so the player sees it before committing to a merge. */
const NextMistPulse = memo(function NextMistPulse({ reduceMotion }: { reduceMotion: boolean }) {
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) { breath.value = 0.5; return; }
    breath.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(breath);
  }, [breath, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: 0.35 + breath.value * 0.5 }));
  return <Animated.View pointerEvents="none" style={[styles.nextMist, style]} />;
});

export const HatchableMissionDock = memo(function HatchableMissionDock({ mission, state, send, merges, mechanicState, encounter, width, bottomInset, landings, onStrike, onFinale, onReveal, onBoardMetrics, onBlockedInteraction, onEntranceSettled }: HatchableMissionDockProps) {
  const sessionRef = useRef<ReturnType<typeof createMergeBoardSession> | null>(null);
  if (!sessionRef.current) sessionRef.current = createMergeBoardSession();
  const sessionId = sessionRef.current.id;
  const boardStep = useMemo(() => missionBoardStep(mission, state, merges, mechanicState), [mechanicState, merges, mission, state]);
  const stateRef = useRef(state);
  const stepRef = useRef(boardStep);
  stateRef.current = state;
  stepRef.current = boardStep;
  // Read by the command handler: the battle's window (null on a board that is not a battle).
  const aimWindowRef = useRef<MissionWindow | null>(null);
  const boardMetricsRef = useRef<MergeBoardScreenMetrics | null>(null);
  const rootRef = useRef<ViewType | null>(null);
  const [boardOffset, setBoardOffset] = useState<BoardOffset | null>(null);
  const boardOffsetRef = useRef<BoardOffset | null>(null);
  boardOffsetRef.current = boardOffset;
  const handleMetrics = useCallback((metrics: MergeBoardScreenMetrics | null) => {
    boardMetricsRef.current = metrics;
    onBoardMetrics?.(metrics);
    // The board's frame against the dock's root, for overlays laid over its cells.
    if (metrics && rootRef.current) rootRef.current.measureInWindow((x, y) => setBoardOffset({ x: metrics.x - x, y: metrics.y - y }));
  }, [onBoardMetrics]);
  const [hiddenItemIds, setHiddenItemIds] = useState<ReadonlySet<string>>(() => new Set());
  const mechanic = resolveMechanic(mission);
  const progress = useMemo(() => mechanicState ? mechanicProgress(mechanic, mission, mechanicState) : { current: Math.max(0, Math.min(mission.required, merges)), total: mission.required }, [mechanic, mechanicState, merges, mission]);
  // A merge's Glow reaches the Mist it clears as lightning over the board (the Egg's bolt), from the merged piece to
  // each cell. The Mist it strikes stays drawn as it was, and a piece it frees stays under its Mist, until that bolt
  // lands; then the Mist lets go and the board puffs it away.
  // The hold lives in a ref written in the same synchronous step as the store's commit, so the first render that shows
  // the settled board already holds its Mist: no render ever shows a cell cleared before its Glow has landed.
  type HeldMist = MergeWorldState['board'][number]['mist'];
  const heldRef = useRef<Record<number, HeldMist>>({});
  const [heldTick, setHeldTick] = useState(0);
  const heldMist = useMemo((): Readonly<Record<number, HeldMist>> | undefined => (Object.keys(heldRef.current).length ? { ...heldRef.current } : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, heldTick]);
  const [bolts, setBolts] = useState<readonly MistBolt[]>([]);
  const boltSeq = useRef(0);
  const launchShots = useCallback((shots: readonly GlowShot[], before: MergeWorldState, after: MergeWorldState, window: MissionWindow | null) => {
    const metrics = boardMetricsRef.current;
    const offset = boardOffsetRef.current;
    const remaining = new Map<number, number>();
    for (const shot of shots) remaining.set(shot.to, (remaining.get(shot.to) ?? 0) + 1);
    const hold: Record<number, HeldMist> = {};
    const freed = new Map<number, string>();
    const holdCell = (cell: number) => {
      const mist = before.board[cell]?.mist;
      if (mist?.kind !== 'encounter' || mist.type === 'wisp-bound') return;
      hold[cell] = mist;
      const occupant = after.board[cell]?.occupant;
      if (mist.type === 'bound' && occupant?.kind === 'item' && after.board[cell]?.mist?.kind !== 'encounter') freed.set(cell, occupant.instanceId);
    };
    for (const cell of remaining.keys()) holdCell(cell);
    // Any other Mist this merge lifted or wore (never a shot's own) waits for the volley's last landing.
    const stragglers = (window?.cellIndices ?? []).filter((cell) => !remaining.has(cell) && before.board[cell]?.mist?.kind === 'encounter' && before.board[cell]?.mist !== after.board[cell]?.mist && after.board[cell]?.mist?.kind !== 'encounter');
    for (const cell of stragglers) holdCell(cell);
    if (!Object.keys(hold).length) return;
    Object.assign(heldRef.current, hold);
    if (freed.size) setHiddenItemIds((hidden) => new Set([...hidden, ...freed.values()]));
    setHeldTick((tick) => tick + 1);
    const release = (cells: readonly number[]) => {
      let changed = false;
      for (const cell of cells) {
        if (!(cell in heldRef.current) || heldRef.current[cell] !== hold[cell]) continue;
        delete heldRef.current[cell];
        changed = true;
      }
      const unhide = cells.flatMap((cell) => (freed.has(cell) ? [freed.get(cell)!] : []));
      if (unhide.length) setHiddenItemIds((hidden) => { const next = new Set(hidden); for (const id of unhide) next.delete(id); return next; });
      if (changed) setHeldTick((tick) => tick + 1);
    };
    const all = Object.keys(hold).map(Number);
    // No board frame to strike across: nothing can land, so let go at once.
    if (!metrics || !offset || !shots.length) { release(all); return; }
    const box = (cell: number) => { const { bounds } = mergeCellFrame(metrics.geometry, cell); return { left: offset.x + bounds.left, top: offset.y + bounds.top, width: bounds.width, height: bounds.height }; };
    let flying = shots.length;
    const made: MistBolt[] = shots.map((shot, index) => ({
      id: ++boltSeq.current, from: box(shot.from), to: box(shot.to), delay: MIST_BOLT_LEAD_MS + index * MIST_BOLT_STAGGER_MS,
      onImpact: () => {
        const cell = shot.to;
        const left = (remaining.get(cell) ?? 1) - 1;
        remaining.set(cell, left);
        if (left <= 0) release([cell]);
        flying -= 1;
        if (flying <= 0) release(stragglers);
      },
    }));
    setBolts((current) => [...current, ...made]);
    setTimeout(() => release(all), HELD_MIST_SAFETY_MS);
  }, []);
  const retireBolt = useCallback((id: number) => setBolts((current) => current.filter((bolt) => bolt.id !== id)), []);
  const dispatch = useCallback((command: MergeWorldCommand): MissionCommandResult | null => {
    const current = stateRef.current;
    if (!mergeFtueAllowsCommand(stepRef.current, current, command)) {
      onBlockedInteraction?.();
      return null;
    }
    // A mission has no Energy economy; a spawner tap (a friend's board may have one) is never refused for it.
    const effective = command.type === 'tapGenerator' ? { ...command, spendEnergy: false as const } : command;
    const result = send(effective);
    if (result) stateRef.current = result.state;
    // Merge vs Mist: the merged piece's Glow flies at the Mist it hit; each cell holds until its shot lands.
    // Every battle: the Mist a merge lifts holds until the Glow shot at it lands.
    if (result?.changed && aimWindowRef.current) launchShots(result.shots ?? [], current, result.state, aimWindowRef.current);
    if (result?.failureReason === 'out_of_resolve' || result?.failureReason === 'spawner_spent') onBlockedInteraction?.();
    if (result?.revealedMistCells?.length) onReveal?.(result.revealedMistCells.length);
    // A merge or a waking is a strike; the store resolved what it does by the board's mechanic.
    const strike = result?.strike ?? null;
    if (!result || !strike) return result;
    const metrics = boardMetricsRef.current;
    if (!metrics) return result;
    const center = mergeCellCenter(metrics.geometry, strike.fromCell);
    const from = { x: metrics.x + center.x, y: metrics.y + center.y };
    if (strike.finale) {
      const occupant = result.state.board[strike.fromCell]?.occupant;
      if (occupant?.kind === 'item') setHiddenItemIds((hidden) => new Set([...hidden, occupant.instanceId]));
      onFinale?.(from, strike.resultDefinitionId, strike);
    } else {
      onStrike?.(from, strike);
    }
    return result;
  }, [launchShots, onBlockedInteraction, onFinale, onReveal, onStrike, send]);

  // The ability: a tap uses it at once when it wants no target; otherwise the board's possible targets light up for a pick.
  const [picking, setPicking] = useState(false);
  const ability = encounter?.ability ?? null;
  useEffect(() => { if (!ability?.ready) setPicking(false); }, [ability?.ready]);
  const pressAbility = useCallback(() => {
    if (!ability?.ready || !encounter) return;
    if (ability.definition.targeting === 'none') { encounter.onUseAbility(null); return; }
    setPicking((value) => !value);
  }, [ability, encounter]);
  const pickTarget = useCallback((cell: number) => {
    encounter?.onUseAbility(cell);
    setPicking(false);
  }, [encounter]);
  const reduceMotion = useReducedMotion();
  // Lanes (`docs/encounter-lanes.md`): the level runs on its own clock once the dock has risen, while it is being
  // played; each piece's Glow flies from its cell at the wisp it is aimed at, for exactly as long as the level says.
  const [entered, setEntered] = useState(false);
  const handleEntranceSettled = useCallback(() => { setEntered(true); onEntranceSettled?.(); }, [onEntranceSettled]);
  const laneTick = encounter?.tick ?? null;
  const laneTickRef = useRef(laneTick);
  laneTickRef.current = laneTick;
  const lanesRunning = Boolean(laneTick) && entered && (encounter?.status === 'playing' || encounter?.status === 'stuck');
  useEffect(() => {
    if (!lanesRunning) return;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      // A stall (the app put away, a long frame) never jumps the level on.
      const dt = Math.min(LANE_TICK_MAX_MS, Math.max(0, now - last));
      last = now;
      const result = laneTickRef.current?.(dt);
      const metrics = boardMetricsRef.current;
      // A wisp over the board spits Mist: a violet bolt from the wisp down to the cell it lands on.
      const offset = boardOffsetRef.current;
      if (result?.spat.length && metrics && offset) {
        const origin = { x: metrics.x - offset.x, y: metrics.y - offset.y };
        const made = result.spat.flatMap((spit): MistBolt[] => {
          const at = landings?.sinkRef?.current?.pointOf?.(spit.wisp);
          if (!at) return [];
          const { bounds } = mergeCellFrame(metrics.geometry, spit.cell);
          const size = bounds.width * 0.6;
          return [{
            id: ++boltSeq.current, tone: 'mist', delay: 0, onImpact: () => {},
            from: { left: at.x - origin.x - size / 2, top: at.y - origin.y - size / 2, width: size, height: size },
            to: { left: offset.x + bounds.left, top: offset.y + bounds.top, width: bounds.width, height: bounds.height },
          }];
        });
        if (made.length) setBolts((current) => [...current, ...made]);
      }
      if (!result?.fired.length || !metrics || !landings?.launchBolts) return;
      const window = aimWindowRef.current;
      const board = stateRef.current.board;
      landings.launchBolts(result.fired.map((shot) => {
        const frame = mergeCellFrame(metrics.geometry, shot.fromCell).bounds;
        const lane = window ? laneOf(window, shot.fromCell) : null;
        // A miss climbs its column past the top of the board.
        const to = lane && window ? laneWispPoint(metrics, window, lane.column, -LANE_MISS_ROW) : undefined;
        // The plant squashes, then stretches as the Glow seed leaves its mouth; the seed still lands on the level's
        // clock, so its flight is that much shorter.
        const shooter = board[shot.fromCell]?.occupant;
        if (shooter?.kind === 'item') spriteRecoil.emit(shooter.instanceId);
        const flight = shot.landsAt - shot.firedAt;
        return {
          from: { x: metrics.x + frame.left + frame.width / 2, y: metrics.y + frame.top + frame.height * LANE_MOUTH_Y },
          wisp: shot.wisp, ...(to ? { to } : {}), delayMs: RECOIL_SQUASH_MS, durationMs: Math.max(80, flight - RECOIL_SQUASH_MS),
          art: GLOW_SEED_BULLET, size: Math.max(14, frame.width * 0.34),
        };
      }));
    }, LANE_TICK_MS);
    return () => clearInterval(timer);
  }, [landings, lanesRunning]);
  // Territory: a piece held over its twin shows the Harmony pulse its merge would send, and rings the wisp it would strike.
  const aimWindow = useMemo(() => (encounter ? encounterWindow(encounter.definition) : null), [encounter?.definition]);
  aimWindowRef.current = aimWindow;
  const aimFromCell = useCallback((cell: number, source: number) => {
    const board = stateRef.current.board;
    const held = source >= 0 ? board[source]?.occupant : null;
    const under = cell >= 0 && cell !== source ? board[cell]?.occupant : null;
    const next = held?.kind === 'item' && under?.kind === 'item' && under.definitionId === held.definitionId ? MERGE_ITEMS_BY_ID.get(held.definitionId)?.nextItemId : null;
    const tier = next ? MERGE_ITEMS_BY_ID.get(next)?.tier ?? null : null;
    pulseAim.set(tier != null ? { cell, tier, ...(next ? { definitionId: next } : {}) } : null);
  }, []);
  useEffect(() => () => pulseAim.set(null), []);
  const aim = usePulseAim();
  // While a piece is held over its twin: the cells its merge would reach (Merge vs Mist: the Mist its Glow would hit).
  const pulseCells = useMemo(() => {
    if (!aim || !aimWindow) return [];
    const clearsByGlow = mechanicIsTactics(resolveMechanic(mission)) || resolveMechanic(mission).kind === 'lanes';
    if (!clearsByGlow || !aim.definitionId) return pulseArea(aim.cell, aim.tier, aimWindow).cells;
    const boost = encounter?.boost ?? { next: 0, water: 0 };
    const water = chainRole(aim.definitionId) === 'water';
    const toward = mechanicState?.kind === 'dark-wisps' ? (mechanicState.nest ?? []).filter((cell) => cell >= 0) : [];
    return [...new Set(glowShots(state, aim.cell, aim.definitionId, aimWindow, undefined, { boost: boost.next + (water ? boost.water : 0), toward }).shots.map((shot) => shot.to))];
  }, [aim, aimWindow, encounter?.boost, mechanicState, mission, state]);
  // What a wisp took off the board without a merge (a piece it ate) puffs away on the board, never simply vanishing.
  const effectSeq = useRef(0);
  const effectCells = useMemo(() => (encounter?.effects ?? []).flatMap((effect) => (effect.kind === 'ate' ? [{ id: ++effectSeq.current, cell: effect.cell, kind: 'mist-burst' as const }] : [])), [encounter?.effects]);
  // Spores a wisp has dropped: a free cell that turns to Mist unless a piece is put on it.
  const spores = useMemo(() => (mechanicState ? wispViews(mechanic, mission, mechanicState).flatMap((view) => view.spores ?? []) : []), [mechanic, mechanicState, mission]);
  // What every wisp will do after the player's next action, shown on the board before it happens.
  const tactics = mechanicIsTactics(mechanic);
  const plans = useMemo((): WispPlan[] => {
    if (!mechanicState || !aimWindow || encounter?.status !== 'playing') return [];
    if (tactics) return mechanicPlans(mechanic, mechanicState, state, aimWindow).filter((plan): plan is WispPlan => Boolean(plan));
    const plan = mechanicPlan(mechanic, mechanicState, state, aimWindow);
    return plan ? [plan] : [];
  }, [aimWindow, encounter?.status, mechanic, mechanicState, state, tactics]);
  // Scout: what the Mist is hiding on the cells Voyagle looked under.
  const revealed = useMemo(() => (encounter?.revealed ?? []).flatMap((cell) => {
    const mist = state.board[cell]?.mist;
    if (mist?.kind !== 'encounter' || !mist.holds) return [];
    return [{ cell, art: mist.holds.kind === 'item' ? mergeWorldItemArt(mist.holds.definitionId) : null }];
  }), [encounter?.revealed, state]);
  const pickCells = picking && ability ? ability.targets : [];
  // The turn strip: who acts, in order, after the player's merge (a territory battle's; Merge vs Mist shows only the cells).
  const strip = useMemo(() => {
    if (!mechanicState || tactics) return [];
    const views = wispViews(mechanic, mission, mechanicState);
    return mechanicTurnStrip(mechanic, mechanicState, 4).map((entry, place) => ({ key: `${place}:${entry}`, look: entry >= 0 ? views[entry]?.look ?? null : null, rest: entry < 0 }));
  }, [mechanic, mechanicState, mission, tactics]);
  // Focus / Ripple: the next merge is stronger.
  const boostLabel = encounter?.boost.next ? `Next merge +${encounter.boost.next}` : encounter?.boost.water ? `Next Water merge +${encounter.boost.water}` : null;
  // A merge-tactics battle plays on five rows.
  const boardLayout = useMemo(() => (aimWindow && aimWindow.rows === 5 ? { ...OPENING_BOARD_LAYOUT, rows: 5, cellIndices: aimWindow.cellIndices, accessibilityLabel: 'Battle board, five columns by five rows' } : undefined), [aimWindow]);
  // A Lanes battle keeps the space over the board clear: no pills, no lines; the wisps come from there.
  // A Lanes battle keeps the space over the board clear: no pills; only a friend's line when a scripted battle has one.
  const header = encounter?.lanes
    ? (encounter.speech ? <View pointerEvents="box-none" style={styles.header}>
      <View style={styles.speechRow}><FriendSpeechBubble text={encounter.speech} reduceMotion={reduceMotion} tail="none" raise={false} /></View>
    </View> : null)
    : encounter ? <View pointerEvents="box-none" style={styles.header}>
    {encounter.speech ? <View style={styles.speechRow}><FriendSpeechBubble text={encounter.speech} reduceMotion={reduceMotion} tail="none" raise={false} /></View> : null}
    <View style={styles.headerRow}>
      {strip.length ? <View accessibilityRole="text" accessibilityLabel={`The wisps act in this order: ${strip.map((entry) => (entry.rest ? 'a rest' : entry.look ?? 'a wisp')).join(', ')}`} style={[styles.pill, styles.stripPill]}>
        {strip.map((entry, place) => <View key={entry.key} style={[styles.stripEntry, place === 0 ? styles.stripFront : null]}>
          {entry.rest ? <IconSymbol name="moon.stars.fill" size={12} color="#8C9BB0" /> : isDarkWispLook(entry.look) ? <Image source={DARK_WISP_LOOK_ART[entry.look]} style={styles.stripArt} contentFit="contain" transition={0} /> : <IconSymbol name="sparkles" size={12} color="#7A6A9E" />}
        </View>)}
      </View> : null}
      {encounter.territory ? <MistMeter mist={encounter.territory.mist} overrun={encounter.territory.overrun} cells={encounter.territory.cells} turns={encounter.turns} reduceMotion={reduceMotion} /> : <View accessibilityRole="text" accessibilityLabel={encounter.resolveLeft == null ? 'No Resolve budget' : `Resolve ${encounter.resolveLeft}`} style={[styles.pill, encounter.resolveLeft != null && encounter.resolveLeft <= 3 ? styles.pillLow : null]}>
        <Text style={styles.pillLabel}>Resolve</Text>
        <Text style={styles.pillValue}>{encounter.resolveLeft == null ? '∞' : encounter.resolveLeft}</Text>
      </View>}
      {ability ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ability.ready }} accessibilityLabel={`${ability.definition.name}, ${ability.ready ? 'ready' : `${ability.charge} of ${ability.tier.chargeEvery} charged`}`}
        onPress={pressAbility} style={[styles.abilityButton, ability.ready ? styles.abilityReady : null, picking ? styles.abilityPicking : null]}>
        <Text style={styles.abilityName}>{ability.definition.name}</Text>
        <Text style={styles.abilityCharge}>{ability.ready ? (picking ? 'Choose' : 'Ready') : `${Math.min(ability.charge, ability.tier.chargeEvery)}/${ability.tier.chargeEvery}`}</Text>
      </Pressable> : null}
      {boostLabel ? <Animated.View entering={ZoomIn.duration(reduceMotion ? 60 : 220)} exiting={FadeOut.duration(160)} style={[styles.pill, styles.boostPill]}><Text style={styles.boostText}>{boostLabel}</Text></Animated.View> : null}
      {encounter.outcome?.cleared ? <View style={styles.pill}><Text style={styles.pillValue}>{gradeLabel(encounter.outcome.grade)}</Text></View> : null}
    </View>
  </View> : null;
  const cellBox = (cell: number) => {
    const metrics = boardMetricsRef.current;
    if (!metrics || !boardOffset) return null;
    const { bounds } = mergeCellFrame(metrics.geometry, cell);
    return { left: boardOffset.x + bounds.left, top: boardOffset.y + bounds.top, width: bounds.width, height: bounds.height };
  };
  const overlay = encounter ? <>
    {bolts.map((bolt) => <MistLightning key={bolt.id} bolt={bolt} reduceMotion={reduceMotion} onDone={retireBolt} />)}
    {plans.flatMap((plan) => {
      const key = `plan:${plan.wisp}:${plan.kind}`;
      // A Drifter's next step: an arrow from where it is to the Mist it drifts into.
      if (plan.kind === 'move' && plan.cells[0] != null) {
        const from = mechanicState?.kind === 'dark-wisps' ? mechanicState.nest?.[plan.wisp] ?? -1 : -1;
        const a = from >= 0 ? cellBox(from) : null;
        const b = cellBox(plan.cells[0]);
        if (!a || !b) return [];
        const angle = Math.atan2(b.top - a.top, b.left - a.left);
        return [<Animated.View key={key} entering={FadeIn.duration(reduceMotion ? 60 : 200)} exiting={FadeOut.duration(reduceMotion ? 60 : 160)} pointerEvents="none" accessible accessibilityLabel="The wisp drifts here next" style={[styles.intentCell, styles.intentMove, b]}>
          <View style={[styles.intentBadge, { transform: [{ rotate: `${angle}rad` }] }]}><IconSymbol name="arrow.right" size={14} color="#FFFFFF" /></View>
        </Animated.View>];
      }
      // Where the Mist goes next: the cell pulses dark before the merge that lets it happen. A piece on it is locked (a
      // Snare Wisp) or holds its ground.
      const onPiece = (cell: number) => state.board[cell]?.occupant?.kind === 'item';
      return plan.kind === 'shield' || plan.kind === 'ward' || plan.kind === 'mend' || plan.kind === 'rest' ? [] : plan.cells.flatMap((cell) => {
        const box = cellBox(cell);
        return box ? [<Animated.View key={`${key}:${cell}`} entering={FadeIn.duration(reduceMotion ? 60 : 200)} exiting={FadeOut.duration(reduceMotion ? 60 : 160)} pointerEvents="none" accessible accessibilityLabel={onPiece(cell) ? 'The Mist reaches for this piece next' : 'The Mist spreads here next'} style={[styles.intentCell, onPiece(cell) ? styles.intentPiece : styles.intentMist, box]}>
          <NextMistPulse reduceMotion={reduceMotion} />
          <View style={styles.intentBadge}><IconSymbol name={onPiece(cell) ? 'lock.fill' : 'cloud.fog.fill'} size={13} color="#FFFFFF" /></View>
        </Animated.View>] : [];
      });
    })}
    {revealed.map(({ cell, art }) => { const box = cellBox(cell); return box ? <Animated.View key={`seen:${cell}`} entering={ZoomIn.duration(reduceMotion ? 60 : 240)} exiting={FadeOut.duration(160)} pointerEvents="none" accessible accessibilityLabel="Voyagle saw something under this Mist" style={[styles.seenCell, box]}>
      {art ? <Image source={art} style={styles.seenArt} contentFit="contain" transition={0} /> : <IconSymbol name="shippingbox.fill" size={18} color="#FFFFFF" />}
    </Animated.View> : null; })}
    {pulseCells.map((cell) => { const box = cellBox(cell); return box ? <Animated.View key={`pulse:${cell}`} entering={FadeIn.duration(reduceMotion ? 60 : 140)} exiting={FadeOut.duration(reduceMotion ? 60 : 160)} pointerEvents="none" style={[styles.pulseCell, box]} /> : null; })}
    {spores.map((spore) => { const box = cellBox(spore.cell); return box ? <Animated.View key={`spore:${spore.cell}`} entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)} exiting={reduceMotion ? undefined : ZoomOut.duration(220)} pointerEvents="none" accessible accessibilityLabel={`A spore. It turns to Mist in ${spore.turns} ${spore.turns === 1 ? 'turn' : 'turns'} unless a piece is put here`} style={[styles.sporeCell, box]}>
      <View style={styles.sporeDot}><Text style={styles.sporeText}>{spore.turns}</Text></View>
    </Animated.View> : null; })}
    {picking && ability && boardOffset ? pickCells.map((cell) => {
      const metrics = boardMetricsRef.current;
      if (!metrics) return null;
      const frame = mergeCellFrame(metrics.geometry, cell);
      return <Pressable key={`pick:${cell}`} accessibilityRole="button" accessibilityLabel={`${ability.definition.name} here`} onPress={() => pickTarget(cell)}
        style={[styles.pickCell, { left: boardOffset.x + frame.bounds.left, top: boardOffset.y + frame.bounds.top, width: frame.bounds.width, height: frame.bounds.height }]} />;
    }) : null}
    {encounter.status === 'failed' ? <Animated.View entering={FadeIn.duration(reduceMotion ? 80 : 260)} exiting={FadeOut.duration(160)} style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={styles.lossScrim} />
      <View style={styles.lossCard}>
        <Text style={styles.lossEyebrow}>{ENCOUNTER_LOSS.eyebrow}</Text>
        <Text style={styles.lossTitle}>{encounter.territory && encounter.lossReason && encounter.lossReason !== 'resolve' ? ENCOUNTER_LOSS_V2[encounter.lossReason].title : ENCOUNTER_LOSS.title}</Text>
        <Text style={styles.lossBody}>{encounter.territory && encounter.lossReason && encounter.lossReason !== 'resolve' ? ENCOUNTER_LOSS_V2[encounter.lossReason].body : ENCOUNTER_LOSS.body}</Text>
        <View style={styles.lossActions}>
          <KatchaButton label={ENCOUNTER_LOSS.retry} onPress={encounter.onRetry} variant="primary" fullWidth />
          <KatchaButton label={encounter.territory ? ENCOUNTER_LOSS_V2.keepGoing : ENCOUNTER_LOSS.keepGoing} onPress={encounter.onKeepGoing} variant="secondary" fullWidth
            cost={encounter.keepGoingCost ? { currency: 'coins', amount: encounter.keepGoingCost } : undefined} />
          {encounter.onLeave ? <KatchaButton label={ENCOUNTER_LOSS.leave} onPress={encounter.onLeave} variant="tertiary" fullWidth /> : null}
        </View>
        {encounter.outcome ? <Text style={styles.lossFootnote}>{outcomeLine('cleared', { continues: encounter.outcome.continues, rescued: encounter.outcome.rescued }) === 'Cleared.' ? '' : ''}</Text> : null}
      </View>
    </Animated.View> : null}
  </> : undefined;

  return <MistMissionDock
    state={state} boardStep={boardStep} progress={progress.current} required={progress.total} barTitle={mission.barTitle}
    interactionKey={`${mission.id}:${boardStep?.id ?? 'free'}`} sessionId={sessionId} hiddenItemIds={hiddenItemIds}
    width={width} bottomInset={bottomInset} landings={landings}
    onCommand={dispatch} onBoardMetrics={handleMetrics} onBlockedInteraction={onBlockedInteraction} onEntranceSettled={handleEntranceSettled}
    rootRef={rootRef} header={header} headerGap={encounter ? 6 : undefined} overlay={overlay} onHoverCell={encounter?.territory ? aimFromCell : undefined}
    layout={boardLayout}
    animateArrivals={Boolean(encounter)} externalEffects={effectCells} heldMist={heldMist} hideBar={Boolean(encounter?.lanes)} />;
});

const styles = StyleSheet.create({
  header: { alignSelf: 'stretch', alignItems: 'center', gap: 6 },
  speechRow: { alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F4F9FD', borderWidth: 1.5, borderColor: '#FFFFFF', boxShadow: '0 3px 10px rgba(20,40,60,0.14)' },
  pillLow: { backgroundColor: '#FFF0E6', borderColor: '#FFD9C2' },
  meterPill: { alignItems: 'center' },
  meterTrack: { width: 76, height: 8, borderRadius: 4, backgroundColor: '#E3E9F0', overflow: 'visible' },
  meterFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4, backgroundColor: '#9C86C8' },
  meterFillClose: { backgroundColor: '#C9678F' },
  meterLine: { position: 'absolute', top: -3, bottom: -3, width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: '#5B3F86' },
  stripPill: { alignItems: 'center', gap: 3, paddingHorizontal: 8 },
  stripEntry: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(90,70,130,0.12)' },
  stripFront: { borderWidth: 1.5, borderColor: '#C9678F' },
  stripArt: { width: 20, height: 20 },
  intentCell: { position: 'absolute', borderRadius: 10, borderWidth: 2, alignItems: 'flex-end', justifyContent: 'flex-start' },
  intentMist: { borderColor: 'rgba(150,110,210,0.9)', borderStyle: 'dashed', backgroundColor: 'rgba(120,90,180,0.14)' },
  intentPiece: { borderColor: 'rgba(201,103,143,0.95)', backgroundColor: 'rgba(201,103,143,0.12)' },
  intentMove: { borderColor: 'rgba(150,110,210,0.55)', alignItems: 'center', justifyContent: 'center' },
  intentBadge: { margin: 2, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(92,62,140,0.9)' },
  pulseCell: { position: 'absolute', borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,210,122,0.9)', backgroundColor: 'rgba(255,226,160,0.22)' },
  sporeCell: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  sporeDot: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, backgroundColor: 'rgba(122,92,170,0.85)', borderWidth: 1.5, borderColor: '#E8DDFB' },
  sporeText: { color: '#FFFFFF', fontFamily: AppFontFamilies.fredokaBold, fontSize: 12 },
  pillLabel: { color: '#5B7390', fontFamily: AppFontFamilies.fredokaBold, fontSize: 12 },
  pillValue: { color: '#2E4A66', fontFamily: AppFontFamilies.fredokaBold, fontSize: 15 },
  abilityButton: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 16, backgroundColor: 'rgba(244,249,253,0.7)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' },
  abilityReady: { backgroundColor: '#E6F6EA', borderColor: '#9ED8AE', boxShadow: '0 0 14px rgba(95,168,123,0.45)' },
  abilityPicking: { backgroundColor: '#FFF6D6', borderColor: '#F2D27A' },
  abilityName: { color: '#2E4A66', fontFamily: AppFontFamilies.fredokaBold, fontSize: 13, lineHeight: 15 },
  boostPill: { alignItems: 'center', backgroundColor: '#FFF6DE', borderColor: '#F2D48A' },
  boostText: { color: '#9A6A12', fontFamily: AppFontFamilies.fredokaBold, fontSize: 12 },
  seenCell: { position: 'absolute', alignItems: 'center', justifyContent: 'center', opacity: 0.8 },
  seenArt: { width: '62%', height: '62%' },
  nextMist: { ...StyleSheet.absoluteFillObject, borderRadius: 10, backgroundColor: 'rgba(92,62,140,0.28)' },
  abilityCharge: { color: '#5B7390', fontFamily: AppFontFamilies.fredokaBold, fontSize: 11, lineHeight: 13 },
  pickCell: { position: 'absolute', borderRadius: 10, borderWidth: 3, borderColor: '#F2D27A', backgroundColor: 'rgba(255,246,214,0.35)' },
  lossScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(22,16,40,0.42)', borderRadius: 18 },
  lossCard: { position: 'absolute', left: 18, right: 18, top: '18%', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 18, borderRadius: 22, borderCurve: 'continuous', backgroundColor: '#F4F9FD', borderWidth: 1.5, borderColor: '#FFFFFF', boxShadow: '0 8px 24px rgba(20,40,60,0.22)' },
  lossEyebrow: { color: '#5B7390', fontFamily: AppFontFamilies.fredokaBold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  lossTitle: { color: '#2E4A66', fontFamily: AppFontFamilies.fredokaBold, fontSize: 18, textAlign: 'center' },
  lossBody: { color: '#5B7390', fontFamily: AppFontFamilies.fredokaBold, fontSize: 13, textAlign: 'center', marginBottom: 6 },
  lossActions: { alignSelf: 'stretch', gap: 8 },
  lossFootnote: { height: 0 },
});
