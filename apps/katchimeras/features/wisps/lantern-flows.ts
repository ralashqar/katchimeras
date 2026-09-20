import { registerStoryCapability } from '@/features/content-flow/story-capability-registry';
import { registerContentFlowDefinition } from '@/features/content-flow/content-flow-catalog';
import { registerContentFlowEffect, type ContentFlowEffectHandler } from '@/features/content-flow/content-flow-capabilities';
import { activateStoredWispLantern, loadMergeWorldState } from '@/utils/merge-world/repository';
import { commandWispLantern, loadWispState } from '@/utils/wisp-storage';
import { welcomeLanternPack } from '@/utils/wisp-lantern-state';
import { LANTERN_INTRO } from './lantern-definition';
import { lanternEligible } from './lantern-world';
const light: ContentFlowEffectHandler = async () => {
  const world = await loadMergeWorldState();
  if (!world.wispLanternPlacement) throw new Error('Plant the Lantern in its patch first.');
  if (!lanternEligible(world)) throw new Error('Share Feastle’s first Snack and meet Heartwood first.');
  commandWispLantern({ type: 'unlock' });
  return { lit: true };
};
const finish: ContentFlowEffectHandler = async () => {
  const welcome = welcomeLanternPack(loadWispState());
  if (!welcome?.outcomes || welcome.revealed < welcome.outcomes.length) throw new Error('Meet your visitors first.');
  await activateStoredWispLantern();
  commandWispLantern({ type: 'complete_intro' });
  return { introduced: true };
};
export function registerLanternFlows() {
  registerStoryCapability({ id: 'wisp.lantern.scene', kind: 'scene' });
  for (const id of ['wisp.lantern.light', 'wisp.lantern.finish']) registerStoryCapability({ id, kind: 'effect', idempotent: true });
  registerContentFlowDefinition(LANTERN_INTRO);
  registerContentFlowEffect('wisp.lantern.light', light);
  registerContentFlowEffect('wisp.lantern.finish', finish);
}
