import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CreatureGroundShadow } from '@/components/katchadeck/creature-ground-shadow';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { KingdomHexResidentTile, KingdomTileRender } from '@/components/katchadeck/world/kingdom-hex-scene';
import { buildKingdomHexScene } from '@/components/katchadeck/world/kingdom-hex-scene';
import { SeamlessWorldImage } from '@/components/katchadeck/world/seamless-world-image';
import { useKingdomHexCamera } from '@/components/katchadeck/world/use-kingdom-hex-camera';
import { useKingdomLodScheduler } from '@/components/katchadeck/world/use-kingdom-lod-scheduler';
import { useKingdomTileScheduler } from '@/components/katchadeck/world/use-kingdom-tile-scheduler';
import { KINGDOM_RENDERING } from '@/constants/kingdom-rendering';
import kingdomWorldViewConfig from '@/constants/kingdom-world-view.json';
import { zodiacFamiliarSource } from '@/constants/world-identity-art';
import { Lantern } from '@/constants/theme';
import type { EggVisualState } from '@/types/home';
import type { WorldIdentityState } from '@/types/world-identity';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import { homePreset, zodiacProfile } from '@/utils/world-identity';
import { HEX_TILE_H, HEX_TILE_W, hexDrawDepth } from '@/utils/world-hex';
import {
  kingdomWorldViewPoint,
  screenPointToWorld,
  type KingdomResidentLod,
} from '@/utils/kingdom-rendering';
import type { KingdomTilePhase } from '@/utils/kingdom-tile-scheduler';
import { getDevKingdomHexVerticalAlignmentMode } from '@/utils/dev-asset-overrides';
import { useScenePerformanceProbe } from '@/hooks/use-scene-performance-probe';
import {
  kingdomHexTileSet,
  kingdomHexTileSourceForLod,
  worldAssetSource,
  type KingdomHexTileLod,
} from '@/utils/world-visuals';

export { kingdomResidentHexTiles } from '@/components/katchadeck/world/kingdom-hex-scene';
export type { KingdomHexResidentTile } from '@/components/katchadeck/world/kingdom-hex-scene';

export type KingdomHexCenterRef = () => { col: number; row: number; plotId: string | null } | null;
export type KingdomResidentStatusGlyph = 'offer' | 'active' | 'ready';

type Props = {
  background: TodayAtmosphereBackground;
  residents: KingdomHexResidentTile[];
  identity?: WorldIdentityState | null;
  eggVisual?: EggVisualState | null;
  lanternColor?: string;
  residentStatusGlyphs?: Partial<Record<string, KingdomResidentStatusGlyph>>;
  onSelectResident?: (creatureId: string, label: string) => void;
  onSelectHome?: () => void;
  onSelectZodiac?: () => void;
};

const CREATURE_SIZE = 58;
const CREATURE_WORLD_SCALE = kingdomWorldViewConfig.katchimera.globalScale;
const CREATURE_WORLD_SIZE = CREATURE_SIZE * CREATURE_WORLD_SCALE;
const ZODIAC_WORLD_SCALE = kingdomWorldViewConfig.zodiac.globalScale;
const ZODIAC_WORLD_SIZE = CREATURE_SIZE * ZODIAC_WORLD_SCALE;
const EGG_STAGE_W = 200;
const EGG_STAGE_H = 258;
const EGG_WORLD_SCALE = kingdomWorldViewConfig.egg.globalScale;
const EGG_WORLD_W = EGG_STAGE_W * EGG_WORLD_SCALE;
const EGG_WORLD_H = EGG_STAGE_H * EGG_WORLD_SCALE;
const KINGDOM_EGG_SOURCE = require('../../../assets/images/katchimeras/cutouts/egg-base.webp');
const TILE_WORLD_LOD_WIDTH = HEX_TILE_W * 1.03;

