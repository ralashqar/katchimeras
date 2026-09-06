import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { HexCoord } from '@/utils/world-hex';

export type KingdomStructurePortDirection =
  | 'upper-left'
  | 'upper-right'
  | 'lower-left'
  | 'lower-right';

export type KingdomStructurePort = {
  cell: HexCoord;
  direction: KingdomStructurePortDirection;
  connectsTo: 'kingdom' | 'mossprout' | null;
};

export const MOSSPROUT_GARDEN_BOARD_TOP: HexCoord = { q: -1, r: 1 };
export const MOSSPROUT_GARDEN_BOARD_BOTTOM: HexCoord = { q: -1, r: 2 };
export const MOSSPROUT_GARDEN_BOARD_MOSSPROUT_COORD: HexCoord = { q: -2, r: 3 };

/**
 * Every non-port neighbour is deliberately left empty. The two unused ports
 * are also reserved so the first garden reads as a single home-to-Mossprout
 * branch while retaining real expansion sockets.
 */
export const MOSSPROUT_GARDEN_BOARD_RESERVED_COORDS: readonly HexCoord[] = [
  MOSSPROUT_GARDEN_BOARD_TOP,
  MOSSPROUT_GARDEN_BOARD_BOTTOM,
  { q: -2, r: 1 },
  { q: 0, r: 2 },
  { q: -1, r: 0 },
  { q: 0, r: 1 },
  { q: -2, r: 2 },
  { q: -1, r: 3 },
] as const;

/** Stable authored coordinates; catalog ordering can no longer move families. */
export const KINGDOM_FAMILY_SLOT_COORD_BY_ID: Readonly<Record<KatchimeraFamilyId, HexCoord>> = {
  mossprout: MOSSPROUT_GARDEN_BOARD_MOSSPROUT_COORD,
  baristabbit: { q: 3, r: -1 },
  feastle: { q: 1, r: 0 },
  steppling: { q: 1, r: -1 },
  flexel: { q: 0, r: -1 },
  bedrotte: { q: 3, r: -2 },
  dawnle: { q: 3, r: -3 },
  mendle: { q: 2, r: -3 },
  gatherglow: { q: 1, r: -3 },
  heartmote: { q: 1, r: 1 },
  kindling: { q: 2, r: 0 },
  snuglet: { q: 2, r: -1 },
  waglet: { q: 2, r: -2 },
  tasklet: { q: 1, r: -2 },
  errandimp: { q: 0, r: -2 },
  pagelet: { q: -1, r: -1 },
  relicoon: { q: -2, r: 0 },
  museling: { q: 0, r: -3 },
  encora: { q: -3, r: 3 },
  flickerbun: { q: -1, r: -2 },
  pixooka: { q: -2, r: -1 },
  shellio: { q: 0, r: 3 },
  skylo: { q: 1, r: 2 },
  voyagle: { q: 2, r: 1 },
  cheerlet: { q: 3, r: 0 },
};
