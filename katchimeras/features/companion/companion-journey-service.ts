import { STEPPLING_CHAPTER_ID, STEPPLING_JOURNEY_DAYS, stepplingEpisodeFlow, stepplingEpisodeId } from '@/constants/steppling-journey-campaign';
import { MOSSPROUT_CAMPAIGN_EPISODES } from '@/constants/mossprout-campaign';
import { beginJourneyReturnPresentation, completeMeditationRequest, createJourneyCycle, currentJourneyCycle, finishJourneyReturn, installJourneyCycle, journeyCycleReady, observeJourneySteps, observeJourneyStepWindow } from '@/game/katchimeras/companion-journey-cycle';
import { relationshipProgressionRepository as repository } from '@/storage/repositories/relationship-progression-repository';
import { homeRepository } from '@/storage/repositories/home-repository';
import { beginAuthoredCohortStory, loadAuthoredCohortStory, saveAuthoredCohortStory } from '@/utils/companion-story-storage';
import { grantStoredJourneyReturn, loadMergeWorldState, reconcileStoredJourneyMeditation } from '@/utils/merge-world/repository';
import { localDayId } from '@/utils/world-identity';
import type { JourneyParticipation } from '@/types/companion-journey-cycle';
import type { ContentFlowRun, ContentFlowDefinition } from '@/types/content-flow';
import { registerContentFlowEffect } from '@/features/content-flow/content-flow-capabilities';
import { registerContentFlowDefinition } from '@/features/content-flow/content-flow-catalog';
import { dispatchContentFlowCommand, publishContentFlowDomainEvent, startContentFlow } from '@/features/content-flow/content-flow-director';
import { loadContentFlowRun } from '@/features/content-flow/content-flow-repository';
import { STEPPLING_DAY_ONE_RUN_ID } from '@/features/content-flow/steppling-day-one-flow';
import { legacyStepplingEpisodeFlow } from '@/constants/steppling-journey-campaign-v1';
import { acceptDailyStoryHabit } from '@/utils/companion-life-storage';
import { recordLifeFlow } from '@/utils/companion-life-recording';
import { selectedStoryHabit } from '@/utils/companion-life';
import { loadCompanionQuickGoalState, saveCompanionQuickGoalState } from '@/utils/companion-quick-goal-storage';
import { updateCompanionQuickGoal } from '@/utils/companion-quick-goals';

export const journeyCycleId = (familyId: string, episodeId: string) => `journey-cycle:${familyId}:${episodeId}`;
const inFlight = new Map<string, Promise<unknown>>();
const lastStepQuery = new Map<string, number>();
function serialize<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = inFlight.get(key) ?? Promise.resolve();
  const promise = previous.catch(() => undefined).then(work);
  inFlight.set(key, promise);
  void promise.finally(() => { if (inFlight.get(key) === promise) inFlight.delete(key); }).catch(() => undefined);
  return promise;
}

function stepBaselines() {
  const home = homeRepository.load();
  return Object.fromEntries(home ? [home.today, ...home.archivedDays].map((day) => [day.stepsCountDayId ?? day.isoDate, Math.max(0, day.stepsCount)]) : []);
}

export function startStepplingRest(number: number, participation: JourneyParticipation = 'not_yet', now = Date.now()) {
  const day = STEPPLING_JOURNEY_DAYS[number - 1];
  if (!day) throw new Error('Unknown Steppling episode');
  repository.update((state) => installJourneyCycle(state, createJourneyCycle({
    id: journeyCycleId('steppling', stepplingEpisodeId(number)), familyId: 'steppling', episodeId: stepplingEpisodeId(number), number,
    chapterId: STEPPLING_CHAPTER_ID, title: day.title, nextTitle: STEPPLING_JOURNEY_DAYS[number]?.title ?? null,
    completedAt: now, finale: number === 6, participation, stepBaselines: stepBaselines(),
  })));
}

