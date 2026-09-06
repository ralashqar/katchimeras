import type { MetaEvent } from '@/types/meta-game';
import type { SeasonDefinition, SeasonProgressState, SeasonReward } from '@/types/season';
import { resolveMetaEvent } from '@/utils/meta-progression';

export function emptySeasonProgress(seasonId: string): SeasonProgressState {
  return { version: 1, seasonId, xp: 0, premium: false, claimedFreeTierIds: [], claimedPremiumTierIds: [], processedEventIds: [] };
}

export function activeSeason(seasons: readonly SeasonDefinition[], now: Date): SeasonDefinition | null {
  const timestamp = now.getTime();
  return seasons.find((season) => season.enabled && Date.parse(season.startsAt) <= timestamp && timestamp < Date.parse(season.endsAt)) ?? null;
}

export function applySeasonEvents(state: SeasonProgressState, events: readonly MetaEvent[]): SeasonProgressState {
  const processed = new Set(state.processedEventIds);
  let xp = state.xp;
  for (const event of events) {
    if (processed.has(event.id)) continue;
    processed.add(event.id);
    xp += resolveMetaEvent(event).rewards
      .filter((reward) => reward.kind === 'season_xp')
      .reduce((sum, reward) => sum + reward.amount, 0);
  }
  return xp === state.xp && processed.size === state.processedEventIds.length
    ? state
    : { ...state, xp, processedEventIds: [...processed].slice(-5000) };
}

export function claimSeasonTier(
  state: SeasonProgressState,
  season: SeasonDefinition,
  tierId: string,
  track: 'free' | 'premium',
): { state: SeasonProgressState; reward: SeasonReward | null } {
  const tier = season.tiers.find((item) => item.id === tierId);
  const claimed = track === 'free' ? state.claimedFreeTierIds : state.claimedPremiumTierIds;
  if (!tier || state.xp < tier.xp || claimed.includes(tierId) || (track === 'premium' && !state.premium)) return { state, reward: null };
  const reward = track === 'free' ? tier.freeReward : tier.premiumReward ?? null;
  if (!reward) return { state, reward: null };
  return {
    state: track === 'free'
      ? { ...state, claimedFreeTierIds: [...state.claimedFreeTierIds, tierId] }
      : { ...state, claimedPremiumTierIds: [...state.claimedPremiumTierIds, tierId] },
    reward,
  };
}
