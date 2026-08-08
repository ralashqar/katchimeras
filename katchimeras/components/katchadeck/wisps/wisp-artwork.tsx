import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { wispDefinition } from '@/constants/wisps';
import { wispAsset } from '@/constants/wisp-assets';
import type { WispId } from '@/types/wisp';

export function WispArtwork({ id, size, thumbnail = false, silhouette = false, style }: { id: WispId; size: number; thumbnail?: boolean; silhouette?: boolean; style?: StyleProp<ViewStyle> }) {
  const source = wispAsset(id, thumbnail);
  const definition = wispDefinition(id);
  return (
    <View accessibilityLabel={`${definition.name} Wisp`} accessible style={[styles.frame, { height: size, width: size }, style]}>
      {source ? <Image cachePolicy="memory-disk" contentFit="contain" source={source} style={[StyleSheet.absoluteFill, silhouette && styles.silhouette]} transition={0} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center' },
  silhouette: { opacity: 0.42, tintColor: '#6E604F' },
});
