export {
  SHARED_RESIDENT_WIDTH, SHARED_RESIDENT_HEIGHT, SHARED_RESIDENT_BASELINE_LIFT, SHARED_EGG_REST_ZOOM, SHARED_EGG_CLOSE_ZOOM, SHARED_EGG_ENTRY_ZOOM,
  SHARED_EGG_SCREEN_ANCHOR_Y, SHARED_RESIDENT_SCREEN_ANCHOR_Y, SHARED_RESIDENT_FOCUS_DURATION_MS, sharedResidentAnchor, sharedResidentCenterY,
} from '@incubator/environments/resident-presentation';
import { hatchableByCompanion } from '@/constants/hatchable-companions/registry';

/** Mossprout and every hatchable friend share the world's resident stage. */
export function usesSharedResidentStage(familyId?: string) {
  return familyId === 'mossprout' || (familyId != null && hatchableByCompanion(familyId) != null);
}

/** Terrain identity stays stable across the mist reveal; a hatchable friend's slot is their cleared tile's structure. */
export function residentArtLayerId(tileId: string, familyId?: string) {
  const hatchable = familyId ? hatchableByCompanion(familyId) : null;
  return hatchable ? `structure:${hatchable.tile.id}` : tileId;
}
