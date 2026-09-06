import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { EggShell } from '@/components/katchadeck/home/egg-shell';
import type { EggVisualState } from '@/types/home';

type LanternEggProps = {
  egg: EggVisualState;
  highResolution?: boolean;
  onPress?: () => void;
  reactionKey?: number;
  crackStage?: 0 | 1 | 2;
  // Ready to hatch: the shell gives an impatient shudder every few seconds
  // (same burst the world patch egg had) to invite the tap.
  isReady?: boolean;
  // Bumps each time the egg is "fed" an answer; fires an absorb pulse — a glow
  // flash, a swallow-pop of the shell, and an outward energy ring.
  feedKey?: number;
  // Optional cosmetic override for the halo glow tint (a Discovery-unlocked lantern
  // colour). Absent → the egg keeps its natural day colour. Purely cosmetic.
  lanternColor?: string;
  // Shrinks/grows the whole stage (glow, dome, shell) around its centre; the
  // stage's layout height shrinks with it so surrounding content stays tight.
  scale?: number;
  // Shifts the whole stage vertically (dp; negative = up) without affecting layout.
  offsetY?: number;
  // Membrane (glass dome + ripple rings) transform RELATIVE to the egg stage —
  // scale around centre and vertical shift, for seating the glass on the art.
  membraneScale?: number;
  membraneOffsetY?: number;
  // Scales ONLY the egg shell graphic, leaving the glow/dome/membrane at their
  // stage size — for when the egg reads too large inside the glass.
  shellScale?: number;
  // Vertical lift of the shell inside the dome/membrane (negative = up). The
  // default centres it; a smaller magnitude sits the egg lower in the glass.
  shellOffsetY?: number;
  // World/kingdom displays can render the egg like a passive object: no drag/tap
  // membrane interaction, and optionally no glass/ripple membrane art.
  interactive?: boolean;
  showMembrane?: boolean;
  showGlow?: boolean;
};

const softGlow = require('@incubator/art-characters/soft-glow.png');
const softRing = require('@incubator/art-characters/soft-ring.png');
const glassDome = require('@incubator/art-characters/glass-dome.png');

const AnimatedImage = Animated.createAnimatedComponent(Image);
const DRAG_LIMIT = 60;


