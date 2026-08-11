import type { KatchimeraSkinId } from '@/types/katchimera';
import type {
  ConversationDefinition,
  ConversationFormResult,
  ConversationNode,
  ConversationOption,
  ConversationPollResult,
  ConversationSession,
  ConversationMode,
  ConversationV2FamilyId,
  QueuedConversationSignal,
} from '@/types/companion-conversation';

export const MAX_CONVERSATION_TRANSITIONS = 16;

export function conversationThreadCanContinue(session: ConversationSession): boolean {
  return (session.encounterTurns ?? 0) < (session.encounterTargetTurns ?? 5);
}

export type ConversationAnswerResult = {
  session: ConversationSession;
  completedGame: boolean;
};

export function conversationNode(
  definition: ConversationDefinition,
  nodeId: string
): ConversationNode | null {
  return definition.nodes.find((node) => node.id === nodeId) ?? null;
}

export function conversationGameQuestion(
  node: Extract<ConversationNode, { kind: 'profile_game' | 'insight_game' }>,
  session: ConversationSession
) {
  if (node.kind === 'profile_game' && session.gameQuestionId) {
    return node.questions.find((question) => question.id === session.gameQuestionId) ?? null;
  }
  return node.questions[session.gameQuestionIndex] ?? null;
}

export function createConversationSession(input: {
  definition: ConversationDefinition;
  formId: KatchimeraSkinId;
  dayId: string;
  evidenceRefs?: ConversationSession['evidenceRefs'];
  createdAt?: number;
  preview?: boolean;
  sessionId?: string;
  encounterId?: string;
  encounterTargetTurns?: number;
  encounterTurns?: number;
}): ConversationSession {
  const createdAt = input.createdAt ?? Date.now();
  const entryNode = conversationNode(input.definition, input.definition.entryNodeId);
  const gameQuestionId = entryNode?.kind === 'profile_game'
    ? entryNode.entryQuestionId ?? entryNode.questions[0]?.id
    : undefined;
  return {
    id: input.sessionId ?? `companion-conversation-v2:${input.definition.familyId}:${input.dayId}`,
    definitionId: input.definition.id,
    definitionVersion: input.definition.version,
    familyId: input.definition.familyId,
    formId: input.formId,
    createdDayId: input.dayId,
    servedDayId: input.dayId,
    currentNodeId: input.definition.entryNodeId,
    gameQuestionIndex: 0,
    ...(gameQuestionId ? { gameQuestionId } : {}),
    turns: [],
    affinityScores: {},
    evidenceRefs: [...(input.evidenceRefs ?? [])],
    status: 'active',
    createdAt,
    updatedAt: createdAt,
    outcomeIds: [],
    ...(input.encounterId ? { encounterId: input.encounterId } : {}),
    ...(input.encounterTargetTurns ? { encounterTargetTurns: input.encounterTargetTurns } : {}),
    encounterTurns: input.encounterTurns ?? 0,
    ...(input.preview ? { preview: true } : {}),
  };
}

