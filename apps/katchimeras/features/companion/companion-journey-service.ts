import { COMPANION_JOURNEY_CHAPTERS, journeyChapterFor, journeyEpisodeById, journeyEpisodeRecordId } from '@/constants/companion-journey-chapters/registry';
import { COMPANION_JOURNEY_PROFILES } from '@/constants/companion-journey-profiles';
import { beginJourneyReturnPresentation, completeMeditationRequest, settleDailyGardenDelivery, createJourneyCycle, currentJourneyCycle, finishJourneyReturn, installJourneyCycle, journeyCycleReady, observeJourneySteps, observeJourneyStepWindow } from '@/game/katchimeras/companion-journey-cycle';
import { relationshipProgressionRepository as repository } from '@/storage/repositories/relationship-progression-repository';
import { homeRepository } from '@/storage/repositories/home-repository';
import { beginAuthoredCohortStory, isAuthoredCohortFamily, loadAuthoredCohortStory, saveAuthoredCohortStory } from '@/utils/companion-story-storage';
import { katchimeraMeditationRecord, mossproutStory } from '@/game/katchimeras/relationship-progression';
import type { RelationshipProgressState } from '@/types/relationship-progression';
import { grantStoredJourneyReturn, loadMergeWorldState, reconcileStoredJourneyMeditation } from '@/utils/merge-world/repository';
import { JOURNEY_GARDEN_ORDERS_EFFECT, episodeConsequences } from '@/constants/companion-journey-chapters/consequence-flow';
import { localDayId } from '@/utils/world-identity';
import type { JourneyParticipation } from '@/types/companion-journey-cycle';
import type { CompanionJourneyChapterDefinition, JourneyEpisodeDefinition } from '@/types/companion-journey-chapter';
import type { ConversationSession } from '@/types/companion-conversation';
import type { ContentFlowDefinition } from '@/types/content-flow';
import type { LifeCompanionFamily } from '@/constants/companion-life-content';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import { registerContentFlowEffect } from '@/features/content-flow/content-flow-capabilities';
import { registerContentFlowDefinition } from '@/features/content-flow/content-flow-catalog';
import { dispatchContentFlowCommand, startContentFlow } from '@/features/content-flow/content-flow-director';
import { loadContentFlowRun } from '@/features/content-flow/content-flow-repository';
import { hatchableEggProgress } from '@/features/onboarding/hatchable-egg-policy';
import { acceptDailyStoryHabit, rememberCompanionMoment } from '@/utils/companion-life-storage';
import { recordLifeFlow } from '@/utils/companion-life-recording';
import { selectedStoryHabit } from '@/utils/companion-life';
import { loadCompanionQuickGoalState, saveCompanionQuickGoalState } from '@/utils/companion-quick-goal-storage';
import { updateCompanionQuickGoal } from '@/utils/companion-quick-goals';
import { COMPANION_BOND_REWARDS, recordCompanionBondEvent } from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState } from '@/utils/companion-bond-storage';
import { companionIdForFamily } from '@/constants/katchimera-skins';
import { registerJourneyConsequenceFlows, resumeJourneyConsequences, startJourneyConsequence } from '@/features/companion/journey-consequences';

/**
 * The journey service, generic over a friend's chapter: it brings a save
 * under the chapter (migrating the day-and-rest era), records an episode's
 * completion with its answers and facts, pays its Bond, starts the
 * reflecting pause, keeps the friend's Garden orders in step, settles a rest
 * from the Garden and the friend's evidence, and pays the return. Which
 * episode opens next is the trigger module's answer
 * (`features/companion/journey-triggers.ts`).
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

const orderId = (chapter: CompanionJourneyChapterDefinition, key: string) => `${chapter.orders?.idPrefix ?? ''}${key}`;
const signatureOrderId = (chapter: CompanionJourneyChapterDefinition) => chapter.orders ? orderId(chapter, chapter.orders.signature.key) : null;
const episodeIndex = (chapter: CompanionJourneyChapterDefinition, episodeId: string) => chapter.episodes.findIndex((episode) => episode.id === episodeId);

/** The friend rests after an episode: a cycle (its requests shorten the pause) and a meditation record. */
export function startJourneyRest(familyId: string, episodeId: string, participation: JourneyParticipation = 'not_yet', now = Date.now()) {
  const chapter = requireChapter(familyId);
  const index = episodeIndex(chapter, episodeId);
  const episode = chapter.episodes[index];
  if (!episode) throw new Error(`Unknown episode of ${chapter.title}`);
  const reflectMs = episode.reflectMs ?? chapter.reflectMs;
  repository.update((state) => installJourneyCycle(state, createJourneyCycle({
    id: journeyCycleId(chapter.familyId, episode.id), familyId: chapter.familyId, episodeId: episode.id, number: index + 1,
    chapterId: chapter.chapterId, title: episode.title, nextTitle: chapter.episodes[index + 1]?.title ?? null,
    completedAt: now, finale: index === chapter.episodes.length - 1, participation, stepBaselines: stepBaselines(),
  }), reflectMs));
}

