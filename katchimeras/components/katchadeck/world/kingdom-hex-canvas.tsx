import { Image } from 'expo-image';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated';

import kingdomWorldViewConfig from '@/constants/kingdom-world-view.json';
import { Lantern } from '@/constants/theme';
import type { EggVisualState } from '@/types/home';
import type { KingdomCreature } from '@/types/kingdom';
import { katchimeraHexTileForCreature } from '@/utils/katchimera-hex-tiles';
import type { KingdomResident } from '@/utils/kingdom-residents';
import {
  HEX_TILE_H,
  HEX_TILE_LIP,
  HEX_TILE_W,
  hexDrawDepth,
  hexSpiral,
  hexTileTopPoints,
  hexToWorld,
  type HexCoord,
} from '@/utils/world-hex';
import {
  kingdomHexTileSet,
  kingdomHexTileSourceForLod,
  worldAssetSource,
  type KingdomHexTileAlphaBounds,
  type KingdomHexTileLod,
  type KingdomHexTileSelection,
} from '@/utils/world-visuals';

export type KingdomHexCenterRef = () => { col: number; row: number; plotId: string | null } | null;
export type KingdomResidentStatusGlyph = 'offer' | 'active' | 'ready';

export type KingdomHexResidentTile = {
  id: string;
  resident: KingdomResident;
  creature: KingdomCreature;
  coord: HexCoord;
};

type TileRender = {
  id: string;
  kind: 'center' | 'resident';
  coord: HexCoord;
  cx: number;
  cy: number;
  depth: number;
  resident?: KingdomHexResidentTile;
};

type Props = {
  residents: KingdomHexResidentTile[];
  eggVisual?: EggVisualState | null;
  lanternColor?: string;
  residentStatusGlyphs?: Partial<Record<string, KingdomResidentStatusGlyph>>;
  onSelectResident?: (creatureId: string, label: string) => void;
};

const SCENE_PAD = 1200;
const CENTER_ID = 'kingdom';
const CREATURE_SIZE = 58;
const CREATURE_WORLD_SCALE = kingdomWorldViewConfig.katchimera.globalScale;
const CREATURE_WORLD_SIZE = CREATURE_SIZE * CREATURE_WORLD_SCALE;
const CREATURE_WORLD_HORIZONTAL_HEX_OFFSET = kingdomWorldViewConfig.katchimera.horizontalOffsetHexTileWidth;
const CREATURE_WORLD_VERTICAL_HEX_OFFSET = kingdomWorldViewConfig.katchimera.verticalOffsetHexTileHeight;
const EGG_STAGE_W = 200;
const EGG_STAGE_H = 258;
const EGG_WORLD_SCALE = kingdomWorldViewConfig.egg.globalScale;
const EGG_WORLD_HORIZONTAL_HEX_OFFSET = kingdomWorldViewConfig.egg.horizontalOffsetHexTileWidth;
const EGG_WORLD_VERTICAL_HEX_OFFSET = kingdomWorldViewConfig.egg.verticalOffsetHexTileHeight;
const EGG_WORLD_W = EGG_STAGE_W * EGG_WORLD_SCALE;
const EGG_WORLD_H = EGG_STAGE_H * EGG_WORLD_SCALE;
const KINGDOM_EGG_SOURCE = require('../../../assets/images/katchimeras/cutouts/egg-base.webp');
const CENTER_TILE_ASSET_SIZE = 1024;
const CULL_SCREEN_PAD = 520;

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type CameraSnapshot = {
  tx: number;
  ty: number;
  scale: number;
};

function residentTileId(creatureId: string) {
  return `resident:${creatureId}`;
}

function tileVisibleBounds(cx: number, cy: number) {
  const topPoints = hexTileTopPoints(cx, cy);
  const xs = topPoints.map((point) => point.x);
  const ys = topPoints.flatMap((point) => [point.y, point.y + HEX_TILE_LIP]);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}

function rectsIntersect(a: Rect, b: Rect) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function frameToRect(frame: { left: number; top: number; width: number; height: number }): Rect {
  return {
    left: frame.left,
    top: frame.top,
    right: frame.left + frame.width,
    bottom: frame.top + frame.height,
  };
}

