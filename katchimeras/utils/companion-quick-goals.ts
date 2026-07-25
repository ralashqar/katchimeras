import {
  companionQuickGoalTemplateById,
  type CompanionQuickGoalTemplate,
} from '@/constants/companion-quick-goals';
import type { KatchimeraFamilyId } from '@/types/katchimera';

export type CompanionQuickGoalCadence =
  | { kind: 'once'; dayId: string }
  | { kind: 'daily' }
  | { kind: 'weekdays'; weekdays: number[] };

export type CompanionQuickGoalStatus = 'active' | 'paused' | 'archived';

export type CompanionQuickGoal = {
  id: string;
  familyId: KatchimeraFamilyId;
  templateId?: string;
  title: string;
  cadence: CompanionQuickGoalCadence;
  status: CompanionQuickGoalStatus;
  createdAt: number;
  updatedAt: number;
};

export type CompanionQuickGoalCompletion = {
  id: string;
  goalId: string;
  familyId: KatchimeraFamilyId;
  dayId: string;
  completedAt: number;
  journaledAt?: number;
};

export type CompanionQuickGoalState = {
  schemaVersion: 1;
  goals: CompanionQuickGoal[];
  completions: CompanionQuickGoalCompletion[];
};

export type CompanionQuickGoalForDay = {
  goal: CompanionQuickGoal;
  completion: CompanionQuickGoalCompletion | null;
};

export type AddCompanionQuickGoalInput = {
  familyId: KatchimeraFamilyId;
  title: string;
  cadence: CompanionQuickGoalCadence;
  templateId?: string;
};

export type AddCompanionQuickGoalResult = {
  state: CompanionQuickGoalState;
  goal: CompanionQuickGoal | null;
  reason: 'blank_title' | 'duplicate' | 'invalid_template' | null;
};

export function emptyCompanionQuickGoalState(): CompanionQuickGoalState {
  return { schemaVersion: 1, goals: [], completions: [] };
}

export function normaliseCompanionQuickGoalState(value: unknown): CompanionQuickGoalState {
  if (!value || typeof value !== 'object') return emptyCompanionQuickGoalState();
  const candidate = value as Partial<CompanionQuickGoalState>;
  const goals = Array.isArray(candidate.goals)
    ? uniqueById(candidate.goals.filter(isValidGoal).map((goal) => ({
        ...goal,
        title: goal.title.trim(),
        cadence: normaliseCadence(goal.cadence),
      })))
    : [];
  const goalIds = new Set(goals.map((goal) => goal.id));
  const completions = Array.isArray(candidate.completions)
    ? uniqueById(candidate.completions.filter((completion) =>
        isValidCompletion(completion) && goalIds.has(completion.goalId)
      ))
    : [];
  return { schemaVersion: 1, goals, completions };
}

export function cadenceFromTemplate(
  template: CompanionQuickGoalTemplate,
  dayId: string
): CompanionQuickGoalCadence {
  if (template.defaultCadence.kind === 'once') return { kind: 'once', dayId };
  if (template.defaultCadence.kind === 'daily') return { kind: 'daily' };
  return { kind: 'weekdays', weekdays: [...template.defaultCadence.weekdays] };
}

export function addCompanionQuickGoal(
  state: CompanionQuickGoalState,
  input: AddCompanionQuickGoalInput,
  createdAt = Date.now()
): AddCompanionQuickGoalResult {
  const title = input.title.trim();
  if (!title) return { state, goal: null, reason: 'blank_title' };
  if (input.templateId) {
    const template = companionQuickGoalTemplateById.get(input.templateId);
    if (!template || template.familyId !== input.familyId) {
      return { state, goal: null, reason: 'invalid_template' };
    }
  }
  const duplicate = state.goals.some((goal) =>
    goal.familyId === input.familyId &&
    goal.status !== 'archived' &&
    (
      input.templateId
        ? goal.templateId === input.templateId
        : normalisedTitle(goal.title) === normalisedTitle(title)
    )
  );
  if (duplicate) return { state, goal: null, reason: 'duplicate' };
  const goal: CompanionQuickGoal = {
    id: `quick-goal:${input.familyId}:${createdAt}:${slug(title)}`,
    familyId: input.familyId,
    ...(input.templateId ? { templateId: input.templateId } : {}),
    title,
    cadence: normaliseCadence(input.cadence),
    status: 'active',
    createdAt,
    updatedAt: createdAt,
  };
  return { state: { ...state, goals: [...state.goals, goal] }, goal, reason: null };
}

export function updateCompanionQuickGoal(
  state: CompanionQuickGoalState,
  goalId: string,
  updates: {
    title?: string;
    cadence?: CompanionQuickGoalCadence;
    status?: CompanionQuickGoalStatus;
  },
  updatedAt = Date.now()
): CompanionQuickGoalState {
  const goal = state.goals.find((item) => item.id === goalId);
  if (!goal) return state;
  const title = updates.title === undefined ? goal.title : updates.title.trim();
  if (!title) return state;
  const nextGoal: CompanionQuickGoal = {
    ...goal,
    title,
    cadence: updates.cadence ? normaliseCadence(updates.cadence) : goal.cadence,
    status: updates.status ?? goal.status,
    updatedAt,
  };
  if (JSON.stringify(nextGoal) === JSON.stringify(goal)) return state;
  return {
    ...state,
    goals: state.goals.map((item) => item.id === goalId ? nextGoal : item),
  };
}

