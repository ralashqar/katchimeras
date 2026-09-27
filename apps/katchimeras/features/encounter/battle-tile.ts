import { buildMossproutHexNeighborhoodScene, type MossproutGardenSceneState } from '@/components/katchadeck/world/mossprout-hex-neighborhood-scene';
import { emptyMossproutNatureIslandLevels } from '@/constants/mossprout-nature-islands';
import { hatchableByCompanion } from '@/constants/hatchable-companions/registry';
import type { MossproutNatureIslandId, MossproutNatureIslandLevel } from '@/types/merge-world';
import type { BattleSource } from './battle-session';
import { MISSION_CAMERA_ANCHOR_Y, MISSION_CAMERA_ZOOM, OPENING_CAMERA_ZOOM } from '@/features/onboarding/opening-mist';

/** Persist symbolic world state, never Metro image IDs or native view references. */
export type BattleTileScene = {
  garden: Omit<MossproutGardenSceneState, 'plantableMemories' | 'previewMemoryId'>;
  levels: Record<MossproutNatureIslandId, MossproutNatureIslandLevel>;
  reveals: Partial<Record<MossproutNatureIslandId, boolean>>;
  homeVeiled: boolean;
};

export function battleTileLayerId(source: BattleSource): string {
  if (source.kind === 'first') return 'family:mossprout';
  if (source.kind === 'trail' || source.kind === 'rescue') {
    const companion = source.kind === 'trail' ? 'steppling' : source.companion;
    return `structure:${hatchableByCompanion(companion)?.tile.id ?? 'steppling-home'}`;
  }
  const { frontierTileId, structureId, islandId } = source.context;
  return frontierTileId || structureId ? `structure:${frontierTileId ?? structureId}`
    : islandId ? `nature:mossprout:${islandId}` : 'family:mossprout';
}

/** Pure layout/art resolution, run once at entry. Only the selected layer is mounted. */
export function resolveBattleTile(source: BattleSource, snapshot?: BattleTileScene) {
  const scene = buildMossproutHexNeighborhoodScene([], snapshot?.levels ?? emptyMossproutNatureIslandLevels(),
    { ...snapshot?.garden, level: snapshot?.garden.level ?? 0, plantableMemories: [] }, snapshot?.reveals,
    { homeVeiled: snapshot?.homeVeiled ?? source.kind === 'first' });
  const layer = scene.tileArtLayers.find(layer => layer.id === battleTileLayerId(source))
    ?? scene.tileArtLayers.find(layer => layer.id === 'family:mossprout')!;
  const tile = scene.tileById.get(layer.id);
  return { ...layer, focusPoint: layer.id === 'family:mossprout' && tile ? { x: tile.cx, y: tile.cy }
    : { x: layer.frame.left + layer.frame.width / 2, y: layer.frame.top + layer.frame.height / 2 } };
}

/** Legacy sessions without a captured frame use the same authored world-camera zoom. */
export function defaultBattleTileFrame(layer: ReturnType<typeof resolveBattleTile>, source: BattleSource, width: number, height: number) {
  const scale = source.kind === 'first' ? OPENING_CAMERA_ZOOM : MISSION_CAMERA_ZOOM;
  return {
    left: width / 2 + (layer.frame.left - layer.focusPoint.x) * scale,
    top: height * MISSION_CAMERA_ANCHOR_Y + (layer.frame.top - layer.focusPoint.y) * scale,
    width: layer.frame.width * scale,
    height: layer.frame.height * scale,
  };
}
