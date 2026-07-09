import { Image } from 'expo-image';
import { MotiView } from 'moti';
import { memo, type MutableRefObject, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated';

import { LanternEgg } from '@/components/katchadeck/home/lantern-egg';
import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { EggVisualState } from '@/types/home';
import type { KingdomCreature } from '@/types/kingdom';
import type { KingdomDecorItem } from '@/utils/kingdom-decor';
import type { KingdomResident } from '@/utils/kingdom-residents';
import {
  clampHexLocal,
  HEX_TILE_H,
  HEX_TILE_LIP,
  HEX_TILE_W,
  hexDrawDepth,
  hexLocalToWorld,
  hexSpiral,
  hexTileTopPoints,
  hexToWorld,
  worldToHexLocal,
  type HexCoord,
} from '@/utils/world-hex';
import { KINGDOM_DEFAULT_HEX_TILE, KINGDOM_EGG_HEX_TILE, worldAssetSource } from '@/utils/world-visuals';

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
  decor: KingdomDecorItem[];
  customising?: boolean;
  highlightObjectId?: string | null;
  eggVisual?: EggVisualState | null;
  lanternColor?: string;
  residentStatusGlyphs?: Partial<Record<string, KingdomResidentStatusGlyph>>;
  getCenterCellRef?: MutableRefObject<KingdomHexCenterRef | null>;
  onSelectResident?: (creatureId: string, label: string) => void;
  onSelectDecor?: (id: string) => void;
  onMoveDecor?: (id: string, col: number, row: number, plotId?: string | null) => void;
  onRemoveDecor?: (id: string) => void;
  onOpenKeepsakes?: () => void;
  unplantedCount?: number;
};

