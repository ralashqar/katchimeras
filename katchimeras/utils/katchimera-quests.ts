import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import type { QuestCapabilityMap } from '@/utils/capabilities/quest-capabilities';
import { evaluateQuestRuntime } from '@/utils/quests/runtime';
import type { Facts } from '@/utils/signals/facts';
import { questCriteriaStatus } from '@/utils/quests/evaluate';
import { questDefinition } from '@/utils/quests/definitions';
import { isQuestLoopAfterCompleteEnabled } from '@/utils/dev-settings';
import type { QuestAttempt, QuestResult } from '@/utils/quests/experiences/types';
import { rankedQuestOfferIds } from '@/utils/quest-offer-order';

// Companion quest store (docs/katchimera-engagement-v1.md): tiny persisted
// ledger of accepted quests, one active per katchimera. Completion is decided
// by the generic facts+criteria engine (utils/quests/evaluate) — this file no
// longer hardcodes per-quest logic.

export type CompanionQuest = {
  questId: string;
  creatureId: string;
  title: string;
  hint: string;
  acceptedAt: number;
  acceptedDayId?: string;
  completedAt?: number;
  completedDayId?: string;
  repairedAt?: number;
  repairedFromQuestId?: string;
  offerSeed?: string;
  resolvedConfig?: Record<string, unknown>;
  questRunId?: string;
};

export type QuestSubmissionRecord = {
  id: string;
  questId: string;
  creatureId: string;
  dayId: string;
  sourceType: string;
  sourceId: string;
  evidenceId?: string | null;
  submittedAt: number;
  questRunId?: string;
  journalRecordId?: string | null;
  verificationSource?: 'journal' | 'foundation' | 'vision' | 'manual_review' | 'legacy';
};

export type QuestSubmissionInput = {
  sourceType: string;
  sourceId: string;
  evidenceId?: string | null;
  journalRecordId?: string | null;
  verificationSource?: QuestSubmissionRecord['verificationSource'];
};

export type QuestOfferCycle = {
  creatureId: string;
  dayId: string;
  offerIds: string[];
  index: number;
};

export type CompanionQuestState = {
  schemaVersion: 2 | 3;
  quests: CompanionQuest[];
  submissions: QuestSubmissionRecord[];
  offerCycles: QuestOfferCycle[];
  attempts: QuestAttempt[];
};

const KEY = 'katchadeck.companion-quests-v1';
// No global cap for now — a katchimera still only holds one quest at a time.
export const MAX_ACTIVE_QUESTS = Infinity;

export function loadCompanionQuests(
  resolveCompanionId: (value: string) => string = (value) => value
): CompanionQuestState {
  const value = getStoredJson<CompanionQuestState>(KEY, emptyCompanionQuestState());
  const needsRunMigration = value.schemaVersion !== 3 || value.quests.some((quest) => !quest.questRunId);
  const normalized = normaliseState(value, true);
  const migrated = migrateCompanionQuestIdentity(normalized, resolveCompanionId);
  if (needsRunMigration || migrated !== normalized) setStoredJson(KEY, migrated);
  return migrated;
}

export function saveCompanionQuests(state: CompanionQuestState) {
  setStoredJson(KEY, normaliseState(state));
}

export function emptyCompanionQuestState(): CompanionQuestState {
  return { schemaVersion: 3, quests: [], submissions: [], offerCycles: [], attempts: [] };
}

export function migrateCompanionQuestIdentity(
  state: CompanionQuestState,
  resolveCompanionId: (value: string) => string
): CompanionQuestState {
  let changed = false;
  const resolve = (value: string) => {
    const next = resolveCompanionId(value);
    if (next !== value) changed = true;
    return next;
  };
  const resolveQuestOwner = (value: string, questId: string) => {
    const familyId = questDefinition(questId)?.familyId;
    const next = familyId ? `companion:${familyId}` : resolve(value);
    if (next !== value) changed = true;
    return next;
  };
  const migrated: CompanionQuestState = {
    ...state,
    quests: state.quests.map((quest) => ({
      ...quest,
      creatureId: resolveQuestOwner(quest.creatureId, quest.questId),
    })),
    submissions: state.submissions.map((submission) => ({
      ...submission,
      creatureId: resolveQuestOwner(submission.creatureId, submission.questId),
    })),
    offerCycles: state.offerCycles.map((cycle) => {
      const creatureId = resolveOfferCycleOwner(cycle, resolve);
      if (creatureId !== cycle.creatureId) changed = true;
      return { ...cycle, creatureId };
    }),
    attempts: state.attempts.map((attempt) => ({
      ...attempt,
      creatureId: resolveQuestOwner(attempt.creatureId, attempt.questId),
    })),
  };
  return changed ? normaliseState(migrated) : state;
}

