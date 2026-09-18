import { Image, StyleSheet, View } from 'react-native';
import { HEARTWOOD_ART } from '@/constants/heartwood-art';
import type { HeartwoodStage } from '@/features/shared-adventure/heartwood-progression';

/** The same generated landmark is used in the world and its story presentations. */
export function HeartwoodVista({ signal = false, answer = false, compact = false, stage }: { signal?: boolean; send?: boolean; answer?: boolean; compact?: boolean; stage?: HeartwoodStage }) {
  const current = stage ?? (answer ? 'rooted' : signal ? 'stirring' : 'dormant');
  return <View style={[styles.frame, compact && styles.compact]}>
    <Image accessibilityLabel={`Heartwood: ${current}. ${current === 'awakened' ? 'Six blooming roots sustain a radiant Tree of Life.' : current === 'blooming' ? 'Six living beds surround a flowering Tree.' : current === 'rooted' ? 'Connected golden roots and new leaves.' : current === 'stirring' ? 'The Garden has woken its first root and buds.' : 'Bare branches, corrupted roots, a living amber heart.'}`} source={HEARTWOOD_ART[current].medium} resizeMode="contain" style={styles.image} />
  </View>;
}
const styles = StyleSheet.create({
  frame: { width: '100%', height: 180, flexShrink: 0, overflow: 'hidden', borderRadius: 24 },
  compact: { height: 140, maxWidth: 260, alignSelf: 'center' },
  image: { width: '100%', height: '100%' },
});
