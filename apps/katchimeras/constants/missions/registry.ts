import { HATCHABLE_COMPANIONS } from '@/constants/hatchable-companions/registry';
import { OLD_GROVE_MISSION } from '@/constants/mossprout-arc-one-copy';
import { markRegistryBuilt, packEntries } from '@/features/content-packs/active-pack';
import type { JourneyMissionDefinition } from '@/types/companion-journey-chapter';

/**
 * Every mission board by id: the hatchable friends' mist missions, the
 * journey tiles' boards, and any a content pack brought. A chapter's
 * `mist_mission` consequence may name a mission by id instead of carrying
 * it, so a pack can ship a board once and dock it from any episode.
 */
export const MISSIONS_BUNDLED: readonly JourneyMissionDefinition[] = [...HATCHABLE_COMPANIONS.map((definition) => definition.mission), OLD_GROVE_MISSION];
export const MISSIONS: readonly JourneyMissionDefinition[] = [...MISSIONS_BUNDLED, ...packEntries('missions')];
markRegistryBuilt('missions');

const byId = new Map(MISSIONS.map((mission) => [mission.id, mission]));

export const missionById = (missionId: string): JourneyMissionDefinition | null => byId.get(missionId) ?? null;
export const isBundledMissionId = (missionId: string): boolean => MISSIONS_BUNDLED.some((mission) => mission.id === missionId);
