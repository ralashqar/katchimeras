import {
  EGG_AVATAR_READY_ASSETS,
} from '@/constants/egg-avatar-assets.generated';
import { EGG_AVATAR_BODY_ACCENTS } from '@/constants/egg-avatar-catalog.generated';
import { availableEggAvatarItems } from '@/constants/egg-avatar-catalog';
import type { EggAvatarSkinDefinition, EggAvatarSkinId } from '@/types/egg-avatar';

export const EGG_AVATAR_SKINS: readonly EggAvatarSkinDefinition[] = availableEggAvatarItems('body').map(
  (item) => {
    const id = item.id as EggAvatarSkinId;
    return {
      ...item,
      id,
      availability: 'ready',
      assetRefs: item.assetRefs!,
      ...EGG_AVATAR_READY_ASSETS.body[id],
      accent: EGG_AVATAR_BODY_ACCENTS[id],
      faceLayoutVersion: item.layoutVersion as 1,
    };
  },
);

export const DEFAULT_EGG_AVATAR_SKIN_ID: EggAvatarSkinId = 'classic';

export const EGG_AVATAR_SKIN_BY_ID = new Map<EggAvatarSkinId, EggAvatarSkinDefinition>(
  EGG_AVATAR_SKINS.map((skin) => [skin.id, skin]),
);

export function eggAvatarSkin(id: EggAvatarSkinId | string | null | undefined): EggAvatarSkinDefinition {
  return EGG_AVATAR_SKIN_BY_ID.get(id as EggAvatarSkinId) ?? EGG_AVATAR_SKIN_BY_ID.get(DEFAULT_EGG_AVATAR_SKIN_ID)!;
}
