import { gameNow } from '@/utils/game-clock';
import { saveWithGameplayOutbox } from '@/features/live-ops/source-outbox';
import { getStoredJson } from '@/utils/app-storage';
import {
  backfillHatchBondEvents,
  backfillQuestBondEvents,
  emptyCompanionBondState,
  migrateCompanionBondIdentity,
  normaliseCompanionBondState,
  resetCompanionBondForCreatures,
  type CompanionBondState,
} from '@/utils/companion-bond';
import { companionIdForFamily, katchimeraFamilies } from '@/constants/katchimera-skins';
import type { CompanionQuestState } from '@/utils/katchimera-quests';
import type { StoredHomeState } from '@/types/home';

const STORAGE_KEY = 'katchadeck.companion-bond-v1';
const listeners = new Set<() => void>();

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
  saveWithGameplayOutbox(STORAGE_KEY, normaliseCompanionBondState(state));
  queueMicrotask(() => listeners.forEach((listener) => listener()));
}

export function subscribeCompanionBondState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetLaunchCompanionBondsForDebug(resetAt = gameNow()): void {
  const stored = normaliseCompanionBondState(
    getStoredJson<CompanionBondState>(STORAGE_KEY, emptyCompanionBondState())
  );
  saveCompanionBondState(resetCompanionBondForCreatures(
    stored,
    ['steppling', 'baristabbit', 'flexel'].map(companionIdForFamily),
    resetAt
  ));
}

export function resetAllKatchimeraBondsForDebug(resetAt = gameNow()): void {
  const stored = normaliseCompanionBondState(
    getStoredJson<CompanionBondState>(STORAGE_KEY, emptyCompanionBondState())
  );
  saveCompanionBondState(resetCompanionBondForCreatures(
    stored,
    katchimeraFamilies.map((family) => companionIdForFamily(family.id)),
    resetAt
  ));
}