function resolveOfferCycleOwner(
  cycle: QuestOfferCycle,
  resolveFallback: (value: string) => string
): string {
  const familyIds = new Set(
    cycle.offerIds
      .map((questId) => questDefinition(questId)?.familyId)
      .filter((familyId): familyId is NonNullable<typeof familyId> => Boolean(familyId))
  );
  return familyIds.size === 1
    ? `companion:${[...familyIds][0]}`
    : resolveFallback(cycle.creatureId);
}

export function questOfferForDay<T extends { id: string; weight?: number }>(
  state: CompanionQuestState,
  creatureId: string,
  dayId: string,
  offers: T[]
): T | undefined {
  if (!offers.length) return undefined;
  const cycle = state.offerCycles.find((item) => item.creatureId === creatureId && item.dayId === dayId);
  const order = currentQuestOfferOrder(cycle, offers, `${creatureId}:${dayId}`);
  const offerId = order[Math.max(0, cycle?.index ?? 0) % order.length];
  return offers.find((offer) => offer.id === offerId) ?? offers[0];
}

export function questOffersForDay<T extends { id: string; weight?: number }>(
  state: CompanionQuestState,
  creatureId: string,
  dayId: string,
  offers: T[],
  limit = 3
): T[] {
  if (!offers.length || limit <= 0) return [];
  const cycle = state.offerCycles.find((item) => item.creatureId === creatureId && item.dayId === dayId);
  const order = currentQuestOfferOrder(cycle, offers, `${creatureId}:${dayId}`);
  return order
    .map((id) => offers.find((offer) => offer.id === id))
    .filter((offer): offer is T => Boolean(offer))
    .slice(0, limit);
}

function currentQuestOfferOrder<T extends { id: string; weight?: number }>(
  cycle: QuestOfferCycle | undefined,
  offers: T[],
  seed: string
): string[] {
  const currentIds = new Set(offers.map((offer) => offer.id));
  const cachedIds = cycle?.offerIds ?? [];
  const cacheMatchesCurrentPool =
    cachedIds.length === currentIds.size &&
    cachedIds.every((id) => currentIds.has(id));
  return cacheMatchesCurrentPool ? cachedIds : rankedQuestOfferIds(offers, seed);
}

export function cycleQuestOffer<T extends { id: string; weight?: number }>(
  state: CompanionQuestState,
  creatureId: string,
  dayId: string,
  offers: T[]
): { state: CompanionQuestState; offer: T | undefined } {
  if (questFor(state, creatureId) || offers.length < 2) return { state, offer: questOfferForDay(state, creatureId, dayId, offers) };
  const offerIds = rankedQuestOfferIds(offers, `${creatureId}:${dayId}`);
  const previous = state.offerCycles.find((item) => item.creatureId === creatureId && item.dayId === dayId);
  const nextCycle: QuestOfferCycle = {
    creatureId,
    dayId,
    offerIds,
    index: ((previous?.index ?? 0) + 1) % offerIds.length,
  };
  const next = {
    ...state,
    offerCycles: [...state.offerCycles.filter((item) => item.creatureId !== creatureId || item.dayId !== dayId), nextCycle],
  };
  return { state: next, offer: questOfferForDay(next, creatureId, dayId, offers) };
}

export function activeQuests(state: CompanionQuestState): CompanionQuest[] {
  return state.quests.filter((quest) => !quest.completedAt);
}

export function questFor(state: CompanionQuestState, creatureId: string): CompanionQuest | null {
  return activeQuests(state).find((quest) => quest.creatureId === creatureId) ?? null;
}

export function hasCompanionQuestForDay(
  state: CompanionQuestState,
  creatureId: string,
  dayId: string
): boolean {
  const ignoreCompletedHistory = isQuestLoopAfterCompleteEnabled();
  return state.quests.some((quest) => {
    if (quest.creatureId !== creatureId) return false;
    if (ignoreCompletedHistory && quest.completedAt) return false;
    return questDayId(quest.acceptedAt, quest.acceptedDayId) === dayId || questDayId(quest.completedAt, quest.completedDayId) === dayId;
  });
}

