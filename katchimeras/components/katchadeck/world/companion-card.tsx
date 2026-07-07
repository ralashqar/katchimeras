import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';

// The village companion card (docs/katchimera-engagement-v1.md): a speech
// bubble in the creature's voice + three interaction threads (Quest / Insight /
// Reflection). Presentation borrows the Today prompt-chip language. The card is
// dumb — all content strings + state come from world.tsx.

export type CompanionThread = 'quest' | 'insight' | 'reflection';

type Criterion = { label: string; done: boolean };

type Props = {
  name: string;
  houseLevel?: number;
  openingLine: string;
  thread: CompanionThread | null;
  onSelectThread: (thread: CompanionThread) => void;
  onClose: () => void;
  // Quest thread.
  activeQuest: { title: string; hint: string } | null;
  questComplete: boolean;
  offer: { id: string; title: string; hint: string } | undefined;
  criteria: Criterion[];
  onAccept: () => void;
  onCashIn: () => void;
  // Insight + reflection threads.
  insightText: string;
  reflectionText: string;
  onAnswerReflection: () => void;
};

const CHIPS: { key: CompanionThread; icon: string; label: string }[] = [
  { key: 'quest', icon: 'sparkles', label: 'Quest' },
  { key: 'insight', icon: 'star.fill', label: 'Insight' },
  { key: 'reflection', icon: 'leaf.fill', label: 'Reflect' },
];

export function CompanionCard(props: Props) {
  const { thread } = props;
  return (
    <Pressable style={styles.scrim} onPress={props.onClose}>
      <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
        <View style={styles.headerRow}>
          <ThemedText style={styles.name} lightColor="#FFE2B8" darkColor="#FFE2B8">
            {props.name}
            {props.houseLevel ? `  ·  home Lv ${props.houseLevel}` : ''}
          </ThemedText>
          <Pressable hitSlop={8} onPress={props.onClose}>
            <IconSymbol name="xmark" size={12} color="rgba(251,243,228,0.7)" />
          </Pressable>
        </View>

        {/* Speech bubble — the opener, or the open thread's content. */}
        <View style={styles.bubble}>
          <ThemedText style={styles.bubbleText} lightColor="#EDEAF6" darkColor="#EDEAF6">
            {thread === null ? props.openingLine : threadLine(props)}
          </ThemedText>
          {thread === 'quest' ? <QuestBody {...props} /> : null}
          {thread === 'reflection' ? (
            <Pressable style={styles.action} onPress={props.onAnswerReflection}>
              <ThemedText style={styles.actionText} lightColor="#A8E2C6" darkColor="#A8E2C6">
                ❀ Answer in a note
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        {/* Option chips (Today prompt-chip language). */}
        <View style={styles.chipRow}>
          {CHIPS.map((chip) => {
            const active = thread === chip.key;
            return (
              <Pressable
                key={chip.key}
                onPress={() => props.onSelectThread(chip.key)}
                style={[styles.chip, active ? styles.chipActive : null]}>
                <IconSymbol name={chip.icon as never} size={13} color={active ? '#1B140A' : '#EDEAF6'} />
                <ThemedText
                  style={styles.chipLabel}
                  lightColor={active ? '#1B140A' : '#EDEAF6'}
                  darkColor={active ? '#1B140A' : '#EDEAF6'}>
                  {chip.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Pressable>
  );
}

function threadLine(props: Props): string {
  if (props.thread === 'insight') return props.insightText;
  if (props.thread === 'reflection') return props.reflectionText;
  // Quest thread intro line.
  if (props.questComplete) return 'You did it! Ready to make it count?';
  if (props.activeQuest) return `Still on it — here's where you're at.`;
  return props.offer ? 'Here’s something I could use your help with…' : 'Nothing pressing right now.';
}

function QuestBody(props: Props) {
  if (props.activeQuest) {
    return (
      <View style={{ marginTop: 8, gap: 4 }}>
        <ThemedText style={styles.questTitle} lightColor="#FFE2B8" darkColor="#FFE2B8">
          {props.activeQuest.title}
        </ThemedText>
        {props.criteria.map((c) => (
          <ThemedText
            key={c.label}
            style={styles.criterion}
            lightColor={c.done ? '#A8E2C6' : '#B7B2C6'}
            darkColor={c.done ? '#A8E2C6' : '#B7B2C6'}>
            {c.done ? '✓' : '○'} {c.label}
          </ThemedText>
        ))}
        {props.questComplete ? (
          <Pressable style={[styles.action, styles.cashIn]} onPress={props.onCashIn}>
            <ThemedText style={styles.actionText} lightColor="#1B140A" darkColor="#1B140A">
              ✦ Report back
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    );
  }
  if (!props.offer) return null;
  return (
    <Pressable style={styles.action} onPress={props.onAccept}>
      <ThemedText style={styles.actionText} lightColor="#A8E2C6" darkColor="#A8E2C6">
        ✦ Accept: {props.offer.title} — {props.offer.hint}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  card: {
    marginHorizontal: 14,
    marginBottom: 118,
    borderRadius: 22,
    padding: 16,
    backgroundColor: 'rgba(16,14,26,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,195,107,0.35)',
    gap: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '800' },
  bubble: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  questTitle: { fontSize: 13.5, fontWeight: '700' },
  criterion: { fontSize: 12.5 },
  action: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(168,226,198,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(168,226,198,0.45)',
  },
  cashIn: { backgroundColor: '#A8E2C6', borderColor: '#A8E2C6' },
  actionText: { fontSize: 13, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipActive: { backgroundColor: '#E9A93E', borderColor: '#E9A93E' },
  chipLabel: { fontSize: 13, fontWeight: '700' },
});
