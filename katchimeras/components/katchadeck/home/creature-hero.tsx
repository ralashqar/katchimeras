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

import { HeroAuraFrame } from '@/components/katchadeck/home/hero-aura-frame';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getCreatureVisual } from '@/utils/home-engine';
import type { EggVisualState, HomeMoment, LocalCreatureRecord } from '@/types/home';
import { KatchaDeckUI } from '@/constants/theme';
import { homeMomentOptions } from '@/constants/home-mvp';

type CreatureHeroProps = {
  creature: LocalCreatureRecord;
  interactive?: boolean;
  moments: HomeMoment[];
  onPress?: () => void;
  subtitle?: string;
};

export function CreatureHero({ creature, interactive = false, moments, onPress, subtitle }: CreatureHeroProps) {
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
    transform: [{ translateY: -float.value * 10 }, { scale: 1 + glow.value * 0.03 }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.22 + glow.value * 0.22,
    transform: [{ scale: 0.94 + glow.value * 0.08 }],
  }));

  const motifMoments = Array.from(new Set(moments.map((moment) => moment.type)))
    .slice(0, 2)
    .map((type) => homeMomentOptions[type]);
  const aura: EggVisualState = {
    accentColor: creature.accentColor,
    haloColor: creature.accentColor,
    coreColor: `${creature.accentColor}66`,
    intensity: creature.rarity === 'legendary' ? 0.78 : creature.rarity === 'epic' ? 0.66 : creature.rarity === 'rare' ? 0.54 : 0.42,
    shimmer: true,
    swirl: 0.34,
    label: creature.name,
  };

  return (
    <View style={styles.shell}>
      <HeroAuraFrame aura={aura} centerPressSize={112} interactive={interactive} onPress={onPress}>
        {() => (
          <View pointerEvents="none" style={styles.visualWrap}>
            <Animated.View style={[styles.halo, { backgroundColor: `${visual.accentColor}32` }, haloStyle]} />
            <Animated.View style={[styles.creatureWrap, visualStyle]}>
              <View style={[styles.creaturePlate, { borderColor: `${visual.accentColor}40` }]}>
                <Image contentFit="contain" source={visual.source} style={styles.image} transition={0} />
              </View>
            </Animated.View>
            {motifMoments.map((moment, index) => (
              <View
                key={moment.id}
                style={[
                  styles.motifOrbit,
                  index === 0 ? styles.motifLeft : styles.motifRight,
                  { backgroundColor: `${moment.accentColor}22`, borderColor: `${moment.accentColor}55` },
                ]}>
                <IconSymbol color={moment.accentColor} name={moment.icon} size={16} />
              </View>
            ))}
          </View>
        )}
      </HeroAuraFrame>
      <View style={styles.copy}>
        <ThemedText type="onboardingLabel" style={styles.label} lightColor="#D7E4FF" darkColor="#D7E4FF">
          {creature.rarity}
        </ThemedText>
        <ThemedText type="display" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
          {creature.name}
        </ThemedText>
        <ThemedText style={styles.subtitle} lightColor="#E6EEFF" darkColor="#E6EEFF">
          {subtitle ?? creature.reflection}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    gap: 16,
  },
  visualWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  halo: {
    borderRadius: 999,
    height: 270,
    position: 'absolute',
    width: 270,
  },
  creatureWrap: {
    height: 244,
    justifyContent: 'center',
    width: 244,
  },
  creaturePlate: {
    alignItems: 'center',
    backgroundColor: 'rgba(10,14,24,0.92)',
    borderRadius: 999,
    borderWidth: 1,
    boxShadow: KatchaDeckUI.shadows.card,
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  motifOrbit: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    position: 'absolute',
    width: 42,
  },
  motifLeft: {
    left: 44,
    top: 64,
  },
  motifRight: {
    bottom: 54,
    right: 46,
  },
  copy: {
    alignItems: 'center',
    gap: 8,
    maxWidth: 300,
  },
  label: {
    fontSize: 11,
  },
  title: {
    fontSize: 44,
    lineHeight: 46,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
