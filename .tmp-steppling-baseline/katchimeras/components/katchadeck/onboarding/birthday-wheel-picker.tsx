import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppFontFamilies, Lantern } from '@/constants/theme';

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const VERTICAL_INSET = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);
const MONTHS = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(2000, index, 1))
);

function daysInMonth(month: number): number {
  return new Date(2000, month, 0).getDate();
}

function pickerDate(month: number, day: number): Date {
  return new Date(2000, month - 1, Math.min(day, daysInMonth(month)), 12);
}

function selectedIndex(event: NativeSyntheticEvent<NativeScrollEvent>, itemCount: number): number {
  return Math.max(0, Math.min(itemCount - 1, Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT)));
}

export const BirthdayWheelPicker = memo(function BirthdayWheelPicker({
  onChange,
  value,
}: {
  onChange: (value: Date) => void;
  value: Date;
}) {
  const [month, setMonth] = useState(value.getMonth() + 1);
  const [day, setDay] = useState(value.getDate());
  const dayScroll = useRef<ScrollView>(null);
  const monthScroll = useRef<ScrollView>(null);
  const days = useMemo(() => Array.from({ length: daysInMonth(month) }, (_, index) => index + 1), [month]);

  const chooseDay = useCallback((nextDay: number, animated = true) => {
    setDay(nextDay);
    onChange(pickerDate(month, nextDay));
    dayScroll.current?.scrollTo({ animated, y: (nextDay - 1) * ITEM_HEIGHT });
  }, [month, onChange]);

  const chooseMonth = useCallback((nextMonth: number, animated = true) => {
    const nextDay = Math.min(day, daysInMonth(nextMonth));
    setMonth(nextMonth);
    setDay(nextDay);
    onChange(pickerDate(nextMonth, nextDay));
    monthScroll.current?.scrollTo({ animated, y: (nextMonth - 1) * ITEM_HEIGHT });
    if (nextDay !== day) dayScroll.current?.scrollTo({ animated, y: (nextDay - 1) * ITEM_HEIGHT });
  }, [day, onChange]);

  return (
    <View style={styles.root}>
      <View style={styles.labels}>
        <ThemedText style={styles.columnLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>DAY</ThemedText>
        <ThemedText style={styles.columnLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>MONTH</ThemedText>
      </View>
      <View style={styles.wheels}>
        <View pointerEvents="none" style={styles.selectionBand} />
        <ScrollView
          accessibilityLabel="Birth day"
          contentContainerStyle={styles.wheelContent}
          contentOffset={{ x: 0, y: (day - 1) * ITEM_HEIGHT }}
          decelerationRate="fast"
          onMomentumScrollEnd={(event) => chooseDay(days[selectedIndex(event, days.length)], false)}
          ref={dayScroll}
          showsVerticalScrollIndicator={false}
          style={styles.wheel}
          snapToInterval={ITEM_HEIGHT}>
          {days.map((item) => (
            <Pressable accessibilityRole="button" key={item} onPress={() => chooseDay(item)} style={styles.item}>
              <ThemedText style={[styles.itemText, item === day && styles.itemTextSelected]} lightColor={item === day ? Lantern.moon50 : Lantern.moon500} darkColor={item === day ? Lantern.moon50 : Lantern.moon500}>{item}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView
          accessibilityLabel="Birth month"
          contentContainerStyle={styles.wheelContent}
          contentOffset={{ x: 0, y: (month - 1) * ITEM_HEIGHT }}
          decelerationRate="fast"
          onMomentumScrollEnd={(event) => chooseMonth(selectedIndex(event, MONTHS.length) + 1, false)}
          ref={monthScroll}
          showsVerticalScrollIndicator={false}
          style={styles.wheel}
          snapToInterval={ITEM_HEIGHT}>
          {MONTHS.map((label, index) => {
            const item = index + 1;
            return (
              <Pressable accessibilityRole="button" key={label} onPress={() => chooseMonth(item)} style={styles.item}>
                <ThemedText numberOfLines={1} style={[styles.itemText, item === month && styles.itemTextSelected]} lightColor={item === month ? Lantern.moon50 : Lantern.moon500} darkColor={item === month ? Lantern.moon50 : Lantern.moon500}>{label}</ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', gap: 8 },
  labels: { flexDirection: 'row', gap: 12, paddingHorizontal: 12 },
  columnLabel: { flex: 1, fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, textAlign: 'center' },
  wheels: { alignSelf: 'stretch', flexDirection: 'row', gap: 12, height: PICKER_HEIGHT, overflow: 'hidden', position: 'relative' },
  wheel: { flex: 1 },
  wheelContent: { paddingVertical: VERTICAL_INSET },
  selectionBand: { backgroundColor: 'rgba(184,174,255,0.1)', borderColor: 'rgba(184,174,255,0.2)', borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, height: ITEM_HEIGHT, left: 0, position: 'absolute', right: 0, top: VERTICAL_INSET },
  item: { alignItems: 'center', height: ITEM_HEIGHT, justifyContent: 'center', paddingHorizontal: 8 },
  itemText: { fontFamily: AppFontFamilies.manrope, fontSize: 20, fontVariant: ['tabular-nums'], fontWeight: '600', lineHeight: 26, textAlign: 'center' },
  itemTextSelected: { fontSize: 22, fontWeight: '800' },
});
