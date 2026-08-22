import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useKatchaSurface } from '@/components/katchadeck/ui/katcha-surface';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import { getCreatureVisual } from '@/game/days';
import { KATCHIMERA_CARD_PRICE, useKatchimeraCards } from '@/hooks/use-katchimera-cards';
import type { KatchimeraFamilyId } from '@/types/katchimera';

export function CompanionSkinsThread({ companionName, familyId, showHeading = true }: {
  companionName: string;
  familyId: KatchimeraFamilyId;
  showHeading?: boolean;
}) {
  const { tokens } = useKatchaSurface();
  const { cards, coins, collectionOpen, loading, purchase } = useKatchimeraCards(familyId);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <View style={styles.root}>
      {showHeading ? <View style={styles.heading}>
        <ThemedText selectable style={styles.eyebrow} lightColor={tokens.accentPressed} darkColor={tokens.accentPressed}>KATCHIMERA CARDS</ThemedText>
        <ThemedText selectable style={styles.title} lightColor={tokens.text} darkColor={tokens.text}>Your {companionName} collection</ThemedText>
      </View> : null}
      <View style={styles.intro}>
        <View style={styles.coinRow}><IconSymbol color="#A77928" name="circle.fill" size={13} /><ThemedText selectable style={styles.coins} lightColor={tokens.text} darkColor={tokens.text}>{coins} Coins</ThemedText></View>
        <ThemedText selectable style={styles.description} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>
          Cards collect the many forms connected to {companionName}. They do not change your companion or your relationship.
        </ThemedText>
        {!collectionOpen && !loading ? <ThemedText selectable style={styles.lockedMessage} lightColor={tokens.accentPressed} darkColor={tokens.accentPressed}>Your first card will be revealed during an early Journey Day.</ThemedText> : null}
        {message ? <ThemedText accessibilityLiveRegion="polite" selectable style={styles.message} lightColor={tokens.accentPressed} darkColor={tokens.accentPressed}>{message}</ThemedText> : null}
      </View>

      <View accessibilityRole="list" style={styles.grid}>
        {cards.map((card) => {
          const visual = card.visualKey ? getCreatureVisual(card.visualKey, 'grown') : null;
          const purchasable = collectionOpen && card.artReady && !card.owned && coins >= KATCHIMERA_CARD_PRICE;
          return (
            <Pressable
              accessibilityLabel={card.owned ? `${card.displayName} card collected` : card.artReady ? `${card.displayName}, ${KATCHIMERA_CARD_PRICE} Coins` : `${card.displayName}, coming later`}
              accessibilityRole="button"
              accessibilityState={{ disabled: !purchasable }}
              disabled={!purchasable}
              key={card.id}
              onPress={() => {
                void purchase(card.id).then((result) => {
                  if (result?.changed) {
                    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setMessage(`${card.displayName} joined your collection.`);
                  } else {
                    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    setMessage(result?.message ?? 'That card could not be collected.');
                  }
                });
              }}
              style={({ pressed }) => [styles.card, card.owned && styles.ownedCard, !card.artReady && styles.plannedCard, pressed && styles.pressedCard]}>
              <View style={[styles.artStage, visual && { backgroundColor: `${visual.accentColor}28` }]}>
                {visual ? <Image accessibilityLabel={card.displayName} contentFit="contain" source={visual.source} style={[styles.art, !card.owned && styles.lockedArt]} transition={120} /> : <IconSymbol color={tokens.textTertiary} name="questionmark" size={30} />}
                {card.owned ? <View style={styles.check}><IconSymbol color="#FFF9EC" name="checkmark" size={13} /></View> : null}
                {!card.owned && card.artReady ? <View style={styles.lock}><IconSymbol color="#FFF9EC" name="lock.fill" size={12} /></View> : null}
              </View>
              <View style={styles.cardCopy}>
                <ThemedText adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} selectable style={styles.cardName} lightColor={tokens.text} darkColor={tokens.text}>{card.displayName}</ThemedText>
                <ThemedText selectable style={styles.status} lightColor={card.owned ? tokens.accentPressed : tokens.textTertiary} darkColor={card.owned ? tokens.accentPressed : tokens.textTertiary}>
                  {card.owned ? card.acquisition === 'journey_match' ? 'Your match' : 'Collected' : !card.artReady ? 'Coming later' : !collectionOpen ? 'Reveal your match first' : `${KATCHIMERA_CARD_PRICE} Coins`}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14, paddingBottom: 10, paddingHorizontal: 4, paddingTop: 8 },
  heading: { gap: 6, paddingHorizontal: 4 },
  eyebrow: { ...KatchaUI.type.label, fontSize: 10, letterSpacing: 1.2 },
  title: { ...KatchaUI.type.screenTitle, fontSize: 23, lineHeight: 28 },
  intro: { backgroundColor: 'rgba(255,248,232,0.9)', borderCurve: 'continuous', borderRadius: 18, gap: 7, padding: 12 },
  coinRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  coins: { fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '900' },
  description: { ...KatchaUI.type.companionBody, fontSize: 12, lineHeight: 18 },
  lockedMessage: { fontSize: 11, fontWeight: '800', lineHeight: 16 },
  message: { fontSize: 11, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { backgroundColor: 'rgba(255,248,232,0.93)', borderColor: 'rgba(95,83,61,0.22)', borderCurve: 'continuous', borderRadius: KatchaUI.radius.card, borderWidth: 1, flexBasis: '47%', flexGrow: 1, minWidth: 132, overflow: 'hidden', padding: 8 },
  ownedCard: { backgroundColor: 'rgba(255,244,204,0.97)', borderColor: '#B68B36', borderWidth: 2, padding: 7 },
  plannedCard: { opacity: 0.72 },
  pressedCard: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  artStage: { alignItems: 'center', backgroundColor: 'rgba(80,70,50,0.08)', borderCurve: 'continuous', borderRadius: 13, height: 118, justifyContent: 'center', overflow: 'hidden' },
  art: { height: 112, width: '100%' },
  lockedArt: { opacity: 0.58, transform: [{ scale: 0.94 }] },
  check: { alignItems: 'center', backgroundColor: '#A77928', borderRadius: 999, height: 24, justifyContent: 'center', position: 'absolute', right: 7, top: 7, width: 24 },
  lock: { alignItems: 'center', backgroundColor: 'rgba(50,43,32,0.72)', borderRadius: 999, height: 24, justifyContent: 'center', position: 'absolute', right: 7, top: 7, width: 24 },
  cardCopy: { gap: 1, paddingBottom: 2, paddingHorizontal: 4, paddingTop: 8 },
  cardName: { ...KatchaUI.type.companionAction, fontSize: 14, letterSpacing: -0.15 },
  status: { ...KatchaUI.type.label, fontSize: 9.5, letterSpacing: 0.35 },
});
