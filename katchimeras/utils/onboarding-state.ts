import { getStoredJson, removeStoredValue, setStoredJson } from '@/utils/app-storage';
import { resetEggAvatarSelection } from '@/utils/egg-avatar-storage';

const ONBOARDING_STORAGE_KEY = 'katchadeck.onboarding-profile';

export type MossproutOnboardingAnswers = {
  dayTextureId?: string | null;
  growthIntentId?: string | null;
  waterTogetherChoiceId?: string | null;
  firstSeedId?: string | null;
  attunementPlaceId?: string | null;
  currentFeelingId?: string | null;
  desiredMoreId?: string | null;
  desiredFeelingId: string | null;
  mainDifficultyId: string | null;
  supportStyleId: string | null;
  lifePriorityId: string | null;
  companionPlaceId: string | null;
};

export type OnboardingProfile = {
  schemaVersion: 3;
  completed: boolean;
  aspirationId: string | null;
  painPointIds: string[];
  preferenceIds: string[];
  completedAt: string | null;
  hatchHour: number | null;
  playerNickname: string | null;
  mossproutAnswers: MossproutOnboardingAnswers;
  matchedResidentId: string | null;
};

export const defaultOnboardingProfile: OnboardingProfile = {
  schemaVersion: 3,
  completed: false,
  aspirationId: null,
  painPointIds: [],
  preferenceIds: [],
  completedAt: null,
  hatchHour: null,
  playerNickname: null,
  mossproutAnswers: {
    dayTextureId: null,
    growthIntentId: null,
    waterTogetherChoiceId: null,
    firstSeedId: null,
    attunementPlaceId: null,
    currentFeelingId: null,
    desiredMoreId: null,
    desiredFeelingId: null,
    mainDifficultyId: null,
    supportStyleId: null,
    lifePriorityId: null,
    companionPlaceId: null,
  },
  matchedResidentId: null,
};

export function loadOnboardingProfile(): OnboardingProfile {
  const stored = getStoredJson(ONBOARDING_STORAGE_KEY, defaultOnboardingProfile);
  return {
    ...defaultOnboardingProfile,
    ...stored,
    schemaVersion: 3,
    mossproutAnswers: { ...defaultOnboardingProfile.mossproutAnswers, ...stored.mossproutAnswers },
  };
}

export function saveOnboardingProfile(profile: OnboardingProfile) {
  setStoredJson(ONBOARDING_STORAGE_KEY, profile);
}

export function sanitizePlayerNickname(value: string): string | null {
  const normalized = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized ? Array.from(normalized).slice(0, 20).join('') : null;
}

export function resetOnboardingProfile() {
  removeStoredValue(ONBOARDING_STORAGE_KEY);
  resetEggAvatarSelection();
}
