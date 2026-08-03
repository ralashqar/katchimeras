import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import {
  emptyCompanionContentState,
  normaliseCompanionContentState,
  type CompanionContentState,
} from '@/utils/companion-content';

const STORAGE_KEY = 'katchadeck.companion-content-v1';

export function loadCompanionContentState(): CompanionContentState {
  return normaliseCompanionContentState(
    getStoredJson<CompanionContentState>(STORAGE_KEY, emptyCompanionContentState())
  );
}

export function saveCompanionContentState(state: CompanionContentState): void {
  setStoredJson(STORAGE_KEY, normaliseCompanionContentState(state));
}

