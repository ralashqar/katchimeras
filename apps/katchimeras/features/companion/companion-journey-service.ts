import { COMPANION_JOURNEY_CHAPTERS, journeyChapterFor, journeyChapterForEpisode } from '@/constants/companion-journey-chapters/registry';
import { journeyEpisodeFlow, journeyEpisodeId } from '@/constants/companion-journey-chapters/episode-flow';
import { COMPANION_JOURNEY_PROFILES } from '@/constants/companion-journey-profiles';
import { MOSSPROUT_CAMPAIGN_EPISODES } from '@/constants/mossprout-campaign';
import { beginJourneyReturnPresentation, completeMeditationRequest, settleDailyGardenDelivery, createJourneyCycle, currentJourneyCycle, finishJourneyReturn, installJourneyCycle, journeyCycleReady, observeJourneySteps, observeJourneyStepWindow } from '@/game/katchimeras/companion-journey-cycle';
import { relationshipProgressionRepository as repository } from '@/storage/repositories/relationship-progression-repository';
import { homeRepository } from '@/storage/repositories/home-repository';
import { beginAuthoredCohortStory, loadAuthoredCohortStory, saveAuthoredCohortStory } from '@/utils/companion-story-storage';
import { grantStoredJourneyReturn, loadMergeWorldState, reconcileStoredJourneyMeditation } from '@/utils/merge-world/repository';
import { localDayId } from '@/utils/world-identity';
import type { JourneyParticipation } from '@/types/companion-journey-cycle';
import type { CompanionJourneyChapterDefinition } from '@/types/companion-journey-chapter';
import type { ContentFlowRun, ContentFlowDefinition } from '@/types/content-flow';
import type { LifeCompanionFamily } from '@/constants/companion-life-content';
import { registerContentFlowEffect } from '@/features/content-flow/content-flow-capabilities';
import { registerContentFlowDefinition } from '@/features/content-flow/content-flow-catalog';
import { dispatchContentFlowCommand, publishContentFlowDomainEvent, startContentFlow } from '@/features/content-flow/content-flow-director';
import { loadContentFlowRun } from '@/features/content-flow/content-flow-repository';
import { hatchableEggProgress } from '@/features/onboarding/hatchable-egg-policy';
import { acceptDailyStoryHabit } from '@/utils/companion-life-storage';
import { recordLifeFlow } from '@/utils/companion-life-recording';
import { selectedStoryHabit } from '@/utils/companion-life';
import { loadCompanionQuickGoalState, saveCompanionQuickGoalState } from '@/utils/companion-quick-goal-storage';
import { updateCompanionQuickGoal } from '@/utils/companion-quick-goals';

/**
 * The journey service, generic over a friend's chapter: it starts each rest,
 * migrates a save from before the chapter system, projects the chapter's
 * orders into the friend's story, begins and reconciles each journey day's
 * flow, settles a rest from the Garden and the friend's evidence, and pays
 * the return. Which friend it is comes from the chapter registry; Mossprout's
 * campaign is adopted as his chapter.
 */
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

function requireChapter(familyId: string): CompanionJourneyChapterDefinition {
  const chapter = journeyChapterFor(familyId);
  if (!chapter) throw new Error(`No journey chapter is authored for ${familyId}`);
  return chapter;
}

function stepBaselines() {
  const home = homeRepository.load();
  return Object.fromEntries(home ? [home.today, ...home.archivedDays].map((day) => [day.stepsCountDayId ?? day.isoDate, Math.max(0, day.stepsCount)]) : []);
}

const orderId = (chapter: CompanionJourneyChapterDefinition, key: string) => `${chapter.orders.idPrefix}${key}`;
const signatureOrderId = (chapter: CompanionJourneyChapterDefinition) => orderId(chapter, chapter.orders.signature.key);

