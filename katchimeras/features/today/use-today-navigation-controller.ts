import { useFocusEffect, useNavigation, type ParamListBase } from '@react-navigation/native';
import { type BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Gesture } from 'react-native-gesture-handler';
import {
  Easing,
  runOnJS,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import todayScene from '@/data/today-scene.json';
import { consumeCaptureFeed } from '@/utils/capture-feed-signal';
import { consumeSelectedDay } from '@/utils/selected-day-signal';
import type { HomeTimelineDay } from '@/types/home';
import { useScenePerformanceProbe } from '@/hooks/use-scene-performance-probe';
import {
  todayTileTransitionIndices,
  todayTileWindowIndices,
} from '@/utils/today-tile-window';
import type { TodayExplorationSwipeDirection } from '@/utils/today-exploration-gesture';
import { TODAY_GROWTH_REWARDS } from '@/utils/today-growth';

type UseTodayNavigationControllerParams = {
  windowWidth: number;
  windowHeight: number;
  selectedDayId: string;
  timelineDays: HomeTimelineDay[];
  isTodayHatched: boolean;
  isHatching: boolean;
  promptSheetOpen: boolean;
  comicOpen: boolean;
  deferCaptureRewardToCare?: boolean;
  selectTimelineDay: (dayId: string) => void;
  startEggFeed: (from: FeedSourceRect, payload: { energyAmount?: number; label?: string; photoUri?: string }, commit: () => void) => void;
};

export function useTodayNavigationController({
  windowWidth,
  windowHeight,
  selectedDayId,
  timelineDays,
  isTodayHatched,
  isHatching,
  promptSheetOpen,
  comicOpen,
  deferCaptureRewardToCare = false,
  selectTimelineDay,
  startEggFeed,
}: UseTodayNavigationControllerParams) {
  const navigation = useNavigation<BottomTabNavigationProp<ParamListBase>>();
  const reduceMotion = useReducedMotion();
  const initialIndex = Math.max(0, timelineDays.findIndex((day) => day.id === selectedDayId));
  const cameraProgress = useSharedValue(initialIndex);
  const cameraTransitionActive = useSharedValue(0);
  useScenePerformanceProbe('today-camera', cameraTransitionActive);
  const visualIndexRef = useRef(initialIndex);
  const transitionTokenRef = useRef(0);
  const [renderedIndices, setRenderedIndices] = useState(() =>
    todayTileWindowIndices(initialIndex, timelineDays.length)
  );

  const commitCameraSettled = useCallback((targetIndex: number) => {
    if (visualIndexRef.current !== targetIndex) return;
    setRenderedIndices(todayTileWindowIndices(targetIndex, timelineDays.length));
  }, [timelineDays.length]);

  const animateCameraTo = useCallback((targetIndex: number) => {
    const fromIndex = visualIndexRef.current;
    const transitionToken = transitionTokenRef.current + 1;
    transitionTokenRef.current = transitionToken;
    visualIndexRef.current = targetIndex;
    setRenderedIndices(todayTileTransitionIndices(fromIndex, targetIndex, timelineDays.length));

    const startCamera = () => {
      if (transitionTokenRef.current !== transitionToken) return;
      if (reduceMotion) {
        cameraTransitionActive.value = 0;
        cameraProgress.value = targetIndex;
        commitCameraSettled(targetIndex);
        return;
      }
      cameraTransitionActive.value = 1;
      cameraProgress.value = withTiming(targetIndex, {
          duration: todayScene.hexNeighborhood.cameraDurationMs,
          easing: Easing.out(Easing.cubic),
        }, (finished) => {
          if (finished) {
            cameraTransitionActive.value = 0;
            runOnJS(commitCameraSettled)(targetIndex);
          }
        });
    };

    // Adjacent targets are already in the settled three-tile window. A distant
    // top-bar jump first commits its temporary corridor, then starts the camera.
    if (Math.abs(targetIndex - fromIndex) > 1) {
      requestAnimationFrame(startCamera);
    } else {
      startCamera();
    }
  }, [cameraProgress, cameraTransitionActive, commitCameraSettled, reduceMotion, timelineDays.length]);

  const navigateToDay = useCallback((dayId: string) => {
    const targetIndex = timelineDays.findIndex((day) => day.id === dayId);
    if (targetIndex < 0) {
      // Archive selections outside the recent strip have a one-item scene.
      transitionTokenRef.current += 1;
      visualIndexRef.current = 0;
      cameraTransitionActive.value = 0;
      cameraProgress.value = 0;
      setRenderedIndices([0]);
    } else {
      animateCameraTo(targetIndex);
    }

    // The camera has already been scheduled on the UI thread. Mark the much
    // larger semantic day update as non-urgent so React/native tree work cannot
    // get ahead of the first movement frame.
    startTransition(() => selectTimelineDay(dayId));
  }, [animateCameraTo, cameraProgress, cameraTransitionActive, selectTimelineDay, timelineDays]);

  // Keep externally driven selections (reset, rollover, hydration repair) in
  // sync without restarting transitions initiated through navigateToDay.
  useEffect(() => {
    const selectedIndex = Math.max(0, timelineDays.findIndex((day) => day.id === selectedDayId));
    if (visualIndexRef.current === selectedIndex) return;
    animateCameraTo(selectedIndex);
  }, [animateCameraTo, selectedDayId, timelineDays]);

  useEffect(() => {
    const current = Math.max(0, Math.min(timelineDays.length - 1, visualIndexRef.current));
    visualIndexRef.current = current;
    setRenderedIndices(todayTileWindowIndices(current, timelineDays.length));
  }, [timelineDays.length]);

  const goToAdjacentDay = useCallback(
    (direction: TodayExplorationSwipeDirection) => {
      // Visual intent advances immediately even if the low-priority semantic
      // selection has not committed yet. Rapid consecutive swipes therefore
      // retarget from the in-flight destination instead of repeating a stale
      // selectedDayId.
      const index = visualIndexRef.current;
      if (index < 0) return;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= timelineDays.length) return;
      if (timelineDays[nextIndex].kind === 'tomorrow' && !isTodayHatched) return;
      navigateToDay(timelineDays[nextIndex].id);
    },
    [isTodayHatched, navigateToDay, timelineDays]
  );

  useFocusEffect(
    useCallback(() => {
      const feed = consumeCaptureFeed();
      if (!feed) {
        return;
      }
      // Capture routes already persisted their artifact. When they originated
      // from a care card, that card's shared completion row owns the visible
      // coin payout and outro after Today regains focus.
      if (deferCaptureRewardToCare) return;
      const from: FeedSourceRect = { x: windowWidth / 2 - 30, y: windowHeight - 150, w: 60, h: 60 };
      startEggFeed(from, { energyAmount: TODAY_GROWTH_REWARDS.photo, photoUri: feed.photoUri }, () => {});
    }, [deferCaptureRewardToCare, startEggFeed, windowHeight, windowWidth])
  );

  useFocusEffect(
    useCallback(() => {
      const pendingDayId = consumeSelectedDay();
      if (pendingDayId) {
        navigateToDay(pendingDayId);
      }
    }, [navigateToDay])
  );

  useEffect(() => {
    return navigation.addListener('tabPress', () => {
      if (!navigation.isFocused()) return;
      const todayId = timelineDays.find((day) => day.kind === 'day' && day.isToday)?.id;
      if (todayId && todayId !== selectedDayId) navigateToDay(todayId);
    });
  }, [navigateToDay, navigation, selectedDayId, timelineDays]);

  const swipeGesture = useMemo(() => Gesture.Pan()
    .maxPointers(1)
    .activeOffsetX([-24, 24])
    .failOffsetY([-18, 18])
    .enabled(!isHatching && !promptSheetOpen && !comicOpen)
    .onEnd((event) => {
      if (event.translationX > 60) {
        runOnJS(goToAdjacentDay)(-1);
      } else if (event.translationX < -60) {
        runOnJS(goToAdjacentDay)(1);
      }
    }), [comicOpen, goToAdjacentDay, isHatching, promptSheetOpen]);

  return {
    cameraProgress,
    goToAdjacentDay,
    navigateToDay,
    renderedIndices,
    swipeGesture,
  };
}
