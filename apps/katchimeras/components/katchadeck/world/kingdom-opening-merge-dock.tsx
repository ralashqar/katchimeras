import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Pressable, StyleSheet, Text, View, type View as ViewType } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

import { MergePlaySurface } from '@/components/katchadeck/games/merge-play-surface';
import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { ProgressBar } from '@/components/katchadeck/progress-bar';
import { RewardTokenFlight, type RewardFlightPoint } from '@/components/katchadeck/ui/reward-token-flight';
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
import { mergeCellCenter } from '@/utils/merge-world/board-geometry';

/** Glow per merge: a burst that peels off one after another, each landing with its own impact. */
export const OPENING_GLOWS_PER_MERGE = 4;
/** Rise + hover + flight of the last Glow in a burst; the bar fills when it lands, not when the merge commits. */
export const OPENING_GLOW_FLIGHT_MS = 700 + (OPENING_GLOWS_PER_MERGE - 1) * 65;
/** How long the impact burst lives at the veiled tile. */
export const OPENING_IMPACT_BURST_MS = 640;
/** After the final item's burst, before the Kingdom moves on to the lift. */
const OPENING_FINALE_SETTLE_MS = 320;
const GLOW_SIZE = 34;
// Fewer, shadow-free motes: four impacts land per merge, and blurred shadows on
// animating views re-rasterise every frame.
const BURST_PARTICLES = 6;
const GLOW_COLOR = '#8FD3FF';
/** The bar reads dark against its pale panel: deep violet fill on a dusk track. */
const BAR_FILL_COLOR = '#6A46C9';
const BAR_TRACK_COLOR = 'rgba(84,66,128,0.24)';

export type OpeningGlowFlight = { id: number; index: number; from: RewardFlightPoint; to: RewardFlightPoint; art?: number; size?: number; count?: number; group?: number; key?: number };

/**
 * Something over the mist that takes the Glow instead of the tile (the
 * corruption wisps). It aims each burst and hears each landing: every token
 * strikes, and once per burst the first to land counts a hit.
 */
