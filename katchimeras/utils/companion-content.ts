import type { CompanionContentItem } from '@/constants/companion-content';
import type { CompanionSupportStyle } from '@/constants/companion-introductions';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import type {
  ConversationSession,
  ConversationTelemetryEvent,
  QueuedConversationSignal,
} from '@/types/companion-conversation';
import { isConversationV2Family } from '@/types/companion-conversation';
import type {
  CompanionConversationReceipt,
  CompanionEvidenceRef,
  CompanionVisitPlan,
} from '@/types/companion-interaction';
import { canonicalFamilyId, companionIdForFamily } from '@/constants/katchimera-skins';

export type CompanionMemoryFact = {
  id: string;
  companionId: string;
  familyId: KatchimeraFamilyId;
  key: string;
  value: string;
  sourceId: string;
  firstRecordedAt: number;
  lastConfirmedAt: number;
};

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

export type CompanionVisitTelemetryEvent = {
  id: string;
  familyId: KatchimeraFamilyId;
  dayId: string;
  kind: 'visit_started' | 'visit_completed' | 'visit_skipped' | 'memory_proposed' | 'memory_confirmed' | 'memory_corrected' | 'memory_rejected' | 'memory_forgotten' | 'shared_history_opened' | 'plus_history_prompted';
  subject?: CompanionVisitPlan['subject'];
  occurredAt: number;
};

export type CompanionDailyInvitationKind =
  | 'resume_quest'
  | 'resume_focus'
  | 'focus_setup'
  | 'bond_moment'
  | 'progress_review'
  | 'check_in'
  | 'quest';

export type CompanionDailyInvitation = {
  id: string;
  companionId: string;
  familyId: KatchimeraFamilyId;
  dayId: string;
  kind: CompanionDailyInvitationKind;
  title: string;
  body: string;
  destination: 'quest' | 'discovery';
  contentItemId?: string;
  questId?: string;
  status: 'offered' | 'opened' | 'completed' | 'skipped';
  createdAt: number;
  openedAt?: number;
  completedAt?: number;
};

export type CompanionContentEvent = {
  id: string;
  kind: 'shown' | 'opened' | 'completed' | 'skipped';
  invitationId: string;
  companionId: string;
  familyId: KatchimeraFamilyId;
  dayId: string;
  occurredAt: number;
};

export type CompanionIntroductionAnswer = {
  nodeId: string;
  optionId: string;
  label: string;
};

export type CompanionIntroductionRecord = {
  id: string;
  companionId: string;
  familyId: KatchimeraFamilyId;
  status: 'deferred' | 'completed';
  preference?: CompanionIntroductionAnswer;
  supportStyle?: CompanionSupportStyle;
  firstSeenAt: number;
  deferredAt?: number;
  completedAt?: number;
  migrated?: boolean;
};

export type CompanionVisitRecord = {
  id: string;
  companionId: string;
  familyId: KatchimeraFamilyId;
  lastVisitedDayId: string;
  lastVisitedAt: number;
  seenSkinIds: string[];
};

export type CompanionContentState = {
  schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  invitations: CompanionDailyInvitation[];
  /** Legacy read shape. V5 normalization clears it; Focus owns its own answers. */
  memoryFacts: CompanionMemoryFact[];
  memories: CompanionMemory[];
  insights: CompanionInsightRecord[];
  visitPlans: CompanionVisitPlan[];
  conversationReceipts: CompanionConversationReceipt[];
  telemetry: CompanionVisitTelemetryEvent[];
  events: CompanionContentEvent[];
  introductions: CompanionIntroductionRecord[];
  visits: CompanionVisitRecord[];
  conversationSessions: ConversationSession[];
  conversationSignals: QueuedConversationSignal[];
  processedConversationEvidenceIds: string[];
  servedConversationDayKeys: string[];
  conversationSignalBaselineComplete: boolean;
  conversationTelemetry: ConversationTelemetryEvent[];
};

export type SelectCompanionInvitationInput = {
  state: CompanionContentState;
  companionId: string;
  familyId: KatchimeraFamilyId;
  dayId: string;
  bondLevel: 1 | 2 | 3 | 4;
  content: readonly CompanionContentItem[];
  activeQuestId?: string | null;
  activeConversationId?: string | null;
  hasActiveGoal: boolean;
  hasFocusHistory?: boolean;
  questCompletions: number;
  reflections: number;
  eligibleQuestIds: readonly string[];
  questTitles?: Readonly<Record<string, string>>;
  createdAt?: number;
};

