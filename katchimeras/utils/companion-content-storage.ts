import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import {
  emptyCompanionContentState,
  normaliseCompanionContentState,
  type CompanionContentState,
} from '@/utils/companion-content';
import { CONVERSATION_V2_IDEAL_SKIN_FAMILIES, isConversationV2IdealSkinFamily } from '@/types/companion-conversation';

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
    conversationSessions: state.conversationSessions.filter((session) => !isConversationV2IdealSkinFamily(session.familyId)),
    conversationSignals: state.conversationSignals.filter((signal) => !isConversationV2IdealSkinFamily(signal.familyId)),
    conversationTelemetry: state.conversationTelemetry.filter((event) => !isConversationV2IdealSkinFamily(event.familyId)),
    servedConversationDayKeys: state.servedConversationDayKeys.filter((key) => !CONVERSATION_V2_IDEAL_SKIN_FAMILIES.some((familyId) => key.startsWith(`${familyId}:`))),
    insights: state.insights.filter((insight) => !isIdealSkinDefinition(insight.sourceDefinitionId)),
    memories: state.memories.filter((memory) => !memory.key.includes(':form-match')),
  });
  resetListeners.forEach((listener) => listener());
}

export function subscribeCompanionContentResets(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => resetListeners.delete(listener);
}
