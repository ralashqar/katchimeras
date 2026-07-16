import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Image } from 'expo-image';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { KatchaSurfacePalette } from '@/constants/katcha-ui';
import { Meadow } from '@/constants/meadow-theme';
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
const PARCHMENT = KatchaSurfacePalette.parchment;

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
    <KatchaSheet
      header={{ eyebrow: 'Mood Monument', title: editable ? 'How did today feel overall?' : 'How this day felt' }}
      onRequestClose={() => onClose()}
      surface="parchment">
      {/* All five moods on one compact grid (3 + 2), no per-mood captions. */}
      <View style={styles.choiceGrid}>
        {MOOD_CHOICES.map((choice) => (
          <MoodChoiceButton
            key={choice.id}
            choice={choice}
            selected={selected?.id === choice.id}
            disabled={!editable}
            onChoose={onChoose}
          />
        ))}
      </View>

      {!editable && onOpenSanctuary ? (
        <Pressable accessibilityRole="button" onPress={onOpenSanctuary} style={styles.secondaryButton}>
          <IconSymbol name="sparkles" size={16} color={PARCHMENT.text} />
          <ThemedText style={styles.secondaryLabel} lightColor={PARCHMENT.text} darkColor={PARCHMENT.text}>
            View Sanctuary history
          </ThemedText>
        </Pressable>
      ) : null}
    </KatchaSheet>
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
    <View ref={ref} style={styles.choiceCell}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${choice.label} — ${choice.caption}`}
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.choice,
          {
            borderColor: selected ? `${choice.accent}D9` : Meadow.cardBorder,
            backgroundColor: selected ? `${choice.accent}2E` : 'rgba(255,248,232,0.48)',
            boxShadow: selected
              ? `-3px 5px 11px rgba(58,38,18,0.22), 0 0 0 1px ${choice.accent}42, 0 0 14px ${choice.accent}24, inset 0 2px 0 rgba(255,253,242,0.78), inset 0 -2px 0 rgba(104,67,28,0.10)`
              : '-3px 5px 10px rgba(58,38,18,0.22), 0 1px 1px rgba(255,252,238,0.70), inset 0 2px 0 rgba(255,253,242,0.72), inset 0 -2px 0 rgba(104,67,28,0.10)',
          },
          pressed && !disabled ? styles.choicePressed : null,
        ]}>
        <View pointerEvents="none" style={styles.bevelRim} />
        <View pointerEvents="none" style={styles.rimLight} />
        {MOOD_ART[choice.state] ? (
          <View style={[styles.artWell, selected && { backgroundColor: `${choice.accent}24` }]}>
            <Image source={MOOD_ART[choice.state]} style={styles.choiceArt} contentFit="contain" />
          </View>
        ) : (
          <IconSymbol name={choice.icon} size={22} color={choice.accent} />
        )}
        <ThemedText style={styles.choiceLabel} lightColor={PARCHMENT.text} darkColor={PARCHMENT.text}>
          {choice.label}
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
  // 3 tiles up top, 2 (centered) below — one glance, one tap.
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  choiceCell: { flexBasis: '30%', flexGrow: 0 },
  choice: {
    alignItems: 'center',
    gap: 3,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    position: 'relative',
  },
  choicePressed: {
    boxShadow: '-1px 2px 4px rgba(58,38,18,0.16), inset 0 2px 3px rgba(104,67,28,0.13)',
    transform: [{ translateY: 1 }, { scale: 0.98 }],
  },
  bevelRim: {
    ...StyleSheet.absoluteFillObject,
    borderBottomColor: 'rgba(104,67,28,0.20)',
    borderCurve: 'continuous',
    borderLeftColor: 'rgba(255,250,235,0.62)',
    borderRadius: 14,
    borderRightColor: 'rgba(104,67,28,0.14)',
    borderTopColor: 'rgba(255,253,242,0.88)',
    borderWidth: 1,
    position: 'absolute',
  },
  rimLight: {
    backgroundColor: 'rgba(255,255,247,0.68)',
    borderRadius: 999,
    height: 1,
    left: 11,
    position: 'absolute',
    right: 11,
    top: 2,
  },
  artWell: {
    alignItems: 'center',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 42,
  },
  choiceArt: { height: 30, width: 30 },
  choiceLabel: { fontSize: 11.5, fontWeight: '800', textAlign: 'center' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PARCHMENT.borderStrong,
    backgroundColor: PARCHMENT.subtle,
  },
  secondaryLabel: { fontSize: 13.5, fontWeight: '800' },
});