export function answerConversation(
  session: ConversationSession,
  definition: ConversationDefinition,
  optionId: string,
  answeredAt = Date.now()
): ConversationAnswerResult {
  if (session.status !== 'active') {
    return { session, completedGame: false };
  }
  const workingSession = session.pendingReply !== undefined
    ? rewindPendingAnswer(session, definition)
    : session;
  const node = conversationNode(definition, workingSession.currentNodeId);
  if (!node) return { session, completedGame: false };
  if (node.kind === 'choice') {
    const option = node.options.find((candidate) => candidate.id === optionId);
    if (!option) return { session, completedGame: false };
    return {
      session: withAnsweredOption(workingSession, node.id, option, answeredAt, option.nextNodeId),
      completedGame: false,
    };
  }
  if (node.kind === 'poll') {
    const option = node.options.find((candidate) => candidate.id === optionId);
    if (!option) return { session, completedGame: false };
    const pollResult = buildVillagePollResult(node.options, optionId, `${workingSession.id}:${node.id}`);
    return {
      session: {
        ...withAnsweredOption(workingSession, node.id, option, answeredAt, node.nextNodeId),
        pollResult,
      },
      completedGame: true,
    };
  }
  if (node.kind !== 'profile_game' && node.kind !== 'insight_game') return { session, completedGame: false };
  const question = conversationGameQuestion(node, workingSession);
  const option = question?.options.find((candidate) => candidate.id === optionId);
  if (!question || !option) return { session, completedGame: false };
  const affinityScores = node.kind === 'profile_game'
    ? mergeAffinity(workingSession.affinityScores, option.affinity)
    : workingSession.affinityScores;
  const sequentialNext = node.questions[workingSession.gameQuestionIndex + 1]?.id ?? null;
  const nextQuestionId = node.kind === 'profile_game'
    ? option.nextQuestionId === undefined ? sequentialNext : option.nextQuestionId
    : sequentialNext;
  const completedGame = nextQuestionId === null;
  const formResult = completedGame && node.kind === 'profile_game' ? resolveFormResult(affinityScores, workingSession.formId) : undefined;
  const turns = [...workingSession.turns, {
    id: `conversation-turn:${workingSession.id}:${workingSession.turns.length + 1}`,
    nodeId: node.id,
    questionId: question.id,
    optionId: option.id,
    ...(option.intentId ? { intentId: option.intentId } : {}),
    answeredAt,
  }];
  const reveal = completedGame && node.kind === 'insight_game'
    ? conversationNode(definition, node.revealNodeId)
    : null;
  const insightResult = reveal?.kind === 'insight_reveal'
    ? resolveInsightResult(definition, reveal, turns)
    : undefined;
  return {
    completedGame,
    session: {
      ...workingSession,
      gameQuestionIndex: node.kind === 'profile_game'
        ? Math.max(0, node.questions.findIndex((candidate) => candidate.id === nextQuestionId))
        : workingSession.gameQuestionIndex + 1,
      ...(node.kind === 'profile_game' && nextQuestionId ? { gameQuestionId: nextQuestionId } : {}),
      pendingReply: option.reply,
      pendingNextNodeId: completedGame ? node.revealNodeId : node.id,
      turns,
      affinityScores,
      encounterTurns: (workingSession.encounterTurns ?? 0) + 1,
      ...(formResult ? { formResult } : {}),
      ...(insightResult ? { insightResult } : {}),
      updatedAt: answeredAt,
    },
  };
}

export function continueConversation(
  session: ConversationSession,
  definition: ConversationDefinition,
  continuedAt = Date.now()
): ConversationSession {
  if (session.status !== 'active') return session;
  if (session.pendingReply !== undefined) {
    const nextNodeId = session.pendingNextNodeId;
    if (!nextNodeId) return completeSession({ ...session, pendingReply: undefined, pendingNextNodeId: undefined }, continuedAt);
    const next = conversationNode(definition, nextNodeId);
    if (!next) return session;
    const entered = enterNode({
      ...session,
      currentNodeId: nextNodeId,
      pendingReply: undefined,
      pendingNextNodeId: undefined,
      updatedAt: continuedAt,
    }, next, continuedAt);
    if (next.kind !== 'insight_reveal' || entered.insightResult) return entered;
    const insightResult = resolveInsightResult(definition, next, entered.turns);
    return insightResult ? { ...entered, insightResult } : entered;
  }
  const node = conversationNode(definition, session.currentNodeId);
  if (!node) return session;
  if (node.kind === 'form_reveal' || node.kind === 'insight_reveal' || node.kind === 'memory_proposal' || node.kind === 'goal_proposal' || node.kind === 'quick_goal_proposal' || node.kind === 'quest_handoff') {
    if (!node.nextNodeId) return completeSession(session, continuedAt);
    const next = conversationNode(definition, node.nextNodeId);
    return next ? enterNode({ ...session, currentNodeId: next.id, updatedAt: continuedAt }, next, continuedAt) : session;
  }
  if (node.kind === 'end') return completeSession(session, continuedAt);
  return session;
}

export function recordConversationOutcome(
  session: ConversationSession,
  outcomeId: string,
  recordedAt = Date.now()
): ConversationSession {
  if (session.outcomeIds.includes(outcomeId)) return session;
  return { ...session, outcomeIds: [...session.outcomeIds, outcomeId], updatedAt: recordedAt };
}