export type GlowSink = {
  aim: (kind: 'glow' | 'finale') => { point: RewardFlightPoint; key: number } | null;
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

/**
 * The opening's mission board: its own independent board (own state, own
 * store, seeded for the mission alone) shown as a 5×4 grid in the same frame
 * the Merge page uses, under Mossprout's veiled tile with one slim "Clear the
 * Mist" bar above it. The guidance is the ordinary spotlight-and-finger
 * overlay the Kingdom mounts over it. Merges go through the same FTUE
 * dispatch as the dedicated page; each merged item sends Glow up into the mist.
 */
export const KingdomOpeningMergeDock = memo(function KingdomOpeningMergeDock({ run, step, state, send, width, bottomInset, impactKey = 0, onGlow, onFinale, onBoardMetrics, onBlockedInteraction, onEntranceSettled }: {
  run: FtueRunState | null;
  /** The mission board's state and reducer, owned by the Kingdom's mission store. */
  state: MergeWorldState;
  send: (command: MergeWorldCommand) => MergeWorldCommandResult | null;
  /** Bumps once per landed Glow; the bar flashes on each. */
  impactKey?: number;
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
    const finale = openingMistProgress(runRef.current) >= OPENING_MERGE_REQUIRED;
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
    onBlocked: onBlockedInteraction, onEvent: handleEvent,
  });

  return <MistMissionDock
    state={state} boardStep={boardStep} progress={progress} required={OPENING_MERGE_REQUIRED}
    interactionKey={`${run?.runId ?? 'free'}:${boardStep?.id ?? 'open'}`} sessionId={sessionId} hiddenItemIds={hiddenItemIds}
    width={width} bottomInset={bottomInset} impactKey={impactKey}
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

export const MistMissionDock = memo(function MistMissionDock({ state, boardStep, progress, required, layout = OPENING_BOARD_LAYOUT, barTitle = 'Drive off the Mist', interactionKey, sessionId, hiddenItemIds, width, bottomInset, impactKey = 0, onCommand, onBoardMetrics, onBlockedInteraction, onEntranceSettled, onClose, closeLabel, header, headerGap, overlay, rootRef }: {
  state: MergeWorldState;
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
  /** Bumps once per landed Glow; the bar flashes on each. */
  impactKey?: number;
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
      <ClearTheMistBar progress={shownProgress} total={required} width={boardWidth} impactKey={impactKey} title={barTitle} />
    </View>
    <MergePlaySurface
      animateEntrance={false}
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
    {overlay}
  </Animated.View>;
});

/** The bar interpolates its fill, flashes its halo on every landed Glow, and swells once per counted merge. */
export function ClearTheMistBar({ progress, total, width, impactKey = 0, title = 'Drive off the Mist' }: { progress: number; total: number; width?: number; impactKey?: number; title?: string }) {
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
  return <Animated.View accessibilityRole="progressbar" accessibilityLabel={title} accessibilityValue={{ min: 0, max: total, now: progress, text: `${progress} of ${total}` }}
    style={[styles.bar, width != null ? { width } : null, pulseStyle]}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.barHalo, haloStyle]} />
    <View style={styles.barHeader}>
      <Text style={styles.barTitle}>{title}</Text>
      <Text style={styles.barCount}>{progress}/{total}</Text>
    </View>
    <ProgressBar current={progress} total={total} minimumPercent={0} variant="egg" color={BAR_FILL_COLOR} trackColor={BAR_TRACK_COLOR} />
  </Animated.View>;
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
    screenRef.current?.measureInWindow((x, y) => setOrigin({ x, y }));
  }, [screenRef, flights.length]);
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glowLayer]}>
    {flights.map((flight) => <RewardTokenFlight key={flight.id} count={flight.count ?? OPENING_GLOWS_PER_MERGE} index={flight.index} tokenSize={flight.size ?? GLOW_SIZE}
      from={{ x: flight.from.x - origin.x, y: flight.from.y - origin.y }} to={{ x: flight.to.x - origin.x, y: flight.to.y - origin.y }}
      onArrive={() => onArrive(flight.id)}>
      <View style={[styles.glow, flight.size ? { width: flight.size, height: flight.size } : null]}>
        <Image source={flight.art ?? GAME_CURRENCY_ART.coins} contentFit="contain" style={[styles.glowArt, flight.size ? { width: flight.size, height: flight.size } : null]} accessible={false} />
      </View>
    </RewardTokenFlight>)}
    {impacts.map((impact) => impact.wisp
      ? <WispStrikeBurst key={impact.id} x={impact.at.x - origin.x} y={impact.at.y - origin.y} onDone={() => onImpactDone(impact.id)} />
      : <ImpactBurst key={impact.id} x={impact.at.x - origin.x} y={impact.at.y - origin.y} onDone={() => onImpactDone(impact.id)} />)}
  </View>;
}

/** A ring and a scatter of Glow motes from the landing point, gone in a moment. */
function ImpactBurst({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    const duration = reduceMotion ? 220 : OPENING_IMPACT_BURST_MS;
    t.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
    const timer = setTimeout(onDone, duration + 40);
    return () => clearTimeout(timer);
  }, [onDone, reduceMotion, t]);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.85 * (1 - t.value),
    transform: [{ scale: 0.35 + t.value * 1.9 }],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - t.value * 1.6),
    transform: [{ scale: 0.8 + t.value * 0.8 }],
  }));
  return <View pointerEvents="none" style={[styles.burst, { left: x, top: y }]}>
    {/* Glow is layered translucent discs, not a blurred shadow: cheap to animate. */}
    <Animated.View style={[styles.burstHalo, flashStyle]} />
    <Animated.View style={[styles.burstFlash, flashStyle]} />
    <Animated.View style={[styles.burstRing, ringStyle]} />
    {Array.from({ length: reduceMotion ? 0 : BURST_PARTICLES }, (_, index) => <ImpactMote key={index} index={index} t={t} />)}
  </View>;
}

/**
 * Glow striking a wisp: a hot white-violet core that flashes and is gone, a
 * magenta ring that races outward, a dark puff of the wisp's own colour that
 * swells and thins, and a spray of bright sparks and dark ember shards thrown
 * out with drag and a little lift. Translucent discs and dots only, no blur.
 */
