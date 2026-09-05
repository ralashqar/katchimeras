import type { EggAvatarCategory } from '@/types/egg-avatar';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { WispId } from '@/types/wisp';

export type FamilyCosmeticReward = {
  category: EggAvatarCategory;
  itemId: string;
};

export type WispFamilySeries = {
  id: string;
  familyId: KatchimeraFamilyId;
  signatureWispId: WispId;
  featuredWispIds: readonly WispId[];
  cosmeticRewards: readonly FamilyCosmeticReward[];
  pilot: boolean;
};
