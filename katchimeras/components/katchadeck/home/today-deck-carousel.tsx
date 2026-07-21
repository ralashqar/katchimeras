import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import {
  CompactDailyCardSizeProvider,
  DailyCard,
  type DailyCardSize,
  frameRect,
  resolveCompactDailyCardSize,
} from '@/components/katchadeck/cards/daily-card';
import { OrnateCardFrame } from '@/components/katchadeck/cards/ornate-card-frame';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { HomeTimelineDay } from '@/types/home';
import {
  CARD_SCENE_TOP,
  COMPACT_CARD_SCENE_HEIGHT,
  COMPACT_CARD_STORY_HEIGHT,
  COMPACT_CARD_STORY_TOP,
} from '@/utils/daily-card-layout';

const eggBase = require('../../../assets/images/katchimeras/cutouts/egg-base.webp');

type TodayDeckCarouselProps = {
  activeContent: ReactNode;
  formingCountdown?: ReactNode;
  formingFooter?: ReactNode;
  frameActive?: boolean;
  days: HomeTimelineDay[];
  disabled?: boolean;
  maxCardHeight: number;
  onSelect: (dayId: string) => void;
  selectedId: string;
};

type DeckTrackCardProps = {
  accessibilityLabel?: string;
  active: boolean;
  children: ReactNode;
  cardIndex: number;
  cardSize: DailyCardSize;
  focusedIndex: SharedValue<number>;
  onPress?: () => void;
  stride: number;
};

const NAVIGATION_DISTANCE_RATIO = 0.48;
const SWIPE_DISTANCE = 54;
const SWIPE_VELOCITY = 520;
const DECK_SPRING = { damping: 20, mass: 0.82, stiffness: 190 } as const;

