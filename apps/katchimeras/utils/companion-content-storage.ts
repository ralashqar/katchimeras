import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import {
  emptyCompanionContentState,
  normaliseCompanionContentState,
  resetCompanionContentForDay,
  type CompanionContentState,
} from '@/utils/companion-content';

const STORAGE_KEY = 'katchadeck.companion-content-v1';
const resetListeners = new Set<() => void>();

export function loadCompanionContentState(): CompanionContentState {
  return normaliseCompanionContentState(
    getStoredJson<CompanionContentState>(STORAGE_KEY, emptyCompanionContentState())
  );
}

export function saveCompanionContentState(state: CompanionContentState): void {
  setStoredJson(STORAGE_KEY, normaliseCompanionContentState(state));
}

export function resetAllKatchimeraContentForDebug(): void {
  saveCompanionContentState(emptyCompanionContentState());
  resetListeners.forEach((listener) => listener());
}

export function resetKatchimeraContentForDayForDebug(dayId: string): void {
  saveCompanionContentState(resetCompanionContentForDay(loadCompanionContentState(), dayId));
  resetListeners.forEach((listener) => listener());
}

export function resetKatchimeraConversationDefinitionsForDebug(definitionIds: readonly string[]): void {
  const definitions = new Set(definitionIds);
  if (!definitions.size) return;
  const state = loadCompanionContentState();
  const removedSessions = state.conversationSessions.filter((session) => definitions.has(session.definitionId));
  const removedSessionIds = new Set(removedSessions.map((session) => session.id));
  const removedServedDayIds = new Set(removedSessions.map((session) => session.servedDayId));
  saveCompanionContentState({
    ...state,
    memories: state.memories.filter((memory) => !memory.evidenceRefs.some((evidence) => removedSessionIds.has(evidence.sourceId))),
    insights: state.insights.filter((insight) => !definitions.has(insight.sourceDefinitionId) && !removedSessionIds.has(insight.sourceSessionId)),
    conversationSessions: state.conversationSessions.filter((session) => !removedSessionIds.has(session.id)),
    processedConversationEvidenceIds: state.processedConversationEvidenceIds.filter((id) => !removedSessionIds.has(id)),
    servedConversationDayKeys: state.servedConversationDayKeys.filter((key) => (
      ![...removedServedDayIds].some((dayId) => key === `mossprout:${dayId}`)
    )),
    conversationTelemetry: state.conversationTelemetry.filter((event) => !definitions.has(event.definitionId) && !removedSessionIds.has(event.sessionId)),
  });
  resetListeners.forEach((listener) => listener());
}

export function subscribeCompanionContentResets(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => resetListeners.delete(listener);
}
