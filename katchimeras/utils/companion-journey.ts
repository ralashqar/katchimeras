import {
  companionJourneyByFamilyId,
  companionJourneyNode,
  type CompanionJourneyConversationNode,
  type CompanionJourneyDefinition,
  type CompanionJourneyGoalStatus,
} from '@/constants/companion-journeys';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { CompanionDiscoveryState } from '@/utils/companion-discovery';
import type { CompanionQuest } from '@/utils/katchimera-quests';
import { questDefinition } from '@/utils/quests/definitions';

export const MAX_ACTIVE_COMPANION_GOALS = 1;

const LEGACY_GOAL_TITLE_REPLACEMENTS: Readonly<Record<string, string>> = {
  'vesperitt:Creative or learning time': 'Protect creative or learning time after dark',
  'vesperitt:Quiet time alone': 'Make room for quiet time after dark',
  'vesperitt:Time with people I care about': 'Protect time with people I care about',
  'vesperitt:A favourite evening ritual': 'Keep a favourite evening ritual',
  'vesperitt:When a chosen night turns into drift': 'Notice when and why a chosen night turns into drift',
  'vesperitt:How late work affects the next day': 'Notice how late work affects the next day',
  'vesperitt:What helps me stop when I mean to': 'Learn what helps me stop when I mean to',
  'vesperitt:Which late nights are actually worth it': 'Notice which late nights feel worth it',
};

export type CompanionJourneyGoal = {
  id: string;
  familyId: KatchimeraFamilyId;
  goalTypeId: string;
  title: string;
  status: CompanionJourneyGoalStatus;
  isPrimary: boolean;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
};

export type CompanionJourneyConversationAnswer = {
  nodeId: string;
  value: string;
  answeredAt: number;
};

export type CompanionJourneyConversationSession = {
  id: string;
  familyId: KatchimeraFamilyId;
  definitionId: string;
  definitionVersion: number;
  currentNodeId: string | null;
  startedAt: number;
  completedAt?: number;
  answers: CompanionJourneyConversationAnswer[];
};

export type CompanionJourneyQuestEvent = {
  id: string;
  familyId: KatchimeraFamilyId;
  goalId: string;
  questId: string;
  creatureId: string;
  dayId: string;
  amount: number;
  occurredAt: number;
};

export type CompanionJourneyReflectionEvent = {
  id: string;
  familyId: KatchimeraFamilyId;
  goalId: string;
  sourceId: string;
  dayId?: string;
  occurredAt: number;
};

export type CompanionJourneyMomentEvent = {
  id: string;
  familyId: KatchimeraFamilyId;
  goalId: string;
  kindId: string;
  note?: string;
  dayId: string;
  occurredAt: number;
};

export type CompanionJourneyState = {
  schemaVersion: 1;
  goals: CompanionJourneyGoal[];
  conversations: CompanionJourneyConversationSession[];
  questEvents: CompanionJourneyQuestEvent[];
  momentEvents: CompanionJourneyMomentEvent[];
  reflectionEvents: CompanionJourneyReflectionEvent[];
};

export type CompanionJourneyStageProgress = {
  id: string;
  title: string;
  description: string;
  requirementKind: CompanionJourneyDefinition['stages'][number]['requirement']['kind'];
  current: number;
  target: number;
  complete: boolean;
  currentStage: boolean;
};

export type CompanionGoalJourneyProgress = {
  goal: CompanionJourneyGoal;
  questCompletions: number;
  moments: number;
  reflections: number;
  completedStageCount: number;
  stages: CompanionJourneyStageProgress[];
  currentStage: CompanionJourneyStageProgress;
};

export type RecordJourneyMomentResult = {
  state: CompanionJourneyState;
  recorded: boolean;
  reason: 'no_active_goal' | 'already_recorded_today' | 'invalid_kind' | null;
};

export type AnswerJourneyConversationResult = {
  state: CompanionJourneyState;
  completed: boolean;
  createdGoalId: string | null;
  blockedReason: 'active_goal_limit' | null;
  suggestedQuickGoalIds: readonly string[];
};

export function emptyCompanionJourneyState(): CompanionJourneyState {
  return { schemaVersion: 1, goals: [], conversations: [], questEvents: [], momentEvents: [], reflectionEvents: [] };
}