export function emptyCompanionContentState(): CompanionContentState {
  return {
    schemaVersion: 7,
    invitations: [],
    memoryFacts: [],
    memories: [],
    insights: [],
    visitPlans: [],
    conversationReceipts: [],
    telemetry: [],
    events: [],
    introductions: [],
    visits: [],
    conversationSessions: [],
    conversationSignals: [],
    processedConversationEvidenceIds: [],
    servedConversationDayKeys: [],
    conversationSignalBaselineComplete: false,
    conversationTelemetry: [],
  };
}

export function normaliseCompanionContentState(value: unknown): CompanionContentState {
  if (!value || typeof value !== 'object') return emptyCompanionContentState();
  const candidate = value as Partial<CompanionContentState>;
  const canonicalizeOwner = <T extends { familyId: KatchimeraFamilyId; companionId: string }>(item: T): T => {
    const familyId = canonicalFamilyId(item.familyId) ?? item.familyId;
    return { ...item, familyId, companionId: companionIdForFamily(familyId) };
  };
  const storedMemories = Array.isArray(candidate.memories) ? candidate.memories.filter(isMemory) : [];
  // V4 promoted questionnaire/check-in answers into confirmed facts. V5 keeps
  // those answers in their owning Focus or conversation and reserves Long
  // Memory for explicit moments, threads, milestones and evidence-specific
  // pattern detectors.
  const memories = uniqueById(storedMemories.map((memory) => {
    if (memory.scope !== 'family' || !memory.familyId) return memory;
    return { ...memory, familyId: canonicalFamilyId(memory.familyId) ?? memory.familyId };
  })).filter(isDurableV5Memory).slice(-3000);
  const migratingToV5 = ![5, 6, 7].includes(candidate.schemaVersion ?? 0);
  const visitPlans = uniqueById((Array.isArray(candidate.visitPlans) ? candidate.visitPlans.filter(isVisitPlan) : []).map((plan) => ({
    ...plan,
    familyId: canonicalFamilyId(plan.familyId) ?? plan.familyId,
  }))).filter((plan) => !migratingToV5 || plan.subject !== 'memory_confirmation').slice(-500);
  const retainedPlanIds = new Set(visitPlans.map((plan) => plan.id));
  const conversationReceipts = uniqueById((Array.isArray(candidate.conversationReceipts) ? candidate.conversationReceipts.filter(isConversationReceipt) : []).map((receipt) => ({
    ...receipt,
    familyId: canonicalFamilyId(receipt.familyId) ?? receipt.familyId,
  }))).filter((receipt) => !migratingToV5 || retainedPlanIds.has(receipt.visitPlanId)).slice(-2000);
  const migratingToV6 = candidate.schemaVersion !== 6 && candidate.schemaVersion !== 7;
  const migratedServedDays = migratingToV6
    ? conversationReceipts
        .filter((receipt) => isConversationV2Family(receipt.familyId))
        .map((receipt) => `${receipt.familyId}:${receipt.dayId}`)
    : [];
  return {
    schemaVersion: 7,
    invitations: uniqueById((Array.isArray(candidate.invitations) ? candidate.invitations.filter(isInvitation) : []).map(canonicalizeOwner)).slice(-2000),
    memoryFacts: [],
    memories,
    insights: uniqueById((Array.isArray(candidate.insights) ? candidate.insights.filter(isInsight) : []).map((insight) => ({
      ...insight,
      familyId: canonicalFamilyId(insight.familyId) ?? insight.familyId,
    }))).slice(-1000),
    visitPlans,
    conversationReceipts,
    telemetry: uniqueById((Array.isArray(candidate.telemetry) ? candidate.telemetry.filter(isTelemetryEvent) : []).map((event) => ({
      ...event,
      familyId: canonicalFamilyId(event.familyId) ?? event.familyId,
    }))).slice(-4000),
    events: uniqueById((Array.isArray(candidate.events) ? candidate.events.filter(isContentEvent) : []).map(canonicalizeOwner)).slice(-4000),
    introductions: uniqueById((Array.isArray(candidate.introductions) ? candidate.introductions.filter(isIntroduction) : []).map(canonicalizeOwner)).slice(-200),
    visits: uniqueById((Array.isArray(candidate.visits) ? candidate.visits.filter(isVisit) : []).map(canonicalizeOwner)).slice(-200),
    conversationSessions: uniqueById((Array.isArray(candidate.conversationSessions) ? candidate.conversationSessions.filter(isConversationSession) : [])).slice(-1000),
    conversationSignals: uniqueById((Array.isArray(candidate.conversationSignals) ? candidate.conversationSignals.filter(isConversationSignal) : [])).slice(-1000),
    processedConversationEvidenceIds: [...new Set(Array.isArray(candidate.processedConversationEvidenceIds) ? candidate.processedConversationEvidenceIds.filter((id): id is string => typeof id === 'string') : [])].slice(-4000),
    servedConversationDayKeys: [...new Set([
      ...(Array.isArray(candidate.servedConversationDayKeys) ? candidate.servedConversationDayKeys.filter((key): key is string => typeof key === 'string') : []),
      ...migratedServedDays,
    ])].slice(-2000),
    conversationSignalBaselineComplete: migratingToV6 ? false : candidate.conversationSignalBaselineComplete === true,
    conversationTelemetry: uniqueById((Array.isArray(candidate.conversationTelemetry) ? candidate.conversationTelemetry.filter(isConversationTelemetry) : [])).slice(-6000),
  };
}

