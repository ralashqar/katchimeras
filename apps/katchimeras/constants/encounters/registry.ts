import { MISSIONS } from '@/constants/missions/registry';
import { markRegistryBuilt, packEntries } from '@/features/content-packs/active-pack';
import { encounterFromMission } from '@/features/encounter/adapt';
import type { EncounterDefinition } from '@/types/encounter';

/**
 * Every encounter by id: the mission boards the friends' tiles and journey
 * episodes have always docked (read as encounters with no budget), and every
 * encounter a content pack brings (schema 7). A region's rungs carry their
 * own encounters and are read from the island campaign registry, not here.
 */
export const ENCOUNTERS_BUNDLED: readonly EncounterDefinition[] = MISSIONS.map((mission) => encounterFromMission(mission));
export const ENCOUNTERS: readonly EncounterDefinition[] = [...ENCOUNTERS_BUNDLED, ...packEntries('encounters')];
markRegistryBuilt('encounters');

const byId = new Map(ENCOUNTERS.map((encounter) => [encounter.id, encounter]));

export const encounterById = (encounterId: string): EncounterDefinition | null => byId.get(encounterId) ?? null;
