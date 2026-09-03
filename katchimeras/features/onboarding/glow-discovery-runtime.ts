import { useEffect, useState } from 'react';
import { startContentFlow, dispatchContentFlowCommand } from '@/features/content-flow/content-flow-director';
import { loadContentFlowRun, subscribeContentFlowJournal } from '@/features/content-flow/content-flow-repository';
import type { ContentFlowRun } from '@/types/content-flow';
import type { MergeWorldState } from '@/types/merge-world';
import { loadMergeWorldState } from '@/utils/merge-world/repository';
import { GLOW_DISCOVERY_FLOW, GLOW_DISCOVERY_RUN_ID, glowDiscoveryLessonReady } from './glow-discovery-flow';

let pending: Promise<ContentFlowRun | null> | null = null;
export function startGlowDiscovery() {
  pending ??= (async () => {
    const world = await loadMergeWorldState();
    const existing = await loadContentFlowRun(GLOW_DISCOVERY_RUN_ID);
    if (existing) return dispatchContentFlowCommand(existing.runId, { type: 'retry' });
    if (world.companionDiscovery.records.some((record) => record.characterId === 'steppling')) return null;
    return startContentFlow(GLOW_DISCOVERY_FLOW, { runId: GLOW_DISCOVERY_RUN_ID });
  })().finally(() => { pending = null; });
  return pending;
}

export function useGlowDiscovery() {
  const [run, setRun] = useState<ContentFlowRun | null>(null);
  useEffect(() => {
    let alive = true;
    let revision = 0;
    const refresh = () => {
      const request = ++revision;
      void loadContentFlowRun(GLOW_DISCOVERY_RUN_ID).then((next) => { if (alive && request === revision) setRun(next); }).catch(() => { /* Keep the last durable view; the next journal event retries. */ });
    };
    refresh();
    const unsubscribe = subscribeContentFlowJournal(refresh);
    return () => { alive = false; unsubscribe(); };
  }, []);
  return run;
}

export async function submitGlowAction(actionId: string) {
  return dispatchContentFlowCommand(GLOW_DISCOVERY_RUN_ID, { type: 'submit_scene', actionId });
}

/** Recover from domain facts after a process kill between board persistence and event delivery. */
export async function reconcileGlowLesson(world: MergeWorldState) {
  const run = await loadContentFlowRun(GLOW_DISCOVERY_RUN_ID);
  if (!run || run.status !== 'active' || !world.glowDiscoveryLesson) return;
  if (!glowDiscoveryLessonReady(run.nodeId, world)) return;
  await dispatchContentFlowCommand(run.runId, { type: 'record_event', event: {
    eventId: `${run.runId}:${run.nodeId}:domain-complete`, type: `glow.${run.nodeId}`, runId: run.runId, nodeId: run.nodeId, payload: {}, occurredAt: Date.now(),
  } });
}
