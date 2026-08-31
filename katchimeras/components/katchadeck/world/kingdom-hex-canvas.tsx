import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Fragment, memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, LayoutChangeEvent, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';

import { CreatureGroundShadow } from '@/components/katchadeck/creature-ground-shadow';
import { EggAvatarArtwork } from '@/components/katchadeck/egg-avatar/egg-avatar-artwork';
import { FrozenMergeOrderTrayCard, type MergeOrderTrayEntry } from '@/components/katchadeck/games/merge-order-rail';
import { HavenUpgradeEffects } from '@/components/katchadeck/world/haven-upgrade-effects';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { KingdomTileArtLayer, KingdomTileRender } from '@/components/katchadeck/world/kingdom-hex-scene';
import { buildKingdomHexScene } from '@/components/katchadeck/world/kingdom-hex-scene';
import { buildMossproutSquareScene } from '@/components/katchadeck/world/mossprout-square-scene';
import { SeamlessWorldImage } from '@/components/katchadeck/world/seamless-world-image';
import { useKingdomHexCamera } from '@/components/katchadeck/world/use-kingdom-hex-camera';
import { KINGDOM_RENDERING } from '@/constants/kingdom-rendering';
import { mossproutNatureIslandById } from '@/constants/mossprout-nature-islands';
import kingdomWorldViewConfig from '@/constants/kingdom-world-view.json';
import { Lantern } from '@/constants/theme';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import type { EggVisualState } from '@/types/home';
import type { MossproutNatureIslandId, MossproutNatureIslandLevel } from '@/types/merge-world';
import type { FtueCameraDirective } from '@/features/onboarding/ftue-types';
import type { WorldIdentityState } from '@/types/world-identity';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import { homePreset } from '@/utils/world-identity';
import { HEX_TILE_H, HEX_TILE_W, hexDrawDepth } from '@/utils/world-hex';
import {
  type KingdomCameraSnapshot,
  kingdomWorldViewPoint,
} from '@/utils/kingdom-rendering';
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
  playerHavenHexTileSet,
  kingdomHexTileOverlaySourceForLod,
  kingdomHexTileSourceForLod,
  worldAssetSource,
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
  onSelectLocked?: (familyId: string) => void;
  onSelectResident?: (creatureId: string, label: string) => void;
  onSelectHome?: () => void;
  onUpgradePresentationComplete?: (presentation: HavenTileUpgradePresentation) => void;
  upgradePresentation?: HavenTileUpgradePresentation | null;
  highlightedLockedFamilyId?: string | null;
  discoveryRevealFamilyId?: string | null;
  gardenOrders?: readonly MergeOrderTrayEntry[];
  initialCameraSnapshot?: KingdomCameraSnapshot | null;
  onCameraSnapshotChange?: (snapshot: KingdomCameraSnapshot) => void;
  onOpenGarden?: (orderId?: string | null) => void;
  interactionResidentId?: string | null;
  onResidentFocusComplete?: (creatureId: string) => void;
  squareWorld?: boolean;
  mossproutNatureIslandLevels?: Record<MossproutNatureIslandId, MossproutNatureIslandLevel>;
  onSelectNatureIsland?: (islandId: MossproutNatureIslandId) => void;
};

const CREATURE_SIZE = 58;
const CREATURE_WORLD_SCALE = kingdomWorldViewConfig.katchimera.globalScale;
const EGG_STAGE_W = 200;
const EGG_STAGE_H = 258;
const HAVEN_HOME_EGG_AVATAR_SCALE = 1.2;
const EGG_WORLD_SCALE = kingdomWorldViewConfig.egg.globalScale * HAVEN_HOME_EGG_AVATAR_SCALE;
const EGG_WORLD_W = EGG_STAGE_W * EGG_WORLD_SCALE;
const EGG_WORLD_H = EGG_STAGE_H * EGG_WORLD_SCALE;
const KINGDOM_DREAM_MIST_LOCK_SOURCE = require('../../../assets/images/katchimeras/world/hex/kingdom_dream_mist_lock_v1_512.webp');
const LOCKED_TILE_HIT_WIDTH = HEX_TILE_W * 0.62;
const LOCKED_TILE_HIT_HEIGHT = HEX_TILE_H * 0.78;
const LOCKED_TILE_LOCK_SIZE = 104;
const GARDEN_ORDER_SLOT_CENTERS = [
  { x: 0.27, y: 0.205 },
  { x: 0.5, y: 0.185 },
  { x: 0.73, y: 0.205 },
] as const;
const GARDEN_ORDER_CARD_WIDTH = 120;
const GARDEN_ORDER_CARD_HEIGHT = 120;