export function restartInsightConversation(
  session: ConversationSession,
  definition: ConversationDefinition,
  restartedAt = Date.now(),
  questionIndex = 0
): ConversationSession {
  const game = definition.nodes.find((node) => node.kind === 'insight_game');
  if (!game || session.preview) return session;
  const boundedIndex = Math.max(0, Math.min(questionIndex, game.questions.length - 1));
  const turns = session.turns.filter((turn) => turn.nodeId === game.id).slice(0, boundedIndex);
  return {
    ...session,
    currentNodeId: game.id,
    gameQuestionIndex: boundedIndex,
    pendingReply: undefined,
    pendingNextNodeId: undefined,
    turns,
    lastReply: replyForTurn(definition, turns.at(-1)) ?? undefined,
    insightResult: undefined,
    outcomePresentation: undefined,
    status: 'active',
    completedAt: undefined,
    encounterTurns: turns.length,
    updatedAt: restartedAt,
  };
}

export function archiveConversationSession(
  session: ConversationSession,
  archivedAt = Date.now()
): ConversationSession {
  if (session.status !== 'active') return session;
  return { ...session, status: 'archived', archivedAt, updatedAt: archivedAt };
}

export function selectConversationDefinition(input: {
  familyId: ConversationV2FamilyId;
  dayId: string;
  definitions: readonly ConversationDefinition[];
  sessions: readonly ConversationSession[];
  signals: readonly QueuedConversationSignal[];
  bondLevel: 1 | 2 | 3 | 4;
  selectionSeed?: string;
}): { definition: ConversationDefinition; signal: QueuedConversationSignal | null } | null {
  const pool = input.definitions.filter((definition) =>
    definition.familyId === input.familyId
    && definition.minimumBondLevel <= input.bondLevel
  );
  if (!pool.length) return null;
  const signal = input.signals
    .filter((candidate) => candidate.familyId === input.familyId && !candidate.consumedAt && candidate.expiresAt > Date.now())
    .sort((left, right) => right.createdAt - left.createdAt)[0] ?? null;
  if (signal) {
    const trigger = signal.kind === 'journal'
      ? 'journal'
      : signal.kind === 'goal_debrief'
        ? 'goal_debrief'
        : signal.kind === 'quest_debrief'
          ? 'quest_debrief'
          : signal.kind === 'bond'
            ? 'bond'
            : null;
    const contextual = trigger ? pool.filter((definition) =>
      definition.trigger === trigger
      && (trigger !== 'journal' || !definition.triggerRouteKeys?.length || (signal.routeKey && definition.triggerRouteKeys.includes(signal.routeKey)))
    ) : [];
    if (contextual.length) return { definition: chooseStable(contextual, `${input.familyId}:${input.dayId}:${signal.id}`)!, signal };
  }
  const openers = pool.filter((definition) => definition.isOpener && !definition.contextualOnly);
  const general = pool.filter((definition) => !definition.contextualOnly && !definition.isOpener);
  const seed = input.selectionSeed ?? `${input.familyId}:${input.dayId}:${input.sessions.length}`;
  const definition = chooseRecentAware(openers.length ? openers : general, input.sessions, seed);
  return definition ? { definition, signal: null } : null;
}

export function selectConversationFromPool(input: {
  familyId: ConversationV2FamilyId;
  poolId?: string;
  definitions: readonly ConversationDefinition[];
  sessions: readonly ConversationSession[];
  seed: string;
  hasActiveFocus?: boolean;
  hasActiveQuest?: boolean;
  excludeDefinitionIds?: readonly string[];
}): ConversationDefinition | null {
  const excluded = new Set(input.excludeDefinitionIds ?? []);
  const candidates = input.definitions.filter((definition) =>
    definition.familyId === input.familyId
    && !excluded.has(definition.id)
    && !definition.contextualOnly
    && !definition.isOpener
    && (!definition.requiresActiveFocus || input.hasActiveFocus)
    && (!definition.requiresNoActiveFocus || !input.hasActiveFocus)
    && (!definition.requiresNoActiveQuest || !input.hasActiveQuest)
    && (input.poolId === 'play' || (definition.format !== 'poll' && definition.format !== 'profile_game'))
    && (!input.poolId || definition.tags?.includes(input.poolId))
  );
  return chooseRecentAware(candidates, input.sessions, input.seed);
}

