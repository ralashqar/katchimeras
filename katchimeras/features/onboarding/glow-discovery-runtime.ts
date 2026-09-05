import { useEffect, useState } from 'react';
import { startContentFlow, dispatchContentFlowCommand } from '@/features/content-flow/content-flow-director';
import { loadContentFlowRun, reduceContentFlowRunAtomically, subscribeContentFlowJournal } from '@/features/content-flow/content-flow-repository';
import type { ContentFlowRun } from '@/types/content-flow';
import type { MergeWorldState } from '@/types/merge-world';
import { glowGatewayState } from '@/utils/merge-world/glow-discovery-policy';
import { loadMergeWorldState } from '@/utils/merge-world/repository';
import { GLOW_DISCOVERY_FLOW, GLOW_DISCOVERY_RUN_ID, glowDiscoveryLessonReady } from './glow-discovery-flow';

let pending: Promise<ContentFlowRun | null> | null = null;
export function startGlowDiscovery() {
  pending ??= (async () => {
    const world = await loadMergeWorldState();
    const existing = await loadContentFlowRun(GLOW_DISCOVERY_RUN_ID);
    if (existing) {
      const recovered = await reduceContentFlowRunAtomically({ runId: existing.runId, reduce: (run) => migrateGlowEggHandoff(run, world) });
      if (recovered.run?.status === 'completed') return recovered.run;
      return dispatchContentFlowCommand(existing.runId, { type: 'retry' });
    }
    if (world.companionDiscovery.records.some((record) => record.characterId === 'steppling')) return null;
    return startContentFlow(GLOW_DISCOVERY_FLOW, { runId: GLOW_DISCOVERY_RUN_ID });
  })().finally(() => { pending = null; });
  return pending;
}

export function useGlowDiscoveryState() {
  const [state, setState] = useState<{ run: ContentFlowRun | null; ready: boolean }>({ run: null, ready: false });
  useEffect(() => {
    let alive = true;
    let revision = 0;
    const refresh = () => {
      const request = ++revision;
      void loadContentFlowRun(GLOW_DISCOVERY_RUN_ID).then((next) => { if (alive && request === revision) setState({ run: next, ready: true }); }).catch(() => {
        if (alive && request === revision) setState((previous) => ({ ...previous, ready: true }));
      });
    };
    refresh();
    const unsubscribe = subscribeContentFlowJournal(refresh);
    return () => { alive = false; unsubscribe(); };
  }, []);
  return state;
}

export function useGlowDiscovery() {
  return useGlowDiscoveryState().run;
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

/** An accepted reveal from an old save still needs to deliver the encounter. */
export function migrateGlowEggHandoff(run: ContentFlowRun, world: MergeWorldState): ContentFlowRun {
  if (run.definitionVersion >= 5 || run.status !== 'completed') return run;
  if (world.stepplingEgg || world.companionDiscovery.records.some((record) => record.characterId === 'steppling') || glowGatewayState(world) !== 'egg') return run;
  return { ...run, definitionVersion: GLOW_DISCOVERY_FLOW.version, status: 'active', completedAt: null, nodeId: 'egg.enter', phase: 'entering', error: null, updatedAt: Date.now() };
}

export async function recoverGlowEggHandoff(world: MergeWorldState) {
  const result = await reduceContentFlowRunAtomically({ runId: GLOW_DISCOVERY_RUN_ID, reduce: (run) => migrateGlowEggHandoff(run, world) });
  if (result.run?.nodeId === 'egg.enter' && result.run.status !== 'completed') {
    await dispatchContentFlowCommand(GLOW_DISCOVERY_RUN_ID, { type: 'retry' });
    if (world.stepplingEgg?.hatchedAt || world.companionDiscovery.records.some((record) => record.characterId === 'steppling')) await acknowledgeGlowEggEntry();
  }
}

export async function acknowledgeGlowEggEntry() {
  const run = await loadContentFlowRun(GLOW_DISCOVERY_RUN_ID);
  if (!run || run.nodeId !== 'egg.enter' || run.status === 'completed') return;
  const next = await dispatchContentFlowCommand(run.runId, { type: 'record_event', event: {
    eventId: `${run.runId}:egg.enter:ready`, type: 'glow.egg.entered', runId: run.runId, nodeId: 'egg.enter', payload: {}, occurredAt: Date.now(),
  } });
  if (next?.status !== 'completed') throw new Error('Could not save the egg handoff');
}
