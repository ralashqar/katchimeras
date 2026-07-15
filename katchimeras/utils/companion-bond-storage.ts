import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import {
  backfillQuestBondEvents,
  emptyCompanionBondState,
  normaliseCompanionBondState,
  type CompanionBondState,
} from '@/utils/companion-bond';
import type { CompanionQuestState } from '@/utils/katchimera-quests';

const STORAGE_KEY = 'katchadeck.companion-bond-v1';

export function loadCompanionBondState(questState?: CompanionQuestState): CompanionBondState {
  const stored = normaliseCompanionBondState(getStoredJson<CompanionBondState>(STORAGE_KEY, emptyCompanionBondState()));
  const migrated = questState ? backfillQuestBondEvents(stored, questState) : stored;
  if (migrated.events.length !== stored.events.length) saveCompanionBondState(migrated);
  return migrated;
}

export function saveCompanionBondState(state: CompanionBondState): void {
  setStoredJson(STORAGE_KEY, normaliseCompanionBondState(state));
}
