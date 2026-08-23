import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp, useReducedMotion } from 'react-native-reanimated';

import {
  DeckCardHitTarget,
  deckSlotStyles,
  DeckVisualSlot,
} from '@/components/katchadeck/home/today-deck/deck-slot';
import { resolveDeckStride } from '@/components/katchadeck/home/today-deck/deck-navigation';
import { useDeckController } from '@/components/katchadeck/home/today-deck/use-deck-controller';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getCreatureVisual } from '@/game/days';
import type { KatchimeraCardOption } from '@/hooks/use-katchimera-cards';
import type { KatchimeraSkinId } from '@/types/katchimera';
import type { DailyCardSize } from '@/utils/daily-card-layout';
import { resolveCollectionDeckWindow } from '@/utils/collection-deck';

type KatchimeraCardDeckCarouselProps = {
  cards: readonly KatchimeraCardOption[];
  initialCardId?: KatchimeraSkinId;
  maxCardHeight?: number;
};

const WINDOW_RADIUS = 3;
const CARD_RATIO = 0.7;

const BOTANICAL_LINES: Partial<Record<KatchimeraSkinId, string>> = {
  mossprout: 'Keeper of the shared patch',
  petalimp: 'Finds colour in every growing thing',
  fernip: 'Makes a home beneath quiet leaves',
  blossle: 'Tends beginnings with gentle care',
  amberleaf: 'Keeps the garden’s changing seasons',
  drizzlet: 'Welcomes the garden’s first rain',
  mistle: 'Notices what the morning mist reveals',
  driftkin: 'Keeps watch through the cold months',
  tempesto: 'Helps the grove weather every storm',
};

