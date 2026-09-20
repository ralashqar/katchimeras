/**
 * The opened pack never blinks out. The sealed stage starts shrinking it and hands over at this scale; the card page
 * mounts its own copy of the pack at the same spot and size and carries the shrink on while the card grows out of it.
 */
export const WISP_PACK_HANDOFF_SCALE = 0.72;
/** How long the sealed stage shrinks the pack before it hands over. */
export const WISP_PACK_HANDOFF_MS = 150;
