import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { eggAvatarFace } from '@/constants/egg-avatar-faces';
import { eggAvatarHat } from '@/constants/egg-avatar-hats';
import { eggAvatarHeldAccessory } from '@/constants/egg-avatar-held-accessories';
import { eggAvatarSkin } from '@/constants/egg-avatar-skins';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import {
  useEggExpressionPlayer,
  type EggExpressionCue,
} from '@/components/katchadeck/egg-avatar/use-egg-expression-player';
import type { EggAvatarFaceId, EggAvatarHatId, EggAvatarHeldAccessoryId, EggAvatarSkinId } from '@/types/egg-avatar';

export type { EggExpressionCue } from '@/components/katchadeck/egg-avatar/use-egg-expression-player';

export const EGG_AVATAR_FACE_PRESENTATION_SCALE = 0.92;

type EggAvatarArtworkProps = {
  allowDownscaling?: boolean;
  faceId: EggAvatarFaceId;
  hatId?: EggAvatarHatId | null;
  heldAccessoryId?: EggAvatarHeldAccessoryId | null;
  priority?: 'low' | 'normal' | 'high';
  resolution?: 'thumbnail' | 'app' | 'high';
  skinId: EggAvatarSkinId;
  style?: StyleProp<ViewStyle>;
  transition?: number;
  expressionSequence?: readonly EggExpressionCue[];
  expressionSequenceKey?: string | number;
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

export function eggAvatarHatPresentationStyle(
  skinId: EggAvatarSkinId,
  presentation?: { scale: number; offsetX: number; offsetY: number },
) {
  const body = eggAvatarSkin(skinId).presentation ?? { scale: 1, offsetX: 0, offsetY: 0 };
  const residual = presentation ?? { scale: 1, offsetX: 0, offsetY: 0 };
  return centeredLayerStyle(
    body.scale * residual.scale,
    body.offsetX + residual.offsetX,
    body.offsetY + residual.offsetY,
  );
}

export function EggAvatarArtwork({
  allowDownscaling = true,
  faceId,
  hatId,
  heldAccessoryId,
  priority = 'normal',
  resolution = 'app',
  skinId,
  style,
  transition = 0,
  expressionSequence,
  expressionSequenceKey,
}: EggAvatarArtworkProps) {
  const { equippedHatId, equippedHeldAccessoryId } = useEggAvatar();
  const skin = eggAvatarSkin(skinId);
  const {
    faceId: displayedFaceId,
    transitionMs: faceTransitionDuration,
  } = useEggExpressionPlayer({
    baseFaceId: faceId,
    sequence: expressionSequence,
    sequenceKey: expressionSequenceKey,
  });
  const face = eggAvatarFace(displayedFaceId);
  const hat = eggAvatarHat(hatId === undefined ? equippedHatId : hatId);
  const heldAccessory = eggAvatarHeldAccessory(
    heldAccessoryId === undefined ? equippedHeldAccessoryId : heldAccessoryId,
  );
  const sourceForResolution = <T extends {
    fullSource: number;
    highSource: number;
    thumbnailSource: number;
  }>(item: T) => {
    if (resolution === 'thumbnail') return item.thumbnailSource;
    if (resolution === 'high') return item.highSource;
    return item.fullSource;
  };
  const bodySource = sourceForResolution(skin);
  const faceSource = sourceForResolution(face);

  return (
    <View pointerEvents="none" style={[styles.container, style]}>
      {/* Keep each native image view stable while its source changes. A recyclingKey
          deliberately clears expo-image to blank, which causes a visible hole while
          the newly selected customization is decoding. Without it, expo-image keeps
          the displayed layer until the replacement is ready, then applies transition. */}
      <Image
        allowDownscaling={allowDownscaling}
        cachePolicy="memory-disk"
        contentFit="contain"
        priority={priority}
        source={bodySource}
        style={eggAvatarBodyPresentationStyle(skinId)}
        transition={transition}
      />
      <Image
        allowDownscaling={allowDownscaling}
        cachePolicy="memory-disk"
        contentFit="contain"
        priority={priority}
        source={faceSource}
        style={centeredLayerStyle(EGG_AVATAR_FACE_PRESENTATION_SCALE)}
        transition={faceTransitionDuration}
      />
      {hat ? (
        <Image
          allowDownscaling={allowDownscaling}
          cachePolicy="memory-disk"
          contentFit="contain"
          priority={priority}
          source={sourceForResolution(hat)}
          style={eggAvatarHatPresentationStyle(skinId, hat.presentation)}
          transition={transition}
        />
      ) : null}
      {heldAccessory ? (
        <Image
          allowDownscaling={allowDownscaling}
          cachePolicy="memory-disk"
          contentFit="contain"
          priority={priority}
          source={sourceForResolution(heldAccessory)}
          style={centeredLayerStyle(
            heldAccessory.presentation?.scale ?? 1,
            heldAccessory.presentation?.offsetX ?? 0,
            heldAccessory.presentation?.offsetY ?? 0,
          )}
          transition={transition}
        />
      ) : null}
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
