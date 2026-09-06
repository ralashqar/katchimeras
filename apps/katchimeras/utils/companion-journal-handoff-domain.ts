import { companionConversationDefinitionById } from '@/constants/companion-conversations-v2';
import { MERGE_CHARACTER_NAMES } from '@/constants/merge-world-catalog';
import type { ConversationNode, ConversationSession } from '@/types/companion-conversation';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { MergeCharacterId } from '@/types/merge-world';
import { continueConversation, recordConversationOutcome } from '@/utils/companion-conversation';
import { recordConversationTelemetry, upsertConversationSession, type CompanionContentState } from '@/utils/companion-content';
import { companionJournalRouteForFamily } from '@/utils/quests/journal-templates';

export type CompanionJournalHandoffStatus = 'pending' | 'saved' | 'cancelled';

export type CompanionJournalHandoff = {
  id: string;
  mode: 'story' | 'optional';
  familyId: KatchimeraFamilyId;
  creatureId: string;
  sessionId: string | null;
  definitionId: string | null;
  nodeId: string | null;
  answerIds: string[];
  target: 'today' | 'tomorrow';
  flowId: string;
  initialChoiceId: string | null;
  allowedChoiceIds: string[];
  prompt: string;
  title: string;
  body: string;
  generatedDraft?: string | null;
  saveLabel: string;
  rewardGrowth: number;
  status: CompanionJournalHandoffStatus;
  journalRecordId: string | null;
  createdAt: number;
  updatedAt: number;
};

