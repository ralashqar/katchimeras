import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { INTENT_WORDS } from '@/features/encounter/encounter-copy';
import { usePulseAim } from '@/features/encounter/pulse-aim';
import { DARK_WISP_LOOK_ART } from '@/constants/dark-wisp-look-art';
import { isDarkWispLook } from '@/constants/dark-wisp-looks';
import { pulseTarget } from '@/features/mission-mechanics/dark-wisps';
import { StyleSheet, Text, View, type View as ViewType } from 'react-native';
import Animated, { cancelAnimation, Easing, FadeInDown, FadeOut, ZoomIn, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { Image } from 'expo-image';

import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import type { RewardFlightPoint } from '@/components/katchadeck/ui/reward-token-flight';
import type { GlowSink } from '@/components/katchadeck/world/kingdom-opening-merge-dock';
import type { MissionWindow } from '@/features/mission-mechanics/board-window';
import { glowStrikeAt } from '@/features/mission-mechanics/glow-strikes';
import { applyStrike, resolveMechanic, syncMechanicState, wispViews, type MissionMechanicHost } from '@/features/mission-mechanics/mechanic';
import { wispLineForFall, type CorruptionWispLines } from '@/features/onboarding/corruption-wisps';
import type { MissionMechanicLive, MissionMechanicState, MissionStrike, MissionWispView } from '@/types/mission-mechanic';
import { mergeCellCenter, mergeCellFrame } from '@/utils/merge-world/board-geometry';

const WISP_ART = require('@incubator/art-cutouts/corruption-wisp.png');
const SOFT_GLOW = require('@incubator/art-characters/soft-glow.png');
const RIM = '#A24BFF';
const EMBER_LIGHT = '#C58BFF';
const EMBER_DARK = '#5E2A8C';
/** After the last wisp falls, how long the layer stays for its death to play. */
const LINGER_MS = 800;
const DEATH_MS = 440;
/** A wisp's arrival: it swells up out of nothing with a little overshoot, then shivers into place. */
const ENTRANCE_MS = 460;
const ENTRANCE_STAGGER_MS = 150;
/**
 * A board put away mid-mission: the wisps still standing shrink and fade out
 * with the dock (its fade is 260ms), moving from the first frame; the stagger
 * is only a ripple, so the last starts well before the first has finished.
 */
const EXIT_MS = 260;
const EXIT_STAGGER_MS = 40;
// Three per wisp: each ember is a native view animating for as long as the wisp stands, and three
// wisps hang over the tile under a board that has its own motion to run.
const EMBERS = [
  { dx: -0.22, rise: 0.95, duration: 2_300, delay: 0, size: 5, light: true },
  { dx: 0.14, rise: 1.05, duration: 2_700, delay: 700, size: 4, light: false },
  { dx: 0.02, rise: 1.15, duration: 2_900, delay: 1_500, size: 5, light: true },
] as const;
const DEATH_MOTES = 8;

/**
 * The misted tile a set of wisps hangs over: which mission, its tile on screen, what the board plays
 * by and where its strikes stand. Wisps over the tile are placed against the tile's measured frame;
 * a mechanic that hangs them above the board (a column shot) anchors them to the board's metrics.
 */
export type CorruptionWispTarget = {
  key: string;
  node: ViewType | null;
  /** Wisps above the board itself: their frame is the board's, no measuring. */
  anchor?: { kind: 'board'; metrics: MergeBoardScreenMetrics | null; window: MissionWindow };
  /** What the board is authored on: its bar, its wisps, its mechanic. */
  host: MissionMechanicHost;
  /** Where the board's strikes stand when the target is first seen: a resumed board starts with its wisps already felled. */
  mechanicState: MissionMechanicState;
  /** A board whose wisps appear over time (a rush) publishes its state here, so new wisps reach this layer without the screen re-rendering for them. */
  live?: MissionMechanicLive;
  /** What the board says as the wisps are struck and fall. */
  lines?: CorruptionWispLines;
  /** False while the camera is still gliding onto the tile: the wisps wait, and measure where it stops. */
  settled?: boolean;
  /** Bumps when full mist bursts open on the board (a sleeper beside it woke); the first one gets a line. */
  revealNonce?: number;
};
/** A board opening asks the camera to frame its tile; this is how long to give it to start moving before a measurement is trusted. */
const SETTLE_GRACE_MS = 200;
/** How long a wisp line stays under the tile. */
const CAPTION_MS = 1_700;
/** After the strike that burst the mist open: when its line is said. */
const REVEAL_LINE_DELAY_MS = 1_100;
/** A wisp on the sky grid, against a board cell; and the space between its rows. */
/** A column shot's sky over the tile: the first row at this fraction of the tile's height, each row above it this much higher, each wisp this fraction of the tile's width. */
const TILE_SKY_BASE = 0.4;
const TILE_SKY_PITCH = 0.17;
const TILE_SKY_WISP_SIZE = 0.18;

type WispFrame = { x: number; y: number; width: number; height: number };
/** Where every wisp is drawn, window-space, and where the line under them goes. */
export type WispLayout = { frame: WispFrame; wisps: readonly { x: number; y: number; size: number }[]; captionTop: number };

export type CorruptionWisps = {
  visible: boolean;
  /** The mission's target is gone while the layer lingers: standing wisps play their exit. */
  leaving: boolean;
  layout: WispLayout | null;
  views: readonly MissionWispView[];
  /** Territory: the wisp a merge landing on a cell would strike, for the aim ring; absent when the wisps are not on the board. */
  aimTarget?: (cell: number, tier: number) => number | null;
  /** Bumps when a Glow strikes that wisp. */
  strikes: Readonly<Record<number, number>>;
  /** The Glow hook's aim: where the next burst goes, and what each landing does. */
  sink: GlowSink | null;
  /** The line under the tile right now, if one is showing. */
  caption: { id: number; text: string } | null;
};

/** Every wisp's place on screen: over the tile by its fractions, on the sky grid above the board, or on its nest cell. */
export function wispLayout(target: CorruptionWispTarget, views: readonly MissionWispView[], tileFrame: WispFrame | null): WispLayout | null {
  const mechanic = resolveMechanic(target.host);
  const anchor = target.anchor;
  if (anchor) {
    const metrics = anchor.metrics;
    if (!metrics) return null;
    const { geometry } = metrics;
    const columns = anchor.window.cellIndices.slice(0, anchor.window.columns);
    if (!columns.length) return null;
    const first = mergeCellFrame(geometry, columns[0]!).bounds;
    const last = mergeCellFrame(geometry, columns[columns.length - 1]!).bounds;
    // A territory battle: each wisp sits on its nest, a cell of the board; no tile to measure.
    if (views.some((view) => view.placement.kind === 'cell')) {
      const bottom = mergeCellFrame(geometry, anchor.window.cellIndices[anchor.window.cellIndices.length - 1]!).bounds;
      const frame = { x: metrics.x + first.left, y: metrics.y + first.top, width: last.left + last.width - first.left, height: bottom.top + bottom.height - first.top };
      const wisps = views.map((view) => {
        const cell = view.placement.kind === 'cell' ? view.placement.cell : anchor.window.cellIndices[Math.floor(anchor.window.columns / 2)]!;
        const center = mergeCellCenter(geometry, cell);
        const bounds = mergeCellFrame(geometry, cell).bounds;
        return { x: metrics.x + center.x, y: metrics.y + center.y, size: Math.max(36, bounds.width * (view.placement.kind === 'cell' ? view.placement.size ?? 0.9 : 0.9)) };
      });
      // The line goes just above the board, where the wisps are.
      return { frame, wisps, captionTop: frame.y - 34 };
    }
    const rows = mechanic.kind === 'column-shot' ? Math.max(1, mechanic.wisps.rows) : 1;
    // The sky sits over the tile, as every other board's wisps do: each column's x is the board's, so a shot flies
    // straight up its column, and the rows climb the tile from its middle. Nothing is drawn until the tile is
    // measured, so no wisp ever appears somewhere else first.
    if (!tileFrame) return null;
    const rowY = (row: number) => tileFrame.y + tileFrame.height * (TILE_SKY_BASE - row * TILE_SKY_PITCH);
    const size = (scale: number) => Math.max(48, TILE_SKY_WISP_SIZE * tileFrame.width * scale);
    const frameTop = rowY(rows - 1) - size(1) / 2;
    const frame = { x: metrics.x + first.left, y: frameTop, width: last.left + last.width - first.left, height: rowY(0) + size(1) / 2 - frameTop };
    const wisps = views.map((view) => {
      if (view.placement.kind !== 'board') return { x: frame.x + frame.width / 2, y: rowY(0), size: size(1) };
      const cell = columns[Math.max(0, Math.min(columns.length - 1, view.placement.column))]!;
      return { x: metrics.x + mergeCellCenter(geometry, cell).x, y: rowY(view.placement.row), size: size(view.placement.size ?? 1) };
    });
    return { frame, wisps, captionTop: tileFrame.y + tileFrame.height * 0.62 };
  }
  if (!tileFrame) return null;
  const wisps = views.map((view) => view.placement.kind === 'tile'
    ? { x: tileFrame.x + view.placement.fx * tileFrame.width, y: tileFrame.y + view.placement.fy * tileFrame.height, size: Math.max(48, view.placement.size * tileFrame.width) }
    : { x: tileFrame.x + tileFrame.width / 2, y: tileFrame.y + tileFrame.height * 0.2, size: Math.max(48, 0.18 * tileFrame.width) });
  return { frame: tileFrame, wisps, captionTop: tileFrame.y + tileFrame.height * 0.62 };
}

/**
 * Owns the wisps over a misted tile: measures the tile (or takes the board's
 * frame), draws each wisp where its mechanic puts it, aims every burst at the
 * wisp its strike names, shakes it on each token and lands the strike's hits
 * once per burst. The last wisp falls on the final strike's own item, the
 * same landing that lifts the mist. A board resumed part-way starts with the
 * wisps its strikes already felled.
 */
export function useCorruptionWisps(target: CorruptionWispTarget | null): CorruptionWisps {
  const [frame, setFrame] = useState<WispFrame | null>(null);
  const [applied, setApplied] = useState<MissionMechanicState | null>(null);
  const [strikes, setStrikes] = useState<Record<number, number>>({});
  // Held from the mission's first frame until a beat after its last: the layer never unmounts in
  // between, so a wisp that fell stays gone through the mist's lift instead of replaying its death.
  const [held, setHeld] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const assignedRef = useRef(0);
  const keyRef = useRef<string | null>(null);
  const lastRef = useRef<{ host: MissionMechanicHost; layout: WispLayout | null } | null>(null);
  // Strikes in the air, by the wisp they are aimed at: each landing takes the next one's hits.
  const queuedRef = useRef(new Map<number, MissionStrike[]>());
  const key = target?.key ?? null;
  const node = target?.node ?? null;
  const settled = target?.settled ?? true;
  // Whether the camera has been seen moving since the last measurement: a settle after motion is measured at once.
  const movedRef = useRef(false);
  useEffect(() => { if (!settled) movedRef.current = true; }, [settled]);
  const host = target?.host ?? lastRef.current?.host ?? null;
  const mechanic = host ? resolveMechanic(host) : null;

  // A new mission: the wisps start where its strikes already are; nothing is in flight yet.
  useEffect(() => {
    if (!key || !target) return;
    if (keyRef.current === key) return;
    keyRef.current = key;
    assignedRef.current = target.mechanicState.strikes;
    queuedRef.current = new Map();
    setApplied(target.mechanicState);
    setStrikes({});
  }, [key, target]);
  // A live board's new wisps join the copy kept here; its damage stays this layer's own.
  const live = target?.live ?? null;
  useEffect(() => {
    if (!live || !mechanic) return;
    const take = () => setApplied((current) => current ? syncMechanicState(mechanic, current, live.get()) : current);
    take();
    return live.subscribe(take);
  }, [key, live, mechanic]);
  // The tile on screen, measured only while the camera is still: a board opening sends the camera onto its
  // tile, so the first measurement waits a beat for that glide to begin, and is made again once it has ended.
  // The wisps therefore first appear where the tile will stay, instead of appearing early and jumping.
  useEffect(() => {
    if (!key || !node || !settled) return;
    let cancelled = false;
    const measure = () => node.measureInWindow((x, y, width, height) => {
      if (cancelled || !(width > 0 && height > 0)) return;
      setFrame((current) => current && current.x === x && current.y === y && current.width === width && current.height === height ? current : { x, y, width, height });
    });
    const grace = movedRef.current ? 0 : SETTLE_GRACE_MS;
    movedRef.current = false;
    const timers = [setTimeout(measure, grace), setTimeout(measure, grace + 400), setTimeout(measure, grace + 1_100)];
    return () => { cancelled = true; for (const timer of timers) clearTimeout(timer); };
  }, [key, node, settled]);
  // The mission ends on the last wisp's fall: the layer stays a beat for that death to play, then goes.
  // Put away early (Back), the standing wisps leave the way they came during that same beat.
  useEffect(() => {
    if (target) { setHeld(true); setLeaving(false); return; }
    setLeaving(true);
    const timer = setTimeout(() => { setHeld(false); setLeaving(false); lastRef.current = null; keyRef.current = null; setFrame(null); setApplied(null); }, LINGER_MS);
    return () => clearTimeout(timer);
  }, [target]);

  const state = applied ?? target?.mechanicState ?? null;
  const views = useMemo(() => host && mechanic && state ? wispViews(mechanic, host, state) : [], [host, mechanic, state]);
  const layout = useMemo(() => target ? wispLayout(target, views, frame) : null, [frame, target, views]);
  if (target) lastRef.current = { host: target.host, layout: layout ?? lastRef.current?.layout ?? null };
  const shownLayout = layout ?? lastRef.current?.layout ?? null;
  // The wisps answer back: once on the first strike, once as each falls, once more for the last.
  const [caption, setCaption] = useState<{ id: number; text: string } | null>(null);
  const captionSeq = useRef(0);
  const spokenStrikeRef = useRef<string | null>(null);
  const fallenRef = useRef<number>(0);
  const struckCount = Object.values(strikes).reduce((sum, count) => sum + count, 0);
  const fallen = views.filter((wisp) => !wisp.alive).length;
  const lines = target?.lines ?? null;
  useEffect(() => {
    if (!key) { fallenRef.current = 0; spokenStrikeRef.current = null; return; }
    if (keyRef.current !== key) return;
    // Nothing to say for wisps already down when the board came back: the count starts where it is.
    if (fallenRef.current === 0 && fallen > 0 && struckCount === 0) { fallenRef.current = fallen; return; }
    let text: string | null = null;
    if (fallen > fallenRef.current) {
      fallenRef.current = fallen;
      text = lines ? wispLineForFall(lines, fallen, views.length) : null;
    } else if (struckCount > 0 && spokenStrikeRef.current !== key) {
      spokenStrikeRef.current = key;
      text = lines?.firstStrike ?? null;
    }
    if (!text) return;
    setCaption({ id: ++captionSeq.current, text });
  }, [fallen, key, lines, views.length, struckCount]);
  useEffect(() => {
    if (!caption) return;
    const timer = setTimeout(() => setCaption((current) => current?.id === caption.id ? null : current), CAPTION_MS);
    return () => clearTimeout(timer);
  }, [caption]);
  // The first burst gets its line, a beat after the strike that caused it so the two are heard in order.
  const revealNonce = target?.revealNonce ?? 0;
  const spokenRevealRef = useRef<string | null>(null);
  useEffect(() => {
    if (!key || !revealNonce || spokenRevealRef.current === key || !lines?.reveal) return;
    spokenRevealRef.current = key;
    const text = lines.reveal;
    const timer = setTimeout(() => setCaption({ id: ++captionSeq.current, text }), REVEAL_LINE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [key, lines, revealNonce]);
  const sink = useMemo<GlowSink | null>(() => {
    if (!target || !layout || !mechanic || !views.length) return null;
    const { host: aimedHost } = target;
    return {
      aim: (kind, strike) => {
        // A burst carrying its board's strike goes where the strike says; one without is dealt here, the old way:
        // the next hit in the deal, the finale on whichever wisp still stands.
        const resolved = strike ?? (mechanic.kind === 'glow-strikes' ? glowStrikeAt(aimedHost, assignedRef.current, kind) : null);
        if (!resolved || resolved.target == null || !layout.wisps[resolved.target]) return null;
        assignedRef.current += 1;
        const queue = queuedRef.current.get(resolved.target) ?? [];
        queue.push(resolved);
        queuedRef.current.set(resolved.target, queue);
        const point = layout.wisps[resolved.target]!;
        return { point: { x: point.x, y: point.y }, key: resolved.target };
      },
      struck: (index) => setStrikes((current) => ({ ...current, [index]: (current[index] ?? 0) + 1 })),
      landed: (index) => {
        const strike = queuedRef.current.get(index)?.shift() ?? null;
        setApplied((current) => current && strike ? applyStrike(mechanic, current, strike) : current);
      },
    };
  }, [layout, mechanic, target, views.length]);

  return {
    visible: Boolean(shownLayout && views.length && (target || held)),
    leaving: !target && leaving,
    layout: shownLayout,
    views,
    ...(mechanic?.kind === 'dark-wisps' && state?.kind === 'dark-wisps' && target?.anchor ? { aimTarget: (cell: number, tier: number) => pulseTarget(mechanic, state, cell, tier, target.anchor!.window) } : {}),
    strikes,
    sink,
    caption,
  };
}

/** Window-space, above the map and under the Glow flights: the wisps themselves. */
export const CorruptionWispLayer = memo(function CorruptionWispLayer({ wisps, screenRef }: { wisps: CorruptionWisps; screenRef: RefObject<ViewType | null> }) {
  const [origin, setOrigin] = useState<RewardFlightPoint>({ x: 0, y: 0 });
  useEffect(() => {
    screenRef.current?.measureInWindow((x, y) => setOrigin({ x, y }));
  }, [screenRef, wisps.layout]);
  const layout = wisps.layout;
  // Territory: the wisp a held piece would strike where it is over, rung while it is held.
  const aim = usePulseAim();
  const aimedIndex = aim && wisps.aimTarget ? wisps.aimTarget(aim.cell, aim.tier) : null;
  if (!layout) return null;
  // Territory wisps sit on the board's own cells, so they are drawn over the docked board rather than under it.
  const onBoard = wisps.views.some((view) => view.placement.kind === 'cell');
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, onBoard ? styles.layerOnBoard : styles.layer]}>
    {wisps.views.map((view, index) => <CorruptionWisp
      key={view.id} index={index} enterDelayMs={view.enterDelayMs}
      x={(layout.wisps[index]?.x ?? layout.frame.x) - origin.x} y={(layout.wisps[index]?.y ?? layout.frame.y) - origin.y}
      size={layout.wisps[index]?.size ?? 48}
      pip={view.hp > 1 ? `${Math.max(0, view.hp - view.damage)}` : null}
      intent={view.intent ?? null}
      aimed={aimedIndex === index}
      look={view.look ?? null}
      weakTo={view.weakTo ?? null}
      alive={view.alive} leaving={wisps.leaving} strikeNonce={wisps.strikes[index] ?? 0} />)}
    {wisps.caption ? <Animated.View key={wisps.caption.id} entering={FadeInDown.duration(220)} exiting={FadeOut.duration(260)} pointerEvents="none"
      style={[styles.caption, { left: layout.frame.x - origin.x, width: layout.frame.width, top: layout.captionTop - origin.y }]}>
      <Text style={styles.captionText}>{wisps.caption.text}</Text>
    </Animated.View> : null}
  </View>;
});

/**
 * The wisps over a mission's tile, owned here rather than by the screen: their measuring, their
 * strikes and their captions re-render this component alone. The Glow's sink is theirs, handed
 * over on every render so a burst launched from the board is aimed at the first wisp standing.
 */
export const MissionWisps = memo(function MissionWisps({ target, glow, screenRef }: {
  target: CorruptionWispTarget | null;
  glow: { sinkRef: { current: GlowSink | null } };
  screenRef: RefObject<ViewType | null>;
}) {
  const wisps = useCorruptionWisps(target);
  glow.sinkRef.current = wisps.sink;
  return wisps.visible ? <CorruptionWispLayer wisps={wisps} screenRef={screenRef} /> : null;
});

/** One wisp: hovering, rimmed in violet, shedding embers; it flinches when struck and shrinks away when it falls. */
const CorruptionWisp = memo(function CorruptionWisp({ index, enterDelayMs, x, y, size, pip, intent, aimed = false, look = null, weakTo = null, alive, leaving, strikeNonce }: { /** v2: the chain it is weak to. */ weakTo?: 'growth' | 'water' | null; /** v2: its Dark Wisp art, when it has one. */ look?: string | null; /** v2: the wisp a held piece would hit. */ aimed?: boolean; index: number; /** A wisp that pops up mid-mission says when; the first ones arrive in order. */ enterDelayMs?: number; x: number; y: number; size: number; /** Hits it still takes, shown under it when it takes more than one. */ pip: string | null; /** v2: what it will do next, and in how many turns. */ intent: MissionWispView['intent'] | null; alive: boolean; leaving: boolean; strikeNonce: number }) {
  const reduceMotion = useReducedMotion();
  const hover = useSharedValue(0);
  const shake = useSharedValue(0);
  const pulse = useSharedValue(0);
  const death = useSharedValue(0);
  const entrance = useSharedValue(0);
  // A wisp already felled when it mounts (a resumed board) was never here: no death to play.
  const [gone, setGone] = useState(() => !alive);
  // v2: one held back until called arrives the first time it is alive.
  useEffect(() => {
    if (!alive || !gone) return;
    setGone(false);
    death.value = 0;
    entrance.value = 0;
    entrance.value = withTiming(1, { duration: reduceMotion ? 80 : ENTRANCE_MS, easing: Easing.out(Easing.back(1.6)) });
  // Only when it comes to life.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alive]);
  useEffect(() => {
    if (reduceMotion) { entrance.value = 1; return; }
    const delay = enterDelayMs ?? index * ENTRANCE_STAGGER_MS;
    entrance.value = withDelay(delay, withTiming(1, { duration: ENTRANCE_MS, easing: Easing.out(Easing.back(1.6)) }));
    shake.value = withDelay(delay + ENTRANCE_MS - 80, withSequence(
      withTiming(0.7, { duration: 45 }),
      withTiming(-0.7, { duration: 60 }),
      withTiming(0.35, { duration: 50 }),
      withTiming(0, { duration: 45 }),
    ));
    return () => { cancelAnimation(entrance); };
  // Once, on arrival.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (reduceMotion) { hover.value = 0.5; pulse.value = 0.5; return; }
    hover.value = withDelay(index * 380, withRepeat(withTiming(1, { duration: 1_900 + index * 140, easing: Easing.inOut(Easing.sin) }), -1, true));
    pulse.value = withDelay(index * 210, withRepeat(withTiming(1, { duration: 1_450, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => { cancelAnimation(hover); cancelAnimation(pulse); };
  }, [hover, index, pulse, reduceMotion]);
  const firstStrike = useRef(true);
  useEffect(() => {
    if (firstStrike.current) { firstStrike.current = false; return; }
    if (!strikeNonce) return;
    shake.value = 0;
    shake.value = withSequence(
      withTiming(1, { duration: 40 }),
      withTiming(-1, { duration: 60 }),
      withTiming(0.6, { duration: 50 }),
      withTiming(-0.3, { duration: 45 }),
      withTiming(0, { duration: 40 }),
    );
  }, [shake, strikeNonce]);
  // Leaving: the entrance runs backwards, staggered; back within the linger, it runs forward again.
  const leftRef = useRef(false);
  useEffect(() => {
    if (!alive) return;
    if (leaving) {
      leftRef.current = true;
      cancelAnimation(entrance);
      entrance.value = withDelay(reduceMotion ? 0 : index * EXIT_STAGGER_MS, withTiming(0, { duration: reduceMotion ? 120 : EXIT_MS, easing: Easing.out(Easing.cubic) }));
    } else if (leftRef.current) {
      leftRef.current = false;
      cancelAnimation(entrance);
      entrance.value = withTiming(1, { duration: reduceMotion ? 80 : ENTRANCE_MS, easing: Easing.out(Easing.back(1.6)) });
    }
  }, [alive, entrance, index, leaving, reduceMotion]);
  useEffect(() => {
    if (alive) return;
    // A felled wisp stops hovering and pulsing at once; only its death plays until it is gone.
    cancelAnimation(hover);
    cancelAnimation(pulse);
    death.value = withTiming(1, { duration: reduceMotion ? 160 : DEATH_MS, easing: Easing.in(Easing.cubic) });
    const timer = setTimeout(() => setGone(true), (reduceMotion ? 160 : DEATH_MS) + 320);
    return () => clearTimeout(timer);
  }, [alive, death, hover, pulse, reduceMotion]);
  const bodyStyle = useAnimatedStyle(() => {
    const bob = (hover.value - 0.5) * size * 0.12;
    const flinch = shake.value * 7;
    const dying = death.value;
    const arriving = Math.max(0, Math.min(1.2, entrance.value));
    return {
      opacity: Math.min(1, arriving / 0.55) * (1 - dying),
      transform: [
        { translateX: flinch },
        { translateY: bob - dying * size * 0.1 + (1 - Math.min(1, arriving)) * size * 0.18 },
        { rotate: `${(hover.value - 0.5) * 4 + shake.value * 3}deg` },
        { scale: arriving * (1 + Math.abs(shake.value) * 0.06) * (1 - dying * 0.85) },
      ],
    };
  });
  const badgeStyle = useAnimatedStyle(() => {
    const arriving = Math.max(0, Math.min(1, entrance.value));
    return { opacity: Math.min(1, arriving / 0.7) * (1 - death.value), transform: [{ scale: 0.6 + arriving * 0.4 }] };
  });
  const rimStyle = useAnimatedStyle(() => ({
    opacity: (0.42 + pulse.value * 0.3) * (1 - death.value) * Math.min(1, entrance.value),
    transform: [{ scale: (1.55 + pulse.value * 0.12 + death.value * 0.5) * Math.max(0.2, Math.min(1, entrance.value)) }],
  }));
  // Its place: where it first appears it simply is; a move after that (a burrow, the board settling) glides there.
  const placeX = useSharedValue(x);
  const placeY = useSharedValue(y);
  useEffect(() => {
    placeX.value = reduceMotion ? x : withTiming(x, { duration: 420, easing: Easing.inOut(Easing.cubic) });
    placeY.value = reduceMotion ? y : withTiming(y, { duration: 420, easing: Easing.inOut(Easing.cubic) });
  }, [placeX, placeY, reduceMotion, x, y]);
  const placeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: placeX.value - x }, { translateY: placeY.value - y }] }));
  if (gone) return null;
  return <Animated.View pointerEvents="none" style={[styles.wisp, { left: x - size / 2, top: y - size / 2, width: size, height: size }, placeStyle]}>
    <Animated.View style={[StyleSheet.absoluteFill, styles.rim, rimStyle]}>
      <Image accessibilityIgnoresInvertColors contentFit="contain" source={SOFT_GLOW} style={StyleSheet.absoluteFill} tintColor={RIM} transition={0} />
    </Animated.View>
    {!reduceMotion && alive ? EMBERS.map((ember, emberIndex) => <Ember key={emberIndex} ember={ember} size={size} />) : null}
    <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
      <Image accessibilityIgnoresInvertColors accessibilityLabel={look ? `A ${look} wisp` : 'A corruption wisp'} contentFit="contain" source={isDarkWispLook(look) ? DARK_WISP_LOOK_ART[look] : WISP_ART} style={StyleSheet.absoluteFill} transition={0} />
    </Animated.View>
    {!alive ? <DeathBurst size={size} reduceMotion={reduceMotion} /> : null}
    {aimed && alive ? <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(160)} exiting={reduceMotion ? undefined : FadeOut.duration(140)} pointerEvents="none" style={[styles.aim, { width: size * 1.35, height: size * 1.35, borderRadius: size, left: -size * 0.175, top: -size * 0.175 }]} /> : null}
    {/* Its badges arrive with it: they grow in as it does, never before it. */}
    <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, badgeStyle]}>
      {pip && alive ? <View style={[styles.pip, { top: size * 0.86 }]}><Text style={styles.pipText}>{pip}</Text></View> : null}
      {intent && alive ? <IntentChip intent={intent} size={size} /> : null}
      {weakTo && alive ? <View accessible accessibilityLabel={`Weak to ${weakTo === 'growth' ? 'Growth' : 'Water'}`} style={[styles.weak, { top: size * 0.86, right: -size * 0.12 }, weakTo === 'water' ? styles.weakWater : styles.weakGrowth]}>
        <IconSymbol name={weakTo === 'water' ? 'water.waves' : 'leaf.fill'} size={11} color="#FFFFFF" />
      </View> : null}
    </Animated.View>
  </Animated.View>;
});