function visibleWorldRect(
  viewport: { width: number; height: number },
  scene: { width: number; height: number },
  camera: CameraSnapshot
): Rect | null {
  if (!viewport.width || !viewport.height || camera.scale <= 0) return null;
  const toWorldX = (screenX: number) => (screenX - scene.width / 2 - camera.tx) / camera.scale + scene.width / 2;
  const toWorldY = (screenY: number) => (screenY - scene.height / 2 - camera.ty) / camera.scale + scene.height / 2;
  return {
    left: toWorldX(-CULL_SCREEN_PAD),
    top: toWorldY(-CULL_SCREEN_PAD),
    right: toWorldX(viewport.width + CULL_SCREEN_PAD),
    bottom: toWorldY(viewport.height + CULL_SCREEN_PAD),
  };
}

function tileArtFrame(tile: TileRender, assetBounds: KingdomHexTileAlphaBounds) {
  const target = tileVisibleBounds(tile.cx, tile.cy);
  const assetBoundsWidth = assetBounds.right - assetBounds.left;
  const assetBoundsCenterX = (assetBounds.left + assetBounds.right) / 2;
  const assetBoundsCenterY = (assetBounds.top + assetBounds.bottom) / 2;
  const targetWidth = target.right - target.left;
  const targetCenterX = (target.left + target.right) / 2;
  const targetCenterY = (target.top + target.bottom) / 2;
  const size = targetWidth * (CENTER_TILE_ASSET_SIZE / assetBoundsWidth);

  return {
    height: size,
    left: targetCenterX - (assetBoundsCenterX / CENTER_TILE_ASSET_SIZE) * size,
    top: targetCenterY - (assetBoundsCenterY / CENTER_TILE_ASSET_SIZE) * size,
    width: size,
  };
}

function tileArtFor(tile: TileRender, hexTiles: KingdomHexTileSelection) {
  const customResidentTile = tile.kind === 'resident' && tile.resident ? katchimeraHexTileForCreature(tile.resident.creature) : null;
  if (customResidentTile) {
    return {
      source: customResidentTile.source,
      sources: customResidentTile.sources,
      frame: tileArtFrame(tile, customResidentTile.alphaBounds),
      custom: true,
    };
  }
  return tile.kind === 'center'
    ? {
        source: hexTiles.center.source,
        sources: hexTiles.center.sources,
        frame: tileArtFrame(tile, hexTiles.center.alphaBounds),
        custom: false,
      }
    : {
        source: hexTiles.default.source,
        sources: hexTiles.default.sources,
        frame: tileArtFrame(tile, hexTiles.default.alphaBounds),
        custom: false,
      };
}

function tileLodForScreenWidth(screenWidth: number): KingdomHexTileLod {
  if (screenWidth < 360) return 'thumb';
  if (screenWidth < 760) return 'medium';
  return 'full';
}

function sceneFromResidents(residents: KingdomHexResidentTile[]) {
  const tilesRaw: TileRender[] = [
    { id: CENTER_ID, kind: 'center', coord: { q: 0, r: 0 }, cx: 0, cy: 0, depth: 0 },
    ...residents.map((resident) => {
      const p = hexToWorld(resident.coord);
      return {
        id: resident.id,
        kind: 'resident' as const,
        coord: resident.coord,
        cx: p.x,
        cy: p.y,
        depth: hexDrawDepth(p),
        resident,
      };
    }),
  ];
  const tileXs = tilesRaw.flatMap((tile) => [tile.cx - HEX_TILE_W, tile.cx + HEX_TILE_W]);
  const tileYs = tilesRaw.flatMap((tile) => [tile.cy - HEX_TILE_H, tile.cy + HEX_TILE_H + HEX_TILE_LIP]);
  const minX = Math.min(...tileXs, -HEX_TILE_W);
  const maxX = Math.max(...tileXs, HEX_TILE_W);
  const minY = Math.min(...tileYs, -HEX_TILE_H);
  const maxY = Math.max(...tileYs, HEX_TILE_H);
  const dx = -minX + SCENE_PAD;
  const dy = -minY + SCENE_PAD;
  return {
    width: maxX + dx + SCENE_PAD,
    height: maxY + dy + SCENE_PAD,
    tiles: tilesRaw
      .map((tile) => ({ ...tile, cx: tile.cx + dx, cy: tile.cy + dy, depth: hexDrawDepth({ x: tile.cx + dx, y: tile.cy + dy }) }))
      .sort((a, b) => a.depth - b.depth),
  };
}

