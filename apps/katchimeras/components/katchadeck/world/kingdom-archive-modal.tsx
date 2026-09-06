import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import type { KingdomBuilding } from '@/types/kingdom';
import {
  archiveModalConfig,
  formatArchiveDate,
  groupArchiveSections,
  type KingdomArchiveEntry,
} from '@/utils/kingdom-archive';

// The full collection — a building's whole lifetime, full-screen: filter chips,
// month sections, and every entry a door back into its day. Grid for the Shelf
// and the Menu (cover-style cards, real photos when a moment has one), list for
// the Grove. SectionList so thousands of entries stay smooth.
type KingdomArchiveModalProps = {
  building: KingdomBuilding;
  entries: KingdomArchiveEntry[];
  onOpenDay: (dayId: string) => void;
  onClose: () => void;
};

const GRID_COLUMNS = 3;

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

export function KingdomArchiveModal({ building, entries, onOpenDay, onClose }: KingdomArchiveModalProps) {
  const config = archiveModalConfig(building.id);
  const [filter, setFilter] = useState('all');
  const filtered = useMemo(
    () => (filter === 'all' ? entries : entries.filter((entry) => entry.filterKey === filter)),
    [entries, filter]
  );
  // SectionList data: grid layouts pack each section's entries into rows.
  const sections = useMemo(
    () =>
      groupArchiveSections(filtered).map((section) => ({
        title: section.title,
        data: config.layout === 'grid' ? chunk(section.entries, GRID_COLUMNS) : section.entries.map((entry) => [entry]),
      })),
    [filtered, config.layout]
  );

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.overlay}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <ThemedText type="onboardingLabel" style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            {building.emoji} {config.title}
          </ThemedText>
          <ThemedText style={styles.headerTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {entries.length.toLocaleString()} {building.label === 'Study' ? 'inspirations' : building.label === 'Food Pavilion' ? 'meals' : 'reflections'} · a life’s collection
          </ThemedText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.closeButton}>
          <IconSymbol name="xmark" size={18} color={Lantern.moon50} />
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {config.filters.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            onPress={() => setFilter(item.key)}
            style={[styles.filterChip, filter === item.key ? styles.filterChipOn : null]}>
            <ThemedText
              style={styles.filterLabel}
              lightColor={filter === item.key ? Lantern.ink950 : Lantern.moon300}
              darkColor={filter === item.key ? Lantern.ink950 : Lantern.moon300}>
              {item.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(row) => row[0]?.id ?? 'row'}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderSectionHeader={({ section }) => (
          <ThemedText style={styles.month} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            {section.title}
          </ThemedText>
        )}
        renderItem={({ item: row }) =>
          config.layout === 'grid' ? (
            <View style={styles.gridRow}>
              {row.map((entry) => (
                <Pressable
                  key={entry.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${entry.title} — open its day`}
                  onPress={() => onOpenDay(entry.dayId)}
                  style={styles.card}>
                  {entry.thumbnailUri ? (
                    <Image contentFit="cover" source={entry.thumbnailUri} style={styles.cardPhoto} transition={140} />
                  ) : (
                    <View style={styles.cardEmojiWrap}>
                      <ThemedText style={styles.cardEmoji}>{entry.emoji}</ThemedText>
                    </View>
                  )}
                  <ThemedText numberOfLines={1} style={styles.cardTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {entry.title}
                  </ThemedText>
                  <ThemedText numberOfLines={1} style={styles.cardSub} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                    {entry.subtitle}
                  </ThemedText>
                  <ThemedText style={styles.cardDate} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                    {formatArchiveDate(entry)}
                  </ThemedText>
                </Pressable>
              ))}
              {row.length < GRID_COLUMNS
                ? Array.from({ length: GRID_COLUMNS - row.length }).map((_, index) => (
                    <View key={`pad-${index}`} style={styles.cardPad} />
                  ))
                : null}
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${row[0].title} — open its day`}
              onPress={() => onOpenDay(row[0].dayId)}
              style={styles.listRow}>
              <ThemedText style={styles.listEmoji}>{row[0].emoji}</ThemedText>
              <View style={styles.listBody}>
                <ThemedText numberOfLines={2} style={styles.listTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                  {row[0].title}
                </ThemedText>
                <ThemedText numberOfLines={1} style={styles.listSub} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                  {row[0].subtitle}
                </ThemedText>
              </View>
              <ThemedText style={styles.listDate} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                {formatArchiveDate(row[0])}
              </ThemedText>
            </Pressable>
          )
        }
        ListEmptyComponent={
          <ThemedText style={styles.empty} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            Nothing here yet — capture it on Today and it lives here forever.
          </ThemedText>
        }
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 7, 16, 0.98)',
    elevation: 30,
    paddingTop: 62,
    zIndex: 70,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerCopy: { flex: 1, gap: 3 },
  kicker: { fontSize: 12, letterSpacing: 1.1 },
  headerTitle: { fontSize: 17, fontWeight: '800', lineHeight: 22 },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(28,24,48,0.86)',
    borderColor: 'rgba(196,186,240,0.16)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 20, paddingVertical: 12 },
  filterChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipOn: { backgroundColor: Lantern.ember300, borderColor: Lantern.ember300 },
  filterLabel: { fontSize: 12, fontWeight: '800' },
  listContent: { gap: 8, paddingBottom: 110, paddingHorizontal: 20 },
  month: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, paddingTop: 10, textTransform: 'uppercase' },
  gridRow: { flexDirection: 'row', gap: 8 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    overflow: 'hidden',
    padding: 8,
  },
  cardPad: { flex: 1 },
  cardPhoto: { borderRadius: 10, height: 84, width: '100%' },
  cardEmojiWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    height: 84,
    justifyContent: 'center',
    width: '100%',
  },
  cardEmoji: { fontSize: 36 },
  cardTitle: { fontSize: 12.5, fontWeight: '800' },
  cardSub: { fontSize: 10.5, fontWeight: '600' },
  cardDate: { fontSize: 9.5, fontWeight: '700' },
  listRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  listEmoji: { fontSize: 20, textAlign: 'center', width: 28 },
  listBody: { flex: 1, gap: 2 },
  listTitle: { fontSize: 14, fontWeight: '800', lineHeight: 19 },
  listSub: { fontSize: 11.5, fontWeight: '600' },
  listDate: { fontSize: 10.5, fontWeight: '700' },
  empty: { fontSize: 13.5, fontWeight: '600', lineHeight: 19, paddingTop: 24, textAlign: 'center' },
});
