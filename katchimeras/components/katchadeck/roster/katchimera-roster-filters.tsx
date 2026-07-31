import { ScrollView, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { lifeAspectById } from '@/constants/life-aspects';
import { AppFontFamilies } from '@/constants/theme';
import type { LifeAspectId } from '@/types/katchimera';
import type { KatchimeraRosterSort } from '@/utils/katchimera-roster';

const SORT_OPTIONS: readonly { id: KatchimeraRosterSort; label: string }[] = [
  { id: 'bond', label: 'Bond' },
  { id: 'newest', label: 'Newest' },
  { id: 'name', label: 'Name' },
  { id: 'rarity', label: 'Rarity' },
];

export function KatchimeraRosterFilters({
  aspectIds,
  count,
  onAspectChange,
  onSortChange,
  onToggleSort,
  selectedAspect,
  sort,
  sortOpen,
}: {
  aspectIds: LifeAspectId[];
  count: number;
  onAspectChange: (aspect: LifeAspectId | 'all') => void;
  onSortChange: (sort: KatchimeraRosterSort) => void;
  onToggleSort: () => void;
  selectedAspect: LifeAspectId | 'all';
  sort: KatchimeraRosterSort;
  sortOpen: boolean;
}) {
  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <ScrollView
          contentContainerStyle={styles.chips}
          horizontal
          showsHorizontalScrollIndicator={false}>
          <FilterChip
            active={selectedAspect === 'all'}
            label="All"
            onPress={() => onAspectChange('all')}
          />
          {aspectIds.map((aspectId) => (
            <FilterChip
              active={selectedAspect === aspectId}
              key={aspectId}
              label={lifeAspectById.get(aspectId)?.label ?? aspectId}
              onPress={() => onAspectChange(aspectId)}
            />
          ))}
        </ScrollView>
        <Pressable
          accessibilityLabel={`Sort Katchimeras. Current sort: ${sort}.`}
          accessibilityRole="button"
          onPress={onToggleSort}
          style={[styles.sortButton, sortOpen ? styles.sortButtonActive : null]}>
          <IconSymbol name="chevron.down" size={14} color="#F6E9C8" />
        </Pressable>
      </View>
      <View style={styles.summaryRow}>
        <ThemedText style={styles.summary} lightColor="#D8C9A5" darkColor="#D8C9A5">
          {count} {count === 1 ? 'companion' : 'companions'}
        </ThemedText>
        <ThemedText style={styles.sortLabel} lightColor="#F1D47A" darkColor="#F1D47A">
          Sorted by {SORT_OPTIONS.find((option) => option.id === sort)?.label}
        </ThemedText>
      </View>
      {sortOpen ? (
        <View style={styles.sortMenu}>
          {SORT_OPTIONS.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option.id}
              onPress={() => onSortChange(option.id)}
              style={[styles.sortOption, sort === option.id ? styles.sortOptionActive : null]}>
              {sort === option.id ? (
                <IconSymbol name="checkmark" size={13} color="#34260B" />
              ) : null}
              <ThemedText
                style={styles.sortOptionText}
                lightColor={sort === option.id ? '#34260B' : '#F3E7CA'}
                darkColor={sort === option.id ? '#34260B' : '#F3E7CA'}>
                {option.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : null]}>
      <ThemedText
        numberOfLines={1}
        style={styles.chipText}
        lightColor={active ? '#36270A' : '#EEE2C5'}
        darkColor={active ? '#36270A' : '#EEE2C5'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: 'rgba(25,24,20,0.94)',
    borderBottomColor: 'rgba(255,242,207,0.15)',
    borderBottomWidth: 1,
    gap: 7,
    paddingBottom: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  row: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  chips: { gap: 7, paddingRight: 4 },
  chip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,248,225,0.08)',
    borderColor: 'rgba(255,243,211,0.14)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 13,
  },
  chipActive: {
    backgroundColor: '#EBC55C',
    borderColor: '#F6DB88',
    boxShadow: 'inset 0 1px 0 rgba(255,250,219,0.72)',
  },
  chipText: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 11,
    fontWeight: '800',
  },
  sortButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,248,225,0.08)',
    borderColor: 'rgba(255,243,211,0.14)',
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  sortButtonActive: { backgroundColor: 'rgba(235,197,92,0.2)' },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 16,
  },
  summary: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  sortLabel: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 10,
    fontWeight: '800',
  },
  sortMenu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    paddingTop: 2,
  },
  sortOption: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,248,225,0.08)',
    borderColor: 'rgba(255,243,211,0.14)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 31,
    paddingHorizontal: 11,
  },
  sortOptionActive: {
    backgroundColor: '#EBC55C',
    borderColor: '#F6DB88',
  },
  sortOptionText: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 10.5,
    fontWeight: '800',
  },
});