export function kingdomResidentHexTiles(residents: KingdomResident[], creatures: KingdomCreature[]): KingdomHexResidentTile[] {
  const coordByIndex = hexSpiral(residents.length, false);
  const meta = new Map(creatures.map((creature) => [creature.creatureId, creature]));
  return residents
    .map((resident, index) => {
      const creature = meta.get(resident.creatureId);
      if (!creature) return null;
      return {
        id: residentTileId(resident.creatureId),
        resident,
        creature,
        coord: coordByIndex[index],
      };
    })
    .filter((tile): tile is KingdomHexResidentTile => Boolean(tile));
}

export function KingdomHexCanvas({
  residents,
  eggVisual,
  residentStatusGlyphs,
  onSelectResident,
}: Props) {
  const scene = useMemo(() => sceneFromResidents(residents), [residents]);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const centred = useSharedValue(false);
  const lastCullUpdate = useSharedValue(0);
  const [cameraSnapshot, setCameraSnapshot] = useState<CameraSnapshot>({ tx: 0, ty: 0, scale: 1 });

  const centreTile = useMemo(() => scene.tiles.find((tile) => tile.id === CENTER_ID) ?? scene.tiles[0], [scene.tiles]);
  const hexTiles = kingdomHexTileSet();
  const tileArtLayers = useMemo(
    () =>
      scene.tiles.map((tile) => ({
        id: tile.id,
        ...tileArtFor(tile, hexTiles),
      })),
    [hexTiles, scene.tiles]
  );
  const cullWorldRect = useMemo(
    () => visibleWorldRect(viewport, { width: scene.width, height: scene.height }, cameraSnapshot),
    [cameraSnapshot, scene.height, scene.width, viewport]
  );
  const visibleTileArtLayers = useMemo(
    () =>
      (cullWorldRect ? tileArtLayers.filter((tile) => rectsIntersect(frameToRect(tile.frame), cullWorldRect)) : tileArtLayers).map((tile) => {
        const lod = tileLodForScreenWidth(tile.frame.width * cameraSnapshot.scale);
        return {
          ...tile,
          lod,
          source: kingdomHexTileSourceForLod(tile, lod),
        };
      }),
    [cameraSnapshot.scale, cullWorldRect, tileArtLayers]
  );
  const visibleTileIds = useMemo(() => new Set(visibleTileArtLayers.map((tile) => tile.id)), [visibleTileArtLayers]);

  const baseScale = viewport.width && viewport.height ? Math.min(1.28, Math.max(0.72, Math.min(viewport.width / 520, viewport.height / 620))) : 1;
  const minScale = 0.54;
  const maxScale = 2.25;
  const boundsW = Math.max(scene.width, viewport.width / Math.max(0.01, scale.value));
  const boundsH = Math.max(scene.height, viewport.height / Math.max(0.01, scale.value));

  const worldStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  const updateCameraSnapshot = useCallback((nextTx: number, nextTy: number, nextScale: number) => {
    setCameraSnapshot((current) => {
      if (
        Math.abs(current.tx - nextTx) < 2 &&
        Math.abs(current.ty - nextTy) < 2 &&
        Math.abs(current.scale - nextScale) < 0.01
      ) {
        return current;
      }
      return { tx: nextTx, ty: nextTy, scale: nextScale };
    });
  }, []);

  useAnimatedReaction(
    () => ({ tx: tx.value, ty: ty.value, scale: scale.value }),
    (next) => {
      const now = Date.now();
      if (now - lastCullUpdate.value < 72) return;
      lastCullUpdate.value = now;
      runOnJS(updateCameraSnapshot)(next.tx, next.ty, next.scale);
    },
    [updateCameraSnapshot]
  );

  useEffect(() => {
    if (!viewport.width || !viewport.height || !centreTile || centred.value) return;
    const nextTx = viewport.width / 2 - scene.width / 2 - (centreTile.cx - scene.width / 2) * baseScale;
    const nextTy = viewport.height / 2 - scene.height / 2 - (centreTile.cy - scene.height / 2) * baseScale - viewport.height * 0.02;
    scale.value = baseScale;
    startScale.value = baseScale;
    tx.value = nextTx;
    ty.value = nextTy;
    setCameraSnapshot({ tx: nextTx, ty: nextTy, scale: baseScale });
    centred.value = true;
  }, [baseScale, centreTile, centred, scene.height, scene.width, scale, startScale, tx, ty, viewport.height, viewport.width]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport({ width, height });
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .activeOffsetY([-6, 6])
    .onChange((event) => {
      const s = scale.value;
      const hw = (boundsW * s) / 2;
      const hh = (boundsH * s) / 2;
      tx.value = Math.min(Math.max(tx.value + event.changeX, viewport.width / 2 - scene.width / 2 - hw), viewport.width / 2 - scene.width / 2 + hw);
      ty.value = Math.min(Math.max(ty.value + event.changeY, viewport.height / 2 - scene.height / 2 - hh), viewport.height / 2 - scene.height / 2 + hh);
    })
    .onEnd((event) => {
      const s = scale.value;
      const hw = (boundsW * s) / 2;
      const hh = (boundsH * s) / 2;
      tx.value = withDecay({
        velocity: event.velocityX,
        deceleration: 0.996,
        clamp: [viewport.width / 2 - scene.width / 2 - hw, viewport.width / 2 - scene.width / 2 + hw],
      });
      ty.value = withDecay({
        velocity: event.velocityY,
        deceleration: 0.996,
        clamp: [viewport.height / 2 - scene.height / 2 - hh, viewport.height / 2 - scene.height / 2 + hh],
      });
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value;
    })
    .onChange((event) => {
      scale.value = Math.min(maxScale, Math.max(minScale, startScale.value * event.scale));
    });

  const recenter = useCallback(() => {
    if (!viewport.width || !viewport.height || !centreTile) return;
    const nextTx = viewport.width / 2 - scene.width / 2 - (centreTile.cx - scene.width / 2) * baseScale;
    const nextTy = viewport.height / 2 - scene.height / 2 - (centreTile.cy - scene.height / 2) * baseScale - viewport.height * 0.02;
    scale.value = withTiming(baseScale, { duration: 260, easing: Easing.out(Easing.cubic) });
    tx.value = withTiming(nextTx, { duration: 260, easing: Easing.out(Easing.cubic) });
    ty.value = withTiming(nextTy, { duration: 260, easing: Easing.out(Easing.cubic) });
    setCameraSnapshot({ tx: nextTx, ty: nextTy, scale: baseScale });
  }, [baseScale, centreTile, scene.height, scene.width, scale, tx, ty, viewport.height, viewport.width]);

  const focusResident = useCallback(
    (x: number, y: number) => {
      if (!viewport.width || !viewport.height) return;
      cancelAnimation(tx);
      cancelAnimation(ty);
      cancelAnimation(scale);
      const zoom = Math.min(maxScale, Math.max(scale.value, 1.35));
      const nextTx = viewport.width / 2 - scene.width / 2 - (x - scene.width / 2) * zoom;
      const nextTy = viewport.height * 0.42 - scene.height / 2 - (y - scene.height / 2) * zoom;
      startScale.value = zoom;
      scale.value = withTiming(zoom, { duration: 420, easing: Easing.out(Easing.cubic) });
      tx.value = withTiming(nextTx, { duration: 420, easing: Easing.out(Easing.cubic) });
      ty.value = withTiming(nextTy, { duration: 420, easing: Easing.out(Easing.cubic) });
      setCameraSnapshot({ tx: nextTx, ty: nextTy, scale: zoom });
    },
    [maxScale, scale, scene.height, scene.width, startScale, tx, ty, viewport.height, viewport.width]
  );

  const renderResidents = useMemo(() => {
    const items: { id: string; depth: number; node: ReactNode }[] = [];
    for (const tile of scene.tiles) {
      if (!visibleTileIds.has(tile.id)) continue;
      if (tile.kind === 'resident' && tile.resident) {
        const creature = {
          x: tile.cx + HEX_TILE_W * CREATURE_WORLD_HORIZONTAL_HEX_OFFSET,
          y: tile.cy + HEX_TILE_H * CREATURE_WORLD_VERTICAL_HEX_OFFSET,
        };
        items.push({
          id: `creature-${tile.id}`,
          depth: hexDrawDepth(creature, 4),
          node: (
            <ResidentCreature
              key={`creature-${tile.id}`}
              tile={tile}
              x={creature.x}
              y={creature.y}
              statusGlyph={residentStatusGlyphs?.[tile.resident.creature.creatureId]}
              onFocus={() => focusResident(creature.x, creature.y)}
              onSelectResident={onSelectResident}
            />
          ),
        });
      }
    }
    return items.sort((a, b) => a.depth - b.depth).map((item) => item.node);
  }, [focusResident, onSelectResident, residentStatusGlyphs, scene.tiles, visibleTileIds]);

  const gesture = Gesture.Simultaneous(pan, pinch);

  return (
    <View style={styles.root} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.scene, { width: scene.width, height: scene.height }, worldStyle]}>
            {visibleTileArtLayers.map((tile) => (
              <Image
                key={`tile-art-${tile.id}`}
                pointerEvents="none"
                source={tile.source}
                contentFit="contain"
                style={[styles.tileArt, tile.frame]}
              />
            ))}
            {centreTile && eggVisual ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Kingdom egg"
                onPress={recenter}
                style={[
                  styles.eggLayer,
                  {
                    left: centreTile.cx + HEX_TILE_W * EGG_WORLD_HORIZONTAL_HEX_OFFSET - EGG_WORLD_W / 2,
                    top: centreTile.cy + HEX_TILE_H * EGG_WORLD_VERTICAL_HEX_OFFSET - EGG_WORLD_H / 2,
                  },
                ]}>
                <Image source={KINGDOM_EGG_SOURCE} contentFit="contain" allowDownscaling={false} style={StyleSheet.absoluteFill} />
              </Pressable>
            ) : (
              <View style={[styles.centerMark, { left: centreTile.cx - 28, top: centreTile.cy - 36 }]}>
                <Text style={styles.centerMarkText}>egg</Text>
              </View>
            )}
            {renderResidents}
          </Animated.View>
        </View>
      </GestureDetector>
      <Pressable accessibilityRole="button" accessibilityLabel="Recenter kingdom" onPress={recenter} style={styles.recenter}>
        <Text style={styles.recenterText}>⌖</Text>
      </Pressable>
    </View>
  );
}

