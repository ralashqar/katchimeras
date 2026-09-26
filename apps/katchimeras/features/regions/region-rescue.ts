import { islandLevel, type IslandLevelSpec } from '@/constants/island-campaigns/island-levels';
import type { RegionMissionDefinition } from '@/constants/island-campaigns/types';
import { regionFriendRescueId, type RegionFriend } from '@/constants/region-friends';

/**
 * A region friend's rescue (`constants/region-friends.ts`): the lit-window battle, grown for the wide world. The friend
 * is trapped under thick Mist at the top of the middle lane; it is won with every wisp down and that cell cleared.
 * Seeds land only in the bottom rows. Never a spitter down the middle lane (it would re-mist the trapped cell forever).
 */
const BOTTOM_ROWS = [36, 37, 38, 39, 40, 43, 44, 45, 46, 47] as const;

const SPECS: Readonly<Record<string, IslandLevelSpec>> = {
  // Dawnle, past the Hollow Tree: moths drawn to the lamp, a weaver among them, and the lamp's old guard.
  dawnle: {
    title: 'The Lamp Beyond', objective: 'Bring down every wisp, and burn the thick Mist off whoever kept the lamp lit.', difficulty: 'thick',
    pieces: [[43, 1], [44, 2], [45, 1], [46, 2], [47, 1], [36, 2], [38, 1], [40, 2], [30, 2], [32, 2]],
    mist: [16, 18, 24, 23, 25].map((cell) => ({ cell, type: 'light' as const })),
    rescue: { cell: 17 },
    wisps: [], seeds: { every: 3, area: BOTTOM_ROWS }, rows: 5,
    lanes: [
      { id: 'moth-1', column: 2, at: 2, hp: 6, step: 5.4 },
      { id: 'moth-2', column: 4, at: 2.6, hp: 6, step: 5.4 },
      { id: 'weaver', column: 1, at: 9, hp: 6, step: 4.6, look: 'weaver', weave: 2.6 },
      { id: 'spitter', column: 5, at: 10, hp: 6, step: 5, spit: 6 },
      { id: 'guard', column: 3, at: 16, hp: 7, step: 5 },
      { id: 'lamp-keeper', column: 3, at: 23, hp: 12, step: 5.2, look: 'warden' },
      { id: 'last-1', column: 1, at: 29, hp: 6, step: 4.5 },
      { id: 'last-2', column: 5, at: 29.6, hp: 6, step: 4.5 },
      { id: 'last-3', column: 4, at: 30.2, hp: 6, step: 4.5 },
    ],
    rewards: { glow: 60, xp: 40 },
  },
};

const built = new Map<string, RegionMissionDefinition>();
export function regionRescueSpec(friend: RegionFriend): IslandLevelSpec {
  const spec = SPECS[friend.id];
  if (!spec) throw new Error(`no rescue authored for ${friend.id}`);
  return spec;
}
export function regionRescueMission(friend: RegionFriend): RegionMissionDefinition {
  const cached = built.get(friend.id);
  if (cached) return cached;
  const mission = islandLevel('region-rescue', friend.id, regionRescueSpec(friend));
  if (mission.id !== regionFriendRescueId(friend.id)) throw new Error(`region rescue id drifted: ${mission.id}`);
  built.set(friend.id, mission);
  return mission;
}
