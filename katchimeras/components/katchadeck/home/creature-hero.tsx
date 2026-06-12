import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { ThemedText } from '@/components/themed-text';
import { getCreatureVisual } from '@/utils/home-engine';
import type { LocalCreatureRecord } from '@/types/home';
import { Lantern } from '@/constants/theme';

type CreatureHeroProps = {
  creature: LocalCreatureRecord;
  subtitle?: string;
  hideSubtitle?: boolean;
};

// Lantern hero: the creature floats free over the ink - no membrane ring, no
// plate, no motif orbits. Halo and float are the only ornament.
export function CreatureHero({ creature, subtitle, hideSubtitle = false }: CreatureHeroProps) {
  const visual = getCreatureVisual(creature.visualKey);
  const float = useSharedValue(0);
  const glow = useSharedValue(0.2);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2300, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2300, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );

    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.22, { duration: 1600, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [float, glow]);

  const visualStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.value * 9 }, { scale: 1 + glow.value * 0.03 }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.26 + glow.value * 0.22,
    transform: [{ scale: 0.94 + glow.value * 0.08 }],
  }));

  return (
    <View style={styles.shell}>
      <View style={styles.stage}>
        <Animated.View style={[styles.halo, { backgroundColor: `${visual.accentColor}2E` }, haloStyle]} />
        <Animated.View style={visualStyle}>
          <Image contentFit="contain" source={visual.source} style={styles.image} transition={0} />
        </Animated.View>
      </View>
      <View style={styles.copy}>
        <ThemedText
          type="onboardingLabel"
          style={styles.label}
          lightColor={Lantern.ember300}
          darkColor={Lantern.ember300}>
          {buildCreatureKicker(creature)}
        </ThemedText>
        <ThemedText type="display" style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {creature.name}
        </ThemedText>
        {hideSubtitle ? null : (
          <ThemedText style={styles.subtitle} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            {subtitle ?? creature.reflection}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

function buildCreatureKicker(creature: LocalCreatureRecord) {
  const encounterCue = creature.encounterProfileId ? creature.motifTags[0] ?? null : null;
  if (!encounterCue) {
    return creature.rarity;
  }

  if (creature.repeatDepth > 0) {
    return `${encounterCue} · ${formatVisitNumber(creature.repeatDepth + 1)} visit`;
  }

  if (creature.rarity !== 'common') {
    return `${encounterCue} · ${creature.rarity}`;
  }

  return encounterCue;
}

function formatVisitNumber(visit: number) {
  const remainderTen = visit % 10;
  const remainderHundred = visit % 100;
  if (remainderTen === 1 && remainderHundred !== 11) return `${visit}st`;
  if (remainderTen === 2 && remainderHundred !== 12) return `${visit}nd`;
  if (remainderTen === 3 && remainderHundred !== 13) return `${visit}rd`;
  return `${visit}th`;
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    gap: 14,
  },
  stage: {
    alignItems: 'center',
    height: 258,
    justifyContent: 'center',
    width: '100%',
  },
  halo: {
    borderRadius: 999,
    height: 240,
    position: 'absolute',
    width: 240,
  },
  image: {
    height: 248,
    width: 248,
  },
  copy: {
    alignItems: 'center',
    gap: 6,
    maxWidth: 320,
  },
  label: {
    fontSize: 11,
  },
  title: {
    fontSize: 46,
    fontStyle: 'italic',
    lineHeight: 52,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
