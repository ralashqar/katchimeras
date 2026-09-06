import {
  EGG_AVATAR_BODY_CATALOG_IDS,
  EGG_AVATAR_FACE_CATALOG_IDS,
  EGG_AVATAR_FACE_IDS,
  EGG_AVATAR_HAT_CATALOG_IDS,
  EGG_AVATAR_HAT_IDS,
  EGG_AVATAR_HELD_ACCESSORY_IDS,
  EGG_AVATAR_HELD_CATALOG_IDS,
  EGG_AVATAR_SKIN_IDS,
} from '@/constants/egg-avatar-catalog.generated';

export {
  EGG_AVATAR_BODY_CATALOG_IDS,
  EGG_AVATAR_FACE_CATALOG_IDS,
  EGG_AVATAR_FACE_IDS,
  EGG_AVATAR_HAT_CATALOG_IDS,
  EGG_AVATAR_HAT_IDS,
  EGG_AVATAR_HELD_ACCESSORY_IDS,
  EGG_AVATAR_HELD_CATALOG_IDS,
  EGG_AVATAR_SKIN_IDS,
};

export type EggAvatarBodyCatalogId = (typeof EGG_AVATAR_BODY_CATALOG_IDS)[number];
export type EggAvatarFaceCatalogId = (typeof EGG_AVATAR_FACE_CATALOG_IDS)[number];
export type EggAvatarHatCatalogId = (typeof EGG_AVATAR_HAT_CATALOG_IDS)[number];
export type EggAvatarHeldCatalogId = (typeof EGG_AVATAR_HELD_CATALOG_IDS)[number];

export type EggAvatarSkinId = (typeof EGG_AVATAR_SKIN_IDS)[number];
export type EggAvatarFaceId = (typeof EGG_AVATAR_FACE_IDS)[number];
export type EggAvatarHatId = (typeof EGG_AVATAR_HAT_IDS)[number];
export type EggAvatarHeldAccessoryId = (typeof EGG_AVATAR_HELD_ACCESSORY_IDS)[number];

export type EggAvatarCategory = 'body' | 'face' | 'hat' | 'held';
export type EggAvatarRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type EggAvatarAccessMode = 'free' | 'premium' | 'essence';
export type EggAvatarAvailability = 'ready' | 'planned';

export type EggAvatarVisualDesign = {
  summary: string;
  palette: string[];
  shapeLanguage: string;
  constraints: string[];
};

export type EggAvatarAccess = {
  mode: EggAvatarAccessMode;
  essencePrice: number | null;
};

export type EggAvatarAssetRefs = {
  high: string;
  app: string;
  thumbnail: string;
};

export type EggAvatarPresentation = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type EggAvatarCatalogItem<Id extends string = string> = {
  id: Id;
  name: string;
  description: string;
  visualDesign: EggAvatarVisualDesign;
  rarity: EggAvatarRarity;
  access: EggAvatarAccess;
  availability: EggAvatarAvailability;
  assetRefs: EggAvatarAssetRefs | null;
  isDefault?: boolean;
  sortOrder: number;
  version: number;
  layoutVersion: number;
  presentation?: EggAvatarPresentation;
};

type ReadyArtSources = {
  fullSource: number;
  highSource: number;
  thumbnailSource: number;
};

export type EggAvatarSkinDefinition = EggAvatarCatalogItem<EggAvatarSkinId> & ReadyArtSources & {
  accent: string;
  availability: 'ready';
  assetRefs: EggAvatarAssetRefs;
  faceLayoutVersion: 1;
};

export type EggAvatarFaceDefinition = EggAvatarCatalogItem<EggAvatarFaceId> & ReadyArtSources & {
  availability: 'ready';
  assetRefs: EggAvatarAssetRefs;
  faceLayoutVersion: 1;
};

export type EggAvatarAccessoryDefinition<Id extends string> = EggAvatarCatalogItem<Id> & ReadyArtSources & {
  availability: 'ready';
  assetRefs: EggAvatarAssetRefs;
  accessoryLayoutVersion: 1 | 2;
};

export type EggAvatarHatDefinition = EggAvatarAccessoryDefinition<EggAvatarHatId>;
export type EggAvatarHeldAccessoryDefinition = EggAvatarAccessoryDefinition<EggAvatarHeldAccessoryId>;

export type EggAvatarSelectionState = {
  version: 3;
  equippedSkinId: EggAvatarSkinId;
  equippedFaceId: EggAvatarFaceId;
  equippedHatId: EggAvatarHatId | null;
  equippedHeldAccessoryId: EggAvatarHeldAccessoryId | null;
};
