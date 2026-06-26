import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import type { FoodMoment, HomeDayRecord } from '@/types/home';
import type { DayChronicle } from '@/utils/chronicle-engine';
import type { MemoryQuest, MemoryQuestType } from '@/utils/memory-quests-engine';

type WorldDashboardProps = {
  days: HomeDayRecord[];
  quests: MemoryQuest[];
  onQuest?: (type: MemoryQuestType) => void;
  chronicle?: DayChronicle | null;
  onOpenChronicle?: () => void;
  foodMoments?: FoodMoment[];
  onOpenFood?: () => void;
  discoveriesUnlocked?: number;
  discoveriesTotal?: number;
  onOpenDiscoveries?: () => void;
  onOpenCosmetics?: () => void;
  essenceBalance?: number;
};

// Consecutive calendar days (ending most-recently) that have hatched a creature.
function computeStreak(days: HomeDayRecord[]): number {
  const hatched = days
    .filter((day) => day.state === 'hatched')
    .map((day) => day.isoDate)
    .sort();
  if (hatched.length === 0) return 0;
  const set = new Set(hatched);
  let cursor = hatched[hatched.length - 1];
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    const prev = new Date(`${cursor}T00:00:00`);
    prev.setDate(prev.getDate() - 1);
    cursor = prev.toISOString().slice(0, 10);
  }
  return streak;
}

// A friendly one-word read of the recent mood, from the dominant score axis.
function computeMood(days: HomeDayRecord[]): { word: string; blurb: string } {
  const recent = days.slice(-7);
  const totals = { calm: 0, energy: 0, social: 0, exploration: 0, focus: 0 };
  let counted = 0;
  for (const day of recent) {
    if (!day.scores) continue;
    counted += 1;
    totals.calm += day.scores.calm ?? 0;
    totals.energy += day.scores.energy ?? 0;
    totals.social += day.scores.social ?? 0;
    totals.exploration += day.scores.exploration ?? 0;
    totals.focus += day.scores.focus ?? 0;
  }
  if (counted === 0) return { word: 'Quiet', blurb: 'Your world is waiting to grow.' };
  const ranked = (Object.entries(totals) as [keyof typeof totals, number][]).sort((a, b) => b[1] - a[1]);
  const map: Record<string, { word: string; blurb: string }> = {
    calm: { word: 'Peaceful', blurb: 'Your world feels calm.' },
    energy: { word: 'Lively', blurb: 'Your world is full of motion.' },
    social: { word: 'Warm', blurb: 'Your world is full of people.' },
    exploration: { word: 'Curious', blurb: 'Your world keeps wandering.' },
    focus: { word: 'Grounded', blurb: 'Your world feels steady.' },
  };
  return map[ranked[0][0]] ?? { word: 'Peaceful', blurb: 'Your world feels calm.' };
}

// Last 7 days of step activity, normalised to bar heights for the mini chart.
function computeWeek(days: HomeDayRecord[]): { key: string; label: string; value: number; isLast: boolean }[] {
  const recent = days.slice(-7);
  const max = Math.max(1, ...recent.map((day) => day.stepsCount ?? 0));
  return recent.map((day, index) => ({
    key: day.id,
    label: day.isToday ? '·' : day.dayLabel.slice(0, 1).toUpperCase(),
    value: (day.stepsCount ?? 0) / max,
    isLast: index === recent.length - 1,
  }));
}