const INTENT_ICON: Readonly<Record<NonNullable<MissionWispView['intent']>['kind'], IconSymbolName>> = {
  surge: 'cloud.fog.fill', snuff: 'cloud.fog.fill', shroud: 'cloud.fill', root: 'leaf.fill', devour: 'exclamationmark.triangle.fill',
  ward: 'shield.fill', mend: 'heart.fill', call: 'sparkles', gather: 'bolt.fill', burrow: 'chevron.down', spores: 'circle.grid.2x2.fill',
};
/** Intents that take ground: the chip turns warm while one is coming. */
const SPREADING: ReadonlySet<string> = new Set(['surge', 'snuff', 'gather', 'shroud', 'root', 'spores']);

/** v2: over the wisp, what it will do next and in how many turns; its ward beside it; a gather's stagger bar under it. */
const IntentChip = memo(function IntentChip({ intent, size }: { intent: NonNullable<MissionWispView['intent']>; size: number }) {
  const urgent = intent.countdown <= 1;
  const threat = SPREADING.has(intent.kind);
  return <View accessible accessibilityLabel={`In ${intent.countdown} ${intent.countdown === 1 ? 'turn' : 'turns'}, it ${INTENT_WORDS[intent.kind]}${intent.ward ? `. Ward ${intent.ward}` : ''}`}
    style={[styles.intent, { top: -size * 0.34 }, threat && styles.intentThreat, urgent && styles.intentUrgent]}>
    <IconSymbol name={INTENT_ICON[intent.kind]} size={13} color={threat ? '#FFE1B8' : '#EDE3FF'} />
    <Text style={styles.intentText}>{`${intent.countdown}`}</Text>
    {intent.amount && intent.amount > 1 ? <Text style={styles.intentText}>{`\u00d7${intent.amount}`}</Text> : null}
    {intent.ward ? <><IconSymbol name="shield.fill" size={11} color="#BFE3FF" /><Text style={styles.intentText}>{`${intent.ward}`}</Text></> : null}
    {intent.kind === 'gather' && intent.stagger ? <View style={styles.staggerTrack}><View style={[styles.staggerFill, { width: `${Math.min(100, ((intent.gathered ?? 0) / intent.stagger) * 100)}%` }]} /></View> : null}
  </View>;
});

