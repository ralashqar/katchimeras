import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';

// "Location gives the where, you give the why." A detected place is shown; the
// user picks what it was (category), then what it meant (feeling). Confirming
// folds it into the day and grows the Places cell.

export type PlaceCategory = { id: string; emoji: string; label: string };
export type PlaceMeaning = { id: string; emoji: string; label: string; tint: string };

export const PLACE_CATEGORIES: PlaceCategory[] = [
  { id: 'cafe', emoji: '☕', label: 'Café' },
  { id: 'food', emoji: '🍽', label: 'Food' },
  { id: 'park', emoji: '🌳', label: 'Park' },
  { id: 'cinema', emoji: '🎬', label: 'Cinema' },
  { id: 'museum', emoji: '🏛', label: 'Museum' },
  { id: 'shopping', emoji: '🛍', label: 'Shopping' },
  { id: 'work', emoji: '💼', label: 'Work' },
  { id: 'home', emoji: '🏠', label: 'Home' },
  { id: 'other', emoji: '✨', label: 'Somewhere else' },
];

export const PLACE_MEANINGS: PlaceMeaning[] = [
  { id: 'calm', emoji: '🌿', label: 'Calm', tint: '#7DE8CD' },
  { id: 'energy', emoji: '⚡', label: 'Energy', tint: '#FFC36B' },
  { id: 'together', emoji: '🧑‍🤝‍🧑', label: 'Together', tint: '#F49AC1' },
  { id: 'meaningful', emoji: '✨', label: 'Meaningful', tint: '#A78BFA' },
  { id: 'focus', emoji: '🎯', label: 'Focus', tint: '#92D7FF' },
];

// Tint per underlying mood archetype (the `id` every meaning still maps to, so the
// patch + scores stay driven by the same 5 archetypes).
const TINT: Record<string, string> = {
  calm: '#7DE8CD',
  energy: '#FFC36B',
  together: '#F49AC1',
  meaningful: '#A78BFA',
  focus: '#92D7FF',
};
const m = (id: string, emoji: string, label: string): PlaceMeaning => ({ id, emoji, label, tint: TINT[id] ?? '#C4BAF0' });

// "What did it mean?" tailored to WHAT the place was — each option still resolves
// to one of the 5 archetypes, but the wording fits the category. Falls back to the
// generic PLACE_MEANINGS for 'other'/unknown.
export const PLACE_MEANINGS_BY_CATEGORY: Record<string, PlaceMeaning[]> = {
  cafe: [m('calm', '🌿', 'Calm'), m('together', '🧑‍🤝‍🧑', 'Caught up'), m('focus', '🎯', 'Got work done'), m('energy', '☕', 'A treat'), m('meaningful', '🕊', 'Me-time')],
  food: [m('together', '🧑‍🤝‍🧑', 'Shared meal'), m('energy', '🎁', 'A treat'), m('calm', '💛', 'Comfort'), m('meaningful', '✨', 'Discovery'), m('focus', '⚡', 'Quick bite')],
  park: [m('calm', '🌿', 'Peaceful'), m('energy', '⚡', 'Active'), m('together', '🧑‍🤝‍🧑', 'Together'), m('meaningful', '🍃', 'Fresh air'), m('focus', '🧠', 'Cleared my head')],
  cinema: [m('meaningful', '🎭', 'Moving'), m('energy', '🍿', 'Fun'), m('together', '🧑‍🤝‍🧑', 'Together'), m('calm', '🌙', 'An escape')],
  museum: [m('meaningful', '🏛', 'Inspiring'), m('calm', '🌿', 'Reflective'), m('focus', '🔍', 'Curious'), m('together', '🧑‍🤝‍🧑', 'Together')],
  shopping: [m('energy', '🎁', 'A treat'), m('focus', '🎯', 'Errands'), m('meaningful', '✨', 'Found something'), m('together', '🧑‍🤝‍🧑', 'Together')],
  work: [m('focus', '🎯', 'Focused'), m('energy', '⚡', 'Productive'), m('meaningful', '🏆', 'A win'), m('together', '🧑‍🤝‍🧑', 'With the team'), m('calm', '🌿', 'Routine')],
  home: [m('calm', '🛋', 'Restful'), m('together', '🧑‍🤝‍🧑', 'Family time'), m('meaningful', '💛', 'Cozy'), m('focus', '🎯', 'Got things done'), m('energy', '✨', 'Lively')],
};
export function meaningsForCategory(categoryId: string): PlaceMeaning[] {
  return PLACE_MEANINGS_BY_CATEGORY[categoryId] ?? PLACE_MEANINGS;
}

type PlacePromptSheetProps = {
  // Shown for context — the detected place's name + time range.
  placeName: string;
  timeLabel?: string | null;
  isNew?: boolean;
  onConfirm: (category: PlaceCategory, meaning: PlaceMeaning) => void;
  onClose: () => void;
};

export function PlacePromptSheet({ placeName, timeLabel, isNew, onConfirm, onClose }: PlacePromptSheetProps) {
  const tabBarHeight = useBottomTabBarHeight();
  const [category, setCategory] = useState<PlaceCategory | null>(null);

  return (
    <View style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.duration(260)}
        exiting={SlideOutDown.duration(200)}
        style={[styles.sheet, { bottom: tabBarHeight + 10 }]}>
        <View style={styles.grabber} />

        <ThemedText style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
          {isNew ? 'A new place' : 'A place you visited'}
        </ThemedText>
        <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {placeName}
        </ThemedText>
        {timeLabel ? (
          <ThemedText style={styles.time} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            {timeLabel}
          </ThemedText>
        ) : null}

        {!category ? (
          <Animated.View entering={FadeInDown.duration(220)} style={styles.section}>
            <ThemedText style={styles.question} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
              What was it?
            </ThemedText>
            <View style={styles.grid}>
              {PLACE_CATEGORIES.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => setCategory(option)}
                  style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}>
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
            <ThemedText style={styles.question} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
              {`${category.emoji} ${category.label} · what did it mean?`}
            </ThemedText>
            <View style={styles.grid}>
              {meaningsForCategory(category.id).map((option) => (
                <Pressable
                  key={`${option.id}-${option.label}`}
                  onPress={() => onConfirm(category, option)}
                  style={({ pressed }) => [styles.chip, { borderColor: `${option.tint}66` }, pressed && styles.chipPressed]}>
                  <ThemedText style={styles.chipEmoji}>{option.emoji}</ThemedText>
                  <ThemedText style={styles.chipLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <Pressable accessibilityRole="button" onPress={() => setCategory(null)} style={styles.back}>
              <ThemedText style={styles.backLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                Back
              </ThemedText>
            </Pressable>
          </Animated.View>
        )}

        <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
          <ThemedText style={styles.closeLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            Later
          </ThemedText>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, elevation: 24, zIndex: 50 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 7, 15, 0.42)' },
  sheet: {
    backgroundColor: '#161226',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
    gap: 8,
    left: 12,
    paddingBottom: 16,
    paddingHorizontal: 18,
    paddingTop: 12,
    position: 'absolute',
    right: 12,
  },
  grabber: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, height: 4, marginBottom: 4, width: 38 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '800', lineHeight: 23 },
  time: { fontSize: 12.5, fontWeight: '600' },
  section: { gap: 10, paddingTop: 8 },
  question: { fontSize: 13, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
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
  close: { alignSelf: 'center', paddingTop: 6 },
  closeLabel: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
});
