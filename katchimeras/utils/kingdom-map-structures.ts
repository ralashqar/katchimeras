import type { ImageSourcePropType } from 'react-native';

import {
  MOSSPROUT_GARDEN_BOARD_BOTTOM,
  MOSSPROUT_GARDEN_BOARD_TOP,
  type KingdomStructurePort,
} from '@/utils/kingdom-map-layout';
import type { HexCoord } from '@/utils/world-hex';

export type KingdomStructureArtSpec = {
  alphaBounds: { left: number; top: number; right: number; bottom: number };
  mergeSurfaceBounds: { left: number; top: number; right: number; bottom: number };
  source: ImageSourcePropType;
  sourceSize: { width: number; height: number };
  overlaySource?: ImageSourcePropType;
};

export type KingdomMapStructureDefinition = {
  art: {
    locked: KingdomStructureArtSpec;
    revealed: KingdomStructureArtSpec;
  };
  footprint: readonly HexCoord[];
  id: string;
  kind: 'merge_board';
  ports: readonly KingdomStructurePort[];
};

const GARDEN_SOURCE_SIZE = { width: 1024, height: 1536 } as const;
const GARDEN_MERGE_SURFACE_BOUNDS = { left: 224, top: 400, right: 800, bottom: 1072 } as const;

export const MOSSPROUT_GARDEN_BOARD: KingdomMapStructureDefinition = {
  id: 'structure:mossprout-garden',
  kind: 'merge_board',
  footprint: [MOSSPROUT_GARDEN_BOARD_TOP, MOSSPROUT_GARDEN_BOARD_BOTTOM],
  ports: [
    { cell: MOSSPROUT_GARDEN_BOARD_TOP, direction: 'upper-right', connectsTo: 'kingdom' },
    { cell: MOSSPROUT_GARDEN_BOARD_TOP, direction: 'upper-left', connectsTo: null },
    { cell: MOSSPROUT_GARDEN_BOARD_BOTTOM, direction: 'lower-left', connectsTo: 'mossprout' },
    { cell: MOSSPROUT_GARDEN_BOARD_BOTTOM, direction: 'lower-right', connectsTo: null },
  ],
  art: {
    revealed: {
      source: require('../assets/images/katchimeras/world/hex/floating_neighborhood_v2_mossprout_garden_board_512x768.webp'),
      overlaySource: require('../assets/images/katchimeras/world/hex/floating_neighborhood_v2_mossprout_garden_board_merge_overlay_512x768.webp'),
      sourceSize: GARDEN_SOURCE_SIZE,
      alphaBounds: { left: 57, top: 60, right: 967, bottom: 1487 },
      mergeSurfaceBounds: GARDEN_MERGE_SURFACE_BOUNDS,
    },
    locked: {
      source: require('../assets/images/katchimeras/world/hex/floating_neighborhood_v2_mossprout_garden_board_locked_512x768.webp'),
      sourceSize: GARDEN_SOURCE_SIZE,
      alphaBounds: { left: 58, top: 61, right: 966, bottom: 1487 },
      mergeSurfaceBounds: GARDEN_MERGE_SURFACE_BOUNDS,
    },
  },
};
