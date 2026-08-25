import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Fragment, memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, LayoutChangeEvent, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CreatureGroundShadow } from '@/components/katchadeck/creature-ground-shadow';
import { HavenUpgradeEffects } from '@/components/katchadeck/world/haven-upgrade-effects';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { KingdomTileArtLayer, KingdomTileRender } from '@/components/katchadeck/world/kingdom-hex-scene';
import { buildKingdomHexScene } from '@/components/katchadeck/world/kingdom-hex-scene';
import { SeamlessWorldImage } from '@/components/katchadeck/world/seamless-world-image';
import { useKingdomHexCamera } from '@/components/katchadeck/world/use-kingdom-hex-camera';
import { useKingdomLodScheduler } from '@/components/katchadeck/world/use-kingdom-lod-scheduler';
import { useKingdomTileScheduler } from '@/components/katchadeck/world/use-kingdom-tile-scheduler';
import { KINGDOM_RENDERING } from '@/constants/kingdom-rendering';
import kingdomWorldViewConfig from '@/constants/kingdom-world-view.json';
import { Lantern } from '@/constants/theme';
import type { EggVisualState } from '@/types/home';
import type { FtueCameraDirective } from '@/features/onboarding/ftue-types';
import type { WorldIdentityState } from '@/types/world-identity';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import { homePreset } from '@/utils/world-identity';
import { HEX_TILE_H, HEX_TILE_W, hexDrawDepth } from '@/utils/world-hex';
import {
  kingdomWorldViewPoint,
  screenPointToWorld,
  type KingdomResidentLod,
} from '@/utils/kingdom-rendering';
import type { KingdomTilePhase } from '@/utils/kingdom-tile-scheduler';
import { getDevKingdomHexVerticalAlignmentMode } from '@/utils/dev-asset-overrides';
import type { KingdomHexCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import {
  HAVEN_UPGRADE_REDUCED_TIMING,
  HAVEN_UPGRADE_TIMING,
  type HavenTileUpgradePresentation,
  type HavenUpgradePresentationPhase,
} from '@/utils/haven-upgrade-presentation';
import { useScenePerformanceProbe } from '@/hooks/use-scene-performance-probe';
import {
  kingdomHexTileSet,
  kingdomHexTileOverlaySourceForLod,
  kingdomHexTileSourceForLod,
  worldAssetSource,
  type KingdomHexTileLod,
} from '@/utils/world-visuals';

export type KingdomHexCenterRef = () => { col: number; row: number; plotId: string | null } | null;
export type KingdomResidentStatusGlyph = 'offer' | 'active' | 'ready';
export type KingdomResidentScreenAnchor = {
  characterId: string;
  creatureId: string;
  x: number;
  y: number;
};

type Props = {
  background: TodayAtmosphereBackground;
  companionSlots: KingdomHexCompanionSlot[];
  identity?: WorldIdentityState | null;
  eggVisual?: EggVisualState | null;
  lanternColor?: string;
  interactionEnabled?: boolean;
  allowedResidentCharacterId?: string | null;
  tutorialCamera?: FtueCameraDirective | null;
  onResidentAnchorsChange?: (anchors: KingdomResidentScreenAnchor[]) => void;
  residentStatusGlyphs?: Partial<Record<string, KingdomResidentStatusGlyph>>;
  recenterBottom?: number;
  onSelectLocked?: () => void;
  onSelectResident?: (creatureId: string, label: string) => void;
  onSelectHome?: () => void;
  onUpgradePresentationComplete?: (presentation: HavenTileUpgradePresentation) => void;
  upgradePresentation?: HavenTileUpgradePresentation | null;
};

const CREATURE_SIZE = 58;
const CREATURE_WORLD_SCALE = kingdomWorldViewConfig.katchimera.globalScale;
const EGG_STAGE_W = 200;
const EGG_STAGE_H = 258;
const EGG_WORLD_SCALE = kingdomWorldViewConfig.egg.globalScale;
const EGG_WORLD_W = EGG_STAGE_W * EGG_WORLD_SCALE;
const EGG_WORLD_H = EGG_STAGE_H * EGG_WORLD_SCALE;
const KINGDOM_EGG_SOURCE = require('../../../assets/images/katchimeras/cutouts/egg-base.webp');
const KINGDOM_DREAM_MIST_LOCK_SOURCES: Record<KingdomResidentLod, ImageSourcePropType> = {
  thumb: require('../../../assets/images/katchimeras/world/hex/kingdom_dream_mist_lock_v1_256.webp'),
  medium: require('../../../assets/images/katchimeras/world/hex/kingdom_dream_mist_lock_v1_512.webp'),
};
const TILE_WORLD_LOD_WIDTH = HEX_TILE_W * 1.03;
const LOCKED_TILE_HIT_WIDTH = HEX_TILE_W * 0.62;
const LOCKED_TILE_HIT_HEIGHT = HEX_TILE_H * 0.78;
const LOCKED_TILE_LOCK_SIZE = 104;

export const KingdomHexCanvas = memo(function KingdomHexCanvas({
  background,
  companionSlots,
  identity,
  eggVisual,
  interactionEnabled = true,
  allowedResidentCharacterId,
  tutorialCamera,
  onResidentAnchorsChange,
  recenterBottom = 126,
  residentStatusGlyphs,
  onSelectLocked,
  onSelectResident,
  onSelectHome,
  onUpgradePresentationComplete,
  upgradePresentation,
}: Props) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [assetRevision, setAssetRevision] = useState(0);
  const [upgradePhase, setUpgradePhase] = useState<HavenUpgradePresentationPhase>('armed');
  const reduceMotion = useReducedMotion();

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
    () => buildKingdomHexScene(companionSlots, hexTileSelection.value, identity, verticalAlignmentSelection.value),
    [companionSlots, hexTileSelection, identity, verticalAlignmentSelection]
  );
  const presentation = hexTileSelection.value.presentation;
  const creatureWorldSize = CREATURE_SIZE * (presentation?.residentScale ?? CREATURE_WORLD_SCALE);
  const focusTargets = useMemo(
    () => scene.tiles.map((tile) => ({ id: tile.id, x: tile.cx, y: tile.cy })),
    [scene.tiles]
  );
  const upgradeLayers = useMemo(() => {
    if (!upgradePresentation) return null;
    const slotsAtStage = (stage: HavenTileUpgradePresentation['fromStage']) => companionSlots.map((slot) => (
      slot.kind === 'owned' && slot.familyId === upgradePresentation.characterId
        ? { ...slot, havenStage: stage }
        : slot
    ));
    const fromScene = buildKingdomHexScene(
      slotsAtStage(upgradePresentation.fromStage),
      hexTileSelection.value,
      identity,
      verticalAlignmentSelection.value,
    );
    const toScene = buildKingdomHexScene(
      slotsAtStage(upgradePresentation.toStage),
      hexTileSelection.value,
      identity,
      verticalAlignmentSelection.value,
    );
    const fromLayer = fromScene.tileArtLayers.find((layer) => layer.id === `family:${upgradePresentation.characterId}`);
    const toLayer = toScene.tileArtLayers.find((layer) => layer.id === `family:${upgradePresentation.characterId}`);
    const tile = toScene.tiles.find((candidate) => candidate.id === `family:${upgradePresentation.characterId}`);
    return fromLayer && toLayer && tile ? { fromLayer, tile, toLayer } : null;
  }, [companionSlots, hexTileSelection, identity, upgradePresentation, verticalAlignmentSelection]);
  const camera = useKingdomHexCamera({
    center: { x: scene.centerTile.cx, y: scene.centerTile.cy },
    centerId: scene.centerTile.id,
    interactionEnabled: interactionEnabled && !upgradePresentation,
    magneticFocus: presentation?.focusMode === 'magnetic'
      ? {
          anchorY: presentation.snapAnchorY,
          durationMs: presentation.snapDurationMs,
          enabled: !upgradePresentation,
          reducedMotion: reduceMotion,
          targets: focusTargets,
        }
      : undefined,
    residentWorldSize: creatureWorldSize,
    scene,
    tileWorldWidth: TILE_WORLD_LOD_WIDTH,
    viewport,
  });
  const tutorialCameraKey = tutorialCamera ? JSON.stringify(tutorialCamera) : 'none';
  const appliedTutorialCameraRef = useRef('none');
  const fitTutorialWorld = camera.fitWorld;
  const focusTutorialResident = camera.focusResident;
  const tutorialCameraReady = camera.ready;
  useEffect(() => {
    if (!tutorialCamera) {
      appliedTutorialCameraRef.current = 'none';
      return;
    }
    if (!tutorialCameraReady || appliedTutorialCameraRef.current === tutorialCameraKey) return;
    appliedTutorialCameraRef.current = tutorialCameraKey;
    if (tutorialCamera.kind === 'fit_targets') {
      fitTutorialWorld(tutorialCamera.durationMs);
      return;
    }
    if (tutorialCamera.target.kind !== 'haven_tile') return;
    const targetCharacterId = tutorialCamera.target.characterId;
    const tile = scene.tiles.find((candidate) => (
      candidate.kind === 'companion'
      && candidate.companion?.kind === 'owned'
      && candidate.companion.familyId === targetCharacterId
    ));
    if (!tile) return;
    focusTutorialResident(tile.cx, tile.cy, {
      anchorY: tutorialCamera.anchorY,
      durationMs: tutorialCamera.durationMs,
      zoom: tutorialCamera.zoom,
    });
  }, [fitTutorialWorld, focusTutorialResident, scene.tiles, tutorialCamera, tutorialCameraKey, tutorialCameraReady]);
  const upgradeCompletionRef = useRef(onUpgradePresentationComplete);
  const upgradeFocusRef = useRef(camera.focusUpgrade);
  const upgradeLayersRef = useRef(upgradeLayers);
  const upgradePresentationRef = useRef(upgradePresentation);
  const reduceMotionRef = useRef(reduceMotion);
  useEffect(() => {
    upgradeCompletionRef.current = onUpgradePresentationComplete;
    upgradeFocusRef.current = camera.focusUpgrade;
    upgradeLayersRef.current = upgradeLayers;
    upgradePresentationRef.current = upgradePresentation;
    reduceMotionRef.current = reduceMotion;
  }, [camera.focusUpgrade, onUpgradePresentationComplete, reduceMotion, upgradeLayers, upgradePresentation]);

  useEffect(() => {
    const presentation = upgradePresentationRef.current;
    const layers = upgradeLayersRef.current;
    const motionReduced = reduceMotionRef.current;
    if (!presentation) {
      setUpgradePhase('armed');
      return;
    }
    if (presentation.status !== 'playing' || !layers) {
      setUpgradePhase('armed');
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = (callback: () => void, delay: number) => {
      timers.push(setTimeout(() => {
        if (!cancelled) callback();
      }, delay));
    };
    const finish = () => {
      setUpgradePhase('complete');
      void AccessibilityInfo.announceForAccessibility(
        `${presentation.creatureName}'s ${presentation.upgradeName} restored`,
      );
      upgradeCompletionRef.current?.(presentation);
    };
    const afterFocus = () => {
      if (cancelled) return;
      if (motionReduced) {
        setUpgradePhase('focus');
        schedule(() => setUpgradePhase('reveal'), HAVEN_UPGRADE_REDUCED_TIMING.revealAtMs);
        schedule(() => setUpgradePhase('react'), HAVEN_UPGRADE_REDUCED_TIMING.reactAtMs);
        schedule(finish, HAVEN_UPGRADE_REDUCED_TIMING.completeAtMs);
        return;
      }
      setUpgradePhase('payment');
      schedule(() => {
        setUpgradePhase('cover');
        if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, HAVEN_UPGRADE_TIMING.coverAtMs);
      schedule(() => setUpgradePhase('reveal'), HAVEN_UPGRADE_TIMING.revealAtMs);
      schedule(() => {
        setUpgradePhase('react');
        if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, HAVEN_UPGRADE_TIMING.reactAtMs);
      schedule(finish, HAVEN_UPGRADE_TIMING.completeAtMs);
    };

    setUpgradePhase('focus');
    upgradeFocusRef.current(layers.tile.cx, layers.tile.cy, motionReduced, afterFocus);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [upgradePresentation?.nonce, upgradePresentation?.status]);

  const cameraSnapshot = camera.snapshot;
  const upgradeEffectGeometry = useMemo(() => {
    if (!upgradeLayers) return null;
    const screenFrame = (layer: KingdomTileArtLayer) => ({
      height: layer.frame.height * cameraSnapshot.scale,
      left: scene.width / 2 + cameraSnapshot.tx + (layer.frame.left - scene.width / 2) * cameraSnapshot.scale,
      top: scene.height / 2 + cameraSnapshot.ty + (layer.frame.top - scene.height / 2) * cameraSnapshot.scale,
      width: layer.frame.width * cameraSnapshot.scale,
    });
    const visibleFrame = (layer: KingdomTileArtLayer) => {
      const frame = screenFrame(layer);
      return {
        left: frame.left + (layer.alphaBounds.left / 1024) * frame.width,
        top: frame.top + (layer.alphaBounds.top / 1024) * frame.height,
        right: frame.left + (layer.alphaBounds.right / 1024) * frame.width,
        bottom: frame.top + (layer.alphaBounds.bottom / 1024) * frame.height,
      };
    };
    const fromVisible = visibleFrame(upgradeLayers.fromLayer);
    const toVisible = visibleFrame(upgradeLayers.toLayer);
    const left = Math.min(fromVisible.left, toVisible.left);
    const top = Math.min(fromVisible.top, toVisible.top);
    const right = Math.max(fromVisible.right, toVisible.right);
    const bottom = Math.max(fromVisible.bottom, toVisible.bottom);
    return {
      area: { height: bottom - top, left, top, width: right - left },
      silhouetteFrame: screenFrame(upgradeLayers.toLayer),
      target: {
        x: scene.width / 2 + cameraSnapshot.tx + (upgradeLayers.tile.cx - scene.width / 2) * cameraSnapshot.scale,
        y: scene.height / 2 + cameraSnapshot.ty + (upgradeLayers.tile.cy - scene.height / 2) * cameraSnapshot.scale,
      },
    };
  }, [cameraSnapshot, scene.height, scene.width, upgradeLayers]);
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
  const artLayerById = useMemo(
    () => new Map(scene.tileArtLayers.map((layer) => [layer.id, layer])),
    [scene.tileArtLayers]
  );
  const tileFocusScale = useCallback((tileId: string) => {
    if (!presentation || presentation.focusMode !== 'magnetic' || camera.isMoving || !camera.focusedTileId) return 1;
    if (tileId === camera.focusedTileId) return reduceMotion ? 1.04 : presentation.focusedScale;
    return presentation.unfocusedScale;
  }, [camera.focusedTileId, camera.isMoving, presentation, reduceMotion]);
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
  const ignoreFocus = useCallback((_x: number, _y: number) => undefined, []);
  const residentAnchorsCallbackRef = useRef(onResidentAnchorsChange);
  useEffect(() => {
    residentAnchorsCallbackRef.current = onResidentAnchorsChange;
  }, [onResidentAnchorsChange]);
  useEffect(() => {
    const callback = residentAnchorsCallbackRef.current;
    if (!callback) return;
    if (!camera.ready || camera.isMoving || upgradePresentation || viewport.width <= 0 || viewport.height <= 0) {
      callback([]);
      return;
    }
    const anchors = scene.tiles.flatMap((tile): KingdomResidentScreenAnchor[] => {
      if (tile.kind !== 'companion' || tile.companion?.kind !== 'owned') return [];
      const residentAnchor = artLayerById.get(tile.id)?.residentAnchor ?? { x: tile.cx, y: tile.cy };
      const focusScale = tileFocusScale(tile.id);
      const focusedX = tile.cx + (residentAnchor.x - tile.cx) * focusScale;
      const focusedY = tile.cy + (residentAnchor.y - HEX_TILE_H * 0.42 - tile.cy) * focusScale;
      const x = scene.width / 2 + camera.snapshot.tx + (focusedX - scene.width / 2) * camera.snapshot.scale;
      const y = scene.height / 2 + camera.snapshot.ty + (focusedY - scene.height / 2) * camera.snapshot.scale;
      if (x < -100 || x > viewport.width + 100 || y < -100 || y > viewport.height + 100) return [];
      return [{ characterId: tile.companion.familyId, creatureId: tile.companion.creature.creatureId, x, y }];
    });
    callback(anchors);
  }, [artLayerById, camera.isMoving, camera.ready, camera.snapshot, scene.height, scene.tiles, scene.width, tileFocusScale, upgradePresentation, viewport.height, viewport.width]);

  const creatureNodes = useMemo(() => {
    const items: { depth: number; node: ReactNode }[] = [];
    for (const tile of scene.tiles) {
      if (tile.kind !== 'companion' || !tile.companion || !scheduler.readyTileIds.has(tile.id)) continue;
      const runtime = runtimeById.get(tile.id);
      if (!runtime || (!scheduler.visibleTileIds.has(tile.id) && runtime.phase !== 'exiting')) continue;
      const artLayer = artLayerById.get(tile.id);
      const focusScale = tileFocusScale(tile.id);
      if (tile.companion.kind === 'locked') {
        items.push({
          depth: tile.depth + 3,
          node: (
            <LockedCompanionTile
              key={`locked-${tile.id}`}
              lod={camera.residentLod}
              focusAnchorX={tile.cx}
              focusAnchorY={tile.cy}
              focusScale={focusScale}
              focusId={tile.id}
              onFocus={interactionEnabled ? camera.focusResident : ignoreFocus}
              onSelectLocked={interactionEnabled ? onSelectLocked : undefined}
              phase={runtime.phase}
              settled={!camera.isMoving}
              x={tile.cx}
              y={tile.cy}
            />
          ),
        });
        continue;
      }
      const { x, y } = artLayer?.residentAnchor ?? kingdomWorldViewPoint(
        { x: tile.cx, y: tile.cy },
        kingdomWorldViewConfig.katchimera
      );
      const residentInteractionEnabled = interactionEnabled || allowedResidentCharacterId === tile.companion.familyId;
      items.push({
        depth: hexDrawDepth({ x, y }, 4),
        node: (
          <ResidentCreature
            celebrationNonce={
              upgradePresentation?.creatureId === tile.companion.creature.creatureId
              && (upgradePhase === 'react' || upgradePhase === 'complete')
                ? upgradePresentation.nonce
                : undefined
            }
            disabled={!residentInteractionEnabled}
            focusAnchorX={tile.cx}
            focusAnchorY={tile.cy}
            focusScale={focusScale}
            key={`creature-${tile.id}`}
            tile={tile}
            x={x}
            y={y}
            lod={camera.residentLod}
            phase={runtime.phase}
            settled={!camera.isMoving}
            statusGlyph={residentStatusGlyphs?.[tile.companion.creature.creatureId] === 'ready' ? undefined : residentStatusGlyphs?.[tile.companion.creature.creatureId]}
            worldSize={creatureWorldSize}
            onFocus={residentInteractionEnabled ? camera.focusResident : ignoreFocus}
            onSelectResident={residentInteractionEnabled ? onSelectResident : undefined}
          />
        ),
      });
    }

    return items.sort((a, b) => a.depth - b.depth).map((item) => item.node);
  }, [allowedResidentCharacterId, artLayerById, camera.focusResident, camera.isMoving, camera.residentLod, creatureWorldSize, ignoreFocus, interactionEnabled, onSelectLocked, onSelectResident, residentStatusGlyphs, runtimeById, scene.tiles, scheduler.readyTileIds, scheduler.visibleTileIds, tileFocusScale, upgradePhase, upgradePresentation]);

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
        cachePolicy="disk"
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
              const overlaySource = kingdomHexTileOverlaySourceForLod(layer, lod);
              const fallbackSource = layer.fallbackSource
                ? kingdomHexTileSourceForLod(
                    { source: layer.fallbackSource, sources: layer.fallbackSources },
                    lod
                  )
                : null;
              return (
                <Fragment key={`tile-stack-${layer.id}`}>
                  <KingdomTileArt
                    focusAnchorX={scene.tileById.get(layer.id)?.cx ?? layer.frame.left + layer.frame.width / 2}
                    focusAnchorY={scene.tileById.get(layer.id)?.cy ?? layer.frame.top + layer.frame.height / 2}
                    focusScale={tileFocusScale(layer.id)}
                    id={layer.id}
                    frame={layer.frame}
                    lod={lod}
                    source={source}
                    overlaySource={overlaySource}
                    fallbackSource={fallbackSource}
                    phase={runtime.phase}
                    priority={lod === 'full' || layer.id === scene.centerTile.id ? 'high' : scheduler.visibleTileIds.has(layer.id) ? 'normal' : 'low'}
                    settled={!camera.isMoving}
                    onExited={scheduler.markExited}
                    onFailed={scheduler.markFailed}
                    onLoaded={scheduler.markLoaded}
                    onLodReady={lodScheduler.markReady}
                  />
                  {upgradeLayers && upgradePresentation && layer.id === upgradeLayers.tile.id ? (
                    <HavenUpgradeTileArt
                      fromLayer={upgradeLayers.fromLayer}
                      phase={upgradePhase}
                      reducedMotion={reduceMotion}
                      toLayer={upgradeLayers.toLayer}
                    />
                  ) : null}
                </Fragment>
              );
            })}
            {showEgg && centerRuntime ? (
              <KingdomEgg
                {...kingdomWorldViewPoint(
                  { x: scene.centerTile.cx, y: scene.centerTile.cy },
                  kingdomWorldViewConfig.egg
                )}
                focusAnchorX={scene.centerTile.cx}
                focusAnchorY={scene.centerTile.cy}
                focusScale={tileFocusScale(scene.centerTile.id)}
                phase={centerRuntime.phase}
                settled={!camera.isMoving}
                onPress={interactionEnabled ? camera.recenter : undefined}
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
      {!upgradePresentation && interactionEnabled ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Recenter kingdom" onPress={camera.recenter} style={[styles.recenter, { bottom: recenterBottom }]}>
          <IconSymbol name="scope" size={22} color={Lantern.moon50} />
        </Pressable>
      ) : null}
      {upgradePresentation && upgradeEffectGeometry && upgradeLayers ? (
        <HavenUpgradeEffects
          area={upgradeEffectGeometry.area}
          phase={upgradePhase}
          presentation={upgradePresentation}
          reducedMotion={reduceMotion}
          silhouetteFrame={upgradeEffectGeometry.silhouetteFrame}
          silhouetteSource={kingdomHexTileSourceForLod(upgradeLayers.toLayer, 'medium')}
          target={upgradeEffectGeometry.target}
        />
      ) : null}
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

type AbsoluteFrame = { height: number; left: number; top: number; width: number };

const TileFocusTransform = memo(function TileFocusTransform({
  anchorX,
  anchorY,
  children,
  frame,
  scale: targetScale,
}: {
  anchorX: number;
  anchorY: number;
  children: ReactNode;
  frame: AbsoluteFrame;
  scale: number;
}) {
  const reduceMotion = useReducedMotion();
  const localScale = useSharedValue(1);
  useEffect(() => {
    localScale.value = withTiming(targetScale, {
      duration: reduceMotion ? 0 : 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [localScale, reduceMotion, targetScale]);
  const anchorDx = anchorX - (frame.left + frame.width / 2);
  const anchorDy = anchorY - (frame.top + frame.height / 2);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -anchorDx },
      { translateY: -anchorDy },
      { scale: localScale.value },
      { translateX: anchorDx },
      { translateY: anchorDy },
    ],
  }));
  return (
    <Animated.View pointerEvents="box-none" style={[styles.focusLayer, frame, animatedStyle]}>
      {children}
    </Animated.View>
  );
});

type TileArtProps = {
  fallbackSource: ImageSourcePropType | null;
  focusAnchorX: number;
  focusAnchorY: number;
  focusScale: number;
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
  overlaySource: ImageSourcePropType | null;
};

const KingdomTileArt = memo(function KingdomTileArt({
  fallbackSource,
  focusAnchorX,
  focusAnchorY,
  focusScale,
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
  overlaySource,
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
    <TileFocusTransform anchorX={focusAnchorX} anchorY={focusAnchorY} frame={frame} scale={focusScale}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, animatedStyle]}>
        <SeamlessWorldImage
          allowDownscaling={lod !== 'full'}
          source={source}
          fallbackSource={fallbackSource}
          priority={priority}
          onReady={handleLoaded}
          onFailure={handleFailed}
        />
        {overlaySource ? (
          <SeamlessWorldImage
            allowDownscaling={lod !== 'full'}
            source={overlaySource}
            priority={priority}
          />
        ) : null}
      </Animated.View>
    </TileFocusTransform>
  );
});

