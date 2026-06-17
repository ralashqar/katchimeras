import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { DayPromptStrip, type FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { ThemedText } from '@/components/themed-text';
import { dayPromptMenuLabels } from '@/constants/day-prompts';
import { Lantern } from '@/constants/theme';
import type { DayPromptKind } from '@/types/home';
import type { ActiveDayPrompt, DayPromptPhotoCandidate } from '@/utils/day-prompt-engine';

// The "Add to today" sheet — replaces the old radial. A bottom panel of prompt
// category buttons (Feeling, Photo, People…); tapping one opens that prompt's
// options right here, and answering flies the choice into the egg. Only prompts
// that are currently answerable appear (so e.g. no recent photos → no Photo).
type MomentPromptSheetProps = {
  prompts: ActiveDayPrompt[];
  // The "what did it mean?" prompt that always follows a photo pick — Photo and
  // Photo meaning are one paired sequence, never separate buttons.
  meaningPrompt: ActiveDayPrompt;
  onClose: () => void;
  onAnswer: (kind: DayPromptKind, choiceIds: string[], from: FeedSourceRect) => void;
  onSelectHeroPhoto: (photo: DayPromptPhotoCandidate, from: FeedSourceRect) => void;
};

const CHIP_ACCENTS = ['#FFC36B', '#92D7FF', '#9DDCB8', '#D5B8FF', '#F2C2A8', '#FFB4A2'];

export function MomentPromptSheet({
  prompts,
  meaningPrompt,
  onClose,
  onAnswer,
  onSelectHeroPhoto,
}: MomentPromptSheetProps) {
  const [selected, setSelected] = useState<ActiveDayPrompt | null>(null);
  // Float the sheet just above the (absolute, pill-shaped) tab bar so the bar
  // never overlaps it.
  const tabBarHeight = useBottomTabBarHeight();

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

        {selected ? (
          <DayPromptStrip
            prompt={selected}
            // Answering or picking a photo feeds the egg (handled by the parent),
            // then the sheet closes; "Later" just returns to the category list.
            onAnswer={(kind, choiceIds, from) => {
              onAnswer(kind, choiceIds, from);
              onClose();
            }}
            onSelectHeroPhoto={(photo, from) => {
              // Picking a photo feeds the egg, then flows straight into the
              // paired "what did it mean?" step rather than closing.
              onSelectHeroPhoto(photo, from);
              setSelected(meaningPrompt);
            }}
            onDismiss={() => setSelected(null)}
          />
        ) : (
          <>
            <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              Add to today
            </ThemedText>
            {prompts.length === 0 ? (
              <ThemedText style={styles.empty} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                {"You've answered everything for now — the egg has what it needs today."}
              </ThemedText>
            ) : (
              <ScrollView
                contentContainerStyle={styles.categoryRow}
                showsVerticalScrollIndicator={false}
                style={styles.categoryScroll}>
                {prompts.map((prompt, index) => (
                  <Animated.View key={prompt.id} entering={FadeInDown.delay(40 + index * 40).duration(280)}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setSelected(prompt)}
                      style={({ pressed }) => [styles.category, pressed && styles.categoryPressed]}>
                      <View
                        style={[
                          styles.categoryDot,
                          {
                            backgroundColor: CHIP_ACCENTS[index % CHIP_ACCENTS.length],
                            boxShadow: `0 0 10px ${CHIP_ACCENTS[index % CHIP_ACCENTS.length]}AA`,
                          },
                        ]}
                      />
                      <ThemedText style={styles.categoryLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                        {dayPromptMenuLabels[prompt.id]}
                      </ThemedText>
                    </Pressable>
                  </Animated.View>
                ))}
              </ScrollView>
            )}
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
              <ThemedText style={styles.closeLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                Close
              </ThemedText>
            </Pressable>
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    // Stack above other in-screen overlays; the position offset (above) is what
    // clears the floating tab bar.
    elevation: 24,
    zIndex: 50,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 7, 15, 0.42)',
  },
  sheet: {
    backgroundColor: '#161226',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
    gap: 12,
    left: 12,
    paddingBottom: 18,
    paddingHorizontal: 18,
    paddingTop: 12,
    position: 'absolute',
    right: 12,
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    height: 4,
    marginBottom: 6,
    width: 38,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  empty: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    paddingVertical: 8,
  },
  categoryScroll: {
    maxHeight: 260,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 4,
  },
  category: {
    alignItems: 'center',
    backgroundColor: 'rgba(12,10,20,0.72)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  categoryPressed: {
    backgroundColor: 'rgba(40,34,60,0.9)',
  },
  categoryDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 17,
  },
  close: {
    alignSelf: 'center',
    paddingTop: 4,
  },
  closeLabel: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
  },
});
