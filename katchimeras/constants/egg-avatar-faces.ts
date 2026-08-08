import { EGG_AVATAR_READY_ASSETS } from '@/constants/egg-avatar-assets.generated';
import { availableEggAvatarItems } from '@/constants/egg-avatar-catalog';
import type { EggAvatarFaceDefinition, EggAvatarFaceId } from '@/types/egg-avatar';

export const EGG_AVATAR_FACES: readonly EggAvatarFaceDefinition[] = availableEggAvatarItems('face').map(
  (item) => {
    const id = item.id as EggAvatarFaceId;
    return {
      ...item,
      id,
      availability: 'ready',
      assetRefs: item.assetRefs!,
      ...EGG_AVATAR_READY_ASSETS.face[id],
      faceLayoutVersion: item.layoutVersion as 1,
    };
  },
);

export const DEFAULT_EGG_AVATAR_FACE_ID: EggAvatarFaceId = 'classic-smile';

export const EGG_AVATAR_FACE_BY_ID = new Map<EggAvatarFaceId, EggAvatarFaceDefinition>(
  EGG_AVATAR_FACES.map((face) => [face.id, face]),
);

export function eggAvatarFace(id: EggAvatarFaceId | string | null | undefined): EggAvatarFaceDefinition {
  return EGG_AVATAR_FACE_BY_ID.get(id as EggAvatarFaceId) ?? EGG_AVATAR_FACE_BY_ID.get(DEFAULT_EGG_AVATAR_FACE_ID)!;
}
