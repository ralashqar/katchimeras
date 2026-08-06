import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import {
  emptyCompanionQuickGoalState,
  normaliseCompanionQuickGoalState,
  resetCompanionQuickGoalProgressForDay,
  type CompanionQuickGoalState,
} from '@/utils/companion-quick-goals';

const STORAGE_KEY = 'katchadeck.companion-quick-goals-v1';
const listeners = new Set<() => void>();

export function loadCompanionQuickGoalState(): CompanionQuickGoalState {
  const stored = getStoredJson<CompanionQuickGoalState>(STORAGE_KEY, emptyCompanionQuickGoalState());
  const normalized = normaliseCompanionQuickGoalState(stored);
  if (JSON.stringify(normalized) !== JSON.stringify(stored)) setStoredJson(STORAGE_KEY, normalized);
  return normalized;
}

export function saveCompanionQuickGoalState(state: CompanionQuickGoalState): void {
  setStoredJson(STORAGE_KEY, normaliseCompanionQuickGoalState(state));
}

export function resetStoredCompanionQuickGoalProgressForDay(dayId: string): void {
  const current = loadCompanionQuickGoalState();
  const next = resetCompanionQuickGoalProgressForDay(current, dayId);
  if (next !== current) saveCompanionQuickGoalState(next);
  // Mounted Today tabs keep their own hook state. Refresh them before the Home
  // record is replaced so stale completion receipts cannot be re-awarded.
  listeners.forEach((listener) => listener());
}

export function subscribeCompanionQuickGoalResets(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
