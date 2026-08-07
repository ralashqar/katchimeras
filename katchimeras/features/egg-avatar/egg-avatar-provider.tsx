import { createContext, type PropsWithChildren, use, useCallback, useMemo, useState } from 'react';

import type { EggAvatarFaceDefinition, EggAvatarFaceId, EggAvatarSkinDefinition, EggAvatarSkinId } from '@/types/egg-avatar';
import { eggAvatarFace } from '@/constants/egg-avatar-faces';
import { eggAvatarSkin } from '@/constants/egg-avatar-skins';
import { equipEggAvatarFace, equipEggAvatarSkin, loadEggAvatarSelection } from '@/utils/egg-avatar-storage';

type EggAvatarContextValue = {
  equippedSkin: EggAvatarSkinDefinition;
  equippedSkinId: EggAvatarSkinId;
  equippedFace: EggAvatarFaceDefinition;
  equippedFaceId: EggAvatarFaceId;
  equipSkin: (skinId: EggAvatarSkinId) => void;
  equipFace: (faceId: EggAvatarFaceId) => void;
};

const EggAvatarContext = createContext<EggAvatarContextValue | null>(null);

export function EggAvatarProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(loadEggAvatarSelection);

  const equipSkin = useCallback((skinId: EggAvatarSkinId) => {
    setState(equipEggAvatarSkin(skinId));
  }, []);
  const equipFace = useCallback((faceId: EggAvatarFaceId) => {
    setState(equipEggAvatarFace(faceId));
  }, []);

  const value = useMemo<EggAvatarContextValue>(() => ({
    equippedSkin: eggAvatarSkin(state.equippedSkinId),
    equippedSkinId: state.equippedSkinId,
    equippedFace: eggAvatarFace(state.equippedFaceId),
    equippedFaceId: state.equippedFaceId,
    equipSkin,
    equipFace,
  }), [equipFace, equipSkin, state.equippedFaceId, state.equippedSkinId]);

  return <EggAvatarContext value={value}>{children}</EggAvatarContext>;
}

export function useEggAvatar() {
  const value = use(EggAvatarContext);
  if (!value) throw new Error('useEggAvatar must be used inside EggAvatarProvider.');
  return value;
}
