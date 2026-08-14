import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { MovementChoiceChips, type MovementChoiceOption } from '@/components/katchadeck/world/movement-choice-chips';
import { KatchaSurfacePalette } from '@/constants/katcha-ui';
import type { DayMovementKind } from '@/types/home';

// Interpret a notably active day — the steps say "a lot moved today", the user says
// what it WAS. One tap, multiple choice. The answer becomes one canonical
// movement memory and can corroborate—but never replace—the measured steps.

type MovementOption = MovementChoiceOption;
const MOVEMENTS: MovementOption[] = [
  { movement: 'hike', label: 'A hike', emoji: '🥾', tint: '#7DE8CD' },
  { movement: 'walk', label: 'A long walk', emoji: '🚶', tint: '#9AE6B4' },
  { movement: 'run', label: 'A run', emoji: '🏃', tint: '#FFC36B' },
  { movement: 'cycle', label: 'A ride', emoji: '🚴', tint: '#92D7FF' },
  { movement: 'workout', label: 'A workout', emoji: '🏋️', tint: '#F49AC1' },
  { movement: 'errands', label: 'Out & about', emoji: '🛍️', tint: '#C7B8FF' },
  { movement: 'transit', label: 'Just transit', emoji: '🚇', tint: '#8FC9FF' },
  { movement: 'commute', label: 'A commute', emoji: '🚉', tint: '#A7D5FF' },
  { movement: 'drive', label: 'Driving / a ride', emoji: '🚗', tint: '#B8C1D9' },
  { movement: 'travel', label: 'A travel day', emoji: '✈️', tint: '#A78BFA' },
  { movement: 'mixed', label: 'A bit of everything', emoji: '🧭', tint: '#D3B7FF' },
];
const PARCHMENT = KatchaSurfacePalette.parchment;

const SUBTYPES: Partial<Record<DayMovementKind, { id: string; label: string; emoji: string }[]>> = {
  transit: [
    { id: 'train', label: 'Train / Tube', emoji: '🚇' },
    { id: 'bus', label: 'Bus', emoji: '🚌' },
    { id: 'taxi', label: 'Taxi / car', emoji: '🚕' },
    { id: 'flight_ferry', label: 'Flight / ferry', emoji: '⛴️' },
  ],
  commute: [
    { id: 'mostly_transit', label: 'Mostly transit', emoji: '🚉' },
    { id: 'mostly_walking', label: 'Mostly walking', emoji: '🚶' },
    { id: 'mostly_driving', label: 'Mostly driving', emoji: '🚗' },
    { id: 'mixed', label: 'Mixed', emoji: '🧭' },
  ],
  walk: [
    { id: 'leisure', label: 'A leisurely walk', emoji: '🌿' },
    { id: 'dog_walk', label: 'A dog walk', emoji: '🐾' },
    { id: 'walking_commute', label: 'Walking commute', emoji: '🏙️' },
    { id: 'exploring', label: 'Exploring', emoji: '🧭' },
  ],
};

export function StepsPromptSheet({
  stepsCount,
  detectedActivityTypes = [],
  onConfirm,
  onClose,
}: {
  stepsCount?: number | null;
  detectedActivityTypes?: string[];
  onConfirm: (input: { movement: DayMovementKind; label: string; emoji: string; subtype?: string | null }) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<MovementOption | null>(null);
  const stepsLine = stepsCount && stepsCount > 0 ? `${stepsCount.toLocaleString()} steps today` : 'A big day of movement';
  const subtypes = selected ? SUBTYPES[selected.movement] : null;
  const orderedMovements = orderMovementOptions(MOVEMENTS, detectedActivityTypes);
  const routeDetected = detectedActivityTypes.length > 0;
  const chooseMovement = (option: MovementOption) => {
    if (SUBTYPES[option.movement]) setSelected(option);
    else onConfirm({ movement: option.movement, label: option.label, emoji: option.emoji });
  };

  return (
    <KatchaSheet header={{ eyebrow: stepsLine, title: selected ? 'What kind of route?' : 'What kind of movement was it?' }} onRequestClose={() => onClose()} surface="parchment">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {!selected ? (
          <ThemedText style={styles.helper} lightColor={PARCHMENT.textSecondary} darkColor={PARCHMENT.textSecondary}>
            {routeDetected
              ? 'Health detected a route. Choose what it was to keep one movement memory for today.'
              : 'Your steps stood out. Choose what they came from to keep one movement memory for today.'}
          </ThemedText>
        ) : null}
        {!selected ? (
          <Animated.View entering={FadeInDown.duration(220)}>
            <MovementChoiceChips options={orderedMovements} onChoose={chooseMovement} />
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(220)} style={styles.grid}>
          {(subtypes ?? []).map((option) => (
            <Pressable
              key={option.id}
              onPress={() => {
                onConfirm({ movement: selected.movement, label: selected.label, emoji: selected.emoji, subtype: option.id });
              }}
              style={({ pressed }) => [
                styles.chip,
                pressed && styles.chipPressed,
              ]}>
              <ThemedText style={styles.chipEmoji}>{option.emoji}</ThemedText>
              <ThemedText style={styles.chipLabel} lightColor={PARCHMENT.text} darkColor={PARCHMENT.text}>
                {option.label}
              </ThemedText>
            </Pressable>
          ))}
          </Animated.View>
        )}
        {selected ? (
          <View style={styles.backRow}>
            <Pressable onPress={() => setSelected(null)}>
              <ThemedText style={styles.backLabel} lightColor={PARCHMENT.textTertiary} darkColor={PARCHMENT.textTertiary}>Back</ThemedText>
            </Pressable>
            <Pressable onPress={() => onConfirm({ movement: selected.movement, label: selected.label, emoji: selected.emoji })}>
              <ThemedText style={styles.backLabel} lightColor={PARCHMENT.textSecondary} darkColor={PARCHMENT.textSecondary}>Skip detail</ThemedText>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </KatchaSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 8, paddingBottom: 4 },
  helper: { fontSize: 13, lineHeight: 18, paddingHorizontal: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: PARCHMENT.subtle,
  },
  chipPressed: { backgroundColor: 'rgba(40,34,60,0.9)' },
  chipEmoji: { fontSize: 16 },
  chipLabel: { fontSize: 13, fontWeight: '700' },
  backRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 6 },
  backLabel: { fontSize: 12.5, fontWeight: '700' },
});

function orderMovementOptions(options: MovementOption[], detectedActivityTypes: string[]): MovementOption[] {
  const preferred = new Set<DayMovementKind>();
  for (const raw of detectedActivityTypes) {
    const activity = raw.toLowerCase();
    if (/hike|hiking/.test(activity)) preferred.add('hike');
    else if (/run|running|jog/.test(activity)) preferred.add('run');
    else if (/walk|walking/.test(activity)) preferred.add('walk');
    else if (/cycle|cycling|bike/.test(activity)) preferred.add('cycle');
  }
  return [...options].sort((left, right) => Number(preferred.has(right.movement)) - Number(preferred.has(left.movement)));
}