const SCENE_PAD = 1200;
const CENTER_ID = 'kingdom';
const CREATURE_SIZE = 58;
const HOUSE_SIZE = 62;
const DECOR_BASE_SIZE = 54;
const EGG_STAGE_W = 200;
const EGG_STAGE_H = 258;
const EGG_STAGE_SCALE = 0.7;
const CENTER_TILE_ASSET_SIZE = 1024;
const CENTER_TILE_ALPHA_BOUNDS = {
  left: 14,
  top: 144,
  right: 1010,
  bottom: 879,
};
const DEFAULT_TILE_ALPHA_BOUNDS = {
  left: 14,
  top: 147,
  right: 1010,
  bottom: 876,
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

function tileArtFrame(tile: TileRender, assetBounds: typeof CENTER_TILE_ALPHA_BOUNDS) {
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

function tileArtFor(tile: TileRender) {
  return tile.kind === 'center'
    ? {
        source: KINGDOM_EGG_HEX_TILE,
        frame: tileArtFrame(tile, CENTER_TILE_ALPHA_BOUNDS),
      }
    : {
        source: KINGDOM_DEFAULT_HEX_TILE,
        frame: tileArtFrame(tile, DEFAULT_TILE_ALPHA_BOUNDS),
      };
}

function sceneFromResidents(residents: KingdomHexResidentTile[], decor: KingdomDecorItem[]) {
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
  const tileById = new Map(tilesRaw.map((tile) => [tile.id, tile]));
  const decorExtents = decor.flatMap((item) => {
    const tile = tileById.get(item.plotId ?? CENTER_ID) ?? tilesRaw[0];
    const local = hexLocalToWorld(item.col, item.row);
    const size = DECOR_BASE_SIZE * (item.sizeScale ?? 1);
    const x = tile.cx + dx + local.x;
    const y = tile.cy + dy + local.y;
    return [
      { x: x - size, y: y - size },
      { x: x + size, y: y + size },
    ];
  });
  const sceneMaxX = Math.max(maxX + dx + SCENE_PAD, ...decorExtents.map((point) => point.x + SCENE_PAD));
  const sceneMaxY = Math.max(maxY + dy + SCENE_PAD, ...decorExtents.map((point) => point.y + SCENE_PAD));
  return {
    width: sceneMaxX,
    height: sceneMaxY,
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
  decor,
  customising = false,
  highlightObjectId,
  eggVisual,
  lanternColor,
  residentStatusGlyphs,
  getCenterCellRef,
  onSelectResident,
  onSelectDecor,
  onMoveDecor,
  onRemoveDecor,
  onOpenKeepsakes,
  unplantedCount = 0,
}: Props) {
  const scene = useMemo(() => sceneFromResidents(residents, decor), [decor, residents]);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const centred = useSharedValue(false);

  const centreTile = useMemo(() => scene.tiles.find((tile) => tile.id === CENTER_ID) ?? scene.tiles[0], [scene.tiles]);
  const tileById = useMemo(() => new Map(scene.tiles.map((tile) => [tile.id, tile])), [scene.tiles]);
  const tileArtLayers = useMemo(
    () =>
      scene.tiles.map((tile) => ({
        id: tile.id,
        ...tileArtFor(tile),
      })),
    [scene.tiles]
  );

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

  useEffect(() => {
    if (!viewport.width || !viewport.height || !centreTile || centred.value) return;
    const nextTx = viewport.width / 2 - scene.width / 2 - (centreTile.cx - scene.width / 2) * baseScale;
    const nextTy = viewport.height / 2 - scene.height / 2 - (centreTile.cy - scene.height / 2) * baseScale - viewport.height * 0.02;
    scale.value = baseScale;
    startScale.value = baseScale;
    tx.value = nextTx;
    ty.value = nextTy;
    centred.value = true;
  }, [baseScale, centreTile, centred, scene.height, scene.width, scale, startScale, tx, ty, viewport.height, viewport.width]);

  if (getCenterCellRef) {
    getCenterCellRef.current = () => {
      if (!viewport.width || !viewport.height || scene.tiles.length === 0) return null;
      const wx = (viewport.width / 2 - scene.width / 2 - tx.value) / scale.value + scene.width / 2;
      const wy = (viewport.height / 2 - scene.height / 2 - ty.value) / scale.value + scene.height / 2;
      let best = scene.tiles[0];
      let bestDistance = Infinity;
      for (const tile of scene.tiles) {
        const distance = (wx - tile.cx) ** 2 + (wy - tile.cy) ** 2;
        if (distance < bestDistance) {
          best = tile;
          bestDistance = distance;
        }
      }
      const local = clampHexLocal(worldToHexLocal(wx - best.cx, wy - best.cy));
      return { col: local.col, row: local.row, plotId: best.id === CENTER_ID ? null : best.id };
    };
  }

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
    },
    [maxScale, scale, scene.height, scene.width, startScale, tx, ty, viewport.height, viewport.width]
  );

  const renderObjects = useMemo(() => {
    const items: { id: string; depth: number; node: ReactNode }[] = [];
    for (const tile of scene.tiles) {
      if (tile.kind === 'resident' && tile.resident) {
        const house = { x: tile.cx + HEX_TILE_W * 0.22, y: tile.cy - HEX_TILE_H * 0.18 };
        const creature = { x: tile.cx, y: tile.cy + HEX_TILE_H * 0.03 };
        items.push({
          id: `house-${tile.id}`,
          depth: hexDrawDepth(house, 1),
          node: <ResidentHouse key={`house-${tile.id}`} tile={tile} x={house.x} y={house.y} />,
        });
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
    for (const item of decor) {
      const tile = tileById.get(item.plotId ?? CENTER_ID) ?? centreTile;
      if (!tile) continue;
      const local = hexLocalToWorld(item.col, item.row);
      const x = tile.cx + local.x;
      const y = tile.cy + local.y;
      items.push({
        id: item.id,
        depth: hexDrawDepth({ x, y }, 5),
        node: (
          <HexDecorSprite
            key={item.id}
            item={item}
            tile={tile}
            x={x}
            y={y}
            tiles={scene.tiles}
            scaleSV={scale}
            customising={customising}
            highlighted={highlightObjectId === item.id}
            onMoveDecor={onMoveDecor}
            onRemoveDecor={onRemoveDecor}
            onSelectDecor={onSelectDecor}
          />
        ),
      });
    }
    return items.sort((a, b) => a.depth - b.depth).map((item) => item.node);
  }, [centreTile, customising, decor, focusResident, highlightObjectId, onMoveDecor, onRemoveDecor, onSelectDecor, onSelectResident, residentStatusGlyphs, scene.tiles, scale, tileById]);

  const gesture = Gesture.Simultaneous(pan, pinch);

  return (
    <View style={styles.root} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.scene, { width: scene.width, height: scene.height }, worldStyle]}>
            {tileArtLayers.map((tile) => (
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
                    left: centreTile.cx - EGG_STAGE_W / 2,
                    top: centreTile.cy - EGG_STAGE_H / 2 - HEX_TILE_H * 0.04,
                    transform: [{ scale: EGG_STAGE_SCALE }],
                  },
                ]}>
                <LanternEgg egg={eggVisual} lanternColor={lanternColor} />
              </Pressable>
            ) : (
              <View style={[styles.centerMark, { left: centreTile.cx - 28, top: centreTile.cy - 36 }]}>
                <Text style={styles.centerMarkText}>egg</Text>
              </View>
            )}
            {renderObjects}
            {unplantedCount > 0 && centreTile ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open keepsakes"
                onPress={onOpenKeepsakes}
                style={[styles.giftCrate, { left: centreTile.cx + HEX_TILE_W * 0.23, top: centreTile.cy + HEX_TILE_H * 0.2 }]}>
                <ThemedText style={styles.giftCrateIcon} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
                  +
                </ThemedText>
                <View style={styles.giftCrateBadge}>
                  <ThemedText style={styles.giftCrateCount} lightColor={Lantern.ink950} darkColor={Lantern.ink950}>
                    {unplantedCount}
                  </ThemedText>
                </View>
              </Pressable>
            ) : null}
          </Animated.View>
        </View>
      </GestureDetector>
      <Pressable accessibilityRole="button" accessibilityLabel="Recenter kingdom" onPress={recenter} style={styles.recenter}>
        <Text style={styles.recenterText}>⌖</Text>
      </Pressable>
    </View>
  );
}

