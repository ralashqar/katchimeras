import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { DevAtmosphereLayer } from '@/components/katchadeck/world/atmosphere-layer';
import { StaticKingdomSkyBackground } from '@/components/katchadeck/world/kingdom-sky-background';
import type { TodayFullSpreadScene } from '@/utils/today-full-spread-scenes';

type TodaySceneBackdropProps = {
  scene: TodayFullSpreadScene | null;
};

// Kingdom sky remains mounted underneath so moving between a full-spread day
// and an ordinary hex-tile day always has a ready, non-blank background.
export function TodaySceneBackdrop({ scene }: TodaySceneBackdropProps) {
  const verticalGrade = scene
    ? [
        'rgba(8, 18, 40, 0.46)',
        'rgba(11, 28, 52, 0.24)',
        'rgba(255, 241, 205, 0.04)',
        'rgba(255, 244, 211, 0.11)',
      ] as const
    : [
        'rgba(8, 18, 40, 0.38)',
        'rgba(11, 28, 52, 0.18)',
        'rgba(255, 241, 205, 0.035)',
        'rgba(255, 244, 211, 0.09)',
      ] as const;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <StaticKingdomSkyBackground />
      <DevAtmosphereLayer plane="background" target="today" />
      {scene ? (
        <Animated.View
          key={scene.id}
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(200)}
          style={StyleSheet.absoluteFill}>
          <Image
            cachePolicy="memory-disk"
            contentFit="cover"
            pointerEvents="none"
            source={scene.source}
            style={StyleSheet.absoluteFill}
            transition={180}
          />
        </Animated.View>
      ) : null}
      {/* A single static grade keeps every scene readable without the GPU cost
          of live blur over the drifting cloud layers. */}
      <LinearGradient
        colors={verticalGrade}
        locations={[0, 0.28, 0.64, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(5, 12, 28, 0.16)', 'rgba(5, 12, 28, 0)']}
        end={{ x: 1, y: 0.5 }}
        pointerEvents="none"
        start={{ x: 0, y: 0.5 }}
        style={styles.leftVignette}
      />
      <LinearGradient
        colors={['rgba(5, 12, 28, 0)', 'rgba(5, 12, 28, 0.16)']}
        end={{ x: 1, y: 0.5 }}
        pointerEvents="none"
        start={{ x: 0, y: 0.5 }}
        style={styles.rightVignette}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  leftVignette: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: '22%',
  },
  rightVignette: {
    bottom: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '22%',
  },
});