export function KatchimeraCardDeckCarousel({ cards, initialCardId, maxCardHeight = 430 }: KatchimeraCardDeckCarouselProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [requestedCardId, setRequestedCardId] = useState<KatchimeraSkinId | ''>(() => (
    cards.some((card) => card.id === initialCardId) ? initialCardId! : cards.find((card) => card.owned)?.id ?? cards[0]?.id ?? ''
  ));
  const selectedCardId = cards.some((card) => card.id === requestedCardId)
    ? requestedCardId
    : cards[0]?.id ?? '';
  const selectedIndex = Math.max(0, cards.findIndex((card) => card.id === selectedCardId));
  const selectedCard = cards[selectedIndex];
  const cardSize = useMemo<DailyCardSize>(() => {
    const width = Math.min(286, Math.max(210, windowWidth - 92), maxCardHeight * CARD_RATIO);
    return { width, height: width / CARD_RATIO, scale: width / 941 };
  }, [maxCardHeight, windowWidth]);
  const stride = resolveDeckStride(windowWidth);
  const { focusedIndex, navigateToIndex, swipeGesture } = useDeckController({
    days: cards,
    disabled: cards.length < 2,
    maxNavigableIndex: Math.max(0, cards.length - 1),
    onSelect: (id) => setRequestedCardId(id as KatchimeraSkinId),
    selectedId: selectedCardId,
    stride,
  });
  const deckIndices = useMemo(
    () => resolveCollectionDeckWindow(cards.length, selectedIndex, WINDOW_RADIUS),
    [cards.length, selectedIndex],
  );

  if (!selectedCard) return null;

  return (
    <View style={styles.carousel}>
      <GestureDetector gesture={swipeGesture}>
        <View style={[styles.stage, { height: cardSize.height + 16, width: windowWidth }]}>
          {deckIndices.map((cardIndex) => {
            const card = cards[cardIndex];
            if (!card) return null;
            const active = card.id === selectedCardId;
            return (
              <DeckVisualSlot active={active} cardIndex={cardIndex} cardSize={cardSize} focusedIndex={focusedIndex} key={card.id} stride={stride}>
                <KatchimeraCollectionCard card={card} cardNumber={cardIndex + 1} cardSize={cardSize} />
              </DeckVisualSlot>
            );
          })}
          <View pointerEvents="box-none" style={deckSlotStyles.hitLayer}>
            {deckIndices.map((cardIndex) => {
              const card = cards[cardIndex];
              if (!card || card.id === selectedCardId) return null;
              return (
                <DeckCardHitTarget
                  accessibilityLabel={`Center card ${cardIndex + 1}`}
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
        <ThemedText style={styles.counter} lightColor="#D0A43B" darkColor="#F0CF77">{selectedIndex + 1} / {cards.length}</ThemedText>
        <ThemedText style={styles.captionTitle} lightColor="#2F3A25" darkColor="#FFF5D8">{selectedCard.owned ? selectedCard.displayName : 'Undiscovered resident'}</ThemedText>
        <ThemedText style={styles.hint} lightColor="#6E725F" darkColor="rgba(255,245,216,0.68)">Swipe through the Mossprout set</ThemedText>
      </View>
    </View>
  );
}

function KatchimeraCollectionCard({ card, cardNumber, cardSize }: {
  card: KatchimeraCardOption;
  cardNumber: number;
  cardSize: DailyCardSize;
}) {
  const visual = card.visualKey ? getCreatureVisual(card.visualKey, 'grown') : null;
  return (
    <View
      accessibilityLabel={card.owned ? `${card.displayName}, collected Mossprout card` : `Undiscovered Mossprout card ${cardNumber}`}
      style={[styles.card, { height: cardSize.height, width: cardSize.width }]}>
      <View style={styles.cardInnerBorder} />
      <View style={styles.vineLeft}><ThemedText style={styles.vineGlyph} lightColor="#738F45" darkColor="#738F45">❧</ThemedText></View>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.setName} lightColor="#6A7D3D" darkColor="#6A7D3D">MOSSPROUT · GARDEN RESIDENTS</ThemedText>
        <ThemedText style={styles.number} lightColor="#8E7130" darkColor="#8E7130">{String(cardNumber).padStart(2, '0')}</ThemedText>
      </View>
      <View style={[styles.artStage, visual && card.owned ? { backgroundColor: `${visual.accentColor}24` } : null]}>
        <View style={styles.sunDisc} />
        <View style={styles.groundOne} />
        <View style={styles.groundTwo} />
        {visual ? <Image
          accessibilityIgnoresInvertColors
          contentFit="contain"
          source={visual.source}
          style={[styles.creatureArt, !card.owned && styles.silhouette]}
          transition={0}
        /> : <IconSymbol color="#44523C" name="questionmark" size={52} />}
        {!card.owned ? <View style={styles.lockBadge}><IconSymbol color="#F7EDC9" name="lock.fill" size={14} /></View> : null}
      </View>
      <View style={styles.namePlate}>
        <ThemedText adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={styles.cardName} lightColor="#312D20" darkColor="#312D20">{card.owned ? card.displayName : '???'}</ThemedText>
        <ThemedText numberOfLines={2} style={styles.cardLine} lightColor="#716A50" darkColor="#716A50">{card.owned ? BOTANICAL_LINES[card.id] ?? 'A resident of Mossprout’s living garden' : 'Keep growing the garden to meet this resident.'}</ThemedText>
      </View>
      <ThemedText style={styles.cardFooter} lightColor="#8E7130" darkColor="#8E7130">KATCHIMERAS · NATURE SET I</ThemedText>
    </View>
  );
}

export function KatchimeraCardRevealModal({ cardId, cards, onDone }: {
  cardId: KatchimeraSkinId | null;
  cards: readonly KatchimeraCardOption[];
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const revealed = cards.find((card) => card.id === cardId);
  if (!cardId || !revealed) return null;
  // The repository subscription normally arrives in the same frame as the
  // serve result. Keep the earned face revealed even if React schedules that
  // snapshot one frame later.
  const revealCards = cards.map((card) => card.id === cardId
    ? { ...card, owned: true, acquisition: card.acquisition ?? 'story_resident' as const }
    : card);
  return (
    <Modal animationType="none" navigationBarTranslucent onRequestClose={onDone} presentationStyle="fullScreen" statusBarTranslucent transparent visible>
      <StatusBar style="light" />
      <Animated.View accessibilityViewIsModal entering={FadeIn.duration(reduceMotion ? 80 : 260)} style={styles.revealScreen}>
        <View style={styles.revealGlow} />
        <View style={[styles.revealLayout, { paddingBottom: Math.max(insets.bottom + 12, 22), paddingTop: Math.max(insets.top + 12, 24) }]}>
          <Animated.View entering={FadeInUp.duration(reduceMotion ? 100 : 420)} style={styles.revealHeading}>
            <ThemedText style={styles.revealEyebrow} lightColor="#F2D27C" darkColor="#F2D27C">A NEW GARDEN RESIDENT</ThemedText>
            <ThemedText style={styles.revealTitle} lightColor="#FFF8E4" darkColor="#FFF8E4">{revealed.displayName} joined your deck</ThemedText>
            <ThemedText style={styles.revealBody} lightColor="rgba(255,248,228,0.74)" darkColor="rgba(255,248,228,0.74)">Their first request is complete. The rest of this nature set is still waiting to be discovered.</ThemedText>
          </Animated.View>
          <View style={styles.revealDeck}>
            <KatchimeraCardDeckCarousel cards={revealCards} initialCardId={cardId} maxCardHeight={Math.min(450, height * 0.52)} />
          </View>
          <View style={styles.revealAction}><KatchaButton fullWidth glow label="Done" onPress={onDone} /></View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  carousel: { alignItems: 'center', gap: 7 },
  stage: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  caption: { alignItems: 'center', gap: 2, paddingHorizontal: 24 },
  counter: { fontSize: 10, fontVariant: ['tabular-nums'], fontWeight: '900', letterSpacing: 1.1 },
  captionTitle: { fontSize: 16, fontWeight: '900', lineHeight: 20 },
  hint: { fontSize: 11, fontWeight: '700', lineHeight: 15, textAlign: 'center' },
  card: { backgroundColor: '#F5EDCE', borderColor: '#B99543', borderRadius: 24, borderWidth: 2, boxShadow: '0 18px 38px rgba(28,38,19,0.3)', overflow: 'hidden', padding: 13 },
  cardInnerBorder: { borderColor: 'rgba(91,116,54,0.36)', borderRadius: 18, borderWidth: 1, bottom: 6, left: 6, pointerEvents: 'none', position: 'absolute', right: 6, top: 6 },
  vineLeft: { left: 6, position: 'absolute', top: 39, transform: [{ rotate: '-18deg' }] },
  vineGlyph: { fontSize: 31, opacity: 0.55 },
  cardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 27, paddingHorizontal: 4 },
  setName: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.75 },
  number: { fontSize: 10, fontWeight: '900' },
  artStage: { alignItems: 'center', backgroundColor: '#DDE4BE', borderColor: 'rgba(70,92,45,0.34)', borderRadius: 16, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 190, overflow: 'hidden' },
  sunDisc: { backgroundColor: 'rgba(255,239,163,0.55)', borderRadius: 999, height: 114, position: 'absolute', right: -22, top: -18, width: 114 },
  groundOne: { backgroundColor: '#A5B873', borderRadius: 999, bottom: -47, height: 112, left: -37, position: 'absolute', right: 40, transform: [{ rotate: '8deg' }] },
  groundTwo: { backgroundColor: '#718D4C', borderRadius: 999, bottom: -60, height: 112, left: 55, position: 'absolute', right: -43, transform: [{ rotate: '-8deg' }] },
  creatureArt: { height: '94%', width: '94%', zIndex: 2 },
  silhouette: { opacity: 0.78, tintColor: '#344238', transform: [{ scale: 0.92 }] },
  lockBadge: { alignItems: 'center', backgroundColor: 'rgba(49,58,40,0.82)', borderColor: 'rgba(247,237,201,0.5)', borderRadius: 999, borderWidth: 1, height: 32, justifyContent: 'center', position: 'absolute', right: 9, top: 9, width: 32, zIndex: 4 },
  namePlate: { alignItems: 'center', gap: 3, minHeight: 72, paddingHorizontal: 8, paddingTop: 10 },
  cardName: { fontSize: 22, fontWeight: '900', letterSpacing: -0.4, lineHeight: 25 },
  cardLine: { fontSize: 10.5, fontWeight: '700', lineHeight: 14, maxWidth: 220, textAlign: 'center' },
  cardFooter: { alignSelf: 'center', fontSize: 7.5, fontWeight: '900', letterSpacing: 1, paddingTop: 5 },
  revealScreen: { backgroundColor: '#1E321F', flex: 1, overflow: 'hidden' },
  revealGlow: { backgroundColor: 'rgba(205,173,78,0.17)', borderRadius: 999, height: 520, left: '50%', marginLeft: -260, position: 'absolute', top: 110, width: 520 },
  revealLayout: { flex: 1, justifyContent: 'space-between' },
  revealHeading: { alignItems: 'center', gap: 6, paddingHorizontal: 28 },
  revealEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.45 },
  revealTitle: { fontSize: 25, fontWeight: '900', letterSpacing: -0.55, lineHeight: 30, textAlign: 'center' },
  revealBody: { fontSize: 12, fontWeight: '700', lineHeight: 17, maxWidth: 330, textAlign: 'center' },
  revealDeck: { flex: 1, justifyContent: 'center' },
  revealAction: { paddingHorizontal: 24 },
});