export function introductionForFamily(
  state: CompanionContentState,
  familyId: KatchimeraFamilyId
): CompanionIntroductionRecord | null {
  const ownerFamilyId = canonicalFamilyId(familyId) ?? familyId;
  return state.introductions.find((item) => item.familyId === ownerFamilyId) ?? null;
}

export function visitForFamily(
  state: CompanionContentState,
  familyId: KatchimeraFamilyId
): CompanionVisitRecord | null {
  const ownerFamilyId = canonicalFamilyId(familyId) ?? familyId;
  return state.visits.find((item) => item.familyId === ownerFamilyId) ?? null;
}

export function migrateCompanionIntroduction(
  state: CompanionContentState,
  input: {
    companionId: string;
    familyId: KatchimeraFamilyId;
    hasExistingRelationship: boolean;
    occurredAt?: number;
  }
): CompanionContentState {
  const familyId = canonicalFamilyId(input.familyId) ?? input.familyId;
  if (!input.hasExistingRelationship || introductionForFamily(state, familyId)) return state;
  const occurredAt = input.occurredAt ?? Date.now();
  const record: CompanionIntroductionRecord = {
    id: `companion-introduction:${familyId}`,
    companionId: companionIdForFamily(familyId),
    familyId,
    status: 'completed',
    firstSeenAt: occurredAt,
    completedAt: occurredAt,
    migrated: true,
  };
  return { ...state, introductions: [...state.introductions, record] };
}

export function deferCompanionIntroduction(
  state: CompanionContentState,
  input: {
    companionId: string;
    familyId: KatchimeraFamilyId;
    preference?: CompanionIntroductionAnswer;
    occurredAt?: number;
  }
): CompanionContentState {
  const familyId = canonicalFamilyId(input.familyId) ?? input.familyId;
  const existing = introductionForFamily(state, familyId);
  if (existing?.status === 'completed') return state;
  const occurredAt = input.occurredAt ?? Date.now();
  const record: CompanionIntroductionRecord = {
    id: `companion-introduction:${familyId}`,
    companionId: companionIdForFamily(familyId),
    familyId,
    status: 'deferred',
    ...(input.preference ? { preference: input.preference } : {}),
    firstSeenAt: existing?.firstSeenAt ?? occurredAt,
    deferredAt: occurredAt,
  };
  return {
    ...state,
    introductions: [...state.introductions.filter((item) => item.familyId !== familyId), record],
  };
}

