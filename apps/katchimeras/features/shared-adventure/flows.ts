import { registerStoryCapability } from '@/features/content-flow/story-capability-registry';
import { registerContentFlowDefinition } from '@/features/content-flow/content-flow-catalog';
import { registerContentFlowEffect } from '@/features/content-flow/content-flow-capabilities';
import { applyStoredAdventure } from '@/utils/merge-world/repository';
import { ADVENTURE_FLOWS } from './definitions';
import type { AdventureBeatId, SignalPromise } from './types';
export { ADVENTURE_FLOWS } from './definitions';


export function registerAdventureFlows() {
  registerStoryCapability({ id: 'shared.adventure.scene', kind: 'scene' });
  registerStoryCapability({ id: 'shared.adventure.commit', kind: 'effect', idempotent: true });
  ADVENTURE_FLOWS.forEach(registerContentFlowDefinition);
  registerContentFlowEffect('shared.adventure.commit', async ({ run, payload }) => {
    const result = await applyStoredAdventure({ type: 'acknowledge', beatId: payload.beatId as AdventureBeatId, promise: run.variables.promise as SignalPromise | undefined });
    return { revision: result.state.revision };
  });
}
