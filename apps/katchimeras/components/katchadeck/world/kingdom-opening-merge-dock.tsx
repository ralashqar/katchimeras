import type { ArtSource } from '@/utils/art-source';
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import type { MergeBoardEffectKind } from '@/utils/merge-world/board-effects';
import { Pressable, StyleSheet, Text, View, type View as ViewType } from 'react-native';
import Animated, { cancelAnimation, Easing, FadeIn, FadeOut, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

import { MergePlaySurface } from '@/components/katchadeck/games/merge-play-surface';
import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { ProgressBar } from '@/components/katchadeck/progress-bar';
import { REWARD_TOKEN_FLIGHT_MS, REWARD_TOKEN_HOVER_MS, REWARD_TOKEN_RISE_MS, REWARD_TOKEN_STAGGER_MS, RewardTokenFlight, type RewardFlightPoint } from '@/components/katchadeck/ui/reward-token-flight';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { mergeWorldItemArt } from '@/constants/merge-world-art';
import { KatchaDeckUI } from '@/constants/theme';
import type { FtueEvent, FtueRunState, FtueStepDefinition } from '@/features/onboarding/ftue-types';
import { mergeFtueBoardGate } from '@/features/onboarding/merge-ftue';
import { createMergeBoardSession, MergeFtueInteractionCoordinator } from '@/features/onboarding/merge-ftue-interaction-coordinator';
import { OPENING_BOARD_LAYOUT, OPENING_MERGE_REQUIRED, OPENING_MERGE_WINDOW_COLUMNS, openingMergesOnBoard, openingMistBoardStep, openingMistProgress } from '@/features/onboarding/opening-mist';
import { dispatchFtueEvent } from '@/features/onboarding/ftue-runtime';
import { useFtueMergeDispatch } from '@/features/onboarding/use-ftue-merge-dispatch';
import type { MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import type { MissionStrike } from '@/types/mission-mechanic';
import { mergeCellCenter } from '@/utils/merge-world/board-geometry';

/** Glow per merge: a burst that peels off one after another, each landing with its own impact. */
export const OPENING_GLOWS_PER_MERGE = 4;
/** Rise + hover + flight of the last Glow in a burst; the bar fills when it lands, not when the merge commits. */
export const OPENING_GLOW_FLIGHT_MS = 700 + (OPENING_GLOWS_PER_MERGE - 1) * 65;
/** How long the impact burst lives at the veiled tile. */
export const OPENING_IMPACT_BURST_MS = 640;
/**
 * From the finale's impact: the wisp it struck shrinks and bursts over 440ms and is gone. The hold
 * on the board lifts right after, while the strike's last sparks are still fading; it used to wait
 * for the whole burst and then a further beat, leaving the empty board up for over a second.
 */
const OPENING_FINALE_SETTLE_MS = 520;
const GLOW_SIZE = 34;
// Fewer, shadow-free motes: four impacts land per merge, and blurred shadows on
// animating views re-rasterise every frame.
const BURST_PARTICLES = 6;
const GLOW_COLOR = '#8FD3FF';
/** The bar reads dark against its pale panel: deep violet fill on a dusk track. */
const BAR_FILL_COLOR = '#6A46C9';
const BAR_TRACK_COLOR = 'rgba(84,66,128,0.24)';

export type OpeningGlowFlight = { id: number; index: number; from: RewardFlightPoint; to: RewardFlightPoint; art?: ArtSource; size?: number; count?: number; group?: number; key?: number; /** A Merge vs Mist Glow shot: always bursts where it lands, as a strike. */ shot?: boolean;
  /** Lanes: a bolt straight up its column, flown for exactly this long (the level lands its damage on the same clock), after `delay` ms. */ direct?: number; delay?: number };
/** One Glow shot of a merge's volley (Merge vs Mist), in window space. */
export type GlowVolleyShot = { from: RewardFlightPoint; to: RewardFlightPoint };

/**
 * Something over the mist that takes the Glow instead of the tile (the
 * corruption wisps). It aims each burst and hears each landing: every token
 * strikes, and once per burst the first to land counts a hit. A burst that
 * carries the strike its board resolved is aimed at that strike's wisp and
 * lands its hits; one without (the opening's) is dealt by the sink itself.
 */
export type GlowSink = {
  /** Where a wisp is drawn right now (Lanes: a shot flies straight at it). */
  pointOf?: (key: number) => RewardFlightPoint | null;
  aim: (kind: 'glow' | 'finale', strike?: MissionStrike | null) => { point: RewardFlightPoint; key: number } | null;
  struck: (key: number) => void;
  landed: (key: number, kind: 'glow' | 'finale') => void;
};
type OpeningImpact = { id: number; at: RewardFlightPoint; wisp?: boolean };
const SOFT_GLOW = require('@incubator/art-characters/soft-glow.png');
/** A strike on a wisp: light meeting corruption. */
const STRIKE_CORE = '#F6EBFF';
const STRIKE_RING = '#E2A9FF';
const STRIKE_HALO = 'rgba(193,92,255,0.5)';
const STRIKE_PUFF = '#4B1F78';
const STRIKE_SPARK = '#FFF1B8';
const STRIKE_SPARK_HOT = '#FFFFFF';
const STRIKE_EMBER = '#6A2FA0';
const STRIKE_EMBER_DEEP = '#3B1657';
const STRIKE_PARTICLES = 10;
/** Glow tokens kept mounted from merge to merge: three merges' Glow in the air at once. Past that, a flight is mounted fresh. */
const GLOW_TOKEN_POOL = 16;
/** Lanes bolts kept mounted: every plant on a full board firing at once, with room to spare. Past that, a bolt is mounted fresh. */
const GLOW_BOLT_POOL = 16;
/** Bursts alive at once, a pool each. A landing past the cap still counts and still strikes; it only bursts nowhere. */
const STRIKE_BURST_POOL = 6;
const IMPACT_BURST_POOL = 4;
/** How long the pooled views stay mounted after the last Glow has gone, so a streak never remounts them. */
const GLOW_POOL_WARM_MS = 4_000;

/**
 * The opening's mission board: its own independent board (own state, own
 * store, seeded for the mission alone) shown as a 5×4 grid in the same frame
 * the Merge page uses, under Mossprout's veiled tile with one slim "Clear the
 * Mist" bar above it. The guidance is the ordinary spotlight-and-finger
 * overlay the Kingdom mounts over it. Merges go through the same FTUE
 * dispatch as the dedicated page; each merged item sends Glow up into the mist.
 */
export const KingdomOpeningMergeDock = memo(function KingdomOpeningMergeDock({ run, step, state, send, width, bottomInset, landings, onGlow, onFinale, onBoardMetrics, onBlockedInteraction, onEntranceSettled }: {
  run: FtueRunState | null;
  /** The mission board's state and reducer, owned by the Kingdom's mission store. */
  state: MergeWorldState;
  send: (command: MergeWorldCommand) => MergeWorldCommandResult | null;
  /** The Glow's landings: the bar flashes on each, subscribed on its own so no caller re-renders for them. */
  landings?: GlowLandingSource;
  /** The authored opening step (`world.mist_clear`); the dock derives its own refill beat from the board. */
  step: FtueStepDefinition | null;
  width: number;
  bottomInset: number;
  /** Window-space origin of a merged item, for the Glow flight. */
  onGlow?: (from: RewardFlightPoint) => void;
  /** The last merge's item leaves the board for the Mist: its origin and what it is. */
  onFinale?: (from: RewardFlightPoint, definitionId: string) => void;
  onBoardMetrics?: (metrics: MergeBoardScreenMetrics | null) => void;
  onBlockedInteraction?: () => void;
  /** Fired once the fade-in has finished and the board has re-measured: the moment guidance may point at it. */
  onEntranceSettled?: () => void;
}) {
  const sessionRef = useRef<ReturnType<typeof createMergeBoardSession> | null>(null);
  if (!sessionRef.current) sessionRef.current = createMergeBoardSession();
  const sessionId = sessionRef.current.id;
  const coordinatorRef = useRef<MergeFtueInteractionCoordinator | null>(null);
  if (!coordinatorRef.current) coordinatorRef.current = new MergeFtueInteractionCoordinator(sessionId);
  const coordinator = coordinatorRef.current;
  useEffect(() => () => coordinator.dispose(), [coordinator]);

  const progress = openingMistProgress(run);
  const boardStep = useMemo(() => openingMistBoardStep(step, state, progress), [progress, state, step]);
  // A kill between the board write and the checkpoint leaves the board a merge
  // ahead. The board is the truth: replay the missing merges into the run, but
  // only for the board the dock mounted with. Every later revision comes from
  // a live drag whose own event is deferred a frame, and a replay then would
  // count that merge twice (the mist lifted one merge early).
  const caughtUpRef = useRef(false);
  useEffect(() => {
    if (!run || run.status !== 'active' || caughtUpRef.current) return;
    caughtUpRef.current = true;
    const missing = openingMergesOnBoard(state) - progress;
    for (let index = 0; index < missing; index++) {
      dispatchFtueEvent({ type: 'merge_completed', fromInstanceId: `opening-catch-up:${index}`, targetInstanceId: `opening-catch-up:${index}`, resultDefinitionId: 'nature:garden:2', resultCell: -1, revision: state.revision }, `opening-catch-up:${state.revision}:${index}`);
    }
  }, [progress, run, state]);
  const stateRef = useRef(state);
  const runRef = useRef(run);
  const stepRef = useRef(boardStep);
  stateRef.current = state;
  runRef.current = run;
  stepRef.current = boardStep;
  const boardMetricsRef = useRef<MergeBoardScreenMetrics | null>(null);
  const handleMetrics = useCallback((metrics: MergeBoardScreenMetrics | null) => {
    boardMetricsRef.current = metrics;
    onBoardMetrics?.(metrics);
  }, [onBoardMetrics]);

  // The final merge's item is hidden on the board the moment it exists and
  // flies into the mist instead; the board is left empty on purpose.
  const [hiddenItemIds, setHiddenItemIds] = useState<ReadonlySet<string>>(() => new Set());
  const handleEvent = useCallback((event: FtueEvent, result: MergeWorldCommandResult) => {
    const metrics = boardMetricsRef.current;
    if (event.type !== 'merge_completed' || !metrics) return;
    const center = mergeCellCenter(metrics.geometry, event.resultCell);
    const from = { x: metrics.x + center.x, y: metrics.y + center.y };
    // Called before the run advances on this merge, so the run still shows the count without it.
    const finale = openingMistProgress(runRef.current) + 1 >= OPENING_MERGE_REQUIRED;
    if (finale) {
      const occupant = result.state.board[event.resultCell]?.occupant;
      if (occupant?.kind === 'item') setHiddenItemIds((current) => new Set([...current, occupant.instanceId]));
      onFinale?.(from, event.resultDefinitionId);
      return;
    }
    onGlow?.(from);
  }, [onFinale, onGlow]);
  const dispatch = useFtueMergeDispatch({
    send, coordinator, sessionId, stateRef, runRef, stepRef, guided: true, deferEvent: true,
    // Before the advance: the finale flag must be up on the very frame the run reaches the lift step,
    // or that frame renders the lift step's camera and the tile re-centres before the last wisp has fallen.
    onBlocked: onBlockedInteraction, onBeforeAdvance: handleEvent,
  });

  return <MistMissionDock
    state={state} boardStep={boardStep} progress={progress} required={OPENING_MERGE_REQUIRED}
    interactionKey={`${run?.runId ?? 'free'}:${boardStep?.id ?? 'open'}`} sessionId={sessionId} hiddenItemIds={hiddenItemIds}
    width={width} bottomInset={bottomInset} landings={landings}
    onCommand={dispatch} onBoardMetrics={handleMetrics} onBlockedInteraction={onBlockedInteraction} onEntranceSettled={onEntranceSettled} />;
});

/**
 * A mist mission's docked board: the slim "Clear the Mist" bar above a 5×4
 * board in the Merge page's own frame, fading and scaling in as one piece
 * once the board has painted, then re-measuring so guidance and Glow flights
 * land on the resting layout. Whose board it is, what counts, and what a
 * merge does are the caller's: the dock only shows and forwards commands.
 */
/** How far the header's bottom edge sits under the top of the bar. */
const HEADER_TUCK = 24;

export const MistMissionDock = memo(function MistMissionDock({ state, boardStep, progress, required, layout = OPENING_BOARD_LAYOUT, barTitle = 'Drive off the Mist', interactionKey, sessionId, hiddenItemIds, width, bottomInset, landings, onCommand, onBoardMetrics, onBlockedInteraction, onEntranceSettled, onClose, closeLabel, header, footer, headerGap, overlay, rootRef, animateArrivals, onHoverCell, externalEffects, heldMist, hideBar = false }: {
  /** The cell a held piece is over (-1 when none). */
  onHoverCell?: (cell: number, source: number) => void;
  /** Effects the owner asks the board to play on cells (a piece a wisp ate puffs away). */
  externalEffects?: readonly { id: number; cell: number; kind: MergeBoardEffectKind }[];
  /** Leaves the progress bar out (Lanes: the space over the board is where the wisps come from). */
  hideBar?: boolean;
  /** Merge vs Mist: Mist still drawn on cells whose Glow shot is in the air (the board's `heldMist`). */
  heldMist?: Readonly<Record<number, MergeWorldState['board'][number]['mist']>>;
  state: MergeWorldState;
  /** Pieces that arrive on their own (a time trial's dealer) pop in the way the board's pieces do. */
  animateArrivals?: boolean;
  /** The window over the canonical board; the opening's 5×4 by default. */
  layout?: typeof OPENING_BOARD_LAYOUT | (Omit<typeof OPENING_BOARD_LAYOUT, 'rows' | 'cellIndices' | 'accessibilityLabel'> & { rows: number; cellIndices: readonly number[]; accessibilityLabel: string });
  barTitle?: string;
  /** The beat gating the board and pointing at it, if any. */
  boardStep: FtueStepDefinition | null;
  /** Counted merges, as the caller's checkpoint has them; the bar trails by one Glow flight. */
  progress: number;
  required: number;
  interactionKey: string;
  sessionId: string;
  hiddenItemIds: ReadonlySet<string>;
  width: number;
  bottomInset: number;
  /** The Glow's landings: the bar flashes on each, subscribed on its own so no caller re-renders for them. */
  landings?: GlowLandingSource;
  onCommand: (command: MergeWorldCommand) => MergeWorldCommandResult | null;
  onBoardMetrics?: (metrics: MergeBoardScreenMetrics | null) => void;
  onBlockedInteraction?: () => void;
  /** Fired once the fade-in has finished and the board has re-measured: the moment guidance may point at it. */
  onEntranceSettled?: () => void;
  /** An optional board (a friend's restoration) can be put away and reopened from its marker. */
  onClose?: () => void;
  closeLabel?: string;
  /** A card above the bar (a friend's request tray). */
  header?: ReactNode;
  /** Under the board (a Lanes battle's hero abilities): the space over it stays the wisps'. */
  footer?: ReactNode;
  /** How far the header's bottom edge sits above the top of the bar; negative tucks it under. Default: tucked by HEADER_TUCK. */
  headerGap?: number;
  /** Drawn over the whole dock (a delivery flight into the board). */
  overlay?: ReactNode;
  /** The dock's root, for measuring flights relative to it. */
  rootRef?: RefObject<ViewType | null>;
}) {
  // Set when the entrance finishes; cleared by the measurement it triggers.
  // Guidance is told only then, so it never lays out on a mid-entrance frame.
  const awaitingSettledMetricsRef = useRef(false);
  const onEntranceSettledRef = useRef(onEntranceSettled);
  onEntranceSettledRef.current = onEntranceSettled;
  const handleMetrics = useCallback((metrics: MergeBoardScreenMetrics) => {
    onBoardMetrics?.(metrics);
    if (awaitingSettledMetricsRef.current) {
      awaitingSettledMetricsRef.current = false;
      onEntranceSettledRef.current?.();
    }
  }, [onBoardMetrics]);
  useEffect(() => () => onBoardMetrics?.(null), [onBoardMetrics]);

  // The bar follows the checkpoint, but only once the Glow has landed.
  // Each step gets its own timer that later merges never cancel, so rapid
  // consecutive merges step the bar up one flight after another instead of
  // waiting for the last one to land.
  const [shownProgress, setShownProgress] = useState(progress);
  const barTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    if (progress <= shownProgress) { setShownProgress(progress); return; }
    const timers = barTimersRef.current;
    const timer = setTimeout(() => {
      timers.delete(timer);
      setShownProgress((shown) => Math.max(shown, progress));
    }, OPENING_GLOW_FLIGHT_MS);
    timers.add(timer);
    // Intentionally not cleared when `progress` moves again: only on unmount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);
  useEffect(() => () => { for (const timer of barTimersRef.current) clearTimeout(timer); }, []);

  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const parcelRef = useRef<ViewType | null>(null);
  const boardWidth = Math.min(width - 28, 400);
  const cell = Math.floor((boardWidth - layout.contentInset * 2) / OPENING_MERGE_WINDOW_COLUMNS);
  const boardHeight = cell * layout.rows + layout.contentInset * 2 + 2;
  const gate = useMemo(() => mergeFtueBoardGate(boardStep, state), [boardStep, state]);

  // Entrance: the dock stays invisible until the board has painted its first
  // frame, then fades and scales up as one piece, and the board re-measures
  // itself once the motion has settled so the finger and Glow flights land on
  // the resting layout rather than a mid-animation one.
  const reduceMotion = useReducedMotion();
  const [boardReady, setBoardReady] = useState(false);
  const [metricsRevision, setMetricsRevision] = useState(0);
  const entrance = useSharedValue(0);
  const markBoardReady = useCallback(() => setBoardReady(true), []);
  const settleMetrics = useCallback(() => {
    // The board re-measures on the next frame; `handleMetrics` reports settled once that lands.
    awaitingSettledMetricsRef.current = true;
    setMetricsRevision((revision) => revision + 1);
  }, []);
  useEffect(() => {
    // The board reports readiness itself; this is only the safety net.
    const timer = setTimeout(markBoardReady, 700);
    return () => clearTimeout(timer);
  }, [markBoardReady]);
  useEffect(() => {
    if (!boardReady) return;
    entrance.value = withTiming(1, { duration: reduceMotion ? 120 : 480, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(settleMetrics)();
    });
  }, [boardReady, entrance, reduceMotion, settleMetrics]);
  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * 28 }, { scale: 0.94 + entrance.value * 0.06 }],
  }));
  // The header (a friend's request card) is an overlay, not a row of the column:
  // it hangs above the bar, tucked a little under it, and fades in and out. The
  // bar and board never move for it.
  const headerIn = FadeIn.duration(reduceMotion ? 80 : 240);
  const headerOut = FadeOut.duration(reduceMotion ? 60 : 180);
  const [dockHeight, setDockHeight] = useState<number | null>(null);
  const [barTop, setBarTop] = useState<number | null>(null);
  const headerBottom = dockHeight != null && barTop != null ? dockHeight - barTop + (headerGap ?? -HEADER_TUCK) : null;

  return <Animated.View ref={rootRef} collapsable={false} exiting={FadeOut.duration(260)} pointerEvents="box-none"
    onLayout={(event) => setDockHeight(Math.round(event.nativeEvent.layout.height))}
    style={[styles.dock, { paddingBottom: bottomInset + 14 }, entranceStyle]}>
    {onClose ? <View pointerEvents="box-none" style={[styles.closeRow, { width: boardWidth }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={closeLabel ?? 'Put the board away'} hitSlop={8} onPress={onClose} style={styles.close}>
        <Text style={styles.closeText}>{closeLabel ?? 'Later'}</Text>
      </Pressable>
    </View> : null}
    {header && headerBottom != null ? <Animated.View entering={headerIn} exiting={headerOut} pointerEvents="box-none" style={[styles.headerSlot, { bottom: headerBottom }]}>
      <View pointerEvents="box-none" style={{ width: boardWidth }}>{header}</View>
    </Animated.View> : null}
    <View pointerEvents="box-none" onLayout={(event) => setBarTop(Math.round(event.nativeEvent.layout.y))}>
      {hideBar ? null : <ClearTheMistBar progress={shownProgress} total={required} width={boardWidth} landings={landings} title={barTitle} />}
    </View>
    <MergePlaySurface
      animateEntrance={false}
      animateArrivals={animateArrivals}
      boardLayout={layout}
      boardState={state}
      railHidden
      counterHidden
      inspectorHidden
      boardInteractionGate={gate}
      railInteractionGate={{ kind: 'locked' }}
      effectsActive
      hiddenItemInstanceIds={hiddenItemIds}
      inspectedCell={null}
      interactionEnabled
      interactionSessionKey={interactionKey}
      maxHeight={boardHeight + 8}
      onBlockedInteraction={onBlockedInteraction}
      onCommand={onCommand}
      onOpenChat={() => {}}
      onOpenParcel={() => {}}
      onReroll={() => {}}
      onScreenMetrics={handleMetrics}
      onHoverCell={onHoverCell}
      externalEffects={externalEffects}
      heldMist={heldMist}
      onSelect={setSelectedCell}
      onServe={() => false}
      onUseGrovelight={() => {}}
      onVisualReady={markBoardReady}
      parcelTargetRef={parcelRef}
      screenMetricsRevision={metricsRevision}
      selectedCell={selectedCell}
      sessionId={sessionId}
      state={state}
      style={styles.surface}
      trayEntries={[]}
      width={boardWidth}
    />
    {footer ? <View pointerEvents="box-none" style={{ width: boardWidth, alignSelf: 'center', marginTop: 8 }}>{footer}</View> : null}
    {overlay}
  </Animated.View>;
});