export function completeCompanionIntroduction(
  state: CompanionContentState,
  input: {
    companionId: string;
    familyId: KatchimeraFamilyId;
    preference: CompanionIntroductionAnswer;
    supportStyle: CompanionSupportStyle;
    occurredAt?: number;
  }
): CompanionContentState {
  const familyId = canonicalFamilyId(input.familyId) ?? input.familyId;
  const existing = introductionForFamily(state, familyId);
  const occurredAt = input.occurredAt ?? Date.now();
  const record: CompanionIntroductionRecord = {
    id: `companion-introduction:${familyId}`,
    companionId: companionIdForFamily(familyId),
    familyId,
    status: 'completed',
    preference: input.preference,
    supportStyle: input.supportStyle,
    firstSeenAt: existing?.firstSeenAt ?? occurredAt,
    completedAt: occurredAt,
  };
  return {
    ...state,
    introductions: [...state.introductions.filter((item) => item.familyId !== familyId), record],
  };
}

export type CompanionVisitGreeting = 'regular' | 'returning' | 'new_skin';

export function recordCompanionVisit(
  state: CompanionContentState,
  input: {
    companionId: string;
    familyId: KatchimeraFamilyId;
    skinId: string;
    dayId: string;
    visitedAt?: number;
    returnAfterDays?: number;
  }
): { state: CompanionContentState; greeting: CompanionVisitGreeting } {
  const familyId = canonicalFamilyId(input.familyId) ?? input.familyId;
  const existing = visitForFamily(state, familyId);
  const visitedAt = input.visitedAt ?? Date.now();
  const firstSkinVisit = Boolean(existing && !existing.seenSkinIds.includes(input.skinId));
  const returning = Boolean(
    existing
      && existing.lastVisitedDayId !== input.dayId
      && dayDistance(existing.lastVisitedDayId, input.dayId) >= (input.returnAfterDays ?? 14)
  );
  const visit: CompanionVisitRecord = {
    id: `companion-visit:${familyId}`,
    companionId: companionIdForFamily(familyId),
    familyId,
    lastVisitedDayId: input.dayId,
    lastVisitedAt: visitedAt,
    seenSkinIds: [...new Set([...(existing?.seenSkinIds ?? []), input.skinId])],
  };
  return {
    greeting: firstSkinVisit ? 'new_skin' : returning ? 'returning' : 'regular',
    state: {
      ...state,
      visits: [...state.visits.filter((item) => item.familyId !== familyId), visit],
    },
  };
}

export function invitationForDay(
  state: CompanionContentState,
  companionId: string,
  dayId: string
): CompanionDailyInvitation | null {
  return state.invitations.find((item) => item.companionId === companionId && item.dayId === dayId) ?? null;
}

export function selectCompanionDailyInvitation(
  input: SelectCompanionInvitationInput
): CompanionDailyInvitation {
  const existing = invitationForDay(input.state, input.companionId, input.dayId);
  if (existing) {
    const currentContent = existing.contentItemId
      ? input.content.find((item) => item.id === existing.contentItemId)
      : null;
    return currentContent
      && (existing.title !== currentContent.title || !existing.body.startsWith(currentContent.prompt))
      ? { ...existing, title: currentContent.title, body: currentContent.prompt }
      : existing;
  }
  const createdAt = input.createdAt ?? Date.now();
  const base = {
    id: `companion-invitation:${input.companionId}:${input.dayId}`,
    companionId: input.companionId,
    familyId: input.familyId,
    dayId: input.dayId,
    status: 'offered' as const,
    createdAt,
  };
  if (input.activeQuestId) {
    return {
      ...base,
      kind: 'resume_quest',
      title: 'Pick up where you left off',
      body: input.questTitles?.[input.activeQuestId] ?? 'Your accepted quest is waiting for you.',
      destination: 'quest',
      questId: input.activeQuestId,
    };
  }
  if (input.activeConversationId) {
    return {
      ...base,
      kind: 'resume_focus',
      title: 'Continue your conversation',
      body: 'Your completed answers are already saved.',
      destination: 'discovery',
    };
  }
  if (!input.hasActiveGoal) {
    return {
      ...base,
      kind: 'focus_setup',
      title: 'Choose what matters here',
      body: 'A few gentle questions will shape future invitations.',
      destination: 'discovery',
    };
  }
  const eligibleContent = input.content.filter((item) =>
    item.minimumBondLevel <= input.bondLevel
    && (item.kind !== 'return' || input.hasFocusHistory)
    && contentIsOffCooldown(input.state, item, input.companionId, input.dayId)
  );
  const bond = eligibleContent.find((item) =>
    item.kind === 'bond_moment' && item.minimumBondLevel === input.bondLevel
  );
  const lastReview = [...input.state.invitations].reverse().find((item) =>
    item.companionId === input.companionId && item.kind === 'progress_review'
  );
  const reviewDue = input.questCompletions >= 3
    && (!lastReview || dayDistance(lastReview.dayId, input.dayId) >= 7);
  const pool = bond
    ? [bond]
    : reviewDue
      ? eligibleContent.filter((item) => item.kind === 'progress_review')
      : eligibleContent.filter((item) => item.kind === 'daily_pulse' || item.kind === 'return');
  const content = chooseStable(pool.length ? pool : eligibleContent, `${input.companionId}:${input.dayId}`);
  const chooseQuest = !bond && !reviewDue && input.eligibleQuestIds.length > 0
    && stableHash(`${input.companionId}:${input.dayId}:lane`) % 4 === 0;
  if (chooseQuest) {
    const questId = chooseStable(input.eligibleQuestIds, `${input.companionId}:${input.dayId}:quest`)!;
    return {
      ...base,
      kind: 'quest',
      title: 'A real-world invitation',
      body: input.questTitles?.[questId] ?? 'Try one small quest when it fits your day.',
      destination: 'quest',
      questId,
    };
  }
  if (content) {
    return {
      ...base,
      kind: content.kind === 'bond_moment' ? 'bond_moment' : content.kind === 'progress_review' ? 'progress_review' : 'check_in',
      title: content.title,
      body: content.prompt,
      destination: 'discovery',
      contentItemId: content.id,
    };
  }
  return {
    ...base,
    kind: 'check_in',
    title: 'A moment from today',
    body: 'What stood out in this part of life today?',
    destination: 'discovery',
  };
}

