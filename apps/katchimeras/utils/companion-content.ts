import { migrateStepplingDayOneSession } from './steppling-day-one-session';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import type {
  ConversationSession,
  ConversationTelemetryEvent,
} from '@/types/companion-conversation';
import type { CompanionEvidenceRef } from '@/types/companion-interaction';
import { canonicalFamilyId } from '@/constants/katchimera-skins';

export type CompanionMemory = {
  id: string;
  scope: 'player' | 'family';
  familyId?: KatchimeraFamilyId;
  kind: 'confirmed_fact' | 'preference' | 'pattern' | 'shared_moment' | 'open_thread' | 'milestone';
  key: string;
  summary: string;
  /** Natural-language question shown before a provisional pattern is saved. */
  confirmationPrompt?: string;
  /** Human-readable provenance without exposing raw journal text. */
  evidenceSummary?: string;
  evidenceRefs: CompanionEvidenceRef[];
  confidence: number;
  status: 'provisional' | 'confirmed' | 'rejected' | 'forgotten';
  sensitivity: 'ordinary' | 'personal';
  firstRecordedAt: number;
  lastConfirmedAt?: number;
  lastUsedAt?: number;
};

export type CompanionInsightRevision = {
  resultId: string;
  title: string;
  summary: string;
  supportingTraits: string[];
  secondaryResultId?: string;
  secondaryTitle?: string;
  confidence?: 'clear' | 'mixed';
  recordedAt: number;
};

export type CompanionInsightRecord = {
  id: string;
  familyId: KatchimeraFamilyId;
  insightKey: string;
  category: string;
  resultId: string;
  title: string;
  summary: string;
  emblemId: string;
  supportingTraits: string[];
  secondaryResultId?: string;
  secondaryTitle?: string;
  confidence?: 'clear' | 'mixed';
  scoreMargin?: number;
  evidenceRefs: CompanionEvidenceRef[];
  sourceDefinitionId: string;
  sourceSessionId: string;
  revisions: CompanionInsightRevision[];
  discoveredAt: number;
  updatedAt: number;
};

export type CompanionContentState = {
  schemaVersion: 8;
  memories: CompanionMemory[];
  insights: CompanionInsightRecord[];
  conversationSessions: ConversationSession[];
  servedConversationDayKeys: string[];
  conversationTelemetry: ConversationTelemetryEvent[];
};

export function emptyCompanionContentState(): CompanionContentState {
  return {
    schemaVersion: 8,
    memories: [],
    insights: [],
    conversationSessions: [],
    servedConversationDayKeys: [],
    conversationTelemetry: [],
  };
}

/**
 * V8 (Sept 2026) keeps only what the current companion pages read: Long
 * Memory, insights, conversation sessions, the days a family was served, and
 * conversation telemetry. Invitations, visits, introductions, visit plans and
 * receipts, content events and conversation signals belonged to the retired
 * interaction generation and are dropped on load.
 */
export function normaliseCompanionContentState(value: unknown): CompanionContentState {
  if (!value || typeof value !== 'object') return emptyCompanionContentState();
  const candidate = value as Partial<CompanionContentState>;
  const storedMemories = Array.isArray(candidate.memories) ? candidate.memories.filter(isMemory) : [];
  // V4 promoted questionnaire/check-in answers into confirmed facts. V5 keeps
  // those answers in their owning Focus or conversation and reserves Long
  // Memory for explicit moments, threads, milestones and evidence-specific
  // pattern detectors.
  const memories = uniqueById(storedMemories.map((memory) => {
    if (memory.scope !== 'family' || !memory.familyId) return memory;
    return { ...memory, familyId: canonicalFamilyId(memory.familyId) ?? memory.familyId };
  })).filter(isDurableV5Memory).slice(-3000);
  return {
    schemaVersion: 8,
    memories,
    insights: uniqueById((Array.isArray(candidate.insights) ? candidate.insights.filter(isInsight) : []).map((insight) => ({
      ...insight,
      familyId: canonicalFamilyId(insight.familyId) ?? insight.familyId,
    }))).slice(-1000),
    conversationSessions: uniqueById((Array.isArray(candidate.conversationSessions) ? candidate.conversationSessions.filter(isConversationSession).map(migrateStepplingDayOneSession) : [])).slice(-2000),
    servedConversationDayKeys: [...new Set(Array.isArray(candidate.servedConversationDayKeys) ? candidate.servedConversationDayKeys.filter((key): key is string => typeof key === 'string') : [])].slice(-2000),
    conversationTelemetry: uniqueById((Array.isArray(candidate.conversationTelemetry) ? candidate.conversationTelemetry.filter(isConversationTelemetry) : [])).slice(-6000),
  };
}