// The Lantern egg stage. The egg artwork breathes over a pulsing tinted glow;
// tapping squeezes it and sends ripple rings out; dragging pulls it against a
// soft membrane ring that materializes under the finger and springs the shell
// back on release. (Feathered glow/ring are generated textures - RN views
// can't blur, so softness is baked into the asset and tinted per day.)
export function LanternEgg({
  egg,
  highResolution = false,
  onPress,
  reactionKey = 0,
  crackStage = 0,
  isReady = false,
  feedKey = 0,
  lanternColor,
  scale = 1,
  offsetY = 0,
  membraneScale = 1,
  membraneOffsetY = 0,
  shellScale = 1,
  shellOffsetY = -26,
  interactive = true,
  showMembrane = true,
  showGlow = true,
}: LanternEggProps) {
  const pressProgress = useSharedValue(0);
  const ripple = useSharedValue(1);
  const rippleEcho = useSharedValue(1);
  const pulse = useSharedValue(0);
  const absorb = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const interactionEnergy = useSharedValue(0);
  const motion = {
    dragX,
    dragY,
    pressProgress,
    releaseVelocity: useSharedValue(0),
    interactionEnergy,
    glowLagX: useSharedValue(0),
    glowLagY: useSharedValue(0),
  };

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const fireRipple = () => {
    ripple.value = 0;
    ripple.value = withTiming(1, { duration: 680, easing: Easing.out(Easing.cubic) });
    rippleEcho.value = 0;
    rippleEcho.value = withDelay(120, withTiming(1, { duration: 680, easing: Easing.out(Easing.cubic) }));
    onPress?.();
  };

  // The egg drinks in the answer: a quick glow swell and shell pop, a single
  // happy rattle (one cycle of the ready-to-hatch shudder), then an outward
  // ring of released energy as it settles.
  const feedShake = useSharedValue(0);
  useEffect(() => {
    if (feedKey <= 0) {
      return;
    }
    absorb.value = withSequence(
      withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 680, easing: Easing.out(Easing.cubic) })
    );
    feedShake.value = 0;
    feedShake.value = withSequence(
      withTiming(1, { duration: 55, easing: Easing.linear }),
      withTiming(-1, { duration: 55, easing: Easing.linear }),
      withTiming(1, { duration: 55, easing: Easing.linear }),
      withTiming(-1, { duration: 55, easing: Easing.linear }),
      withTiming(0.5, { duration: 55, easing: Easing.linear }),
      withTiming(0, { duration: 70, easing: Easing.out(Easing.cubic) })
    );
    ripple.value = 0;
    ripple.value = withDelay(160, withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }));
  }, [absorb, feedKey, feedShake, ripple]);

  // Ready-to-hatch: a burst of rattle then stillness, repeating every ~2.6s —
  // ported verbatim from the world patch egg.
  const readyShake = useSharedValue(0);
  useEffect(() => {
    if (!isReady) {
      cancelAnimation(readyShake);
      readyShake.value = withTiming(0, { duration: 140 });
      return;
    }
    readyShake.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 55, easing: Easing.linear }),
        withTiming(-1, { duration: 55, easing: Easing.linear }),
        withTiming(1, { duration: 55, easing: Easing.linear }),
        withTiming(-1, { duration: 55, easing: Easing.linear }),
        withTiming(0.5, { duration: 55, easing: Easing.linear }),
        withTiming(0, { duration: 70, easing: Easing.out(Easing.cubic) }),
        withDelay(2600, withTiming(0, { duration: 1 }))
      ),
      -1,
      false
    );
    return () => cancelAnimation(readyShake);
  }, [isReady, readyShake]);

  // A quick rattle of the shell (same axis pair the feed shake uses), scaled
  // by `strength` — 0.8 for a tap, up to ~1.2 for an energetic drag release.
  // `delayMs` lets the drag release breathe: the membrane springs back first,
  // THEN the shell rattles, instead of both firing on the same frame.
  const fireShake = (strength: number, delayMs = 0) => {
    'worklet';
    feedShake.value = 0;
    const rattle = withSequence(
      withTiming(strength, { duration: 55, easing: Easing.linear }),
      withTiming(-strength, { duration: 55, easing: Easing.linear }),
      withTiming(strength * 0.55, { duration: 55, easing: Easing.linear }),
      withTiming(-strength * 0.35, { duration: 55, easing: Easing.linear }),
      withTiming(0, { duration: 80, easing: Easing.out(Easing.cubic) })
    );
    feedShake.value = delayMs > 0 ? withDelay(delayMs, rattle) : rattle;
  };

  const tapGesture = Gesture.Tap()
    .enabled(interactive)
    .maxDeltaX(12)
    .maxDeltaY(12)
    .onBegin(() => {
      pressProgress.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) });
    })
    .onFinalize(() => {
      pressProgress.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
    })
    .onEnd(() => {
      fireShake(0.8);
      runOnJS(fireRipple)();
    });

  const panGesture = Gesture.Pan()
    .enabled(interactive)
    .maxPointers(1)
    .minDistance(10)
    .onBegin(() => {
      pressProgress.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) });
    })
    .onUpdate((event) => {
      const clampedX = Math.max(-DRAG_LIMIT, Math.min(DRAG_LIMIT, event.translationX * 0.55));
      const clampedY = Math.max(-DRAG_LIMIT, Math.min(DRAG_LIMIT, event.translationY * 0.55));
      dragX.value = clampedX;
      dragY.value = clampedY;
      interactionEnergy.value = Math.min(1, Math.hypot(clampedX, clampedY) / DRAG_LIMIT);
    })
    .onEnd((event) => {
      // Shake on top of the spring-back, harder the further it was pulled.
      const energy = interactionEnergy.value;
      dragX.value = withSpring(0, { damping: 11, stiffness: 220, velocity: event.velocityX * 0.4 });
      dragY.value = withSpring(0, { damping: 11, stiffness: 220, velocity: event.velocityY * 0.4 });
      interactionEnergy.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) });
      fireShake(0.5 + energy * 0.7, 500);
    })
    .onFinalize(() => {
      pressProgress.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
    });

  const gesture = Gesture.Exclusive(panGesture, tapGesture);

  const glowStyle = useAnimatedStyle(() => ({
    opacity:
      0.34 +
      pulse.value * 0.22 +
      pressProgress.value * 0.16 +
      interactionEnergy.value * 0.18 +
      absorb.value * 0.42,
    transform: [
      { translateX: dragX.value * 0.3 },
      { translateY: dragY.value * 0.3 },
      { scale: 0.94 + pulse.value * 0.1 + interactionEnergy.value * 0.08 + absorb.value * 0.14 },
    ],
  }));

  // The egg's visible body sits low inside its padded cutout, so it read as
  // dropped within the surrounding membrane/dome — lift it to sit centered.
  const liftStyle = useAnimatedStyle(() => {
    const shake = feedShake.value + readyShake.value;
    return {
      transform: [
        { translateX: shake * 5 },
        { translateY: shellOffsetY - absorb.value * 6 },
        { rotateZ: `${shake * 3.2}deg` },
        { scale: shellScale * (1.08 + absorb.value * 0.1) },
      ],
    };
  });

  // The glass dome sits faintly over the egg at rest, brightens under the
  // finger, and stretches elastically with the drag.
  const membraneStyle = useAnimatedStyle(() => {
    const magnitude = Math.min(1, Math.hypot(dragX.value, dragY.value) / DRAG_LIMIT);
    return {
      opacity: 0.5 + pressProgress.value * 0.22 + magnitude * 0.28,
      transform: [
        { translateX: dragX.value * 0.55 },
        { translateY: membraneOffsetY + dragY.value * 0.55 },
        { scaleX: (1 + Math.abs(dragX.value) / 260 + pressProgress.value * 0.02) * membraneScale },
        { scaleY: (1 + Math.abs(dragY.value) / 260 + pressProgress.value * 0.02) * membraneScale },
      ],
    };
  });

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: (1 - ripple.value) * 0.55,
    transform: [{ translateY: membraneOffsetY }, { scale: (0.62 + ripple.value * 0.85) * membraneScale }],
  }));

  const rippleEchoStyle = useAnimatedStyle(() => ({
    opacity: (1 - rippleEcho.value) * 0.35,
    transform: [{ translateY: membraneOffsetY }, { scale: (0.55 + rippleEcho.value * 1.0) * membraneScale }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[
          styles.stage,
          scale !== 1 || offsetY !== 0
            ? { height: 258 * scale, transform: [{ translateY: offsetY }, { scale }] }
            : null,
        ]}>
        {showGlow ? (
          <AnimatedImage
            contentFit="contain"
            pointerEvents="none"
            source={softGlow}
            style={[styles.glow, glowStyle]}
            tintColor={lanternColor ?? egg.haloColor}
            transition={0}
          />
        ) : null}
        {showMembrane ? (
          <>
            <AnimatedImage
              contentFit="contain"
              allowDownscaling={false}
              pointerEvents="none"
              source={glassDome}
              style={[styles.dome, membraneStyle]}
              transition={0}
            />
            <AnimatedImage
              contentFit="contain"
              pointerEvents="none"
              source={softRing}
              style={[styles.membrane, rippleStyle]}
              tintColor={egg.accentColor}
              transition={0}
            />
            <AnimatedImage
              contentFit="contain"
              pointerEvents="none"
              source={softRing}
              style={[styles.membrane, rippleEchoStyle]}
              tintColor={egg.coreColor}
              transition={0}
            />
          </>
        ) : null}
        <Animated.View style={liftStyle}>
          <EggShell
            crackStage={crackStage}
            egg={egg}
            highResolution={highResolution}
            motion={motion}
            reactionKey={reactionKey}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    height: 258,
    justifyContent: 'center',
    width: '100%',
  },
  glow: {
    height: 330,
    position: 'absolute',
    top: -42,
    width: 330,
  },
  // Tight glass shell around the egg (geometry verified by compositing at
  // stage scale - the egg's visible body is ~120x180 inside its padded
  // cutout); ripples use the wider ring so they travel outward past the dome.
  dome: {
    height: 200,
    position: 'absolute',
    top: 19,
    width: 200,
  },
  membrane: {
    height: 286,
    position: 'absolute',
    top: -20,
    width: 286,
  },
});