export function TodayDeckCarousel({ activeContent, formingCountdown, formingFooter, frameActive = false, days, disabled = false, maxCardHeight, onSelect, selectedId }: TodayDeckCarouselProps) {
  const { width: windowWidth } = useWindowDimensions();
  const cardSize = resolveCompactDailyCardSize(windowWidth, maxCardHeight);
  const stride = Math.min(210, Math.max(168, windowWidth * NAVIGATION_DISTANCE_RATIO));
  const initialIndex = Math.max(0, days.findIndex((day) => day.id === selectedId));
  const focusedIndex = useSharedValue(initialIndex);
  const gestureOriginIndex = useSharedValue(initialIndex);
  const gestureActive = useSharedValue(0);
  const pendingIndexRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  const selectedIndex = useMemo(() => days.findIndex((day) => day.id === selectedId), [days, selectedId]);
  const selected = selectedIndex >= 0 ? days[selectedIndex] : null;
  const todayHatched = days.some((day) => day.kind === 'day' && day.isToday && day.state === 'hatched');
  const maxNavigableIndex = Math.max(0, days.length - (todayHatched ? 1 : 2));

  useLayoutEffect(() => {
    if (selectedIndex < 0) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      focusedIndex.value = selectedIndex;
      gestureOriginIndex.value = selectedIndex;
      return;
    }
    if (pendingIndexRef.current === selectedIndex) {
      gestureOriginIndex.value = selectedIndex;
      return;
    }
    pendingIndexRef.current = null;
    focusedIndex.value = withSpring(selectedIndex, DECK_SPRING);
    gestureOriginIndex.value = selectedIndex;
  }, [focusedIndex, gestureOriginIndex, selectedIndex]);

  const beginNavigation = useCallback((targetIndex: number) => {
    const target = days[targetIndex];
    if (!target) return;
    pendingIndexRef.current = targetIndex;
    onSelect(target.id);
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  }, [days, onSelect]);

  const completeNavigation = useCallback((targetIndex: number) => {
    if (pendingIndexRef.current !== targetIndex) return;
    pendingIndexRef.current = null;
  }, []);

  const navigateToIndex = useCallback((targetIndex: number) => {
    if (disabled) return;
    const clampedTarget = Math.max(0, Math.min(maxNavigableIndex, targetIndex));
    if (clampedTarget === selectedIndex) {
      focusedIndex.value = withSpring(clampedTarget, DECK_SPRING);
      return;
    }
    beginNavigation(clampedTarget);
    focusedIndex.value = withSpring(clampedTarget, DECK_SPRING, () => {
      runOnJS(completeNavigation)(clampedTarget);
    });
  }, [beginNavigation, completeNavigation, disabled, focusedIndex, maxNavigableIndex, selectedIndex]);

  const swipeGesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetX([-18, 18])
      .failOffsetY([-16, 16])
      .enabled(!disabled)
      .onBegin(() => {
        gestureActive.value = 1;
        gestureOriginIndex.value = focusedIndex.value;
      })
      .onUpdate((event) => {
        if (gestureActive.value === 0) return;
        const rawIndex = gestureOriginIndex.value - event.translationX / stride;
        if (rawIndex < 0) focusedIndex.value = rawIndex * 0.18;
        else if (rawIndex > maxNavigableIndex) focusedIndex.value = maxNavigableIndex + (rawIndex - maxNavigableIndex) * 0.18;
        else focusedIndex.value = rawIndex;
      })
      .onEnd((event) => {
        if (gestureActive.value === 0) return;
        gestureActive.value = 0;
        const wantsPrevious = event.translationX > SWIPE_DISTANCE || event.velocityX > SWIPE_VELOCITY;
        const wantsNext = event.translationX < -SWIPE_DISTANCE || event.velocityX < -SWIPE_VELOCITY;
        const origin = Math.round(gestureOriginIndex.value);
        const requestedTarget = wantsPrevious ? origin - 1 : wantsNext ? origin + 1 : origin;
        const target = Math.max(0, Math.min(maxNavigableIndex, requestedTarget));
        if (target !== origin) runOnJS(beginNavigation)(target);
        focusedIndex.value = withSpring(target, DECK_SPRING, () => {
          if (target !== origin) runOnJS(completeNavigation)(target);
        });
      })
      .onFinalize(() => {
        if (gestureActive.value === 0) return;
        gestureActive.value = 0;
        focusedIndex.value = withSpring(gestureOriginIndex.value, DECK_SPRING);
      }),
    [beginNavigation, completeNavigation, disabled, focusedIndex, gestureActive, gestureOriginIndex, maxNavigableIndex, stride]
  );

  return (
    <CompactDailyCardSizeProvider size={cardSize}>
      <GestureDetector gesture={swipeGesture}>
        <View style={[styles.stage, { height: cardSize.height }]}>
          {days.map((day, cardIndex) => {
            const isSelected = day.id === selectedId;
            const isAdjacent = Math.abs(cardIndex - selectedIndex) === 1;
            const unlocked = day.kind !== 'tomorrow' || todayHatched;
            return (
              <DeckTrackCard
                key={day.id}
                accessibilityLabel={cardIndex < selectedIndex ? 'View previous day' : 'View next day'}
                active={isSelected}
                cardIndex={cardIndex}
                cardSize={cardSize}
                focusedIndex={focusedIndex}
                onPress={!disabled && isAdjacent && unlocked ? () => navigateToIndex(cardIndex) : undefined}
                stride={stride}>
                {isSelected ? (
                  frameActive && selected ? (
                    <PromiseCard
                      cardSize={cardSize}
                      countdownContent={selected.kind === 'day' && selected.isToday ? formingCountdown : undefined}
                      day={selected}
                      footerContent={selected.kind === 'day' && selected.isToday ? formingFooter : undefined}
                      locked={selected.kind === 'tomorrow' && !todayHatched}>
                      {activeContent}
                    </PromiseCard>
                  ) : activeContent
                ) : renderDeckPreview(day, cardSize, !unlocked)}
              </DeckTrackCard>
            );
          })}
        </View>
      </GestureDetector>
    </CompactDailyCardSizeProvider>
  );
}

function DeckTrackCard({ accessibilityLabel, active, children, cardIndex, cardSize, focusedIndex, onPress, stride }: DeckTrackCardProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const relativePosition = cardIndex - focusedIndex.value;
    const distance = Math.min(2, Math.abs(relativePosition));
    return {
      opacity: interpolate(distance, [0, 1, 1.72, 2], [1, 0.72, 0.05, 0]),
      transform: [
        { translateX: relativePosition * stride },
        { translateY: interpolate(distance, [0, 1, 2], [0, 26, 40]) },
        { rotate: `${interpolate(relativePosition, [-2, -1, 0, 1, 2], [-11, -8, 0, 8, 11])}deg` },
        { scale: interpolate(distance, [0, 1, 2], [1, 0.69, 0.56]) },
      ],
      zIndex: Math.round(interpolate(distance, [0, 2], [30, 1])),
    };
  }, [cardIndex, stride]);

  return (
    <Animated.View
      accessibilityElementsHidden={!active && !onPress}
      importantForAccessibility={!active && !onPress ? 'no-hide-descendants' : 'auto'}
      pointerEvents={active || onPress ? 'box-none' : 'none'}
      style={[styles.slot, { height: cardSize.height }, animatedStyle]}>
      <View
        accessibilityElementsHidden={Boolean(onPress)}
        importantForAccessibility={onPress ? 'no-hide-descendants' : 'auto'}
        pointerEvents={onPress ? 'none' : 'auto'}
        style={styles.cardHost}>
        {children}
      </View>
      {onPress ? (
        <Pressable
          accessibilityHint="Moves this day into the center"
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          onPress={onPress}
          style={[styles.cardHitTarget, { height: cardSize.height, width: cardSize.width }]}
        />
      ) : null}
    </Animated.View>
  );
}