export function selectConversationForMode(input: {
  familyId: ConversationV2FamilyId;
  mode: ConversationMode;
  definitions: readonly ConversationDefinition[];
  sessions: readonly ConversationSession[];
  seed: string;
  hasActiveFocus?: boolean;
  hasActiveQuest?: boolean;
}): ConversationDefinition | null {
  const talkPoolIds = new Set(input.definitions.flatMap((definition) => definition.isOpener
    ? definition.nodes.flatMap((node) => node.kind === 'choice'
        ? node.options.flatMap((option) => option.transition?.kind === 'pool'
            && option.transition.poolId !== 'play'
            && option.transition.poolId !== 'goals'
          ? [option.transition.poolId]
          : [])
        : [])
    : []));
  const candidates = input.definitions.filter((definition) => {
    if (definition.familyId !== input.familyId || definition.contextualOnly) return false;
    if (definition.requiresActiveFocus && !input.hasActiveFocus) return false;
    if (definition.requiresNoActiveFocus && input.hasActiveFocus) return false;
    if (definition.requiresNoActiveQuest && input.hasActiveQuest) return false;
    if (input.mode === 'play') return definition.format === 'profile_game' || definition.format === 'poll';
    if (input.mode === 'discover') return definition.format === 'insight_game';
    if (input.mode === 'plan') return definition.id.endsWith(':goal-discovery');
    return !definition.isOpener
      && definition.format !== 'poll'
      && definition.format !== 'profile_game'
      && Boolean(definition.tags?.some((tag) => talkPoolIds.has(tag)));
  });
  if (input.mode === 'play') {
    const formGame = candidates.find((definition) =>
      definition.format === 'profile_game'
      && !input.sessions.some((session) => session.definitionId === definition.id && session.status === 'completed')
    );
    if (formGame) return formGame;
  }
  return chooseRecentAware(candidates, input.sessions, input.seed);
}

export function conversationQuestionCount(definition: ConversationDefinition): number {
  if (definition.format === 'profile_game') return 3;
  return maximumQuestionCount(definition);
}

