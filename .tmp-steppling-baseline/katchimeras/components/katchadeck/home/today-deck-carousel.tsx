import { memo, Profiler, type ProfilerOnRenderCallback, type ReactNode, useCallback, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import {
  CompactDailyCardSizeProvider,
  DailyCard,
  type DailyCardSize,
  resolveCompactDailyCardSize,
} from '@/components/katchadeck/cards/daily-card';
import { DeckCardHitTarget, deckSlotStyles, DeckVisualSlot } from '@/components/katchadeck/home/today-deck/deck-slot';
import {
  allDeckIndices,
  isHatchTransitionActive,
  resolveDeckStride,
} from '@/components/katchadeck/home/today-deck/deck-navigation';
import { FormingEggItem } from '@/components/katchadeck/home/today-deck/forming-egg-item';
import { HatchCardTransition } from '@/components/katchadeck/home/today-deck/hatch-card-transition';
import { useDeckController } from '@/components/katchadeck/home/today-deck/use-deck-controller';
import { DECK_PERF_ENABLED, DeckPerformanceProbe } from '@/components/katchadeck/home/today-deck/use-deck-performance-probe';
import type { HomeTimelineDay } from '@/types/home';

type TodayDeckCarouselProps = {
  days: HomeTimelineDay[];
  disabled?: boolean;
  formingCountdown?: ReactNode;
  formingFooter?: ReactNode;
  hatchingDayId?: string | null;
  maxCardHeight: number;
  onOpenCard?: (cardId: string) => void;
  onSelect: (dayId: string) => void;
  promiseHeroTop?: number;
  renderFormingContent: (day: HomeTimelineDay, active: boolean, onRevealSettled?: () => void) => ReactNode;
  selectedId: string;
};

const reportDeckCommit: ProfilerOnRenderCallback = (_id, phase, actualDuration) => {
  if (DECK_PERF_ENABLED && actualDuration > 8) {
    console.warn('[today-deck] slow React commit', { actualDuration, phase });
  }
};

export function TodayDeckCarousel({
  days,
  disabled = false,
  formingCountdown,
  formingFooter,
  hatchingDayId,
  maxCardHeight,
  onOpenCard,
  onSelect,
  promiseHeroTop,
  renderFormingContent,
  selectedId,
}: TodayDeckCarouselProps) {
  const { width: windowWidth } = useWindowDimensions();
  const cardSize = useMemo(
    () => resolveCompactDailyCardSize(windowWidth, maxCardHeight),
    [maxCardHeight, windowWidth]
  );
  const stride = resolveDeckStride(windowWidth);
  const todayHatched = days.some((day) => day.kind === 'day' && day.isToday && day.state === 'hatched');
  const maxNavigableIndex = Math.max(0, days.length - (todayHatched ? 1 : 2));
  const {
    focusedIndex,
    navigateToIndex,
    swipeGesture,
    transitionActive,
  } = useDeckController({
    days,
    disabled,
    maxNavigableIndex,
    onSelect,
    selectedId,
    stride,
  });

  // Keep the complete deck mounted. The recent deck is deliberately small,
  // and stable card instances are more valuable here than virtualization:
  // returning to a distant card must never wait for its frame/art to remount.
  const deckIndices = useMemo(
    () => allDeckIndices(days.length),
    [days.length]
  );

  const deck = (
    <CompactDailyCardSizeProvider size={cardSize}>
        <DeckPerformanceProbe transitionActive={transitionActive} />
        <GestureDetector gesture={swipeGesture}>
          <View style={[styles.stage, { height: cardSize.height }]}>
          {deckIndices.map((cardIndex) => {
            const day = days[cardIndex];
            if (!day || shouldHideTomorrow(day, todayHatched)) return null;
            const active = day.id === selectedId;
            return (
              <DeckVisualSlot
                active={active}
                cardIndex={cardIndex}
                cardSize={cardSize}
                focusedIndex={focusedIndex}
                key={day.id}
                stride={stride}>
                <DeckItem
                  active={active}
                  cardSize={cardSize}
                  day={day}
                  formingCountdown={active ? formingCountdown : undefined}
                  formingFooter={active ? formingFooter : undefined}
                  hatchingDayId={hatchingDayId}
                  onOpenCard={onOpenCard}
                  promiseHeroTop={promiseHeroTop}
                  renderFormingContent={renderFormingContent}
                  renderTier={active ? 'focused' : 'neighbor'}
                  todayHatched={todayHatched}
                />
              </DeckVisualSlot>
            );
          })}
          <View pointerEvents="box-none" style={deckSlotStyles.hitLayer}>
            {deckIndices.map((cardIndex) => {
              const day = days[cardIndex];
              if (!day || day.id === selectedId || shouldHideTomorrow(day, todayHatched)) return null;
              return (
                <DeckCardHitTarget
                  accessibilityLabel={`View ${day.kind === 'tomorrow' ? 'tomorrow' : day.isoDate}`}
                  cardIndex={cardIndex}
                  cardSize={cardSize}
                  focusedIndex={focusedIndex}
                  key={`hit-${day.id}`}
                  onPress={() => navigateToIndex(cardIndex)}
                  stride={stride}
                />
              );
            })}
          </View>
          </View>
        </GestureDetector>
    </CompactDailyCardSizeProvider>
  );
  return DECK_PERF_ENABLED ? <Profiler id="today-deck" onRender={reportDeckCommit}>{deck}</Profiler> : deck;
}

const DeckItem = memo(function DeckItem({
  active,
  cardSize,
  day,
  formingCountdown,
  formingFooter,
  hatchingDayId,
  onOpenCard,
  promiseHeroTop,
  renderFormingContent,
  renderTier,
  todayHatched,
}: {
  active: boolean;
  cardSize: DailyCardSize;
  day: HomeTimelineDay;
  formingCountdown?: ReactNode;
  formingFooter?: ReactNode;
  hatchingDayId?: string | null;
  onOpenCard?: (cardId: string) => void;
  promiseHeroTop?: number;
  renderFormingContent: (day: HomeTimelineDay, active: boolean, onRevealSettled?: () => void) => ReactNode;
  renderTier: 'focused' | 'neighbor' | 'buffer';
  todayHatched: boolean;
}) {
  const cardId = day.kind === 'day' ? day.card?.id : undefined;
  const handleOpenCard = useCallback(() => {
    if (cardId && onOpenCard) onOpenCard(cardId);
  }, [cardId, onOpenCard]);

  if (isHatchTransitionActive({ active, dayId: day.id, hatchingDayId })) {
    return (
      <HatchCardTransition
        cardSize={cardSize}
        day={day}
        promiseHeroTop={promiseHeroTop}
        renderReveal={(onSettled) => renderFormingContent(day, active, onSettled)}
      />
    );
  }

  if (day.kind === 'day' && day.state === 'hatched' && day.card) {
    return (
      <DailyCard
        card={day.card}
        compact
        frameSize={cardSize}
        onPress={active && onOpenCard ? handleOpenCard : undefined}
        renderTier={renderTier}
        sceneArt="kingdom"
      />
    );
  }

  const locked = day.kind === 'tomorrow' && !todayHatched;
  return (
    <FormingEggItem
      cardSize={cardSize}
      countdownContent={active && day.kind === 'day' && day.isToday ? formingCountdown : undefined}
      footerContent={active ? formingFooter : undefined}
      heroTop={promiseHeroTop}
      locked={locked}>
      {renderFormingContent(day, active)}
    </FormingEggItem>
  );
});

function shouldHideTomorrow(day: HomeTimelineDay, todayHatched: boolean) {
  return day.kind === 'tomorrow' && !todayHatched;
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center', overflow: 'visible', width: '100%' },
});
