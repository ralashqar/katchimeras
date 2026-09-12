import { ensureStepplingGardenLesson } from '@/features/onboarding/steppling-garden-runtime';
import { stepplingGardenHandoffPending } from '@/utils/steppling-day-one-session';
import { LEGACY_STEPPLING_DAY_ONE_FLOW_V2 } from '@/features/content-flow/steppling-day-one-flow-v2';
import { recordLifeFlow } from '@/utils/companion-life-recording';
import { useCallback, useEffect, useRef, useState } from 'react';
import { STEPPLING_DAY_ONE_CONVERSATION_ID } from '@/constants/steppling-day-one-conversation';
import { loadCompanionContentState, saveCompanionContentState } from '@/utils/companion-content-storage';
import { loadMergeWorldState } from '@/utils/merge-world/repository';
import { localDayId } from '@/utils/world-identity';
import { bootstrapContentFlowCatalog } from '@/features/content-flow/content-flow-bootstrap';
import { startContentFlow, dispatchContentFlowCommand } from '@/features/content-flow/content-flow-director';
import { loadContentFlowRun, reduceContentFlowRunAtomically } from '@/features/content-flow/content-flow-repository';
import { STEPPLING_DAY_ONE_FLOW, STEPPLING_DAY_ONE_RUN_ID } from '@/features/content-flow/steppling-day-one-flow';
import { LEGACY_STEPPLING_DAY_ONE_FLOW } from '@/features/content-flow/steppling-day-one-flow-v1';
import { contentFlowDefinition } from '@/features/content-flow/content-flow-catalog';

export function acknowledgeStepplingDayOneGarden() {
  const state = loadCompanionContentState();
  if (!state.conversationSessions.some(stepplingGardenHandoffPending)) return;
  saveCompanionContentState({ ...state, conversationSessions: state.conversationSessions.map((session) =>
    stepplingGardenHandoffPending(session) ? { ...session, gardenHandoffAt: Date.now() } : session) });
}

/** Conversation owns presentation/answers; the journey journal owns its one-shot parcel effect. */
export async function settleStepplingDayOne() {
  const session = [...loadCompanionContentState().conversationSessions].reverse().find((candidate) =>
    candidate.definitionId === STEPPLING_DAY_ONE_CONVERSATION_ID && candidate.status === 'completed' && !candidate.preview);
  if (!session) return false;
  bootstrapContentFlowCatalog();
  let run = await loadContentFlowRun(STEPPLING_DAY_ONE_RUN_ID)
    ?? await startContentFlow(session.definitionVersion < 2 ? LEGACY_STEPPLING_DAY_ONE_FLOW : session.definitionVersion === 2 ? LEGACY_STEPPLING_DAY_ONE_FLOW_V2 : STEPPLING_DAY_ONE_FLOW, { runId: STEPPLING_DAY_ONE_RUN_ID, variables: { dayId: localDayId() } });
  if (session.definitionVersion >= 3 && run.definitionVersion < 3 && run.status !== 'completed') {
    const answer = [...session.turns].reverse().find((turn) => turn.nodeId === 'reflection')?.optionId;
    const migrated = await reduceContentFlowRunAtomically({ runId: run.runId, reduce: (current) => current.status === 'completed' || current.definitionVersion >= 3 ? current : {
      ...current, definitionVersion: 3, nodeId: current.nodeId === 'parcel' ? 'parcel' : answer ? `handoff.${answer}` : 'reflection',
      variables: { ...current.variables, ...(answer ? { movementChoice: answer } : {}) },
      phase: 'entering', status: 'active', error: null,
    } });
    if (migrated.run) run = migrated.run;
  }
  const definition = contentFlowDefinition(run.definitionId, run.definitionVersion)!;
  for (let guard = 0; guard < definition.nodes.length * 2 && run.status !== 'completed'; guard += 1) {
    const node = definition.nodes.find((candidate) => candidate.id === run.nodeId);
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
  if (stepplingGardenHandoffPending(session)) await ensureStepplingGardenLesson();
  return true;
}

export function useStepplingDayOne(enabled: boolean) {
  const [ready, setReady] = useState(!enabled);
  const [definitionId, setDefinitionId] = useState<string>();
  const [gardenHandoffPending, setGardenHandoffPending] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const pending = useRef<Promise<boolean> | null>(null);
  const complete = useCallback(() => {
    if (!enabled) return Promise.resolve(false);
    pending.current ??= settleStepplingDayOne().then((settled) => {
      if (settled) {
        setDefinitionId(undefined);
        setGardenHandoffPending(loadCompanionContentState().conversationSessions.some(stepplingGardenHandoffPending));
      }
      setError(false);
      return settled;
    }).catch((cause) => { setError(true); throw cause; }).finally(() => { pending.current = null; });
    return pending.current;
  }, [enabled]);
  useEffect(() => {
    if (!enabled) { setGardenHandoffPending(false); setReady(true); setDefinitionId(undefined); return; }
    let live = true;
    setReady(false); setError(false);
    void Promise.all([loadMergeWorldState(), loadContentFlowRun(STEPPLING_DAY_ONE_RUN_ID)]).then(async ([world, run]) => {
      if (!live) return;
      if (!world.stepplingEgg?.hatchedAt || run?.status === 'completed') {
        if (world.stepplingEgg?.hatchedAt && loadCompanionContentState().conversationSessions.some(stepplingGardenHandoffPending)) await ensureStepplingGardenLesson();
        setGardenHandoffPending(Boolean(world.stepplingEgg?.hatchedAt) && loadCompanionContentState().conversationSessions.some(stepplingGardenHandoffPending));
        setReady(true); return;
      }
      const settled = await complete();
      if (live) { setDefinitionId(settled ? undefined : STEPPLING_DAY_ONE_CONVERSATION_ID); setReady(true); }
    }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [complete, enabled, revision]);
  return { ready, definitionId, error, complete, gardenHandoffPending, retry: () => setRevision((value) => value + 1) };
}