const HavenUpgradeTileArt = memo(function HavenUpgradeTileArt({
  fromLayer,
  phase,
  reducedMotion,
  toLayer,
}: {
  fromLayer: KingdomTileArtLayer;
  phase: HavenUpgradePresentationPhase;
  reducedMotion: boolean;
  toLayer: KingdomTileArtLayer;
}) {
  const oldOpacity = useSharedValue(1);
  const newOpacity = useSharedValue(0);

  useEffect(() => {
    if (phase !== 'reveal' && phase !== 'react' && phase !== 'complete') return;
    const timing = { duration: reducedMotion ? 180 : 480, easing: Easing.inOut(Easing.cubic) };
    oldOpacity.value = withTiming(0, timing);
    newOpacity.value = withTiming(1, timing);
  }, [newOpacity, oldOpacity, phase, reducedMotion]);

  const oldStyle = useAnimatedStyle(() => ({ opacity: oldOpacity.value }));
  const newStyle = useAnimatedStyle(() => ({ opacity: newOpacity.value }));
  const oldSource = kingdomHexTileSourceForLod(fromLayer, 'medium');
  const newSource = kingdomHexTileSourceForLod(toLayer, 'medium');
  const oldOverlaySource = kingdomHexTileOverlaySourceForLod(fromLayer, 'medium');
  const newOverlaySource = kingdomHexTileOverlaySourceForLod(toLayer, 'medium');

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.tileArt, fromLayer.frame, oldStyle]}>
        <SeamlessWorldImage priority="high" source={oldSource} />
        {oldOverlaySource ? <SeamlessWorldImage priority="high" source={oldOverlaySource} /> : null}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.tileArt, toLayer.frame, newStyle]}>
        <SeamlessWorldImage priority="high" source={newSource} />
        {newOverlaySource ? <SeamlessWorldImage priority="high" source={newOverlaySource} /> : null}
      </Animated.View>
    </>
  );
});

