import type { ContentFlowCommand, ContentFlowRun } from '@/types/content-flow';
import type { MergeWorldState } from '@/types/merge-world';
import { loadContentFlowRun } from '@/features/content-flow/content-flow-repository';
import { dispatchContentFlowCommand } from '@/features/content-flow/content-flow-director';
import { GLOW_DISCOVERY_RUN_ID } from './glow-discovery-flow';
import { GLOW_GATEWAY_ID } from '@/utils/merge-world/glow-discovery-policy';

let queue: Promise<unknown> = Promise.resolve();
/** The shared panel must advance the saved story, never start an ordinary purchase. */
export function advanceGlowUpgrade(action: 'open' | 'confirm'): Promise<ContentFlowRun> {
  const operation = queue.then(async () => {
    let run = await loadContentFlowRun(GLOW_DISCOVERY_RUN_ID);
    if (!run) throw new Error('The mist story could not load. Please try again.');
    const dispatch = async (command: ContentFlowCommand) => {
      const next = await dispatchContentFlowCommand(GLOW_DISCOVERY_RUN_ID, command);
      if (!next || next.status === 'failed_recoverable') throw new Error(next?.error ?? 'The mist upgrade paused. Please try again.');
      if (command.type === 'submit_scene' && next.nodeId === run!.nodeId) throw new Error('The upgrade did not advance. Please try again.');
      run = next;
    };
    if (run.status === 'failed_recoverable' || run.nodeId === 'gateway.return') await dispatch({ type: 'retry' });
    if (run.nodeId === 'gateway.ready') await dispatch({ type: 'submit_scene', actionId: 'return' });
    if (run.nodeId === 'gateway.offer') await dispatch({ type: 'submit_scene', actionId: 'open_upgrade' });
    if (action === 'confirm' && run.nodeId === 'gateway.buy') await dispatch({ type: 'submit_scene', actionId: 'unlock' });
    if (run.nodeId !== 'gateway.buy' && !run.nodeId.startsWith('gateway.purchase.')
      && !['gateway.egg', 'egg.enter', 'complete'].includes(run.nodeId)) {
      throw new Error('Finish the Garden request before clearing this mist.');
    }
    return run;
  });
  queue = operation.catch(() => undefined);
  return operation;
}

/** Repair only an already purchased clearing; never buy automatically. The
 * existing unlock makes the original receipt-backed effect charge zero again. */
export async function recoverPaidGlowUpgrade(world: MergeWorldState) {
  if (!world.worldUnlocks?.[GLOW_GATEWAY_ID]) return null;
  const run = await loadContentFlowRun(GLOW_DISCOVERY_RUN_ID);
  if (!run || run.status === 'completed' || !['gateway.ready', 'gateway.return', 'gateway.offer', 'gateway.buy'].includes(run.nodeId)) return null;
  return advanceGlowUpgrade('confirm');
}
