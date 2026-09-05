import type { WispGrantSource, WispId } from '@/types/wisp';
import type { EggAvatarAccess, EggAvatarCategory, EggAvatarRarity } from '@/types/egg-avatar';

export type EconomyFeatureFlags = {
  economySync: boolean;
  wispShop: boolean;
  visitorChoice: boolean;
  plus: boolean;
  gifting: boolean;
  seasonalTrack: boolean;
  legacyMigration: boolean;
};

export type EconomyOffer = {
  id: string;
  collectibleType: 'wisp' | 'avatar';
  collectibleId: string;
  currency: 'essence' | 'cash';
  price: number;
  enabled: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type EconomyConfig = {
  version: number;
  catalogVersion: number;
  flags: EconomyFeatureFlags;
  essence: {
    purchasable: false;
    duplicateConversion: Record<'common' | 'rare' | 'epic' | 'legendary', number>;
    rewards: Record<string, number>;
    avatarPrices: Record<EggAvatarCategory, Record<EggAvatarRarity, number>>;
  };
  shop: { offers: EconomyOffer[]; freeSlots: number; plusSlots: number };
  visitor: { daysPerClaim: number; choiceCount: number; ownedPoolFallbackEssence: number; pool: WispId[]; enabled: boolean };
  plus: {
    entitlementId: 'plus';
    offeringId: string;
    products: string[];
    monthlyClaimWispId: WispId;
    enabled: boolean;
    capabilities: PlusCapabilities;
  };
};

export type PlusCapabilities = {
  historyDays: number | null;
  premiumAvatarRental: boolean;
  shopSlots: number;
  monthlyWispClaim: boolean;
};

export type AvatarAccessState = {
  hasAccess: boolean;
  permanentlyOwned: boolean;
  source: 'free' | 'permanent' | 'plus-rental' | 'locked-plus' | 'locked-essence';
  price: number | null;
};

export type RevenueCatPackageSummary = {
  identifier: string;
  productIdentifier: string;
  title: string;
  priceString: string;
  period: 'monthly' | 'annual' | 'other';
};

export type AvatarPurchaseInput = {
  category: EggAvatarCategory;
  itemId: string;
  rarity: EggAvatarRarity;
  access: EggAvatarAccess;
};

export type EconomyInventoryGrant = {
  collectibleType: 'wisp' | 'avatar';
  collectibleId: string;
  quantity: number;
  source: WispGrantSource | 'avatar_free' | 'avatar_essence' | 'avatar_plus' | 'avatar_grandfathered';
  grantedAt: string;
};

export type VisitorOffer = {
  claimIndex: number;
  choices: WispId[];
  earnedAtCapturedDays: number;
};

export type EconomySnapshot = {
  configVersion: number;
  serverTime: string | null;
  essenceBalance: number;
  gemsBalance: number;
  activePlus: boolean;
  inventory: EconomyInventoryGrant[];
  activeCampaignIds: string[];
  shopOfferIds: string[];
  visitorOffer: VisitorOffer | null;
  monthlyPlusClaimed: boolean;
  synced: boolean;
};

export type EconomyMutationResult = { ok: true } | { ok: false; reason: 'disabled' | 'offline' | 'invalid_offer' | 'insufficient_essence' | 'not_eligible' | 'server_error' };
