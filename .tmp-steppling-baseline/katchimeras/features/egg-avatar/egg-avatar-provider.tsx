import { createContext, type PropsWithChildren, use, useCallback, useEffect, useMemo, useState } from 'react';

import type { EggAvatarFaceDefinition, EggAvatarFaceId, EggAvatarHatDefinition, EggAvatarHatId, EggAvatarHeldAccessoryDefinition, EggAvatarHeldAccessoryId, EggAvatarSkinDefinition, EggAvatarSkinId } from '@/types/egg-avatar';
import { eggAvatarFace } from '@/constants/egg-avatar-faces';
import { eggAvatarHat } from '@/constants/egg-avatar-hats';
import { eggAvatarHeldAccessory } from '@/constants/egg-avatar-held-accessories';
import { eggAvatarSkin } from '@/constants/egg-avatar-skins';
import { equipEggAvatarFace, equipEggAvatarHat, equipEggAvatarHeldAccessory, equipEggAvatarSkin, loadEggAvatarSelection, subscribeEggAvatarSelection } from '@/utils/egg-avatar-storage';

type EggAvatarContextValue = {
  equippedSkin: EggAvatarSkinDefinition;
  equippedSkinId: EggAvatarSkinId;
  equippedFace: EggAvatarFaceDefinition;
  equippedFaceId: EggAvatarFaceId;
  equippedHat: EggAvatarHatDefinition | null;
  equippedHatId: EggAvatarHatId | null;
  equippedHeldAccessory: EggAvatarHeldAccessoryDefinition | null;
  equippedHeldAccessoryId: EggAvatarHeldAccessoryId | null;
  equipSkin: (skinId: EggAvatarSkinId) => void;
  equipFace: (faceId: EggAvatarFaceId) => void;
  equipHat: (hatId: EggAvatarHatId | null) => void;
  equipHeldAccessory: (accessoryId: EggAvatarHeldAccessoryId | null) => void;
};

const EggAvatarContext = createContext<EggAvatarContextValue | null>(null);

export function EggAvatarProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(loadEggAvatarSelection);

  useEffect(() => subscribeEggAvatarSelection(() => setState(loadEggAvatarSelection())), []);

  const equipSkin = useCallback((skinId: EggAvatarSkinId) => {
    setState(equipEggAvatarSkin(skinId));
  }, []);
  const equipFace = useCallback((faceId: EggAvatarFaceId) => {
    setState(equipEggAvatarFace(faceId));
  }, []);
  const equipHat = useCallback((hatId: EggAvatarHatId | null) => {
    setState(equipEggAvatarHat(hatId));
  }, []);
  const equipHeldAccessory = useCallback((accessoryId: EggAvatarHeldAccessoryId | null) => {
    setState(equipEggAvatarHeldAccessory(accessoryId));
  }, []);

  const value = useMemo<EggAvatarContextValue>(() => ({
    equippedSkin: eggAvatarSkin(state.equippedSkinId),
    equippedSkinId: state.equippedSkinId,
    equippedFace: eggAvatarFace(state.equippedFaceId),
    equippedFaceId: state.equippedFaceId,
    equippedHat: eggAvatarHat(state.equippedHatId),
    equippedHatId: state.equippedHatId,
    equippedHeldAccessory: eggAvatarHeldAccessory(state.equippedHeldAccessoryId),
    equippedHeldAccessoryId: state.equippedHeldAccessoryId,
    equipSkin,
    equipFace,
    equipHat,
    equipHeldAccessory,
  }), [equipFace, equipHat, equipHeldAccessory, equipSkin, state.equippedFaceId, state.equippedHatId, state.equippedHeldAccessoryId, state.equippedSkinId]);

  return <EggAvatarContext value={value}>{children}</EggAvatarContext>;
}

export function useEggAvatar() {
  const value = use(EggAvatarContext);
  if (!value) throw new Error('useEggAvatar must be used inside EggAvatarProvider.');
  return value;
}
