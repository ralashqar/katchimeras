import { HOME_PRESETS, ZODIAC_PROFILES } from '@/constants/world-identity';
import type { HomeArchetypeId, WorldIdentityState, ZodiacSignId } from '@/types/world-identity';
import { getStoredJson, removeStoredValue, setStoredJson } from '@/utils/app-storage';
export { deriveZodiacSign, localDayId, promptForDay, scorePersonality, validBirthday } from '@/utils/world-identity-rules';

const STORAGE_KEY = 'katchimeras.world-identity.v1';

type LegacyWorldIdentity = Omit<WorldIdentityState, 'version' | 'zodiacRitualCompletions'> & {
  version: 1;
  constellationTutorialCompleted?: boolean;
  constellationCompletions?: string[];
};

export const EMPTY_WORLD_IDENTITY: WorldIdentityState = {
  version: 2, personalityAnswers: {}, recommendedHomeArchetypeId: null, selectedHomeArchetypeId: null,
  birthMonth: null, birthDay: null, zodiacSignId: null, setupCompletedAt: null,
  zodiacRitualCompletions: [], recentZodiacPromptIds: [], zodiacReflections: [],
};

export function loadWorldIdentity(): WorldIdentityState {
  const value = getStoredJson<WorldIdentityState | LegacyWorldIdentity | null>(STORAGE_KEY, null);
  if (value?.version === 2) return { ...EMPTY_WORLD_IDENTITY, ...value };
  if (value?.version === 1) {
    const { constellationCompletions = [], constellationTutorialCompleted: _tutorial, ...legacy } = value;
    const migrated: WorldIdentityState = {
      ...EMPTY_WORLD_IDENTITY,
      ...legacy,
      version: 2,
      zodiacRitualCompletions: [...new Set(constellationCompletions)],
    };
    saveWorldIdentity(migrated);
    return migrated;
  }
  return EMPTY_WORLD_IDENTITY;
}

export function saveWorldIdentity(value: WorldIdentityState): void { setStoredJson(STORAGE_KEY, value); }
export function resetWorldIdentity(): void { removeStoredValue(STORAGE_KEY); }

/**
 * Clears only the choices made by the personality/zodiac setup experience.
 * Long-lived zodiac ritual history and saved reflections are retained so
 * the developer replay tool cannot erase player-created content by accident.
 */
export function resetWorldIdentityOnboarding(): void {
  const current = loadWorldIdentity();
  saveWorldIdentity({
    ...current,
    personalityAnswers: {},
    recommendedHomeArchetypeId: null,
    selectedHomeArchetypeId: null,
    birthMonth: null,
    birthDay: null,
    zodiacSignId: null,
    setupCompletedAt: null,
  });
}

export function homePreset(id: HomeArchetypeId | null | undefined) { return HOME_PRESETS.find((item) => item.id === id) ?? HOME_PRESETS[0]; }
export function zodiacProfile(id: ZodiacSignId | null | undefined) { return ZODIAC_PROFILES.find((item) => item.id === id) ?? null; }
