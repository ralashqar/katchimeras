import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';

import type { HeroOrbitItem, HeroOrbitPosition, HeroSequencePhase } from '@/constants/onboarding-hero';
import { KatchaDeckUI } from '@/constants/theme';

type OrbitingKatchimeraProps = {
  item: HeroOrbitItem;
  sceneSize: number;
  source: number;
  delay: number;
  elapsedMs?: number;
  hidden?: boolean;
  mode?: 'orbit' | 'spotlight';
  spotlightPhase?: HeroSequencePhase;
  spotlightOrigin?: HeroOrbitPosition | null;
  spotlightTarget?: { x: number; y: number };
  spotlightReturnTarget?: HeroOrbitPosition | null;
  spotlightScale?: number;
};

export function OrbitingKatchimera({
  item,
  sceneSize,
  source,
  delay,
  hidden = false,
  mode = 'orbit',
  spotlightPhase = 'idle',
  spotlightOrigin = null,
  spotlightTarget = { x: 0, y: 0 },
  spotlightReturnTarget = null,
  spotlightScale = 1.12,
}: OrbitingKatchimeraProps) {
  const orbitRotation = useSharedValue(0);
  const reveal = useSharedValue(mode === 'orbit' ? 0 : 1);
  const hiddenProgress = useSharedValue(hidden ? 1 : 0);
  const centerProgress = useSharedValue(spotlightPhase === 'idle' ? 0 : 1);
  const returnProgress = useSharedValue(spotlightPhase === 'spotlightOut' ? 1 : 0);

  useEffect(() => {
    if (mode === 'orbit') {
      orbitRotation.value = withRepeat(
        withTiming(360, {
          duration: item.rotationDuration,
          easing: Easing.linear,
        }),
        -1,
        false
      );
    }

    reveal.value = withDelay(
      delay,
      withTiming(1, {
        duration: 900,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [delay, item.rotationDuration, mode, orbitRotation, reveal]);

  useEffect(() => {
    hiddenProgress.value = withTiming(hidden ? 1 : 0, {
      duration: hidden ? 220 : 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [hidden, hiddenProgress]);

  useEffect(() => {
    if (mode !== 'spotlight') {
      return;
    }

    if (spotlightPhase === 'spotlightIn') {
      centerProgress.value = 0;
      returnProgress.value = 0;
      centerProgress.value = withTiming(1, {
        duration: 780,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    if (spotlightPhase === 'spotlightHold') {
      centerProgress.value = withTiming(1, {
        duration: 160,
        easing: Easing.out(Easing.cubic),
      });
      returnProgress.value = withTiming(0, {
        duration: 120,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    if (spotlightPhase === 'spotlightOut') {
      centerProgress.value = withTiming(1, {
        duration: 120,
        easing: Easing.out(Easing.cubic),
      });
      returnProgress.value = withTiming(1, {
        duration: 820,
        easing: Easing.inOut(Easing.cubic),
      });
      return;
    }

    centerProgress.value = 0;
    returnProgress.value = 0;
  }, [centerProgress, mode, returnProgress, spotlightPhase]);

  const animatedStyle = useAnimatedStyle(() => {
    if (mode === 'spotlight') {
      const origin = spotlightOrigin ?? { x: 0, y: 0, depth: 0.5 };
      const returnTarget = spotlightReturnTarget ?? origin;
      const toCenterX = origin.x + (spotlightTarget.x - origin.x) * centerProgress.value;
      const toCenterY = origin.y + (spotlightTarget.y - origin.y) * centerProgress.value;
      const finalX = toCenterX + (returnTarget.x - spotlightTarget.x) * returnProgress.value;
      const finalY = toCenterY + (returnTarget.y - spotlightTarget.y) * returnProgress.value;

      return {
        opacity: reveal.value * (1 - returnProgress.value * 0.08),
        transform: [
          { translateX: finalX },
          { translateY: finalY },
          { scale: 1 + (spotlightScale - 1) * centerProgress.value - returnProgress.value * 0.05 },
        ],
        zIndex: 220,
      };
    }

    const degrees = item.startAngle + orbitRotation.value;
    const radians = (degrees * Math.PI) / 180;
    const orbitX = Math.cos(radians) * item.orbitRadius;
    const orbitY = Math.sin(radians) * item.orbitRadius * (0.84 + item.parallaxDepth * 0.08);
    const depth = (Math.sin(radians) + 1) / 2;
    const scale = (0.92 + depth * 0.12) * (0.9 + reveal.value * 0.1);

    return {
      opacity: reveal.value * item.opacity * (1 - hiddenProgress.value),
      transform: [{ translateX: orbitX }, { translateY: orbitY }, { scale }],
      zIndex: Math.round(depth * 100),
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.anchor,
        {
          height: item.size,
          left: sceneSize / 2,
          marginLeft: -item.size / 2,
          marginTop: -item.size / 2,
          top: sceneSize / 2,
          width: item.size,
        },
        animatedStyle,
      ]}>
      <View style={[styles.frame, mode === 'spotlight' ? styles.spotlightFrame : null]}>
        <View style={styles.imageSurface}>
          <Image contentFit="cover" source={source} style={styles.image} transition={250} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
  },
  frame: {
    backgroundColor: 'rgba(11, 16, 28, 0.48)',
    borderColor: 'rgba(216, 228, 255, 0.18)',
    borderRadius: 999,
    borderWidth: 1,
    boxShadow: KatchaDeckUI.shadows.soft,
    height: '100%',
    overflow: 'hidden',
    padding: 4,
    width: '100%',
  },
  spotlightFrame: {
    borderColor: 'rgba(241, 247, 255, 0.28)',
    boxShadow: KatchaDeckUI.shadows.card,
  },
  imageSurface: {
    aspectRatio: 1,
    backgroundColor: '#111827',
    borderRadius: 999,
    overflow: 'hidden',
    width: '100%',
  },
  image: {
    flex: 1,
  },
});
