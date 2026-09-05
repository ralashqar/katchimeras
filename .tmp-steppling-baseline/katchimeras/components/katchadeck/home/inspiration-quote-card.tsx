import { ScrollView, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import {
  homeInspirationCategories,
  homeInspirationCategoryLabels,
  homeMomentOptions,
} from '@/constants/home-mvp';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import type { InspirationCategory, InspirationSelection } from '@/types/home';

type InspirationQuoteCardProps = {
  onAdd: () => void;
  onSelectCategory: (category: InspirationCategory) => void;
  selection: InspirationSelection;
};

export function InspirationQuoteCard({
  onAdd,
  onSelectCategory,
  selection,
}: InspirationQuoteCardProps) {
  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={styles.shell}>
      <View
        style={[
          styles.quoteSurface,
          {
            backgroundColor: 'rgba(19, 23, 38, 0.9)',
            borderColor: `${homeMomentOptions.inspiration.accentColor}3A`,
          },
        ]}>
        <View style={styles.quoteGlow} />
        <View style={styles.quoteHeader}>
          <ThemedText type="onboardingLabel" style={styles.kicker} lightColor="#EAD9FF" darkColor="#EAD9FF">
            Inspiration moment
          </ThemedText>
          <ThemedText style={styles.categoryLabel} lightColor="#C9D7F9" darkColor="#C9D7F9">
            {homeInspirationCategoryLabels[selection.category]}
          </ThemedText>
        </View>

        <ThemedText type="subtitle" style={styles.quoteText} lightColor="#FFF9F5" darkColor="#FFF9F5">
          “{selection.quote.text}”
        </ThemedText>

        <ScrollView
          horizontal
          contentContainerStyle={styles.categoryRow}
          showsHorizontalScrollIndicator={false}>
          {homeInspirationCategories.map((category) => {
            const active = selection.category === category;
            return (
              <Pressable
                key={category}
                onPress={() => onSelectCategory(category)}
                style={[
                  styles.categoryChip,
                  active
                    ? styles.categoryChipActive
                    : styles.categoryChipIdle,
                  active
                    ? { borderColor: `${homeMomentOptions.inspiration.accentColor}88` }
                    : null,
                ]}>
                <ThemedText
                  style={styles.categoryChipLabel}
                  lightColor={active ? '#FFF8F4' : '#D5DEFA'}
                  darkColor={active ? '#FFF8F4' : '#D5DEFA'}>
                  {homeInspirationCategoryLabels[category]}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <ThemedText style={styles.footnote} lightColor="#C6D2F2" darkColor="#C6D2F2">
            Feed this into the egg.
          </ThemedText>
          <KatchaButton label="Add to egg" onPress={onAdd} variant="premium" icon="star.fill" />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
  },
  quoteSurface: {
    borderCurve: 'continuous',
    borderRadius: 32,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 18,
    position: 'relative',
  },
  quoteGlow: {
    backgroundColor: 'rgba(225, 192, 255, 0.12)',
    borderRadius: 999,
    height: 120,
    position: 'absolute',
    right: -8,
    top: -14,
    width: 120,
  },
  quoteHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  kicker: {
    fontSize: 11,
  },
  categoryLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  quoteText: {
    fontSize: 24,
    lineHeight: 31,
    marginTop: 16,
  },
  categoryRow: {
    gap: 10,
    paddingBottom: 2,
    paddingTop: 18,
  },
  categoryChip: {
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  categoryChipActive: {
    backgroundColor: 'rgba(225, 192, 255, 0.18)',
  },
  categoryChipIdle: {
    backgroundColor: 'rgba(216, 226, 255, 0.06)',
    borderColor: 'rgba(216, 226, 255, 0.14)',
  },
  categoryChipLabel: {
    fontSize: 13,
    lineHeight: 16,
  },
  footer: {
    gap: 10,
    marginTop: 18,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 16,
  },
});
