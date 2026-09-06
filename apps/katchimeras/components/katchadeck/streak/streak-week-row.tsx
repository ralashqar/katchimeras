import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';
import type { StreakDaySummary } from '@/types/streak';

const GOLD = '#E5BE6A';
const INK = '#173D57';

export function StreakWeekRow({ days, compact = false }: { days: StreakDaySummary[]; compact?: boolean }) {
  return (
    <View accessibilityRole="summary" style={[styles.panel, compact && styles.panelCompact]}>
      <View style={styles.labelRow}>
        {days.map((day, index) => <ThemedText key={day.localDate} style={styles.label} lightColor={INK} darkColor={INK}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</ThemedText>)}
      </View>
      <View style={styles.trackRow}>
        <View pointerEvents="none" style={styles.connector} />
        {days.map((day) => (
          <View accessibilityLabel={`${day.label}, ${day.state}`} key={day.localDate} style={styles.nodeSlot}>
            <View style={[
              styles.mark,
              compact && styles.markCompact,
              day.state === 'captured' && styles.captured,
              day.state === 'repaired' && styles.repaired,
              day.state === 'missed' && styles.missed,
              day.state === 'future' && styles.future,
              day.state === 'uncaptured' && styles.today,
            ]}>
              {day.state === 'captured' ? <IconSymbol color="#FFFDF3" name="checkmark" size={compact ? 13 : 17} /> : null}
              {day.state === 'repaired' ? <IconSymbol color="#FFFDF3" name="shield.fill" size={compact ? 13 : 16} /> : null}
              {day.state === 'uncaptured' ? <IconSymbol color={GOLD} name="flame.fill" size={compact ? 13 : 16} /> : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: 'rgba(255,249,224,0.72)', borderColor: 'rgba(255,255,255,0.72)', borderCurve: 'continuous', borderRadius: 24, borderWidth: 1.5, boxShadow: '0 12px 28px rgba(53,92,108,0.12), inset 0 1px 0 rgba(255,255,255,0.74)', paddingHorizontal: 12, paddingVertical: 14 },
  panelCompact: { borderRadius: 19, paddingHorizontal: 8, paddingVertical: 10 },
  labelRow: { flexDirection: 'row', width: '100%' },
  label: { flex: 1, fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' },
  trackRow: { flexDirection: 'row', paddingTop: 6, position: 'relative', width: '100%' },
  nodeSlot: { alignItems: 'center', flex: 1, justifyContent: 'center', zIndex: 2 },
  connector: { backgroundColor: GOLD, borderRadius: 999, height: 4, left: '7.14%', opacity: 0.92, position: 'absolute', right: '7.14%', top: 20, zIndex: 0 },
  mark: { alignItems: 'center', borderRadius: 999, borderWidth: 2, boxShadow: '0 3px 7px rgba(110,71,13,0.18), inset 0 1px 0 rgba(255,255,255,0.36)', height: 32, justifyContent: 'center', width: 32, zIndex: 3 },
  markCompact: { height: 26, width: 26 },
  captured: { backgroundColor: GOLD, borderColor: '#C99433' },
  repaired: { backgroundColor: '#7B8E74', borderColor: '#5D7357' },
  missed: { backgroundColor: 'rgba(23,61,87,0.05)', borderColor: 'rgba(23,61,87,0.23)' },
  future: { backgroundColor: 'transparent', borderColor: 'rgba(23,61,87,0.14)', borderStyle: 'dashed' },
  today: { backgroundColor: '#FFF9E9', borderColor: GOLD },
});
