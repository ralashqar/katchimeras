import type { EggAvatarFaceId, EggAvatarSelectionState, EggAvatarSkinId } from '@/types/egg-avatar';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { DEFAULT_EGG_AVATAR_SELECTION, normalizeEggAvatarSelection } from '@/utils/egg-avatar-rules';

export const EGG_AVATAR_STORAGE_KEY = 'katchimera.egg-avatar.v2';
export const LEGACY_EGG_AVATAR_STORAGE_KEY = 'katchimera.egg-avatar.v1';

export function loadEggAvatarSelection(): EggAvatarSelectionState {
  const current = getStoredJson<unknown>(EGG_AVATAR_STORAGE_KEY, null);
  if (current) return normalizeEggAvatarSelection(current);
  const migrated = normalizeEggAvatarSelection(
    getStoredJson<unknown>(LEGACY_EGG_AVATAR_STORAGE_KEY, DEFAULT_EGG_AVATAR_SELECTION)
  );
  saveEggAvatarSelection(migrated);
  return migrated;
}

export function saveEggAvatarSelection(state: EggAvatarSelectionState) {
  setStoredJson(EGG_AVATAR_STORAGE_KEY, normalizeEggAvatarSelection(state));
}

export function equipEggAvatarSkin(skinId: EggAvatarSkinId): EggAvatarSelectionState {
  const current = loadEggAvatarSelection();
  const next: EggAvatarSelectionState = { ...current, equippedSkinId: skinId };
  saveEggAvatarSelection(next);
  return next;
}

export function equipEggAvatarFace(faceId: EggAvatarFaceId): EggAvatarSelectionState {
  const current = loadEggAvatarSelection();
  const next: EggAvatarSelectionState = { ...current, equippedFaceId: faceId };
  saveEggAvatarSelection(next);
  return next;
}
