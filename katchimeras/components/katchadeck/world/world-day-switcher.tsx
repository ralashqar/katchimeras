import { Image } from 'expo-image';
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { HomeDayRecord } from '@/types/home';
import { getCreatureVisual } from '@/game/days';

const auroraRing = require('../../../assets/images/katchimeras/aurora-ring.png');
const eggBase = require('../../../assets/images/katchimeras/cutouts/egg-base.webp');
// Feathered radial glow (same texture the world canvas uses) — fades smoothly so
// the selected state never shows a hard, aliased ring.
const softGlow = require('../../../assets/images/katchimeras/soft-glow.png');

type WorldDaySwitcherProps = {
  days: HomeDayRecord[];
  selectedId: string;
  onSelect: (dayId: string) => void;
};

// A compact horizontal day picker that lives at the top of the World page (like
// the Today page's timeline, but smaller and slicker). Today first, then back
// through the archive; horizontally scrollable. The selected day gets an ember
// ring + glow and a brightened label.
export function WorldDaySwitcher({ days, selectedId, onSelect }: WorldDaySwitcherProps) {
  // Oldest first → Today is the right-most entry; scroll left for history.
  const entries = [...days].sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  const scrollRef = useRef<ScrollView>(null);
  const didInitialScroll = useRef(false);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      // Land on Today (the right end) the first time we know the content width.
      onContentSizeChange={() => {
        if (didInitialScroll.current) return;
        didInitialScroll.current = true;
        scrollRef.current?.scrollToEnd({ animated: false });
      }}
      contentContainerStyle={styles.row}>
      {entries.map((day) => {
        const selected = day.id === selectedId;
        const hatched = day.state === 'hatched' && day.creature;
        const label = day.isToday ? 'TODAY' : day.dayLabel.toUpperCase();
        const labelColor = selected ? Lantern.ember300 : day.isToday ? Lantern.moon300 : Lantern.moon500;
        return (
          <Pressable
            key={day.id}
            onPress={() => onSelect(day.id)}
            style={styles.item}
            accessibilityRole="button"
            accessibilityState={{ selected }}>
            <View style={styles.orbWrap}>
              {selected ? (
                <Image
                  source={softGlow}
                  tintColor={Lantern.ember300}
                  contentFit="contain"
                  pointerEvents="none"
                  style={styles.glow}
                  transition={0}
                />
              ) : null}
              <View style={[styles.orb, selected ? styles.orbSelected : null]}>
                {hatched ? (
                  <>
                    <Image source={auroraRing} style={StyleSheet.absoluteFill} contentFit="contain" transition={0} />
                    <Image
                      source={getCreatureVisual(day.creature!.visualKey).source}
                      style={[styles.creature, selected ? null : styles.dim]}
                      contentFit="contain"
                      transition={0}
                    />
                  </>
                ) : (
                  <View style={[styles.eggRing, selected ? styles.eggRingSelected : null]}>
                    <Image source={eggBase} style={[styles.egg, selected ? null : styles.dim]} contentFit="contain" transition={0} />
                  </View>
                )}
              </View>
            </View>
            <ThemedText style={styles.label} lightColor={labelColor} darkColor={labelColor}>
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Generous vertical padding so the selected glow has room and is never clipped.
  row: { flexDirection: 'row', gap: 14, paddingHorizontal: 20, paddingVertical: 20 },
  item: { alignItems: 'center', gap: 6, width: 54 },
  // Holds the orb plus the (larger, overflowing) glow behind it.
  orbWrap: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  // Feathered radial glow, extends well past the orb and fades — no hard edge.
  glow: { position: 'absolute', width: 82, height: 82, left: -18, top: -18, opacity: 0.95 },
  orb: { width: 46, height: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  // Selected: a crisp ember ring (no scale transform, so it stays smooth).
  orbSelected: { borderWidth: 2, borderColor: Lantern.ember300 },
  creature: { width: 34, height: 34 },
  dim: { opacity: 0.7 },
  eggRing: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Lantern.ink800,
    borderColor: 'rgba(201,194,232,0.28)',
    borderRadius: 999,
    borderStyle: 'dashed',
    borderWidth: 1.5,
  },
  eggRingSelected: { borderStyle: 'solid', borderColor: 'transparent' },
  egg: { width: 28, height: 28 },
  label: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
});
