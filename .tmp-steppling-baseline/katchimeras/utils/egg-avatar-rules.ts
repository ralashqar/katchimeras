import {
  EGG_AVATAR_FACE_IDS,
  EGG_AVATAR_HAT_IDS,
  EGG_AVATAR_HELD_ACCESSORY_IDS,
  EGG_AVATAR_SKIN_IDS,
  type EggAvatarFaceId,
  type EggAvatarHatId,
  type EggAvatarHeldAccessoryId,
  type EggAvatarSelectionState,
  type EggAvatarSkinId,
} from '@/types/egg-avatar';

export const DEFAULT_EGG_AVATAR_SKIN_ID: EggAvatarSkinId = 'classic';
export const DEFAULT_EGG_AVATAR_FACE_ID: EggAvatarFaceId = 'classic-smile';

export const DEFAULT_EGG_AVATAR_SELECTION: EggAvatarSelectionState = {
  version: 3,
  equippedSkinId: DEFAULT_EGG_AVATAR_SKIN_ID,
  equippedFaceId: DEFAULT_EGG_AVATAR_FACE_ID,
  equippedHatId: null,
  equippedHeldAccessoryId: null,
};

export function isEggAvatarSkinId(value: unknown): value is EggAvatarSkinId {
  return typeof value === 'string' && EGG_AVATAR_SKIN_IDS.includes(value as EggAvatarSkinId);
}

export function isEggAvatarFaceId(value: unknown): value is EggAvatarFaceId {
  return typeof value === 'string' && EGG_AVATAR_FACE_IDS.includes(value as EggAvatarFaceId);
}

export function isEggAvatarHatId(value: unknown): value is EggAvatarHatId {
  return typeof value === 'string' && EGG_AVATAR_HAT_IDS.includes(value as EggAvatarHatId);
}

export function isEggAvatarHeldAccessoryId(value: unknown): value is EggAvatarHeldAccessoryId {
  return typeof value === 'string'
    && EGG_AVATAR_HELD_ACCESSORY_IDS.includes(value as EggAvatarHeldAccessoryId);
}

export function normalizeEggAvatarSelection(value: unknown): EggAvatarSelectionState {
  if (!value || typeof value !== 'object') return DEFAULT_EGG_AVATAR_SELECTION;

  const candidate = value as {
    version?: number;
    equippedSkinId?: unknown;
    equippedFaceId?: unknown;
    equippedHatId?: unknown;
    equippedHeldAccessoryId?: unknown;
  };
  if (!isEggAvatarSkinId(candidate.equippedSkinId)) {
    return DEFAULT_EGG_AVATAR_SELECTION;
  }
  // v1 stored only a body. Preserve it and attach the default face.
  if (candidate.version === 1) {
    return migratedSelection(candidate.equippedSkinId, DEFAULT_EGG_AVATAR_FACE_ID);
  }
  if (!isEggAvatarFaceId(candidate.equippedFaceId)) {
    return DEFAULT_EGG_AVATAR_SELECTION;
  }
  if (candidate.version === 2) {
    return migratedSelection(candidate.equippedSkinId, candidate.equippedFaceId);
  }
  if (candidate.version !== 3) return DEFAULT_EGG_AVATAR_SELECTION;
  return {
    version: 3,
    equippedSkinId: candidate.equippedSkinId,
    equippedFaceId: candidate.equippedFaceId,
    equippedHatId: isEggAvatarHatId(candidate.equippedHatId) ? candidate.equippedHatId : null,
    equippedHeldAccessoryId: isEggAvatarHeldAccessoryId(candidate.equippedHeldAccessoryId)
      ? candidate.equippedHeldAccessoryId
      : null,
  };
}

function migratedSelection(skinId: EggAvatarSkinId, faceId: EggAvatarFaceId): EggAvatarSelectionState {
  const legacyHat: Partial<Record<EggAvatarSkinId, EggAvatarHatId>> = {
    moss: 'moss-sprout',
    barista: 'barista-beret',
    pumpkin: 'pumpkin-vine-crown',
  };
  return {
    version: 3,
    equippedSkinId: skinId,
    equippedFaceId: faceId,
    equippedHatId: legacyHat[skinId] ?? null,
    equippedHeldAccessoryId: null,
  };
}
