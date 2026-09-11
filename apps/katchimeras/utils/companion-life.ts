import { lifeHabitById, type LifeCompanionFamily } from '@/constants/companion-life-content';
import type { ConversationDefinition, ConversationOption, ConversationSession, ConversationTraitId } from '@/types/companion-conversation';
import { CONVERSATION_TRAIT_PHRASES } from '@/utils/companion-conversation';
import { addCompanionQuickGoal, updateCompanionQuickGoal, type CompanionQuickGoalState } from '@/utils/companion-quick-goals';

export type CompanionJournalEntry = {
  id: string; familyId: LifeCompanionFamily; title: string; createdAt: number; updatedAt: number;
  facts: Record<string, string>; goalId?: string; seedId?: string; kind: 'conversation' | 'chapter' | 'activity';
  photo?: { uri: string; memoryId: string; confirmedSubject?: string };
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

/**
 * A scenario question answered ("a path off the trail isn't on the map") becomes
 * one journal entry: the question, what the player chose, the friend's reply,
 * and what the answer quietly noticed. One entry per question per day; replaying
 * the same day rewrites it. Over time the journal is a map of who the player is,
 * drawn from their own choices rather than a test.
 */
export function scenarioJournalEntry(session: ConversationSession, definition: ConversationDefinition): CompanionJournalEntry | null {
  if (session.preview || session.status !== 'completed') return null;
  const familyId = definition.familyId;
  if (familyId !== 'mossprout' && familyId !== 'steppling') return null;
  const at = session.completedAt ?? session.updatedAt;
  // "Mossprout thinks he knows you": what he said, and what the player said back.
  if (definition.tags?.includes('theory')) {
    const confirm = definition.nodes.find((node) => node.id === 'confirm');
    const turn = session.turns.find((candidate) => candidate.nodeId === 'confirm');
    const option = confirm?.kind === 'choice' ? confirm.options.find((candidate) => candidate.id === turn?.optionId) : undefined;
    if (!confirm || confirm.kind !== 'choice' || !option) return null;
    const theory = confirm.prompt.split('\n\n').at(-1) ?? confirm.prompt;
    return { id: `theory:${definition.id}`, familyId, title: definition.title, kind: 'conversation', createdAt: at, updatedAt: at,
      facts: { theory: `Mossprout said: “${theory}”`, answer: `You said “${option.spokenText ?? option.label}”.` } };
  }
  const facts: Record<string, string> = {};
  const noticed = new Map<ConversationTraitId, number>();
  for (const turn of session.turns) {
    const node = definition.nodes.find((item) => item.id === turn.nodeId);
    if (!node) continue;
    let option: ConversationOption | undefined;
    let prompt = '';
    if (node.kind === 'choice' || node.kind === 'poll') {
      option = node.options.find((item) => item.id === turn.optionId);
      prompt = node.prompt;
    } else if (node.kind === 'insight_game' || node.kind === 'profile_game') {
      const question = node.questions.find((candidate) => candidate.options.some((item) => item.id === turn.optionId));
      option = question?.options.find((item) => item.id === turn.optionId);
      prompt = question?.prompt ?? '';
    }
    if (!option?.traits) continue;
    facts[`${node.id}:${option.id}`] = `${prompt} You chose “${option.label}”. ${option.reply}`.trim();
    for (const [trait, weight] of Object.entries(option.traits) as [ConversationTraitId, 1 | 2][]) noticed.set(trait, (noticed.get(trait) ?? 0) + weight);
  }
  if (!Object.keys(facts).length) return null;
  const phrases = [...noticed.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, 2).map(([trait]) => CONVERSATION_TRAIT_PHRASES[trait]);
  facts.noticed = `${familyId === 'mossprout' ? 'Mossprout' : 'Steppling'} noticed: ${phrases.join(', ')}.`;
  return { id: `answer:${definition.id}:${session.servedDayId}`, familyId, title: definition.title, kind: 'conversation', createdAt: at, updatedAt: at, facts };
}
