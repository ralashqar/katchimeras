import type { HexCoord } from '@incubator/environments/hex';
import type { RescueBattleCopy } from '@/types/hatchable-companion';
import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';
import { HOLLOW_REACHES_HOMES, type RegionId } from './regions';

/**
 * A region's friends (`docs/regions-world-design.md`): the light way a friend joins in the wide world. A home on a
 * placed cell around the region's landmark, under the Mist until a Lanes rescue docked under it is won (its first
 * clear, `region-rescue:<friend>`, is the only record), their arrival scene, and a hero with an ability. No Egg, no
 * flow, no journal: the chapters say when (`region_rescue` goals).
 */
export type RegionFriend = {
  id: MergeCharacterId;
  name: string;
  region: RegionId;
  /** The home's structure id (the scene draws it as `structure:<tileId>`). */
  tileId: string;
  coord: HexCoord;
  home: { name: string; alphaBoundsKey: string };
  /** The light kept in the Mist while their chapter points there. */
  beaconColor: string;
  rescue: RescueBattleCopy;
};

export const REGION_RESCUE_PREFIX = 'region-rescue:';
export const regionFriendRescueId = (id: string) => `${REGION_RESCUE_PREFIX}${id}`;

export const DAWNLE_FRIEND: RegionFriend = {
  id: 'dawnle', name: 'Dawnle', region: 'hollow-reaches', tileId: 'region-dawnle', coord: HOLLOW_REACHES_HOMES.dawnle!,
  home: { name: 'the Lamp House', alphaBoundsKey: 'shared_world_dawnle_lamp_house_hex_tile_v1.webp' },
  beaconColor: '#FFC36B',
  rescue: {
    intro: { title: 'The Lamp Beyond', line: 'Past the Hollow Tree, someone has kept a lamp lit for a very long time. The wisps are drawn to it. Get there first.' },
    voice: 'Someone past the tree',
    hello: 'Is it morning yet? I keep the light on, just in case.',
    guard: 'That’s the lamp. Whoever it is, they’re right in the middle.',
    light: 'I can see you. Keep coming.',
    almost: 'Nearly. The Mist is thin now.',
    steer: 'Merge beside the thick Mist in the middle. Burn it off them.',
    arrival: {
      title: 'The Lamp Beyond', answer: 'Welcome home',
      lines: [
        { speaker: 'dawnle', text: 'You came. I kept the lamp on every night, in case someone would.' },
        { speaker: 'dawnle', text: 'Before the Mist, I woke the first light every morning. Then everyone forgot to get up.' },
        { speaker: 'mossprout', text: 'We remember now. The Hollow Tree does too.' },
        { speaker: 'dawnle', text: 'Then let me help. My First Light burns the Mist off anything it touches.' },
        { speaker: 'steppling', text: 'There are more homes past the tree. More lights, going out.' },
        { speaker: 'dawnle', text: 'Relicoon. Pagelet. Museling. They are out there. I can feel them.' },
      ],
    },
  },
};

export const REGION_FRIENDS: readonly RegionFriend[] = [DAWNLE_FRIEND];
const byId = new Map(REGION_FRIENDS.map((friend) => [friend.id, friend]));
const byTile = new Map(REGION_FRIENDS.map((friend) => [friend.tileId, friend]));
export const regionFriendById = (id: string): RegionFriend | null => byId.get(id) ?? null;
export const regionFriendByTile = (tileId: string): RegionFriend | null => byTile.get(tileId) ?? null;
export const regionFriendForMission = (missionId: string): RegionFriend | null => (missionId.startsWith(REGION_RESCUE_PREFIX) ? byId.get(missionId.slice(REGION_RESCUE_PREFIX.length)) ?? null : null);

/** Home: their rescue won. */
export function regionFriendHome(world: Pick<MergeWorldState, 'encounters'>, id: string): boolean {
  return Boolean(world.encounters?.clears?.[regionFriendRescueId(id)]);
}
