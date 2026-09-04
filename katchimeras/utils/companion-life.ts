import { lifeHabitById, type LifeCompanionFamily } from '@/constants/companion-life-content';
import { addCompanionQuickGoal, updateCompanionQuickGoal, type CompanionQuickGoalState } from '@/utils/companion-quick-goals';

export type CompanionJournalEntry = {
  id: string; familyId: LifeCompanionFamily; title: string; createdAt: number; updatedAt: number;
  facts: Record<string, string>; goalId?: string; seedId?: string; kind: 'conversation' | 'chapter';
  summaryOverride?: string; note?: string; removedAt?: number;
};
export type CompanionLifeState = {
  schemaVersion: 1;
  habitReceipts?: string[];
  entries: CompanionJournalEntry[];
};
export const emptyCompanionLifeState = (): CompanionLifeState => ({ schemaVersion: 1, entries: [] });

/** Replay adds facts to the same source; edits and removal markers always win. */
export function upsertCompanionJournal(state: CompanionLifeState, entry: CompanionJournalEntry): CompanionLifeState {
  const previous = state.entries.find((item) => item.id === entry.id);
  if (previous?.removedAt != null) return state;
  const next = previous ? { ...entry, ...previous, title: entry.title, facts: { ...previous.facts, ...entry.facts },
    goalId: entry.goalId ?? previous.goalId, seedId: entry.seedId ?? previous.seedId, updatedAt: entry.updatedAt } : entry;
  if (previous && JSON.stringify({ ...previous, updatedAt: 0 }) === JSON.stringify({ ...next, updatedAt: 0 })) return state;
  return { ...state, entries: previous ? state.entries.map((item) => item.id === entry.id ? next : item) : [...state.entries, next] };
}

export function selectDailyStoryHabit(state: CompanionQuickGoalState, familyId: LifeCompanionFamily, habitId: string, now = Date.now()) {
  const habit = lifeHabitById.get(habitId);
  if (!habit || habit.familyId !== familyId) return { state, goal: null };
  let next = state;
  const previousId = state.storyHabitIds?.[familyId];
  // Reuse an existing exact template instead of creating a duplicate.
  let goal = next.goals.find((item) => item.familyId === familyId && item.templateId === habitId && item.status !== 'archived');
  if (!goal) {
    const result = addCompanionQuickGoal(next, { familyId, title: habit.title, templateId: habitId, cadence: { kind: 'daily' } }, now);
    if (!result.goal) return { state, goal: null };
    next = result.state; goal = result.goal;
  }
  if (previousId && previousId !== goal.id) next = updateCompanionQuickGoal(next, previousId, { status: 'paused' }, now);
  next = updateCompanionQuickGoal(next, goal.id, { status: 'active', cadence: { kind: 'daily' } }, now);
  next = { ...next, storyHabitIds: { ...next.storyHabitIds, [familyId]: goal.id } };
  return { state: next, goal: next.goals.find((item) => item.id === goal.id)! };
}

export function selectedStoryHabit(state: CompanionQuickGoalState, familyId: LifeCompanionFamily) {
  return state.goals.find((goal) => goal.id === state.storyHabitIds?.[familyId] && goal.status !== 'archived') ?? null;
}

export function journalSummary(entry: CompanionJournalEntry) {
  return entry.summaryOverride ?? Object.values(entry.facts).filter(Boolean).join(' ');
}