/** The bar interpolates its fill, flashes its halo on every landed Glow, and swells once per counted merge. */
export function ClearTheMistBar({ progress, total, width, landings, title = 'Drive off the Mist' }: { progress: number; total: number; width?: number; landings?: GlowLandingSource; title?: string }) {
  // Landings arrive here straight from the Glow's store: the bar is the only thing that re-renders for one.
  const impactKey = useSyncExternalStore(landings?.subscribe ?? subscribeToNothing, landings?.getLanded ?? noLandings, landings?.getLanded ?? noLandings);
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const halo = useSharedValue(0);
  const previous = useRef(progress);
  const previousImpact = useRef(impactKey);
  useEffect(() => {
    if (impactKey === previousImpact.current) return;
    previousImpact.current = impactKey;
    halo.value = withSequence(withTiming(1, { duration: reduceMotion ? 80 : 90 }), withTiming(0, { duration: reduceMotion ? 260 : 380, easing: Easing.out(Easing.quad) }));
    if (!reduceMotion) scale.value = withSequence(withTiming(1.025, { duration: 90 }), withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }));
  }, [halo, impactKey, reduceMotion, scale]);
  useEffect(() => {
    const grew = progress > previous.current;
    previous.current = progress;
    if (!grew || reduceMotion) return;
    scale.value = withSequence(
      withTiming(1.06, { duration: 150, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 320, easing: Easing.out(Easing.back(1.6)) }),
    );
  }, [progress, reduceMotion, scale]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value }));
  // The shadow lives on a wrapper that never moves: a shadow on the view that pulses would be
  // re-rasterised on every frame of every landing, four times a merge.
  return <View style={[styles.barShadow, width != null ? { width } : null]}>
    <Animated.View accessibilityRole="progressbar" accessibilityLabel={title} accessibilityValue={{ min: 0, max: total, now: progress, text: `${progress} of ${total}` }}
      style={[styles.bar, pulseStyle]}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.barHalo, haloStyle]} />
    <View style={styles.barHeader}>
      <Text style={styles.barTitle}>{title}</Text>
      <Text style={styles.barCount}>{progress}/{total}</Text>
    </View>
    <ProgressBar current={progress} total={total} minimumPercent={0} variant="egg" color={BAR_FILL_COLOR} trackColor={BAR_TRACK_COLOR} />
    </Animated.View>
  </View>;
}

