import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import type { QuestCapabilityMap } from '@/utils/capabilities/quest-capabilities';
import { evaluateQuestRuntime } from '@/utils/quests/runtime';
import type { Facts } from '@/utils/signals/facts';
import { questCriteriaStatus } from '@/utils/quests/evaluate';
import { isQuestLoopAfterCompleteEnabled } from '@/utils/dev-settings';

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
};

export type QuestSubmissionInput = {
  sourceType: string;
  sourceId: string;
  evidenceId?: string | null;
};

export type CompanionQuestState = { quests: CompanionQuest[]; submissions: QuestSubmissionRecord[] };

const KEY = 'katchadeck.companion-quests-v1';
// No global cap for now — a katchimera still only holds one quest at a time.
export const MAX_ACTIVE_QUESTS = Infinity;

export function loadCompanionQuests(): CompanionQuestState {
  const value = getStoredJson<CompanionQuestState>(KEY, { quests: [], submissions: [] });
  return normaliseState(value);
}

export function saveCompanionQuests(state: CompanionQuestState) {
  setStoredJson(KEY, normaliseState(state));
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
    const runtime = evaluateQuestRuntime({ questId: active.questId, facts, capabilities });
    return runtime.complete || runtime.readyToSubmit ? 'ready' : 'active';
  }
  return hasOffer ? 'offer' : 'idle';
}

/** Accept a quest offer; returns null (unchanged) if caps are hit. */
export function acceptQuest(
  state: CompanionQuestState,
  offer: { questId: string; creatureId: string; title: string; hint: string; dayId?: string | null },
  acceptedAt: number
): CompanionQuestState | null {
  if (questFor(state, offer.creatureId)) return null;
  if (offer.dayId && hasCompanionQuestForDay(state, offer.creatureId, offer.dayId)) return null;
  if (activeQuests(state).length >= MAX_ACTIVE_QUESTS) return null;
  return {
    quests: [
      ...state.quests,
      {
        questId: offer.questId,
        creatureId: offer.creatureId,
        title: offer.title,
        hint: offer.hint,
        acceptedAt,
        acceptedDayId: offer.dayId ?? localDayId(acceptedAt),
      },
    ],
    submissions: state.submissions ?? [],
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
    submissions: state.submissions ?? [],
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
  return { state: { quests, submissions: state.submissions ?? [] }, completed };
}

export function completeQuest(
  state: CompanionQuestState,
  creatureId: string,
  completedAt: number,
  dayId?: string | null
): CompanionQuestState {
  if (isQuestLoopAfterCompleteEnabled()) {
    return {
      quests: state.quests.filter((quest) => quest.creatureId !== creatureId || quest.completedAt),
      submissions: state.submissions ?? [],
    };
  }
  return {
    quests: state.quests.map((quest) =>
      quest.creatureId === creatureId && !quest.completedAt
        ? { ...quest, completedAt, completedDayId: dayId ?? localDayId(completedAt) }
        : quest
    ),
    submissions: state.submissions ?? [],
  };
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
  };
  const done = { ...active, completedAt: submittedAt, completedDayId: resolvedDayId };
  const quests = isQuestLoopAfterCompleteEnabled()
    ? state.quests.filter((quest) => quest !== active)
    : state.quests.map((quest) => (quest === active ? done : quest));
  return {
    state: { quests, submissions: [...submissions, record] },
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

function normaliseState(value: CompanionQuestState | null | undefined): CompanionQuestState {
  return {
    quests: value && Array.isArray(value.quests) ? value.quests : [],
    submissions: value && Array.isArray(value.submissions) ? value.submissions : [],
  };
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
