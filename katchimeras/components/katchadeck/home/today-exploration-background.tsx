import { Image } from 'expo-image';
import { type ReactNode, useEffect, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import todayScene from '@/data/today-scene.json';
import {
  resolveTodayExplorationSwipeDirection,
  type TodayExplorationSwipeDirection,
} from '@/utils/today-exploration-gesture';
import type { TodayExplorationBackgroundKey } from '@/utils/today-exploration-backgrounds';
import { TODAY_EXPLORATION_BACKGROUND_SOURCES } from '@/constants/today-exploration-background-sources.gen';

type TodayExplorationBackgroundMotionOptions = {
  enabled: boolean;
  onQuickSwipe: (direction: TodayExplorationSwipeDirection) => void;
};

export function useTodayExplorationBackgroundMotion({
  enabled,
  onQuickSwipe,
}: TodayExplorationBackgroundMotionOptions) {
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const gestureStartX = useSharedValue(0);
  const gestureEnded = useSharedValue(false);
  const environmentDragUnlocked = useSharedValue(0);
  const environmentDragStarted = useSharedValue(false);
  const environmentDragOriginX = useSharedValue(0);
  const pendingTranslationX = useSharedValue(0);
  const imageSize = Math.max(viewportHeight, viewportWidth);
  const maxPan = Math.max(0, (imageSize - viewportWidth) / 2);
  const spring = todayScene.homeExplorationBackground.resetSpring;

  useEffect(() => {
    if (enabled) return;
    cancelAnimation(environmentDragUnlocked);
    environmentDragUnlocked.value = 0;
    environmentDragStarted.value = false;
    cancelAnimation(translateX);
    translateX.value = reduceMotion
      ? withTiming(0, { duration: 120 })
      : withSpring(0, spring);
  }, [
    enabled,
    environmentDragStarted,
    environmentDragUnlocked,
    reduceMotion,
    spring,
    translateX,
  ]);

  const gesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(enabled && maxPan > 0)
      .maxPointers(1)
      .activeOffsetX([-6, 6])
      .failOffsetY([-20, 20])
      .onBegin(() => {
        cancelAnimation(translateX);
        gestureStartX.value = translateX.value;
        gestureEnded.value = false;
        cancelAnimation(environmentDragUnlocked);
        environmentDragUnlocked.value = withDelay(
          todayScene.homeExplorationBackground.environmentDragActivationMs,
          withTiming(1, { duration: 0 }, (finished) => {
            if (!finished) return;
            environmentDragStarted.value = true;
            environmentDragOriginX.value = 0;
            translateX.value = withTiming(
              Math.max(
                -maxPan,
                Math.min(maxPan, gestureStartX.value + pendingTranslationX.value),
              ),
              { duration: 90 },
            );
          }),
        );
        environmentDragStarted.value = false;
        environmentDragOriginX.value = 0;
        pendingTranslationX.value = 0;
      })
      .onUpdate((event) => {
        pendingTranslationX.value = event.translationX;
        if (environmentDragUnlocked.value < 1) return;
        if (!environmentDragStarted.value) {
          environmentDragStarted.value = true;
          environmentDragOriginX.value = event.translationX;
          gestureStartX.value = translateX.value;
          return;
        }
        translateX.value = Math.max(
          -maxPan,
          Math.min(
            maxPan,
            gestureStartX.value + event.translationX - environmentDragOriginX.value,
          ),
        );
      })
      .onEnd((event) => {
        gestureEnded.value = true;
        const swipeDirection = environmentDragUnlocked.value >= 1
          ? null
          : resolveTodayExplorationSwipeDirection({
              minDistance: todayScene.homeExplorationBackground.quickSwipe.minDistance,
              minVelocity: todayScene.homeExplorationBackground.quickSwipe.minVelocity,
              translationX: event.translationX,
              velocityX: event.velocityX,
            });
        cancelAnimation(environmentDragUnlocked);
        environmentDragUnlocked.value = 0;
        environmentDragStarted.value = false;
        pendingTranslationX.value = 0;
        translateX.value = reduceMotion
          ? withTiming(0, { duration: 120 })
          : withSpring(0, spring);
        if (swipeDirection != null) runOnJS(onQuickSwipe)(swipeDirection);
      })
      .onFinalize(() => {
        if (gestureEnded.value) return;
        cancelAnimation(environmentDragUnlocked);
        environmentDragUnlocked.value = 0;
        environmentDragStarted.value = false;
        pendingTranslationX.value = 0;
        translateX.value = reduceMotion
          ? withTiming(0, { duration: 120 })
          : withSpring(0, spring);
      });
  }, [
      enabled,
      environmentDragOriginX,
      environmentDragStarted,
      environmentDragUnlocked,
      gestureEnded,
      gestureStartX,
      maxPan,
      onQuickSwipe,
      pendingTranslationX,
      reduceMotion,
      spring,
      translateX,
  ]);

  return {
    gesture,
    imageSize,
    maxPan,
    translateX,
  };
}

export function TodayExplorationBackground({
  backgroundKey,
  imageSize,
  translateX,
}: {
  backgroundKey: TodayExplorationBackgroundKey;
  imageSize: number;
  translateX: SharedValue<number>;
}) {
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const background = TODAY_EXPLORATION_BACKGROUND_SOURCES[backgroundKey];
  const panStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.imageFrame,
          {
            height: imageSize,
            left: (viewportWidth - imageSize) / 2,
            top: (viewportHeight - imageSize) / 2,
            width: imageSize,
          },
          panStyle,
        ]}>
        <Image
          allowDownscaling={false}
          cachePolicy="memory-disk"
          contentFit="fill"
          pointerEvents="none"
          priority="high"
          recyclingKey={background.recyclingKey}
          source={background.source}
          style={StyleSheet.absoluteFill}
          transition={0}
        />
      </Animated.View>
    </View>
  );
}

/** Keeps the egg and egg-anchored UI physically attached to the authored dais. */
export function TodayExplorationSceneLayer({
  children,
  translateX,
}: {
  children: ReactNode;
  translateX: SharedValue<number>;
}) {
  const panStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  return (
    <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, panStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  imageFrame: {
    position: 'absolute',
  },
});
