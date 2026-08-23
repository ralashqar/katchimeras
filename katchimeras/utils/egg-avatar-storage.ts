import type { EggAvatarFaceId, EggAvatarHatId, EggAvatarHeldAccessoryId, EggAvatarSelectionState, EggAvatarSkinId } from '@/types/egg-avatar';
import { getStoredJson, removeStoredValue, setStoredJson } from '@/utils/app-storage';
import { DEFAULT_EGG_AVATAR_SELECTION, normalizeEggAvatarSelection } from '@/utils/egg-avatar-rules';

export const EGG_AVATAR_STORAGE_KEY = 'katchimera.egg-avatar.v3';
export const VERSION_TWO_EGG_AVATAR_STORAGE_KEY = 'katchimera.egg-avatar.v2';
export const LEGACY_EGG_AVATAR_STORAGE_KEY = 'katchimera.egg-avatar.v1';

const selectionListeners = new Set<() => void>();

function publishEggAvatarSelectionChange() {
  selectionListeners.forEach((listener) => listener());
}

export function subscribeEggAvatarSelection(listener: () => void) {
  selectionListeners.add(listener);
  return () => {
    selectionListeners.delete(listener);
  };
}

export function loadEggAvatarSelection(): EggAvatarSelectionState {
  const current = getStoredJson<unknown>(EGG_AVATAR_STORAGE_KEY, null);
  if (current) return normalizeEggAvatarSelection(current);
  const migrated = normalizeEggAvatarSelection(getStoredJson<unknown>(
    VERSION_TWO_EGG_AVATAR_STORAGE_KEY,
    getStoredJson<unknown>(LEGACY_EGG_AVATAR_STORAGE_KEY, DEFAULT_EGG_AVATAR_SELECTION),
  ));
  saveEggAvatarSelection(migrated);
  return migrated;
}

export function saveEggAvatarSelection(state: EggAvatarSelectionState) {
  setStoredJson(EGG_AVATAR_STORAGE_KEY, normalizeEggAvatarSelection(state));
  publishEggAvatarSelectionChange();
}

/** Return every equipped avatar layer to the base Egg without revoking owned cosmetics. */
export function resetEggAvatarSelection(): EggAvatarSelectionState {
  const selection = { ...DEFAULT_EGG_AVATAR_SELECTION };
  removeStoredValue(VERSION_TWO_EGG_AVATAR_STORAGE_KEY);
  removeStoredValue(LEGACY_EGG_AVATAR_STORAGE_KEY);
  saveEggAvatarSelection(selection);
  return selection;
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

export function equipEggAvatarHat(hatId: EggAvatarHatId | null): EggAvatarSelectionState {
  const current = loadEggAvatarSelection();
  const next: EggAvatarSelectionState = { ...current, equippedHatId: hatId };
  saveEggAvatarSelection(next);
  return next;
}

export function equipEggAvatarHeldAccessory(accessoryId: EggAvatarHeldAccessoryId | null): EggAvatarSelectionState {
  const current = loadEggAvatarSelection();
  const next: EggAvatarSelectionState = { ...current, equippedHeldAccessoryId: accessoryId };
  saveEggAvatarSelection(next);
  return next;
}
