import { useFocusEffect } from '@react-navigation/native';
import { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';
import { useEconomy } from '@/features/economy/economy-provider';
import type { HomeDayRecord, HomeTimelineDay } from '@/types/home';
import { loadMergeWorldState } from '@/utils/merge-world/repository';

type TodayTopHudProps = {
  days: HomeTimelineDay[];
  interactionLocked?: boolean;
  onSelectDay: (dayId: string) => void;
  selectedId: string;
};

type MergeBalances = { energy: number; coins: number };

export const TodayTopHud = memo(function TodayTopHud({
  days,
  interactionLocked = false,
  onSelectDay,
  selectedId,
}: TodayTopHudProps) {
  const economy = useEconomy();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mergeBalances, setMergeBalances] = useState<MergeBalances | null>(null);
  const selectedDay = days.find((day) => day.id === selectedId) ?? null;

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadMergeWorldState().then((state) => {
      if (active) setMergeBalances({ energy: state.energy.value, coins: state.coins });
    }).catch(() => {
      if (active) setMergeBalances({ energy: 0, coins: 0 });
    });
    return () => { active = false; };
  }, []));

  const selectDay = useCallback((dayId: string) => {
    setHistoryOpen(false);
    onSelectDay(dayId);
  }, [onSelectDay]);

  return (
    <>
      <View style={styles.hud}>
        <Pressable
          accessibilityHint="Opens your recent days"
          accessibilityLabel={`${selectedDayLabel(selectedDay)}. Open day history`}
          accessibilityRole="button"
          disabled={interactionLocked}
          onPress={() => setHistoryOpen(true)}
          style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}>
          <IconSymbol color="#F1D27A" name="calendar" size={16} />
          <ThemedText numberOfLines={1} style={styles.dateLabel} lightColor="#FFF8E7" darkColor="#FFF8E7">
            {selectedDayLabel(selectedDay)}
          </ThemedText>
          <IconSymbol color="rgba(255,248,231,0.62)" name="chevron.down" size={13} />
        </Pressable>

        <View accessibilityLabel="Currencies" style={styles.balances}>
          <Balance icon="bolt.fill" label="Energy" tint="#FFD45F" value={mergeBalances?.energy ?? null} />
          <Balance icon="circle.fill" label="Coins" tint="#E9B94F" value={mergeBalances?.coins ?? null} />
          <Balance icon="diamond.fill" label="Gems" tint="#88E3E8" value={economy.snapshot.gemsBalance} />
        </View>
      </View>

      {historyOpen ? (
        <DayHistorySheet
          days={days}
          onClose={() => setHistoryOpen(false)}
          onSelect={selectDay}
          selectedId={selectedId}
        />
      ) : null}
    </>
  );
});

function Balance({ icon, label, tint, value }: { icon: IconSymbolName; label: string; tint: string; value: number | null }) {
  return (
    <View accessibilityLabel={`${label}: ${value ?? 'loading'}`} style={styles.balancePill}>
      <IconSymbol color={tint} name={icon} size={13} />
      <ThemedText selectable style={styles.balanceValue} lightColor="#FFF8E7" darkColor="#FFF8E7">
        {value == null ? '–' : compactNumber(value)}
      </ThemedText>
    </View>
  );
}

function DayHistorySheet({
  days,
  onClose,
  onSelect,
  selectedId,
}: {
  days: HomeTimelineDay[];
  onClose: () => void;
  onSelect: (dayId: string) => void;
  selectedId: string;
}) {
  const history = days.filter((day): day is HomeDayRecord => day.kind === 'day').toReversed();
  return (
    <KatchaSheet
      header={{ eyebrow: 'Your days', title: 'Day history', subtitle: 'Return to a day without keeping the whole week on screen.' }}
      maxHeight="70%"
      onRequestClose={onClose}
      scroll
      scrollContentStyle={styles.historyList}
      surface="night">
      {history.map((day) => {
        const selected = day.id === selectedId;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={day.id}
            onPress={() => onSelect(day.id)}
            style={({ pressed }) => [styles.historyRow, selected && styles.historyRowSelected, pressed && styles.pressed]}>
            <View style={styles.historyDate}>
              <ThemedText style={styles.historyDay} lightColor="#FFF8E7" darkColor="#FFF8E7">
                {day.isToday ? 'Today' : day.dayLabel}
              </ThemedText>
              <ThemedText style={styles.historyMeta} lightColor="rgba(255,248,231,0.58)" darkColor="rgba(255,248,231,0.58)">
                {longDate(day.isoDate)} · {dayStateLabel(day)}
              </ThemedText>
            </View>
            <IconSymbol
              color={selected ? '#F1D27A' : 'rgba(255,248,231,0.42)'}
              name={selected ? 'checkmark' : 'chevron.right'}
              size={17}
            />
          </Pressable>
        );
      })}
    </KatchaSheet>
  );
}

function selectedDayLabel(day: HomeTimelineDay | null): string {
  if (!day) return 'Today';
  if (day.kind === 'tomorrow') return 'Tomorrow';
  const date = shortDate(day.isoDate);
  return day.isToday ? `Today · ${date}` : date;
}

function dayStateLabel(day: HomeDayRecord): string {
  if (day.state === 'hatched') return 'Hatched';
  if (day.state === 'ready_to_hatch') return 'Ready to hatch';
  return 'Forming';
}

function dateParts(isoDate: string) {
  const [, month = '1', day = '1'] = isoDate.split('-');
  return { day: Number(day), month: Number(month) - 1 };
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function shortDate(isoDate: string): string {
  const parts = dateParts(isoDate);
  return `${MONTHS_SHORT[parts.month] ?? ''} ${parts.day}`;
}

function longDate(isoDate: string): string {
  const parts = dateParts(isoDate);
  return `${MONTHS_LONG[parts.month] ?? ''} ${parts.day}`;
}

function compactNumber(value: number): string {
  const safe = Math.max(0, Math.floor(value));
  if (safe < 1_000) return String(safe);
  if (safe < 1_000_000) return `${(safe / 1_000).toFixed(safe < 10_000 ? 1 : 0)}k`;
  return `${(safe / 1_000_000).toFixed(safe < 10_000_000 ? 1 : 0)}m`;
}

const styles = StyleSheet.create({
  hud: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(28,24,18,0.78)',
    borderColor: 'rgba(255,236,190,0.18)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    boxShadow: '0 5px 18px rgba(17,12,7,0.22)',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    maxWidth: 430,
    minHeight: 46,
    paddingHorizontal: 8,
    width: '100%',
  },
  dateButton: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 5, minHeight: 44, paddingHorizontal: 4 },
  dateLabel: { flexShrink: 1, fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '900' },
  balances: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  balancePill: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.075)', borderRadius: 999, flexDirection: 'row', gap: 3, minHeight: 30, minWidth: 43, paddingHorizontal: 6 },
  balanceValue: { fontFamily: AppFontFamilies.manrope, fontSize: 11, fontVariant: ['tabular-nums'], fontWeight: '900' },
  historyList: { gap: 8, paddingBottom: 18 },
  historyRow: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.055)', borderColor: 'rgba(255,255,255,0.08)', borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'space-between', minHeight: 62, paddingHorizontal: 14, paddingVertical: 10 },
  historyRowSelected: { backgroundColor: 'rgba(241,210,122,0.12)', borderColor: 'rgba(241,210,122,0.42)' },
  historyDate: { flex: 1, gap: 3 },
  historyDay: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '900' },
  historyMeta: { fontFamily: AppFontFamilies.manrope, fontSize: 11.5, fontWeight: '700' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
