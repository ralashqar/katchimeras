import { useFocusEffect, useNavigation, type ParamListBase } from '@react-navigation/native';
import { type BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useCallback, useEffect } from 'react';

import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
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

  const goToAdjacentDay = useCallback(
    (direction: number) => {
      const index = timelineDays.findIndex((day) => day.id === selectedDayId);
      if (index < 0) return;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= timelineDays.length) return;
      if (timelineDays[nextIndex].kind === 'tomorrow' && !isTodayHatched) return;
      selectTimelineDay(timelineDays[nextIndex].id);
    },
    [isTodayHatched, selectTimelineDay, selectedDayId, timelineDays]
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
        selectTimelineDay(pendingDayId);
      }
    }, [selectTimelineDay])
  );

  useEffect(() => {
    return navigation.addListener('tabPress', () => {
      if (!navigation.isFocused()) return;
      const todayId = timelineDays.find((day) => day.kind === 'day' && day.isToday)?.id;
      if (todayId && todayId !== selectedDayId) selectTimelineDay(todayId);
    });
  }, [navigation, selectTimelineDay, selectedDayId, timelineDays]);

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

  return { swipeGesture };
}
