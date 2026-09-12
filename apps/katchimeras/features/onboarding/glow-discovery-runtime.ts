import type { ContentFlowRun } from '@/types/content-flow';
import type { MergeWorldState } from '@/types/merge-world';
import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/registry';
import {
  acknowledgeHatchableEggEntry, completeHatchableMission, migrateHatchableEggHandoff, reconcileHatchableLesson, recoverHatchableEggHandoff,
  startHatchableDiscovery, submitHatchableAction, useHatchableRuns,
} from './hatchable-runtime';

/**
 * Steppling's discovery, by his old names: every function here is the
 * shared hatchable runtime called with his definition. New friends use the
 * runtime directly with theirs.
 */
export function startGlowDiscovery() {
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