export function normaliseCompanionJourneyState(value: unknown): CompanionJourneyState {
  if (!value || typeof value !== 'object') return emptyCompanionJourneyState();
  const candidate = value as Partial<CompanionJourneyState>;
  const goals = normaliseSingleFocus(Array.isArray(candidate.goals)
    ? candidate.goals.filter(isValidGoal).map((goal) => {
        const title = goal.title.trim();
        return {
          ...goal,
          title: LEGACY_GOAL_TITLE_REPLACEMENTS[`${goal.familyId}:${title}`] ?? title,
        };
      })
    : []);
  const goalIds = new Set(goals.map((goal) => goal.id));
  const conversations = Array.isArray(candidate.conversations)
    ? candidate.conversations.filter(isValidConversation).map((session) => ({
        ...session,
        answers: Array.isArray(session.answers) ? session.answers.filter(isValidConversationAnswer) : [],
      }))
    : [];
  const questEvents = Array.isArray(candidate.questEvents)
    ? uniqueById(candidate.questEvents.filter((event) => isValidQuestEvent(event) && goalIds.has(event.goalId)))
    : [];
  const momentEvents = Array.isArray(candidate.momentEvents)
    ? uniqueById(candidate.momentEvents.filter((event) => isValidMomentEvent(event) && goalIds.has(event.goalId)))
    : [];
  const reflectionEvents = Array.isArray(candidate.reflectionEvents)
    ? uniqueById(candidate.reflectionEvents.filter((event) => isValidReflectionEvent(event) && goalIds.has(event.goalId)))
    : [];
  return {
    schemaVersion: 1,
    goals: uniqueById(goals),
    conversations: uniqueById(conversations),
    questEvents,
    momentEvents,
    reflectionEvents,
  };
}

export function migrateLegacyDiscoveryGoals(
  state: CompanionJourneyState,
  discovery: CompanionDiscoveryState,
  migratedAt = Date.now()
): CompanionJourneyState {
  const mapping: Record<string, { familyId: KatchimeraFamilyId; goalTypeId: string }> = {
    'sleep-rest:wind-down-goal': { familyId: 'sleep-rest', goalTypeId: 'wind-down' },
    'tasklet:focus-goal': { familyId: 'tasklet', goalTypeId: 'project' },
    'vesperitt:night-intention': { familyId: 'vesperitt', goalTypeId: 'understand' },
  };
  let next = state;
  for (const answer of discovery.answers) {
    const mapped = mapping[answer.promptId];
    if (!mapped || !answer.value.trim()) continue;
    const id = `legacy-goal:${answer.familyId}:${answer.promptId}`;
    if (next.goals.some((goal) => goal.id === id)) continue;
    const status = answer.goalStatus === 'completed'
      ? 'completed'
      : answer.goalStatus === 'paused'
        ? 'paused'
        : 'active';
    const hasPrimary = next.goals.some(
      (goal) => goal.familyId === mapped.familyId && goal.isPrimary && goal.status === 'active'
    );
    const goal: CompanionJourneyGoal = {
      id,
      familyId: mapped.familyId,
      goalTypeId: mapped.goalTypeId,
      title: answer.value.trim(),
      status,
      isPrimary: status === 'active' && !hasPrimary,
      createdAt: answer.answeredAt || migratedAt,
      updatedAt: answer.answeredAt || migratedAt,
      completedAt: status === 'completed' ? answer.answeredAt || migratedAt : undefined,
    };
    next = { ...next, goals: [...next.goals, goal] };
  }
  return next;
}

export function goalsForJourneyFamily(
  state: CompanionJourneyState,
  familyId: KatchimeraFamilyId
): CompanionJourneyGoal[] {
  const order: Record<CompanionJourneyGoalStatus, number> = { active: 0, paused: 1, completed: 2, abandoned: 3 };
  return state.goals
    .filter((goal) => goal.familyId === familyId)
    .sort((left, right) => order[left.status] - order[right.status] || Number(right.isPrimary) - Number(left.isPrimary) || right.updatedAt - left.updatedAt);
}

