import type { KatchimeraSkinId } from '@/types/katchimera';
import {
  loadOnboardingProfile,
  sanitizePlayerNickname,
  saveOnboardingProfile,
  type MossproutOnboardingAnswers,
} from '@/utils/onboarding-state';
import { mossproutFirstSeedForIntent } from './mossprout-bond-share';
import { normalizeMossproutIntent } from './mossprout-ftue-copy';

const ACTION_FIELDS: Readonly<Record<string, keyof MossproutOnboardingAnswers>> = {
  'companion.greeting': 'firstGreetingId',
  'egg.day_texture': 'dayTextureId',
  'egg.desired_help': 'growthIntentId',
  'companion.choose_growth_intent': 'growthIntentId',
  'companion.choose_support_style': 'supportStyleId',
  'companion.confirm_first_reflection': 'reflectionAccuracyId',
  'companion.meditation_friction': 'mainDifficultyId',
  'companion.choose_water_together': 'waterTogetherChoiceId',
  'egg.desired_feeling': 'attunementPlaceId',
  'egg.main_difficulty': 'currentFeelingId',
  'egg.support_style': 'desiredMoreId',
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
  if (field === 'growthIntentId') optionId = normalizeMossproutIntent(optionId);
  const profile = loadOnboardingProfile();
  const mossproutAnswers = { ...profile.mossproutAnswers, [field]: optionId };
  const matchedResidentId = field === 'companionPlaceId'
    ? MOSSPROUT_FTUE_FIRST_RESIDENT_ID
    : profile.matchedResidentId;
  const next = {
    ...profile,
    aspirationId: field === 'desiredMoreId' || field === 'growthIntentId' ? optionId : profile.aspirationId,
    painPointIds: field === 'currentFeelingId' || field === 'dayTextureId' ? [optionId] : profile.painPointIds,
    preferenceIds: field === 'attunementPlaceId' || field === 'lifePriorityId' || field === 'supportStyleId'
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

export function keepMossproutFirstSeed() {
  const profile = loadOnboardingProfile();
  const seed = mossproutFirstSeedForIntent(profile.mossproutAnswers.growthIntentId);
  saveOnboardingProfile({
    ...profile,
    mossproutAnswers: { ...profile.mossproutAnswers, firstSeedId: seed.id },
  });
  return seed;
}