/** Window-space Glow flights from merged items up into the mist, each ending in a burst. Mounted by the Kingdom screen above everything. */
export function OpeningGlowLayer({ flights, impacts, onArrive, onImpactDone, screenRef }: {
  flights: readonly OpeningGlowFlight[];
  impacts: readonly OpeningImpact[];
  onArrive: (id: number) => void;
  onImpactDone: (id: number) => void;
  screenRef: RefObject<ViewType | null>;
}) {
  const [origin, setOrigin] = useState<RewardFlightPoint>({ x: 0, y: 0 });
  useEffect(() => {
    screenRef.current?.measureInWindow((x, y) => setOrigin((current) => current.x === x && current.y === y ? current : { x, y }));
  }, [screenRef, flights.length]);
  // Pooled views: a token or burst slot keeps its worklets and native views from one flight to the
  // next; a new flight only moves it and restarts its clock. Mounting four tokens per merge and
  // fifteen animated views per burst, then tearing them down a moment later, was the cost that
  // grew with every fast merge in a streak.
  // Lane bolts fly straight on their own clock; every other flight rises, hovers and homes in, from the pool.
  const pooled = useMemo(() => flights.filter((flight) => !flight.direct), [flights]);
  const bolts = useMemo(() => flights.filter((flight) => flight.direct), [flights]);
  const tokens = usePoolSlots(pooled, GLOW_TOKEN_POOL);
  const boltSlots = usePoolSlots(bolts, GLOW_BOLT_POOL);
  const strikes = useMemo(() => impacts.filter((impact) => impact.wisp), [impacts]);
  const plain = useMemo(() => impacts.filter((impact) => !impact.wisp), [impacts]);
  const strikeSlots = usePoolSlots(strikes, STRIKE_BURST_POOL);
  const impactSlots = usePoolSlots(plain, IMPACT_BURST_POOL);
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glowLayer]}>
    {tokens.slots.map((flight, slot) => <PooledGlowToken key={slot} flight={flight} origin={origin} onArrive={onArrive} />)}
    {tokens.overflow.map((flight) => <RewardTokenFlight key={flight.id} count={flight.count ?? OPENING_GLOWS_PER_MERGE} index={flight.index} tokenSize={flight.size ?? GLOW_SIZE}
      from={{ x: flight.from.x - origin.x, y: flight.from.y - origin.y }} to={{ x: flight.to.x - origin.x, y: flight.to.y - origin.y }}
      onArrive={() => onArrive(flight.id)}>
      <GlowTokenArt art={flight.art} size={flight.size} />
    </RewardTokenFlight>)}
    {boltSlots.slots.map((flight, slot) => <GlowBolt key={`bolt-slot-${slot}`} flight={flight} origin={origin} onArrive={onArrive} />)}
    {boltSlots.overflow.map((flight) => <GlowBolt key={flight.id} flight={flight} origin={origin} onArrive={onArrive} />)}
    {strikeSlots.slots.map((impact, slot) => <WispStrikeBurst key={slot} impact={impact} origin={origin} onDone={onImpactDone} />)}
    {impactSlots.slots.map((impact, slot) => <ImpactBurst key={slot} impact={impact} origin={origin} onDone={onImpactDone} />)}
  </View>;
}