export function primaryGoalForFamily(
  state: CompanionJourneyState,
  familyId: KatchimeraFamilyId
): CompanionJourneyGoal | null {
  const active = state.goals.filter((goal) => goal.familyId === familyId && goal.status === 'active');
  return active.find((goal) => goal.isPrimary) ?? active.sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;
}

export function activeConversationForFamily(
  state: CompanionJourneyState,
  familyId: KatchimeraFamilyId
): CompanionJourneyConversationSession | null {
  return state.conversations
    .filter((session) => session.familyId === familyId && !session.completedAt && session.currentNodeId)
    .sort((left, right) => right.startedAt - left.startedAt)[0] ?? null;
}

export function startJourneyConversation(
  state: CompanionJourneyState,
  familyId: KatchimeraFamilyId,
  startedAt = Date.now()
): CompanionJourneyState {
  const definition = companionJourneyByFamilyId.get(familyId);
  if (!definition || activeConversationForFamily(state, familyId)) return state;
  const session: CompanionJourneyConversationSession = {
    id: `journey-conversation:${familyId}:${startedAt}`,
    familyId,
    definitionId: definition.id,
    definitionVersion: definition.version,
    currentNodeId: definition.startNodeId,
    startedAt,
    answers: [],
  };
  return { ...state, conversations: [...state.conversations, session] };
}

export function currentJourneyConversationNode(
  session: CompanionJourneyConversationSession | null
): CompanionJourneyConversationNode | null {
  if (!session) return null;
  const definition = companionJourneyByFamilyId.get(session.familyId);
  return definition ? companionJourneyNode(definition, session.currentNodeId) : null;
}

export function answerJourneyConversation(
  state: CompanionJourneyState,
  sessionId: string,
  value: string,
  answeredAt = Date.now()
): AnswerJourneyConversationResult {
  const cleanValue = value.trim();
  const session = state.conversations.find((item) => item.id === sessionId);
  const definition = session ? companionJourneyByFamilyId.get(session.familyId) : null;
  const node = session && definition ? companionJourneyNode(definition, session.currentNodeId) : null;
  if (!session || !definition || !node || !cleanValue) {
    return { state, completed: false, createdGoalId: null, blockedReason: null, suggestedQuickGoalIds: [] };
  }

  let nextNodeId: string | null;
  let answerValue = cleanValue;
  let goalTitle = cleanValue;
  let suggestedQuickGoalIds = node.suggestedQuickGoalIds ?? [];
  if (node.kind === 'single_choice') {
    const choice = node.options?.find((option) => option.id === cleanValue || option.label === cleanValue);
    if (!choice && !node.allowCustomText) {
      return { state, completed: false, createdGoalId: null, blockedReason: null, suggestedQuickGoalIds: [] };
    }
    nextNodeId = choice?.nextNodeId ?? node.nextNodeId ?? null;
    answerValue = choice?.label ?? cleanValue;
    goalTitle = choice?.goalTitle ?? answerValue;
    suggestedQuickGoalIds = choice?.suggestedQuickGoalIds ?? suggestedQuickGoalIds;
  } else {
    nextNodeId = node.nextNodeId ?? null;
  }

  let goals = state.goals;
  let createdGoalId: string | null = null;
  if (node.createsGoalTypeId) {
    createdGoalId = `journey-goal:${session.familyId}:${answeredAt}`;
    goals = [
      ...goals.map((goal) => goal.familyId === session.familyId && goal.status === 'active'
        ? { ...goal, status: 'paused' as const, isPrimary: false, updatedAt: answeredAt }
        : goal),
      {
        id: createdGoalId,
        familyId: session.familyId,
        goalTypeId: node.createsGoalTypeId,
        title: goalTitle,
        status: 'active',
        isPrimary: true,
        createdAt: answeredAt,
        updatedAt: answeredAt,
      },
    ];
  }

  const answer: CompanionJourneyConversationAnswer = { nodeId: node.id, value: answerValue, answeredAt };
  const completed = nextNodeId === null;
  const conversations = state.conversations.map((item) =>
    item.id === session.id
      ? {
          ...item,
          currentNodeId: nextNodeId,
          completedAt: completed ? answeredAt : undefined,
          answers: [...item.answers.filter((existing) => existing.nodeId !== node.id), answer],
        }
      : item
  );
  return {
    state: { ...state, goals, conversations },
    completed,
    createdGoalId,
    blockedReason: null,
    suggestedQuickGoalIds,
  };
}

