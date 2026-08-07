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
  {
    id: 'happy-squint',
    name: 'Happy Squint',
    description: 'Closed happy eyes and a delighted little grin.',
    fullSource: require('../assets/images/katchimeras/egg-avatars/faces/happy-squint.webp'),
    highResolutionSource: require('../assets/images/katchimeras/egg-avatars/faces/happy-squint.png'),
    thumbnailSource: require('../assets/images/katchimeras/egg-avatars/faces/thumbnails/happy-squint.webp'),
    faceLayoutVersion: 1,
    version: 1,
  },
  {
    id: 'sleepy',
    name: 'Sleepy',
    description: 'Restful closed eyes and a peaceful smile.',
    fullSource: require('../assets/images/katchimeras/egg-avatars/faces/sleepy.webp'),
    highResolutionSource: require('../assets/images/katchimeras/egg-avatars/faces/sleepy.png'),
    thumbnailSource: require('../assets/images/katchimeras/egg-avatars/faces/thumbnails/sleepy.webp'),
    faceLayoutVersion: 1,
    version: 1,
  },
  {
    id: 'curious',
    name: 'Curious',
    description: 'Wondering eyes and a tiny surprised mouth.',
    fullSource: require('../assets/images/katchimeras/egg-avatars/faces/curious.webp'),
    highResolutionSource: require('../assets/images/katchimeras/egg-avatars/faces/curious.png'),
    thumbnailSource: require('../assets/images/katchimeras/egg-avatars/faces/thumbnails/curious.webp'),
    faceLayoutVersion: 1,
    version: 1,
  },
  {
    id: 'determined',
    name: 'Determined',
    description: 'A cute, confident ready-to-try expression.',
    fullSource: require('../assets/images/katchimeras/egg-avatars/faces/determined.webp'),
    highResolutionSource: require('../assets/images/katchimeras/egg-avatars/faces/determined.png'),
    thumbnailSource: require('../assets/images/katchimeras/egg-avatars/faces/thumbnails/determined.webp'),
    faceLayoutVersion: 1,
    version: 1,
  },
] as const;

export const DEFAULT_EGG_AVATAR_FACE_ID: EggAvatarFaceId = 'classic-smile';

export const EGG_AVATAR_FACE_BY_ID = new Map<EggAvatarFaceId, EggAvatarFaceDefinition>(
  EGG_AVATAR_FACES.map((face) => [face.id, face])
);

export function eggAvatarFace(id: EggAvatarFaceId | string | null | undefined): EggAvatarFaceDefinition {
  return EGG_AVATAR_FACE_BY_ID.get(id as EggAvatarFaceId) ?? EGG_AVATAR_FACE_BY_ID.get(DEFAULT_EGG_AVATAR_FACE_ID)!;
}
