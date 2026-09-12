import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { StyleSheet, Text, View, type View as ViewType } from 'react-native';
import Animated, { cancelAnimation, Easing, FadeInDown, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { Image } from 'expo-image';

import type { RewardFlightPoint } from '@/components/katchadeck/ui/reward-token-flight';
import type { GlowSink } from '@/components/katchadeck/world/kingdom-opening-merge-dock';
import { wispHitPlan, wispLineForFall, wispStates, wispTargetIndex, type CorruptionWispLines, type CorruptionWispSpec } from '@/features/onboarding/corruption-wisps';

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

/** The misted tile a set of wisps hangs over: which mission, its tile on screen, how many merges it takes, how many are already in. */
export type CorruptionWispTarget = {
  key: string;
  node: ViewType | null;
  required: number;
  merges: number;
  specs: readonly CorruptionWispSpec[];
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

type WispFrame = { x: number; y: number; width: number; height: number };

export type CorruptionWisps = {
  visible: boolean;
  /** The mission's target is gone while the layer lingers: standing wisps play their exit. */
  leaving: boolean;
  frame: WispFrame | null;
  specs: readonly CorruptionWispSpec[];
  states: readonly { hits: number; hp: number; alive: boolean }[];
  /** Bumps when a Glow strikes that wisp. */
  strikes: Readonly<Record<number, number>>;
  /** The Glow hook's aim: where the next burst goes, and what each landing does. */
  sink: GlowSink | null;
  /** The line under the tile right now, if one is showing. */
  caption: { id: number; text: string } | null;
};

/**
 * Owns the wisps over a misted tile: measures the tile, deals the clearing's
 * merges across the wisps in order, aims every Glow burst at the first wisp
 * still standing, shakes it on each token and counts one hit per merge. The
 * last wisp falls on the final merge's own item, the same landing that lifts
 * the mist. A board resumed part-way starts with the wisps its merges already
 * felled.
 */
export function useCorruptionWisps(target: CorruptionWispTarget | null): CorruptionWisps {
  const [frame, setFrame] = useState<WispFrame | null>(null);
  const [landed, setLanded] = useState(0);
  const [strikes, setStrikes] = useState<Record<number, number>>({});
  // Held from the mission's first frame until a beat after its last: the layer never unmounts in
  // between, so a wisp that fell stays gone through the mist's lift instead of replaying its death.
  const [held, setHeld] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const assignedRef = useRef(0);
  const keyRef = useRef<string | null>(null);
  const lastRef = useRef<{ specs: readonly CorruptionWispSpec[]; plan: number[] } | null>(null);
  const key = target?.key ?? null;
  const node = target?.node ?? null;
  const settled = target?.settled ?? true;
  // Whether the camera has been seen moving since the last measurement: a settle after motion is measured at once.
  const movedRef = useRef(false);
  useEffect(() => { if (!settled) movedRef.current = true; }, [settled]);
  const plan = useMemo(() => target ? wispHitPlan(target.required, target.specs.length) : lastRef.current?.plan ?? [], [target]);
  const specs = target?.specs ?? lastRef.current?.specs ?? [];
  if (target) lastRef.current = { specs: target.specs, plan };

  // A new mission: the wisps start where its merges already are; nothing is in flight yet.
  useEffect(() => {
    if (!key || !target) return;
    if (keyRef.current === key) return;
    keyRef.current = key;
    assignedRef.current = target.merges;
    setLanded(target.merges);
    setStrikes({});
  }, [key, target]);
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
    const timer = setTimeout(() => { setHeld(false); setLeaving(false); lastRef.current = null; keyRef.current = null; setFrame(null); }, LINGER_MS);
    return () => clearTimeout(timer);
  }, [target]);

  const shownFrame = frame;
  const states = useMemo(() => wispStates(plan, landed), [landed, plan]);
  // The wisps answer back: once on the first strike, once as each falls, once more for the last.
  const [caption, setCaption] = useState<{ id: number; text: string } | null>(null);
  const captionSeq = useRef(0);
  const spokenStrikeRef = useRef<string | null>(null);
  const fallenRef = useRef<number>(0);
  const struckCount = Object.values(strikes).reduce((sum, count) => sum + count, 0);
  const fallen = states.filter((wisp) => !wisp.alive).length;
  const lines = target?.lines ?? null;
  useEffect(() => {
    if (!key) { fallenRef.current = 0; spokenStrikeRef.current = null; return; }
    if (keyRef.current !== key) return;
    // Nothing to say for wisps already down when the board came back: the count starts where it is.
    if (fallenRef.current === 0 && fallen > 0 && struckCount === 0) { fallenRef.current = fallen; return; }
    let text: string | null = null;
    if (fallen > fallenRef.current) {
      fallenRef.current = fallen;
      text = lines ? wispLineForFall(lines, fallen, plan.length) : null;
    } else if (struckCount > 0 && spokenStrikeRef.current !== key) {
      spokenStrikeRef.current = key;
      text = lines?.firstStrike ?? null;
    }
    if (!text) return;
    setCaption({ id: ++captionSeq.current, text });
  }, [fallen, key, lines, plan.length, struckCount]);
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
    if (!target || !shownFrame || !plan.length) return null;
    const point = (index: number): RewardFlightPoint => {
      const spec = target.specs[index]!;
      return { x: shownFrame.x + spec.fx * shownFrame.width, y: shownFrame.y + spec.fy * shownFrame.height };
    };
    return {
      aim: (kind) => {
        // The finale strikes whichever wisp still stands; an ordinary burst takes the next hit in the deal.
        const index = kind === 'finale' ? wispTargetIndex(plan, Math.max(assignedRef.current, plan.reduce((sum, hp) => sum + hp, 0) - 1)) : wispTargetIndex(plan, assignedRef.current);
        if (index == null) return null;
        assignedRef.current += 1;
        return { point: point(index), key: index };
      },
      struck: (index) => setStrikes((current) => ({ ...current, [index]: (current[index] ?? 0) + 1 })),
      landed: () => setLanded((count) => count + 1),
    };
  }, [plan, shownFrame, target]);

  return {
    visible: Boolean(shownFrame && specs.length && (target || held)),
    leaving: !target && leaving,
    frame: shownFrame,
    specs,
    states,
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
  }, [screenRef, wisps.frame]);
  const frame = wisps.frame;
  if (!frame) return null;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.layer]}>
    {wisps.specs.map((spec, index) => <CorruptionWisp
      key={spec.id} index={index}
      x={frame.x + spec.fx * frame.width - origin.x} y={frame.y + spec.fy * frame.height - origin.y}
      size={Math.max(48, spec.size * frame.width)}
      alive={wisps.states[index]?.alive ?? true} leaving={wisps.leaving} strikeNonce={wisps.strikes[index] ?? 0} />)}
    {wisps.caption ? <Animated.View key={wisps.caption.id} entering={FadeInDown.duration(220)} exiting={FadeOut.duration(260)} pointerEvents="none"
      style={[styles.caption, { left: frame.x - origin.x, width: frame.width, top: frame.y + frame.height * 0.62 - origin.y }]}>
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
function CorruptionWisp({ index, x, y, size, alive, leaving, strikeNonce }: { index: number; x: number; y: number; size: number; alive: boolean; leaving: boolean; strikeNonce: number }) {
  const reduceMotion = useReducedMotion();
  const hover = useSharedValue(0);
  const shake = useSharedValue(0);
  const pulse = useSharedValue(0);
  const death = useSharedValue(0);
  const entrance = useSharedValue(0);
  // A wisp already felled when it mounts (a resumed board) was never here: no death to play.
  const [gone, setGone] = useState(() => !alive);
  useEffect(() => {
    if (reduceMotion) { entrance.value = 1; return; }
    const delay = index * ENTRANCE_STAGGER_MS;
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
  const rimStyle = useAnimatedStyle(() => ({
    opacity: (0.42 + pulse.value * 0.3) * (1 - death.value) * Math.min(1, entrance.value),
    transform: [{ scale: (1.55 + pulse.value * 0.12 + death.value * 0.5) * Math.max(0.2, Math.min(1, entrance.value)) }],
  }));
  if (gone) return null;
  return <View pointerEvents="none" style={[styles.wisp, { left: x - size / 2, top: y - size / 2, width: size, height: size }]}>
    <Animated.View style={[StyleSheet.absoluteFill, styles.rim, rimStyle]}>
      <Image accessibilityIgnoresInvertColors contentFit="contain" source={SOFT_GLOW} style={StyleSheet.absoluteFill} tintColor={RIM} transition={0} />
    </Animated.View>
    {!reduceMotion && alive ? EMBERS.map((ember, emberIndex) => <Ember key={emberIndex} ember={ember} size={size} />) : null}
    <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
      <Image accessibilityIgnoresInvertColors accessibilityLabel="A corruption wisp" contentFit="contain" source={WISP_ART} style={StyleSheet.absoluteFill} transition={0} />
    </Animated.View>
    {!alive ? <DeathBurst size={size} reduceMotion={reduceMotion} /> : null}
  </View>;
}

/** One ember: born low on the body, rising and fading, forever. Cheap: a tinted dot on the UI thread. */
function Ember({ ember, size }: { ember: (typeof EMBERS)[number]; size: number }) {
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
}

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
  caption: { position: 'absolute', alignItems: 'center', zIndex: 4 },
  captionText: { fontFamily: 'FredokaBold', fontSize: 17, color: '#FFF4D6', textAlign: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(38,18,58,0.72)', overflow: 'hidden' },
  wisp: { position: 'absolute', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  rim: { zIndex: 0 },
  ember: { position: 'absolute', zIndex: 1 },
  burst: { alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  mote: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: EMBER_DARK },
  moteLight: { width: 10, height: 10, borderRadius: 5, backgroundColor: EMBER_LIGHT },
});
