import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { sceneDefinition } from '@/constants/scenes';
import { TODAY_EXPLORATION_BACKGROUND_SOURCES } from '@/constants/today-exploration-background-sources.gen';
import type { SceneVariantId } from '@/types/scene';

export function SceneDiscoveryReveal({ id, onDismiss, onEquip }: { id: SceneVariantId; onDismiss: () => void; onEquip: () => void }) {
  const scene = sceneDefinition(id);
  return (
    <Animated.View entering={FadeIn.duration(240)} exiting={FadeOut.duration(180)} style={styles.scrim}>
      <Animated.View entering={ZoomIn.duration(380)} style={styles.card}>
        <ThemedText style={styles.kicker} lightColor="#796241" darkColor="#796241">NEW SCENE</ThemedText>
        <Image contentFit="cover" source={TODAY_EXPLORATION_BACKGROUND_SOURCES[id].source} style={styles.preview} transition={0} />
        <ThemedText selectable style={styles.title} lightColor="#3B2B1C" darkColor="#3B2B1C">{scene.name}</ThemedText>
        <ThemedText selectable style={styles.copy} lightColor="#6D5943" darkColor="#6D5943">Scenes you discover can decorate your Today page.</ThemedText>
        <View style={styles.actions}>
          <KatchaButton onPress={onDismiss} variant="secondary" size="compact" style={{flex: 1}} label="Keep current" />
          <KatchaButton onPress={onEquip} size="compact" style={{flex: 1}} label="Equip Scene" />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, alignItems: 'center', backgroundColor: 'rgba(25,20,16,0.7)', justifyContent: 'center', padding: 22, zIndex: 121 },
  card: { alignItems: 'center', backgroundColor: '#F8EBCF', borderCurve: 'continuous', borderRadius: 30, boxShadow: '0 22px 44px rgba(26,17,9,0.32)', maxWidth: 390, overflow: 'hidden', paddingBottom: 22, width: '100%' },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, paddingVertical: 14 },
  preview: { aspectRatio: 1.45, width: '100%' },
  title: { fontFamily: 'InstrumentSerif', fontSize: 36, lineHeight: 41, paddingHorizontal: 20, paddingTop: 16, textAlign: 'center' },
  copy: { fontSize: 14, lineHeight: 21, paddingHorizontal: 24, paddingTop: 6, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 18, width: '100%' },
});
