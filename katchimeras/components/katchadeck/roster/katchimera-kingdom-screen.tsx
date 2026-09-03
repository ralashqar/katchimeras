import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, View, useWindowDimensions, type View as ViewType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import {
  KingdomHexCanvas,
  type KingdomResidentScreenAnchor,
  type KingdomResidentStatusGlyph,
  type KingdomTileUpgradeOffer,
} from '@/components/katchadeck/world/kingdom-hex-canvas';
import { KatchimeraCompanionRouteScreen } from '@/components/katchadeck/world/katchimera-companion-route-screen';
import { HavenTileHudLayer } from '@/components/katchadeck/world/haven-tile-hud-layer';
import { MossproutNatureIslandSheet } from '@/components/katchadeck/world/mossprout-nature-island-sheet';
import { HavenFtueOverlay } from '@/components/katchadeck/onboarding/haven-ftue-overlay';
import { FtueGuideCopy } from '@/components/katchadeck/onboarding/ftue-guide-copy';
import { PersistentMergeItemArt } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { GameCurrencyHud } from '@/components/katchadeck/ui/game-currency-hud';
import { GameHudBar } from '@/components/katchadeck/ui/game-primitives';
import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
import { ThemedText } from '@/components/themed-text';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { mossproutMemoryPlantById, mossproutMemoryPlantStage } from '@/constants/mossprout-memory-plants';
import { AppFontFamilies } from '@/constants/theme';
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import { loadWorldIdentity, localDayId } from '@/utils/world-identity';
import type { KingdomHexCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import type { MergeCharacterId, MergeWorldState, MossproutNatureIslandId, MossproutNatureIslandLevel, StoryWorldMutationReceipt } from '@/types/merge-world';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import { HAVEN_ENVIRONMENTS, havenStoryGateSatisfied, type HavenEnvironmentStage, type HavenStage } from '@/constants/haven-catalog';
import { completeMossproutHavenUpgrade } from '@/utils/companion-story-storage';
import { recordStoredMovementEggProgress, reconcileStoredHavenStory, upgradeStoredHavenTile, upgradeStoredMossproutNatureIsland } from '@/utils/merge-world/repository';
import { mossproutNatureIslandById, mossproutNatureIslandLevelDefinition } from '@/constants/mossprout-nature-islands';
import { havenHexTileSpec, kingdomHexTileSourceForLod } from '@/utils/world-visuals';
import type { HavenTileUpgradePresentation } from '@/utils/haven-upgrade-presentation';
import { deriveHavenTilePresentation } from '@/utils/haven-tile-presentation';
import { advanceFtueActionDurably, commitFtueAction, dispatchFtueEvent, loadFtueRun } from '@/features/onboarding/ftue-runtime';
import {
  MOSSPROUT_WORLD_EGG_CLOSE_ZOOM,
  MOSSPROUT_WORLD_EGG_ENTRY_ZOOM,
  MOSSPROUT_WORLD_EGG_REST_ZOOM,
  mossproutFtueStep,
  mossproutFtueUsesHostedCompanionStage,
} from '@/features/onboarding/mossprout-ftue-script';
import { mossproutJourneyForDay, mossproutJourneyRuntimeDayId } from '@/game/katchimeras/relationship-progression';
import { isJourneyQuickModeEnabled } from '@/utils/dev-settings';
import { mergeOrderItemReadiness, readyMergeOrderIds } from '@/utils/merge-world/engine';
import { prioritizedVisibleMergeOrders } from '@/utils/merge-world/order-presentation';
import type { MergeOrderTrayEntry } from '@/components/katchadeck/games/merge-order-rail';
import type { KingdomCameraSnapshot } from '@/utils/kingdom-rendering';
import { useGameScreenTransition } from '@/features/navigation/game-screen-transition';
import { getPedometerAccess, readRecentPedometerStepDays, requestPedometerAccess } from '@/utils/pedometer-steps';
import type { WorldFtueSubjectPresentation } from '@/components/katchadeck/world/world-ftue-subject-presentation';
import type { MossproutWorldInteractionRequest } from '@/components/katchadeck/world/mossprout-world-interaction';
import type { StoryWorldUpgradePresentationPayload } from '@/types/content-flow';
import {
  STORY_WORLD_UPGRADE_PRESENTATION,
  contentFlowEffectResult,
} from '@/features/content-flow/story-world-operations';
import { useStoryPresentationOperation } from '@/features/content-flow/use-story-presentation-operation';

type Props = {
  background: TodayAtmosphereBackground;
  companionSlots: KingdomHexCompanionSlot[];
  onContentReady?: () => void;
  onBackToHavenSelector: () => void;
  navigationLocked?: boolean;
  interactionRequest?: MossproutWorldInteractionRequest | null;
  onInteractionRequestConsumed?: () => void;
  residentStatusGlyphs?: Partial<Record<string, KingdomResidentStatusGlyph>>;
  mergeWorld: MergeWorldState;
  ftueStepId?: string;
  onFtueRestore?: () => void;
  onFtueInspect?: () => void;
  onFtueOpenGarden?: () => void;
  initialCameraSnapshot?: KingdomCameraSnapshot | null;
  onCameraSnapshotChange?: (snapshot: KingdomCameraSnapshot) => void;
  worldEggTargetRef?: RefObject<ViewType | null>;
  worldSubjectPresentation?: WorldFtueSubjectPresentation | null;
};

const GARDEN_BUTTON_ART = require('../../../assets/images/katchimeras/world/square/mossprout-garden-button-v1-256.webp');
const FIRST_BLOOM_GARDEN_UPGRADE_OFFER = {
  accessibilityHint: "Uses the First Bloom to restore Mossprout's Garden",
  anchor: { x: 0.5, y: 0.76 },
  label: 'Restore',
  target: { kind: 'haven_structure', structureId: 'mossprout-hex-garden' },
} as const satisfies KingdomTileUpgradeOffer;
function residentScreenAnchorsEqual(
  current: readonly KingdomResidentScreenAnchor[],
  next: readonly KingdomResidentScreenAnchor[],
) {
  return current.length === next.length && current.every((anchor, index) => {
    const candidate = next[index];
    return candidate != null
      && anchor.characterId === candidate.characterId
      && anchor.creatureId === candidate.creatureId
      && Math.abs(anchor.x - candidate.x) < 0.01
      && Math.abs(anchor.y - candidate.y) < 0.01;
  });
}

function FtueOpeningFade() {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    opacity.value = withDelay(
      reduceMotion ? 0 : 120,
      withTiming(0, {
        duration: reduceMotion ? 140 : 1_350,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [opacity, reduceMotion]);

  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.openingFade, animatedStyle]} />;
}

export function KatchimeraKingdomScreen({
  background,
  companionSlots,
  onContentReady,
  onBackToHavenSelector,
  navigationLocked = false,
  interactionRequest,
  onInteractionRequestConsumed,
  residentStatusGlyphs,
  mergeWorld,
  ftueStepId,
  onFtueRestore,
  onFtueInspect,
  onFtueOpenGarden,
  initialCameraSnapshot,
  onCameraSnapshotChange,
  worldEggTargetRef,
  worldSubjectPresentation,
}: Props) {
  const router = useRouter();
  const { transitionTo } = useGameScreenTransition();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [lockedHintVisible, setLockedHintVisible] = useState(false);
  const [selectedCreatureId, setSelectedCreatureId] = useState<string | null>(null);
  const [interactionCreatureId, setInteractionCreatureId] = useState<string | null>(null);
  const [ftueReturnFocusCreatureId, setFtueReturnFocusCreatureId] = useState<string | null>(null);
  const [interactionCameraReady, setInteractionCameraReady] = useState(false);
  const [interactionExiting, setInteractionExiting] = useState(false);
  const [interactionExitNonce, setInteractionExitNonce] = useState(0);
  const [interactionLoadingVisible, setInteractionLoadingVisible] = useState(false);
  const [hostedInteractionRequest, setHostedInteractionRequest] = useState<MossproutWorldInteractionRequest | null>(null);
  const [interactionRewardPulseKey, setInteractionRewardPulseKey] = useState(0);
  const [detailCreatureId, setDetailCreatureId] = useState<string | null>(null);
  const [residentAnchors, setResidentAnchors] = useState<KingdomResidentScreenAnchor[]>([]);
  const [ftueTargetRevision, setFtueTargetRevision] = useState(0);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradePresentation, setUpgradePresentation] = useState<HavenTileUpgradePresentation | null>(null);
  const [selectedNatureIslandId, setSelectedNatureIslandId] = useState<MossproutNatureIslandId | null>(null);
  const [selectedMemoryPlantId, setSelectedMemoryPlantId] = useState<string | null>(null);
  const [movementEggOpen, setMovementEggOpen] = useState(false);
  const [movementStepsBusy, setMovementStepsBusy] = useState(false);
  const [movementStepsUnavailable, setMovementStepsUnavailable] = useState(false);
  const [natureUpgradeError, setNatureUpgradeError] = useState<string | null>(null);
  const restoreButtonRef = useRef<View>(null);
  const screenRef = useRef<View>(null);
  const ftueTargetRefs = useRef(new Map<string, View>());
  const upgradeNonceRef = useRef(0);
  const storyUpgradeResolversRef = useRef(new Map<string, () => void>());
  const interactionCreatureIdRef = useRef<string | null>(null);
  const handledInteractionRequestRef = useRef<string | null>(null);
  const ftueRestoreStartedRef = useRef(false);
  const firstBloomRestoreStartedRef = useRef(false);
  const firstSeedPlantStartedRef = useRef(false);
  const firstSeedReturnStartedRef = useRef(false);
  const ftueRecoveryRef = useRef<string | null>(null);
  const autoAdvancedStepRef = useRef<string | null>(null);
  const onFtueInspectRef = useRef(onFtueInspect);
  onFtueInspectRef.current = onFtueInspect;
  const identity = useMemo(loadWorldIdentity, []);
  const relationships = useRelationshipProgression();
  const mergeWorldRef = useRef(mergeWorld);
  mergeWorldRef.current = mergeWorld;
  interactionCreatureIdRef.current = interactionCreatureId;
  const visibleCompanionSlots = useMemo(
    () => companionSlots.filter((slot) => slot.familyId === 'mossprout'),
    [companionSlots],
  );
  const mossproutGardenScene = useMemo(() => ({
    level: mergeWorld.haven.structures.mossproutGarden.level,
    plantableMemories: mergeWorld.haven.plantableMemories,
    movementEggStatus: mergeWorld.haven.movementEgg.status,
    featureLevels: mergeWorld.haven.structures.mossproutGarden.featureLevels,
  }), [
    mergeWorld.haven.movementEgg.status,
    mergeWorld.haven.plantableMemories,
    mergeWorld.haven.structures.mossproutGarden.featureLevels,
    mergeWorld.haven.structures.mossproutGarden.level,
  ]);
  const updateResidentAnchors = useCallback((next: KingdomResidentScreenAnchor[]) => {
    setResidentAnchors((current) => residentScreenAnchorsEqual(current, next) ? current : next);
  }, []);
  const selectedMemoryPlant = selectedMemoryPlantId
    ? mergeWorld.haven.plantableMemories.find((plant) => plant.id === selectedMemoryPlantId) ?? null
    : null;
  const selectedMemoryPlantDefinition = selectedMemoryPlant
    ? mossproutMemoryPlantById.get(selectedMemoryPlant.definitionId) ?? null
    : null;
  const activeFtueRunId = loadFtueRun()?.runId ?? null;
  const firstFtueMemory = mergeWorld.haven.plantableMemories.find((plant) => (
    plant.source.kind === 'ftue' && (!activeFtueRunId || plant.source.sourceId === activeFtueRunId)
  )) ?? null;
  const firstSeedPlanted = firstFtueMemory?.status === 'planted' && firstFtueMemory.slotId === 'front-left';
  const firstSeedGrown = firstSeedPlanted && firstFtueMemory.growthPoints >= 1;
  const havenMergeBoardActive = visibleCompanionSlots.some((slot) => (
    slot.familyId === 'mossprout' && slot.kind === 'owned'
  ));
  const mossproutJourneyDayId = mossproutJourneyRuntimeDayId(
    relationships,
    localDayId(),
    isJourneyQuickModeEnabled(),
  );
  const mossproutJourney = mossproutJourneyForDay(relationships, mossproutJourneyDayId);
  const ftueStep = ftueStepId ? mossproutFtueStep(ftueStepId) ?? null : null;
  const gardenOrderEntries = useMemo<MergeOrderTrayEntry[]>(() => {
    if (!havenMergeBoardActive || ftueStepId !== 'world.garden_handoff') return [];
    const journeyOrderIds = new Set(mossproutJourney?.activity?.mergeOrderIds
      ?? (mossproutJourney?.activity ? [mossproutJourney.activity.mergeOrderId] : []));
    const activeResidentDiscovery = mergeWorld.residentCardDiscovery.records.find((record) => (
      record.status !== 'locked' && record.status !== 'card_earned'
    ));
    const readyOrderIds = readyMergeOrderIds(mergeWorld);
    const realEntries: MergeOrderTrayEntry[] = prioritizedVisibleMergeOrders(mergeWorld, {
      activeResidentDiscoveryId: activeResidentDiscovery?.id,
      exclusiveJourney: Boolean(mossproutJourney && mossproutJourney.status !== 'complete'),
      journeyOrderIds,
    }).filter((order) => order.id === 'mossprout:chapter-0:first-sprout').slice(0, 1).map((order) => ({
      id: order.id,
      itemReadiness: mergeOrderItemReadiness(mergeWorld, order),
      kind: 'order' as const,
      order,
      ready: readyOrderIds.has(order.id),
    }));
    return realEntries;
  }, [ftueStepId, havenMergeBoardActive, mergeWorld, mossproutJourney]);
  const gardenHandoffOrder = gardenOrderEntries[0] ?? null;
  const gardenHandoffOrderId = gardenHandoffOrder?.order.id ?? 'mossprout:chapter-0:first-sprout';
  const gardenHandoffPlantDefinitionId = gardenHandoffOrder?.order.requirements[0]?.definitionId
    ?? 'nature:garden:1';
  const interactionSlot = useMemo(() => visibleCompanionSlots.find((slot) => (
    slot.kind === 'owned' && slot.creature.creatureId === interactionCreatureId
  )), [interactionCreatureId, visibleCompanionSlots]);
  const activeInteractionResidentId = interactionCreatureId ?? ftueReturnFocusCreatureId;
  const interactionHasGarden = interactionSlot?.familyId === 'mossprout';
  const tutorialCamera = ftueStep?.camera ?? null;
  const ftueReturnCamera = ftueReturnFocusCreatureId
    ? mossproutFtueStep('companion.chapter_zero_return')?.camera ?? null
    : null;
  const ftueReturnResidentAnchorY = ftueReturnCamera?.kind === 'focus_target'
    ? ftueReturnCamera.anchorY
    : undefined;
  const ftueReturnResidentZoom = ftueReturnCamera?.kind === 'focus_target'
    ? ftueReturnCamera.zoom
    : undefined;
  const initialFtueCameraScale = ftueStepId === 'world.egg_intro'
    ? MOSSPROUT_WORLD_EGG_ENTRY_ZOOM
    : tutorialCamera?.kind === 'focus_target' && tutorialCamera.projectionOnly
      ? tutorialCamera.zoom
    : tutorialCamera?.kind === 'focus_target' && tutorialCamera.target.kind === 'haven_resident'
      ? tutorialCamera.zoom ?? MOSSPROUT_WORLD_EGG_REST_ZOOM
      : undefined;
  useEffect(() => {
    const delays: Partial<Record<string, number>> = {
      'world.egg_intro': 4_100,
    };
    const delay = ftueStepId ? delays[ftueStepId] : undefined;
    if (delay == null || autoAdvancedStepRef.current === ftueStepId) return;
    const timer = setTimeout(() => {
      autoAdvancedStepRef.current = ftueStepId ?? null;
      onFtueInspectRef.current?.();
    }, delay);
    return () => clearTimeout(timer);
  }, [ftueStepId]);
  useEffect(() => {
    setInteractionLoadingVisible(false);
    if (!interactionCreatureId || interactionCameraReady) return;
    const loadingTimer = setTimeout(() => setInteractionLoadingVisible(true), 120);
    return () => {
      clearTimeout(loadingTimer);
    };
  }, [interactionCameraReady, interactionCreatureId]);
  const advanceOpening = useCallback(() => {
    onFtueInspect?.();
  }, [onFtueInspect]);
  const registerFtueTarget = useCallback((key: string, node: View | null) => {
    const current = ftueTargetRefs.current.get(key) ?? null;
    if (current === node) return;
    if (node) ftueTargetRefs.current.set(key, node);
    else ftueTargetRefs.current.delete(key);
    setFtueTargetRevision((revision) => revision + 1);
  }, []);
  const setRestoreButtonNode = useCallback((node: View | null) => {
    restoreButtonRef.current = node;
    registerFtueTarget('upgrade:mossprout', node);
  }, [registerFtueTarget]);
  const setGardenButtonNode = useCallback((node: View | null) => {
    registerFtueTarget('garden-button:mossprout', node);
  }, [registerFtueTarget]);
  const setGardenOrderNode = useCallback((orderId: string, node: View | null) => {
    registerFtueTarget(`garden-order:mossprout:${orderId}`, node);
  }, [registerFtueTarget]);
  const setGardenHandoffOrderNode = useCallback((node: View | null) => {
    setGardenOrderNode(gardenHandoffOrderId, node);
  }, [gardenHandoffOrderId, setGardenOrderNode]);
  const setFirstBloomRestoreButtonNode = useCallback((node: View | null) => {
    registerFtueTarget('upgrade:mossprout', ftueStepId === 'world.first_bloom_restore' ? node : null);
  }, [ftueStepId, registerFtueTarget]);
  const setHavenGuideNode = useCallback((node: View | null) => {
    registerFtueTarget('haven-guide', node);
  }, [registerFtueTarget]);
  useEffect(() => {
    firstBloomRestoreStartedRef.current = false;
  }, [ftueStepId]);
  useEffect(() => {
    if (ftueStepId === 'world.first_seed_grew') return;
    firstSeedReturnStartedRef.current = false;
    setFtueReturnFocusCreatureId(null);
  }, [ftueStepId]);
  useEffect(() => {
    if (ftueStepId !== 'world.garden_arrival') firstSeedPlantStartedRef.current = false;
  }, [ftueStepId]);
  useEffect(() => {
    if (ftueStepId !== 'haven.mossprout.focus' && ftueStepId !== 'haven.mossprout.restore') {
      ftueRestoreStartedRef.current = false;
      return;
    }
    if (ftueRestoreStartedRef.current) return;
    const mossprout = visibleCompanionSlots.find((slot) => (
      slot.familyId === 'mossprout' && slot.kind === 'owned'
    ));
    if (mossprout?.kind === 'owned') {
      setSelectedCreatureId(mossprout.creature.creatureId);
      if (ftueStepId === 'haven.mossprout.restore') setDetailCreatureId(mossprout.creature.creatureId);
    }
  }, [ftueStepId, visibleCompanionSlots]);
  useEffect(() => {
    if (upgrading || upgradePresentation || (mergeWorld.haven.tileStages.mossprout ?? 0) < 1 || !ftueStepId) return;
    if (ftueRecoveryRef.current === ftueStepId) return;
    if (ftueStepId === 'haven.mossprout.focus') {
      ftueRecoveryRef.current = ftueStepId;
      commitFtueAction({ actionId: 'haven.open_mossprout_upgrade', evidenceRef: 'haven:mossprout:already-restored' });
    } else if (ftueStepId === 'haven.mossprout.restore') {
      ftueRecoveryRef.current = ftueStepId;
      onFtueRestore?.();
    }
  }, [ftueStepId, mergeWorld.haven.tileStages.mossprout, onFtueRestore, upgradePresentation, upgrading]);
  const havenPresentations = useMemo(() => visibleCompanionSlots.flatMap((slot) => {
    if (slot.kind !== 'owned' || !HAVEN_ENVIRONMENTS[slot.familyId as MergeCharacterId]) return [];
    if (slot.familyId === 'mossprout' && (mergeWorld.haven.tileStages.mossprout ?? 0) >= 1) return [];
    return [deriveHavenTilePresentation({
      characterId: slot.familyId as MergeCharacterId,
      creatureId: slot.creature.creatureId,
      creatureName: slot.creature.name,
      mergeWorld,
      saving: upgrading && upgradePresentation?.characterId === slot.familyId,
    })];
  }), [mergeWorld, upgradePresentation?.characterId, upgrading, visibleCompanionSlots]);
  const havenOpeningActive = ftueStepId === 'world.egg_intro'
    || ftueStepId === 'world.garden_arrival'
    || ftueStepId === 'world.seed_planted'
    || ftueStepId === 'world.garden_handoff'
    || ftueStepId === 'world.first_bloom_restore'
    || ftueStepId === 'world.first_seed_grew';
  const ftueWorldCloseupActive = Boolean(ftueStepId && (
    ftueStepId === 'world.egg_intro'
    || ftueStepId.startsWith('egg.')
    || ftueStepId.startsWith('companion.')
  ));
  const ftueEggFeedingCloseupActive = ftueStepId === 'world.egg_intro'
    || Boolean(ftueStepId?.startsWith('egg.'));
  const gardenWorldGuidanceActive = ftueStepId === 'world.garden_arrival'
    || ftueStepId === 'world.seed_planted'
    || ftueStepId === 'world.garden_handoff'
    || ftueStepId === 'world.first_bloom_restore'
    || ftueStepId === 'world.first_seed_grew';
  const gardenWorldBottomCtaActive = ftueStepId === 'world.garden_arrival'
    || ftueStepId === 'world.seed_planted'
    || ftueStepId === 'world.first_seed_grew';
  const measureRestoreOrigin = useCallback(() => new Promise<{ x: number; y: number }>((resolve) => {
    const fallback = { x: window.width / 2, y: window.height - Math.max(90, insets.bottom + 66) };
    const node = restoreButtonRef.current;
    if (!node) {
      resolve(fallback);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      resolve(width > 0 && height > 0 ? { x: x + width / 2, y: y + height / 2 } : fallback);
    });
  }), [insets.bottom, window.height, window.width]);

  const beginUpgrade = useCallback(async (
    characterId: MergeCharacterId,
    creatureId: string,
    creatureName: string,
    currentStage: HavenStage,
    next: HavenEnvironmentStage,
  ) => {
    if (upgrading || upgradePresentation) return;
    setUpgrading(true);
    setUpgradeError(null);
    const coinOrigin = await measureRestoreOrigin();
    const presentation: HavenTileUpgradePresentation = {
      characterId,
      coinCost: next.coinCost,
      coinOrigin,
      creatureId,
      creatureName,
      fromStage: currentStage,
      nonce: ++upgradeNonceRef.current,
      palette: next.effectPalette ?? {
        accent: '#FFE28A',
        glow: '#A8E873',
        mist: 'rgba(226,255,213,0.88)',
        primary: '#4F9F57',
      },
      reactionLine: next.reactionLine ?? 'Look what we built together.',
      status: 'armed',
      toStage: next.stage,
      upgradeName: next.name,
    };
    if (ftueStepId === 'haven.mossprout.restore' && characterId === 'mossprout' && next.stage === 1) {
      ftueRestoreStartedRef.current = true;
    }
    setUpgradePresentation(presentation);
    setDetailCreatureId(null);

    // Give the canvas one frame to mount the old-art guard before the stored
    // snapshot publishes the new Haven stage.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const result = await upgradeStoredHavenTile(characterId, next.stage);
      if (!result.changed) throw new Error('The Haven upgrade could not be completed.');
      setUpgradePresentation({ ...presentation, status: 'playing' });
      if (characterId === 'mossprout' && next.stage >= 2) {
        const story = completeMossproutHavenUpgrade(next.stage);
        void reconcileStoredHavenStory('mossprout', story.currentLevel).catch(() => undefined);
      }
    } catch {
      if (ftueStepId === 'haven.mossprout.restore' && characterId === 'mossprout' && next.stage === 1) {
        ftueRestoreStartedRef.current = false;
      }
      setUpgradePresentation(null);
      setSelectedCreatureId(creatureId);
      setDetailCreatureId(creatureId);
      setUpgradeError('The restoration did not complete. Your Haven has not been changed. Please try again.');
      setUpgrading(false);
    }
  }, [ftueStepId, measureRestoreOrigin, upgradePresentation, upgrading]);

  const beginNatureIslandUpgrade = useCallback(async (
    islandId: MossproutNatureIslandId,
    nextLevel: MossproutNatureIslandLevel,
  ) => {
    if (upgrading || upgradePresentation) return;
    const island = mossproutNatureIslandById.get(islandId);
    const next = mossproutNatureIslandLevelDefinition(islandId, nextLevel);
    const mossproutSlot = visibleCompanionSlots.find((slot) => slot.kind === 'owned' && slot.familyId === 'mossprout');
    if (!island || !next || mossproutSlot?.kind !== 'owned') return;
    const currentLevel = mergeWorldRef.current.haven.mossproutNatureIslands[islandId] ?? 1;
    setUpgrading(true);
    setNatureUpgradeError(null);
    const coinOrigin = await measureRestoreOrigin();
    const presentation: HavenTileUpgradePresentation = {
      characterId: 'mossprout',
      coinCost: next.coinCost,
      coinOrigin,
      creatureId: mossproutSlot.creature.creatureId,
      creatureName: mossproutSlot.creature.name,
      fromStage: currentLevel,
      natureIslandId: islandId,
      nonce: ++upgradeNonceRef.current,
      palette: {
        accent: island.accent,
        glow: island.accent,
        mist: 'rgba(226,255,213,0.88)',
        primary: '#4F9F57',
      },
      reactionLine: `${island.shortName} is growing beautifully.`,
      status: 'armed',
      toStage: nextLevel,
      upgradeName: next.name,
    };
    setUpgradePresentation(presentation);
    setSelectedNatureIslandId(null);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const result = await upgradeStoredMossproutNatureIsland(islandId, nextLevel);
      if (!result.changed) throw new Error(result.message ?? 'The island could not grow.');
      setUpgradePresentation({ ...presentation, status: 'playing' });
      if (result.natureIslandUpgrade?.completedTier && nextLevel >= 2) {
        const story = completeMossproutHavenUpgrade(nextLevel);
        void reconcileStoredHavenStory('mossprout', story.currentLevel).catch(() => undefined);
      }
    } catch {
      setUpgradePresentation(null);
      setSelectedNatureIslandId(islandId);
      setNatureUpgradeError('The growth did not complete. Your Coins and island have not changed. Please try again.');
      setUpgrading(false);
    }
  }, [measureRestoreOrigin, upgradePresentation, upgrading, visibleCompanionSlots]);

  useStoryPresentationOperation('haven', STORY_WORLD_UPGRADE_PRESENTATION, async (work, run) => {
    const payload = work.payload as StoryWorldUpgradePresentationPayload;
    const receipt = contentFlowEffectResult<StoryWorldMutationReceipt>(
      run.effectReceipts,
      run.runId,
      payload.sourceEffectNodeId,
      payload.sourceEffectId,
    );
    if (!receipt) throw new Error(`Upgrade receipt for ${payload.sourceEffectNodeId} is not available`);

    const mossproutSlot = visibleCompanionSlots.find((slot) => slot.kind === 'owned' && slot.familyId === 'mossprout');
    const coinOrigin = await measureRestoreOrigin();
    let presentation: HavenTileUpgradePresentation;
    if (receipt.target.kind === 'haven_tile') {
      const characterId = receipt.target.characterId;
      const slot = visibleCompanionSlots.find((candidate) => candidate.kind === 'owned' && candidate.familyId === characterId);
      if (slot?.kind !== 'owned') throw new Error(`Haven resident ${characterId} is not visible`);
      const stage = HAVEN_ENVIRONMENTS[characterId]?.stages[receipt.toLevel];
      if (!stage) throw new Error(`Haven level ${receipt.toLevel} is not authored for ${characterId}`);
      presentation = {
        cameraAlreadyFocused: true,
        characterId,
        coinCost: receipt.coinCost,
        coinOrigin,
        creatureId: slot.creature.creatureId,
        creatureName: slot.creature.name,
        fromStage: receipt.fromLevel as HavenStage,
        nonce: ++upgradeNonceRef.current,
        palette: stage.effectPalette ?? {
          accent: '#FFE28A',
          glow: '#A8E873',
          mist: 'rgba(226,255,213,0.88)',
          primary: '#4F9F57',
        },
        reactionLine: payload.reactionLine ?? stage.reactionLine ?? 'Look what we built together.',
        showCoins: payload.showCoins ?? receipt.economyMode === 'normal',
        status: 'playing',
        storyPresentationKey: work.key,
        toStage: receipt.toLevel as HavenStage,
        upgradeName: stage.name,
        visualTarget: payload.target,
      };
    } else {
      const island = mossproutNatureIslandById.get(receipt.target.islandId);
      const level = mossproutNatureIslandLevelDefinition(receipt.target.islandId, receipt.toLevel as MossproutNatureIslandLevel);
      if (!island || !level || mossproutSlot?.kind !== 'owned') throw new Error(`Nature island ${receipt.target.islandId} is not ready`);
      presentation = {
        cameraAlreadyFocused: true,
        characterId: 'mossprout',
        coinCost: receipt.coinCost,
        coinOrigin,
        creatureId: mossproutSlot.creature.creatureId,
        creatureName: mossproutSlot.creature.name,
        fromStage: receipt.fromLevel as HavenStage,
        natureIslandId: receipt.target.islandId,
        nonce: ++upgradeNonceRef.current,
        palette: {
          accent: island.accent,
          glow: island.accent,
          mist: 'rgba(226,255,213,0.88)',
          primary: '#4F9F57',
        },
        reactionLine: payload.reactionLine ?? `${island.shortName} is growing beautifully.`,
        showCoins: payload.showCoins ?? receipt.economyMode === 'normal',
        status: 'playing',
        storyPresentationKey: work.key,
        toStage: receipt.toLevel as HavenStage,
        upgradeName: level.name,
        visualTarget: payload.target,
      };
    }

    setUpgrading(true);
    setDetailCreatureId(null);
    setSelectedNatureIslandId(null);
    setUpgradePresentation(presentation);
    await new Promise<void>((resolve) => storyUpgradeResolversRef.current.set(work.key, resolve));
  });

  const completeUpgradePresentation = useCallback((presentation: HavenTileUpgradePresentation) => {
    if (presentation.storyPresentationKey) {
      const resolve = storyUpgradeResolversRef.current.get(presentation.storyPresentationKey);
      storyUpgradeResolversRef.current.delete(presentation.storyPresentationKey);
      resolve?.();
    }
    setUpgradePresentation((current) => current?.nonce === presentation.nonce ? null : current);
    setUpgrading(false);
    if (
      ftueStepId === 'world.first_bloom_restore'
      && presentation.characterId === 'mossprout'
      && presentation.toStage === 1
    ) {
      dispatchFtueEvent({
        type: 'haven_upgrade_completed',
        characterId: 'mossprout',
        stage: 1,
        revision: mergeWorldRef.current.revision,
      }, presentation.storyPresentationKey ?? 'first-bloom-upgrade');
    }
    if (
      ftueStepId === 'haven.mossprout.restore'
      && presentation.characterId === 'mossprout'
      && presentation.toStage === 1
    ) {
      ftueRecoveryRef.current = ftueStepId;
      onFtueRestore?.();
    }
  }, [ftueStepId, onFtueRestore]);

  const beginFirstBloomRestore = useCallback(() => {
    if (ftueStepId !== 'world.first_bloom_restore' || firstBloomRestoreStartedRef.current) return;
    firstBloomRestoreStartedRef.current = true;
    const next = commitFtueAction({
      actionId: 'world.restore_with_first_bloom',
      evidenceRef: 'first-bloom:restore-button',
      nextStepId: 'world.first_bloom_restore',
    });
    if (next?.stepId !== 'world.first_bloom_restore') firstBloomRestoreStartedRef.current = false;
  }, [ftueStepId]);

  const beginFirstSeedPlanting = useCallback(() => {
    if (ftueStepId !== 'world.garden_arrival' || firstSeedPlantStartedRef.current) return;
    firstSeedPlantStartedRef.current = true;
    void advanceFtueActionDurably({
      expectedStepId: 'world.garden_arrival',
      actionId: 'world.plant_first_seed',
      evidenceRef: 'garden-plot:front-left',
      nextStepId: 'world.seed_planted',
    }).then((result) => {
      if (result.run?.stepId !== 'world.seed_planted') firstSeedPlantStartedRef.current = false;
    }).catch(() => {
      firstSeedPlantStartedRef.current = false;
    });
  }, [ftueStepId]);

  const beginFirstSeedReturn = useCallback(() => {
    if (ftueStepId !== 'world.first_seed_grew' || firstSeedReturnStartedRef.current) return;
    const mossprout = visibleCompanionSlots.find((slot) => (
      slot.kind === 'owned' && slot.familyId === 'mossprout'
    ));
    if (!mossprout || mossprout.kind !== 'owned') return;
    firstSeedReturnStartedRef.current = true;
    setSelectedCreatureId(mossprout.creature.creatureId);
    setDetailCreatureId(null);
    setFtueReturnFocusCreatureId(mossprout.creature.creatureId);
  }, [ftueStepId, visibleCompanionSlots]);

  const openHavenDetail = useCallback((creatureId: string) => {
    const presentation = havenPresentations.find((candidate) => candidate.creatureId === creatureId);
    if (!presentation) return;
    if (ftueStepId === 'haven.mossprout.focus' && presentation.characterId !== 'mossprout') return;
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCreatureId(creatureId);
    setDetailCreatureId(creatureId);
    if (ftueStepId === 'haven.mossprout.focus' && presentation.characterId === 'mossprout') {
      commitFtueAction({ actionId: 'haven.open_mossprout_upgrade', evidenceRef: 'haven:mossprout:hud-opened' });
    }
  }, [ftueStepId, havenPresentations]);

  const selectResident = useCallback((creatureId: string) => {
    const presentation = havenPresentations.find((candidate) => candidate.creatureId === creatureId);
    if (ftueStepId === 'haven.mossprout.focus' && presentation?.characterId !== 'mossprout') return;
    if (ftueStepId === 'haven.mossprout.restore') return;
    setSelectedCreatureId(creatureId);
    setDetailCreatureId(null);
    setHostedInteractionRequest(null);
    setInteractionCameraReady(false);
    setInteractionExiting(false);
    setInteractionCreatureId(creatureId);
  }, [ftueStepId, havenPresentations]);

  useEffect(() => {
    if (!interactionRequest || handledInteractionRequestRef.current === interactionRequest.key) return;
    if (mossproutFtueUsesHostedCompanionStage(ftueStep?.id)) {
      handledInteractionRequestRef.current = interactionRequest.key;
      onInteractionRequestConsumed?.();
      return;
    }
    const requestedSlot = visibleCompanionSlots.find((slot) => (
      slot.kind === 'owned' && slot.creature.creatureId === interactionRequest.creatureId
    ));
    if (!requestedSlot || requestedSlot.kind !== 'owned') return;
    handledInteractionRequestRef.current = interactionRequest.key;
    setSelectedCreatureId(interactionRequest.creatureId);
    setDetailCreatureId(null);
    setHostedInteractionRequest(interactionRequest);
    // A new story mode for the resident already in focus (notably Seed ->
    // meditation) is an in-place interaction update. Resetting readiness here
    // waits for a second camera completion that intentionally never runs.
    if (interactionCreatureIdRef.current !== interactionRequest.creatureId) {
      setInteractionCameraReady(false);
      setInteractionExiting(false);
      setInteractionCreatureId(interactionRequest.creatureId);
    }
    onInteractionRequestConsumed?.();
  }, [ftueStep?.id, interactionRequest, onInteractionRequestConsumed, visibleCompanionSlots]);

  const completeResidentFocus = useCallback((creatureId: string) => {
    if (ftueReturnFocusCreatureId === creatureId) {
      void advanceFtueActionDurably({
        expectedStepId: 'world.first_seed_grew',
        actionId: 'world.acknowledge_first_seed_growth',
        evidenceRef: 'mossprout-world:first-seed-grew',
        nextStepId: 'companion.chapter_zero_return',
      }).then((result) => {
        if (result.run?.stepId === 'companion.chapter_zero_return') return;
        firstSeedReturnStartedRef.current = false;
        setFtueReturnFocusCreatureId(null);
      }).catch(() => {
        firstSeedReturnStartedRef.current = false;
        setFtueReturnFocusCreatureId(null);
      });
      return;
    }
    if (interactionCreatureIdRef.current === creatureId) setInteractionCameraReady(true);
  }, [ftueReturnFocusCreatureId]);

  const closeResidentInteraction = useCallback(() => {
    setInteractionCameraReady(false);
    setInteractionExiting(false);
    setInteractionLoadingVisible(false);
    setHostedInteractionRequest(null);
    setInteractionCreatureId(null);
  }, []);
  useEffect(() => {
    if (!interactionCreatureId || !ftueStepId || ftueStepId.startsWith('companion.')) return;
    // Companion dialogue and world interaction share this mounted Haven host.
    // Release the transparent dialogue layer as soon as the graph hands
    // ownership back to a world node; otherwise it disables world controls
    // while the FTUE spotlight can still point at them.
    closeResidentInteraction();
  }, [closeResidentInteraction, ftueStepId, interactionCreatureId]);
  const requestResidentInteractionExit = useCallback(() => {
    if (!interactionCreatureIdRef.current) return;
    // Ordinary FTUE beats own the close gesture. The terminal Tend action has
    // already completed the durable run synchronously, even though this
    // component can still hold the previous FTUE prop for one frame.
    if (ftueStepId && loadFtueRun()?.status !== 'complete') return;
    setInteractionCameraReady(false);
    setInteractionExiting(true);
    setInteractionExitNonce((current) => current + 1);
  }, [ftueStepId]);
  useEffect(() => {
    if (!interactionCreatureId || ftueStepId) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      requestResidentInteractionExit();
      return true;
    });
    return () => subscription.remove();
  }, [ftueStepId, interactionCreatureId, requestResidentInteractionExit]);
  const pulseVisibleResident = useCallback(() => {
    setInteractionRewardPulseKey((current) => current + 1);
  }, []);

  const openGarden = useCallback((orderId?: string | null, requestedFamilyId?: KatchimeraFamilyId) => {
    const familyId = requestedFamilyId ?? interactionSlot?.familyId ?? 'mossprout';
    if (familyId !== 'mossprout' || !havenMergeBoardActive) return;
    transitionTo({
      announcement: "Opening Mossprout's Garden",
      target: 'merge',
      onCovered: closeResidentInteraction,
      navigate: () => {
        router.push({
          pathname: '/katchimera/[creatureId]/activity',
          params: {
            creatureId: 'companion:mossprout',
            source: 'haven-world',
            ...(orderId ? { focusOrderId: orderId } : {}),
          },
        });
      },
    });
  }, [closeResidentInteraction, havenMergeBoardActive, interactionSlot?.familyId, router, transitionTo]);

  return (
    <View collapsable={false} onLayout={onContentReady} ref={screenRef} style={styles.screen}>
      <KingdomHexCanvas
        background={background}
        cameraLocked={Boolean(ftueStep && ftueStep.surface === 'haven')}
        cameraMaximumScale={ftueEggFeedingCloseupActive
          ? MOSSPROUT_WORLD_EGG_CLOSE_ZOOM
          : ftueReturnResidentZoom != null
            ? ftueReturnResidentZoom
            : ftueWorldCloseupActive || Boolean(activeInteractionResidentId)
              ? MOSSPROUT_WORLD_EGG_REST_ZOOM
              : undefined}
        companionSlots={visibleCompanionSlots}
        identity={identity}
        discoveryRevealFamilyId={null}
        highlightedLockedFamilyId={null}
        interactionEnabled={!activeInteractionResidentId && (havenOpeningActive || !ftueStep || ftueStep.surface !== 'haven')}
        interactionExitNonce={interactionExitNonce}
        interactionResidentAnchorY={ftueReturnResidentAnchorY}
        interactionResidentId={activeInteractionResidentId}
        interactionRewardPulseKey={interactionRewardPulseKey}
        gardenOrders={ftueStepId === 'world.garden_handoff' ? [] : gardenOrderEntries}
        gardenOrdersInteractive={false}
        initialTutorialCameraScale={initialFtueCameraScale}
        initialCameraSnapshot={initialCameraSnapshot}
        mossproutNatureIslandLevels={mergeWorld.haven.mossproutNatureIslands}
        mossproutGarden={mossproutGardenScene}
        onCameraSnapshotChange={onCameraSnapshotChange}
        onInteractionExitFocusComplete={closeResidentInteraction}
        onOpenGarden={openGarden}
        onTileUpgradeOfferPress={beginFirstBloomRestore}
        onTileUpgradeOfferTargetChange={setFirstBloomRestoreButtonNode}
        onSelectHome={() => {}}
        onSelectLocked={(familyId) => {
          if (!ftueStep || ftueStep.surface !== 'haven') setLockedHintVisible(true);
        }}
        onSelectNatureIsland={(islandId) => {
          if (ftueStep?.surface === 'haven') return;
          if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setNatureUpgradeError(null);
          setSelectedNatureIslandId(islandId);
        }}
        onSelectMemoryPlant={setSelectedMemoryPlantId}
        onSelectMovementEgg={() => setMovementEggOpen(true)}
        onSelectResident={selectResident}
        onResidentFocusComplete={completeResidentFocus}
        onResidentAnchorsChange={updateResidentAnchors}
        onUpgradePresentationComplete={completeUpgradePresentation}
        recenterBottom={Math.max(insets.bottom, 12) + 150}
        residentStatusGlyphs={residentStatusGlyphs}
        tileUpgradeOffer={ftueStepId === 'world.first_bloom_restore'
          ? FIRST_BLOOM_GARDEN_UPGRADE_OFFER
          : null}
        tutorialCamera={tutorialCamera}
        upgradePresentation={upgradePresentation}
        focusedMossproutWorld
        worldEggTargetRef={worldEggTargetRef}
        worldSubjectPresentation={worldSubjectPresentation}
      />
      {!upgradePresentation && !activeInteractionResidentId ? (
        <HavenTileHudLayer
          anchors={residentAnchors}
          bottomInset={Math.max(insets.bottom, 12)}
          height={window.height}
          interactionCharacterId={ftueStepId === 'haven.mossprout.focus' ? 'mossprout' : ftueStepId === 'haven.mossprout.restore' ? '__none__' : null}
          onOpen={openHavenDetail}
          onTargetRef={(characterId, node) => registerFtueTarget(`hud:${characterId}`, node)}
          presentations={havenPresentations}
          selectedCreatureId={selectedCreatureId}
          topInset={insets.top}
          width={window.width}
        />
      ) : null}
      {!upgradePresentation && !ftueStepId ? (
        <Animated.View entering={FadeIn.duration(reduceMotion ? 100 : 360)} pointerEvents="box-none" style={[styles.topHudLayer, { top: insets.top + 3 }]}>
          <GameHudBar
            leading={<KatchimeraBackButton
              accessibilityHint={interactionCreatureId ? "Returns to this Katchimera's world" : 'Returns to the Katchimera world map'}
              accessibilityLabel={interactionCreatureId ? 'Exit interaction' : 'All Havens'}
              compact
              disabled={interactionExiting || (!interactionCreatureId && navigationLocked)}
              onPress={interactionCreatureId ? requestResidentInteractionExit : onBackToHavenSelector}
            />}
            content={<GameCurrencyHud balances={[{
              art: GAME_CURRENCY_ART.coins,
              id: 'coins',
              value: mergeWorld.coins,
            }]} style={styles.currencyHud} tone="glass" />}
            density="compact"
            style={styles.topHud}
            tone="glass"
          />
        </Animated.View>
      ) : null}
      {!upgradePresentation && !activeInteractionResidentId && havenMergeBoardActive && (!havenOpeningActive || ftueStepId === 'world.garden_handoff') ? (
        <Animated.View
          entering={FadeIn
            .duration(reduceMotion ? 80 : 260)
            .delay(ftueStepId === 'world.garden_handoff' && !reduceMotion ? 260 : 0)}
          style={[styles.gardenButtonCluster, { bottom: Math.max(insets.bottom, 12) + 10 }]}>
          {ftueStepId === 'world.garden_handoff' ? (
            <View
              accessibilityLabel="Plant needed for Mossprout's first Garden order"
              collapsable={false}
              ref={setGardenHandoffOrderNode}
              style={styles.gardenRequestBubble}>
              <PersistentMergeItemArt definitionId={gardenHandoffPlantDefinitionId} size={68} />
              <View style={styles.gardenRequestBubbleTail} />
            </View>
          ) : null}
          <View style={styles.gardenButton}>
            <Pressable
              accessibilityHint="Opens the dedicated Merge Garden"
              accessibilityLabel="Open Garden"
              accessibilityRole="button"
              disabled={navigationLocked && ftueStepId !== 'world.garden_handoff'}
              onPress={ftueStepId === 'world.garden_handoff' ? onFtueOpenGarden : () => openGarden()}
              ref={setGardenButtonNode}
              style={({ pressed }) => [
                styles.gardenButtonPressable,
                pressed && styles.gardenButtonPressed,
              ]}>
              <Image
                accessibilityIgnoresInvertColors
                allowDownscaling
                cachePolicy="memory-disk"
                contentFit="contain"
                source={GARDEN_BUTTON_ART}
                style={StyleSheet.absoluteFill}
                transition={0}
              />
              <ThemedText style={styles.gardenButtonLabel} lightColor="#5B3514" darkColor="#5B3514">Garden</ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
      {interactionCreatureId ? (
        <View
          accessibilityElementsHidden={!interactionCameraReady || interactionExiting}
          importantForAccessibility={interactionCameraReady && !interactionExiting ? 'auto' : 'no-hide-descendants'}
          pointerEvents={interactionCameraReady && !interactionExiting ? 'auto' : 'none'}
          style={[styles.companionOverlay, (!interactionCameraReady || interactionExiting) && styles.companionOverlayPreparing]}>
          <KatchimeraCompanionRouteScreen
            creatureId={interactionCreatureId}
            ftueConversationDefinitionId={hostedInteractionRequest?.ftueConversationDefinitionId}
            hostedInHaven
            journeyReturnConversationDefinitionId={hostedInteractionRequest?.journeyReturnConversationDefinitionId}
            onHostedClose={requestResidentInteractionExit}
            onHostedFtueComplete={closeResidentInteraction}
            onHostedOpenMerge={interactionHasGarden ? openGarden : undefined}
            onVisibleCreatureRewardPulse={pulseVisibleResident}
            residentStoryResumeRequested={hostedInteractionRequest?.residentStoryResumeRequested}
            reuseUnderlyingStage
            source={hostedInteractionRequest?.source}
          />
        </View>
      ) : null}
      {interactionCreatureId && !interactionCameraReady && !interactionExiting && interactionLoadingVisible ? (
        <View accessibilityLabel="Preparing Katchimera interaction" accessibilityLiveRegion="polite" pointerEvents="none" style={styles.interactionLoading}>
          <ActivityIndicator color="#FFF4C7" size="small" />
        </View>
      ) : null}
      {lockedHintVisible ? (
        <KatchaSheet
          header={{
            eyebrow: 'UNDISCOVERED KATCHIMERA',
            title: 'Hidden in the Dream Mist',
            subtitle: 'A new companion is waiting somewhere beyond the clouds.',
          }}
          onRequestClose={() => setLockedHintVisible(false)}
          surface="night">
          <View style={styles.discoveryHint}>
            <ThemedText selectable style={styles.discoveryHintText} lightColor="#E9E3F5" darkColor="#E9E3F5">
              Keep living days and growing your relationships to discover who is waiting here.
            </ThemedText>
          </View>
        </KatchaSheet>
      ) : null}
      {selectedNatureIslandId && !upgradePresentation ? (
        <MossproutNatureIslandSheet
          error={natureUpgradeError}
          islandId={selectedNatureIslandId}
          mergeWorld={mergeWorld}
          onClose={() => {
            setNatureUpgradeError(null);
            setSelectedNatureIslandId(null);
          }}
          onUpgrade={beginNatureIslandUpgrade}
          saving={upgrading}
        />
      ) : null}
      {selectedMemoryPlant && selectedMemoryPlantDefinition && !upgradePresentation ? (
        <KatchaSheet
          header={{
            eyebrow: `MEMORY PLANT · ${mossproutMemoryPlantStage(selectedMemoryPlant.growthPoints).toUpperCase()}`,
            title: selectedMemoryPlantDefinition.name,
            subtitle: selectedMemoryPlantDefinition.description,
          }}
          onRequestClose={() => setSelectedMemoryPlantId(null)}
          surface="parchment">
          <View style={styles.memoryPlantDetail}>
            <Image
              contentFit="contain"
              source={selectedMemoryPlantDefinition.art[mossproutMemoryPlantStage(selectedMemoryPlant.growthPoints)]}
              style={styles.memoryPlantArt}
            />
            <ThemedText selectable style={styles.memoryPlantReflection}>
              “{selectedMemoryPlantDefinition.reflection}”
            </ThemedText>
            <ThemedText selectable style={styles.memoryPlantProgress}>
              Growth {selectedMemoryPlant.growthPoints} · {selectedMemoryPlant.slotId?.replace('-', ' ') ?? 'Not planted'}
            </ThemedText>
          </View>
        </KatchaSheet>
      ) : null}
      {movementEggOpen && mergeWorld.haven.movementEgg.status !== 'hidden' && !upgradePresentation ? (
        <KatchaSheet
          footer={mergeWorld.haven.movementEgg.status === 'stirring' ? undefined : (
            <View style={styles.actions}>
              {!movementStepsUnavailable ? <KatchaButton
                disabled={movementStepsBusy}
                fullWidth
                icon="figure.walk"
                label={movementStepsBusy ? 'Checking Steps…' : 'Connect Steps'}
                onPress={() => {
                  setMovementStepsBusy(true);
                  void (async () => {
                    const access = await getPedometerAccess();
                    const available = access === 'available' || (access === 'should_request' && await requestPedometerAccess());
                    if (!available) {
                      setMovementStepsUnavailable(true);
                      return;
                    }
                    const [today] = await readRecentPedometerStepDays(new Date(), 1);
                    await recordStoredMovementEggProgress({
                      observedSteps: today?.totalSteps ?? 0,
                      receiptId: `movement-egg:steps:${today?.dayId ?? localDayId()}:${today?.totalSteps ?? 0}`,
                    });
                  })().catch(() => setMovementStepsUnavailable(true)).finally(() => setMovementStepsBusy(false));
                }}
              /> : null}
              <KatchaButton
                fullWidth
                icon="figure.walk"
                label="Log some movement"
                onPress={() => {
                  void recordStoredMovementEggProgress({
                    manualMovement: true,
                    receiptId: `movement-egg:manual:${localDayId()}`,
                  });
                }}
                variant="secondary"
              />
            </View>
          )}
          header={{
            eyebrow: 'SOMETHING WAS HIDDEN HERE…',
            title: mergeWorld.haven.movementEgg.status === 'stirring' ? 'Something inside moved' : 'A mysterious egg',
            subtitle: 'Something inside seems to respond to movement.',
          }}
          onRequestClose={() => setMovementEggOpen(false)}
          surface="night">
          <View style={styles.movementEggDetail}>
            <Image contentFit="contain" source={require('../../../assets/images/katchimeras/cutouts/egg-base.webp')} style={styles.movementEggArt} />
            <ThemedText style={styles.movementEggProgress} lightColor="#F8FCFF" darkColor="#F8FCFF">
              {mergeWorld.haven.movementEgg.observedSteps > 0
                ? `${Math.min(500, mergeWorld.haven.movementEgg.observedSteps)} / 500 steps`
                : mergeWorld.haven.movementEgg.status === 'stirring'
                  ? 'Movement noticed'
                  : 'Use steps if available, or log a little movement yourself.'}
            </ThemedText>
          </View>
        </KatchaSheet>
      ) : null}
      {havenOpeningActive && ftueStep && !activeInteractionResidentId ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.discoveryCalloutLayer,
            ftueStepId === 'world.garden_handoff' && styles.discoveryCalloutLayerAboveSpotlight,
            gardenWorldBottomCtaActive
              ? {
                  bottom: Math.max(insets.bottom, 12) + 22,
                  justifyContent: 'space-between',
                  top: insets.top + 18,
                }
              : gardenWorldGuidanceActive || ftueStepId === 'world.egg_intro'
              ? { top: insets.top + 18 }
              : { bottom: Math.max(insets.bottom, 12) + 12 },
          ]}>
          <View collapsable={false} pointerEvents="none" ref={setHavenGuideNode} style={styles.discoveryCallout}>
            <FtueGuideCopy guide={ftueStep.guide} hero />
          </View>
          {!['world.egg_intro', 'world.garden_handoff', 'world.first_bloom_restore'].includes(ftueStepId ?? '')
            && (ftueStepId !== 'world.seed_planted' || firstSeedPlanted)
            && (ftueStepId !== 'world.first_seed_grew' || firstSeedGrown) ? <View style={styles.discoveryCalloutButton}>
            <KatchaButton
              fullWidth
              glow={ftueStepId === 'world.garden_arrival'}
              icon={ftueStep.actions[0]?.icon ?? 'sparkles'}
              label={ftueStep.actions[0]?.title ?? 'Continue'}
              onPress={ftueStepId === 'world.garden_arrival'
                ? beginFirstSeedPlanting
                : ftueStepId === 'world.first_seed_grew'
                  ? beginFirstSeedReturn
                  : advanceOpening}
            />
          </View> : null}
        </View>
      ) : null}
      {detailCreatureId ? (() => {
        const slot = visibleCompanionSlots.find((candidate) => candidate.kind === 'owned' && candidate.creature.creatureId === detailCreatureId);
        if (!slot || slot.kind !== 'owned') return null;
        const characterId = slot.familyId as MergeCharacterId;
        const environment = HAVEN_ENVIRONMENTS[characterId];
        const currentStage = mergeWorld.haven.tileStages[characterId] ?? 0;
        const current = environment?.stages[currentStage];
        const next = characterId === 'mossprout' && currentStage >= 1
          ? undefined
          : environment?.stages[currentStage + 1];
        const storyReady = next ? havenStoryGateSatisfied(mergeWorld, next.storyGate) : false;
        const currentArt = havenHexTileSpec(characterId, currentStage);
        const nextArt = next ? havenHexTileSpec(characterId, next.stage) : null;
        return <KatchaSheet
          footer={<View style={styles.actions}>
            {next ? <View ref={characterId === 'mossprout' ? setRestoreButtonNode : undefined} style={styles.restoreButtonAnchor}>
              <KatchaButton
                disabled={!storyReady || mergeWorld.coins < next.coinCost || upgrading}
                fullWidth
                icon="sparkles"
                label={`Restore · ${next.coinCost} Coins`}
                onPress={() => void beginUpgrade(characterId, slot.creature.creatureId, slot.creature.name, currentStage, next)}
              />
            </View> : null}
            {ftueStepId !== 'haven.mossprout.restore' ? <KatchaButton fullWidth label={`Visit ${slot.creature.name}`} onPress={() => selectResident(slot.creature.creatureId)} variant="secondary" /> : null}
          </View>}
          header={{ eyebrow: `${slot.creature.name.toUpperCase()} · HAVEN LV${currentStage}`, title: current?.name ?? `${slot.creature.name}’s Haven`, subtitle: current?.narrative ?? 'A home with room to grow.' }}
          onRequestClose={() => { if (ftueStepId !== 'haven.mossprout.restore') setDetailCreatureId(null); }}
          portal={ftueStepId !== 'haven.mossprout.restore'}
          scroll
          showClose={ftueStepId !== 'haven.mossprout.restore'}
          surface="night">
          <View style={styles.progressCard}>
            <ThemedText style={styles.progressEyebrow} lightColor="#B7D98B" darkColor="#B7D98B">ENVIRONMENT · {currentStage} / 4</ThemedText>
            <View style={styles.previewRow}>
              {currentArt ? <View style={styles.previewCell}>
                <Image contentFit="contain" source={kingdomHexTileSourceForLod(currentArt, 'medium')} style={styles.previewImage} />
                <ThemedText style={styles.previewLabel} lightColor="#D7E2D1" darkColor="#D7E2D1">CURRENT</ThemedText>
              </View> : null}
              {nextArt ? <View style={styles.previewCell}>
                <Image blurRadius={storyReady ? 0 : 8} contentFit="contain" source={kingdomHexTileSourceForLod(nextArt, 'medium')} style={[styles.previewImage, !storyReady && styles.previewLocked]} />
                <ThemedText style={styles.previewLabel} lightColor="#D7E2D1" darkColor="#D7E2D1">NEXT</ThemedText>
              </View> : null}
            </View>
            {next ? <>
              <ThemedText style={styles.nextTitle} lightColor="#F8FCFF" darkColor="#F8FCFF">Next: {next.name}</ThemedText>
              <ThemedText style={styles.discoveryHintText} lightColor="#D7E2D1" darkColor="#D7E2D1">{next.narrative}</ThemedText>
              <View style={styles.requirementRow}>
                <ThemedText style={styles.requirement} lightColor={storyReady ? '#CBEBA5' : '#E8C889'} darkColor={storyReady ? '#CBEBA5' : '#E8C889'}>{storyReady ? '✓ Story ready' : '◌ Story locked'}</ThemedText>
                <ThemedText style={styles.requirement} lightColor="#FFE19A" darkColor="#FFE19A">Grows through Journey Days</ThemedText>
              </View>
            </> : <ThemedText style={styles.nextTitle} lightColor="#FFE19A" darkColor="#FFE19A">Signature Haven complete</ThemedText>}
            {upgradeError ? <ThemedText selectable style={styles.upgradeError} lightColor="#FFD2C8" darkColor="#FFD2C8">{upgradeError}</ThemedText> : null}
          </View>
        </KatchaSheet>;
      })() : null}
      {!upgradePresentation && !interactionCreatureId && (ftueStepId === 'haven.mossprout.focus' || ftueStepId === 'haven.mossprout.restore' || ftueStepId === 'world.garden_handoff' || ftueStepId === 'world.first_bloom_restore') ? (
        <HavenFtueOverlay
          cue={ftueStep?.cue ?? null}
          screenRef={screenRef}
          spotlight={ftueStep?.spotlight ?? null}
          targetRefs={ftueTargetRefs}
          targetRevision={ftueTargetRevision}
        />
      ) : null}
      {ftueStepId === 'world.egg_intro' ? <FtueOpeningFade /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#55A9E2', flex: 1 },
  openingFade: { backgroundColor: '#203447', zIndex: 100 },
  companionOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 45 },
  companionOverlayPreparing: { opacity: 0 },
  interactionLoading: {
    alignItems: 'center',
    backgroundColor: 'rgba(31,44,30,0.72)',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -19,
    marginTop: -19,
    position: 'absolute',
    top: '50%',
    width: 38,
    zIndex: 46,
  },
  topHudLayer: {
    alignItems: 'center',
    left: 12,
    position: 'absolute',
    right: 12,
    zIndex: 50,
  },
  topHud: { maxWidth: 430, width: '100%' },
  currencyHud: { flex: 1 },
  gardenButton: {
    height: 132,
    width: 132,
  },
  gardenButtonCluster: {
    alignItems: 'center',
    position: 'absolute',
    right: 8,
    zIndex: 32,
  },
  gardenButtonPressable: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
  },
  gardenButtonPressed: { opacity: 0.9, transform: [{ scale: 0.96 }] },
  gardenButtonLabel: {
    fontFamily: AppFontFamilies.fredokaBold,
    fontSize: 19,
    lineHeight: 23,
    marginTop: 33,
    textAlign: 'center',
  },
  gardenRequestBubble: {
    alignItems: 'center',
    backgroundColor: '#FFF8D8',
    borderColor: 'rgba(95,67,31,0.24)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: '0 7px 18px rgba(49,36,19,0.24)',
    height: 94,
    justifyContent: 'center',
    marginBottom: 3,
    width: 94,
  },
  gardenRequestBubbleTail: {
    backgroundColor: '#FFF8D8',
    bottom: -6,
    height: 12,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 12,
  },
  discoveryHint: {
    backgroundColor: 'rgba(214,203,242,0.09)',
    borderColor: 'rgba(214,203,242,0.2)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  discoveryHintText: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  discoveryCalloutLayer: {
    gap: 10,
    left: 16,
    position: 'absolute',
    right: 16,
    zIndex: 40,
  },
  discoveryCalloutLayerAboveSpotlight: { zIndex: 90 },
  discoveryCallout: {
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: 430,
    width: '100%',
  },
  discoveryCalloutButton: { alignSelf: 'center', maxWidth: 430, width: '100%' },
  actions: { gap: 10 },
  restoreButtonAnchor: { width: '100%' },
  progressCard: { backgroundColor: 'rgba(214,233,197,0.08)', borderColor: 'rgba(203,235,165,0.2)', borderRadius: 20, borderWidth: 1, gap: 9, padding: 17 },
  progressEyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  nextTitle: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 22, lineHeight: 27 },
  requirementRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
  requirement: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '800' },
  upgradeError: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  previewRow: { flexDirection: 'row', gap: 10 },
  previewCell: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 16, flex: 1, overflow: 'hidden', padding: 6 },
  previewImage: { aspectRatio: 1, width: '100%' },
  previewLocked: { opacity: 0.58 },
  previewLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  memoryPlantDetail: { alignItems: 'center', gap: 12, paddingBottom: 8 },
  memoryPlantArt: { height: 210, width: 210 },
  memoryPlantReflection: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 21, lineHeight: 27, maxWidth: 330, textAlign: 'center' },
  memoryPlantProgress: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '800', opacity: 0.68, textTransform: 'capitalize' },
  movementEggDetail: { alignItems: 'center', gap: 10, paddingBottom: 8 },
  movementEggArt: { height: 190, width: 190 },
  movementEggProgress: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '800', lineHeight: 21, maxWidth: 330, textAlign: 'center' },
});
