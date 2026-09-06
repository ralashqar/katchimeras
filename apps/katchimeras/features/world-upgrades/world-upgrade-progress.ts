import type { MergeWorldState } from '@/types/merge-world';
import { WORLD_UPGRADE_STORIES } from './world-upgrade-stories';

export function upgradeCompletedLevel(world: MergeWorldState, offerId: string): number {
  if (offerId === 'haven:mossprout') return world.haven.tileStages.mossprout ?? 0;
  if (offerId === 'mist:steppling-home') return world.worldUnlocks?.['mossprout:overgrown-trail'] ? 1 : 0;
  return world.haven.mossproutNatureIslands[offerId.slice('nature:'.length) as keyof typeof world.haven.mossproutNatureIslands] ?? 0;
}

/** Run inside normalization and the upgrade transaction: old saves and retries
 * get the same deterministic grants, never a second purchase or companion. */
export function reconcileUpgradeProgress(world: MergeWorldState): MergeWorldState {
  const upgradeStoryRead: Record<string, number> = {};
  const upgradeSkinGrants: NonNullable<MergeWorldState['upgradeSkinGrants']> = {};
  for (const story of WORLD_UPGRADE_STORIES) {
    const read = world.upgradeStoryRead?.[story.id];
    const completed = upgradeCompletedLevel(world, story.offerId) >= story.level;
    const available = completed || upgradeCompletedLevel(world, story.offerId) + 1 === story.level;
    if (available && typeof read === 'number' && Number.isFinite(read)) {
      upgradeStoryRead[story.id] = Math.max(0, Math.min(story.before.length + (completed ? story.after.length : 0), Math.floor(read)));
    }
    if (completed && story.rewardSkinId) {
      const prior = world.upgradeSkinGrants?.[story.id];
      upgradeSkinGrants[story.id] = { skinId: story.rewardSkinId,
        grantedAt: prior && Number.isFinite(prior.grantedAt) ? prior.grantedAt : world.updatedAt };
    }
  }
  return { ...world, upgradeStoryRead, upgradeSkinGrants };
}
