import { EGG_AVATAR_READY_ASSETS } from '@/constants/egg-avatar-assets.generated';
import { availableEggAvatarItems } from '@/constants/egg-avatar-catalog';
import type { EggAvatarHatDefinition, EggAvatarHatId } from '@/types/egg-avatar';

export const EGG_AVATAR_HATS: readonly EggAvatarHatDefinition[] = availableEggAvatarItems('hat').map(
  (item) => {
    const id = item.id as EggAvatarHatId;
    return {
      ...item,
      id,
      availability: 'ready',
      assetRefs: item.assetRefs!,
      ...EGG_AVATAR_READY_ASSETS.hat[id],
      accessoryLayoutVersion: item.layoutVersion as 1 | 2,
    };
  },
);

export const EGG_AVATAR_HAT_BY_ID = new Map<EggAvatarHatId, EggAvatarHatDefinition>(
  EGG_AVATAR_HATS.map((item) => [item.id, item]),
);

export function eggAvatarHat(id: EggAvatarHatId | string | null | undefined): EggAvatarHatDefinition | null {
  return id ? EGG_AVATAR_HAT_BY_ID.get(id as EggAvatarHatId) ?? null : null;
}
