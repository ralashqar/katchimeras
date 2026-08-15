import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DayPromptStrip, type FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { ThemedText } from '@/components/themed-text';
import type { IconSymbolName } from '@/components/ui/icon-symbol';
import { ActionTile } from '@/components/katchadeck/ui/action-tile';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { dayPromptMenuLabels } from '@/constants/day-prompts';
import { Lantern } from '@/constants/theme';
import { KatchaSurfacePalette } from '@/constants/katcha-ui';
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
  quickCategories?: {
    id: string;
    title: string;
    icon: IconSymbolName;
    accent: string;
    section: PromptMenuSection;
  }[];
  suggestions?: { id: string; actionId: string; title: string; icon: IconSymbolName; accent: string; sourceMemoryId?: string }[];
  onSelectSuggestion?: (suggestion: { id: string; actionId: string; sourceMemoryId?: string }) => boolean | void;
  onQuickCategory?: (id: string) => void;
};

export type PromptMenuSection = 'capture' | 'context' | 'more';

const MENU_SECTIONS: { id: PromptMenuSection; title: string }[] = [
  { id: 'capture', title: 'Capture' },
  { id: 'context', title: 'Add context' },
  { id: 'more', title: 'More' },
];

const CHIP_ACCENTS = ['#FFC36B', '#92D7FF', '#9DDCB8', '#D5B8FF', '#F2C2A8', '#FFB4A2'];
const PARCHMENT = KatchaSurfacePalette.parchment;

function sectionForPrompt(prompt: ActiveDayPrompt): PromptMenuSection {
  if (prompt.id === 'meaningful_photo') return 'capture';
  if (prompt.id === 'people') return 'context';
  return 'more';
}

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
  suggestions = [],
  onSelectSuggestion,
  onQuickCategory,
}: MomentPromptSheetProps) {
  const [selected, setSelected] = useState<ActiveDayPrompt | null>(initialPrompt);
  const openedDirectlyRef = useRef(initialPrompt != null);

  return (
    <KatchaSheet
      header={selected ? undefined : { title: 'Add to today' }}
      maxHeight={selected ? '88%' : '74%'}
      onRequestClose={() => onClose()}
      scroll
      surface="parchment">
      {selected ? (
        <DayPromptStrip
          prompt={selected}
          dismissLabel="Back"
          showDismiss={!openedDirectlyRef.current}
          embedded
          presentation="parchment"
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
            if (openedDirectlyRef.current) {
              onClose();
              return;
            }
            setSelected(null);
          }}
        />
      ) : (
        <>
          {seeds && seeds.length > 0 ? (
            <View style={styles.seedSection}>
              <ThemedText style={styles.seedHeading} lightColor={PARCHMENT.textSecondary} darkColor={PARCHMENT.textSecondary}>
                Things that could shape today
              </ThemedText>
              <View style={styles.seedRow}>
                {seeds.map((seed) => (
                  <SeedChip key={seed.id} seed={seed} onComplete={onCompleteSeed} />
                ))}
              </View>
            </View>
          ) : null}

          {suggestions.length > 0 ? (
            <View style={styles.suggestionSection}>
              <ThemedText style={styles.seedHeading} lightColor={PARCHMENT.accentPressed} darkColor={PARCHMENT.accentPressed}>
                Suggested now
              </ThemedText>
              <View style={styles.suggestionRow}>
                {suggestions.slice(0, 2).map((suggestion) => (
                  <View key={`suggestion-${suggestion.id}`} style={styles.suggestionCell}>
                    <ActionTile
                      icon={suggestion.icon}
                      title={suggestion.title}
                      tint={suggestion.accent}
                      onPress={() => {
                        if (onSelectSuggestion?.(suggestion)) return;
                        onQuickCategory?.(suggestion.actionId);
                      }}
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {prompts.length === 0 && quickCategories.length === 0 ? (
            <ThemedText style={styles.empty} lightColor={PARCHMENT.textTertiary} darkColor={PARCHMENT.textTertiary}>
              Nothing is waiting for you. Add another piece whenever you like.
            </ThemedText>
          ) : (
            <View style={styles.menuSections}>
              {MENU_SECTIONS.map((section) => {
                const sectionCategories = quickCategories.filter((category) => category.section === section.id);
                const sectionPrompts = prompts.filter((prompt) => sectionForPrompt(prompt) === section.id);
                if (sectionCategories.length === 0 && sectionPrompts.length === 0) return null;

                return (
                  <View key={section.id} style={styles.menuSection}>
                    <ThemedText style={styles.menuHeading} lightColor={PARCHMENT.textSecondary} darkColor={PARCHMENT.textSecondary}>
                      {section.title}
                    </ThemedText>
                    <View style={styles.categoryGrid}>
                      {sectionCategories.map((category, index) => (
                        <Animated.View
                          key={`quick-${category.id}`}
                          entering={FadeInDown.delay(40 + index * 35).duration(280)}
                          style={styles.categoryCell}>
                          <ActionTile
                            icon={category.icon}
                            title={category.title}
                            tint={category.accent}
                            onPress={() => void onQuickCategory?.(category.id)}
                          />
                        </Animated.View>
                      ))}
                      {sectionPrompts.map((prompt, index) => {
                        const promptIndex = prompts.indexOf(prompt);
                        const accent = CHIP_ACCENTS[promptIndex % CHIP_ACCENTS.length];
                        return (
                          <Animated.View
                            key={prompt.id}
                            entering={FadeInDown.delay(40 + (sectionCategories.length + index) * 35).duration(280)}
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
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </KatchaSheet>
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
  menuSections: { gap: 16, paddingVertical: 4 },
  menuSection: { gap: 8 },
  menuHeading: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  categoryCell: {
    // Preserve the original compact three-across + menu. Categories launch
    // the conversational capture flow instead of becoming larger form cards.
    width: '30%',
  },
  suggestionSection: { gap: 8 },
  suggestionRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  suggestionCell: { width: '46%' },
});
