import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { wispDefinition } from '@/constants/wisps';
import type { WispId } from '@/types/wisp';
import { ThemedText } from '@/components/themed-text';
import { WispCompanion } from './wisp-companion';

export function WispDiscoveryReveal({ id, onDismiss, onEquip }: { id: WispId; onDismiss: () => void; onEquip?: () => void }) {
  const definition = wispDefinition(id);
  return (
    <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(180)} style={styles.scrim}>
      <Animated.View entering={ZoomIn.duration(420)} style={styles.card}>
        <ThemedText style={styles.kicker} lightColor="#796241" darkColor="#796241">NEW WISP</ThemedText>
        <View style={styles.hero}><WispCompanion behavior="celebrate" id={id} size={170} /></View>
        <ThemedText style={styles.title} lightColor="#3B2B1C" darkColor="#3B2B1C">{definition.name} discovered</ThemedText>
        <ThemedText style={styles.copy} lightColor="#6D5943" darkColor="#6D5943">{definition.description} Every day can leave behind a little Wisp of what it became.</ThemedText>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onDismiss} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <ThemedText style={styles.secondaryText} lightColor="#5D7046" darkColor="#5D7046">Not now</ThemedText>
          </Pressable>
          <KatchaButton onPress={onEquip ?? onDismiss} style={{flex: 1}} label="Stay beside Egg" />
        </View>
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
  actions: { flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' },
  secondary: { alignItems: 'center', borderColor: 'rgba(93,112,70,0.35)', borderRadius: 17, borderWidth: 1, flex: 1, paddingVertical: 13 },
  secondaryText: { fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
});