/**
 * Hands each live item a slot it keeps until it is gone. Slots are mounted up to the most used
 * so far in this layer's life, never fewer and never past the pool; items past the pool are the
 * overflow, drawn without a slot.
 */
function usePoolSlots<T extends { id: number }>(items: readonly T[], size: number): { slots: readonly (T | null)[]; overflow: readonly T[] } {
  const assignedRef = useRef(new Map<number, number>());
  const highWaterRef = useRef(0);
  return useMemo(() => {
    const assigned = assignedRef.current;
    const live = new Set(items.map((item) => item.id));
    for (const id of [...assigned.keys()]) if (!live.has(id)) assigned.delete(id);
    const taken = new Set(assigned.values());
    const placed: (T | null)[] = Array.from({ length: size }, () => null);
    const overflow: T[] = [];
    for (const item of items) {
      let slot = assigned.get(item.id);
      if (slot == null) {
        slot = placed.findIndex((_, index) => !taken.has(index));
        if (slot < 0) { overflow.push(item); continue; }
        assigned.set(item.id, slot);
        taken.add(slot);
      }
      placed[slot] = item;
    }
    for (const slot of taken) highWaterRef.current = Math.max(highWaterRef.current, slot + 1);
    return { slots: placed.slice(0, highWaterRef.current), overflow };
  }, [items, size]);
}

const GlowTokenArt = memo(function GlowTokenArt({ art, size }: { art?: ArtSource; size?: number }) {
  const box = size ? { width: size, height: size } : null;
  return <View style={[styles.glow, box]}>
    <Image source={art ?? GAME_CURRENCY_ART.coins} contentFit="contain" style={[styles.glowArt, box]} accessible={false} />
  </View>;
});

