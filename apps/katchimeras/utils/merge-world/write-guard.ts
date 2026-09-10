import type { MergeWorldState } from '@/types/merge-world';

/**
 * A provider save is only valid while the database still holds the snapshot
 * the provider derived its state from. Anything else on disk was written by
 * another writer since, and overwriting it would revert that writer's change
 * on the next launch. The rejected save hands back the newer snapshot so the
 * provider can adopt it instead of retrying the stale write.
 */
export class MergeWorldStaleWriteError extends Error {
  constructor(readonly current: MergeWorldState) {
    super('The Merge world changed on disk since this state was derived');
    this.name = 'MergeWorldStaleWriteError';
  }
}

/** Disk moved past the base this state was derived from. */
export function mergeWriteIsStale(diskRevision: number | null | undefined, baseRevision: number | undefined): boolean {
  if (baseRevision == null || diskRevision == null || !Number.isFinite(diskRevision)) return false;
  return diskRevision > baseRevision;
}
