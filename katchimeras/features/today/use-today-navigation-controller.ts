import { useFocusEffect, useNavigation, type ParamListBase } from '@react-navigation/native';
import { type BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
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
  selectTimelineDay: (dayId: string) => void;
  startEggFeed: (from: FeedSourceRect, payload: { label?: string; photoUri?: string }, commit: () => void) => void;
};

export function useTodayNavigationController({
  windowWidth,
  windowHeight,
  selectedDayId,
  timelineDays,
  selectTimelineDay,
  startEggFeed,
}: UseTodayNavigationControllerParams) {
  const navigation = useNavigation<BottomTabNavigationProp<ParamListBase>>();

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

  return null;
}
