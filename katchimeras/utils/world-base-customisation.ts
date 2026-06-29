import { getStoredJson, setStoredJson } from '@/utils/app-storage';

// User customisation for the image-base world patch: per-slot positions the user
// has dragged objects to, stored as FRACTIONAL grid cells (col,row) in the same
// iso space the patch uses — so they're resolution-independent and clamp to the
// grass diamond by clamping col/row. Keyed by a stable slot key (category/kind),
// NOT the object id (ids change as a cell levels up). Empty = everything sits at
// its default placement, so the main app looks unchanged until the user moves
// something. See [[world-iso-graphics-redesign]].

export type SlotCell = { col: number; row: number };
export type BaseCustomisation = Record<string, SlotCell>;

const STORAGE_KEY = 'katchadeck.world-base-customisation-v1';

export function loadBaseCustomisation(): BaseCustomisation {
  const value = getStoredJson<BaseCustomisation>(STORAGE_KEY, {});
  return value && typeof value === 'object' ? value : {};
}

export function saveBaseCustomisation(value: BaseCustomisation) {
  setStoredJson(STORAGE_KEY, value);
}

// Clamp a fractional cell to the patch's grass diamond (the slab incl. its ring),
// inset by a margin so objects never sit on the very edge / transparent boundary.
export function clampCell(col: number, row: number, ring: number, patchSize: number, inset = 0.4): SlotCell {
  const lo = -ring + inset;
  const hi = patchSize + ring - inset;
  return {
    col: Math.min(hi, Math.max(lo, col)),
    row: Math.min(hi, Math.max(lo, row)),
  };
}