/** Lanes: one Glow token straight from its piece to the wisp it is aimed at, landing exactly when the level lands it. */
const GlowBolt = memo(function GlowBolt({ flight, origin, onArrive }: { flight: OpeningGlowFlight | null; origin: RewardFlightPoint; onArrive: (id: number) => void }) {
  // Pooled: a slot keeps its view and worklets from one bolt to the next; a new bolt only moves it and restarts its
  // clock. Between bolts it is hidden where it landed. (Mounting a view per shot, several a second, was the cost.)
  const progress = useSharedValue(0);
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  const toX = useSharedValue(0);
  const toY = useSharedValue(0);
  const half = useSharedValue(0);
  const miss = useSharedValue(0);
  const shown = useSharedValue(0);
  const onArriveRef = useRef(onArrive);
  onArriveRef.current = onArrive;
  const land = useCallback((id: number) => onArriveRef.current(id), []);
  // The last bolt's art and size stay on the hidden slot, so it never swaps its image for nothing.
  const lastRef = useRef(flight);
  if (flight) lastRef.current = flight;
  const drawn = flight ?? lastRef.current;
  const size = drawn?.size ?? GLOW_SIZE * 0.8;
  const flightId = flight?.id ?? null;
  const flightRef = useRef(flight);
  flightRef.current = flight;
  useEffect(() => {
    const current = flightRef.current;
    cancelAnimation(progress);
    if (flightId == null || !current) { shown.value = 0; return; }
    fromX.value = current.from.x - origin.x;
    fromY.value = current.from.y - origin.y;
    toX.value = current.to.x - origin.x;
    toY.value = current.to.y - origin.y;
    half.value = (current.size ?? GLOW_SIZE * 0.8) / 2;
    miss.value = current.key == null ? 1 : 0;
    progress.value = 0;
    shown.value = 1;
    progress.value = withDelay(current.delay ?? 0, withTiming(1, { duration: current.direct ?? 300, easing: current.key == null ? Easing.out(Easing.quad) : Easing.in(Easing.quad) }, (finished) => { if (finished) runOnJS(land)(flightId); }));
    return () => cancelAnimation(progress);
  // Once per bolt; its geometry is read when it starts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightId]);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    // A miss thins out over the last third of its climb: it hit nothing and is gone.
    const fade = miss.value && p > 0.66 ? Math.max(0, 1 - (p - 0.66) / 0.34) : 1;
    return {
      opacity: shown.value * (p <= 0 ? 0 : p < 0.04 ? p / 0.04 : 1) * fade,
      transform: [{ translateX: fromX.value + (toX.value - fromX.value) * p - half.value }, { translateY: fromY.value + (toY.value - fromY.value) * p - half.value }, { scale: 0.75 + p * 0.35 }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.token, { width: size, height: size }, style]}>
    <GlowTokenArt art={drawn?.art} size={size} />
  </Animated.View>;
});

/** The reward flight's burst directions, one per token of a merge. */
const GLOW_BURST_VECTORS = [
  { rotation: -12, x: -31, y: -48 },
  { rotation: -6, x: -16, y: -57 },
  { rotation: 0, x: 0, y: -62 },
  { rotation: 6, x: 16, y: -57 },
  { rotation: 12, x: 31, y: -48 },
] as const;

/**
 * One pooled Glow token: the reward flight's rise, hover and staggered homing flight (the same
 * motion as `RewardTokenFlight`), on geometry it is handed per launch. Between flights it is
 * hidden where it landed, its worklets idle.
 */
const PooledGlowToken = memo(function PooledGlowToken({ flight, origin, onArrive }: { flight: OpeningGlowFlight | null; origin: RewardFlightPoint; onArrive: (id: number) => void }) {
  const reduceMotion = useReducedMotion();
  const rise = useSharedValue(0);
  const flightProgress = useSharedValue(0);
  const hoverPhase = useSharedValue(0);
  const shown = useSharedValue(0);
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  const toX = useSharedValue(0);
  const toY = useSharedValue(0);
  const slot = useSharedValue(0);
  const tokenSize = useSharedValue(GLOW_SIZE);
  const onArriveRef = useRef(onArrive);
  onArriveRef.current = onArrive;
  const land = useCallback((id: number) => onArriveRef.current(id), []);
  // The last flight's art and size stay on the hidden token, so a slot never swaps its image for nothing.
  const lastRef = useRef(flight);
  if (flight) lastRef.current = flight;
  const drawn = flight ?? lastRef.current;
  const flightId = flight?.id ?? null;
  const flightRef = useRef(flight);
  flightRef.current = flight;
  // Geometry follows the flight and the layer's origin without restarting the motion.
  useEffect(() => {
    if (!flight) return;
    fromX.value = flight.from.x - origin.x;
    fromY.value = flight.from.y - origin.y;
    toX.value = flight.to.x - origin.x;
    toY.value = flight.to.y - origin.y;
    slot.value = flight.index;
    tokenSize.value = flight.size ?? GLOW_SIZE;
  }, [flight, fromX, fromY, origin, slot, toX, toY, tokenSize]);
  useEffect(() => {
    if (flightId == null) { shown.value = 0; return; }
    const riseDuration = reduceMotion ? 100 : REWARD_TOKEN_RISE_MS;
    const hoverDuration = reduceMotion ? 90 : REWARD_TOKEN_HOVER_MS;
    const stagger = (flightRef.current?.index ?? 0) * (reduceMotion ? 28 : REWARD_TOKEN_STAGGER_MS);
    const flightDuration = reduceMotion ? 250 : REWARD_TOKEN_FLIGHT_MS;
    cancelAnimation(rise);
    cancelAnimation(hoverPhase);
    cancelAnimation(flightProgress);
    rise.value = 0;
    hoverPhase.value = 0;
    flightProgress.value = 0;
    shown.value = 1;
    // Every token of a merge rises together and hovers as one cluster; only the flights in are staggered.
    rise.value = withTiming(1, { duration: riseDuration, easing: Easing.out(Easing.cubic) });
    hoverPhase.value = reduceMotion
      ? withTiming(1, { duration: 560, easing: Easing.linear })
      : withRepeat(withTiming(1, { duration: 720, easing: Easing.linear }), -1, false);
    flightProgress.value = withDelay(riseDuration + hoverDuration + stagger, withTiming(1, { duration: flightDuration, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(land)(flightId);
    }));
    return () => {
      cancelAnimation(rise);
      cancelAnimation(hoverPhase);
      cancelAnimation(flightProgress);
    };
  }, [flightId, flightProgress, hoverPhase, land, reduceMotion, rise, shown]);
  const style = useAnimatedStyle(() => {
    const index = slot.value;
    const vector = GLOW_BURST_VECTORS[index] ?? GLOW_BURST_VECTORS[GLOW_BURST_VECTORS.length - 1]!;
    const risen = rise.value;
    const flown = flightProgress.value;
    const inverse = 1 - flown;
    const burstX = fromX.value + vector.x;
    const burstY = fromY.value + vector.y;
    const controlX = (burstX + toX.value) / 2 + (index % 2 === 0 ? -24 : 24);
    const controlY = Math.min(burstY, toY.value) - 82 - index * 3;
    const baseX = flown === 0 ? fromX.value + vector.x * risen : inverse * inverse * burstX + 2 * inverse * flown * controlX + flown * flown * toX.value;
    const baseY = flown === 0 ? fromY.value + vector.y * risen : inverse * inverse * burstY + 2 * inverse * flown * controlY + flown * flown * toY.value;
    const envelope = risen * inverse;
    const phase = hoverPhase.value * Math.PI * 2 + index * 0.92;
    const strength = reduceMotion ? 0.5 : 1;
    const x = baseX + Math.cos(phase) * 3 * envelope * strength;
    const y = baseY + Math.sin(phase) * 4 * envelope * strength;
    const scale = (flown > 0 ? 1.06 - flown * 0.8 : 0.54 + risen * 0.52) * (1 + Math.sin(phase + 0.6) * 0.035 * envelope * strength);
    const opacity = risen <= 0.04 ? risen / 0.04 : flown < 0.88 ? 1 : Math.max(0, (1 - flown) / 0.12);
    const half = tokenSize.value / 2;
    return {
      opacity: shown.value ? opacity : 0,
      transform: [{ translateX: x - half }, { translateY: y - half }, { rotate: `${vector.rotation * (1 - flown)}deg` }, { scale }],
    };
  });
  const size = drawn?.size ?? GLOW_SIZE;
  return <Animated.View style={[styles.token, { width: size, height: size }, style]}>
    <GlowTokenArt art={drawn?.art} size={drawn?.size} />
  </Animated.View>;
});

type PooledBurstProps = { impact: OpeningImpact | null; origin: RewardFlightPoint; onDone: (id: number) => void };

/** The clock and place of one pooled burst: restarted for each impact the slot is handed, hidden between them. */
function usePooledBurst({ impact, origin, onDone }: PooledBurstProps, reduceMotion: boolean) {
  const t = useSharedValue(0);
  const shown = useSharedValue(0);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const impactId = impact?.id ?? null;
  useEffect(() => {
    if (!impact) return;
    x.value = impact.at.x - origin.x;
    y.value = impact.at.y - origin.y;
  }, [impact, origin, x, y]);
  useEffect(() => {
    if (impactId == null) { shown.value = 0; return; }
    const duration = reduceMotion ? 220 : OPENING_IMPACT_BURST_MS;
    cancelAnimation(t);
    t.value = 0;
    shown.value = 1;
    t.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
    // On its own clock, keyed to the impact: a landing elsewhere re-rendering the layer used to
    // restart every live burst's timing and its removal, so a streak's bursts never died.
    const timer = setTimeout(() => onDoneRef.current(impactId), duration + 40);
    return () => clearTimeout(timer);
  }, [impactId, reduceMotion, shown, t]);
  const rootStyle = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateX: x.value }, { translateY: y.value }] }));
  return { t, rootStyle };
}

