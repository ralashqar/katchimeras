import { createContext, type PropsWithChildren, use, useCallback, useMemo, useState } from 'react';

import type { EggAvatarSkinDefinition, EggAvatarSkinId } from '@/types/egg-avatar';
import { eggAvatarSkin } from '@/constants/egg-avatar-skins';
import { equipEggAvatarSkin, loadEggAvatarSelection } from '@/utils/egg-avatar-storage';

type EggAvatarContextValue = {
  equippedSkin: EggAvatarSkinDefinition;
  equippedSkinId: EggAvatarSkinId;
  equipSkin: (skinId: EggAvatarSkinId) => void;
};

const EggAvatarContext = createContext<EggAvatarContextValue | null>(null);

export function EggAvatarProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(loadEggAvatarSelection);

  const equipSkin = useCallback((skinId: EggAvatarSkinId) => {
    setState(equipEggAvatarSkin(skinId));
  }, []);

  const value = useMemo<EggAvatarContextValue>(() => ({
    equippedSkin: eggAvatarSkin(state.equippedSkinId),
    equippedSkinId: state.equippedSkinId,
    equipSkin,
  }), [equipSkin, state.equippedSkinId]);

  return <EggAvatarContext value={value}>{children}</EggAvatarContext>;
}

export function useEggAvatar() {
  const value = use(EggAvatarContext);
  if (!value) throw new Error('useEggAvatar must be used inside EggAvatarProvider.');
  return value;
}
