import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { eggAvatarFace } from '@/constants/egg-avatar-faces';
import { eggAvatarSkin } from '@/constants/egg-avatar-skins';
import type { EggAvatarFaceId, EggAvatarSkinId } from '@/types/egg-avatar';

export const EGG_AVATAR_FACE_PRESENTATION_SCALE = 0.92;

type EggAvatarArtworkProps = {
  allowDownscaling?: boolean;
  faceId: EggAvatarFaceId;
  priority?: 'low' | 'normal' | 'high';
  resolution?: 'thumbnail' | 'app' | 'high';
  skinId: EggAvatarSkinId;
  style?: StyleProp<ViewStyle>;
  transition?: number;
};

function centeredLayerStyle(scale: number, offsetX = 0, offsetY = 0) {
  const size = `${scale * 100}%` as `${number}%`;
  const left = `${((1 - scale) / 2 + offsetX) * 100}%` as `${number}%`;
  const top = `${((1 - scale) / 2 + offsetY) * 100}%` as `${number}%`;
  return { bottom: undefined, height: size, left, position: 'absolute' as const, right: undefined, top, width: size };
}

export function eggAvatarBodyPresentationStyle(skinId: EggAvatarSkinId) {
  const presentation = eggAvatarSkin(skinId).presentation ?? { scale: 1, offsetX: 0, offsetY: 0 };
  return centeredLayerStyle(presentation.scale, presentation.offsetX, presentation.offsetY);
}

export function EggAvatarArtwork({
  allowDownscaling = true,
  faceId,
  priority = 'normal',
  resolution = 'app',
  skinId,
  style,
  transition = 0,
}: EggAvatarArtworkProps) {
  const skin = eggAvatarSkin(skinId);
  const face = eggAvatarFace(faceId);
  const bodySource = resolution === 'thumbnail'
    ? skin.thumbnailSource
    : resolution === 'high'
      ? skin.highResolutionSource
      : skin.fullSource;
  const faceSource = resolution === 'thumbnail'
    ? face.thumbnailSource
    : resolution === 'high'
      ? face.highResolutionSource
      : face.fullSource;

  return (
    <View pointerEvents="none" style={[styles.container, style]}>
      <Image
        allowDownscaling={allowDownscaling}
        cachePolicy="memory-disk"
        contentFit="contain"
        priority={priority}
        recyclingKey={`egg-body-${skin.id}`}
        source={bodySource}
        style={eggAvatarBodyPresentationStyle(skinId)}
        transition={transition}
      />
      <Image
        allowDownscaling={allowDownscaling}
        cachePolicy="memory-disk"
        contentFit="contain"
        priority={priority}
        recyclingKey={`egg-face-${face.id}`}
        source={faceSource}
        style={centeredLayerStyle(EGG_AVATAR_FACE_PRESENTATION_SCALE)}
        transition={transition}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: '100%',
    overflow: 'visible',
    position: 'relative',
    width: '100%',
  },
});