let registered = false;
const RETURN_FLOW: ContentFlowDefinition = {
  id: 'companion-journey-return', version: 1, entryNodeId: 'gift', metadata: { kind: 'story' },
  nodes: [
    { id: 'gift', kind: 'effect', capability: 'journey.cycle.return', effectType: 'journey.cycle.return', effectId: 'gift', next: 'complete' },
    { id: 'complete', kind: 'complete' },
  ],
};
export function registerCompanionJourneyFlows() {
  if (registered) return;
  registered = true;
  registerContentFlowEffect('companion.life.habit', async ({ run, payload, effectKey }) => {
    const familyId = payload.familyId;
    if (familyId !== 'steppling' && familyId !== 'mossprout') throw new Error('Unknown life companion');
    recordLifeFlow(run);
    if (payload.pause) {
      const state = loadCompanionQuickGoalState(); const goal = selectedStoryHabit(state, familyId);
      if (goal) saveCompanionQuickGoalState(updateCompanionQuickGoal(state, goal.id, { status: 'paused' }));
    } else acceptDailyStoryHabit(familyId, String(payload.habitId), run.definitionId === 'steppling-day-one' ? 'steppling:journey:day-1' : run.definitionId, `${run.definitionId}:habit:${String(payload.habitId)}`);
    return { effectKey };
  });
  registerContentFlowDefinition(RETURN_FLOW);
  registerContentFlowEffect('journey.cycle.return', async ({ run, effectKey }) => {
    const cycle = repository.load().journeyCycles?.find((item) => item.id === run.variables.cycleId);
    if (!cycle) throw new Error('Journey return is missing');
    if (cycle.returnedAt != null) return { effectKey };
    if (!journeyCycleReady(repository.load(), cycle, Date.now())) throw new Error('Your companion is still reflecting');
    await grantStoredJourneyReturn(cycle, localDayId());
    repository.update((state) => finishJourneyReturn(state, cycle.id, Date.now()));
    if (cycle.familyId === 'steppling') projectStepplingOrders(null);
    return { effectKey, rewardId: cycle.rewardId };
  });
  STEPPLING_JOURNEY_DAYS.filter((day) => day.number > 1).forEach((day) => {
    registerContentFlowDefinition(legacyStepplingEpisodeFlow(day.number));
    registerContentFlowDefinition(stepplingEpisodeFlow(day.number));
  });
  registerContentFlowEffect('journey.cycle.rest', async ({ run, payload, effectKey }) => {
    recordLifeFlow(run);
    startStepplingRest(Number(payload.number), run.definitionVersion < 2 ? (run.variables.participation as JourneyParticipation) ?? 'not_yet' : 'not_yet', run.updatedAt);
    projectStepplingOrders(null);
    return { effectKey };
  });
}

/** Preserve legacy conversations already in progress; migrate once they close.
 * Completed orders map to completed episodes without retroactive gift grants. */
export async function initializeStepplingJourney() {
  return serialize('steppling-initialize', initializeStepplingJourneyOnce);
}

async function initializeStepplingJourneyOnce() {
  registerCompanionJourneyFlows();
  let story = loadAuthoredCohortStory('steppling');
  if (story.journeyManaged) return true;
  if (story.pendingConversationId) return false;
  const firstDay = await loadContentFlowRun(STEPPLING_DAY_ONE_RUN_ID);
  const world = await loadMergeWorldState();
  if (firstDay?.status !== 'completed' && story.status === 'intro_available' && world.stepplingEgg?.hatchedAt) return false;
  const legacy = story.status !== 'intro_available' || (!world.stepplingEgg?.hatchedAt && !!world.generators['journey-locker']);
  if (!legacy && firstDay?.status !== 'completed') return false;
  if (story.status === 'intro_available') story = beginAuthoredCohortStory('steppling');
  const served = new Set([...story.completedOrderIds, ...(story.orderDeck?.servedOrderIds ?? []), ...world.externalRewardReceipts.filter((receipt) => receipt.kind === 'story_order_served').map((receipt) => receipt.id.replace('merge-story-served:', ''))]);
  const finished = story.status === 'chapter_complete' || served.has('merge-story:steppling:chapter-1:path-outside');
  const count = story.orderDeck?.templateKeys.filter((key) => served.has(`merge-story:steppling:chapter-1:${key}`)).length ?? 0;
  if (legacy) {
    const through = finished ? 6 : Math.min(5, count + 1);
    repository.update((state) => {
      const existing = new Set(state.journeyCycles?.map((cycle) => cycle.id));
      const migrated = STEPPLING_JOURNEY_DAYS.slice(0, through).map((day) => ({ ...createJourneyCycle({
        id: journeyCycleId('steppling', stepplingEpisodeId(day.number)), familyId: 'steppling', episodeId: stepplingEpisodeId(day.number), number: day.number,
        chapterId: STEPPLING_CHAPTER_ID, title: day.title, nextTitle: STEPPLING_JOURNEY_DAYS.find((next) => next.number === day.number + 1)?.title ?? null, completedAt: story.updatedAt, finale: day.number === 6,
      }), migrated: true, returnedAt: story.updatedAt }));
      return { ...state, journeyCycles: [...(state.journeyCycles ?? []), ...migrated.filter((cycle) => !existing.has(cycle.id))] };
    });
  } else {
    // The first meeting captures intention, not proof of an activity.
    startStepplingRest(1, 'not_yet', firstDay?.completedAt ?? Date.now());
  }
  saveAuthoredCohortStory('steppling', { ...story, journeyManaged: true, status: finished ? 'chapter_complete' : 'conversation_active', pendingConversationId: null,
    completedOrderIds: [...served].filter((id) => id.startsWith('merge-story:steppling:chapter-1:')), orderDeck: story.orderDeck ? { ...story.orderDeck, servedOrderIds: [...served].filter((id) => id.startsWith('merge-story:steppling:chapter-1:')) } : null });
  return true;
}