export const KingdomHexCanvas = memo(function KingdomHexCanvas({
  background,
  residents,
  identity,
  eggVisual,
  residentStatusGlyphs,
  onSelectResident,
  onSelectHome,
  onSelectZodiac,
}: Props) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [assetRevision, setAssetRevision] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setAssetRevision((current) => current + 1);
    }, [])
  );

  const hexTileSelection = useMemo(
    () => ({ revision: assetRevision, value: kingdomHexTileSet() }),
    [assetRevision]
  );
  const verticalAlignmentSelection = useMemo(
    () => ({ revision: assetRevision, value: getDevKingdomHexVerticalAlignmentMode() }),
    [assetRevision]
  );
  const scene = useMemo(
    () => buildKingdomHexScene(residents, hexTileSelection.value, identity, verticalAlignmentSelection.value),
    [hexTileSelection, identity, residents, verticalAlignmentSelection]
  );
  const camera = useKingdomHexCamera({
    center: { x: scene.centerTile.cx, y: scene.centerTile.cy },
    residentWorldSize: CREATURE_WORLD_SIZE,
    scene,
    tileWorldWidth: TILE_WORLD_LOD_WIDTH,
    viewport,
  });
  const cameraTransitionActive = useSharedValue(camera.isMoving ? 1 : 0);
  useEffect(() => {
    cameraTransitionActive.value = camera.isMoving ? 1 : 0;
  }, [camera.isMoving, cameraTransitionActive]);
  useScenePerformanceProbe('kingdom-camera', cameraTransitionActive);
  const scheduler = useKingdomTileScheduler({
    camera: camera.snapshot,
    cameraReady: camera.ready,
    isMoving: camera.isMoving,
    scene,
    viewport,
  });
  const lodScheduler = useKingdomLodScheduler({
    isMoving: camera.isMoving,
    requestedLod: camera.tileLod,
    renderedTiles: scheduler.renderedTiles,
    visibleTileIds: scheduler.visibleTileIds,
  });
  const runtimeById = useMemo(
    () => new Map(scheduler.renderedTiles.map((item) => [item.layer.id, item.runtime])),
    [scheduler.renderedTiles]
  );
  const promotedFullTileId = useMemo(() => {
    if (camera.isMoving || camera.tileLod !== 'full' || viewport.width <= 0 || viewport.height <= 0) {
      return null;
    }
    const center = screenPointToWorld(
      { x: viewport.width / 2, y: viewport.height / 2 },
      scene,
      camera.snapshot,
    );
    let nearestId: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const layer of scene.tileArtLayers) {
      if (!scheduler.visibleTileIds.has(layer.id)) continue;
      const x = layer.frame.left + layer.frame.width / 2;
      const y = layer.frame.top + layer.frame.height / 2;
      const distance = (x - center.x) ** 2 + (y - center.y) ** 2;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = layer.id;
      }
    }
    return nearestId;
  }, [
    camera.isMoving,
    camera.snapshot,
    camera.tileLod,
    scene,
    scheduler.visibleTileIds,
    viewport.height,
    viewport.width,
  ]);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport((current) => (current.width === width && current.height === height ? current : { width, height }));
  }, []);

  const creatureNodes = useMemo(() => {
    const items: { depth: number; node: ReactNode }[] = [];
    for (const tile of scene.tiles) {
      if (tile.kind !== 'resident' || !tile.resident || !scheduler.readyTileIds.has(tile.id)) continue;
      const runtime = runtimeById.get(tile.id);
      if (!runtime || (!scheduler.visibleTileIds.has(tile.id) && runtime.phase !== 'exiting')) continue;
      const { x, y } = kingdomWorldViewPoint(
        { x: tile.cx, y: tile.cy },
        kingdomWorldViewConfig.katchimera
      );
      items.push({
        depth: hexDrawDepth({ x, y }, 4),
        node: (
          <ResidentCreature
            key={`creature-${tile.id}`}
            tile={tile}
            x={x}
            y={y}
            lod={camera.residentLod}
            phase={runtime.phase}
            settled={!camera.isMoving}
            statusGlyph={residentStatusGlyphs?.[tile.resident.creature.creatureId]}
            onFocus={camera.focusResident}
            onSelectResident={onSelectResident}
          />
        ),
      });
    }

    const zodiacTile = scene.tiles.find((tile) => tile.kind === 'zodiac');
    const zodiac = zodiacProfile(identity?.zodiacSignId);
    if (zodiacTile && zodiac && scheduler.readyTileIds.has(zodiacTile.id)) {
      const runtime = runtimeById.get(zodiacTile.id);
      if (runtime && (scheduler.visibleTileIds.has(zodiacTile.id) || runtime.phase === 'exiting')) {
        const { x, y } = kingdomWorldViewPoint(
          { x: zodiacTile.cx, y: zodiacTile.cy },
          kingdomWorldViewConfig.zodiac
        );
        items.push({
          depth: hexDrawDepth({ x, y }, 4),
          node: (
            <ZodiacCreature
              accessibilityLabel={`${zodiac.familiarName}, ${zodiac.name} star companion`}
              key={`zodiac-creature-${zodiac.id}`}
              onFocus={camera.focusResident}
              onPress={onSelectZodiac}
              phase={runtime.phase}
              settled={!camera.isMoving}
              source={zodiacFamiliarSource(zodiac.element, camera.residentLod)}
              x={x}
              y={y}
            />
          ),
        });
      }
    }

    return items.sort((a, b) => a.depth - b.depth).map((item) => item.node);
  }, [camera.focusResident, camera.isMoving, camera.residentLod, identity?.zodiacSignId, onSelectResident, onSelectZodiac, residentStatusGlyphs, runtimeById, scene.tiles, scheduler.readyTileIds, scheduler.visibleTileIds]);

  const centerRuntime = runtimeById.get(scene.centerTile.id);
  const home = homePreset(identity?.selectedHomeArchetypeId);
  const showEgg =
    Boolean(eggVisual) &&
    scheduler.readyTileIds.has(scene.centerTile.id) &&
    Boolean(centerRuntime) &&
    (scheduler.visibleTileIds.has(scene.centerTile.id) || centerRuntime?.phase === 'exiting');

  return (
    <View style={styles.root} onLayout={onLayout}>
      <Image
        cachePolicy="memory-disk"
        contentFit="cover"
        pointerEvents="none"
        recyclingKey={background.id}
        source={background.source}
        style={StyleSheet.absoluteFill}
      />
      {/* Recreate the native handler whenever this tab regains focus. A camera
          route can suspend a gesture mid-lifecycle on iOS; retaining that
          handler leaves the otherwise-visible Kingdom canvas unresponsive. */}
      <GestureDetector key={`kingdom-camera-${assetRevision}`} gesture={camera.gesture}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.scene, { width: scene.width, height: scene.height }, camera.worldStyle]}>
            {scheduler.renderedTiles.map(({ layer, runtime }) => {
              const scheduledLod = lodScheduler.lodFor(layer.id);
              const lod: KingdomHexTileLod = layer.id === promotedFullTileId
                ? 'full'
                : scheduledLod === 'full'
                  ? 'medium'
                  : scheduledLod;
              const source = kingdomHexTileSourceForLod(layer, lod);
              const fallbackSource = layer.fallbackSource
                ? kingdomHexTileSourceForLod(
                    { source: layer.fallbackSource, sources: layer.fallbackSources },
                    lod
                  )
                : null;
              return (
                <KingdomTileArt
                  key={`tile-art-${layer.id}`}
                  id={layer.id}
                  frame={layer.frame}
                  lod={lod}
                  source={source}
                  fallbackSource={fallbackSource}
                  phase={runtime.phase}
                  priority={lod === 'full' || layer.id === scene.centerTile.id ? 'high' : scheduler.visibleTileIds.has(layer.id) ? 'normal' : 'low'}
                  settled={!camera.isMoving}
                  onExited={scheduler.markExited}
                  onFailed={scheduler.markFailed}
                  onLoaded={scheduler.markLoaded}
                  onLodReady={lodScheduler.markReady}
                />
              );
            })}
            {showEgg && centerRuntime ? (
              <KingdomEgg
                {...kingdomWorldViewPoint(
                  { x: scene.centerTile.cx, y: scene.centerTile.cy },
                  kingdomWorldViewConfig.egg
                )}
                phase={centerRuntime.phase}
                settled={!camera.isMoving}
                onPress={camera.recenter}
              />
            ) : null}
            {identity?.selectedHomeArchetypeId && centerRuntime ? (
              <HomeTileHitTarget
                accessibilityLabel={`${home.name} home`}
                onPress={onSelectHome}
                x={scene.centerTile.cx}
                y={scene.centerTile.cy - HEX_TILE_H * 0.38}
              />
            ) : null}
            {creatureNodes}
          </Animated.View>
        </View>
      </GestureDetector>
      <Pressable accessibilityRole="button" accessibilityLabel="Recenter kingdom" onPress={camera.recenter} style={styles.recenter}>
        <IconSymbol name="scope" size={22} color={Lantern.moon50} />
      </Pressable>
    </View>
  );
});

