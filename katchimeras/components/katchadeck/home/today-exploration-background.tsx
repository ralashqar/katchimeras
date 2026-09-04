import { Image } from 'expo-image';
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import todayScene from '@/data/today-scene.json';
import { useExplorationEnvironmentProgressionStage } from '@/components/katchadeck/home/exploration-environment-progression-context';
import { EXPLORATION_ENVIRONMENT_PROGRESSION_SOURCES } from '@/constants/exploration-environment-progression-sources';
import {
  resolveTodayExplorationDragTranslation,
  resolveTodayExplorationSwipeDirection,
  resolveTodayExplorationTransitionDuration,
  resolveTodayExplorationTransitionOpacity,
  type TodayExplorationSwipeDirection,
  type TodayExplorationTransitionRole,
} from '@/utils/today-exploration-gesture';
import type { TodayExplorationBackgroundKey } from '@/utils/today-exploration-backgrounds';
import { TODAY_EXPLORATION_BACKGROUND_SOURCES } from '@/constants/today-exploration-background-sources.gen';

type TodayExplorationBackgroundMotionOptions = {
  activeKey?: string | null;
  canSwipeNext?: boolean;
  canSwipePrevious?: boolean;
  enabled: boolean;
  frozen?: boolean;
  onQuickSwipe: (direction: TodayExplorationSwipeDirection) => void;
  onTransitionStart?: (direction: TodayExplorationSwipeDirection) => void;
  pageTransitionEnabled?: boolean;
};

