import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import type { QuestCapabilityMap } from '@/utils/capabilities/quest-capabilities';
import { evaluateQuestRuntime } from '@/utils/quests/runtime';
import type { Facts } from '@/utils/signals/facts';
import { questCriteriaStatus } from '@/utils/quests/evaluate';

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

export type CompanionQuestState = { quests: CompanionQuest[] };

const KEY = 'katchadeck.companion-quests-v1';
// No global cap for now — a katchimera still only holds one quest at a time.
export const MAX_ACTIVE_QUESTS = Infinity;

export function loadCompanionQuests(): CompanionQuestState {
  const value = getStoredJson<CompanionQuestState>(KEY, { quests: [] });
  return value && Array.isArray(value.quests) ? value : { quests: [] };
}

export function saveCompanionQuests(state: CompanionQuestState) {
  setStoredJson(KEY, state);
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
  return state.quests.some((quest) => {
    if (quest.creatureId !== creatureId) return false;
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
  if (active) return evaluateQuestRuntime({ questId: active.questId, facts, capabilities }).complete ? 'ready' : 'active';
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
  const completed: CompanionQuest[] = [];
  const quests = state.quests.map((quest) => {
    if (quest.completedAt || !evaluateQuestRuntime({ questId: quest.questId, facts, capabilities }).complete) {
      return quest;
    }
    const done = { ...quest, completedAt: now, completedDayId: dayId ?? localDayId(now) };
    completed.push(done);
    return done;
  });
  return { state: { quests }, completed };
}

export function completeQuest(
  state: CompanionQuestState,
  creatureId: string,
  completedAt: number,
  dayId?: string | null
): CompanionQuestState {
  return {
    quests: state.quests.map((quest) =>
      quest.creatureId === creatureId && !quest.completedAt
        ? { ...quest, completedAt, completedDayId: dayId ?? localDayId(completedAt) }
        : quest
    ),
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
