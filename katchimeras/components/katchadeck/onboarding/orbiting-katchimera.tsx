import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';

import type { HeroOrbitItem } from '@/constants/onboarding-hero';
import { KatchaDeckUI } from '@/constants/theme';

type OrbitingKatchimeraProps = {
  item: HeroOrbitItem;
  sceneSize: number;
  source: number;
  delay: number;
};

export function OrbitingKatchimera({ item, sceneSize, source, delay }: OrbitingKatchimeraProps) {
  const orbitRotation = useSharedValue(0);
  const reveal = useSharedValue(0);

  useEffect(() => {
    orbitRotation.value = withRepeat(
      withTiming(360, {
        duration: item.rotationDuration,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    reveal.value = withDelay(
      delay,
      withTiming(1, {
        duration: 900,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [delay, item.rotationDuration, orbitRotation, reveal]);

  const animatedStyle = useAnimatedStyle(() => {
    const degrees = item.startAngle + orbitRotation.value;
    const radians = (degrees * Math.PI) / 180;
    const orbitX = Math.cos(radians) * item.orbitRadius;
    const orbitY = Math.sin(radians) * item.orbitRadius * (0.84 + item.parallaxDepth * 0.08);
    const depth = (Math.sin(radians) + 1) / 2;
    const scale = (0.92 + depth * 0.12) * (0.9 + reveal.value * 0.1);

    return {
      opacity: reveal.value * item.opacity,
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
      <View style={styles.frame}>
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
