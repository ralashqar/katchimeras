import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { StyleSheet, Text, View, type View as ViewType } from 'react-native';
import Animated, { Easing, FadeIn, SlideInDown, SlideOutDown, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

import { MergePlaySurface } from '@/components/katchadeck/games/merge-play-surface';
import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { ProgressBar } from '@/components/katchadeck/progress-bar';
import { RewardTokenFlight, type RewardFlightPoint } from '@/components/katchadeck/ui/reward-token-flight';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { KatchaDeckUI } from '@/constants/theme';
import { useMergeWorldActions, useMergeWorldState } from '@/features/merge-world/merge-world-provider';
import type { FtueEvent, FtueRunState, FtueStepDefinition } from '@/features/onboarding/ftue-types';
import { mergeFtueBoardGate } from '@/features/onboarding/merge-ftue';
import { createMergeBoardSession, MergeFtueInteractionCoordinator } from '@/features/onboarding/merge-ftue-interaction-coordinator';
import { OPENING_BOARD_LAYOUT, OPENING_MERGE_REQUIRED, OPENING_MERGE_WINDOW_COLUMNS, OPENING_MERGE_WINDOW_ROWS, openingMistBoardStep, openingMistProgress } from '@/features/onboarding/opening-mist';
import { useFtueMergeDispatch } from '@/features/onboarding/use-ftue-merge-dispatch';
import type { MergeWorldCommandResult } from '@/types/merge-world';
import { mergeCellCenter } from '@/utils/merge-world/board-geometry';

/** Glow per merge: a burst that peels off one after another, each landing with its own impact. */
export const OPENING_GLOWS_PER_MERGE = 4;
/** Rise + hover + flight of the last Glow in a burst; the bar fills when it lands, not when the merge commits. */
export const OPENING_GLOW_FLIGHT_MS = 700 + (OPENING_GLOWS_PER_MERGE - 1) * 65;
/** How long the impact burst lives at the veiled tile. */
export const OPENING_IMPACT_BURST_MS = 640;
const GLOW_SIZE = 34;
const BURST_PARTICLES = 10;
const GLOW_COLOR = '#8FD3FF';

export type OpeningGlowFlight = { id: number; index: number; from: RewardFlightPoint; to: RewardFlightPoint };
type OpeningImpact = { id: number; at: RewardFlightPoint };

/**
 * The opening's board: the real Merge board seen through a 5×4 window, in
 * the same frame the Merge page uses, sitting under Mossprout's veiled tile
 * with one slim "Clear the Mist" bar above it. Nothing else: the guidance is
 * the ordinary spotlight-and-finger overlay the Kingdom mounts over it.
 * Merges go through the same FTUE dispatch as the dedicated page; each
 * merged item sends a Glow (via `onGlow`) up into the mist.
 */
export const KingdomOpeningMergeDock = memo(function KingdomOpeningMergeDock({ run, step, width, bottomInset, impactKey = 0, onGlow, onBoardMetrics, onBlockedInteraction }: {
  run: FtueRunState | null;
  /** Bumps once per landed Glow; the bar flashes on each. */
  impactKey?: number;
  /** The authored opening step (`world.mist_clear`); the dock derives its own refill beat from the board. */
  step: FtueStepDefinition | null;
  width: number;
  bottomInset: number;
  /** Window-space origin of a merged item, for the Glow flight. */
  onGlow?: (from: RewardFlightPoint) => void;
  onBoardMetrics?: (metrics: MergeBoardScreenMetrics | null) => void;
  onBlockedInteraction?: () => void;
}) {
  const { state } = useMergeWorldState();
  const { dispatch: send } = useMergeWorldActions();
  const sessionRef = useRef<ReturnType<typeof createMergeBoardSession> | null>(null);
  if (!sessionRef.current) sessionRef.current = createMergeBoardSession();
  const sessionId = sessionRef.current.id;
  const coordinatorRef = useRef<MergeFtueInteractionCoordinator | null>(null);
  if (!coordinatorRef.current) coordinatorRef.current = new MergeFtueInteractionCoordinator(sessionId);
  const coordinator = coordinatorRef.current;
  useEffect(() => () => coordinator.dispose(), [coordinator]);

  const progress = openingMistProgress(run);
  const boardStep = useMemo(() => openingMistBoardStep(step, state, progress), [progress, state, step]);
  const stateRef = useRef(state);
  const runRef = useRef(run);
  const stepRef = useRef(boardStep);
  stateRef.current = state;
  runRef.current = run;
  stepRef.current = boardStep;
  const boardMetricsRef = useRef<MergeBoardScreenMetrics | null>(null);
  const handleMetrics = useCallback((metrics: MergeBoardScreenMetrics) => {
    boardMetricsRef.current = metrics;
    onBoardMetrics?.(metrics);
  }, [onBoardMetrics]);
  useEffect(() => () => onBoardMetrics?.(null), [onBoardMetrics]);

  const handleEvent = useCallback((event: FtueEvent, result: MergeWorldCommandResult) => {
    const metrics = boardMetricsRef.current;
    if (event.type !== 'merge_completed' || !metrics || !onGlow) return;
    const center = mergeCellCenter(metrics.geometry, event.resultCell);
    onGlow({ x: metrics.x + center.x, y: metrics.y + center.y });
    void result;
  }, [onGlow]);
  const dispatch = useFtueMergeDispatch({
    send, coordinator, sessionId, stateRef, runRef, stepRef, guided: true,
    onBlocked: onBlockedInteraction, onEvent: handleEvent,
  });

  // The bar follows the checkpoint, but only once the Glow has landed.
  const [shownProgress, setShownProgress] = useState(progress);
  useEffect(() => {
    if (progress <= shownProgress) { setShownProgress(progress); return; }
    const timer = setTimeout(() => setShownProgress(progress), OPENING_GLOW_FLIGHT_MS);
    return () => clearTimeout(timer);
  }, [progress, shownProgress]);

  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const parcelRef = useRef<ViewType | null>(null);
  const boardWidth = Math.min(width - 28, 400);
  const cell = Math.floor((boardWidth - OPENING_BOARD_LAYOUT.contentInset * 2) / OPENING_MERGE_WINDOW_COLUMNS);
  const boardHeight = cell * OPENING_MERGE_WINDOW_ROWS + OPENING_BOARD_LAYOUT.contentInset * 2 + 2;
  const gate = useMemo(() => state ? mergeFtueBoardGate(boardStep, state) : { kind: 'locked' as const }, [boardStep, state]);
  const interactionKey = `${run?.runId ?? 'free'}:${boardStep?.id ?? 'open'}`;

  return <Animated.View entering={SlideInDown.duration(420)} exiting={SlideOutDown.duration(360)} pointerEvents="box-none"
    style={[styles.dock, { paddingBottom: bottomInset + 14 }]}>
    <ClearTheMistBar progress={shownProgress} total={OPENING_MERGE_REQUIRED} width={boardWidth} impactKey={impactKey} />
    {state ? <MergePlaySurface
      boardLayout={OPENING_BOARD_LAYOUT}
      railHidden
      counterHidden
      inspectorHidden
      boardInteractionGate={gate}
      railInteractionGate={{ kind: 'locked' }}
      effectsActive
      inspectedCell={null}
      interactionEnabled
      interactionSessionKey={interactionKey}
      maxHeight={boardHeight + 8}
      onBlockedInteraction={onBlockedInteraction}
      onCommand={dispatch}
      onOpenChat={() => {}}
      onOpenParcel={() => {}}
      onReroll={() => {}}
      onScreenMetrics={handleMetrics}
      onSelect={setSelectedCell}
      onServe={() => false}
      onUseGrovelight={() => {}}
      parcelTargetRef={parcelRef}
      selectedCell={selectedCell}
      sessionId={sessionId}
      state={state}
      style={styles.surface}
      trayEntries={[]}
      width={boardWidth}
    /> : null}
  </Animated.View>;
});

/** The bar interpolates its fill, flashes its halo on every landed Glow, and swells once per counted merge. */
export function ClearTheMistBar({ progress, total, width, impactKey = 0 }: { progress: number; total: number; width?: number; impactKey?: number }) {
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
  return <Animated.View accessibilityRole="progressbar" accessibilityLabel="Clear the Mist" accessibilityValue={{ min: 0, max: total, now: progress, text: `${progress} of ${total}` }}
    style={[styles.bar, width != null ? { width } : null, pulseStyle]}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.barHalo, haloStyle]} />
    <View style={styles.barHeader}>
      <Text style={styles.barTitle}>Clear the Mist</Text>
      <Text style={styles.barCount}>{progress}/{total}</Text>
    </View>
    <ProgressBar current={progress} total={total} minimumPercent={0} variant="egg" color={GLOW_COLOR} trackColor="rgba(72,86,120,0.28)" />
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
    {flights.map((flight) => <RewardTokenFlight key={flight.id} count={OPENING_GLOWS_PER_MERGE} index={flight.index} tokenSize={GLOW_SIZE}
      from={{ x: flight.from.x - origin.x, y: flight.from.y - origin.y }} to={{ x: flight.to.x - origin.x, y: flight.to.y - origin.y }}
      onArrive={() => onArrive(flight.id)}>
      <Animated.View entering={FadeIn.duration(120)} style={styles.glow}>
        <Image source={GAME_CURRENCY_ART.coins} contentFit="contain" style={styles.glowArt} accessible={false} />
      </Animated.View>
    </RewardTokenFlight>)}
    {impacts.map((impact) => <ImpactBurst key={impact.id} x={impact.at.x - origin.x} y={impact.at.y - origin.y} onDone={() => onImpactDone(impact.id)} />)}
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
    <Animated.View style={[styles.burstFlash, flashStyle]} />
    <Animated.View style={[styles.burstRing, ringStyle]} />
    {Array.from({ length: reduceMotion ? 0 : BURST_PARTICLES }, (_, index) => <ImpactMote key={index} index={index} t={t} />)}
  </View>;
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
  const nextId = useRef(0);
  const targetRef = useRef(targetNode);
  targetRef.current = targetNode;
  const launch = useCallback((from: RewardFlightPoint) => {
    const push = (to: RewardFlightPoint) => setFlights((current) => [
      ...current,
      ...Array.from({ length: OPENING_GLOWS_PER_MERGE }, (_, index) => ({ id: ++nextId.current, index, from, to })),
    ]);
    const target = targetRef.current;
    if (!target) { push({ x: from.x, y: from.y - 220 }); return; }
    target.measureInWindow((x, y, width, height) => push({ x: x + width / 2, y: y + height * 0.55 }));
  }, []);
  const arrive = useCallback((id: number) => {
    setFlights((current) => {
      const landed = current.find((flight) => flight.id === id);
      if (landed) setImpacts((bursts) => [...bursts, { id, at: { x: landed.to.x + (landed.index - (OPENING_GLOWS_PER_MERGE - 1) / 2) * 14, y: landed.to.y + (landed.index % 2) * 10 - 5 } }]);
      return current.filter((flight) => flight.id !== id);
    });
    setLanded((count) => count + 1);
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);
  const impactDone = useCallback((id: number) => setImpacts((current) => current.filter((impact) => impact.id !== id)), []);
  return { flights, impacts, landed, launch, arrive, impactDone };
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 60, alignItems: 'center', gap: 10 },
  bar: {
    gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, overflow: 'visible',
    backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.95)',
    boxShadow: '0 4px 14px rgba(20,40,60,0.16)',
  },
  barHalo: { borderRadius: 16, backgroundColor: 'rgba(143,211,255,0.22)', boxShadow: `0 0 26px ${GLOW_COLOR}` },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  barTitle: { ...KatchaDeckUI.typography.ftuePanelTitle, color: '#2E4A66' },
  barCount: { color: '#2E4A66', fontSize: 15, lineHeight: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  surface: { paddingTop: 0 },
  glowLayer: { zIndex: 100 },
  glow: { width: GLOW_SIZE, height: GLOW_SIZE, alignItems: 'center', justifyContent: 'center' },
  glowArt: { width: GLOW_SIZE, height: GLOW_SIZE },
  burst: { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  burstFlash: { position: 'absolute', width: 54, height: 54, marginLeft: -27, marginTop: -27, borderRadius: 27, backgroundColor: 'rgba(214,240,255,0.95)', boxShadow: `0 0 30px ${GLOW_COLOR}` },
  burstRing: { position: 'absolute', width: 48, height: 48, marginLeft: -24, marginTop: -24, borderRadius: 24, borderWidth: 3, borderColor: GLOW_COLOR },
  mote: { position: 'absolute', width: 8, height: 8, marginLeft: -4, marginTop: -4, borderRadius: 4, backgroundColor: '#DDF4FF', boxShadow: `0 0 8px ${GLOW_COLOR}` },
  moteLarge: { width: 12, height: 12, marginLeft: -6, marginTop: -6, borderRadius: 6 },
});