/** A ring and a scatter of Glow motes from the landing point, gone in a moment. A pooled slot, moved to each impact it is handed. */
const ImpactBurst = memo(function ImpactBurst({ impact, origin, onDone }: PooledBurstProps) {
  const reduceMotion = useReducedMotion();
  const { t, rootStyle } = usePooledBurst({ impact, origin, onDone }, reduceMotion);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.85 * (1 - t.value),
    transform: [{ scale: 0.35 + t.value * 1.9 }],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - t.value * 1.6),
    transform: [{ scale: 0.8 + t.value * 0.8 }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.burst, rootStyle]}>
    {/* Glow is layered translucent discs, not a blurred shadow: cheap to animate. */}
    <Animated.View style={[styles.burstHalo, flashStyle]} />
    <Animated.View style={[styles.burstFlash, flashStyle]} />
    <Animated.View style={[styles.burstRing, ringStyle]} />
    {Array.from({ length: reduceMotion ? 0 : BURST_PARTICLES }, (_, index) => <ImpactMote key={index} index={index} t={t} />)}
  </Animated.View>;
});

/**
 * Glow striking a wisp: a hot white-violet core that flashes and is gone, a
 * magenta ring that races outward, a dark puff of the wisp's own colour that
 * swells and thins, and a spray of bright sparks and dark ember shards thrown
 * out with drag and a little lift. Translucent discs and dots only, no blur.
 * A pooled slot, moved to each strike it is handed.
 */
const WispStrikeBurst = memo(function WispStrikeBurst({ impact, origin, onDone }: PooledBurstProps) {
  const reduceMotion = useReducedMotion();
  const { t, rootStyle } = usePooledBurst({ impact, origin, onDone }, reduceMotion);
  const coreStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - t.value * 2.4),
    transform: [{ scale: 0.5 + t.value * 1.3 }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 0.9 - t.value * 1.5),
    transform: [{ scale: 0.4 + t.value * 2.1 }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.95 * (1 - t.value),
    transform: [{ scale: 0.3 + t.value * 2.5 }],
  }));
  const puffStyle = useAnimatedStyle(() => ({
    // The dark puff lags the flash: the corruption gives way after the light lands.
    opacity: Math.max(0, Math.min(1, (t.value - 0.08) * 3)) * (1 - t.value) * 0.75,
    transform: [{ scale: 0.6 + t.value * 1.5 }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.burst, rootStyle]}>
    <Animated.View style={[styles.strikePuff, puffStyle]}>
      <Image source={SOFT_GLOW} contentFit="contain" style={StyleSheet.absoluteFill} tintColor={STRIKE_PUFF} accessible={false} />
    </Animated.View>
    <Animated.View style={[styles.strikeHalo, haloStyle]} />
    <Animated.View style={[styles.strikeCore, coreStyle]} />
    <Animated.View style={[styles.strikeRing, ringStyle]} />
    {Array.from({ length: reduceMotion ? 0 : STRIKE_PARTICLES }, (_, index) => <StrikeShard key={index} index={index} t={t} />)}
  </Animated.View>;
});

/** One shard of the strike: a bright spark or a dark ember, flung out and slowed by drag, lifting a little, turning as it goes. */
function StrikeShard({ index, t }: { index: number; t: SharedValue<number> }) {
  const ember = index % 2 === 1;
  const angle = (index / STRIKE_PARTICLES) * Math.PI * 2 + (index % 3) * 0.37;
  const distance = (ember ? 28 : 36) + (index % 4) * 9;
  const spin = (index % 2 ? -1 : 1) * (90 + (index % 3) * 40);
  const style = useAnimatedStyle(() => {
    // Drag: most of the distance in the first third, then a drift; embers sink, sparks float.
    const reach = 1 - Math.pow(1 - t.value, 2.2);
    const lift = ember ? 10 * t.value * t.value : -12 * t.value;
    return {
      opacity: t.value < 0.5 ? 1 : Math.max(0, 1 - (t.value - 0.5) / 0.5),
      transform: [
        { translateX: Math.cos(angle) * distance * reach },
        { translateY: Math.sin(angle) * distance * reach + lift },
        { rotate: `${spin * t.value}deg` },
        { scale: ember ? 1 - t.value * 0.35 : 1.1 - t.value * 0.7 },
      ],
    };
  });
  return <Animated.View style={[ember ? styles.strikeEmber : styles.strikeSpark, index % 4 === 0 && styles.strikeSparkHot, index % 4 === 3 && styles.strikeEmberDeep, style]} />;
}

function ImpactMote({ index, t }: { index: number; t: SharedValue<number> }) {
  const angle = (index / BURST_PARTICLES) * Math.PI * 2 + (index % 2) * 0.33;
  const distance = 30 + (index % 3) * 13;
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [
      { translateX: Math.cos(angle) * distance * t.value },
      { translateY: Math.sin(angle) * distance * t.value - 14 * t.value },
      { scale: 1 - t.value * 0.55 },
    ],
  }));
  return <Animated.View style={[styles.mote, index % 3 === 0 && styles.moteLarge, style]} />;
}

type OpeningGlowState = {
  flights: OpeningGlowFlight[];
  impacts: OpeningImpact[];
  landed: number;
  finaleActive: boolean;
  finaleLanded: boolean;
  finaleLandedId: number | null;
};
type GlowFlightsSnapshot = Pick<OpeningGlowState, 'flights' | 'impacts'>;
type GlowFinaleSnapshot = Pick<OpeningGlowState, 'finaleActive' | 'finaleLanded' | 'finaleLandedId'>;
/** What a bar needs to flash on each landed Glow: a subscription and the count. */
export type GlowLandingSource = {
  subscribe: (listener: () => void) => () => void;
  getLanded: () => number;
};
/**
 * The Glow's own store. Flights, bursts and landings change many times per merge; only the
 * layer that draws them and the bar that flashes subscribe to those. The screen subscribes to the
 * finale alone (three changes per mission), so a landing never re-renders the Kingdom.
 */
export type OpeningGlowStore = GlowLandingSource & {
  getFlights: () => GlowFlightsSnapshot;
  getFinale: () => GlowFinaleSnapshot;
  /** True from the moment the finale launches until its burst has settled; readable during any render. */
  finaleHoldRef: { current: boolean };
  /** Whoever is taking the Glow right now (the wisps over a misted tile), or nothing for the tile itself. */
  sinkRef: { current: GlowSink | null };
  /** The tile the Glow is aimed at when nothing over it takes it; the screen sets it each render. */
  targetRef: { current: ViewType | null };
  /** A burst of Glow into the wisp the sink names, else the tile the hook is aimed at, else the node given (a spend that lands before the screen has re-aimed). */
  launch: (from: RewardFlightPoint, targetNode?: ViewType | null, strike?: MissionStrike | null) => void;
  /** One merge's item, alone, into the tile: a restoration board sends what it just made, not Glow. */
  launchItem: (from: RewardFlightPoint, definitionId: string, strike?: MissionStrike | null) => void;
  /** A column shot: the item a merge made, straight up its column into the wisp the strike names; a wasted one rises and fades over the board. */
  launchShot: (from: RewardFlightPoint, strike: MissionStrike) => void;
  /** Merge vs Mist: one Glow token per shot, each flying at its own Mist cell; `onLand` hears each landing by the shot's index. */
  launchVolley: (shots: readonly GlowVolleyShot[], onLand: (index: number) => void) => void;
  /** Lanes: one Glow token per shot, straight from its piece at the wisp it is aimed at (or, with none, to `to`, fading), flown for `durationMs`. */
  launchBolts: (bolts: readonly { from: RewardFlightPoint; wisp: number; to?: RewardFlightPoint; durationMs: number; delayMs?: number; art?: ArtSource; size?: number }[]) => void;
  /** The final merge's item, large and alone, straight up into the mist. */
  launchFinale: (from: RewardFlightPoint, definitionId: string, strike?: MissionStrike | null) => number;
  arrive: (id: number) => void;
  impactDone: (id: number) => void;
};
type Updater<T> = T | ((current: T) => T);
const subscribeToNothing = () => () => {};
const noLandings = () => 0;

