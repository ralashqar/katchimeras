import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import type { HomeDayRecord } from '@/types/home';

type WorldOverlaysProps = {
  day: HomeDayRecord;
  traits?: string[];
  onMemory?: () => void;
  onPlaces?: () => void;
  onJourney?: () => void;
  onReflection?: () => void;
};

function formatSteps(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k steps`;
  return `${count} steps`;
}

function moodLabel(day: HomeDayRecord): string {
  if (day.creature?.mood) return day.creature.mood;
  const scores = day.scores;
  if (!scores) return 'Calm';
  const entries: [string, number][] = [
    ['Calm', scores.calm ?? 0],
    ['Lively', scores.energy ?? 0],
    ['Social', scores.social ?? 0],
    ['Curious', scores.exploration ?? 0],
    ['Focused', scores.focus ?? 0],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

// The floating labels anchored over the diorama — Memory Vault, Places, Journey
// and Reflection in the four quadrants, plus a creature name card once the day
// has hatched. Tapping a label opens that aspect of the day.
export function WorldOverlays({ day, traits, onMemory, onPlaces, onJourney, onReflection }: WorldOverlaysProps) {
  const memoryCount = day.capturedMeanings?.length ?? day.moments?.length ?? 0;
  const placeCount = day.visitedPlaceCount || day.newPlaceCount || 0;
  const steps = day.stepsCount ?? 0;
  const hatched = day.state === 'hatched' && !!day.creature;
  const quote = day.creature?.reflection ?? day.highlight ?? null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[styles.anchor, styles.topLeft]} pointerEvents="box-none">
        <Chip icon="book.closed.fill" title="Memory Vault" value={`${memoryCount} memories`} onPress={onMemory} />
      </View>
      <View style={[styles.anchor, styles.topRight]} pointerEvents="box-none">
        <Chip icon="mappin.and.ellipse" title="Places" value={`${placeCount} places`} onPress={onPlaces} align="right" />
      </View>
      <View style={[styles.anchor, styles.bottomLeft]} pointerEvents="box-none">
        <Chip icon="figure.walk" title="Journey" value={formatSteps(steps)} onPress={onJourney} />
      </View>
      <View style={[styles.anchor, styles.bottomRight]} pointerEvents="box-none">
        <Chip icon="leaf.fill" title="Reflection" value={moodLabel(day)} onPress={onReflection} align="right" />
      </View>

      {hatched ? (
        <View style={styles.creatureCardWrap} pointerEvents="box-none">
          <View style={styles.creatureCard}>
            <View style={styles.creatureNameRow}>
              <IconSymbol name="leaf.fill" size={13} color={Lantern.auroraTeal} />
              <ThemedText type="subtitle" lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                {day.creature?.name ?? 'Your creature'}
              </ThemedText>
            </View>
            {traits && traits.length > 0 ? (
              <ThemedText style={styles.traits} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                {traits.slice(0, 3).join('  ·  ')}
              </ThemedText>
            ) : null}
            {quote ? (
              <ThemedText style={styles.quote} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                {`“${quote}”`}
              </ThemedText>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Chip({
  icon,
  title,
  value,
  onPress,
  align = 'left',
}: {
  icon: IconSymbolName;
  title: string;
  value: string;
  onPress?: () => void;
  align?: 'left' | 'right';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${value}`}
      onPress={onPress}
      style={[styles.chip, align === 'right' ? styles.chipRight : null]}>
      <View style={styles.chipTitleRow}>
        <IconSymbol name={icon} size={12} color={Lantern.auroraTeal} />
        <ThemedText style={styles.chipTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          {title}
        </ThemedText>
      </View>
      <ThemedText style={styles.chipValue} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
        {value}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute' },
  // Hover over the diorama in four quadrants (the capture controls live in the
  // right column now, so the lower-left is free again).
  topLeft: { top: '13%', left: 12 },
  topRight: { top: '13%', right: 8 },
  bottomLeft: { bottom: '16%', left: 12 },
  bottomRight: { bottom: '16%', right: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: 'rgba(20,17,31,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(196,186,240,0.14)',
    gap: 1,
  },
  chipRight: { alignItems: 'flex-end' },
  chipTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipTitle: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.2 },
  chipValue: { fontSize: 11, fontWeight: '600' },
  creatureCardWrap: { position: 'absolute', top: '26%', left: 0, right: 0, alignItems: 'center' },
  creatureCard: {
    maxWidth: 260,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(20,17,31,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(196,186,240,0.16)',
    gap: 6,
  },
  creatureNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  traits: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  quote: { fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
});
