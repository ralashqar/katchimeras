import type { EggAvatarFaceDefinition, EggAvatarFaceId } from '@/types/egg-avatar';

export const EGG_AVATAR_FACES: readonly EggAvatarFaceDefinition[] = [
  {
    id: 'classic-smile',
    name: 'Classic Smile',
    description: 'Bright eyes, a tiny smile, and warm rosy cheeks.',
    fullSource: require('../assets/images/katchimeras/egg-avatars/faces/classic-smile.webp'),
    highResolutionSource: require('../assets/images/katchimeras/egg-avatars/faces/classic-smile.png'),
    thumbnailSource: require('../assets/images/katchimeras/egg-avatars/faces/thumbnails/classic-smile.webp'),
    faceLayoutVersion: 1,
    isDefault: true,
    version: 2,
  },
] as const;

export const DEFAULT_EGG_AVATAR_FACE_ID: EggAvatarFaceId = 'classic-smile';

export const EGG_AVATAR_FACE_BY_ID = new Map<EggAvatarFaceId, EggAvatarFaceDefinition>(
  EGG_AVATAR_FACES.map((face) => [face.id, face])
);

export function eggAvatarFace(id: EggAvatarFaceId | string | null | undefined): EggAvatarFaceDefinition {
  return EGG_AVATAR_FACE_BY_ID.get(id as EggAvatarFaceId) ?? EGG_AVATAR_FACE_BY_ID.get(DEFAULT_EGG_AVATAR_FACE_ID)!;
}