// The village status glyph for a resident (docs/katchimera-engagement-v1.md):
//   offer  → gold '!'  (a quest to accept)
//   active → gray '?'  (accepted, not finished)
//   ready  → gold '?'  (finished — tap to report back)
//   idle   → nothing
export type InteractionState = 'offer' | 'active' | 'ready' | 'idle';
export function interactionState(
  state: CompanionQuestState,
  creatureId: string,
  facts: Partial<Facts>,
  hasOffer: boolean,
  capabilities?: QuestCapabilityMap | null
): InteractionState {
  const active = questFor(state, creatureId);
  if (active) {
    const runtime = evaluateQuestRuntime({ questId: active.questId, questRunId: active.questRunId, facts, capabilities });
    return runtime.complete || runtime.readyToSubmit || runtime.possibleEvidenceIds.length > 0 ? 'ready' : 'active';
  }
  return hasOffer ? 'offer' : 'idle';
}

/** Accept a quest offer; returns null (unchanged) if caps are hit. */
export function acceptQuest(
  state: CompanionQuestState,
  offer: { questId: string; creatureId: string; title: string; hint: string; dayId?: string | null; offerSeed?: string; resolvedConfig?: Record<string, unknown> },
  acceptedAt: number
): CompanionQuestState | null {
  if (questFor(state, offer.creatureId)) return null;
  if (offer.dayId && hasCompanionQuestForDay(state, offer.creatureId, offer.dayId)) return null;
  if (activeQuests(state).length >= MAX_ACTIVE_QUESTS) return null;
  const questRunId = createQuestRunId(offer.questId, offer.creatureId, acceptedAt);
  return {
    ...state,
    quests: [
      ...state.quests,
      {
        questId: offer.questId,
        creatureId: offer.creatureId,
        title: offer.title,
        hint: offer.hint,
        acceptedAt,
        acceptedDayId: offer.dayId ?? localDayId(acceptedAt),
        offerSeed: offer.offerSeed,
        resolvedConfig: offer.resolvedConfig,
        questRunId,
      },
    ],
  };
}

/**
 * Old profiles can contain active quest rows created before the current
 * subtype-driven mapping existed. Keep completed history intact, but make the
 * active row match the companion's current data-driven offer.
 */
export function reconcileCompanionQuestOffer(
  state: CompanionQuestState,
  offer: { questId: string; creatureId: string; title: string; hint: string },
  repairedAt: number
): CompanionQuestState {
  const active = questFor(state, offer.creatureId);
  if (!active) return state;
  if (active.questId === offer.questId && active.title === offer.title && active.hint === offer.hint) {
    return state;
  }

  return {
    ...state,
    quests: state.quests.map((quest) =>
      quest.creatureId === offer.creatureId && !quest.completedAt
        ? {
            ...quest,
            ...offer,
            repairedAt,
            repairedFromQuestId: quest.questId === offer.questId ? quest.repairedFromQuestId : quest.questId,
          }
        : quest
    ),
  };
}

// Live acceptance-criteria checklist for the journal — delegated to the
// generic engine so copy + logic live in ONE place (utils/quests/definitions).
export function questCriteria(questId: string, facts: Partial<Facts>): { label: string; done: boolean }[] {
  return questCriteriaStatus(questId, facts);
}

/**
 * Complete any active quests whose criteria are all satisfied by today's
 * facts. Returns the completed quests so the caller can celebrate + pay
 * rewards.
 */
export function evaluateCompanionQuests(
  state: CompanionQuestState,
  facts: Partial<Facts>,
  now: number,
  capabilities?: QuestCapabilityMap | null,
  dayId?: string | null
): { state: CompanionQuestState; completed: CompanionQuest[] } {
  const loopAfterComplete = isQuestLoopAfterCompleteEnabled();
  const completed: CompanionQuest[] = [];
  const quests = state.quests.flatMap((quest) => {
    const runtime = evaluateQuestRuntime({ questId: quest.questId, facts, capabilities });
    if (quest.completedAt || !runtime.complete) {
      return [quest];
    }
    const done = { ...quest, completedAt: now, completedDayId: dayId ?? localDayId(now) };
    completed.push(done);
    return loopAfterComplete ? [] : [done];
  });
  return { state: { ...state, quests }, completed };
}

export function completeQuest(
  state: CompanionQuestState,
  creatureId: string,
  completedAt: number,
  dayId?: string | null
): CompanionQuestState {
  if (isQuestLoopAfterCompleteEnabled()) {
    return {
      ...state,
      quests: state.quests.filter((quest) => quest.creatureId !== creatureId || quest.completedAt),
    };
  }
  return {
    ...state,
    quests: state.quests.map((quest) =>
      quest.creatureId === creatureId && !quest.completedAt
        ? { ...quest, completedAt, completedDayId: dayId ?? localDayId(completedAt) }
        : quest
    ),
  };
}

