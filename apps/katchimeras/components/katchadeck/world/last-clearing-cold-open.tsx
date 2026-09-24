import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { FTUE_SCENE_LAYERS } from '@/constants/ftue-scene-layers';
import { KatchaUI } from '@/constants/katcha-ui';
import { COLD_OPEN_LINES } from '@/features/onboarding/last-clearing';

/** Each lore line: in, held, out. Then the dark lifts off the world beneath. */
const LINE_IN_MS = 900;
const LINE_HOLD_MS = 1_900;
const LINE_OUT_MS = 700;
const DARK_OUT_MS = 1_600;

/**
 * The cold open (`docs/cozy-4x-ftue-the-last-clearing.md`, beat 1): black, and the lore one line at a time, white on
 * the dark. Then the dark lifts off the misted world, where the camera is already sinking toward the last lit
 * clearing, and `onDone` hands the story on. A tap moves to the next line sooner.
 */
export function LastClearingColdOpen({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotion();
  const [line, setLine] = useState(0);
  const [lifting, setLifting] = useState(false);
  const lineOpacity = useSharedValue(0);
  const dark = useSharedValue(1);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const doneRef = useRef(false);

  useEffect(() => {
    if (lifting) return;
    const inMs = reduceMotion ? 120 : LINE_IN_MS;
    const outMs = reduceMotion ? 120 : LINE_OUT_MS;
    lineOpacity.value = 0;
    lineOpacity.value = withTiming(1, { duration: inMs, easing: Easing.out(Easing.quad) });
    const out = setTimeout(() => { lineOpacity.value = withTiming(0, { duration: outMs, easing: Easing.in(Easing.quad) }); }, inMs + LINE_HOLD_MS);
    const next = setTimeout(() => advance(), inMs + LINE_HOLD_MS + outMs);
    return () => { clearTimeout(out); clearTimeout(next); };
  // One run per line.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, lifting]);

  useEffect(() => {
    if (!lifting) return;
    dark.value = withTiming(0, { duration: reduceMotion ? 200 : DARK_OUT_MS, easing: Easing.inOut(Easing.cubic) });
    const timer = setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDoneRef.current();
    }, reduceMotion ? 200 : DARK_OUT_MS);
    return () => clearTimeout(timer);
  }, [dark, lifting, reduceMotion]);

  function advance() {
    if (lifting) return;
    if (line + 1 < COLD_OPEN_LINES.length) setLine(line + 1);
    else setLifting(true);
  }

  const darkStyle = useAnimatedStyle(() => ({ opacity: dark.value }));
  const lineStyle = useAnimatedStyle(() => ({ opacity: lineOpacity.value, transform: [{ translateY: (1 - lineOpacity.value) * 6 }] }));
  return <Animated.View pointerEvents={lifting ? 'none' : 'auto'} style={[StyleSheet.absoluteFill, styles.dark, darkStyle]}>
    <Pressable accessibilityRole="text" accessibilityLabel={COLD_OPEN_LINES[line]} accessibilityHint="Shows the next line" onPress={advance} style={styles.press}>
      {!lifting ? <Animated.View style={lineStyle}><Text style={styles.line}>{COLD_OPEN_LINES[line]}</Text></Animated.View> : null}
    </Pressable>
  </Animated.View>;
}

const styles = StyleSheet.create({
  dark: { backgroundColor: '#07060F', zIndex: FTUE_SCENE_LAYERS.hero + 5 },
  press: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  line: { ...KatchaUI.type.companionCardTitle, color: '#F3EEFF', fontSize: 24, lineHeight: 32, textAlign: 'center', textShadowColor: 'rgba(160,120,255,0.55)', textShadowRadius: 12 },
});
