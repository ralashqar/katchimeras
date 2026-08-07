import { EGG_AVATAR_SKIN_IDS, type EggAvatarSelectionState, type EggAvatarSkinId } from '@/types/egg-avatar';

export const DEFAULT_EGG_AVATAR_SKIN_ID: EggAvatarSkinId = 'classic';

export const DEFAULT_EGG_AVATAR_SELECTION: EggAvatarSelectionState = {
  version: 1,
  equippedSkinId: DEFAULT_EGG_AVATAR_SKIN_ID,
};

export function isEggAvatarSkinId(value: unknown): value is EggAvatarSkinId {
  return typeof value === 'string' && EGG_AVATAR_SKIN_IDS.includes(value as EggAvatarSkinId);
}

export function normalizeEggAvatarSelection(value: unknown): EggAvatarSelectionState {
  if (!value || typeof value !== 'object') return DEFAULT_EGG_AVATAR_SELECTION;

  const candidate = value as Partial<EggAvatarSelectionState>;
  if (candidate.version !== 1 || !isEggAvatarSkinId(candidate.equippedSkinId)) {
    return DEFAULT_EGG_AVATAR_SELECTION;
  }

  return { version: 1, equippedSkinId: candidate.equippedSkinId };
}
