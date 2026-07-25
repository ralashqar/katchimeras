import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import {
  backfillHatchBondEvents,
  backfillQuestBondEvents,
  emptyCompanionBondState,
  migrateCompanionBondIdentity,
  normaliseCompanionBondState,
  type CompanionBondState,
} from '@/utils/companion-bond';
import type { CompanionQuestState } from '@/utils/katchimera-quests';
import type { StoredHomeState } from '@/types/home';

const STORAGE_KEY = 'katchadeck.companion-bond-v1';

export function loadCompanionBondState(
  questState?: CompanionQuestState,
  resolveCompanionId: (value: string) => string = (value) => value,
  homeState?: Pick<StoredHomeState, 'archivedDays' | 'today' | 'tomorrow'> | null
): CompanionBondState {
  const stored = normaliseCompanionBondState(getStoredJson<CompanionBondState>(STORAGE_KEY, emptyCompanionBondState()));
  const identityMigrated = migrateCompanionBondIdentity(stored, resolveCompanionId);
  const questMigrated = questState ? backfillQuestBondEvents(identityMigrated, questState) : identityMigrated;
  const migrated = backfillHatchBondEvents(questMigrated, homeState);
  if (migrated !== stored || migrated.events.length !== stored.events.length) saveCompanionBondState(migrated);
  return migrated;
}

export function saveCompanionBondState(state: CompanionBondState): void {
  setStoredJson(STORAGE_KEY, normaliseCompanionBondState(state));
}
