import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import {
  emptyCompanionContentState,
  normaliseCompanionContentState,
  type CompanionContentState,
} from '@/utils/companion-content';
import { isConversationV2Family } from '@/types/companion-conversation';

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

export function resetIdealSkinOnboardingForDebug(): void {
  const state = loadCompanionContentState();
  const isIdealSkinDefinition = (definitionId: string) => definitionId.endsWith(':game:form-finder');
  saveCompanionContentState({
    ...state,
    conversationSessions: state.conversationSessions.filter((session) => !isConversationV2Family(session.familyId)),
    conversationSignals: state.conversationSignals.filter((signal) => !isConversationV2Family(signal.familyId)),
    conversationTelemetry: state.conversationTelemetry.filter((event) => !isConversationV2Family(event.familyId)),
    servedConversationDayKeys: state.servedConversationDayKeys.filter((key) => !['baristabbit:', 'steppling:', 'flexel:'].some((prefix) => key.startsWith(prefix))),
    insights: state.insights.filter((insight) => !isIdealSkinDefinition(insight.sourceDefinitionId)),
    memories: state.memories.filter((memory) => !memory.key.includes(':form-match')),
  });
  resetListeners.forEach((listener) => listener());
}

export function subscribeCompanionContentResets(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => resetListeners.delete(listener);
}
