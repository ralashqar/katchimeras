import type { SeasonDefinition } from '@/types/season';

export const SEASON_CATALOG: readonly SeasonDefinition[] = [{
  id: 'season-zero-little-adventures',
  name: 'Season of Little Adventures',
  startsAt: '2026-08-01T00:00:00.000Z',
  endsAt: '2026-09-01T00:00:00.000Z',
  enabled: false,
  tiers: [
    { id: 'tier-1', xp: 100, freeReward: { kind: 'merge_energy', amount: 25 }, premiumReward: { kind: 'gems', amount: 20 } },
    { id: 'tier-2', xp: 250, freeReward: { kind: 'coins', amount: 150 }, premiumReward: { kind: 'wisp', wispId: 'leaflet' } },
    { id: 'tier-3', xp: 500, freeReward: { kind: 'wisp', wispId: 'sprout' }, premiumReward: { kind: 'cosmetic', cosmeticId: 'egg-hat-little-adventurer' } },
    { id: 'tier-4', xp: 800, freeReward: { kind: 'gems', amount: 25 }, premiumReward: { kind: 'cosmetic', cosmeticId: 'hatch-effect-wandering-light' } },
  ],
}];
