import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { wispDefinition } from '@/constants/wisps';
import type { WispId } from '@/types/wisp';
import { wispEvolutionTier } from '@/utils/wisp-collections';
import { WispCompanion } from './wisp-companion';

export function WispResonanceReveal({ id, previousCount, nextCount, onDismiss }: { id: WispId; previousCount: number; nextCount: number; onDismiss: () => void }) {
  const definition = wispDefinition(id);
  const previousTier = wispEvolutionTier(previousCount);
  const nextTier = wispEvolutionTier(nextCount);
  return (
    <Animated.View entering={FadeIn.duration(240)} exiting={FadeOut.duration(180)} style={styles.scrim}>
      <Animated.View entering={ZoomIn.duration(380)} style={styles.card}>
        <ThemedText style={styles.kicker} lightColor="#796241" darkColor="#796241">{definition.name.toUpperCase()} RETURNS</ThemedText>
        <View style={styles.hero}><WispCompanion behavior="celebrate" id={id} size={160} /></View>
        <ThemedText selectable style={styles.title} lightColor="#3B2B1C" darkColor="#3B2B1C">Resonance increased</ThemedText>
        <ThemedText selectable style={styles.count} lightColor="#5D7046" darkColor="#5D7046">{previousCount} → {nextCount}</ThemedText>
        <ThemedText selectable style={styles.copy} lightColor="#6D5943" darkColor="#6D5943">This kind of day has found you again.{previousTier !== nextTier ? ` ${definition.name} has evolved to ${nextTier}.` : ''}</ThemedText>
        <Pressable accessibilityRole="button" onPress={onDismiss} style={({ pressed }) => [styles.button, pressed && { opacity: 0.84 }]}>
          <ThemedText style={styles.buttonText} lightColor="#FFF8E8" darkColor="#FFF8E8">Keep the day</ThemedText>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, alignItems: 'center', backgroundColor: 'rgba(25,20,16,0.7)', justifyContent: 'center', padding: 22, zIndex: 120 },
  card: { alignItems: 'center', backgroundColor: '#F8EBCF', borderCurve: 'continuous', borderRadius: 30, boxShadow: '0 22px 44px rgba(26,17,9,0.32)', maxWidth: 380, padding: 24, width: '100%' },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3, textAlign: 'center' },
  hero: { alignItems: 'center', height: 175, justifyContent: 'center' },
  title: { fontFamily: 'InstrumentSerif', fontSize: 34, lineHeight: 39, textAlign: 'center' },
  count: { fontSize: 22, fontVariant: ['tabular-nums'], fontWeight: '900', paddingTop: 5 },
  copy: { fontSize: 14, lineHeight: 21, paddingTop: 8, textAlign: 'center' },
  button: { backgroundColor: '#5D7046', borderRadius: 17, marginTop: 18, paddingHorizontal: 24, paddingVertical: 13 },
  buttonText: { fontSize: 13.5, fontWeight: '900' },
});
