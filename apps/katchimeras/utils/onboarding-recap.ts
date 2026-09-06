import { getStoredJson, removeStoredValue, setStoredJson } from '@/utils/app-storage';

const RECAP_KEY = 'katchimeras.onboarding.recap.v1';

export type OnboardingRecap = {
  moodId: string | null;
  activityIds: string[];
  // Encounter seeds the first hatches lean toward, ordered as the user answered —
  // produced by the Hatch-Your-Past prompts and consumed by the backfill as the
  // preferred floor when a reconstructed day has no real signal of its own.
  preferredSeedIds: string[];
  semanticTags: string[];
  savedAt: string;
};

export function loadOnboardingRecap(): OnboardingRecap | null {
  return getStoredJson<OnboardingRecap | null>(RECAP_KEY, null);
}

export function saveOnboardingRecap(recap: OnboardingRecap) {
  setStoredJson(RECAP_KEY, recap);
}

export function clearOnboardingRecap() {
  removeStoredValue(RECAP_KEY);
}
