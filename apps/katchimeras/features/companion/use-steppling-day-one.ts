import { ensureGardenLesson, hatchableForCompanion } from '@/features/onboarding/hatchable-runtime';
import { gardenHandoffPendingFor } from '@/utils/steppling-day-one-session';
import { LEGACY_STEPPLING_DAY_ONE_FLOW_V2 } from '@/features/content-flow/steppling-day-one-flow-v2';
import { recordLifeFlow } from '@/utils/companion-life-recording';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadCompanionContentState, saveCompanionContentState } from '@/utils/companion-content-storage';
import { loadMergeWorldState } from '@/utils/merge-world/repository';
import { localDayId } from '@/utils/world-identity';
import { bootstrapContentFlowCatalog } from '@/features/content-flow/content-flow-bootstrap';
import { startContentFlow, dispatchContentFlowCommand } from '@/features/content-flow/content-flow-director';
import { loadContentFlowRun, reduceContentFlowRunAtomically } from '@/features/content-flow/content-flow-repository';
import { LEGACY_STEPPLING_DAY_ONE_FLOW } from '@/features/content-flow/steppling-day-one-flow-v1';
import { contentFlowDefinition } from '@/features/content-flow/content-flow-catalog';
import { hatchableFlows } from '@/features/onboarding/hatchable-flows';
import { hatchableEggProgress } from '@/features/onboarding/steppling-egg-policy';
import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/registry';
import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import type { ContentFlowDefinition } from '@/types/content-flow';

/**
 * A hatchable companion's day one: the first conversation's answers replayed
 * into its journey flow, whose last node hands over the spawner parcel. The
 * conversation owns presentation and answers; the journey journal owns its
 * one-shot parcel effect. Everything is keyed by the companion's definition.
 */

/** Released flows a companion's older conversation sessions may still be on. Steppling shipped two before the definition existed. */
const LEGACY_DAY_ONE_FLOWS: Partial<Record<string, readonly ContentFlowDefinition[]>> = {
  steppling: [LEGACY_STEPPLING_DAY_ONE_FLOW, LEGACY_STEPPLING_DAY_ONE_FLOW_V2],
};

export function acknowledgeHatchableDayOneGarden(definition: HatchableCompanionDefinition) {
  const state = loadCompanionContentState();
  const pending = (session: Parameters<typeof gardenHandoffPendingFor>[0]) => gardenHandoffPendingFor(session, definition.dayOne.conversationId);
  if (!state.conversationSessions.some(pending)) return;
  saveCompanionContentState({ ...state, conversationSessions: state.conversationSessions.map((session) =>
    pending(session) ? { ...session, gardenHandoffAt: Date.now() } : session) });
}
export function acknowledgeStepplingDayOneGarden() {
  return acknowledgeHatchableDayOneGarden(STEPPLING_HATCHABLE);
}

