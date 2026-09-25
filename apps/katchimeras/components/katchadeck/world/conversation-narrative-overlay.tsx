import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, { Easing, FadeIn, FadeOut, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { getCreatureVisual } from '@/game/days/visuals';
import type { ConversationTranscriptEntry } from '@/types/companion-conversation';

/**
 * How long a line used to stay before the next arrived on its own. Kept for callers that time other beats by it; the
 * dialogue itself no longer moves on by itself (one line at a time, a tap for the next).
 */
export function narrativeReadingDelayMs(text: string): number {
  return Math.min(3200, Math.max(1300, 800 + text.length * 20));
}

/**
 * Which lines a batched transcript update may show at once. A session commit can append the player's answer, the reply
 * to it and the next prompt in one go. The answer and its reply are one moment; a further prompt earns its own tap.
 */
export function narrativeAdmittedCount(
  previousIds: readonly string[],
  entries: readonly Pick<ConversationTranscriptEntry, 'id' | 'speaker'>[],
  currentRevealStep: number,
): number {
  const previousVisibleCount = Math.min(currentRevealStep, previousIds.length);
  let retained = 0;
  while (retained < previousVisibleCount && previousIds[retained] === entries[retained]?.id) retained += 1;
  const answer = entries[retained];
  const reply = entries[retained + 1];
  const admitted = answer?.speaker === 'player' && reply && reply.speaker !== 'player' ? retained + 2 : retained + 1;
  return Math.min(entries.length, admitted);
}

const INK = '#1F2733';
const CARD = '#FBF8EF';
const TAG = '#4F9D89';
const TAG_EDGE = '#3B7F6E';
const ENTER_MS = 300;
const EXIT_MS = 220;

type Side = 'left' | 'right';

/** The speakers who stand on stage: the first to speak on the left, the second on the right. The player has no figure. */
function castOf(entries: readonly ConversationTranscriptEntry[]) {
  const order: string[] = [];
  const firstLine = new Map<string, number>();
  entries.forEach((entry, index) => {
    if (entry.speaker === 'player' || order.includes(entry.speaker) || order.length >= 2) return;
    order.push(entry.speaker);
    firstLine.set(entry.speaker, index);
  });
  return { left: order[0] ?? null, right: order[1] ?? null, firstLine };
}

/**
 * The story's dialogue (Sept 2026, after Foundation: Galactic Frontier): the world dims, the speakers stand at the
 * bottom of the screen (the first on the left, a second on the right), and one line at a time sits in a cream card
 * fixed under them, with the speaker's name on a tag at their side of the card. A tap anywhere shows the next line;
 * the caller's buttons (a choice, "Continue") come into the card with the last. Everything eases in and out: nothing
 * snaps. Presentation only: callers keep ownership of saves, handoffs and rewards.
 */
export function ConversationNarrativeOverlay({ title, entries, checkpoint, required = false, inline = false, paced = false, initiallyRevealedCount = 0, onClose, children }: {
  title: string; entries: readonly ConversationTranscriptEntry[]; checkpoint: string;
  required?: boolean; inline?: boolean; paced?: boolean; initiallyRevealedCount?: number; onClose: () => void;
  children: (perform: (action: () => unknown, exit?: boolean) => void) => ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const window = useWindowDimensions();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(true);
  // One line at a time. A paced story opens on its first line; a transcript opened midway, on its latest.
  const [line, setLine] = useState(() => Math.max(0, Math.min(entries.length - 1, paced ? initiallyRevealedCount : entries.length - 1)));
  const priorEntryIds = useRef(entries.map((entry) => entry.id));
  const afterDismiss = useRef<(() => void) | null>(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entrance = useSharedValue(0);
  useEffect(() => {
    mounted.current = true;
    entrance.value = withTiming(1, { duration: reduced ? 120 : ENTER_MS, easing: Easing.out(Easing.cubic) });
    return () => { mounted.current = false; if (timer.current) clearTimeout(timer.current); };
  }, [entrance, reduced]);
  useEffect(() => { locked.current = false; setBusy(false); }, [checkpoint]);
  // New lines (an answer and its reply): the next unseen line comes up; the rest wait for taps.
  useEffect(() => {
    const nextIds = entries.map((entry) => entry.id);
    const previousIds = priorEntryIds.current;
    priorEntryIds.current = nextIds;
    if (previousIds.length === nextIds.length && previousIds.every((id, index) => id === nextIds[index])) return;
    let kept = 0;
    while (kept < previousIds.length && previousIds[kept] === nextIds[kept]) kept += 1;
    setLine(Math.max(0, Math.min(nextIds.length - 1, kept)));
  }, [entries]);
  useEffect(() => {
    if (!visible && afterDismiss.current) {
      const complete = afterDismiss.current;
      afterDismiss.current = null;
      complete();
    }
  }, [visible]);

  const atEnd = line >= entries.length - 1;
  const current = entries[Math.min(line, entries.length - 1)] ?? null;
  const advance = useCallback(() => { if (!atEnd && !busy) setLine((value) => Math.min(entries.length - 1, value + 1)); }, [atEnd, busy, entries.length]);
  const perform = (action: () => unknown, exit = false) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(false);
    const execute = async () => {
      try { await action(); }
      catch {
        if (mounted.current) { setError(true); setVisible(true); entrance.value = withTiming(1, { duration: 160 }); }
      } finally {
        if (mounted.current) { locked.current = false; setBusy(false); }
      }
    };
    if (exit) {
      entrance.value = withTiming(0, { duration: reduced ? 90 : EXIT_MS, easing: Easing.in(Easing.cubic) });
      afterDismiss.current = () => { void execute(); };
      timer.current = setTimeout(() => { setVisible(false); }, reduced ? 90 : EXIT_MS);
    } else void execute();
  };
  const dismiss = () => { if (!required) perform(onClose, true); };

  const cast = useMemo(() => castOf(entries), [entries]);
  const speaker = current?.speaker ?? null;
  const side: Side = speaker && speaker === cast.right ? 'right' : speaker === 'player' ? 'right' : 'left';
  const name = speaker === 'player' ? 'You' : (speaker ? katchimeraSkinById.get(speaker)?.displayName : null) ?? title;

  const scrim = useAnimatedStyle(() => ({ opacity: entrance.value }));
  const card = useAnimatedStyle(() => ({ opacity: entrance.value, transform: [{ translateY: (1 - entrance.value) * 36 }] }));

  if (inline) return visible ? <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: insets.bottom + 16 }}>
    <Animated.View style={card}>
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>Could not save. Please try again.</Text> : null}
      <View pointerEvents={busy ? 'none' : 'auto'}>{children(perform)}</View>
    </Animated.View>
  </View> : null;

  const figure = Math.min(window.width * 0.44, 220);
  const showControls = atEnd;
  return <Modal transparent visible={visible} statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={dismiss}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, scrim]} />
    {/* A tap anywhere shows the next line (until the last, where the card's buttons take over). */}
    <Pressable accessibilityRole="button" accessibilityLabel="Next line" accessibilityHint="Shows the next line of the conversation"
      disabled={atEnd || busy} onPress={advance} style={StyleSheet.absoluteFill} />
    <View pointerEvents="box-none" accessibilityViewIsModal onAccessibilityEscape={dismiss} style={styles.stage}>
      <View pointerEvents="none" style={[styles.cast, { height: figure }]}>
        {cast.left ? <CastFigure key={`cast:${cast.left}`} speaker={cast.left} side="left" size={figure} shown={(cast.firstLine.get(cast.left) ?? 0) <= line} active={speaker === cast.left} entrance={entrance} reduced={reduced} /> : null}
        {cast.right ? <CastFigure key={`cast:${cast.right}`} speaker={cast.right} side="right" size={figure} shown={(cast.firstLine.get(cast.right) ?? 0) <= line} active={speaker === cast.right} entrance={entrance} reduced={reduced} /> : null}
      </View>
      <Animated.View style={[styles.cardWrap, { marginBottom: insets.bottom + 14 }, card]}>
        <Pressable accessibilityLabel={`${name}: ${current?.text ?? ''}`} disabled={atEnd || busy} onPress={advance} style={styles.card}>
          <Animated.View key={`tag:${side}:${name}`} entering={reduced ? undefined : FadeIn.duration(200)} exiting={reduced ? undefined : FadeOut.duration(140)}
            style={[styles.tag, side === 'right' ? styles.tagRight : styles.tagLeft]}>
            <Text numberOfLines={1} style={styles.tagText}>{name}</Text>
          </Animated.View>
          {!required ? <Pressable disabled={busy} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close conversation and keep my place" onPress={dismiss} style={styles.close}>
            <Text style={styles.closeText}>×</Text>
          </Pressable> : null}
          {current ? <Animated.Text key={`line:${current.id}`} entering={reduced ? undefined : FadeIn.duration(220)} style={styles.text}>{current.text}</Animated.Text> : null}
          {showControls ? <Animated.View key={`controls:${checkpoint}`} entering={reduced ? undefined : FadeIn.duration(220).delay(120)} pointerEvents={busy ? 'none' : 'auto'} style={styles.controls}>
            {children(perform)}
          </Animated.View> : <NextChevron reduced={reduced} />}
          {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>Could not save. Please try again.</Text> : null}
        </Pressable>
      </Animated.View>
    </View>
  </Modal>;
}

