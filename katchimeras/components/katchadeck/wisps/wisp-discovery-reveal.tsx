import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { wispDefinition } from '@/constants/wisps';
import type { WispId } from '@/types/wisp';
import { ThemedText } from '@/components/themed-text';
import { WispCompanion } from './wisp-companion';

export function WispDiscoveryReveal({ id, onDismiss }: { id: WispId; onDismiss: () => void }) {
  const definition = wispDefinition(id);
  return (
    <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(180)} style={styles.scrim}>
      <Animated.View entering={ZoomIn.duration(420)} style={styles.card}>
        <ThemedText style={styles.kicker} lightColor="#796241" darkColor="#796241">SOMETHING FOLLOWED YOU HOME...</ThemedText>
        <View style={styles.hero}><WispCompanion behavior="celebrate" id={id} size={170} /></View>
        <ThemedText style={styles.title} lightColor="#3B2B1C" darkColor="#3B2B1C">{definition.name} discovered</ThemedText>
        <ThemedText style={styles.copy} lightColor="#6D5943" darkColor="#6D5943">{definition.description}</ThemedText>
        <Pressable accessibilityRole="button" onPress={onDismiss} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <ThemedText style={styles.buttonText} lightColor="#FFF8E8" darkColor="#FFF8E8">Welcome, {definition.name}</ThemedText>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, alignItems: 'center', backgroundColor: 'rgba(25,20,16,0.68)', justifyContent: 'center', padding: 22, zIndex: 120 },
  card: { alignItems: 'center', backgroundColor: '#F8EBCF', borderCurve: 'continuous', borderRadius: 30, boxShadow: '0 22px 44px rgba(26,17,9,0.32)', maxWidth: 380, padding: 24, width: '100%' },
  kicker: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.3, textAlign: 'center' },
  hero: { alignItems: 'center', height: 185, justifyContent: 'center' },
  title: { fontFamily: 'InstrumentSerif', fontSize: 35, lineHeight: 39, textAlign: 'center' },
  copy: { fontSize: 14, lineHeight: 21, marginTop: 7, textAlign: 'center' },
  button: { backgroundColor: '#5D7046', borderRadius: 17, marginTop: 20, paddingHorizontal: 22, paddingVertical: 13 },
  buttonText: { fontSize: 13.5, fontWeight: '900' },
  pressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
});
