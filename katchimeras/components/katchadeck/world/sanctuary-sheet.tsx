import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { dayPromptRegistry } from '@/constants/day-prompts';
import { Lantern } from '@/constants/theme';
import type { DayPromptAnswer, DayPromptKind, HomeDayRecord } from '@/types/home';

const REFLECTION_KINDS = new Set<DayPromptKind>([
  'feeling',
  'inner_weather',
  'day_word',
  'meaning',
  'gratitude',
  'highlight',
  'people',
  'for_who',
  'body',
  'intention',
  'energy',
]);

const SLEEP_LINE: Record<string, string> = {
  good: 'The day began rested',
  normal: 'The day began steady',
  low: 'The day began on little sleep',
};

const PROMPT_ACCENTS: Partial<Record<DayPromptKind, string>> = {
  feeling: '#F5AFC6',
  inner_weather: '#A7D5FF',
  day_word: '#A7D5FF',
  gratitude: '#FFC36B',
  highlight: '#FFC36B',
  people: '#F4BE8D',
  for_who: '#F4BE8D',
  body: '#91D8C7',
  intention: '#C77DFF',
  energy: '#FFC36B',
};

const MEANING_META: Record<string, { icon: IconSymbolName; accent: string }> = {
  calm: { icon: 'leaf.fill', accent: '#91D8C7' },
  energy: { icon: 'bolt.fill', accent: '#FFC36B' },
  together: { icon: 'person.2.fill', accent: '#F4BE8D' },
  meaningful: { icon: 'sparkles', accent: '#C77DFF' },
};

const MEANING_FALLBACK: { icon: IconSymbolName; accent: string } = { icon: 'sparkles', accent: '#FFC36B' };

type SanctuaryHistoryItem = {
  id: string;
  time: number;
  timeLabel: string;
  category: string;
  label: string;
  noteText?: string | null;
  icon: IconSymbolName;
  accent: string;
};

