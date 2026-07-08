import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { DiscoveryCategory, DiscoveryRarity } from '@/types/discoveries';
import type { DiscoveryEntry } from '@/hooks/use-discoveries';
import { artefactForReward } from '@/utils/discoveries-artefacts';
import { Meadow } from '@/constants/meadow-theme';

// The Hall of Discoveries — the collection reader. Grouped by category; unlocked
// discoveries show their icon/name/date/reward, locked ones a silhouette (hidden
// ones stay a mystery until found). See docs/discoveries-system-design.md §7.

const CATEGORY_META: Record<DiscoveryCategory, { emoji: string; label: string }> = {
  exploration: { emoji: '🌍', label: 'Exploration' },
  memory: { emoji: '📸', label: 'Memories' },
  life: { emoji: '❤️', label: 'Life' },
  journey: { emoji: '🚶', label: 'Journey' },
  reflection: { emoji: '🌿', label: 'Reflection' },
  world: { emoji: '🌎', label: 'World' },
};
const CATEGORY_ORDER: DiscoveryCategory[] = ['exploration', 'memory', 'life', 'journey', 'reflection', 'world'];
type HallFilter = 'all' | 'found' | 'locked' | 'hidden';
const FILTERS: { id: HallFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'found', label: 'Found' },
  { id: 'locked', label: 'Locked' },
  { id: 'hidden', label: 'Hidden' },
];

const RARITY_TINT: Record<DiscoveryRarity, string> = {
  common: '#9DB4C0',
  rare: '#92D7FF',
  epic: '#A78BFA',
  legendary: '#FFC36B',
};
const RARITY_LABEL: Record<DiscoveryRarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

function formatDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

type DiscoveriesHallSheetProps = {
  entries: DiscoveryEntry[];
  unlockedCount: number;
  totalCount: number;
  onClose: () => void;
};

