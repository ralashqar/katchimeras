import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import type { HomeDayRecord } from '@/types/home';
import type { DailySeed } from '@/utils/daily-seeds-engine';

type SeedWithEarned = DailySeed & { earned: boolean };

type WorldDashboardProps = {
  days: HomeDayRecord[];
  seeds: SeedWithEarned[];
  onCompleteSeed?: (seedId: string, from: FeedSourceRect) => void;
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

// The dashboard below the diorama: Today's Seeds, then World Streak / This Week /
// World Mood cards. Mirrors the reference home layout.
export function WorldDashboard({ days, seeds, onCompleteSeed }: WorldDashboardProps) {
  const streak = computeStreak(days);
  const mood = computeMood(days);
  const week = computeWeek(days);

  return (
    <View style={styles.root}>
      {seeds.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <IconSymbol name="leaf.fill" size={13} color={Lantern.auroraTeal} />
            <ThemedText style={styles.sectionTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              Today’s Seeds
            </ThemedText>
          </View>
          <View style={styles.seedRow}>
            {seeds.map((seed) => (
              <SeedCard key={seed.id} seed={seed} onComplete={onCompleteSeed} />
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

function SeedCard({ seed, onComplete }: { seed: SeedWithEarned; onComplete?: (seedId: string, from: FeedSourceRect) => void }) {
  const ref = useRef<View>(null);
  const handlePress = () => {
    if (seed.earned || !onComplete) return;
    if (ref.current) {
      ref.current.measureInWindow((x, y, w, h) => onComplete(seed.id, { x, y, w, h }));
    } else {
      onComplete(seed.id, { x: 0, y: 0, w: 0, h: 0 });
    }
  };
  return (
    <Pressable ref={ref} onPress={handlePress} style={styles.seedCard} disabled={seed.earned}>
      <ThemedText style={styles.seedEmoji}>{seed.emoji}</ThemedText>
      <ThemedText style={styles.seedLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50} numberOfLines={2}>
        {seed.label}
      </ThemedText>
      <View style={styles.seedFootRow}>
        <ThemedText style={styles.seedReward} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal} numberOfLines={1}>
          {`+ ${seed.reward.label}`}
        </ThemedText>
        <View style={[styles.seedCheck, seed.earned ? styles.seedCheckDone : null]}>
          <IconSymbol
            name={seed.earned ? 'sparkles' : 'arrow.right'}
            size={12}
            color={seed.earned ? Lantern.emberInk : Lantern.moon300}
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
  },
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