export function SanctuarySheet({
  day,
  onReflect,
  onClose,
}: {
  day: HomeDayRecord;
  onReflect?: () => void;
  onClose: () => void;
}) {
  const tabBarHeight = useBottomTabBarHeight();
  const history = buildSanctuaryHistory(day);
  const sleepLine = day.sleep ? SLEEP_LINE[day.sleep.quality] : null;

  return (
    <View style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View entering={SlideInDown.duration(260)} exiting={SlideOutDown.duration(200)} style={[styles.sheet, { bottom: tabBarHeight + 10 }]}>
        <View style={styles.grabber} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <ThemedText style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            The Sanctuary
          </ThemedText>
          <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            How today felt
          </ThemedText>

          <View style={styles.body}>
            {sleepLine ? (
              <View style={styles.sleepRow}>
                <IconSymbol name="moon.stars.fill" size={15} color={Lantern.moon300} />
                <ThemedText style={styles.sleepText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                  {sleepLine}
                </ThemedText>
              </View>
            ) : null}

            {history.length === 0 ? (
              <ThemedText style={styles.empty} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                Yet to reflect. Give today a feeling.
              </ThemedText>
            ) : (
              history.map((item) => (
                <View key={item.id} style={styles.historyRow}>
                  <View style={[styles.historyIcon, { backgroundColor: `${item.accent}20`, borderColor: `${item.accent}55` }]}>
                    <IconSymbol name={item.icon} size={16} color={item.accent} />
                  </View>
                  <View style={styles.historyBody}>
                    <View style={styles.historyMetaRow}>
                      <ThemedText style={styles.historyTime} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                        {item.timeLabel}
                      </ThemedText>
                      <ThemedText style={styles.historyCategory} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                        {item.category}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.historyLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                      {item.label}
                    </ThemedText>
                    {item.noteText ? (
                      <ThemedText style={styles.historyNote} numberOfLines={3} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                        {item.noteText}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
              ))
            )}

            {onReflect ? (
              <Pressable accessibilityRole="button" onPress={onReflect} style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}>
                <IconSymbol name="sparkles" size={16} color={Lantern.moon50} />
                <ThemedText style={styles.addBtnLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                  Give today a feeling
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function buildSanctuaryHistory(day: HomeDayRecord): SanctuaryHistoryItem[] {
  const entries: SanctuaryHistoryItem[] = [];
  const push = (
    createdAt: string,
    id: string,
    icon: IconSymbolName,
    accent: string,
    category: string,
    label: string,
    noteText?: string | null
  ) => {
    const time = Date.parse(createdAt);
    if (Number.isNaN(time) || !label.trim()) return;
    entries.push({ id, time, timeLabel: formatClock(time), icon, accent, category, label, noteText });
  };

  for (const answer of day.promptAnswers ?? []) {
    const item = answerToHistory(answer);
    if (item) push(answer.createdAt, `answer-${answer.id}`, item.icon, item.accent, item.category, item.label, answer.noteText);
  }

  const hero = day.heroPhoto;
  if (hero) {
    hero.meaningLabels.forEach((label, index) => {
      const meta = MEANING_META[hero.meaningChoiceIds[index]] ?? MEANING_FALLBACK;
      push(hero.selectedAt, `hero-${hero.assetId}-${index}`, meta.icon, meta.accent, 'Photo meaning', label, hero.noteText);
    });
  }

  (day.capturedMeanings ?? []).forEach((captured, index) => {
    const meta = MEANING_META[captured.archetype] ?? MEANING_FALLBACK;
    push(captured.createdAt, `captured-${index}-${captured.createdAt}`, meta.icon, meta.accent, 'Captured moment', captured.label);
  });

  for (const note of day.notes ?? []) {
    const meta = MEANING_META[note.archetype] ?? MEANING_FALLBACK;
    push(
      note.createdAt,
      `note-${note.id}`,
      note.kind === 'voice' ? 'mic.fill' : 'square.and.pencil',
      meta.accent,
      note.kind === 'voice' ? 'Voice reflection' : 'Written reflection',
      note.label,
      note.text
    );
  }

  return entries.sort((left, right) => left.time - right.time);
}

function answerToHistory(answer: DayPromptAnswer): Omit<SanctuaryHistoryItem, 'id' | 'time' | 'timeLabel'> | null {
  if (answer.dismissed || answer.labels.length === 0 || !REFLECTION_KINDS.has(answer.kind)) return null;
  if (answer.kind === 'meaning') {
    const meta = MEANING_META[answer.choiceIds[0]] ?? MEANING_FALLBACK;
    return { icon: meta.icon, accent: meta.accent, category: 'Photo meaning', label: answer.labels.join(' / ') };
  }
  return {
    icon: resolveAnswerIcon(answer.kind, answer.choiceIds),
    accent: PROMPT_ACCENTS[answer.kind] ?? '#C9C2E8',
    category: humanizeKind(answer.kind),
    label: answer.labels.join(' / '),
  };
}

function resolveAnswerIcon(kind: DayPromptKind, choiceIds: string[]): IconSymbolName {
  const prompt = dayPromptRegistry[kind];
  const option = prompt?.options.find((candidate) => choiceIds.includes(candidate.id));
  return option?.icon ?? prompt?.categoryIcon ?? 'sparkles';
}

function humanizeKind(kind: DayPromptKind): string {
  return kind.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatClock(time: number): string {
  const date = new Date(time);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes < 10 ? `0${minutes}` : minutes} ${period}`;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, elevation: 24, zIndex: 50 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 7, 15, 0.42)' },
  sheet: {
    backgroundColor: '#161226',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
    left: 12,
    maxHeight: '74%',
    paddingBottom: 14,
    paddingHorizontal: 18,
    paddingTop: 12,
    position: 'absolute',
    right: 12,
  },
  grabber: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, height: 4, marginBottom: 6, width: 38 },
  scroll: { gap: 8, paddingBottom: 4 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '800', lineHeight: 23 },
  body: { gap: 10, paddingTop: 8 },
  sleepRow: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingVertical: 4 },
  sleepText: { flex: 1, fontSize: 14, fontWeight: '600' },
  empty: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  historyRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderCurve: 'continuous',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  historyIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  historyBody: { flex: 1, gap: 4 },
  historyMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyTime: { fontSize: 11, fontWeight: '700' },
  historyCategory: { flex: 1, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  historyLabel: { fontSize: 14, fontWeight: '800', lineHeight: 18 },
  historyNote: { fontSize: 12.5, fontWeight: '600', lineHeight: 17 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(168,201,154,0.45)',
    backgroundColor: 'rgba(168,201,154,0.12)',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  addBtnPressed: { backgroundColor: 'rgba(168,201,154,0.22)' },
  addBtnLabel: { fontSize: 13.5, fontWeight: '800' },
});
