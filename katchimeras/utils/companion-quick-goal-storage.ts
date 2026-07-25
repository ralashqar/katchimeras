import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import {
  emptyCompanionQuickGoalState,
  normaliseCompanionQuickGoalState,
  type CompanionQuickGoalState,
} from '@/utils/companion-quick-goals';

const STORAGE_KEY = 'katchadeck.companion-quick-goals-v1';

export function loadCompanionQuickGoalState(): CompanionQuickGoalState {
  const stored = getStoredJson<CompanionQuickGoalState>(STORAGE_KEY, emptyCompanionQuickGoalState());
  const normalized = normaliseCompanionQuickGoalState(stored);
  if (JSON.stringify(normalized) !== JSON.stringify(stored)) setStoredJson(STORAGE_KEY, normalized);
  return normalized;
}

export function saveCompanionQuickGoalState(state: CompanionQuickGoalState): void {
  setStoredJson(STORAGE_KEY, normaliseCompanionQuickGoalState(state));
}
