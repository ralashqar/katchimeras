import { useEffect, useState } from 'react';
import { loadMergeWorldState } from '@/utils/merge-world/repository';
import { dispatchContentFlowCommand, startContentFlow } from '@/features/content-flow/content-flow-director';
import { listContentFlowRuns, loadContentFlowRun, subscribeContentFlowJournal } from '@/features/content-flow/content-flow-repository';
import type { ContentFlowRun } from '@/types/content-flow';
import { worldUpgradeOffers, type WorldUpgradeOffer } from './world-upgrade-offers';
import { WORLD_UPGRADE_FLOWS, worldUpgradeRunId } from './world-upgrade-flows';

let purchasing: Promise<ContentFlowRun | null> | null = null;
export function purchaseWorldUpgrade(offer: WorldUpgradeOffer) {
  if (purchasing) return purchasing;
  purchasing = (async () => {
    const runId = worldUpgradeRunId(offer);
    const existing = await loadContentFlowRun(runId);
    if (existing) return existing.status === 'completed' ? existing : dispatchContentFlowCommand(runId, { type: 'retry' });
    const unfinished = (await listContentFlowRuns()).find((run) => run.runId.startsWith('world-upgrade:') && run.status !== 'completed');
    if (unfinished) throw new Error('Finish the current upgrade before starting another.');
    const world = await loadMergeWorldState();
    const fresh = worldUpgradeOffers(world).find((candidate) => candidate.id === offer.id && candidate.nextLevel === offer.nextLevel);
    if (!fresh?.eligible) throw new Error('This upgrade is no longer available.');
    if (!fresh.affordable) throw new Error(`Earn ${fresh.missingGlow} more Glow in the Garden.`);
    const definition = WORLD_UPGRADE_FLOWS.find((candidate) => candidate.id === runId)!;
    return startContentFlow(definition, { runId });
  })().finally(() => { purchasing = null; });
  return purchasing;
}

export function useWorldUpgradeRun(runId?: string) {
  const [run, setRun] = useState<ContentFlowRun | null>(null);
  useEffect(() => {
    let active = true; let revision = 0;
    const refresh = () => {
      const request = ++revision;
      void listContentFlowRuns().then((runs) => {
        if (active && request === revision) setRun(runs.find((candidate) => (runId ? candidate.runId === runId : candidate.runId.startsWith('world-upgrade:')) && candidate.status !== 'completed') ?? null);
      }).catch(() => {});
    };
    refresh(); const unsubscribe = subscribeContentFlowJournal(refresh);
    return () => { active = false; unsubscribe(); };
  }, [runId]);
  return run;
}
