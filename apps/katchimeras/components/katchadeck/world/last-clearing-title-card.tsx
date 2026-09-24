import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { FTUE_SCENE_LAYERS } from '@/constants/ftue-scene-layers';
import { KatchaUI } from '@/constants/katcha-ui';

const CARD_IN_MS = 1_100;
const LINE_DELAY_MS = 900;
const HINT_DELAY_MS = 2_200;
const CARD_OUT_MS = 650;

/**
 * A Last Clearing title card (`docs/cozy-4x-ftue-the-last-clearing.md`: SANCTUARY FOUNDED, and later THE FIRST
 * GROVE): the world dims a little, a big serif title breathes in over it, then the friend's line under it. A tap
 * once the line is up fades the card away and `onContinue` hands the story on.
 */
export function LastClearingTitleCard({ eyebrow, title, line, onContinue }: { eyebrow?: string; title: string; line?: string; onContinue: () => void }) {
  const reduceMotion = useReducedMotion();
  const card = useSharedValue(0);
  const lineIn = useSharedValue(0);
  const hint = useSharedValue(0);
  const [ready, setReady] = useState(false);
  const leavingRef = useRef(false);
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;

  useEffect(() => {
    const scale = reduceMotion ? 0.2 : 1;
    card.value = withTiming(1, { duration: CARD_IN_MS * scale, easing: Easing.out(Easing.cubic) });
    lineIn.value = withDelay(LINE_DELAY_MS * scale, withTiming(1, { duration: 700 * scale, easing: Easing.out(Easing.quad) }));
    hint.value = withDelay(HINT_DELAY_MS * scale, withTiming(1, { duration: 500 * scale }));
    const timer = setTimeout(() => setReady(true), LINE_DELAY_MS * scale);
    return () => clearTimeout(timer);
  }, [card, hint, lineIn, reduceMotion]);

  const leave = () => {
    if (!ready || leavingRef.current) return;
    leavingRef.current = true;
    const ms = reduceMotion ? 150 : CARD_OUT_MS;
    card.value = withTiming(0, { duration: ms, easing: Easing.in(Easing.quad) });
    setTimeout(() => onContinueRef.current(), ms);
  };

  const dimStyle = useAnimatedStyle(() => ({ opacity: card.value }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: card.value, transform: [{ scale: 0.94 + card.value * 0.06 }] }));
  const lineStyle = useAnimatedStyle(() => ({ opacity: lineIn.value * card.value, transform: [{ translateY: (1 - lineIn.value) * 8 }] }));
  const hintStyle = useAnimatedStyle(() => ({ opacity: hint.value * card.value }));
  return <View style={[StyleSheet.absoluteFill, styles.layer]}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim, dimStyle]} />
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${line ?? ''}`} accessibilityHint="Continues" onPress={leave} style={styles.press}>
      <Animated.View style={[styles.titleBlock, titleStyle]}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <View style={styles.rule} />
        <Text style={styles.title}>{title.toUpperCase()}</Text>
        <View style={styles.rule} />
      </Animated.View>
      {line ? <Animated.View style={lineStyle}><Text style={styles.line}>“{line}”</Text></Animated.View> : null}
      <Animated.Text style={[styles.hint, hintStyle]}>Tap to continue</Animated.Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  layer: { zIndex: FTUE_SCENE_LAYERS.hero + 5 },
  dim: { backgroundColor: 'rgba(12,10,26,0.52)' },
  press: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 22 },
  titleBlock: { alignItems: 'center', gap: 12 },
  eyebrow: { ...KatchaUI.type.label, color: '#FFE7A8' },
  rule: { width: 120, height: StyleSheet.hairlineWidth * 2, backgroundColor: 'rgba(255,231,168,0.7)' },
  title: { ...KatchaUI.type.display, color: '#FFF8E6', fontSize: 40, lineHeight: 46, letterSpacing: 2, textAlign: 'center', textShadowColor: 'rgba(255,196,92,0.65)', textShadowRadius: 18 },
  line: { ...KatchaUI.type.body, color: '#F3EEFF', fontSize: 16, lineHeight: 23, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 6 },
  hint: { ...KatchaUI.type.label, color: 'rgba(243,238,255,0.72)', position: 'absolute', bottom: 64 },
});
