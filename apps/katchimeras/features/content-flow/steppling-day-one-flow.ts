import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/steppling';
import { hatchableFlows } from '@/features/onboarding/hatchable-flows';

/** Steppling's day one, generated from his hatchable definition; the names here are the ones his saves use. */
export const STEPPLING_DAY_ONE_RUN_ID = STEPPLING_HATCHABLE.dayOne.flow.runId;
export const STEPPLING_PARCEL_REWARD_ID = STEPPLING_HATCHABLE.dayOne.parcel.rewardId;
export const STEPPLING_DAY_ONE_FLOW = hatchableFlows(STEPPLING_HATCHABLE).dayOne;