function WispStrikeBurst({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    const duration = reduceMotion ? 220 : OPENING_IMPACT_BURST_MS;
    t.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
    const timer = setTimeout(onDone, duration + 40);
    return () => clearTimeout(timer);
  }, [onDone, reduceMotion, t]);
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
  return <View pointerEvents="none" style={[styles.burst, { left: x, top: y }]}>
    <Animated.View style={[styles.strikePuff, puffStyle]}>
      <Image source={SOFT_GLOW} contentFit="contain" style={StyleSheet.absoluteFill} tintColor={STRIKE_PUFF} accessible={false} />
    </Animated.View>
    <Animated.View style={[styles.strikeHalo, haloStyle]} />
    <Animated.View style={[styles.strikeCore, coreStyle]} />
    <Animated.View style={[styles.strikeRing, ringStyle]} />
    {Array.from({ length: reduceMotion ? 0 : STRIKE_PARTICLES }, (_, index) => <StrikeShard key={index} index={index} t={t} />)}
  </View>;
}

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

/** Measures the veiled tile, launches a burst of Glow per merged item, and bursts where each one lands. */
export function useOpeningGlow(targetNode: ViewType | null) {
  const [flights, setFlights] = useState<OpeningGlowFlight[]>([]);
  const [impacts, setImpacts] = useState<OpeningImpact[]>([]);
  const [landed, setLanded] = useState(0);
  // True from the final merge until its item has landed, burst, and settled:
  // the Kingdom holds the clear beat on screen for exactly that long.
  const [finaleActive, setFinaleActive] = useState(false);
  // True from the moment the final item strikes the tile: the mist clears on that frame.
  const [finaleLanded, setFinaleLanded] = useState(false);
  const finaleIdRef = useRef<number | null>(null);
  const nextId = useRef(0);
  const groupSeq = useRef(0);
  const targetRef = useRef(targetNode);
  targetRef.current = targetNode;
  // Set by the screen each render: whoever is taking the Glow right now (the wisps over a misted tile), or nothing for the tile itself.
  const sinkRef = useRef<GlowSink | null>(null);
  const flightsRef = useRef<OpeningGlowFlight[]>([]);
  flightsRef.current = flights;
  const landedGroups = useRef(new Set<number>());
  /** A burst of Glow into the wisp the sink names, else the tile the hook is aimed at, else the node given (a spend that lands before the screen has re-aimed). */
  const launch = useCallback((from: RewardFlightPoint, targetNode?: ViewType | null) => {
    const group = ++groupSeq.current;
    const aimed = targetNode ? null : sinkRef.current?.aim('glow') ?? null;
    const push = (to: RewardFlightPoint) => setFlights((current) => [
      ...current,
      ...Array.from({ length: OPENING_GLOWS_PER_MERGE }, (_, index) => ({ id: ++nextId.current, index, from, to, group, key: aimed?.key })),
    ]);
    if (aimed) { push(aimed.point); return; }
    const target = targetNode ?? targetRef.current;
    if (!target) { push({ x: from.x, y: from.y - 220 }); return; }
    target.measureInWindow((x, y, width, height) => push({ x: x + width / 2, y: y + height * 0.55 }));
  }, []);
  const [finaleLandedId, setFinaleLandedId] = useState<number | null>(null);
  const arrive = useCallback((id: number) => {
    const finale = id === finaleIdRef.current;
    // A token that struck a wisp: the wisp flinches on every token and takes one hit per burst.
    const struck = flightsRef.current.find((flight) => flight.id === id);
    if (struck?.key != null) {
      sinkRef.current?.struck(struck.key);
      if (struck.group != null && !landedGroups.current.has(struck.group)) {
        landedGroups.current.add(struck.group);
        sinkRef.current?.landed(struck.key, finale ? 'finale' : 'glow');
      }
    }
    if (finale) { setFinaleLanded(true); setFinaleLandedId(id); }
    setFlights((current) => {
      const landed = current.find((flight) => flight.id === id);
      // Every other landing bursts (the first and third of four): half the particle
      // views for the same read, since the impacts land 65 ms apart. The finale always bursts.
      if (landed && (finale || landed.index % 2 === 0)) setImpacts((bursts) => [...bursts, { id, wisp: landed.key != null, at: { x: landed.to.x + (landed.index - (OPENING_GLOWS_PER_MERGE - 1) / 2) * 14, y: landed.to.y + (landed.index % 2) * 10 - 5 } }]);
      return current.filter((flight) => flight.id !== id);
    });
    setLanded((count) => count + 1);
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(finale ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  }, []);
  const impactDone = useCallback((id: number) => {
    setImpacts((current) => current.filter((impact) => impact.id !== id));
    // The burst is over; let it settle before the lift beat takes the screen.
    if (id === finaleIdRef.current) setTimeout(() => setFinaleActive(false), OPENING_FINALE_SETTLE_MS);
  }, []);
  /** One merge's item, alone, into the tile: a restoration board sends what it just made, not Glow. */
  const launchItem = useCallback((from: RewardFlightPoint, definitionId: string) => {
    const id = ++nextId.current;
    const art = mergeWorldItemArt(definitionId) as number | undefined;
    const aimed = sinkRef.current?.aim('glow') ?? null;
    const push = (to: RewardFlightPoint) => setFlights((current) => [...current, { id, index: 0, count: 1, from, to, art, size: 44, group: ++groupSeq.current, key: aimed?.key }]);
    if (aimed) { push(aimed.point); return; }
    const target = targetRef.current;
    if (!target) { push({ x: from.x, y: from.y - 220 }); return; }
    target.measureInWindow((x, y, width, height) => push({ x: x + width / 2, y: y + height * 0.55 }));
  }, []);
  /** The final merge's item, large and alone, straight up into the mist. */
  const launchFinale = useCallback((from: RewardFlightPoint, definitionId: string): number => {
    const id = ++nextId.current;
    finaleIdRef.current = id;
    setFinaleActive(true);
    setFinaleLanded(false);
    const art = mergeWorldItemArt(definitionId) as number | undefined;
    // The last merge's item strikes the last wisp standing; its landing is the one that lifts the mist.
    const aimed = sinkRef.current?.aim('finale') ?? null;
    const push = (to: RewardFlightPoint) => setFlights((current) => [...current, { id, index: 2, count: 5, from, to, art, size: 64, group: ++groupSeq.current, key: aimed?.key }]);
    if (aimed) { push(aimed.point); return id; }
    const target = targetRef.current;
    if (!target) { push({ x: from.x, y: from.y - 260 }); return id; }
    target.measureInWindow((x, y, width, height) => push({ x: x + width / 2, y: y + height * 0.5 }));
    return id;
  }, []);
  return { flights, impacts, landed, finaleActive, finaleLanded, finaleLandedId, launch, launchItem, launchFinale, arrive, impactDone, sinkRef };
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 60, alignItems: 'center', gap: 10 },
  // Above the bar, out of the column's flow; the bar that follows paints over its tucked edge.
  headerSlot: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 0 },
  closeRow: { alignItems: 'flex-end', marginBottom: -4 },
  close: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#F4F9FD', borderWidth: 1.5, borderColor: '#FFFFFF', boxShadow: '0 3px 10px rgba(20,40,60,0.14)' },
  closeText: { color: '#2E4A66', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  bar: {
    gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, overflow: 'visible',
    backgroundColor: '#F4F9FD', borderWidth: 1.5, borderColor: '#FFFFFF',
    boxShadow: '0 4px 14px rgba(20,40,60,0.16)',
  },
  barHalo: { borderRadius: 16, backgroundColor: 'rgba(143,211,255,0.28)' },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  barTitle: { ...KatchaDeckUI.typography.ftuePanelTitle, color: '#2E4A66' },
  barCount: { color: '#2E4A66', fontSize: 15, lineHeight: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  surface: { paddingTop: 0 },
  glowLayer: { zIndex: 100 },
  glow: { width: GLOW_SIZE, height: GLOW_SIZE, alignItems: 'center', justifyContent: 'center' },
  glowArt: { width: GLOW_SIZE, height: GLOW_SIZE },
  burst: { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
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
