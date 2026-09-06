import { useEffect } from 'react';

import { EGG_AVATAR_FACES } from '@/constants/egg-avatar-faces';
import { EGG_AVATAR_HATS } from '@/constants/egg-avatar-hats';
import { EGG_AVATAR_HELD_ACCESSORIES } from '@/constants/egg-avatar-held-accessories';
import { EGG_AVATAR_SKINS } from '@/constants/egg-avatar-skins';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import { useEconomy } from '@/features/economy/economy-provider';
import type { EggAvatarSelectionState } from '@/types/egg-avatar';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { DEFAULT_EGG_AVATAR_SELECTION } from '@/utils/egg-avatar-rules';

const RENTAL_SELECTION_KEY = 'katchimera.economy.avatar-rental.v1';
type SavedRental = { selection: EggAvatarSelectionState; fallbackApplied: boolean };

export function AvatarAccessReconciler() {
  const avatar = useEggAvatar();
  const economy = useEconomy();

  useEffect(() => {
    if (!economy.config.flags.plus) return;
    const current: EggAvatarSelectionState = {
      version: 3,
      equippedSkinId: avatar.equippedSkinId,
      equippedFaceId: avatar.equippedFaceId,
      equippedHatId: avatar.equippedHatId,
      equippedHeldAccessoryId: avatar.equippedHeldAccessoryId,
    };
    const saved = getStoredJson<SavedRental | null>(RENTAL_SELECTION_KEY, null);
    const hasPremium = selectionUsesPremium(current);
    if (economy.snapshot.activePlus) {
      if (hasPremium) {
        setStoredJson(RENTAL_SELECTION_KEY, { selection: current, fallbackApplied: false });
      } else if (saved?.fallbackApplied) {
        applySelection(saved.selection, avatar);
        setStoredJson(RENTAL_SELECTION_KEY, { ...saved, fallbackApplied: false });
      }
      return;
    }
    if (!hasPremium) return;
    setStoredJson(RENTAL_SELECTION_KEY, { selection: current, fallbackApplied: true });
    avatar.equipSkin(isPremium(EGG_AVATAR_SKINS, current.equippedSkinId) ? DEFAULT_EGG_AVATAR_SELECTION.equippedSkinId : current.equippedSkinId);
    avatar.equipFace(isPremium(EGG_AVATAR_FACES, current.equippedFaceId) ? DEFAULT_EGG_AVATAR_SELECTION.equippedFaceId : current.equippedFaceId);
    if (current.equippedHatId && isPremium(EGG_AVATAR_HATS, current.equippedHatId)) avatar.equipHat(null);
    if (current.equippedHeldAccessoryId && isPremium(EGG_AVATAR_HELD_ACCESSORIES, current.equippedHeldAccessoryId)) avatar.equipHeldAccessory(null);
  }, [avatar, economy.config.flags.plus, economy.snapshot.activePlus]);
  return null;
}

function selectionUsesPremium(selection: EggAvatarSelectionState) {
  return isPremium(EGG_AVATAR_SKINS, selection.equippedSkinId)
    || isPremium(EGG_AVATAR_FACES, selection.equippedFaceId)
    || Boolean(selection.equippedHatId && isPremium(EGG_AVATAR_HATS, selection.equippedHatId))
    || Boolean(selection.equippedHeldAccessoryId && isPremium(EGG_AVATAR_HELD_ACCESSORIES, selection.equippedHeldAccessoryId));
}

function isPremium(items: readonly { id: string; access: { mode: string } }[], id: string) {
  return items.find((item) => item.id === id)?.access.mode === 'premium';
}

function applySelection(selection: EggAvatarSelectionState, avatar: ReturnType<typeof useEggAvatar>) {
  avatar.equipSkin(selection.equippedSkinId);
  avatar.equipFace(selection.equippedFaceId);
  avatar.equipHat(selection.equippedHatId);
  avatar.equipHeldAccessory(selection.equippedHeldAccessoryId);
}
