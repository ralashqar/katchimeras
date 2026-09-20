import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { DeckCardHitTarget, deckSlotStyles, DeckVisualSlot } from '@/components/katchadeck/home/today-deck/deck-slot';
import { resolveDeckStride } from '@/components/katchadeck/home/today-deck/deck-navigation';
import { useDeckController } from '@/components/katchadeck/home/today-deck/use-deck-controller';
import { resolveCollectionDeckWindow } from '@/utils/collection-deck';
import type { DailyCardSize } from '@/utils/daily-card-layout';
import { ThemedText } from '@/components/themed-text';

/** Friend sets and Wisp packs share geometry, gestures, snapping and hit targets. */
export function CollectibleCardDeck<T extends { id: string }>({ cards, selectedId, onSelect, renderCard, renderCaption, maxCardHeight = 430, cardRatio = 0.7, navigationLabel = 'cards' }: {
  cards: readonly T[]; selectedId: string; onSelect: (card: T, index: number) => void;
  renderCard: (card: T, index: number, size: DailyCardSize, active: boolean) => ReactNode;
  renderCaption?: (card: T, index: number) => ReactNode;
  maxCardHeight?: number; cardRatio?: number; navigationLabel?: string;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const selectedIndex = Math.max(0, cards.findIndex(card => card.id === selectedId));
  const selectedCard = cards[selectedIndex];
  const cardSize = useMemo<DailyCardSize>(() => {
    const width = Math.min(286, Math.max(160, windowWidth - 92), maxCardHeight * cardRatio);
    return { width, height: width / cardRatio, scale: width / 941 };
  }, [cardRatio, maxCardHeight, windowWidth]);
  const stride = resolveDeckStride(windowWidth);
  const { focusedIndex, navigateToIndex, swipeGesture } = useDeckController({
    days: cards, disabled: cards.length < 2, maxNavigableIndex: Math.max(0, cards.length - 1),
    onSelect: id => { const index = cards.findIndex(card => card.id === id); if (index >= 0) onSelect(cards[index], index); },
    selectedId: selectedCard?.id ?? '', stride,
  });
  const indices = resolveCollectionDeckWindow(cards.length, selectedIndex, 3);
  if (!selectedCard) return null;
  return <View style={styles.carousel}>
    <GestureDetector gesture={swipeGesture}>
      <View style={{ height: cardSize.height + 16, width: windowWidth, alignItems: 'center', justifyContent: 'center' }}>
        {indices.map(index => <DeckVisualSlot key={cards[index].id} active={index === selectedIndex} cardIndex={index} cardSize={cardSize} focusedIndex={focusedIndex} stride={stride}>
          {renderCard(cards[index], index, cardSize, index === selectedIndex)}
        </DeckVisualSlot>)}
        <View pointerEvents="box-none" style={deckSlotStyles.hitLayer}>
          {indices.filter(index => index !== selectedIndex).map(index => <DeckCardHitTarget key={`hit:${cards[index].id}`} accessibilityLabel={`Center ${navigationLabel} card ${index + 1}`} cardIndex={index} cardSize={cardSize} focusedIndex={focusedIndex} onPress={() => navigateToIndex(index)} stride={stride} />)}
        </View>
      </View>
    </GestureDetector>
    {cards.length > 1 ? <View style={styles.navigation}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous card" disabled={selectedIndex === 0} onPress={() => navigateToIndex(selectedIndex - 1)} style={styles.arrow}><ThemedText lightColor="#9D7730" darkColor="#F0CF77" style={{ opacity: selectedIndex === 0 ? 0.25 : 1 }}>‹</ThemedText></Pressable>
      <ThemedText lightColor="#9D7730" darkColor="#F0CF77" accessibilityLiveRegion="polite" style={styles.counter}>{selectedIndex + 1} / {cards.length}</ThemedText>
      <Pressable accessibilityRole="button" accessibilityLabel="Next card" disabled={selectedIndex === cards.length - 1} onPress={() => navigateToIndex(selectedIndex + 1)} style={styles.arrow}><ThemedText lightColor="#9D7730" darkColor="#F0CF77" style={{ opacity: selectedIndex === cards.length - 1 ? 0.25 : 1 }}>›</ThemedText></Pressable>
    </View> : null}
    {renderCaption?.(selectedCard, selectedIndex)}
  </View>;
}
const styles = StyleSheet.create({
  carousel: { alignItems: 'center', gap: 7 }, navigation: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, counter: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
