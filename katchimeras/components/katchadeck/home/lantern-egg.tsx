import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { EggShell } from '@/components/katchadeck/home/egg-shell';
import type { EggVisualState } from '@/types/home';

type LanternEggProps = {
  egg: EggVisualState;
  onPress?: () => void;
  reactionKey?: number;
  crackStage?: 0 | 1 | 2;
};

// The Lantern egg stage: the egg artwork alone, on the same 258px stage as
// the creature hero so day-flipping keeps the subject in one spot. Tapping
// squeezes the shell and sends two expanding ripple rings out from it - the
// membrane feel, without the legacy static ring or particles.
export function LanternEgg({ egg, onPress, reactionKey = 0, crackStage = 0 }: LanternEggProps) {
  const pressProgress = useSharedValue(0);
  const ripple = useSharedValue(1);
  const rippleEcho = useSharedValue(1);
  const rest = {
    dragX: useSharedValue(0),
    dragY: useSharedValue(0),
    pressProgress,
    releaseVelocity: useSharedValue(0),
    interactionEnergy: useSharedValue(0),
    glowLagX: useSharedValue(0),
    glowLagY: useSharedValue(0),
  };

  const handlePressIn = () => {
    pressProgress.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) });
  };

  const handlePressOut = () => {
    pressProgress.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
  };

  const handlePress = () => {
    ripple.value = 0;
    ripple.value = withTiming(1, { duration: 680, easing: Easing.out(Easing.cubic) });
    rippleEcho.value = 0;
    rippleEcho.value = withDelay(120, withTiming(1, { duration: 680, easing: Easing.out(Easing.cubic) }));
    onPress?.();
  };

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: (1 - ripple.value) * 0.5,
    transform: [{ scale: 0.62 + ripple.value * 0.85 }],
  }));

  const rippleEchoStyle = useAnimatedStyle(() => ({
    opacity: (1 - rippleEcho.value) * 0.32,
    transform: [{ scale: 0.55 + rippleEcho.value * 1.0 }],
  }));

  return (
    <Pressable onPress={handlePress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={styles.stage}>
      <Animated.View pointerEvents="none" style={[styles.ripple, { borderColor: egg.accentColor }, rippleStyle]} />
      <Animated.View pointerEvents="none" style={[styles.ripple, { borderColor: egg.coreColor }, rippleEchoStyle]} />
      <Animated.View style={styles.lift}>
        <EggShell crackStage={crackStage} egg={egg} motion={rest} reactionKey={reactionKey} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    height: 258,
    justifyContent: 'center',
    width: '100%',
  },
  ripple: {
    borderRadius: 999,
    borderWidth: 1.5,
    height: 230,
    position: 'absolute',
    top: 2,
    width: 230,
  },
  lift: {
    transform: [{ translateY: -10 }, { scale: 1.08 }],
  },
});