export function validateConversationDefinitions(definitions: readonly ConversationDefinition[]): string[] {
  const issues: string[] = [];
  const definitionIds = new Set<string>();
  for (const definition of definitions) {
    if (definitionIds.has(definition.id)) issues.push(`${definition.id}: duplicate definition id`);
    definitionIds.add(definition.id);
    const nodeIds = new Set(definition.nodes.map((node) => node.id));
    if (nodeIds.size !== definition.nodes.length) issues.push(`${definition.id}: duplicate node id`);
    if (!nodeIds.has(definition.entryNodeId)) issues.push(`${definition.id}: missing entry node`);
    for (const node of definition.nodes) {
      for (const next of referencedNodeIds(node)) {
        if (next && !nodeIds.has(next)) issues.push(`${definition.id}:${node.id}: missing ${next}`);
      }
      if (node.kind === 'choice') {
        for (const option of node.options) {
          const transition = option.transition;
          if (transition?.kind === 'definition' && !definitions.some((candidate) => candidate.id === transition.definitionId)) {
            issues.push(`${definition.id}:${node.id}:${option.id}: missing transition definition`);
          }
          if (transition?.kind === 'pool' && !definitions.some((candidate) => candidate.familyId === definition.familyId && candidate.tags?.includes(transition.poolId))) {
            issues.push(`${definition.id}:${node.id}:${option.id}: empty transition pool`);
          }
        }
      }
      if (node.kind === 'profile_game' || node.kind === 'insight_game') {
        if (node.kind === 'profile_game') issues.push(...validateProfileQuestionGraph(definition.id, node));
        if (node.kind === 'insight_game' && node.questions.length < 4) issues.push(`${definition.id}:${node.id}: insight game needs at least four questions`);
        if (node.kind === 'insight_game' && node.questions.length > 6) issues.push(`${definition.id}:${node.id}: insight game exceeds six questions`);
        for (const [questionIndex, question] of node.questions.entries()) {
          if (question.options.length < 2) issues.push(`${definition.id}:${node.id}:${question.id}: needs at least two options`);
          if (question.promptByPriorOptionId) {
            const priorOptionIds = new Set(node.questions[questionIndex - 1]?.options.map((option) => option.id) ?? []);
            if (!priorOptionIds.size) issues.push(`${definition.id}:${node.id}:${question.id}: branch prompts need a prior question`);
            for (const optionId of Object.keys(question.promptByPriorOptionId)) {
              if (!priorOptionIds.has(optionId)) issues.push(`${definition.id}:${node.id}:${question.id}: branch prompt references unknown prior answer ${optionId}`);
            }
          }
        }
        if (node.kind === 'insight_game') {
          const reveal = definition.nodes.find((candidate) => candidate.id === node.revealNodeId);
          if (reveal?.kind === 'insight_reveal') {
            const scoredOptionIds = new Set(reveal.results.flatMap((result) => result.matchOptionIds));
            for (const question of node.questions) {
              for (const option of question.options) {
                if (!scoredOptionIds.has(option.id)) issues.push(`${definition.id}:${node.id}:${question.id}:${option.id}: answer does not contribute to an insight result`);
              }
            }
            for (const result of reveal.results) {
              const evidenceQuestions = node.questions.filter((question) => question.options.some((option) => result.matchOptionIds.includes(option.id)));
              if (evidenceQuestions.length < 4) issues.push(`${definition.id}:${reveal.id}:${result.id}: result uses fewer than four questions`);
            }
          }
        }
      }
      if (node.kind === 'poll') {
        if (node.options.length < 2 || node.options.some((option) => option.villageWeight <= 0)) {
          issues.push(`${definition.id}:${node.id}: invalid fictional poll weights`);
        }
      }
    }
    if (!definition.nodes.some((node) => node.kind === 'end')) issues.push(`${definition.id}: missing end node`);
    const questionCount = maximumQuestionCount(definition);
    if (!definition.isOpener && questionCount > 6) issues.push(`${definition.id}: exceeds six questions`);
    if (definition.id.endsWith(':goal-discovery')) {
      const choiceNodes = definition.nodes.filter((node) => node.kind === 'choice');
      const goalNodes = definition.nodes.filter((node) => node.kind === 'goal_proposal');
      if (questionCount !== 4) issues.push(`${definition.id}: goal discovery must ask exactly four questions`);
      if (choiceNodes.some((node) => node.options.length !== 4)) issues.push(`${definition.id}: goal discovery choices must offer four specific answers`);
      if (goalNodes.length < 4) issues.push(`${definition.id}: goal discovery needs multiple matched outcomes`);
      for (const node of goalNodes) {
        if (!node.summary?.trim()) issues.push(`${definition.id}:${node.id}: matched goal needs a personal summary`);
        if (node.suggestedQuickGoalIds.length < 2 || node.suggestedQuickGoalIds.length > 3) issues.push(`${definition.id}:${node.id}: matched goal needs two or three supporting steps`);
      }
    }
    if (!definition.isOpener && hasOutcomeLessEnding(definition)) issues.push(`${definition.id}: reachable ending has no outcome`);
    const reachable = reachableNodeIds(definition);
    for (const node of definition.nodes) if (!reachable.has(node.id)) issues.push(`${definition.id}:${node.id}: unreachable`);
  }
  return issues;
}

function maximumQuestionCount(definition: ConversationDefinition): number {
  const visit = (nodeId: string, seen: ReadonlySet<string>): number => {
    if (seen.has(nodeId)) return 0;
    const node = conversationNode(definition, nodeId);
    if (!node) return 0;
    const nextSeen = new Set(seen).add(nodeId);
    if (node.kind === 'profile_game') return maximumProfileQuestionCount(node) + visit(node.revealNodeId, nextSeen);
    if (node.kind === 'insight_game') return node.questions.length + visit(node.revealNodeId, nextSeen);
    const own = node.kind === 'choice' || node.kind === 'poll' ? 1 : 0;
    return own + Math.max(0, ...referencedNodeIds(node).map((next) => next ? visit(next, nextSeen) : 0));
  };
  return visit(definition.entryNodeId, new Set());
}

function maximumProfileQuestionCount(node: Extract<ConversationNode, { kind: 'profile_game' }>): number {
  const byId = new Map(node.questions.map((question, index) => [question.id, { question, index }]));
  const entryId = node.entryQuestionId ?? node.questions[0]?.id;
  if (!entryId) return 0;
  const visit = (questionId: string, path: ReadonlySet<string>): number => {
    if (path.has(questionId)) return 0;
    const entry = byId.get(questionId);
    if (!entry) return 0;
    const nextPath = new Set(path).add(questionId);
    const remaining = entry.question.options.map((option) => {
      const nextId = option.nextQuestionId === undefined
        ? node.questions[entry.index + 1]?.id ?? null
        : option.nextQuestionId;
      return nextId ? visit(nextId, nextPath) : 0;
    });
    return 1 + Math.max(0, ...remaining);
  };
  return visit(entryId, new Set());
}