function createOpeningGlowStore(): OpeningGlowStore {
  let state: OpeningGlowState = { flights: [], impacts: [], landed: 0, finaleActive: false, finaleLanded: false, finaleLandedId: null };
  let flightsSnapshot: GlowFlightsSnapshot = { flights: state.flights, impacts: state.impacts };
  let finaleSnapshot: GlowFinaleSnapshot = { finaleActive: false, finaleLanded: false, finaleLandedId: null };
  const listeners = new Set<() => void>();
  let batching = 0;
  let dirty = false;
  const notify = () => {
    if (batching > 0) { dirty = true; return; }
    for (const listener of [...listeners]) listener();
  };
  /** Several changes, one notification: a landing touches flights, impacts and the count together. */
  const batch = (work: () => void) => {
    batching += 1;
    try { work(); } finally {
      batching -= 1;
      if (batching === 0 && dirty) { dirty = false; notify(); }
    }
  };
  const update = (change: Partial<OpeningGlowState>) => {
    const next = { ...state, ...change };
    // Snapshots keep their identity unless their own fields moved: a landing does not wake the finale's subscriber.
    if (next.flights !== state.flights || next.impacts !== state.impacts) flightsSnapshot = { flights: next.flights, impacts: next.impacts };
    if (next.finaleActive !== state.finaleActive || next.finaleLanded !== state.finaleLanded || next.finaleLandedId !== state.finaleLandedId) {
      finaleSnapshot = { finaleActive: next.finaleActive, finaleLanded: next.finaleLanded, finaleLandedId: next.finaleLandedId };
    }
    state = next;
    notify();
  };
  const resolve = <T,>(value: Updater<T>, current: T): T => typeof value === 'function' ? (value as (current: T) => T)(current) : value;
  const setFlights = (value: Updater<OpeningGlowFlight[]>) => update({ flights: resolve(value, state.flights) });
  const setImpacts = (value: Updater<OpeningImpact[]>) => update({ impacts: resolve(value, state.impacts) });
  const setLanded = (value: Updater<number>) => update({ landed: resolve(value, state.landed) });
  const setFinaleActive = (value: boolean) => update({ finaleActive: value });
  const setFinaleLanded = (value: boolean) => update({ finaleLanded: value });
  const setFinaleLandedId = (value: number | null) => update({ finaleLandedId: value });

  const nextId = { current: 0 };
  const groupSeq = { current: 0 };
  const finaleIdRef = { current: null as number | null };
  // The same hold as a ref: set the instant the finale launches, before any subscriber has rendered.
  // The FTUE run store re-renders its subscribers at sync priority, ahead of other updates queued in
  // the same frame; a screen deriving its step from `finaleActive` alone renders the lift step once
  // without the hold and moves the camera. Reading this ref during render closes that gap.
  const finaleHoldRef = { current: false };
  const targetRef = { current: null as ViewType | null };
  const sinkRef = { current: null as GlowSink | null };
  const landedGroups = { current: new Set<number>() };
  const shotLandings = new Map<number, () => void>();

  const launch = (from: RewardFlightPoint, targetNode?: ViewType | null, strike?: MissionStrike | null) => {
    const group = ++groupSeq.current;
    const aimed = targetNode ? null : sinkRef.current?.aim('glow', strike) ?? null;
    const push = (to: RewardFlightPoint) => setFlights((current) => [
      ...current,
      ...Array.from({ length: OPENING_GLOWS_PER_MERGE }, (_, index) => ({ id: ++nextId.current, index, from, to, group, key: aimed?.key })),
    ]);
    if (aimed) { push(aimed.point); return; }
    const target = targetNode ?? targetRef.current;
    if (!target) { push({ x: from.x, y: from.y - 220 }); return; }
    target.measureInWindow((x, y, width, height) => push({ x: x + width / 2, y: y + height * 0.55 }));
  };
  const arrive = (id: number) => batch(() => {
    const finale = id === finaleIdRef.current;
    const onShotLand = shotLandings.get(id);
    if (onShotLand) { shotLandings.delete(id); onShotLand(); }
    // A token that struck a wisp: the wisp flinches on every token and takes one hit per burst.
    const struck = state.flights.find((flight) => flight.id === id);
    if (struck?.key != null) {
      sinkRef.current?.struck(struck.key);
      if (struck.group != null && !landedGroups.current.has(struck.group)) {
        landedGroups.current.add(struck.group);
        sinkRef.current?.landed(struck.key, finale ? 'finale' : 'glow');
      }
    }
    if (finale) {
      setFinaleLanded(true);
      setFinaleLandedId(id);
      // The mission is over the moment the last wisp has fallen: the hold lifts on that clock, not the burst's.
      setTimeout(() => { finaleHoldRef.current = false; setFinaleActive(false); }, OPENING_FINALE_SETTLE_MS);
    }
    const landed = struck;
    // Every other landing bursts (the first and third of four): half the particle
    // views for the same read, since the impacts land 65 ms apart. The finale always bursts.
    // Past the pool, a burst is skipped rather than mounted fresh: a streak stays at its cap.
    // A Glow shot (and a lane bolt) always bursts, as the strike on a wisp does: light meeting the Mist.
    const miss = Boolean(landed?.direct) && landed?.key == null;
    if (landed && !miss && (finale || landed.shot || landed.direct || landed.index % 2 === 0)) setImpacts((bursts) => {
      const wisp = landed.key != null || Boolean(landed.shot);
      const live = bursts.reduce((count, burst) => count + (Boolean(burst.wisp) === wisp ? 1 : 0), 0);
      if (!finale && live >= (wisp ? STRIKE_BURST_POOL : IMPACT_BURST_POOL)) return bursts;
      const spread = landed.shot ? 0 : (landed.index - (OPENING_GLOWS_PER_MERGE - 1) / 2) * 10;
      return [...bursts, { id, wisp, at: { x: landed.to.x + spread, y: landed.to.y } }];
    });
    setFlights((current) => current.filter((flight) => flight.id !== id));
    setLanded((count) => count + 1);
    // One haptic per burst of Glow (its first token) and one for the finale, not one per token.
    // Never for a Lanes bolt: plants fire several a second, and a buzz on each was both noise and a native call per shot.
    if (process.env.EXPO_OS === 'ios' && !landed?.direct && (finale || landed?.index === 0)) void Haptics.impactAsync(finale ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  });
  const impactDone = (id: number) => {
    setImpacts((current) => current.filter((impact) => impact.id !== id));
  };
  const launchItem = (from: RewardFlightPoint, definitionId: string, strike?: MissionStrike | null) => {
    const id = ++nextId.current;
    const art = mergeWorldItemArt(definitionId) ?? undefined;
    const aimed = sinkRef.current?.aim('glow', strike) ?? null;
    const push = (to: RewardFlightPoint) => setFlights((current) => [...current, { id, index: 0, count: 1, from, to, art, size: 44, group: ++groupSeq.current, key: aimed?.key }]);
    if (aimed) { push(aimed.point); return; }
    const target = targetRef.current;
    if (!target) { push({ x: from.x, y: from.y - 220 }); return; }
    target.measureInWindow((x, y, width, height) => push({ x: x + width / 2, y: y + height * 0.55 }));
  };
  const launchShot = (from: RewardFlightPoint, strike: MissionStrike) => {
    const id = ++nextId.current;
    const art = mergeWorldItemArt(strike.resultDefinitionId) ?? undefined;
    // Straight up the column: into the wisp the strike names, or, wasted, to the top of the sky and gone.
    const aimed = sinkRef.current?.aim('glow', strike) ?? null;
    const to = aimed?.point ?? { x: from.x, y: from.y - 220 };
    setFlights((current) => [...current, { id, index: 0, count: 1, from, to, art, size: 44, group: ++groupSeq.current, key: aimed?.key }]);
  };
  const launchVolley = (shots: readonly GlowVolleyShot[], onLand: (index: number) => void) => {
    const group = ++groupSeq.current;
    const made = shots.map((shot, index): OpeningGlowFlight => {
      const id = ++nextId.current;
      shotLandings.set(id, () => onLand(index));
      // The burst's own rise and staggered flight in: one Glow token per shot.
      return { id, index: Math.min(index, 4), count: Math.max(1, shots.length), from: shot.from, to: shot.to, group, shot: true };
    });
    setFlights((current) => [...current, ...made]);
  };
  const launchBolts = (bolts: readonly { from: RewardFlightPoint; wisp: number; to?: RewardFlightPoint; durationMs: number; delayMs?: number; art?: ArtSource; size?: number }[]) => {
    const made: OpeningGlowFlight[] = [];
    for (const bolt of bolts) {
      const aimed = bolt.wisp >= 0 ? sinkRef.current?.pointOf?.(bolt.wisp) ?? null : null;
      const to = aimed ?? bolt.to;
      if (!to) continue;
      // Each its own group: a bolt at a wisp flinches it and bursts where it lands; a miss fades out on its way up.
      made.push({ id: ++nextId.current, index: 0, count: 1, from: bolt.from, to, group: ++groupSeq.current, ...(aimed ? { key: bolt.wisp } : {}), direct: Math.max(80, bolt.durationMs), ...(bolt.delayMs ? { delay: bolt.delayMs } : {}), ...(bolt.art ? { art: bolt.art } : {}), ...(bolt.size ? { size: bolt.size } : {}) });
    }
    if (made.length) setFlights((current) => [...current, ...made]);
  };
  const launchFinale = (from: RewardFlightPoint, definitionId: string, strike?: MissionStrike | null): number => {
    const id = ++nextId.current;
    finaleIdRef.current = id;
    finaleHoldRef.current = true;
    setFinaleActive(true);
    setFinaleLanded(false);
    const art = mergeWorldItemArt(definitionId) ?? undefined;
    // The last merge's item strikes the last wisp standing; its landing is the one that lifts the mist.
    const aimed = sinkRef.current?.aim('finale', strike) ?? null;
    const push = (to: RewardFlightPoint) => setFlights((current) => [...current, { id, index: 2, count: 5, from, to, art, size: 64, group: ++groupSeq.current, key: aimed?.key }]);
    if (aimed) { push(aimed.point); return id; }
    const target = targetRef.current;
    if (!target) { push({ x: from.x, y: from.y - 260 }); return id; }
    target.measureInWindow((x, y, width, height) => push({ x: x + width / 2, y: y + height * 0.5 }));
    return id;
  };
  return {
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getLanded: () => state.landed,
    getFlights: () => flightsSnapshot,
    getFinale: () => finaleSnapshot,
    finaleHoldRef, sinkRef, targetRef,
    launch, launchItem, launchShot, launchVolley, launchBolts, launchFinale, arrive, impactDone,
  };
}

/**
 * The Glow of one screen: launches a burst per merged item into the veiled tile (or the wisps
 * over it) and bursts where each lands. The screen gets stable launchers and the finale's three
 * flags; the flights themselves live in the store, drawn by `MissionGlowLayer`.
 */
export function useOpeningGlow(targetNode: ViewType | null) {
  const [store] = useState(createOpeningGlowStore);
  store.targetRef.current = targetNode;
  const finale = useSyncExternalStore(store.subscribe, store.getFinale, store.getFinale);
  return useMemo(() => ({
    store,
    launch: store.launch, launchItem: store.launchItem, launchShot: store.launchShot, launchFinale: store.launchFinale,
    finaleHoldRef: store.finaleHoldRef, sinkRef: store.sinkRef,
    finaleActive: finale.finaleActive, finaleLanded: finale.finaleLanded, finaleLandedId: finale.finaleLandedId,
  }), [finale, store]);
}

/** The Glow flights and bursts, subscribed on their own: a landing re-renders this layer, not the screen. */
export const MissionGlowLayer = memo(function MissionGlowLayer({ store, screenRef }: { store: OpeningGlowStore; screenRef: RefObject<ViewType | null> }) {
  const { flights, impacts } = useSyncExternalStore(store.subscribe, store.getFlights, store.getFlights);
  const live = flights.length > 0 || impacts.length > 0;
  // The pooled views stay mounted a while after the last landing: the next merge of a streak reuses them.
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    if (live) { setWarm(true); return; }
    const timer = setTimeout(() => setWarm(false), GLOW_POOL_WARM_MS);
    return () => clearTimeout(timer);
  }, [live]);
  if (!live && !warm) return null;
  return <OpeningGlowLayer flights={flights} impacts={impacts} onArrive={store.arrive} onImpactDone={store.impactDone} screenRef={screenRef} />;
});

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 60, alignItems: 'center', gap: 10 },
  // Above the bar, out of the column's flow; the bar that follows paints over its tucked edge.
  headerSlot: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 0 },
  closeRow: { alignItems: 'flex-end', marginBottom: -4 },
  close: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#F4F9FD', borderWidth: 1.5, borderColor: '#FFFFFF', boxShadow: '0 3px 10px rgba(20,40,60,0.14)' },
  closeText: { color: '#2E4A66', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  barShadow: { borderRadius: 16, boxShadow: '0 4px 14px rgba(20,40,60,0.16)' },
  bar: {
    gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, overflow: 'visible',
    backgroundColor: '#F4F9FD', borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  barHalo: { borderRadius: 16, backgroundColor: 'rgba(143,211,255,0.28)' },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  barTitle: { ...KatchaDeckUI.typography.ftuePanelTitle, color: '#2E4A66' },
  barCount: { color: '#2E4A66', fontSize: 15, lineHeight: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  surface: { paddingTop: 0 },
  glowLayer: { zIndex: 100 },
  glow: { width: GLOW_SIZE, height: GLOW_SIZE, alignItems: 'center', justifyContent: 'center' },
  glowArt: { width: GLOW_SIZE, height: GLOW_SIZE },
  token: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  burst: { position: 'absolute', left: 0, top: 0, width: 0, height: 0, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  burstHalo: { position: 'absolute', width: 96, height: 96, marginLeft: -48, marginTop: -48, borderRadius: 48, backgroundColor: 'rgba(143,211,255,0.28)' },
  burstFlash: { position: 'absolute', width: 54, height: 54, marginLeft: -27, marginTop: -27, borderRadius: 27, backgroundColor: 'rgba(214,240,255,0.95)' },
  burstRing: { position: 'absolute', width: 48, height: 48, marginLeft: -24, marginTop: -24, borderRadius: 24, borderWidth: 3, borderColor: GLOW_COLOR },
  mote: { position: 'absolute', width: 9, height: 9, marginLeft: -4.5, marginTop: -4.5, borderRadius: 4.5, backgroundColor: '#DDF4FF' },
  strikePuff: { position: 'absolute', width: 110, height: 110, marginLeft: -55, marginTop: -55 },
  strikeHalo: { position: 'absolute', width: 84, height: 84, marginLeft: -42, marginTop: -42, borderRadius: 42, backgroundColor: STRIKE_HALO },
  strikeCore: { position: 'absolute', width: 40, height: 40, marginLeft: -20, marginTop: -20, borderRadius: 20, backgroundColor: STRIKE_CORE },
  strikeRing: { position: 'absolute', width: 44, height: 44, marginLeft: -22, marginTop: -22, borderRadius: 22, borderWidth: 2.5, borderColor: STRIKE_RING },
  strikeSpark: { position: 'absolute', width: 7, height: 7, marginLeft: -3.5, marginTop: -3.5, borderRadius: 3.5, backgroundColor: STRIKE_SPARK },
  strikeSparkHot: { width: 9, height: 9, marginLeft: -4.5, marginTop: -4.5, borderRadius: 4.5, backgroundColor: STRIKE_SPARK_HOT },
  strikeEmber: { position: 'absolute', width: 7, height: 7, marginLeft: -3.5, marginTop: -3.5, borderRadius: 2, backgroundColor: STRIKE_EMBER },
  strikeEmberDeep: { width: 6, height: 9, marginLeft: -3, marginTop: -4.5, borderRadius: 2, backgroundColor: STRIKE_EMBER_DEEP },
  moteLarge: { width: 12, height: 12, marginLeft: -6, marginTop: -6, borderRadius: 6 },
});