/** Marks an episode complete: once, with what the player answered, its facts, its Bond and a journal moment; then the friend reflects. */
export function completeJourneyEpisode(familyId: string, episodeId: string, input: { session?: ConversationSession | null; now?: number } = {}) {
  const found = journeyEpisodeById(familyId, episodeId);
  if (!found) throw new Error(`Unknown episode ${episodeId} for ${familyId}`);
  const { chapter, episode, compiled } = found;
  const now = input.now ?? Date.now();
  const recordId = journeyEpisodeRecordId(chapter.familyId, episode.id);
  if (repository.load().journeyEpisodes?.[recordId]) return false;
  const answers: Record<string, string> = {};
  const facts: Record<string, string> = {};
  for (const turn of input.session?.turns ?? []) {
    answers[turn.nodeId] = turn.optionId;
    const fact = compiled?.facts[turn.optionId];
    if (fact) facts[fact.key] = fact.value;
  }
  repository.update((state) => chapter.onEpisodeComplete?.({ ...state, journeyEpisodes: { ...(state.journeyEpisodes ?? {}), [recordId]: { familyId: chapter.familyId, episodeId: episode.id, completedAt: now, answers, facts } } }, episode, now)
    ?? { ...state, journeyEpisodes: { ...(state.journeyEpisodes ?? {}), [recordId]: { familyId: chapter.familyId, episodeId: episode.id, completedAt: now, answers, facts } } });
  // A beat that grows the friend's home: the stage is recorded on their story, where the Haven reads it.
  if (episode.habitatStage && chapter.familyId === 'mossprout') {
    repository.update((state) => {
      const story = mossproutStory(state, now);
      if (story.habitatStage >= episode.habitatStage!) return state;
      return { ...state, stories: { ...state.stories, mossprout: { ...story, habitatStage: episode.habitatStage!, updatedAt: now } } };
    });
  }
  if (!episode.dayOne) {
    const bond = loadCompanionBondState();
    const award = recordCompanionBondEvent(bond, { id: `journey:${recordId}`, kind: 'journey_day_completed', creatureId: companionIdForFamily(chapter.familyId as KatchimeraFamilyId),
      points: episode.bond ?? COMPANION_BOND_REWARDS.journey_day_completed, occurredAt: now, dayId: localDayId(new Date(now)) }, { queueCelebration: false });
    if (award.awarded) saveCompanionBondState(award.state);
    const journalFacts: Record<string, string> = {};
    for (const turn of input.session?.turns ?? []) {
      const node = compiled?.definition.nodes.find((item) => item.id === turn.nodeId);
      if (node?.kind !== 'choice' || node.options.length < 2) continue;
      const option = node.options.find((item) => item.id === turn.optionId);
      if (option) journalFacts[`${chapter.familyId}:${episode.id}:${node.id}`] = `${node.prompt} You chose “${option.label}”.`;
    }
    rememberCompanionMoment({ id: `journey:${recordId}`, familyId: chapter.familyId as LifeCompanionFamily, kind: episodeIndex(chapter, episode.id) === chapter.episodes.length - 1 ? 'chapter' : 'conversation',
      title: episode.title, createdAt: now, updatedAt: now, facts: journalFacts });
  }
  // A chapter with no pauses of its own (Mossprout's, beside his campaign) leaves the friend's rests to what already keeps them.
  if ((episode.reflectMs ?? chapter.reflectMs) > 0) startJourneyRest(chapter.familyId, episode.id, 'not_yet', now);
  projectJourneyOrders(chapter.familyId);
  // The episode's world consequence plays on the Kingdom; its run is durable, so a failure here is retried on resume.
  if (episodeConsequences(episode).length) void startJourneyConsequence(chapter.familyId, episode.id).catch((error) => console.warn('The journey consequence could not start', error));
  return true;
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
  registerJourneyConsequenceFlows();
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
  // An episode's Garden orders are placed by the Garden's own reconcile, from the episode record; the effect only marks the step.
  registerContentFlowEffect(JOURNEY_GARDEN_ORDERS_EFFECT, async ({ effectKey, payload }) => {
    const orders = payload.orders as { id: string }[];
    return { effectKey, orderIds: orders.map((order) => order.id) };
  });
  registerContentFlowEffect('journey.cycle.return', async ({ run, effectKey }) => {
    const cycle = repository.load().journeyCycles?.find((item) => item.id === run.variables.cycleId);
    if (!cycle) throw new Error('Journey return is missing');
    if (cycle.returnedAt != null) return { effectKey };
    if (!journeyCycleReady(repository.load(), cycle, Date.now())) throw new Error('Your companion is still reflecting');
    await grantStoredJourneyReturn(cycle, localDayId());
    repository.update((state) => finishJourneyReturn(state, cycle.id, Date.now()));
    if (journeyChapterFor(cycle.familyId)) projectJourneyOrders(cycle.familyId);
    return { effectKey, rewardId: cycle.rewardId };
  });
  // Episode runs from the day-and-rest era: their rest effect still lands, on the chapter's episode of that number.
  registerContentFlowEffect('journey.cycle.rest', async ({ run, payload, effectKey }) => {
    recordLifeFlow(run);
    const chapter = COMPANION_JOURNEY_CHAPTERS.find((candidate) => candidate.legacyEpisodeIdPrefix && run.definitionId.startsWith(candidate.legacyEpisodeIdPrefix));
    const episode = chapter?.episodes[Number(payload.number) - 1];
    if (!chapter || !episode) throw new Error('Unknown journey chapter');
    completeJourneyEpisode(chapter.familyId, episode.id, { now: run.updatedAt });
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
  if (!isAuthoredCohortFamily(familyId)) {
    // Mossprout: the first session is his first meeting; the farewell's rest (or a finished Garden day) says it happened.
    const dayOneAt = mossproutDayOneAt(repository.load());
    if (dayOneAt == null) return false;
    const dayOne = chapter.episodes.find((episode) => episode.dayOne);
    if (dayOne) completeJourneyEpisode(familyId, dayOne.id, { now: dayOneAt });
    migrateCampaignJourneyDays(chapter);
    return true;
  }
  let story = loadAuthoredCohortStory(familyId);
  if (story.journeyManaged) { migrateDayAndRestCycles(chapter); return true; }
  if (story.pendingConversationId) return false;
  const firstDay = await loadContentFlowRun(chapter.dayOne.runId);
  const world = await loadMergeWorldState();
  const hatched = Boolean(hatchableEggProgress(world, { companion: familyId })?.hatchedAt);
  if (firstDay?.status !== 'completed' && story.status === 'intro_available' && hatched) return false;
  const legacy = story.status !== 'intro_available' || (!hatched && !!world.generators[chapter.generatorId]);
  if (!legacy && firstDay?.status !== 'completed') return false;
  if (story.status === 'intro_available') story = beginAuthoredCohortStory(familyId);
  const served = new Set([...story.completedOrderIds, ...(story.orderDeck?.servedOrderIds ?? []), ...world.externalRewardReceipts.filter((receipt) => receipt.kind === 'story_order_served').map((receipt) => receipt.id.replace('merge-story-served:', ''))]);
  const signature = signatureOrderId(chapter);
  const finished = story.status === 'chapter_complete' || (signature != null && served.has(signature));
  const count = story.orderDeck?.templateKeys.filter((key) => served.has(orderId(chapter, key))).length ?? 0;
  const total = chapter.episodes.length;
  if (legacy) {
    // A save from before the chapter system: its served orders say how far it got; no episode pays again.
    const through = finished ? total : Math.min(total - 1, count + 1);
    repository.update((state) => {
      const records = { ...(state.journeyEpisodes ?? {}) };
      for (const episode of chapter.episodes.slice(0, through)) {
        const id = journeyEpisodeRecordId(familyId, episode.id);
        if (!records[id]) records[id] = { familyId, episodeId: episode.id, completedAt: story.updatedAt, answers: {}, facts: {}, migrated: true };
      }
      return { ...state, journeyEpisodes: records };
    });
  } else {
    // The first meeting captures intention, not proof of an activity.
    const dayOne = chapter.episodes.find((episode) => episode.dayOne);
    if (dayOne) completeJourneyEpisode(familyId, dayOne.id, { now: firstDay?.completedAt ?? Date.now() });
  }
  const chapterOrders = (ids: Iterable<string>) => [...ids].filter((id) => chapter.orders && id.startsWith(chapter.orders.idPrefix));
  saveAuthoredCohortStory(familyId, { ...story, journeyManaged: true, status: finished ? 'chapter_complete' : 'conversation_active', pendingConversationId: null,
    completedOrderIds: chapterOrders(served), orderDeck: story.orderDeck ? { ...story.orderDeck, servedOrderIds: chapterOrders(served) } : null });
  projectJourneyOrders(familyId);
  return true;
}

/** When Mossprout's first session ended: the farewell began his first rest; an older save may only have its first Garden day. */
function mossproutDayOneAt(state: RelationshipProgressState): number | null {
  const rest = [...(state.meditations ?? [])].filter((record) => record.familyId === 'mossprout').sort((a, b) => a.startedAt - b.startedAt)[0] ?? katchimeraMeditationRecord(state, 'mossprout');
  const firstDay = state.journeyDays.find((day) => day.familyId === 'mossprout' && day.status === 'complete');
  const cycle = state.journeyCycles?.find((item) => item.familyId === 'mossprout');
  const at = [rest?.startedAt, firstDay?.completedAt ?? undefined, cycle?.completedAt].filter((value): value is number => typeof value === 'number');
  return at.length ? Math.min(...at) : null;
}

/**
 * Journey days from the Garden campaign's day-and-rest era: every completed
 * day is its beat's opening and resolution, recorded once with no answers.
 * The story summary those days wrote (beats, chapter, habitat stage) is
 * already in place, so nothing pays or reveals again.
 */
function migrateCampaignJourneyDays(chapter: CompanionJourneyChapterDefinition) {
  const state = repository.load();
  const days = state.journeyDays.filter((day) => day.familyId === chapter.familyId && day.status === 'complete' && day.completedAt != null);
  if (!days.length) return;
  const records = { ...(state.journeyEpisodes ?? {}) };
  let changed = false;
  for (const day of days) {
    for (const episode of chapter.episodes.filter((item) => item.id === day.beatId || item.id === `${day.beatId}:resolution`)) {
      const id = journeyEpisodeRecordId(chapter.familyId, episode.id);
      if (records[id]) continue;
      records[id] = { familyId: chapter.familyId, episodeId: episode.id, completedAt: day.completedAt!, answers: {}, facts: {}, migrated: true };
      changed = true;
    }
  }
  if (changed) repository.update((current) => ({ ...current, journeyEpisodes: records }));
}

/** Cycles written by the day-and-rest era name their episode by number: every returned cycle is a complete episode. */
function migrateDayAndRestCycles(chapter: CompanionJourneyChapterDefinition) {
  const prefix = chapter.legacyEpisodeIdPrefix;
  if (!prefix) return;
  const state = repository.load();
  const cycles = (state.journeyCycles ?? []).filter((cycle) => cycle.familyId === chapter.familyId && cycle.episodeId.startsWith(prefix));
  if (!cycles.length) return;
  const records = { ...(state.journeyEpisodes ?? {}) };
  let changed = false;
  for (const cycle of cycles) {
    const episode = chapter.episodes[cycle.number - 1];
    if (!episode) continue;
    const id = journeyEpisodeRecordId(chapter.familyId, episode.id);
    if (records[id]) continue;
    records[id] = { familyId: chapter.familyId, episodeId: episode.id, completedAt: cycle.completedAt, answers: {}, facts: {}, migrated: true };
    changed = true;
  }
  if (changed) repository.update((current) => ({ ...current, journeyEpisodes: records }));
}

/** Keeps the friend's story arc in step with the chapter: orders stay open while episodes remain; the signature comes once enough are served. */
export function projectJourneyOrders(familyId: string) {
  const chapter = requireChapter(familyId);
  if (!chapter.orders || !isAuthoredCohortFamily(chapter.familyId)) return;
  const story = loadAuthoredCohortStory(chapter.familyId);
  if (!story.journeyManaged) return;
  const state = repository.load();
  const complete = chapter.episodes.every((episode) => state.journeyEpisodes?.[journeyEpisodeRecordId(chapter.familyId, episode.id)]);
  const served = story.orderDeck?.templateKeys.filter((key) => story.completedOrderIds.includes(orderId(chapter, key))).length ?? 0;
  const status = complete ? 'chapter_complete' : 'order_active';
  const actPhase = complete ? 'complete' : served >= chapter.orders.requiredCount ? 'signature_order' : 'regular_orders';
  if (story.status === status && story.actPhase === actPhase && !story.pendingConversationId) return;
  saveAuthoredCohortStory(chapter.familyId, { ...story, status, actPhase, pendingConversationId: null, unreadReturn: false });
}

/** Repairs the order projection after a relaunch, and resumes any episode consequence still to play. */
export async function resumeCompanionJourneys() {
  for (const chapter of COMPANION_JOURNEY_CHAPTERS) {
    if (isAuthoredCohortFamily(chapter.familyId) && loadAuthoredCohortStory(chapter.familyId).journeyManaged) { migrateDayAndRestCycles(chapter); projectJourneyOrders(chapter.familyId); }
  }
  await resumeJourneyConsequences();
}

/** Whether a friend's first meeting has finished: the day-one flow, or the story already managed. */
export async function journeyDayOneComplete(familyId: string): Promise<boolean> {
  const chapter = journeyChapterFor(familyId);
  if (!chapter) return false;
  if (!isAuthoredCohortFamily(chapter.familyId)) return mossproutDayOneAt(repository.load()) != null;
  if (loadAuthoredCohortStory(chapter.familyId).journeyManaged) return true;
  return (await loadContentFlowRun(chapter.dayOne.runId))?.status === 'completed';
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

export type { JourneyEpisodeDefinition };