/**
 * Removes conversation state produced by one local day while preserving
 * prior-day history. This gives developer Today resets the same "never
 * served" semantics as a genuinely new day.
 */
export function resetCompanionContentForDay(
  state: CompanionContentState,
  dayId: string,
): CompanionContentState {
  const removedSessions = state.conversationSessions.filter((session) => (
    session.createdDayId === dayId || session.servedDayId === dayId
  ));
  const removedSessionIds = new Set(removedSessions.map((session) => session.id));
  const removedEvidenceIds = new Set([
    ...removedSessionIds,
    ...removedSessions.flatMap((session) => session.evidenceRefs.map((evidence) => evidence.sourceId)),
  ]);
  const belongsToResetDay = (evidence: CompanionEvidenceRef) => (
    evidence.dayId === dayId
    || removedSessionIds.has(evidence.sourceId)
    || removedEvidenceIds.has(evidence.sourceId)
  );

  return normaliseCompanionContentState({
    ...state,
    memories: state.memories.filter((memory) => !memory.evidenceRefs.some(belongsToResetDay)),
    insights: state.insights.filter((insight) => (
      !removedSessionIds.has(insight.sourceSessionId)
      && !insight.evidenceRefs.some(belongsToResetDay)
    )),
    conversationSessions: state.conversationSessions.filter((session) => !removedSessionIds.has(session.id)),
    servedConversationDayKeys: state.servedConversationDayKeys.filter((key) => !key.endsWith(`:${dayId}`)),
    conversationTelemetry: state.conversationTelemetry.filter((event) => !removedSessionIds.has(event.sessionId)),
  });
}

export function memoriesForFamily(
  state: CompanionContentState,
  familyId: KatchimeraFamilyId,
  options: { includeProvisional?: boolean; includeInactive?: boolean } = {}
): CompanionMemory[] {
  const ownerFamilyId = canonicalFamilyId(familyId) ?? familyId;
  return state.memories
    .filter((memory) => memory.scope === 'player' || memory.familyId === ownerFamilyId)
    .filter((memory) => options.includeInactive || (memory.status !== 'forgotten' && memory.status !== 'rejected'))
    .filter((memory) => options.includeProvisional || memory.status === 'confirmed')
    .sort((left, right) => (right.lastConfirmedAt ?? right.firstRecordedAt) - (left.lastConfirmedAt ?? left.firstRecordedAt));
}