export function startJourneyRest(familyId: string, number: number, participation: JourneyParticipation = 'not_yet', now = Date.now()) {
  const chapter = requireChapter(familyId);
  const day = chapter.days[number - 1];
  if (!day) throw new Error(`Unknown episode of ${chapter.title}`);
  repository.update((state) => installJourneyCycle(state, createJourneyCycle({
    id: journeyCycleId(chapter.familyId, journeyEpisodeId(chapter, number)), familyId: chapter.familyId, episodeId: journeyEpisodeId(chapter, number), number,
    chapterId: chapter.chapterId, title: day.title, nextTitle: chapter.days[number]?.title ?? null,
    completedAt: now, finale: number === chapter.days.length, participation, stepBaselines: stepBaselines(),
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
    const familyId = String(payload.familyId);
    const chapter = journeyChapterFor(familyId);
    if (familyId !== 'mossprout' && !chapter) throw new Error('Unknown life companion');
    recordLifeFlow(run);
    if (payload.pause) {
      const state = loadCompanionQuickGoalState(); const goal = selectedStoryHabit(state, familyId as LifeCompanionFamily);
      if (goal) saveCompanionQuickGoalState(updateCompanionQuickGoal(state, goal.id, { status: 'paused' }));
    } else {
      // A habit chosen at the first meeting is the first journey day's.
      const flowId = chapter && run.definitionId === chapter.dayOne.flowId ? chapter.dayOne.runId : run.definitionId;
      acceptDailyStoryHabit(familyId as LifeCompanionFamily, String(payload.habitId), flowId, `${run.definitionId}:habit:${String(payload.habitId)}`);
    }
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
    if (journeyChapterFor(cycle.familyId)) projectJourneyOrders(cycle.familyId, null);
    return { effectKey, rewardId: cycle.rewardId };
  });
  for (const chapter of COMPANION_JOURNEY_CHAPTERS) {
    for (const day of chapter.days) {
      if (day.number === 1) continue;
      if (chapter.legacyEpisodeFlow) registerContentFlowDefinition(chapter.legacyEpisodeFlow(day.number));
      registerContentFlowDefinition(journeyEpisodeFlow(chapter, day.number));
    }
  }
  registerContentFlowEffect('journey.cycle.rest', async ({ run, payload, effectKey }) => {
    recordLifeFlow(run);
    // Flows from before the chapter system name no family; their episode id does.
    const chapter = (typeof payload.familyId === 'string' ? journeyChapterFor(payload.familyId) : null) ?? journeyChapterForEpisode(run.definitionId);
    if (!chapter) throw new Error('Unknown journey chapter');
    startJourneyRest(chapter.familyId, Number(payload.number), run.definitionVersion < 2 ? (run.variables.participation as JourneyParticipation) ?? 'not_yet' : 'not_yet', run.updatedAt);
    projectJourneyOrders(chapter.familyId, null);
    return { effectKey };
  });
}

/**
 * Brings a friend's chapter under the journey service: true once the
 * chapter is managed, false while their first meeting or an older
 * conversation is still to finish. A friend without a chapter has nothing
 * to manage and is ready at once.
 */
export async function initializeJourney(familyId: string) {
  const chapter = journeyChapterFor(familyId);
  if (!chapter) return true;
  return serialize(`${chapter.familyId}-initialize`, () => initializeJourneyOnce(chapter));
}

/** Preserve legacy conversations already in progress; migrate once they close.
 * Completed orders map to completed episodes without retroactive gift grants. */
async function initializeJourneyOnce(chapter: CompanionJourneyChapterDefinition) {
  registerCompanionJourneyFlows();
  const familyId = chapter.familyId;
  let story = loadAuthoredCohortStory(familyId);
  if (story.journeyManaged) return true;
  if (story.pendingConversationId) return false;
  const firstDay = await loadContentFlowRun(chapter.dayOne.runId);
  const world = await loadMergeWorldState();
  const hatched = Boolean(hatchableEggProgress(world, { companion: familyId })?.hatchedAt);
  if (firstDay?.status !== 'completed' && story.status === 'intro_available' && hatched) return false;
  const legacy = story.status !== 'intro_available' || (!hatched && !!world.generators[chapter.generatorId]);
  if (!legacy && firstDay?.status !== 'completed') return false;
  if (story.status === 'intro_available') story = beginAuthoredCohortStory(familyId);
  const served = new Set([...story.completedOrderIds, ...(story.orderDeck?.servedOrderIds ?? []), ...world.externalRewardReceipts.filter((receipt) => receipt.kind === 'story_order_served').map((receipt) => receipt.id.replace('merge-story-served:', ''))]);
  const finished = story.status === 'chapter_complete' || served.has(signatureOrderId(chapter));
  const count = story.orderDeck?.templateKeys.filter((key) => served.has(orderId(chapter, key))).length ?? 0;
  const total = chapter.days.length;
  if (legacy) {
    const through = finished ? total : Math.min(total - 1, count + 1);
    repository.update((state) => {
      const existing = new Set(state.journeyCycles?.map((cycle) => cycle.id));
      const migrated = chapter.days.slice(0, through).map((day) => ({ ...createJourneyCycle({
        id: journeyCycleId(familyId, journeyEpisodeId(chapter, day.number)), familyId, episodeId: journeyEpisodeId(chapter, day.number), number: day.number,
        chapterId: chapter.chapterId, title: day.title, nextTitle: chapter.days.find((next) => next.number === day.number + 1)?.title ?? null, completedAt: story.updatedAt, finale: day.number === total,
      }), migrated: true, returnedAt: story.updatedAt }));
      return { ...state, journeyCycles: [...(state.journeyCycles ?? []), ...migrated.filter((cycle) => !existing.has(cycle.id))] };
    });
  } else {
    // The first meeting captures intention, not proof of an activity.
    startJourneyRest(familyId, 1, 'not_yet', firstDay?.completedAt ?? Date.now());
  }
  const chapterOrders = (ids: Iterable<string>) => [...ids].filter((id) => id.startsWith(chapter.orders.idPrefix));
  saveAuthoredCohortStory(familyId, { ...story, journeyManaged: true, status: finished ? 'chapter_complete' : 'conversation_active', pendingConversationId: null,
    completedOrderIds: chapterOrders(served), orderDeck: story.orderDeck ? { ...story.orderDeck, servedOrderIds: chapterOrders(served) } : null });
  return true;
}

/** Keeps the friend's story arc in step with the journey: which orders are open, and whether the signature order is due. */
export function projectJourneyOrders(familyId: string, run: ContentFlowRun | null) {
  const chapter = requireChapter(familyId);
  const story = loadAuthoredCohortStory(chapter.familyId);
  if (!story.journeyManaged) return;
  const cycle = currentJourneyCycle(repository.load(), chapter.familyId);
  const complete = cycle?.number === chapter.days.length && cycle.returnedAt != null;
  const active = run?.nodeId === 'activity';
  const served = story.orderDeck?.templateKeys.filter((key) => story.completedOrderIds.includes(orderId(chapter, key))).length ?? 0;
  const status = complete ? 'chapter_complete' : active ? 'order_active' : 'conversation_active';
  const actPhase = complete ? 'complete' : served >= chapter.orders.requiredCount ? 'signature_order' : 'regular_orders';
  if (story.status === status && story.actPhase === actPhase && !story.pendingConversationId) return;
  saveAuthoredCohortStory(chapter.familyId, { ...story, status, actPhase, pendingConversationId: null, unreadReturn: false });
}

/** The run of the journey day after the friend's last return, if one has begun. */
export async function activeJourneyRun(familyId: string) {
  const chapter = journeyChapterFor(familyId);
  if (!chapter) return null;
  const cycle = currentJourneyCycle(repository.load(), chapter.familyId);
  if (!cycle || !cycle.returnedAt || cycle.number >= chapter.days.length) return null;
  return loadContentFlowRun(journeyEpisodeId(chapter, cycle.number + 1));
}

/** Repairs the order projection if the app stopped after a saved scene answer
 * but before the companion panel could publish its next activity. */
export async function resumeCompanionJourneys() {
  for (const chapter of COMPANION_JOURNEY_CHAPTERS) {
    if (loadAuthoredCohortStory(chapter.familyId).journeyManaged) await reconcileEpisode(chapter.familyId, await activeJourneyRun(chapter.familyId));
  }
}

export function beginNextEpisode(familyId: string) {
  const chapter = requireChapter(familyId);
  return serialize(chapter.familyId, async () => {
    const cycle = currentJourneyCycle(repository.load(), chapter.familyId);
    if (!cycle || !cycle.returnedAt || cycle.number >= chapter.days.length) return null;
    const definition = journeyEpisodeFlow(chapter, cycle.number + 1);
    const run = await loadContentFlowRun(definition.id) ?? await startContentFlow(definition, { runId: definition.id, variables: { journalTitle: cycle.nextTitle ?? chapter.title } });
    projectJourneyOrders(chapter.familyId, run);
    return run;
  });
}

export async function reconcileEpisode(familyId: string, run: ContentFlowRun | null) {
  if (!run) return null;
  const chapter = requireChapter(familyId);
  recordLifeFlow(run);
  if (run.nodeId === 'activity') {
    const definitionId = run.definitionId;
    const day = chapter.days.find((item) => journeyEpisodeId(chapter, item.number) === definitionId)!;
    const story = loadAuthoredCohortStory(chapter.familyId);
    const served = story.orderDeck?.templateKeys.filter((key) => story.completedOrderIds.includes(orderId(chapter, key))).length ?? 0;
    if (served >= day.routes && (day.number !== chapter.days.length || story.completedOrderIds.includes(signatureOrderId(chapter)))) {
      await publishContentFlowDomainEvent({ eventId: `${run.runId}:orders`, type: 'journey.episode_orders_complete', payload: { episodeId: run.definitionId } });
      run = await loadContentFlowRun(run.runId);
    }
  }
  if (run?.status === 'failed_recoverable' || run?.nodeId === 'rest') run = await dispatchContentFlowCommand(run.runId, { type: 'retry' });
  projectJourneyOrders(chapter.familyId, run);
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
  // A walker's rest listens to steps: the day's aggregates, and the pedometer window since the rest began.
  const tracksSteps = COMPANION_JOURNEY_PROFILES[cycle.familyId]?.tracker === 'steps';
  let windowSteps: number | null = null;
  if (tracksSteps && cycle.returnedAt == null && !journeyCycleReady(repository.load(), cycle, Date.now()) && Date.now() - (lastStepQuery.get(cycle.id) ?? 0) >= 30000) {
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
    if (cycle.dailyGardenVersion === 1) {
      const deliveries = world.externalRewardReceipts.filter((item) => item.sourceId === 'companion:daily-garden' && item.characterId === familyId && item.createdAt >= cycle.completedAt).sort((a, b) => a.createdAt - b.createdAt);
      for (const receipt of deliveries) {
        state = settleDailyGardenDelivery(state, familyId, receipt.id, receipt.createdAt);
      }
    }
    if (tracksSteps) {
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
