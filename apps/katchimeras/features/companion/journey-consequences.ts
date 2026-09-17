import { gameNow } from '@/utils/game-clock';
import { useEffect, useState } from 'react';
import type { ContentFlowRun } from '@/types/content-flow';
import { journeyEpisodeRecordId } from '@/constants/companion-journey-chapters/registry';
import { JOURNEY_MISSION_CLEAR_NODE_ID, JOURNEY_MISSION_CLEARED_EVENT, journeyConsequenceFlow } from '@/constants/companion-journey-chapters/consequence-flow';
import { JOURNEY_CONSEQUENCES, type ActiveJourneyMission, type JourneyConsequenceRuns } from './journey-consequence-state';
import { registerContentFlowDefinition } from '@/features/content-flow/content-flow-catalog';
import { dispatchContentFlowCommand, startContentFlow } from '@/features/content-flow/content-flow-director';
import { loadContentFlowRun, subscribeContentFlowJournal } from '@/features/content-flow/content-flow-repository';
import { relationshipProgressionRepository as repository } from '@/storage/repositories/relationship-progression-repository';

/**
 * The runtime of an episode's world consequence: its flow is started once the
 * episode is recorded, resumed after a relaunch, and read by the Kingdom so a
 * tile mission docks its board beneath the story tile. Nothing here names a
 * friend or a place; the chapters and the story tiles do.
 */
export { JOURNEY_CONSEQUENCES, activeJourneyMission, journeyMissionResumeCamera, type ActiveJourneyMission, type JourneyConsequenceEntry, type JourneyConsequenceRuns } from './journey-consequence-state';

let registered = false;
export function registerJourneyConsequenceFlows() {
  if (registered) return;
  registered = true;
  for (const { chapter, episode } of JOURNEY_CONSEQUENCES) {
    const flow = journeyConsequenceFlow(chapter, episode);
    if (flow) registerContentFlowDefinition(flow);
  }
}

const starts = new Map<string, Promise<ContentFlowRun | null>>();
/** Starts an episode's consequence once, or retries a saved one that failed; nothing to do once it completed. */
export function startJourneyConsequence(familyId: string, episodeId: string): Promise<ContentFlowRun | null> {
  const entry = JOURNEY_CONSEQUENCES.find((item) => item.chapter.familyId === familyId && item.episode.id === episodeId);
  if (!entry) return Promise.resolve(null);
  let pending = starts.get(entry.runId);
  if (!pending) {
    pending = (async () => {
      registerJourneyConsequenceFlows();
      const existing = await loadContentFlowRun(entry.runId);
      if (existing) return existing.status === 'failed_recoverable' ? dispatchContentFlowCommand(entry.runId, { type: 'retry' }) : existing;
      const flow = journeyConsequenceFlow(entry.chapter, entry.episode)!;
      return startContentFlow(flow, { runId: entry.runId });
    })().finally(() => { starts.delete(entry.runId); });
    starts.set(entry.runId, pending);
  }
  return pending;
}

/** After a relaunch: every recorded episode's consequence is started or retried; a completed one is left alone. */
export async function resumeJourneyConsequences() {
  const records = repository.load().journeyEpisodes ?? {};
  for (const entry of JOURNEY_CONSEQUENCES) {
    if (!records[journeyEpisodeRecordId(entry.chapter.familyId, entry.episode.id)]) continue;
    try { await startJourneyConsequence(entry.chapter.familyId, entry.episode.id); }
    catch (error) { console.warn('A journey consequence could not resume', error); }
  }
}

const EMPTY_RUNS: JourneyConsequenceRuns = { ready: false, runs: {} };

/** Every consequence run, refreshed on every journal write. */
export function useJourneyConsequenceRuns(): JourneyConsequenceRuns {
  const [runs, setRuns] = useState<JourneyConsequenceRuns>(EMPTY_RUNS);
  useEffect(() => {
    if (!JOURNEY_CONSEQUENCES.length) { setRuns({ ready: true, runs: {} }); return; }
    registerJourneyConsequenceFlows();
    let live = true; let revision = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      const request = ++revision;
      void Promise.all(JOURNEY_CONSEQUENCES.map(async (entry) => [entry.runId, await loadContentFlowRun(entry.runId)] as const))
        .then((entries) => { if (live && request === revision) setRuns({ ready: true, runs: Object.fromEntries(entries) }); })
        .catch(() => { if (live && request === revision) retry = setTimeout(refresh, 1000); });
    };
    refresh();
    const unsubscribe = subscribeContentFlowJournal(refresh);
    return () => { live = false; clearTimeout(retry); unsubscribe(); };
  }, []);
  return runs;
}

/** The board filled its bar: the consequence moves on to the reveal. The event id is scoped to the visit, so a replay on a later revisit is not ignored as a duplicate. */
export async function completeJourneyMission(mission: ActiveJourneyMission) {
  const run = await loadContentFlowRun(mission.runId);
  if (!run || !run.nodeId.endsWith(JOURNEY_MISSION_CLEAR_NODE_ID) || run.status !== 'active') return run;
  return dispatchContentFlowCommand(run.runId, { type: 'record_event', event: {
    eventId: `${run.runId}:${run.nodeId}:cleared:${run.revision}`, type: JOURNEY_MISSION_CLEARED_EVENT, runId: run.runId, nodeId: run.nodeId, payload: {}, occurredAt: gameNow(),
  } });
}
