import type { ContentFlowRun } from '@/types/content-flow';
import type { MergeWorldState } from '@/types/merge-world';
import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/registry';
import { advanceHatchableUpgrade, recoverPaidHatchableUpgrade } from './hatchable-runtime';

/** Steppling's mist upgrade, by its old names: the shared hatchable runtime with his definition. */
export function advanceGlowUpgrade(action: 'open' | 'confirm'): Promise<ContentFlowRun> {
  return advanceHatchableUpgrade(STEPPLING_HATCHABLE, action);
}

export async function recoverPaidGlowUpgrade(world: MergeWorldState) {
  return recoverPaidHatchableUpgrade(STEPPLING_HATCHABLE, world);
}
