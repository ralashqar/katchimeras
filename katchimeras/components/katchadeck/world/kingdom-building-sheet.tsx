import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { KingdomBuilding } from '@/types/kingdom';
import { formatArchiveDate, type KingdomArchiveSection } from '@/utils/kingdom-archive';

// A Kingdom building's card: the human question it answers, how far a lifetime
// of living has grown it, and what grows it next. The deep readers stay on
// Today (this day's contributions) and Collection (history) — this sheet is the
// building's own story.
type KingdomBuildingSheetProps = {
  building: KingdomBuilding;
  // The building's lifetime collection (Study: every book/film ever kept, …),
  // grouped by month, newest first. Empty → the level card stands alone.
  archive?: KingdomArchiveSection[];
  // Opens the full-screen collection modal (the Shelf / the Menu / the Grove).
  onOpenCollection?: () => void;
  onClose: () => void;
};

const LEVEL_NAMES = ['Unbuilt', 'Founded', 'Growing', 'Flourishing', 'Radiant'];

export function KingdomBuildingSheet({ building, archive = [], onOpenCollection, onClose }: KingdomBuildingSheetProps) {
  // The sheet is a teaser: the latest few entries; the modal holds the rest.
  const totalEntries = archive.reduce((sum, section) => sum + section.entries.length, 0);
  const recent = (() => {
    const out: typeof archive = [];
    let left = 4;
    for (const section of archive) {
      if (left <= 0) break;
      const take = section.entries.slice(0, left);
      out.push({ title: section.title, entries: take });
      left -= take.length;
    }
    return out;
  })();
  const tabBarHeight = useBottomTabBarHeight();
  const progress =
    building.nextLevelAt !== null ? Math.min(1, building.count / building.nextLevelAt) : 1;

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
          {building.emoji} {building.label}
        </ThemedText>
        <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {building.question}
        </ThemedText>

        <View style={styles.statRow}>
          <ThemedText style={styles.statValue} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {building.countLabel}
          </ThemedText>
          <ThemedText style={styles.statLevel} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            {LEVEL_NAMES[building.level]} · level {building.level} of 4
          </ThemedText>
        </View>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <ThemedText style={styles.nextLine} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
          {building.nextLevelAt !== null
            ? `Grows again at ${building.nextLevelAt.toLocaleString()}`
            : 'Fully grown — a lifetime landmark'}
        </ThemedText>

        {archive.length > 0 ? (
          <ScrollView style={styles.archive} showsVerticalScrollIndicator={false} contentContainerStyle={styles.archiveContent}>
            {recent.map((section) => (
              <View key={section.title} style={styles.archiveSection}>
                <ThemedText style={styles.archiveMonth} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                  {section.title}
                </ThemedText>
                {section.entries.map((entry) => (
                  <View key={entry.id} style={styles.archiveRow}>
                    <ThemedText style={styles.archiveEmoji}>{entry.emoji}</ThemedText>
                    <View style={styles.archiveBody}>
                      <ThemedText numberOfLines={1} style={styles.archiveTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                        {entry.title}
                      </ThemedText>
                      <ThemedText numberOfLines={1} style={styles.archiveSub} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                        {entry.subtitle}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.archiveDate} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                      {formatArchiveDate(entry)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        ) : (
          <ThemedText style={styles.hint} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            Everything you capture on Today feeds it. Revisit the days themselves in Collection.
          </ThemedText>
        )}

        {onOpenCollection && totalEntries > 0 ? (
          <Pressable accessibilityRole="button" onPress={onOpenCollection} style={styles.collectionBtn}>
            <ThemedText style={styles.collectionLabel} lightColor={Lantern.ink900} darkColor={Lantern.ink900}>
              View the whole collection ({totalEntries.toLocaleString()})
            </ThemedText>
          </Pressable>
        ) : null}

        <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
          <ThemedText style={styles.closeLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            Close
          </ThemedText>
        </Pressable>
      </Animated.View>
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
    borderRadius: 24,
    borderWidth: 1,
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
    gap: 10,
    left: 14,
    padding: 18,
    position: 'absolute',
    right: 14,
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    height: 4,
    marginBottom: 4,
    width: 38,
  },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 19, fontWeight: '800', lineHeight: 24 },
  statRow: { alignItems: 'baseline', flexDirection: 'row', gap: 10, marginTop: 2 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLevel: { fontSize: 12.5, fontWeight: '700' },
  track: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 8,
    marginTop: 2,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: Lantern.ember300,
    borderRadius: 999,
    height: 8,
  },
  nextLine: { fontSize: 12, fontWeight: '600' },
  hint: { fontSize: 12.5, fontWeight: '600', lineHeight: 17, marginTop: 4 },
  archive: { flexGrow: 0, marginTop: 6, maxHeight: 220 },
  collectionBtn: {
    alignItems: 'center',
    backgroundColor: Lantern.ember300,
    borderCurve: 'continuous',
    borderRadius: 999,
    marginTop: 6,
    paddingVertical: 12,
  },
  collectionLabel: { fontSize: 14, fontWeight: '900' },
  archiveContent: { gap: 12, paddingBottom: 4 },
  archiveSection: { gap: 6 },
  archiveMonth: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  archiveRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderCurve: 'continuous',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  archiveEmoji: { fontSize: 18, textAlign: 'center', width: 26 },
  archiveBody: { flex: 1, gap: 1 },
  archiveTitle: { fontSize: 13.5, fontWeight: '800' },
  archiveSub: { fontSize: 11.5, fontWeight: '600' },
  archiveDate: { fontSize: 10.5, fontWeight: '700' },
  close: { alignSelf: 'center', paddingTop: 6 },
  closeLabel: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
});
