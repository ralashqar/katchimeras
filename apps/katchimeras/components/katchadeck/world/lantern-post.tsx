import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SharedAdventureProgress } from '@/features/shared-adventure/types';

/** Reuses bundled world art so the signal is available on a first offline session. */
export function LanternPost({ progress, onPress }: { progress?: SharedAdventureProgress; onPress?: () => void }) {
  const state = progress?.completedAt ? 'lit' : progress?.postBuiltAt ? 'prepared' : 'dormant';
  return <Pressable disabled={!onPress} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Lantern Post, ${state}`} style={styles.post}>
    {state === 'lit' ? <View style={styles.halo} /> : null}
    <Image source={require('@incubator/art-world/props/prop_lantern.png')} contentFit="contain" style={[styles.art, state === 'dormant' && { opacity: 0.4 }]} />
    {state === 'prepared' ? <Text style={styles.ready}>Ready to light</Text> : null}
  </Pressable>;
}
const styles = StyleSheet.create({
  post: { width: 68, height: 90, alignItems: 'center', justifyContent: 'center' },
  art: { width: 60, height: 78 },
  halo: { position: 'absolute', width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255,227,137,0.35)' },
  ready: { position: 'absolute', bottom: 0, color: '#FFF4CF', fontSize: 10, backgroundColor: '#344937', paddingHorizontal: 5, borderRadius: 6 },
});
