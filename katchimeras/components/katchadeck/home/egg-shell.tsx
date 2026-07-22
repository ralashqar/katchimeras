import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import type { EggVisualState } from '@/types/home';

export type EggAuraMotionValues = {
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  pressProgress: SharedValue<number>;
  releaseVelocity: SharedValue<number>;
  interactionEnergy: SharedValue<number>;
  glowLagX: SharedValue<number>;
  glowLagY: SharedValue<number>;
};

type EggShellProps = {
  egg: EggVisualState;
  highResolution?: boolean;
  motion: EggAuraMotionValues;
  reactionKey?: number;
  // 0 = whole shell, 1 = first glowing cracks, 2 = bursting. The stages are
  // generated edits of the same render, tight-cropped to a shared bounding
  // box so crossfades stay pixel-aligned.
  crackStage?: 0 | 1 | 2;
};

// Drag-to-tilt: dragX is already clamped to ±60 in LanternEgg's pan handler, so
// a full sideways pull reaches the max tilt.
const DRAG_TILT_RANGE = 60;
const MAX_TILT_DEG = 9;

const eggBase = require('../../../assets/images/katchimeras/cutouts/egg-base.webp');
const eggCrackOne = require('../../../assets/images/katchimeras/cutouts/egg-crack-1.webp');
const eggCrackTwo = require('../../../assets/images/katchimeras/cutouts/egg-crack-2.webp');
const eggBaseHighResolution = require('../../../assets/images/katchimeras/cutouts/egg-base.png');
const eggCrackOneHighResolution = require('../../../assets/images/katchimeras/cutouts/egg-crack-1.png');
const eggCrackTwoHighResolution = require('../../../assets/images/katchimeras/cutouts/egg-crack-2.png');

const AnimatedImage = Animated.createAnimatedComponent(Image);

// Pure artwork egg: the render plus crack overlays, breathing. No procedural
// glow capsules, rings, or sparks - the glow is baked into the art.
export function EggShell({
  egg: _egg,
  highResolution = false,
  motion,
  reactionKey = 0,
  crackStage = 0,
}: EggShellProps) {
  const breathe = useSharedValue(0);
  const reaction = useSharedValue(0);
  const crackOne = useSharedValue(0);
  const crackTwo = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [breathe]);

  useEffect(() => {
    reaction.value = 0;
    reaction.value = withSequence(
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) })
    );
  }, [reaction, reactionKey]);

  useEffect(() => {
    crackOne.value = withTiming(crackStage >= 1 ? 1 : 0, { duration: 360, easing: Easing.out(Easing.cubic) });
    crackTwo.value = withTiming(crackStage >= 2 ? 1 : 0, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [crackOne, crackTwo, crackStage]);

  const shellStyle = useAnimatedStyle(() => {
    const energy = motion.interactionEnergy.value;
    const press = motion.pressProgress.value;
    const dragMagnitude = Math.min(1, Math.hypot(motion.dragX.value, motion.dragY.value) / 88);
    // Pulling the membrane swings the egg: a leftward pull (e.g. from the bottom
    // left) tips it clockwise, a rightward pull counter-clockwise — driven by the
    // horizontal component so a straight up/down pull leaves it upright. Clamped
    // to a gentle tilt; springs back with dragX on release.
    const tilt = Math.max(-1, Math.min(1, -motion.dragX.value / DRAG_TILT_RANGE)) * MAX_TILT_DEG;

    return {
      transform: [
        { translateX: motion.dragX.value * 0.14 },
        { translateY: motion.dragY.value * 0.14 },
        { rotate: `${tilt}deg` },
        { scaleX: 1 + breathe.value * 0.05 + reaction.value * 0.06 + press * 0.03 + dragMagnitude * 0.03 },
        {
          scaleY:
            1 + breathe.value * 0.05 + reaction.value * 0.06 + press * 0.03 - dragMagnitude * 0.018 + energy * 0.025,
        },
      ],
    };
  });

  const crackOneStyle = useAnimatedStyle(() => ({
    opacity: crackOne.value * (1 - crackTwo.value * 0.65),
  }));

  const crackTwoStyle = useAnimatedStyle(() => ({
    opacity: crackTwo.value,
    transform: [{ scale: 1 + crackTwo.value * 0.02 }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.eggWrap, shellStyle]}>
      {/* allowDownscaling=false keeps the full-res texture, so the egg stays crisp
          when the World view shrinks it then zooms back in (it's drawn small there). */}
      <Image
        allowDownscaling={false}
        cachePolicy="memory-disk"
        contentFit="contain"
        priority="high"
        source={highResolution ? eggBaseHighResolution : eggBase}
        style={styles.eggImage}
        transition={0}
      />
      {crackStage >= 1 ? (
        <AnimatedImage
          allowDownscaling={false}
          cachePolicy="memory-disk"
          contentFit="contain"
          priority="high"
          source={highResolution ? eggCrackOneHighResolution : eggCrackOne}
          style={[styles.eggImage, crackOneStyle]}
          transition={0}
        />
      ) : null}
      {crackStage >= 2 ? (
        <AnimatedImage
          allowDownscaling={false}
          cachePolicy="memory-disk"
          contentFit="contain"
          priority="high"
          source={highResolution ? eggCrackTwoHighResolution : eggCrackTwo}
          style={[styles.eggImage, crackTwoStyle]}
          transition={0}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  eggWrap: {
    alignItems: 'center',
    height: 224,
    justifyContent: 'center',
    width: 196,
    // iOS derives this shadow from the RENDERED ALPHA (no background, no
    // shadowPath) — a true silhouette drop-shadow, like CSS drop-shadow().
    // Biased downward so it reads as contact with the nest, and it rides the
    // shell's every transform (drag, breathe, shake) for free.
    shadowColor: '#170F06',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  eggImage: {
    height: '100%',
    position: 'absolute',
    width: '100%',
  },
});