export function quickGoalsForDay(
  state: CompanionQuickGoalState,
  dayId: string,
  familyId?: KatchimeraFamilyId | null
): CompanionQuickGoalForDay[] {
  const completionByGoalId = new Map(
    state.completions
      .filter((completion) => completion.dayId === dayId)
      .map((completion) => [completion.goalId, completion])
  );
  return state.goals
    .filter((goal) =>
      goal.status === 'active' &&
      (!familyId || goal.familyId === familyId) &&
      cadenceIncludesDay(goal.cadence, dayId)
    )
    .map((goal) => ({ goal, completion: completionByGoalId.get(goal.id) ?? null }))
    .sort((left, right) => {
      if (Boolean(left.completion) !== Boolean(right.completion)) return left.completion ? 1 : -1;
      return left.goal.createdAt - right.goal.createdAt;
    });
}

export function completeCompanionQuickGoal(
  state: CompanionQuickGoalState,
  goalId: string,
  dayId: string,
  completedAt = Date.now()
): { state: CompanionQuickGoalState; completion: CompanionQuickGoalCompletion | null; completed: boolean } {
  const goal = state.goals.find((item) =>
    item.id === goalId && item.status === 'active' && cadenceIncludesDay(item.cadence, dayId)
  );
  if (!goal) return { state, completion: null, completed: false };
  const id = quickGoalCompletionId(goalId, dayId);
  const existing = state.completions.find((item) => item.id === id);
  if (existing) return { state, completion: existing, completed: false };
  const completion: CompanionQuickGoalCompletion = {
    id,
    goalId,
    familyId: goal.familyId,
    dayId,
    completedAt,
  };
  return {
    state: { ...state, completions: [...state.completions, completion] },
    completion,
    completed: true,
  };
}

export function undoCompanionQuickGoal(
  state: CompanionQuickGoalState,
  goalId: string,
  dayId: string
): { state: CompanionQuickGoalState; completion: CompanionQuickGoalCompletion | null; undone: boolean } {
  const id = quickGoalCompletionId(goalId, dayId);
  const completion = state.completions.find((item) => item.id === id) ?? null;
  if (!completion) return { state, completion: null, undone: false };
  return {
    state: { ...state, completions: state.completions.filter((item) => item.id !== id) },
    completion,
    undone: true,
  };
}

export function markQuickGoalCompletionJournaled(
  state: CompanionQuickGoalState,
  completionId: string,
  journaledAt = Date.now()
): CompanionQuickGoalState {
  const completion = state.completions.find((item) => item.id === completionId);
  if (!completion || completion.journaledAt) return state;
  return {
    ...state,
    completions: state.completions.map((item) =>
      item.id === completionId ? { ...item, journaledAt } : item
    ),
  };
}

export function quickGoalCompletionId(goalId: string, dayId: string): string {
  return `quick-goal-completion:${goalId}:${dayId}`;
}

export function cadenceIncludesDay(cadence: CompanionQuickGoalCadence, dayId: string): boolean {
  if (cadence.kind === 'once') return cadence.dayId === dayId;
  if (cadence.kind === 'daily') return true;
  const weekday = new Date(`${dayId}T12:00:00`).getDay();
  return cadence.weekdays.includes(weekday);
}

export function quickGoalCadenceLabel(cadence: CompanionQuickGoalCadence): string {
  if (cadence.kind === 'once') return 'Today only';
  if (cadence.kind === 'daily') return 'Every day';
  if (cadence.weekdays.join(',') === '1,2,3,4,5') return 'Weekdays';
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return cadence.weekdays.map((day) => labels[day]).filter(Boolean).join(', ');
}

function normaliseCadence(cadence: CompanionQuickGoalCadence): CompanionQuickGoalCadence {
  if (cadence.kind === 'once') return { kind: 'once', dayId: cadence.dayId };
  if (cadence.kind === 'daily') return { kind: 'daily' };
  return {
    kind: 'weekdays',
    weekdays: [...new Set(cadence.weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort(),
  };
}

function isValidGoal(value: unknown): value is CompanionQuickGoal {
  if (!value || typeof value !== 'object') return false;
  const goal = value as CompanionQuickGoal;
  return typeof goal.id === 'string' && typeof goal.familyId === 'string' &&
    typeof goal.title === 'string' && Boolean(goal.title.trim()) &&
    ['active', 'paused', 'archived'].includes(goal.status) &&
    isValidCadence(goal.cadence) && Number.isFinite(goal.createdAt) && Number.isFinite(goal.updatedAt);
}

function isValidCadence(value: unknown): value is CompanionQuickGoalCadence {
  if (!value || typeof value !== 'object') return false;
  const cadence = value as CompanionQuickGoalCadence;
  return cadence.kind === 'daily' ||
    (cadence.kind === 'once' && typeof cadence.dayId === 'string' && Boolean(cadence.dayId)) ||
    (cadence.kind === 'weekdays' && Array.isArray(cadence.weekdays));
}

function isValidCompletion(value: unknown): value is CompanionQuickGoalCompletion {
  if (!value || typeof value !== 'object') return false;
  const completion = value as CompanionQuickGoalCompletion;
  return typeof completion.id === 'string' && typeof completion.goalId === 'string' &&
    typeof completion.familyId === 'string' && typeof completion.dayId === 'string' &&
    Number.isFinite(completion.completedAt) &&
    (completion.journaledAt === undefined || Number.isFinite(completion.journaledAt));
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function normalisedTitle(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function slug(value: string): string {
  return normalisedTitle(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'goal';
}
