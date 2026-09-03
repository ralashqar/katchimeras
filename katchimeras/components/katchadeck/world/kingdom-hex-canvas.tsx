import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import {
  BlendColor,
  Canvas,
  Circle,
  Group,
  Image as SkiaImage,
  RadialGradient as SkiaRadialGradient,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import { Fragment, memo, type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, LayoutChangeEvent, Pressable, StyleSheet, Text, View, type ImageSourcePropType, type View as ViewType } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  withRepeat,
  withDelay,
  type SharedValue,
} from 'react-native-reanimated';

import { CreatureGroundShadow } from '@/components/katchadeck/creature-ground-shadow';
import { EggAvatarArtwork, eggAvatarBodyPresentationStyle } from '@/components/katchadeck/egg-avatar/egg-avatar-artwork';
import type { EggExpressionCue } from '@/components/katchadeck/egg-avatar/egg-avatar-artwork';
import { FrozenMergeOrderTrayCard, type MergeOrderTrayEntry } from '@/components/katchadeck/games/merge-order-rail';
import { PersistentMergeItemArt } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { HavenUpgradeEffects } from '@/components/katchadeck/world/haven-upgrade-effects';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import type { KingdomHexScene, KingdomTileArtLayer, KingdomTileRender } from '@/components/katchadeck/world/kingdom-hex-scene';
import { buildKingdomHexScene } from '@/components/katchadeck/world/kingdom-hex-scene';
import { buildMossproutHexNeighborhoodScene, mossproutGardenPlantSlotFrame, MOSSPROUT_GARDEN_PLANT_SLOT_IDS, type MossproutGardenSceneState } from '@/components/katchadeck/world/mossprout-hex-neighborhood-scene';
import { SeamlessWorldImage } from '@/components/katchadeck/world/seamless-world-image';
import { CreatureAnimatedArt } from '@/components/katchadeck/world/creature-animated-art';
import type { WorldFtueSubjectPresentation } from '@/components/katchadeck/world/world-ftue-subject-presentation';
import { runRewardArrivalMotion } from '@/components/katchadeck/ui/reward-arrival-motion';
import { RotatingRadialSunburst } from '@/components/katchadeck/ui/radial-sunburst';
import { CelebrationParticles } from '@/components/katchadeck/world/companion-achievement-celebration';
import { useKingdomHexCamera } from '@/components/katchadeck/world/use-kingdom-hex-camera';
import { KINGDOM_RENDERING } from '@/constants/kingdom-rendering';
import { mossproutNatureIslandById } from '@/constants/mossprout-nature-islands';
import { mossproutMemoryPlantById, mossproutMemoryPlantStage } from '@/constants/mossprout-memory-plants';
import kingdomWorldViewConfig from '@/constants/kingdom-world-view.json';
import { Lantern } from '@/constants/theme';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import type { MossproutGardenPlantSlotId, MossproutNatureIslandId, MossproutNatureIslandLevel } from '@/types/merge-world';
import type { FtueCameraDirective } from '@/features/onboarding/ftue-types';
import type { StoryCameraPresentationPayload, StoryTarget } from '@/types/content-flow';
import { STORY_CAMERA_PRESENTATION } from '@/features/content-flow/story-world-operations';
import { useStoryPresentationOperation } from '@/features/content-flow/use-story-presentation-operation';
import { useContentFlowSurface } from '@/features/content-flow/use-content-flow-surface';
import { storyTargetRegistry, waitForStoryTargets } from '@/features/content-flow/story-targets';
import type { WorldIdentityState } from '@/types/world-identity';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import { homePreset } from '@/utils/world-identity';
import { HEX_TILE_H, HEX_TILE_W, hexDrawDepth } from '@/utils/world-hex';
import {
  type KingdomCameraSnapshot,
  kingdomWorldViewPoint,
} from '@/utils/kingdom-rendering';
import { getDevKingdomHexVerticalAlignmentMode } from '@/utils/dev-asset-overrides';
import { worldTileActionFrame, type WorldTileActionPlacement } from '@/utils/world-tile-action-layout';
import { resolveCreatureArtSource, resolveCreatureMeditationArtSource } from '@/utils/creature-art';
import { FTUE_MOSSPROUT_CREATURE } from '@/features/onboarding/mossprout-ftue-creature';
import { eggVisualGrowthForEnergyRatio } from '@/utils/today-growth';
import type { TodayHatchPhase } from '@/utils/today-hatch-presentation';
import type { KingdomHexCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import {
  HAVEN_UPGRADE_REDUCED_TIMING,
  HAVEN_UPGRADE_TIMING,
  type HavenTileUpgradePresentation,
  type HavenUpgradePresentationPhase,
} from '@/utils/haven-upgrade-presentation';
import { useScenePerformanceProbe } from '@/hooks/use-scene-performance-probe';
import {
  type KingdomHexTileLod,
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
export type KingdomTileUpgradeOffer = WorldTileActionPlacement & {
  accessibilityHint: string;
  icon?: IconSymbolName;
  label: string;
  target: Extract<StoryTarget, {
    kind: 'haven_garden_plot' | 'haven_home' | 'haven_nature_island' | 'haven_structure' | 'haven_tile';
  }>;
};
type Props = {
  background: TodayAtmosphereBackground;
  companionSlots: KingdomHexCompanionSlot[];
  identity?: WorldIdentityState | null;
  lanternColor?: string;
  interactionEnabled?: boolean;
  cameraLocked?: boolean;
  cameraMaximumScale?: number;
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
  gardenOrdersInteractive?: boolean;
  gardenOrderCallout?: boolean;
  onGardenOrderTargetChange?: (orderId: string, node: ViewType | null) => void;
  onGardenPlotTargetChange?: (slotId: MossproutGardenPlantSlotId, node: ViewType | null) => void;
  initialTutorialCameraScale?: number;
  initialCameraSnapshot?: KingdomCameraSnapshot | null;
  onCameraSnapshotChange?: (snapshot: KingdomCameraSnapshot) => void;
  onCameraMotionChange?: (moving: boolean) => void;
  onOpenGarden?: (orderId?: string | null) => void;
  tileUpgradeOffer?: KingdomTileUpgradeOffer | null;
  onTileUpgradeOfferPress?: () => void;
  onTileUpgradeOfferTargetChange?: (node: ViewType | null) => void;
  interactionResidentId?: string | null;
  mossproutMeditating?: boolean;
  interactionResidentAnchorY?: number;
  interactionExitNonce?: number;
  interactionRewardPulseKey?: number;
  onInteractionExitFocusComplete?: () => void;
  onResidentFocusComplete?: (creatureId: string) => void;
  focusedMossproutWorld?: boolean;
  mossproutNatureIslandLevels?: Record<MossproutNatureIslandId, MossproutNatureIslandLevel>;
  mossproutGarden?: MossproutGardenSceneState;
  onSelectNatureIsland?: (islandId: MossproutNatureIslandId) => void;
  onSelectMemoryPlant?: (instanceId: string) => void;
  onSelectGateway?: () => void;
  onGatewayTargetChange?: (node: View | null) => void;
  storyOperationsEnabled?: boolean;
  worldEggTargetRef?: RefObject<ViewType | null>;
  worldSubjectPresentation?: WorldFtueSubjectPresentation | null;
};

type HavenUpgradeLayers = {
  fromLayer: KingdomTileArtLayer;
  tile: { id: string; cx: number; cy: number };
  toLayer: KingdomTileArtLayer;
};

const CREATURE_SIZE = 58;
const CREATURE_WORLD_SCALE = kingdomWorldViewConfig.katchimera.globalScale;
const KINGDOM_DREAM_MIST_LOCK_SOURCE = require('../../../assets/images/katchimeras/world/hex/kingdom_dream_mist_lock_v1_512.webp');
const LOCKED_TILE_HIT_WIDTH = HEX_TILE_W * 0.62;
const LOCKED_TILE_HIT_HEIGHT = HEX_TILE_H * 0.78;
const LOCKED_TILE_LOCK_SIZE = 104;
const GARDEN_ORDER_SLOT_CENTERS = [
  { x: 0.5, y: 0.096 },
  { x: 0.3575, y: 0.539 },
  { x: 0.6425, y: 0.539 },
] as const;
const FTUE_GARDEN_ORDER_SLOT = { x: 0.5, y: 0.78 } as const;
const GARDEN_ORDER_CARD_WIDTH = 120;
const GARDEN_ORDER_CARD_HEIGHT = 120;
const FTUE_GARDEN_REQUEST_BUBBLE_SIZE = 94;
const TILE_UPGRADE_OFFER_WIDTH = 206;
const TILE_UPGRADE_OFFER_HEIGHT = 44;
const WORLD_FTUE_CRACK_ONE = require('../../../assets/images/katchimeras/egg-avatars/effects/crack-1.png');
const WORLD_FTUE_CRACK_TWO = require('../../../assets/images/katchimeras/egg-avatars/effects/crack-2.png');
const WORLD_FTUE_SOFT_RING = require('../../../assets/images/katchimeras/soft-ring.png');
const WORLD_FTUE_SOFT_GLOW = require('../../../assets/images/katchimeras/soft-glow.png');
const WORLD_FTUE_MOSSPROUT_SOURCE = resolveCreatureArtSource(FTUE_MOSSPROUT_CREATURE.visualKey);
const WORLD_FTUE_DISCOVERY_EXPRESSIONS: readonly EggExpressionCue[] = [
  { faceId: 'curious', atMs: 180, durationMs: 150 },
  { faceId: 'little-worried', atMs: 430, durationMs: 150 },
  { faceId: 'big-surprise', atMs: 700, durationMs: 150 },
  { faceId: 'happy-squint', atMs: 920, durationMs: 140 },
];
const AnimatedExpoImage = Animated.createAnimatedComponent(Image);
// Keep the Egg's native image plane larger than the largest composition of
// world camera, tile focus, growth and reaction scales. It is therefore always
// sampled down (never enlarged from a 108x139 intermediate texture).
const WORLD_FTUE_EGG_NATIVE_SURFACE_SCALE = 2.7;
const WORLD_FTUE_CREATURE_NATIVE_SURFACE_SCALE = 2.7;
const WORLD_FTUE_PULSE_RING_NATIVE_SURFACE_SCALE = 2;
// Interaction residents live on a detached, oversized native plane just like
// the FTUE Egg. The camera only downsamples this surface, so an animated WebP
// is never first rasterized at its tiny world-map footprint and enlarged.
// Render well above the world-space frame, then counter-scale against the
// camera. The high-resolution still is held during motion so this surface is
// never rasterized from a small in-world copy while zooming.
const WORLD_INTERACTION_CREATURE_NATIVE_SURFACE_SCALE = 2.7;
const MEMORY_PLANT_NATIVE_SURFACE_SCALE = 3.2;
const WORLD_FTUE_EGG_WIDTH = 108;
const WORLD_FTUE_EGG_HEIGHT = 139;
const WORLD_FTUE_EGG_STAGE_SCALE = WORLD_FTUE_EGG_WIDTH / 200;
const WORLD_FTUE_READY_SUNBURST_SIZE = 440 * WORLD_FTUE_EGG_STAGE_SCALE;
const WORLD_FTUE_HATCH_SUNBURST_SIZE = WORLD_FTUE_EGG_WIDTH * 1.8;
const WORLD_FTUE_REWARD_GLOW_SIZE = WORLD_FTUE_EGG_WIDTH * 0.84;
const WORLD_FTUE_GLOW_ACCENT = '#F4CE7A';
const WORLD_FTUE_GLOW_CORE = '#FFF1B8';
const MOSSPROUT_WORLD_BASELINE_LIFT = 8;
const MOSSPROUT_DIALOGUE_SCREEN_ANCHOR_Y = 0.5;
const REGULAR_RESIDENT_INTERACTION_SCREEN_ANCHOR_Y = 0.46;

function mossproutDialogueSubjectCenterY(residentAnchorY: number) {
  return residentAnchorY - MOSSPROUT_WORLD_BASELINE_LIFT - WORLD_FTUE_EGG_HEIGHT / 2;
}

function residentCreatureFrame(x: number, y: number, worldSize: number, stableWorldPresentation: boolean) {
  const width = stableWorldPresentation ? WORLD_FTUE_EGG_WIDTH : worldSize;
  const height = stableWorldPresentation ? WORLD_FTUE_EGG_HEIGHT : worldSize;
  return {
    height,
    left: x - width / 2,
    top: stableWorldPresentation
      ? y - MOSSPROUT_WORLD_BASELINE_LIFT - height
      : y - CREATURE_SIZE * 0.63 - (worldSize - CREATURE_SIZE),
    width,
  };
}

function GardenOrderShortcut({ callout, entry, frame, index, onPress, onTargetChange, slotOverride }: {
  callout?: boolean;
  entry: MergeOrderTrayEntry;
  frame: { height: number; left: number; top: number; width: number };
  index: number;
  onPress?: () => void;
  onTargetChange?: (orderId: string, node: ViewType | null) => void;
  slotOverride?: { x: number; y: number };
}) {
  const reduceMotion = useReducedMotion();
  const slot = slotOverride ?? GARDEN_ORDER_SLOT_CENTERS[index];
  const setTargetNode = useCallback((node: ViewType | null) => {
    onTargetChange?.(entry.order.id, node);
  }, [entry.order.id, onTargetChange]);
  if (!slot) return null;
  const groupWidth = callout ? FTUE_GARDEN_REQUEST_BUBBLE_SIZE : GARDEN_ORDER_CARD_WIDTH;
  const groupTop = callout
    ? frame.top + frame.height * slot.y + GARDEN_ORDER_CARD_HEIGHT / 2 - FTUE_GARDEN_REQUEST_BUBBLE_SIZE
    : frame.top + frame.height * slot.y - GARDEN_ORDER_CARD_HEIGHT / 2;
  const requestedDefinitionId = entry.order.requirements[0]?.definitionId ?? null;
  return (
    <Animated.View
      entering={FadeIn.duration(reduceMotion ? 80 : 260).delay(reduceMotion ? 0 : 100 + index * 50)}
      style={[
        styles.gardenOrderShortcutGroup,
        {
          left: frame.left + frame.width * slot.x - groupWidth / 2,
          top: groupTop,
          width: groupWidth,
        },
      ]}>
      <View collapsable={false} ref={setTargetNode} style={styles.gardenOrderShortcutTarget}>
        {callout ? (
          <View
            accessibilityLabel="First Bloom needed"
            pointerEvents="none"
            style={styles.gardenOrderRequestBubble}>
            {requestedDefinitionId ? (
              <PersistentMergeItemArt definitionId={requestedDefinitionId} size={68} />
            ) : <IconSymbol color="#6E4C22" name="leaf.fill" size={42} />}
            <View style={styles.gardenOrderCalloutTail} />
          </View>
        ) : <Pressable
          accessibilityHint="Opens this order in the Garden"
          accessibilityLabel={`${entry.order.title}${entry.ready ? ', ready to serve' : ''}`}
          accessibilityRole="button"
          disabled={!onPress}
          onPress={onPress}
          style={({ pressed }) => [
            styles.gardenOrderShortcut,
            pressed && styles.gardenOrderShortcutPressed,
          ]}>
          <FrozenMergeOrderTrayCard entry={entry} />
        </Pressable>}
      </View>
    </Animated.View>
  );
}

function TileUpgradeOffer({
  frame,
  offer,
  onPress,
  targetRef,
}: {
  frame: AbsoluteFrame;
  offer: KingdomTileUpgradeOffer;
  onPress?: () => void;
  targetRef: (node: ViewType | null) => void;
}) {
  const actionFrame = worldTileActionFrame(frame, {
    width: TILE_UPGRADE_OFFER_WIDTH,
    height: TILE_UPGRADE_OFFER_HEIGHT,
  }, offer);
  return (
    <Pressable
      accessibilityHint={offer.accessibilityHint}
      accessibilityLabel={offer.label}
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      ref={targetRef}
      style={({ pressed }) => [
        styles.tileUpgradeOffer,
        actionFrame,
        pressed && styles.tileUpgradeOfferPressed,
      ]}>
      <IconSymbol color="#3D2A12" name={offer.icon ?? 'sparkles'} size={18} />
      <Text numberOfLines={1} style={styles.tileUpgradeOfferLabel}>{offer.label}</Text>
    </Pressable>
  );
}

const GardenPlotTarget = memo(function GardenPlotTarget({
  frame,
  onTargetChange,
  slotId,
}: {
  frame: AbsoluteFrame;
  onTargetChange: (slotId: MossproutGardenPlantSlotId, node: ViewType | null) => void;
  slotId: MossproutGardenPlantSlotId;
}) {
  const setNode = useCallback((node: ViewType | null) => {
    onTargetChange(slotId, node);
  }, [onTargetChange, slotId]);
  return (
    <View
      collapsable={false}
      pointerEvents="none"
      ref={setNode}
      style={[styles.gardenPlotTarget, frame]}
    />
  );
});

export const KingdomHexCanvas = memo(function KingdomHexCanvas({
  background,
  companionSlots,
  identity,
  interactionEnabled = true,
  cameraLocked = false,
  cameraMaximumScale,
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
  gardenOrdersInteractive = true,
  gardenOrderCallout = false,
  onGardenOrderTargetChange,
  onGardenPlotTargetChange,
  initialTutorialCameraScale,
  initialCameraSnapshot,
  onCameraSnapshotChange,
  onCameraMotionChange,
  onOpenGarden,
  tileUpgradeOffer = null,
  onTileUpgradeOfferPress,
  onTileUpgradeOfferTargetChange,
  interactionResidentId = null,
  mossproutMeditating = false,
  interactionResidentAnchorY,
  interactionExitNonce = 0,
  interactionRewardPulseKey = 0,
  onInteractionExitFocusComplete,
  onResidentFocusComplete,
  focusedMossproutWorld = false,
  mossproutNatureIslandLevels,
  mossproutGarden,
  onSelectNatureIsland,
  onSelectMemoryPlant,
  onSelectGateway,
  onGatewayTargetChange,
  storyOperationsEnabled = true,
  worldEggTargetRef,
  worldSubjectPresentation,
}: Props) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [assetRevision, setAssetRevision] = useState(0);
  const [upgradePhase, setUpgradePhase] = useState<HavenUpgradePresentationPhase>('armed');
  const [settlingUpgrade, setSettlingUpgrade] = useState<{
    layers: HavenUpgradeLayers;
    nonce: number;
  } | null>(null);
  const [storySceneGuard, setStorySceneGuard] = useState<{ key: string; scene: KingdomHexScene } | null>(null);
  const [discoveryPhase, setDiscoveryPhase] = useState<HavenUpgradePresentationPhase>('armed');
  const rootRef = useRef<View>(null);
  const reduceMotion = useReducedMotion();
  const [cameraRestoreNonce, setCameraRestoreNonce] = useState(0);
  const cameraRestoreArmedRef = useRef(false);
  const settlingUpgradeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (settlingUpgradeTimerRef.current) clearTimeout(settlingUpgradeTimerRef.current);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        cameraRestoreArmedRef.current = true;
        return;
      }
      if (nextState !== 'active' || !cameraRestoreArmedRef.current) return;
      cameraRestoreArmedRef.current = false;
      setCameraRestoreNonce((current) => current + 1);
    });
    return () => subscription.remove();
  }, []);

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
  const committedScene = useMemo(
    () => focusedMossproutWorld
      ? buildMossproutHexNeighborhoodScene(companionSlots, mossproutNatureIslandLevels ?? {
          'seed-nursery': 0,
          'bloom-garden': 0,
          'pond-sanctuary': 0,
          'orchard-grove': 0,
          'ancient-tree-grove': 0,
          'wildgrowth-grove': 0,
        }, mossproutGarden)
      : buildKingdomHexScene(companionSlots, hexTileSelection.value, identity, verticalAlignmentSelection.value),
    [companionSlots, focusedMossproutWorld, hexTileSelection, identity, mossproutGarden, mossproutNatureIslandLevels, verticalAlignmentSelection]
  );
  const upgradeFromScene = useMemo(() => {
    if (!focusedMossproutWorld || !upgradePresentation || !mossproutNatureIslandLevels) return committedScene;
    const fromSlots = companionSlots.map((slot) => (
      slot.kind === 'owned' && slot.familyId === upgradePresentation.characterId
        ? { ...slot, havenStage: upgradePresentation.fromStage }
        : slot
    ));
    const fromNatureLevels = upgradePresentation.natureIslandId
      ? { ...mossproutNatureIslandLevels, [upgradePresentation.natureIslandId]: upgradePresentation.fromStage as MossproutNatureIslandLevel }
      : mossproutNatureIslandLevels;
    const fromGarden = upgradePresentation.visualTarget?.kind === 'haven_structure' && upgradePresentation.visualTarget.structureId === 'steppling-home'
      ? { ...(mossproutGarden ?? { level: 0, plantableMemories: [] }), gateway: upgradePresentation.fromStage === 0 ? 'locked' as const : 'egg' as const }
      : upgradePresentation.visualTarget?.kind === 'haven_structure'
      && upgradePresentation.visualTarget.structureId === 'mossprout-hex-garden'
      ? { ...(mossproutGarden ?? { plantableMemories: [] }), level: upgradePresentation.fromStage }
      : mossproutGarden;
    // A persisted upgrade can publish before its presentation mounts. Keep
    // the complete rendered world on the receipt's from-state until the
    // reveal finishes; otherwise the base image changes frame/source one
    // render before the guarded crossfade is ready.
    return buildMossproutHexNeighborhoodScene(fromSlots, fromNatureLevels, fromGarden);
  }, [committedScene, companionSlots, focusedMossproutWorld, mossproutGarden, mossproutNatureIslandLevels, upgradePresentation]);
  const scene = upgradePresentation
    ? upgradeFromScene
    : storySceneGuard?.scene ?? committedScene;
  const sceneTileImageLod: KingdomHexTileLod = focusedMossproutWorld
    ? 'full'
    : KINGDOM_RENDERING.havenImageLod;
  const sceneHomeTile = useMemo(
    () => scene.tiles.find((tile) => tile.kind === 'home') ?? scene.centerTile,
    [scene.centerTile, scene.tiles]
  );
  const presentation = hexTileSelection.value.presentation;
  const creatureWorldSize = CREATURE_SIZE * (presentation?.residentScale ?? CREATURE_WORLD_SCALE);
  const focusTargets = useMemo(
    () => [
      ...scene.tiles.map((tile) => ({ id: tile.id, x: tile.cx, y: tile.cy })),
      ...(focusedMossproutWorld ? scene.tileArtLayers
        .filter((layer) => layer.kind === 'structure')
        .map((layer) => ({
          id: layer.id,
          x: layer.frame.left + layer.frame.width / 2,
          y: layer.frame.top + layer.frame.height / 2,
        })) : []),
    ],
    [focusedMossproutWorld, scene.tileArtLayers, scene.tiles]
  );
  const upgradeLayers = useMemo(() => {
    if (!upgradePresentation) return null;
    if (focusedMossproutWorld && upgradePresentation.visualTarget?.kind === 'haven_structure' && upgradePresentation.visualTarget.structureId === 'steppling-home') {
      const atStage = (gateway: 'locked' | 'egg') => buildMossproutHexNeighborhoodScene(companionSlots, mossproutNatureIslandLevels!, { ...mossproutGarden, level: mossproutGarden?.level ?? 0, plantableMemories: mossproutGarden?.plantableMemories ?? [], gateway });
      const fromLayer = atStage(upgradePresentation.fromStage === 0 ? 'locked' : 'egg').tileArtLayers.find((layer) => layer.id === 'structure:steppling-home');
      const toLayer = atStage('egg').tileArtLayers.find((layer) => layer.id === 'structure:steppling-home');
      return fromLayer && toLayer ? { fromLayer, toLayer, tile: { id: toLayer.id, cx: toLayer.frame.left + toLayer.frame.width / 2, cy: toLayer.frame.top + toLayer.frame.height / 2 } } : null;
    }
    if (focusedMossproutWorld && upgradePresentation.natureIslandId && mossproutNatureIslandLevels) {
      const islandId = upgradePresentation.natureIslandId;
      const fromLevels = { ...mossproutNatureIslandLevels, [islandId]: upgradePresentation.fromStage };
      const toLevels = { ...mossproutNatureIslandLevels, [islandId]: upgradePresentation.toStage };
      const fromScene = buildMossproutHexNeighborhoodScene(companionSlots, fromLevels, mossproutGarden);
      const toScene = buildMossproutHexNeighborhoodScene(companionSlots, toLevels, mossproutGarden);
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
    const fromScene = focusedMossproutWorld
      ? buildMossproutHexNeighborhoodScene(fromSlots, mossproutNatureIslandLevels!, upgradePresentation.visualTarget?.kind === 'haven_structure'
        && upgradePresentation.visualTarget.structureId === 'mossprout-hex-garden'
        ? { level: upgradePresentation.fromStage, plantableMemories: mossproutGarden?.plantableMemories ?? [] }
        : mossproutGarden)
      : buildKingdomHexScene(fromSlots, hexTileSelection.value, identity, verticalAlignmentSelection.value);
    const toScene = focusedMossproutWorld
      ? buildMossproutHexNeighborhoodScene(toSlots, mossproutNatureIslandLevels!, upgradePresentation.visualTarget?.kind === 'haven_structure'
        && upgradePresentation.visualTarget.structureId === 'mossprout-hex-garden'
        ? { level: upgradePresentation.toStage, plantableMemories: mossproutGarden?.plantableMemories ?? [] }
        : mossproutGarden)
      : buildKingdomHexScene(toSlots, hexTileSelection.value, identity, verticalAlignmentSelection.value);
    if (upgradePresentation.visualTarget?.kind === 'haven_structure') {
      const layerId = upgradePresentation.visualTarget.structureId.startsWith('structure:')
        ? upgradePresentation.visualTarget.structureId
        : `structure:${upgradePresentation.visualTarget.structureId}`;
      const fromLayer = fromScene.tileArtLayers.find((layer) => layer.id === layerId);
      const toLayer = toScene.tileArtLayers.find((layer) => layer.id === layerId);
      const footprint = toLayer?.interactionFrame ?? toLayer?.frame;
      return fromLayer && toLayer && footprint ? {
        fromLayer,
        toLayer,
        tile: {
          id: layerId,
          cx: footprint.left + footprint.width / 2,
          cy: footprint.top + footprint.height / 2,
        },
      } : null;
    }
    const fromLayer = fromScene.tileArtLayers.find((layer) => layer.id === `family:${upgradePresentation.characterId}`);
    const toLayer = toScene.tileArtLayers.find((layer) => layer.id === `family:${upgradePresentation.characterId}`);
    const tile = toScene.tiles.find((candidate) => candidate.id === `family:${upgradePresentation.characterId}`);
    return fromLayer && toLayer && tile ? { fromLayer, tile, toLayer } : null;
  }, [companionSlots, focusedMossproutWorld, hexTileSelection, identity, mossproutGarden, mossproutNatureIslandLevels, upgradePresentation, verticalAlignmentSelection]);
  const discoveryLayers = useMemo(() => {
    if (!discoveryRevealFamilyId) return null;
    const revealed = companionSlots.find((slot) => slot.familyId === discoveryRevealFamilyId && slot.kind === 'revealed_egg');
    if (!revealed) return null;
    const lockedSlots = companionSlots.map((slot) => slot.familyId === discoveryRevealFamilyId
      ? { id: slot.id, coord: slot.coord, familyId: slot.familyId, kind: 'locked' as const }
      : slot);
    const fromScene = focusedMossproutWorld
      ? buildMossproutHexNeighborhoodScene(lockedSlots, mossproutNatureIslandLevels!, mossproutGarden)
      : buildKingdomHexScene(lockedSlots, hexTileSelection.value, identity, verticalAlignmentSelection.value);
    const fromLayer = fromScene.tileArtLayers.find((layer) => layer.id === revealed.id);
    const toLayer = scene.tileArtLayers.find((layer) => layer.id === revealed.id);
    const tile = scene.tiles.find((candidate) => candidate.id === revealed.id);
    return fromLayer && toLayer && tile ? { fromLayer, tile, toLayer } : null;
  }, [companionSlots, discoveryRevealFamilyId, focusedMossproutWorld, hexTileSelection, identity, mossproutGarden, mossproutNatureIslandLevels, scene.tileArtLayers, scene.tiles, verticalAlignmentSelection]);
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
  const gardenLayer = useMemo(() => scene.tileArtLayers.find(
    (layer) => layer.id === 'structure:mossprout-hex-garden',
  ) ?? null, [scene.tileArtLayers]);
  const gardenFrame = gardenLayer?.interactionFrame ?? null;
  const gardenFocusFrame = gardenLayer?.frame ?? null;
  const gardenPlotFrames = useMemo(() => gardenFocusFrame
    ? MOSSPROUT_GARDEN_PLANT_SLOT_IDS.map((slotId) => ({
        frame: mossproutGardenPlantSlotFrame(gardenFocusFrame, slotId),
        slotId,
      }))
    : [], [gardenFocusFrame]);
  const natureIslandFrames = useMemo(() => scene.tileArtLayers.flatMap((layer) => {
    if (!layer.id.startsWith('nature:mossprout:') || layer.id.endsWith(':growth') || !layer.interactionFrame) return [];
    return [{
      frame: layer.interactionFrame,
      islandId: layer.id.slice('nature:mossprout:'.length) as MossproutNatureIslandId,
    }];
  }), [scene.tileArtLayers]);
  const memoryPlantFrames = useMemo(() => scene.tileArtLayers.flatMap((layer) => (
    layer.id.startsWith('plant:') && layer.interactionFrame
      ? [{ frame: layer.interactionFrame, instanceId: layer.id.slice('plant:'.length) }]
      : []
  )), [scene.tileArtLayers]);
  const memoryPlantProjections = useMemo(() => scene.tileArtLayers.flatMap((layer) => {
    if (!layer.id.startsWith('plant:')) return [];
    const instanceId = layer.id.slice('plant:'.length);
    const plant = mossproutGarden?.plantableMemories.find((candidate) => candidate.id === instanceId);
    const definition = plant ? mossproutMemoryPlantById.get(plant.definitionId) : null;
    if (!plant || !definition) return [];
    const stage = mossproutMemoryPlantStage(plant.growthPoints);
    return [{
      color: definition.color,
      frame: layer.frame,
      instanceId,
      source: definition.art[stage],
      visualKey: `${instanceId}:${stage}`,
    }];
  }), [mossproutGarden?.plantableMemories, scene.tileArtLayers]);
  const previousPlantVisualKeysRef = useRef<Set<string> | null>(null);
  const currentPlantVisualKeys = useMemo(
    () => new Set(memoryPlantProjections.map((plant) => plant.visualKey)),
    [memoryPlantProjections],
  );
  const memoryPlantRevealKeys = useMemo(() => {
    const previous = previousPlantVisualKeysRef.current;
    if (!previous) return new Set<string>();
    return new Set(memoryPlantProjections
      .filter((plant) => !previous.has(plant.visualKey))
      .map((plant) => plant.visualKey));
  }, [memoryPlantProjections]);
  useEffect(() => {
    previousPlantVisualKeysRef.current = currentPlantVisualKeys;
  }, [currentPlantVisualKeys]);
  const initialTutorialFocus = useMemo(() => {
    if (!initialTutorialCameraScale || !tutorialCamera || tutorialCamera.kind !== 'focus_target') return null;
    const target = tutorialCamera.target;
    if (target.kind === 'haven_garden_tile') {
      if (!gardenFocusFrame) return null;
      return {
        durationMs: tutorialCamera.durationMs,
        initialScale: initialTutorialCameraScale,
        scale: tutorialCamera.zoom ?? initialTutorialCameraScale,
        screenY: viewport.height * (tutorialCamera.anchorY ?? 0.5),
        x: gardenFocusFrame.left + gardenFocusFrame.width / 2,
        y: gardenFocusFrame.top + gardenFocusFrame.height / 2,
      };
    }
    if (target.kind !== 'haven_tile' && target.kind !== 'haven_resident') return null;
    const tile = scene.tiles.find((candidate) => (
      candidate.kind === 'companion'
      && candidate.companion?.familyId === target.characterId
    ));
    if (!tile) return null;
    const residentAnchor = target.kind === 'haven_resident' || tile.companion?.kind === 'revealed_egg'
      ? scene.tileArtLayers.find((layer) => layer.id === tile.id)?.residentAnchor
      : null;
    const eggGrowthScale = 0.5
      + eggVisualGrowthForEnergyRatio(worldSubjectPresentation?.growthProgress ?? 0) * 0.5;
    return {
      durationMs: tutorialCamera.durationMs,
      initialScale: initialTutorialCameraScale,
      scale: tutorialCamera.zoom ?? initialTutorialCameraScale,
      screenY: viewport.height * (tutorialCamera.anchorY ?? 0.5),
      x: residentAnchor?.x ?? tile.cx,
      y: residentAnchor
        ? target.kind === 'haven_resident'
          ? mossproutDialogueSubjectCenterY(residentAnchor.y)
          : residentAnchor.y - 8 - WORLD_FTUE_EGG_HEIGHT * eggGrowthScale / 2
        : tile.cy,
    };
  }, [gardenFocusFrame, initialTutorialCameraScale, scene.tileArtLayers, scene.tiles, tutorialCamera, viewport.height, worldSubjectPresentation?.growthProgress]);
  const tutorialCameraKey = tutorialCamera
    ? `${JSON.stringify(tutorialCamera)}:${worldSubjectPresentation?.growthProgress ?? 'none'}`
    : 'none';
  const residentInteractionScreenAnchorY = interactionResidentAnchorY ?? (tutorialCamera?.kind === 'focus_target'
    ? tutorialCamera.anchorY ?? MOSSPROUT_DIALOGUE_SCREEN_ANCHOR_Y
    : REGULAR_RESIDENT_INTERACTION_SCREEN_ANCHOR_Y);
  // The first opening directive is started inside camera initialization so
  // the first drawable frame is already moving. Mark it applied here to keep
  // the post-ready effect from restarting the same zoom.
  const appliedTutorialCameraRef = useRef(initialTutorialFocus ? `${tutorialCameraKey}:0` : 'none');
  const initialInteractionFocus = useMemo(() => {
    if (!interactionResidentId) return null;
    const tile = scene.tiles.find((candidate) => (
      candidate.kind === 'companion'
      && candidate.companion?.kind === 'owned'
      && candidate.companion.creature.creatureId === interactionResidentId
    ));
    if (!tile) return null;
    const residentAnchor = scene.tileArtLayers.find((layer) => layer.id === tile.id)?.residentAnchor;
    const isMossprout = tile.companion?.familyId === 'mossprout';
    const subjectFrame = residentAnchor
      ? residentCreatureFrame(residentAnchor.x, residentAnchor.y, creatureWorldSize, isMossprout)
      : null;
    return {
      scale: cameraMaximumScale ?? KINGDOM_RENDERING.havenMaxScale,
      screenY: viewport.height * residentInteractionScreenAnchorY,
      x: subjectFrame ? subjectFrame.left + subjectFrame.width / 2 : tile.cx,
      y: subjectFrame ? subjectFrame.top + subjectFrame.height / 2 : tile.cy,
    };
  }, [cameraMaximumScale, creatureWorldSize, interactionResidentId, residentInteractionScreenAnchorY, scene.tileArtLayers, scene.tiles, viewport.height]);
  const havenStorySurface = useContentFlowSurface('haven');
  const storyCameraInputLocked = havenStorySurface.pendingWork.kind === 'presentation'
    && havenStorySurface.pendingWork.presentationType === STORY_CAMERA_PRESENTATION
    && (havenStorySurface.pendingWork.payload as StoryCameraPresentationPayload).lockInput !== false;
  const camera = useKingdomHexCamera({
    center: { x: scene.centerTile.cx, y: scene.centerTile.cy },
    centerId: scene.centerTile.id,
    initialFitWorld: focusedMossproutWorld,
    initialFocus: initialTutorialFocus ?? initialInteractionFocus,
    initialSnapshot: initialCameraSnapshot,
    interactionEnabled: interactionEnabled && !cameraLocked && !upgradePresentation && !storyCameraInputLocked,
    magneticFocus: presentation?.focusMode === 'magnetic'
      ? {
          anchorY: presentation.snapAnchorY,
          durationMs: presentation.snapDurationMs,
          enabled: !upgradePresentation,
          reducedMotion: reduceMotion,
          targets: focusTargets,
        }
      : undefined,
    minimumScale: focusedMossproutWorld ? 0.28 : undefined,
    maximumScale: cameraMaximumScale,
    onSnapshotChange: onCameraSnapshotChange,
    onMotionChange: onCameraMotionChange,
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
  const fitTutorialWorld = camera.fitWorld;
  const focusTutorialResident = camera.focusResident;
  const animateToCameraSnapshot = camera.animateToSnapshot;
  const readLiveCameraSnapshot = camera.getSnapshot;
  const tutorialCameraReady = camera.ready;
  useEffect(() => {
    if (!tutorialCamera) {
      appliedTutorialCameraRef.current = 'none';
      return;
    }
    // Projection-only directives establish a deterministic camera after a
    // cold launch. Their live transitions are owned by Content Flow and must
    // never restart from this legacy compatibility effect.
    if (tutorialCamera.kind === 'focus_target' && tutorialCamera.projectionOnly) return;
    const applicationKey = `${tutorialCameraKey}:${cameraRestoreNonce}`;
    if (!tutorialCameraReady || appliedTutorialCameraRef.current === applicationKey) return;
    appliedTutorialCameraRef.current = applicationKey;
    const durationMs = tutorialCamera.durationMs;
    if (tutorialCamera.kind === 'fit_targets') {
      fitTutorialWorld(durationMs);
      return;
    }
    const target = tutorialCamera.target;
    const targetCharacterId = target.kind === 'haven_tile' || target.kind === 'haven_resident'
      ? target.characterId
      : null;
    if (target.kind === 'haven_gateway') {
      const frame = scene.tileArtLayers.find((layer) => layer.id === 'structure:steppling-home')?.frame;
      if (frame) focusTutorialResident(frame.left + frame.width / 2, frame.top + frame.height / 2, { anchorY: tutorialCamera.anchorY, durationMs, zoom: tutorialCamera.zoom });
      return;
    }
    if (target.kind === 'haven_garden_tile' && gardenFrame) {
      focusTutorialResident(
        gardenFrame.left + gardenFrame.width / 2,
        gardenFrame.top + gardenFrame.height / 2,
        {
          anchorY: tutorialCamera.anchorY,
          durationMs,
          zoom: tutorialCamera.zoom,
        },
      );
      return;
    }
    const tile = target.kind === 'haven_home'
      ? sceneHomeTile
      : targetCharacterId
        ? scene.tiles.find((candidate) => (
            candidate.kind === 'companion'
            && candidate.companion?.familyId === targetCharacterId
          ))
        : null;
    if (!tile) return;
    const residentAnchor = target.kind === 'haven_resident' || tile.companion?.kind === 'revealed_egg'
      ? scene.tileArtLayers.find((layer) => layer.id === tile.id)?.residentAnchor
      : null;
    const eggGrowthScale = 0.5
      + eggVisualGrowthForEnergyRatio(worldSubjectPresentation?.growthProgress ?? 0) * 0.5;
    const subjectCenterY = residentAnchor
      ? target.kind === 'haven_resident'
        ? mossproutDialogueSubjectCenterY(residentAnchor.y)
        : residentAnchor.y - 8 - WORLD_FTUE_EGG_HEIGHT * eggGrowthScale / 2
      : tile.cy;
    focusTutorialResident(residentAnchor?.x ?? tile.cx, subjectCenterY, {
      anchorY: tutorialCamera.anchorY,
      durationMs,
      zoom: tutorialCamera.zoom,
    });
  }, [cameraRestoreNonce, fitTutorialWorld, focusTutorialResident, gardenFrame, scene.tileArtLayers, scene.tiles, sceneHomeTile, tutorialCamera, tutorialCameraKey, tutorialCameraReady, worldSubjectPresentation?.growthProgress]);
  const storyCameraSnapshotsRef = useRef(new Map<string, KingdomCameraSnapshot>());
  const storyTargetFrame = useCallback((target: StoryTarget) => {
    if (target.kind === 'haven_world') return { left: 0, top: 0, width: scene.width, height: scene.height };
    if (target.kind === 'haven_home') {
      const layer = scene.tileArtLayers.find((candidate) => candidate.id === sceneHomeTile.id);
      return layer?.frame ?? { left: sceneHomeTile.cx - HEX_TILE_W / 2, top: sceneHomeTile.cy - HEX_TILE_H / 2, width: HEX_TILE_W, height: HEX_TILE_H };
    }
    if (target.kind === 'haven_nature_island') return natureIslandFrames.find((candidate) => candidate.islandId === target.islandId)?.frame ?? null;
    if (target.kind === 'haven_structure') return scene.tileArtLayers.find((candidate) => candidate.id === target.structureId || candidate.id === `structure:${target.structureId}`)?.frame ?? null;
    if (target.kind === 'haven_garden_plot') return gardenPlotFrames.find((candidate) => candidate.slotId === target.slotId)?.frame ?? null;
    if (target.kind === 'haven_tile' || target.kind === 'haven_resident') {
      const tile = scene.tiles.find((candidate) => candidate.kind === 'companion' && candidate.companion?.familyId === target.familyId);
      if (!tile) return null;
      const layer = scene.tileArtLayers.find((candidate) => candidate.id === tile.id);
      if (target.kind === 'haven_resident' && layer?.residentAnchor) {
        const size = creatureWorldSize;
        return { left: layer.residentAnchor.x - size / 2, top: layer.residentAnchor.y - size / 2, width: size, height: size };
      }
      return layer?.frame ?? { left: tile.cx - HEX_TILE_W / 2, top: tile.cy - HEX_TILE_H / 2, width: HEX_TILE_W, height: HEX_TILE_H };
    }
    return null;
  }, [creatureWorldSize, gardenPlotFrames, natureIslandFrames, scene.height, scene.tileArtLayers, scene.tiles, scene.width, sceneHomeTile]);
  const havenTargetRegistry = useMemo(() => storyTargetRegistry('haven'), []);
  const registeredStoryTargets = useMemo<StoryTarget[]>(() => [
    { kind: 'haven_world' },
    { kind: 'haven_home' },
    ...scene.tiles.flatMap<StoryTarget>((tile) => tile.kind === 'companion' && tile.companion?.familyId
      ? [{ kind: 'haven_tile', familyId: tile.companion.familyId }, { kind: 'haven_resident', familyId: tile.companion.familyId }]
      : []),
    ...scene.tileArtLayers.flatMap<StoryTarget>((layer) => layer.id.startsWith('structure:')
      ? [{ kind: 'haven_structure', structureId: layer.id.slice('structure:'.length) }]
      : []),
    ...natureIslandFrames.map<StoryTarget>((entry) => ({ kind: 'haven_nature_island', islandId: entry.islandId })),
    ...gardenPlotFrames.map<StoryTarget>((entry) => ({ kind: 'haven_garden_plot', slotId: entry.slotId })),
  ], [gardenPlotFrames, natureIslandFrames, scene.tileArtLayers, scene.tiles]);
  useEffect(() => {
    const unregister = registeredStoryTargets.flatMap((target) => {
      const frame = storyTargetFrame(target);
      return frame ? [havenTargetRegistry.register(target, { frame, interactive: true, ready: tutorialCameraReady })] : [];
    });
    return () => unregister.forEach((remove) => remove());
  }, [havenTargetRegistry, registeredStoryTargets, storyTargetFrame, tutorialCameraReady]);
  useStoryPresentationOperation('haven', STORY_CAMERA_PRESENTATION, async (work, _run, signal) => {
    const payload = work.payload as StoryCameraPresentationPayload;
    if (payload.operation === 'preserve') {
      if (payload.holdWorldState) {
        setStorySceneGuard((current) => current?.key === work.key
          ? current
          : { key: work.key, scene: committedScene });
        // Do not acknowledge the pre-commit operation until React has mounted
        // the frozen scene. The following persistence effect may publish its
        // new level immediately after this acknowledgement.
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      return;
    }
    if (payload.operation === 'restore') {
      const snapshot = payload.snapshotId ? storyCameraSnapshotsRef.current.get(payload.snapshotId) : null;
      if (!snapshot) throw new Error(`Camera snapshot ${payload.snapshotId ?? ''} is not available`);
      await new Promise<void>((resolve) => camera.animateToSnapshot(snapshot, reduceMotion ? 0 : payload.durationMs, resolve));
      return;
    }
    const targets = payload.operation === 'focus' && payload.target ? [payload.target] : payload.targets ?? [];
    await waitForStoryTargets(havenTargetRegistry, targets);
    if (signal.aborted) return;
    const frames = targets.map(storyTargetFrame);
    if (!frames.length || frames.some((frame) => !frame)) throw new Error('The authored camera target is not ready');
    if (!storyCameraSnapshotsRef.current.has('entry')) storyCameraSnapshotsRef.current.set('entry', readLiveCameraSnapshot());
    if (payload.operation === 'focus' && frames.length === 1 && payload.target?.kind !== 'haven_world') {
      const frame = frames[0]!;
      await new Promise<void>((resolve) => camera.focusResident(
        frame.left + frame.width / 2,
        frame.top + frame.height / 2,
        { anchorY: payload.anchorY, durationMs: reduceMotion ? 0 : payload.durationMs, zoom: payload.zoom, onComplete: resolve },
      ));
      return;
    }
    const concrete = frames as { left: number; top: number; width: number; height: number }[];
    const left = Math.min(...concrete.map((frame) => frame.left));
    const top = Math.min(...concrete.map((frame) => frame.top));
    const right = Math.max(...concrete.map((frame) => frame.left + frame.width));
    const bottom = Math.max(...concrete.map((frame) => frame.top + frame.height));
    await new Promise<void>((resolve) => camera.focusFrame(
      { left, top, width: right - left, height: bottom - top },
      { durationMs: reduceMotion ? 0 : payload.durationMs, horizontalPadding: payload.padding, verticalPadding: payload.padding, onComplete: resolve },
    ));
  }, tutorialCameraReady && storyOperationsEnabled);
  useEffect(() => {
    if (!upgradePresentation || !storySceneGuard) return;
    // The receipt-backed presentation now reconstructs the same from-state,
    // so it can take over without changing a single rendered frame.
    setStorySceneGuard(null);
  }, [storySceneGuard, upgradePresentation]);
  const tileUpgradeOfferFrame = tileUpgradeOffer
    ? storyTargetFrame(tileUpgradeOffer.target)
    : null;
  const tileUpgradeOfferNodeRef = useRef<ViewType | null>(null);
  const tileUpgradeOfferTargetCallbackRef = useRef(onTileUpgradeOfferTargetChange);
  tileUpgradeOfferTargetCallbackRef.current = onTileUpgradeOfferTargetChange;
  const cameraMovingRef = useRef(camera.isMoving);
  cameraMovingRef.current = camera.isMoving;
  const setTileUpgradeOfferNode = useCallback((node: ViewType | null) => {
    tileUpgradeOfferNodeRef.current = node;
    tileUpgradeOfferTargetCallbackRef.current?.(cameraMovingRef.current ? null : node);
  }, []);
  useEffect(() => {
    // A world-space control moves without receiving a new layout event while
    // the camera animates. Unregister it during motion, then publish its final
    // native position so a screen-space spotlight never measures stale bounds.
    tileUpgradeOfferTargetCallbackRef.current?.(
      camera.isMoving ? null : tileUpgradeOfferNodeRef.current,
    );
  }, [camera.isMoving, tileUpgradeOffer]);
  const focusedInteractionResidentRef = useRef<string | null>(null);
  const interactionOriginSnapshotRef = useRef<KingdomCameraSnapshot | null>(null);
  useEffect(() => {
    if (!interactionResidentId) {
      focusedInteractionResidentRef.current = null;
      interactionOriginSnapshotRef.current = null;
      return;
    }
    const interactionFocusKey = `${interactionResidentId}:${cameraRestoreNonce}`;
    if (!tutorialCameraReady || focusedInteractionResidentRef.current === interactionFocusKey) return;
    const tile = scene.tiles.find((candidate) => (
      candidate.kind === 'companion'
      && candidate.companion?.kind === 'owned'
      && candidate.companion.creature.creatureId === interactionResidentId
    ));
    if (!tile) return;
    interactionOriginSnapshotRef.current ??= readLiveCameraSnapshot();
    focusedInteractionResidentRef.current = interactionFocusKey;
    const residentAnchor = scene.tileArtLayers.find((layer) => layer.id === tile.id)?.residentAnchor;
    const isMossprout = tile.companion?.familyId === 'mossprout';
    const subjectFrame = residentAnchor
      ? residentCreatureFrame(residentAnchor.x, residentAnchor.y, creatureWorldSize, isMossprout)
      : null;
    focusTutorialResident(
      subjectFrame ? subjectFrame.left + subjectFrame.width / 2 : tile.cx,
      subjectFrame ? subjectFrame.top + subjectFrame.height / 2 : tile.cy,
      {
      anchorY: residentInteractionScreenAnchorY,
      durationMs: reduceMotion ? 80 : 520,
      onComplete: () => onResidentFocusComplete?.(interactionResidentId),
      zoom: cameraMaximumScale ?? KINGDOM_RENDERING.havenMaxScale,
    });
  }, [cameraMaximumScale, cameraRestoreNonce, creatureWorldSize, focusTutorialResident, interactionResidentId, onResidentFocusComplete, readLiveCameraSnapshot, reduceMotion, residentInteractionScreenAnchorY, scene.tileArtLayers, scene.tiles, tutorialCameraReady]);
  const handledInteractionExitNonceRef = useRef(0);
  useEffect(() => {
    if (!interactionResidentId || interactionExitNonce <= handledInteractionExitNonceRef.current) return;
    handledInteractionExitNonceRef.current = interactionExitNonce;
    const interactionOrigin = interactionOriginSnapshotRef.current;
    if (interactionOrigin) {
      animateToCameraSnapshot(interactionOrigin, reduceMotion ? 80 : 440, () => {
        interactionOriginSnapshotRef.current = null;
        onInteractionExitFocusComplete?.();
      });
      return;
    }
    const tile = scene.tiles.find((candidate) => (
      candidate.kind === 'companion'
      && candidate.companion?.kind === 'owned'
      && candidate.companion.creature.creatureId === interactionResidentId
    ));
    if (!tile) {
      onInteractionExitFocusComplete?.();
      return;
    }
    const residentAnchor = scene.tileArtLayers.find((layer) => layer.id === tile.id)?.residentAnchor;
    focusTutorialResident(residentAnchor?.x ?? tile.cx, residentAnchor?.y ?? tile.cy, {
      anchorY: 0.48,
      durationMs: reduceMotion ? 80 : 440,
      onComplete: onInteractionExitFocusComplete,
      zoom: KINGDOM_RENDERING.havenMaxScale,
    });
  }, [animateToCameraSnapshot, focusTutorialResident, interactionExitNonce, interactionResidentId, onInteractionExitFocusComplete, reduceMotion, scene.tileArtLayers, scene.tiles]);
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
      // The parent commits the new scene and clears the presentation in the
      // same turn. Retain this already-visible top layer until the persistent
      // tile beneath it confirms that its new source has loaded and faded in.
      setSettlingUpgrade({ layers, nonce: presentation.nonce });
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
    if (presentation.cameraAlreadyFocused) afterFocus();
    else upgradeFocusRef.current(layers.tile.cx, layers.tile.cy, motionReduced, afterFocus);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [upgradePresentation?.nonce, upgradePresentation?.status]);

  const finishSettlingUpgrade = useCallback((nonce: number) => {
    if (settlingUpgradeTimerRef.current) clearTimeout(settlingUpgradeTimerRef.current);
    settlingUpgradeTimerRef.current = setTimeout(() => {
      settlingUpgradeTimerRef.current = null;
      setSettlingUpgrade((current) => current?.nonce === nonce ? null : current);
    }, KINGDOM_RENDERING.imageCrossfadeMs + 34);
  }, []);

  useEffect(() => {
    if (!settlingUpgrade) return;
    // A changed overlay can disappear rather than load a replacement source.
    // Keep a bounded fallback so that case cannot retain an inert layer.
    const timer = setTimeout(() => finishSettlingUpgrade(settlingUpgrade.nonce), 1_000);
    return () => clearTimeout(timer);
  }, [finishSettlingUpgrade, settlingUpgrade]);

  const cameraSnapshot = camera.snapshot;
  const upgradeEffectGeometry = useMemo(() => {
    if (!upgradeLayers) return null;
    const screenRect = (frame: { height: number; left: number; top: number; width: number }) => ({
      height: frame.height * cameraSnapshot.scale,
      left: scene.width / 2 + cameraSnapshot.tx + (frame.left - scene.width / 2) * cameraSnapshot.scale,
      top: scene.height / 2 + cameraSnapshot.ty + (frame.top - scene.height / 2) * cameraSnapshot.scale,
      width: frame.width * cameraSnapshot.scale,
    });
    const screenFrame = (layer: KingdomTileArtLayer) => screenRect(layer.frame);
    const visibleFrame = (layer: KingdomTileArtLayer) => {
      const frame = screenFrame(layer);
      const left = frame.left + (layer.alphaBounds.left / layer.sourceSize.width) * frame.width;
      const top = frame.top + (layer.alphaBounds.top / layer.sourceSize.height) * frame.height;
      return {
        height: frame.top + (layer.alphaBounds.bottom / layer.sourceSize.height) * frame.height - top,
        left,
        top,
        width: frame.left + (layer.alphaBounds.right / layer.sourceSize.width) * frame.width - left,
      };
    };
    const fromVisible = upgradeLayers.fromLayer.interactionFrame
      ? screenRect(upgradeLayers.fromLayer.interactionFrame)
      : visibleFrame(upgradeLayers.fromLayer);
    const toVisible = upgradeLayers.toLayer.interactionFrame
      ? screenRect(upgradeLayers.toLayer.interactionFrame)
      : visibleFrame(upgradeLayers.toLayer);
    const left = Math.min(fromVisible.left, toVisible.left);
    const top = Math.min(fromVisible.top, toVisible.top);
    const right = Math.max(fromVisible.left + fromVisible.width, toVisible.left + toVisible.width);
    const bottom = Math.max(fromVisible.top + fromVisible.height, toVisible.top + toVisible.height);
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

  const revealedEggProjection = useMemo(() => {
    const tile = scene.tiles.find((candidate) => (
      candidate.kind === 'companion' && candidate.companion?.kind === 'revealed_egg'
    ));
    if (!tile || tile.companion?.kind !== 'revealed_egg') return null;
    const residentAnchor = artLayerById.get(tile.id)?.residentAnchor ?? { x: tile.cx, y: tile.cy };
    return {
      eggSkinId: tile.companion.eggSkinId,
      familyId: tile.companion.familyId,
      x: residentAnchor.x,
      y: residentAnchor.y - 8,
    };
  }, [artLayerById, scene.tiles]);

  const interactionResidentProjection = useMemo(() => {
    if (!interactionResidentId) return null;
    const tile = scene.tiles.find((candidate) => (
      candidate.kind === 'companion'
      && candidate.companion?.kind === 'owned'
      && candidate.companion.creature.creatureId === interactionResidentId
    ));
    if (!tile || tile.companion?.kind !== 'owned') return null;
    const artLayer = artLayerById.get(tile.id);
    const anchor = artLayer?.residentAnchor ?? kingdomWorldViewPoint(
      { x: tile.cx, y: tile.cy },
      kingdomWorldViewConfig.katchimera,
    );
    const stableWorldPresentation = tile.companion.familyId === 'mossprout';
    return {
      creature: tile.companion.creature,
      frame: residentCreatureFrame(anchor.x, anchor.y, creatureWorldSize, stableWorldPresentation),
      source: artLayer?.residentSource,
    };
  }, [artLayerById, creatureWorldSize, interactionResidentId, scene.tiles]);

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
        continue;
      }
      // The active interaction subject is drawn outside the transformed world
      // below. Keeping the small world copy here would both duplicate it and
      // preserve the blurry camera-scaled raster that FTUE already avoids.
      if (tile.companion.creature.creatureId === interactionResidentId) continue;
      const { x, y } = artLayer?.residentAnchor ?? kingdomWorldViewPoint(
        { x: tile.cx, y: tile.cy },
        kingdomWorldViewConfig.katchimera
      );
      const stableWorldPresentation = tile.companion.familyId === 'mossprout';
      const residentInteractionEnabled = interactionEnabled || allowedResidentCharacterId === tile.companion.familyId;
      items.push({
        depth: hexDrawDepth({ x, y }, 4),
        node: (
          <ResidentCreature
            animated={stableWorldPresentation || interactionResidentId === tile.companion.creature.creatureId}
            celebrationNonce={
              interactionResidentId === tile.companion.creature.creatureId && interactionRewardPulseKey > 0
                ? 1_000_000 + interactionRewardPulseKey
              : upgradePresentation?.creatureId === tile.companion.creature.creatureId
              && (upgradePhase === 'react' || upgradePhase === 'complete')
                ? upgradePresentation.nonce
                : undefined
            }
            disabled={!residentInteractionEnabled}
            focusAnchorX={tile.cx}
            focusAnchorY={tile.cy}
            focusScale={focusScale}
            key={`creature-${tile.id}`}
            meditating={tile.companion.familyId === 'mossprout' && mossproutMeditating}
            source={artLayer?.residentSource}
            stableWorldPresentation={stableWorldPresentation}
            tile={tile}
            x={x}
            y={y}
            statusGlyph={residentStatusGlyphs?.[tile.companion.creature.creatureId] === 'ready' ? undefined : residentStatusGlyphs?.[tile.companion.creature.creatureId]}
            worldSize={creatureWorldSize}
            onFocus={residentInteractionEnabled ? camera.focusResident : ignoreFocus}
            onSelectResident={residentInteractionEnabled ? onSelectResident : undefined}
          />
        ),
      });
    }

    return items.sort((a, b) => a.depth - b.depth).map((item) => item.node);
  }, [allowedResidentCharacterId, artLayerById, camera.focusResident, creatureWorldSize, highlightedLockedFamilyId, ignoreFocus, interactionEnabled, interactionResidentId, interactionRewardPulseKey, mossproutMeditating, onSelectLocked, onSelectResident, residentStatusGlyphs, scene.tiles, tileFocusScale, upgradePhase, upgradePresentation]);

  const home = homePreset(identity?.selectedHomeArchetypeId);

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
              // Memory plants are drawn on oversized, screen-projected native
              // surfaces below. A second camera-scaled copy here would soften
              // when the Garden is focused and can briefly double the reveal.
              if (layer.id.startsWith('plant:')) return null;
              const source = kingdomHexTileSourceForLod(layer, sceneTileImageLod);
              const overlaySource = kingdomHexTileOverlaySourceForLod(layer, sceneTileImageLod);
              const fallbackSource = layer.fallbackSource
                ? kingdomHexTileSourceForLod(
                    { source: layer.fallbackSource, sources: layer.fallbackSources },
                    sceneTileImageLod
                  )
                : null;
              const upgradeOwnsLayer = Boolean(
                upgradeLayers
                && upgradePresentation
                && layer.id === upgradeLayers.tile.id
                && havenUpgradeLayerArtChanges(upgradeLayers.fromLayer, upgradeLayers.toLayer, sceneTileImageLod),
              );
              const settlingOwnsLayer = Boolean(
                settlingUpgrade
                && layer.id === settlingUpgrade.layers.tile.id
                && havenUpgradeLayerArtChanges(
                  settlingUpgrade.layers.fromLayer,
                  settlingUpgrade.layers.toLayer,
                  sceneTileImageLod,
                )
              );
              const transitionLayers = upgradeOwnsLayer
                ? upgradeLayers
                : settlingOwnsLayer
                  ? settlingUpgrade?.layers ?? null
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
                    onReady={settlingOwnsLayer && settlingUpgrade
                      ? () => finishSettlingUpgrade(settlingUpgrade.nonce)
                      : undefined}
                    priority={layer.id === scene.centerTile.id || layer.id === 'structure:mossprout-hex-garden' ? 'high' : 'normal'}
                  />
                  {transitionLayers ? (
                    <HavenUpgradeTileArt
                      fromLayer={transitionLayers.fromLayer}
                      imageLod={sceneTileImageLod}
                      phase={upgradeOwnsLayer ? upgradePhase : 'complete'}
                      reducedMotion={reduceMotion}
                      toLayer={transitionLayers.toLayer}
                    />
                  ) : null}
                  {discoveryLayers && layer.id === discoveryLayers.tile.id && discoveryPhase !== 'complete' ? (
                    <HavenUpgradeTileArt
                      fromLayer={discoveryLayers.fromLayer}
                      imageLod={sceneTileImageLod}
                      phase={discoveryPhase}
                      reducedMotion={reduceMotion}
                      toLayer={discoveryLayers.toLayer}
                    />
                  ) : null}
                </Fragment>
              );
            })}
            {focusedMossproutWorld && onGardenPlotTargetChange
              ? gardenPlotFrames.map(({ frame, slotId }) => (
                  <GardenPlotTarget
                    frame={frame}
                    key={`garden-plot-target-${slotId}`}
                    onTargetChange={onGardenPlotTargetChange}
                    slotId={slotId}
                  />
                ))
              : null}
            {interactionEnabled
              && !camera.isMoving
              && !upgradePresentation
              && tileUpgradeOffer
              && tileUpgradeOfferFrame ? (
                <TileUpgradeOffer
                  frame={tileUpgradeOfferFrame}
                  offer={tileUpgradeOffer}
                  onPress={onTileUpgradeOfferPress}
                  targetRef={setTileUpgradeOfferNode}
                />
              ) : null}
            {focusedMossproutWorld && interactionEnabled && !upgradePresentation && gardenFrame && onOpenGarden
              ? gardenOrders.slice(0, 3).map((entry, index) => (
                  <GardenOrderShortcut
                    callout={gardenOrdersInteractive ? false : gardenOrderCallout}
                    entry={entry}
                    frame={gardenFrame}
                    index={index}
                    key={`garden-order-shortcut-${entry.id}`}
                    onPress={gardenOrdersInteractive ? () => onOpenGarden(entry.order.id) : undefined}
                    onTargetChange={onGardenOrderTargetChange}
                    slotOverride={gardenOrdersInteractive ? undefined : FTUE_GARDEN_ORDER_SLOT}
                  />
                ))
              : null}
            {focusedMossproutWorld && interactionEnabled && !upgradePresentation ? natureIslandFrames.map(({ frame, islandId }) => {
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
            {focusedMossproutWorld && mossproutGarden?.gateway ? scene.tileArtLayers.filter((layer) => layer.id === 'structure:steppling-home').map((layer) => (
              <Pressable ref={onGatewayTargetChange} collapsable={false} key="steppling-home" accessibilityRole="button" accessibilityLabel={mossproutGarden.gateway === 'locked' ? 'Misty clearing, clear mist for 40 Glow' : 'A new friend is resting here'} onPress={interactionEnabled && !upgradePresentation ? onSelectGateway : undefined} style={[styles.natureIslandHitTarget, layer.frame]}>
              </Pressable>
            )) : null}
            {focusedMossproutWorld && interactionEnabled && !upgradePresentation && onSelectMemoryPlant
              ? memoryPlantFrames.map(({ frame, instanceId }) => (
                  <Pressable
                    accessibilityHint="Shows what this memory means and how it has grown"
                    accessibilityLabel="Open planted memory"
                    accessibilityRole="button"
                    key={`memory-plant-hit-target-${instanceId}`}
                    onPress={() => onSelectMemoryPlant(instanceId)}
                    style={[styles.natureIslandHitTarget, frame]}
                  />
                ))
              : null}
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
      {revealedEggProjection ? (
        <RevealedCompanionEgg
          cameraScale={camera.scaleValue}
          cameraTranslateX={camera.translationXValue}
          cameraTranslateY={camera.translationYValue}
          eggSkinId={revealedEggProjection.eggSkinId}
          onPress={interactionEnabled ? () => onSelectLocked?.(revealedEggProjection.familyId) : undefined}
          presentation={worldSubjectPresentation}
          sceneHeight={scene.height}
          sceneWidth={scene.width}
          targetRef={worldEggTargetRef}
          x={revealedEggProjection.x}
          y={revealedEggProjection.y}
        />
      ) : null}
      {interactionResidentProjection ? (
        <ProjectedResidentCreature
          cameraMoving={camera.isMoving}
          cameraScale={camera.scaleValue}
          cameraTranslateX={camera.translationXValue}
          cameraTranslateY={camera.translationYValue}
          creature={interactionResidentProjection.creature}
          frame={interactionResidentProjection.frame}
          meditating={mossproutMeditating}
          rewardPulseKey={interactionRewardPulseKey}
          sceneHeight={scene.height}
          sceneWidth={scene.width}
          source={interactionResidentProjection.source}
        />
      ) : null}
      {focusedMossproutWorld && mossproutGarden?.gateway === 'egg' && !upgradePresentation && !storySceneGuard ? (() => {
        const layer = scene.tileArtLayers.find((candidate) => candidate.id === 'structure:steppling-home');
        if (!layer) return null;
        const anchor = layer.residentAnchor ?? { x: layer.frame.left + layer.frame.width / 2, y: layer.frame.top + layer.frame.height / 2 };
        return <RevealedCompanionEgg idleDiscovery eggSkinId="classic"
          cameraScale={camera.scaleValue} cameraTranslateX={camera.translationXValue} cameraTranslateY={camera.translationYValue}
          sceneHeight={scene.height} sceneWidth={scene.width} x={anchor.x} y={anchor.y}
          onPress={interactionEnabled ? onSelectGateway : undefined} />;
      })() : null}
      {memoryPlantProjections.map((plant) => (
        <ProjectedMemoryPlant
          animateReveal={memoryPlantRevealKeys.has(plant.visualKey)}
          cameraScale={camera.scaleValue}
          cameraTranslateX={camera.translationXValue}
          cameraTranslateY={camera.translationYValue}
          color={plant.color}
          frame={plant.frame}
          key={plant.instanceId}
          sceneHeight={scene.height}
          sceneWidth={scene.width}
          source={plant.source}
          visualKey={plant.visualKey}
        />
      ))}
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
          showCoins={upgradePresentation.showCoins}
          silhouetteFrame={upgradeEffectGeometry.silhouetteFrame}
          silhouetteSource={kingdomHexTileSourceForLod(upgradeLayers.toLayer, sceneTileImageLod)}
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
          silhouetteSource={kingdomHexTileSourceForLod(discoveryLayers.toLayer, sceneTileImageLod)}
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
  onReady?: () => void;
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
  onReady,
}: TileArtProps) {
  return (
    <TileFocusTransform anchorX={focusAnchorX} anchorY={focusAnchorY} frame={frame} scale={focusScale}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <SeamlessWorldImage
          allowDownscaling
          source={source}
          fallbackSource={fallbackSource}
          onReady={onReady}
          priority={priority}
        />
        {overlaySource ? (
          <SeamlessWorldImage
            allowDownscaling
            onReady={onReady}
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
  imageLod,
  phase,
  reducedMotion,
  toLayer,
}: {
  fromLayer: KingdomTileArtLayer;
  imageLod: KingdomHexTileLod;
  phase: HavenUpgradePresentationPhase;
  reducedMotion: boolean;
  toLayer: KingdomTileArtLayer;
}) {
  const revealActive = phase === 'reveal' || phase === 'react' || phase === 'complete';
  // A presentation can be reconstructed while its persisted world commit is
  // publishing. Initialize from the current phase so a remount after reveal
  // can never flash the old art, then only ever move this value forward.
  const revealProgress = useSharedValue(revealActive ? 1 : 0);

  useEffect(() => {
    if (!revealActive) return;
    revealProgress.value = withTiming(1, {
      duration: reducedMotion ? 180 : 480,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [reducedMotion, revealActive, revealProgress]);

  const oldStyle = useAnimatedStyle(() => ({ opacity: 1 - revealProgress.value }));
  const newStyle = useAnimatedStyle(() => ({ opacity: revealProgress.value }));
  const oldSource = kingdomHexTileSourceForLod(fromLayer, imageLod);
  const newSource = kingdomHexTileSourceForLod(toLayer, imageLod);
  const oldOverlaySource = kingdomHexTileOverlaySourceForLod(fromLayer, imageLod);
  const newOverlaySource = kingdomHexTileOverlaySourceForLod(toLayer, imageLod);
  const artChanges = havenUpgradeLayerArtChanges(fromLayer, toLayer, imageLod);

  if (!artChanges) return null;

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

const RevealedCompanionEgg = memo(function RevealedCompanionEgg({
  cameraScale,
  cameraTranslateX,
  cameraTranslateY,
  eggSkinId,
  x,
  y,
  onPress,
  presentation,
  sceneHeight,
  sceneWidth,
  targetRef,
  idleDiscovery = false,
}: {
  cameraScale: SharedValue<number>;
  cameraTranslateX: SharedValue<number>;
  cameraTranslateY: SharedValue<number>;
  eggSkinId: Extract<KingdomHexCompanionSlot, { kind: 'revealed_egg' }>['eggSkinId'];
  x: number;
  y: number;
  onPress?: () => void;
  presentation?: WorldFtueSubjectPresentation | null;
  sceneHeight: number;
  sceneWidth: number;
  targetRef?: RefObject<ViewType | null>;
  idleDiscovery?: boolean;
}) {
  const { equippedFaceId } = useEggAvatar();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const visualGrowth = useSharedValue(eggVisualGrowthForEnergyRatio(presentation?.growthProgress ?? 0));
  const feedbackPulse = useSharedValue(0);
  const feedbackShake = useSharedValue(0);
  const radianceFlare = useSharedValue(0);
  const ripple = useSharedValue(1);
  const rippleEcho = useSharedValue(1);
  const readyShake = useSharedValue(0);
  const readyRipple = useSharedValue(1);
  const hatchShake = useSharedValue(0);
  const hatchPulse = useSharedValue(0);
  const crackOne = useSharedValue(0);
  const crackTwo = useSharedValue(0);
  const eggExit = useSharedValue(presentation?.companionVisible ? 1 : 0);
  const creatureEntry = useSharedValue(presentation?.companionVisible ? 1 : 0);
  const rewardPulse = useSharedValue(0);
  const rewardShake = useSharedValue(0);
  const hatchPhase = presentation?.hatchPresentation?.phase ?? 'idle';
  const feedExpressionSequence = useMemo<readonly EggExpressionCue[]>(() => [
    { faceId: 'big-grin', atMs: 80, durationMs: 180 },
    { faceId: 'happy-squint', atMs: 430, durationMs: 190 },
    { faceId: equippedFaceId, atMs: 900, durationMs: 240 },
  ], [equippedFaceId]);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [opacity]);
  useEffect(() => {
    visualGrowth.value = withTiming(eggVisualGrowthForEnergyRatio(presentation?.growthProgress ?? 0), {
      duration: reduceMotion ? 90 : 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [presentation?.growthProgress, reduceMotion, visualGrowth]);
  const triggerFeedArrivalFeedback = useCallback(() => {
    runRewardArrivalMotion(feedbackPulse, feedbackShake, reduceMotion);
    radianceFlare.value = withSequence(
      withTiming(1, { duration: reduceMotion ? 65 : 90, easing: Easing.out(Easing.cubic) }),
      withDelay(
        reduceMotion ? 90 : 190,
        withTiming(0, { duration: reduceMotion ? 240 : 420, easing: Easing.out(Easing.cubic) }),
      ),
    );
    ripple.value = 0;
    ripple.value = withTiming(1, {
      duration: reduceMotion ? 220 : 420,
      easing: Easing.out(Easing.cubic),
    });
    rippleEcho.value = 0;
    rippleEcho.value = withDelay(
      reduceMotion ? 50 : 120,
      withTiming(1, {
        duration: reduceMotion ? 220 : 420,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [feedbackPulse, feedbackShake, radianceFlare, reduceMotion, ripple, rippleEcho]);
  useEffect(() => {
    if (!presentation?.feedbackKey) return;
    triggerFeedArrivalFeedback();
  }, [presentation?.feedbackKey, triggerFeedArrivalFeedback]);
  useEffect(() => {
    return () => {
      cancelAnimation(feedbackPulse);
      cancelAnimation(feedbackShake);
      cancelAnimation(radianceFlare);
      cancelAnimation(ripple);
      cancelAnimation(rippleEcho);
    };
  }, [feedbackPulse, feedbackShake, radianceFlare, ripple, rippleEcho]);
  useEffect(() => {
    cancelAnimation(readyShake);
    cancelAnimation(readyRipple);
    if ((!presentation?.readyToHatch && !idleDiscovery) || reduceMotion) {
      readyShake.value = withTiming(0, { duration: 120 });
      readyRipple.value = 1;
      return;
    }
    // Preserve the original 3.06-second readiness reminder: a brief organic
    // rattle and one expanding glow ring, followed by a quiet hold.
    readyShake.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 75, easing: Easing.linear }),
        withTiming(-1, { duration: 80, easing: Easing.linear }),
        withTiming(0.65, { duration: 85, easing: Easing.linear }),
        withTiming(-0.35, { duration: 90, easing: Easing.linear }),
        withTiming(0, { duration: 130, easing: Easing.out(Easing.cubic) }),
        withDelay(2_600, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );
    readyRipple.value = 0;
    readyRipple.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
        withDelay(2_639, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(readyShake);
      cancelAnimation(readyRipple);
    };
  }, [idleDiscovery, presentation?.readyToHatch, readyRipple, readyShake, reduceMotion]);
  useEffect(() => {
    cancelAnimation(hatchShake);
    cancelAnimation(hatchPulse);
    if (!presentation?.hatchPresentation) {
      hatchShake.value = 0;
      hatchPulse.value = 0;
      crackOne.value = 0;
      crackTwo.value = 0;
      eggExit.value = withTiming(presentation?.companionVisible ? 1 : 0, { duration: reduceMotion ? 1 : 240 });
      creatureEntry.value = withTiming(presentation?.companionVisible ? 1 : 0, { duration: reduceMotion ? 1 : 320 });
      return;
    }
    const shaking = (hatchPhase === 'preparing' || worldFtueHatchPhaseAtLeast(hatchPhase, 'shaking'))
      && !worldFtueHatchPhaseAtLeast(hatchPhase, 'crossfading_subject');
    hatchShake.value = shaking && !reduceMotion ? withRepeat(withSequence(
      withTiming(1, { duration: 62, easing: Easing.linear }),
      withTiming(-1, { duration: 62, easing: Easing.linear }),
    ), -1, true) : withTiming(0, { duration: 80 });
    hatchPulse.value = shaking ? withRepeat(
      withTiming(1, { duration: reduceMotion ? 240 : 720, easing: Easing.out(Easing.cubic) }),
      -1,
      false,
    ) : 0;
    const cracking = worldFtueHatchPhaseAtLeast(hatchPhase, 'cracking');
    crackOne.value = withTiming(cracking ? 1 : 0, { duration: reduceMotion ? 80 : 260 });
    crackTwo.value = cracking
      ? withDelay(reduceMotion ? 50 : 300, withTiming(1, { duration: reduceMotion ? 80 : 180 }))
      : withTiming(0, { duration: 80 });
    const revealed = worldFtueHatchPhaseAtLeast(hatchPhase, 'crossfading_subject');
    eggExit.value = withTiming(revealed ? 1 : 0, { duration: reduceMotion ? 180 : 500, easing: Easing.out(Easing.cubic) });
    creatureEntry.value = withTiming(revealed ? 1 : 0, { duration: reduceMotion ? 180 : 500, easing: reduceMotion ? Easing.out(Easing.cubic) : Easing.out(Easing.back(1.35)) });
    return () => {
      cancelAnimation(hatchShake);
      cancelAnimation(hatchPulse);
    };
  }, [crackOne, crackTwo, creatureEntry, eggExit, hatchPhase, hatchPulse, hatchShake, presentation?.companionVisible, presentation?.hatchPresentation, reduceMotion]);
  useEffect(() => {
    if (!presentation?.rewardPulseKey) return;
    runRewardArrivalMotion(rewardPulse, rewardShake, reduceMotion);
    return () => {
      cancelAnimation(rewardPulse);
      cancelAnimation(rewardShake);
    };
  }, [presentation?.rewardPulseKey, reduceMotion, rewardPulse, rewardShake]);
  const eggMotionStyle = useAnimatedStyle(() => {
    const shake = feedbackShake.value + readyShake.value + hatchShake.value * 2;
    return {
      opacity: opacity.value,
      transform: [
        // This plane is already in screen coordinates, so the canonical
        // legacy amplitude can be used directly without world-scale dilution.
        { translateX: hatchShake.value * 7 },
        { rotateZ: `${shake * 2.8}deg` },
        { scale: 1 - eggExit.value * 0.82 },
      ],
    };
  });
  const eggNativeSurfaceStyle = useAnimatedStyle(() => ({
    transform: [{
      scale: (0.5 + visualGrowth.value * 0.5)
        * (1 + feedbackPulse.value * 0.045)
        * cameraScale.value
        / WORLD_FTUE_EGG_NATIVE_SURFACE_SCALE,
    }],
  }));
  const eggFadeStyle = useAnimatedStyle(() => ({ opacity: 1 - eggExit.value }));
  const crackOneStyle = useAnimatedStyle(() => ({ opacity: crackOne.value * (1 - crackTwo.value * 0.65) }));
  const crackTwoStyle = useAnimatedStyle(() => ({ opacity: crackTwo.value }));
  const hatchPulseOneStyle = useAnimatedStyle(() => ({
    opacity: (1 - hatchPulse.value) * 0.36 * (1 - eggExit.value),
    transform: [{
      scale: (0.62 + hatchPulse.value * 0.72)
        * cameraScale.value
        / WORLD_FTUE_PULSE_RING_NATIVE_SURFACE_SCALE,
    }],
  }));
  const hatchPulseTwoStyle = useAnimatedStyle(() => ({
    opacity: (1 - hatchPulse.value) * 0.22 * (1 - eggExit.value),
    transform: [{
      scale: (0.86 + hatchPulse.value * 0.72)
        * cameraScale.value
        / WORLD_FTUE_PULSE_RING_NATIVE_SURFACE_SCALE,
    }],
  }));
  const projectedEffectCameraStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cameraScale.value }],
  }));
  const creatureStyle = useAnimatedStyle(() => ({
    opacity: creatureEntry.value,
    transform: [
      { translateX: rewardShake.value * 5.5 },
      { translateY: (1 - creatureEntry.value) * 14 },
      { rotateZ: `${rewardShake.value * 2.2}deg` },
    ],
  }));
  const creatureNativeSurfaceStyle = useAnimatedStyle(() => ({
    transform: [{
      scale: (0.72 + creatureEntry.value * 0.28 + rewardPulse.value * 0.055)
        * cameraScale.value
        / WORLD_FTUE_CREATURE_NATIVE_SURFACE_SCALE,
    }],
  }));
  const rewardGlowStyle = useAnimatedStyle(() => ({
    opacity: rewardPulse.value * 0.84,
    transform: [{ scale: 0.72 + rewardPulse.value * 0.55 }],
  }));
  const hatchGlowStyle = useAnimatedStyle(() => ({
    opacity: creatureEntry.value * 0.72,
    transform: [{ scale: 0.75 + creatureEntry.value * 0.3 }],
  }));
  const width = WORLD_FTUE_EGG_WIDTH;
  const height = WORLD_FTUE_EGG_HEIGHT;
  const creatureNativeWidth = width * WORLD_FTUE_CREATURE_NATIVE_SURFACE_SCALE;
  const creatureNativeHeight = height * WORLD_FTUE_CREATURE_NATIVE_SURFACE_SCALE;
  const creatureRaySize = WORLD_FTUE_HATCH_SUNBURST_SIZE * WORLD_FTUE_CREATURE_NATIVE_SURFACE_SCALE;
  const creatureRewardGlowSize = WORLD_FTUE_REWARD_GLOW_SIZE * WORLD_FTUE_CREATURE_NATIVE_SURFACE_SCALE;
  const hatchPulseRingSize = WORLD_FTUE_EGG_WIDTH * 1.05 * WORLD_FTUE_PULSE_RING_NATIVE_SURFACE_SCALE;
  const hatchPulseRingCenterY = WORLD_FTUE_EGG_HEIGHT * 0.08 + WORLD_FTUE_EGG_WIDTH * 1.05 / 2;
  const projectionStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: sceneWidth / 2
          + cameraTranslateX.value
          + (x - sceneWidth / 2) * cameraScale.value
          - width / 2,
      },
      {
        translateY: sceneHeight / 2
          + cameraTranslateY.value
          + (y - sceneHeight / 2) * cameraScale.value
          - height,
      },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.worldFtueProjectedSubject, { height, width }, projectionStyle]}>
      {presentation?.hatchPresentation ? <>
        <Animated.View pointerEvents="none" style={[styles.worldFtueHatchRing, {
          borderWidth: 2 * WORLD_FTUE_PULSE_RING_NATIVE_SURFACE_SCALE,
          height: hatchPulseRingSize,
          left: (WORLD_FTUE_EGG_WIDTH - hatchPulseRingSize) / 2,
          top: hatchPulseRingCenterY - hatchPulseRingSize / 2,
          width: hatchPulseRingSize,
        }, hatchPulseOneStyle]} />
        <Animated.View pointerEvents="none" style={[styles.worldFtueHatchRing, {
          borderWidth: 2 * WORLD_FTUE_PULSE_RING_NATIVE_SURFACE_SCALE,
          height: hatchPulseRingSize,
          left: (WORLD_FTUE_EGG_WIDTH - hatchPulseRingSize) / 2,
          top: hatchPulseRingCenterY - hatchPulseRingSize / 2,
          width: hatchPulseRingSize,
        }, hatchPulseTwoStyle]} />
      </> : null}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, projectedEffectCameraStyle]}>
        {presentation?.readyToHatch ? <>
          <RotatingRadialSunburst
            baseOpacity={0.9}
            size={WORLD_FTUE_READY_SUNBURST_SIZE}
            style={{
              left: (WORLD_FTUE_EGG_WIDTH - WORLD_FTUE_READY_SUNBURST_SIZE) / 2,
              top: (WORLD_FTUE_EGG_HEIGHT - WORLD_FTUE_READY_SUNBURST_SIZE) / 2,
            }}
          />
          <WorldEggRippleField primary={readyRipple} />
        </> : null}
        <WorldEggRadiance flare={radianceFlare} growth={visualGrowth} />
        {idleDiscovery ? <WorldEggRippleField primary={readyRipple} /> : null}
        <WorldEggRippleField primary={ripple} secondary={rippleEcho} />
      </Animated.View>
      <Animated.View
        renderToHardwareTextureAndroid={false}
        shouldRasterizeIOS={false}
        style={[StyleSheet.absoluteFill, eggMotionStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, eggFadeStyle]}>
        <View collapsable={false} ref={targetRef} style={StyleSheet.absoluteFill}>
        <Pressable accessibilityLabel={idleDiscovery || presentation?.hatchFamilyId === 'steppling' ? 'Discovered Egg' : 'Mossprout Egg'} accessibilityRole="button" disabled={!onPress} onPress={onPress} style={StyleSheet.absoluteFill}>
          <Animated.View
            collapsable={false}
            renderToHardwareTextureAndroid={false}
            shouldRasterizeIOS={false}
            style={[
              styles.worldFtueEggNativeSurface,
              {
                height: height * WORLD_FTUE_EGG_NATIVE_SURFACE_SCALE,
                marginLeft: -width * WORLD_FTUE_EGG_NATIVE_SURFACE_SCALE / 2,
                width: width * WORLD_FTUE_EGG_NATIVE_SURFACE_SCALE,
              },
              eggNativeSurfaceStyle,
            ]}>
            <EggAvatarArtwork
              allowDownscaling={false}
              expressionSequence={
                presentation?.hatchPresentation
                  ? WORLD_FTUE_DISCOVERY_EXPRESSIONS
                  : presentation?.feedExpressionKey
                    ? feedExpressionSequence
                    : undefined
              }
              expressionSequenceKey={
                presentation?.hatchPresentation
                  ? `world-hatch:${presentation.hatchPresentation.animationKey}`
                  : presentation?.feedExpressionKey
                    ? `world-feed:${presentation.feedExpressionKey}`
                    : 'world-sleeping'
              }
              faceId={(presentation?.growthStage ?? 0) > 0 ? 'curious' : 'sleepy'}
              hatId={null}
              heldAccessoryId={null}
              priority="high"
              resolution="high"
              showFace
              skinId={eggSkinId}
              style={StyleSheet.absoluteFill}
              transition={0}
            />
            {presentation?.hatchPresentation ? <>
              <AnimatedExpoImage
                allowDownscaling={false}
                cachePolicy="memory-disk"
                contentFit="contain"
                priority="high"
                source={WORLD_FTUE_CRACK_ONE}
                style={[StyleSheet.absoluteFill, eggAvatarBodyPresentationStyle(eggSkinId), crackOneStyle]}
                transition={0}
              />
              <AnimatedExpoImage
                allowDownscaling={false}
                cachePolicy="memory-disk"
                contentFit="contain"
                priority="high"
                source={WORLD_FTUE_CRACK_TWO}
                style={[StyleSheet.absoluteFill, eggAvatarBodyPresentationStyle(eggSkinId), crackTwoStyle]}
                transition={0}
              />
            </> : null}
          </Animated.View>
        </Pressable>
        </View>
        </Animated.View>
      </Animated.View>
      {presentation?.hatchPresentation || presentation?.companionVisible ? (
        <Animated.View
          collapsable={false}
          pointerEvents="none"
          renderToHardwareTextureAndroid={false}
          shouldRasterizeIOS={false}
          style={[styles.worldFtueCreatureFrame, StyleSheet.absoluteFill, creatureStyle]}>
          <Animated.View
            collapsable={false}
            renderToHardwareTextureAndroid={false}
            shouldRasterizeIOS={false}
            style={[
              styles.worldFtueCreatureNativeSurface,
              {
                height: creatureNativeHeight,
                marginLeft: -creatureNativeWidth / 2,
                width: creatureNativeWidth,
              },
              creatureNativeSurfaceStyle,
            ]}>
            {presentation?.hatchPresentation ? <>
              <RotatingRadialSunburst
                baseOpacity={0.9}
                nativeSurfaceScale={1}
                size={creatureRaySize}
                style={{
                  left: (creatureNativeWidth - creatureRaySize) / 2,
                  top: (creatureNativeHeight - creatureRaySize) / 2,
                }}
              />
              <AnimatedExpoImage
                allowDownscaling={false}
                cachePolicy="memory-disk"
                contentFit="contain"
                priority="high"
                source={WORLD_FTUE_SOFT_GLOW}
                style={[styles.worldFtueHatchGlow, hatchGlowStyle]}
                tintColor={presentation?.hatchFamilyId === 'steppling' ? '#FFD76A' : FTUE_MOSSPROUT_CREATURE.accentColor}
                transition={0}
              />
            </> : null}
            <Animated.View style={[styles.worldFtueRewardGlow, {
              borderWidth: 2 * WORLD_FTUE_CREATURE_NATIVE_SURFACE_SCALE,
              boxShadow: `0 0 ${22 * WORLD_FTUE_CREATURE_NATIVE_SURFACE_SCALE}px rgba(255,193,65,0.72)`,
              height: creatureRewardGlowSize,
              left: (creatureNativeWidth - creatureRewardGlowSize) / 2,
              top: (creatureNativeHeight - creatureRewardGlowSize) / 2,
              width: creatureRewardGlowSize,
            }, rewardGlowStyle]} />
            <CreatureGroundShadow frameSize={creatureNativeWidth} stage="grown" visualKey={presentation?.hatchFamilyId ?? 'mossprout'} widthMultiplier={1.6} />
            <CreatureAnimatedArt
              accessibilityLabel={`${presentation?.hatchFamilyId === 'steppling' ? 'Steppling' : 'Mossprout'} animated`}
              allowDownscaling={false}
              fallbackSource={presentation?.hatchFamilyId === 'steppling' ? require('../../../assets/images/katchimeras/world/square/steppling-standing-resident-512.webp') : WORLD_FTUE_MOSSPROUT_SOURCE}
              onLoad={presentation.onHatchAssetsReady}
              style={StyleSheet.absoluteFill}
              visualKey={presentation?.hatchFamilyId ?? 'mossprout'}
            />
          </Animated.View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
});

function havenUpgradeLayerArtChanges(
  fromLayer: KingdomTileArtLayer,
  toLayer: KingdomTileArtLayer,
  imageLod: KingdomHexTileLod,
) {
  return kingdomHexTileSourceForLod(fromLayer, imageLod) !== kingdomHexTileSourceForLod(toLayer, imageLod)
    || kingdomHexTileOverlaySourceForLod(fromLayer, imageLod) !== kingdomHexTileOverlaySourceForLod(toLayer, imageLod);
}

function WorldEggRippleField({ primary, secondary }: {
  primary: SharedValue<number>;
  secondary?: SharedValue<number>;
}) {
  const ringImage = useImage(WORLD_FTUE_SOFT_RING);
  const canvasSize = 540 * WORLD_FTUE_EGG_STAGE_SCALE;
  const center = canvasSize / 2;
  const primarySize = 304 * WORLD_FTUE_EGG_STAGE_SCALE;
  const secondarySize = 342 * WORLD_FTUE_EGG_STAGE_SCALE;
  const primaryOpacity = useDerivedValue(() => (1 - primary.value) * 0.9);
  const secondaryOpacity = useDerivedValue(() => (1 - (secondary?.value ?? 1)) * 0.58);
  const primaryTransform = useDerivedValue(() => [{ scale: 0.42 + primary.value * 1.02 }]);
  const secondaryTransform = useDerivedValue(() => [{ scale: 0.36 + (secondary?.value ?? 1) * 1.16 }]);
  if (!ringImage) return null;
  return (
    <Canvas pointerEvents="none" style={[styles.worldFtueEggEffectCanvas, {
      height: canvasSize,
      left: (WORLD_FTUE_EGG_WIDTH - canvasSize) / 2,
      top: (WORLD_FTUE_EGG_HEIGHT - canvasSize) / 2,
      width: canvasSize,
    }]}>
      <Group opacity={primaryOpacity} origin={vec(center, center)} transform={primaryTransform}>
        <SkiaImage fit="contain" height={primarySize} image={ringImage} width={primarySize} x={(canvasSize - primarySize) / 2} y={(canvasSize - primarySize) / 2}>
          <BlendColor color={WORLD_FTUE_GLOW_ACCENT} mode="srcIn" />
        </SkiaImage>
      </Group>
      {secondary ? <Group opacity={secondaryOpacity} origin={vec(center, center)} transform={secondaryTransform}>
        <SkiaImage fit="contain" height={secondarySize} image={ringImage} width={secondarySize} x={(canvasSize - secondarySize) / 2} y={(canvasSize - secondarySize) / 2}>
          <BlendColor color={WORLD_FTUE_GLOW_CORE} mode="srcIn" />
        </SkiaImage>
      </Group> : null}
    </Canvas>
  );
}

function WorldEggRadiance({ flare, growth }: {
  flare: SharedValue<number>;
  growth: SharedValue<number>;
}) {
  const size = 460 * WORLD_FTUE_EGG_STAGE_SCALE;
  const center = size / 2;
  const outerRadius = 185 * WORLD_FTUE_EGG_STAGE_SCALE;
  const innerRadius = 140 * WORLD_FTUE_EGG_STAGE_SCALE;
  const outerOpacity = useDerivedValue(() => Math.min(1, 0.058 + growth.value * 0.25 + flare.value * 0.72));
  const innerOpacity = useDerivedValue(() => Math.min(1, 0.127 + growth.value * 0.42 + flare.value * 0.68));
  const outerTransform = useDerivedValue(() => [{ scale: 0.576 + growth.value * 0.38 + flare.value * 0.22 }]);
  const innerTransform = useDerivedValue(() => [{ scale: 0.591 + growth.value * 0.36 + flare.value * 0.16 }]);
  return (
    <Canvas pointerEvents="none" style={[styles.worldFtueEggEffectCanvas, {
      height: size,
      left: (WORLD_FTUE_EGG_WIDTH - size) / 2,
      top: (WORLD_FTUE_EGG_HEIGHT - size) / 2,
      width: size,
    }]}>
      <Group opacity={outerOpacity} origin={vec(center, center)} transform={outerTransform}>
        <Circle cx={center} cy={center} r={outerRadius}>
          <SkiaRadialGradient c={vec(center, center)} colors={['rgba(255, 248, 188, 0.92)', 'rgba(255, 222, 91, 0.68)', 'rgba(255, 202, 47, 0.22)', 'rgba(255, 198, 42, 0)']} positions={[0, 0.28, 0.62, 1]} r={outerRadius} />
        </Circle>
      </Group>
      <Group opacity={innerOpacity} origin={vec(center, center)} transform={innerTransform}>
        <Circle cx={center} cy={center} r={innerRadius}>
          <SkiaRadialGradient c={vec(center, center)} colors={[WORLD_FTUE_GLOW_CORE, WORLD_FTUE_GLOW_ACCENT, 'rgba(255, 216, 79, 0.28)', 'rgba(255, 208, 62, 0)']} positions={[0, 0.3, 0.68, 1]} r={innerRadius} />
        </Circle>
      </Group>
    </Canvas>
  );
}

function worldFtueHatchPhaseAtLeast(phase: TodayHatchPhase, target: TodayHatchPhase) {
  const order: TodayHatchPhase[] = [
    'idle', 'preparing', 'shaking', 'cracking', 'crossfading_subject', 'subject_settling',
    'forming_card', 'assembling_deck', 'awaiting_claim', 'claiming', 'new_day_intro',
    'restoring_today', 'awaiting_interaction', 'world_shift', 'dashboard_settling', 'complete',
  ];
  return order.indexOf(phase) >= order.indexOf(target);
}

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

const ProjectedResidentCreature = memo(function ProjectedResidentCreature({
  cameraMoving,
  cameraScale,
  cameraTranslateX,
  cameraTranslateY,
  creature,
  frame,
  meditating,
  rewardPulseKey,
  sceneHeight,
  sceneWidth,
  source,
}: {
  cameraMoving: boolean;
  cameraScale: SharedValue<number>;
  cameraTranslateX: SharedValue<number>;
  cameraTranslateY: SharedValue<number>;
  creature: Extract<KingdomHexCompanionSlot, { kind: 'owned' }>['creature'];
  frame: AbsoluteFrame;
  meditating: boolean;
  rewardPulseKey: number;
  sceneHeight: number;
  sceneWidth: number;
  source?: ImageSourcePropType;
}) {
  const reduceMotion = useReducedMotion();
  const rewardPulse = useSharedValue(0);
  const rewardShake = useSharedValue(0);
  const meditationProgress = useSharedValue(meditating ? 1 : 0);
  const handledRewardPulseKeyRef = useRef(rewardPulseKey);
  const nativeWidth = frame.width * WORLD_INTERACTION_CREATURE_NATIVE_SURFACE_SCALE;
  const nativeHeight = frame.height * WORLD_INTERACTION_CREATURE_NATIVE_SURFACE_SCALE;
  const glowSize = nativeWidth * 0.84;
  const meditationSource = resolveCreatureMeditationArtSource(creature.visualKey);

  useEffect(() => {
    if (rewardPulseKey <= handledRewardPulseKeyRef.current) return;
    handledRewardPulseKeyRef.current = rewardPulseKey;
    runRewardArrivalMotion(rewardPulse, rewardShake, reduceMotion);
    return () => {
      cancelAnimation(rewardPulse);
      cancelAnimation(rewardShake);
    };
  }, [reduceMotion, rewardPulse, rewardPulseKey, rewardShake]);
  useEffect(() => {
    meditationProgress.value = reduceMotion
      ? meditating ? 1 : 0
      : withTiming(meditating ? 1 : 0, {
          duration: 520,
          easing: Easing.inOut(Easing.cubic),
        });
    return () => cancelAnimation(meditationProgress);
  }, [meditating, meditationProgress, reduceMotion]);

  const projectionStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: sceneWidth / 2
          + cameraTranslateX.value
          + (frame.left + frame.width / 2 - sceneWidth / 2) * cameraScale.value
          - frame.width / 2,
      },
      {
        translateY: sceneHeight / 2
          + cameraTranslateY.value
          + (frame.top + frame.height - sceneHeight / 2) * cameraScale.value
          - frame.height,
      },
    ],
  }));
  const reactionStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: rewardShake.value * 5.5 },
      { rotateZ: `${rewardShake.value * 2.2}deg` },
    ],
  }));
  const nativeSurfaceStyle = useAnimatedStyle(() => ({
    transform: [{
      scale: cameraScale.value
        * (1 + rewardPulse.value * 0.055)
        / WORLD_INTERACTION_CREATURE_NATIVE_SURFACE_SCALE,
    }],
  }));
  const rewardGlowStyle = useAnimatedStyle(() => ({
    opacity: rewardPulse.value * 0.84,
    transform: [{ scale: 0.72 + rewardPulse.value * 0.55 }],
  }));
  const regularCreatureStyle = useAnimatedStyle(() => ({
    opacity: meditationSource ? 1 - meditationProgress.value : 1,
  }));
  const meditationCreatureStyle = useAnimatedStyle(() => ({
    opacity: meditationProgress.value,
  }));
  const meditationAuraStyle = useAnimatedStyle(() => ({
    opacity: meditationProgress.value * 0.82,
    transform: [{ scale: 0.92 + meditationProgress.value * 0.08 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.worldFtueProjectedSubject,
        { height: frame.height, width: frame.width },
        projectionStyle,
      ]}>
      <Animated.View
        collapsable={false}
        renderToHardwareTextureAndroid={false}
        shouldRasterizeIOS={false}
        style={[StyleSheet.absoluteFill, reactionStyle]}>
        <Animated.View
          collapsable={false}
          renderToHardwareTextureAndroid={false}
          shouldRasterizeIOS={false}
          style={[
            styles.worldInteractionCreatureNativeSurface,
            { height: nativeHeight, marginLeft: -nativeWidth / 2, width: nativeWidth },
            nativeSurfaceStyle,
          ]}>
          <Animated.View
            style={[
              styles.worldFtueRewardGlow,
              {
                borderWidth: 2 * WORLD_INTERACTION_CREATURE_NATIVE_SURFACE_SCALE,
                boxShadow: `0 0 ${22 * WORLD_INTERACTION_CREATURE_NATIVE_SURFACE_SCALE}px rgba(255,193,65,0.72)`,
                height: glowSize,
                left: (nativeWidth - glowSize) / 2,
                top: (nativeHeight - glowSize) / 2,
                width: glowSize,
              },
              rewardGlowStyle,
            ]}
          />
          {meditationSource ? (
            <Animated.View
              style={[
                styles.worldMeditationAura,
                {
                  height: nativeWidth * 0.82,
                  left: nativeWidth * 0.09,
                  top: nativeHeight * 0.13,
                  width: nativeWidth * 0.82,
                },
                meditationAuraStyle,
              ]}>
              <RotatingRadialSunburst
                baseOpacity={0.58}
                nativeSurfaceScale={1}
                size={nativeWidth * 0.98}
                style={{ left: -nativeWidth * 0.08, top: -nativeWidth * 0.08 }}
              />
            </Animated.View>
          ) : null}
          <CreatureGroundShadow frameSize={nativeWidth} visualKey={creature.visualKey} />
          <Animated.View style={[StyleSheet.absoluteFill, regularCreatureStyle]}>
            <CreatureAnimatedArt
              accessibilityLabel={`${creature.name} animated`}
              allowDownscaling={false}
              fallbackSource={source ?? resolveCreatureArtSource(creature.visualKey)}
              forceStatic={cameraMoving}
              style={StyleSheet.absoluteFill}
              visualKey={creature.visualKey}
            />
          </Animated.View>
          {meditationSource ? (
            <Animated.View style={[StyleSheet.absoluteFill, meditationCreatureStyle]}>
              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel={`${creature.name}, meditating`}
                allowDownscaling={false}
                cachePolicy="memory-disk"
                contentFit="contain"
                source={meditationSource}
                style={StyleSheet.absoluteFill}
                transition={0}
              />
            </Animated.View>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
});

/**
 * Memory plants use a detached, oversized image plane. The Garden camera only
 * ever downsamples this full-resolution surface, avoiding the soft texture that
 * results when a tiny world-space view is rasterized and then enlarged.
 */
const ProjectedMemoryPlant = memo(function ProjectedMemoryPlant({
  animateReveal,
  cameraScale,
  cameraTranslateX,
  cameraTranslateY,
  color,
  frame,
  sceneHeight,
  sceneWidth,
  source,
  visualKey,
}: {
  animateReveal: boolean;
  cameraScale: SharedValue<number>;
  cameraTranslateX: SharedValue<number>;
  cameraTranslateY: SharedValue<number>;
  color: string;
  frame: AbsoluteFrame;
  sceneHeight: number;
  sceneWidth: number;
  source: ImageSourcePropType;
  visualKey: string;
}) {
  const reduceMotion = useReducedMotion();
  const revealOpacity = useSharedValue(animateReveal ? 0 : 1);
  const revealScale = useSharedValue(animateReveal ? 0.48 : 1);
  const revealLift = useSharedValue(animateReveal ? 12 : 0);
  const celebrationOpacity = useSharedValue(0);
  const handledVisualKeyRef = useRef(animateReveal ? null : visualKey);
  // `animateReveal` is an event emitted by the projection diff, not durable
  // display state. Latch it to the visual key so the following parent render
  // cannot switch it back to false and cancel this animation's cleanup-bound
  // Reanimated sequences before they reach their final values.
  const revealRequestedForVisualKeyRef = useRef<string | null>(animateReveal ? visualKey : null);
  if (animateReveal) revealRequestedForVisualKeyRef.current = visualKey;
  const [showCelebration, setShowCelebration] = useState(animateReveal);
  const nativeWidth = frame.width * MEMORY_PLANT_NATIVE_SURFACE_SCALE;
  const nativeHeight = frame.height * MEMORY_PLANT_NATIVE_SURFACE_SCALE;
  const raySize = nativeWidth * 1.85;

  useEffect(() => {
    if (revealRequestedForVisualKeyRef.current !== visualKey || handledVisualKeyRef.current === visualKey) return;
    handledVisualKeyRef.current = visualKey;
    setShowCelebration(true);
    revealOpacity.value = 0;
    revealScale.value = reduceMotion ? 0.88 : 0.48;
    revealLift.value = reduceMotion ? 4 : 12;
    celebrationOpacity.value = 0;
    revealOpacity.value = withTiming(1, {
      duration: reduceMotion ? 100 : 220,
      easing: Easing.out(Easing.cubic),
    });
    revealLift.value = withTiming(0, {
      duration: reduceMotion ? 100 : 440,
      easing: Easing.out(Easing.cubic),
    });
    revealScale.value = reduceMotion
      ? withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) })
      : withSequence(
          withTiming(1.14, { duration: 340, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 180, easing: Easing.inOut(Easing.cubic) }),
        );
    celebrationOpacity.value = withSequence(
      withTiming(1, { duration: reduceMotion ? 80 : 150 }),
      withDelay(
        reduceMotion ? 180 : 760,
        withTiming(0, { duration: reduceMotion ? 140 : 360, easing: Easing.in(Easing.cubic) }),
      ),
    );
    const timer = setTimeout(() => setShowCelebration(false), reduceMotion ? 520 : 1_360);
    return () => {
      clearTimeout(timer);
      cancelAnimation(revealOpacity);
      cancelAnimation(revealScale);
      cancelAnimation(revealLift);
      cancelAnimation(celebrationOpacity);
    };
  }, [celebrationOpacity, reduceMotion, revealLift, revealOpacity, revealScale, visualKey]);

  const projectionStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: sceneWidth / 2
          + cameraTranslateX.value
          + (frame.left + frame.width / 2 - sceneWidth / 2) * cameraScale.value
          - frame.width / 2,
      },
      {
        translateY: sceneHeight / 2
          + cameraTranslateY.value
          + (frame.top + frame.height / 2 - sceneHeight / 2) * cameraScale.value
          - frame.height / 2,
      },
    ],
  }));
  const nativeSurfaceStyle = useAnimatedStyle(() => ({
    opacity: revealOpacity.value,
    transform: [{
      scale: cameraScale.value * revealScale.value / MEMORY_PLANT_NATIVE_SURFACE_SCALE,
    }],
  }));
  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: revealLift.value * cameraScale.value }],
  }));
  const celebrationStyle = useAnimatedStyle(() => ({ opacity: celebrationOpacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.projectedMemoryPlant,
        { height: frame.height, width: frame.width },
        projectionStyle,
      ]}>
      <Animated.View
        collapsable={false}
        renderToHardwareTextureAndroid={false}
        shouldRasterizeIOS={false}
        style={[StyleSheet.absoluteFill, liftStyle]}>
        <Animated.View
          collapsable={false}
          renderToHardwareTextureAndroid={false}
          shouldRasterizeIOS={false}
          style={[
            styles.memoryPlantNativeSurface,
            {
              height: nativeHeight,
              marginLeft: -nativeWidth / 2,
              marginTop: -nativeHeight / 2,
              width: nativeWidth,
            },
            nativeSurfaceStyle,
          ]}>
          {showCelebration ? (
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, celebrationStyle]}>
              <RotatingRadialSunburst
                baseOpacity={0.86}
                nativeSurfaceScale={1}
                rotationDurationMs={18_000}
                size={raySize}
                style={{
                  left: (nativeWidth - raySize) / 2,
                  // Memory-plant artwork is grounded in the lower half of its
                  // transparent plane. Centre the celebration on the planted
                  // subject rather than the empty canvas above it.
                  top: (nativeHeight - raySize) / 2 + nativeHeight * 0.14,
                }}
              />
              <CelebrationParticles
                key={`memory-plant-confetti-${visualKey}`}
                layerStyle={{ left: nativeWidth / 2, top: nativeHeight * 0.48 }}
                tier={2}
                tint={color}
              />
            </Animated.View>
          ) : null}
          <Image
            accessibilityIgnoresInvertColors
            allowDownscaling={false}
            cachePolicy="memory-disk"
            contentFit="contain"
            priority="high"
            recyclingKey={visualKey}
            source={source}
            style={StyleSheet.absoluteFill}
            transition={0}
          />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
});