function ResidentCreature({
  tile,
  x,
  y,
  statusGlyph,
  onFocus,
  onSelectResident,
}: {
  tile: TileRender;
  x: number;
  y: number;
  statusGlyph?: KingdomResidentStatusGlyph;
  onFocus?: () => void;
  onSelectResident?: (creatureId: string, label: string) => void;
}) {
  const creature = tile.resident?.creature;
  const source = creature ? worldAssetSource(`creature:${creature.visualKey}`, 'thumb') : null;
  const handlePress = useCallback(() => {
    if (!creature) return;
    onFocus?.();
    onSelectResident?.(creature.creatureId, creature.name);
  }, [creature, onFocus, onSelectResident]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={creature?.name}
      onPress={handlePress}
      style={[styles.creature, { left: x - CREATURE_SIZE / 2, top: y - CREATURE_SIZE * 0.63, width: CREATURE_SIZE, height: CREATURE_SIZE }]}>
      <View pointerEvents="none" style={styles.creatureVisual}>
        {source ? <Image source={source} contentFit="contain" style={StyleSheet.absoluteFill} /> : null}
        {statusGlyph ? (
          <View pointerEvents="none" style={styles.statusGlyphWrap}>
            <View style={[styles.statusGlyph, statusGlyph === 'active' ? styles.statusGlyphActive : styles.statusGlyphReady]}>
              <Text style={styles.statusGlyphText}>{statusGlyph === 'offer' ? '!' : '?'}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  scene: { position: 'relative' },
  tileArt: { position: 'absolute' },
  eggLayer: { height: EGG_WORLD_H, position: 'absolute', width: EGG_WORLD_W },
  centerMark: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,224,163,0.12)',
    borderColor: 'rgba(255,224,163,0.3)',
    borderRadius: 999,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    width: 56,
  },
  centerMarkText: { color: '#FFE0A3', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  creature: { position: 'absolute' },
  creatureVisual: {
    height: CREATURE_WORLD_SIZE,
    left: -(CREATURE_WORLD_SIZE - CREATURE_SIZE) / 2,
    position: 'absolute',
    top: -(CREATURE_WORLD_SIZE - CREATURE_SIZE),
    width: CREATURE_WORLD_SIZE,
  },
  statusGlyphWrap: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: -16,
  },
  statusGlyph: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.42)',
    borderRadius: 999,
    borderWidth: 1,
    height: 23,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 6,
    width: 23,
  },
  statusGlyphActive: { backgroundColor: 'rgba(120,120,140,0.92)' },
  statusGlyphReady: { backgroundColor: '#E9A93E' },
  statusGlyphText: { color: Lantern.emberInk, fontSize: 17, fontWeight: '900', lineHeight: 19 },
  recenter: {
    alignItems: 'center',
    backgroundColor: 'rgba(20,17,31,0.82)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 23,
    borderWidth: 1,
    bottom: 126,
    height: 46,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    width: 46,
  },
  recenterText: { color: Lantern.moon50, fontSize: 22, fontWeight: '900' },
});