export function DiscoveriesHallSheet({ entries, unlockedCount, totalCount, onClose }: DiscoveriesHallSheetProps) {
  const [filter, setFilter] = useState<HallFilter>('all');
  const visibleEntries = useMemo(() => entries.filter((entry) => matchesFilter(entry, filter)), [entries, filter]);
  const worldRewards = useMemo(() => {
    const seen = new Set<string>();
    return entries
      .filter((entry) => entry.record && entry.def.worldRewardId)
      .map((entry) => artefactForReward(entry.def.worldRewardId))
      .filter((artefact): artefact is NonNullable<typeof artefact> => {
        if (!artefact || seen.has(artefact.rewardId)) return false;
        seen.add(artefact.rewardId);
        return true;
      });
  }, [entries]);

  return (
    <View style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.duration(260)}
        exiting={SlideOutDown.duration(200)}
        style={[styles.sheet, { bottom: Meadow.overlay.bottomClearance }]}>
        <View style={styles.grabber} />
        <ThemedText style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
          Hall of Discoveries
        </ThemedText>
        <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {unlockedCount} of {totalCount} found
        </ThemedText>
        <View style={styles.filterRow}>
          {FILTERS.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => setFilter(item.id)}
              style={[styles.filterChip, filter === item.id ? styles.filterChipActive : null]}>
              <ThemedText
                style={styles.filterLabel}
                lightColor={filter === item.id ? Lantern.emberInk : Lantern.moon300}
                darkColor={filter === item.id ? Lantern.emberInk : Lantern.moon300}>
                {item.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {worldRewards.length > 0 ? <WorldRewardsStrip rewards={worldRewards} /> : null}
          {CATEGORY_ORDER.map((category) => {
            const group = visibleEntries.filter((entry) => entry.def.category === category);
            if (group.length === 0) return null;
            const meta = CATEGORY_META[category];
            const allInCategory = entries.filter((entry) => entry.def.category === category);
            const found = allInCategory.filter((entry) => entry.record).length;
            const progress = allInCategory.length > 0 ? Math.round((found / allInCategory.length) * 100) : 0;
            return (
              <View key={category} style={styles.section}>
                <View style={styles.sectionHead}>
                  <ThemedText style={styles.sectionEmoji}>{meta.emoji}</ThemedText>
                  <ThemedText style={styles.sectionLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {meta.label}
                  </ThemedText>
                  <ThemedText style={styles.sectionCount} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                    {found}/{allInCategory.length}
                  </ThemedText>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                {group.map((entry) => (
                  <DiscoveryRow key={entry.def.id} entry={entry} />
                ))}
              </View>
            );
          })}
          {visibleEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <ThemedText style={styles.emptyTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                Nothing here yet
              </ThemedText>
              <ThemedText style={styles.emptyCopy} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                This filter will fill as your world discovers more.
              </ThemedText>
            </View>
          ) : null}
        </ScrollView>

        <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
          <ThemedText style={styles.closeLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            Close
          </ThemedText>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function matchesFilter(entry: DiscoveryEntry, filter: HallFilter): boolean {
  if (filter === 'found') return !!entry.record;
  if (filter === 'locked') return !entry.record && !entry.def.hidden;
  if (filter === 'hidden') return !entry.record && entry.def.hidden;
  return true;
}

function WorldRewardsStrip({ rewards }: { rewards: NonNullable<ReturnType<typeof artefactForReward>>[] }) {
  return (
    <View style={styles.rewardsStrip}>
      <View style={styles.sectionHead}>
        <ThemedText style={styles.sectionEmoji}>*</ThemedText>
        <ThemedText style={styles.sectionLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          World Rewards
        </ThemedText>
        <ThemedText style={styles.sectionCount} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
          {rewards.length}
        </ThemedText>
      </View>
      <View style={styles.rewardList}>
        {rewards.map((reward) => (
          <View key={reward.rewardId} style={styles.rewardTile}>
            <ThemedText style={styles.rewardTileIcon} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
              *
            </ThemedText>
            <ThemedText style={styles.rewardTileLabel} numberOfLines={1} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              {reward.name}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

function DiscoveryRow({ entry }: { entry: DiscoveryEntry }) {
  const { def, record } = entry;
  const unlocked = !!record;
  const tint = RARITY_TINT[def.rarity];

  // Locked + hidden → a mystery. Locked + visible → a dimmed silhouette.
  if (!unlocked) {
    const mystery = def.hidden;
    return (
      <View style={[styles.row, styles.rowLocked]}>
        <ThemedText style={[styles.icon, styles.iconLocked]}>{mystery ? '🔒' : def.icon}</ThemedText>
        <View style={styles.body}>
          <ThemedText style={styles.nameLocked} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            {mystery ? '???' : def.name}
          </ThemedText>
          <ThemedText style={styles.descLocked} numberOfLines={2} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            {mystery ? 'A hidden discovery, waiting to be found.' : def.description}
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, { borderColor: `${tint}55` }]}>
      <ThemedText style={styles.icon}>{def.icon}</ThemedText>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <ThemedText style={styles.name} numberOfLines={1} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {def.name}
          </ThemedText>
          <View style={[styles.rarityDot, { backgroundColor: tint }]} />
        </View>
        <ThemedText style={styles.desc} numberOfLines={2} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
          {def.description}
        </ThemedText>
        <View style={styles.metaRow}>
          <ThemedText style={styles.date} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            {formatDate(record.unlockedAt)}
          </ThemedText>
          <View style={[styles.rarityChip, { borderColor: `${tint}66` }]}>
            <View style={[styles.rarityDotSmall, { backgroundColor: tint }]} />
            <ThemedText style={styles.rarityLabel} lightColor={tint} darkColor={tint}>
              {RARITY_LABEL[def.rarity]}
            </ThemedText>
          </View>
          {def.worldRewardId ? (
            <View style={[styles.rewardChip, { borderColor: `${tint}66` }]}>
              <ThemedText style={styles.rewardLabel} lightColor={tint} darkColor={tint}>
                {artefactForReward(def.worldRewardId)?.name ?? 'World reward'}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, elevation: 24, zIndex: 50 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 7, 15, 0.42)' },
  sheet: {
    backgroundColor: Meadow.overlay.sheetBg,
    borderColor: Meadow.overlay.sheetBorder,
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
    left: 12,
    maxHeight: '82%',
    paddingBottom: 14,
    paddingHorizontal: 18,
    paddingTop: 12,
    position: 'absolute',
    right: 12,
  },
  grabber: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, height: 4, marginBottom: 6, width: 38 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '800', lineHeight: 23 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 10 },
  filterChip: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(196,186,240,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  filterChipActive: { backgroundColor: Lantern.ember300, borderColor: Lantern.ember300 },
  filterLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 0.2 },
  scroll: { gap: 14, paddingTop: 10, paddingBottom: 4 },
  rewardsStrip: {
    gap: 9,
    padding: 12,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,195,107,0.18)',
    backgroundColor: 'rgba(255,195,107,0.06)',
  },
  rewardList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rewardTile: {
    minHeight: 36,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,195,107,0.24)',
    backgroundColor: 'rgba(20,17,31,0.58)',
  },
  rewardTileIcon: { fontSize: 12, fontWeight: '900' },
  rewardTileLabel: { maxWidth: 150, fontSize: 12, fontWeight: '800' },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionEmoji: { fontSize: 15 },
  sectionLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase', flex: 1 },
  sectionCount: { fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 4, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: Lantern.ember300 },
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  rowLocked: { backgroundColor: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.05)' },
  icon: { fontSize: 26, lineHeight: 30 },
  iconLocked: { opacity: 0.4 },
  body: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  nameLocked: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  rarityDot: { width: 8, height: 8, borderRadius: 999 },
  rarityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(12,10,20,0.6)',
  },
  rarityDotSmall: { width: 6, height: 6, borderRadius: 999 },
  rarityLabel: { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.3 },
  desc: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  descLocked: { fontSize: 12.5, fontWeight: '500', lineHeight: 17, fontStyle: 'italic' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 3 },
  date: { fontSize: 11.5, fontWeight: '700' },
  rewardChip: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1, backgroundColor: 'rgba(12,10,20,0.6)' },
  rewardLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  emptyState: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 26,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  emptyTitle: { fontSize: 15, fontWeight: '900' },
  emptyCopy: { fontSize: 12.5, fontWeight: '600', lineHeight: 17, textAlign: 'center' },
  close: { alignSelf: 'center', paddingTop: 6 },
  closeLabel: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
});
