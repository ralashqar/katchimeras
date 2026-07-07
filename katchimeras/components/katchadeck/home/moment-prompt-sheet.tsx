import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DayPromptStrip, type FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { ThemedText } from '@/components/themed-text';
import type { IconSymbolName } from '@/components/ui/icon-symbol';
import { ActionTile } from '@/components/katchadeck/ui/action-tile';
import { MeadowSheet } from '@/components/katchadeck/ui/meadow-sheet';
import { dayPromptMenuLabels } from '@/constants/day-prompts';
import { Lantern } from '@/constants/theme';
import type { DayPromptKind } from '@/types/home';
import type { DailySeed } from '@/utils/daily-seeds-engine';
import type { ActiveDayPrompt, DayPromptPhotoCandidate } from '@/utils/day-prompt-engine';

// The "Add to today" sheet — replaces the old radial. A bottom panel of prompt
// category buttons (Feeling, Photo, People…); tapping one opens that prompt's
// options right here, and answering flies the choice into the egg. Only prompts
// that are currently answerable appear (so e.g. no recent photos → no Photo).
type MomentPromptSheetProps = {
  prompts: ActiveDayPrompt[];
  onClose: () => void;
  onAnswer: (kind: DayPromptKind, choiceIds: string[], from: FeedSourceRect) => void;
  onSelectHeroPhoto: (photo: DayPromptPhotoCandidate, from: FeedSourceRect) => void;
  // Today Patch V2 — Daily Seeds shown above the prompt categories (World only).
  seeds?: (DailySeed & { earned: boolean })[];
  onCompleteSeed?: (seedId: string, from: FeedSourceRect) => void;
  // Open straight into a specific prompt (e.g. the photos prompt from the world's
  // golden "!"), skipping the category list.
  initialPrompt?: ActiveDayPrompt | null;
  // Let a parent replace a category with a richer domain-specific surface while
  // still keeping the category in this menu.
  onSelectPrompt?: (prompt: ActiveDayPrompt) => boolean | void;
  // Fired when a prompt is dismissed via its "Later" button (passes the prompt id).
  onPromptDismiss?: (promptId: string) => void;
  // Categories that DON'T open a strip prompt here — tapping hands off to the
  // parent, which opens the category's own sheet (Mood / Sleep). Rendered
  // first in the same grid so the menu still shows every category.
  quickCategories?: { id: string; title: string; icon: IconSymbolName; accent: string }[];
  onQuickCategory?: (id: string) => void;
};

const CHIP_ACCENTS = ['#FFC36B', '#92D7FF', '#9DDCB8', '#D5B8FF', '#F2C2A8', '#FFB4A2'];

export function MomentPromptSheet({
  prompts,
  onClose,
  onAnswer,
  onSelectHeroPhoto,
  seeds,
  onCompleteSeed,
  initialPrompt = null,
  onSelectPrompt,
  onPromptDismiss,
  quickCategories = [],
  onQuickCategory,
}: MomentPromptSheetProps) {
  const [selected, setSelected] = useState<ActiveDayPrompt | null>(initialPrompt);

  return (
    <MeadowSheet onClose={onClose} title={selected ? undefined : 'Add to today'}>
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
            // Picking a photo opens the full-screen essence flow ("what did
            // this mean?"); the parent closes this sheet and navigates.
            onSelectHeroPhoto(photo, from);
          }}
          onDismiss={() => {
            onPromptDismiss?.(selected.id);
            setSelected(null);
          }}
        />
      ) : (
        <>
          {seeds && seeds.length > 0 ? (
            <View style={styles.seedSection}>
              <ThemedText style={styles.seedHeading} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                Things that could shape today
              </ThemedText>
              <View style={styles.seedRow}>
                {seeds.map((seed) => (
                  <SeedChip key={seed.id} seed={seed} onComplete={onCompleteSeed} />
                ))}
              </View>
            </View>
          ) : null}

          {prompts.length === 0 && quickCategories.length === 0 ? (
            <ThemedText style={styles.empty} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              {"You've answered everything for now — the egg has what it needs today."}
            </ThemedText>
          ) : (
            <ScrollView
              contentContainerStyle={styles.categoryGrid}
              showsVerticalScrollIndicator={false}
              style={styles.categoryScroll}>
              {quickCategories.map((category, index) => (
                <Animated.View
                  key={`quick-${category.id}`}
                  entering={FadeInDown.delay(40 + index * 35).duration(280)}
                  style={styles.categoryCell}>
                  <ActionTile icon={category.icon} title={category.title} tint={category.accent} onPress={() => onQuickCategory?.(category.id)} />
                </Animated.View>
              ))}
              {prompts.map((prompt, index) => {
                const accent = CHIP_ACCENTS[index % CHIP_ACCENTS.length];
                return (
                  <Animated.View
                    key={prompt.id}
                    entering={FadeInDown.delay(40 + (quickCategories.length + index) * 35).duration(280)}
                    style={styles.categoryCell}>
                    <ActionTile
                      icon={prompt.categoryIcon}
                      title={dayPromptMenuLabels[prompt.id]}
                      tint={accent}
                      onPress={() => {
                        if (onSelectPrompt?.(prompt)) return;
                        setSelected(prompt);
                      }}
                    />
                  </Animated.View>
                );
              })}
            </ScrollView>
          )}
        </>
      )}
    </MeadowSheet>
  );
}

// A seed chip that measures its own screen rect on tap, so the parent can fly a
// glowing mote from here into the egg (same comet flight as the prompt chips).
function SeedChip({
  seed,
  onComplete,
}: {
  seed: DailySeed & { earned: boolean };
  onComplete?: (seedId: string, from: FeedSourceRect) => void;
}) {
  const ref = useRef<View | null>(null);
  const tappable = !seed.earned && seed.completion === 'manual' && !!onComplete;
  const handlePress = () => {
    ref.current?.measureInWindow((x, y, w, h) => onComplete?.(seed.id, { x, y, w, h }));
  };
  return (
    <Pressable
      ref={ref}
      disabled={!tappable}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.seedChip,
        seed.earned && styles.seedChipEarned,
        pressed && tappable && styles.seedChipPressed,
      ]}>
      <ThemedText style={styles.seedEmoji}>{seed.earned ? '✓' : seed.emoji}</ThemedText>
      <ThemedText
        numberOfLines={2}
        style={[styles.seedLabel, seed.earned && styles.seedLabelEarned]}
        lightColor={Lantern.moon50}
        darkColor={Lantern.moon50}>
        {seed.label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  seedSection: { gap: 8 },
  seedHeading: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  seedRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  seedChip: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(12,10,20,0.72)',
    borderColor: 'rgba(125,232,205,0.35)',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 11,
  },
  seedChipEarned: { borderColor: 'rgba(125,232,205,0.7)', backgroundColor: 'rgba(125,232,205,0.12)' },
  seedChipPressed: { backgroundColor: 'rgba(40,34,60,0.9)' },
  seedEmoji: { fontSize: 18, lineHeight: 22 },
  seedLabel: { fontSize: 11.5, fontWeight: '700', lineHeight: 15, textAlign: 'center' },
  seedLabelEarned: { opacity: 0.7 },
  empty: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    paddingVertical: 8,
    textAlign: 'center',
  },
  categoryScroll: {
    maxHeight: 320,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  categoryCell: {
    // Three across, centered — wraps to as many rows as needed (6 categories =
    // a clean 3×2 grid).
    width: '30%',
  },
});
