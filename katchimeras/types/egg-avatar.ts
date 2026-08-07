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
};

export type EggAvatarSelectionState = {
  version: 1;
  equippedSkinId: EggAvatarSkinId;
};
