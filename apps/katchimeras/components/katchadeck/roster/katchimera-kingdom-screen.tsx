import { useStepplingGardenLesson } from '@/features/onboarding/steppling-garden-runtime';
import { useMergeWorldActions } from '@/features/merge-world/merge-world-provider';
import { advanceGlowUpgrade, recoverPaidGlowUpgrade } from '@/features/onboarding/glow-upgrade-runtime';
import { homeSoloForStep, homeVeilForStep, isMossproutOpeningStep, MISSION_CAMERA_ANCHOR_Y, MISSION_CAMERA_ZOOM, OPENING_CAMERA_ENTRY_ZOOM, OPENING_LIFTED_ACTION_ID, OPENING_MIST_CLEAR_STEP_ID, OPENING_MIST_LIFT_STEP_ID, OPENING_MIST_OPEN_STEP_ID, openingMistBoardStep, openingMistProgress } from '@/features/onboarding/opening-mist';
import { KingdomOpeningMergeDock, OpeningGlowLayer, useOpeningGlow } from '@/components/katchadeck/world/kingdom-opening-merge-dock';
import { StepplingMissionDock } from '@/components/katchadeck/world/steppling-mission-dock';
import type { RewardFlightPoint } from '@/components/katchadeck/ui/reward-token-flight';
import { createStepplingMissionState, STEPPLING_MISSION_ID, STEPPLING_MISSION_MERGE_REQUIRED, STEPPLING_MISSION_STORAGE_KEY, stepplingMissionBoardStep } from '@/features/onboarding/steppling-mission';
import { KingdomOpeningCaption } from '@/components/katchadeck/world/kingdom-opening-caption';
import { clearMission, clearOpeningMission, useMissionBoard, useOpeningMissionBoard } from '@/features/onboarding/use-opening-mission-board';
import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { worldUpgradeRunId } from '@/features/world-upgrades/world-upgrade-flows';
import { WORLD_UPGRADE_DEFINITIONS, worldUpgradeMaxLevel, visibleWorldUpgradeOffers, worldUpgradeOffers, worldUpgradeArchiveOffer, type WorldUpgradeOffer } from '@/features/world-upgrades/world-upgrade-offers';
import { purchaseWorldUpgrade, useWorldUpgradeRun } from '@/features/world-upgrades/world-upgrade-runtime';
import { dispatchContentFlowCommand } from '@/features/content-flow/content-flow-director';
import { WorldUpgradeNarrative } from '@/components/katchadeck/world/world-upgrade-narrative';
import { CompanionFtueCoachmark } from '@/components/katchadeck/onboarding/companion-ftue-coachmark';
import { WorldUpgradePanel, type UpgradeCoachmarkState, type WorldUpgradeCampaignState } from '@/components/katchadeck/world/world-upgrade-panel';
import { KatchimeraCardRevealModal } from '@/components/katchadeck/collection/katchimera-card-deck-carousel';
import { KatchimeraFriendDiscoveryReveal } from '@/components/katchadeck/world/katchimera-friend-discovery-reveal';
import { worldUpgradeStory, upgradeUsesTutorialNarrative } from '@/features/world-upgrades/world-upgrade-stories';
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
import { completeStepplingMission, startGlowDiscovery, submitGlowAction, useGlowDiscoveryState } from '@/features/onboarding/glow-discovery-runtime';
import { GLOW_GATEWAY_NODE_IDS, GLOW_MISSION_CLEAR_NODE_ID, glowDiscoveryAllowsGarden, glowDiscoveryLocksCamera, glowDiscoveryMissionNode, glowDiscoveryResumeCamera, glowDiscoveryScene } from '@/features/onboarding/glow-discovery-flow';
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
import { HavenFtueOverlay } from '@/components/katchadeck/onboarding/haven-ftue-overlay';
import { FtueGuideCopy } from '@/components/katchadeck/onboarding/ftue-guide-copy';
import { FTUE_SCENE_LAYERS } from '@/constants/ftue-scene-layers';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { GameCurrencyHud } from '@/components/katchadeck/ui/game-currency-hud';
import { MergeFtueEggGuide, MergeFtueOverlay } from '@/components/katchadeck/games/merge-ftue-overlay';
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
import type { KatchimeraFamilyId, KatchimeraSkinId } from '@/types/katchimera';
import type { ConversationSession } from '@/types/companion-conversation';
import { HAVEN_ENVIRONMENTS, type HavenStage } from '@/constants/haven-catalog';
import { acknowledgeStoredIslandCampaignChapterReturn, acknowledgeStoredIslandCampaignResidentCardReveal, acknowledgeStoredIslandCampaignResidentDiscovery, activateStoredIslandCampaignChapter, completeStoredIslandCampaignChapter, completeStoredIslandRestoration, ensureStoredFirstFtueMemoryPlacement, recordStoredIslandRestorationProgress, requestStoredIslandCampaignDelivery, saveUpgradeStoryRead } from '@/utils/merge-world/repository';
import type { FtueCameraDirective } from '@/features/onboarding/ftue-types';
import { IslandRestorationDock } from '@/components/katchadeck/world/island-restoration-dock';
import { consumeIslandRestorationOpen, requestIslandRestorationOpen } from '@/features/island-restoration/restoration-intent';
import { PETALIMP_ISLAND_CAMPAIGN_ID } from '@/constants/island-campaigns/petalimp-bloom';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { createRestorationState, deliveriesToPlace, restorationBoardStep, restorationCheckpointReached, restorationComplete, restorationDeliveryCells, restorationProgress, restorationRunId, restorationStorageKey, restoreRestorationEchoes } from '@/features/island-restoration/island-restoration';
import { useKatchimeraCards } from '@/hooks/use-katchimera-cards';
import { mossproutNatureIslandById, mossproutNatureIslandLevelDefinition } from '@/constants/mossprout-nature-islands';
import { havenHexTileSpec, kingdomHexTileSourceForLod } from '@/utils/world-visuals';
import type { HavenTileUpgradePresentation } from '@/utils/haven-upgrade-presentation';
import { deriveHavenTilePresentation } from '@/utils/haven-tile-presentation';
import { advanceFtueActionDurably, commitFtueAction, dispatchFtueEvent, loadFtueRun, useFtueRun } from '@/features/onboarding/ftue-runtime';
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
import {
  activeIslandCampaign,
  islandCampaignChapter,
  islandCampaignChapterOrder,
  islandCampaignOpeningConversationId,
  islandCampaignPanelPresentation,
  islandCampaignPreviousStyle,
  islandCampaignResolutionConversationId,
  islandCampaignReturnConversationId,
  islandCampaignSelectedChoice,
  islandCampaignSelectedStyle,
  islandCampaignUpgradePanelState,
  pendingIslandCampaignCardReveal,
  pendingIslandCampaignDiscovery,
  activeIslandRestoration,
} from '@/constants/island-campaigns/helpers';
import { islandCampaignForIsland, islandCampaignForOffer } from '@/constants/island-campaigns/registry';
import type { IslandCampaignDefinition, IslandCampaignPhase } from '@/constants/island-campaigns/types';
import { nextOpenIsland } from '@/constants/island-campaigns/wake-order';
import { KingdomGoalScene } from '@/components/katchadeck/onboarding/kingdom-goal-scene';
import { KingdomProgressPill } from '@/components/katchadeck/world/kingdom-progress-pill';
import { IslandWakeHandoffSheet, KingdomProgressSheet } from '@/components/katchadeck/world/kingdom-progress-sheet';
import { kingdomProgress, type KingdomNext } from '@/features/kingdom-progress/kingdom-progress';
import { STEPPLING_FINALE_NODE_IDS, stepplingShoeServed } from '@/features/onboarding/steppling-garden-lesson';
import { acknowledgeStoredKingdomGoalCoachmark } from '@/utils/merge-world/repository';

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

const GARDEN_BUTTON_ART = require('@incubator/art-world/square/mossprout-garden-button-v1-256.webp');
/** One shared empty list, so the canvas is not handed a fresh prop on every opening render. */
const NO_UPGRADE_OFFERS: WorldUpgradeOffer[] = [];
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