const KingdomEgg = memo(function KingdomEgg({
  x,
  y,
  focusAnchorX,
  focusAnchorY,
  focusScale,
  phase,
  settled,
  onPress,
}: {
  x: number;
  y: number;
  focusAnchorX: number;
  focusAnchorY: number;
  focusScale: number;
  phase: KingdomTilePhase;
  settled: boolean;
  onPress?: () => void;
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
  const frame = { height: EGG_WORLD_H, left: x - EGG_WORLD_W / 2, top: y - EGG_WORLD_H / 2, width: EGG_WORLD_W };

  return (
    <TileFocusTransform anchorX={focusAnchorX} anchorY={focusAnchorY} frame={frame} scale={focusScale}>
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Kingdom egg" onPress={onPress} style={StyleSheet.absoluteFill}>
          <SeamlessWorldImage source={KINGDOM_EGG_SOURCE} priority="high" onReady={markReady} onFailure={markReady} />
        </Pressable>
      </Animated.View>
    </TileFocusTransform>
  );
});

const LockedCompanionTile = memo(function LockedCompanionTile({
  lod,
  focusAnchorX,
  focusAnchorY,
  focusId,
  focusScale,
  onFocus,
  onSelectLocked,
  phase,
  settled,
  x,
  y,
}: {
  lod: KingdomResidentLod;
  focusAnchorX: number;
  focusAnchorY: number;
  focusId: string;
  focusScale: number;
  onFocus: (x: number, y: number, options?: { id?: string }) => void;
  onSelectLocked?: () => void;
  phase: KingdomTilePhase;
  settled: boolean;
  x: number;
  y: number;
}) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const lift = useSharedValue(10);
  const pulse = useSharedValue(1);
  const shownRef = useRef(false);

  useEffect(() => {
    if (phase === 'exiting') {
      opacity.value = withTiming(0, { duration: KINGDOM_RENDERING.exitDurationMs });
      lift.value = withTiming(6, { duration: KINGDOM_RENDERING.exitDurationMs });
      return;
    }
    if (!shownRef.current && !settled) return;
    shownRef.current = true;
    opacity.value = withTiming(1, { duration: reduceMotion ? 80 : 180, easing: Easing.out(Easing.cubic) });
    lift.value = reduceMotion ? withTiming(0, { duration: 80 }) : withSpring(0, { damping: 14, stiffness: 210 });
  }, [lift, opacity, phase, reduceMotion, settled]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: lift.value }, { scale: pulse.value }],
  }));
  const handlePress = useCallback(() => {
    onFocus(x, y, { id: focusId });
    if (!reduceMotion) {
      pulse.value = withSequence(
        withTiming(1.12, { duration: 110, easing: Easing.out(Easing.cubic) }),
        withSpring(1, { damping: 12, stiffness: 240 }),
      );
    }
    onSelectLocked?.();
  }, [focusId, onFocus, onSelectLocked, pulse, reduceMotion, x, y]);
  const frame = {
    height: LOCKED_TILE_HIT_HEIGHT,
    left: x - LOCKED_TILE_HIT_WIDTH / 2,
    top: y - LOCKED_TILE_HIT_HEIGHT / 2,
    width: LOCKED_TILE_HIT_WIDTH,
  };

  return (
    <TileFocusTransform anchorX={focusAnchorX} anchorY={focusAnchorY} frame={frame} scale={focusScale}>
      <Pressable
        accessibilityHint="Shows how to discover another Katchimera"
        accessibilityLabel="Undiscovered Katchimera, hidden in the Dream Mist"
        accessibilityRole="button"
        onPress={handlePress}
        style={[styles.lockedTileHitTarget, StyleSheet.absoluteFill]}>
        <Animated.View pointerEvents="none" style={[styles.lockedTileLockWrap, animatedStyle]}>
          <Image
            accessibilityIgnoresInvertColors
            cachePolicy="memory-disk"
            contentFit="contain"
            source={KINGDOM_DREAM_MIST_LOCK_SOURCES[lod]}
            style={styles.lockedTileLock}
          />
        </Animated.View>
      </Pressable>
    </TileFocusTransform>
  );
});