export async function settleHatchableDayOne(definition: HatchableCompanionDefinition) {
  const { conversationId } = definition.dayOne;
  const { runId } = definition.dayOne.flow;
  const flow = hatchableFlows(definition).dayOne;
  const legacy = LEGACY_DAY_ONE_FLOWS[definition.companion] ?? [];
  const session = [...loadCompanionContentState().conversationSessions].reverse().find((candidate) =>
    candidate.definitionId === conversationId && candidate.status === 'completed' && !candidate.preview);
  if (!session) return false;
  bootstrapContentFlowCatalog();
  const flowForSession = legacy.find((candidate) => candidate.version === session.definitionVersion) ?? flow;
  let run = await loadContentFlowRun(runId)
    ?? await startContentFlow(session.definitionVersion < flow.version ? flowForSession : flow, { runId, variables: { dayId: localDayId() } });
  if (session.definitionVersion >= flow.version && run.definitionVersion < flow.version && run.status !== 'completed') {
    const answer = [...session.turns].reverse().find((turn) => turn.nodeId === 'reflection')?.optionId;
    const migrated = await reduceContentFlowRunAtomically({ runId: run.runId, reduce: (current) => current.status === 'completed' || current.definitionVersion >= flow.version ? current : {
      ...current, definitionVersion: flow.version, nodeId: current.nodeId === 'parcel' ? 'parcel' : answer ? `handoff.${answer}` : 'reflection',
      variables: { ...current.variables, ...(answer ? { [definition.dayOne.choiceVariable]: answer } : {}) },
      phase: 'entering', status: 'active', error: null,
    } });
    if (migrated.run) run = migrated.run;
  }
  const flowDefinition = contentFlowDefinition(run.definitionId, run.definitionVersion)!;
  for (let guard = 0; guard < flowDefinition.nodes.length * 2 && run.status !== 'completed'; guard += 1) {
    const node = flowDefinition.nodes.find((candidate) => candidate.id === run.nodeId);
    // A process can stop after the closing answer was saved but before its
    // parcel effect ran. Resume that effect too, not only explicit failures.
    if (run.status === 'failed_recoverable' || node?.kind === 'effect') {
      const retried = await dispatchContentFlowCommand(run.runId, { type: 'retry' });
      if (!retried) throw new Error('Journey could not be restored');
      run = retried;
      if (run.status === 'failed_recoverable') throw new Error('Journey reward could not save');
      continue;
    }
    if (node?.kind !== 'scene') throw new Error('Journey reward is still pending');
    const answer = [...session.turns].reverse().find((turn) => turn.nodeId === node.id)?.optionId;
    const actionId = answer ?? (node.actions?.length === 1 ? node.actions[0].id : '');
    if (!node.actions?.some((action) => action.id === actionId)) throw new Error('Journey answer is missing');
    const advanced = await dispatchContentFlowCommand(run.runId, { type: 'submit_scene', actionId });
    if (!advanced) throw new Error('Journey could not be restored');
    run = advanced;
  }
  if (run.status !== 'completed') throw new Error('Journey reward is still pending');
  recordLifeFlow(run);
  if (gardenHandoffPendingFor(session, conversationId)) await ensureGardenLesson(definition);
  return true;
}
export function settleStepplingDayOne() {
  return settleHatchableDayOne(STEPPLING_HATCHABLE);
}

export function useHatchableDayOne(definition: HatchableCompanionDefinition | null, enabled: boolean) {
  const on = enabled && definition != null;
  const [ready, setReady] = useState(!on);
  const [definitionId, setDefinitionId] = useState<string>();
  const [gardenHandoffPending, setGardenHandoffPending] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const pending = useRef<Promise<boolean> | null>(null);
  const conversationId = definition?.dayOne.conversationId;
  const handoffPending = useCallback(() => Boolean(conversationId) && loadCompanionContentState().conversationSessions.some((session) => gardenHandoffPendingFor(session, conversationId!)), [conversationId]);
  const complete = useCallback(() => {
    if (!on || !definition) return Promise.resolve(false);
    pending.current ??= settleHatchableDayOne(definition).then((settled) => {
      if (settled) {
        setDefinitionId(undefined);
        setGardenHandoffPending(handoffPending());
      }
      setError(false);
      return settled;
    }).catch((cause) => { setError(true); throw cause; }).finally(() => { pending.current = null; });
    return pending.current;
  }, [definition, handoffPending, on]);
  useEffect(() => {
    if (!on || !definition) { setGardenHandoffPending(false); setReady(true); setDefinitionId(undefined); return; }
    let live = true;
    setReady(false); setError(false);
    void Promise.all([loadMergeWorldState(), loadContentFlowRun(definition.dayOne.flow.runId)]).then(async ([world, run]) => {
      if (!live) return;
      const hatched = Boolean(hatchableEggProgress(world, definition)?.hatchedAt);
      if (!hatched || run?.status === 'completed') {
        if (hatched && handoffPending()) await ensureGardenLesson(definition);
        setGardenHandoffPending(hatched && handoffPending());
        setReady(true); return;
      }
      const settled = await complete();
      if (live) { setDefinitionId(settled ? undefined : definition.dayOne.conversationId); setReady(true); }
    }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [complete, definition, handoffPending, on, revision]);
  return { ready, definitionId, error, complete, gardenHandoffPending, retry: () => setRevision((value) => value + 1) };
}

export function useStepplingDayOne(enabled: boolean) {
  return useHatchableDayOne(STEPPLING_HATCHABLE, enabled);
}

export { hatchableForCompanion };
