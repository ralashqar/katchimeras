import renderProfilesJson from '@/data/katchimeras/render-profiles.json';
import type { KatchimeraRenderProfile } from '@/types/katchimera';

export const katchimeraRenderProfiles = renderProfilesJson as KatchimeraRenderProfile[];

export const katchimeraFamilyIds = [
  ...new Set(katchimeraRenderProfiles.map((profile) => profile.familyId)),
];

export const katchimeraHabitatIds = [
  ...new Set(katchimeraRenderProfiles.map((profile) => profile.habitatAspectId)),
];

export const katchimeraStageIds = [
  ...new Set(katchimeraRenderProfiles.map((profile) => profile.stageId)),
];