/**
 * A speaker standing behind the card: they slide in from their side the first time they speak, and stay. Whoever is
 * speaking is at full light; the one listening steps back a little (dimmer, a touch smaller). Eased, never sprung.
 */
function CastFigure({ speaker, side, size, shown, active, entrance, reduced }: {
  speaker: string; side: Side; size: number; shown: boolean; active: boolean;
  entrance: import('react-native-reanimated').SharedValue<number>; reduced: boolean;
}) {
  const skin = katchimeraSkinById.get(speaker);
  const source = skin?.visualKey ? getCreatureVisual(skin.visualKey, 'grown').source : null;
  const appear = useSharedValue(0);
  const light = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    appear.value = withTiming(shown ? 1 : 0, { duration: reduced ? 100 : 340, easing: Easing.out(Easing.cubic) });
  }, [appear, reduced, shown]);
  useEffect(() => {
    light.value = withTiming(active ? 1 : 0, { duration: reduced ? 80 : 220, easing: Easing.inOut(Easing.cubic) });
  }, [active, light, reduced]);
  const style = useAnimatedStyle(() => ({
    opacity: appear.value * entrance.value * (0.62 + light.value * 0.38),
    transform: [
      { translateX: (1 - appear.value) * (side === 'left' ? -48 : 48) + (1 - entrance.value) * (side === 'left' ? -24 : 24) },
      { scale: 0.94 + light.value * 0.06 },
    ],
  }));
  if (!source) return null;
  return <Animated.View style={[styles.figure, side === 'left' ? styles.figureLeft : styles.figureRight, { width: size, height: size }, style]}>
    <Image source={source} style={{ width: size, height: size }} contentFit="contain" transition={0} accessible={false} />
  </Animated.View>;
}

