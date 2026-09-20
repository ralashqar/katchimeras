import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { RotatingRadialSunburst } from '@/components/katchadeck/ui/radial-sunburst';
import { eggHatchRattle, eggHatchPulse, EGG_HATCH_SHAKE_X, EGG_HATCH_SHAKE_ROTATION } from '@/components/katchadeck/ui/egg-hatch-motion';
import { createEggHatchHaptics } from '@/features/today/egg-haptics';
import { HATCH_PHASE_DELAYS_MS, REDUCED_HATCH_PHASE_DELAYS_MS } from '@/utils/hatch-reveal-timing';
import { WISP_CARD_ART } from '@/constants/wisp-card-art';
import { WISP_PACK_HANDOFF_MS, WISP_PACK_HANDOFF_SCALE } from './wisp-pack-handoff';

/** Reward-overlay artwork. Only the motion and haptics come from the Egg hatch. */
export function WispPackAnticipation({ opening, onDone, size = 310 }: { opening: boolean; onDone: () => void; size?: number }) {
  const reduced = useReducedMotion();
  const shake = useSharedValue(0);
  const pulse = useSharedValue(0);
  const exit = useSharedValue(0);
  const done = useRef(onDone); done.current = onDone;
  useEffect(() => {
    shake.value = 0; pulse.value = 0; exit.value = 0;
    if (!opening) return;
    const timing = reduced ? REDUCED_HATCH_PHASE_DELAYS_MS : HATCH_PHASE_DELAYS_MS;
    const haptics = createEggHatchHaptics(reduced);
    // Cracking advances tactile feedback without interrupting the continuous rattle.
    shake.value = reduced ? 0 : eggHatchRattle();
    pulse.value = eggHatchPulse(reduced);
    const timers = [
      setTimeout(() => haptics.advance('shaking'), timing.shaking),
      setTimeout(() => haptics.advance('cracking'), timing.cracking),
      setTimeout(() => {
        haptics.advance('crossfading_subject');
        cancelAnimation(shake); cancelAnimation(pulse);
        shake.value = withTiming(0, { duration: 80 });
        pulse.value = 0;
        // The pack starts to shrink here and the card page carries the shrink on: it never fades or snaps away.
        exit.value = withTiming(1, { duration: reduced ? 80 : WISP_PACK_HANDOFF_MS, easing: Easing.in(Easing.quad) });
      }, timing.crossfadingSubject),
      setTimeout(() => { haptics.advance('subject_settling'); done.current(); }, timing.crossfadingSubject + (reduced ? 80 : WISP_PACK_HANDOFF_MS)),
    ];
    return () => {
      timers.forEach(clearTimeout); haptics.stop();
      cancelAnimation(shake); cancelAnimation(pulse); cancelAnimation(exit);
    };
  }, [exit, opening, pulse, reduced, shake]);
  const packStyle = useAnimatedStyle(() => ({
    // Reduced motion has no card page animation to hand over to, so there the pack simply fades.
    opacity: reduced ? 1 - exit.value : 1,
    transform: [{ translateX: shake.value * EGG_HATCH_SHAKE_X }, { rotateZ: `${shake.value * EGG_HATCH_SHAKE_ROTATION}deg` }, { scale: reduced ? 1 : 1 - exit.value * (1 - WISP_PACK_HANDOFF_SCALE) }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: (0.35 + pulse.value * 0.5) * (1 - exit.value), transform: [{ scale: 0.8 + pulse.value * 0.3 }] }));
  return <View pointerEvents="none" accessibilityLiveRegion="polite" accessibilityLabel={opening ? 'Opening Wisp card pack' : 'Sealed Wisp card pack'} style={[styles.stage, { width: size, height: size }]}>
    {opening ? <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}><RotatingRadialSunburst size={size} baseOpacity={0.8} /></Animated.View> : null}
    <Animated.View style={packStyle}><Image source={WISP_CARD_ART.pack} contentFit="contain" style={{ width: size * 190 / 310, height: size * 285 / 310 }} transition={0} /></Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center' },
});