export function validateProfileQuestionGraph(
  definitionId: string,
  node: Extract<ConversationNode, { kind: 'profile_game' }>
): string[] {
  const issues: string[] = [];
  const byId = new Map(node.questions.map((question) => [question.id, question]));
  const entryId = node.entryQuestionId ?? node.questions[0]?.id;
  if (!entryId || !byId.has(entryId)) return [`${definitionId}:${node.id}: missing profile-game entry question`];
  const reachable = new Set<string>();
  const visit = (questionId: string, depth: number, path: ReadonlySet<string>) => {
    if (path.has(questionId)) {
      issues.push(`${definitionId}:${node.id}:${questionId}: profile-game question cycle`);
      return;
    }
    const question = byId.get(questionId);
    if (!question) {
      issues.push(`${definitionId}:${node.id}:${questionId}: missing profile-game question`);
      return;
    }
    reachable.add(questionId);
    const nextPath = new Set(path).add(questionId);
    for (const option of question.options) {
      const sequentialIndex = node.questions.findIndex((candidate) => candidate.id === questionId) + 1;
      const nextId = option.nextQuestionId === undefined
        ? node.questions[sequentialIndex]?.id ?? null
        : option.nextQuestionId;
      if (!nextId) {
        if (depth !== 3) issues.push(`${definitionId}:${node.id}:${questionId}:${option.id}: form-game path must use exactly three answers`);
      } else {
        visit(nextId, depth + 1, nextPath);
      }
    }
  };
  visit(entryId, 1, new Set());
  for (const question of node.questions) {
    if (!reachable.has(question.id)) issues.push(`${definitionId}:${node.id}:${question.id}: unreachable profile-game question`);
  }
  return [...new Set(issues)];
}

function hasOutcomeLessEnding(definition: ConversationDefinition): boolean {
  const outcomeKinds = new Set<ConversationNode['kind']>([
    'poll', 'form_reveal', 'insight_reveal', 'memory_proposal', 'goal_proposal', 'quick_goal_proposal', 'quest_handoff',
  ]);
  const visit = (nodeId: string, hasOutcome: boolean, seen: ReadonlySet<string>): boolean => {
    if (seen.has(nodeId)) return false;
    const node = conversationNode(definition, nodeId);
    if (!node) return true;
    const nextHasOutcome = hasOutcome || outcomeKinds.has(node.kind);
    if (node.kind === 'end') return !nextHasOutcome;
    const nextSeen = new Set(seen).add(nodeId);
    const nextIds = referencedNodeIds(node).filter((id): id is string => Boolean(id));
    return !nextIds.length ? !nextHasOutcome : nextIds.some((id) => visit(id, nextHasOutcome, nextSeen));
  };
  return visit(definition.entryNodeId, false, new Set());
}

function enterNode(session: ConversationSession, node: ConversationNode, occurredAt: number): ConversationSession {
  if (node.kind === 'end') return completeSession(session, occurredAt);
  return session;
}

function completeSession(session: ConversationSession, completedAt: number): ConversationSession {
  if (session.status === 'completed') return session;
  return { ...session, status: 'completed', completedAt, updatedAt: completedAt };
}

function withAnsweredOption(
  session: ConversationSession,
  nodeId: string,
  option: ConversationOption,
  answeredAt: number,
  nextNodeId: string | null
): ConversationSession {
  return {
    ...session,
    pendingReply: option.reply,
    lastReply: option.reply,
    pendingNextNodeId: nextNodeId,
    turns: [...session.turns, {
      id: `conversation-turn:${session.id}:${session.turns.length + 1}`,
      nodeId,
      optionId: option.id,
      ...(option.intentId ? { intentId: option.intentId } : {}),
      answeredAt,
    }],
    affinityScores: mergeAffinity(session.affinityScores, option.affinity),
    encounterTurns: (session.encounterTurns ?? 0) + 1,
    updatedAt: answeredAt,
    ...(option.transition ? { exitTransition: option.transition } : {}),
  };
}

