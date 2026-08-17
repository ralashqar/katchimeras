import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { wispDefinition } from '@/constants/wisps';
import { wispAsset } from '@/constants/wisp-assets';
import type { WispId } from '@/types/wisp';

type WispArtworkProps = {
  id: WispId;
  onError?: () => void;
  onLoad?: () => void;
  silhouette?: boolean;
  size: number;
  style?: StyleProp<ViewStyle>;
  thumbnail?: boolean;
};

export function WispArtwork({ id, onError, onLoad, size, thumbnail = false, silhouette = false, style }: WispArtworkProps) {
  const source = wispAsset(id, thumbnail);
  const definition = wispDefinition(id);
  return (
    <View accessibilityLabel={`${definition.name} Wisp`} accessible style={[styles.frame, { height: size, width: size }, style]}>
      {source ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="contain"
          onError={onError}
          onLoad={onLoad}
          priority="high"
          source={source}
          style={[StyleSheet.absoluteFill, silhouette && styles.silhouette]}
          transition={0}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center' },
  silhouette: { opacity: 0.42, tintColor: '#6E604F' },
});
