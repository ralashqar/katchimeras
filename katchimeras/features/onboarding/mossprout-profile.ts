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

/**
 * The first-session resident lesson is authored around Petalimp's Garden
 * request. Later Journey resident discoveries can still use affinity and
 * next-unearned selection; the FTUE itself must remain deterministic.
 */
export const MOSSPROUT_FTUE_FIRST_RESIDENT_ID: KatchimeraSkinId = 'petalimp';

export function mossproutResidentForPlace(placeId: string | null | undefined): KatchimeraSkinId | null {
  return placeId ? RESIDENT_BY_PLACE[placeId] ?? null : null;
}

export function recordMossproutOnboardingAnswer(actionId: string, optionId: string) {
  const field = ACTION_FIELDS[actionId];
  if (!field) return loadOnboardingProfile();
  const profile = loadOnboardingProfile();
  const mossproutAnswers = { ...profile.mossproutAnswers, [field]: optionId };
  const matchedResidentId = field === 'companionPlaceId'
    ? MOSSPROUT_FTUE_FIRST_RESIDENT_ID
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

/** Repairs active/older first-session saves that chose a resident before the
 * deterministic Petalimp lesson was introduced. */
export function ensureMossproutFtueFirstResident() {
  const profile = loadOnboardingProfile();
  if (profile.matchedResidentId === MOSSPROUT_FTUE_FIRST_RESIDENT_ID) return profile;
  const next = { ...profile, matchedResidentId: MOSSPROUT_FTUE_FIRST_RESIDENT_ID };
  saveOnboardingProfile(next);
  return next;
}

export function saveMossproutPlayerNickname(value: string) {
  const profile = loadOnboardingProfile();
  const playerNickname = sanitizePlayerNickname(value);
  saveOnboardingProfile({ ...profile, playerNickname });
  return playerNickname;
}
