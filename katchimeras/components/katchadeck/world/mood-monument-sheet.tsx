import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import type { HomeDayRecord } from '@/types/home';
import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';

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
  const tabBarHeight = useBottomTabBarHeight();
  const selected = currentMoodChoice(day);
  const editable = !!onChoose;

  return (
    <View style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(260)} exiting={SlideOutDown.duration(200)} style={[styles.sheet, { bottom: tabBarHeight + 10 }]}>
        <View style={styles.grabber} />
        <ThemedText style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
          Mood Monument
        </ThemedText>
        <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {editable ? 'How did today feel overall?' : 'How this day felt'}
        </ThemedText>
        <ThemedText style={styles.body} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
          Every mood leaves a seed behind.
        </ThemedText>

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
      </Animated.View>
    </View>
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
          <IconSymbol name={choice.icon} size={20} color={choice.accent} />
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
  overlay: { ...StyleSheet.absoluteFillObject, elevation: 24, zIndex: 50 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 7, 15, 0.42)' },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    maxHeight: '74%',
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderRadius: 28,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#161226',
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, marginBottom: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.22)' },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 19, fontWeight: '900', lineHeight: 24 },
  body: { fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
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
