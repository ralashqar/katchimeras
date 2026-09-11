import type { MergeWorldState } from '@/types/merge-world';

/**
 * Whether a stored world was built on the current Mossprout campaign already.
 * The campaign migration is a destructive one-time reset for worlds from
 * before it; it must never run on a world that only lacks its marker (a dev
 * reset cleared storage, a snapshot was loaded, a fresh install). Anything the
 * new campaign writes is proof: the Kingdom wish, an island story, a cleared
 * mist, the Glow or Steppling lessons, a grown island. A brand-new world has
 * nothing to migrate either.
 */
export function worldAlreadyOnMossproutCampaignV2(world: MergeWorldState): boolean {
  if (world.revision === 0) return true;
  if (world.kingdomGoal?.introducedAt) return true;
  if (world.islandCampaigns && Object.keys(world.islandCampaigns).length > 0) return true;
  if (world.worldUnlocks && Object.keys(world.worldUnlocks).length > 0) return true;
  if (world.glowDiscoveryLesson || world.stepplingGardenLesson) return true;
  if (Object.keys(world.haven.mossproutNatureIslandReveals ?? {}).length > 0) return true;
  if (Object.values(world.haven.mossproutNatureIslands ?? {}).some((level) => (level ?? 0) > 0)) return true;
  return false;
}