const HomeTileHitTarget = memo(function HomeTileHitTarget({ accessibilityLabel, onPress, x, y }: {
  accessibilityLabel: string; onPress?: () => void; x: number; y: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={12}
      onPress={onPress}
      style={[styles.homeTileHitTarget, { left: x - 54, top: y - 42 }]}
    />
  );
});

type TileArtProps = {
  fallbackSource: ImageSourcePropType | null;
  frame: { left: number; top: number; width: number; height: number };
  id: string;
  lod: KingdomHexTileLod;
  onExited: (id: string) => void;
  onFailed: (id: string) => void;
  onLoaded: (id: string) => void;
  onLodReady: (id: string, lod: KingdomHexTileLod) => void;
  phase: KingdomTilePhase;
  priority: 'low' | 'normal' | 'high';
  settled: boolean;
  source: ImageSourcePropType;
};

const KingdomTileArt = memo(function KingdomTileArt({
  fallbackSource,
  frame,
  id,
  lod,
  onExited,
  onFailed,
  onLoaded,
  onLodReady,
  phase,
  priority,
  settled,
  source,
}: TileArtProps) {
  const opacity = useSharedValue(0);
  const lift = useSharedValue(12);
  const shownRef = useRef(false);

  useEffect(() => {
    if (phase === 'exiting') {
      opacity.value = withTiming(0, { duration: KINGDOM_RENDERING.exitDurationMs }, (finished) => {
        if (finished) runOnJS(onExited)(id);
      });
      lift.value = withTiming(6, { duration: KINGDOM_RENDERING.exitDurationMs });
      return;
    }
    cancelAnimation(opacity);
    cancelAnimation(lift);
    if (phase !== 'visible' && phase !== 'failed') return;
    if (!shownRef.current && !settled) return;
    shownRef.current = true;
    opacity.value = withTiming(1, { duration: KINGDOM_RENDERING.tileIntroMs, easing: Easing.out(Easing.cubic) });
    lift.value = withTiming(0, { duration: KINGDOM_RENDERING.tileIntroMs, easing: Easing.out(Easing.cubic) });
  }, [id, lift, onExited, opacity, phase, settled]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: lift.value }],
  }));
  const handleLoaded = useCallback(() => {
    onLoaded(id);
    onLodReady(id, lod);
  }, [id, lod, onLoaded, onLodReady]);
  const handleFailed = useCallback(() => {
    onFailed(id);
    onLodReady(id, lod);
  }, [id, lod, onFailed, onLodReady]);

  return (
    <Animated.View pointerEvents="none" style={[styles.tileArt, frame, animatedStyle]}>
      <SeamlessWorldImage
        source={source}
        fallbackSource={fallbackSource}
        priority={priority}
        onReady={handleLoaded}
        onFailure={handleFailed}
      />
    </Animated.View>
  );
});

