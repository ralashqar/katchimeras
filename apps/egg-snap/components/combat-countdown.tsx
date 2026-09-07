import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { createGameAudio } from '../game/audio';
import { Copy } from './ui';

const BEAT_MS = 800;

/** Formula Snap's 800ms count and oversized punch, on a separate pre-combat clock. */
export function CombatCountdown({paused, reduced, muted, haptics, onStart}: {
  paused: boolean; reduced: boolean; muted: boolean; haptics: boolean; onStart: () => void;
}) {
  const age = useSharedValue(0);
  const delivered = useSharedValue(-1);
  const [beat, setBeat] = useState(0);
  const audio = useMemo(createGameAudio, []);
  const start = useRef(onStart);
  start.current = onStart;
  useEffect(() => { audio.setEnabled(!muted && !paused); }, [audio, muted, paused]);
  useEffect(() => () => audio.dispose(), [audio]);
  const frameCallback = useFrameCallback(frame => {
    if (!paused && age.value < 2900) age.value += Math.min(80, frame.timeSincePreviousFrame ?? 0);
  });
  useEffect(() => {
    frameCallback.setActive(!paused && beat < 4);
    return () => frameCallback.setActive(false);
  }, [frameCallback, paused, beat]);
  const announce = (next: number) => {
    setBeat(next);
    if (next === 4) start.current();
    if (next > 3) return;
    audio.play((['count3', 'count2', 'count1', 'go'] as const)[next]);
    if (haptics) void Haptics.impactAsync(next === 3 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };
  useAnimatedReaction(() => paused ? -1 : age.value >= 2900 ? 4 : Math.floor(age.value / BEAT_MS), next => {
    if (next >= 0 && next > delivered.value) {
      delivered.value = next;
      runOnJS(announce)(next);
    }
  });
  const style = useAnimatedStyle(() => {
    const local = age.value < 2400 ? age.value % BEAT_MS : age.value - 2400;
    return {
      opacity: interpolate(local, [0, 100, 380, age.value < 2400 ? 800 : 500], [0, 1, 1, 0], 'clamp'),
      transform: [{scale: reduced ? 1 : interpolate(local, [0, 147, 252, 420], [2.6, 1.06, .94, 1], 'clamp')}],
    };
  });
  if (paused || beat > 3) return null;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, {bottom: '20%', justifyContent: 'center', alignItems: 'center', overflow: 'visible'}]}>
    <Animated.View style={[{overflow: 'visible'}, style]}>
      <Copy accessibilityRole="text" accessibilityLiveRegion="assertive" style={{fontFamily: 'EggDisplay', fontSize: beat === 3 ? 108 : 150,
        lineHeight: 190, paddingHorizontal: 28, paddingVertical: 28, overflow: 'visible',
        textAlign: 'center', color: beat === 3 ? '#DFFFAC' : '#FFF0BA',
        textShadowColor: '#19301D', textShadowRadius: 12, textShadowOffset: {width: 0, height: 5}}}>
        {beat === 3 ? 'GO!' : 3 - beat}
      </Copy>
    </Animated.View>
  </View>;
}
