import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import type { TodayFullSpreadScene } from '@/utils/today-full-spread-scenes';

type TodaySceneBackdropProps = {
  background: TodayAtmosphereBackground;
  onLoad?: () => void;
  scene: TodayFullSpreadScene | null;
  variant?: 'default' | 'splash';
};

export function TodaySceneBackdrop({
  background,
  onLoad,
  scene,
  variant = 'default',
}: TodaySceneBackdropProps) {
  const reduceMotion = useReducedMotion();
  const splash = variant === 'splash';
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
      <Image
        cachePolicy="disk"
        contentFit="cover"
        contentPosition={splash ? "bottom" : "center"}
        pointerEvents="none"
        onLoad={onLoad}
        recyclingKey={background.id}
        source={background.source}
        style={StyleSheet.absoluteFill}
        transition={reduceMotion ? 0 : 200}
      />
      {scene ? (
        <Animated.View
          key={scene.id}
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(200)}
          style={StyleSheet.absoluteFill}>
          <Image
            cachePolicy="disk"
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
      {!splash ? (
        <>
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
        </>
      ) : null}
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