export function releaseActiveQuest(
  state: CompanionQuestState,
  creatureId: string
): CompanionQuestState {
  return {
    ...state,
    quests: state.quests.filter((quest) => quest.creatureId !== creatureId || Boolean(quest.completedAt)),
  };
}

export function reconcileActiveQuestPool(
  state: CompanionQuestState,
  creatureId: string,
  offers: readonly { id: string }[]
): CompanionQuestState {
  const active = questFor(state, creatureId);
  if (!active || !offers.length || offers.some((offer) => offer.id === active.questId)) {
    return state;
  }
  return releaseActiveQuest(state, creatureId);
}

export function submitQuest(
  state: CompanionQuestState,
  creatureId: string,
  submission: QuestSubmissionInput,
  submittedAt: number,
  dayId?: string | null
): { state: CompanionQuestState; quest: CompanionQuest | null; submitted: boolean } {
  const active = questFor(state, creatureId);
  if (!active || !submission.sourceId) return { state, quest: active, submitted: false };
  const resolvedDayId = dayId ?? localDayId(submittedAt);
  const submissions = state.submissions ?? [];
  if (isSubmittedForQuest(submissions, active.questId, active.creatureId, submission.sourceType, submission.sourceId)) {
    return { state, quest: active, submitted: false };
  }

  const record: QuestSubmissionRecord = {
    id: `${active.questId}:${active.creatureId}:${submission.sourceType}:${submission.sourceId}:${submittedAt}`,
    questId: active.questId,
    creatureId: active.creatureId,
    dayId: resolvedDayId,
    sourceType: submission.sourceType,
    sourceId: submission.sourceId,
    evidenceId: submission.evidenceId ?? null,
    submittedAt,
    questRunId: active.questRunId ?? createQuestRunId(active.questId, active.creatureId, active.acceptedAt),
    journalRecordId: submission.journalRecordId ?? null,
    verificationSource: submission.verificationSource ?? 'legacy',
  };
  const done = { ...active, completedAt: submittedAt, completedDayId: resolvedDayId };
  const quests = isQuestLoopAfterCompleteEnabled()
    ? state.quests.filter((quest) => quest !== active)
    : state.quests.map((quest) => (quest === active ? done : quest));
  return {
    state: { ...state, quests, submissions: [...submissions, record] },
    quest: done,
    submitted: true,
  };
}

export function isSubmittedForQuest(
  submissions: QuestSubmissionRecord[] | undefined,
  questId: string,
  creatureId: string,
  sourceType: string,
  sourceId: string
): boolean {
  return (submissions ?? []).some(
    (record) =>
      record.questId === questId &&
      record.creatureId === creatureId &&
      record.sourceType === sourceType &&
      record.sourceId === sourceId
  );
}

function normaliseState(value: CompanionQuestState | null | undefined, cancelInterrupted = false): CompanionQuestState {
  return {
    schemaVersion: 3,
    quests: value && Array.isArray(value.quests) ? value.quests.map((quest) => ({
      ...quest,
      questRunId: quest.questRunId ?? createQuestRunId(quest.questId, quest.creatureId, quest.acceptedAt),
    })) : [],
    submissions: value && Array.isArray(value.submissions) ? value.submissions : [],
    offerCycles: value && Array.isArray(value.offerCycles) ? value.offerCycles : [],
    attempts: value && Array.isArray(value.attempts)
      ? value.attempts.map((attempt) => cancelInterrupted && attempt.status === 'running'
        ? { ...attempt, status: 'cancelled' as const, endedAt: Date.now() }
        : attempt)
      : [],
  };
}

export function createQuestRunId(questId: string, creatureId: string, acceptedAt: number): string {
  return `quest-run:${creatureId}:${questId}:${acceptedAt.toString(36)}`;
}

export function startQuestAttempt(
  state: CompanionQuestState,
  input: Omit<QuestAttempt, 'id' | 'status' | 'startedAt'>,
  startedAt = Date.now()
): { state: CompanionQuestState; attempt: QuestAttempt } {
  const running = state.attempts.find((attempt) =>
    attempt.questId === input.questId &&
    attempt.creatureId === input.creatureId &&
    attempt.dayId === input.dayId &&
    attempt.status === 'running'
  );
  if (running) return { state, attempt: running };
  const attempt: QuestAttempt = {
    ...input,
    id: `${input.questId}:${input.creatureId}:${input.dayId}:${startedAt}`,
    status: 'running',
    startedAt,
  };
  return { state: { ...state, attempts: [...state.attempts, attempt] }, attempt };
}

