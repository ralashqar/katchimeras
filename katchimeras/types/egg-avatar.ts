export const EGG_AVATAR_SKIN_IDS = [
  'classic',
  'moss',
  'tide',
  'sunset',
  'starglow',
  'frost',
  'ember',
  'barista',
  'robot',
  'pumpkin',
] as const;

export type EggAvatarSkinId = (typeof EGG_AVATAR_SKIN_IDS)[number];

export const EGG_AVATAR_FACE_IDS = [
  'classic-smile',
  'happy-squint',
  'sleepy',
  'curious',
  'determined',
] as const;

export type EggAvatarFaceId = (typeof EGG_AVATAR_FACE_IDS)[number];

export type EggAvatarSkinDefinition = {
  id: EggAvatarSkinId;
  name: string;
  description: string;
  accent: string;
  fullSource: number;
  highResolutionSource: number;
  thumbnailSource: number;
  faceLayoutVersion: 1;
  isDefault?: boolean;
  version: number;
  presentation?: {
    scale: number;
    offsetX: number;
    offsetY: number;
  };
};

export type EggAvatarFaceDefinition = {
  id: EggAvatarFaceId;
  name: string;
  description: string;
  fullSource: number;
  highResolutionSource: number;
  thumbnailSource: number;
  faceLayoutVersion: 1;
  isDefault?: boolean;
  version: number;
};

export type EggAvatarSelectionState = {
  version: 2;
  equippedSkinId: EggAvatarSkinId;
  equippedFaceId: EggAvatarFaceId;
};