export function useTodayExplorationBackgroundMotion({
  activeKey,
  canSwipeNext = true,
  canSwipePrevious = true,
  enabled,
  frozen = false,
  onQuickSwipe,
  onTransitionStart,
  pageTransitionEnabled = false,
}: TodayExplorationBackgroundMotionOptions) {
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const gestureStartX = useSharedValue(0);
  const gestureEnded = useSharedValue(false);
  const gestureIgnored = useSharedValue(false);
  const transitionActive = useSharedValue(0);
  const transitionDirection = useSharedValue(0);
  const transitionProgress = useSharedValue(0);
  const transitionStartX = useSharedValue(0);
  const previousActiveKey = useRef(activeKey);
  const imageSize = Math.max(viewportHeight, viewportWidth);
  const maxPan = Math.max(0, (imageSize - viewportWidth) / 2);
  const spring = todayScene.homeExplorationBackground.resetSpring;
  const visualTranslateX = useDerivedValue(() => {
    if (transitionActive.value === 0 || transitionDirection.value === 0) {
      return translateX.value;
    }
    const targetX = -transitionDirection.value * viewportWidth;
    return transitionStartX.value
      + (targetX - transitionStartX.value) * transitionProgress.value;
  });

  const resetAfterCommit = useCallback(() => {
    cancelAnimation(transitionProgress);
    transitionActive.value = 0;
    transitionDirection.value = 0;
    transitionProgress.value = 0;
    transitionStartX.value = 0;
    translateX.value = 0;
  }, [
    transitionActive,
    transitionDirection,
    transitionProgress,
    transitionStartX,
    translateX,
  ]);

  useEffect(() => {
    if (previousActiveKey.current === activeKey) return;
    previousActiveKey.current = activeKey;
    cancelAnimation(translateX);
    cancelAnimation(transitionProgress);
    transitionActive.value = 0;
    transitionDirection.value = 0;
    transitionProgress.value = 0;
    transitionStartX.value = 0;
    translateX.value = 0;
  }, [
    activeKey,
    transitionActive,
    transitionDirection,
    transitionProgress,
    transitionStartX,
    translateX,
  ]);

  useEffect(() => {
    if (frozen) {
      cancelAnimation(translateX);
      cancelAnimation(transitionProgress);
      transitionActive.value = 0;
      transitionDirection.value = 0;
      transitionProgress.value = 0;
      transitionStartX.value = translateX.value;
      return;
    }
    if (enabled) return;
    cancelAnimation(translateX);
    cancelAnimation(transitionProgress);
    transitionActive.value = 0;
    transitionDirection.value = 0;
    transitionProgress.value = 0;
    transitionStartX.value = 0;
    translateX.value = reduceMotion
      ? withTiming(0, { duration: 120 })
      : withSpring(0, spring);
  }, [
    enabled,
    frozen,
    reduceMotion,
    spring,
    transitionActive,
    transitionDirection,
    transitionProgress,
    transitionStartX,
    translateX,
  ]);

  const gesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(enabled && !frozen && maxPan > 0)
      .maxPointers(1)
      .activeOffsetX([-1, 1])
      .failOffsetY([-20, 20])
      .onBegin(() => {
        if (transitionActive.value > 0) {
          gestureIgnored.value = true;
          return;
        }
        gestureIgnored.value = false;
        cancelAnimation(translateX);
        cancelAnimation(transitionProgress);
        gestureStartX.value = translateX.value;
        gestureEnded.value = false;
        transitionActive.value = 0;
        transitionDirection.value = 0;
        transitionProgress.value = 0;
        transitionStartX.value = 0;
      })
      .onUpdate((event) => {
        if (gestureIgnored.value || transitionActive.value > 0) return;
        translateX.value = resolveTodayExplorationDragTranslation({
          gestureStartX: gestureStartX.value,
          maxPan,
          // Overscroll was useful when a flick could transition to another
          // day. In camera-pan-only mode it can expose the edge of the square
          // cinematic environment, so stop exactly at the coverage boundary.
          overscrollResistance: pageTransitionEnabled
            ? todayScene.homeExplorationBackground.overscrollResistance
            : 0,
          translationX: event.translationX,
        });
      })
      .onEnd((event) => {
        if (gestureIgnored.value) {
          gestureIgnored.value = false;
          return;
        }
        gestureEnded.value = true;
        const swipeDirection = resolveTodayExplorationSwipeDirection({
          minDistance: todayScene.homeExplorationBackground.quickSwipe.minDistance,
          minVelocity: todayScene.homeExplorationBackground.quickSwipe.minVelocity,
          translationX: event.translationX,
          velocityX: event.velocityX,
        });
        const swipeAllowed = swipeDirection === -1
          ? canSwipePrevious
          : swipeDirection === 1
          ? canSwipeNext
          : false;

        if (swipeDirection != null && swipeAllowed) {
          if (!pageTransitionEnabled || reduceMotion) {
            transitionActive.value = 0;
            transitionDirection.value = 0;
            transitionProgress.value = 0;
            translateX.value = reduceMotion
              ? withTiming(0, { duration: 80 })
              : withSpring(0, spring);
            runOnJS(onQuickSwipe)(swipeDirection);
            return;
          }
          transitionActive.value = 1;
          transitionDirection.value = swipeDirection;
          transitionProgress.value = 0;
          transitionStartX.value = translateX.value;
          if (onTransitionStart) {
            runOnJS(onTransitionStart)(swipeDirection);
          }
          const targetX = -swipeDirection * viewportWidth;
          const transitionConfig = {
            duration: resolveTodayExplorationTransitionDuration({
              currentX: transitionStartX.value,
              targetX,
            }),
            easing: Easing.out(Easing.cubic),
          };
          transitionProgress.value = withTiming(
            1,
            transitionConfig,
            (finished) => {
              if (finished) runOnJS(onQuickSwipe)(swipeDirection);
            },
          );
          return;
        }

        transitionActive.value = 0;
        transitionDirection.value = 0;
        transitionProgress.value = 0;
        transitionStartX.value = 0;
        translateX.value = reduceMotion
          ? withTiming(0, { duration: 120 })
          : withSpring(0, spring);
      })
      .onFinalize(() => {
        if (gestureIgnored.value) {
          gestureIgnored.value = false;
          return;
        }
        if (gestureEnded.value) return;
        transitionActive.value = 0;
        transitionDirection.value = 0;
        transitionProgress.value = 0;
        transitionStartX.value = 0;
        translateX.value = reduceMotion
          ? withTiming(0, { duration: 120 })
          : withSpring(0, spring);
      });
  }, [
      canSwipeNext,
      canSwipePrevious,
      enabled,
      frozen,
      gestureEnded,
      gestureIgnored,
      gestureStartX,
      maxPan,
      onQuickSwipe,
      onTransitionStart,
      pageTransitionEnabled,
      reduceMotion,
      spring,
      translateX,
      transitionActive,
      transitionDirection,
      transitionProgress,
      transitionStartX,
      viewportWidth,
  ]);

  return {
    gesture,
    imageSize,
    maxPan,
    resetAfterCommit,
    transitionActive,
    transitionDirection,
    transitionProgress,
    translateX: visualTranslateX,
  };
}

