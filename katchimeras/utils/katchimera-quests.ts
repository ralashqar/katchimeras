import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import type { Facts } from '@/utils/signals/facts';
import { isQuestComplete, questCriteriaStatus } from '@/utils/quests/evaluate';

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
  completedAt?: number;
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
  hasOffer: boolean
): InteractionState {
  const active = questFor(state, creatureId);
  if (active) return isQuestComplete(active.questId, facts) ? 'ready' : 'active';
  return hasOffer ? 'offer' : 'idle';
}

/** Accept a quest offer; returns null (unchanged) if caps are hit. */
export function acceptQuest(
  state: CompanionQuestState,
  offer: { questId: string; creatureId: string; title: string; hint: string },
  acceptedAt: number
): CompanionQuestState | null {
  if (questFor(state, offer.creatureId)) return null;
  if (activeQuests(state).length >= MAX_ACTIVE_QUESTS) return null;
  return {
    quests: [...state.quests, { ...offer, acceptedAt }],
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
  now: number
): { state: CompanionQuestState; completed: CompanionQuest[] } {
  const completed: CompanionQuest[] = [];
  const quests = state.quests.map((quest) => {
    if (quest.completedAt || !isQuestComplete(quest.questId, facts)) return quest;
    const done = { ...quest, completedAt: now };
    completed.push(done);
    return done;
  });
  return { state: { quests }, completed };
}

export function completeQuest(state: CompanionQuestState, creatureId: string, completedAt: number): CompanionQuestState {
  return {
    quests: state.quests.map((quest) =>
      quest.creatureId === creatureId && !quest.completedAt ? { ...quest, completedAt } : quest
    ),
  };
}
