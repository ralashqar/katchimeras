import type { ContentFlowRun } from '@/types/content-flow';
import type { MergeWorldState } from '@/types/merge-world';
import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/registry';
import { GLOW } from '@/constants/glow';
import { hatchableGatewayState } from '@/utils/merge-world/glow-discovery-policy';
import { grantStoredStoryGlow, loadMergeWorldState } from '@/utils/merge-world/repository';
import {
  acknowledgeHatchableEggEntry, completeHatchableMission, migrateHatchableEggHandoff, reconcileHatchableLesson, recoverHatchableEggHandoff,
  startHatchableDiscovery, submitHatchableAction, useHatchableRuns,
} from './hatchable-runtime';

/**
 * Steppling's discovery, by his old names: every function here is the
 * shared hatchable runtime called with his definition. New friends use the
 * runtime directly with theirs.
 */
/** Once per save: the Glow Steppling's mist costs, handed over as his clearing opens (no Merge page to earn it on). */
export const STEPPLING_MIST_GLOW_RECEIPT = 'story-glow:steppling-mist';

export async function grantStepplingMistGlow() {
  const world = await loadMergeWorldState();
  // A mist already cleared (or a friend already home) never pays out again.
  if (hatchableGatewayState(world, STEPPLING_HATCHABLE) !== 'locked') return world;
  return (await grantStoredStoryGlow(STEPPLING_MIST_GLOW_RECEIPT, GLOW.stepplingMistCost)).state;
}

export async function startGlowDiscovery() {
  await grantStepplingMistGlow();
  return startHatchableDiscovery(STEPPLING_HATCHABLE);
}

export function useGlowDiscoveryState() {
  const runs = useHatchableRuns();
  return { run: runs.discovery[STEPPLING_HATCHABLE.companion] ?? null, ready: runs.ready };
}

export function useGlowDiscovery() {
  return useGlowDiscoveryState().run;
}

export async function submitGlowAction(actionId: string) {
  return submitHatchableAction(STEPPLING_HATCHABLE, actionId);
}

/** Recover from domain facts after a process kill between board persistence and event delivery. */
export async function reconcileGlowLesson(world: MergeWorldState) {
  return reconcileHatchableLesson(STEPPLING_HATCHABLE, world);
}

/** An accepted reveal from an old save still needs to deliver the encounter. */
export function migrateGlowEggHandoff(run: ContentFlowRun, world: MergeWorldState): ContentFlowRun {
  return migrateHatchableEggHandoff(STEPPLING_HATCHABLE, run, world);
}

export async function recoverGlowEggHandoff(world: MergeWorldState) {
  return recoverHatchableEggHandoff(STEPPLING_HATCHABLE, world);
}

export async function completeStepplingMission() {
  return completeHatchableMission(STEPPLING_HATCHABLE);
}

export async function acknowledgeGlowEggEntry() {
  return acknowledgeHatchableEggEntry(STEPPLING_HATCHABLE);
}