export function setJourneyGoalStatus(
  state: CompanionJourneyState,
  goalId: string,
  status: CompanionJourneyGoalStatus,
  updatedAt = Date.now()
): CompanionJourneyState {
  const target = state.goals.find((goal) => goal.id === goalId);
  if (!target || target.status === status) return state;
  const shouldChooseNewPrimary = target.isPrimary && status !== 'active';
  let goals = state.goals.map((goal) =>
    goal.id === goalId
      ? {
          ...goal,
          status,
          isPrimary: status === 'active',
          updatedAt,
          completedAt: status === 'completed' ? updatedAt : undefined,
        }
      : status === 'active' && goal.familyId === target.familyId && goal.status === 'active'
        ? { ...goal, status: 'paused' as const, isPrimary: false, updatedAt }
        : goal
  );
  if (status === 'active' && !goals.some((goal) => goal.familyId === target.familyId && goal.status === 'active' && goal.isPrimary)) {
    goals = goals.map((goal) => goal.id === goalId ? { ...goal, isPrimary: true } : goal);
  } else if (shouldChooseNewPrimary) {
    const replacement = goals
      .filter((goal) => goal.familyId === target.familyId && goal.status === 'active')
      .sort((left, right) => right.updatedAt - left.updatedAt)[0];
    if (replacement) goals = goals.map((goal) => goal.id === replacement.id ? { ...goal, isPrimary: true } : goal);
  }
  return { ...state, goals };
}

export function setPrimaryJourneyGoal(
  state: CompanionJourneyState,
  goalId: string,
  updatedAt = Date.now()
): CompanionJourneyState {
  const target = state.goals.find((goal) => goal.id === goalId && goal.status === 'active');
  if (!target) return state;
  return {
    ...state,
    goals: state.goals.map((goal) =>
      goal.familyId === target.familyId
        ? { ...goal, isPrimary: goal.id === goalId, updatedAt: goal.id === goalId ? updatedAt : goal.updatedAt }
        : goal
    ),
  };
}

export function syncJourneyQuestCompletions(
  state: CompanionJourneyState,
  quests: readonly CompanionQuest[]
): CompanionJourneyState {
  const existingIds = new Set(state.questEvents.map((event) => event.id));
  const questEvents = [...state.questEvents];
  for (const quest of quests) {
    if (!quest.completedAt) continue;
    const definition = questDefinition(quest.questId);
    const familyId = definition?.familyId;
    const contribution = definition?.goalContribution;
    if (!familyId || !contribution || contribution.amount <= 0) continue;
    const goal = primaryGoalForFamily(state, familyId);
    if (!goal) continue;
    if (quest.completedAt < goal.createdAt) continue;
    if (contribution.goalTypeIds?.length && !contribution.goalTypeIds.includes(goal.goalTypeId)) continue;
    const id = `journey-quest:${quest.creatureId}:${quest.questId}:${quest.acceptedAt}`;
    if (existingIds.has(id)) continue;
    existingIds.add(id);
    questEvents.push({
      id,
      familyId,
      goalId: goal.id,
      questId: quest.questId,
      creatureId: quest.creatureId,
      dayId: quest.completedDayId ?? localDayId(quest.completedAt),
      amount: contribution.amount,
      occurredAt: quest.completedAt,
    });
  }
  return questEvents.length === state.questEvents.length ? state : { ...state, questEvents };
}

export function recordJourneyReflection(
  state: CompanionJourneyState,
  familyId: KatchimeraFamilyId,
  sourceId: string,
  occurredAt = Date.now(),
  dayId?: string
): CompanionJourneyState {
  const goal = primaryGoalForFamily(state, familyId);
  if (!goal || !sourceId) return state;
  const id = `journey-reflection:${familyId}:${sourceId}`;
  if (state.reflectionEvents.some((event) => event.id === id)) return state;
  return {
    ...state,
    reflectionEvents: [
      ...state.reflectionEvents,
      { id, familyId, goalId: goal.id, sourceId, occurredAt, dayId },
    ],
  };
}