function renderDeckPreview(day: HomeTimelineDay, cardSize: DailyCardSize, locked = false): ReactNode {
  if (day.kind === 'day' && day.state === 'hatched' && day.card) return <DailyCard card={day.card} compact frameSize={cardSize} />;
  return <PromiseCard cardSize={cardSize} day={day} locked={locked || day.kind === 'tomorrow'} />;
}

function PromiseCard({
  cardSize,
  children,
  countdownContent,
  day,
  footerContent,
  locked,
}: {
  cardSize: DailyCardSize;
  children?: ReactNode;
  countdownContent?: ReactNode;
  day: HomeTimelineDay;
  footerContent?: ReactNode;
  locked: boolean;
}) {
  const isTomorrow = day.kind === 'tomorrow';
  const label = isTomorrow ? 'TOMORROW' : day.isToday ? 'TODAY' : day.dayLabel.toUpperCase();
  const title = locked ? 'MYSTERY' : day.kind === 'day' && day.state === 'ready_to_hatch' ? 'READY TO HATCH' : 'KATCHIMERA EGG';
  const date = formatPromiseDate(day.isoDate);
  const scale = cardSize.scale;
  return (
    <OrnateCardFrame
      background={<PromiseScene countdownContent={countdownContent} locked={locked} scale={scale}>{children}</PromiseScene>}
      height={cardSize.height}
      variant="compact"
      width={cardSize.width}>
      <View style={[frameRect(scale, 52, 78, 158, 154), styles.promiseBadge]}>
        <IconSymbol color="#FFF0B1" name={locked ? 'moon.fill' : 'sparkles'} size={Math.max(15, 52 * scale)} />
      </View>
      <View style={[frameRect(scale, 66, 221, 139, 66), styles.centerBox]}>
        <ThemedText numberOfLines={1} style={[styles.frameText, { fontSize: 29 * scale, lineHeight: 35 * scale }]} lightColor="#FFF0C7" darkColor="#FFF0C7">{label}</ThemedText>
      </View>
      <View style={[frameRect(scale, 215, 83, 520, 130), styles.centerBox]}>
        <ThemedText adjustsFontSizeToFit minimumFontScale={0.62} numberOfLines={1} style={[styles.promiseTitle, { fontSize: 60 * scale, lineHeight: 69 * scale }]} lightColor="#3E6522" darkColor="#3E6522">{title}</ThemedText>
      </View>
      <View style={[frameRect(scale, 283, 235, 390, 63), styles.centerBox]}>
        <ThemedText numberOfLines={1} style={[styles.promiseRibbon, { fontSize: 35 * scale, lineHeight: 42 * scale }]} lightColor="#FFF7E8" darkColor="#FFF7E8">✦ {locked ? 'Arriving soon' : 'Forming today'} ✦</ThemedText>
      </View>
      <View style={[frameRect(scale, 746, 82, 140, 194), styles.promiseDate, { transform: [{ translateX: -6 * scale }, { translateY: -5 * scale }] }]}>
        <IconSymbol color="#70562E" name="calendar" size={Math.max(13, 42 * scale)} />
        <ThemedText style={[styles.frameText, { fontSize: 38 * scale, lineHeight: 39 * scale }]} lightColor="#59472E" darkColor="#59472E">{date.weekday}</ThemedText>
        <ThemedText style={[styles.promiseDateValue, { fontSize: 36 * scale, lineHeight: 38 * scale }]} lightColor="#59472E" darkColor="#59472E">{date.dayMonth}</ThemedText>
      </View>
      <View style={[frameRect(scale, 720, 329, 145, 184), styles.promiseTag]}>
        <IconSymbol color="#FFE4A1" name={locked ? 'moon.fill' : 'leaf.fill'} size={Math.max(11, 32 * scale)} />
        <ThemedText numberOfLines={2} style={[styles.promiseTagText, { fontSize: 27 * scale, lineHeight: 32 * scale }]} lightColor="#FFF0C7" darkColor="#FFF0C7">{locked ? 'Mystery Day' : 'Card Forming'}</ThemedText>
      </View>
      {footerContent ? (
        <View style={[frameRect(scale, 82, 1023, 777, 244), styles.promiseFooter]}>{footerContent}</View>
      ) : day.kind === 'day' && day.isToday ? null : (
        <View style={[frameRect(scale, 82, COMPACT_CARD_STORY_TOP, 777, COMPACT_CARD_STORY_HEIGHT), styles.centerBox]}>
          <ThemedText adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={2} style={[styles.promiseStory, { fontSize: 32 * scale, lineHeight: 38 * scale }]} lightColor="#6F5B3A" darkColor="#6F5B3A">❧ {locked ? 'Tomorrow’s mystery is gathering.' : 'Today’s card is forming.'} ❧</ThemedText>
        </View>
      )}
    </OrnateCardFrame>
  );
}