function rewindPendingAnswer(
  session: ConversationSession,
  definition: ConversationDefinition
): ConversationSession {
  const removedTurn = session.turns.at(-1);
  if (!removedTurn) {
    return {
      ...session,
      pendingReply: undefined,
      pendingNextNodeId: undefined,
      exitTransition: undefined,
      pollResult: undefined,
    };
  }
  const turns = session.turns.slice(0, -1);
  const node = conversationNode(definition, removedTurn.nodeId);
  const questionIndex = (node?.kind === 'profile_game' || node?.kind === 'insight_game') && removedTurn.questionId
    ? node.questions.findIndex((question) => question.id === removedTurn.questionId)
    : -1;
  return {
    ...session,
    gameQuestionIndex: questionIndex >= 0 ? questionIndex : session.gameQuestionIndex,
    ...((node?.kind === 'profile_game' || node?.kind === 'insight_game') && removedTurn.questionId
      ? { gameQuestionId: removedTurn.questionId }
      : {}),
    pendingReply: undefined,
    pendingNextNodeId: undefined,
    lastReply: replyForTurn(definition, turns.at(-1)) ?? undefined,
    turns,
    affinityScores: affinityScoresForTurns(definition, turns),
    formResult: undefined,
    insightResult: undefined,
    pollResult: undefined,
    exitTransition: undefined,
    encounterTurns: Math.max(0, (session.encounterTurns ?? 0) - 1),
  };
}

function affinityScoresForTurns(
  definition: ConversationDefinition,
  turns: readonly ConversationSession['turns'][number][]
): ConversationSession['affinityScores'] {
  let scores: ConversationSession['affinityScores'] = {};
  for (const turn of turns) {
    const node = conversationNode(definition, turn.nodeId);
    const option = node?.kind === 'choice' || node?.kind === 'poll'
      ? node.options.find((candidate) => candidate.id === turn.optionId)
      : node?.kind === 'profile_game' || node?.kind === 'insight_game'
        ? node.questions.find((question) => question.id === turn.questionId)?.options.find((candidate) => candidate.id === turn.optionId)
        : undefined;
    scores = mergeAffinity(scores, option?.affinity);
  }
  return scores;
}

function replyForTurn(
  definition: ConversationDefinition,
  turn: ConversationSession['turns'][number] | undefined
): string | null {
  if (!turn) return null;
  const node = conversationNode(definition, turn.nodeId);
  if (node?.kind === 'choice' || node?.kind === 'poll') {
    return node.options.find((option) => option.id === turn.optionId)?.reply ?? null;
  }
  if (node?.kind === 'profile_game' || node?.kind === 'insight_game') {
    return node.questions.find((question) => question.id === turn.questionId)
      ?.options.find((option) => option.id === turn.optionId)?.reply ?? null;
  }
  return null;
}

function mergeAffinity(
  current: ConversationSession['affinityScores'],
  added: ConversationOption['affinity']
): ConversationSession['affinityScores'] {
  if (!added) return current;
  const next = { ...current };
  for (const [formId, amount] of Object.entries(added)) {
    if (typeof amount === 'number') next[formId as KatchimeraSkinId] = (next[formId as KatchimeraSkinId] ?? 0) + amount;
  }
  return next;
}

function resolveFormResult(
  scores: ConversationSession['affinityScores'],
  fallbackFormId: KatchimeraSkinId
): ConversationFormResult {
  const ranked = Object.entries(scores)
    .filter((entry): entry is [KatchimeraSkinId, number] => typeof entry[1] === 'number')
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  return {
    topFormId: ranked[0]?.[0] ?? fallbackFormId,
    runnerUpFormId: ranked[1]?.[0] ?? null,
    scores,
  };
}

