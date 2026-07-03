import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { MeadowSheet } from '@/components/katchadeck/ui/meadow-sheet';
import { Lantern } from '@/constants/theme';
import type { FoodMeaning, FoodMoment } from '@/types/home';

// Food Vault (Patch Systems V3) — what you tasted, shared, or enjoyed. NOT a
// calorie tracker. A two-step add (what + what it meant) and a small reader.

type FoodType = { label: string; emoji: string };
const FOOD_TYPES: FoodType[] = [
  { label: 'Coffee', emoji: '☕' },
  { label: 'Meal', emoji: '🍽' },
  { label: 'Dessert', emoji: '🍰' },
  { label: 'Snack', emoji: '🥐' },
  { label: 'Drink', emoji: '🥤' },
  { label: 'Something', emoji: '🍎' },
];

export const FOOD_MEANINGS: { id: FoodMeaning; emoji: string; label: string; tint: string }[] = [
  { id: 'treat', emoji: '🎁', label: 'A treat', tint: '#FFC36B' },
  { id: 'sharedMeal', emoji: '🧑‍🤝‍🧑', label: 'Shared', tint: '#F49AC1' },
  { id: 'comfort', emoji: '💛', label: 'Comfort', tint: '#A78BFA' },
  { id: 'fuel', emoji: '⚡', label: 'Fuel', tint: '#92D7FF' },
  { id: 'discovery', emoji: '✨', label: 'Discovery', tint: '#7DE8CD' },
];
const MEANING_LABEL: Record<FoodMeaning, string> = Object.fromEntries(
  FOOD_MEANINGS.map((meaning) => [meaning.id, meaning.label])
) as Record<FoodMeaning, string>;
const MEANING_TINT: Record<FoodMeaning, string> = Object.fromEntries(
  FOOD_MEANINGS.map((meaning) => [meaning.id, meaning.tint])
) as Record<FoodMeaning, string>;
// Shown under a food when there's no note excerpt — where it came from.
const SOURCE_LABEL: Record<NonNullable<FoodMoment['source']>, string> = {
  manual: 'Saved',
  photo: 'From a photo',
  note: 'From a note',
};

// --- Add sheet: what was it → what did it mean ---
export function FoodMomentSheet({
  onConfirm,
  onClose,
  suggested,
}: {
  onConfirm: (input: { label: string; emoji: string; meaning: FoodMeaning }) => void;
  onClose: () => void;
  // Pre-fill the "what" from on-device food detection — user still gives the why.
  suggested?: { label: string; emoji: string } | null;
}) {
  const [food, setFood] = useState<FoodType | null>(suggested ?? null);

  return (
    <MeadowSheet
      onClose={onClose}
      kicker="A food memory"
      title={food ? `${food.emoji} ${food.label} · what did it mean?` : 'What did you have?'}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!food ? (
          <Animated.View entering={FadeInDown.duration(220)} style={styles.section}>
            <View style={styles.grid}>
              {FOOD_TYPES.map((option) => (
                <Pressable key={option.label} onPress={() => setFood(option)} style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}>
                  <ThemedText style={styles.chipEmoji}>{option.emoji}</ThemedText>
                  <ThemedText style={styles.chipLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(220)} style={styles.section}>
            <View style={styles.grid}>
              {FOOD_MEANINGS.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => onConfirm({ label: food.label, emoji: food.emoji, meaning: option.id })}
                  style={({ pressed }) => [styles.chip, { borderColor: `${option.tint}66` }, pressed && styles.chipPressed]}>
                  <ThemedText style={styles.chipEmoji}>{option.emoji}</ThemedText>
                  <ThemedText style={styles.chipLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <Pressable accessibilityRole="button" onPress={() => setFood(null)} style={styles.back}>
              <ThemedText style={styles.backLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                Back
              </ThemedText>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </MeadowSheet>
  );
}

// --- Reader: the day's food memories ---
export function FoodVaultSheet({
  foodMoments,
  onAddFood,
  onClose,
}: {
  foodMoments: FoodMoment[];
  onAddFood?: () => void;
  onClose: () => void;
}) {
  return (
    <MeadowSheet
      onClose={onClose}
      kicker="Food Vault"
      title={foodMoments.length > 0 ? 'Today’s food memories' : 'Your food memories'}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.body}>
          {onAddFood ? (
            <Pressable accessibilityRole="button" onPress={onAddFood} style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}>
              <ThemedText style={styles.addBtnEmoji}>🍽</ThemedText>
              <ThemedText style={styles.addBtnLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                Save a food memory
              </ThemedText>
            </Pressable>
          ) : null}
          {foodMoments.length === 0 ? (
            <ThemedText style={styles.empty} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              No food memories yet — save a coffee, a meal, a treat.
            </ThemedText>
          ) : null}
          {foodMoments.map((moment) => (
            <View key={moment.id} style={styles.foodRow}>
              {moment.thumbnailUri ? (
                <Image source={{ uri: moment.thumbnailUri }} style={styles.foodPhoto} contentFit="cover" transition={120} />
              ) : (
                <ThemedText style={styles.foodEmoji}>{moment.emoji}</ThemedText>
              )}
              <View style={styles.foodText}>
                <ThemedText style={styles.foodLabel} numberOfLines={1} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                  {moment.label}
                </ThemedText>
                {moment.detail || moment.source ? (
                  <ThemedText style={styles.foodDetail} numberOfLines={1} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                    {moment.detail ? `“${moment.detail}”` : SOURCE_LABEL[moment.source ?? 'manual']}
                  </ThemedText>
                ) : null}
              </View>
              <View style={[styles.meaningChip, { borderColor: `${MEANING_TINT[moment.meaning] ?? Lantern.moon300}66` }]}>
                <View style={[styles.meaningDot, { backgroundColor: MEANING_TINT[moment.meaning] ?? Lantern.moon300 }]} />
                <ThemedText style={styles.meaningLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                  {MEANING_LABEL[moment.meaning] ?? moment.meaning}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </MeadowSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 8, paddingBottom: 4 },
  section: { gap: 10, paddingTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(12,10,20,0.7)',
  },
  chipPressed: { backgroundColor: 'rgba(40,34,60,0.9)' },
  chipEmoji: { fontSize: 16 },
  chipLabel: { fontSize: 13, fontWeight: '700' },
  back: { alignSelf: 'flex-start', paddingTop: 2 },
  backLabel: { fontSize: 12.5, fontWeight: '700' },
  body: { gap: 10, paddingTop: 6 },
  empty: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,195,107,0.45)',
    backgroundColor: 'rgba(255,195,107,0.12)',
    alignSelf: 'flex-start',
  },
  addBtnPressed: { backgroundColor: 'rgba(255,195,107,0.22)' },
  addBtnEmoji: { fontSize: 16 },
  addBtnLabel: { fontSize: 13.5, fontWeight: '800' },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  foodEmoji: { fontSize: 22, width: 28, textAlign: 'center' },
  foodPhoto: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' },
  foodText: { flex: 1, gap: 1 },
  foodLabel: { fontSize: 14, fontWeight: '700' },
  foodDetail: { fontSize: 11.5, fontWeight: '600' },
  meaningChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(12,10,20,0.6)',
  },
  meaningDot: { width: 7, height: 7, borderRadius: 999 },
  meaningLabel: { fontSize: 12, fontWeight: '700' },
});
