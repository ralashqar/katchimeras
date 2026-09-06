import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WispArtwork } from '@/components/katchadeck/wisps/wisp-artwork';
import { sceneDefinition } from '@/constants/scenes';
import { Lantern } from '@/constants/theme';
import { getCreatureVisual } from '@/game/days';
import type { HomeDayRecord } from '@/types/home';
import type { StreakDayState } from '@/types/streak';

const eggBase = require('@incubator/art-cutouts/egg-base.webp');
// The glassy membrane that sits over the egg on the Today page (LanternEgg).
const glassDome = require('@incubator/art-characters/glass-dome.png');

const RARITY_RING: Record<string, string> = {
  common: 'rgba(255,255,255,0.22)',
  rare: '#7DE8CD',
  epic: '#A78BFA',
  legendary: '#FFC36B',
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
// How many days past today still render as dashed "egg" placeholders.
const FUTURE_PLACEHOLDER_DAYS = 3;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// year*12 + month (0-based), a single comparable integer per calendar month.
function monthIndexOfIso(iso: string): number {
  const [year, month] = iso.split('-').map((part) => Number(part));
  return year * 12 + (month - 1);
}

function monthIndexOf(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function CalendarMonth({
  days,
  onSelectDay,
  streakStateForDate,
}: {
  days: HomeDayRecord[];
  onSelectDay: (dayId: string) => void;
  streakStateForDate?: (isoDate: string) => StreakDayState;
}) {
  const now = new Date();
  const todayIso = toIso(now);
  const futureEdge = new Date(now);
  futureEdge.setDate(futureEdge.getDate() + FUTURE_PLACEHOLDER_DAYS);
  const futureEdgeIso = toIso(futureEdge);

  const byIso = useMemo(() => {
    const map = new Map<string, HomeDayRecord>();
    for (const day of days) {
      map.set(day.isoDate, day);
    }
    return map;
  }, [days]);

  // Navigable range: earliest day with a record → the month holding today + the
  // future placeholder window.
  const minMonthIndex = days.length > 0 ? monthIndexOfIso(days[0].isoDate) : monthIndexOf(now);
  const maxMonthIndex = monthIndexOfIso(futureEdgeIso);

  const [viewMonthIndex, setViewMonthIndex] = useState(monthIndexOf(now));
  const clampedIndex = Math.min(Math.max(viewMonthIndex, minMonthIndex), maxMonthIndex);
  const viewYear = Math.floor(clampedIndex / 12);
  const viewMonth = clampedIndex % 12;

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: ({ iso: string; day: number } | null)[] = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ iso: `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`, day });
  }

  const hatchedThisMonth = cells.filter((cell) => cell && byIso.get(cell.iso)?.card).length;
  const canGoPrev = clampedIndex > minMonthIndex;
  const canGoNext = clampedIndex < maxMonthIndex;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable
          disabled={!canGoPrev}
          hitSlop={10}
          onPress={() => setViewMonthIndex(clampedIndex - 1)}
          style={[styles.chevron, !canGoPrev ? styles.chevronDisabled : null]}>
          <IconSymbol color={Lantern.moon300} name="chevron.left" size={18} />
        </Pressable>
        <View style={styles.headerCenter}>
          <ThemedText type="subtitle" style={styles.monthLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </ThemedText>
          <ThemedText style={styles.monthMeta} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            {hatchedThisMonth} hatched
          </ThemedText>
        </View>
        <Pressable
          disabled={!canGoNext}
          hitSlop={10}
          onPress={() => setViewMonthIndex(clampedIndex + 1)}
          style={[styles.chevron, !canGoNext ? styles.chevronDisabled : null]}>
          <IconSymbol color={Lantern.moon300} name="chevron.right" size={18} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((label, index) => (
          <View key={`${label}-${index}`} style={styles.weekCell}>
            <ThemedText style={styles.weekLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              {label}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell, index) => {
          if (!cell) {
            return <View key={`blank-${index}`} style={styles.cell} />;
          }
          const day = byIso.get(cell.iso) ?? null;
          const isToday = cell.iso === todayIso;
          const isUpcoming = cell.iso > todayIso && cell.iso <= futureEdgeIso;
          return (
            <DayCell
              key={cell.iso}
              isToday={isToday}
              isUpcoming={isUpcoming}
              record={day}
              streakState={streakStateForDate?.(cell.iso)}
              onPress={day ? () => onSelectDay(day.id) : undefined}
            />
          );
        })}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendOrb, { borderColor: 'rgba(255,255,255,0.4)' }]} />
          <ThemedText style={styles.legendLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            Day Card
          </ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendEgg} />
          <ThemedText style={styles.legendLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            upcoming
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

function DayCell({
  record,
  isToday,
  isUpcoming,
  onPress,
  streakState,
}: {
  record: HomeDayRecord | null;
  isToday: boolean;
  isUpcoming: boolean;
  onPress?: () => void;
  streakState?: StreakDayState;
}) {
  const creature = record?.creature ?? null;
  const wispId = record?.state === 'hatched'
    ? record.dailyHatch?.primaryWispId ?? record.card?.primaryWispId ?? null
    : null;
  const visual = creature ? getCreatureVisual(creature.visualKey).source : null;
  const ring = creature ? RARITY_RING[creature.rarity] ?? RARITY_RING.common : RARITY_RING.common;
  const accent = creature?.accentColor ?? Lantern.moon500;

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.cell, pressed && onPress ? styles.cellPressed : null]}>
      {wispId ? (
        <View
          style={[
            styles.orb,
            { borderColor: isToday ? Lantern.ember300 : 'rgba(255,255,255,0.34)', backgroundColor: record?.dailyHatch?.sceneVariantId ? `${sceneAccent(record.dailyHatch.sceneVariantId)}33` : 'rgba(255,255,255,0.08)' },
            isToday ? styles.todayOrb : null,
          ]}>
          <WispArtwork id={wispId} size={42} thumbnail />
        </View>
      ) : creature && visual ? (
        <View
          style={[
            styles.orb,
            { borderColor: ring, backgroundColor: `${accent}22` },
            isToday ? styles.todayOrb : null,
          ]}>
          <Image contentFit="contain" source={visual} style={styles.orbImage} transition={0} />
        </View>
      ) : isToday ? (
        <View style={[styles.orb, styles.todayOrb, styles.todayEgg]}>
          <Image contentFit="contain" source={eggBase} style={styles.eggImage} transition={0} />
          <Image contentFit="contain" pointerEvents="none" source={glassDome} style={styles.eggDome} transition={0} />
        </View>
      ) : record ? (
        <View style={[styles.quietDot, { backgroundColor: `${accent}66` }]} />
      ) : isUpcoming ? (
        <View style={styles.egg} />
      ) : (
        <View style={styles.emptyDot} />
      )}
      {streakState === 'captured' || streakState === 'repaired' ? (
        <View style={[styles.streakBadge, streakState === 'repaired' && styles.streakBadgeRepaired]}>
          <IconSymbol color="#FFF9EC" name={streakState === 'repaired' ? 'shield.fill' : 'checkmark'} size={9} />
        </View>
      ) : streakState === 'missed' ? <View style={styles.streakMissed} /> : null}
    </Pressable>
  );
}

