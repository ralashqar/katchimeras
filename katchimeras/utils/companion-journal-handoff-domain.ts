import { companionConversationDefinitionById } from '@/constants/companion-conversations-v2';
import type { ConversationNode, ConversationSession } from '@/types/companion-conversation';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import { continueConversation, recordConversationOutcome } from '@/utils/companion-conversation';
import { recordConversationTelemetry, upsertConversationSession, type CompanionContentState } from '@/utils/companion-content';

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
  allowedChoiceIds: string[];
  prompt: string;
  title: string;
  body: string;
  saveLabel: string;
  rewardGrowth: number;
  rewardMergeEnergy: number;
  rewardItemIds: string[];
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
    flowId: node?.flowId ?? 'food',
    allowedChoiceIds: [...(node?.allowedChoiceIds ?? ['meal', 'snack', 'dessert', 'coffee', 'tea', 'drink', 'cooking', 'other_food'])],
    prompt: input.target === 'tomorrow'
      ? 'Today’s Katchimera has already arrived. Tomorrow’s Egg can carry one food memory forward.'
      : node?.prompt ?? 'Could we give today’s Egg one food moment to remember? Ordinary counts.',
    title: node?.title ?? 'Today’s table',
    body: input.target === 'tomorrow'
      ? 'Choose a food moment from today to carry into Tomorrow’s Egg. A meal, snack, drink, or something you made all count—and ordinary counts too.'
      : node?.body ?? 'A meal, snack, drink, or something you made all count—and ordinary counts too.',
    saveLabel: node?.saveLabel ?? 'Add to the Egg',
    rewardGrowth: node?.rewardGrowth ?? 20,
    rewardMergeEnergy: node?.rewardMergeEnergy ?? 8,
    rewardItemIds: [...(node?.rewardItemIds ?? ['food:table:1', 'food:table:1'])],
    status: 'pending',
    journalRecordId: null,
    createdAt: input.now,
    updatedAt: input.now,
  };
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
