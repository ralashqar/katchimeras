import { EGG_AVATAR_READY_ASSETS } from '@/constants/egg-avatar-assets.generated';
import { availableEggAvatarItems } from '@/constants/egg-avatar-catalog';
import type {
  EggAvatarHeldAccessoryDefinition,
  EggAvatarHeldAccessoryId,
} from '@/types/egg-avatar';

export const EGG_AVATAR_HELD_ACCESSORIES: readonly EggAvatarHeldAccessoryDefinition[] = availableEggAvatarItems('held').map(
  (item) => {
    const id = item.id as EggAvatarHeldAccessoryId;
    return {
      ...item,
      id,
      availability: 'ready',
      assetRefs: item.assetRefs!,
      ...EGG_AVATAR_READY_ASSETS.held[id],
      accessoryLayoutVersion: item.layoutVersion as 1 | 2,
    };
  },
);

export const EGG_AVATAR_HELD_ACCESSORY_BY_ID = new Map<EggAvatarHeldAccessoryId, EggAvatarHeldAccessoryDefinition>(
  EGG_AVATAR_HELD_ACCESSORIES.map((item) => [item.id, item]),
);

export function eggAvatarHeldAccessory(
  id: EggAvatarHeldAccessoryId | string | null | undefined,
): EggAvatarHeldAccessoryDefinition | null {
  return id ? EGG_AVATAR_HELD_ACCESSORY_BY_ID.get(id as EggAvatarHeldAccessoryId) ?? null : null;
}
