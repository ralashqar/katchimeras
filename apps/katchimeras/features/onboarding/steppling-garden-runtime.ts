import type { MergeWorldState } from '@/types/merge-world';
import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/registry';
import { advanceGardenFinale, ensureGardenLesson, gardenLessonFor, reconcileGardenLesson, useHatchableRuns } from './hatchable-runtime';

/** Steppling's garden lesson, by his old names: the shared hatchable runtime with his definition. */
export function ensureStepplingGardenLesson() {
  return ensureGardenLesson(STEPPLING_HATCHABLE);
}
export function useStepplingGardenLesson() {
  return gardenLessonFor(useHatchableRuns(), STEPPLING_HATCHABLE);
}
export async function reconcileStepplingGarden(state: MergeWorldState) {
  return reconcileGardenLesson(STEPPLING_HATCHABLE, state);
}
export function advanceStepplingFinale(actionId: 'summary' | 'finish') {
  return advanceGardenFinale(STEPPLING_HATCHABLE, actionId);
}
