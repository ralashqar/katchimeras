import { useCallback, useEffect, useMemo, useReducer } from 'react';

import { KINGDOM_RENDERING } from '@/constants/kingdom-rendering';
import type { KingdomHexScene, KingdomTileArtLayer } from '@/components/katchadeck/world/kingdom-hex-scene';
import {
  frameToRect,
  rectsIntersect,
  screenPointToWorld,
  visibleWorldRect,
  type KingdomCameraSnapshot,
  type KingdomSize,
} from '@/utils/kingdom-rendering';
import {
  EMPTY_KINGDOM_TILE_SCHEDULER,
  kingdomTileSchedulerReducer,
  type KingdomTileRuntime,
} from '@/utils/kingdom-tile-scheduler';

export type ScheduledKingdomTile = {
  layer: KingdomTileArtLayer;
  runtime: KingdomTileRuntime;
};

type Args = {
  camera: KingdomCameraSnapshot;
  isMoving: boolean;
  scene: KingdomHexScene;
  viewport: KingdomSize;
};

export function useKingdomTileScheduler({ camera, isMoving, scene, viewport }: Args) {
  const [state, dispatch] = useReducer(kingdomTileSchedulerReducer, EMPTY_KINGDOM_TILE_SCHEDULER);
  const layerById = useMemo(() => new Map(scene.tileArtLayers.map((layer) => [layer.id, layer])), [scene.tileArtLayers]);

  const visibility = useMemo(() => {
    const viewportRect = visibleWorldRect(viewport, scene, camera, 0);
    const preloadRect = visibleWorldRect(viewport, scene, camera, KINGDOM_RENDERING.preloadMarginScreenPx);
    if (!viewportRect || !preloadRect) {
      return { preloadIds: [] as string[], priority: [] as string[], visibleIds: new Set<string>() };
    }

    const visibleIds = new Set<string>();
    const priorityLayers: KingdomTileArtLayer[] = [];
    for (const layer of scene.tileArtLayers) {
      const frame = frameToRect(layer.frame);
      if (rectsIntersect(frame, viewportRect)) visibleIds.add(layer.id);
      priorityLayers.push(layer);
    }

    const viewportCenter = screenPointToWorld({ x: viewport.width / 2, y: viewport.height / 2 }, scene, camera);
    priorityLayers.sort((a, b) => {
      const aFrame = frameToRect(a.frame);
      const bFrame = frameToRect(b.frame);
      const zoneDelta =
        Number(!visibleIds.has(a.id)) - Number(!visibleIds.has(b.id)) ||
        Number(!rectsIntersect(aFrame, preloadRect)) - Number(!rectsIntersect(bFrame, preloadRect));
      if (zoneDelta) return zoneDelta;
      if (a.id === scene.centerTile.id) return -1;
      if (b.id === scene.centerTile.id) return 1;
      const aCenterX = a.frame.left + a.frame.width / 2;
      const aCenterY = a.frame.top + a.frame.height / 2;
      const bCenterX = b.frame.left + b.frame.width / 2;
      const bCenterY = b.frame.top + b.frame.height / 2;
      const aDistance = (aCenterX - viewportCenter.x) ** 2 + (aCenterY - viewportCenter.y) ** 2;
      const bDistance = (bCenterX - viewportCenter.x) ** 2 + (bCenterY - viewportCenter.y) ** 2;
      return aDistance - bDistance || a.depth - b.depth;
    });

    const priority = priorityLayers.map((layer) => layer.id);
    return { preloadIds: priority, priority, visibleIds };
  }, [camera, scene, viewport]);

  useEffect(() => {
    dispatch({ type: 'sync', paused: isMoving, preloadIds: visibility.preloadIds, priority: visibility.priority });
  }, [isMoving, visibility.preloadIds, visibility.priority]);

  const renderedTiles = useMemo<ScheduledKingdomTile[]>(() => {
    const next: ScheduledKingdomTile[] = [];
    for (const runtime of Object.values(state.entries)) {
      if (!runtime.loadStarted || runtime.phase === 'queued') continue;
      const layer = layerById.get(runtime.id);
      if (layer) next.push({ layer, runtime });
    }
    return next.sort((a, b) => a.layer.depth - b.layer.depth);
  }, [layerById, state.entries]);

  const readyTileIds = useMemo(() => {
    const ready = new Set<string>();
    for (const entry of Object.values(state.entries)) {
      if (entry.loaded) ready.add(entry.id);
    }
    return ready;
  }, [state.entries]);

  const markLoaded = useCallback((id: string) => dispatch({ type: 'loaded', id }), []);
  const markFailed = useCallback((id: string) => dispatch({ type: 'failed', id }), []);
  const markExited = useCallback((id: string) => dispatch({ type: 'exited', id }), []);

  return {
    markExited,
    markFailed,
    markLoaded,
    readyTileIds,
    renderedTiles,
    visibleTileIds: visibility.visibleIds,
  };
}