function PromiseScene({ children, countdownContent, locked, scale }: { children?: ReactNode; countdownContent?: ReactNode; locked: boolean; scale: number }) {
  return (
    <LinearGradient
      colors={locked ? ['#403B4D', '#1C1923'] : ['#DDE8B4', '#82A267']}
      style={[frameRect(scale, 53, CARD_SCENE_TOP, 835, COMPACT_CARD_SCENE_HEIGHT), styles.promiseScene, { borderRadius: 22 * scale }]}>
      {children && !locked ? (
        <View style={[styles.activeEggHost, { transform: [{ translateY: -28 * scale }, { scale: 0.84 }] }]}>{children}</View>
      ) : locked ? (
        <ThemedText type="display" style={[styles.questionMark, { fontSize: 190 * scale, lineHeight: 205 * scale }]} lightColor="#C8BED7" darkColor="#C8BED7">?</ThemedText>
      ) : (
        <Image cachePolicy="memory-disk" contentFit="contain" source={eggBase} style={styles.promiseEgg} transition={0} />
      )}
      {countdownContent && !locked ? (
        <View pointerEvents="none" style={[styles.promiseCountdown, { bottom: 18 * scale }]}>{countdownContent}</View>
      ) : null}
    </LinearGradient>
  );
}

function formatPromiseDate(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  return {
    dayMonth: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
  };
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center', overflow: 'visible', width: '100%' },
  slot: { alignItems: 'center', justifyContent: 'center', position: 'absolute', width: 330 },
  cardHost: { alignItems: 'center', justifyContent: 'center' },
  cardHitTarget: { alignSelf: 'center', position: 'absolute' },
  promiseBadge: { alignItems: 'center', justifyContent: 'center' },
  centerBox: { alignItems: 'center', justifyContent: 'center' },
  frameText: { fontFamily: 'Manrope', fontWeight: '900', textAlign: 'center', textAlignVertical: 'center' },
  promiseTitle: { fontFamily: 'Manrope', fontWeight: '900', letterSpacing: -1, textAlign: 'center', textAlignVertical: 'center' },
  promiseRibbon: { fontFamily: 'InstrumentSerif', fontStyle: 'italic', textAlign: 'center', textAlignVertical: 'center' },
  promiseDate: { alignItems: 'center', justifyContent: 'center' },
  promiseDateValue: { fontFamily: 'InstrumentSerif', fontWeight: '700', textAlign: 'center' },
  promiseTag: { alignItems: 'center', gap: 2, justifyContent: 'center' },
  promiseTagText: { fontFamily: 'InstrumentSerif', fontWeight: '700', textAlign: 'center' },
  promiseScene: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  activeEggHost: { alignItems: 'center', height: '100%', justifyContent: 'center', width: '100%', zIndex: 2 },
  promiseEgg: { height: '63%', transform: [{ translateY: -10 }], width: '69%', zIndex: 2 },
  promiseCountdown: { alignItems: 'center', left: 0, position: 'absolute', right: 0, zIndex: 5 },
  promiseFooter: { alignItems: 'center', justifyContent: 'center' },
  questionMark: { opacity: 0.82, zIndex: 2 },
  promiseStory: { fontFamily: 'InstrumentSerif', fontStyle: 'italic', fontWeight: '600', textAlign: 'center', textAlignVertical: 'center' },
});