type ResidentProps = {
  animated?: boolean;
  celebrationNonce?: number;
  disabled?: boolean;
  focusAnchorX: number;
  focusAnchorY: number;
  focusScale: number;
  meditating?: boolean;
  onFocus: (x: number, y: number, options?: { id?: string; onComplete?: () => void }) => void;
  onSelectResident?: (creatureId: string, label: string) => void;
  source?: ImageSourcePropType;
  statusGlyph?: KingdomResidentStatusGlyph;
  stableWorldPresentation?: boolean;
  tile: KingdomTileRender;
  worldSize: number;
  x: number;
  y: number;
};

const ResidentCreature = memo(function ResidentCreature({
  animated = false,
  celebrationNonce,
  disabled,
  focusAnchorX,
  focusAnchorY,
  focusScale,
  meditating = false,
  onFocus,
  onSelectResident,
  source: sourceOverride,
  statusGlyph,
  stableWorldPresentation = false,
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
  const opacity = useSharedValue(stableWorldPresentation ? 1 : 0);
  const lift = useSharedValue(stableWorldPresentation ? 0 : 12);
  const reactionLift = useSharedValue(0);
  const reactionRotation = useSharedValue(0);
  const reactionScale = useSharedValue(1);
  const meditationProgress = useSharedValue(meditating ? 1 : 0);
  const reduceMotion = useReducedMotion();
  const meditationSource = creature
    ? resolveCreatureMeditationArtSource(creature.visualKey)
    : null;

  useEffect(() => {
    if (stableWorldPresentation) {
      opacity.value = 1;
      lift.value = 0;
      return;
    }
    if (!ready) return;
    opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
    lift.value = withSpring(0, { damping: 14, stiffness: 210 });
  }, [lift, opacity, ready, stableWorldPresentation]);

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

  useEffect(() => {
    meditationProgress.value = reduceMotion
      ? meditating ? 1 : 0
      : withTiming(meditating ? 1 : 0, {
          duration: 520,
          easing: Easing.inOut(Easing.cubic),
        });
    return () => cancelAnimation(meditationProgress);
  }, [meditating, meditationProgress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: lift.value + reactionLift.value },
      { rotateZ: `${reactionRotation.value}deg` },
      { scale: reactionScale.value },
    ],
  }));
  const regularCreatureStyle = useAnimatedStyle(() => ({
    opacity: meditationSource ? 1 - meditationProgress.value : 1,
  }));
  const meditationCreatureStyle = useAnimatedStyle(() => ({
    opacity: meditationProgress.value,
  }));
  const meditationAuraStyle = useAnimatedStyle(() => ({
    opacity: meditationProgress.value * 0.82,
    transform: [{ scale: 0.92 + meditationProgress.value * 0.08 }],
  }));
  const handlePress = useCallback(() => {
    if (!creature) return;
    // The interaction effect owns the canonical FTUE-matched focus. Starting
    // the old magnetic tile focus first caused a brief .42-anchor zoom before
    // the resident was recentered at .5, producing a visible double move.
    if (onSelectResident) {
      onSelectResident(creature.creatureId, creature.name);
      return;
    }
    onFocus(x, y, { id: tile.id });
  }, [creature, onFocus, onSelectResident, tile.id, x, y]);
  const markReady = useCallback(() => setReady(true), []);
  const frame = residentCreatureFrame(x, y, worldSize, stableWorldPresentation);
  const frameWidth = frame.width;

  return (
    <TileFocusTransform anchorX={focusAnchorX} anchorY={focusAnchorY} frame={frame} scale={focusScale}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={creature?.name}
        disabled={disabled}
        onPress={handlePress}
        style={StyleSheet.absoluteFill}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, animatedStyle]}>
          {meditationSource ? (
            <Animated.View style={[styles.residentMeditationAura, meditationAuraStyle]}>
              <RotatingRadialSunburst
                baseOpacity={0.58}
                size={frameWidth * 1.12}
                style={{ left: -frameWidth * 0.15, top: -frameWidth * 0.15 }}
              />
            </Animated.View>
          ) : null}
          {creature ? (
            <CreatureGroundShadow
              frameSize={frameWidth}
              visualKey={creature.visualKey}
            />
          ) : null}
          <Animated.View style={[StyleSheet.absoluteFill, regularCreatureStyle]}>
            {creature && animated ? (
              <CreatureAnimatedArt
                accessibilityLabel={`${creature.name} animated`}
                fallbackSource={resolveCreatureArtSource(creature.visualKey)}
                onLoad={markReady}
                style={StyleSheet.absoluteFill}
                visualKey={creature.visualKey}
              />
            ) : source ? <SeamlessWorldImage source={source} priority="normal" onReady={markReady} onFailure={markReady} /> : null}
          </Animated.View>
          {meditationSource ? (
            <Animated.View style={[StyleSheet.absoluteFill, meditationCreatureStyle]}>
              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel={`${creature?.name ?? 'Katchimera'}, meditating`}
                allowDownscaling={false}
                cachePolicy="memory-disk"
                contentFit="contain"
                source={meditationSource}
                style={StyleSheet.absoluteFill}
                transition={0}
              />
            </Animated.View>
          ) : null}
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
  residentMeditationAura: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,220,125,0.16)',
    borderRadius: 999,
    boxShadow: '0 0 22px rgba(255,210,92,0.46)',
    height: '82%',
    justifyContent: 'center',
    left: '9%',
    position: 'absolute',
    top: '9%',
    width: '82%',
  },
  scene: { position: 'relative' },
  focusLayer: { position: 'absolute' },
  tileArt: { position: 'absolute' },
  tileUpgradeOffer: {
    alignItems: 'center',
    backgroundColor: '#F6D774',
    borderColor: 'rgba(255,250,210,0.96)',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 2,
    boxShadow: '0 7px 18px rgba(47,35,15,0.28)',
    flexDirection: 'row',
    gap: 8,
    height: TILE_UPGRADE_OFFER_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 13,
    position: 'absolute',
    width: TILE_UPGRADE_OFFER_WIDTH,
    zIndex: 30,
  },
  tileUpgradeOfferLabel: { color: '#3D2A12', flexShrink: 1, fontSize: 14, fontWeight: '900' },
  tileUpgradeOfferPressed: { opacity: 0.86, transform: [{ scale: 0.97 }] },
  gardenOrderShortcutGroup: {
    alignItems: 'center',
    position: 'absolute',
    zIndex: 32,
  },
  gardenOrderShortcutTarget: {
    alignItems: 'center',
  },
  gardenOrderRequestBubble: {
    alignItems: 'center',
    backgroundColor: '#FFF8D8',
    borderColor: 'rgba(95,67,31,0.24)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: '0 7px 18px rgba(49,36,19,0.24)',
    height: FTUE_GARDEN_REQUEST_BUBBLE_SIZE,
    justifyContent: 'center',
    width: FTUE_GARDEN_REQUEST_BUBBLE_SIZE,
  },
  gardenOrderCalloutTail: {
    backgroundColor: '#FFF8D8',
    bottom: -5,
    height: 10,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 10,
  },
  gardenOrderShortcut: {
    height: GARDEN_ORDER_CARD_HEIGHT,
    width: GARDEN_ORDER_CARD_WIDTH,
  },
  gardenOrderShortcutPressed: { opacity: 0.9, transform: [{ scale: 0.94 }] },
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
  worldFtueRewardGlow: {
    backgroundColor: 'rgba(255,205,92,0.34)',
    borderColor: 'rgba(255,239,168,0.88)',
    borderRadius: 999,
    position: 'absolute',
  },
  worldFtueEggNativeSurface: {
    bottom: 0,
    left: '50%',
    position: 'absolute',
    transformOrigin: 'center bottom',
  },
  worldInteractionCreatureNativeSurface: {
    bottom: 0,
    left: '50%',
    position: 'absolute',
    transformOrigin: 'center bottom',
  },
  worldMeditationAura: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,220,125,0.16)',
    borderRadius: 999,
    boxShadow: '0 0 80px rgba(255,210,92,0.44)',
    justifyContent: 'center',
    position: 'absolute',
  },
  memoryPlantNativeSurface: {
    left: '50%',
    position: 'absolute',
    top: '50%',
    transformOrigin: 'center center',
  },
  projectedMemoryPlant: {
    left: 0,
    overflow: 'visible',
    position: 'absolute',
    top: 0,
    zIndex: 16,
  },
  // Mossprout shares the Egg's ground anchor. Scaling this frame around its
  // center pushed the enlarged lower half below that anchor and behind the
  // dialogue choices; bottom-origin scaling retains the hatch position and
  // lifts the visible character into the Egg's former centered composition.
  worldFtueCreatureFrame: {
    transformOrigin: 'center bottom',
  },
  worldFtueCreatureNativeSurface: {
    bottom: 0,
    left: '50%',
    position: 'absolute',
    transformOrigin: 'center bottom',
  },
  worldFtueProjectedSubject: {
    left: 0,
    overflow: 'visible',
    position: 'absolute',
    top: 0,
    zIndex: 18,
  },
  worldFtueEggEffectCanvas: {
    position: 'absolute',
  },
  worldFtueHatchRing: {
    backgroundColor: 'rgba(250,218,125,0.12)',
    borderColor: 'rgba(255,236,174,0.55)',
    borderRadius: 999,
    position: 'absolute',
  },
  worldFtueHatchGlow: {
    bottom: '-20%',
    left: '-20%',
    position: 'absolute',
    right: '-20%',
    top: '-20%',
  },
  lockedTileLock: { height: '100%', width: '100%' },
  homeTileHitTarget: { height: 84, position: 'absolute', width: 108 },
  natureIslandHitTarget: { position: 'absolute' },
  gardenPlotTarget: { position: 'absolute' },
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
