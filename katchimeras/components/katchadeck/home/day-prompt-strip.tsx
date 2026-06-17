import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { DayPromptKind } from '@/types/home';
import type { ActiveDayPrompt, DayPromptPhotoCandidate } from '@/utils/day-prompt-engine';

type DayPromptStripProps = {
  prompt: ActiveDayPrompt | null;
  onAnswer: (kind: DayPromptKind, choiceIds: string[]) => void;
  onDismiss: (kind: DayPromptKind) => void;
  onSelectHeroPhoto: (photo: DayPromptPhotoCandidate) => void;
};

export function DayPromptStrip({ prompt, onAnswer, onDismiss, onSelectHeroPhoto }: DayPromptStripProps) {
  if (!prompt) {
    return null;
  }

  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {prompt.title}
          </ThemedText>
          {prompt.body ? (
            <ThemedText style={styles.body} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              {prompt.body}
            </ThemedText>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" onPress={() => onDismiss(prompt.id)} style={styles.dismiss}>
          <ThemedText style={styles.dismissLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            Later
          </ThemedText>
        </Pressable>
      </View>

      {prompt.id === 'meaningful_photo' ? (
        <ScrollView
          contentContainerStyle={styles.photoRow}
          horizontal
          showsHorizontalScrollIndicator={false}>
          {prompt.photoCandidates.map((photo) => (
            <Pressable
              accessibilityRole="button"
              key={photo.assetId}
              onPress={() => onSelectHeroPhoto(photo)}
              style={styles.photoButton}>
              <Image contentFit="cover" source={{ uri: photo.thumbnailUri }} style={styles.photo} transition={120} />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.chipRow}
          horizontal
          showsHorizontalScrollIndicator={false}>
          {prompt.options.slice(0, prompt.maxOptions).map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option.id}
              onPress={() => onAnswer(prompt.id, [option.id])}
              style={styles.chip}>
              <ThemedText style={styles.chipLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                {option.label}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      )}
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
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: 'rgba(12,10,20,0.72)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
  },
  photoRow: {
    gap: 10,
    paddingRight: 4,
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