const KingdomEgg = memo(function KingdomEgg({
  x,
  y,
  phase,
  settled,
  onPress,
}: {
  x: number;
  y: number;
  phase: KingdomTilePhase;
  settled: boolean;
  onPress: () => void;
}) {
  const [ready, setReady] = useState(false);
  const opacity = useSharedValue(0);
  const lift = useSharedValue(10);
  const shownRef = useRef(false);

  useEffect(() => {
    if (phase === 'exiting') {
      opacity.value = withTiming(0, { duration: KINGDOM_RENDERING.exitDurationMs });
      lift.value = withTiming(6, { duration: KINGDOM_RENDERING.exitDurationMs });
      return;
    }
    if (!ready || (!shownRef.current && !settled)) return;
    shownRef.current = true;
    opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
    lift.value = withSpring(0, { damping: 14, stiffness: 190 });
  }, [lift, opacity, phase, ready, settled]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: lift.value }],
  }));
  const markReady = useCallback(() => setReady(true), []);

  return (
    <Animated.View style={[styles.eggLayer, { left: x - EGG_WORLD_W / 2, top: y - EGG_WORLD_H / 2 }, animatedStyle]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Kingdom egg" onPress={onPress} style={StyleSheet.absoluteFill}>
        <SeamlessWorldImage source={KINGDOM_EGG_SOURCE} priority="high" onReady={markReady} onFailure={markReady} />
      </Pressable>
    </Animated.View>
  );
});

type ResidentProps = {
  lod: KingdomResidentLod;
  onFocus: (x: number, y: number) => void;
  onSelectResident?: (creatureId: string, label: string) => void;
  phase: KingdomTilePhase;
  settled: boolean;
  statusGlyph?: KingdomResidentStatusGlyph;
  tile: KingdomTileRender;
  x: number;
  y: number;
};

