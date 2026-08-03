import type { CompanionContentItem } from '@/constants/companion-content';
import type { KatchimeraFamilyId } from '@/types/katchimera';
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

export type CompanionContentState = {
  schemaVersion: 1 | 2;
  invitations: CompanionDailyInvitation[];
  memoryFacts: CompanionMemoryFact[];
  events: CompanionContentEvent[];
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
  return { schemaVersion: 2, invitations: [], memoryFacts: [], events: [] };
}

export function normaliseCompanionContentState(value: unknown): CompanionContentState {
  if (!value || typeof value !== 'object') return emptyCompanionContentState();
  const candidate = value as Partial<CompanionContentState>;
  const canonicalizeOwner = <T extends { familyId: KatchimeraFamilyId; companionId: string }>(item: T): T => {
    const familyId = canonicalFamilyId(item.familyId) ?? item.familyId;
    return { ...item, familyId, companionId: companionIdForFamily(familyId) };
  };
  return {
    schemaVersion: 2,
    invitations: uniqueById((Array.isArray(candidate.invitations) ? candidate.invitations.filter(isInvitation) : []).map(canonicalizeOwner)).slice(-2000),
    memoryFacts: uniqueById((Array.isArray(candidate.memoryFacts) ? candidate.memoryFacts.filter(isMemoryFact) : []).map(canonicalizeOwner)).slice(-2000),
    events: uniqueById((Array.isArray(candidate.events) ? candidate.events.filter(isContentEvent) : []).map(canonicalizeOwner)).slice(-4000),
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
    const remembered = [...input.state.memoryFacts].reverse().find((fact) =>
      fact.companionId === input.companionId
      && (content.kind !== 'return' || fact.key.startsWith('focus:'))
      && fact.key !== content.memoryKey
    );
    return {
      ...base,
      kind: content.kind === 'bond_moment' ? 'bond_moment' : content.kind === 'progress_review' ? 'progress_review' : 'check_in',
      title: content.title,
      body: remembered && (content.kind === 'return' || content.kind === 'bond_moment')
        ? `${content.prompt} Last time, you chose “${remembered.value}”.`
        : content.prompt,
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

export function rememberCompanionAnswer(
  state: CompanionContentState,
  input: {
    companionId: string;
    familyId: KatchimeraFamilyId;
    key: string;
    value: string;
    sourceId: string;
    occurredAt?: number;
  }
): CompanionContentState {
  const value = input.value.trim();
  if (!value) return state;
  const occurredAt = input.occurredAt ?? Date.now();
  const id = `companion-memory:${input.companionId}:${input.key}`;
  const existing = state.memoryFacts.find((item) => item.id === id);
  const fact: CompanionMemoryFact = {
    id,
    companionId: input.companionId,
    familyId: input.familyId,
    key: input.key,
    value,
    sourceId: input.sourceId,
    firstRecordedAt: existing?.firstRecordedAt ?? occurredAt,
    lastConfirmedAt: occurredAt,
  };
  return {
    ...state,
    memoryFacts: [...state.memoryFacts.filter((item) => item.id !== id), fact],
  };
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

function isMemoryFact(value: unknown): value is CompanionMemoryFact {
  const item = value as CompanionMemoryFact;
  return Boolean(item && typeof item.id === 'string' && typeof item.key === 'string' && typeof item.value === 'string');
}

function isContentEvent(value: unknown): value is CompanionContentEvent {
  const item = value as CompanionContentEvent;
  return Boolean(item && typeof item.id === 'string' && typeof item.invitationId === 'string');
}