export function cancelQuestAttempt(state: CompanionQuestState, attemptId: string, endedAt = Date.now()): CompanionQuestState {
  return {
    ...state,
    attempts: state.attempts.map((attempt) =>
      attempt.id === attemptId && attempt.status === 'running'
        ? { ...attempt, status: 'cancelled', endedAt }
        : attempt
    ),
  };
}

export function completeInteractiveQuest(
  state: CompanionQuestState,
  input: { attemptId: string; creatureId: string; result: QuestResult; dayId: string },
  completedAt = Date.now()
): CompanionQuestState {
  const existing = state.attempts.find((attempt) => attempt.id === input.attemptId);
  if (!existing || existing.status === 'succeeded') return state;
  const result = withPersonalBest(state, existing.questId, input.result);
  const withResult: CompanionQuestState = {
    ...state,
    attempts: state.attempts.map((attempt) =>
      attempt.id === input.attemptId
        ? { ...attempt, status: 'succeeded', endedAt: completedAt, result }
        : attempt
    ),
  };
  return completeQuest(withResult, input.creatureId, completedAt, input.dayId);
}

function withPersonalBest(state: CompanionQuestState, questId: string, result: QuestResult): QuestResult {
  const previous = state.attempts.filter((attempt) => attempt.questId === questId && attempt.result?.kind === result.kind).map((attempt) => attempt.result!);
  if (result.kind === 'live_steps') return { ...result, personalBest: !previous.some((item) => item.kind === 'live_steps' && item.target === result.target && item.durationMs <= result.durationMs) };
  if (result.kind === 'timing_zone') return { ...result, personalBest: !previous.some((item) => item.kind === 'timing_zone' && (item.accuracy > result.accuracy || (item.accuracy === result.accuracy && item.averageOffsetMs <= result.averageOffsetMs))) };
  if (result.kind === 'pattern_memory') return { ...result, personalBest: !previous.some((item) => item.kind === 'pattern_memory' && (item.completedRounds > result.completedRounds || (item.completedRounds === result.completedRounds && item.durationMs <= result.durationMs))) };
  if (result.kind === 'sorting') {
    const packId = result.packId ?? 'feastle-table';
    return {
      ...result,
      personalBest: result.success && !previous.some((item) =>
        item.kind === 'sorting' &&
        item.success &&
        (item.packId ?? 'feastle-table') === packId &&
        item.totalItems === result.totalItems &&
        item.durationMs <= result.durationMs
      ),
    };
  }
  if (result.kind === 'matching') {
    const packId = result.packId ?? 'relicoon-gallery';
    return {
      ...result,
      personalBest: result.success && !previous.some((item) =>
        item.kind === 'matching' &&
        item.success &&
        (item.packId ?? 'relicoon-gallery') === packId &&
        item.pairs === result.pairs &&
        item.durationMs <= result.durationMs
      ),
    };
  }
  if (result.kind === 'merge') {
    return {
      ...result,
      personalBest: result.success && !previous.some((item) =>
        item.kind === 'merge' &&
        item.success &&
        item.packId === result.packId &&
        item.ordersTotal === result.ordersTotal &&
        (item.durationMs < result.durationMs || (item.durationMs === result.durationMs && item.movesUsed <= result.movesUsed))
      ),
    };
  }
  if (result.kind === 'block_jam') {
    return {
      ...result,
      personalBest: result.success && !previous.some((item) =>
        item.kind === 'block_jam' && item.success && item.rulesetId === result.rulesetId && item.packId === result.packId && item.levelId === result.levelId &&
        (item.durationMs < result.durationMs || (item.durationMs === result.durationMs && item.movesUsed <= result.movesUsed))
      ),
    };
  }
  if (result.kind === 'block_blast') {
    return {
      ...result,
      personalBest: !previous.some((item) =>
        item.kind === 'block_blast' && item.rulesetId === result.rulesetId && item.score >= result.score
      ),
    };
  }
  if (result.kind === 'rhythm') return { ...result, personalBest: !previous.some((item) => item.kind === 'rhythm' && (item.score > result.score || (item.score === result.score && item.durationMs <= result.durationMs))) };
  return result;
}

function questDayId(timestamp?: number, explicitDayId?: string): string | null {
  return explicitDayId ?? (typeof timestamp === 'number' ? localDayId(timestamp) : null);
}

function localDayId(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