function ResidentHouse({ tile, x, y }: { tile: TileRender; x: number; y: number }) {
  const source = worldAssetSource('home');
  const badge = tile.resident?.resident.houseLevel ?? 1;
  return (
    <View pointerEvents="none" style={[styles.house, { left: x - HOUSE_SIZE / 2, top: y - HOUSE_SIZE * 0.72, width: HOUSE_SIZE, height: HOUSE_SIZE }]}>
      {source ? <Image source={source} contentFit="contain" style={StyleSheet.absoluteFill} /> : <View style={styles.houseFallback} />}
      {badge > 1 ? (
        <View style={styles.houseBadge}>
          <Text style={styles.houseBadgeText}>{badge}</Text>
        </View>
      ) : null}
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
  const source = creature ? worldAssetSource(`creature:${creature.visualKey}`) : null;
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
      {source ? <Image source={source} contentFit="contain" style={StyleSheet.absoluteFill} /> : null}
      {statusGlyph ? (
        <View pointerEvents="none" style={styles.statusGlyphWrap}>
          <View style={[styles.statusGlyph, statusGlyph === 'active' ? styles.statusGlyphActive : styles.statusGlyphReady]}>
            <Text style={styles.statusGlyphText}>{statusGlyph === 'offer' ? '!' : '?'}</Text>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const HexDecorSprite = memo(function HexDecorSprite({
  item,
  tile,
  x,
  y,
  tiles,
  scaleSV,
  customising,
  highlighted,
  onMoveDecor,
  onRemoveDecor,
  onSelectDecor,
}: {
  item: KingdomDecorItem;
  tile: TileRender;
  x: number;
  y: number;
  tiles: TileRender[];
  scaleSV: SharedValue<number>;
  customising: boolean;
  highlighted: boolean;
  onMoveDecor?: (id: string, col: number, row: number, plotId?: string | null) => void;
  onRemoveDecor?: (id: string) => void;
  onSelectDecor?: (id: string) => void;
}) {
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const dragging = useSharedValue(false);
  const source = worldAssetSource(item.assetKey);
  const size = DECOR_BASE_SIZE * (item.sizeScale ?? 1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.value }, { translateY: dy.value }, { scale: dragging.value ? 1.07 : 1 }],
    zIndex: dragging.value ? 20 : 1,
  }));
  const commit = useCallback(
    (worldDx: number, worldDy: number) => {
      const drop = { x: x + worldDx, y: y + worldDy };
      let nearest = tile;
      let nearestDistance = Infinity;
      for (const candidate of tiles) {
        const distance = (drop.x - candidate.cx) ** 2 + (drop.y - candidate.cy) ** 2;
        if (distance < nearestDistance) {
          nearest = candidate;
          nearestDistance = distance;
        }
      }
      const local = worldToHexLocal(drop.x - nearest.cx, drop.y - nearest.cy);
      onMoveDecor?.(item.id, local.col, local.row, nearest.id === CENTER_ID ? null : nearest.id);
    },
    [item.id, onMoveDecor, tile, tiles, x, y]
  );
  const drag = Gesture.Pan()
    .enabled(Boolean(onMoveDecor))
    .activateAfterLongPress(customising ? 0 : 320)
    .onStart(() => {
      dragging.value = true;
    })
    .onChange((event) => {
      dx.value = event.translationX / scaleSV.value;
      dy.value = event.translationY / scaleSV.value;
    })
    .onEnd(() => {
      runOnJS(commit)(dx.value, dy.value);
      dx.value = withTiming(0, { duration: 140 });
      dy.value = withTiming(0, { duration: 140 });
    })
    .onFinalize(() => {
      dragging.value = false;
      dx.value = withTiming(0, { duration: 140 });
      dy.value = withTiming(0, { duration: 140 });
    });
  return (
    <GestureDetector gesture={drag}>
      <Animated.View style={[styles.decor, { left: x - size / 2, top: y - size * 0.78, width: size, height: size }, animStyle]}>
        <Pressable accessibilityRole="button" onPress={() => !customising && onSelectDecor?.(item.id)} style={StyleSheet.absoluteFill}>
          {highlighted ? (
            <MotiView
              pointerEvents="none"
              from={{ opacity: 0.25, scale: 0.9 }}
              animate={{ opacity: 0.58, scale: 1.08 }}
              transition={{ loop: true, type: 'timing', duration: 900 }}
              style={styles.decorHighlight}
            />
          ) : null}
          {source ? <Image source={source} contentFit="contain" style={StyleSheet.absoluteFill} /> : <View style={styles.decorFallback} />}
        </Pressable>
        {customising ? (
          <Pressable accessibilityRole="button" onPress={() => onRemoveDecor?.(item.id)} style={styles.remove}>
            <Text style={styles.removeText}>×</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  scene: { position: 'relative' },
  tileArt: { position: 'absolute' },
  eggLayer: { height: EGG_STAGE_H, position: 'absolute', width: EGG_STAGE_W },
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
  decor: { position: 'absolute' },
  decorHighlight: {
    backgroundColor: 'rgba(255,224,163,0.18)',
    borderColor: 'rgba(255,224,163,0.65)',
    borderRadius: 999,
    borderWidth: 1,
    bottom: 4,
    left: 4,
    position: 'absolute',
    right: 4,
    top: 4,
  },
  decorFallback: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, flex: 1 },
  giftCrate: {
    alignItems: 'center',
    backgroundColor: 'rgba(28,24,48,0.92)',
    borderColor: 'rgba(255,195,107,0.45)',
    borderRadius: 16,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    position: 'absolute',
    width: 42,
  },
  giftCrateIcon: { fontSize: 24, fontWeight: '900', lineHeight: 28 },
  giftCrateBadge: {
    alignItems: 'center',
    backgroundColor: Lantern.ember300,
    borderRadius: 999,
    minWidth: 17,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -5,
    top: -5,
  },
  giftCrateCount: { fontSize: 10, fontWeight: '900' },
  house: { position: 'absolute' },
  houseFallback: { backgroundColor: 'rgba(255,224,163,0.16)', borderRadius: 14, flex: 1 },
  houseBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(20,17,31,0.88)',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    borderWidth: 1,
    bottom: 4,
    minWidth: 18,
    paddingHorizontal: 4,
    position: 'absolute',
    right: 3,
  },
  houseBadgeText: { color: '#FFE0A3', fontSize: 10, fontWeight: '900' },
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
  remove: {
    alignItems: 'center',
    backgroundColor: 'rgba(20,17,31,0.94)',
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 10,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -4,
    top: -4,
    width: 20,
  },
  removeText: { color: Lantern.moon50, fontSize: 13, fontWeight: '900', lineHeight: 15 },
});
