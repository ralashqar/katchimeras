import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';

import type { HeroFlywheelConfig, HeroRosterItem } from '@/constants/onboarding-hero';
import { KatchaDeckUI } from '@/constants/theme';

type OrbitingKatchimeraProps = {
  item: HeroRosterItem;
  sceneSize: number;
  source: number;
  delay: number;
  loopProgress: SharedValue<number>;
  slotIndex: number;
  visibleCount: number;
  flywheel: HeroFlywheelConfig;
  onWrap: (slotIndex: number) => void;
};

export function OrbitingKatchimera({
  item,
  sceneSize,
  source,
  delay,
  loopProgress,
  slotIndex,
  visibleCount,
  flywheel,
  onWrap,
}: OrbitingKatchimeraProps) {
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = 0;
    reveal.value = withDelay(
      delay,
      withTiming(1, {
        duration: 760,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [delay, item.id, reveal]);

  useAnimatedReaction(
    () => {
      const rawProgress = loopProgress.value + slotIndex / visibleCount;
      return ((rawProgress % 1) + 1) % 1;
    },
    (current, previous) => {
      if (previous === null || previous === undefined) {
        return;
      }

      if (previous > 1 - flywheel.exitFadeWindow && current < flywheel.entryFadeWindow) {
        runOnJS(onWrap)(slotIndex);
      }
    },
    [flywheel.entryFadeWindow, flywheel.exitFadeWindow, onWrap, slotIndex, visibleCount]
  );

  const animatedStyle = useAnimatedStyle(() => {
    const rawProgress = loopProgress.value + slotIndex / visibleCount;
    const progress = ((rawProgress % 1) + 1) % 1;
    const angle = progress * 360 + 180;
    const radians = (angle * Math.PI) / 180;
    const orbitX = Math.cos(radians) * flywheel.orbitRadiusX;
    const orbitY = Math.sin(radians) * flywheel.orbitRadiusY;
    const depth = (Math.sin(radians) + 1) / 2;
    const distanceToHighlight = Math.min(
      Math.abs(progress - flywheel.highlightProgress),
      1 - Math.abs(progress - flywheel.highlightProgress)
    );
    const highlightFactor = Math.max(0, 1 - distanceToHighlight / flywheel.highlightWindow);
    const entryFade = Math.min(1, progress / flywheel.entryFadeWindow);
    const exitFade = Math.min(1, (1 - progress) / flywheel.exitFadeWindow);
    const leftFade = Math.min(entryFade, exitFade);
    const introShiftX = -flywheel.entryOffsetX * (1 - reveal.value);
    const scale = (0.9 + depth * 0.15) * (0.9 + reveal.value * 0.1) * (1 + (flywheel.highlightScale - 1) * highlightFactor);
    const opacityBoost = 0.84 + highlightFactor * 0.16;

    return {
      opacity: reveal.value * leftFade * opacityBoost,
      transform: [
        { translateX: orbitX + introShiftX + flywheel.highlightOffset.x * highlightFactor },
        { translateY: orbitY + flywheel.highlightOffset.y * highlightFactor },
        { scale },
      ],
      zIndex: Math.round(depth * 100 + highlightFactor * 60),
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.anchor,
        {
          height: flywheel.itemSize,
          left: sceneSize / 2,
          marginLeft: -flywheel.itemSize / 2,
          marginTop: -flywheel.itemSize / 2,
          top: sceneSize / 2,
          width: flywheel.itemSize,
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