// The dashboard below the diorama: Memory Quests, then World Streak / This Week /
// World Mood cards. Mirrors the reference home layout.
export function WorldDashboard({
  days,
  quests,
  onQuest,
  chronicle,
  onOpenChronicle,
  foodMoments,
  onOpenFood,
  discoveriesUnlocked = 0,
  discoveriesTotal = 0,
  onOpenDiscoveries,
  onOpenCosmetics,
  essenceBalance,
}: WorldDashboardProps) {
  const streak = computeStreak(days);
  const mood = computeMood(days);
  const week = computeWeek(days);

  return (
    <View style={styles.root}>
      {typeof essenceBalance === 'number' ? (
        <View style={styles.essenceChip}>
          <ThemedText style={styles.essenceChipMark} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>
            ✦
          </ThemedText>
          <ThemedText style={styles.essenceChipValue} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {essenceBalance}
          </ThemedText>
          <ThemedText style={styles.essenceChipLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            Essence
          </ThemedText>
        </View>
      ) : null}

      {chronicle?.hasStory ? (
        <Pressable onPress={onOpenChronicle} style={styles.chronicleCard}>
          <View style={styles.sectionHead}>
            <IconSymbol name="book.closed.fill" size={13} color={Lantern.ember300} />
            <ThemedText style={styles.chronicleKicker} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              Chronicle
            </ThemedText>
            <IconSymbol name="chevron.right" size={13} color={Lantern.moon500} style={styles.chronicleChevron} />
          </View>
          <ThemedText type="subtitle" lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {chronicle.title}
          </ThemedText>
          <ThemedText style={styles.chronicleSummary} numberOfLines={2} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            {chronicle.summary}
          </ThemedText>
        </Pressable>
      ) : null}

      {foodMoments && foodMoments.length > 0 ? (
        <Pressable onPress={onOpenFood} style={styles.chronicleCard}>
          <View style={styles.sectionHead}>
            <ThemedText style={styles.sleepEmoji}>🍽</ThemedText>
            <ThemedText style={styles.chronicleKicker} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              Food Vault
            </ThemedText>
            <IconSymbol name="chevron.right" size={13} color={Lantern.moon500} style={styles.chronicleChevron} />
          </View>
          <ThemedText style={styles.foodCardRow}>
            {foodMoments.slice(0, 8).map((moment) => moment.emoji).join('  ')}
          </ThemedText>
        </Pressable>
      ) : null}

      {onOpenDiscoveries && discoveriesTotal > 0 ? (
        <Pressable onPress={onOpenDiscoveries} style={styles.chronicleCard}>
          <View style={styles.sectionHead}>
            <ThemedText style={styles.sleepEmoji}>🏛</ThemedText>
            <ThemedText style={styles.chronicleKicker} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              Discoveries
            </ThemedText>
            <IconSymbol name="chevron.right" size={13} color={Lantern.moon500} style={styles.chronicleChevron} />
          </View>
          <ThemedText style={styles.chronicleSummary} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            {discoveriesUnlocked} of {discoveriesTotal} found — milestones from your life.
          </ThemedText>
        </Pressable>
      ) : null}

      {onOpenCosmetics ? (
        <Pressable onPress={onOpenCosmetics} style={styles.chronicleCard}>
          <View style={styles.sectionHead}>
            <ThemedText style={styles.sleepEmoji}>🎨</ThemedText>
            <ThemedText style={styles.chronicleKicker} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              Customize
            </ThemedText>
            <IconSymbol name="chevron.right" size={13} color={Lantern.moon500} style={styles.chronicleChevron} />
          </View>
          <ThemedText style={styles.chronicleSummary} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            Lantern colours unlocked by your discoveries.
          </ThemedText>
        </Pressable>
      ) : null}

      {quests.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <IconSymbol name="sparkles" size={13} color={Lantern.auroraTeal} />
            <ThemedText style={styles.sectionTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              Memory Quests
            </ThemedText>
          </View>
          <View style={styles.seedRow}>
            {quests.map((quest) => (
              <QuestCard key={quest.id} quest={quest} onPress={onQuest} />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={styles.statHead}>
            <IconSymbol name="flame.fill" size={12} color={Lantern.ember300} />
            <ThemedText style={styles.statTitle} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
              Streak
            </ThemedText>
          </View>
          <View style={styles.streakValueRow}>
            <ThemedText style={styles.statBig} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
              {streak}
            </ThemedText>
            <ThemedText style={styles.statUnit} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              days
            </ThemedText>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statHead}>
            <IconSymbol name="leaf.fill" size={12} color={Lantern.auroraTeal} />
            <ThemedText style={styles.statTitle} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
              Energy
            </ThemedText>
          </View>
          <ThemedText style={styles.statWord} lightColor={Lantern.moon50} darkColor={Lantern.moon50} numberOfLines={1}>
            {mood.word}
          </ThemedText>
        </View>

        <View style={styles.statCard}>
          <ThemedText style={styles.statTitle} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            This Week
          </ThemedText>
          <View style={styles.chart}>
            {week.map((bar) => (
              <View key={bar.key} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { height: `${Math.max(8, Math.round(bar.value * 100))}%` },
                      bar.isLast ? styles.barFillLast : null,
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function QuestCard({ quest, onPress }: { quest: MemoryQuest; onPress?: (type: MemoryQuestType) => void }) {
  const handlePress = () => {
    if (quest.completed || !onPress) return;
    onPress(quest.type);
  };
  return (
    <Pressable onPress={handlePress} style={styles.seedCard} disabled={quest.completed}>
      {!quest.completed ? (
        <View style={styles.essenceBadge}>
          <ThemedText style={styles.essenceBadgeText} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>
            ✦{quest.essenceReward}
          </ThemedText>
        </View>
      ) : null}
      <ThemedText style={styles.seedEmoji}>{quest.emoji}</ThemedText>
      <ThemedText style={styles.seedLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50} numberOfLines={3}>
        {quest.title}
      </ThemedText>
      <View style={styles.seedFootRow}>
        <ThemedText style={styles.seedReward} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal} numberOfLines={1}>
          {quest.completed ? 'Done' : `+ ${quest.rewardLabel}`}
        </ThemedText>
        <View style={[styles.seedCheck, quest.completed ? styles.seedCheckDone : null]}>
          <IconSymbol
            name={quest.completed ? 'sparkles' : 'arrow.right'}
            size={12}
            color={quest.completed ? Lantern.emberInk : Lantern.moon300}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  section: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(20,17,31,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(196,186,240,0.1)',
    gap: 10,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  chronicleCard: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(20,17,31,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,195,107,0.22)',
    gap: 5,
  },
  chronicleKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  chronicleChevron: { marginLeft: 'auto' },
  chronicleSummary: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  sleepCard: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(20,17,31,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
    gap: 8,
  },
  sleepEmoji: { fontSize: 15 },
  sleepChips: { flexDirection: 'row', gap: 8 },
  sleepChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(28,24,48,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(196,186,240,0.14)',
  },
  sleepChipEmoji: { fontSize: 15 },
  sleepChipLabel: { fontSize: 13, fontWeight: '700' },
  foodCardRow: { fontSize: 20, letterSpacing: 2 },
  seedRow: { flexDirection: 'row', gap: 8 },
  seedCard: {
    flex: 1,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(28,24,48,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(196,186,240,0.12)',
    gap: 6,
    minHeight: 92,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  essenceBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(125,232,205,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(125,232,205,0.3)',
  },
  essenceBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  essenceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(125,232,205,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(125,232,205,0.28)',
  },
  essenceChipMark: { fontSize: 13, fontWeight: '900' },
  essenceChipValue: { fontSize: 14, fontWeight: '800' },
  essenceChipLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  seedEmoji: { fontSize: 18 },
  seedLabel: { fontSize: 11.5, fontWeight: '700', lineHeight: 15 },
  seedFootRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  seedReward: { fontSize: 10, fontWeight: '800', flexShrink: 1 },
  seedCheck: {
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(196,186,240,0.3)',
  },
  seedCheckDone: { backgroundColor: Lantern.ember300, borderColor: Lantern.ember300 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(20,17,31,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(196,186,240,0.1)',
    gap: 6,
    minHeight: 84,
    justifyContent: 'center',
  },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  streakValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statBig: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  statUnit: { fontSize: 11, fontWeight: '700' },
  statWord: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 36, gap: 2 },
  barColumn: { flex: 1, alignItems: 'center' },
  barTrack: { width: 4, height: 32, borderRadius: 999, backgroundColor: 'rgba(196,186,240,0.1)', justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 999, backgroundColor: Lantern.moon300 },
  barFillLast: { backgroundColor: Lantern.ember300 },
});
