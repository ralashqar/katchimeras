import { Image } from 'expo-image';
import { View, type ImageSourcePropType } from 'react-native';

/** Shared world-selector portrait: cream ring, leaf backdrop, overlapping art. */
export function HavenCharacterPortrait({ source, size = 156 }: { source: ImageSourcePropType; size?: number }) {
  const unit = size / 156;
  return <View pointerEvents="none" style={{ width: size, height: 112 * unit, position: 'relative' }}>
    <View style={{ position: 'absolute', left: 22 * unit, top: 20 * unit, width: 112 * unit, height: 112 * unit,
      borderRadius: 56 * unit, borderWidth: 7 * unit, borderColor: '#FFF6D8', backgroundColor: '#EAF6D2',
      boxShadow: `0 ${7 * unit}px ${16 * unit}px rgba(35,44,25,0.34)` }} />
    <Image source={source} accessibilityIgnoresInvertColors accessible={false} allowDownscaling cachePolicy="memory-disk"
      contentFit="contain" transition={0} style={{ position: 'absolute', width: size, height: size, left: 0, top: 0 }} />
  </View>;
}
