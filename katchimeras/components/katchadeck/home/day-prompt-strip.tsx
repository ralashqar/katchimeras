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
import { Meadow } from '@/constants/meadow-theme';
import { KatchaSurfacePalette, resolveParchmentAccent } from '@/constants/katcha-ui';
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
  dismissLabel?: string;
  /** Hide the secondary dismissal when the parent sheet already owns closing. */
  showDismiss?: boolean;
  /** Removes the card shell when this content already lives inside a sheet. */
  embedded?: boolean;
  presentation?: 'night' | 'parchment';
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const motionEasing = Easing.bezier(0.22, 1, 0.36, 1);

// A few warm lantern hues so the option dots feel alive without shouting.
const CHIP_ACCENTS = ['#FFC36B', '#92D7FF', '#9DDCB8', '#D5B8FF', '#F2C2A8', '#FFB4A2'];

// Secondary cream — matches the shared Meadow sheet's muted copy.
const CREAM_SOFT = 'rgba(251,243,228,0.75)';
const PARCHMENT = KatchaSurfacePalette.parchment;

export function DayPromptStrip({
  prompt,
  onAnswer,
  onDismiss,
  onSelectHeroPhoto,
  dismissLabel = 'Later',
  showDismiss = true,
  embedded = false,
  presentation = 'night',
}: DayPromptStripProps) {
  if (!prompt) {
    return null;
  }

  const options = prompt.options ?? [];
  const maxOptions = Number.isFinite(prompt.maxOptions) ? prompt.maxOptions : options.length;
  const photoCandidates = prompt.photoCandidates ?? [];

  return (
    <Animated.View
      // Re-key per prompt so the whole strip plays its intro when the question
      // changes, not just on first mount.
      key={prompt.id}
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(150)}
      style={[
        styles.wrap,
        presentation === 'parchment' && styles.wrapParchment,
        embedded && styles.wrapEmbedded,
      ]}>
      <View style={[styles.header, embedded && !showDismiss && styles.headerWithSheetClose]}>
        <Animated.View entering={FadeInDown.duration(280).easing(motionEasing)} style={styles.titleBlock}>
          <ThemedText style={styles.title} lightColor={presentation === 'parchment' ? PARCHMENT.text : Meadow.chipLabel} darkColor={presentation === 'parchment' ? PARCHMENT.text : Meadow.chipLabel}>
            {prompt.title}
          </ThemedText>
          {prompt.body ? (
            <ThemedText style={styles.body} lightColor={presentation === 'parchment' ? PARCHMENT.textSecondary : CREAM_SOFT} darkColor={presentation === 'parchment' ? PARCHMENT.textSecondary : CREAM_SOFT}>
              {prompt.body}
            </ThemedText>
          ) : null}
        </Animated.View>
        {showDismiss ? (
          <Pressable accessibilityRole="button" onPress={() => onDismiss(prompt.id)} style={[styles.dismiss, presentation === 'parchment' && styles.dismissParchment]}>
            <ThemedText style={styles.dismissLabel} lightColor={presentation === 'parchment' ? PARCHMENT.textSecondary : CREAM_SOFT} darkColor={presentation === 'parchment' ? PARCHMENT.textSecondary : CREAM_SOFT}>
              {dismissLabel}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {prompt.id === 'meaningful_photo' ? (
        <ScrollView contentContainerStyle={styles.photoRow} horizontal showsHorizontalScrollIndicator={false}>
          {photoCandidates.map((photo, index) => (
            <PromptPhoto
              key={photo.assetId}
              index={index}
              photo={photo}
              presentation={presentation}
              onPick={(from) => onSelectHeroPhoto(photo, from)}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.chipRow}>
          {options.slice(0, maxOptions).map((option, index) => (
            <PromptChip
              key={option.id}
              index={index}
              label={option.label}
              icon={option.icon}
              accent={CHIP_ACCENTS[index % CHIP_ACCENTS.length]}
              presentation={presentation}
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
  presentation,
}: {
  label: string;
  icon: IconSymbolName;
  accent: string;
  index: number;
  onPick: (from: FeedSourceRect) => void;
  presentation: 'night' | 'parchment';
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
        style={[styles.chip, presentation === 'parchment' && styles.chipParchment, animatedStyle]}>
        <IconSymbol name={icon} size={15} color={presentation === 'parchment' ? resolveParchmentAccent(accent).foreground : accent} />
        <ThemedText style={styles.chipLabel} lightColor={presentation === 'parchment' ? PARCHMENT.text : Meadow.chipLabel} darkColor={presentation === 'parchment' ? PARCHMENT.text : Meadow.chipLabel}>
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
  presentation,
}: {
  photo: DayPromptPhotoCandidate;
  index: number;
  onPick: (from: FeedSourceRect) => void;
  presentation: 'night' | 'parchment';
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
        style={[styles.photoButton, presentation === 'parchment' && styles.photoButtonParchment, animatedStyle]}>
        <Image contentFit="cover" source={{ uri: photo.thumbnailUri }} style={styles.photo} transition={120} />
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(34,27,16,0.94)',
    borderColor: Meadow.overlay.sheetBorder,
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    position: 'relative',
    zIndex: 45,
  },
  wrapParchment: {
    backgroundColor: PARCHMENT.elevated,
    borderColor: PARCHMENT.borderStrong,
    boxShadow: PARCHMENT.cardShadow,
  },
  wrapEmbedded: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    boxShadow: 'none',
    marginTop: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  headerWithSheetClose: {
    // Reserve the shared sheet close button's hit area without rendering a
    // second navigation control beside it.
    paddingRight: 44,
  },
  titleBlock: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  body: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  dismiss: {
    borderColor: Meadow.overlay.sheetBorder,
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  dismissParchment: {
    backgroundColor: PARCHMENT.subtle,
    borderColor: PARCHMENT.borderStrong,
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
    backgroundColor: Meadow.chip,
    borderColor: Meadow.chipBorder,
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 40,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipParchment: {
    backgroundColor: 'rgba(255,248,232,0.62)',
    borderColor: PARCHMENT.borderStrong,
    boxShadow: '-1px 2px 6px rgba(58,38,18,0.14), inset 0 1px 0 rgba(255,248,230,0.58)',
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
    backgroundColor: Meadow.chip,
    borderColor: Meadow.chipBorder,
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    height: 74,
    overflow: 'hidden',
    width: 74,
  },
  photoButtonParchment: {
    backgroundColor: PARCHMENT.subtle,
    borderColor: PARCHMENT.borderStrong,
    boxShadow: PARCHMENT.cardShadow,
  },
  photo: {
    height: '100%',
    width: '100%',
  },
});
