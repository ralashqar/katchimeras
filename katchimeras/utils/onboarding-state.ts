import { getStoredJson, removeStoredValue, setStoredJson } from '@/utils/app-storage';

const ONBOARDING_STORAGE_KEY = 'katchadeck.onboarding-profile';

export type OnboardingProfile = {
  completed: boolean;
  aspirationId: string | null;
  painPointIds: string[];
  preferenceIds: string[];
  completedAt: string | null;
};

export const defaultOnboardingProfile: OnboardingProfile = {
  completed: false,
  aspirationId: null,
  painPointIds: [],
  preferenceIds: [],
  completedAt: null,
};

export function loadOnboardingProfile() {
  return getStoredJson(ONBOARDING_STORAGE_KEY, defaultOnboardingProfile);
}

export function saveOnboardingProfile(profile: OnboardingProfile) {
  setStoredJson(ONBOARDING_STORAGE_KEY, profile);
}

export function resetOnboardingProfile() {
  removeStoredValue(ONBOARDING_STORAGE_KEY);
}