export function insightsForFamily(
  state: CompanionContentState,
  familyId?: KatchimeraFamilyId | null
): CompanionInsightRecord[] {
  const ownerFamilyId = familyId ? canonicalFamilyId(familyId) ?? familyId : null;
  return state.insights
    .filter((insight) => !ownerFamilyId || insight.familyId === ownerFamilyId)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function upsertCompanionInsight(
  state: CompanionContentState,
  insight: Omit<CompanionInsightRecord, 'id' | 'revisions' | 'discoveredAt' | 'updatedAt'> & { recordedAt?: number }
): CompanionContentState {
  const recordedAt = insight.recordedAt ?? Date.now();
  const familyId = canonicalFamilyId(insight.familyId) ?? insight.familyId;
  const id = `companion-insight:${familyId}:${insight.insightKey}`;
  const existing = state.insights.find((item) => item.id === id);
  if (existing?.sourceSessionId === insight.sourceSessionId && existing.resultId === insight.resultId) return state;
  const revisions = existing && existing.resultId !== insight.resultId
    ? [...existing.revisions, {
        resultId: existing.resultId,
        title: existing.title,
        summary: existing.summary,
        supportingTraits: [...existing.supportingTraits],
        ...(existing.secondaryResultId ? { secondaryResultId: existing.secondaryResultId } : {}),
        ...(existing.secondaryTitle ? { secondaryTitle: existing.secondaryTitle } : {}),
        ...(existing.confidence ? { confidence: existing.confidence } : {}),
        recordedAt: existing.updatedAt,
      }].slice(-20)
    : existing?.revisions ?? [];
  const next: CompanionInsightRecord = {
    ...insight,
    id,
    familyId,
    revisions,
    discoveredAt: existing?.discoveredAt ?? recordedAt,
    updatedAt: recordedAt,
  };
  return { ...state, insights: [...state.insights.filter((item) => item.id !== id), next] };
}

export function removeCompanionInsight(state: CompanionContentState, insightId: string): CompanionContentState {
  const insights = state.insights.filter((insight) => insight.id !== insightId);
  return insights.length === state.insights.length ? state : { ...state, insights };
}

export function activeConversationSessionForFamily(
  state: CompanionContentState,
  familyId: KatchimeraFamilyId
): ConversationSession | null {
  const ownerFamilyId = canonicalFamilyId(familyId) ?? familyId;
  return [...state.conversationSessions]
    .reverse()
    .find((session) => session.familyId === ownerFamilyId && !session.preview && session.status === 'active') ?? null;
}

export function previewConversationSessionForFamily(
  state: CompanionContentState,
  familyId: KatchimeraFamilyId
): ConversationSession | null {
  const ownerFamilyId = canonicalFamilyId(familyId) ?? familyId;
  return [...state.conversationSessions]
    .reverse()
    .find((session) => session.familyId === ownerFamilyId && session.preview && session.status !== 'archived') ?? null;
}

export function conversationSessionForDay(
  state: CompanionContentState,
  familyId: KatchimeraFamilyId,
  dayId: string
): ConversationSession | null {
  const ownerFamilyId = canonicalFamilyId(familyId) ?? familyId;
  return state.conversationSessions.find((session) => session.familyId === ownerFamilyId && !session.preview && session.createdDayId === dayId) ?? null;
}

export function upsertConversationSession(
  state: CompanionContentState,
  session: ConversationSession
): CompanionContentState {
  const servedKey = `${session.familyId}:${session.servedDayId}`;
  return {
    ...state,
    conversationSessions: [...state.conversationSessions.filter((item) => item.id !== session.id), session],
    servedConversationDayKeys: session.status === 'completed' && !session.preview
      ? [...new Set([...state.servedConversationDayKeys, servedKey])]
      : state.servedConversationDayKeys,
  };
}

export function recordConversationTelemetry(
  state: CompanionContentState,
  event: ConversationTelemetryEvent
): CompanionContentState {
  if (state.conversationTelemetry.some((item) => item.id === event.id)) return state;
  return { ...state, conversationTelemetry: [...state.conversationTelemetry, event].slice(-6000) };
}

export function upsertCompanionMemory(
  state: CompanionContentState,
  memory: CompanionMemory
): CompanionContentState {
  const normalised = memory.scope === 'family' && memory.familyId
    ? { ...memory, familyId: canonicalFamilyId(memory.familyId) ?? memory.familyId }
    : memory;
  return {
    ...state,
    memories: [...state.memories.filter((item) => item.id !== normalised.id), normalised],
  };
}

export function updateCompanionMemoryStatus(
  state: CompanionContentState,
  input: {
    memoryId: string;
    status: 'confirmed' | 'rejected' | 'forgotten';
    summary?: string;
    occurredAt?: number;
    familyId: KatchimeraFamilyId;
    dayId: string;
  }
): CompanionContentState {
  const occurredAt = input.occurredAt ?? Date.now();
  const existing = state.memories.find((memory) => memory.id === input.memoryId);
  if (!existing) return state;
  const updated: CompanionMemory = {
    ...existing,
    status: input.status,
    ...(input.summary?.trim() ? { summary: input.summary.trim() } : {}),
    ...(input.status === 'confirmed' ? { lastConfirmedAt: occurredAt } : {}),
  };
  let next = upsertCompanionMemory(state, updated);
  if (input.status === 'confirmed' && updated.kind === 'pattern' && updated.familyId && updated.evidenceRefs.length >= 3) {
    const presentation = journalPatternPresentation(updated.familyId, updated.key);
    if (presentation) next = upsertCompanionInsight(next, {
      familyId: updated.familyId,
      insightKey: `journal:${updated.key}`,
      category: presentation.category,
      resultId: updated.key,
      title: presentation.title,
      summary: `${updated.summary} ${updated.evidenceSummary ?? ''}`.trim(),
      emblemId: presentation.emblemId,
      supportingTraits: [presentation.trait, updated.evidenceSummary ?? 'Repeated across recorded days'],
      evidenceRefs: updated.evidenceRefs,
      sourceDefinitionId: `journal-pattern:${updated.key}`,
      sourceSessionId: updated.id,
      recordedAt: occurredAt,
    });
  }
  return next;
}

function journalPatternPresentation(familyId: KatchimeraFamilyId, key: string): { category: string; title: string; trait: string; emblemId: string } | null {
  if (familyId === 'baristabbit' && key.includes('cafe-pauses')) return { category: 'Real life', title: 'Your Recurring Cup', trait: 'A ritual that keeps returning', emblemId: 'barista-journal-recurring-cup' };
  if (familyId === 'steppling' && key.includes('movement-on-foot')) return { category: 'Real life', title: 'The Route That Returns', trait: 'Movement across different days', emblemId: 'steppling-journal-returning-route' };
  if (familyId === 'flexel' && key.includes('movement-practice')) return { category: 'Real life', title: 'The Practice That Returns', trait: 'Practice across different days', emblemId: 'flexel-journal-returning-practice' };
  return null;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function isMemory(value: unknown): value is CompanionMemory {
  const item = value as CompanionMemory;
  return Boolean(
    item
      && typeof item.id === 'string'
      && typeof item.key === 'string'
      && typeof item.summary === 'string'
      && Array.isArray(item.evidenceRefs)
      && ['provisional', 'confirmed', 'rejected', 'forgotten'].includes(item.status)
  );
}

function isInsight(value: unknown): value is CompanionInsightRecord {
  const item = value as CompanionInsightRecord;
  return Boolean(
    item
      && typeof item.id === 'string'
      && typeof item.familyId === 'string'
      && typeof item.insightKey === 'string'
      && typeof item.resultId === 'string'
      && typeof item.title === 'string'
      && typeof item.summary === 'string'
      && typeof item.emblemId === 'string'
      && Array.isArray(item.supportingTraits)
      && Array.isArray(item.evidenceRefs)
      && Array.isArray(item.revisions)
      && typeof item.updatedAt === 'number'
  );
}

function isDurableV5Memory(memory: CompanionMemory): boolean {
  if (memory.kind === 'confirmed_fact') return false;
  if (memory.kind === 'pattern') return memory.key.startsWith('pattern:v2:');
  return true;
}

function isConversationSession(value: unknown): value is ConversationSession {
  const item = value as ConversationSession;
  return Boolean(
    item
      && typeof item.id === 'string'
      && typeof item.definitionId === 'string'
      && typeof item.familyId === 'string'
      && typeof item.createdDayId === 'string'
      && typeof item.currentNodeId === 'string'
      && Array.isArray(item.turns)
      && ['active', 'completed', 'archived'].includes(item.status)
  );
}

function isConversationTelemetry(value: unknown): value is ConversationTelemetryEvent {
  const item = value as ConversationTelemetryEvent;
  return Boolean(item && typeof item.id === 'string' && typeof item.sessionId === 'string' && typeof item.definitionId === 'string' && typeof item.kind === 'string');
}