function GardenOrderShortcut({ entry, frame, index, onPress }: {
  entry: MergeOrderTrayEntry;
  frame: { height: number; left: number; top: number; width: number };
  index: number;
  onPress: () => void;
}) {
  const slot = GARDEN_ORDER_SLOT_CENTERS[index];
  if (!slot) return null;
  return (
    <Pressable
      accessibilityHint="Opens this order in the Garden"
      accessibilityLabel={`${entry.order.title}${entry.ready ? ', ready to serve' : ''}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.gardenOrderShortcut,
        {
          left: frame.left + frame.width * slot.x - GARDEN_ORDER_CARD_WIDTH / 2,
          top: frame.top + frame.height * slot.y - GARDEN_ORDER_CARD_HEIGHT / 2,
        },
        pressed && styles.gardenOrderShortcutPressed,
      ]}>
      <FrozenMergeOrderTrayCard entry={entry} />
    </Pressable>
  );
}

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
  highlightedLockedFamilyId,
  discoveryRevealFamilyId = null,
  gardenOrders = [],
  initialCameraSnapshot,
  onCameraSnapshotChange,
  onOpenGarden,
  interactionResidentId = null,
  onResidentFocusComplete,
  squareWorld = false,
  mossproutNatureIslandLevels,
  onSelectNatureIsland,
}: Props) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [assetRevision, setAssetRevision] = useState(0);
  const [upgradePhase, setUpgradePhase] = useState<HavenUpgradePresentationPhase>('armed');
  const [discoveryPhase, setDiscoveryPhase] = useState<HavenUpgradePresentationPhase>('armed');
  const rootRef = useRef<View>(null);
  const reduceMotion = useReducedMotion();

  useFocusEffect(
    useCallback(() => {
      setAssetRevision((current) => current + 1);
      return undefined;
    }, [])
  );

  const hexTileSelection = useMemo(
    () => ({ revision: assetRevision, value: playerHavenHexTileSet() }),
    [assetRevision]
  );
  const verticalAlignmentSelection = useMemo(
    () => ({ revision: assetRevision, value: getDevKingdomHexVerticalAlignmentMode() }),
    [assetRevision]
  );
  const scene = useMemo(
    () => squareWorld
      ? buildMossproutSquareScene(companionSlots, mossproutNatureIslandLevels ?? {
          'seed-nursery': 0,
          'bloom-garden': 0,
          'pond-sanctuary': 0,
          'orchard-grove': 0,
          'ancient-tree-grove': 0,
          'wildgrowth-grove': 0,
        })
      : buildKingdomHexScene(companionSlots, hexTileSelection.value, identity, verticalAlignmentSelection.value),
    [companionSlots, hexTileSelection, identity, mossproutNatureIslandLevels, squareWorld, verticalAlignmentSelection]
  );
  const sceneHomeTile = useMemo(
    () => scene.tiles.find((tile) => tile.kind === 'home') ?? scene.centerTile,
    [scene.centerTile, scene.tiles]
  );
  const presentation = hexTileSelection.value.presentation;
  const creatureWorldSize = CREATURE_SIZE * (presentation?.residentScale ?? CREATURE_WORLD_SCALE);
  const focusTargets = useMemo(
    () => [
      ...scene.tiles.map((tile) => ({ id: tile.id, x: tile.cx, y: tile.cy })),
      ...(squareWorld ? scene.tileArtLayers
        .filter((layer) => layer.kind === 'structure')
        .map((layer) => ({
          id: layer.id,
          x: layer.frame.left + layer.frame.width / 2,
          y: layer.frame.top + layer.frame.height / 2,
        })) : []),
    ],
    [scene.tileArtLayers, scene.tiles, squareWorld]
  );
  const upgradeLayers = useMemo(() => {
    if (!upgradePresentation) return null;
    if (squareWorld && upgradePresentation.natureIslandId && mossproutNatureIslandLevels) {
      const islandId = upgradePresentation.natureIslandId;
      const fromLevels = { ...mossproutNatureIslandLevels, [islandId]: upgradePresentation.fromStage };
      const toLevels = { ...mossproutNatureIslandLevels, [islandId]: upgradePresentation.toStage };
      const fromScene = buildMossproutSquareScene(companionSlots, fromLevels);
      const toScene = buildMossproutSquareScene(companionSlots, toLevels);
      const baseLayerId = `nature:mossprout:${islandId}`;
      const growthLayerId = `${baseLayerId}:growth`;
      const fromLayer = fromScene.tileArtLayers.find((layer) => layer.id === growthLayerId)
        ?? fromScene.tileArtLayers.find((layer) => layer.id === baseLayerId);
      const toLayer = toScene.tileArtLayers.find((layer) => layer.id === growthLayerId)
        ?? toScene.tileArtLayers.find((layer) => layer.id === baseLayerId);
      const baseLayer = toScene.tileArtLayers.find((layer) => layer.id === baseLayerId);
      return fromLayer && toLayer && baseLayer ? {
        fromLayer,
        toLayer,
        tile: {
          id: toLayer.id,
          cx: baseLayer.frame.left + baseLayer.frame.width / 2,
          cy: baseLayer.frame.top + baseLayer.frame.height / 2,
        },
      } : null;
    }
    const slotsAtStage = (stage: HavenTileUpgradePresentation['fromStage']) => companionSlots.map((slot) => (
      slot.kind === 'owned' && slot.familyId === upgradePresentation.characterId
        ? { ...slot, havenStage: stage }
        : slot
    ));
    const fromSlots = slotsAtStage(upgradePresentation.fromStage);
    const toSlots = slotsAtStage(upgradePresentation.toStage);
    const fromScene = squareWorld
      ? buildMossproutSquareScene(fromSlots, mossproutNatureIslandLevels!)
      : buildKingdomHexScene(fromSlots, hexTileSelection.value, identity, verticalAlignmentSelection.value);
    const toScene = squareWorld
      ? buildMossproutSquareScene(toSlots, mossproutNatureIslandLevels!)
      : buildKingdomHexScene(toSlots, hexTileSelection.value, identity, verticalAlignmentSelection.value);
    const fromLayer = fromScene.tileArtLayers.find((layer) => layer.id === `family:${upgradePresentation.characterId}`);
    const toLayer = toScene.tileArtLayers.find((layer) => layer.id === `family:${upgradePresentation.characterId}`);
    const tile = toScene.tiles.find((candidate) => candidate.id === `family:${upgradePresentation.characterId}`);
    return fromLayer && toLayer && tile ? { fromLayer, tile, toLayer } : null;
  }, [companionSlots, hexTileSelection, identity, mossproutNatureIslandLevels, squareWorld, upgradePresentation, verticalAlignmentSelection]);
  const discoveryLayers = useMemo(() => {
    if (!discoveryRevealFamilyId) return null;
    const revealed = companionSlots.find((slot) => slot.familyId === discoveryRevealFamilyId && slot.kind === 'revealed_egg');
    if (!revealed) return null;
    const lockedSlots = companionSlots.map((slot) => slot.familyId === discoveryRevealFamilyId
      ? { id: slot.id, coord: slot.coord, familyId: slot.familyId, kind: 'locked' as const }
      : slot);
    const fromScene = squareWorld
      ? buildMossproutSquareScene(lockedSlots, mossproutNatureIslandLevels!)
      : buildKingdomHexScene(lockedSlots, hexTileSelection.value, identity, verticalAlignmentSelection.value);
    const fromLayer = fromScene.tileArtLayers.find((layer) => layer.id === revealed.id);
    const toLayer = scene.tileArtLayers.find((layer) => layer.id === revealed.id);
    const tile = scene.tiles.find((candidate) => candidate.id === revealed.id);
    return fromLayer && toLayer && tile ? { fromLayer, tile, toLayer } : null;
  }, [companionSlots, discoveryRevealFamilyId, hexTileSelection, identity, mossproutNatureIslandLevels, scene.tileArtLayers, scene.tiles, squareWorld, verticalAlignmentSelection]);
  useEffect(() => {
    if (!discoveryLayers) {
      setDiscoveryPhase('armed');
      return;
    }
    setDiscoveryPhase('cover');
    const revealTimer = setTimeout(() => setDiscoveryPhase('reveal'), reduceMotion ? 80 : 360);
    const completeTimer = setTimeout(() => setDiscoveryPhase('complete'), reduceMotion ? 360 : 1_120);
    return () => {
      clearTimeout(revealTimer);
      clearTimeout(completeTimer);
    };
  }, [discoveryLayers, reduceMotion]);
  const gardenFrame = useMemo(() => scene.tileArtLayers.find(
    (layer) => layer.id === 'structure:mossprout-square-garden',
  )?.interactionFrame ?? null, [scene.tileArtLayers]);
  const natureIslandFrames = useMemo(() => scene.tileArtLayers.flatMap((layer) => {
    if (!layer.id.startsWith('nature:mossprout:') || layer.id.endsWith(':growth') || !layer.interactionFrame) return [];
    return [{
      frame: layer.interactionFrame,
      islandId: layer.id.slice('nature:mossprout:'.length) as MossproutNatureIslandId,
    }];
  }), [scene.tileArtLayers]);
  const camera = useKingdomHexCamera({
    center: { x: scene.centerTile.cx, y: scene.centerTile.cy },
    centerId: scene.centerTile.id,
    initialFitWorld: squareWorld,
    initialSnapshot: initialCameraSnapshot,
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
    minimumScale: squareWorld ? 0.28 : undefined,
    onSnapshotChange: onCameraSnapshotChange,
    scene,
    viewport,
  });
  const handleNatureIslandPress = useCallback((
    islandId: MossproutNatureIslandId,
    frame: { height: number; left: number; top: number; width: number },
  ) => {
    camera.focusFrame(frame, {
      durationMs: reduceMotion ? 0 : 280,
      horizontalPadding: 70,
      screenCenterY: viewport.height * 0.42,
      verticalPadding: 140,
    });
    onSelectNatureIsland?.(islandId);
  }, [camera, onSelectNatureIsland, reduceMotion, viewport.height]);
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
    const target = tutorialCamera.target;
    const targetCharacterId = target.kind === 'haven_tile' ? target.characterId : null;
    const tile = target.kind === 'haven_home'
      ? sceneHomeTile
      : targetCharacterId
        ? scene.tiles.find((candidate) => (
            candidate.kind === 'companion'
            && candidate.companion?.familyId === targetCharacterId
          ))
        : null;
    if (!tile) return;
    focusTutorialResident(tile.cx, tile.cy, {
      anchorY: tutorialCamera.anchorY,
      durationMs: tutorialCamera.durationMs,
      zoom: tutorialCamera.zoom,
    });
  }, [fitTutorialWorld, focusTutorialResident, scene.tiles, sceneHomeTile, tutorialCamera, tutorialCameraKey, tutorialCameraReady]);
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
        left: frame.left + (layer.alphaBounds.left / layer.sourceSize.width) * frame.width,
        top: frame.top + (layer.alphaBounds.top / layer.sourceSize.height) * frame.height,
        right: frame.left + (layer.alphaBounds.right / layer.sourceSize.width) * frame.width,
        bottom: frame.top + (layer.alphaBounds.bottom / layer.sourceSize.height) * frame.height,
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
  const discoveryEffectGeometry = useMemo(() => {
    if (!discoveryLayers) return null;
    const screenFrame = (layer: KingdomTileArtLayer) => ({
      height: layer.frame.height * cameraSnapshot.scale,
      left: scene.width / 2 + cameraSnapshot.tx + (layer.frame.left - scene.width / 2) * cameraSnapshot.scale,
      top: scene.height / 2 + cameraSnapshot.ty + (layer.frame.top - scene.height / 2) * cameraSnapshot.scale,
      width: layer.frame.width * cameraSnapshot.scale,
    });
    const frame = screenFrame(discoveryLayers.toLayer);
    return {
      area: frame,
      silhouetteFrame: frame,
      target: {
        x: scene.width / 2 + cameraSnapshot.tx + (discoveryLayers.tile.cx - scene.width / 2) * cameraSnapshot.scale,
        y: scene.height / 2 + cameraSnapshot.ty + (discoveryLayers.tile.cy - scene.height / 2) * cameraSnapshot.scale,
      },
    };
  }, [cameraSnapshot, discoveryLayers, scene.height, scene.width]);
  const discoveryPresentation = useMemo<HavenTileUpgradePresentation | null>(() => discoveryRevealFamilyId ? ({
    characterId: 'mossprout', coinCost: 0, coinOrigin: { x: 0, y: 0 }, creatureId: 'egg:mossprout', creatureName: 'Mossprout',
    fromStage: 0, nonce: 32, palette: { accent: '#F5E58A', glow: '#A8E873', mist: 'rgba(226,255,213,0.88)', primary: '#4F9F57' },
    reactionLine: '', status: 'playing', toStage: 0, upgradeName: 'Grove revealed',
  }) : null, [discoveryRevealFamilyId]);
  const cameraTransitionActive = useSharedValue(camera.isMoving ? 1 : 0);
  useEffect(() => {
    cameraTransitionActive.value = camera.isMoving ? 1 : 0;
  }, [camera.isMoving, cameraTransitionActive]);
  useScenePerformanceProbe('kingdom-camera', cameraTransitionActive, 'kingdom');
  const artLayerById = useMemo(
    () => new Map(scene.tileArtLayers.map((layer) => [layer.id, layer])),
    [scene.tileArtLayers]
  );
  const tileFocusScale = useCallback((tileId: string) => {
    if (!presentation || presentation.focusMode !== 'magnetic' || camera.isMoving || !camera.focusedTileId) return 1;
    if (tileId === camera.focusedTileId) return reduceMotion ? 1.04 : presentation.focusedScale;
    return presentation.unfocusedScale;
  }, [camera.focusedTileId, camera.isMoving, presentation, reduceMotion]);
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
      if (tile.kind !== 'companion' || !tile.companion) continue;
      const artLayer = artLayerById.get(tile.id);
      const focusScale = tileFocusScale(tile.id);
      if (tile.companion.kind === 'locked') {
        const lockedFamilyId = tile.companion.familyId;
        items.push({
          depth: tile.depth + 3,
          node: (
            <LockedCompanionTile
              highlighted={lockedFamilyId === highlightedLockedFamilyId}
              key={`locked-${tile.id}`}
              focusAnchorX={tile.cx}
              focusAnchorY={tile.cy}
              focusScale={focusScale}
              focusId={tile.id}
              onFocus={interactionEnabled ? camera.focusResident : ignoreFocus}
              onSelectLocked={interactionEnabled ? () => onSelectLocked?.(lockedFamilyId) : undefined}
              x={tile.cx}
              y={tile.cy}
            />
          ),
        });
        continue;
      }
      if (tile.companion.kind === 'revealed_egg') {
        items.push({
          depth: tile.depth + 3,
          node: (
            <RevealedCompanionEgg
              eggSkinId={tile.companion.eggSkinId}
              focusAnchorX={tile.cx}
              focusAnchorY={tile.cy}
              focusScale={focusScale}
              key={`revealed-egg-${tile.id}`}
              onPress={interactionEnabled ? () => onSelectLocked?.(tile.companion!.familyId) : undefined}
              x={artLayer?.residentAnchor?.x ?? tile.cx}
              y={(artLayer?.residentAnchor?.y ?? tile.cy) - 8}
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
            source={artLayer?.residentSource}
            tile={tile}
            x={x}
            y={y}
            statusGlyph={residentStatusGlyphs?.[tile.companion.creature.creatureId] === 'ready' ? undefined : residentStatusGlyphs?.[tile.companion.creature.creatureId]}
            worldSize={creatureWorldSize}
            onFocus={residentInteractionEnabled ? camera.focusResident : ignoreFocus}
            onSelectResident={residentInteractionEnabled ? onSelectResident : undefined}
            onFocusComplete={onResidentFocusComplete}
          />
        ),
      });
    }

    return items.sort((a, b) => a.depth - b.depth).map((item) => item.node);
  }, [allowedResidentCharacterId, artLayerById, camera.focusResident, creatureWorldSize, highlightedLockedFamilyId, ignoreFocus, interactionEnabled, onResidentFocusComplete, onSelectLocked, onSelectResident, residentStatusGlyphs, scene.tiles, tileFocusScale, upgradePhase, upgradePresentation]);

  const home = homePreset(identity?.selectedHomeArchetypeId);
  const showEgg = Boolean(eggVisual);

  return (
    <View collapsable={false} ref={rootRef} style={styles.root} onLayout={onLayout}>
      <Image
        cachePolicy="disk"
        contentFit="cover"
        pointerEvents="none"
        recyclingKey={background.id}
        source={background.havenSource}
        style={StyleSheet.absoluteFill}
      />
      {/* Recreate the native handler whenever this tab regains focus. A camera
          route can suspend a gesture mid-lifecycle on iOS; retaining that
          handler leaves the otherwise-visible Kingdom canvas unresponsive. */}
      <GestureDetector key={`kingdom-camera-${assetRevision}`} gesture={camera.gesture}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.scene, { width: scene.width, height: scene.height }, camera.worldStyle]}>
            {scene.tileArtLayers.map((layer) => {
              // The merge garden sits beneath many small interactive sprites
              // and remains visible while zoomed. Give that single container
              // its 1024 px tier without promoting every Haven tile globally.
              const layerLod = squareWorld && layer.id === 'structure:mossprout-square-garden'
                ? 'full'
                : KINGDOM_RENDERING.havenImageLod;
              const source = kingdomHexTileSourceForLod(layer, layerLod);
              const overlaySource = kingdomHexTileOverlaySourceForLod(layer, layerLod);
              const fallbackSource = layer.fallbackSource
                ? kingdomHexTileSourceForLod(
                    { source: layer.fallbackSource, sources: layer.fallbackSources },
                    layerLod
                  )
                : null;
              return (
                <Fragment key={`tile-stack-${layer.id}`}>
                  <KingdomTileArt
                    focusAnchorX={scene.tileById.get(layer.id)?.cx ?? layer.frame.left + layer.frame.width / 2}
                    focusAnchorY={scene.tileById.get(layer.id)?.cy ?? layer.frame.top + layer.frame.height / 2}
                    focusScale={tileFocusScale(layer.id)}
                    frame={layer.frame}
                    source={source}
                    overlaySource={overlaySource}
                    fallbackSource={fallbackSource}
                    priority={layer.id === scene.centerTile.id || layer.id === 'structure:mossprout-square-garden' ? 'high' : 'normal'}
                  />
                  {upgradeLayers && upgradePresentation && layer.id === upgradeLayers.tile.id ? (
                    <HavenUpgradeTileArt
                      fromLayer={upgradeLayers.fromLayer}
                      phase={upgradePhase}
                      reducedMotion={reduceMotion}
                      toLayer={upgradeLayers.toLayer}
                    />
                  ) : null}
                  {discoveryLayers && layer.id === discoveryLayers.tile.id && discoveryPhase !== 'complete' ? (
                    <HavenUpgradeTileArt
                      fromLayer={discoveryLayers.fromLayer}
                      phase={discoveryPhase}
                      reducedMotion={reduceMotion}
                      toLayer={discoveryLayers.toLayer}
                    />
                  ) : null}
                </Fragment>
              );
            })}
            {squareWorld && interactionEnabled && !upgradePresentation && gardenFrame && onOpenGarden ? (
              <Pressable
                accessibilityHint="Opens the dedicated Merge Garden"
                accessibilityLabel="Mossprout Garden"
                accessibilityRole="button"
                onPress={() => onOpenGarden()}
                style={[styles.gardenIslandHitTarget, gardenFrame]}
              />
            ) : null}
            {squareWorld && interactionEnabled && !upgradePresentation && gardenFrame && onOpenGarden
              ? gardenOrders.slice(0, 3).map((entry, index) => (
                  <GardenOrderShortcut
                    entry={entry}
                    frame={gardenFrame}
                    index={index}
                    key={`garden-order-shortcut-${entry.id}`}
                    onPress={() => onOpenGarden(entry.order.id)}
                  />
                ))
              : null}
            {squareWorld && interactionEnabled && !upgradePresentation ? natureIslandFrames.map(({ frame, islandId }) => {
              const definition = mossproutNatureIslandById.get(islandId);
              const level = mossproutNatureIslandLevels?.[islandId] ?? 0;
              return (
                <Pressable
                  key={`nature-island-hit-target-${islandId}`}
                  accessibilityHint="Opens this island's growth and upgrade details"
                  accessibilityLabel={`${definition?.name ?? 'Nature island'}, level ${level} of 4`}
                  accessibilityRole="button"
                  onPress={() => handleNatureIslandPress(islandId, frame)}
                  style={[styles.natureIslandHitTarget, frame]}
                />
              );
            }) : null}
            {showEgg ? (
              <KingdomEgg
                {...kingdomWorldViewPoint(
                  { x: sceneHomeTile.cx, y: sceneHomeTile.cy },
                  kingdomWorldViewConfig.egg
                )}
                focusAnchorX={sceneHomeTile.cx}
                focusAnchorY={sceneHomeTile.cy}
                focusScale={tileFocusScale(sceneHomeTile.id)}
                onPress={interactionEnabled ? () => camera.focusResident(
                  sceneHomeTile.cx,
                  sceneHomeTile.cy,
                  { anchorY: 0.46, id: sceneHomeTile.id, zoom: 1.05 }
                ) : undefined}
              />
            ) : null}
            {identity?.selectedHomeArchetypeId ? (
              <HomeTileHitTarget
                accessibilityLabel={`${home.name} home`}
                onPress={onSelectHome}
                x={sceneHomeTile.cx}
                y={sceneHomeTile.cy - HEX_TILE_H * 0.38}
              />
            ) : null}
            {creatureNodes}
          </Animated.View>
        </View>
      </GestureDetector>
      {!upgradePresentation && interactionEnabled ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Recenter kingdom"
          onPress={camera.recenter}
          style={[styles.recenter, { bottom: recenterBottom }]}>
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
          silhouetteSource={kingdomHexTileSourceForLod(upgradeLayers.toLayer, KINGDOM_RENDERING.havenImageLod)}
          target={upgradeEffectGeometry.target}
        />
      ) : null}
      {!upgradePresentation && discoveryPresentation && discoveryEffectGeometry && discoveryLayers && discoveryPhase !== 'complete' ? (
        <HavenUpgradeEffects
          area={discoveryEffectGeometry.area}
          phase={discoveryPhase}
          presentation={discoveryPresentation}
          reducedMotion={reduceMotion}
          showCoins={false}
          showReaction={false}
          silhouetteFrame={discoveryEffectGeometry.silhouetteFrame}
          silhouetteSource={kingdomHexTileSourceForLod(discoveryLayers.toLayer, KINGDOM_RENDERING.havenImageLod)}
          target={discoveryEffectGeometry.target}
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
  priority: 'low' | 'normal' | 'high';
  source: ImageSourcePropType;
  overlaySource: ImageSourcePropType | null;
};

const KingdomTileArt = memo(function KingdomTileArt({
  fallbackSource,
  focusAnchorX,
  focusAnchorY,
  focusScale,
  frame,
  priority,
  source,
  overlaySource,
}: TileArtProps) {
  return (
    <TileFocusTransform anchorX={focusAnchorX} anchorY={focusAnchorY} frame={frame} scale={focusScale}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <SeamlessWorldImage
          allowDownscaling
          source={source}
          fallbackSource={fallbackSource}
          priority={priority}
        />
        {overlaySource ? (
          <SeamlessWorldImage
            allowDownscaling
            source={overlaySource}
            priority={priority}
          />
        ) : null}
      </View>
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
  const oldSource = kingdomHexTileSourceForLod(fromLayer, KINGDOM_RENDERING.havenImageLod);
  const newSource = kingdomHexTileSourceForLod(toLayer, KINGDOM_RENDERING.havenImageLod);
  const oldOverlaySource = kingdomHexTileOverlaySourceForLod(fromLayer, KINGDOM_RENDERING.havenImageLod);
  const newOverlaySource = kingdomHexTileOverlaySourceForLod(toLayer, KINGDOM_RENDERING.havenImageLod);

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
  onPress,
}: {
  x: number;
  y: number;
  focusAnchorX: number;
  focusAnchorY: number;
  focusScale: number;
  onPress?: () => void;
}) {
  const avatar = useEggAvatar();
  const [ready, setReady] = useState(false);
  const opacity = useSharedValue(0);
  const lift = useSharedValue(10);

  useEffect(() => {
    if (!ready) return;
    opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
    lift.value = withSpring(0, { damping: 14, stiffness: 190 });
  }, [lift, opacity, ready]);

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
          <EggAvatarArtwork
            allowDownscaling
            faceId={avatar.equippedFaceId}
            hatId={avatar.equippedHatId}
            heldAccessoryId={avatar.equippedHeldAccessoryId}
            onError={markReady}
            onLoad={markReady}
            priority="high"
            resolution="app"
            skinId={avatar.equippedSkinId}
            style={StyleSheet.absoluteFill}
            transition={0}
          />
        </Pressable>
      </Animated.View>
    </TileFocusTransform>
  );
});

const RevealedCompanionEgg = memo(function RevealedCompanionEgg({
  eggSkinId,
  x,
  y,
  focusAnchorX,
  focusAnchorY,
  focusScale,
  onPress,
}: {
  eggSkinId: Extract<KingdomHexCompanionSlot, { kind: 'revealed_egg' }>['eggSkinId'];
  x: number;
  y: number;
  focusAnchorX: number;
  focusAnchorY: number;
  focusScale: number;
  onPress?: () => void;
}) {
  const opacity = useSharedValue(0);
  const pulse = useSharedValue(1);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
    pulse.value = withRepeat(withSequence(
      withTiming(1.055, { duration: 760, easing: Easing.inOut(Easing.quad) }),
      withTiming(1, { duration: 760, easing: Easing.inOut(Easing.quad) }),
    ), -1);
  }, [opacity, pulse]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: pulse.value }],
  }));
  const width = 82;
  const height = 106;
  const frame = { height, left: x - width / 2, top: y - height, width };
  return (
    <TileFocusTransform anchorX={focusAnchorX} anchorY={focusAnchorY} frame={frame} scale={focusScale}>
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <Pressable accessibilityLabel="Inspect Mossprout Egg" accessibilityRole="button" onPress={onPress} style={StyleSheet.absoluteFill}>
          <EggAvatarArtwork
            faceId="curious"
            hatId={null}
            heldAccessoryId={null}
            priority="high"
            resolution="app"
            showFace={false}
            skinId={eggSkinId}
            style={StyleSheet.absoluteFill}
          />
        </Pressable>
      </Animated.View>
    </TileFocusTransform>
  );
});

const LockedCompanionTile = memo(function LockedCompanionTile({
  highlighted,
  focusAnchorX,
  focusAnchorY,
  focusId,
  focusScale,
  onFocus,
  onSelectLocked,
  x,
  y,
}: {
  highlighted: boolean;
  focusAnchorX: number;
  focusAnchorY: number;
  focusId: string;
  focusScale: number;
  onFocus: (x: number, y: number, options?: { id?: string }) => void;
  onSelectLocked?: () => void;
  x: number;
  y: number;
}) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const lift = useSharedValue(10);
  const pulse = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: reduceMotion ? 80 : 180, easing: Easing.out(Easing.cubic) });
    lift.value = reduceMotion ? withTiming(0, { duration: 80 }) : withSpring(0, { damping: 14, stiffness: 210 });
  }, [lift, opacity, reduceMotion]);

  useEffect(() => {
    cancelAnimation(pulse);
    pulse.value = highlighted && !reduceMotion
      ? withRepeat(withSequence(
          withTiming(1.1, { duration: 760, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 760, easing: Easing.inOut(Easing.quad) }),
        ), -1)
      : withTiming(1, { duration: 120 });
    return () => cancelAnimation(pulse);
  }, [highlighted, pulse, reduceMotion]);

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
        <Animated.View pointerEvents="none" style={[styles.lockedTileLockWrap, highlighted && styles.highlightedLockedTile, animatedStyle]}>
          <Image
            accessibilityIgnoresInvertColors
            cachePolicy="memory-disk"
            contentFit="contain"
            source={KINGDOM_DREAM_MIST_LOCK_SOURCE}
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
  onFocus: (x: number, y: number, options?: { id?: string; onComplete?: () => void }) => void;
  onFocusComplete?: (creatureId: string) => void;
  onSelectResident?: (creatureId: string, label: string) => void;
  source?: ImageSourcePropType;
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
  onFocus,
  onFocusComplete,
  onSelectResident,
  source: sourceOverride,
  statusGlyph,
  tile,
  worldSize,
  x,
  y,
}: ResidentProps) {
  const creature = tile.companion?.kind === 'owned' ? tile.companion.creature : null;
  const source = creature
    ? sourceOverride ?? worldAssetSource(`creature:${creature.visualKey}`, KINGDOM_RENDERING.havenImageLod)
    : null;
  const [ready, setReady] = useState(false);
  const opacity = useSharedValue(0);
  const lift = useSharedValue(12);
  const reactionLift = useSharedValue(0);
  const reactionRotation = useSharedValue(0);
  const reactionScale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!ready) return;
    opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
    lift.value = withSpring(0, { damping: 14, stiffness: 210 });
  }, [lift, opacity, ready]);

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
    onFocus(x, y, { id: tile.id, onComplete: () => onFocusComplete?.(creature.creatureId) });
    onSelectResident?.(creature.creatureId, creature.name);
  }, [creature, onFocus, onFocusComplete, onSelectResident, tile.id, x, y]);
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
  gardenIslandHitTarget: { position: 'absolute', zIndex: 10 },
  gardenOrderShortcut: {
    height: GARDEN_ORDER_CARD_HEIGHT,
    position: 'absolute',
    width: GARDEN_ORDER_CARD_WIDTH,
    zIndex: 20,
  },
  gardenOrderShortcutPressed: { opacity: 0.9, transform: [{ scale: 0.94 }] },
  eggLayer: { height: EGG_WORLD_H, position: 'absolute', width: EGG_WORLD_W },
  creature: { position: 'absolute' },
  lockedTileHitTarget: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  lockedTileLockWrap: {
    height: LOCKED_TILE_LOCK_SIZE,
    width: LOCKED_TILE_LOCK_SIZE,
  },
  highlightedLockedTile: {
    backgroundColor: 'rgba(150, 239, 113, 0.18)',
    borderRadius: LOCKED_TILE_LOCK_SIZE / 2,
    boxShadow: '0 0 26px rgba(150, 239, 113, 0.82)',
  },
  lockedTileLock: { height: '100%', width: '100%' },
  homeTileHitTarget: { height: 84, position: 'absolute', width: 108 },
  natureIslandHitTarget: { position: 'absolute' },
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
