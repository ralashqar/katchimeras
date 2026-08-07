import type { EggAvatarSelectionState, EggAvatarSkinId } from '@/types/egg-avatar';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { DEFAULT_EGG_AVATAR_SELECTION, normalizeEggAvatarSelection } from '@/utils/egg-avatar-rules';

export const EGG_AVATAR_STORAGE_KEY = 'katchimera.egg-avatar.v1';

export function loadEggAvatarSelection(): EggAvatarSelectionState {
  return normalizeEggAvatarSelection(
    getStoredJson<unknown>(EGG_AVATAR_STORAGE_KEY, DEFAULT_EGG_AVATAR_SELECTION)
  );
}

export function saveEggAvatarSelection(state: EggAvatarSelectionState) {
  setStoredJson(EGG_AVATAR_STORAGE_KEY, normalizeEggAvatarSelection(state));
}

export function equipEggAvatarSkin(skinId: EggAvatarSkinId): EggAvatarSelectionState {
  const next: EggAvatarSelectionState = { version: 1, equippedSkinId: skinId };
  saveEggAvatarSelection(next);
  return next;
}