/** The "next" mark: a double chevron in the card's corner, drifting down and back. */
function NextChevron({ reduced }: { reduced: boolean }) {
  const drift = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    drift.value = withRepeat(withSequence(withTiming(1, { duration: 620, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 620, easing: Easing.inOut(Easing.sin) })), -1, false);
    return () => cancelAnimation(drift);
  }, [drift, reduced]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: drift.value * 4 }] }));
  return <Animated.View pointerEvents="none" style={[styles.chevron, style]}>
    <IconSymbol name="chevron.down" size={26} color={TAG} />
    <View style={{ marginTop: -16 }}><IconSymbol name="chevron.down" size={26} color={TAG} /></View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(8,10,24,0.46)' },
  stage: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  cast: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: -30, paddingHorizontal: 10 },
  figure: { position: 'absolute', bottom: 0 },
  figureLeft: { left: 8 },
  figureRight: { right: 8 },
  cardWrap: { marginHorizontal: 16 },
  card: {
    minHeight: 158, borderRadius: 18, borderCurve: 'continuous', backgroundColor: CARD,
    borderWidth: 1.5, borderColor: '#ECE4D3', paddingTop: 30, paddingBottom: 20, paddingHorizontal: 24,
    boxShadow: '0 10px 28px rgba(10,14,30,0.28)',
  },
  tag: {
    position: 'absolute', top: -20, maxWidth: '72%', paddingHorizontal: 22, paddingVertical: 7,
    backgroundColor: TAG, borderRadius: 7, borderBottomWidth: 3, borderBottomColor: TAG_EDGE, transform: [{ skewX: '-8deg' }],
  },
  tagLeft: { left: 20 },
  tagRight: { right: 20 },
  tagText: { color: '#FFFFFF', fontFamily: AppFontFamilies.fredokaBold, fontSize: 18, letterSpacing: 1, textTransform: 'uppercase', transform: [{ skewX: '8deg' }] },
  close: { position: 'absolute', top: 6, right: 12, zIndex: 2 },
  closeText: { color: '#8C8576', fontSize: 24, fontWeight: '700' },
  text: { color: INK, fontFamily: AppFontFamilies.manrope, fontSize: 20, lineHeight: 29, fontWeight: '600' },
  controls: { marginTop: 16, gap: 10 },
  chevron: { position: 'absolute', right: 18, bottom: 10, alignItems: 'center' },
  error: { color: '#C4513B', fontSize: 14, marginTop: 8, textAlign: 'center' },
});
