import { memo, type RefObject, useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GameCurrencyHud } from '@/components/katchadeck/ui/game-currency-hud';
import { GameHudBar, GameHudControl } from '@/components/katchadeck/ui/game-primitives';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GameUI } from '@/constants/game-ui';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { useGameWallet } from '@/features/ui/game-wallet-provider';
import type { HomeDayRecord, HomeTimelineDay } from '@/types/home';

type TodayTopHudProps = {
  days: HomeTimelineDay[];
  energyPulseNonce?: number;
  energyTargetRef?: RefObject<View | null>;
  interactionLocked?: boolean;
  onSelectDay: (dayId: string) => void;
  selectedId: string;
};

export const TodayTopHud = memo(function TodayTopHud({ days, energyPulseNonce = 0, energyTargetRef, interactionLocked = false, onSelectDay, selectedId }: TodayTopHudProps) {
  const wallet = useGameWallet();
  const [historyOpen, setHistoryOpen] = useState(false);
  const selectedDay = days.find((day) => day.id === selectedId) ?? null;
  const selectDay = useCallback((dayId: string) => {
    setHistoryOpen(false);
    onSelectDay(dayId);
  }, [onSelectDay]);

  return <>
    <GameHudBar
      content={<GameCurrencyHud balances={[
        { art: GAME_CURRENCY_ART.energy, id: 'energy', pulseNonce: energyPulseNonce, suffix: wallet.energyCap > 0 ? `/${wallet.energyCap}` : undefined, targetRef: energyTargetRef, value: wallet.energy },
        { art: GAME_CURRENCY_ART.coins, id: 'coins', value: wallet.coins },
        { id: 'gems', value: wallet.gems },
      ]} style={styles.currencyHud} tone="glass" />}
      density="compact"
      leading={<GameHudControl
        accessibilityHint="Opens your recent days"
        accessibilityLabel={`${selectedDayLabel(selectedDay)}. Open day history`}
        disabled={interactionLocked}
        onPress={() => setHistoryOpen(true)}
        style={styles.dayButton}
        tone="glass">
        <ThemedText numberOfLines={1} style={styles.dateLabel} lightColor={GameUI.color.ink} darkColor={GameUI.color.ink}>{selectedDay?.kind === 'day' && selectedDay.isToday ? 'Today' : selectedDayLabel(selectedDay)}</ThemedText>
        <IconSymbol color={GameUI.color.inkSecondary} name="chevron.down" size={11} />
      </GameHudControl>}
      style={styles.hud}
      tone="glass"
    />
    {historyOpen ? <DayHistorySheet days={days} onClose={() => setHistoryOpen(false)} onSelect={selectDay} selectedId={selectedId} /> : null}
  </>;
});

function DayHistorySheet({ days, onClose, onSelect, selectedId }: { days: HomeTimelineDay[]; onClose: () => void; onSelect: (dayId: string) => void; selectedId: string }) {
  const history = days.filter((day): day is HomeDayRecord => day.kind === 'day').toReversed();
  return <KatchaSheet
    header={{ eyebrow: 'Your days', title: 'Day history', subtitle: 'Return to a day without keeping the whole week on screen.' }}
    maxHeight="70%"
    onRequestClose={onClose}
    scroll
    scrollContentStyle={styles.historyList}
    surface="parchment">
    {history.map((day) => {
      const selected = day.id === selectedId;
      return <Pressable accessibilityRole="button" accessibilityState={{ selected }} key={day.id} onPress={() => onSelect(day.id)} style={({ pressed }) => [styles.historyRow, selected && styles.historyRowSelected, pressed && styles.pressed]}>
        <View style={styles.historyDate}>
          <ThemedText style={styles.historyDay} lightColor={GameUI.color.ink} darkColor={GameUI.color.ink}>{day.isToday ? 'Today' : day.dayLabel}</ThemedText>
          <ThemedText style={styles.historyMeta} lightColor={GameUI.color.inkSecondary} darkColor={GameUI.color.inkSecondary}>{longDate(day.isoDate)} · {dayStateLabel(day)}</ThemedText>
        </View>
        <IconSymbol color={selected ? GameUI.color.goldStrong : GameUI.color.inkTertiary} name={selected ? 'checkmark' : 'chevron.right'} size={17} />
      </Pressable>;
    })}
  </KatchaSheet>;
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

function shortDate(isoDate: string): string { const parts = dateParts(isoDate); return `${MONTHS_SHORT[parts.month] ?? ''} ${parts.day}`; }
function longDate(isoDate: string): string { const parts = dateParts(isoDate); return `${MONTHS_LONG[parts.month] ?? ''} ${parts.day}`; }

const styles = StyleSheet.create({
  hud: { alignSelf: 'center', maxWidth: 430, width: '100%' },
  dayButton: { flexShrink: 0, gap: 4, minWidth: 70, paddingHorizontal: 10 },
  currencyHud: { flex: 1 },
  dateLabel: { ...GameUI.type.label, flexShrink: 1, fontSize: 12, letterSpacing: 0 },
  historyList: { gap: 8, paddingBottom: 18 },
  historyRow: { alignItems: 'center', backgroundColor: GameUI.color.parchmentSoft, borderColor: GameUI.color.line, borderCurve: 'continuous', borderRadius: GameUI.radius.control, borderWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'space-between', minHeight: 62, paddingHorizontal: 14, paddingVertical: 10 },
  historyRowSelected: { backgroundColor: GameUI.color.parchmentRaised, borderColor: GameUI.color.goldStrong },
  historyDate: { flex: 1, gap: 3 },
  historyDay: { ...GameUI.type.title, fontSize: 14, lineHeight: 18 },
  historyMeta: { ...GameUI.type.body, fontSize: 11.5, lineHeight: 16 },
  pressed: { opacity: 0.9, transform: [{ translateY: 1 }, { scale: 0.985 }] },
});
