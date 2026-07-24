import { memo, useCallback, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useReducedMotion, ZoomInDown } from 'react-native-reanimated';

import {
  DailyCard,
  resolveCompactDailyCardSize,
  type DailyCardSize,
} from '@/components/katchadeck/cards/daily-card';
import {
  DeckCardHitTarget,
  deckSlotStyles,
  DeckVisualSlot,
} from '@/components/katchadeck/home/today-deck/deck-slot';
import { resolveDeckStride } from '@/components/katchadeck/home/today-deck/deck-navigation';
import { useDeckController } from '@/components/katchadeck/home/today-deck/use-deck-controller';
import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { DailyCreatureCard } from '@/types/home';
import { resolveCollectionDeckWindow } from '@/utils/collection-deck';

type CardDeckCarouselProps = {
  cards: readonly DailyCreatureCard[];
  onOpenCard: (cardId: string) => void;
};

const MAX_STAGE_CARD_HEIGHT = 480;
const STAGE_HEIGHT_RATIO = 0.57;
const WINDOW_RADIUS = 3;
const COMPACT_DECK_OFFSET_X = -10;
const COMPACT_DECK_OFFSET_Y = -8;

export function CardDeckCarousel({ cards, onOpenCard }: CardDeckCarouselProps) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [requestedCardId, setRequestedCardId] = useState(cards[0]?.id ?? '');
  const selectedCardId = cards.some((card) => card.id === requestedCardId)
    ? requestedCardId
    : cards[0]?.id ?? '';
  const selectedIndex = Math.max(0, cards.findIndex((card) => card.id === selectedCardId));
  const selectedCard = cards[selectedIndex];
  const cardSize = useMemo(
    () => resolveCompactDailyCardSize(
      windowWidth,
      Math.min(MAX_STAGE_CARD_HEIGHT, windowHeight * STAGE_HEIGHT_RATIO)
    ),
    [windowHeight, windowWidth]
  );
  const stride = resolveDeckStride(windowWidth);
  const {
    focusedIndex,
    navigateToIndex,
    swipeGesture,
  } = useDeckController({
    days: cards,
    disabled: cards.length < 2,
    maxNavigableIndex: Math.max(0, cards.length - 1),
    onSelect: setRequestedCardId,
    selectedId: selectedCardId,
    stride,
  });
  const deckIndices = useMemo(
    () => resolveCollectionDeckWindow(cards.length, selectedIndex, WINDOW_RADIUS),
    [cards.length, selectedIndex]
  );

  if (!selectedCard) return null;

  return (
    <View style={styles.carousel}>
      <GestureDetector gesture={swipeGesture}>
        <View style={[styles.stage, { height: cardSize.height + 18, width: windowWidth }]}>
          {deckIndices.map((cardIndex) => {
            const card = cards[cardIndex];
            if (!card) return null;
            const active = card.id === selectedCardId;
            return (
              <DeckVisualSlot
                active={active}
                cardIndex={cardIndex}
                cardSize={cardSize}
                focusedIndex={focusedIndex}
                key={card.id}
                stride={stride}>
                <Animated.View
                  entering={reduceMotion
                    ? undefined
                    : ZoomInDown
                      .delay(Math.min(90, Math.abs(cardIndex - selectedIndex) * 30))
                      .springify()
                      .damping(19)
                      .stiffness(220)
                      .mass(0.62)}
                  style={styles.cardEntrance}>
                  <CollectionDeckCard
                    active={active}
                    card={card}
                    cardSize={cardSize}
                    onOpenCard={onOpenCard}
                  />
                </Animated.View>
              </DeckVisualSlot>
            );
          })}

          <View pointerEvents="box-none" style={deckSlotStyles.hitLayer}>
            {deckIndices.map((cardIndex) => {
              const card = cards[cardIndex];
              if (!card || card.id === selectedCardId) return null;
              return (
                <DeckCardHitTarget
                  accessibilityLabel={`Center ${card.creatureName}'s card from ${card.isoDate}`}
                  cardIndex={cardIndex}
                  cardSize={cardSize}
                  focusedIndex={focusedIndex}
                  key={`hit-${card.id}`}
                  onPress={() => navigateToIndex(cardIndex)}
                  stride={stride}
                />
              );
            })}
          </View>
        </View>
      </GestureDetector>

      <View style={styles.caption}>
        <ThemedText
          style={styles.counter}
          lightColor={Lantern.ember300}
          darkColor={Lantern.ember300}>
          {selectedIndex + 1} / {cards.length}
        </ThemedText>
        <ThemedText
          numberOfLines={1}
          style={styles.captionTitle}
          lightColor={Lantern.moon50}
          darkColor={Lantern.moon50}>
          {selectedCard.creatureName}
        </ThemedText>
        <ThemedText
          style={styles.hint}
          lightColor={Lantern.moon500}
          darkColor={Lantern.moon500}>
          Swipe through your deck · Tap the centred card to open
        </ThemedText>
      </View>
    </View>
  );
}

const CollectionDeckCard = memo(function CollectionDeckCard({
  active,
  card,
  cardSize,
  onOpenCard,
}: {
  active: boolean;
  card: DailyCreatureCard;
  cardSize: DailyCardSize;
  onOpenCard: (cardId: string) => void;
}) {
  const handleOpen = useCallback(() => onOpenCard(card.id), [card.id, onOpenCard]);
  return (
    <DailyCard
      card={card}
      compact
      frameSize={cardSize}
      onPress={active ? handleOpen : undefined}
      renderTier={active ? 'focused' : 'neighbor'}
      sceneArt="kingdom"
    />
  );
});

const styles = StyleSheet.create({
  carousel: { alignItems: 'center', gap: 10 },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    transform: [
      { translateX: COMPACT_DECK_OFFSET_X },
      { translateY: COMPACT_DECK_OFFSET_Y },
    ],
  },
  cardEntrance: { alignItems: 'center', justifyContent: 'center' },
  caption: { alignItems: 'center', gap: 3, paddingHorizontal: 24 },
  counter: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  captionTitle: { fontSize: 16, fontWeight: '900', lineHeight: 20 },
  hint: { fontSize: 12, fontWeight: '700', lineHeight: 16, textAlign: 'center' },
});