export function hasJourneyMomentForDay(
  state: CompanionJourneyState,
  goalId: string,
  dayId: string
): boolean {
  return state.questEvents.some((event) => event.goalId === goalId && event.dayId === dayId) ||
    state.momentEvents.some((event) => event.goalId === goalId && event.dayId === dayId);
}

export function recordJourneyMoment(
  state: CompanionJourneyState,
  familyId: KatchimeraFamilyId,
  kindId: string,
  note = '',
  occurredAt = Date.now(),
  dayId = localDayId(occurredAt)
): RecordJourneyMomentResult {
  const definition = companionJourneyByFamilyId.get(familyId);
  const goal = primaryGoalForFamily(state, familyId);
  if (!goal) return { state, recorded: false, reason: 'no_active_goal' };
  if (!definition?.checkIn.options.some((option) => option.id === kindId)) {
    return { state, recorded: false, reason: 'invalid_kind' };
  }
  if (hasJourneyMomentForDay(state, goal.id, dayId)) {
    return { state, recorded: false, reason: 'already_recorded_today' };
  }
  const trimmedNote = note.trim();
  return {
    state: {
      ...state,
      momentEvents: [
        ...state.momentEvents,
        {
          id: `journey-moment:${goal.id}:${dayId}`,
          familyId,
          goalId: goal.id,
          kindId,
          ...(trimmedNote ? { note: trimmedNote } : {}),
          dayId,
          occurredAt,
        },
      ],
    },
    recorded: true,
    reason: null,
  };
}

export function journeyProgressForGoal(
  state: CompanionJourneyState,
  goal: CompanionJourneyGoal,
  definition = companionJourneyByFamilyId.get(goal.familyId)
): CompanionGoalJourneyProgress | null {
  if (!definition) return null;
  const questCompletions = state.questEvents
    .filter((event) => event.goalId === goal.id)
    .reduce((sum, event) => sum + event.amount, 0);
  const moments = new Set([
    ...state.questEvents.filter((event) => event.goalId === goal.id).map((event) => event.dayId),
    ...state.momentEvents.filter((event) => event.goalId === goal.id).map((event) => event.dayId),
  ]).size;
  const reflections = state.reflectionEvents.filter((event) => event.goalId === goal.id).length;
  const rawStages = definition.stages.map((stage) => {
    const current = stage.requirement.kind === 'goal_created'
      ? 1
      : stage.requirement.kind === 'quest_completions'
        ? moments
        : stage.requirement.kind === 'reflections'
          ? reflections
          : goal.status === 'completed' || goal.status === 'abandoned'
            ? 1
            : 0;
    return {
      id: stage.id,
      title: stage.title,
      description: stage.description,
      requirementKind: stage.requirement.kind,
      current: Math.min(current, stage.requirement.target),
      target: stage.requirement.target,
      complete: current >= stage.requirement.target,
      currentStage: false,
    };
  });
  const currentIndex = rawStages.findIndex((stage) => !stage.complete);
  const selectedIndex = currentIndex < 0 ? rawStages.length - 1 : currentIndex;
  const stages = rawStages.map((stage, index) => ({ ...stage, currentStage: index === selectedIndex }));
  return {
    goal,
    questCompletions,
    moments,
    reflections,
    completedStageCount: stages.filter((stage) => stage.complete).length,
    stages,
    currentStage: stages[selectedIndex]!,
  };
}

export function reflectionPromptForJourney(
  state: CompanionJourneyState,
  familyId: KatchimeraFamilyId
): string | null {
  const definition = companionJourneyByFamilyId.get(familyId);
  if (!definition) return null;
  const goal = primaryGoalForFamily(state, familyId);
  if (!goal) {
    const firstStage = definition.stages[0];
    return firstStage ? definition.reflectionPrompts[firstStage.id] ?? null : null;
  }
  const progress = journeyProgressForGoal(state, goal, definition);
  if (!progress) return null;
  const template = definition.reflectionPrompts[progress.currentStage.id] ?? definition.reflectionPrompts[definition.stages[0]?.id ?? ''];
  return template?.replaceAll('{goal}', goal.title) ?? null;
}

