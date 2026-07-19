import { useCallback, useEffect, useMemo, useReducer } from 'react';

import type { ScheduledKingdomTile } from '@/components/katchadeck/world/use-kingdom-tile-scheduler';
import {
  activeKingdomTileLod,
  EMPTY_KINGDOM_LOD_SCHEDULER,
  kingdomLodSchedulerReducer,
  visibleKingdomTileLod,
} from '@/utils/kingdom-lod-scheduler';
import type { KingdomHexTileLod } from '@/utils/world-visuals';

type Args = {
  isMoving: boolean;
  requestedLod: KingdomHexTileLod;
  renderedTiles: ScheduledKingdomTile[];
  visibleTileIds: Set<string>;
};

export function useKingdomLodScheduler({ isMoving, requestedLod, renderedTiles, visibleTileIds }: Args) {
  const desired = useMemo(
    () =>
      Object.fromEntries(
        renderedTiles.map(({ layer }) => [
          layer.id,
          visibleTileIds.has(layer.id) ? visibleKingdomTileLod(requestedLod) : 'thumb',
        ])
      ) as Record<string, KingdomHexTileLod>,
    [renderedTiles, requestedLod, visibleTileIds]
  );
  const priority = useMemo(
    () => [
      ...renderedTiles.filter(({ layer }) => visibleTileIds.has(layer.id)).map(({ layer }) => layer.id),
      ...renderedTiles.filter(({ layer }) => !visibleTileIds.has(layer.id)).map(({ layer }) => layer.id),
    ],
    [renderedTiles, visibleTileIds]
  );
  const [state, dispatch] = useReducer(kingdomLodSchedulerReducer, EMPTY_KINGDOM_LOD_SCHEDULER);

  useEffect(() => {
    dispatch({ type: 'sync', desired, paused: isMoving, priority });
  }, [desired, isMoving, priority]);

  const lodFor = useCallback((id: string) => activeKingdomTileLod(state, id), [state]);
  const markReady = useCallback(
    (id: string, lod: KingdomHexTileLod) => dispatch({ type: 'loaded', id, lod }),
    []
  );

  return { lodFor, markReady };
}