export function projectStepplingOrders(run: ContentFlowRun | null) {
  const story = loadAuthoredCohortStory('steppling');
  if (!story.journeyManaged) return;
  const cycle = currentJourneyCycle(repository.load(), 'steppling');
  const complete = cycle?.number === 6 && cycle.returnedAt != null;
  const active = run?.nodeId === 'activity';
  const served = story.orderDeck?.templateKeys.filter((key) => story.completedOrderIds.includes(`merge-story:steppling:chapter-1:${key}`)).length ?? 0;
  const status = complete ? 'chapter_complete' : active ? 'order_active' : 'conversation_active';
  const actPhase = complete ? 'complete' : served >= 5 ? 'signature_order' : 'regular_orders';
  if (story.status === status && story.actPhase === actPhase && !story.pendingConversationId) return;
  saveAuthoredCohortStory('steppling', { ...story, status, actPhase, pendingConversationId: null, unreadReturn: false });
}

export async function stepplingActiveRun() {
  const cycle = currentJourneyCycle(repository.load(), 'steppling');
  if (!cycle || !cycle.returnedAt || cycle.number >= 6) return null;
  return loadContentFlowRun(stepplingEpisodeId(cycle.number + 1));
}

/** Repairs the order projection if the app stopped after a saved scene answer
 * but before the companion panel could publish its next activity. */
export async function resumeCompanionJourneys() {
  if (loadAuthoredCohortStory('steppling').journeyManaged) await reconcileStepplingEpisode(await stepplingActiveRun());
}

export function beginNextStepplingEpisode() {
  return serialize('steppling', async () => {
    const cycle = currentJourneyCycle(repository.load(), 'steppling');
    if (!cycle || !cycle.returnedAt || cycle.number >= 6) return null;
    const definition = stepplingEpisodeFlow(cycle.number + 1);
    const run = await loadContentFlowRun(definition.id) ?? await startContentFlow(definition, { runId: definition.id, variables: { journalTitle: cycle.nextTitle ?? 'The Path Outside' } });
    projectStepplingOrders(run);
    return run;
  });
}

export async function reconcileStepplingEpisode(run: ContentFlowRun | null) {
  if (!run) return null;
  recordLifeFlow(run);
  if (run.nodeId === 'activity') {
    const definitionId = run.definitionId;
    const day = STEPPLING_JOURNEY_DAYS.find((item) => stepplingEpisodeId(item.number) === definitionId)!;
    const story = loadAuthoredCohortStory('steppling');
    const served = story.orderDeck?.templateKeys.filter((key) => story.completedOrderIds.includes(`merge-story:steppling:chapter-1:${key}`)).length ?? 0;
    if (served >= day.routes && (day.number !== 6 || story.completedOrderIds.includes('merge-story:steppling:chapter-1:path-outside'))) {
      await publishContentFlowDomainEvent({ eventId: `${run.runId}:orders`, type: 'journey.episode_orders_complete', payload: { episodeId: run.definitionId } });
      run = await loadContentFlowRun(run.runId);
    }
  }
  if (run?.status === 'failed_recoverable' || run?.nodeId === 'rest') run = await dispatchContentFlowCommand(run.runId, { type: 'retry' });
  projectStepplingOrders(run);
  return run;
}