export function validateCompanionJourneyDefinitions(): string[] {
  const issues: string[] = [];
  for (const definition of companionJourneyByFamilyId.values()) {
    const nodeIds = new Set(definition.nodes.map((node) => node.id));
    if (!nodeIds.has(definition.startNodeId)) issues.push(`${definition.familyId}: missing start node`);
    if (!definition.stages.length) issues.push(`${definition.familyId}: missing stages`);
    for (const node of definition.nodes) {
      if (node.createsGoalTypeId && !definition.goalTypes[node.createsGoalTypeId]) {
        issues.push(`${definition.familyId}:${node.id}: unknown goal type`);
      }
      const nextIds = node.kind === 'single_choice'
        ? (node.options ?? []).map((option) => option.nextNodeId)
        : [node.nextNodeId ?? null];
      for (const nextId of nextIds) {
        if (nextId && !nodeIds.has(nextId)) issues.push(`${definition.familyId}:${node.id}: missing next node ${nextId}`);
      }
    }
  }
  return issues;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function normaliseSingleFocus(goals: CompanionJourneyGoal[]): CompanionJourneyGoal[] {
  const retainedByFamily = new Map<KatchimeraFamilyId, string>();
  for (const familyId of new Set(goals.map((goal) => goal.familyId))) {
    const active = goals
      .filter((goal) => goal.familyId === familyId && goal.status === 'active')
      .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary) || right.updatedAt - left.updatedAt);
    if (active[0]) retainedByFamily.set(familyId, active[0].id);
  }
  return goals.map((goal) => {
    if (goal.status !== 'active') return goal.isPrimary ? { ...goal, isPrimary: false } : goal;
    const retained = retainedByFamily.get(goal.familyId) === goal.id;
    return retained
      ? { ...goal, isPrimary: true }
      : { ...goal, status: 'paused', isPrimary: false };
  });
}

function isValidGoal(value: unknown): value is CompanionJourneyGoal {
  if (!value || typeof value !== 'object') return false;
  const goal = value as CompanionJourneyGoal;
  return typeof goal.id === 'string' && typeof goal.familyId === 'string' && typeof goal.goalTypeId === 'string' &&
    typeof goal.title === 'string' && Boolean(goal.title.trim()) &&
    ['active', 'paused', 'completed', 'abandoned'].includes(goal.status) &&
    typeof goal.isPrimary === 'boolean' && Number.isFinite(goal.createdAt) && Number.isFinite(goal.updatedAt);
}

function isValidConversation(value: unknown): value is CompanionJourneyConversationSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as CompanionJourneyConversationSession;
  return typeof session.id === 'string' && typeof session.familyId === 'string' &&
    typeof session.definitionId === 'string' && Number.isFinite(session.definitionVersion) &&
    (typeof session.currentNodeId === 'string' || session.currentNodeId === null) &&
    Number.isFinite(session.startedAt);
}

function isValidConversationAnswer(value: unknown): value is CompanionJourneyConversationAnswer {
  if (!value || typeof value !== 'object') return false;
  const answer = value as CompanionJourneyConversationAnswer;
  return typeof answer.nodeId === 'string' && typeof answer.value === 'string' && Number.isFinite(answer.answeredAt);
}

function isValidQuestEvent(value: unknown): value is CompanionJourneyQuestEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as CompanionJourneyQuestEvent;
  return typeof event.id === 'string' && typeof event.familyId === 'string' && typeof event.goalId === 'string' &&
    typeof event.questId === 'string' && typeof event.creatureId === 'string' && typeof event.dayId === 'string' &&
    Number.isFinite(event.amount) && Number.isFinite(event.occurredAt);
}

function isValidReflectionEvent(value: unknown): value is CompanionJourneyReflectionEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as CompanionJourneyReflectionEvent;
  return typeof event.id === 'string' && typeof event.familyId === 'string' && typeof event.goalId === 'string' &&
    typeof event.sourceId === 'string' && Number.isFinite(event.occurredAt);
}

function isValidMomentEvent(value: unknown): value is CompanionJourneyMomentEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as CompanionJourneyMomentEvent;
  return typeof event.id === 'string' && typeof event.familyId === 'string' && typeof event.goalId === 'string' &&
    typeof event.kindId === 'string' && typeof event.dayId === 'string' &&
    (event.note === undefined || typeof event.note === 'string') && Number.isFinite(event.occurredAt);
}

function localDayId(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
