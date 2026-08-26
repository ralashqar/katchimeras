import type { KatchimeraSkinId } from '@/types/katchimera';
import {
  loadOnboardingProfile,
  sanitizePlayerNickname,
  saveOnboardingProfile,
  type MossproutOnboardingAnswers,
} from '@/utils/onboarding-state';

const ACTION_FIELDS: Readonly<Record<string, keyof MossproutOnboardingAnswers>> = {
  'egg.desired_feeling': 'desiredFeelingId',
  'egg.main_difficulty': 'mainDifficultyId',
  'egg.support_style': 'supportStyleId',
  'egg.life_priority': 'lifePriorityId',
  'egg.companion_place': 'companionPlaceId',
};

const RESIDENT_BY_PLACE: Readonly<Record<string, KatchimeraSkinId>> = {
  mossy_forest: 'fernip',
  flower_meadow: 'petalimp',
  rainy_pond: 'drizzlet',
  windy_hill: 'driftkin',
};

export function mossproutResidentForPlace(placeId: string | null | undefined): KatchimeraSkinId | null {
  return placeId ? RESIDENT_BY_PLACE[placeId] ?? null : null;
}

export function recordMossproutOnboardingAnswer(actionId: string, optionId: string) {
  const field = ACTION_FIELDS[actionId];
  if (!field) return loadOnboardingProfile();
  const profile = loadOnboardingProfile();
  const mossproutAnswers = { ...profile.mossproutAnswers, [field]: optionId };
  const matchedResidentId = field === 'companionPlaceId'
    ? mossproutResidentForPlace(optionId)
    : profile.matchedResidentId;
  const next = {
    ...profile,
    aspirationId: field === 'desiredFeelingId' ? optionId : profile.aspirationId,
    painPointIds: field === 'mainDifficultyId' ? [optionId] : profile.painPointIds,
    preferenceIds: field === 'supportStyleId' || field === 'lifePriorityId'
      ? [optionId, ...profile.preferenceIds.filter((id) => id !== optionId)]
      : profile.preferenceIds,
    mossproutAnswers,
    matchedResidentId,
  };
  saveOnboardingProfile(next);
  return next;
}

export function saveMossproutPlayerNickname(value: string) {
  const profile = loadOnboardingProfile();
  const playerNickname = sanitizePlayerNickname(value);
  saveOnboardingProfile({ ...profile, playerNickname });
  return playerNickname;
}
