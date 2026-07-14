import { HOME_PRESETS, ZODIAC_PROFILES } from '@/constants/world-identity';
import type { HomeArchetypeId, WorldIdentityState, ZodiacSignId } from '@/types/world-identity';
import { getStoredJson, removeStoredValue, setStoredJson } from '@/utils/app-storage';
export { deriveZodiacSign, localDayId, promptForDay, scorePersonality, validBirthday } from '@/utils/world-identity-rules';

const STORAGE_KEY = 'katchimeras.world-identity.v1';

export const EMPTY_WORLD_IDENTITY: WorldIdentityState = {
  version: 1, personalityAnswers: {}, recommendedHomeArchetypeId: null, selectedHomeArchetypeId: null,
  birthMonth: null, birthDay: null, zodiacSignId: null, setupCompletedAt: null,
  constellationTutorialCompleted: false, constellationCompletions: [], recentZodiacPromptIds: [], zodiacReflections: [],
};

export function loadWorldIdentity(): WorldIdentityState {
  const value = getStoredJson<WorldIdentityState>(STORAGE_KEY, EMPTY_WORLD_IDENTITY);
  return value?.version === 1 ? { ...EMPTY_WORLD_IDENTITY, ...value } : EMPTY_WORLD_IDENTITY;
}

export function saveWorldIdentity(value: WorldIdentityState): void { setStoredJson(STORAGE_KEY, value); }
export function resetWorldIdentity(): void { removeStoredValue(STORAGE_KEY); }

export function homePreset(id: HomeArchetypeId | null | undefined) { return HOME_PRESETS.find((item) => item.id === id) ?? HOME_PRESETS[0]; }
export function zodiacProfile(id: ZodiacSignId | null | undefined) { return ZODIAC_PROFILES.find((item) => item.id === id) ?? null; }