function resolveInsightResult(
  definition: ConversationDefinition,
  node: Extract<ConversationNode, { kind: 'insight_reveal' }>,
  turns: readonly ConversationSession['turns'][number][]
) {
  const chosen = new Set(turns.map((turn) => turn.optionId));
  const ranked = node.results
    .map((result, index) => ({ result, index, score: result.matchOptionIds.filter((id) => chosen.has(id)).length }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const result = ranked[0]?.result ?? node.results[0];
  if (!result) return undefined;
  const topScore = ranked[0]?.score ?? 0;
  const runnerUp = ranked[1];
  const scoreMargin = Math.max(0, topScore - (runnerUp?.score ?? 0));
  const mixed = Boolean(runnerUp?.result && scoreMargin <= 1);
  const supportingTraits = turns
    .map((turn) => optionLabelForTurn(definition, turn))
    .filter((label): label is string => Boolean(label))
    .filter((label, index, all) => all.indexOf(label) === index)
    .slice(-6);
  return {
    insightKey: node.insightKey,
    category: node.category,
    resultId: result.id,
    title: result.title,
    reflection: result.reflection,
    summary: result.summary,
    emblemId: result.emblemId,
    supportingTraits,
    ...(mixed && runnerUp?.result ? {
      secondaryResultId: runnerUp.result.id,
      secondaryTitle: runnerUp.result.title,
    } : {}),
    confidence: mixed ? 'mixed' as const : 'clear' as const,
    scoreMargin,
  };
}

function optionLabelForTurn(definition: ConversationDefinition, turn: ConversationSession['turns'][number]): string | null {
  const node = conversationNode(definition, turn.nodeId);
  if (node?.kind === 'choice' || node?.kind === 'poll') return node.options.find((option) => option.id === turn.optionId)?.label ?? null;
  if (node?.kind === 'profile_game' || node?.kind === 'insight_game') {
    return node.questions.find((question) => question.id === turn.questionId)?.options.find((option) => option.id === turn.optionId)?.label ?? null;
  }
  return null;
}

function buildVillagePollResult(
  options: readonly (ConversationOption & { villageWeight: number })[],
  selectedOptionId: string,
  seed: string
): ConversationPollResult {
  const varied = options.map((option, index) => ({
    id: option.id,
    weight: Math.max(1, option.villageWeight + (stableHash(`${seed}:${index}`) % 9) - 4),
  }));
  const total = varied.reduce((sum, option) => sum + option.weight, 0);
  const raw = varied.map((option) => ({ id: option.id, value: (option.weight / total) * 100 }));
  const floors = raw.map((option) => ({ id: option.id, value: Math.floor(option.value), remainder: option.value % 1 }));
  let remaining = 100 - floors.reduce((sum, option) => sum + option.value, 0);
  for (const option of [...floors].sort((left, right) => right.remainder - left.remainder)) {
    if (remaining <= 0) break;
    option.value += 1;
    remaining -= 1;
  }
  return {
    selectedOptionId,
    percentages: Object.fromEntries(floors.map((option) => [option.id, option.value])),
    label: 'Katchimera village poll - fictional',
  };
}

function chooseStable<T>(items: readonly T[], seed: string): T | null {
  return items.length ? items[stableHash(seed) % items.length]! : null;
}

function chooseRecentAware(
  definitions: readonly ConversationDefinition[],
  sessions: readonly ConversationSession[],
  seed: string
): ConversationDefinition | null {
  if (!definitions.length) return null;
  const recentIds = new Set(
    sessions
      .filter((session) => !session.preview)
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, 5)
      .map((session) => session.definitionId)
  );
  const fresh = definitions.filter((definition) => !recentIds.has(definition.id));
  const candidates = fresh.length ? fresh : definitions;
  const weighted = candidates.flatMap((definition) => Array.from(
    { length: Math.max(1, Math.round(definition.weight ?? 1)) },
    () => definition
  ));
  return chooseStable(weighted, seed);
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function referencedNodeIds(node: ConversationNode): (string | null)[] {
  if (node.kind === 'choice') return node.options.map((option) => option.nextNodeId);
  if (node.kind === 'profile_game' || node.kind === 'insight_game') return [node.revealNodeId, ...node.questions.flatMap((question) => question.options.map((option) => option.nextNodeId))];
  if (node.kind === 'quest_handoff') return [node.nextNodeId, node.fallbackNodeId];
  if (node.kind === 'poll' || node.kind === 'form_reveal' || node.kind === 'insight_reveal' || node.kind === 'memory_proposal' || node.kind === 'goal_proposal' || node.kind === 'quick_goal_proposal') return [node.nextNodeId];
  return [];
}

function reachableNodeIds(definition: ConversationDefinition): Set<string> {
  const reached = new Set<string>();
  const queue = [definition.entryNodeId];
  while (queue.length) {
    const id = queue.shift()!;
    if (reached.has(id)) continue;
    reached.add(id);
    const node = conversationNode(definition, id);
    if (!node) continue;
    for (const next of referencedNodeIds(node)) if (next && !reached.has(next)) queue.push(next);
  }
  return reached;
}
