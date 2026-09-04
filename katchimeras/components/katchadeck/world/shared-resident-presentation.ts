/** One stage geometry for Eggs and residents in the shared world. */
export const SHARED_RESIDENT_WIDTH = 108;
export const SHARED_RESIDENT_HEIGHT = 139;
export const SHARED_RESIDENT_BASELINE_LIFT = 8;
export const SHARED_EGG_REST_ZOOM = 2.05;
export const SHARED_EGG_CLOSE_ZOOM = 3.2;
export const SHARED_EGG_ENTRY_ZOOM = 1.35;
export const SHARED_EGG_SCREEN_ANCHOR_Y = 0.5;
export const SHARED_RESIDENT_SCREEN_ANCHOR_Y = 0.46;
export const SHARED_RESIDENT_FOCUS_DURATION_MS = 520;

export function sharedResidentAnchor(frame: { left: number; top: number; width: number; height: number }) {
  return { x: frame.left + frame.width * 0.5, y: frame.top + frame.height * 0.49 };
}

export function sharedResidentCenterY(anchorY: number, growthScale = 1) {
  return anchorY - SHARED_RESIDENT_BASELINE_LIFT - SHARED_RESIDENT_HEIGHT * growthScale / 2;
}

export function usesSharedResidentStage(familyId?: string) {
  return familyId === 'mossprout' || familyId === 'steppling';
}

/** Terrain identity stays stable across the mist reveal; resident slots have their own IDs. */
export function residentArtLayerId(tileId: string, familyId?: string) {
  return familyId === 'steppling' ? 'structure:steppling-home' : tileId;
}
