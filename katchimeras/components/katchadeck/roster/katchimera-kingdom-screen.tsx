import { useStepplingGardenLesson } from '@/features/onboarding/steppling-garden-runtime';
import { advanceGlowUpgrade, recoverPaidGlowUpgrade } from '@/features/onboarding/glow-upgrade-runtime';
import { worldUpgradeRunId } from '@/features/world-upgrades/world-upgrade-flows';
import { visibleWorldUpgradeOffers, worldUpgradeOffers, type WorldUpgradeOffer } from '@/features/world-upgrades/world-upgrade-offers';
import { purchaseWorldUpgrade, useWorldUpgradeRun } from '@/features/world-upgrades/world-upgrade-runtime';
import { dispatchContentFlowCommand } from '@/features/content-flow/content-flow-director';
import { WorldUpgradeSheet } from '@/components/katchadeck/world/world-upgrade-sheet';
import { worldUpgradePreview } from '@/components/katchadeck/world/world-upgrade-preview';
import { useGlowEggHandoff } from '@/features/onboarding/use-glow-egg-handoff';
import { CompanionJournalButton } from '@/components/katchadeck/world/companion-life-actions';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, View, useWindowDimensions, type View as ViewType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useIsFocused } from '@react-navigation/native';
import { GlowGatewayGuide } from '@/components/katchadeck/world/glow-gateway-guide';
import { StepplingEncounterPanel } from '@/components/katchadeck/world/steppling-encounter-panel';
import { SHARED_EGG_REST_ZOOM, usesSharedResidentStage } from '@/components/katchadeck/world/shared-resident-presentation';
import { EggFeedOverlay } from '@/components/katchadeck/home/egg-feed-overlay';
import { useStepplingEncounter } from '@/features/onboarding/use-steppling-encounter';
import { startGlowDiscovery, submitGlowAction, useGlowDiscoveryState } from '@/features/onboarding/glow-discovery-runtime';
import { glowDiscoveryAllowsGarden, glowDiscoveryLocksCamera, glowDiscoveryResumeCamera, glowDiscoveryScene } from '@/features/onboarding/glow-discovery-flow';
import { ftueLocksCamera } from '@/features/onboarding/ftue-camera-policy';
import { glowGatewayState } from '@/utils/merge-world/glow-discovery-policy';
import { sharedWorldIncludesCompanion } from '@/constants/shared-world';
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
  type KingdomResidentStatusGlyph,
  type KingdomTileUpgradeOffer,
} from '@/components/katchadeck/world/kingdom-hex-canvas';
import { KatchimeraCompanionRouteScreen } from '@/components/katchadeck/world/katchimera-companion-route-screen';
import { MossproutNatureIslandSheet } from '@/components/katchadeck/world/mossprout-nature-island-sheet';
import { HavenFtueOverlay } from '@/components/katchadeck/onboarding/haven-ftue-overlay';
import { FtueGuideCopy } from '@/components/katchadeck/onboarding/ftue-guide-copy';
import { FTUE_SCENE_LAYERS } from '@/constants/ftue-scene-layers';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { GameCurrencyHud } from '@/components/katchadeck/ui/game-currency-hud';
import { MergeFtueEggGuide } from '@/components/katchadeck/games/merge-ftue-overlay';
import { GameHudBar } from '@/components/katchadeck/ui/game-primitives';
import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
import { ThemedText } from '@/components/themed-text';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { mossproutMemoryPlantById, mossproutMemoryPlantStage } from '@/constants/mossprout-memory-plants';
import { MOSSPROUT_FIRST_MEMORY_SLOT_ID } from '@/utils/mossprout-garden-layout';
import { AppFontFamilies } from '@/constants/theme';
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import { loadWorldIdentity } from '@/utils/world-identity';
import type { KingdomHexCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import type { MergeCharacterId, MergeWorldState, MossproutGardenPlantSlotId, MossproutNatureIslandId, MossproutNatureIslandLevel, StoryWorldMutationReceipt } from '@/types/merge-world';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import { HAVEN_ENVIRONMENTS, type HavenStage } from '@/constants/haven-catalog';
import { ensureStoredFirstFtueMemoryPlacement } from '@/utils/merge-world/repository';
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
  mossproutFtueShowsWorldGarden,
} from '@/features/onboarding/mossprout-ftue-script';
import { activeKatchimeraMeditation } from '@/game/katchimeras/relationship-progression';
import type { KingdomCameraSnapshot } from '@/utils/kingdom-rendering';
import { useGameScreenTransition } from '@/features/navigation/game-screen-transition';
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
const FIRST_SEED_GARDEN_PLANT_OFFER = {
  accessibilityHint: 'Plants your first Memory Seed in the highlighted Garden patch',
  placement: 'below',
  gap: 12,
  icon: 'leaf.fill',
  label: 'Plant Seed',
  target: { kind: 'haven_garden_plot', slotId: MOSSPROUT_FIRST_MEMORY_SLOT_ID },
} as const satisfies KingdomTileUpgradeOffer;

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
  const { run: glowRun, ready: glowReady } = useGlowDiscoveryState();
  const stepplingLesson = useStepplingGardenLesson();
  const stepplingLessonOpening = useRef(false);
  const stepplingEncounter = useStepplingEncounter(mergeWorld);
  const stepplingSurfaceOpen = stepplingEncounter.open;
  const { open: stepplingEggOpen, close: closeStepplingEgg } = stepplingEncounter;
  useEffect(() => {
    if (!stepplingSurfaceOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stepplingEggOpen) closeStepplingEgg();
      return true;
    });
    return () => subscription.remove();
  }, [stepplingSurfaceOpen, stepplingEggOpen, closeStepplingEgg]);
  const screenFocused = useIsFocused();
  const [glowPanelOpen, setGlowPanelOpen] = useState(true);
  useEffect(() => { setGlowPanelOpen(glowRun?.status !== 'completed'); }, [glowRun?.status, glowRun?.nodeId]);
  const glowGatewayActive = Boolean(glowRun);
  const mistUpgradeActive = Boolean(glowRun && glowRun.status !== 'completed' && ['gateway.ready', 'gateway.return', 'gateway.offer', 'gateway.buy'].includes(glowRun.nodeId));
  const glowScene = glowRun ? glowDiscoveryScene(glowRun.nodeId) : null;
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [lockedHintVisible, setLockedHintVisible] = useState(false);
  const [interactionCreatureId, setInteractionCreatureId] = useState<string | null>(null);
  const [ftueReturnFocusCreatureId, setFtueReturnFocusCreatureId] = useState<string | null>(null);
  const [interactionCameraReady, setInteractionCameraReady] = useState(false);
  const [interactionExiting, setInteractionExiting] = useState(false);
  const [interactionExitNonce, setInteractionExitNonce] = useState(0);
  const [interactionLoadingVisible, setInteractionLoadingVisible] = useState(false);
  const [hostedInteractionRequest, setHostedInteractionRequest] = useState<MossproutWorldInteractionRequest | null>(null);
  const [interactionRewardPulseKey, setInteractionRewardPulseKey] = useState(0);
  const [detailCreatureId, setDetailCreatureId] = useState<string | null>(null);
  const [ftueTargetRevision, setFtueTargetRevision] = useState(0);
  const [ftueCameraSettled, setFtueCameraSettled] = useState(false);
  const cameraSettleRevisionRef = useRef(0);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [upgradePresentation, setUpgradePresentation] = useState<HavenTileUpgradePresentation | null>(null);
  const prepareEggEntry = useCallback(() => { setFtueCameraSettled(false); setGlowPanelOpen(false); }, []);
  const eggHandoff = useGlowEggHandoff({ run: glowRun, world: mergeWorld, focused: screenFocused,
    available: !interactionCreatureId && !upgradePresentation, open: stepplingEggOpen,
    enter: stepplingEncounter.enter, onOpening: prepareEggEntry });
  const upgradeOffers = useMemo(() => worldUpgradeOffers(mergeWorld), [mergeWorld]);
  const [selectedUpgrade, setSelectedUpgrade] = useState<WorldUpgradeOffer | null>(null);
  const [upgradePurchasing, setUpgradePurchasing] = useState(false);
  const [upgradeCommitted, setUpgradeCommitted] = useState(false);
  const upgradePressBusy = useRef(false);
  const upgradeActionRef = useRef<View>(null);
  const activeFtueRunId = loadFtueRun()?.runId ?? null;
  const ordinaryUpgradeRun = useWorldUpgradeRun();
  const ftueUpgradeRun = useWorldUpgradeRun(activeFtueRunId ? `flow:${activeFtueRunId}` : 'no-ftue-upgrade');
  const sharedUpgrade = selectedUpgrade ? upgradeOffers.find((offer) => offer.id === selectedUpgrade.id && offer.nextLevel === selectedUpgrade.nextLevel) ?? selectedUpgrade : null;
  const sharedUpgradePreview = useMemo(() => sharedUpgrade ? worldUpgradePreview(sharedUpgrade, mergeWorld, companionSlots) : {}, [sharedUpgrade, mergeWorld, companionSlots]);
  const ftueGardenUpgradeActive = ftueStepId === 'world.first_bloom_offer' || ftueStepId === 'world.first_bloom_restore';
  const coachedUpgrade = ftueGardenUpgradeActive || mistUpgradeActive;
  useEffect(() => {
    const id = ftueStepId === 'world.first_bloom_restore' ? 'haven:mossprout' : null;
    if (id) {
      const offer = worldUpgradeOffers(mergeWorldRef.current).find((candidate) => candidate.id === id);
      if (offer) { setSelectedUpgrade(offer); setUpgradeCommitted(false); }
    }
  }, [ftueStepId]);
  useEffect(() => {
    if (!screenFocused || !mistUpgradeActive) return;
    void recoverPaidGlowUpgrade(mergeWorld).catch((error) => { setUpgradeError(error instanceof Error ? error.message : 'Please try again.'); });
  }, [screenFocused, mistUpgradeActive, mergeWorld]);
  useEffect(() => {
    if (upgradePresentation) { setSelectedUpgrade(null); setUpgradePurchasing(false); }
  }, [upgradePresentation]);
  useEffect(() => {
    const failed = ordinaryUpgradeRun?.status === 'failed_recoverable' ? ordinaryUpgradeRun
      : ftueStepId === 'world.first_bloom_restore' && ftueUpgradeRun?.status === 'failed_recoverable' ? ftueUpgradeRun
        : glowRun?.status === 'failed_recoverable' && glowRun.nodeId.startsWith('gateway.purchase') ? glowRun : null;
    if (!failed) return;
    setUpgradePurchasing(false); setUpgradeCommitted(false); setUpgradeError('The upgrade paused. Try again to continue without paying twice.');
    if (failed === ordinaryUpgradeRun) {
      const offer = worldUpgradeOffers(mergeWorldRef.current).find((candidate) => worldUpgradeRunId(candidate) === failed.runId);
      if (offer) setSelectedUpgrade(offer);
    }
  }, [ordinaryUpgradeRun, ftueUpgradeRun, ftueStepId, glowRun]);
  const [selectedNatureIslandId, setSelectedNatureIslandId] = useState<MossproutNatureIslandId | null>(null);
  const [selectedMemoryPlantId, setSelectedMemoryPlantId] = useState<string | null>(null);
  const [natureUpgradeError, setNatureUpgradeError] = useState<string | null>(null);
  const [firstSeedPlacementBusy, setFirstSeedPlacementBusy] = useState(false);
  const [firstSeedPlacementFailed, setFirstSeedPlacementFailed] = useState(false);
  const restoreButtonRef = useRef<View>(null);
  const screenRef = useRef<View>(null);
  const ftueTargetRefs = useRef(new Map<string, View>());
  const upgradeNonceRef = useRef(0);
  const storyUpgradeResolversRef = useRef(new Map<string, () => void>());
  const interactionCreatureIdRef = useRef<string | null>(null);
  const handledInteractionRequestRef = useRef<string | null>(null);
  const ftueRestoreStartedRef = useRef(false);
  const firstSeedPlantStartedRef = useRef(false);
  const firstSeedRepairAttemptRef = useRef<string | null>(null);
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
    () => companionSlots.filter((slot) => sharedWorldIncludesCompanion(slot.familyId)),
    [companionSlots],
  );
  // The canvas owns motion readiness. A parent step-reset effect runs after
  // its child's settled notification and can invalidate the only notification
  // when adjacent FTUE steps share an already-stationary camera.
  const handleCameraMotionChange = useMemo(() => {
    // Refresh the settled notification when the tutorial changes while the
    // camera is already stationary. The canvas immediately reports its state.
    void ftueStepId;
    return (moving: boolean) => {
    const revision = ++cameraSettleRevisionRef.current;
    setFtueCameraSettled(false);
    if (moving) {
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (cameraSettleRevisionRef.current === revision) setFtueCameraSettled(true);
    }));
    };
  }, [ftueStepId]);
  const gatewayState = glowGatewayState(mergeWorld);
  const mossproutGardenScene = useMemo(() => ({
    gateway: stepplingEncounter.open ? 'egg' as const : gatewayState,
    level: mergeWorld.haven.structures.mossproutGarden.level,
    plantableMemories: mergeWorld.haven.plantableMemories,
    previewMemoryId: ftueStepId === 'world.garden_arrival'
      ? mergeWorld.haven.plantableMemories.find((plant) => plant.source.kind === 'ftue'
        && (!activeFtueRunId || plant.source.sourceId === activeFtueRunId) && plant.status !== 'planted')?.id
      : undefined,
    featureLevels: mergeWorld.haven.structures.mossproutGarden.featureLevels,
  }), [
    gatewayState,
    ftueStepId,
    activeFtueRunId,
    stepplingEncounter.open,
    mergeWorld.haven.plantableMemories,
    mergeWorld.haven.structures.mossproutGarden.featureLevels,
    mergeWorld.haven.structures.mossproutGarden.level,
  ]);
  const selectedMemoryPlant = selectedMemoryPlantId
    ? mergeWorld.haven.plantableMemories.find((plant) => plant.id === selectedMemoryPlantId) ?? null
    : null;
  const selectedMemoryPlantDefinition = selectedMemoryPlant
    ? mossproutMemoryPlantById.get(selectedMemoryPlant.definitionId) ?? null
    : null;
  const firstFtueMemory = mergeWorld.haven.plantableMemories.find((plant) => (
    plant.source.kind === 'ftue' && (!activeFtueRunId || plant.source.sourceId === activeFtueRunId)
  )) ?? null;
  const firstSeedPlanted = firstFtueMemory?.status === 'planted' && firstFtueMemory.slotId === MOSSPROUT_FIRST_MEMORY_SLOT_ID;
  const firstSeedGrown = firstSeedPlanted && firstFtueMemory.growthPoints >= 1;
  const havenMergeBoardActive = visibleCompanionSlots.some((slot) => (
    slot.familyId === 'mossprout' && slot.kind === 'owned'
  ));
  const ftueStep = ftueStepId ? mossproutFtueStep(ftueStepId) ?? null : null;
  const glowWorldTarget = glowScene?.view.kind === 'garden'
    ? { kind: 'haven_garden_button' as const, characterId: 'mossprout' as const }
    : glowScene?.view.kind === 'goal' || glowScene?.view.kind === 'purchase' ? { kind: 'haven_gateway' as const } : null;
  const interactionSlot = useMemo(() => visibleCompanionSlots.find((slot) => (
    slot.kind === 'owned' && slot.creature.creatureId === interactionCreatureId
  )), [interactionCreatureId, visibleCompanionSlots]);
  const activeInteractionResidentId = interactionCreatureId ?? ftueReturnFocusCreatureId;
  const mossproutMeditating = ftueStepId === 'companion.meditating'
    || Boolean(activeKatchimeraMeditation(relationships, 'mossprout'));
  const interactionHasGarden = usesSharedResidentStage(interactionSlot?.familyId);
  const mistResumeCamera = glowDiscoveryResumeCamera(glowRun);
  const tutorialCamera = mistResumeCamera ? screenFocused ? mistResumeCamera : null : ftueStep?.camera ?? null;
  const ftueReturnCamera = ftueReturnFocusCreatureId
    ? mossproutFtueStep('companion.chapter_zero_return')?.camera ?? null
    : null;
  const ftueReturnResidentAnchorY = ftueReturnCamera?.kind === 'focus_target'
    ? ftueReturnCamera.anchorY
    : undefined;
  const ftueReturnResidentZoom = ftueReturnCamera?.kind === 'focus_target'
    ? ftueReturnCamera.zoom
    : undefined;
  const initialFtueCameraScale = mistResumeCamera?.kind === 'focus_target' ? mistResumeCamera.zoom
    : ftueStepId === 'world.egg_intro'
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
    const delay = ftueStep?.autoAdvanceMs ?? (ftueStepId ? delays[ftueStepId] : undefined);
    const key = ftueStepId ? `${activeFtueRunId ?? 'current'}:${ftueStepId}` : null;
    if (ftueStepId === 'world.seed_planted' && !firstSeedPlanted) return;
    if (delay == null || !key || autoAdvancedStepRef.current === key) return;
    const timer = setTimeout(() => {
      autoAdvancedStepRef.current = key;
      onFtueInspectRef.current?.();
    }, delay);
    return () => clearTimeout(timer);
  }, [activeFtueRunId, firstSeedPlanted, ftueStep?.autoAdvanceMs, ftueStepId]);
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
  const setGardenClusterNode = useCallback((node: View | null) => {
    registerFtueTarget('garden-cluster:mossprout', node);
  }, [registerFtueTarget]);
  const setGatewayNode = useCallback((node: View | null) => {
    registerFtueTarget('shared-world:steppling-home', node);
  }, [registerFtueTarget]);
  const setGardenPlotNode = useCallback((slotId: MossproutGardenPlantSlotId, node: View | null) => {
    registerFtueTarget(`garden-plot:mossprout:${slotId}`, node);
  }, [registerFtueTarget]);
  const setGardenWorldOfferNode = useCallback((node: View | null) => {
    registerFtueTarget('garden-plant-button:mossprout', ftueStepId === 'world.garden_arrival' ? node : null);

  }, [ftueStepId, registerFtueTarget]);
  const setHavenGuideNode = useCallback((node: View | null) => {
    registerFtueTarget('haven-guide', node);
  }, [registerFtueTarget]);
  useEffect(() => {
  }, [ftueStepId]);
  useEffect(() => {
    if (ftueStepId === 'world.first_seed_grew') return;
    firstSeedReturnStartedRef.current = false;
    setFtueReturnFocusCreatureId(null);
  }, [ftueStepId]);
  useEffect(() => {
    if (ftueStepId !== 'world.garden_arrival') firstSeedPlantStartedRef.current = false;
    if (ftueStepId !== 'world.seed_planted') {
      firstSeedRepairAttemptRef.current = null;
      setFirstSeedPlacementFailed(false);
    }
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
    || ftueStepId === 'world.first_bloom_offer'
    || ftueStepId === 'world.first_bloom_restore'
    || ftueStepId === 'world.first_seed_grew';
  const ftueWorldCloseupActive = Boolean(ftueStepId && (
    ftueStepId === 'world.egg_intro'
    || ftueStepId.startsWith('egg.')
    || ftueStepId.startsWith('companion.')
  ));
  const ftueEggFeedingCloseupActive = ftueStepId === 'world.egg_intro'
    || Boolean(ftueStepId?.startsWith('egg.'));
  const gardenWorldGuidanceActive = Boolean(ftueStepId && (
    mossproutFtueShowsWorldGarden(ftueStepId) || ftueStepId === 'world.first_seed_grew'
  ));
  const gardenWorldBottomCtaActive = (ftueStepId === 'world.seed_planted' && firstSeedPlacementFailed)
    || ftueStepId === 'world.first_seed_grew';
  const measureRestoreOrigin = useCallback(() => new Promise<{ x: number; y: number }>((resolve) => {
    const fallback = { x: window.width / 2, y: window.height - Math.max(90, insets.bottom + 66) };
    const node = upgradeActionRef.current ?? restoreButtonRef.current;
    if (!node) {
      resolve(fallback);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      resolve(width > 0 && height > 0 ? { x: x + width / 2, y: y + height / 2 } : fallback);
    });
  }), [insets.bottom, window.height, window.width]);

  useStoryPresentationOperation('haven', STORY_WORLD_UPGRADE_PRESENTATION, async (work, run, signal) => {
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
    if (signal.aborted) return;
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
    } else if (receipt.target.kind === 'haven_structure') {
      presentation = {
        cameraAlreadyFocused: true, characterId: 'steppling', coinCost: receipt.coinCost, coinOrigin,
        creatureId: 'steppling', creatureName: 'A new friend', fromStage: receipt.fromLevel as HavenStage,
        toStage: 1, nonce: ++upgradeNonceRef.current,
        palette: { accent: '#FFE28A', glow: '#FFD98C', mist: 'rgba(226,255,213,0.88)', primary: '#4F9F57' },
        reactionLine: '', showCoins: receipt.coinCost > 0,
        status: 'playing', storyPresentationKey: work.key, upgradeName: 'Misty clearing', visualTarget: payload.target,
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
    await new Promise<void>((resolve) => {
      storyUpgradeResolversRef.current.set(work.key, resolve);
      signal.addEventListener('abort', () => {
        storyUpgradeResolversRef.current.delete(work.key);
        setUpgradePresentation((current) => current?.storyPresentationKey === work.key ? null : current);
        setUpgrading(false);
        resolve();
      }, { once: true });
    });
  }, screenFocused && !activeInteractionResidentId && !interactionExiting);

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

  const beginFirstSeedPlanting = useCallback(() => {
    if (ftueStepId !== 'world.garden_arrival' || firstSeedPlantStartedRef.current) return;
    firstSeedPlantStartedRef.current = true;
    setFirstSeedPlacementBusy(true);
    setFirstSeedPlacementFailed(false);
    void advanceFtueActionDurably({
      expectedStepId: 'world.garden_arrival',
      actionId: 'world.plant_first_seed',
      evidenceRef: `garden-plot:${MOSSPROUT_FIRST_MEMORY_SLOT_ID}`,
      nextStepId: 'world.seed_planted',
    }).then(async (result) => {
      if (result.run?.stepId !== 'world.seed_planted') throw new Error('The Garden did not accept the Seed.');
      const sourceId = result.run.runId;
      const placement = await ensureStoredFirstFtueMemoryPlacement(
        sourceId,
        `ftue-recovery:${sourceId}:place-first-memory`,
      );
      if (!placement.placed) throw new Error('The memory Seed could not be planted.');
    }).catch(async () => {
      // The resume snapshot is committed before the Content Flow effect. If
      // that dispatch is interrupted, finish the idempotent placement here
      // instead of making the player's first tap a no-op.
      const run = loadFtueRun();
      if (run?.status === 'active' && run.stepId === 'world.seed_planted') {
        try {
          const placement = await ensureStoredFirstFtueMemoryPlacement(
            run.runId,
            `ftue-recovery:${run.runId}:place-first-memory`,
          );
          if (placement.placed) {
            setFirstSeedPlacementFailed(false);
            return;
          }
        } catch {
          // Keep the visible Plant Seed action retryable below.
        }
      }
      firstSeedPlantStartedRef.current = false;
      setFirstSeedPlacementFailed(true);
    }).finally(() => setFirstSeedPlacementBusy(false));
  }, [ftueStepId]);

  const ensureFirstSeedPlacement = useCallback(async () => {
    const runId = loadFtueRun()?.runId ?? activeFtueRunId;
    const placement = await ensureStoredFirstFtueMemoryPlacement(
      runId,
      `ftue-recovery:${runId ?? 'current'}:place-first-memory`,
    );
    return placement.placed;
  }, [activeFtueRunId]);

  useEffect(() => {
    if (firstSeedPlanted) {
      setFirstSeedPlacementBusy(false);
      setFirstSeedPlacementFailed(false);
      return;
    }
    if (!['world.seed_planted', 'world.garden_handoff', 'world.first_bloom_offer', 'world.first_bloom_restore', 'world.first_seed_grew'].includes(ftueStepId ?? '')) return;
    const repairKey = `${activeFtueRunId ?? 'current'}:${ftueStepId}`;
    if (firstSeedRepairAttemptRef.current === repairKey) return;
    firstSeedRepairAttemptRef.current = repairKey;
    let cancelled = false;
    setFirstSeedPlacementBusy(true);
    void ensureFirstSeedPlacement()
      .then((planted) => { if (!cancelled) setFirstSeedPlacementFailed(!planted); })
      .catch(() => { if (!cancelled) setFirstSeedPlacementFailed(true); })
      .finally(() => { if (!cancelled) setFirstSeedPlacementBusy(false); });
    return () => { cancelled = true; };
  }, [activeFtueRunId, ensureFirstSeedPlacement, firstSeedPlanted, ftueStepId]);

  const acknowledgeFirstSeedPlanting = useCallback(() => {
    if (ftueStepId !== 'world.seed_planted' || firstSeedPlacementBusy) return;
    setFirstSeedPlacementBusy(true);
    setFirstSeedPlacementFailed(false);
    void ensureFirstSeedPlacement()
      .then((planted) => {
        if (!planted) {
          firstSeedRepairAttemptRef.current = null;
          setFirstSeedPlacementFailed(true);
          return;
        }
        onFtueInspect?.();
      })
      .catch(() => {
        firstSeedRepairAttemptRef.current = null;
        setFirstSeedPlacementFailed(true);
      })
      .finally(() => setFirstSeedPlacementBusy(false));
  }, [ensureFirstSeedPlacement, firstSeedPlacementBusy, ftueStepId, onFtueInspect]);

  const beginFirstSeedReturn = useCallback(() => {
    if (ftueStepId !== 'world.first_seed_grew' || firstSeedReturnStartedRef.current) return;
    const mossprout = visibleCompanionSlots.find((slot) => (
      slot.kind === 'owned' && slot.familyId === 'mossprout'
    ));
    if (!mossprout || mossprout.kind !== 'owned') return;
    firstSeedReturnStartedRef.current = true;
    setDetailCreatureId(null);
    setFtueReturnFocusCreatureId(mossprout.creature.creatureId);
  }, [ftueStepId, visibleCompanionSlots]);

  const selectResident = useCallback((creatureId: string) => {
    const presentation = havenPresentations.find((candidate) => candidate.creatureId === creatureId);
    if (ftueStepId === 'haven.mossprout.focus' && presentation?.characterId !== 'mossprout') return;
    if (ftueStepId === 'haven.mossprout.restore') return;
    setDetailCreatureId(null);
    setHostedInteractionRequest(null);
    setInteractionCameraReady(false);
    setInteractionExiting(false);
    setInteractionCreatureId(creatureId);
  }, [ftueStepId, havenPresentations]);

  useEffect(() => {
    if (!stepplingEggOpen || !mergeWorld.stepplingEgg?.hatchedAt) return;
    const resident = companionSlots.find((slot) => slot.kind === 'owned' && slot.familyId === 'steppling');
    if (resident?.kind !== 'owned') return;
    // Swap the hatch actor and hosted resident together, after durable ownership
    // has arrived. The canvas carries the Egg camera origin into normal Back.
    selectResident(resident.creature.creatureId);
    closeStepplingEgg();
  }, [closeStepplingEgg, companionSlots, mergeWorld.stepplingEgg?.hatchedAt, selectResident, stepplingEggOpen]);

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
        nextStepId: 'companion.water_together',
      }).then((result) => {
        if (result.run?.stepId === 'companion.water_together') return;
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
  const [mistExitError, setMistExitError] = useState(false);
  const requestResidentInteractionExit = useCallback(() => {
    if (!interactionCreatureIdRef.current) return;
    const run = loadFtueRun();
    // Back accepts the same durable mist handoff as the tutorial card.
    // The hosted controller opens the destination before calling us to exit.
    if (run?.status === 'active' && run.stepId === 'companion.meditating') {
      setMistExitError(false);
      void advanceFtueActionDurably({ expectedStepId: 'companion.meditating', actionId: 'companion.tend_garden' })
        .catch(() => setMistExitError(true));
      return;
    } else if (ftueStepId && run?.status !== 'complete') return;
    setInteractionCameraReady(false);
    setInteractionExiting(true);
    setInteractionExitNonce((current) => current + 1);
  }, [ftueStepId]);
  useEffect(() => {
    if (!interactionCreatureId || (ftueStepId && ftueStepId !== 'companion.meditating')) return;
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
    if (!usesSharedResidentStage(familyId) || !havenMergeBoardActive) return;
    transitionTo({
      announcement: "Opening Mossprout's Garden",
      target: 'merge',
      onCovered: closeResidentInteraction,
      navigate: () => {
        router.push({
          pathname: '/katchimera/[creatureId]/activity',
          params: {
            creatureId: 'companion:mossprout',
            requestCharacterId: familyId,
            source: 'haven-world',
            ...(orderId ? { focusOrderId: orderId } : {}),
          },
        });
      },
    });
  }, [closeResidentInteraction, havenMergeBoardActive, interactionSlot?.familyId, router, transitionTo]);

  useEffect(() => {
    if (!screenFocused) { stepplingLessonOpening.current = false; return; }
    if (!stepplingLesson.active || !stepplingLesson.run || !havenMergeBoardActive) return;
    if (['closing', 'summary'].includes(stepplingLesson.run.nodeId)) {
      const resident = companionSlots.find((slot) => slot.kind === 'owned' && slot.familyId === 'steppling');
      if (resident?.kind === 'owned' && interactionCreatureId !== resident.creature.creatureId) selectResident(resident.creature.creatureId);
    } else if (!activeInteractionResidentId && !stepplingLessonOpening.current) {
      stepplingLessonOpening.current = true;
      openGarden(undefined, 'steppling');
    }
  }, [screenFocused, stepplingLesson.active, stepplingLesson.run, havenMergeBoardActive, companionSlots, interactionCreatureId, activeInteractionResidentId, selectResident, openGarden]);

  const openUpgradeOffer = useCallback(async (offer: WorldUpgradeOffer) => {
    if (upgradePressBusy.current || upgradePurchasing || upgradePresentation) return;
    upgradePressBusy.current = true;
    setUpgradeError(null); setUpgradeCommitted(false);
    try {
      if (ftueStepId === 'world.first_bloom_offer') await advanceFtueActionDurably({ expectedStepId: ftueStepId, actionId: 'world.open_first_bloom_upgrade' });
      if (offer.id === 'mist:steppling-home' && glowRun && glowRun.status !== 'completed') {
        const run = await advanceGlowUpgrade('open');
        if (run.nodeId !== 'gateway.buy') { setSelectedUpgrade(null); return; }
      }
      if (ftueStepId === 'haven.mossprout.restore') ftueRestoreStartedRef.current = true;
      setSelectedUpgrade(offer);
    } catch (error) { setSelectedUpgrade(offer); setUpgradeError(error instanceof Error ? error.message : 'Could not open the upgrade. Please try again.'); }
    finally { upgradePressBusy.current = false; }
  }, [ftueStepId, glowRun, upgradePresentation, upgradePurchasing]);
  const setUpgradeMarkerNode = useCallback((id: string, node: View | null) => {
    if (id === 'haven:mossprout') registerFtueTarget('upgrade:mossprout', node);
    if (id === 'mist:steppling-home') registerFtueTarget('upgrade:steppling', node);
  }, [registerFtueTarget]);
  const confirmWorldUpgrade = useCallback(async () => {
    if (!sharedUpgrade || upgradePressBusy.current || (upgradeCommitted && !upgradeError)) return;
    upgradePressBusy.current = true; setUpgradePurchasing(true); setUpgradeCommitted(true); setUpgradeError(null);
    try {
      if (sharedUpgrade.id === 'mist:steppling-home' && glowRun && glowRun.status !== 'completed') {
        const run = await advanceGlowUpgrade('confirm');
        if (run.status === 'completed' || ['gateway.egg', 'egg.enter'].includes(run.nodeId)) { setSelectedUpgrade(null); setUpgradeCommitted(false); }
      } else if (ftueStepId === 'world.first_bloom_restore') {
        await advanceFtueActionDurably({ expectedStepId: ftueStepId, actionId: 'world.restore_with_first_bloom', nextStepId: ftueStepId, evidenceRef: 'shared-upgrade:confirm' });
      } else {
        const run = await purchaseWorldUpgrade(sharedUpgrade);
        if (run?.status === 'failed_recoverable') throw new Error('The upgrade could not finish. Try again.');
        if (run?.status === 'completed') setSelectedUpgrade(null);
      }
    } catch (error) { setUpgradeError(error instanceof Error ? error.message : 'Could not upgrade. Please try again.'); setUpgradeCommitted(false); }
    finally { upgradePressBusy.current = false; setUpgradePurchasing(false); }
  }, [ftueStepId, glowRun, sharedUpgrade, upgradeCommitted, upgradeError]);
  const visibleUpgradeOffers = visibleWorldUpgradeOffers(upgradeOffers, ftueStepId, glowRun);

  // Mount the camera with its saved framing, rather than initializing the overview first.
  if (!glowReady || !stepplingLesson.ready) return null;

  return (
    <View collapsable={false} onLayout={onContentReady} ref={screenRef} style={styles.screen}>
      <KingdomHexCanvas
        background={background}
        cameraLocked={ftueLocksCamera(ftueStep) || glowDiscoveryLocksCamera(glowRun) || stepplingEncounter.open || stepplingLesson.active}
        discoveredEggInteraction={stepplingEncounter.open}
        discoveredEggPresentation={stepplingEncounter.presentation}
        discoveredEggTargetRef={stepplingEncounter.feedController.eggTargetRef}
        cameraMaximumScale={stepplingEncounter.open ? SHARED_EGG_REST_ZOOM : ftueEggFeedingCloseupActive
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
        interactionEnabled={!activeInteractionResidentId && !stepplingEncounter.open && (mistUpgradeActive || havenOpeningActive || !ftueStep || ftueStep.surface !== 'haven')}
        interactionExitNonce={interactionExitNonce}
        interactionResidentAnchorY={ftueReturnResidentAnchorY}
        interactionResidentId={activeInteractionResidentId}
        mossproutMeditating={mossproutMeditating}
        interactionRewardPulseKey={interactionRewardPulseKey}
        gardenOrdersInteractive={false}
        initialTutorialCameraScale={initialFtueCameraScale}
        initialCameraSnapshot={initialCameraSnapshot}
        mossproutNatureIslandLevels={mergeWorld.haven.mossproutNatureIslands}
        mossproutGarden={mossproutGardenScene}
        onCameraSnapshotChange={onCameraSnapshotChange}
        onCameraMotionChange={handleCameraMotionChange}
        onInteractionExitFocusComplete={closeResidentInteraction}
        onOpenGarden={openGarden}
        onGardenPlotTargetChange={setGardenPlotNode}
        onTileUpgradeOfferPress={beginFirstSeedPlanting}
        upgradeOffers={screenFocused && !activeInteractionResidentId && !interactionCreatureId && !stepplingEggOpen && !ordinaryUpgradeRun ? visibleUpgradeOffers : []}
        selectedUpgradeOffer={selectedUpgrade}
        preserveUpgradeCamera={ftueGardenUpgradeActive || (selectedUpgrade?.id === 'mist:steppling-home' && Boolean(glowRun && glowRun.status !== 'completed'))}
        upgradeSelectionCommitted={upgradeCommitted}
        upgradeFailed={Boolean(upgradeError)}
        onUpgradeOfferPress={(offer) => { void openUpgradeOffer(offer); }}
        onUpgradeOfferTargetChange={setUpgradeMarkerNode}
        onTileUpgradeOfferTargetChange={setGardenWorldOfferNode}
        onSelectHome={() => {}}
        onSelectLocked={(familyId) => {
          if (!ftueStep || ftueStep.surface !== 'haven') setLockedHintVisible(true);
        }}
        onSelectNatureIsland={(islandId) => {
          if (ftueStep?.surface === 'haven') return;
          if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setNatureUpgradeError(null);
          const offer = upgradeOffers.find((candidate) => candidate.id === `nature:${islandId}`);
          if (offer) void openUpgradeOffer(offer);
          else setSelectedNatureIslandId(islandId);
        }}
        onSelectMemoryPlant={setSelectedMemoryPlantId}
        onGatewayTargetChange={setGatewayNode}
        storyOperationsEnabled={screenFocused && !activeInteractionResidentId && !interactionExiting}
        onSelectGateway={() => {
          if (gatewayState === 'egg' && !glowDiscoveryLocksCamera(glowRun)) {
            setFtueCameraSettled(false);
            setGlowPanelOpen(false);
            void stepplingEncounter.enter();
            return;
          }
          const offer = upgradeOffers.find((candidate) => candidate.id === 'mist:steppling-home');
          if (offer && (!glowRun || ['gateway.ready', 'gateway.return', 'gateway.offer', 'gateway.buy'].includes(glowRun.nodeId))) { void openUpgradeOffer(offer); return; }
          setGlowPanelOpen(true);
          void startGlowDiscovery().catch(() => setNatureUpgradeError('The path could not open. Please try again.'));
        }}
        onSelectResident={(creatureId) => {
          if (glowDiscoveryLocksCamera(glowRun)) return;
          selectResident(creatureId);
        }}
        onResidentFocusComplete={completeResidentFocus}
        onUpgradePresentationComplete={completeUpgradePresentation}
        recenterBottom={Math.max(insets.bottom, 12) + 150}
        residentStatusGlyphs={residentStatusGlyphs}
        tileUpgradeOffer={ftueStepId === 'world.garden_arrival'
          ? FIRST_SEED_GARDEN_PLANT_OFFER
          : null}
        tutorialCamera={tutorialCamera}
        upgradePresentation={upgradePresentation}
        focusedMossproutWorld
        worldEggTargetRef={worldEggTargetRef}
        worldSubjectPresentation={worldSubjectPresentation}
      />
      {!activeInteractionResidentId && !interactionCreatureId && !stepplingSurfaceOpen && !upgradePresentation && !navigationLocked && (!ftueStepId || ftueStepId === 'companion.meditating') ? <View style={{ position: 'absolute', left: 16, bottom: Math.max(insets.bottom, 12) + 10, zIndex: 30 }}>
        <CompanionJournalButton familyId="mossprout" />
      </View> : null}
      {screenFocused && mistExitError ? <View style={{ position: 'absolute', bottom: insets.bottom + 20, left: 24, right: 24, zIndex: 120 }}>
        <KatchaButton label="Explore the mist · Try again" onPress={requestResidentInteractionExit} />
      </View> : null}
      {screenFocused && eggHandoff.error ? <View style={{ position: 'absolute', bottom: insets.bottom + 20, left: 24, right: 24, zIndex: 120 }}>
        <KatchaButton label="Try again" onPress={eggHandoff.retry} />
      </View> : null}
      {screenFocused && stepplingEncounter.open ? <StepplingEncounterPanel
        encounter={stepplingEncounter}
        egg={stepplingEncounter.egg}
        cameraReady={ftueCameraSettled}
        onReady={eggHandoff.onReady}
      /> : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 120 }]}>
        <EggFeedOverlay
          feed={stepplingEncounter.feedController.eggFeed}
          onArrive={stepplingEncounter.feedController.handleEggFeedArrive}
          onEnergyTokenArrive={stepplingEncounter.feedController.handleEnergyTokenArrive}
        />
      </View>
      {ftueGardenUpgradeActive || (!upgradePresentation && (!ftueStepId || ftueStepId === 'companion.meditating')) ? (
        <Animated.View entering={FadeIn.duration(reduceMotion ? 100 : 360)} pointerEvents="box-none" style={[styles.topHudLayer, { top: insets.top + 3 }, ftueGardenUpgradeActive && { zIndex: 90 }]}>
          <GameHudBar
            leading={ftueGardenUpgradeActive || stepplingLesson.active ? undefined : <KatchimeraBackButton
              accessibilityHint={interactionCreatureId ? "Returns to this Katchimera's world" : 'Returns to the Katchimera world map'}
              accessibilityLabel={interactionCreatureId ? 'Exit interaction' : 'All Havens'}
              compact
              disabled={stepplingEncounter.busy || stepplingEncounter.hatching || interactionExiting || (!interactionCreatureId && (navigationLocked || glowDiscoveryLocksCamera(glowRun)))}
              onPress={stepplingEncounter.open ? stepplingEncounter.close : interactionCreatureId ? requestResidentInteractionExit : onBackToHavenSelector}
            />}
            content={<View />}
            trailing={<GameCurrencyHud balances={[{
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
      {!stepplingSurfaceOpen && !upgradePresentation && !activeInteractionResidentId && havenMergeBoardActive && mossproutFtueShowsWorldGarden(ftueStepId) && !gardenWorldBottomCtaActive ? (
        <Animated.View
          collapsable={false}
          ref={setGardenClusterNode}
          entering={FadeIn
            .duration(reduceMotion ? 80 : 260)
            .delay(ftueStepId === 'world.garden_handoff' && !reduceMotion ? 260 : 0)}
          style={[styles.gardenButtonCluster, { bottom: Math.max(insets.bottom, 12) + 10 }]}>
          <View style={styles.gardenButton}>
            <Pressable
              accessibilityHint="Opens the dedicated Merge Garden"
              accessibilityLabel="Open Garden"
              accessibilityRole="button"
              disabled={navigationLocked && !glowDiscoveryAllowsGarden(glowRun) && !['world.garden_handoff', 'world.seed_planted'].includes(ftueStepId ?? '')}
              onPress={['world.garden_handoff', 'world.seed_planted'].includes(ftueStepId ?? '') ? onFtueOpenGarden : () => {
                if (glowScene?.view.kind === 'garden') {
                  void submitGlowAction(glowScene.actionId).then((run) => { if (run?.status === 'active') openGarden(); }).catch(() => setNatureUpgradeError('The Garden could not open. Please try again.'));
                } else openGarden();
              }}
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
      {screenFocused && !activeInteractionResidentId && (!ftueStepId || glowGatewayActive) && !upgradePresentation && !stepplingEggOpen && glowRun?.status !== 'completed' && glowPanelOpen && (ftueCameraSettled || glowRun?.status === 'failed_recoverable') && !mistUpgradeActive && !sharedUpgrade && glowGatewayActive && (glowRun?.status === 'failed_recoverable' || (glowScene && glowScene.view.kind !== 'garden') || glowRun?.nodeId.startsWith('lesson.')) ? <GlowGatewayGuide
        world={mergeWorld}
        onClose={() => setGlowPanelOpen(false)}
        onOpenMerge={() => openGarden()}
      /> : null}
      {screenFocused && sharedUpgrade && !upgradePresentation && !activeInteractionResidentId ? <WorldUpgradeSheet
        offer={sharedUpgrade} balance={mergeWorld.coins} {...sharedUpgradePreview} busy={upgradePurchasing || (upgradeCommitted && !upgradeError)}
        error={upgradeError} coached={coachedUpgrade} actionRef={upgradeActionRef}
        onClose={() => { setSelectedUpgrade(null); setUpgradeError(null); }} onConfirm={() => { void confirmWorldUpgrade(); }}
        onGarden={() => { setSelectedUpgrade(null); setUpgradeError(null); openGarden(); }} /> : null}
      {screenFocused && mistUpgradeActive && !sharedUpgrade && !upgradePresentation && !activeInteractionResidentId && !stepplingEggOpen ? (
        <HavenFtueOverlay
          cue={{ kind: 'tap', target: { kind: 'haven_upgrade_button', characterId: 'steppling' } }}
          spotlight={{ targets: [{ kind: 'haven_upgrade_button', characterId: 'steppling' }], grouping: 'bounding_rect' }}
          fingerPlacement="below" screenRef={screenRef} targetRefs={ftueTargetRefs} targetRevision={ftueTargetRevision}
        />
      ) : null}
      {screenFocused && ordinaryUpgradeRun?.status === 'failed_recoverable' && !sharedUpgrade ? <View style={[styles.upgradeRecoveryCta, { bottom: Math.max(insets.bottom, 12) + 20 }]}>
        <KatchaButton label="Resume upgrade" onPress={() => { void dispatchContentFlowCommand(ordinaryUpgradeRun.runId, { type: 'retry' }); }} />
      </View> : null}
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
          onUpgrade={(islandId) => { const offer = upgradeOffers.find((candidate) => candidate.id === `nature:${islandId}`); if (offer) { setSelectedNatureIslandId(null); void openUpgradeOffer(offer); } }}
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
      {havenOpeningActive && ftueStep && !activeInteractionResidentId ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.discoveryCalloutLayer,
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
          {!['world.egg_intro', 'world.garden_arrival', 'world.garden_handoff', 'world.first_bloom_offer', 'world.first_bloom_restore'].includes(ftueStepId ?? '')
            && (ftueStepId !== 'world.seed_planted' || firstSeedPlacementFailed)
            && (ftueStepId !== 'world.first_seed_grew' || firstSeedGrown) ? <View style={styles.discoveryCalloutButton}>
            <KatchaButton
              fullWidth
              glow={ftueStepId === 'world.garden_arrival'}
              icon={ftueStep.actions[0]?.icon ?? 'sparkles'}
              label={ftueStepId === 'world.seed_planted' && firstSeedPlacementFailed
                ? 'Retry Planting'
                : ftueStep.actions[0]?.title ?? 'Continue'}
              loading={firstSeedPlacementBusy && (ftueStepId === 'world.garden_arrival' || ftueStepId === 'world.seed_planted')}
              onPress={ftueStepId === 'world.garden_arrival'
                ? beginFirstSeedPlanting
                : ftueStepId === 'world.seed_planted'
                  ? acknowledgeFirstSeedPlanting
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
        const currentArt = havenHexTileSpec(characterId, currentStage);
        const nextArt = next ? havenHexTileSpec(characterId, next.stage) : null;
        return <KatchaSheet
          footer={<View style={styles.actions}>
            {next ? <View ref={characterId === 'mossprout' ? setRestoreButtonNode : undefined} style={styles.restoreButtonAnchor}>
              <KatchaButton
                disabled={mergeWorld.coins < next.coinCost || upgrading}
                fullWidth
                icon="sparkles"
                label="Restore"
                cost={{ currency: 'coins', amount: next.coinCost }}
                onPress={() => { const offer = upgradeOffers.find((candidate) => candidate.id === `haven:${characterId}`); if (offer) { setDetailCreatureId(null); void openUpgradeOffer(offer); } }}
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
                <Image contentFit="contain" source={kingdomHexTileSourceForLod(nextArt, 'medium')} style={styles.previewImage} />
                <ThemedText style={styles.previewLabel} lightColor="#D7E2D1" darkColor="#D7E2D1">NEXT</ThemedText>
              </View> : null}
            </View>
            {next ? <>
              <ThemedText style={styles.nextTitle} lightColor="#F8FCFF" darkColor="#F8FCFF">Next: {next.name}</ThemedText>
              <ThemedText style={styles.discoveryHintText} lightColor="#D7E2D1" darkColor="#D7E2D1">{next.narrative}</ThemedText>
              <View style={styles.requirementRow}>
                <ThemedText style={styles.requirement} lightColor="#FFE19A" darkColor="#FFE19A">{next.coinCost.toLocaleString()} Glow</ThemedText>
              </View>
            </> : <ThemedText style={styles.nextTitle} lightColor="#FFE19A" darkColor="#FFE19A">Signature Haven complete</ThemedText>}
            {upgradeError ? <ThemedText selectable style={styles.upgradeError} lightColor="#FFD2C8" darkColor="#FFD2C8">{upgradeError}</ThemedText> : null}
          </View>
        </KatchaSheet>;
      })() : null}
      {ftueCameraSettled && !sharedUpgrade && !upgradePresentation && !interactionCreatureId && (ftueStepId === 'haven.mossprout.focus' || ftueStepId === 'haven.mossprout.restore' || ftueStepId === 'world.garden_arrival' || (ftueStepId === 'world.seed_planted' && firstSeedPlanted && !firstSeedPlacementBusy && !firstSeedPlacementFailed) || ftueStepId === 'world.garden_handoff' || ftueStepId === 'world.first_bloom_offer' || ftueStepId === 'world.first_bloom_restore') ? (
        <HavenFtueOverlay
          cue={ftueStep?.cue ?? null}
          fingerPlacement={ftueGardenUpgradeActive ? 'below' : 'center'}
          screenRef={screenRef}
          spotlight={ftueStep?.spotlight ?? null}
          targetRefs={ftueTargetRefs}
          targetRevision={ftueTargetRevision}
        />
      ) : null}
      {ftueStepId === 'world.egg_intro' ? <FtueOpeningFade /> : null}
      {screenFocused && ftueCameraSettled && glowRun?.status === 'active' && glowScene?.view.kind === 'garden' && !activeInteractionResidentId && !upgradePresentation ? (
        <View collapsable={false} ref={setHavenGuideNode} pointerEvents="none" style={{ position: 'absolute', right: 148, bottom: Math.max(insets.bottom, 12) + 30, width: Math.min(250, window.width - 164), zIndex: 85 }}>
          <MergeFtueEggGuide hideAvatar inlineWidth={Math.min(250, window.width - 164)}
            anchor={{ x: 0, y: 0, width: 0, height: 0 }} screen={window}
            guide={{ eyebrow: '', title: 'Tap Garden.', body: 'Merge to earn Glow and clear the mist!' }} />
        </View>
      ) : null}
      {screenFocused && ftueCameraSettled && glowRun?.status === 'active' && !sharedUpgrade && !['gateway.ready', 'gateway.return', 'gateway.offer', 'gateway.buy'].includes(glowRun.nodeId) && glowPanelOpen && glowWorldTarget && !activeInteractionResidentId && !upgradePresentation ? <HavenFtueOverlay
        cue={glowWorldTarget.kind === 'haven_garden_button' ? { kind: 'tap', target: glowWorldTarget } : null}
        spotlight={{ targets: glowScene?.view.kind === 'garden' ? [glowWorldTarget, { kind: 'haven_guide' }] : [glowWorldTarget], grouping: 'bounding_rect' }} screenRef={screenRef} targetRefs={ftueTargetRefs} targetRevision={ftueTargetRevision}
      /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#55A9E2', flex: 1 },
  openingFade: { backgroundColor: '#203447', zIndex: 100 },
  companionOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 45 },
  companionOverlayPreparing: { opacity: 0 },
  upgradeRecoveryCta: { position: 'absolute', left: 20, right: 20, zIndex: 95 },
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
  currencyHud: { flex: 0, paddingLeft: 18, width: 106 },
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
    zIndex: FTUE_SCENE_LAYERS.hero,
  },
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
  previewLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  memoryPlantDetail: { alignItems: 'center', gap: 12, paddingBottom: 8 },
  memoryPlantArt: { height: 210, width: 210 },
  memoryPlantReflection: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 21, lineHeight: 27, maxWidth: 330, textAlign: 'center' },
  memoryPlantProgress: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '800', opacity: 0.68, textTransform: 'capitalize' },
});
