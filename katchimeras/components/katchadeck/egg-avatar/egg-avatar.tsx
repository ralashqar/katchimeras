import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { eggAvatarSkin } from '@/constants/egg-avatar-skins';
import type { EggAvatarSkinId } from '@/types/egg-avatar';

type EggAvatarProps = {
  skinId: EggAvatarSkinId;
  size: number;
  presentation?: 'hero' | 'grid' | 'button';
  style?: StyleProp<ViewStyle>;
};

export function EggAvatar({ skinId, size, presentation = 'hero', style }: EggAvatarProps) {
  const skin = eggAvatarSkin(skinId);
  const source = presentation === 'button' ? skin.thumbnailSource : skin.fullSource;

  return (
    <View
      accessibilityLabel={`${skin.name} egg avatar`}
      accessible
      style={[styles.shell, presentation === 'hero' && styles.heroShadow, { height: size, width: size }, style]}
    >
      <Image
        accessibilityIgnoresInvertColors
        allowDownscaling
        cachePolicy="memory-disk"
        contentFit="contain"
        priority={presentation === 'button' ? 'high' : 'normal'}
        source={source}
        style={styles.image}
        transition={presentation === 'button' ? 0 : 140}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  heroShadow: {
    shadowColor: '#2A1609',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
  },
});
