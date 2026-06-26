import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { DiscoveryCategory, DiscoveryRarity } from '@/types/discoveries';
import type { DiscoveryEntry } from '@/hooks/use-discoveries';
import { artefactForReward } from '@/utils/discoveries-artefacts';

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

const RARITY_TINT: Record<DiscoveryRarity, string> = {
  common: '#9DB4C0',
  rare: '#92D7FF',
  epic: '#A78BFA',
  legendary: '#FFC36B',
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
        <ThemedText style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
          Hall of Discoveries
        </ThemedText>
        <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {unlockedCount} of {totalCount} found
        </ThemedText>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {CATEGORY_ORDER.map((category) => {
            const group = entries.filter((entry) => entry.def.category === category);
            if (group.length === 0) return null;
            const meta = CATEGORY_META[category];
            const found = group.filter((entry) => entry.record).length;
            return (
              <View key={category} style={styles.section}>
                <View style={styles.sectionHead}>
                  <ThemedText style={styles.sectionEmoji}>{meta.emoji}</ThemedText>
                  <ThemedText style={styles.sectionLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {meta.label}
                  </ThemedText>
                  <ThemedText style={styles.sectionCount} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                    {found}/{group.length}
                  </ThemedText>
                </View>
                {group.map((entry) => (
                  <DiscoveryRow key={entry.def.id} entry={entry} />
                ))}
              </View>
            );
          })}
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
    backgroundColor: '#161226',
    borderColor: 'rgba(255,255,255,0.12)',
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
  scroll: { gap: 14, paddingTop: 10, paddingBottom: 4 },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionEmoji: { fontSize: 15 },
  sectionLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase', flex: 1 },
  sectionCount: { fontSize: 12, fontWeight: '700' },
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
  desc: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  descLocked: { fontSize: 12.5, fontWeight: '500', lineHeight: 17, fontStyle: 'italic' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
  date: { fontSize: 11.5, fontWeight: '700' },
  rewardChip: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1, backgroundColor: 'rgba(12,10,20,0.6)' },
  rewardLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  close: { alignSelf: 'center', paddingTop: 6 },
  closeLabel: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
});
