import { StyleSheet, Text, View } from 'react-native';

/** Keep the fill precise while presenting whole hit points to the player. */
export function WispHealthBar({ hp, maxHp, guarded = false }: { hp: number; maxHp: number; guarded?: boolean }) {
  const remaining = Math.max(0, Math.min(maxHp, hp));
  const fraction = maxHp > 0 ? remaining / maxHp : 0;
  return <View accessibilityRole="progressbar" accessibilityLabel="Wisp health"
    accessibilityValue={{ min: 0, max: maxHp, now: remaining, text: `${Math.round(remaining)} HP${guarded ? ', shielded' : ''}` }} style={styles.track}>
    <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
    <Text style={styles.label}>{guarded ? '◆ ' : ''}{Math.round(remaining)}</Text>
  </View>;
}

const styles = StyleSheet.create({
  track: { position: 'absolute', top: '86%', alignSelf: 'center', width: 48, height: 17, borderRadius: 8,
    overflow: 'hidden', backgroundColor: '#421E29', borderWidth: 1, borderColor: '#FFD5D5', zIndex: 3 },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#DA3548' },
  label: { color: '#FFFFFF', fontFamily: 'FredokaBold', fontSize: 11, lineHeight: 14, textAlign: 'center',
    textShadowColor: '#671421', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
});
