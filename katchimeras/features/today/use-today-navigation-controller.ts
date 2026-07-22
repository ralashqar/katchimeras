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
import { startTransition, useCallback, useEffect, useRef } from 'react';

import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import todayScene from '@/data/today-scene.json';
import { consumeCaptureFeed } from '@/utils/capture-feed-signal';
import { consumeSelectedDay } from '@/utils/selected-day-signal';
import type { HomeTimelineDay } from '@/types/home';

type UseTodayNavigationControllerParams = {
  windowWidth: number;
  windowHeight: number;
  selectedDayId: string;
  timelineDays: HomeTimelineDay[];
  isTodayHatched: boolean;
  isHatching: boolean;
  promptSheetOpen: boolean;
  comicOpen: boolean;
  selectTimelineDay: (dayId: string) => void;
  startEggFeed: (from: FeedSourceRect, payload: { label?: string; photoUri?: string }, commit: () => void) => void;
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
  selectTimelineDay,
  startEggFeed,
}: UseTodayNavigationControllerParams) {
  const navigation = useNavigation<BottomTabNavigationProp<ParamListBase>>();
  const reduceMotion = useReducedMotion();
  const initialIndex = Math.max(0, timelineDays.findIndex((day) => day.id === selectedDayId));
  const cameraProgress = useSharedValue(initialIndex);
  const visualIndexRef = useRef(initialIndex);

  const animateCameraTo = useCallback((targetIndex: number) => {
    visualIndexRef.current = targetIndex;
    cameraProgress.value = reduceMotion
      ? targetIndex
      : withTiming(targetIndex, {
          duration: todayScene.hexNeighborhood.cameraDurationMs,
          easing: Easing.out(Easing.cubic),
        });
  }, [cameraProgress, reduceMotion]);

  const navigateToDay = useCallback((dayId: string) => {
    const targetIndex = timelineDays.findIndex((day) => day.id === dayId);
    if (targetIndex < 0) {
      // Archive selections outside the recent strip have a one-item scene.
      visualIndexRef.current = 0;
      cameraProgress.value = 0;
    } else {
      animateCameraTo(targetIndex);
    }

    // The camera has already been scheduled on the UI thread. Mark the much
    // larger semantic day update as non-urgent so React/native tree work cannot
    // get ahead of the first movement frame.
    startTransition(() => selectTimelineDay(dayId));
  }, [animateCameraTo, cameraProgress, selectTimelineDay, timelineDays]);

  // Keep externally driven selections (reset, rollover, hydration repair) in
  // sync without restarting transitions initiated through navigateToDay.
  useEffect(() => {
    const selectedIndex = Math.max(0, timelineDays.findIndex((day) => day.id === selectedDayId));
    if (visualIndexRef.current === selectedIndex) return;
    animateCameraTo(selectedIndex);
  }, [animateCameraTo, selectedDayId, timelineDays]);

  const goToAdjacentDay = useCallback(
    (direction: number) => {
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
      const from: FeedSourceRect = { x: windowWidth / 2 - 30, y: windowHeight - 150, w: 60, h: 60 };
      startEggFeed(from, { photoUri: feed.photoUri }, () => {});
    }, [startEggFeed, windowHeight, windowWidth])
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

  const swipeGesture = Gesture.Pan()
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
    });

  return { cameraProgress, navigateToDay, swipeGesture };
}
