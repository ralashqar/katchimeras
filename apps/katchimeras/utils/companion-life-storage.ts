import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { emptyCompanionLifeState, upsertCompanionJournal, selectDailyStoryHabit, type CompanionJournalEntry, type CompanionLifeState } from './companion-life';
import { loadCompanionQuickGoalState, saveCompanionQuickGoalState } from './companion-quick-goal-storage';
import type { LifeCompanionFamily } from '@/constants/companion-life-content';

const KEY = 'katchadeck.companion-life-v1';
const listeners = new Set<() => void>();
export function loadCompanionLife(): CompanionLifeState {
  const value = getStoredJson<CompanionLifeState>(KEY, emptyCompanionLifeState());
  if (!value || !Array.isArray(value.entries)) return emptyCompanionLifeState();
  return { schemaVersion: 1, habitReceipts: Array.isArray(value.habitReceipts) ? value.habitReceipts.filter((item) => typeof item === 'string') : [], entries: value.entries.filter((entry) => entry && typeof entry.id === 'string' && entry.facts && ['mossprout', 'steppling'].includes(entry.familyId)) };
}
function save(state: CompanionLifeState) { setStoredJson(KEY, state); listeners.forEach((listener) => listener()); }
export function subscribeCompanionLife(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function rememberCompanionMoment(entry: CompanionJournalEntry) {
  const state = loadCompanionLife(); const next = upsertCompanionJournal(state, entry);
  if (next !== state) save(next);
}
export function editCompanionMoment(id: string, update: Pick<Partial<CompanionJournalEntry>, 'summaryOverride' | 'note' | 'removedAt'>) {
  const state = loadCompanionLife();
  save({ ...state, entries: state.entries.map((entry) => entry.id === id ? { ...entry, ...update, updatedAt: Date.now() } : entry) });
}
export function acceptDailyStoryHabit(familyId: LifeCompanionFamily, habitId: string, entryId?: string, receiptId?: string) {
  if (receiptId && loadCompanionLife().habitReceipts?.includes(receiptId)) return null;
  const result = selectDailyStoryHabit(loadCompanionQuickGoalState(), familyId, habitId);
  if (!result.goal) throw new Error('This habit could not be added.');
  saveCompanionQuickGoalState(result.state);
  const entry = loadCompanionLife().entries.find((item) => item.id === entryId);
  if (entry) rememberCompanionMoment({ ...entry, goalId: result.goal.id, facts: { habit: `You chose “${result.goal.title}” as a daily habit.` }, updatedAt: Date.now() });
  if (receiptId) { const state = loadCompanionLife(); save({ ...state, habitReceipts: [...(state.habitReceipts ?? []), receiptId] }); }
  return result.goal;
}
