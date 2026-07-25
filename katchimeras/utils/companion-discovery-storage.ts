import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import {
  emptyCompanionDiscoveryState,
  normaliseCompanionDiscoveryState,
  type CompanionDiscoveryState,
} from '@/utils/companion-discovery';

const STORAGE_KEY = 'katchadeck.companion-discovery-v1';

export function loadCompanionDiscoveryState(): CompanionDiscoveryState {
  return normaliseCompanionDiscoveryState(
    getStoredJson<CompanionDiscoveryState>(STORAGE_KEY, emptyCompanionDiscoveryState())
  );
}

export function saveCompanionDiscoveryState(state: CompanionDiscoveryState): void {
  setStoredJson(STORAGE_KEY, normaliseCompanionDiscoveryState(state));
}