type ResidentProps = {
  celebrationNonce?: number;
  disabled?: boolean;
  focusAnchorX: number;
  focusAnchorY: number;
  focusScale: number;
  lod: KingdomResidentLod;
  onFocus: (x: number, y: number, options?: { id?: string }) => void;
  onSelectResident?: (creatureId: string, label: string) => void;
  phase: KingdomTilePhase;
  settled: boolean;
  statusGlyph?: KingdomResidentStatusGlyph;
  tile: KingdomTileRender;
  worldSize: number;
  x: number;
  y: number;
};

const ResidentCreature = memo(function ResidentCreature({
  celebrationNonce,
  disabled,
  focusAnchorX,
  focusAnchorY,
  focusScale,
  lod,
  onFocus,
  onSelectResident,
  phase,
  settled,
  statusGlyph,
  tile,
  worldSize,
  x,
  y,
}: ResidentProps) {
  const creature = tile.companion?.kind === 'owned' ? tile.companion.creature : null;
  const source = creature ? worldAssetSource(`creature:${creature.visualKey}`, lod) : null;
  const [ready, setReady] = useState(false);
  const opacity = useSharedValue(0);
  const lift = useSharedValue(12);
  const reactionLift = useSharedValue(0);
  const reactionRotation = useSharedValue(0);
  const reactionScale = useSharedValue(1);
  const shownRef = useRef(false);
  const reduceMotion = useReducedMotion();

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

  useEffect(() => {
    if (celebrationNonce === undefined || reduceMotion) return;
    reactionLift.value = withSequence(
      withTiming(-10, { duration: 130, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 230, easing: Easing.out(Easing.cubic) }),
    );
    reactionRotation.value = withSequence(
      withTiming(-5, { duration: 90 }),
      withTiming(6, { duration: 110 }),
      withTiming(-3, { duration: 90 }),
      withTiming(0, { duration: 120 }),
    );
    reactionScale.value = withSequence(
      withTiming(1.14, { duration: 150, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 12, stiffness: 180 }),
    );
  }, [celebrationNonce, reactionLift, reactionRotation, reactionScale, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: lift.value + reactionLift.value },
      { rotateZ: `${reactionRotation.value}deg` },
      { scale: reactionScale.value },
    ],
  }));
  const handlePress = useCallback(() => {
    if (!creature) return;
    onFocus(x, y, { id: tile.id });
    onSelectResident?.(creature.creatureId, creature.name);
  }, [creature, onFocus, onSelectResident, tile.id, x, y]);
  const markReady = useCallback(() => setReady(true), []);
  const frame = {
    height: worldSize,
    left: x - worldSize / 2,
    top: y - CREATURE_SIZE * 0.63 - (worldSize - CREATURE_SIZE),
    width: worldSize,
  };

  return (
    <TileFocusTransform anchorX={focusAnchorX} anchorY={focusAnchorY} frame={frame} scale={focusScale}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={creature?.name}
        disabled={disabled}
        onPress={handlePress}
        style={StyleSheet.absoluteFill}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, animatedStyle]}>
          {creature ? (
            <CreatureGroundShadow
              frameSize={worldSize}
              visualKey={creature.visualKey}
            />
          ) : null}
          {source ? <SeamlessWorldImage source={source} priority="normal" onReady={markReady} onFailure={markReady} /> : null}
          {statusGlyph ? <ResidentStatusGlyph status={statusGlyph} /> : null}
        </Animated.View>
      </Pressable>
    </TileFocusTransform>
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
  focusLayer: { position: 'absolute' },
  tileArt: { position: 'absolute' },
  eggLayer: { height: EGG_WORLD_H, position: 'absolute', width: EGG_WORLD_W },
  creature: { position: 'absolute' },
  lockedTileHitTarget: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  lockedTileLockWrap: {
    height: LOCKED_TILE_LOCK_SIZE,
    width: LOCKED_TILE_LOCK_SIZE,
  },
  lockedTileLock: { height: '100%', width: '100%' },
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
    height: 46,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    width: 46,
  },
});