/** One ember: born low on the body, rising and fading, forever. Cheap: a tinted dot on the UI thread. */
const Ember = memo(function Ember({ ember, size }: { ember: (typeof EMBERS)[number]; size: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(ember.delay, withRepeat(withTiming(1, { duration: ember.duration, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(t);
  }, [ember.delay, ember.duration, t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.15 ? t.value / 0.15 : 1 - (t.value - 0.15) / 0.85,
    transform: [
      { translateX: ember.dx * size + Math.sin(t.value * Math.PI * 2) * size * 0.04 },
      { translateY: size * 0.35 - t.value * ember.rise * size },
      { scale: 1 - t.value * 0.5 },
    ],
  }));
  return <Animated.View style={[styles.ember, { width: ember.size, height: ember.size, borderRadius: ember.size / 2, left: size / 2 - ember.size / 2, top: size / 2, backgroundColor: ember.light ? EMBER_LIGHT : EMBER_DARK }, style]} />;
});

/** The wisp's last breath: a ring of embers thrown outward and gone. */
function DeathBurst({ size, reduceMotion }: { size: number; reduceMotion: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: reduceMotion ? 200 : 620, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(t);
  }, [reduceMotion, t]);
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.burst]}>
    {Array.from({ length: reduceMotion ? 0 : DEATH_MOTES }, (_, index) => <DeathMote key={index} index={index} size={size} t={t} />)}
  </View>;
}

