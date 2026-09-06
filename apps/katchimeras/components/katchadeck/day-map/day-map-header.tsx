import { Image } from 'expo-image';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Meadow } from '@/constants/meadow-theme';
import { getCreatureVisual } from '@/game/days';
import type { HomeDayRecord } from '@/types/home';

const eggBase = require('@incubator/art-cutouts/egg-base.webp');

export function DayMapHeader({ day, onBack }: { day: HomeDayRecord; onBack: () => void }) {
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const visual = day.creature ? getCreatureVisual(day.creature.visualKey) : null;
  const accent = day.creature?.accentColor ?? day.egg.accentColor ?? Meadow.gold;

  return (
    <Animated.View entering={FadeInDown.duration(240)} style={[styles.header, compact && styles.headerCompact]}>
      <Pressable
        accessibilityLabel="Close memory map"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
        <IconSymbol name="chevron.left" size={28} color={Meadow.ink} />
      </Pressable>

      <View style={styles.copy}>
        <ThemedText selectable style={styles.eyebrow} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>
          Memory map
        </ThemedText>
        <ThemedText selectable numberOfLines={1} style={[styles.day, compact && styles.dayCompact]} lightColor={Meadow.ink} darkColor={Meadow.ink}>
          {formatWeekday(day.isoDate)}
        </ThemedText>
        <ThemedText selectable style={styles.date} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
          {formatDate(day.isoDate)}
        </ThemedText>
      </View>

      <View
        accessibilityLabel={visual ? `${day.creature?.name}, this day's Katchimera` : `${day.egg.label}, today's egg`}
        accessible
        style={[styles.visualStage, compact && styles.visualStageCompact]}>
        <View style={[styles.visualGlow, { backgroundColor: `${accent}28` }]} />
        <Image
          contentFit="contain"
          source={visual?.source ?? eggBase}
          style={visual ? styles.creature : styles.egg}
          transition={0}
        />
      </View>
      <IconSymbol name="leaf.fill" size={22} color="rgba(117,131,66,0.38)" style={styles.leaf} />
    </Animated.View>
  );
}

export function DayMapLayerControls({
  memoryCount,
  libraryCount,
  showMemories,
  showLibrary,
  onToggleMemories,
  onToggleLibrary,
}: {
  memoryCount: number;
  libraryCount: number;
  showMemories: boolean;
  showLibrary: boolean;
  onToggleMemories: () => void;
  onToggleLibrary: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(70).duration(220)} style={styles.layers}>
      <LayerButton active={showMemories} count={memoryCount} icon="book.fill" label="Memories" onPress={onToggleMemories} tone="memory" />
      <LayerButton active={showLibrary} count={libraryCount} icon="photo.on.rectangle.angled" label="Photo Library" onPress={onToggleLibrary} tone="library" />
    </Animated.View>
  );
}

function LayerButton({ active, count, icon, label, onPress, tone }: {
  active: boolean;
  count: number;
  icon: IconSymbolName;
  label: string;
  onPress: () => void;
  tone: 'memory' | 'library';
}) {
  const color = tone === 'memory' ? '#94610E' : '#456C67';
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.layer,
        tone === 'library' ? styles.layerLibrary : styles.layerMemory,
        !active && styles.layerInactive,
        pressed && styles.pressed,
      ]}>
      <IconSymbol name={icon} size={20} color={active ? color : Meadow.inkSoft} />
      <ThemedText numberOfLines={1} style={styles.layerText} lightColor={active ? color : Meadow.inkSoft} darkColor={active ? color : Meadow.inkSoft}>
        {label} {count}
      </ThemedText>
    </Pressable>
  );
}

function formatWeekday(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return Number.isNaN(date.getTime()) ? isoDate : new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date);
}

function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return Number.isNaN(date.getTime()) ? isoDate : new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric' }).format(date);
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: 'rgba(249,229,183,0.97)',
    borderColor: 'rgba(123,82,26,0.24)',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    boxShadow: '0 12px 32px rgba(24,20,22,0.34), inset 0 1px 0 rgba(255,255,255,0.72)',
    flexDirection: 'row',
    minHeight: 94,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  headerCompact: { minHeight: 86, paddingHorizontal: 10, paddingVertical: 7 },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,247,221,0.70)',
    borderColor: 'rgba(123,82,26,0.25)',
    borderRadius: 999,
    borderWidth: 1,
    boxShadow: '0 4px 12px rgba(75,51,20,0.16)',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  copy: { flex: 1, gap: 0, minWidth: 0, paddingLeft: 13, zIndex: 2 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.25, lineHeight: 12, textTransform: 'uppercase' },
  day: { fontFamily: 'InstrumentSerif', fontSize: 33, lineHeight: 35 },
  dayCompact: { fontSize: 30, lineHeight: 32 },
  date: { fontSize: 14, fontWeight: '700', lineHeight: 17 },
  visualStage: { alignItems: 'center', height: 78, justifyContent: 'center', width: 92, zIndex: 2 },
  visualStageCompact: { height: 72, width: 78 },
  visualGlow: { borderRadius: 999, height: 66, position: 'absolute', width: 66 },
  creature: { height: 84, width: 84 },
  egg: { height: 62, width: 52 },
  leaf: { bottom: 5, left: 12, position: 'absolute', transform: [{ rotate: '-18deg' }] },
  layers: { flexDirection: 'row', gap: 8, paddingHorizontal: 22, paddingTop: 8 },
  layer: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    boxShadow: '0 8px 18px rgba(17,20,25,0.26), inset 0 1px 0 rgba(255,255,255,0.68)',
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 11,
  },
  layerMemory: { backgroundColor: 'rgba(255,221,143,0.97)', borderColor: 'rgba(148,97,14,0.42)' },
  layerLibrary: { backgroundColor: 'rgba(225,239,216,0.97)', borderColor: 'rgba(69,108,103,0.38)' },
  layerInactive: { backgroundColor: 'rgba(238,229,210,0.86)', opacity: 0.72 },
  layerText: { fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
