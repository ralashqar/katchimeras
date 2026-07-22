import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { DailyCard } from '@/components/katchadeck/cards/daily-card';
import { ThemedText } from '@/components/themed-text';
import { KatchaDeckUI, Lantern } from '@/constants/theme';
import { useAllDays } from '@/hooks/use-all-days';

export default function CardDetailRoute() {
  const { cardId } = useLocalSearchParams<{ cardId?: string }>();
  const { days } = useAllDays();
  const decodedId = cardId ? decodeURIComponent(cardId) : '';
  const day = days.find((candidate) => candidate.card?.id === decodedId) ?? null;
  const card = day?.card ?? null;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: card?.creatureName ?? 'Daily card' }} />
      <AmbientBackground
        accentColor={card ? `${card.accentColor}22` : 'rgba(167,139,250,0.14)'}
        colors={KatchaDeckUI.gradients.world}
        meshColors={['rgba(167,139,250,0.12)', 'rgba(125,232,205,0.08)', 'rgba(255,195,107,0.08)', 'rgba(20,17,31,0.2)']}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        {card && day ? (
          <>
            <DailyCard card={card} sceneArt="kingdom" />
            <View style={styles.section}>
              <ThemedText type="subtitle" style={styles.sectionTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                Collector notes
              </ThemedText>
              {card.rarityReason ? (
                <View style={styles.factCard}>
                  <ThemedText style={styles.factLabel} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>WHY IT WAS {card.rarity.toUpperCase()}</ThemedText>
                  <ThemedText selectable style={styles.factText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                    Only from {card.rarityReason}.
                  </ThemedText>
                </View>
              ) : null}
              {day.creature?.fieldEchoes?.length ? (
                <View style={styles.factCard}>
                  <ThemedText style={styles.factLabel} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>ALMOST CAUGHT</ThemedText>
                  <ThemedText selectable style={styles.factText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                    {day.creature.fieldEchoes.slice(0, 2).map((echo) => `${echo.name} · ${Math.round(echo.probability * 100)}%`).join('\n')}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.empty}>
            <ThemedText type="subtitle" lightColor={Lantern.moon50} darkColor={Lantern.moon50}>Card not found</ThemedText>
            <ThemedText selectable style={styles.emptyText} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              This card may belong to an older save that has not been migrated yet.
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Lantern.ink950, flex: 1 },
  content: { gap: 28, paddingBottom: 60, paddingHorizontal: 16, paddingTop: 20 },
  section: { gap: 14 },
  sectionTitle: { fontSize: 21 },
  factCard: { backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.1)', borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, gap: 7, padding: 16 },
  factLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  factText: { fontSize: 14, lineHeight: 21 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 80 },
  emptyText: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