export function buildCompanionJournalHandoff(input: {
  mode: 'story' | 'optional';
  familyId: KatchimeraFamilyId;
  creatureId: string;
  session?: ConversationSession | null;
  node?: Extract<ConversationNode, { kind: 'journal_handoff' }> | null;
  target: 'today' | 'tomorrow';
  now: number;
}): CompanionJournalHandoff {
  const node = input.node ?? null;
  const characterId = input.familyId as MergeCharacterId;
  const route = companionJournalRouteForFamily(input.familyId);
  const companionName = MERGE_CHARACTER_NAMES[characterId] ?? 'Your Katchimera';
  const generatedDraft = input.familyId === 'mossprout' && input.session?.definitionId.includes(':nature-journal:')
    ? mossproutNatureDraft(input.session)
    : null;
  const allowedChoiceIds = [...(node?.allowedChoiceIds ?? route.allowedChoiceIds ?? [route.initialChoiceId ?? 'ordinary'])];
  const initialChoiceId = input.familyId === 'mossprout' && input.session?.definitionId.includes(':nature-journal:')
    ? mossproutNatureJournalChoiceId(input.session, allowedChoiceIds)
    : route.initialChoiceId && allowedChoiceIds.includes(route.initialChoiceId)
      ? route.initialChoiceId
      : allowedChoiceIds[0] ?? null;
  const theme = 'notice one small part of today worth keeping';
  const id = input.mode === 'story' && input.session && node
    ? `companion-journal:${input.session.id}:${node.id}`
    : `companion-journal:${input.familyId}:optional:${input.now.toString(36)}`;
  return {
    id,
    mode: input.mode,
    familyId: input.familyId,
    creatureId: input.creatureId,
    sessionId: input.session?.id ?? null,
    definitionId: input.session?.definitionId ?? null,
    nodeId: node?.id ?? null,
    answerIds: input.session?.turns.map((turn) => turn.optionId) ?? [],
    target: input.target,
    flowId: node?.flowId ?? route.flowId,
    initialChoiceId,
    allowedChoiceIds,
    prompt: input.target === 'tomorrow'
      ? `Today’s Katchimera has already arrived. Tomorrow’s Egg can carry one ${companionName} memory forward.`
      : node?.prompt ?? `Could we give today’s Egg one moment that helps ${theme}? Ordinary counts.`,
    title: node?.title ?? `${companionName}’s moment`,
    body: input.target === 'tomorrow'
      ? `Choose a small moment from today to carry into Tomorrow’s Egg. ${capitalize(theme)}.`
      : node?.body ?? `Choose a small moment from today. ${capitalize(theme)}.`,
    generatedDraft,
    saveLabel: node?.saveLabel ?? 'Add to the Egg',
    rewardGrowth: node?.rewardGrowth ?? 20,
    status: 'pending',
    journalRecordId: null,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

function mossproutNatureJournalChoiceId(
  session: ConversationSession,
  allowedChoiceIds: readonly string[],
): string | null {
  const answerIds = new Set(session.turns.map((turn) => turn.optionId));
  let choiceId = 'park';
  if (session.definitionId.endsWith(':three-detail-field-note')) {
    if (answerIds.has('window') || answerIds.has('indoors')) choiceId = 'home';
  } else if (session.definitionId.endsWith(':one-growing-thing')) {
    if (answerIds.has('tended') || answerIds.has('care')) choiceId = 'garden';
  } else if (session.definitionId.endsWith(':small-return') && answerIds.has('edge')) {
    choiceId = 'other_place';
  }
  return allowedChoiceIds.includes(choiceId) ? choiceId : allowedChoiceIds[0] ?? null;
}

function capitalize(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function mossproutNatureDraft(session: ConversationSession): string | null {
  const definition = companionConversationDefinitionById.get(session.definitionId);
  if (!definition) return null;
  const handoff = definition.nodes.find((node) => node.kind === 'journal_handoff');
  const fragments = new Map(session.turns.flatMap((turn) => {
    const node = definition.nodes.find((candidate) => candidate.id === turn.nodeId);
    if (!node || (node.kind !== 'choice' && node.kind !== 'poll')) return [];
    const option = node.options.find((candidate) => candidate.id === turn.optionId);
    const fragment = option?.journalFragment ?? (option?.label ? lowercaseInitial(option.label) : null);
    return fragment ? [[node.id, fragment] as const] : [];
  }));
  if (handoff?.kind === 'journal_handoff' && handoff.draftTemplate) {
    const draft = handoff.draftTemplate.replace(/\{\{([^}]+)\}\}/g, (_match, nodeId: string) => fragments.get(nodeId) ?? '');
    return draft.replace(/\s+([.,!?])/g, '$1').replace(/\s{2,}/g, ' ').trim() || null;
  }
  const labels = [...fragments.values()];
  if (!labels.length) return null;
  const [where, detail, meaning] = labels;
  return [
    where ? `Nature found me ${where}.` : null,
    detail ? `I noticed ${detail}.` : null,
    meaning ? `I want to remember ${meaning}.` : null,
  ].filter((line): line is string => Boolean(line)).join(' ');
}

function lowercaseInitial(value: string) {
  return value ? `${value[0]!.toLocaleLowerCase()}${value.slice(1)}` : value;
}

export function advanceConversationForJournalHandoff(
  content: CompanionContentState,
  handoff: CompanionJournalHandoff,
  journalRecordId: string,
  now: number,
): { content: CompanionContentState; advanced: boolean } {
  if (handoff.mode !== 'story' || !handoff.sessionId || !handoff.definitionId || !handoff.nodeId) {
    return { content, advanced: false };
  }
  const session = content.conversationSessions.find((item) => item.id === handoff.sessionId);
  const definition = companionConversationDefinitionById.get(handoff.definitionId);
  if (!session || !definition || session.currentNodeId !== handoff.nodeId) return { content, advanced: false };
  let nextSession = recordConversationOutcome(session, `journal-handoff:saved:${journalRecordId}`, now);
  nextSession = continueConversation(nextSession, definition, now);
  if (definition.nodes.find((node) => node.id === nextSession.currentNodeId)?.kind === 'end') {
    nextSession = continueConversation(nextSession, definition, now);
  }
  let nextContent = upsertConversationSession(content, nextSession);
  nextContent = recordConversationTelemetry(nextContent, {
    id: `${session.id}:${handoff.nodeId}:saved`,
    familyId: session.familyId,
    sessionId: session.id,
    definitionId: session.definitionId,
    kind: 'journal_handoff_saved',
    nodeId: handoff.nodeId,
    occurredAt: now,
  });
  return { content: nextContent, advanced: true };
}

export function isCompanionJournalHandoff(value: unknown): value is CompanionJournalHandoff {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CompanionJournalHandoff>;
  return typeof item.id === 'string'
    && (item.mode === 'story' || item.mode === 'optional')
    && typeof item.familyId === 'string'
    && typeof item.creatureId === 'string'
    && (item.target === 'today' || item.target === 'tomorrow')
    && (item.status === 'pending' || item.status === 'saved' || item.status === 'cancelled');
}
