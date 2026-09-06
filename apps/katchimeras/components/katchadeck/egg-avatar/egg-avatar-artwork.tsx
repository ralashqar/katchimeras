import type { StyleProp, ViewStyle } from 'react-native';
import { LayeredAvatar } from '@incubator/avatar/layered-avatar';
import { centeredLayerStyle, composeLayerPresentation } from '@incubator/avatar/layout';

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
  onError?: () => void;
  onLoad?: () => void;
  priority?: 'low' | 'normal' | 'high';
  resolution?: 'thumbnail' | 'app' | 'high';
  showFace?: boolean;
  skinId: EggAvatarSkinId;
  style?: StyleProp<ViewStyle>;
  transition?: number;
  expressionSequence?: readonly EggExpressionCue[];
  expressionSequenceKey?: string | number;
};

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
  onError,
  onLoad,
  priority = 'normal',
  resolution = 'app',
  showFace = true,
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

  const bodyPresentation = skin.presentation ?? {scale:1,offsetX:0,offsetY:0};
  const hatPresentation = composeLayerPresentation(bodyPresentation, hat?.presentation ?? {scale:1,offsetX:0,offsetY:0});
  return <LayeredAvatar bodySource={bodySource} faceSource={faceSource} hat={hat ? sourceForResolution(hat) : null} heldAccessory={heldAccessory ? sourceForResolution(heldAccessory) : null} bodyPresentation={bodyPresentation} hatPresentation={hatPresentation} heldPresentation={heldAccessory?.presentation} faceScale={EGG_AVATAR_FACE_PRESENTATION_SCALE} faceTransitionDuration={faceTransitionDuration} allowDownscaling={allowDownscaling} showFace={showFace} transition={transition} priority={priority} onError={onError} onLoad={onLoad} style={style} />;
}
