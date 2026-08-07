import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CreatureGroundShadow } from '@/components/katchadeck/creature-ground-shadow';
import { getCreatureVisual } from '@/game/days';
import { homeRepository } from '@/storage/repositories/home-repository';
import type { HomeVisualKey } from '@/types/home';

const EGG_SOURCE = require('../../../assets/images/katchimeras/cutouts/egg-base.webp');
const RAYS = Array.from({ length: 16 }, (_, index) => index);

export const StreakHeroStage = memo(function StreakHeroStage({ size }: { size: number }) {
  const reduceMotion = useReducedMotion();
  const float = useSharedValue(0);
  const hero = useMemo(resolveHero, []);

  useEffect(() => {
    cancelAnimation(float);
    if (reduceMotion) {
      float.value = 0;
      return;
    }
    float.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
        withTiming(3, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(float);
  }, [float, reduceMotion]);

  const floatingStyle = useAnimatedStyle(() => ({ transform: [{ translateY: float.value }] }));
  const artSize = size * 0.57;

  return (
    <View accessibilityLabel={hero.name} style={{ height: size, width: size }}>
      <View pointerEvents="none" style={styles.rays}>
        {RAYS.map((index) => (
          <View key={index} style={[styles.rayFrame, { transform: [{ rotate: `${index * 22.5}deg` }] }]}>
            <LinearGradient
              colors={['rgba(255,250,211,0.52)', 'rgba(244,202,96,0.16)', 'rgba(244,202,96,0)']}
              end={{ x: 0.5, y: 0 }}
              start={{ x: 0.5, y: 1 }}
              style={[styles.ray, { height: size * 0.46, left: size / 2 - 7, top: size * 0.04 }]}
            />
          </View>
        ))}
        <View style={[styles.halo, { height: size * 0.58, left: size * 0.21, top: size * 0.21, width: size * 0.58 }]} />
      </View>
      <Animated.View style={[styles.artFrame, { height: artSize, left: (size - artSize) / 2, top: size * 0.2, width: artSize }, floatingStyle]}>
        {hero.visualKey ? <CreatureGroundShadow frameSize={artSize} visualKey={hero.visualKey} /> : <View style={styles.eggShadow} />}
        <Image accessibilityLabel={hero.name} contentFit="contain" source={hero.source} style={StyleSheet.absoluteFill} transition={0} />
      </Animated.View>
    </View>
  );
});

function resolveHero(): { name: string; source: ReturnType<typeof getCreatureVisual>['source']; visualKey: HomeVisualKey | null } {
  const state = homeRepository.load();
  const day = state
    ? [state.today, ...state.archivedDays]
      .filter((candidate) => candidate.creature)
      .sort((left, right) => right.isoDate.localeCompare(left.isoDate))[0]
    : null;
  if (!day?.creature) return { name: 'Your next Katchimera', source: EGG_SOURCE, visualKey: null };
  return {
    name: `${day.creature.name}, your Katchimera`,
    source: getCreatureVisual(day.creature.visualKey).source,
    visualKey: day.creature.visualKey,
  };
}

const styles = StyleSheet.create({
  rays: { ...StyleSheet.absoluteFillObject, borderRadius: 999, overflow: 'hidden' },
  rayFrame: { ...StyleSheet.absoluteFillObject },
  ray: { borderRadius: 999, position: 'absolute', width: 14 },
  halo: { backgroundColor: 'rgba(255,245,190,0.42)', borderColor: 'rgba(255,255,255,0.66)', borderRadius: 999, borderWidth: 2, position: 'absolute' },
  artFrame: { position: 'absolute' },
  eggShadow: { alignSelf: 'center', backgroundColor: 'rgba(28,50,50,0.18)', borderRadius: 999, bottom: '8%', height: '10%', position: 'absolute', width: '48%' },
});