export function adoptMossproutCycle() {
  repository.update((state) => {
    const latest = [...state.journeyDays].reverse().find((day) => day.familyId === 'mossprout');
    if (!latest || latest.status !== 'complete' || latest.completedAt == null) return state;
    const episode = MOSSPROUT_CAMPAIGN_EPISODES.find((item) => item.beatId === latest.beatId);
    if (!episode) return state;
    const rest = state.meditations?.find((item) => item.familyId === 'mossprout');
    // First rest starts at the FTUE's explicit farewell, never at the Bloom.
    if (episode.episodeNumber === 1 && !rest) return state;
    return installJourneyCycle(state, createJourneyCycle({
      id: journeyCycleId('mossprout', latest.beatId), familyId: 'mossprout', episodeId: latest.beatId, number: episode.episodeNumber,
      chapterId: episode.chapterId, title: episode.title, nextTitle: MOSSPROUT_CAMPAIGN_EPISODES[episode.episodeNumber]?.title ?? null,
      completedAt: latest.completedAt, finale: !MOSSPROUT_CAMPAIGN_EPISODES[episode.episodeNumber] || MOSSPROUT_CAMPAIGN_EPISODES[episode.episodeNumber].chapterId !== episode.chapterId,
    }));
  });
}

export async function reconcileCompanionMeditation(familyId: string) {
  const cycle = currentJourneyCycle(repository.load(), familyId);
  if (!cycle) return;
  const world = await loadMergeWorldState();
  let windowSteps: number | null = null;
  if (familyId === 'steppling' && cycle.returnedAt == null && !journeyCycleReady(repository.load(), cycle, Date.now()) && Date.now() - (lastStepQuery.get(cycle.id) ?? 0) >= 30000) {
    lastStepQuery.set(cycle.id, Date.now());
    try {
      const { Pedometer } = await import('expo-sensors');
      const permission = await Pedometer.getPermissionsAsync();
      if (permission.granted && await Pedometer.isAvailableAsync()) {
        windowSteps = (await Pedometer.getStepCountAsync(new Date(cycle.completedAt), new Date(Date.now()))).steps;
      }
    } catch { /* Unsupported/denied Motion keeps the adapted and rest paths available. */ }
  }
  repository.update((initial) => {
    let state = initial;
    for (const request of cycle.requests) {
      const receipt = world.externalRewardReceipts.find((item) => item.id === `merge-story-served:${request.orderId}`);
      if (receipt) state = completeMeditationRequest(state, cycle.id, request.id, receipt.id, receipt.createdAt);
    }
    if (familyId === 'steppling') {
      const home = homeRepository.load();
      for (const day of home ? [home.today, ...home.archivedDays] : []) {
        const dayId = day.stepsCountDayId ?? day.isoDate;
        if (!day.stepsUpdatedAt) continue;
        const measuredAt = Date.parse(day.stepsUpdatedAt);
        if (!Number.isFinite(measuredAt) || measuredAt > Date.now()) continue;
        state = observeJourneySteps(state, cycle.id, dayId, day.stepsCount, measuredAt, new Date(`${dayId}T00:00:00`).getTime());
      }
      if (windowSteps != null) state = observeJourneyStepWindow(state, cycle.id, windowSteps, Date.now());
    }
    return state;
  });
  const latest = currentJourneyCycle(repository.load(), familyId)!;
  const rest = repository.load().meditations?.find((item) => (item.cycleId ?? item.sourceId) === latest.id);
  await reconcileStoredJourneyMeditation(latest, rest?.availableAt ?? latest.completedAt, Date.now());
  repository.update((state) => beginJourneyReturnPresentation(state, latest.id, Date.now()));
}

export function claimCompanionJourneyReturn(cycleId: string) {
  return serialize(cycleId, async () => {
    const cycle = repository.load().journeyCycles?.find((item) => item.id === cycleId);
    if (!cycle || cycle.returnedAt != null || !journeyCycleReady(repository.load(), cycle, Date.now())) return;
    registerCompanionJourneyFlows();
    const runId = `journey-return:${cycleId}`;
    const existing = await loadContentFlowRun(runId);
    const result = existing ? await dispatchContentFlowCommand(runId, { type: 'retry' }) : await startContentFlow(RETURN_FLOW, { runId, variables: { cycleId } });
    if (result?.status !== 'completed') throw new Error('The return gift could not be saved');
  });
}