function DeathMote({ index, size, t }: { index: number; size: number; t: SharedValue<number> }) {
  const angle = (index / DEATH_MOTES) * Math.PI * 2 + (index % 2) * 0.4;
  const distance = size * (0.42 + (index % 3) * 0.1);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [
      { translateX: Math.cos(angle) * distance * t.value },
      { translateY: Math.sin(angle) * distance * t.value - size * 0.12 * t.value },
      { scale: 1 - t.value * 0.6 },
    ],
  }));
  return <Animated.View style={[styles.mote, index % 2 === 0 && styles.moteLight, style]} />;
}

const styles = StyleSheet.create({
  // Over the map and its markers, under the docked board (60) and everything the board's beats draw; the Glow (100) strikes them from above.
  layer: { zIndex: 58 },
  // Over the docked board (60), under the Glow (100).
  layerOnBoard: { zIndex: 61 },
  caption: { position: 'absolute', alignItems: 'center', zIndex: 4 },
  pip: { position: 'absolute', alignSelf: 'center', zIndex: 3, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 9, backgroundColor: 'rgba(38,18,58,0.78)' },
  pipText: { fontFamily: 'FredokaBold', fontSize: 12, color: '#F3E6FF', textAlign: 'center' },
  aim: { position: 'absolute', borderWidth: 3, borderColor: '#FFD27A', backgroundColor: 'rgba(255,210,122,0.12)', zIndex: 2 },
  weak: { position: 'absolute', zIndex: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFFFFF' },
  weakWater: { backgroundColor: '#3B9CC4' },
  weakGrowth: { backgroundColor: '#4E9F57' },
  intent: { position: 'absolute', alignSelf: 'center', zIndex: 4, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(38,18,58,0.82)', borderWidth: 1, borderColor: 'rgba(200,170,255,0.55)' },
  intentThreat: { backgroundColor: 'rgba(92,30,24,0.88)', borderColor: 'rgba(255,170,120,0.8)' },
  intentUrgent: { borderWidth: 2, borderColor: '#FFD27A' },
  intentText: { fontFamily: 'FredokaBold', fontSize: 12, color: '#FFF4E6' },
  staggerTrack: { position: 'absolute', left: 6, right: 6, bottom: -4, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  staggerFill: { height: 3, backgroundColor: '#FFD27A' },
  captionText: { fontFamily: 'FredokaBold', fontSize: 17, color: '#FFF4D6', textAlign: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(38,18,58,0.72)', overflow: 'hidden' },
  wisp: { position: 'absolute', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  rim: { zIndex: 0 },
  ember: { position: 'absolute', zIndex: 1 },
  burst: { alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  mote: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: EMBER_DARK },
  moteLight: { width: 10, height: 10, borderRadius: 5, backgroundColor: EMBER_LIGHT },
});
