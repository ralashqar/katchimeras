import { encounterLiveCast } from '@/constants/encounter-cast';
import { TODAY_KATCHIMERA_EXPLORATION_BACKGROUND_KEYS } from '@/constants/today-exploration-background-keys.gen';
import type { LocalCreatureRecord } from '@/types/home';
import { identityForEncounter } from '@/utils/katchimera-identity';

export type DevExplorationEnvironmentPreview = {
  backgroundKey: (typeof TODAY_KATCHIMERA_EXPLORATION_BACKGROUND_KEYS)[number];
  creature: LocalCreatureRecord;
  environmentLabel: string;
};

export const DEV_EXPLORATION_ENVIRONMENT_PREVIEWS =
  TODAY_KATCHIMERA_EXPLORATION_BACKGROUND_KEYS.map((backgroundKey) => {
    const cast = encounterLiveCast.find(
      (candidate) => candidate.visualKey === backgroundKey,
    );
    const identity = identityForEncounter(cast?.profileId, backgroundKey);
    const displayName = titleCase(backgroundKey);
    const creature: LocalCreatureRecord = {
      id: `dev-environment-preview:${backgroundKey}`,
      ...(identity ?? {}),
      name: displayName,
      primaryTrait: 'exploration',
      secondaryTrait: 'calm',
      rarity: 'common',
      visualKey: backgroundKey,
      // CreatureHero resolves the production palette from visualKey. Keep this
      // persisted-record field asset-agnostic so the fixture remains testable
      // outside Metro without eagerly requiring every creature bitmap.
      accentColor: '#FFC36B',
      highlightMomentId: null,
      highlight: `Developer preview for ${displayName}.`,
      reflection: `Developer preview for ${displayName}.`,
      motifTags: [cast?.categoryLabel ?? 'Environment preview'],
      encounterProfileId: cast?.profileId ?? null,
      repeatDepth: 0,
    };

    return {
      backgroundKey,
      creature,
      environmentLabel: cast?.categoryLabel ?? displayName,
    };
  });

function titleCase(value: string) {
  return value
    .split(/[-_]/u)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
