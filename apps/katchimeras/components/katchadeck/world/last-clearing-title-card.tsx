import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { FTUE_SCENE_LAYERS } from '@/constants/ftue-scene-layers';
import { KatchaUI } from '@/constants/katcha-ui';

const CARD_IN_MS = 1_100;
const LINE_DELAY_MS = 900;
/** Each further line of the friend's arrives this long after the one before. */
const LINE_STEP_MS = 1_500;
const HINT_AFTER_LAST_MS = 1_100;
const CARD_OUT_MS = 650;

type Placement = 'center' | 'top';

/**
 * A Last Clearing title card (`docs/cozy-4x-ftue-the-last-clearing.md`: SANCTUARY FOUNDED, THE FIRST GROVE, FOLLOW
 * THE LOST TRAIL): the world dims a little, a big serif title breathes in over it, then the friend's lines under it,
 * one after another. A tap once the first line is up fades the card away and `onContinue` hands the story on.
 * `top` keeps the card high and the dim light, for a card over a view the player should keep seeing (the frontier).
 */
export function LastClearingTitleCard({ eyebrow, title, line, lines, placement = 'center', onContinue }: {
  eyebrow?: string;
  title: string;
  line?: string;
  lines?: readonly string[];
  placement?: Placement;
  onContinue: () => void;
}) {
  const said = lines ?? (line ? [line] : []);
  const reduceMotion = useReducedMotion();
  const card = useSharedValue(0);
  const hint = useSharedValue(0);
  const [ready, setReady] = useState(false);
  const leavingRef = useRef(false);
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;
  const scale = reduceMotion ? 0.2 : 1;

  useEffect(() => {
    card.value = withTiming(1, { duration: CARD_IN_MS * scale, easing: Easing.out(Easing.cubic) });
    const lastLineAt = LINE_DELAY_MS + Math.max(0, said.length - 1) * LINE_STEP_MS;
    hint.value = withDelay((lastLineAt + HINT_AFTER_LAST_MS) * scale, withTiming(1, { duration: 500 * scale }));
    const timer = setTimeout(() => setReady(true), LINE_DELAY_MS * scale);
    return () => clearTimeout(timer);
  // One entrance per card.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = () => {
    if (!ready || leavingRef.current) return;
    leavingRef.current = true;
    const ms = reduceMotion ? 150 : CARD_OUT_MS;
    card.value = withTiming(0, { duration: ms, easing: Easing.in(Easing.quad) });
    setTimeout(() => onContinueRef.current(), ms);
  };

  const top = placement === 'top';
  const dimStyle = useAnimatedStyle(() => ({ opacity: card.value }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: card.value, transform: [{ scale: 0.94 + card.value * 0.06 }] }));
  const hintStyle = useAnimatedStyle(() => ({ opacity: hint.value * card.value }));
  return <View style={[StyleSheet.absoluteFill, styles.layer]}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, top ? styles.dimLight : styles.dim, dimStyle]} />
    <Pressable accessibilityRole="button" accessibilityLabel={[title, ...said].join('. ')} accessibilityHint="Continues" onPress={leave}
      style={[styles.press, top ? styles.pressTop : null]}>
      <Animated.View style={[styles.titleBlock, titleStyle]}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <View style={styles.rule} />
        <Text style={styles.title}>{title.toUpperCase()}</Text>
        <View style={styles.rule} />
      </Animated.View>
      {said.map((text, index) => <SaidLine key={`${index}:${text}`} card={card} delayMs={(LINE_DELAY_MS + index * LINE_STEP_MS) * scale} durationMs={700 * scale} text={text} />)}
      <Animated.Text style={[styles.hint, hintStyle]}>Tap to continue</Animated.Text>
    </Pressable>
  </View>;
}

function SaidLine({ card, delayMs, durationMs, text }: { card: { value: number }; delayMs: number; durationMs: number; text: string }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = withDelay(delayMs, withTiming(1, { duration: durationMs, easing: Easing.out(Easing.quad) }));
  }, [delayMs, durationMs, shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value * card.value, transform: [{ translateY: (1 - shown.value) * 8 }] }));
  return <Animated.View style={style}><Text style={styles.line}>“{text}”</Text></Animated.View>;
}

const styles = StyleSheet.create({
  layer: { zIndex: FTUE_SCENE_LAYERS.hero + 5 },
  dim: { backgroundColor: 'rgba(12,10,26,0.52)' },
  dimLight: { backgroundColor: 'rgba(12,10,26,0.22)' },
  press: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 18 },
  pressTop: { justifyContent: 'flex-start', paddingTop: 96 },
  titleBlock: { alignItems: 'center', gap: 12, marginBottom: 4 },
  eyebrow: { ...KatchaUI.type.label, color: '#FFE7A8' },
  rule: { width: 120, height: StyleSheet.hairlineWidth * 2, backgroundColor: 'rgba(255,231,168,0.7)' },
  title: { ...KatchaUI.type.display, color: '#FFF8E6', fontSize: 40, lineHeight: 46, letterSpacing: 2, textAlign: 'center', textShadowColor: 'rgba(255,196,92,0.65)', textShadowRadius: 18 },
  line: { ...KatchaUI.type.body, color: '#F3EEFF', fontSize: 16, lineHeight: 23, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 6 },
  hint: { ...KatchaUI.type.label, color: 'rgba(243,238,255,0.72)', position: 'absolute', bottom: 64 },
});
