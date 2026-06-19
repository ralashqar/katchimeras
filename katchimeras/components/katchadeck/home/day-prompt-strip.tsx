import { Image } from 'expo-image';
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import type { DayPromptKind } from '@/types/home';
import type { ActiveDayPrompt, DayPromptPhotoCandidate } from '@/utils/day-prompt-engine';

// Where on screen (window coords) the tapped item sits, so the answer's mote
// can launch from exactly there and fly into the egg.
export type FeedSourceRect = { x: number; y: number; w: number; h: number };

type DayPromptStripProps = {
  prompt: ActiveDayPrompt | null;
  onAnswer: (kind: DayPromptKind, choiceIds: string[], from: FeedSourceRect) => void;
  onDismiss: (kind: DayPromptKind) => void;
  onSelectHeroPhoto: (photo: DayPromptPhotoCandidate, from: FeedSourceRect) => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const motionEasing = Easing.bezier(0.22, 1, 0.36, 1);

// A few warm lantern hues so the option dots feel alive without shouting.
const CHIP_ACCENTS = ['#FFC36B', '#92D7FF', '#9DDCB8', '#D5B8FF', '#F2C2A8', '#FFB4A2'];

export function DayPromptStrip({ prompt, onAnswer, onDismiss, onSelectHeroPhoto }: DayPromptStripProps) {
  if (!prompt) {
    return null;
  }

  return (
    <Animated.View
      // Re-key per prompt so the whole strip plays its intro when the question
      // changes, not just on first mount.
      key={prompt.id}
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(150)}
      style={styles.wrap}>
      <View style={styles.header}>
        <Animated.View entering={FadeInDown.duration(280).easing(motionEasing)} style={styles.titleBlock}>
          <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {prompt.title}
          </ThemedText>
          {prompt.body ? (
            <ThemedText style={styles.body} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              {prompt.body}
            </ThemedText>
          ) : null}
        </Animated.View>
        <Pressable accessibilityRole="button" onPress={() => onDismiss(prompt.id)} style={styles.dismiss}>
          <ThemedText style={styles.dismissLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            Later
          </ThemedText>
        </Pressable>
      </View>

      {prompt.id === 'meaningful_photo' ? (
        <ScrollView contentContainerStyle={styles.photoRow} horizontal showsHorizontalScrollIndicator={false}>
          {prompt.photoCandidates.map((photo, index) => (
            <PromptPhoto
              key={photo.assetId}
              index={index}
              photo={photo}
              onPick={(from) => onSelectHeroPhoto(photo, from)}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.chipRow}>
          {prompt.options.slice(0, prompt.maxOptions).map((option, index) => (
            <PromptChip
              key={option.id}
              index={index}
              label={option.label}
              icon={option.icon}
              accent={CHIP_ACCENTS[index % CHIP_ACCENTS.length]}
              onPick={(from) => onAnswer(prompt.id, [option.id], from)}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

function PromptChip({
  label,
  icon,
  accent,
  index,
  onPick,
}: {
  label: string;
  icon: IconSymbolName;
  accent: string;
  index: number;
  onPick: (from: FeedSourceRect) => void;
}) {
  const ref = useRef<View | null>(null);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const pick = () => {
    ref.current?.measureInWindow((x, y, w, h) => onPick({ x, y, w, h }));
  };

  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 45).duration(320).easing(motionEasing)}>
      <AnimatedPressable
        ref={ref}
        accessibilityRole="button"
        onPressIn={() => {
          scale.value = withSpring(0.93, { damping: 15, stiffness: 320 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 240 });
        }}
        onPress={pick}
        style={[styles.chip, { borderColor: `${accent}40` }, animatedStyle]}>
        <IconSymbol name={icon} size={15} color={accent} />
        <ThemedText style={styles.chipLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {label}
        </ThemedText>
      </AnimatedPressable>
    </Animated.View>
  );
}

function PromptPhoto({
  photo,
  index,
  onPick,
}: {
  photo: DayPromptPhotoCandidate;
  index: number;
  onPick: (from: FeedSourceRect) => void;
}) {
  const ref = useRef<View | null>(null);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const pick = () => {
    ref.current?.measureInWindow((x, y, w, h) => onPick({ x, y, w, h }));
  };

  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 55).duration(340).easing(motionEasing)}>
      <AnimatedPressable
        ref={ref}
        accessibilityRole="button"
        onPressIn={() => {
          scale.value = withSpring(0.93, { damping: 15, stiffness: 320 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 240 });
        }}
        onPress={pick}
        style={[styles.photoButton, animatedStyle]}>
        <Image contentFit="cover" source={{ uri: photo.thumbnailUri }} style={styles.photo} transition={120} />
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 19,
  },
  body: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  dismiss: {
    borderColor: 'rgba(255,255,255,0.1)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  dismissLabel: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 2,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: 'rgba(12,10,20,0.72)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 40,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
  },
  photoRow: {
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 2,
  },
  photoButton: {
    backgroundColor: 'rgba(12,10,20,0.72)',
    borderColor: 'rgba(255,241,228,0.28)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    height: 74,
    overflow: 'hidden',
    width: 74,
  },
  photo: {
    height: '100%',
    width: '100%',
  },
});
