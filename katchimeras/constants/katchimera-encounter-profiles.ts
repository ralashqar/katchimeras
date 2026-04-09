import encounterProfilesJson from '@/data/katchimeras/encounter-katchimeras.json';
import type { KatchimeraEncounterProfile } from '@/types/katchimera';

const encounterProfiles = encounterProfilesJson as Array<
  Omit<KatchimeraEncounterProfile, 'displayName'>
>;

export const katchimeraEncounterProfiles: KatchimeraEncounterProfile[] = encounterProfiles.map(
  (profile) => ({
    ...profile,
    displayName: profile.name,
  })
);

export const katchimeraEncounterTypes = [
  ...new Set(katchimeraEncounterProfiles.map((profile) => profile.topLevelType)),
];

export const katchimeraEncounterCategories = [
  ...new Set(katchimeraEncounterProfiles.map((profile) => profile.triggerCategory)),
];

export const katchimeraEncounterSubtypes = [
  ...new Set(katchimeraEncounterProfiles.map((profile) => profile.triggerSubtype)),
];
