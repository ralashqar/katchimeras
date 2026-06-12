import { getStoredJson, removeStoredValue, setStoredJson } from '@/utils/app-storage';

const ONBOARDING_STORAGE_KEY = 'katchadeck.onboarding-profile';

export type OnboardingProfile = {
  completed: boolean;
  aspirationId: string | null;
  painPointIds: string[];
  preferenceIds: string[];
  completedAt: string | null;
  hatchHour: number | null;
};

export const defaultOnboardingProfile: OnboardingProfile = {
  completed: false,
  aspirationId: null,
  painPointIds: [],
  preferenceIds: [],
  completedAt: null,
  hatchHour: null,
};

export function loadOnboardingProfile(): OnboardingProfile {
  const stored = getStoredJson(ONBOARDING_STORAGE_KEY, defaultOnboardingProfile);
  return { ...defaultOnboardingProfile, ...stored };
}

export function saveOnboardingProfile(profile: OnboardingProfile) {
  setStoredJson(ONBOARDING_STORAGE_KEY, profile);
}

export function resetOnboardingProfile() {
  removeStoredValue(ONBOARDING_STORAGE_KEY);
}
