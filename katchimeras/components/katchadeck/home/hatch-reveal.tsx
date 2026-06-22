import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { LanternEgg } from '@/components/katchadeck/home/lantern-egg';
import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { EggVisualState, LocalCreatureRecord } from '@/types/home';
import { resolveCreatureVariantSource } from '@/utils/creature-variant';
import { getCreatureVisual } from '@/utils/home-engine';

const AnimatedImage = Animated.createAnimatedComponent(Image);
const softGlow = require('../../../assets/images/katchimeras/soft-glow.png');

// LanternEgg's own stage height — the box the egg sits centered within.
const EGG_HOST_HEIGHT = 258;
const CREATURE_SIZE = 196;

type HatchRevealPhase = 'build' | 'hatch' | 'settle';

type HatchRevealProps = {
  egg: EggVisualState;
  // The resolved creature (may briefly be null while the hatch finalizes — the
  // egg keeps shaking until it arrives).
  creature: LocalCreatureRecord | null;
  onComplete: () => void;
};

// In-place hatch: the SAME egg widget already on the page rattles, cracks, then
// shrinks away exactly as the hatched katchimera scales up in its spot — matching
// the onboarding cinematic. No page change, no moved egg.
export function HatchReveal({ egg, creature, onComplete }: HatchRevealProps) {
  const [phase, setPhase] = useState<HatchRevealPhase>('build');
  const [crackStage, setCrackStage] = useState<0 | 1 | 2>(0);

  const eggOpacity = useSharedValue(1);
  const eggShake = useSharedValue(0);
  const eggHatch = useSharedValue(0);
  const creatureProgress = useSharedValue(0);
  const creatureScale = useSharedValue(0.4);

  // Timeline: rattle + crack, then hatch (egg shrinks, creature pops), then settle.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setCrackStage(1), 480));
    timers.push(setTimeout(() => setCrackStage(2), 960));
    timers.push(setTimeout(() => setPhase('hatch'), 1180));
    timers.push(setTimeout(() => setPhase('settle'), 1680));
    timers.push(setTimeout(() => onComplete(), 2200));
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  // Aggressive continuous rattle while building, one violent jolt at the hatch.
  useEffect(() => {
    if (phase === 'build') {
      eggShake.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 55, easing: Easing.linear }),
          withTiming(-1, { duration: 55, easing: Easing.linear })
        ),
        -1,
        true
      );
    } else if (phase === 'hatch') {
      eggShake.value = withSequence(
        withTiming(1.8, { duration: 45, easing: Easing.linear }),
        withTiming(-1.8, { duration: 50, easing: Easing.linear }),
        withTiming(0, { duration: 70, easing: Easing.out(Easing.cubic) })
      );
    } else {
      eggShake.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.cubic) });
    }
  }, [eggShake, phase]);

  // Egg shrinks + fades while the creature scales up with an overshoot.
  useEffect(() => {
    const hatched = phase === 'hatch' || phase === 'settle';
    eggOpacity.value = withTiming(hatched ? 0 : 1, {
      duration: hatched ? 240 : 180,
      easing: Easing.out(Easing.cubic),
    });
    eggHatch.value = withTiming(hatched ? 1 : 0, { duration: 300, easing: Easing.in(Easing.cubic) });
    creatureProgress.value = withTiming(hatched ? 1 : 0, { duration: 460, easing: Easing.out(Easing.cubic) });
    creatureScale.value = withTiming(hatched ? 1 : 0.4, {
      duration: 520,
      easing: hatched ? Easing.out(Easing.back(1.7)) : Easing.out(Easing.cubic),
    });
  }, [creatureProgress, creatureScale, eggHatch, eggOpacity, phase]);

  const eggStyle = useAnimatedStyle(() => ({
    opacity: eggOpacity.value,
    transform: [
      { translateX: eggShake.value * 7 },
      { rotateZ: `${eggShake.value * 4}deg` },
      { scale: 1 - eggHatch.value * 0.82 },
    ],
  }));
  const creatureStyle = useAnimatedStyle(() => ({
    opacity: creatureProgress.value,
    transform: [{ translateY: 14 - creatureProgress.value * 14 }, { scale: creatureScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: creatureProgress.value * 0.85,
    transform: [{ scale: 0.7 + creatureProgress.value * 0.5 }],
  }));

  const heroSource = creature
    ? resolveCreatureVariantSource(creature.visualKey, creature.variantCell) ?? getCreatureVisual(creature.visualKey).source
    : null;
  const accent = creature?.accentColor ?? egg.accentColor;
  const settled = phase === 'settle';

  return (
    <View style={styles.stage}>
      <View style={styles.eggArea}>
        <Animated.View pointerEvents="none" style={eggStyle}>
          <LanternEgg crackStage={crackStage} egg={egg} />
        </Animated.View>

        {heroSource ? (
          <Animated.View pointerEvents="none" style={[styles.creatureWrap, creatureStyle]}>
            <AnimatedImage
              contentFit="contain"
              source={softGlow}
              style={[styles.creatureGlow, glowStyle]}
              tintColor={accent}
              transition={0}
            />
            <Image contentFit="contain" source={heroSource} style={styles.creatureImage} transition={0} />
          </Animated.View>
        ) : null}
      </View>

      <View style={styles.captionWrap}>
        {settled && creature ? (
          <Animated.View entering={FadeIn.duration(320)} style={styles.caption} key="settled">
            <ThemedText type="onboardingLabel" style={styles.captionKicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
              Today became
            </ThemedText>
            <ThemedText type="display" style={styles.captionName} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              {creature.name}
            </ThemedText>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(320)} key="building">
            <ThemedText style={styles.captionBuild} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
              Your day is taking shape…
            </ThemedText>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  eggArea: {
    alignItems: 'center',
    height: EGG_HOST_HEIGHT,
    justifyContent: 'center',
    width: '100%',
  },
  creatureWrap: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  creatureGlow: {
    height: CREATURE_SIZE * 1.4,
    position: 'absolute',
    width: CREATURE_SIZE * 1.4,
  },
  creatureImage: {
    height: CREATURE_SIZE,
    width: CREATURE_SIZE,
  },
  captionWrap: {
    alignItems: 'center',
    minHeight: 64,
    justifyContent: 'center',
  },
  caption: {
    alignItems: 'center',
    gap: 4,
  },
  captionKicker: {
    fontSize: 11,
  },
  captionName: {
    fontSize: 34,
    fontStyle: 'italic',
    lineHeight: 40,
    textAlign: 'center',
  },
  captionBuild: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
