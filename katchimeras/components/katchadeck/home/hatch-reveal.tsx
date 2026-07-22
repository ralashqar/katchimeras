import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
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
import { DailyCard } from '@/components/katchadeck/cards/daily-card';
import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { DailyCreatureCard, EggVisualState, LocalCreatureRecord } from '@/types/home';
import { resolveCreatureArtSource } from '@/utils/creature-art';

const AnimatedImage = Animated.createAnimatedComponent(Image);
const softGlow = require('../../../assets/images/katchimeras/soft-glow.png');

// LanternEgg's own stage height — the box the egg sits centered within.
const EGG_HOST_HEIGHT = 258;
const CREATURE_SIZE = 196;

type HatchRevealPhase = 'build' | 'hatch' | 'settle';

type HatchRevealProps = {
  egg: EggVisualState;
  card?: DailyCreatureCard | null;
  // The resolved creature (may briefly be null while the hatch finalizes — the
  // egg keeps shaking until it arrives).
  creature: LocalCreatureRecord | null;
  onComplete: () => void;
  onSettled?: () => void;
  // Hide the built-in "Today became / name" caption — used when the host renders
  // its own header (e.g. the World page's "You hatched X" banner).
  hideCaption?: boolean;
  // Optional cosmetic lantern-colour override for the egg's glow during the reveal.
  lanternColor?: string;
  // When hosted inside the forming card, keep the reveal in the card's art
  // window. The parent swaps to the completed DailyCard after onComplete.
  embedded?: boolean;
};

// In-place hatch: the SAME egg widget already on the page rattles, cracks, then
// shrinks away exactly as the hatched katchimera scales up in its spot — matching
// the onboarding cinematic. No page change, no moved egg.
export function HatchReveal({ egg, card, creature, onComplete, onSettled, hideCaption = false, lanternColor, embedded = false }: HatchRevealProps) {
  const [phase, setPhase] = useState<HatchRevealPhase>('build');
  const [crackStage, setCrackStage] = useState<0 | 1 | 2>(0);

  const eggOpacity = useSharedValue(1);
  const eggShake = useSharedValue(0);
  const eggHatch = useSharedValue(0);
  const creatureProgress = useSharedValue(0);
  const creatureScale = useSharedValue(0.4);
  const creatureReady = Boolean(creature);

  // Keep the latest onComplete without re-running the hatch timers each time the
  // parent re-renders (the creature arriving triggers several re-renders).
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  // Build: rattle + a first crack while we WAIT for the hatch to be determined.
  useEffect(() => {
    const t = setTimeout(() => setCrackStage((stage) => (stage < 1 ? 1 : stage)), 480);
    return () => clearTimeout(t);
  }, []);

  // The egg keeps shaking until the creature is determined from the day. Once it
  // arrives → full crack → hatch → settle → done. A safety timeout completes even
  // if determination never lands, so the egg never shakes forever.
  useEffect(() => {
    if (!creatureReady) {
      const safety = setTimeout(() => onCompleteRef.current(), 9000);
      return () => clearTimeout(safety);
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    setCrackStage(2);
    timers.push(setTimeout(() => setPhase('hatch'), 240));
    timers.push(setTimeout(() => {
      setPhase('settle');
      onSettledRef.current?.();
    }, 740));
    timers.push(setTimeout(() => onCompleteRef.current(), 1300));
    return () => timers.forEach(clearTimeout);
  }, [creatureReady]);

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
    ? resolveCreatureArtSource(creature.visualKey, { variantCell: creature.variantCell })
    : null;
  const accent = creature?.accentColor ?? egg.accentColor;
  const settled = phase === 'settle';

  return (
    <View style={styles.stage}>
      <View style={styles.eggArea}>
        <Animated.View pointerEvents="none" style={eggStyle}>
          <LanternEgg crackStage={crackStage} egg={egg} lanternColor={lanternColor} />
        </Animated.View>

        {settled && card && !embedded ? (
          <Animated.View entering={FadeIn.duration(360)} style={[styles.cardWrap, creatureStyle]}>
            <DailyCard card={card} compact />
          </Animated.View>
        ) : heroSource ? (
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

      {hideCaption || (settled && card) ? null : (
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
              Hatching your day…
            </ThemedText>
          </Animated.View>
        )}
      </View>
      )}
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
  cardWrap: {
    alignItems: 'center',
    bottom: -42,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: -42,
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