/** Petalimp's checkpoint hint is shown once per player. */
const RESTORATION_HINT_SEEN_KEY = 'katchimeras.island-restoration.hint-seen.petalimp.v1';
/** How long the hint stays before a tap away can dismiss it. */
const RESTORATION_HINT_ARM_MS = 2500;
/** Under the docked board (60), so the card and board keep their taps; over the map, so a tap there puts the hint away. */
const RESTORATION_HINT_CATCHER_Z = 59;

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
  ftueStepId: routeFtueStepId,
  onFtueRestore,
  onFtueInspect,
  onFtueOpenGarden,
  initialCameraSnapshot,
  onCameraSnapshotChange,
  worldEggTargetRef,
  worldSubjectPresentation,
}: Props) {
  const router = useRouter();
  const { run: glowRun, ready: glowReady } = useGlowDiscoveryState();
  // Steppling's mist mission is live while the Glow story waits on its bar.
  const stepplingMissionActive = glowRun?.status === 'active' && glowRun.nodeId === GLOW_MISSION_CLEAR_NODE_ID;
  // The final merge's item flies into the mist before the lift beat: the run
  // is already at `world.mist_lift`, but the Kingdom keeps presenting the
  // clear beat (its camera, the veiled tile, the dock, no caption) until the
  // item has landed and its burst has settled. Only then does the lift begin.
  const [homeTileNode, setHomeTileNodeState] = useState<View | null>(null);
  const [gatewayTileNode, setGatewayTileNodeState] = useState<View | null>(null);
  // A friend's restoration board: the chapter whose beds are open, on its own store under the island.
  const islandRestoration = useMemo(() => activeIslandRestoration(mergeWorld), [mergeWorld]);
  const [islandTileNodes, setIslandTileNodes] = useState<Partial<Record<MossproutNatureIslandId, View | null>>>({});
  const islandTileNodesRef = useRef(islandTileNodes);
  islandTileNodesRef.current = islandTileNodes;
  const setNatureIslandTileNode = useCallback((islandId: MossproutNatureIslandId, node: View | null) => {
    setIslandTileNodes((current) => (current[islandId] === node ? current : { ...current, [islandId]: node }));
  }, []);
  const restorationTileNode = islandRestoration ? islandTileNodes[islandRestoration.campaign.islandId] ?? null : null;
  // Glow flies into whichever misted tile the live board sits under.
  const openingGlow = useOpeningGlow(stepplingMissionActive ? gatewayTileNode : islandRestoration ? restorationTileNode : homeTileNode);
  const ftueStepId = routeFtueStepId === OPENING_MIST_LIFT_STEP_ID && openingGlow.finaleActive ? OPENING_MIST_CLEAR_STEP_ID : routeFtueStepId;
  // The mist itself starts clearing the frame the item strikes the tile; only
  // the camera, the caption and the dock wait for the burst to settle.
  const homeVeil = routeFtueStepId === OPENING_MIST_LIFT_STEP_ID && openingGlow.finaleActive && !openingGlow.finaleLanded ? 'veiled' : homeVeilForStep(routeFtueStepId);
  const { flush: flushMergeWorld } = useMergeWorldActions();
  const { transitionTo } = useGameScreenTransition();
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
  const mistUpgradeActive = Boolean(glowRun && glowRun.status !== 'completed' && GLOW_GATEWAY_NODE_IDS.includes(glowRun.nodeId));
  const glowScene = glowRun ? glowDiscoveryScene(glowRun.nodeId) : null;
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [lockedHintVisible, setLockedHintVisible] = useState(false);
  // Mossprout's wish: once told, the next open island is framed and pointed at exactly once.
  const kingdomGoal = mergeWorld.kingdomGoal ?? null;
  const goalIslandId = nextOpenIsland(mergeWorld);
  const goalIslandIdRef = useRef(goalIslandId);
  goalIslandIdRef.current = goalIslandId;
  const goalMarkerRef = useRef<View | null>(null);
  const [goalMarkerRevision, setGoalMarkerRevision] = useState(0);
  const [focusIslandId, setFocusIslandId] = useState<MossproutNatureIslandId | null>(null);
  const focusReasonRef = useRef<'goal' | 'tracker' | null>(null);
  const [goalCoachmarkArmed, setGoalCoachmarkArmed] = useState(false);
  const [progressSheetOpen, setProgressSheetOpen] = useState(false);
  const [wakeHandoffCampaign, setWakeHandoffCampaign] = useState<IslandCampaignDefinition | null>(null);
  const progressSummary = useMemo(() => kingdomProgress(mergeWorld), [mergeWorld]);
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
  const [displayedGlow, setDisplayedGlow] = useState(mergeWorld.coins);
  // A friend's paid stage: the Glow leaves the top bar for the tile as the counter counts it down, the way a purchase shows.
  // Primed before the write (the counter holds the old balance), counting once the write has landed.
  const [glowSpend, setGlowSpend] = useState<{ amount: number; counting: boolean } | null>(null);
  const [requiredUpgradeStory, setRequiredUpgradeStory] = useState<{ offer: WorldUpgradeOffer; presentation: HavenTileUpgradePresentation } | null>(null);
  const prepareEggEntry = useCallback(() => { setFtueCameraSettled(false); setGlowPanelOpen(false); }, []);
  const eggHandoff = useGlowEggHandoff({ run: glowRun, world: mergeWorld, focused: screenFocused,
    available: !interactionCreatureId && !upgradePresentation && !requiredUpgradeStory, open: stepplingEggOpen,
    enter: stepplingEncounter.enter, onOpening: prepareEggEntry });
  const upgradeOffers = useMemo(() => worldUpgradeOffers(mergeWorld), [mergeWorld]);
  const [selectedUpgrade, setSelectedUpgrade] = useState<WorldUpgradeOffer | null>(null);
  const [upgradePurchasing, setUpgradePurchasing] = useState(false);
  const [upgradeCommitted, setUpgradeCommitted] = useState(false);
  const upgradePressBusy = useRef(false);
  const [upgradeCoachmark, setUpgradeCoachmark] = useState<UpgradeCoachmarkState>({ visible: false, revision: 0 });
  const upgradeActionRef = useRef<View>(null);
  const tutorialUpgradeNonceRef = useRef<number | null>(null);
  const revealedUpgradeRef = useRef<number | null>(null);
  const pendingUpgradeReward = useRef<string | null>(null);
  const [upgradeReward, setUpgradeReward] = useState<string | null>(null);
  const { cards: mossproutCards } = useKatchimeraCards('mossprout');
  const pendingIslandDiscovery = pendingIslandCampaignDiscovery(mergeWorld);
  const pendingIslandCardReveal = pendingIslandCampaignCardReveal(mergeWorld);
  const revealedFriendCardId = (upgradeReward ?? pendingIslandCardReveal?.campaign.residentSkinId ?? null) as KatchimeraSkinId | null;
  const upgradeDismiss = useRef<(() => void) | null>(null);
  const registerUpgradeDismiss = useCallback((dismiss: (() => void) | null) => { upgradeDismiss.current = dismiss; }, []);
  const activeFtueRunId = loadFtueRun()?.runId ?? null;
  const ordinaryUpgradeRun = useWorldUpgradeRun();
  const ftueUpgradeRun = useWorldUpgradeRun(activeFtueRunId ? `flow:${activeFtueRunId}` : 'no-ftue-upgrade');
  const sharedUpgrade = selectedUpgrade ? selectedUpgrade.lockedReason
    ? selectedUpgrade
    : upgradeOffers.find((offer) => offer.id === selectedUpgrade.id && offer.nextLevel === selectedUpgrade.nextLevel) ?? selectedUpgrade
    : null;
  const sharedUpgradeCampaign = sharedUpgrade ? islandCampaignForOffer(sharedUpgrade.id) : null;
  const islandCampaignPanelState: WorldUpgradeCampaignState | null = sharedUpgradeCampaign
    ? islandCampaignPanelPresentation(mergeWorld, sharedUpgradeCampaign)
    : null;
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
  const [pendingIslandCampaign, setPendingIslandCampaign] = useState<{
    campaign: IslandCampaignDefinition; level: MossproutNatureIslandLevel; phase: IslandCampaignPhase;
  } | null>(null);
  const islandNarrativeAfterUpgradeRef = useRef<((campaign: IslandCampaignDefinition, level: MossproutNatureIslandLevel, phase: IslandCampaignPhase) => void) | null>(null);
  const islandDiscoveryContinueBusy = useRef(false);
  const campaignAutoTransitionRef = useRef<string | null>(null);
  /** A served request whose friend should greet the player on the island panel, not in an overlay. */
  const returnPanelRef = useRef<string | null>(null);
  const openUpgradeOfferRef = useRef<((offer: WorldUpgradeOffer) => Promise<void>) | null>(null);
  const [selectedMemoryPlantId, setSelectedMemoryPlantId] = useState<string | null>(null);
  const [firstSeedPlacementBusy, setFirstSeedPlacementBusy] = useState(false);
  const [firstSeedPlacementFailed, setFirstSeedPlacementFailed] = useState(false);
  const restoreButtonRef = useRef<View>(null);
  const glowCurrencyArtRef = useRef<View>(null);
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
  // A friend's restoration board frames their island the way the opening framed Mossprout's tile.
  // Keyed on the island alone: the restoration record changes with every planting, the framing does not.
  const restorationIslandId = islandRestoration?.campaign.islandId ?? null;
  // The board is optional: it opens when the friend's answer starts a stage or
  // from the island's marker, and can be put away to roam the map or serve the
  // order on the Main Board. Nothing forces the player back into it.
  const [restorationOpen, setRestorationOpen] = useState(false);
  useEffect(() => { if (!restorationIslandId) setRestorationOpen(false); }, [restorationIslandId]);
  const restorationCampaignId = islandRestoration?.campaign.campaignId ?? null;
  useEffect(() => {
    // "Meet me at Bloom Garden" from the Merge page: straight onto the board.
    if (screenFocused && restorationCampaignId && consumeIslandRestorationOpen(restorationCampaignId)) setRestorationOpen(true);
  }, [restorationCampaignId, screenFocused]);
  // Petalimp's one hint (the spent patch, the request on the tray) is shown once ever:
  // a tap away from the board after a moment, the card, or Later puts it away for good.
  const [restorationHintSeen, setRestorationHintSeen] = useState(() => getStoredJson<boolean>(RESTORATION_HINT_SEEN_KEY, false));
  const [restorationHintArmed, setRestorationHintArmed] = useState(false);
  const dismissRestorationHint = useCallback(() => {
    setRestorationHintSeen((seen) => {
      if (!seen) setStoredJson(RESTORATION_HINT_SEEN_KEY, true);
      return true;
    });
  }, []);
  const closeRestoration = useCallback(() => { setRestorationOpen(false); dismissRestorationHint(); }, [dismissRestorationHint]);
  const restorationCamera = useMemo((): FtueCameraDirective | null => restorationIslandId && restorationOpen && screenFocused ? {
    kind: 'focus_target' as const, target: { kind: 'haven_nature_island' as const, islandId: restorationIslandId },
    zoom: MISSION_CAMERA_ZOOM, anchorY: MISSION_CAMERA_ANCHOR_Y, durationMs: 700,
  } : null, [restorationIslandId, restorationOpen, screenFocused]);
  const tutorialCamera = mistResumeCamera ? screenFocused ? mistResumeCamera : null : restorationCamera ?? ftueStep?.camera ?? null;
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
    : ftueStepId === OPENING_MIST_OPEN_STEP_ID
      ? OPENING_CAMERA_ENTRY_ZOOM
    : isMossproutOpeningStep(ftueStepId) && tutorialCamera?.kind === 'focus_target'
      ? tutorialCamera.zoom
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
  const setHomeTileNode = useCallback((node: View | null) => {
    setHomeTileNodeState(node);
    registerFtueTarget('tile:mossprout', node);
  }, [registerFtueTarget]);
  // The opening's docked board: the run's own progress drives the bar, each
  // merge sends a Glow into the mist, and the finger shows only the first pairs.
  const ftueRun = useFtueRun();
  const openingRun = ftueRun?.status === 'active' && ftueRun.stepId === routeFtueStepId ? ftueRun : null;
  const [openingBoardMetrics, setOpeningBoardMetrics] = useState<MergeBoardScreenMetrics | null>(null);
  const [openingBlockedNonce, setOpeningBlockedNonce] = useState(0);
  const openingRailRefs = useRef(new Map<string, View>());
  const bumpOpeningBlocked = useCallback(() => setOpeningBlockedNonce((nonce) => nonce + 1), []);
  // The mission board: its own state and store, alive for the clear beat (and the lift while the final item flies).
  const missionRunId = openingRun && (ftueStepId === OPENING_MIST_CLEAR_STEP_ID || ftueStepId === OPENING_MIST_LIFT_STEP_ID) ? openingRun.runId : null;
  const mission = useOpeningMissionBoard(missionRunId);
  useEffect(() => {
    // The mission is over once the mist has lifted: its store goes with it.
    if (ftueStepId === 'world.egg_intro') clearOpeningMission();
  }, [ftueStepId]);
  const openingBoardActive = Boolean(mission.state) && ftueStepId === OPENING_MIST_CLEAR_STEP_ID;
  const openingProgress = openingMistProgress(openingRun);
  const openingStep = ftueStepId ? mossproutFtueStep(ftueStepId) ?? null : null;
  // The same beat the dock projects: spotlight and finger on the first pairs, the Basket refill, or nothing.
  const openingBoardStep = useMemo(() => openingBoardActive ? openingMistBoardStep(openingStep, mission.state, openingProgress) : null, [mission.state, openingBoardActive, openingProgress, openingStep]);
  const openingGuidanceVisible = Boolean(openingBoardStep && (openingBoardStep.cue || openingBoardStep.spotlight));
  // The spotlight and finger wait for the dock to finish fading in, or they point at a board still in motion.
  const [openingDockSettled, setOpeningDockSettled] = useState(false);
  useEffect(() => { if (!openingBoardActive && !stepplingMissionActive && !islandRestoration) setOpeningDockSettled(false); }, [islandRestoration, openingBoardActive, stepplingMissionActive]);
  const markOpeningDockSettled = useCallback(() => setOpeningDockSettled(true), []);
  // Steppling's mist mission: its own board and store under the misted
  // clearing. The bar filling is what moves the Glow story on to the paid
  // reveal, recorded the moment the final item strikes the tile.
  const stepplingMission = useMissionBoard(STEPPLING_MISSION_STORAGE_KEY, stepplingMissionActive ? STEPPLING_MISSION_ID : null, createStepplingMissionState);
  const stepplingMissionStep = useMemo(() => stepplingMissionActive ? stepplingMissionBoardStep(stepplingMission.state, stepplingMission.merges) : null, [stepplingMission.merges, stepplingMission.state, stepplingMissionActive]);
  const stepplingMissionGuidanceVisible = Boolean(stepplingMissionStep && (stepplingMissionStep.cue || stepplingMissionStep.spotlight));
  const stepplingMissionCleared = stepplingMission.merges >= STEPPLING_MISSION_MERGE_REQUIRED;
  const stepplingFinaleIdRef = useRef<number | null>(null);
  const { launchFinale: launchGlowFinale } = openingGlow;
  const launchStepplingFinale = useCallback((from: RewardFlightPoint, definitionId: string) => {
    stepplingFinaleIdRef.current = launchGlowFinale(from, definitionId);
  }, [launchGlowFinale]);
  const stepplingMissionDoneRef = useRef(false);
  useEffect(() => { if (!stepplingMissionActive) stepplingMissionDoneRef.current = false; }, [stepplingMissionActive]);
  const finishStepplingMission = useCallback(() => {
    if (stepplingMissionDoneRef.current) return;
    stepplingMissionDoneRef.current = true;
    void completeStepplingMission().catch((error) => {
      stepplingMissionDoneRef.current = false;
      console.warn('The mist could not clear', error);
    });
  }, []);
  // Live: the mist clears when the mission's own final item lands on the tile.
  useEffect(() => {
    if (stepplingMissionActive && stepplingMissionCleared && stepplingFinaleIdRef.current != null && openingGlow.finaleLandedId === stepplingFinaleIdRef.current) finishStepplingMission();
  }, [finishStepplingMission, openingGlow.finaleLandedId, stepplingMissionActive, stepplingMissionCleared]);
  // Resume: a board saved with its bar already full (killed while the item flew) clears the mist on arrival.
  const stepplingMissionCheckedRef = useRef(false);
  useEffect(() => {
    if (!stepplingMissionActive || !stepplingMission.state) { stepplingMissionCheckedRef.current = false; return; }
    if (stepplingMissionCheckedRef.current) return;
    stepplingMissionCheckedRef.current = true;
    if (stepplingMission.merges >= STEPPLING_MISSION_MERGE_REQUIRED) finishStepplingMission();
  }, [finishStepplingMission, stepplingMission.merges, stepplingMission.state, stepplingMissionActive]);
  useEffect(() => {
    // The mission is over once the reveal has played: its store goes with it.
    if (glowRun?.status === 'completed' || glowRun?.nodeId === 'gateway.egg') clearMission(STEPPLING_MISSION_STORAGE_KEY);
  }, [glowRun?.nodeId, glowRun?.status]);
  const setGardenButtonNode = useCallback((node: View | null) => {
    registerFtueTarget('garden-button:mossprout', node);
  }, [registerFtueTarget]);
  const setGardenClusterNode = useCallback((node: View | null) => {
    registerFtueTarget('garden-cluster:mossprout', node);
  }, [registerFtueTarget]);
  const setGatewayNode = useCallback((node: View | null) => {
    setGatewayTileNodeState(node);
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
  const havenOpeningActive = isMossproutOpeningStep(ftueStepId)
    || ftueStepId === 'world.egg_intro'
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
  const seedPlantingFtueActive = ftueStepId === 'world.garden_arrival' || ftueStepId === 'world.seed_planted';
  const measureGlowCurrencyOrigin = useCallback(() => new Promise<{ x: number; y: number }>((resolve) => {
    const fallback = { x: window.width - 54, y: insets.top + 28 };
    const node = glowCurrencyArtRef.current;
    if (!node) {
      resolve(fallback);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      resolve(width > 0 && height > 0 ? { x: x + width / 2, y: y + height / 2 } : fallback);
    });
  }), [insets.top, window.width]);

  useEffect(() => {
    if (upgradePresentation?.showCoins && upgradePresentation.coinCost > 0) return;
    if (upgradePurchasing || upgradeCommitted || glowSpend) return;
    setDisplayedGlow(mergeWorld.coins);
  }, [glowSpend, mergeWorld.coins, upgradeCommitted, upgradePresentation, upgradePurchasing]);

  useEffect(() => {
    if (!upgradePresentation?.showCoins || upgradePresentation.coinCost <= 0) return;
    // Paint the pre-purchase balance and the first outgoing tokens together,
    // then count down for the same 650 ms occupied by the staggered flights.
    const frame = requestAnimationFrame(() => setDisplayedGlow(mergeWorldRef.current.coins));
    return () => cancelAnimationFrame(frame);
  }, [upgradePresentation?.coinCost, upgradePresentation?.nonce, upgradePresentation?.showCoins]);

  const upgradePresentationOperation = useStoryPresentationOperation('haven', STORY_WORLD_UPGRADE_PRESENTATION, async (work, run, signal) => {
    const payload = work.payload as StoryWorldUpgradePresentationPayload;
    const receipt = contentFlowEffectResult<StoryWorldMutationReceipt>(
      run.effectReceipts,
      run.runId,
      payload.sourceEffectNodeId,
      payload.sourceEffectId,
    );
    if (!receipt) throw new Error(`Upgrade receipt for ${payload.sourceEffectNodeId} is not available`);

    const mossproutSlot = visibleCompanionSlots.find((slot) => slot.kind === 'owned' && slot.familyId === 'mossprout');
    const coinOrigin = await measureGlowCurrencyOrigin();
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
        showCoins: receipt.coinCost > 0 && receipt.economyMode === 'normal' && (payload.showCoins ?? true),
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
        reactionLine: '', showCoins: receipt.coinCost > 0 && receipt.economyMode === 'normal',
        status: 'playing', storyPresentationKey: work.key, upgradeName: 'Misty clearing', visualTarget: payload.target,
      };
    } else {
      const island = mossproutNatureIslandById.get(receipt.target.islandId);
      const level = mossproutNatureIslandLevelDefinition(receipt.target.islandId, receipt.toLevel as MossproutNatureIslandLevel);
      if (!island || (!level && receipt.transition !== 'island_reveal') || mossproutSlot?.kind !== 'owned') throw new Error(`Nature island ${receipt.target.islandId} is not ready`);
      presentation = {
        cameraAlreadyFocused: true,
        characterId: 'mossprout',
        coinCost: receipt.coinCost,
        coinOrigin,
        creatureId: mossproutSlot.creature.creatureId,
        creatureName: mossproutSlot.creature.name,
        fromStage: receipt.fromLevel as HavenStage,
        natureIslandId: receipt.target.islandId,
        natureIslandReveal: receipt.transition === 'island_reveal',
        nonce: ++upgradeNonceRef.current,
        palette: {
          accent: island.accent,
          glow: island.accent,
          mist: 'rgba(226,255,213,0.88)',
          primary: '#4F9F57',
        },
        reactionLine: islandCampaignForIsland(receipt.target.islandId)
          ? receipt.transition === 'island_reveal' ? islandCampaignForIsland(receipt.target.islandId)!.copy.revealReactionLine : ''
          : payload.reactionLine ?? `${island.shortName} is growing beautifully.`,
        showCoins: receipt.coinCost > 0 && receipt.economyMode === 'normal' && (payload.showCoins ?? true),
        status: 'playing',
        storyPresentationKey: work.key,
        toStage: receipt.toLevel as HavenStage,
        upgradeName: level?.name ?? 'Forgotten Garden',
        visualTarget: payload.target,
      };
    }

    // The authored conversation is shown after the crossblend, not as a caption over it.
    const offerId = presentation.natureIslandId ? `nature:${presentation.natureIslandId}`
      : receipt.target.kind === 'haven_structure' ? `mist:${receipt.target.structureId}` : `haven:${presentation.characterId}`;
    if (worldUpgradeStory(offerId, receipt.toLevel)) presentation.reactionLine = '';
    tutorialUpgradeNonceRef.current = upgradeUsesTutorialNarrative(offerId, receipt.toLevel, run.definitionId) ? presentation.nonce : null;
    revealedUpgradeRef.current = null;
    setUpgrading(true);
    setDetailCreatureId(null);
    setDisplayedGlow(presentation.showCoins ? mergeWorldRef.current.coins + presentation.coinCost : mergeWorldRef.current.coins);
    setUpgradePresentation(presentation);
    await new Promise<void>((resolve) => {
      storyUpgradeResolversRef.current.set(work.key, resolve);
      signal.addEventListener('abort', () => {
        storyUpgradeResolversRef.current.delete(work.key);
        setUpgradePresentation((current) => current?.storyPresentationKey === work.key ? null : current);
        setRequiredUpgradeStory((current) => current?.presentation.storyPresentationKey === work.key ? null : current);
        setDisplayedGlow(mergeWorldRef.current.coins);
        setUpgrading(false);
        resolve();
      }, { once: true });
    });
  }, screenFocused && !activeInteractionResidentId && !interactionExiting);
  // A restoration is queued the moment its narrative ends, but the presentation
  // itself can only be built a few frames later (it has to measure the Glow
  // counter first). Read the queue directly — not the gated `active` flag — so
  // the markers and the panel stay down across that whole handoff instead of
  // flashing back in for a frame between the story and the upgrade sequence.
  const upgradeHandoffPending = upgradePresentationOperation.model.pendingWork.kind === 'presentation'
    && upgradePresentationOperation.model.pendingWork.presentationType === STORY_WORLD_UPGRADE_PRESENTATION;

  const finishUpgradePresentation = useCallback((presentation: HavenTileUpgradePresentation) => {
    setRequiredUpgradeStory(null);
    if (pendingUpgradeReward.current) { setUpgradeReward(pendingUpgradeReward.current); pendingUpgradeReward.current = null; }
    if (presentation.storyPresentationKey) {
      const resolve = storyUpgradeResolversRef.current.get(presentation.storyPresentationKey);
      storyUpgradeResolversRef.current.delete(presentation.storyPresentationKey);
      resolve?.();
    }
    setUpgradePresentation((current) => current?.nonce === presentation.nonce ? null : current);
    setDisplayedGlow(mergeWorldRef.current.coins);
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

  const completeUpgradePresentation = useCallback((presentation: HavenTileUpgradePresentation) => {
    // The canvas may report completion more than once; a single story owns the ack.
    if (revealedUpgradeRef.current === presentation.nonce) return;
    revealedUpgradeRef.current = presentation.nonce;
    if (presentation.veilLift) {
      // The opening's lift wrote nothing to the world; it only moves the run on.
      setUpgradePresentation((current) => current?.nonce === presentation.nonce ? null : current);
      commitFtueAction({ actionId: OPENING_LIFTED_ACTION_ID, evidenceRef: 'mossprout-world:veil-lifted' });
      return;
    }
    if (tutorialUpgradeNonceRef.current === presentation.nonce) {
      finishUpgradePresentation(presentation);
      return;
    }
    const presentedCampaign = islandCampaignForIsland(presentation.natureIslandId);
    if (presentedCampaign) {
      finishUpgradePresentation(presentation);
      if (!presentation.natureIslandReveal) requestAnimationFrame(() => islandNarrativeAfterUpgradeRef.current?.(
        presentedCampaign,
        presentation.toStage as MossproutNatureIslandLevel,
        'resolution',
      ));
      return;
    }
    const id = presentation.natureIslandId ? `nature:${presentation.natureIslandId}`
      : presentation.visualTarget?.kind === 'haven_structure' && presentation.visualTarget.structureId === 'steppling-home'
        ? 'mist:steppling-home' : `haven:${presentation.characterId}`;
    const definition = WORLD_UPGRADE_DEFINITIONS.find((item) => item.id === id && item.nextLevel === presentation.toStage);
    if (definition && worldUpgradeStory(id, presentation.toStage)) {
      setUpgradePresentation((current) => current?.nonce === presentation.nonce ? null : current);
      setRequiredUpgradeStory({ presentation, offer: { ...definition, currentLevel: presentation.toStage,
        maxLevel: worldUpgradeMaxLevel(definition), eligible: false, affordable: false, missingGlow: 0 } });
      // Do not resolve the durable reveal yet. On interruption the same paid
      // receipt replays its reveal and resumes the saved dialogue cursor.
      return;
    }
    finishUpgradePresentation(presentation);
  }, [finishUpgradePresentation]);

  // The opening's veil lift: one local crossblend per run at `world.mist_lift`,
  // rebuilt on a cold resume and committed exactly once when the canvas finishes.
  const veilLiftKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (homeVeil !== 'lifting') return;
    const key = `${activeFtueRunId ?? 'current'}:${OPENING_MIST_LIFT_STEP_ID}`;
    if (veilLiftKeyRef.current === key) return;
    veilLiftKeyRef.current = key;
    revealedUpgradeRef.current = null;
    setUpgradePresentation({
      cameraAlreadyFocused: true, characterId: 'mossprout', coinCost: 0, coinOrigin: { x: 0, y: 0 },
      creatureId: 'companion:mossprout', creatureName: 'Mossprout', fromStage: 0, toStage: 0,
      nonce: ++upgradeNonceRef.current,
      palette: { accent: '#DDF6FF', glow: '#A9E4FF', mist: 'rgba(214,229,238,0.92)', primary: '#7FBFD9' },
      reactionLine: '', showCoins: false, status: 'playing', upgradeName: 'clearing', veilLift: true,
    });
  }, [activeFtueRunId, homeVeil]);

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
    setPendingIslandCampaign(null);
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
    const accepted = transitionTo({
      announcement: "Opening Mossprout's Garden",
      target: 'merge',
      onCovered: closeResidentInteraction,
      navigate: () => {
        // Retain the island/upgrade focus while the source is visible. Clearing
        // the selection earlier makes the camera restore behind the closing
        // panel before the route curtain has finished covering the world.
        setSelectedUpgrade(null);
        setUpgradeError(null);
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
    if (!accepted) {
      setSelectedUpgrade(null);
      setUpgradeError(null);
    }
  }, [closeResidentInteraction, havenMergeBoardActive, interactionSlot?.familyId, router, transitionTo]);

  const openIslandCampaignNarrative = useCallback((campaign: IslandCampaignDefinition, level: MossproutNatureIslandLevel, phase: IslandCampaignPhase = 'opening') => {
    const chapter = islandCampaignChapter(campaign, level);
    const mossprout = visibleCompanionSlots.find((slot) => slot.kind === 'owned' && slot.familyId === 'mossprout');
    if (!chapter || !mossprout || mossprout.kind !== 'owned') return;
    const progress = mergeWorld.islandCampaigns?.[campaign.campaignId];
    const selectedOptionId = progress?.chapters[String(level)]?.selectedOptionId;
    const finalLevel = campaign.chapters[campaign.chapters.length - 1]?.level;
    const style = level === finalLevel ? islandCampaignSelectedStyle(mergeWorld, campaign) : undefined;
    const definitionId = phase === 'opening' ? islandCampaignOpeningConversationId(campaign, level, islandCampaignPreviousStyle(mergeWorld, campaign, level))
      : phase === 'return' ? islandCampaignReturnConversationId(campaign, level, selectedOptionId)
        : islandCampaignResolutionConversationId(campaign, level, selectedOptionId, style);
    if (!definitionId) return;
    setPendingIslandCampaign({ campaign, level, phase });
    setDetailCreatureId(null);
    setInteractionCameraReady(false);
    setInteractionExiting(false);
    setHostedInteractionRequest({
      creatureId: 'companion:mossprout',
      journeyReturnConversationDefinitionId: definitionId,
      key: `${campaign.campaignId}:level-${level}:${phase}:${Date.now().toString(36)}`,
    });
    setInteractionCreatureId(mossprout.creature.creatureId);
  }, [mergeWorld, visibleCompanionSlots]);
  islandNarrativeAfterUpgradeRef.current = openIslandCampaignNarrative;

  const handleIslandCampaignPanelAction = useCallback(() => {
    const campaign = sharedUpgradeCampaign;
    const progress = campaign ? islandCampaignUpgradePanelState(mergeWorldRef.current, campaign) : null;
    if (!campaign || !progress?.action) return;
    if (progress.action === 'open_merge') {
      openGarden(progress.order?.id, 'mossprout');
      return;
    }
    if (progress.action === 'continue_restoring') {
      // Bring the board back under the island.
      setRestorationOpen(true);
      setSelectedUpgrade(null);
      return;
    }
    openIslandCampaignNarrative(campaign, progress.level, progress.action === 'start_story'
      ? 'opening'
      : progress.action === 'continue_return' ? 'return' : 'resolution');
    setSelectedUpgrade(null);
  }, [openGarden, openIslandCampaignNarrative, sharedUpgradeCampaign]);

  const continueFromIslandDiscovery = useCallback(async (campaign: IslandCampaignDefinition) => {
    if (islandDiscoveryContinueBusy.current) return;
    islandDiscoveryContinueBusy.current = true;
    const level = pendingIslandCampaign?.campaign.campaignId === campaign.campaignId ? pendingIslandCampaign.level
      : Math.min(4, (mergeWorldRef.current.haven.mossproutNatureIslands[campaign.islandId] ?? 0) + 1) as MossproutNatureIslandLevel;
    try {
      await acknowledgeStoredIslandCampaignResidentDiscovery(campaign.campaignId);
      openIslandCampaignNarrative(campaign, level, 'opening');
    } catch (error) {
      console.warn(`Could not continue from ${campaign.residentName} discovery`, error);
    } finally {
      islandDiscoveryContinueBusy.current = false;
    }
  }, [openIslandCampaignNarrative, pendingIslandCampaign]);

  const completeIslandCampaignConversation = useCallback(async (_definitionId: string, session: ConversationSession) => {
    if (!pendingIslandCampaign) return;
    const { campaign, level, phase } = pendingIslandCampaign;
    const chapter = islandCampaignChapter(campaign, level);
    if (!chapter) return;
    if (phase === 'return') {
      await acknowledgeStoredIslandCampaignChapterReturn(campaign.campaignId, chapter.level);
      requestResidentInteractionExit();
      return;
    }
    if (phase === 'resolution') {
      await completeStoredIslandCampaignChapter(campaign.campaignId, chapter.level);
      requestResidentInteractionExit();
      return;
    }
    const selectedOptionId = islandCampaignSelectedChoice(campaign, chapter.level, session.turns.map((turn) => turn.optionId))?.id;
    if (!selectedOptionId) throw new Error('Choose how this part of the garden should grow.');
    const order = islandCampaignChapterOrder(campaign, chapter.level, selectedOptionId);
    if (!order) return;
    // A board stage is paid as it opens (the first is the gift): hold the counter until the write lands.
    const stageCost = chapter.restoration && chapter.level > 1 ? mossproutNatureIslandLevelDefinition(campaign.islandId, chapter.level)?.coinCost ?? 0 : 0;
    if (stageCost > 0) setGlowSpend({ amount: stageCost, counting: false });
    let result: Awaited<ReturnType<typeof activateStoredIslandCampaignChapter>>;
    try {
      result = await activateStoredIslandCampaignChapter({
        campaignId: campaign.campaignId,
        islandId: campaign.islandId,
        residentSkinId: campaign.residentSkinId,
        level: chapter.level,
        selectedOptionId,
        orders: [order],
      });
    } catch (error) { setGlowSpend(null); throw error; }
    const campaignProgress = result.state.islandCampaigns?.[campaign.campaignId]
      ?.chapters[String(chapter.level)];
    if (chapter.restoration) {
      // Paid here (the first is the gift); the board docks under the island once the conversation closes.
      if (!campaignProgress?.restoration) { setGlowSpend(null); throw new Error(result.message ?? 'Earn a few more Glow through Merge orders.'); }
      if (stageCost > 0) {
        // The Glow flies from the top bar into this island (aimed at its own node: the shared hook has not
        // re-aimed yet when the write lands) as the counter counts it down.
        const spent = result.state.coins;
        void measureGlowCurrencyOrigin().then((origin) => {
          const aim = (attempt: number) => {
            const node = islandTileNodesRef.current[campaign.islandId] ?? null;
            if (!node && attempt < 30) { requestAnimationFrame(() => aim(attempt + 1)); return; }
            openingGlow.launch(origin, node);
            setGlowSpend({ amount: stageCost, counting: true });
            setDisplayedGlow(spent);
            setTimeout(() => setGlowSpend(null), 900);
          };
          aim(0);
        });
      }
      setRestorationOpen(true);
      requestResidentInteractionExit();
      return;
    }
    if (!campaignProgress?.orderIds[0]) throw new Error(`${campaign.residentName}’s request could not be opened. Please try again.`);
    const activeOrderId = campaignProgress.orderIds[0];
    openGarden(activeOrderId, 'mossprout');
  }, [measureGlowCurrencyOrigin, openGarden, openingGlow, pendingIslandCampaign, requestResidentInteractionExit]);

  // The restoration board itself: its store, its deliveries, its checkpoint and its finish.
  const restorationDefinition = islandRestoration?.chapter.restoration ?? null;
  // The run names the stage's start and the board's authoring: a restarted or re-authored stage never inherits a saved board.
  const restorationBoardRunId = islandRestoration && restorationDefinition ? restorationRunId(islandRestoration.campaign.campaignId, islandRestoration.level, islandRestoration.progress.startedAt, restorationDefinition) : null;
  const createRestorationBoard = useCallback((now: number) => createRestorationState(restorationDefinition!, now), [restorationDefinition]);
  const repairRestorationBoard = useCallback((state: MergeWorldState) => restorationDefinition ? restoreRestorationEchoes(restorationDefinition, state) : state, [restorationDefinition]);
  const restorationStore = useMissionBoard(islandRestoration ? restorationStorageKey(islandRestoration.campaign.campaignId, islandRestoration.level) : 'katchimeras.mist-mission.none.v1', restorationBoardRunId, createRestorationBoard, repairRestorationBoard);
  const restorationChapterProgress = islandRestoration ? mergeWorld.islandCampaigns?.[islandRestoration.campaign.campaignId]?.chapters[String(islandRestoration.level)] ?? null : null;
  const restorationBoardVisible = Boolean(islandRestoration && restorationStore.state) && restorationOpen && screenFocused && !upgradePresentation && !interactionCreatureId && !pendingIslandCampaign && !stepplingMissionActive && !openingBoardActive;
  useEffect(() => {
    // Back puts the board away; it never leaves the Kingdom from here.
    if (!restorationBoardVisible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { closeRestoration(); return true; });
    return () => subscription.remove();
  }, [closeRestoration, restorationBoardVisible]);
  const restorationSummary = useMemo(() => restorationDefinition ? restorationProgress(restorationDefinition, restorationStore.merges) : null, [restorationDefinition, restorationStore.merges]);
  const restorationDone = Boolean(restorationDefinition && restorationComplete(restorationDefinition, restorationStore.merges));
  // While a docked board is up, only its tile stays on the map (the opening uses `homeSolo` instead).
  // The map comes back the moment the bar is full: clearing the mist is done, so everything is shown again for the reveal.
  const stepplingBoardBusy = stepplingMissionActive && !stepplingMissionCleared;
  const restorationBoardBusy = restorationBoardVisible && !restorationDone;
  const soloLayerId = stepplingBoardBusy ? 'structure:steppling-home' : restorationBoardBusy && restorationIslandId ? `nature:mossprout:${restorationIslandId}` : null;
  // No marker percentage while the board is up: the request lives on the dock's tray instead.
  const soloOfferId = stepplingBoardBusy ? 'mist:steppling-home' : null;
  // No tutorial on a friend's board: the step only locks the board once its bar is full.
  const restorationStep = useMemo(() => islandRestoration && restorationStore.state
    ? restorationBoardStep(islandRestoration.campaign, islandRestoration.level, restorationStore.state, restorationStore.merges)
    : null, [islandRestoration, restorationStore.merges, restorationStore.state]);
  // The tray's request: the chapter's order once the board has asked for it, served or not.
  const restorationOrder = useMemo(() => {
    if (!islandRestoration || !restorationChapterProgress || islandRestoration.progress.deliveryRequestedAt == null) return null;
    const orderId = restorationChapterProgress.orderIds[0];
    const saved = orderId ? mergeWorld.activeOrders.find((candidate) => candidate.id === orderId) : null;
    const authored = islandCampaignChapterOrder(islandRestoration.campaign, islandRestoration.level, restorationChapterProgress.selectedOptionId ?? null);
    return saved ?? (authored && orderId ? { ...authored, id: orderId } : authored);
  }, [islandRestoration, mergeWorld.activeOrders, restorationChapterProgress]);
  const restorationOrderServed = Boolean(restorationChapterProgress && restorationChapterProgress.orderIds.length > 0 && restorationChapterProgress.orderIds.every((id) => restorationChapterProgress.servedOrderIds.includes(id)));
  const restorationPendingDeliveries = useMemo(() => islandRestoration ? deliveriesToPlace(islandRestoration.progress, restorationStore.placedDeliveries) : [], [islandRestoration, restorationStore.placedDeliveries]);
  // The one hint a friend's board gives, and only Petalimp's: when the patch is
  // spent and her request sits on the tray, the card is spotlit and explained.
  const restorationCheckpointHint = Boolean(islandRestoration && islandRestoration.campaign.campaignId === PETALIMP_ISLAND_CAMPAIGN_ID
    && restorationOrder && !restorationOrderServed && restorationBoardVisible && !restorationHintSeen);
  useEffect(() => {
    // A tap away dismisses it only after it has had a moment to be read.
    if (!restorationCheckpointHint) { setRestorationHintArmed(false); return; }
    const timer = setTimeout(() => setRestorationHintArmed(true), RESTORATION_HINT_ARM_MS);
    return () => clearTimeout(timer);
  }, [restorationCheckpointHint]);
  useEffect(() => {
    // Served: the hint has done its job, whether or not it was ever tapped away.
    if (restorationOrderServed) dismissRestorationHint();
  }, [dismissRestorationHint, restorationOrderServed]);
  const openRestorationOrder = useCallback(() => {
    if (!islandRestoration || !restorationOrder) return;
    dismissRestorationHint();
    // Back from the Merge page lands on this board again.
    requestIslandRestorationOpen(islandRestoration.campaign.campaignId);
    openGarden(restorationOrder.id, 'mossprout');
  }, [dismissRestorationHint, islandRestoration, openGarden, restorationOrder]);
  const restorationPlace = restorationStore.place;
  const placeRestorationDelivery = useCallback((entry: { cell: number; definitionId: string }) => restorationPlace([entry]), [restorationPlace]);
  // With the board put away, deliveries land quietly as they arrive (and on mount after a relaunch);
  // with it up, the dock flies them from the tray into the cells and places each as it arrives.
  useEffect(() => {
    if (!islandRestoration || !restorationDefinition || !restorationStore.state || restorationBoardVisible) return;
    const pending = deliveriesToPlace(islandRestoration.progress, restorationStore.placedDeliveries);
    if (!pending.length) return;
    const cells = restorationDeliveryCells(restorationDefinition, restorationStore.state, pending.length);
    const entries = pending.map((definitionId, index) => ({ cell: cells[index] ?? -1, definitionId })).filter((entry) => entry.cell >= 0);
    if (entries.length) restorationPlace(entries);
  }, [islandRestoration, restorationBoardVisible, restorationDefinition, restorationPlace, restorationStore.placedDeliveries, restorationStore.state]);
  // The world keeps the beds' summary for the marker and the tracker: one write per change.
  const recordedCurrent = islandRestoration?.progress.progress.current ?? -1;
  const recordedTotal = islandRestoration?.progress.progress.total ?? -1;
  useEffect(() => {
    if (!islandRestoration || !restorationSummary) return;
    if (recordedCurrent === restorationSummary.current && recordedTotal === restorationSummary.total) return;
    void recordStoredIslandRestorationProgress(islandRestoration.campaign.campaignId, islandRestoration.level, restorationSummary).catch(() => undefined);
  }, [islandRestoration, recordedCurrent, recordedTotal, restorationSummary]);
  // The checkpoint: the beds can go no further, so the chapter's order goes to the Main Board.
  useEffect(() => {
    if (!islandRestoration || !restorationDefinition || !restorationStore.state) return;
    if (islandRestoration.progress.deliveryRequestedAt != null) return;
    if (!restorationCheckpointReached(restorationDefinition, restorationStore.state, restorationStore.merges)) return;
    const order = islandCampaignChapterOrder(islandRestoration.campaign, islandRestoration.level, restorationChapterProgress?.selectedOptionId ?? null);
    if (!order) return;
    void requestStoredIslandCampaignDelivery(islandRestoration.campaign.campaignId, islandRestoration.level, [order]).catch((error) => console.warn('The request could not be sent', error));
  }, [islandRestoration, restorationChapterProgress?.selectedOptionId, restorationDefinition, restorationStore.merges, restorationStore.state]);
  // Finish: the last planting's bloom strikes the tile (or a board saved full finishes on arrival).
  const restorationFinaleIdRef = useRef<number | null>(null);
  const restorationFinishedRef = useRef<string | null>(null);
  const finishIslandRestoration = useCallback(() => {
    if (!islandRestoration) return;
    const key = `${islandRestoration.campaign.campaignId}:${islandRestoration.level}`;
    if (restorationFinishedRef.current === key) return;
    restorationFinishedRef.current = key;
    void completeStoredIslandRestoration(islandRestoration.campaign.campaignId, islandRestoration.level).catch((error) => {
      restorationFinishedRef.current = null;
      console.warn('The garden could not finish', error);
    });
  }, [islandRestoration]);
  const launchRestorationFinale = useCallback((from: RewardFlightPoint, definitionId: string) => {
    restorationFinaleIdRef.current = launchGlowFinale(from, definitionId);
  }, [launchGlowFinale]);
  useEffect(() => {
    if (restorationDone && restorationFinaleIdRef.current != null && openingGlow.finaleLandedId === restorationFinaleIdRef.current) finishIslandRestoration();
  }, [finishIslandRestoration, openingGlow.finaleLandedId, restorationDone]);
  const restorationCheckedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!islandRestoration || !restorationStore.state) return;
    const key = `${islandRestoration.campaign.campaignId}:${islandRestoration.level}`;
    if (restorationCheckedRef.current === key) return;
    restorationCheckedRef.current = key;
    if (restorationDefinition && restorationComplete(restorationDefinition, restorationStore.merges)) finishIslandRestoration();
  }, [finishIslandRestoration, islandRestoration, restorationDefinition, restorationStore.merges, restorationStore.state]);
  const lastRestorationKeyRef = useRef<string | null>(null);
  useEffect(() => {
    // The board's store goes with the chapter once its restoration is done.
    const key = islandRestoration ? restorationStorageKey(islandRestoration.campaign.campaignId, islandRestoration.level) : null;
    if (!key && lastRestorationKeyRef.current) clearMission(lastRestorationKeyRef.current);
    lastRestorationKeyRef.current = key;
  }, [islandRestoration]);

  useEffect(() => {
    if (!screenFocused || pendingIslandDiscovery
      || interactionCreatureId || selectedUpgrade || upgradePresentation || requiredUpgradeStory || ordinaryUpgradeRun) return;
    const active = activeIslandCampaign(mergeWorld);
    if (!active) return;
    const { campaign, chapter, status } = active;
    // Not `mergeWorld.revision`: that bumps on every command in the game,
    // including ones that have nothing to do with this campaign (an energy
    // tick, an unrelated merge). Keying on it meant the guard reset itself
    // the instant anything else happened — including mid-conversation — so
    // the same narrative could get torn down and reopened before it ever
    // reached its own completion callback, and its chapter never actually
    // persisted as complete. `status` only changes when this chapter's own
    // progress does, which is the only thing that should ever re-arm this.
    if (status === 'return_ready') {
      const key = `return:${campaign.campaignId}:${chapter.level}:${status}`;
      if (campaignAutoTransitionRef.current === key) return;
      campaignAutoTransitionRef.current = key;
      if (chapter.level === 1) {
        // The first return is the gift beat: a full scene, then the free restoration.
        openIslandCampaignNarrative(campaign, chapter.level, 'return');
        return;
      }
      // Later returns land where the Glow is spent: the friend speaks on the island panel.
      returnPanelRef.current = `${campaign.campaignId}:${chapter.level}`;
      void acknowledgeStoredIslandCampaignChapterReturn(campaign.campaignId, chapter.level).catch(() => { returnPanelRef.current = null; });
      return;
    }
    if (status === 'restoration_ready' && chapter.restoration) {
      // The beds are full and the stage was paid when they opened: the island grows on its own.
      const offer = upgradeOffers.find((candidate) => candidate.id === `nature:${campaign.islandId}` && candidate.nextLevel === chapter.level && candidate.eligible);
      const key = `restore-board:${campaign.campaignId}:${status}`;
      if (!offer || campaignAutoTransitionRef.current === key) return;
      campaignAutoTransitionRef.current = key;
      void purchaseWorldUpgrade(offer, { beforeValidation: flushMergeWorld }).catch((error) => {
        campaignAutoTransitionRef.current = null;
        setUpgradeError(error instanceof Error ? error.message : 'The garden restoration paused.');
      });
      return;
    }
    if (status === 'restoration_ready' && returnPanelRef.current === `${campaign.campaignId}:${chapter.level}`) {
      returnPanelRef.current = null;
      const offer = upgradeOffers.find((candidate) => candidate.id === `nature:${campaign.islandId}` && candidate.nextLevel === chapter.level);
      if (offer) void openUpgradeOfferRef.current?.(offer);
      return;
    }
    if (chapter.level === 1 && status === 'restoration_ready') {
      const offer = upgradeOffers.find((candidate) => candidate.id === `nature:${campaign.islandId}` && candidate.nextLevel === 1 && candidate.eligible);
      const key = `restore:${campaign.campaignId}:${status}`;
      if (!offer || campaignAutoTransitionRef.current === key) return;
      campaignAutoTransitionRef.current = key;
      void purchaseWorldUpgrade(offer, { beforeValidation: flushMergeWorld }).catch((error) => {
        campaignAutoTransitionRef.current = null;
        setUpgradeError(error instanceof Error ? error.message : 'The garden restoration paused.');
      });
      return;
    }
    if (status === 'resolution_ready') {
      const key = `resolution:${campaign.campaignId}:${chapter.level}:${status}`;
      if (campaignAutoTransitionRef.current === key) return;
      campaignAutoTransitionRef.current = key;
      openIslandCampaignNarrative(campaign, chapter.level, 'resolution');
    }
  }, [flushMergeWorld, interactionCreatureId, mergeWorld, openIslandCampaignNarrative, ordinaryUpgradeRun,
    pendingIslandDiscovery, requiredUpgradeStory, screenFocused, selectedUpgrade, upgradeOffers, upgradePresentation]);

  // Mossprout's wish plays once Steppling's garden lesson is over: a blocking
  // full-screen scene, then a guided walk to the first mist. Both phases are
  // durable (`kingdomGoal.introducedAt`, `kingdomGoal.coachmarkSeenAt`), so a
  // relaunch resumes exactly where the player left off.
  const stepplingLessonDone = stepplingLesson.ready
    && (stepplingLesson.run ? stepplingLesson.run.status === 'completed' : stepplingShoeServed(mergeWorld));
  const kingdomGoalWanted = screenFocused && stepplingLessonDone && !kingdomGoal?.introducedAt
    && loadFtueRun()?.status === 'complete' && glowRun?.status === 'completed'
    && !sharedUpgrade && !upgradePresentation && !requiredUpgradeStory && !stepplingEggOpen && !pendingIslandDiscovery;
  // Steppling's page has to be gone before the wish, not behind it. Two
  // full-screen sheets that swap in the same frame can leave the second one
  // unpresented, and his ordinary greeting would otherwise speak over the
  // farewell he just finished. So the lesson's end closes him first.
  const stepplingGoalHandoffPending = Boolean(kingdomGoalWanted && (interactionCreatureId || activeInteractionResidentId));
  const kingdomGoalPending = kingdomGoalWanted && !stepplingGoalHandoffPending;
  useEffect(() => {
    if (!stepplingGoalHandoffPending) return;
    requestResidentInteractionExit();
  }, [requestResidentInteractionExit, stepplingGoalHandoffPending]);
  // While guiding, the camera is locked and only the first mist's marker answers
  // taps — so never guide unless that marker is actually there to be tapped.
  const goalIslandOffer = goalIslandId
    ? upgradeOffers.find((offer) => offer.id === `nature:${goalIslandId}` && offer.eligible) ?? null
    : null;
  const kingdomGoalGuideActive = Boolean(screenFocused && kingdomGoal?.introducedAt && kingdomGoal.coachmarkSeenAt == null && goalIslandOffer
    && !interactionCreatureId && !activeInteractionResidentId && !stepplingEggOpen && !upgradePresentation && !requiredUpgradeStory && !ordinaryUpgradeRun);
  const goalFocusStartedRef = useRef(false);
  useEffect(() => {
    if (!kingdomGoalGuideActive) { goalFocusStartedRef.current = false; return; }
    if (goalFocusStartedRef.current || focusIslandId || !goalIslandId) return;
    goalFocusStartedRef.current = true;
    focusReasonRef.current = 'goal';
    setFocusIslandId(goalIslandId);
  }, [focusIslandId, goalIslandId, kingdomGoalGuideActive]);
  useEffect(() => {
    // The hint never waits on the camera reporting back; the marker is tappable regardless.
    if (!kingdomGoalGuideActive || goalCoachmarkArmed) return;
    const timer = setTimeout(() => setGoalCoachmarkArmed(true), reduceMotion ? 200 : 1400);
    return () => clearTimeout(timer);
  }, [goalCoachmarkArmed, kingdomGoalGuideActive, reduceMotion]);
  const finishKingdomGoalScene = useCallback(() => {
    // Leave Steppling's page so the guide can frame the first mist.
    if (interactionCreatureIdRef.current) requestResidentInteractionExit();
  }, [requestResidentInteractionExit]);
  const completeIslandFocus = useCallback(() => {
    setFocusIslandId(null);
    if (focusReasonRef.current === 'goal') setGoalCoachmarkArmed(true);
    focusReasonRef.current = null;
  }, []);
  const showIslandFromTracker = useCallback((islandId: MossproutNatureIslandId) => {
    setProgressSheetOpen(false);
    setWakeHandoffCampaign(null);
    focusReasonRef.current = 'tracker';
    setFocusIslandId(islandId);
  }, []);
  const followKingdomNext = useCallback((next: KingdomNext) => {
    if (next.kind === 'merge') { setProgressSheetOpen(false); openGarden(undefined, 'mossprout'); return; }
    if (next.islandId) showIslandFromTracker(next.islandId);
    else setProgressSheetOpen(false);
  }, [openGarden, showIslandFromTracker]);
  useEffect(() => {
    if (!screenFocused) { stepplingLessonOpening.current = false; return; }
    if (!stepplingLesson.active || !stepplingLesson.run || !havenMergeBoardActive) return;
    if (STEPPLING_FINALE_NODE_IDS.includes(stepplingLesson.run.nodeId)) {
      const resident = companionSlots.find((slot) => slot.kind === 'owned' && slot.familyId === 'steppling');
      if (resident?.kind === 'owned' && interactionCreatureId !== resident.creature.creatureId) selectResident(resident.creature.creatureId);
    } else if (!activeInteractionResidentId && !stepplingLessonOpening.current) {
      stepplingLessonOpening.current = true;
      openGarden(undefined, 'steppling');
    }
  }, [screenFocused, stepplingLesson.active, stepplingLesson.run, havenMergeBoardActive, companionSlots, interactionCreatureId, activeInteractionResidentId, selectResident, openGarden]);

  const openUpgradeOffer = useCallback(async (offer: WorldUpgradeOffer) => {
    if (upgradePressBusy.current || upgradePurchasing || upgradePresentation) return;
    // Resting friends are on the map from the first frame, but not yet the player's business.
    if (offer.sleepingSkinId && ftueStepId) return;
    // A friend mid-restoration: the marker is the board, not a panel about the board.
    if (restorationCampaignId && islandCampaignForOffer(offer.id)?.campaignId === restorationCampaignId) {
      setRestorationOpen(true);
      return;
    }
    upgradePressBusy.current = true;
    setUpgradeError(null); setUpgradeCommitted(false);
    try {
      if (ftueStepId === 'world.first_bloom_offer') await advanceFtueActionDurably({ expectedStepId: ftueStepId, actionId: 'world.open_first_bloom_upgrade' });
      if (offer.id === 'mist:steppling-home' && glowRun && glowRun.status !== 'completed') {
        // The bubble opens the mission board under the tile, never a purchase sheet.
        await advanceGlowUpgrade('open');
        setSelectedUpgrade(null);
        return;
      }
      if (ftueStepId === 'haven.mossprout.restore') ftueRestoreStartedRef.current = true;
      if (goalIslandIdRef.current && offer.id === `nature:${goalIslandIdRef.current}` && mergeWorldRef.current.kingdomGoal?.introducedAt
        && mergeWorldRef.current.kingdomGoal.coachmarkSeenAt == null) {
        setGoalCoachmarkArmed(false);
        void acknowledgeStoredKingdomGoalCoachmark().catch(() => undefined);
      }
      setSelectedUpgrade(offer);
    } catch (error) { setSelectedUpgrade(offer); setUpgradeError(error instanceof Error ? error.message : 'Could not open the upgrade. Please try again.'); }
    finally { upgradePressBusy.current = false; }
  }, [ftueStepId, glowRun, restorationCampaignId, upgradePresentation, upgradePurchasing]);
  openUpgradeOfferRef.current = openUpgradeOffer;
  const handleUpgradeOfferPress = useCallback((offer: WorldUpgradeOffer) => {
    void openUpgradeOffer(offer);
  }, [openUpgradeOffer]);
  const setUpgradeMarkerNode = useCallback((id: string, node: View | null) => {
    if (id === 'haven:mossprout') registerFtueTarget('upgrade:mossprout', node);
    if (id === 'mist:steppling-home') registerFtueTarget('upgrade:steppling', node);
    if (goalIslandIdRef.current && id === `nature:${goalIslandIdRef.current}`) {
      goalMarkerRef.current = node;
      setGoalMarkerRevision((revision) => revision + 1);
    }
  }, [registerFtueTarget]);
  const confirmWorldUpgrade = useCallback(async () => {
    if (!sharedUpgrade || upgradePressBusy.current || (upgradeCommitted && !upgradeError)) return;
    upgradePressBusy.current = true; setUpgradePurchasing(true); setUpgradeCommitted(true); setUpgradeError(null);
    const reward = worldUpgradeStory(sharedUpgrade.id, sharedUpgrade.nextLevel)?.rewardSkinId;
    pendingUpgradeReward.current = reward && !Object.values(mergeWorldRef.current.upgradeSkinGrants ?? {}).some((grant) => grant.skinId === reward)
      && !mergeWorldRef.current.ownedKatchimeraCards.some((card) => card.cardId === reward) ? reward : null;
    try {
      if (sharedUpgrade.id === 'mist:steppling-home' && glowRun && glowRun.status !== 'completed') {
        const run = await advanceGlowUpgrade('confirm');
        if (run.status === 'completed' || ['gateway.egg', 'egg.enter'].includes(run.nodeId)) { setSelectedUpgrade(null); setUpgradeCommitted(false); }
      } else if (ftueStepId === 'world.first_bloom_restore') {
        await advanceFtueActionDurably({ expectedStepId: ftueStepId, actionId: 'world.restore_with_first_bloom', nextStepId: ftueStepId, evidenceRef: 'shared-upgrade:confirm' });
      } else {
        const run = await purchaseWorldUpgrade(sharedUpgrade, { beforeValidation: flushMergeWorld });
        if (run?.status === 'failed_recoverable') throw new Error('The upgrade could not finish. Try again.');
        if (run?.status === 'completed') setSelectedUpgrade(null);
      }
    } catch (error) { setDisplayedGlow(mergeWorldRef.current.coins); setUpgradeError(error instanceof Error ? error.message : 'Could not upgrade. Please try again.'); setUpgradeCommitted(false); }
    finally { upgradePressBusy.current = false; setUpgradePurchasing(false); }
  }, [flushMergeWorld, ftueStepId, glowRun, sharedUpgrade, upgradeCommitted, upgradeError]);
  // Sleeping islands arrive from the offers layer already locked, in wake order.
  const presentedUpgradeOffers = upgradeOffers;
  // Alone until the hatch: no markers at all until the islands are drawn.
  const visibleUpgradeOffers = homeSoloForStep(ftueStepId) ? NO_UPGRADE_OFFERS : visibleWorldUpgradeOffers(presentedUpgradeOffers, ftueStepId, glowRun);

  // Mount the camera with its saved framing, rather than initializing the overview first.
  if (!glowReady || !stepplingLesson.ready) return null;

  return (
    <View collapsable={false} onLayout={onContentReady} ref={screenRef} style={styles.screen}>
      <KingdomHexCanvas
        background={background}
        cameraLocked={ftueLocksCamera(ftueStep) || glowDiscoveryLocksCamera(glowRun) || stepplingEncounter.open || stepplingLesson.active || kingdomGoalGuideActive || Boolean(selectedUpgrade) || Boolean(requiredUpgradeStory) || restorationBoardVisible}
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
        interactionNatureIslandId={pendingIslandCampaign?.campaign.islandId ?? null}
        preserveInteractionCameraOnExit={Boolean(pendingIslandCampaign)}
        interactionResidentAnchorY={ftueReturnResidentAnchorY}
        interactionResidentId={activeInteractionResidentId}
        mossproutMeditating={mossproutMeditating}
        interactionRewardPulseKey={pendingIslandCampaign ? 0 : interactionRewardPulseKey}
        gardenOrdersInteractive={false}
        initialTutorialCameraScale={initialFtueCameraScale}
        initialCameraSnapshot={initialCameraSnapshot}
        mossproutNatureIslandLevels={mergeWorld.haven.mossproutNatureIslands}
        mossproutNatureIslandReveals={Object.fromEntries(Object.keys(mergeWorld.haven.mossproutNatureIslandReveals).map((id) => [id, true]))}
        mossproutGarden={mossproutGardenScene}
        onCameraSnapshotChange={onCameraSnapshotChange}
        onCameraMotionChange={handleCameraMotionChange}
        onInteractionExitFocusComplete={closeResidentInteraction}
        onOpenGarden={openGarden}
        onGardenPlotTargetChange={setGardenPlotNode}
        onHomeTileTargetChange={setHomeTileNode}
        homeVeil={homeVeil}
        homeSolo={homeSoloForStep(ftueStepId)}
        openingWeather={homeVeil !== 'none'}
        sleepingMarkersInert={Boolean(ftueStepId)}
        onTileUpgradeOfferPress={beginFirstSeedPlanting}
        upgradeOffers={screenFocused && !activeInteractionResidentId && !interactionCreatureId && !stepplingEggOpen && !ordinaryUpgradeRun && !upgradeHandoffPending
          ? kingdomGoalGuideActive ? visibleUpgradeOffers.filter((offer) => offer.id === `nature:${goalIslandId}`) : visibleUpgradeOffers
          : []}
        selectedUpgradeOffer={selectedUpgrade}
        onDismissUpgrade={() => upgradeDismiss.current?.()}
        upgradePanel={screenFocused && sharedUpgrade && !upgradePresentation && !upgradeHandoffPending && !activeInteractionResidentId ? <WorldUpgradePanel
          offer={sharedUpgrade} world={mergeWorld} busy={upgradePurchasing || (upgradeCommitted && !upgradeError)}
          campaignState={islandCampaignPanelState}
          saveRead={saveUpgradeStoryRead}
          onCoachmarkChange={setUpgradeCoachmark} error={upgradeError} coached={coachedUpgrade} actionRef={upgradeActionRef} registerDismiss={registerUpgradeDismiss}
          onCampaignAction={islandCampaignPanelState?.actionLabel ? handleIslandCampaignPanelAction : undefined}
          onClose={() => { pendingUpgradeReward.current = null; setSelectedUpgrade(null); setUpgradeError(null); }} onConfirm={() => { void confirmWorldUpgrade(); }}
          onGarden={() => { openGarden(); }} /> : null}
        preserveUpgradeCamera={ftueGardenUpgradeActive || Boolean(pendingIslandCampaign)
          || (selectedUpgrade?.id === 'mist:steppling-home' && Boolean(glowRun && glowRun.status !== 'completed'))}
        upgradeSelectionCommitted={upgradeCommitted}
        upgradeFailed={Boolean(upgradeError)}
        onUpgradeOfferPress={handleUpgradeOfferPress}
        onUpgradeOfferTargetChange={setUpgradeMarkerNode}
        onTileUpgradeOfferTargetChange={setGardenWorldOfferNode}
        onSelectHome={() => {}}
        onSelectLocked={(familyId) => {
          if (kingdomGoalGuideActive) return;
          if (!ftueStep || ftueStep.surface !== 'haven') setLockedHintVisible(true);
        }}
        onSelectNatureIsland={(islandId) => {
          if (ftueStep?.surface === 'haven') return;
          if (kingdomGoalGuideActive && islandId !== goalIslandId) return;
          if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const offer = presentedUpgradeOffers.find((candidate) => candidate.id === `nature:${islandId}`);
          if (offer?.lockedReason) {
            void openUpgradeOffer(offer);
            return;
          }
          if (offer) void openUpgradeOffer(offer);
          else { const archive = worldUpgradeArchiveOffer(mergeWorld, `nature:${islandId}`); if (archive) setSelectedUpgrade(archive); }
        }}
        focusNatureIslandId={focusIslandId}
        onFocusNatureIslandComplete={completeIslandFocus}
        onSelectMemoryPlant={kingdomGoalGuideActive ? undefined : setSelectedMemoryPlantId}
        onGatewayTargetChange={setGatewayNode}
        onNatureIslandTargetChange={setNatureIslandTileNode}
        soloLayerId={soloLayerId}
        soloOfferId={soloOfferId}
        storyOperationsEnabled={screenFocused && !activeInteractionResidentId && !interactionExiting}
        onSelectGateway={() => {
          if (kingdomGoalGuideActive) return;
          if (gatewayState === 'egg' && !glowDiscoveryLocksCamera(glowRun)) {
            setFtueCameraSettled(false);
            setGlowPanelOpen(false);
            void stepplingEncounter.enter();
            return;
          }
          if (glowRun && glowDiscoveryMissionNode(glowRun.nodeId)) return;
          const offer = upgradeOffers.find((candidate) => candidate.id === 'mist:steppling-home');
          if (offer && (!glowRun || GLOW_GATEWAY_NODE_IDS.includes(glowRun.nodeId))) { void openUpgradeOffer(offer); return; }
          setGlowPanelOpen(true);
          void startGlowDiscovery().catch((error) => console.warn('The path could not open', error));
        }}
        onSelectResident={(creatureId) => {
          if (glowDiscoveryLocksCamera(glowRun) || kingdomGoalGuideActive) return;
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
      {!activeInteractionResidentId && !interactionCreatureId && !stepplingSurfaceOpen && !upgradePresentation && !navigationLocked && !kingdomGoalGuideActive && !kingdomGoalPending && !sharedUpgrade && (!ftueStepId || ftueStepId === 'companion.meditating') ? <View style={{ position: 'absolute', left: 16, bottom: Math.max(insets.bottom, 12) + 10, zIndex: 30 }}>
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
      {ftueGardenUpgradeActive || seedPlantingFtueActive || Boolean(selectedUpgrade) || Boolean(upgradePresentation && !upgradePresentation.veilLift)
        || (!upgradePresentation && (!ftueStepId || ftueStepId === 'companion.meditating')) ? (
        <Animated.View entering={FadeIn.duration(reduceMotion ? 100 : 360)} pointerEvents="box-none" style={[styles.topHudLayer, { top: insets.top + 3 }, ftueGardenUpgradeActive && { zIndex: 90 }]}>
          <GameHudBar
            leading={ftueGardenUpgradeActive || seedPlantingFtueActive || upgradePresentation || kingdomGoalGuideActive
              // The lesson owns Back only while it has a surface up. Hiding it
              // for an active run with nothing on screen strands the player.
              || (stepplingLesson.active && Boolean(interactionCreatureId)) ? undefined : <KatchimeraBackButton
              accessibilityHint={restorationBoardVisible ? 'Puts the restoration board away' : interactionCreatureId ? "Returns to this Katchimera's world" : 'Returns to the Katchimera world map'}
              accessibilityLabel={restorationBoardVisible ? 'Put the board away' : interactionCreatureId ? 'Exit interaction' : 'All Havens'}
              compact
              disabled={stepplingEncounter.busy || stepplingEncounter.hatching || interactionExiting || (!interactionCreatureId && (navigationLocked || glowDiscoveryLocksCamera(glowRun)))}
              onPress={stepplingEncounter.open ? stepplingEncounter.close : restorationBoardVisible ? closeRestoration : interactionCreatureId ? requestResidentInteractionExit : onBackToHavenSelector}
            />}
            content={kingdomGoal?.introducedAt && !kingdomGoalGuideActive && !ftueStepId && !stepplingLesson.active && !upgradePresentation && !interactionCreatureId && !stepplingEncounter.open
              ? <View style={styles.progressPill}><KingdomProgressPill progress={progressSummary} onPress={() => setProgressSheetOpen(true)} /></View>
              : <View />}
            trailing={<GameCurrencyHud balances={[{
              animateValue: Boolean(upgradePresentation?.showCoins && upgradePresentation.coinCost > 0) || Boolean(glowSpend?.counting),
              art: GAME_CURRENCY_ART.coins,
              artTargetRef: glowCurrencyArtRef,
              id: 'coins',
              value: displayedGlow,
              valueAnimationDurationMs: reduceMotion ? 180 : 650,
            }]} style={styles.currencyHud} tone="glass" />}
            density="compact"
            style={styles.topHud}
            tone="glass"
          />
        </Animated.View>
      ) : null}
      {!stepplingSurfaceOpen && !upgradePresentation && !activeInteractionResidentId && !kingdomGoalGuideActive && !sharedUpgrade && havenMergeBoardActive && mossproutFtueShowsWorldGarden(ftueStepId) && !gardenWorldBottomCtaActive ? (
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
              accessibilityLabel="Open Merge"
              accessibilityRole="button"
              disabled={navigationLocked && !glowDiscoveryAllowsGarden(glowRun) && !['world.garden_handoff', 'world.seed_planted'].includes(ftueStepId ?? '')}
              onPress={['world.garden_handoff', 'world.seed_planted'].includes(ftueStepId ?? '') ? onFtueOpenGarden : () => {
                if (glowScene?.view.kind === 'garden') {
                  void submitGlowAction(glowScene.actionId).then((run) => { if (run?.status === 'active') openGarden(); }).catch((error) => console.warn('The Garden could not open', error));
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
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
      {interactionCreatureId && !stepplingGoalHandoffPending ? (
        <View
          accessibilityElementsHidden={!interactionCameraReady || interactionExiting}
          importantForAccessibility={interactionCameraReady && !interactionExiting ? 'auto' : 'no-hide-descendants'}
          pointerEvents={interactionCameraReady && !interactionExiting ? 'auto' : 'none'}
          style={[styles.companionOverlay, (!interactionCameraReady || interactionExiting) && styles.companionOverlayPreparing]}>
          <KatchimeraCompanionRouteScreen
            creatureId={interactionCreatureId}
            ftueConversationDefinitionId={hostedInteractionRequest?.ftueConversationDefinitionId}
            hostedInHaven
            hostedNarrativeRequired={Boolean(pendingIslandCampaign)}
            journeyReturnConversationDefinitionId={hostedInteractionRequest?.journeyReturnConversationDefinitionId}
            onHostedClose={requestResidentInteractionExit}
            onHostedInitialConversationComplete={completeIslandCampaignConversation}
            onHostedFtueComplete={closeResidentInteraction}
            onHostedOpenMerge={interactionHasGarden ? openGarden : undefined}
            onVisibleCreatureRewardPulse={pendingIslandCampaign ? undefined : pulseVisibleResident}
            residentStoryResumeRequested={hostedInteractionRequest?.residentStoryResumeRequested}
            reuseUnderlyingStage
            source={hostedInteractionRequest?.source}
          />
        </View>
      ) : null}
      {interactionCreatureId && !stepplingGoalHandoffPending && !interactionCameraReady && !interactionExiting && interactionLoadingVisible ? (
        <View accessibilityLabel="Preparing Katchimera interaction" accessibilityLiveRegion="polite" pointerEvents="none" style={styles.interactionLoading}>
          <ActivityIndicator color="#FFF4C7" size="small" />
        </View>
      ) : null}
      {screenFocused && !activeInteractionResidentId && (!ftueStepId || glowGatewayActive) && !upgradePresentation && !stepplingEggOpen && glowRun?.status !== 'completed' && glowPanelOpen && (ftueCameraSettled || glowRun?.status === 'failed_recoverable') && !mistUpgradeActive && !sharedUpgrade && glowGatewayActive && (glowRun?.status === 'failed_recoverable' || (glowScene && glowScene.view.kind !== 'garden') || glowRun?.nodeId.startsWith('lesson.')) ? <GlowGatewayGuide
        world={mergeWorld}
        onClose={() => setGlowPanelOpen(false)}
        onOpenMerge={() => openGarden()}
      /> : null}
      {screenFocused && sharedUpgrade && upgradeCoachmark.visible && !upgradePresentation && !requiredUpgradeStory && !activeInteractionResidentId ? <CompanionFtueCoachmark
        targetRef={upgradeActionRef} targetRevision={upgradeCoachmark.revision} placement="above" showFinger
        message={[{ text: `Use ${sharedUpgrade.cost} ` }, { emphasis: true, text: 'Glow' }, { text: sharedUpgrade.action === 'Clear mist' ? ' to clear this mist.' : ' to restore the Garden.' }]} /> : null}
      {screenFocused && goalCoachmarkArmed && kingdomGoal?.introducedAt && kingdomGoal.coachmarkSeenAt == null && goalIslandId
        && !sharedUpgrade && !upgradePresentation && !requiredUpgradeStory && !activeInteractionResidentId && !interactionCreatureId ? <CompanionFtueCoachmark
        targetRef={goalMarkerRef} targetRevision={goalMarkerRevision} placement="above" showFinger
        message={[{ text: 'Someone is waiting beyond this mist.' }]} /> : null}
      {kingdomGoalPending ? <KingdomGoalScene onDone={finishKingdomGoalScene} /> : null}
      {screenFocused && requiredUpgradeStory ? <WorldUpgradeNarrative key={requiredUpgradeStory.presentation.storyPresentationKey ?? requiredUpgradeStory.presentation.nonce}
        offer={requiredUpgradeStory.offer} world={mergeWorld} required saveRead={saveUpgradeStoryRead}
        onClose={() => finishUpgradePresentation(requiredUpgradeStory.presentation)} /> : null}
      {screenFocused && pendingIslandDiscovery && !activeInteractionResidentId && !sharedUpgrade && !upgradePresentation && !requiredUpgradeStory ? <KatchimeraFriendDiscoveryReveal
        actionLabel={pendingIslandDiscovery.campaign.copy.discoveryActionLabel}
        dialogue={pendingIslandDiscovery.campaign.copy.discoveryDialogue}
        onContinue={() => { void continueFromIslandDiscovery(pendingIslandDiscovery.campaign); }}
        residentId={pendingIslandDiscovery.campaign.residentSkinId}
      /> : null}
      <KatchimeraCardRevealModal
        cardId={screenFocused && !sharedUpgrade && !upgradePresentation && !requiredUpgradeStory ? revealedFriendCardId : null}
        cards={mossproutCards}
        onDone={() => {
          setUpgradeReward(null);
          if (pendingIslandCardReveal) {
            void acknowledgeStoredIslandCampaignResidentCardReveal(pendingIslandCardReveal.campaign.campaignId);
            // The friend who just came home points at whoever is resting next.
            if (nextOpenIsland(mergeWorldRef.current)) setWakeHandoffCampaign(pendingIslandCardReveal.campaign);
          }
        }}
      />
      {screenFocused && progressSheetOpen && !sharedUpgrade && !upgradePresentation ? <KingdomProgressSheet
        progress={progressSummary}
        onClose={() => setProgressSheetOpen(false)}
        onNext={followKingdomNext}
      /> : null}
      {screenFocused && wakeHandoffCampaign && !pendingIslandCardReveal && !sharedUpgrade && !upgradePresentation && !interactionCreatureId && goalIslandId ? <IslandWakeHandoffSheet
        campaign={wakeHandoffCampaign}
        nextIslandId={goalIslandId}
        onClose={() => setWakeHandoffCampaign(null)}
        onShow={showIslandFromTracker}
      /> : null}
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
      {havenOpeningActive && ftueStep && !activeInteractionResidentId && ftueStepId !== 'world.first_bloom_restore'
        && ftueStepId !== OPENING_MIST_OPEN_STEP_ID && ftueStepId !== OPENING_MIST_CLEAR_STEP_ID ? (
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
              : gardenWorldGuidanceActive || ftueStepId === 'world.egg_intro' || ftueStepId === OPENING_MIST_LIFT_STEP_ID
              ? { top: insets.top + 18 }
              : { bottom: Math.max(insets.bottom, 12) + 12 },
          ]}>
          <View collapsable={false} pointerEvents="none" ref={setHavenGuideNode} style={styles.discoveryCallout}>
            <FtueGuideCopy guide={ftueStep.guide} hero />
          </View>
          {!['world.mist_lift', 'world.egg_intro', 'world.garden_arrival', 'world.garden_handoff', 'world.first_bloom_offer', 'world.first_bloom_restore'].includes(ftueStepId ?? '')
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
      {ftueStepId === OPENING_MIST_OPEN_STEP_ID && ftueStep && screenFocused ? <KingdomOpeningCaption
        step={ftueStep} bottomInset={insets.bottom} onLookCloser={advanceOpening} /> : null}
      {openingBoardActive && ftueStep && mission.state ? <KingdomOpeningMergeDock
        run={openingRun} step={ftueStep} state={mission.state} send={mission.send} width={window.width} bottomInset={insets.bottom}
        impactKey={openingGlow.landed} onGlow={openingGlow.launch} onFinale={openingGlow.launchFinale} onBoardMetrics={setOpeningBoardMetrics} onBlockedInteraction={bumpOpeningBlocked}
        onEntranceSettled={markOpeningDockSettled} /> : null}
      {openingGuidanceVisible && ftueCameraSettled && openingDockSettled ? <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: FTUE_SCENE_LAYERS.spotlight }]}>
        <MergeFtueOverlay blockedPulseNonce={openingBlockedNonce} boardMetrics={openingBoardMetrics} cue={openingBoardStep?.cue ?? null} guide={openingBoardStep?.guide ?? null}
          layoutNonce={openingProgress} railTargetRefs={openingRailRefs} screenRef={screenRef} spotlight={openingBoardStep?.spotlight ?? null} state={mission.state ?? mergeWorld} targetRevision={openingProgress} />
      </View> : null}
      {stepplingMissionActive && stepplingMission.state ? <StepplingMissionDock
        state={stepplingMission.state} send={stepplingMission.send} merges={stepplingMission.merges} mergesRef={stepplingMission.mergesRef} width={window.width} bottomInset={insets.bottom}
        impactKey={openingGlow.landed} onGlow={openingGlow.launch} onFinale={launchStepplingFinale} onBoardMetrics={setOpeningBoardMetrics} onBlockedInteraction={bumpOpeningBlocked}
        onEntranceSettled={markOpeningDockSettled} /> : null}
      {stepplingMissionActive && stepplingMission.state && stepplingMissionGuidanceVisible && openingDockSettled ? <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: FTUE_SCENE_LAYERS.spotlight }]}>
        <MergeFtueOverlay blockedPulseNonce={openingBlockedNonce} boardMetrics={openingBoardMetrics} cue={stepplingMissionStep?.cue ?? null} guide={stepplingMissionStep?.guide ?? null}
          layoutNonce={stepplingMission.state.revision} railTargetRefs={openingRailRefs} screenRef={screenRef} spotlight={stepplingMissionStep?.spotlight ?? null} state={stepplingMission.state} targetRevision={stepplingMission.state.revision} />
      </View> : null}
      {restorationBoardVisible && islandRestoration && restorationStore.state ? <IslandRestorationDock
        campaign={islandRestoration.campaign} level={islandRestoration.level} state={restorationStore.state} send={restorationStore.send} boardStep={restorationStep}
        merges={restorationStore.merges} mergesRef={restorationStore.mergesRef} width={window.width} bottomInset={insets.bottom}
        order={restorationOrder} orderServed={restorationOrderServed} pendingDeliveries={restorationPendingDeliveries} onOpenOrder={openRestorationOrder} onPlaceDelivery={placeRestorationDelivery}
        railTargetRefs={openingRailRefs}
        impactKey={openingGlow.landed} onMerge={openingGlow.launchItem} onFinale={launchRestorationFinale} onBoardMetrics={setOpeningBoardMetrics} onBlockedInteraction={bumpOpeningBlocked}
        onEntranceSettled={markOpeningDockSettled} onClose={closeRestoration} /> : null}
      {restorationCheckpointHint && restorationHintArmed ? <Pressable accessibilityRole="button" accessibilityLabel="Dismiss the hint" onPress={dismissRestorationHint}
        style={[StyleSheet.absoluteFill, { zIndex: RESTORATION_HINT_CATCHER_Z }]} /> : null}
      {restorationCheckpointHint && restorationOrder && restorationStore.state && openingDockSettled ? <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: FTUE_SCENE_LAYERS.spotlight }]}>
        <MergeFtueOverlay blockedPulseNonce={openingBlockedNonce} boardMetrics={openingBoardMetrics}
          cue={{ kind: 'tap', target: { kind: 'order_card', orderId: restorationOrder.id } }}
          guide={{ eyebrow: 'Requested in Merge', title: 'This patch has given all it had.', body: 'Serve Petalimp’s request on the Merge board, then come back: what you bring frees what the mist still holds.' }}
          layoutNonce={restorationStore.state.revision} railTargetRefs={openingRailRefs} screenRef={screenRef}
          spotlight={{ targets: [{ kind: 'order_card', orderId: restorationOrder.id }], grouping: 'bounding_rect', padding: 8, radius: 18, dimOpacity: 0.58 }}
          state={restorationStore.state} targetRevision={restorationStore.state.revision} />
      </View> : null}
      {openingGlow.flights.length || openingGlow.impacts.length ? <OpeningGlowLayer flights={openingGlow.flights} impacts={openingGlow.impacts}
        onArrive={openingGlow.arrive} onImpactDone={openingGlow.impactDone} screenRef={screenRef} /> : null}
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
            {characterId === 'mossprout' && currentStage >= 1 && !ftueStepId ? <KatchaButton fullWidth label="Garden story & history" variant="secondary" onPress={() => {
              const archive = worldUpgradeArchiveOffer(mergeWorld, 'haven:mossprout');
              if (archive) { setDetailCreatureId(null); setSelectedUpgrade({ ...archive, currentLevel: currentStage }); }
            }} /> : null}
            {characterId === 'steppling' && mergeWorld.worldUnlocks?.['mossprout:overgrown-trail'] && !ftueStepId ? <KatchaButton fullWidth label="Clearing story & history" variant="secondary" onPress={() => {
              const archive = worldUpgradeArchiveOffer(mergeWorld, 'mist:steppling-home');
              if (archive) { setDetailCreatureId(null); setSelectedUpgrade(archive); }
            }} /> : null}
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
      {ftueStepId === OPENING_MIST_OPEN_STEP_ID ? <FtueOpeningFade /> : null}
      {screenFocused && ftueCameraSettled && glowRun?.status === 'active' && glowScene?.view.kind === 'garden' && !activeInteractionResidentId && !upgradePresentation ? (
        <View collapsable={false} ref={setHavenGuideNode} pointerEvents="none" style={{ position: 'absolute', right: 115, bottom: Math.max(insets.bottom, 12) + 30, width: Math.min(250, window.width - 131), zIndex: 85 }}>
          <MergeFtueEggGuide hideAvatar inlineWidth={Math.min(250, window.width - 131)}
            anchor={{ x: 0, y: 0, width: 0, height: 0 }} screen={window}
            guide={{ eyebrow: '', title: 'Tap Merge.', body: 'Merge to earn Glow and clear the mist!' }} />
        </View>
      ) : null}
      {screenFocused && ftueCameraSettled && glowRun?.status === 'active' && !sharedUpgrade && !GLOW_GATEWAY_NODE_IDS.includes(glowRun.nodeId) && glowPanelOpen && glowWorldTarget && !activeInteractionResidentId && !upgradePresentation ? <HavenFtueOverlay
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
  progressPill: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  gardenButton: {
    height: 99,
    width: 99,
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
