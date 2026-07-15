import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Meadow } from '@/constants/meadow-theme';
import type { CompanionBondProgress } from '@/utils/companion-bond';

export function CompanionBondMeter({ name, progress }: { name: string; progress: CompanionBondProgress }) {
  const valueLabel = progress.isMax
    ? 'Max'
    : `${progress.segmentPoints}/${progress.segmentTarget}`;
  const hint = progress.isMax
    ? `You and ${name} have reached the deepest bond.`
    : `${progress.pointsRemaining} bond until ${progress.nextLabel}.`;
  return (
    <View style={styles.root} accessibilityLabel={`Bond with ${name}. ${valueLabel}. ${hint}`}>
      <View style={styles.icon}><IconSymbol name="heart.fill" size={14} color="#A95043" /></View>
      <ThemedText style={styles.label} lightColor={Meadow.ink} darkColor={Meadow.ink}>Bond</ThemedText>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress.ratio * 100) }}
        style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(progress.totalPoints > 0 ? 4 : 0, progress.ratio * 100)}%` }]} />
      </View>
      <ThemedText numberOfLines={1} style={styles.value} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{valueLabel}</ThemedText>
      <View style={styles.level}>
        <ThemedText style={styles.levelText} lightColor={Meadow.ink} darkColor={Meadow.ink}>Lv {progress.level}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', backgroundColor: 'rgba(255,248,232,0.42)', borderColor: Meadow.cardBorder, borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, boxShadow: '-3px 4px 8px rgba(58,38,18,0.16), inset 0 1px 0 rgba(255,248,230,0.58)', flexDirection: 'row', gap: 7, minHeight: 46, paddingHorizontal: 9, paddingVertical: 7 },
  icon: { alignItems: 'center', backgroundColor: 'rgba(169,80,67,0.12)', borderRadius: 999, height: 28, justifyContent: 'center', width: 28 },
  label: { fontSize: 11.5, fontWeight: '900' },
  value: { fontSize: 10, fontVariant: ['tabular-nums'], fontWeight: '800' },
  track: { backgroundColor: Meadow.trackOnCard, borderRadius: 999, flex: 1, height: 6, minWidth: 42, overflow: 'hidden' },
  fill: { backgroundColor: '#C86956', borderRadius: 999, height: '100%' },
  level: { alignItems: 'center', backgroundColor: Meadow.goldSoft, borderColor: 'rgba(255,248,230,0.48)', borderRadius: 9, borderWidth: 1, boxShadow: '-1px 2px 4px rgba(58,38,18,0.14), inset 0 1px 0 rgba(255,252,234,0.68)', justifyContent: 'center', minHeight: 28, minWidth: 36, paddingHorizontal: 5 },
  levelText: { fontSize: 10, fontVariant: ['tabular-nums'], fontWeight: '900' },
});