const ResidentCreature = memo(function ResidentCreature({
  lod,
  onFocus,
  onSelectResident,
  phase,
  settled,
  statusGlyph,
  tile,
  x,
  y,
}: ResidentProps) {
  const creature = tile.resident?.creature;
  const source = creature ? worldAssetSource(`creature:${creature.visualKey}`, lod) : null;
  const [ready, setReady] = useState(false);
  const opacity = useSharedValue(0);
  const lift = useSharedValue(12);
  const shownRef = useRef(false);

  useEffect(() => {
    if (phase === 'exiting') {
      opacity.value = withTiming(0, { duration: KINGDOM_RENDERING.exitDurationMs });
      lift.value = withTiming(6, { duration: KINGDOM_RENDERING.exitDurationMs });
      return;
    }
    if (!ready || (!shownRef.current && !settled)) return;
    shownRef.current = true;
    opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
    lift.value = withSpring(0, { damping: 14, stiffness: 210 });
  }, [lift, opacity, phase, ready, settled]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: lift.value }],
  }));
  const handlePress = useCallback(() => {
    if (!creature) return;
    onFocus(x, y);
    onSelectResident?.(creature.creatureId, creature.name);
  }, [creature, onFocus, onSelectResident, x, y]);
  const markReady = useCallback(() => setReady(true), []);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={creature?.name}
      onPress={handlePress}
      style={[
        styles.creature,
        {
          left: x - CREATURE_WORLD_SIZE / 2,
          top: y - CREATURE_SIZE * 0.63 - (CREATURE_WORLD_SIZE - CREATURE_SIZE),
          width: CREATURE_WORLD_SIZE,
          height: CREATURE_WORLD_SIZE,
        },
      ]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, animatedStyle]}>
        {creature ? (
          <CreatureGroundShadow
            frameSize={CREATURE_WORLD_SIZE}
            visualKey={creature.visualKey}
          />
        ) : null}
        {source ? <SeamlessWorldImage source={source} priority="normal" onReady={markReady} onFailure={markReady} /> : null}
        {statusGlyph ? <ResidentStatusGlyph status={statusGlyph} /> : null}
      </Animated.View>
    </Pressable>
  );
});

const ZodiacCreature = memo(function ZodiacCreature({
  accessibilityLabel,
  onFocus,
  onPress,
  phase,
  settled,
  source,
  x,
  y,
}: {
  accessibilityLabel: string;
  onFocus: (x: number, y: number) => void;
  onPress?: () => void;
  phase: KingdomTilePhase;
  settled: boolean;
  source: ImageSourcePropType;
  x: number;
  y: number;
}) {
  const [ready, setReady] = useState(false);
  const opacity = useSharedValue(0);
  const lift = useSharedValue(12);
  const shownRef = useRef(false);

  useEffect(() => {
    if (phase === 'exiting') {
      opacity.value = withTiming(0, { duration: KINGDOM_RENDERING.exitDurationMs });
      lift.value = withTiming(6, { duration: KINGDOM_RENDERING.exitDurationMs });
      return;
    }
    if (!ready || (!shownRef.current && !settled)) return;
    shownRef.current = true;
    opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
    lift.value = withSpring(0, { damping: 14, stiffness: 210 });
  }, [lift, opacity, phase, ready, settled]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: lift.value }],
  }));
  const handlePress = useCallback(() => {
    onFocus(x, y);
    onPress?.();
  }, [onFocus, onPress, x, y]);
  const markReady = useCallback(() => setReady(true), []);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={handlePress}
      style={[
        styles.creature,
        {
          height: ZODIAC_WORLD_SIZE,
          left: x - ZODIAC_WORLD_SIZE / 2,
          top: y - CREATURE_SIZE * 0.63 - (ZODIAC_WORLD_SIZE - CREATURE_SIZE),
          width: ZODIAC_WORLD_SIZE,
        },
      ]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, animatedStyle]}>
        <SeamlessWorldImage source={source} priority="normal" onReady={markReady} onFailure={markReady} />
      </Animated.View>
    </Pressable>
  );
});

const ResidentStatusGlyph = memo(function ResidentStatusGlyph({ status }: { status: KingdomResidentStatusGlyph }) {
  return (
    <View pointerEvents="none" style={styles.statusGlyphWrap}>
      <View style={[styles.statusGlyph, status === 'active' ? styles.statusGlyphActive : styles.statusGlyphReady]}>
        <Text style={styles.statusGlyphText}>{status === 'offer' ? '!' : '?'}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  scene: { position: 'relative' },
  tileArt: { position: 'absolute' },
  eggLayer: { height: EGG_WORLD_H, position: 'absolute', width: EGG_WORLD_W },
  creature: { position: 'absolute' },
  homeTileHitTarget: { height: 84, position: 'absolute', width: 108 },
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
});
