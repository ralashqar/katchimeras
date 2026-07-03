import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Image } from 'expo-image';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { MeadowSheet } from '@/components/katchadeck/ui/meadow-sheet';
import { Lantern } from '@/constants/theme';
import type { HomeDayRecord } from '@/types/home';
import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';

// Generated 3D mood faces (FAL grid, style-anchored to the mood chip smiley).
const MOOD_ART: Record<string, number> = {
  radiant: require('@/assets/images/katchimeras/today-icons/moods/radiant.webp'),
  light: require('@/assets/images/katchimeras/today-icons/moods/light.webp'),
  meh: require('@/assets/images/katchimeras/today-icons/moods/meh.webp'),
  heavy: require('@/assets/images/katchimeras/today-icons/moods/heavy.webp'),
  stormy: require('@/assets/images/katchimeras/today-icons/moods/stormy.webp'),
};

export type MoodMonumentChoiceId = 'energized' | 'good' | 'meh' | 'drained' | 'stressed';

type MoodChoice = {
  id: MoodMonumentChoiceId;
  state: 'radiant' | 'light' | 'meh' | 'heavy' | 'stormy';
  label: string;
  caption: string;
  icon: IconSymbolName;
  accent: string;
};

const MOOD_CHOICES: MoodChoice[] = [
  { id: 'energized', state: 'radiant', label: 'Radiant', caption: 'Bright, alive, switched on', icon: 'face.very_happy', accent: '#FFC36B' },
  { id: 'good', state: 'light', label: 'Light', caption: 'Good, easy, open', icon: 'face.happy', accent: '#FFE08A' },
  { id: 'meh', state: 'meh', label: 'Meh', caption: 'Flat, neutral, just okay', icon: 'face.neutral', accent: '#A7D5FF' },
  { id: 'drained', state: 'heavy', label: 'Heavy', caption: 'Tired, low, tender', icon: 'face.sad', accent: '#91D8C7' },
  { id: 'stressed', state: 'stormy', label: 'Stormy', caption: 'Tense, loud, unsettled', icon: 'face.very_sad', accent: '#C77DFF' },
];

export function MoodMonumentSheet({
  day,
  onChoose,
  onOpenSanctuary,
  onClose,
}: {
  day: HomeDayRecord;
  onChoose?: (choiceId: MoodMonumentChoiceId, label: string, from: FeedSourceRect) => void;
  onOpenSanctuary?: () => void;
  onClose: () => void;
}) {
  const selected = currentMoodChoice(day);
  const editable = !!onChoose;

  return (
    <MeadowSheet
      onClose={onClose}
      kicker="Mood Monument"
      title={editable ? 'How did today feel overall?' : 'How this day felt'}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
        {MOOD_CHOICES.map((choice) => (
          <MoodChoiceButton
            key={choice.id}
            choice={choice}
            selected={selected?.id === choice.id}
            disabled={!editable}
            onChoose={onChoose}
          />
        ))}
      </ScrollView>

      {!editable && onOpenSanctuary ? (
        <Pressable accessibilityRole="button" onPress={onOpenSanctuary} style={styles.secondaryButton}>
          <IconSymbol name="sparkles" size={16} color={Lantern.moon50} />
          <ThemedText style={styles.secondaryLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            View Sanctuary history
          </ThemedText>
        </Pressable>
      ) : null}
    </MeadowSheet>
  );
}

function MoodChoiceButton({
  choice,
  selected,
  disabled,
  onChoose,
}: {
  choice: MoodChoice;
  selected: boolean;
  disabled: boolean;
  onChoose?: (choiceId: MoodMonumentChoiceId, label: string, from: FeedSourceRect) => void;
}) {
  const ref = useRef<View | null>(null);
  const handlePress = () => {
    ref.current?.measureInWindow((x, y, w, h) => onChoose?.(choice.id, choice.label, { x, y, w, h }));
  };
  return (
    <View ref={ref}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.choice,
          { borderColor: selected ? choice.accent : `${choice.accent}35`, backgroundColor: selected ? `${choice.accent}22` : 'rgba(255,255,255,0.045)' },
          pressed && !disabled ? styles.choicePressed : null,
        ]}>
        <View style={[styles.choiceIcon, { backgroundColor: `${choice.accent}22`, borderColor: `${choice.accent}55` }]}>
          {MOOD_ART[choice.state] ? (
            <Image source={MOOD_ART[choice.state]} style={{ height: 26, width: 26 }} contentFit="contain" />
          ) : (
            <IconSymbol name={choice.icon} size={20} color={choice.accent} />
          )}
        </View>
        <ThemedText style={styles.choiceLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {choice.label}
        </ThemedText>
        <ThemedText style={styles.choiceCaption} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
          {choice.caption}
        </ThemedText>
      </Pressable>
    </View>
  );
}

function currentMoodChoice(day: HomeDayRecord): MoodChoice | null {
  const answer = [...(day.promptAnswers ?? [])]
    .reverse()
    .find((candidate) => !candidate.dismissed && candidate.kind === 'feeling' && candidate.choiceIds.length > 0);
  const choiceId = answer?.choiceIds[0];
  if (choiceId === 'calm' || choiceId === 'loved') return MOOD_CHOICES.find((choice) => choice.id === 'good') ?? null;
  if (choiceId === 'low') return MOOD_CHOICES.find((choice) => choice.id === 'drained') ?? null;
  return MOOD_CHOICES.find((choice) => choice.id === choiceId) ?? null;
}

const styles = StyleSheet.create({
  choiceRow: { gap: 10, paddingVertical: 4, paddingRight: 8 },
  choice: {
    width: 126,
    minHeight: 130,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  choicePressed: { transform: [{ scale: 0.98 }] },
  choiceIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
  },
  choiceLabel: { fontSize: 14, fontWeight: '900', textAlign: 'center' },
  choiceCaption: { fontSize: 11.5, fontWeight: '600', lineHeight: 15, textAlign: 'center' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  secondaryLabel: { fontSize: 13.5, fontWeight: '800' },
});
