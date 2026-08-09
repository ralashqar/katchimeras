import fallbackData from '@/data/economy/fallback.json';
import { READY_WISPS, WISPS_BY_ID, WISP_CATALOG_VERSION } from '@/constants/wisps';
import type { EconomyConfig, EconomySnapshot, VisitorOffer } from '@/types/economy';
import type { EggAvatarCategory, EggAvatarRarity } from '@/types/egg-avatar';
import type { WispId } from '@/types/wisp';

export const FALLBACK_ECONOMY_CONFIG = fallbackData as EconomyConfig;

export function normalizeEconomyConfig(value: unknown): EconomyConfig {
  if (!value || typeof value !== 'object') return FALLBACK_ECONOMY_CONFIG;
  const candidate = value as Partial<EconomyConfig>;
  if (!Number.isFinite(candidate.version) || !candidate.flags || !candidate.visitor || !candidate.plus || !candidate.shop) return FALLBACK_ECONOMY_CONFIG;
  if ((candidate.catalogVersion ?? Infinity) > WISP_CATALOG_VERSION) return FALLBACK_ECONOMY_CONFIG;
  const knownReady = new Set(READY_WISPS.map((item) => item.id));
  const pool = (candidate.visitor.pool ?? []).filter((id): id is WispId => WISPS_BY_ID.has(id) && knownReady.has(id));
  return {
    ...FALLBACK_ECONOMY_CONFIG,
    ...candidate,
    flags: { ...FALLBACK_ECONOMY_CONFIG.flags, ...candidate.flags },
    essence: { ...FALLBACK_ECONOMY_CONFIG.essence, ...candidate.essence, purchasable: false },
    shop: {
      freeSlots: candidate.shop.freeSlots ?? FALLBACK_ECONOMY_CONFIG.shop.freeSlots,
      plusSlots: candidate.shop.plusSlots ?? FALLBACK_ECONOMY_CONFIG.shop.plusSlots,
      offers: (candidate.shop.offers ?? []).filter((offer) => offer.collectibleType !== 'wisp' || knownReady.has(offer.collectibleId as WispId)),
    },
    visitor: { ...FALLBACK_ECONOMY_CONFIG.visitor, ...candidate.visitor, pool },
    plus: { ...FALLBACK_ECONOMY_CONFIG.plus, ...candidate.plus },
  };
}

export function emptyEconomySnapshot(localEssenceBalance = 0): EconomySnapshot {
  return { configVersion: FALLBACK_ECONOMY_CONFIG.version, serverTime: null, essenceBalance: localEssenceBalance, activePlus: false, inventory: [], activeCampaignIds: [], shopOfferIds: [], visitorOffer: null, monthlyPlusClaimed: false, synced: false };
}

const AVATAR_PRICE: Record<EggAvatarCategory, Record<EggAvatarRarity, number>> = {
  body: { common: 150, rare: 300, epic: 500, legendary: 900 },
  face: { common: 60, rare: 120, epic: 240, legendary: 450 },
  hat: { common: 80, rare: 160, epic: 320, legendary: 600 },
  held: { common: 80, rare: 160, epic: 320, legendary: 600 },
};

export function avatarEssencePrice(category: EggAvatarCategory, rarity: EggAvatarRarity, config: EconomyConfig = FALLBACK_ECONOMY_CONFIG) {
  return config.essence.avatarPrices?.[category]?.[rarity] ?? AVATAR_PRICE[category][rarity];
}

export function visibleShopOffers(config: EconomyConfig, activePlus: boolean, selectedIds?: readonly string[]) {
  const count = activePlus ? config.shop.plusSlots : config.shop.freeSlots;
  const selected = selectedIds?.length ? new Set(selectedIds) : null;
  return config.shop.offers.filter((offer) => offer.enabled && (!selected || selected.has(offer.id))).slice(0, count);
}

export function deterministicVisitorOffer(input: {
  userSeed: string;
  claimIndex: number;
  capturedDays: number;
  owned: ReadonlySet<WispId>;
  config?: EconomyConfig;
}): VisitorOffer | null {
  const config = input.config ?? FALLBACK_ECONOMY_CONFIG;
  if (!config.visitor.enabled || input.capturedDays < (input.claimIndex + 1) * config.visitor.daysPerClaim) return null;
  const available = config.visitor.pool.filter((id) => !input.owned.has(id));
  if (!available.length) return { claimIndex: input.claimIndex, choices: [], earnedAtCapturedDays: (input.claimIndex + 1) * config.visitor.daysPerClaim };
  const ranked = available.map((id) => ({ id, score: hash32(`${input.userSeed}:${input.claimIndex}:${id}`) })).sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
  return { claimIndex: input.claimIndex, choices: ranked.slice(0, config.visitor.choiceCount).map((item) => item.id), earnedAtCapturedDays: (input.claimIndex + 1) * config.visitor.daysPerClaim };
}

function hash32(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}
