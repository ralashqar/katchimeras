import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { EggAvatarArtwork } from '@/components/katchadeck/egg-avatar/egg-avatar-artwork';
import { eggAvatarSkin } from '@/constants/egg-avatar-skins';
import { DEFAULT_EGG_AVATAR_FACE_ID } from '@/constants/egg-avatar-faces';
import type { EggAvatarFaceId, EggAvatarHatId, EggAvatarHeldAccessoryId, EggAvatarSkinId } from '@/types/egg-avatar';

type EggAvatarProps = {
  skinId: EggAvatarSkinId;
  faceId?: EggAvatarFaceId;
  hatId?: EggAvatarHatId | null;
  heldAccessoryId?: EggAvatarHeldAccessoryId | null;
  size: number;
  presentation?: 'hero' | 'grid' | 'button';
  style?: StyleProp<ViewStyle>;
};

export function EggAvatar({ skinId, faceId = DEFAULT_EGG_AVATAR_FACE_ID, hatId, heldAccessoryId, size, presentation = 'hero', style }: EggAvatarProps) {
  const skin = eggAvatarSkin(skinId);

  return (
    <View
      accessibilityLabel={`${skin.name} egg avatar`}
      accessible
      style={[styles.shell, presentation === 'hero' && styles.heroShadow, { height: size, width: size }, style]}
    >
      <EggAvatarArtwork
        faceId={faceId}
        hatId={hatId}
        heldAccessoryId={heldAccessoryId}
        priority={presentation === 'button' ? 'high' : 'normal'}
        resolution={presentation === 'button' || presentation === 'grid' ? 'thumbnail' : 'app'}
        skinId={skinId}
        transition={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroShadow: {
    shadowColor: '#2A1609',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
  },
});
