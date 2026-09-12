import type { MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/registry';
import {
  eggFeedBond, eggFeedOffer, hatchableEggHasBeenFed, hatchableEggProgress, hatchableEggReady, normalizeHatchableEgg, reduceHatchableEgg,
  type HatchableEggAction, type HatchableEggProgress,
} from './hatchable-egg-policy';

/**
 * Steppling's Egg, by its old names: the shared Egg policy called with his
 * definition. His copy lives in `constants/steppling-egg-copy.ts`.
 */
export {
  STEPPLING_EGG_GUIDES, STEPPLING_STEP_ACCESS_OPTIONS, STEPPLING_EGG_TARGET, STEPPLING_STEPS_PER_BOND,
  STEPPLING_INTENT_BOND, STEPPLING_MOVEMENT_BOND, STEPPLING_INTENT_OPTIONS, STEPPLING_MOVEMENT_OPTIONS,
} from '@/constants/steppling-egg-copy';
export { hatchableEggProgress };
export type StepplingEggProgress = HatchableEggProgress;
export type StepplingEggAction = HatchableEggAction;

export const stepplingStepsBond = (steps: number) => eggFeedBond(STEPPLING_HATCHABLE.egg, steps);
/** Round the cumulative total, not each tap, so partial feeds cannot farm Bond. */
export function stepplingStepFeedOffer(egg: StepplingEggProgress | undefined, observedSteps: number) {
  return eggFeedOffer(STEPPLING_HATCHABLE.egg, egg, observedSteps);
}
// A discovered Egg sleeps until a saved answer/feed gives it its first Bond.
export const stepplingEggHasBeenFed = hatchableEggHasBeenFed;
export const stepplingEggReady = (egg?: StepplingEggProgress) => hatchableEggReady(STEPPLING_HATCHABLE.egg, egg);

export function normalizeStepplingEgg(raw: StepplingEggProgress | undefined): StepplingEggProgress | undefined {
  return normalizeHatchableEgg(STEPPLING_HATCHABLE.egg, raw);
}

/** Steps are explicitly fed, never inferred from the legacy observed-step field. */
export function reduceStepplingEgg(state: MergeWorldState, action: StepplingEggAction, now: number): MergeWorldCommandResult {
  return reduceHatchableEgg(state, STEPPLING_HATCHABLE, action, now);
}