function sceneAccent(id: NonNullable<HomeDayRecord['dailyHatch']>['sceneVariantId']) {
  const family = sceneDefinition(id).family;
  if (family === 'woodland') return '#8FB879';
  if (family === 'home') return '#D3A36F';
  if (family === 'city') return '#A894C7';
  if (family === 'night') return '#777CC1';
  if (family === 'weather') return '#91AEB9';
  return '#E4C67E';
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerCenter: {
    alignItems: 'center',
    gap: 1,
  },
  monthLabel: {
    fontSize: 20,
    lineHeight: 24,
  },
  monthMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  chevron: {
    alignItems: 'center',
    borderColor: 'rgba(215, 228, 255, 0.16)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  chevronDisabled: {
    opacity: 0.3,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekCell: {
    alignItems: 'center',
    flexBasis: '14.2857%',
  },
  weekLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    aspectRatio: 1,
    alignItems: 'center',
    flexBasis: '14.2857%',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  cellPressed: {
    opacity: 0.6,
  },
  orb: {
    alignItems: 'center',
    aspectRatio: 1,
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '94%',
  },
  todayOrb: {
    borderColor: Lantern.ember300,
    borderWidth: 2,
  },
  todayEgg: {
    backgroundColor: 'rgba(255, 195, 107, 0.12)',
  },
  eggImage: {
    aspectRatio: 1,
    width: '70%',
  },
  // The membrane fills the cell and sits over the egg, like the Today-page dome.
  eggDome: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  orbImage: {
    aspectRatio: 1,
    width: '84%',
  },
  quietDot: {
    borderRadius: 999,
    height: 9,
    width: 9,
  },
  egg: {
    aspectRatio: 1,
    borderColor: 'rgba(170, 178, 255, 0.45)',
    borderRadius: 999,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    width: '66%',
  },
  emptyDot: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 999,
    height: 5,
    width: 5,
  },
  streakBadge: { alignItems: 'center', backgroundColor: '#D6A94E', borderColor: '#1C1830', borderRadius: 999, borderWidth: 1.5, bottom: 1, height: 17, justifyContent: 'center', position: 'absolute', right: 2, width: 17 },
  streakBadgeRepaired: { backgroundColor: '#71866B' },
  streakMissed: { borderColor: 'rgba(201,194,232,0.34)', borderRadius: 999, borderWidth: 1.5, bottom: 5, height: 6, position: 'absolute', width: 6 },
  legend: {
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'center',
    paddingTop: 4,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  legendOrb: {
    borderRadius: 999,
    borderWidth: 1.5,
    height: 12,
    width: 12,
  },
  legendEgg: {
    borderColor: 'rgba(170, 178, 255, 0.45)',
    borderRadius: 999,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    height: 12,
    width: 12,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