export function ensureCompanionInvitation(
  state: CompanionContentState,
  invitation: CompanionDailyInvitation
): CompanionContentState {
  if (state.invitations.some((item) => item.id === invitation.id)) return state;
  return appendEvent({
    ...state,
    invitations: [...state.invitations, invitation],
  }, invitation, 'shown', invitation.createdAt);
}

export function updateCompanionInvitation(
  state: CompanionContentState,
  invitationId: string,
  status: 'opened' | 'completed' | 'skipped',
  occurredAt = Date.now()
): CompanionContentState {
  const invitation = state.invitations.find((item) => item.id === invitationId);
  if (!invitation || invitation.status === status || invitation.status === 'completed') return state;
  const updated: CompanionDailyInvitation = {
    ...invitation,
    status,
    ...(status === 'opened' ? { openedAt: occurredAt } : {}),
    ...(status === 'completed' ? { completedAt: occurredAt } : {}),
  };
  return appendEvent({
    ...state,
    invitations: state.invitations.map((item) => item.id === invitationId ? updated : item),
  }, updated, status, occurredAt);
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

export function enqueueConversationSignal(
  state: CompanionContentState,
  signal: QueuedConversationSignal
): CompanionContentState {
  if (state.conversationSignals.some((item) => item.id === signal.id)) return state;
  return { ...state, conversationSignals: [...state.conversationSignals, signal].slice(-1000) };
}

export function consumeConversationSignal(
  state: CompanionContentState,
  signalId: string,
  consumedAt = Date.now()
): CompanionContentState {
  return {
    ...state,
    conversationSignals: state.conversationSignals.map((signal) =>
      signal.id === signalId && !signal.consumedAt ? { ...signal, consumedAt } : signal
    ),
  };
}

export function baselineConversationEvidence(
  state: CompanionContentState,
  evidenceIds: readonly string[]
): CompanionContentState {
  return {
    ...state,
    conversationSignalBaselineComplete: true,
    processedConversationEvidenceIds: [...new Set([...state.processedConversationEvidenceIds, ...evidenceIds])].slice(-4000),
  };
}

export function markConversationEvidenceProcessed(
  state: CompanionContentState,
  evidenceId: string
): CompanionContentState {
  if (state.processedConversationEvidenceIds.includes(evidenceId)) return state;
  return { ...state, processedConversationEvidenceIds: [...state.processedConversationEvidenceIds, evidenceId].slice(-4000) };
}

export function recordConversationTelemetry(
  state: CompanionContentState,
  event: ConversationTelemetryEvent
): CompanionContentState {
  if (state.conversationTelemetry.some((item) => item.id === event.id)) return state;
  return { ...state, conversationTelemetry: [...state.conversationTelemetry, event].slice(-6000) };
}

export function visitPlanForDay(
  state: CompanionContentState,
  familyId: KatchimeraFamilyId,
  dayId: string
): CompanionVisitPlan | null {
  const ownerFamilyId = canonicalFamilyId(familyId) ?? familyId;
  return state.visitPlans.find((plan) => plan.familyId === ownerFamilyId && plan.dayId === dayId) ?? null;
}

export function receiptForVisitPlan(
  state: CompanionContentState,
  visitPlanId: string
): CompanionConversationReceipt | null {
  return state.conversationReceipts.find((receipt) => receipt.visitPlanId === visitPlanId) ?? null;
}

export function ensureCompanionVisitPlan(
  state: CompanionContentState,
  plan: CompanionVisitPlan
): CompanionContentState {
  if (state.visitPlans.some((item) => item.id === plan.id)) return state;
  return {
    ...recordCompanionVisitTelemetry(state, {
      familyId: plan.familyId,
      dayId: plan.dayId,
      kind: 'visit_started',
      subject: plan.subject,
      occurredAt: plan.createdAt,
    }),
    visitPlans: [...state.visitPlans, plan],
  };
}

export function completeCompanionVisit(
  state: CompanionContentState,
  input: Omit<CompanionConversationReceipt, 'id' | 'completedAt'> & { completedAt?: number }
): CompanionContentState {
  const id = `companion-conversation-receipt:${input.visitPlanId}`;
  if (state.conversationReceipts.some((item) => item.id === id)) return state;
  const completedAt = input.completedAt ?? Date.now();
  const receipt: CompanionConversationReceipt = { ...input, id, completedAt };
  const withReceipt = {
    ...state,
    conversationReceipts: [...state.conversationReceipts, receipt],
  };
  return recordCompanionVisitTelemetry(withReceipt, {
    familyId: input.familyId,
    dayId: input.dayId,
    kind: 'visit_completed',
    subject: state.visitPlans.find((plan) => plan.id === input.visitPlanId)?.subject,
    occurredAt: completedAt,
  });
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

/** Development support: clear one companion's Long Memory and Visit receipts
 * without touching its Focus, quests, bond or introduction preferences. */
export function resetCompanionMemory(
  state: CompanionContentState,
  familyId: KatchimeraFamilyId
): CompanionContentState {
  const ownerFamilyId = canonicalFamilyId(familyId) ?? familyId;
  const removedPlanIds = new Set(
    state.visitPlans.filter((plan) => plan.familyId === ownerFamilyId).map((plan) => plan.id)
  );
  return {
    ...state,
    memoryFacts: state.memoryFacts.filter((fact) => fact.familyId !== ownerFamilyId),
    memories: state.memories.filter((memory) => memory.familyId !== ownerFamilyId),
    visitPlans: state.visitPlans.filter((plan) => plan.familyId !== ownerFamilyId),
    conversationReceipts: state.conversationReceipts.filter((receipt) => !removedPlanIds.has(receipt.visitPlanId)),
    telemetry: state.telemetry.filter((event) => event.familyId !== ownerFamilyId),
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
  const kind = input.status === 'confirmed'
    ? input.summary ? 'memory_corrected' : 'memory_confirmed'
    : input.status === 'rejected'
      ? 'memory_rejected'
      : 'memory_forgotten';
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
  return recordCompanionVisitTelemetry(next, {
    familyId: input.familyId,
    dayId: input.dayId,
    kind,
    occurredAt,
  });
}

function journalPatternPresentation(familyId: KatchimeraFamilyId, key: string): { category: string; title: string; trait: string; emblemId: string } | null {
  if (familyId === 'baristabbit' && key.includes('cafe-pauses')) return { category: 'Real life', title: 'Your Recurring Cup', trait: 'A ritual that keeps returning', emblemId: 'barista-journal-recurring-cup' };
  if (familyId === 'steppling' && key.includes('movement-on-foot')) return { category: 'Real life', title: 'The Route That Returns', trait: 'Movement across different days', emblemId: 'steppling-journal-returning-route' };
  if (familyId === 'flexel' && key.includes('movement-practice')) return { category: 'Real life', title: 'The Practice That Returns', trait: 'Practice across different days', emblemId: 'flexel-journal-returning-practice' };
  return null;
}

export function recordCompanionVisitTelemetry(
  state: CompanionContentState,
  input: Omit<CompanionVisitTelemetryEvent, 'id'>
): CompanionContentState {
  const id = `companion-visit-event:${input.familyId}:${input.dayId}:${input.kind}:${input.occurredAt}`;
  if (state.telemetry.some((event) => event.id === id)) return state;
  return { ...state, telemetry: [...state.telemetry, { ...input, id }] };
}

function contentIsOffCooldown(
  state: CompanionContentState,
  content: CompanionContentItem,
  companionId: string,
  dayId: string
): boolean {
  const last = [...state.invitations].reverse().find((item) =>
    item.companionId === companionId && item.contentItemId === content.id
  );
  return !last || dayDistance(last.dayId, dayId) >= content.cooldownDays;
}

function appendEvent(
  state: CompanionContentState,
  invitation: CompanionDailyInvitation,
  kind: CompanionContentEvent['kind'],
  occurredAt: number
): CompanionContentState {
  const event: CompanionContentEvent = {
    id: `companion-content-event:${invitation.id}:${kind}`,
    kind,
    invitationId: invitation.id,
    companionId: invitation.companionId,
    familyId: invitation.familyId,
    dayId: invitation.dayId,
    occurredAt,
  };
  if (state.events.some((item) => item.id === event.id)) return state;
  return { ...state, events: [...state.events, event] };
}

function chooseStable<T>(items: readonly T[], seed: string): T | undefined {
  return items.length ? items[stableHash(seed) % items.length] : undefined;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function dayDistance(left: string, right: string): number {
  return Math.floor((Date.parse(`${right}T12:00:00`) - Date.parse(`${left}T12:00:00`)) / 86_400_000);
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function isInvitation(value: unknown): value is CompanionDailyInvitation {
  const item = value as CompanionDailyInvitation;
  return Boolean(item && typeof item.id === 'string' && typeof item.companionId === 'string' && typeof item.dayId === 'string');
}

function isContentEvent(value: unknown): value is CompanionContentEvent {
  const item = value as CompanionContentEvent;
  return Boolean(item && typeof item.id === 'string' && typeof item.invitationId === 'string');
}

function isIntroduction(value: unknown): value is CompanionIntroductionRecord {
  const item = value as CompanionIntroductionRecord;
  return Boolean(
    item
      && typeof item.id === 'string'
      && typeof item.familyId === 'string'
      && (item.status === 'deferred' || item.status === 'completed')
  );
}

function isVisit(value: unknown): value is CompanionVisitRecord {
  const item = value as CompanionVisitRecord;
  return Boolean(
    item
      && typeof item.id === 'string'
      && typeof item.familyId === 'string'
      && typeof item.lastVisitedDayId === 'string'
      && Array.isArray(item.seenSkinIds)
  );
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

function isVisitPlan(value: unknown): value is CompanionVisitPlan {
  const item = value as CompanionVisitPlan;
  return Boolean(item && typeof item.id === 'string' && typeof item.familyId === 'string' && typeof item.dayId === 'string' && Array.isArray(item.responses));
}

function isConversationReceipt(value: unknown): value is CompanionConversationReceipt {
  const item = value as CompanionConversationReceipt;
  return Boolean(item && typeof item.id === 'string' && typeof item.visitPlanId === 'string' && typeof item.dayId === 'string');
}

function isTelemetryEvent(value: unknown): value is CompanionVisitTelemetryEvent {
  const item = value as CompanionVisitTelemetryEvent;
  return Boolean(item && typeof item.id === 'string' && typeof item.familyId === 'string' && typeof item.dayId === 'string' && typeof item.kind === 'string');
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

function isConversationSignal(value: unknown): value is QueuedConversationSignal {
  const item = value as QueuedConversationSignal;
  return Boolean(item && typeof item.id === 'string' && typeof item.familyId === 'string' && typeof item.sourceId === 'string' && typeof item.expiresAt === 'number');
}

function isConversationTelemetry(value: unknown): value is ConversationTelemetryEvent {
  const item = value as ConversationTelemetryEvent;
  return Boolean(item && typeof item.id === 'string' && typeof item.sessionId === 'string' && typeof item.definitionId === 'string' && typeof item.kind === 'string');
}
