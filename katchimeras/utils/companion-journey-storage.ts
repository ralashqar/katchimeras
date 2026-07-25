import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { loadCompanionDiscoveryState } from '@/utils/companion-discovery-storage';
import {
  emptyCompanionJourneyState,
  migrateLegacyDiscoveryGoals,
  normaliseCompanionJourneyState,
  type CompanionJourneyState,
} from '@/utils/companion-journey';

const STORAGE_KEY = 'katchadeck.companion-journey-v1';

export function loadCompanionJourneyState(): CompanionJourneyState {
  const stored = getStoredJson<CompanionJourneyState>(STORAGE_KEY, emptyCompanionJourneyState());
  const normalized = normaliseCompanionJourneyState(stored);
  const migrated = migrateLegacyDiscoveryGoals(normalized, loadCompanionDiscoveryState());
  if (JSON.stringify(migrated) !== JSON.stringify(stored)) setStoredJson(STORAGE_KEY, migrated);
  return migrated;
}

export function saveCompanionJourneyState(state: CompanionJourneyState): void {
  setStoredJson(STORAGE_KEY, normaliseCompanionJourneyState(state));
}
