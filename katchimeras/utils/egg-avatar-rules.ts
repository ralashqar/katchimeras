import {
  EGG_AVATAR_FACE_IDS,
  EGG_AVATAR_SKIN_IDS,
  type EggAvatarFaceId,
  type EggAvatarSelectionState,
  type EggAvatarSkinId,
} from '@/types/egg-avatar';

export const DEFAULT_EGG_AVATAR_SKIN_ID: EggAvatarSkinId = 'classic';
export const DEFAULT_EGG_AVATAR_FACE_ID: EggAvatarFaceId = 'classic-smile';

export const DEFAULT_EGG_AVATAR_SELECTION: EggAvatarSelectionState = {
  version: 2,
  equippedSkinId: DEFAULT_EGG_AVATAR_SKIN_ID,
  equippedFaceId: DEFAULT_EGG_AVATAR_FACE_ID,
};

export function isEggAvatarSkinId(value: unknown): value is EggAvatarSkinId {
  return typeof value === 'string' && EGG_AVATAR_SKIN_IDS.includes(value as EggAvatarSkinId);
}

export function isEggAvatarFaceId(value: unknown): value is EggAvatarFaceId {
  return typeof value === 'string' && EGG_AVATAR_FACE_IDS.includes(value as EggAvatarFaceId);
}

export function normalizeEggAvatarSelection(value: unknown): EggAvatarSelectionState {
  if (!value || typeof value !== 'object') return DEFAULT_EGG_AVATAR_SELECTION;

  const candidate = value as {
    version?: number;
    equippedSkinId?: unknown;
    equippedFaceId?: unknown;
  };
  if (!isEggAvatarSkinId(candidate.equippedSkinId)) {
    return DEFAULT_EGG_AVATAR_SELECTION;
  }
  // v1 stored only a body. Preserve it and attach the default face.
  if (candidate.version === 1) {
    return { version: 2, equippedSkinId: candidate.equippedSkinId, equippedFaceId: DEFAULT_EGG_AVATAR_FACE_ID };
  }
  if (candidate.version !== 2 || !isEggAvatarFaceId(candidate.equippedFaceId)) {
    return DEFAULT_EGG_AVATAR_SELECTION;
  }
  return { version: 2, equippedSkinId: candidate.equippedSkinId, equippedFaceId: candidate.equippedFaceId };
}
