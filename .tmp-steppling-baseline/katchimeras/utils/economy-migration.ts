import { allEggAvatarItems } from '@/constants/egg-avatar-catalog';
import type { EggAvatarCategory } from '@/types/egg-avatar';
import { loadEggAvatarSelection } from '@/utils/egg-avatar-storage';
import { ensureStreakIdentity } from '@/utils/streak-sync';
import { supabase } from '@/utils/supabase';

const CATEGORIES: EggAvatarCategory[] = ['body', 'face', 'hat', 'held'];

export async function migrateLegacyEconomy(openingBalance: number, purchasedIds: readonly string[]) {
  if (!await ensureStreakIdentity()) return false;
  const selection = loadEggAvatarSelection();
  const equipped = [
    `body:${selection.equippedSkinId}`,
    `face:${selection.equippedFaceId}`,
    selection.equippedHatId ? `hat:${selection.equippedHatId}` : null,
    selection.equippedHeldAccessoryId ? `held:${selection.equippedHeldAccessoryId}` : null,
  ].filter((value): value is string => Boolean(value));
  const purchased = purchasedIds.flatMap((itemId) => CATEGORIES
    .filter((category) => allEggAvatarItems(category).some((item) => item.id === itemId))
    .map((category) => `${category}:${itemId}`));
  const { error } = await supabase.rpc('migrate_legacy_economy_v1', {
    opening_balance: Math.max(0, Math.round(openingBalance)),
    purchased_avatar_ids: purchased,
    equipped_avatar_ids: equipped,
  });
  return !error;
}
