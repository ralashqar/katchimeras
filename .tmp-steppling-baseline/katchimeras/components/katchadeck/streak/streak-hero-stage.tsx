import { Image } from 'expo-image';
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
import { EggAvatarArtwork } from '@/components/katchadeck/egg-avatar/egg-avatar-artwork';
import { RotatingRadialSunburst } from '@/components/katchadeck/ui/radial-sunburst';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import { getCreatureVisual } from '@/game/days';
import { homeRepository } from '@/storage/repositories/home-repository';
import type { HomeVisualKey } from '@/types/home';

const EGG_SOURCE = require('../../../assets/images/katchimeras/cutouts/egg-base.webp');

export const StreakHeroStage = memo(function StreakHeroStage({
  heroMode = 'latest-katchimera',
  rayScale = 1,
  rayStrength = 0.76,
  size,
}: {
  heroMode?: 'active-egg-avatar' | 'latest-katchimera';
  rayScale?: number;
  rayStrength?: number;
  size: number;
}) {
  const reduceMotion = useReducedMotion();
  const { equippedFaceId, equippedSkinId } = useEggAvatar();
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
  const showsEggAvatar = heroMode === 'active-egg-avatar';
  const artSize = size * (showsEggAvatar ? 0.64 : 0.57);
  const raySize = size * rayScale;
  const rayOffset = (size - raySize) / 2;

  return (
    <View accessibilityLabel={showsEggAvatar ? 'Your active egg avatar' : hero.name} style={{ height: size, width: size }}>
      <RotatingRadialSunburst
        baseOpacity={rayStrength}
        size={raySize}
        style={[styles.rays, { left: rayOffset, top: rayOffset }]}
      />
      <Animated.View style={[styles.artFrame, { height: artSize, left: (size - artSize) / 2, top: size * 0.2, width: artSize }, floatingStyle]}>
        {showsEggAvatar || !hero.visualKey
          ? <View style={styles.eggShadow} />
          : <CreatureGroundShadow frameSize={artSize} visualKey={hero.visualKey} />}
        {showsEggAvatar ? (
          <EggAvatarArtwork
            allowDownscaling={false}
            faceId={equippedFaceId}
            priority="high"
            resolution="high"
            skinId={equippedSkinId}
            style={StyleSheet.absoluteFill}
            transition={140}
          />
        ) : (
          <Image accessibilityLabel={hero.name} contentFit="contain" source={hero.source} style={StyleSheet.absoluteFill} transition={0} />
        )}
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
  rays: { position: 'absolute' },
  artFrame: { position: 'absolute' },
  eggShadow: { alignSelf: 'center', backgroundColor: 'rgba(28,50,50,0.18)', borderRadius: 999, bottom: '8%', height: '10%', position: 'absolute', width: '48%' },
});
