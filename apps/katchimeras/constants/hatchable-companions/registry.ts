import type { MergeCharacterId } from '@/types/merge-world';
import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import { STEPPLING_HATCHABLE } from './steppling';

/**
 * Every friend the Mist keeps on a shared-world tile, in the order they were
 * authored. Screens, flows and the engine read this; nothing names a friend by
 * hand. To add one, add a definition file here and its content and art.
 */
export const HATCHABLE_COMPANIONS: readonly HatchableCompanionDefinition[] = [STEPPLING_HATCHABLE];

const byCompanion = new Map(HATCHABLE_COMPANIONS.map((definition) => [definition.companion, definition]));
const byTile = new Map(HATCHABLE_COMPANIONS.map((definition) => [definition.tile.id, definition]));
const byUnlock = new Map(HATCHABLE_COMPANIONS.map((definition) => [definition.tile.unlockId, definition]));
const byMission = new Map(HATCHABLE_COMPANIONS.map((definition) => [definition.mission.id, definition]));

export const hatchableByCompanion = (companion: MergeCharacterId | string) => byCompanion.get(companion as MergeCharacterId) ?? null;
export const hatchableByTile = (tileId: string) => byTile.get(tileId) ?? null;
export const hatchableByUnlock = (unlockId: string) => byUnlock.get(unlockId) ?? null;
export const hatchableByMission = (missionId: string) => byMission.get(missionId) ?? null;
export const isHatchableCompanion = (companion: string) => byCompanion.has(companion as MergeCharacterId);
/** The story target a definition's world operations address: its tile as a haven structure. */
export const hatchableStoryTarget = (definition: HatchableCompanionDefinition) => ({ kind: 'haven_structure' as const, structureId: definition.tile.id });