export function TodayExplorationBackground({
  backgroundKey,
  contentFit = 'fill',
  environmentStage,
  imageSize,
  onDisplay,
  onError,
  onLoad,
  translateX,
  verticalOffset = 0,
}: {
  backgroundKey: TodayExplorationBackgroundKey;
  contentFit?: 'cover' | 'fill';
  environmentStage?: number | null;
  imageSize: number;
  onDisplay?: () => void;
  onError?: (error: string) => void;
  onLoad?: () => void;
  translateX?: SharedValue<number>;
  verticalOffset?: number;
}) {
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const inheritedEnvironmentStage = useExplorationEnvironmentProgressionStage();
  const selectedEnvironmentStage = environmentStage ?? inheritedEnvironmentStage;
  const progression = backgroundKey === 'home'
    ? undefined
    : EXPLORATION_ENVIRONMENT_PROGRESSION_SOURCES[backgroundKey];
  const progressionStage = selectedEnvironmentStage != null && progression && progression.length > 0
    ? Math.max(0, Math.min(progression.length - 1, Math.round(selectedEnvironmentStage)))
    : null;
  const progressionSource = progressionStage == null || !progression
    ? null
    : progression[progressionStage];
  const background = progressionSource
    ? {
        recyclingKey: `today-${backgroundKey}-exploration-stage-${progressionStage}-${imageSize > 1100 ? 'full' : 'medium'}`,
        source: imageSize > 1100 ? progressionSource.full : progressionSource.medium,
      }
    : TODAY_EXPLORATION_BACKGROUND_SOURCES[backgroundKey];
  const panStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX?.value ?? 0 }],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.imageFrame,
          {
            height: imageSize,
            left: (viewportWidth - imageSize) / 2,
            top: (viewportHeight - imageSize) / 2 + verticalOffset,
            width: imageSize,
          },
          panStyle,
        ]}>
        <Image
          allowDownscaling
          cachePolicy="disk"
          contentFit={contentFit}
          enforceEarlyResizing
          pointerEvents="none"
          priority="high"
          onDisplay={onDisplay}
          onError={(event) => onError?.(event.error)}
          onLoad={onLoad}
          recyclingKey={background.recyclingKey}
          source={background.source}
          style={StyleSheet.absoluteFill}
          transition={0}
        />
      </Animated.View>
    </View>
  );
}

export function TodayExplorationPageLayer({
  baseOffsetX = 0,
  children,
  hidden = false,
  holdCentered = false,
  pageDirection,
  transitionDirection,
  transitionProgress,
  transitionRole = 'static',
  translateX,
}: {
  baseOffsetX?: number;
  children: ReactNode;
  hidden?: boolean;
  holdCentered?: boolean;
  pageDirection?: TodayExplorationSwipeDirection;
  transitionDirection?: SharedValue<number>;
  transitionProgress?: SharedValue<number>;
  transitionRole?: TodayExplorationTransitionRole;
  translateX: SharedValue<number>;
}) {
  const pageStyle = useAnimatedStyle(() => {
    const progress = transitionProgress?.value ?? 0;
    const isSelectedIncomingPage =
      transitionRole === 'incoming'
      && transitionDirection?.value === pageDirection;
    if (hidden) {
      return {
        opacity: 0,
        transform: [{ translateX: baseOffsetX + translateX.value }],
        zIndex: 0,
      };
    }
    if (holdCentered) {
      return {
        opacity: 1,
        transform: [{ translateX: 0 }],
        zIndex: 3,
      };
    }
    return {
      opacity: resolveTodayExplorationTransitionOpacity({
        plane: 'background',
        progress,
        role: transitionRole,
        selectedIncoming: isSelectedIncomingPage,
      }),
      transform: [{ translateX: baseOffsetX + translateX.value }],
      zIndex: transitionRole === 'incoming'
        ? isSelectedIncomingPage
          ? 3
          : 0
        : transitionRole === 'current'
        ? 1
        : 0,
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, pageStyle]}>
      {children}
    </Animated.View>
  );
}

/** Keeps the egg and egg-anchored UI physically attached to the authored dais. */
export function TodayExplorationSceneLayer({
  baseOffsetX = 0,
  children,
  hidden = false,
  holdCentered = false,
  interactive,
  pageDirection,
  transitionDirection,
  transitionProgress,
  transitionRole = 'static',
  translateX,
}: {
  baseOffsetX?: number;
  children: ReactNode;
  hidden?: boolean;
  holdCentered?: boolean;
  interactive?: boolean;
  pageDirection?: TodayExplorationSwipeDirection;
  transitionDirection?: SharedValue<number>;
  transitionProgress?: SharedValue<number>;
  transitionRole?: TodayExplorationTransitionRole;
  translateX: SharedValue<number>;
}) {
  const panStyle = useAnimatedStyle(() => {
    const progress = transitionProgress?.value ?? 0;
    const isSelectedIncomingPage =
      transitionRole === 'incoming'
      && transitionDirection?.value === pageDirection;
    if (hidden) {
      return {
        opacity: 0,
        transform: [{ translateX: baseOffsetX + translateX.value }],
        zIndex: 0,
      };
    }
    if (holdCentered) {
      return {
        opacity: 1,
        transform: [{ translateX: 0 }],
        zIndex: 3,
      };
    }
    return {
      opacity: resolveTodayExplorationTransitionOpacity({
        plane: 'subject',
        progress,
        role: transitionRole,
        selectedIncoming: isSelectedIncomingPage,
      }),
      transform: [{ translateX: baseOffsetX + translateX.value }],
      zIndex: transitionRole === 'incoming'
        ? isSelectedIncomingPage
          ? 3
          : 0
        : transitionRole === 'current'
        ? 1
        : 0,
    };
  });
  const receivesPointerEvents =
    interactive ?? transitionRole !== 'incoming';
  return (
    <Animated.View
      pointerEvents={receivesPointerEvents ? 'box-none' : 'none'}
      style={[StyleSheet.absoluteFill, panStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  imageFrame: {
    position: 'absolute',
  },
});
