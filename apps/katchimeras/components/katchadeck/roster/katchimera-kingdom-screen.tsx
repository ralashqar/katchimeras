import { sanctuaryFounded } from '@/constants/heart-tree';
import { FIRST_GOAL_COACH_ID, goalNeed, type GoalNeedSource } from '@/features/sanctuary/goal-need';
import type { SanctuaryChapterState } from '@/constants/sanctuary-chapters';
import type { MergeWorldCommand } from '@/types/merge-world';
import { cafeDropProfile, cafeMealsBonus, kitchenCrateMealsBonus } from '@/constants/hero-buildings';
import { battleLoadout, withPartner } from '@/features/encounter/team';
import { BARISTABBIT_HATCHABLE } from '@/constants/hatchable-companions/baristabbit';
import { loadWispState } from '@/utils/wisp-storage';
import { heartwoodStage, gardenSupplyStatus } from '@/features/shared-adventure/heartwood-progression';
import { HeartwoodRoad } from '@/components/katchadeck/world/heartwood-road';
import { WispLanternPanel, WispLanternWorld } from '@/components/katchadeck/wisps/wisp-lantern';
import { WispLanternUpgradePanel } from '@/components/katchadeck/wisps/wisp-lantern-upgrade-panel';
import { HeartwoodBuildingPanel } from '@/components/katchadeck/world/heartwood-building-panel';
import { KatchimeraUpgradePanel } from '@/components/katchadeck/world/katchimera-upgrade-panel';
/** The campaign pivot removed the Merge page: nothing on the Haven leads to it. */
const MERGE_PAGE_REMOVED = true;

/** The synthetic marker on Mossprout's own tile: the Grove's levels, then today's Daily Mist. */
const HOME_TRACK_OFFER_ID = 'track:home';

/**
 * Every friend's island marker shows its level track (levels cleared of all), and Mossprout's tile gets one marker
 * for the Grove (or, once it is done, today's Daily Mist). Sleeping islands keep their silhouette; the first
 * session shows none of it.
 */
function withTrackBadges(world: MergeWorldState, offers: readonly WorldUpgradeOffer[], afterFirstSession: boolean): WorldUpgradeOffer[] {
  if (!afterFirstSession) return [...offers];
  const badged = offers.map((offer) => {
    const campaign = offer.trial || offer.sleepingSkinId ? null : islandCampaignForOffer(offer.id);
    if (!campaign) return offer;
    const revealed = Boolean(world.haven.mossproutNatureIslandReveals[campaign.islandId] || (world.haven.mossproutNatureIslands[campaign.islandId] ?? 0) > 0);
    if (revealed && world.islandCampaigns?.[campaign.campaignId]?.discoveryRevealSeenAt == null) return offer;
    // Before the Sanctuary is founded a misted friend keeps the marker it had (the chapters are what point at them).
    if (!revealed && !sanctuaryFounded(world)) return offer;
    const track = islandTrack(world, campaign);
    return { ...offer, track: { kind: 'island' as const, cleared: track.cleared, total: track.total, label: `${track.cleared}/${track.total}` }, eligible: true, affordable: true, missingGlow: 0, lockedReason: undefined };
  });
  const grove = groveTrack(world, { ftueComplete: true });
  const home = grove.cleared < grove.total ? grove : dailyMistUnlocked(world) ? dailyTrack(world, localDayId(new Date(gameNow()))) : null;
  if (!home || ((world.haven.tileStages.mossprout ?? 0) < 1 && !sanctuaryFounded(world))) return badged;
  // Framed as Mossprout's own restore marker is: over his garden.
  return [...badged, {
    id: HOME_TRACK_OFFER_ID, target: { kind: 'haven_tile' as const, familyId: 'mossprout' }, visualTarget: { kind: 'haven_structure' as const, structureId: 'mossprout-hex-garden' }, name: home.title, nextName: home.title, description: home.caption,
    nextLevel: 0, cost: 0, action: 'Upgrade', currentLevel: 0, maxLevel: 0, eligible: true, affordable: true, missingGlow: 0,
    track: { kind: home.kind, cleared: home.cleared, total: home.total, label: home.kind === 'daily' ? `${home.cleared}/${home.total} today` : `${home.cleared}/${home.total}` },
  }];
}
import { LevelTrackSheet } from '@/components/katchadeck/world/level-track-sheet';
import { dailyTrack, groveTrack, islandTrack, isMistLevel, type LevelNode } from '@/features/level-tracks/level-track';
import { claimStoredTrackMilestone, payStoredEncounterContinue } from '@/utils/merge-world/repository';
import { dailyMistUnlocked } from '@/features/encounters/daily-mist';
import type { RegionMissionDefinition } from '@/constants/island-campaigns/types';
import { recordEncounterBond } from '@/features/encounter/encounter-bond';
import { FriendWispsSheet } from '@/components/katchadeck/wisps/friend-wisps-sheet';
import { FRIEND_CONSTELLATIONS } from '@/constants/friend-wisp-constellations';
import { katchimeraFamilyById, katchimeraSkinById } from '@/constants/katchimera-skins';
import { useWisps } from '@/features/wisps/wisp-provider';
import { friendEquippedWisp, friendPacksWaiting } from '@/utils/friend-wisp-packs';
import { HeartwoodBuildingWorld } from '@/components/katchadeck/world/heartwood-building-world';
import { HEARTWOOD_BUILDINGS, heartwoodBuildingById, heartwoodBuildingCost, heartwoodBuildingLevel, type HeartwoodBuildingId } from '@/constants/heartwood-buildings';
import { FIRST_SEED_BUILDING_ID, firstSeedReadyForSpring, firstSpringAwake, firstSpringBuilt, heartwoodBuildingsEligible } from '@/features/heartwood-buildings/buildings-world';
import { COIN_FLIGHT_WINDOW_MS } from '@incubator/environments/upgrade-effects';
import { lanternEligible } from '@/features/wisps/lantern-world';
import { HeartwoodStoryScene } from '@/components/katchadeck/world/heartwood-story-scene';
import { needsHeartwoodRecap } from '@/features/shared-adventure/heartwood-opening';
import { loadCompanionContentState } from '@/utils/companion-content-storage';
import { companionInitialConversationCompletionReady } from '@/utils/companion-interaction';
import { worldEventActions, worldEventConversation, type WorldEventAction, type WorldEventSelection } from '@/features/live-ops/world-event-presentation';
import { availableLocalEvents } from '@/features/live-ops/local-catalog';
import { useHarmonyProgress } from '@/features/live-ops/use-harmony-progress';
import { companionConversationDefinitionById } from '@/constants/companion-conversations-v2';
import { plantStoredWispLantern, upgradeStoredWispLantern, upgradeStoredHeartwoodBuilding, ensureStoredFirstSpring, ensureStoredFirstSpringBuilt, ensureStoredFirstSpringLight, applyStoredAdventure, applyStoredLocalEvent , acknowledgeStoredIslandCampaignChapterReturn, acknowledgeStoredIslandCampaignResidentCardReveal, acknowledgeStoredIslandCampaignResidentDiscovery, activateStoredIslandCampaignChapter, completeStoredIslandCampaignChapter, completeStoredIslandRestoration, recordStoredIslandRestorationProgress, requestStoredIslandCampaignDelivery, saveUpgradeStoryRead, ensureStoredOpeningGlow , restoreStoredHeartTree, rescueStoredWorldFriend, revealStoredStoryTile, grantStoredStoryGlow, claimStoredChapterReward, completeStoredSupplyOrder, markStoredChapterOpened, upgradeStoredHeroBuilding, acknowledgeStoredKingdomGoalCoachmark, payStoredHatchableMission, claimStoredTimeTrialChest, recordStoredTimeTrialHeat, startStoredEncounter, abandonStoredEncounter, completeStoredEncounter, upgradeStoredKatchimera } from '@/utils/merge-world/repository';
import { canUpgradeKatchimera, isPlayableKatchimera, katchimeraLevel, PLAYABLE_KATCHIMERAS } from '@/constants/katchimera-progression';
import { encounterRunId } from '@/features/encounter/run-id';
import type { EncounterLoadout } from '@/types/encounter';
import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import type { EncounterLoadoutChoice } from '@/components/katchadeck/upgrade/upgrade-mission-rows';
import { LocalEventMissionDock } from '@/components/katchadeck/world/local-event-mission-dock';
import { WorldEventActionCard } from '@/components/katchadeck/world/world-event-action-card';
import { GardenEventAdornment } from '@/components/katchadeck/world/garden-event-adornment';
import { LocalWorldEvents } from '@/components/katchadeck/world/local-world-events';
import { HATCHABLE_COMPANIONS, hatchableByCompanion, hatchableByTile, STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/registry';
import { useMergeWorldActions } from '@/features/merge-world/merge-world-provider';
import { activeHatchableFor, completeHatchableMission, gardenLessonFor, resumeHatchableDiscovery, startHatchableDiscovery, submitHatchableAction, useHatchableRuns } from '@/features/onboarding/hatchable-runtime';
import { hatchableTicketReceiptId } from '@/constants/glow-discovery-ids';
import { companionHasPage } from '@/features/companion/companion-page-policy';
import { familyIdFromCompanionId } from '@/constants/katchimera-skins';
import { HATCHABLE_LESSON_FINALE_NODE_IDS, hatchableDiscoveryScene } from '@/features/onboarding/hatchable-flows';
import { homeSoloForStep, homeVeilForStep, isMossproutOpeningStep, MISSION_CAMERA_ANCHOR_Y, MISSION_CAMERA_ZOOM, OPENING_MERGE_REQUIRED, OPENING_CAMERA_ENTRY_ZOOM, OPENING_CAMERA_ZOOM, OPENING_CAMERA_ANCHOR_Y, OPENING_LIFTED_ACTION_ID, OPENING_MIST_CLEAR_STEP_ID, OPENING_MIST_LIFT_STEP_ID, OPENING_MIST_OPEN_STEP_ID, openingMistBoardStep, openingMistProgress } from '@/features/onboarding/opening-mist';
import { BoardSessionDim } from '@/components/katchadeck/world/board-session-dim';
import { KingdomOpeningMergeDock, MissionGlowLayer, OPENING_GLOW_FLIGHT_MS, useOpeningGlow } from '@/components/katchadeck/world/kingdom-opening-merge-dock';
import { HatchableMissionDock } from '@/components/katchadeck/world/hatchable-mission-dock';
import { completeJourneyMission, useJourneyConsequenceRuns } from '@/features/companion/journey-consequences';
import { activeJourneyMission, JOURNEY_CONSEQUENCES, journeyMissionResumeCamera } from '@/features/companion/journey-consequence-state';
import { journeyMissionOf } from '@/constants/companion-journey-chapters/consequence-flow';
import { storyTileById, storyTileStates } from '@/constants/story-tiles/registry';
import type { RewardFlightPoint } from '@/components/katchadeck/ui/reward-token-flight';
import { STEPPLING_MISSION_HINT_THEME } from '@/features/onboarding/steppling-mission';
import { missionWispTarget, useMistMission, WISP_FALL_MS } from '@/features/onboarding/use-mist-mission';
import { ISLAND_WISP_LINES, OPENING_WISP_LINES, OPENING_WISPS } from '@/features/onboarding/corruption-wisps';
import { missionWindow } from '@/features/mission-mechanics/board-window';
import { createMechanicState, mechanicComplete, mechanicProgress, resolveMechanic, type MissionMechanicHost } from '@/features/mission-mechanics/mechanic';
import { previewMissionStorageKey, resolveRestorationForPlay } from '@/features/mission-mechanics/preview';
import { useDevMissionMechanicPreview } from '@/hooks/use-dev-mission-mechanic-preview';
import type { MissionStrike } from '@/types/mission-mechanic';
import { MissionWisps, type CorruptionWispTarget } from '@/components/katchadeck/world/corruption-wisp-layer';
import { LastClearingColdOpen } from '@/components/katchadeck/world/last-clearing-cold-open';
import { LastClearingGuardian } from '@/components/katchadeck/world/last-clearing-guardian';
import { FIRST_BATTLE_ID, FIRST_BATTLE_XP, LOST_TRAIL_STONE_XP, FRONTIER_ACTION_ID, FRONTIER_LINES, FRONTIER_STEP_ID, FRONTIER_TITLE, GUARDIAN_STEP_ID, HEART_TREE_ACTION_ID, HEART_TREE_STEP_ID, LOST_TRACKS_ACTION_ID, LOST_TRACKS_STEP_ID, LOST_TRAIL_TILE_ID, SANCTUARY_ACTION_ID, SANCTUARY_LINE, SANCTUARY_STEP_ID, SANCTUARY_TITLE, LOST_TRAIL_STONE_STEP_IDS, LOST_TRAIL_STONE_BATTLE_IDS, LOST_TRAIL_STONES, LOST_TRAIL_EYEBROW, LOST_TRAIL_STONE_GLOW, STEPPLING_RESCUED_STEP_ID, STEPPLING_RESCUED_ACTION_ID, STEPPLING_MEETS_STEP_ID, STEPPLING_MEETS_ACTION_ID, STEPPLING_JOINED_STEP_ID, STEPPLING_JOINED_ACTION_ID, STEPPLING_JOINED_EYEBROW, STEPPLING_JOINED_TITLE, HOME_STEP_ID, HOME_ACTION_ID, HOME_TITLE, HOME_LINES } from '@/features/onboarding/last-clearing';
import { LastClearingTracks, LostTrailTapTarget } from '@/components/katchadeck/world/last-clearing-tracks';
import { BattleRewardCard, type BattleReward } from '@/components/katchadeck/world/battle-reward-card';
import { ChapterGoalCard } from '@/components/katchadeck/world/chapter-goal-card';
import { sanctuaryChapterState } from '@/constants/sanctuary-chapters';
import { HeroBuildingPanel } from '@/components/katchadeck/world/hero-building-panel';
import { heroTileLook } from '@/constants/hero-building-art';
import { HERO_BUILDINGS, heroBuildingForCompanion, heroCompanionHome, heroTileLayerId, heroTileSlot } from '@/constants/hero-buildings';
import { HeartTreePanel } from '@/components/katchadeck/world/heart-tree-panel';
import { heartTreeLevel } from '@/constants/heart-tree';
import { collectStoredHeroBuilding, upgradeStoredHeartTree } from '@/utils/merge-world/repository';
import { lodgeTimberWaiting } from '@/constants/hero-buildings';
import { HeroRosterSheet } from '@/components/katchadeck/world/hero-roster-sheet';
import { heroBuildingById, heroBuildingLevel, lodgeCrateGlowBonus, lodgeTimberBonus, type HeroBuildingId } from '@/constants/hero-buildings';
import { LIFE_INPUT_ENABLED } from '@/constants/product-scope';
import { SignalFlare } from '@/components/katchadeck/world/signal-flare';
import { ConversationNarrativeOverlay } from '@/components/katchadeck/world/conversation-narrative-overlay';
import { SupplyRunDock, type SupplyRunOrder } from '@/components/katchadeck/world/supply-run-dock';
import { MergeServeRewardOverlay, type MergeScreenPoint, type MergeServeRewardFlight } from '@/components/katchadeck/games/merge-serve-reward-overlay';
import { mergeOrderReady, mergeOrderServingCells } from '@/utils/merge-world/engine';
import { createSupplyRunBoard, kitchenOpen, supplyOrder, supplyRunSlots } from '@/features/supply-run/supply-run';
import { LastClearingHeartTree } from '@/components/katchadeck/world/last-clearing-heart-tree';
import { LastClearingTitleCard } from '@/components/katchadeck/world/last-clearing-title-card';
import { FIRST_BATTLE, firstBattleLine, LOST_TRAIL_BATTLES, LOST_TRAIL_RESCUE_CELL, lostTrailLine, rescueBattleLine, scriptedBattleGuide, stickyBattleGuide } from '@/constants/last-clearing-battle';
import { LastClearingStepplingMeets, TrappedFriendSilhouette } from '@/components/katchadeck/world/last-clearing-rescue';
import { mergeCellCenter, mergeCellOrigin } from '@/utils/merge-world/board-geometry';

/** A first-battle hint shows once the board has asked for the same thing this long. */
const FIRST_BATTLE_HINT_DELAY_MS = 1_200;
/** A wake on the first battle's chain is shown this soon after the board settles: the finger leads the whole chain. */
const FIRST_BATTLE_WAKE_HINT_DELAY_MS = 450;
/** The frontier's pull-out goes past the usual limit, until the clearing is a speck in the Mist. */
const FRONTIER_MINIMUM_SCALE = 0.16;
/** The currency bar's width: its left padding, then each pill at full width with the gap between them. */
const currencyHudWidth = (count: number) => 18 + count * 88 + Math.max(0, count - 1) * 20;
/** How long a chapter's signal flares over its island before the friends react. */
const CHAPTER_SIGNAL_FLARE_MS = 2_600;
/** How long Steppling is seen home on his tile before his card reveal. */

/** The first battle is Mossprout's: level one, no helper Wisp. */
const FIRST_BATTLE_LOADOUT = { companionId: 'mossprout' as const, level: 1 };
import { clearMission, clearOpeningMission, useMissionBoard, useOpeningMissionBoard } from '@/features/onboarding/use-opening-mission-board';
import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { worldUpgradeRunId } from '@/features/world-upgrades/world-upgrade-flows';
import { WORLD_UPGRADE_DEFINITIONS, worldUpgradeMaxLevel, visibleWorldUpgradeOffers, worldUpgradeOffers, worldUpgradeArchiveOffer, type WorldUpgradeOffer } from '@/features/world-upgrades/world-upgrade-offers';
import { purchaseWorldUpgrade, useWorldUpgradeRun } from '@/features/world-upgrades/world-upgrade-runtime';
import { dispatchContentFlowCommand } from '@/features/content-flow/content-flow-director';
import { contentFlowPresentationKey } from '@/features/content-flow/content-flow-interpreter';
import { WorldUpgradeNarrative } from '@/components/katchadeck/world/world-upgrade-narrative';
import { CompanionFtueCoachmark } from '@/components/katchadeck/onboarding/companion-ftue-coachmark';
import { WorldUpgradePanel, type UpgradeCoachmarkState, type WorldUpgradeCampaignState } from '@/components/katchadeck/world/world-upgrade-panel';
import { KatchimeraCardRevealModal } from '@/components/katchadeck/collection/katchimera-card-deck-carousel';
import { KatchimeraFriendDiscoveryReveal } from '@/components/katchadeck/world/katchimera-friend-discovery-reveal';
import { worldUpgradeStory, upgradeUsesTutorialNarrative } from '@/features/world-upgrades/world-upgrade-stories';
import { useGlowEggHandoff } from '@/features/onboarding/use-glow-egg-handoff';
import { CompanionJournalButton } from '@/components/katchadeck/world/companion-life-actions';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType, type View as ViewType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useIsFocused } from '@react-navigation/native';
import { GlowGatewayGuide } from '@/components/katchadeck/world/glow-gateway-guide';
import { HatchableEncounterPanel } from '@/components/katchadeck/world/hatchable-encounter-panel';
import { sharedEggZoom, DISCOVERED_EGG_ZOOM, usesSharedResidentStage } from '@/components/katchadeck/world/shared-resident-presentation';
import { EggFeedOverlay } from '@/components/katchadeck/home/egg-feed-overlay';
import { useHatchableEncounter } from '@/features/onboarding/use-hatchable-encounter';
import { hatchableEggProgress } from '@/features/onboarding/hatchable-egg-policy';
import { GLOW_GATEWAY_NODE_IDS, GLOW_MISSION_CLEAR_NODE_ID, GLOW_MISSION_FOCUS_NODE_ID, glowDiscoveryAllowsGarden, glowDiscoveryLocksCamera, glowDiscoveryMissionNode, glowDiscoveryResumeCamera } from '@/features/onboarding/glow-discovery-flow';
import { ftueLocksCamera } from '@/features/onboarding/ftue-camera-policy';
import { glowGatewayState, hatchableAvailable, hatchableGatewayState } from '@/utils/merge-world/glow-discovery-policy';
import { sharedWorldIncludesCompanion } from '@/constants/shared-world';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import {
  KingdomHexCanvas,
  type HeartwoodBuildingFx,
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
import { GLOW } from '@/constants/glow';
import { AppFontFamilies } from '@/constants/theme';
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';
import { useStableCallback } from '@/hooks/use-stable-callback';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import { loadWorldIdentity } from '@/utils/world-identity';
import type { KingdomHexCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import type { MergeCharacterId, MergeWorldState, MossproutGardenPlantSlotId, MossproutNatureIslandId, MossproutNatureIslandLevel, StoryWorldMutationReceipt } from '@/types/merge-world';
import type { KatchimeraFamilyId, KatchimeraSkinId } from '@/types/katchimera';
import type { ConversationSession } from '@/types/companion-conversation';
import { HAVEN_ENVIRONMENTS, type HavenStage } from '@/constants/haven-catalog';

import type { FtueCameraDirective, FtueCueDefinition, FtueSpotlightDefinition, FtueStepDefinition, FtueTarget } from '@/features/onboarding/ftue-types';
import { IslandRestorationDock } from '@/components/katchadeck/world/island-restoration-dock';
import { WispRushDock } from '@/components/katchadeck/world/wisp-rush-dock';
import { WispRushSheet, type WispRushResult } from '@/components/katchadeck/world/wisp-rush-sheet';
import { createRushLive, heatHost, WISP_RUSH_HOST } from '@/features/time-trial/heat-mechanic';
import { HEATS_PER_DAY, heatFor, heatFromRules, heatPars } from '@/features/time-trial/ladder';
import { heatsCleared, nextHeatIndex, timeTrialFor } from '@/features/time-trial/trial-world';
import { commandFriendWispPacks } from '@/features/wisps/friend-wisp-runtime';
import { gameNow } from '@/utils/game-clock';
import { localDayId } from '@/utils/world-identity-rules';
import { HavenDetailPanel, UndiscoveredHavenPanel } from '@/components/katchadeck/world/haven-detail-panel';
import { upgradeStageLayout } from '@/features/upgrade-stage/upgrade-stage-layout';
import { tileLevelArt } from '@/features/upgrade-stage/upgrade-level-art';
import { KINGDOM_DREAM_MIST_LOCKED_HEX_TILE_V1 } from '@/utils/world-visuals';
import { consumeIslandRestorationOpen, peekIslandRestorationOpen, requestIslandRestorationOpen } from '@/features/island-restoration/restoration-intent';
import { createRestorationState, deliveriesToPlace, restorationBoardStep, restorationCheckpointReached, restorationDeliveryCells, restorationMechanicHost, restorationRunId, restorationStorageKey, restoreRestorationEchoes, restorationRequestOrder } from '@/features/island-restoration/island-restoration';
import { useKatchimeraCards } from '@/hooks/use-katchimera-cards';
import { mossproutNatureIslandById, mossproutNatureIslandLevelDefinition } from '@/constants/mossprout-nature-islands';
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
import type { StoryTarget, StoryWorldUpgradePresentationPayload } from '@/types/content-flow';
import {
  STORY_WORLD_UPGRADE_PRESENTATION,
  contentFlowEffectResult,
} from '@/features/content-flow/story-world-operations';
import { useStoryPresentationOperation } from '@/features/content-flow/use-story-presentation-operation';
import {
  activeIslandCampaigns,
  type ActiveIslandCampaign,
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
  islandCampaignChapterStatus,
} from '@/constants/island-campaigns/helpers';
import { regionLadder, regionRung } from '@/constants/island-campaigns/ladder';
import { islandCampaignById, islandCampaignForIsland, islandCampaignForOffer } from '@/constants/island-campaigns/registry';
import { MERGE_CHARACTER_NAMES } from '@/constants/merge-world-catalog';
import type { IslandCampaignDefinition, IslandCampaignPhase } from '@/constants/island-campaigns/types';
import { nextOpenIsland } from '@/constants/island-campaigns/wake-order';
import { KingdomGoalScene } from '@/components/katchadeck/onboarding/kingdom-goal-scene';
import { KingdomProgressPill } from '@/components/katchadeck/world/kingdom-progress-pill';
import { SharedAdventurePanel } from '@/components/katchadeck/world/shared-adventure-panel';
import { LanternPost } from '@/components/katchadeck/world/lantern-post';
import { SHARED_ADVENTURE_ENABLED } from '@/features/shared-adventure/catalog';
import { IslandWakeHandoffSheet, KingdomProgressSheet } from '@/components/katchadeck/world/kingdom-progress-sheet';
import { kingdomProgress, type KingdomNext } from '@/features/kingdom-progress/kingdom-progress';
import { stepplingShoeServed } from '@/features/onboarding/steppling-garden-lesson';


type Props = {
  background: TodayAtmosphereBackground;
  companionSlots: KingdomHexCompanionSlot[];
  onContentReady?: () => void;
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
const LANTERN_PLANT_OFFER = {
  accessibilityHint: 'Plants the Wisp Lantern in the highlighted Heartwood patch',
  placement: 'below', gap: 12, icon: 'sparkles', label: 'Plant Lantern',
  target: { kind: 'haven_garden_plot', slotId: 'front-right' },
} as const satisfies KingdomTileUpgradeOffer;
const FIRST_SEED_GARDEN_PLANT_OFFER = {
  accessibilityHint: 'Plants the Dew Spring in the highlighted Heartwood patch',
  placement: 'below',
  gap: 12,
  icon: 'drop.fill',
  label: 'Plant it',
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

/** The checkpoint hint is one finger, under the card's item slots rather than on its face (the card is 120 tall). */
/** After the dock has settled: the card's fade-in and the friend's bubble come first, then the finger. */
const RESTORATION_HINT_DELAY_MS = 900;
const RESTORATION_HINT_FINGER_DROP = 40;

/** The clear step's camera, held past the run's own step change while the board fades. */
const OPENING_CLEAR_CAMERA = mossproutFtueStep(OPENING_MIST_CLEAR_STEP_ID)?.camera ?? null;
/** The opening's mist as a board mechanic sees it: its bar and its three wisps, struck by Glow. */
const OPENING_MIST_HOST: MissionMechanicHost = { required: OPENING_MERGE_REQUIRED, wisps: OPENING_WISPS };
/** How long the opening's lift caption is on screen before the run moves on to the Egg. */
/** "We did it." is held long enough to be felt (FTUE v2, Act I): the lift breathes before the Heart Tree. */
const LIFT_CAPTION_MIN_MS = 2_200;
// The merge dock fades out in 260ms; its space is then free for the caption.
const REVEAL_CAPTION_DELAY_MS = 300;
const OPENING_EGG_APPROACH_DELAY_MS = REVEAL_CAPTION_DELAY_MS + 1000;
/** The longest the screen is held still between a board's finale and its resolution story. */
const RESTORATION_HANDOFF_MAX_MS = 12_000;

const noop = () => {};

/** Memoised: the route re-renders on every FTUE run and world-session change, and hands it stable props. */
export const KatchimeraKingdomScreen = memo(function KatchimeraKingdomScreen({
  background,
  companionSlots,
  onContentReady,
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
  // Every hatchable companion's runs; the live one is whose discovery (and whose garden lesson) the Kingdom shows.
  const hatchableRuns = useHatchableRuns();
  const { discovery: activeHatchable, lesson: activeLessonHatchable } = useMemo(() => activeHatchableFor(mergeWorld, hatchableRuns), [hatchableRuns, mergeWorld]);
  const glowRun = hatchableRuns.discovery[activeHatchable.companion] ?? null;
  const glowReady = hatchableRuns.ready;
  // The live companion's mist mission is up while their discovery waits on its bar.
  const stepplingMissionActive = glowRun?.status === 'active' && glowRun.nodeId === GLOW_MISSION_CLEAR_NODE_ID;
  // A journey episode's Dark Wisp: its consequence run waits on a board docked under the story tile. A friend's discovery board comes first.
  const journeyConsequenceRuns = useJourneyConsequenceRuns();
  const journeyMission = useMemo(() => activeJourneyMission(journeyConsequenceRuns), [journeyConsequenceRuns]);
  const journeyMissionActive = journeyMission != null && !stepplingMissionActive;
  const [storyTileNodes, setStoryTileNodes] = useState<Partial<Record<string, View | null>>>({});
  const setStoryTileNode = useCallback((tileId: string, node: View | null) => {
    setStoryTileNodes((current) => (current[tileId] === node ? current : { ...current, [tileId]: node }));
  }, []);
  const journeyTileNode = journeyMission ? storyTileNodes[journeyMission.tile.id] ?? null : null;
  // The final merge's item flies into the mist before the lift beat: the run
  // is already at `world.mist_lift`, but the Kingdom keeps presenting the
  // clear beat (its camera, the veiled tile, the dock, no caption) until the
  // item has landed and its burst has settled. Only then does the lift begin.
  const [homeTileNode, setHomeTileNodeState] = useState<View | null>(null);
  const [gatewayTileNode, setGatewayTileNodeState] = useState<View | null>(null);
  // A friend's restoration board: the chapter whose beds are open, on its own store under the island.
  // Whose board the player is dealing with. Two friends can be mid-restoration at once (a pack's island wakes on
  // its own condition), so the board follows the friend whose story, marker or request opened it.
  const [restorationFocusCampaignId, setRestorationFocusCampaignId] = useState<string | null>(() => peekIslandRestorationOpen());
  const islandRestoration = useMemo(() => activeIslandRestoration(mergeWorld, restorationFocusCampaignId), [mergeWorld, restorationFocusCampaignId]);
  const [islandTileNodes, setIslandTileNodes] = useState<Partial<Record<MossproutNatureIslandId, View | null>>>({});
  const islandTileNodesRef = useRef(islandTileNodes);
  islandTileNodesRef.current = islandTileNodes;
  // The campaign pivot: a rung of an island's ladder up as an encounter under the island, with what was brought in.
  // The campaign pivot: a rung up as an encounter, docked under its island, or under Mossprout's own tile for the Daily Mist.
  const [islandEncounter, setIslandEncounter] = useState<{ campaignId?: string; islandId?: string; mission: RegionMissionDefinition; loadout: EncounterLoadout } | null>(null);
  const islandEncounterRung = islandEncounter;
  const islandEncounterIslandId = islandEncounter?.islandId ?? null;
  const islandEncounterTileNode = islandEncounterIslandId ? islandTileNodes[islandEncounterIslandId] ?? null : homeTileNode;
  // The tile whose level track is open on the upgrade stage: a friend's island, Mossprout's Grove, or the Daily Mist.
  const [trackOpen, setTrackOpen] = useState<{ kind: 'island'; campaignId: string } | { kind: 'grove' } | { kind: 'daily' } | null>(null);
  const [trackNotice, setTrackNotice] = useState<string | null>(null);
  const [trackBusy, setTrackBusy] = useState(false);
  /** The track to bring back once the level, story or reveal in front of it has gone: the player lands back on the tile's levels. */
  /** A level waiting on the story in front of it: once the conversation has closed, it starts (or the track comes back). */
  const [levelAfterStory, setLevelAfterStory] = useState<{ campaignId: string; missionId: string; choice: EncounterLoadoutChoice } | null>(null);
  const [trackReopen, setTrackReopen] = useState<{ kind: 'island'; campaignId: string } | { kind: 'grove' } | { kind: 'daily' } | null>(null);
  const setNatureIslandTileNode = useCallback((islandId: MossproutNatureIslandId, node: View | null) => {
    setIslandTileNodes((current) => (current[islandId] === node ? current : { ...current, [islandId]: node }));
  }, []);
  const restorationTileNode = islandRestoration ? islandTileNodes[islandRestoration.campaign.islandId] ?? null : null;
  // Wisp Rush, Dashkit's daily time trial. Between heats: a sheet on the upgrade stage. During one: the same docked
  // board, the same wisps over the tile and the same Glow flights as every friend's board.
  const [rushSheetOpen, setRushSheetOpen] = useState(false);
  const [rushRun, setRushRun] = useState<{ dayId: string; index: number; attempt: number } | null>(null);
  const [rushResult, setRushResult] = useState<WispRushResult | null>(null);
  const [rushNotice, setRushNotice] = useState<string | null>(null);
  const rushSpec = useMemo(() => rushRun ? heatFor(rushRun.dayId, rushRun.index) : null, [rushRun]);
  const rushTileNode = islandTileNodes[WISP_RUSH_HOST.islandId] ?? null;
  // Glow flies into whichever misted tile the live board sits under.
  const trailGlowTarget = (LOST_TRAIL_STONE_STEP_IDS as readonly string[]).includes(routeFtueStepId ?? '') ? storyTileNodes[LOST_TRAIL_TILE_ID] ?? null : null;
  const openingGlow = useOpeningGlow(trailGlowTarget ? trailGlowTarget : rushSpec ? rushTileNode : stepplingMissionActive ? gatewayTileNode : journeyMissionActive ? journeyTileNode : islandEncounter ? islandEncounterTileNode : islandRestoration ? restorationTileNode : homeTileNode);
  // A board's finale is its last item striking the last wisp. Nothing moves on until that landing,
  // and then only once the wisp has fallen: the mission is over when the player has seen it end.
  const restorationFinaleIdRef = useRef<number | null>(null);
  const restorationLanded = restorationFinaleIdRef.current != null && openingGlow.finaleLandedId === restorationFinaleIdRef.current;
  // Held from the instant the finale launches (the ref) until its burst has settled (the state): the run
  // store's own render pass arrives before the state does, and must not see the lift step unheld.
  const openingFinaleHeld = openingGlow.finaleActive || openingGlow.finaleHoldRef.current;
  const ftueStepId = routeFtueStepId === OPENING_MIST_LIFT_STEP_ID && openingFinaleHeld ? OPENING_MIST_CLEAR_STEP_ID : routeFtueStepId;
  const screenFocused = useIsFocused();
  // Read the bottom caption for one second, then approach automatically.
  const [openingEggApproachReady, setOpeningEggApproachReady] = useState(false);
  useEffect(() => {
    if (routeFtueStepId !== OPENING_MIST_LIFT_STEP_ID || openingFinaleHeld || !screenFocused) {
      setOpeningEggApproachReady(false);
      return;
    }
    const timer = setTimeout(() => setOpeningEggApproachReady(true), OPENING_EGG_APPROACH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [routeFtueStepId, openingFinaleHeld, screenFocused]);
  const openingLiftCameraHeld = routeFtueStepId === OPENING_MIST_LIFT_STEP_ID
    && (openingFinaleHeld || !openingEggApproachReady);
  // The mist itself starts clearing the frame the item strikes the tile; only
  // the camera, the caption and the dock wait for the burst to settle.
  const homeVeil = routeFtueStepId === OPENING_MIST_LIFT_STEP_ID && openingFinaleHeld && !openingGlow.finaleLanded ? 'veiled' : homeVeilForStep(routeFtueStepId);
  const { flush: flushMergeWorld } = useMergeWorldActions();
  const { transitionTo } = useGameScreenTransition();
  const stepplingLesson = useMemo(() => gardenLessonFor(hatchableRuns, activeLessonHatchable), [activeLessonHatchable, hatchableRuns]);
  const stepplingLessonOpening = useRef(false);
  // The Egg keeps its companion while the encounter is open: the live companion moves on the moment the
  // hatch writes the discovery record, and the panel must finish with the friend it opened for.
  const encounterOpenRef = useRef(false);
  const encounterHatchableRef = useRef(activeHatchable);
  if (!encounterOpenRef.current) encounterHatchableRef.current = activeHatchable;
  const encounterHatchable = encounterHatchableRef.current;
  const stepplingEncounter = useHatchableEncounter(mergeWorld, encounterHatchable);
  encounterOpenRef.current = stepplingEncounter.open;
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
  const [glowPanelOpen, setGlowPanelOpen] = useState(true);
  useEffect(() => { setGlowPanelOpen(glowRun?.status !== 'completed'); }, [glowRun?.status, glowRun?.nodeId]);
  const glowGatewayActive = Boolean(glowRun);
  const mistUpgradeActive = Boolean(glowRun && glowRun.status !== 'completed' && GLOW_GATEWAY_NODE_IDS.includes(glowRun.nodeId));
  const glowScene = glowRun ? hatchableDiscoveryScene(activeHatchable, glowRun.nodeId) : null;
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  // The shared upgrade stage: the docked panel's size, and the band above it the canvas frames the tile in.
  const upgradeStage = useMemo(() => upgradeStageLayout(window, insets), [insets, window]);
  const upgradeStageBand = useMemo(() => ({ centerY: upgradeStage.stageCenterY, height: upgradeStage.stageHeight }), [upgradeStage]);
  const reduceMotion = useReducedMotion();
  // A hidden friend's tile on the upgrade stage: which one, so the camera can frame it.
  const [lockedHintFamilyId, setLockedHintFamilyId] = useState<string | null>(null);
  // What the world is drawing for the tile on the upgrade stage: the panel's "current" picture is that very tile.
  const [upgradeStageArt, setUpgradeStageArt] = useState<ImageSourcePropType | null>(null);
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
  const [adventureOpen, setAdventureOpen] = useState(false);
  const [wispLanternOpen, setWispLanternOpen] = useState(false);
  // Growing the Lantern: the hub hands over to the shared upgrade stage and takes the player back after.
  const [lanternUpgradeOpen, setLanternUpgradeOpen] = useState(false);
  // One of Heartwood's economy buildings, open on the shared upgrade stage. It holds the screen the way the Lantern's surfaces do.
  const [buildingPanelId, setBuildingPanelId] = useState<HeartwoodBuildingId | null>(null);
  // A playable Katchimera's level, on the upgrade stage over their tile.
  const [katchimeraPanelId, setKatchimeraPanelId] = useState<MergeCharacterId | null>(null);
  // A friend's one panel (Sept 25 2026): their Hero and their Building share a tile, so they share a panel, as two tabs
  // on the upgrade stage. Every way in (a tap on them, a goal, the Heroes list) opens it on the tab that is asked for,
  // or the one that needs them (a hero held back by their building opens on the building).
  const [friendPanelSwitched, setFriendPanelSwitched] = useState(false);
  // A friend's own Wisps menu, opened from the small button beside them.
  const [friendWispsFamilyId, setFriendWispsFamilyId] = useState<string | null>(null);
  const { state: wispState } = useWisps();
  const residentWisps = useMemo(() => Object.fromEntries(FRIEND_CONSTELLATIONS.map(({ familyId }) => [familyId, {
    wispId: friendEquippedWisp(wispState, familyId), packWaiting: friendPacksWaiting(wispState, familyId).length > 0,
  }])), [wispState]);
  const lanternSurfaceOpen = wispLanternOpen || lanternUpgradeOpen || buildingPanelId != null || katchimeraPanelId != null || trackOpen != null;
  const [wispPlanting, setWispPlanting] = useState(false);
  const [wispPlantError, setWispPlantError] = useState('');
  const wispPlantBusy = useRef(false);
  const wispAutoPresented = useRef(false);
  const plantWispLantern = useCallback(() => {
    if (wispPlantBusy.current) return;
    wispPlantBusy.current = true; setWispPlantError('');
    void plantStoredWispLantern().catch(() => setWispPlantError('Couldn’t plant the Lantern. Tap Plant Lantern to try again.'))
      .finally(() => { wispPlantBusy.current = false; });
  }, []);
  const [routeCompanion, setRouteCompanion] = useState<string | undefined>();
  const eventHarmony = useHarmonyProgress();
  const [eventSelection, setEventSelection] = useState<WorldEventSelection | null>(null);
  const [eventError, setEventError] = useState('');
  const eventBusy = useRef(false);
  const eventIntroduced = useRef(new Set<string>());
  const [eventClock, setEventClock] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setEventClock(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const eventActions = useMemo(() => worldEventActions(mergeWorld, eventHarmony, availableLocalEvents(), eventClock), [mergeWorld, eventHarmony, eventClock]);
  const selectedEventAction = eventActions.find(a => a.event.id === eventSelection?.eventId && a.encounter.id === eventSelection.nodeId);
  const eventBoardActive = Boolean(screenFocused && eventSelection?.kind === 'board' && (selectedEventAction?.phase === 'board' || selectedEventAction?.phase === 'resolution'));

  const [wakeHandoffCampaign, setWakeHandoffCampaign] = useState<IslandCampaignDefinition | null>(null);
  const progressSummary = useMemo(() => kingdomProgress(mergeWorld), [mergeWorld]);
  const [interactionCreatureId, setInteractionCreatureId] = useState<string | null>(null);
  const [ftueReturnFocusCreatureId, setFtueReturnFocusCreatureId] = useState<string | null>(null);
  const [interactionCameraReady, setInteractionCameraReady] = useState(false);
  const [interactionExiting, setInteractionExiting] = useState(false);
  const [interactionExitNonce, setInteractionExitNonce] = useState(0);
  // The first session's rest hands the camera to Steppling's clearing: that exit closes where the camera is,
  // never flying back to Mossprout (a second move would cancel the first and its completion with it).
  const [interactionExitHandsOver, setInteractionExitHandsOver] = useState(false);
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
  // The first restore's light could not be kept (a storage error): the offer shows a way to retry.
  const [firstLightFailed, setFirstLightFailed] = useState(false);
  const [requiredUpgradeStory, setRequiredUpgradeStory] = useState<{ offer: WorldUpgradeOffer; presentation: HavenTileUpgradePresentation } | null>(null);
  const prepareEggEntry = useCallback(() => { setFtueCameraSettled(false); setGlowPanelOpen(false); }, []);
  const eggHandoff = useGlowEggHandoff({ run: hatchableRuns.discovery[encounterHatchable.companion] ?? null, world: mergeWorld, focused: screenFocused,
    available: !interactionCreatureId && !upgradePresentation && !requiredUpgradeStory, open: stepplingEggOpen,
    enter: stepplingEncounter.enter, onOpening: prepareEggEntry, definition: encounterHatchable });
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
  const islandCampaignPanelState: WorldUpgradeCampaignState | null = useMemo(() => {
    if (!sharedUpgradeCampaign) return null;
    const presentation = islandCampaignPanelPresentation(mergeWorld, sharedUpgradeCampaign);
    if (!presentation) return null;
    const remembered = mergeWorld.encounters?.loadout;
    return {
      ...presentation,
      loadout: remembered ? { katchimeraId: remembered.katchimeraId, helperWispId: remembered.helperWispId } : null,
      // Playable friends who are here: Mossprout always, the others once hatched.
      playable: PLAYABLE_KATCHIMERAS.filter((id) => id === 'mossprout' || mergeWorld.unlockedCharacters.includes(id)),
      ownedWispIds: Object.keys(wispState.unlocked),
      cleared: presentation.mission ? mergeWorld.encounters?.clears[presentation.mission.id] ?? null : null,
    };
  }, [mergeWorld, sharedUpgradeCampaign, wispState.unlocked]);
  const ftueGardenUpgradeActive = ftueStepId === 'world.first_bloom_offer' || ftueStepId === 'world.first_bloom_restore';
  const coachedUpgrade = ftueGardenUpgradeActive || mistUpgradeActive;
  useEffect(() => {
    const id = ftueStepId === 'world.first_bloom_restore' ? 'haven:mossprout' : null;
    if (id) {
      const offer = worldUpgradeOffers(mergeWorldRef.current).find((candidate) => candidate.id === id);
      if (offer) { setSelectedUpgrade(offer); setUpgradeCommitted(false); }
    }
  }, [ftueStepId]);
  // The discovery resumes wherever the world says it stands: a failed node retried, the lesson's return
  // submitted, a paid ticket's event recorded so the board opens. Keyed on everything that can move it.
  const hatchableTicketHeld = Boolean(mergeWorld.hatchableMissions?.[activeHatchable.companion]);
  const hatchableTileUnlocked = Boolean(mergeWorld.worldUnlocks?.[activeHatchable.tile.unlockId]);
  /** A hatchable's discovery is under way (its clearing, board, Egg): nothing else takes the camera until it ends. */
  const hatchableStoryOpen = Boolean(glowRun && glowRun.status !== 'completed');
  const hatchableStoryOpenRef = useRef(hatchableStoryOpen);
  hatchableStoryOpenRef.current = hatchableStoryOpen;
  const resumeActiveHatchable = useCallback(() => resumeHatchableDiscovery(activeHatchable, mergeWorldRef.current)
    .then((result) => { if (result.blockedBy === 'garden') openGardenRef.current?.(undefined, activeHatchable.companion); return result; })
    .catch((error) => { setUpgradeError(error instanceof Error ? error.message : 'Please try again.'); return null; }), [activeHatchable]);
  useEffect(() => {
    if (!screenFocused || !glowRun || glowRun.status === 'completed') return;
    if (!mistUpgradeActive && glowRun.status !== 'failed_recoverable') return;
    void resumeActiveHatchable();
  }, [glowRun?.nodeId, glowRun?.status, glowRun, hatchableTicketHeld, hatchableTileUnlocked, mistUpgradeActive, resumeActiveHatchable, screenFocused]);
  // The focus step frames the tile, then the board docks. If its camera acknowledgement is ever lost (a move
  // superseded mid-flight, a surface not mounted for it), the step is acknowledged here after a beat: the
  // board must open every time, never only after a relaunch.
  useEffect(() => {
    if (!screenFocused || glowRun?.status !== 'active' || glowRun.nodeId !== GLOW_MISSION_FOCUS_NODE_ID) return;
    const run = glowRun;
    const timer = setTimeout(() => {
      void dispatchContentFlowCommand(run.runId, { type: 'presentation_acknowledged', presentationKey: contentFlowPresentationKey(run, GLOW_MISSION_FOCUS_NODE_ID) })
        .catch((error) => console.warn('The mist board could not open', error));
    }, 4000);
    return () => clearTimeout(timer);
  }, [glowRun, screenFocused]);
  // A ticket paid with no story saved (the app went down between the two writes): the story begins now.
  useEffect(() => {
    if (!screenFocused || !glowReady || glowRun || !hatchableTicketHeld || hatchableTileUnlocked) return;
    void startHatchableDiscovery(activeHatchable).then(() => resumeActiveHatchable()).catch((error) => console.warn('The path could not open', error));
  }, [activeHatchable, glowReady, glowRun, hatchableTicketHeld, hatchableTileUnlocked, resumeActiveHatchable, screenFocused]);
  useEffect(() => {
    if (upgradePresentation) { setSelectedUpgrade(null); setUpgradePurchasing(false); }
  }, [upgradePresentation]);
  useEffect(() => {
    const failed = ordinaryUpgradeRun?.status === 'failed_recoverable' ? ordinaryUpgradeRun
      : ftueStepId === 'world.first_bloom_restore' && ftueUpgradeRun?.status === 'failed_recoverable' ? ftueUpgradeRun
        : glowRun?.status === 'failed_recoverable' && (glowRun.nodeId.startsWith('gateway.purchase') || glowRun.nodeId === 'gateway.pay') ? glowRun : null;
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
  // Every automatic continuation that has already fired, by friend, chapter and status: more than one friend's story
  // can be in progress, so one slot would let them knock each other's guard out and replay a scene.
  const campaignAutoTransitionRef = useRef(new Set<string>());
  /** A served request whose friend should greet the player on the island panel, not in an overlay. */
  const returnPanelRef = useRef<string | null>(null);
  const openUpgradeOfferRef = useRef<((offer: WorldUpgradeOffer) => Promise<void>) | null>(null);
  const openGardenRef = useRef<((orderId?: string, companion?: MergeCharacterId) => void) | null>(null);
  const [selectedMemoryPlantId, setSelectedMemoryPlantId] = useState<string | null>(null);
  const [firstSeedPlacementBusy, setFirstSeedPlacementBusy] = useState(false);
  const [firstSeedPlacementFailed, setFirstSeedPlacementFailed] = useState(false);
  const restoreButtonRef = useRef<View>(null);
  const glowCurrencyArtRef = useRef<View>(null);
  const timberCurrencyArtRef = useRef<View>(null);
  const mealsCurrencyArtRef = useRef<View>(null);
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
  // Every hatchable tile's state; the one whose Egg is open on screen shows the Egg even before the world says so.
  const hatchableTileStates = HATCHABLE_COMPANIONS.map((definition) =>
    definition.companion === encounterHatchable.companion && stepplingEncounter.open ? 'egg' as const : hatchableGatewayState(mergeWorld, definition)).join('|');
  // Keyed by the states themselves, never by the world object: a Glow landing must not rebuild the whole scene mid-mission.
  const hatchableTiles = useMemo(() => Object.fromEntries(HATCHABLE_COMPANIONS.map((definition, index) => [definition.tile.id, hatchableTileStates.split('|')[index] as 'locked' | 'egg' | 'open'])), [hatchableTileStates]);
  // Keyed by the states themselves, like the hatchable tiles: a Glow landing must not rebuild the scene.
  const storyTileStateKey = Object.entries(storyTileStates(mergeWorld)).map(([id, state]) => `${id}=${state}`).join('|');
  const storyTiles = useMemo(() => Object.fromEntries(storyTileStateKey.split('|').filter(Boolean).map((entry) => entry.split('=') as [string, 'misted' | 'revealed'])), [storyTileStateKey]);
  const [heartwoodOpenToken, setHeartwoodOpenToken] = useState(0);
  const [selectedHeartwoodBed, setSelectedHeartwoodBed] = useState<MossproutGardenPlantSlotId | undefined>();
  const treeStage = heartwoodStage(mergeWorld);
  useEffect(() => {
    if (treeStage !== 'dormant' && (!mergeWorld.sharedAdventure?.gardenSupply || mergeWorld.sharedAdventure.gardenBedsVersion !== 2)) {
      void applyStoredAdventure({ type: 'sync_heartwood' }).catch(() => { /* The Tree panel offers a retry. */ });
    }
  }, [treeStage, mergeWorld.sharedAdventure?.gardenSupply, mergeWorld.sharedAdventure?.gardenBedsVersion]);
  // Replay only the presentation on a resumed growth checkpoint; saved growth
  // remains authoritative. Paint the seed before releasing its sprout graphic.
  const growthPresentationKey = `${activeFtueRunId ?? 'ftue'}:first-seed`;
  const [releasedSeedGrowth, setReleasedSeedGrowth] = useState<string | null>(null);
  useEffect(() => {
    if (ftueStepId !== 'world.first_seed_grew') {
      setReleasedSeedGrowth(null);
      return;
    }
    if (!screenFocused || upgradePresentation || !ftueCameraSettled) return;
    const timer = setTimeout(() => setReleasedSeedGrowth(growthPresentationKey), 150);
    return () => clearTimeout(timer);
  }, [ftueStepId, screenFocused, upgradePresentation, ftueCameraSettled, growthPresentationKey]);
  const holdFirstSeedGraphic = ftueStepId === 'world.first_bloom_restore'
    || (ftueStepId === 'world.first_seed_grew' && releasedSeedGrowth !== growthPresentationKey);
  // Every friend's building shows on their tile at its level's look.
  const heroSlotsKey = HERO_BUILDINGS.map((building) => heroTileSlot(heroBuildingLevel(mergeWorld, building.id))).join(',');
  const heroTileLooks = useMemo(() => Object.fromEntries(HERO_BUILDINGS.map((building, index) => [building.tileId, Number(heroSlotsKey.split(',')[index])])), [heroSlotsKey]);
  const mossproutGardenScene = useMemo(() => ({
    heroTileLooks,
    heartwoodStage: treeStage,
    gateway: stepplingEncounter.open ? 'egg' as const : gatewayState,
    hatchableTiles,
    storyTiles,
    level: mergeWorld.haven.structures.mossproutGarden.level,
    plantableMemories: mergeWorld.haven.plantableMemories,
    featureLevels: mergeWorld.haven.structures.mossproutGarden.featureLevels,
  }), [
    heroTileLooks,
    treeStage,
    gatewayState,
    hatchableTiles,
    storyTiles,
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
  // The first session's planting beat plants the Dew Spring, and it stays exactly as planted: restoring the tree's
  // tile does not change it, hide it or "grow" it. These keep the beats' old names (they are wired through the whole
  // screen); what they read is the Spring, never a memory seed.
  const firstSeedPlanted = firstSpringBuilt(mergeWorld);
  const firstSeedGrown = firstSpringAwake(mergeWorld);
  // A save that finished the first session when it still planted a memory seed gets the Spring it would have built.
  const firstSpringReady = Boolean(firstSeedReadyForSpring(mergeWorld)) && !ftueStepId;
  const firstSpringAttemptRef = useRef<number | null>(null);
  useEffect(() => {
    if (!firstSpringReady || firstSpringAttemptRef.current === mergeWorld.revision) return;
    firstSpringAttemptRef.current = mergeWorld.revision;
    void ensureStoredFirstSpring().catch(() => { firstSpringAttemptRef.current = null; });
  }, [firstSpringReady, mergeWorld.revision]);
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
  const mistResumeCamera = glowDiscoveryResumeCamera(glowRun) ?? (journeyMissionActive ? journeyMissionResumeCamera(journeyMission) : null);
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
    // "Meet me at Bloom Garden" from the Merge page: straight onto that friend's board, whoever's was up before.
    if (!screenFocused) return;
    const requested = peekIslandRestorationOpen();
    if (requested && requested !== restorationCampaignId) { setRestorationFocusCampaignId(requested); return; }
    if (restorationCampaignId && consumeIslandRestorationOpen(restorationCampaignId)) setRestorationOpen(true);
  }, [restorationCampaignId, screenFocused]);
  const closeRestoration = useCallback(() => setRestorationOpen(false), []);
  const restorationCamera = useMemo((): FtueCameraDirective | null => restorationIslandId && restorationOpen && screenFocused ? {
    kind: 'focus_target' as const, target: { kind: 'haven_nature_island' as const, islandId: restorationIslandId },
    zoom: MISSION_CAMERA_ZOOM, anchorY: MISSION_CAMERA_ANCHOR_Y, durationMs: 700,
  } : null, [restorationIslandId, restorationOpen, screenFocused]);
  const islandEncounterCamera = useMemo((): FtueCameraDirective | null => !screenFocused ? null : islandEncounter ? {
    kind: 'focus_target' as const, target: islandEncounterIslandId ? { kind: 'haven_nature_island' as const, islandId: islandEncounterIslandId } : { kind: 'haven_tile' as const, characterId: 'mossprout' as const },
    zoom: MISSION_CAMERA_ZOOM, anchorY: MISSION_CAMERA_ANCHOR_Y, durationMs: 700,
  } : trackOpen ? {
    // The track's tile framed over the docked panel: a friend's island, else Mossprout's own tile.
    kind: 'focus_target' as const,
    target: trackOpen.kind === 'island' && islandCampaignById.get(trackOpen.campaignId)
      ? { kind: 'haven_nature_island' as const, islandId: islandCampaignById.get(trackOpen.campaignId)!.islandId }
      : { kind: 'haven_tile' as const, characterId: 'mossprout' as const },
    zoom: 1.25, anchorY: upgradeStage.stageCenterY / Math.max(1, window.height), durationMs: 520,
  } : null, [islandEncounter, islandEncounterIslandId, screenFocused, trackOpen, upgradeStage, window.height]);
  // A heat frames Dashkit's tile the way a friend's board frames theirs; the sheet between heats frames it over the panel.
  const rushCamera = useMemo((): FtueCameraDirective | null => !screenFocused ? null : rushSpec
    ? { kind: 'focus_target', target: { kind: 'haven_nature_island', islandId: WISP_RUSH_HOST.islandId }, zoom: MISSION_CAMERA_ZOOM, anchorY: MISSION_CAMERA_ANCHOR_Y, durationMs: 700 }
    : rushSheetOpen ? { kind: 'focus_target', target: { kind: 'haven_nature_island', islandId: WISP_RUSH_HOST.islandId }, zoom: 1.25, anchorY: upgradeStage.stageCenterY / Math.max(1, window.height), durationMs: 520 } : null,
  [rushSheetOpen, rushSpec, screenFocused, upgradeStage, window.height]);
  const eventCompanionId = selectedEventAction?.encounter.companionId ?? 'mossprout';
  const eventCamera = useMemo((): FtueCameraDirective | null => eventBoardActive ? { kind: 'focus_target', target: { kind: 'haven_resident', characterId: eventCompanionId }, zoom: MISSION_CAMERA_ZOOM, anchorY: MISSION_CAMERA_ANCHOR_Y, durationMs: 700 } : null, [eventBoardActive, eventCompanionId]);
  const heartwoodIntroActive = (ftueStepId === 'companion.first_meeting' && Boolean(worldSubjectPresentation?.introRevealReady))
    || ftueStepId === 'companion.garden_intro';
  const heartwoodIntroCamera = useMemo((): FtueCameraDirective | null => heartwoodIntroActive ? {
    kind: 'focus_target', target: { kind: 'haven_heartwood_pair' }, zoom: 0.92, anchorY: 0.46, durationMs: 1200,
  } : null, [heartwoodIntroActive]);
  useEffect(() => {
    if (!heartwoodIntroActive || !ftueCameraSettled || !screenFocused) return;
    const revision = cameraSettleRevisionRef.current;
    const timer = setTimeout(() => {
      if (cameraSettleRevisionRef.current === revision) worldSubjectPresentation?.onIntroFramingReady?.();
    }, 1000);
    return () => clearTimeout(timer);
  }, [heartwoodIntroActive, ftueCameraSettled, screenFocused, worldSubjectPresentation?.onIntroFramingReady]);
  // The Supply Run docks under the Lost Trail, framed the way the trail's battles were.
  const [supplyRunOpen, setSupplyRunOpen] = useState(false);
  // A chapter's opening scene (The Signal) frames the island the signal comes from.
  // Where a chapter's opening points the camera: a friend's island, or a friend's misted tile (the lit window).
  const [chapterOpeningPlace, setChapterOpeningPlace] = useState<{ islandId?: MossproutNatureIslandId; tileId?: string } | null>(null);
  // A chapter opening on a friend's tile (the lit window) ends on a tap on that tile (`finishChapterOpening`).
  const [openingTileTap, setOpeningTileTap] = useState<string | null>(null);
  // The story holds the world (a chapter's opening from before its camera moves to its guided tile tap, a rescued
  // friend's tile clearing and their arrival scene): no tile, marker, resident or panel takes a touch meanwhile. Only
  // the guided tap goes through (`storyBypassRef`).
  const storyHoldRef = useRef(false);
  const storyBypassRef = useRef(false);
  const chapterOpeningCamera = useMemo((): FtueCameraDirective | null => chapterOpeningPlace?.islandId
    ? { kind: 'focus_target', target: { kind: 'haven_nature_island', islandId: chapterOpeningPlace.islandId }, zoom: 1.05, anchorY: 0.5, durationMs: 1_800 }
    : chapterOpeningPlace?.tileId
      ? { kind: 'focus_target', target: { kind: 'haven_structure', structureId: chapterOpeningPlace.tileId }, zoom: 1.25, anchorY: 0.46, durationMs: 1_800 }
      : null, [chapterOpeningPlace]);
  const supplyRunCamera = useMemo((): FtueCameraDirective | null => supplyRunOpen
    ? { kind: 'focus_target', target: { kind: 'haven_structure', structureId: BARISTABBIT_HATCHABLE.tile.id }, zoom: OPENING_CAMERA_ZOOM, anchorY: OPENING_CAMERA_ANCHOR_Y, durationMs: 700 }
    : null, [supplyRunOpen]);
  // A friend's own building (the Explorer's Lodge): their tile framed over the docked panel, like a hero's.
  const [heroBuildingPanelId, setHeroBuildingPanelId] = useState<HeroBuildingId | null>(null);
  const openFriendPanel = useCallback((characterId: MergeCharacterId, tab?: 'hero' | 'building') => {
    const world = mergeWorldRef.current;
    const building = heroBuildingForCompanion(characterId);
    const hasBuilding = Boolean(building && heroCompanionHome(world, building));
    const hasHero = isPlayableKatchimera(characterId);
    const heldByBuilding = hasHero && (() => { const check = canUpgradeKatchimera(world, characterId); return !check.ok && check.reason === 'building'; })();
    const open = tab === 'building' && hasBuilding ? 'building' : tab === 'hero' && hasHero ? 'hero' : heldByBuilding && hasBuilding ? 'building' : hasHero ? 'hero' : hasBuilding ? 'building' : null;
    setFriendPanelSwitched(false);
    if (open === 'building' && building) { setKatchimeraPanelId(null); setHeroBuildingPanelId(building.id); return true; }
    if (open === 'hero') { setHeroBuildingPanelId(null); setKatchimeraPanelId(characterId); return true; }
    return false;
  }, []);
  const friendPanelCharacter = katchimeraPanelId ?? (heroBuildingPanelId ? HERO_BUILDINGS.find((building) => building.id === heroBuildingPanelId)?.companion ?? null : null);
  const friendTabs = useMemo(() => {
    if (!friendPanelCharacter) return undefined;
    const building = heroBuildingForCompanion(friendPanelCharacter);
    if (!building || !heroCompanionHome(mergeWorld, building) || !isPlayableKatchimera(friendPanelCharacter)) return undefined;
    return {
      items: [{ id: 'hero' as const, label: 'Hero', icon: 'star.fill' as const }, { id: 'building' as const, label: building.name, icon: 'house.fill' as const }],
      value: katchimeraPanelId ? 'hero' as const : 'building' as const,
      onChange: (tab: 'hero' | 'building') => {
        setFriendPanelSwitched(true);
        if (tab === 'building') { setKatchimeraPanelId(null); setHeroBuildingPanelId(building.id); }
        else { setHeroBuildingPanelId(null); setKatchimeraPanelId(friendPanelCharacter); }
      },
    };
  }, [friendPanelCharacter, katchimeraPanelId, mergeWorld]);
  const [heartTreePanelOpen, setHeartTreePanelOpen] = useState(false);
  const heartTreeCamera = useMemo((): FtueCameraDirective | null => heartTreePanelOpen
    ? { kind: 'focus_target', target: { kind: 'haven_garden_tile', characterId: 'mossprout' }, zoom: 1.4, anchorY: (upgradeStage.stageCenterY + upgradeStage.stageHeight * 0.15) / Math.max(1, window.height), durationMs: 520 }
    : null, [heartTreePanelOpen, upgradeStage, window.height]);
  const [heroRosterOpen, setHeroRosterOpen] = useState(false);
  const heroBuildingCamera = useMemo((): FtueCameraDirective | null => heroBuildingPanelId
    ? { kind: 'focus_target', target: heroBuildingTarget(heroBuildingPanelId), zoom: 1.5, anchorY: (upgradeStage.stageCenterY + upgradeStage.stageHeight * 0.15) / Math.max(1, window.height), durationMs: 520 }
    : null, [heroBuildingPanelId, upgradeStage, window.height]);
  const katchimeraCamera = useMemo((): FtueCameraDirective | null => katchimeraPanelId
    ? { kind: 'focus_target', target: { kind: 'haven_tile', characterId: katchimeraPanelId }, zoom: 1.5, anchorY: (upgradeStage.stageCenterY + upgradeStage.stageHeight * 0.15) / Math.max(1, window.height), durationMs: 520 }
    : null, [katchimeraPanelId, upgradeStage, window.height]);
  const lanternCamera = useMemo((): FtueCameraDirective | null => buildingPanelId
    ? { kind: 'focus_target', target: { kind: 'haven_garden_plot', characterId: 'mossprout', slotId: heartwoodBuildingById.get(buildingPanelId)!.slotId }, zoom: 1.7, anchorY: (upgradeStage.stageCenterY + upgradeStage.stageHeight * 0.2) / Math.max(1, window.height), durationMs: 520 }
    : lanternUpgradeOpen
    // The Lantern stands above its plot: frame the plot a little under the band's centre so the Lantern fills it.
    ? { kind: 'focus_target', target: { kind: 'haven_garden_plot', characterId: 'mossprout', slotId: 'front-right' }, zoom: 1.7, anchorY: (upgradeStage.stageCenterY + upgradeStage.stageHeight * 0.2) / Math.max(1, window.height), durationMs: 520 }
    : wispLanternOpen ? { kind: 'focus_target', target: { kind: 'haven_garden_plot', characterId: 'mossprout', slotId: 'front-right' }, zoom: 1.15, anchorY: 0.42, durationMs: 850 } : null, [buildingPanelId, lanternUpgradeOpen, upgradeStage, window.height, wispLanternOpen]);
  // A level on a tile (or its open track) frames that tile, whatever story would otherwise resume its camera.
  const baseTutorialCamera = katchimeraCamera ?? heroBuildingCamera ?? heartTreeCamera ?? supplyRunCamera ?? chapterOpeningCamera ?? lanternCamera ?? rushCamera ?? heartwoodIntroCamera ?? eventCamera ?? (islandEncounter || trackOpen ? islandEncounterCamera : null) ?? (mistResumeCamera ? screenFocused ? mistResumeCamera : null : islandEncounterCamera ?? restorationCamera ?? (openingLiftCameraHeld ? OPENING_CLEAR_CAMERA : ftueStep?.camera ?? null));
  const tutorialCamera = useMemo(() => {
    if (!ftueStepId?.startsWith('egg.') || baseTutorialCamera?.kind !== 'focus_target') return baseTutorialCamera;
    return { ...baseTutorialCamera, zoom: sharedEggZoom(worldSubjectPresentation?.wispsCleared
      ?? (ftueStepId === 'egg.ready' ? 2 : ftueStepId === 'egg.context' ? 1 : 0)), durationMs: ftueStepId === 'egg.opening' && !worldSubjectPresentation?.wispsCleared ? 1400 : 600 };
  }, [baseTutorialCamera, ftueStepId, worldSubjectPresentation?.wispsCleared]);
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
      // The Seed is in the ground: straight on to the offer, nothing to read and nothing to tap.
      'world.seed_planted': 0,
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
  // This checkpoint is automatic, including a cold resume. The questions
  // become available only once the egg camera has settled, like other eggs.
  useEffect(() => {
    if (ftueStepId !== 'world.egg_intro' || !ftueCameraSettled || !screenFocused) return;
    const revision = cameraSettleRevisionRef.current;
    const timer = setTimeout(() => {
      if (revision !== cameraSettleRevisionRef.current) return;
      commitFtueAction({ actionId: 'world.inspect_mossprout_egg', evidenceRef: 'mossprout-world:egg-camera-settled' });
    }, 200);
    return () => clearTimeout(timer);
  }, [ftueStepId, ftueCameraSettled, screenFocused]);
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
  // The Lost Trail's tile is an FTUE target (`shared-world:lost-trail`): the tracks beat's finger and spotlight find it.
  const lostTrailNode = storyTileNodes[LOST_TRAIL_TILE_ID] ?? null;
  useEffect(() => { registerFtueTarget(`shared-world:${LOST_TRAIL_TILE_ID}`, lostTrailNode); }, [lostTrailNode, registerFtueTarget]);
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
  // The run store advances a frame before the route's step id follows it. On the final merge the run is
  // already at the lift while the route still says clear; the run is still the opening's, or the docked
  // board would unmount for that frame and remount with its entrance slide (and its final item back).
  const openingRun = ftueRun?.status === 'active'
    && (ftueRun.stepId === routeFtueStepId || (ftueRun.stepId === OPENING_MIST_LIFT_STEP_ID && routeFtueStepId === OPENING_MIST_CLEAR_STEP_ID))
    ? ftueRun : null;
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
  // The Last Clearing's first battle (`constants/last-clearing-battle.ts`): a scripted Lanes battle docked under the
  // clearing at `world.mist_clear`, in place of the opening's glow-strike board. Winning it moves the story on.
  // The spotlight and finger wait for the dock to finish fading in, or they point at a board still in motion.
  const [openingDockSettled, setOpeningDockSettled] = useState(false);
  const firstBattleStepActive = ftueStepId === OPENING_MIST_CLEAR_STEP_ID && screenFocused;
  // A won battle's card (`BattleRewardCard`): its reward is written first, the card shows it, and Continue hands the
  // story on (or, off the story, leaves the track to come back under it). The Glow counts into the counter as it goes.
  const [battleReward, setBattleReward] = useState<(BattleReward & { before: number; finish: () => void }) | null>(null);
  const battleOutcomeRef = useRef<{ grade?: string } | null>(null);
  const gradeStars = (grade: string | undefined) => grade === 'perfect' ? 3 : grade === 'bright' ? 2 : 1;
  const completeFirstBattle = useCallback(async () => {
    // The first battle's light is the opening Glow (the same receipt the story's effect keeps): the Heart Tree's price.
    const before = mergeWorldRef.current.coins;
    const lit = await ensureStoredOpeningGlow(`${activeFtueRunId ?? 'current'}:opening-glow`).catch(() => null);
    await grantStoredStoryGlow(`${FIRST_BATTLE_ID}:xp:${activeFtueRunId ?? 'current'}`, 0, undefined, { katchimeraId: 'mossprout', amount: FIRST_BATTLE_XP }).catch(() => undefined);
    setBattleReward({ key: FIRST_BATTLE_ID, title: 'They found us', stars: gradeStars(battleOutcomeRef.current?.grade), glow: lit?.granted ? lit.amount : GLOW.firstRestorationCost, xp: FIRST_BATTLE_XP, before,
      finish: () => {
        clearMission(FIRST_BATTLE.storageKey);
        dispatchFtueEvent({ type: 'battle_won', battleId: FIRST_BATTLE_ID, revision: 1 }, FIRST_BATTLE_ID);
      } });
  }, [activeFtueRunId]);
  const firstBattle = useMistMission({ guided: false, active: firstBattleStepActive, mission: null, encounter: FIRST_BATTLE, owner: 'mossprout', loadout: FIRST_BATTLE_LOADOUT, world: mergeWorld, tileNode: homeTileNode,
    boardMetrics: openingDockSettled ? openingBoardMetrics : null, cameraSettled: ftueCameraSettled, glow: openingGlow, complete: completeFirstBattle, speechFor: firstBattleLine });
  // The Lost Trail's three battles (step 5), docked under the trail's tile the same way; each opens with its own card.
  const trailStoneIndex = (LOST_TRAIL_STONE_STEP_IDS as readonly string[]).indexOf(ftueStepId ?? '');
  const [trailIntroSeen, setTrailIntroSeen] = useState<string | null>(null);
  const trailStoneActive = (index: number) => trailStoneIndex === index && screenFocused && trailIntroSeen === LOST_TRAIL_STONE_STEP_IDS[index];
  const trailComplete = useMemo(() => LOST_TRAIL_BATTLES.map((encounter, index) => async () => {
    const battleId = LOST_TRAIL_STONE_BATTLE_IDS[index]!;
    const glow = LOST_TRAIL_STONE_GLOW[index]!;
    const before = mergeWorldRef.current.coins;
    // Paid once per run, whatever happens to the card: a relaunch replays the battle, never the payment.
    const xp = LOST_TRAIL_STONE_XP[index]!;
    await grantStoredStoryGlow(`${battleId}:${activeFtueRunId ?? 'current'}`, glow, undefined, { katchimeraId: 'mossprout', amount: xp }).catch(() => undefined);
    setBattleReward({ key: battleId, title: LOST_TRAIL_STONES[index]!.title, stars: gradeStars(battleOutcomeRef.current?.grade), glow, xp, before,
      finish: () => {
        clearMission(encounter.storageKey);
        dispatchFtueEvent({ type: 'battle_won', battleId, revision: 1 }, battleId);
      } });
  }), [activeFtueRunId]);
  const trailSpeech = useMemo(() => LOST_TRAIL_BATTLES.map((_, index) => (input: Parameters<typeof lostTrailLine>[1]) => lostTrailLine(index, input)), []);
  const trailBoardMetrics = openingDockSettled ? openingBoardMetrics : null;
  const trail1 = useMistMission({ guided: false, active: trailStoneActive(0), mission: null, encounter: LOST_TRAIL_BATTLES[0]!, owner: 'mossprout', loadout: FIRST_BATTLE_LOADOUT, world: mergeWorld, tileNode: lostTrailNode,
    boardMetrics: trailBoardMetrics, cameraSettled: ftueCameraSettled, glow: openingGlow, complete: trailComplete[0]!, speechFor: trailSpeech[0] });
  // One scripted battle is docked at a time: the first battle, or the Lost Trail stone under way.
  const trailBattle = trailStoneIndex >= 0 && trailStoneActive(trailStoneIndex) ? trail1 : null;
  const battle = firstBattleStepActive ? firstBattle : trailBattle;
  const battleEncounter = firstBattleStepActive ? FIRST_BATTLE : trailBattle ? LOST_TRAIL_BATTLES[trailStoneIndex]! : null;
  const openingBoardActive = Boolean(battle?.store.state);
  battleOutcomeRef.current = battle?.encounter?.outcome ?? null;
  const openingProgress = openingMistProgress(openingRun);
  const openingStep = ftueStepId ? mossproutFtueStep(ftueStepId) ?? null : null;
  // The same beat the dock projects: spotlight and finger on the first pairs, the Basket refill, or nothing.
  // The hand on the first two Seeds, until the first merge; then the board is the player's.
  // The first battle's finger (`firstBattleGuide`): every wake of the chain under the Mist, then whatever the board most
  // needs (a piece moved out of an empty lane under an uncovered wisp, else a pair to merge). The very first wake shows
  // at once, spotlit; each later wake a beat after the board settles; moves and merges once they have stood unanswered.
  // The finger holds still (`stickyBattleGuide`): a Seed landing never restarts it, only a hint that can no longer be
  // played or a more urgent one (a wisp over an open lane) replaces it.
  const shownGuideRef = useRef<ReturnType<typeof scriptedBattleGuide>>(null);
  const firstBattleHint = useMemo(() => {
    if (!(openingBoardActive && battleEncounter && battle?.store.state && battle.store.mechanicState)) { shownGuideRef.current = null; return null; }
    const next = stickyBattleGuide(shownGuideRef.current, scriptedBattleGuide(battleEncounter, battle.store.state, battle.store.mechanicState), battle.store.state);
    shownGuideRef.current = next;
    return next;
  }, [battle?.store.mechanicState, battle?.store.state, battleEncounter, openingBoardActive]);
  const firstBattleHintKey = firstBattleHint ? `${firstBattleHint.kind}:${firstBattleHint.from}:${firstBattleHint.to}` : null;
  const battleMerges = battle?.store.merges ?? 0;
  const firstBattleHintDelay = firstBattleStepActive && battleMerges === 0 ? 0 : firstBattleHint?.kind === 'wake' || battleMerges === 0 ? FIRST_BATTLE_WAKE_HINT_DELAY_MS : FIRST_BATTLE_HINT_DELAY_MS;
  const [shownBattleHint, setShownBattleHint] = useState<{ key: string; revision: number } | null>(null);
  useEffect(() => {
    setShownBattleHint(null);
    if (!firstBattleHintKey) return;
    const timer = setTimeout(() => setShownBattleHint((current) => ({ key: firstBattleHintKey, revision: (current?.revision ?? 0) + 1 })), firstBattleHintDelay);
    return () => clearTimeout(timer);
  // The delay belongs to the hint it was chosen with.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstBattleHintKey]);
  const openingBoardStep = useMemo((): FtueStepDefinition | null => {
    if (!openingBoardActive || !openingStep) return null;
    if (!firstBattleHint || shownBattleHint?.key !== firstBattleHintKey) return null;
    const from: FtueTarget = { kind: 'board_cell', cell: firstBattleHint.from };
    const to: FtueTarget = { kind: 'board_cell', cell: firstBattleHint.to };
    const first = firstBattleStepActive && battleMerges === 0;
    // Mossprout's line over the board already says why; the finger only shows how. The first is spotlit.
    return { ...openingStep, id: `${openingStep.id}.hint-${firstBattleHintKey}`, surface: 'merge', interaction: { mode: 'none' }, cue: { kind: 'drag', from, to },
      spotlight: first ? { targets: [from, to], grouping: 'bounding_rect', padding: 3, radius: 11, dimOpacity: 0.64 } : undefined, guide: { eyebrow: '', title: '', body: '' } };
  }, [battleMerges, firstBattleHint, firstBattleHintKey, firstBattleStepActive, openingBoardActive, openingStep, shownBattleHint?.key]);
  const openingBoardRevision = battleMerges * 1_000 + (shownBattleHint?.revision ?? 0);
  const openingGuidanceVisible = Boolean(openingBoardStep && (openingBoardStep.cue || openingBoardStep.spotlight));
  useEffect(() => { if (!openingBoardActive && !stepplingMissionActive && !journeyMissionActive && !islandRestoration) setOpeningDockSettled(false); }, [islandRestoration, journeyMissionActive, openingBoardActive, stepplingMissionActive]);
  const markOpeningDockSettled = useCallback(() => setOpeningDockSettled(true), []);
  // Steppling's mist mission and a journey episode's board: each its own store under its tile, played
  // by the mission's mechanic. The bar filling is what moves the story on, recorded the moment the
  // final item strikes the last wisp and the wisp has fallen.
  // A friend rescued (Steppling on his trailhead, Baristabbit at his window): one reveal, their misted tile crossblending
  // to their own tile with them fading in on it in the same beat. No Egg, no card. The write lands as it plays; `onDone`
  // runs when the tile has cleared.
  const friendRevealStartedRef = useRef<string | null>(null);
  const friendRevealDoneRef = useRef<(() => void) | null>(null);
  const playFriendReveal = useCallback(async (definition: HatchableCompanionDefinition, write: () => Promise<unknown>, onDone: () => void, runKey: string) => {
    const key = `${runKey}:${definition.tile.id}`;
    if (friendRevealStartedRef.current === key) return;
    friendRevealStartedRef.current = key;
    if (reduceMotion) { await write().catch(() => undefined); onDone(); return; }
    revealedUpgradeRef.current = null;
    friendRevealDoneRef.current = onDone;
    setUpgrading(true);
    setUpgradePresentation({
      cameraAlreadyFocused: true, characterId: definition.companion, coinCost: 0, coinOrigin: { x: 0, y: 0 },
      creatureId: `companion:${definition.companion}`, creatureName: definition.displayName, fromStage: 0, toStage: 1,
      nonce: ++upgradeNonceRef.current,
      palette: { accent: '#DDF6FF', glow: '#A9E4FF', mist: 'rgba(214,229,238,0.92)', primary: '#7FBFD9' },
      reactionLine: '', showCoins: false, status: 'playing', upgradeName: 'home',
      visualTarget: { kind: 'haven_structure', structureId: definition.tile.id },
      ftueReveal: definition.tile.id, noEgg: true,
    });
    await write().catch((error) => console.warn('The rescue could not be written', error));
  }, [reduceMotion]);
  // A friend rescued in a Lanes battle (cozy 4X v2: Baristabbit's lit window): the lead's rescue, paid once like the
  // Lost Trail's stones, with the battle's card before the story moves on to the reveal.
  const hatchableRescue = activeHatchable.mission.encounter ?? null;
  const rescueLeadLevel = katchimeraLevel(mergeWorld, 'mossprout');
  const hatchableRescueLoadout = useMemo((): EncounterLoadout => ({ companionId: 'mossprout', level: rescueLeadLevel }), [rescueLeadLevel]);
  const hatchableRescueGradeRef = useRef<string | undefined>(undefined);
  // The friend whose tile is clearing after their rescue battle: the board is put away while it plays.
  const [rescueRevealing, setRescueRevealing] = useState<string | null>(null);
  // Then their arrival scene (who they are, what they bring), before the goal widget comes back.
  const [arrivalTalk, setArrivalTalk] = useState<NonNullable<NonNullable<HatchableCompanionDefinition['mission']['rescue']>['arrival']> & { companion: string } | null>(null);
  const completeActiveHatchable = useCallback(async () => {
    const encounter = activeHatchable.mission.encounter;
    if (!encounter) return completeHatchableMission(activeHatchable);
    const before = mergeWorldRef.current.coins;
    const { glow, xp } = encounter.rewards;
    await grantStoredStoryGlow(`rescue:${activeHatchable.companion}:${activeHatchable.discoveryFlow.runId}`, glow, undefined, { katchimeraId: 'mossprout', amount: xp }).catch(() => undefined);
    const definition = activeHatchable;
    setBattleReward({ key: `rescue:${definition.companion}`, title: definition.tile.name, stars: gradeStars(hatchableRescueGradeRef.current), glow, xp: xp || undefined, before,
      finish: () => {
        // In order: the board steps away, the tile clears with the friend fading in on it, then the story moves on.
        setRescueRevealing(definition.companion);
        void playFriendReveal(definition, () => rescueStoredWorldFriend(definition.tile.unlockId), () => {
          const arrival = definition.mission.rescue?.arrival;
          if (arrival) setArrivalTalk({ ...arrival, companion: definition.companion });
          void completeHatchableMission(definition).catch((error) => console.warn('The rescue could not finish', error))
            .finally(() => setRescueRevealing(null));
        }, definition.discoveryFlow.runId);
      } });
  }, [activeHatchable, playFriendReveal]);
  const hatchableRescueSpeech = useMemo(() => {
    const copy = activeHatchable.mission.rescue;
    return hatchableRescue && copy ? (input: Parameters<typeof rescueBattleLine>[1]) => rescueBattleLine(hatchableRescue, input, copy) : undefined;
  }, [activeHatchable.mission.rescue, hatchableRescue]);
  // A rescue battle waits for its story: the intro card is read (once the camera is on the tile) before the wisps come.
  const [rescueIntroSeen, setRescueIntroSeen] = useState<string | null>(null);
  const rescueIntroPending = stepplingMissionActive && Boolean(hatchableRescue) && rescueIntroSeen !== activeHatchable.discoveryFlow.runId;
  const hatchableMist = useMistMission({ guided: !hatchableRescue, active: stepplingMissionActive && !rescueIntroPending && !rescueRevealing, mission: hatchableRescue ? null : activeHatchable.mission, encounter: hatchableRescue, owner: hatchableRescue ? 'mossprout' : activeHatchable.companion,
    loadout: hatchableRescue ? hatchableRescueLoadout : null, world: mergeWorld, tileNode: gatewayTileNode, boardMetrics: openingBoardMetrics, cameraSettled: ftueCameraSettled, glow: openingGlow, complete: completeActiveHatchable, speechFor: hatchableRescueSpeech });
  hatchableRescueGradeRef.current = hatchableMist.encounter?.outcome?.grade;
  const stepplingMission = hatchableMist.store;
  const stepplingMissionStep = hatchableMist.step;
  const stepplingMissionGuidanceVisible = hatchableMist.guidanceVisible;
  const stepplingMissionStalled = hatchableMist.stalled;
  const stepplingMissionLanded = hatchableMist.landed;
  useEffect(() => {
    // The mission is over once the reveal has played: its store goes with it.
    for (const definition of HATCHABLE_COMPANIONS) {
      const run = hatchableRuns.discovery[definition.companion];
      if (run?.status === 'completed' || run?.nodeId === 'gateway.egg') clearMission(definition.mission.storageKey);
    }
  }, [hatchableRuns.discovery]);
  const journeyMissionDefinition = journeyMission?.mission ?? null;
  const completeActiveJourneyMission = useCallback(() => journeyMission ? completeJourneyMission(journeyMission) : Promise.resolve(), [journeyMission]);
  const journeyMist = useMistMission({ active: journeyMissionActive, mission: journeyMissionDefinition, owner: journeyMission?.tile.companion ?? null, world: mergeWorld, tileNode: journeyTileNode, boardMetrics: openingBoardMetrics, cameraSettled: ftueCameraSettled, glow: openingGlow, complete: completeActiveJourneyMission });
  const journeyMissionStore = journeyMist.store;
  const journeyMissionStep = journeyMist.step;
  const journeyMissionGuidanceVisible = journeyMist.guidanceVisible;
  const journeyMissionLanded = journeyMist.landed;
  useEffect(() => {
    // The mission is over once the reveal has played: its store goes with it.
    for (const entry of JOURNEY_CONSEQUENCES) {
      const mission = journeyMissionOf(entry.episode);
      if (mission && journeyConsequenceRuns.runs[entry.runId]?.status === 'completed') clearMission(mission.mission.storageKey);
    }
  }, [journeyConsequenceRuns.runs]);
  const setGardenButtonNode = useCallback((node: View | null) => {
    registerFtueTarget('garden-button:mossprout', node);
  }, [registerFtueTarget]);
  const setGardenClusterNode = useCallback((node: View | null) => {
    registerFtueTarget('garden-cluster:mossprout', node);
  }, [registerFtueTarget]);
  const setGatewayNode = useCallback((node: View | null) => {
    setGatewayTileNodeState(node);
    registerFtueTarget(`shared-world:${activeHatchable.tile.id}`, node);
    registerFtueTarget('shared-world:gateway', node);
  }, [activeHatchable.tile.id, registerFtueTarget]);
  const setGardenPlotNode = useCallback((slotId: MossproutGardenPlantSlotId, node: View | null) => {
    registerFtueTarget(`garden-plot:mossprout:${slotId}`, node);
  }, [registerFtueTarget]);
  const setGardenWorldOfferNode = useCallback((node: View | null) => {
    registerFtueTarget('garden-plant-button:mossprout', ftueStepId === 'world.garden_arrival' || wispPlanting ? node : null);

  }, [ftueStepId, registerFtueTarget, wispPlanting]);
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
    || (ftueStepId === 'world.first_bloom_offer' && firstLightFailed)
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
    } else if (receipt.target.kind === 'haven_structure' && storyTileById(receipt.target.structureId)) {
      const tile = storyTileById(receipt.target.structureId)!;
      presentation = {
        cameraAlreadyFocused: true, characterId: tile.companion, coinCost: 0, coinOrigin,
        creatureId: mossproutSlot?.kind === 'owned' ? mossproutSlot.creature.creatureId : tile.companion, creatureName: mossproutSlot?.kind === 'owned' ? mossproutSlot.creature.name : 'Mossprout',
        fromStage: receipt.fromLevel as HavenStage, toStage: 1, nonce: ++upgradeNonceRef.current,
        palette: { accent: '#C9F29B', glow: '#A8E873', mist: 'rgba(226,255,213,0.88)', primary: '#4F9F57' },
        reactionLine: payload.reactionLine ?? tile.lines.reveal, showCoins: false,
        status: 'playing', storyPresentationKey: work.key, upgradeName: tile.name, visualTarget: payload.target,
      };
    } else if (receipt.target.kind === 'haven_structure') {
      const hatchable = hatchableByTile(receipt.target.structureId) ?? STEPPLING_HATCHABLE;
      presentation = {
        cameraAlreadyFocused: true, characterId: hatchable.companion, coinCost: receipt.coinCost, coinOrigin,
        creatureId: hatchable.companion, creatureName: 'A new friend', fromStage: receipt.fromLevel as HavenStage,
        toStage: 1, nonce: ++upgradeNonceRef.current,
        palette: { accent: '#FFE28A', glow: '#FFD98C', mist: 'rgba(226,255,213,0.88)', primary: '#4F9F57' },
        reactionLine: '', showCoins: receipt.coinCost > 0 && receipt.economyMode === 'normal',
        status: 'playing', storyPresentationKey: work.key, upgradeName: hatchable.tile.name, visualTarget: payload.target,
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

  const [openingRevealComplete, setOpeningRevealComplete] = useState(false);
  const [liftCaptionVisible, setLiftCaptionVisible] = useState(false);
  const completeUpgradePresentation = useCallback((presentation: HavenTileUpgradePresentation) => {
    // The canvas may report completion more than once; a single story owns the ack.
    if (revealedUpgradeRef.current === presentation.nonce) return;
    revealedUpgradeRef.current = presentation.nonce;
    if (presentation.tileLook || presentation.tileLevelUp) {
      setUpgradePresentation((current) => current?.nonce === presentation.nonce ? null : current);
      setUpgrading(false);
      setDisplayedGlow(mergeWorldRef.current.coins);
      return;
    }
    if (presentation.ftueReveal) {
      setUpgradePresentation((current) => current?.nonce === presentation.nonce ? null : current);
      setUpgrading(false);
      const done = friendRevealDoneRef.current;
      friendRevealDoneRef.current = null;
      done?.();
      return;
    }
    if (presentation.heartTree) {
      // The Heart Tree is awake (written before the reveal): the story moves on to the Sanctuary's title card.
      setUpgradePresentation((current) => current?.nonce === presentation.nonce ? null : current);
      setDisplayedGlow(mergeWorldRef.current.coins);
      setUpgrading(false);
      if (presentation.heartTree.grown) return;
      commitFtueAction({ actionId: HEART_TREE_ACTION_ID, evidenceRef: 'mossprout-world:heart-tree' });
      return;
    }
    if (presentation.veilLift) {
      // Completion includes the mist crossblend; the egg approach runs alongside it.
      setUpgradePresentation((current) => current?.nonce === presentation.nonce ? null : current);
      setOpeningRevealComplete(true);
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
      : presentation.visualTarget?.kind === 'haven_structure' && (hatchableByTile(presentation.visualTarget.structureId) || storyTileById(presentation.visualTarget.structureId))
        ? `mist:${presentation.visualTarget.structureId}` : `haven:${presentation.characterId}`;
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

  useEffect(() => {
    if (ftueStepId !== OPENING_MIST_LIFT_STEP_ID || !screenFocused) return;
    const timer = setTimeout(() => setLiftCaptionVisible(true), REVEAL_CAPTION_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ftueStepId, screenFocused]);
  // Keep the same caption through the approach and its settled reading beat.
  useEffect(() => {
    if (ftueStepId !== OPENING_MIST_LIFT_STEP_ID || !liftCaptionVisible || !openingRevealComplete || openingLiftCameraHeld || !ftueCameraSettled || !screenFocused) return;
    const timer = setTimeout(() => {
      commitFtueAction({ actionId: OPENING_LIFTED_ACTION_ID, evidenceRef: 'mossprout-world:veil-lifted' });
    }, LIFT_CAPTION_MIN_MS);
    return () => clearTimeout(timer);
  }, [ftueStepId, liftCaptionVisible, openingRevealComplete, openingLiftCameraHeld, ftueCameraSettled, screenFocused]);
  // Keep the earned Glow, but no reward flight competes with the egg reveal.
  useEffect(() => {
    if (ftueStepId !== OPENING_MIST_LIFT_STEP_ID) return;
    let cancelled = false;
    void ensureStoredOpeningGlow(`${activeFtueRunId ?? 'current'}:opening-glow`).then(result => {
      if (!cancelled) setDisplayedGlow(result.state.coins);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [activeFtueRunId, ftueStepId]);
  // The repair: a profile that reaches the first restore short of its light (the lift happened before
  // the light was kept, or the effect was interrupted) is granted it here under the same receipt.
  const firstLightRepairRef = useRef<string | null>(null);
  const repairFirstLight = useCallback(() => {
    setFirstLightFailed(false);
    return ensureStoredOpeningGlow(`${activeFtueRunId ?? 'current'}:opening-glow`)
      .then((result) => { if (result.state.coins < GLOW.firstRestorationCost) setFirstLightFailed(true); })
      .catch(() => setFirstLightFailed(true));
  }, [activeFtueRunId]);
  useEffect(() => {
    if (ftueStepId !== 'world.first_bloom_offer' && ftueStepId !== 'world.first_bloom_restore') return;
    if (mergeWorld.coins >= GLOW.firstRestorationCost) return;
    const key = `${activeFtueRunId ?? 'current'}:${ftueStepId}:first-light`;
    if (firstLightRepairRef.current === key) return;
    firstLightRepairRef.current = key;
    void repairFirstLight();
  }, [activeFtueRunId, ftueStepId, mergeWorld.coins, repairFirstLight]);
  // The opening's veil lift: one local crossblend per run at `world.mist_lift`,
  // rebuilt on a cold resume and committed exactly once when the canvas finishes.
  const veilLiftKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (homeVeil !== 'lifting') return;
    const key = `${activeFtueRunId ?? 'current'}:${OPENING_MIST_LIFT_STEP_ID}`;
    if (veilLiftKeyRef.current === key) return;
    veilLiftKeyRef.current = key;
    setOpeningRevealComplete(false);
    setLiftCaptionVisible(false);
    revealedUpgradeRef.current = null;
    setUpgradePresentation({
      cameraAlreadyFocused: true, characterId: 'mossprout', coinCost: 0, coinOrigin: { x: 0, y: 0 },
      creatureId: 'companion:mossprout', creatureName: 'Mossprout', fromStage: 0, toStage: 0,
      nonce: ++upgradeNonceRef.current,
      palette: { accent: '#DDF6FF', glow: '#A9E4FF', mist: 'rgba(214,229,238,0.92)', primary: '#7FBFD9' },
      reactionLine: '', showCoins: false, status: 'playing', upgradeName: 'clearing', veilLift: true,
    });
  }, [activeFtueRunId, homeVeil]);

  // The Last Clearing's Heart Tree (beat 8): the first light leaves the counter as coins, the Tree is written awake as
  // they fly, and the Heartwood crossblends from grey to stirring under the field of light. A relaunch after the write
  // finds the Tree awake and simply moves on; a failed write lets the button be pressed again.
  const heartTreeStartedRef = useRef<string | null>(null);
  const [heartTreeBusy, setHeartTreeBusy] = useState(false);
  const restoreHeartTree = useCallback(async () => {
    const runKey = activeFtueRunId ?? 'current';
    if (heartTreeStartedRef.current === runKey) return;
    heartTreeStartedRef.current = runKey;
    setHeartTreeBusy(true);
    const commit = () => commitFtueAction({ actionId: HEART_TREE_ACTION_ID, evidenceRef: 'mossprout-world:heart-tree' });
    try {
      if (mergeWorldRef.current.heartTree) { commit(); return; }
      const cost = GLOW.firstRestorationCost;
      const lit = await ensureStoredOpeningGlow(`${runKey}:opening-glow`);
      if (lit.state.coins < cost) await ensureStoredOpeningGlow(`${runKey}:heart-tree-light`, cost - lit.state.coins);
      const from = heartwoodStage(mergeWorldRef.current);
      const coinOrigin = await measureGlowCurrencyOrigin();
      const result = await restoreStoredHeartTree(`${runKey}:heart-tree`, cost);
      if (!result.restored) throw new Error(result.message ?? 'The Heart Tree could not be woken.');
      if (reduceMotion) { commit(); return; }
      const homeStage = (result.state.haven.tileStages.mossprout ?? 0) as HavenStage;
      revealedUpgradeRef.current = null;
      setUpgrading(true);
      setDisplayedGlow(result.state.coins + cost);
      setUpgradePresentation({
        cameraAlreadyFocused: true, characterId: 'mossprout', coinCost: cost, coinOrigin,
        creatureId: 'companion:mossprout', creatureName: 'Mossprout', fromStage: homeStage, toStage: homeStage,
        nonce: ++upgradeNonceRef.current,
        palette: { accent: '#FFE7A8', glow: '#FFD36B', mist: 'rgba(255,240,205,0.9)', primary: '#E0A23C' },
        reactionLine: '', showCoins: true, status: 'playing', upgradeName: 'Heart Tree',
        heartTree: { from, to: from === 'dormant' ? 'stirring' : from },
      });
    } catch (error) {
      console.warn('The Heart Tree could not be woken', error);
      heartTreeStartedRef.current = null;
    } finally {
      setHeartTreeBusy(false);
    }
  }, [activeFtueRunId, measureGlowCurrencyOrigin, reduceMotion]);
  // A relaunch after the Tree was written awake, but before the story moved on: move it on.
  useEffect(() => {
    if (ftueStepId !== HEART_TREE_STEP_ID || !screenFocused || !mergeWorld.heartTree || upgradePresentation || heartTreeStartedRef.current) return;
    heartTreeStartedRef.current = activeFtueRunId ?? 'current';
    commitFtueAction({ actionId: HEART_TREE_ACTION_ID, evidenceRef: 'mossprout-world:heart-tree' });
  }, [activeFtueRunId, ftueStepId, mergeWorld.heartTree, screenFocused, upgradePresentation]);
  const foundSanctuary = useCallback(() => {
    commitFtueAction({ actionId: SANCTUARY_ACTION_ID, evidenceRef: 'mossprout-world:sanctuary-founded' });
  }, []);
  // Step 4: the frontier pull-out, the tracks (Mossprout's lines, then the trail tapped) and the mission card.
  const seeFrontier = useCallback(() => {
    commitFtueAction({ actionId: FRONTIER_ACTION_ID, evidenceRef: 'mossprout-world:frontier-seen' });
  }, []);
  const [tracksLooked, setTracksLooked] = useState(false);
  useEffect(() => { if (ftueStepId !== LOST_TRACKS_STEP_ID) setTracksLooked(false); }, [ftueStepId]);
  const followTracks = useCallback(() => {
    commitFtueAction({ actionId: LOST_TRACKS_ACTION_ID, evidenceRef: `shared-world:${LOST_TRAIL_TILE_ID}` });
  }, []);
  // Step 5's payoff (`docs/cozy-4x-ftue-the-last-clearing.md`, beats 14 and 15). Each reveal is played locally while its
  // write lands (the Lost Trail clearing, then Steppling's tile opening with him home), and a relaunch after a write
  // simply moves on; the story's own effect after them guarantees both.
  const [stepplingPhase, setStepplingPhase] = useState<'reveal' | 'talk'>('reveal');
  const stepplingHome = mergeWorld.companionDiscovery.records.some((record) => record.characterId === 'steppling');
  // The rescue (Sept 25 2026): the Lost Trail is his own tile, so the last battle's win clears it at once. His misted
  // trailhead crossblends to his tile with him fading in on it (the rescue written as it plays), then his first words.
  useEffect(() => {
    if (ftueStepId !== STEPPLING_RESCUED_STEP_ID || !screenFocused || !ftueCameraSettled) return;
    const freed = () => commitFtueAction({ actionId: STEPPLING_RESCUED_ACTION_ID, evidenceRef: `shared-world:${LOST_TRAIL_TILE_ID}` });
    if (stepplingHome && !upgradePresentation && friendRevealStartedRef.current !== `${activeFtueRunId ?? 'current'}:steppling-home`) { freed(); return; }
    void playFriendReveal(STEPPLING_HATCHABLE, () => rescueStoredWorldFriend(STEPPLING_HATCHABLE.tile.unlockId), freed, activeFtueRunId ?? 'current');
  // A reveal already on screen is left to finish.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ftueStepId, ftueCameraSettled, screenFocused]);
  useEffect(() => {
    if (ftueStepId !== STEPPLING_MEETS_STEP_ID) { setStepplingPhase('reveal'); return; }
    if (!screenFocused || !ftueCameraSettled || stepplingPhase !== 'reveal' || upgradePresentation) return;
    // He is already home on his tile, seen as it cleared. (A save from before the rescue was written still clears the
    // tile here.) No card, no deck (the user, Sept 25 2026): his tile cleared with him on it; then his first words.
    if (stepplingHome) { setStepplingPhase('talk'); return; }
    void playFriendReveal(STEPPLING_HATCHABLE, () => rescueStoredWorldFriend(STEPPLING_HATCHABLE.tile.unlockId), () => setStepplingPhase('talk'), activeFtueRunId ?? 'current');
  // A reveal already on screen is left to finish.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ftueStepId, ftueCameraSettled, screenFocused, stepplingHome, upgradePresentation]);
  const welcomeSteppling = useCallback(() => {
    commitFtueAction({ actionId: STEPPLING_MEETS_ACTION_ID, evidenceRef: 'shared-world:steppling-home' });
  }, []);
  const stepplingJoined = useCallback(() => {
    commitFtueAction({ actionId: STEPPLING_JOINED_ACTION_ID, evidenceRef: 'mossprout-world:steppling-joined' });
  }, []);
  const comeHome = useCallback(() => {
    commitFtueAction({ actionId: HOME_ACTION_ID, evidenceRef: 'mossprout-world:home' });
  }, []);

  // Upgrading a building is a small version of upgrading a tile: the Glow leaves the top bar as coins, each one rocks
  // the building as it lands and the counter counts down with them; on the last landing the upgrade is written and
  // the tile upgrade's field of light (rays, embers, arrows) plays around the building while it glows.
  const HEARTWOOD_BUILDING_PALETTE = useMemo(() => ({ accent: '#C9F29B', glow: '#A8E873', mist: 'rgba(226,255,213,0.88)', primary: '#4F9F57' }), []);
  const [buildingFx, setBuildingFx] = useState<(HeartwoodBuildingFx & { id: HeartwoodBuildingId }) | null>(null);
  const [buildingImpact, setBuildingImpact] = useState<{ id: HeartwoodBuildingId; nonce: number } | null>(null);
  const buildingFxNonceRef = useRef(0);
  const buildingFxTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { for (const timer of buildingFxTimersRef.current) clearTimeout(timer); }, []);
  const playHeartwoodBuildingFx = useStableCallback(async <T extends { state: MergeWorldState }>(id: HeartwoodBuildingId, cost: number, write: () => Promise<T>, options?: { /** Resolve once the field of light has finished too, not at the write (the first session waits for the whole thing). */ settleAfterField?: boolean }): Promise<T> => {
    const building = heartwoodBuildingById.get(id)!;
    const nonce = ++buildingFxNonceRef.current;
    const timers = buildingFxTimersRef.current;
    const later = (ms: number, action: () => void) => { timers.push(setTimeout(action, ms)); };
    const coinOrigin = await measureGlowCurrencyOrigin();
    setGlowSpend({ amount: cost, counting: false });
    setBuildingFx({ id, nonce, slotId: building.slotId, coinOrigin, palette: HEARTWOOD_BUILDING_PALETTE, phase: 'payment',
      onCoinLanded: () => setBuildingImpact((current) => ({ id, nonce: (current?.nonce ?? 0) + 1 })) });
    // The counter follows the coins down; the world is written as the last one seats.
    later(180, () => setGlowSpend({ amount: cost, counting: true }));
    const settled = new Promise<T>((resolve, reject) => {
      later(COIN_FLIGHT_WINDOW_MS, () => { write().then(resolve, reject); });
    });
    try {
      const result = await settled;
      setDisplayedGlow(result.state.coins);
      setBuildingFx((current) => current?.nonce === nonce ? { ...current, phase: 'cover' } : current);
      later(320, () => setBuildingFx((current) => current?.nonce === nonce ? { ...current, phase: 'reveal' } : current));
      later(900, () => setBuildingFx((current) => current?.nonce === nonce ? { ...current, phase: 'react' } : current));
      const over = new Promise<void>((resolve) => later(1_500, () => { setBuildingFx((current) => current?.nonce === nonce ? null : current); setGlowSpend(null); resolve(); }));
      if (options?.settleAfterField) await over;
      return result;
    } catch (error) {
      setBuildingFx((current) => current?.nonce === nonce ? null : current);
      setGlowSpend(null);
      throw error;
    }
  });
  const upgradeHeartwoodBuildingWithFx = useStableCallback((id: HeartwoodBuildingId, expectedLevel: number) => {
    const cost = heartwoodBuildingCost(expectedLevel) ?? 0;
    // Reduced motion, or nothing to pay: the write alone, as before.
    if (reduceMotion || cost <= 0 || buildingFx) return upgradeStoredHeartwoodBuilding(id, expectedLevel);
    return playHeartwoodBuildingFx(id, cost, () => upgradeStoredHeartwoodBuilding(id, expectedLevel));
  });
  const beginFirstSeedPlanting = useCallback(() => {
    if (ftueStepId !== 'world.garden_arrival' || firstSeedPlantStartedRef.current) return;
    firstSeedPlantStartedRef.current = true;
    setFirstSeedPlacementBusy(true);
    setFirstSeedPlacementFailed(false);
    // The planting is the first session's one build, and it looks like every build after it: the light leaves the
    // top bar as coins, the patch flashes under each, and the Spring swells up out of the glow as the story's own
    // step writes it. The write is the story's, so a relaunch lands exactly where it always did.
    const build = async () => {
      const placement = await ensureStoredFirstSpringBuilt();
      if (!placement.placed) throw new Error('The Dew Spring could not be built.');
      // Heartwood's introduction used to be a sheet before this tap; the planting itself is the introduction now.
      await applyStoredAdventure({ type: 'presented', scene: 'introduction' }).catch(() => undefined);
      return placement;
    };
    const advance = async () => {
      const result = await advanceFtueActionDurably({
        expectedStepId: 'world.garden_arrival',
        actionId: 'world.plant_first_seed',
        evidenceRef: `garden-plot:${MOSSPROUT_FIRST_MEMORY_SLOT_ID}`,
        nextStepId: 'world.first_seed_grew',
      });
      if (result.run?.stepId !== 'world.first_seed_grew') throw new Error('The Garden did not accept the Spring.');
    };
    const cost = heartwoodBuildingCost(0) ?? 0;
    // The Spring's price is on the counter first (the opening's light, or a top-up for a profile that spent it); the
    // world is written as the last coin lands; the story moves on only once the field of light is over.
    void ensureStoredFirstSpringLight(activeFtueRunId ?? 'current').then((lit) => {
      setDisplayedGlow(lit.coins);
      const paid = lit.coins >= cost && cost > 0;
      return reduceMotion || !paid || buildingFx ? build() : playHeartwoodBuildingFx(FIRST_SEED_BUILDING_ID, cost, build, { settleAfterField: true });
    }).then(advance).catch(async () => {
      // The resume snapshot is committed before the Content Flow effect. If
      // that dispatch is interrupted, finish the idempotent placement here
      // instead of making the player's first tap a no-op.
      const run = loadFtueRun();
      if (run?.status === 'active' && run.stepId === 'world.first_seed_grew') {
        try {
          const placement = await ensureStoredFirstSpringBuilt();
          if (placement.placed) {
            setFirstSeedPlacementFailed(false);
            return;
          }
        } catch {
          // Keep the visible Build action retryable below.
        }
      }
      firstSeedPlantStartedRef.current = false;
      setFirstSeedPlacementFailed(true);
    }).finally(() => setFirstSeedPlacementBusy(false));
  }, [activeFtueRunId, buildingFx, ftueStepId, playHeartwoodBuildingFx, reduceMotion]);

  const ensureFirstSeedPlacement = useCallback(async () => {
    const placement = await ensureStoredFirstSpringBuilt();
    return placement.placed;
  }, []);

  const heartwoodWoken = (mergeWorld.haven.tileStages.mossprout ?? 0) >= 1;
  useEffect(() => {
    if (firstSeedPlanted && heartwoodWoken) {
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
  }, [activeFtueRunId, ensureFirstSeedPlacement, firstSeedPlanted, ftueStepId, heartwoodWoken]);

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

  // The bud is a caption over the world, never a sheet: once it has had its moment the story goes back to Mossprout by itself.
  const firstSeedGrewShown = ftueStepId === 'world.first_seed_grew' && firstSeedGrown && !holdFirstSeedGraphic && !upgradePresentation && ftueCameraSettled && screenFocused && !ftueReturnFocusCreatureId && !buildingFx;
  useEffect(() => {
    if (!firstSeedGrewShown) return;
    const timer = setTimeout(beginFirstSeedReturn, reduceMotion ? 300 : 1_600);
    return () => clearTimeout(timer);
  }, [beginFirstSeedReturn, firstSeedGrewShown, reduceMotion]);

  const selectResident = useCallback((creatureId: string) => {
    const presentation = havenPresentations.find((candidate) => candidate.creatureId === creatureId);
    if (ftueStepId === 'haven.mossprout.focus' && presentation?.characterId !== 'mossprout') return;
    if (ftueStepId === 'haven.mossprout.restore') return;
    // A family with no authored page is a resident to look at, never to talk to. The family comes from the
    // slot (the haven presentation only exists for a misted Mossprout tile), then from the creature id itself.
    const tappedSlot = visibleCompanionSlots.find((slot) => slot.kind === 'owned' && slot.creature.creatureId === creatureId);
    const tappedFamilyId = (tappedSlot?.kind === 'owned' ? tappedSlot.familyId : null) ?? familyIdFromCompanionId(creatureId) ?? presentation?.characterId;
    // Cozy 4X: a friend on the map is a hero. Tapping one opens their hero panel (level, ability, training), never the
    // companion-life page (Bond, meditation, day one) the old first session used; a friend who cannot fight is looked at.
    if (sanctuaryFounded(mergeWorldRef.current) && !ftueStepId) {
      if (tappedFamilyId && openFriendPanel(tappedFamilyId as MergeCharacterId)) setDetailCreatureId(null);
      else setDetailCreatureId(creatureId);
      return;
    }
    if (!companionHasPage(tappedFamilyId)) { setDetailCreatureId(creatureId); return; }
    setDetailCreatureId(null);
    setHostedInteractionRequest(null);
    setInteractionCameraReady(false);
    setInteractionExiting(false);
    setInteractionCreatureId(creatureId);
  }, [ftueStepId, havenPresentations, visibleCompanionSlots]);

  useEffect(() => {
    if (!stepplingEggOpen || !hatchableEggProgress(mergeWorld, encounterHatchable)?.hatchedAt) return;
    const resident = companionSlots.find((slot) => slot.kind === 'owned' && slot.familyId === encounterHatchable.companion);
    if (resident?.kind !== 'owned') return;
    // Swap the hatch actor and hosted resident together, after durable ownership
    // has arrived. The canvas carries the Egg camera origin into normal Back.
    selectResident(resident.creature.creatureId);
    closeStepplingEgg();
  }, [encounterHatchable, closeStepplingEgg, companionSlots, mergeWorld, selectResident, stepplingEggOpen]);

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
      // The bud was a sheet once; its receipt is kept so the road and the recap rule read as before.
      void applyStoredAdventure({ type: 'presented', scene: 'signal' }).catch(() => undefined);
      void advanceFtueActionDurably({
        expectedStepId: 'world.first_seed_grew',
        actionId: 'world.acknowledge_first_seed_growth',
        evidenceRef: 'mossprout-world:first-seed-grew',
        nextStepId: 'companion.first_rest',
      }).then((result) => {
        if (result.run?.stepId === 'companion.first_rest') return;
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
    setInteractionExitHandsOver(false);
    setInteractionLoadingVisible(false);
    setHostedInteractionRequest(null);
    setInteractionCreatureId(null);
    setPendingIslandCampaign(null);
    setEventSelection(current => current?.kind === 'board' ? current : null);
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
  const requestResidentInteractionExit = useCallback((options?: { handsOver?: boolean }) => {
    if (!interactionCreatureIdRef.current) return;
    const run = loadFtueRun();
    // Back accepts the same durable mist handoff as the tutorial card.
    // The hosted controller opens the destination before calling us to exit.
    if (run?.status === 'active' && run.stepId === 'companion.meditating') {
      setMistExitError(false);
      // The first session ends here. It used to hand over to the Merge page, which closed this page on the way out;
      // with the page gone, the rest closes it and the Haven takes over (Steppling's clearing is next).
      void advanceFtueActionDurably({ expectedStepId: 'companion.meditating', actionId: 'companion.tend_garden' })
        .then(() => {
          setInteractionCameraReady(false);
          setInteractionExitHandsOver(true);
          setInteractionExiting(true);
          setInteractionExitNonce((current) => current + 1);
        })
        .catch(() => setMistExitError(true));
      return;
    } else if (ftueStepId && run?.status !== 'complete') return;
    // Called by Mossprout's page right after the rest completed the first session (this render still sees the
    // meditating step): Steppling's clearing owns the camera now.
    const restHandoff = options?.handsOver === true || (ftueStepId === 'companion.meditating' && run?.status === 'complete');
    setInteractionCameraReady(false);
    if (restHandoff) setInteractionExitHandsOver(true);
    setInteractionExiting(true);
    setInteractionExitNonce((current) => current + 1);
  }, [ftueStepId]);
  // The page's overlay never waits on a camera callback alone: a later camera move (a story directive, a resume
  // camera) cancels the exit's move and drops its completion. Past the exit's own duration, the page closes anyway.
  useEffect(() => {
    if (!interactionExiting) return;
    const timer = setTimeout(closeResidentInteraction, reduceMotion ? 600 : 1_400);
    return () => clearTimeout(timer);
  }, [closeResidentInteraction, interactionExiting, interactionExitNonce, reduceMotion]);
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
    // The campaign pivot: the Merge page is gone. Every old way into it (a request card, a lesson, a shortcut) now
    // just clears what was open and leaves the player on the Haven, where the Mist is.
    void orderId; void requestedFamilyId;
    setSelectedUpgrade(null);
    setUpgradeError(null);
    if (MERGE_PAGE_REMOVED) return;
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
    // A scene plays once ever. If it has already been heard but its world write never landed (a crash, or a chapter
    // that could not close at the time), replay only the durable step: never strand a chapter behind a scene it cannot show.
    if (phase !== 'opening' && loadCompanionContentState().conversationSessions.some((session) => !session.preview && companionInitialConversationCompletionReady(session, definitionId))) {
      void (phase === 'return' ? acknowledgeStoredIslandCampaignChapterReturn(campaign.campaignId, level) : completeStoredIslandCampaignChapter(campaign.campaignId, level))
        .catch((error) => console.warn('The island chapter could not move on', error));
      return;
    }
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

  const handleIslandCampaignPanelAction = useCallback((choice?: EncounterLoadoutChoice) => {
    if (sharedUpgradeCampaign) runIslandCampaignActionRef.current?.(sharedUpgradeCampaign, choice);
  }, [sharedUpgradeCampaign]);
  const runIslandCampaignActionRef = useRef<((campaign: IslandCampaignDefinition, choice?: EncounterLoadoutChoice) => void) | null>(null);
  /** What a friend's island does next (a story beat, a board kept from before the pivot, a rung), from its panel or its level track. */
  const runIslandCampaignAction = useCallback((campaign: IslandCampaignDefinition, choice?: EncounterLoadoutChoice) => {
    const progress = islandCampaignUpgradePanelState(mergeWorldRef.current, campaign);
    if (!campaign || !progress?.action) return;
    if (progress.action === 'enter_mist' || progress.action === 'resume_mist') {
      // Into the Mist: the rung docks under the island with the Katchimera and Wisp chosen on the panel.
      const rung = progress.rung;
      if (!rung) return;
      const remembered = mergeWorldRef.current.encounters?.loadout;
      const picked: EncounterLoadoutChoice = choice ?? { katchimeraId: remembered?.katchimeraId ?? 'mossprout', helperWispId: remembered?.helperWispId ?? null, partnerId: remembered?.partnerId ?? null };
      const loadout = battleLoadout(mergeWorldRef.current, withPartner(mergeWorldRef.current, picked, playableHeroes(mergeWorldRef.current)));
      void startStoredEncounter({ missionId: rung.mission.id, runId: encounterRunId(rung.mission.encounter, 1, loadout), campaignId: campaign.campaignId, katchimeraId: loadout.companionId, helperWispId: loadout.wispId ?? null, partnerId: loadout.partner?.companionId ?? null }).catch(() => undefined);
      setIslandEncounter({ campaignId: campaign.campaignId, islandId: campaign.islandId, mission: rung.mission, loadout });
      setSelectedUpgrade(null);
      return;
    }
    if (progress.action === 'open_merge') {
      openGarden(progress.order?.id, 'mossprout');
      return;
    }
    if (progress.action === 'continue_restoring') {
      // Bring this friend's board back under their island.
      setRestorationFocusCampaignId(campaign.campaignId);
      setRestorationOpen(true);
      setSelectedUpgrade(null);
      return;
    }
    openIslandCampaignNarrative(campaign, progress.level, progress.action === 'start_story'
      ? 'opening'
      : progress.action === 'continue_return' ? 'return' : 'resolution');
    setSelectedUpgrade(null);
  }, [openGarden, openIslandCampaignNarrative]);
  runIslandCampaignActionRef.current = runIslandCampaignAction;

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
      setTrackReopen({ kind: 'island', campaignId: campaign.campaignId });
      requestResidentInteractionExit();
      return;
    }
    if (phase === 'resolution') {
      await completeStoredIslandCampaignChapter(campaign.campaignId, chapter.level);
      // A finished island has nothing left to show but its replays; the next chapter's story waits on its track.
      setTrackReopen({ kind: 'island', campaignId: campaign.campaignId });
      requestResidentInteractionExit();
      return;
    }
    const selectedOptionId = islandCampaignSelectedChoice(campaign, chapter.level, session.turns.map((turn) => turn.optionId))?.id;
    if (!selectedOptionId) throw new Error('Choose how this part of the garden should grow.');
    // The campaign pivot: the chapter plays as rungs of the island's ladder, free; the answer still shapes the story.
    const stageCost = 0;
    if (stageCost > 0) setGlowSpend({ amount: stageCost, counting: false });
    let result: Awaited<ReturnType<typeof activateStoredIslandCampaignChapter>>;
    try {
      result = await activateStoredIslandCampaignChapter({
        campaignId: campaign.campaignId,
        islandId: campaign.islandId,
        residentSkinId: campaign.residentSkinId,
        level: chapter.level,
        selectedOptionId,
        orders: [],
      });
    } catch (error) { setGlowSpend(null); throw error; }
    const campaignProgress = result.state.islandCampaigns?.[campaign.campaignId]
      ?.chapters[String(chapter.level)];
    if (chapter.restoration && campaignProgress?.restoration) {
      // A chapter from before the pivot, still on its board: paid here (the first is the gift); the board docks under the island once the conversation closes.
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
      // The board that docks is the one this answer just opened, not another friend's left unfinished.
      setRestorationFocusCampaignId(campaign.campaignId);
      setRestorationOpen(true);
      requestResidentInteractionExit();
      return;
    }
    const activeOrderId = campaignProgress?.orderIds.at(-1);
    if (activeOrderId) { openGarden(activeOrderId, 'mossprout'); return; }
    // The campaign pivot: the chapter plays as levels. The conversation closes and its first level starts (the one the
    // player pressed, or the chapter's first after a discovery); the island's levels come back up when nothing waits.
    if (!levelAfterStoryRef.current || levelAfterStoryRef.current.campaignId !== campaign.campaignId) {
      const first = regionLadder(campaign).find((rung) => rung.chapterLevel === chapter.level);
      const remembered = mergeWorldRef.current.encounters?.loadout;
      if (first) setLevelAfterStory({ campaignId: campaign.campaignId, missionId: first.mission.id, choice: { katchimeraId: remembered?.katchimeraId ?? 'mossprout', helperWispId: remembered?.helperWispId ?? null } });
      else setTrackReopen({ kind: 'island', campaignId: campaign.campaignId });
    }
    requestResidentInteractionExit();
  }, [measureGlowCurrencyOrigin, openGarden, openingGlow, pendingIslandCampaign, requestResidentInteractionExit]);

  const openWorldEvent = useCallback(async (action: WorldEventAction) => {
    if (eventBusy.current) return;
    eventBusy.current = true;
    setEventError('');
    try {
      const companionId = action.encounter.companionId ?? 'mossprout';
      const mossprout = visibleCompanionSlots.find(slot => slot.kind === 'owned' && slot.familyId === companionId);
      if (!mossprout || mossprout.kind !== 'owned') throw new Error('This friend must be home to explore their disturbance.');
      await applyStoredLocalEvent({ type: 'join', eventId: action.event.id });
      if (action.phase === 'order') { openGarden(`local-event:${action.event.id}:${action.encounter.id}`, companionId); return; }
      const kind = action.phase === 'board' ? 'board' : action.phase === 'resolution' ? 'resolution' : 'opening';
      if (kind === 'board') { setEventSelection({ eventId: action.event.id, nodeId: action.encounter.id, kind }); return; }
      const conversation = worldEventConversation(action, kind);
      companionConversationDefinitionById.set(conversation.id, conversation);
      // A crash can land between dialogue acknowledgement and the world write.
      // Replay only the durable handoff; do not strand behind a once-ever conversation.
      if (loadCompanionContentState().conversationSessions.some(session => !session.preview
        && companionInitialConversationCompletionReady(session, conversation.id)
        && (!session.dialoguePresentation || session.dialogueAcknowledgedAt))) {
        await applyStoredLocalEvent({ type: kind === 'opening' ? 'begin' : 'resolve', eventId: action.event.id, nodeId: action.encounter.id });
        setEventSelection(null);
        return;
      }
      setEventSelection({ eventId: action.event.id, nodeId: action.encounter.id, kind });
      setDetailCreatureId(null);
      setInteractionCameraReady(false);
      setInteractionExiting(false);
      setHostedInteractionRequest({ creatureId: mossprout.creature.creatureId, journeyReturnConversationDefinitionId: conversation.id, key: conversation.id });
      setInteractionCreatureId(mossprout.creature.creatureId);
    } catch (error) { setEventError(error instanceof Error ? error.message : 'The disturbance could not open. Try again.'); }
    finally { eventBusy.current = false; }
  }, [openGarden, visibleCompanionSlots]);
  const completeWorldEventConversation = useCallback(async () => {
    if (!eventSelection || eventSelection.kind === 'board' || eventBusy.current) return;
    eventBusy.current = true;
    try {
      await applyStoredLocalEvent({ type: eventSelection.kind === 'opening' ? 'begin' : 'resolve', eventId: eventSelection.eventId, nodeId: eventSelection.nodeId });
      setEventSelection(null);
      requestResidentInteractionExit();
    } catch (error) {
      setEventError(error instanceof Error ? error.message : 'Please resume this encounter to try again.');
      requestResidentInteractionExit();
    } finally { eventBusy.current = false; }
  }, [eventSelection, requestResidentInteractionExit]);


  // The restoration board itself: its store, its deliveries, its checkpoint and its finish.
  const mechanicPreview = useDevMissionMechanicPreview();
  const restorationDefinition = useMemo(() => islandRestoration?.chapter.restoration ? resolveRestorationForPlay(islandRestoration.chapter.restoration, mechanicPreview) : null, [islandRestoration, mechanicPreview]);
  const restorationBinding = useMemo(() => restorationDefinition ? { host: restorationMechanicHost(restorationDefinition), window: missionWindow(restorationDefinition.rows) } : null, [restorationDefinition]);
  // The friend's own voice over their board when authored; module constants, so the wisp target stays stable.
  const restorationWispLines = islandRestoration?.campaign.copy.wispLines ?? ISLAND_WISP_LINES;
  // The run names the stage's start and the board's authoring: a restarted or re-authored stage never inherits a saved board.
  const restorationBoardRunId = islandRestoration && restorationDefinition ? restorationRunId(islandRestoration.campaign.campaignId, islandRestoration.level, islandRestoration.progress.startedAt, restorationDefinition) : null;
  const createRestorationBoard = useCallback((now: number) => createRestorationState(restorationDefinition!, now), [restorationDefinition]);
  const repairRestorationBoard = useCallback((state: MergeWorldState) => restorationDefinition ? restoreRestorationEchoes(restorationDefinition, state) : state, [restorationDefinition]);
  const restorationStore = useMissionBoard(islandRestoration ? previewMissionStorageKey(restorationStorageKey(islandRestoration.campaign.campaignId, islandRestoration.level), mechanicPreview) : 'katchimeras.mist-mission.none.v1', restorationBoardRunId, createRestorationBoard, repairRestorationBoard, restorationBinding);
  const restorationChapterProgress = islandRestoration ? mergeWorld.islandCampaigns?.[islandRestoration.campaign.campaignId]?.chapters[String(islandRestoration.level)] ?? null : null;
  const islandEncounterActive = Boolean(islandEncounterRung) && screenFocused && !upgradePresentation && !interactionCreatureId && !pendingIslandCampaign && !stepplingMissionActive && !journeyMissionActive && !openingBoardActive;
  // A Lanes battle (`docs/encounter-lanes.md`) on the island: the screen's own chrome stays out of its way.
  const laneBattleActive = islandEncounterActive && islandEncounterRung?.mission.encounter?.mechanic?.kind === 'lanes';
  // A battle's dock fades in afresh: its wisps wait for it to settle (below), so each level starts unsettled.
  const islandEncounterMissionId = islandEncounterActive ? islandEncounterRung?.mission.id ?? null : null;
  useEffect(() => { setOpeningDockSettled(false); }, [islandEncounterMissionId]);
  const islandEncounterRef = useRef(islandEncounter);
  islandEncounterRef.current = islandEncounter;
  const islandEncounterRungRef = useRef(islandEncounterRung);
  islandEncounterRungRef.current = islandEncounterRung;
  const leaveIslandEncounter = useCallback(() => {
    void abandonStoredEncounter().catch(() => undefined);
    setIslandEncounter(null);
  }, []);
  const islandMistOutcomeRef = useRef<{ outcome: import('@/features/encounter/outcome').EncounterOutcome | null; runId: string | null }>({ outcome: null, runId: null });
  /**
   * The island's lift, from the win that starts it until its upgrade sequence has played out. The friend's discovery
   * reveal waits for all of it: the lift is queued a beat after the win and its sequence builds a few frames after
   * that, and the reveal used to slip into those gaps, get cut off by the sequence, then come back after it.
   */
  const [islandLiftHold, setIslandLiftHold] = useState(false);
  const liftSequenceSeenRef = useRef(false);
  useEffect(() => {
    if (!islandLiftHold) { liftSequenceSeenRef.current = false; return; }
    if (upgradeHandoffPending || upgradePresentation || requiredUpgradeStory) { liftSequenceSeenRef.current = true; return; }
    // The sequence has been and gone: the reveal may come.
    if (liftSequenceSeenRef.current) { setIslandLiftHold(false); return; }
    // Never seen at all (the lift did not queue a sequence): let go after a while rather than hold the reveal forever.
    const timer = setTimeout(() => setIslandLiftHold(false), ISLAND_LIFT_HOLD_MAX_MS);
    return () => clearTimeout(timer);
  }, [islandLiftHold, requiredUpgradeStory, upgradeHandoffPending, upgradePresentation]);
  /** A friend's first level won: the Mist lifts through the same reveal (and its presentation) a paid reveal used to run, free. */
  const liftIslandMist = useStableCallback(async (campaignId: string) => {
    const campaign = islandCampaignById.get(campaignId);
    if (!campaign) return;
    const offer = worldUpgradeOffers(mergeWorldRef.current).find((candidate) => candidate.id === `nature:${campaign.islandId}` && candidate.transition === 'island_reveal');
    if (!offer) return;
    setIslandLiftHold(true);
    try {
      const run = await purchaseWorldUpgrade(offer, { beforeValidation: flushMergeWorld });
      if (run?.status === 'failed_recoverable') { setIslandLiftHold(false); setTrackNotice('The Mist did not lift yet. Tap Lift the Mist to try again.'); }
    } catch (error) {
      console.warn('The Mist could not lift', error);
      setIslandLiftHold(false);
      setTrackNotice('The Mist did not lift yet. Tap Lift the Mist to try again.');
    }
  });
  /** A friend pack named by a clear or a chest joins that Katchimera's Wisps (its receipt keeps it to once). */
  const grantTrackPack = useCallback((pack: { receiptId: string; familyId: string; kind: 'gift' | 'gift-rare' | 'finale' | 'bright' }) => {
    commandFriendWispPacks({ type: 'grant', receiptId: pack.receiptId, familyId: pack.familyId, kind: pack.kind, seed: Math.floor(Math.random() * 4294967296) });
  }, []);
  const payIslandKeepGoing = useCallback((receiptId: string) => payStoredEncounterContinue(receiptId, GLOW.keepGoingCost), []);
  const completeIslandEncounter = useCallback(async () => {
    const focus = islandEncounterRef.current;
    const found = islandEncounterRungRef.current;
    const { outcome, runId } = islandMistOutcomeRef.current;
    if (!focus || !found || !outcome || !runId) return;
    const result = await completeStoredEncounter({
      receiptId: `encounter:${runId}`, missionId: focus.mission.id, ...(focus.campaignId ? { campaignId: focus.campaignId } : {}),
      katchimeraId: focus.loadout.companionId, helperWispId: focus.loadout.wispId ?? null, partnerId: focus.loadout.partner?.companionId ?? null,
      outcome, difficulty: found.mission.difficulty, base: found.mission.rewards,
    });
    // The won board is done with: its save goes, so a replay (or the level again after a reset) starts a fresh board
    // instead of loading a won one and clearing on arrival.
    if (found.mission.encounter?.storageKey) clearMission(found.mission.encounter.storageKey);
    // The friend who was there remembers it: Bond, and the day's sparks toward their pouch.
    recordEncounterBond(result);
    const cleared = result.encounterCleared;
    if (cleared?.bossPack) grantTrackPack({ ...cleared.bossPack, kind: 'bright' });
    if (cleared) setBattleReward({ key: `encounter:${runId}`, title: found.mission.title, stars: gradeStars(cleared.grade), glow: cleared.glow, xp: cleared.xp || undefined, xpEach: Boolean(cleared.partnerId),
      before: Math.max(0, result.state.coins - cleared.glow), finish: () => undefined });
    setIslandEncounter(null);
    // A friend's first level lifts their island's Mist, and the discovery that always followed it plays.
    if (focus.campaignId && isMistLevel(focus.mission.id) && cleared?.firstClear) { setIslandLiftHold(true); void liftIslandMist(focus.campaignId); return; }
    // A chapter's last level grows the island and its closing conversation opens on its own; that story brings the
    // track back when it ends. Any other level lands straight back on its tile's levels.
    if (cleared?.islandRaised) return;
    setTrackReopen(focus.campaignId ? { kind: 'island', campaignId: focus.campaignId }
      : focus.mission.id.startsWith('daily:') ? { kind: 'daily' } : { kind: 'grove' });
  }, [grantTrackPack, liftIslandMist]);
  const islandMist = useMistMission({ guided: false, keepGoingCost: GLOW.keepGoingCost, payKeepGoing: payIslandKeepGoing, active: islandEncounterActive, mission: null, encounter: islandEncounterRung?.mission.encounter ?? null, owner: 'mossprout', loadout: islandEncounter?.loadout ?? null, world: mergeWorld, tileNode: islandEncounterTileNode,
    // A battle's wisps stand on the board's cells: they appear only once the dock has finished rising, where they stay.
    boardMetrics: openingDockSettled ? openingBoardMetrics : null, cameraSettled: ftueCameraSettled, glow: openingGlow, complete: completeIslandEncounter, onLeave: leaveIslandEncounter });
  islandMistOutcomeRef.current = { outcome: islandMist.encounter?.outcome ?? null, runId: islandMist.runId };
  const islandEncounterBusy = islandEncounterActive && !islandMist.landed;
  useEffect(() => {
    // Back puts the encounter away (the board keeps); it never leaves the Kingdom from here.
    if (!islandEncounterActive) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { leaveIslandEncounter(); return true; });
    return () => subscription.remove();
  }, [islandEncounterActive, leaveIslandEncounter]);
  /** A level from a track, docked under its tile: a friend's island under theirs, the Grove and the Daily Mist under Mossprout's. */
  const enterTrackLevel = useCallback((node: LevelNode, choice: EncounterLoadoutChoice) => {
    const mission = node.mission;
    const open = trackOpenRef.current;
    if (!mission || !open || hatchableStoryOpenRef.current) return;
    const campaign = open.kind === 'island' ? islandCampaignById.get(open.campaignId) ?? null : null;
    if (campaign && node.opensStory) {
      // The story in front of this level plays first; the level starts when it closes.
      setTrackOpen(null);
      setTrackNotice(null);
      setLevelAfterStory({ campaignId: campaign.campaignId, missionId: mission.id, choice });
      runIslandCampaignActionRef.current?.(campaign);
      return;
    }
    const loadout = battleLoadout(mergeWorldRef.current, choice);
    void startStoredEncounter({ missionId: mission.id, runId: encounterRunId(mission.encounter, 1, loadout), ...(campaign ? { campaignId: campaign.campaignId } : {}), katchimeraId: loadout.companionId, helperWispId: loadout.wispId ?? null, partnerId: loadout.partner?.companionId ?? null }).catch(() => undefined);
    setTrackOpen(null);
    setTrackNotice(null);
    setIslandEncounter(campaign ? { campaignId: campaign.campaignId, islandId: campaign.islandId, mission, loadout } : { mission, loadout });
  }, []);
  useEffect(() => {
    if (!trackReopen || !screenFocused || islandEncounter || interactionCreatureId || pendingIslandCampaign || upgradePresentation
      || requiredUpgradeStory || pendingIslandDiscovery || selectedUpgrade || trackOpen) return;
    // One beat, so the camera leaving the level or the story has settled before the tile is framed over the panel.
    const timer = setTimeout(() => { setTrackNotice(null); setTrackOpen(trackReopen); setTrackReopen(null); }, 250);
    return () => clearTimeout(timer);
  }, [interactionCreatureId, islandEncounter, pendingIslandCampaign, pendingIslandDiscovery, requiredUpgradeStory, screenFocused, selectedUpgrade, trackOpen, trackReopen, upgradePresentation]);
  const levelAfterStoryRef = useRef(levelAfterStory);
  levelAfterStoryRef.current = levelAfterStory;
  useEffect(() => {
    if (!levelAfterStory || !screenFocused || islandEncounter || interactionCreatureId || pendingIslandCampaign || upgradePresentation
      || requiredUpgradeStory || pendingIslandDiscovery || selectedUpgrade || trackOpen) return;
    const timer = setTimeout(() => {
      const waiting = levelAfterStoryRef.current;
      setLevelAfterStory(null);
      const campaign = waiting ? islandCampaignById.get(waiting.campaignId) : null;
      const rung = campaign && waiting ? regionRung(campaign, waiting.missionId) : null;
      if (!campaign || !rung || !waiting) return;
      const status = islandCampaignChapterStatus(mergeWorldRef.current, campaign, rung.chapterLevel);
      // The story it waited on opened its chapter: in it goes. Anything else (a chapter's close) lands back on the track.
      if (status !== 'mission_available' && status !== 'in_encounter') { setTrackOpen({ kind: 'island', campaignId: campaign.campaignId }); return; }
      const loadout = battleLoadout(mergeWorldRef.current, waiting.choice);
      void startStoredEncounter({ missionId: rung.mission.id, runId: encounterRunId(rung.mission.encounter, 1, loadout), campaignId: campaign.campaignId, katchimeraId: loadout.companionId, helperWispId: loadout.wispId ?? null, partnerId: loadout.partner?.companionId ?? null }).catch(() => undefined);
      setIslandEncounter({ campaignId: campaign.campaignId, islandId: campaign.islandId, mission: rung.mission, loadout });
    }, 250);
    return () => clearTimeout(timer);
  }, [interactionCreatureId, islandEncounter, levelAfterStory, pendingIslandCampaign, pendingIslandDiscovery, requiredUpgradeStory, screenFocused, selectedUpgrade, trackOpen, upgradePresentation]);
  const trackOpenRef = useRef(trackOpen);
  trackOpenRef.current = trackOpen;
  const openTrack = useMemo(() => {
    if (!trackOpen) return null;
    if (trackOpen.kind === 'grove') return groveTrack(mergeWorld, { ftueComplete: !ftueStepId });
    if (trackOpen.kind === 'daily') return dailyTrack(mergeWorld, localDayId(new Date(gameNow())));
    const campaign = islandCampaignById.get(trackOpen.campaignId);
    return campaign ? islandTrack(mergeWorld, campaign) : null;
  }, [ftueStepId, mergeWorld, trackOpen]);
  // The open track's levels as stepping-stones on its tile (held while a board is docked there).
  const levelTrackStones = useMemo(() => openTrack && !islandEncounter ? {
    islandId: openTrack.islandId,
    stones: openTrack.levels.map((node) => ({ key: node.key, number: node.number, state: node.state, stars: node.stars, boss: node.boss, playable: node.playable })),
  } : null, [islandEncounter, openTrack]);
  /** A stone tapped: its level, with whoever and whichever Wisp came last time. */
  const playTrackStone = useStableCallback((key: string) => {
    const node = openTrack?.levels.find((candidate) => candidate.key === key);
    if (!node?.playable) return;
    const remembered = mergeWorldRef.current.encounters?.loadout;
    const playable = playableHeroes(mergeWorldRef.current);
    const chosen = remembered && playable.includes(remembered.katchimeraId) ? remembered.katchimeraId : 'mossprout';
    const katchimeraId = node.mission?.eligible && !node.mission.eligible.includes(chosen) ? node.mission.eligible[0]! as MergeCharacterId : chosen;
    enterTrackLevel(node, withPartner(mergeWorldRef.current, { katchimeraId, helperWispId: remembered?.helperWispId ?? null, partnerId: remembered?.partnerId === katchimeraId ? chosen : remembered?.partnerId ?? null }, playable));
  });
  const openTrackStory = useCallback((level: number) => {
    const open = trackOpenRef.current;
    const campaign = open?.kind === 'island' ? islandCampaignById.get(open.campaignId) : null;
    void level;
    setTrackOpen(null);
    if (campaign) runIslandCampaignAction(campaign);
  }, [runIslandCampaignAction]);
  const revealFromTrack = useCallback(() => {
    const open = trackOpenRef.current;
    setTrackOpen(null);
    if (open?.kind === 'island') void liftIslandMist(open.campaignId);
  }, [liftIslandMist]);
  const openTrackChest = useCallback(async (threshold: number) => {
    const open = trackOpenRef.current;
    const trackId = open?.kind === 'island' ? open.campaignId : open?.kind === 'grove' ? 'sleeping-grove' : null;
    if (!trackId) return;
    setTrackBusy(true);
    try {
      const result = await claimStoredTrackMilestone(trackId, threshold);
      const claimed = result.milestoneClaimed;
      if (claimed) {
        grantTrackPack({ receiptId: claimed.receiptId, familyId: claimed.familyId, kind: claimed.pack });
        setTrackNotice(`+${claimed.glow} Glow, and a friend pack is waiting with ${MERGE_CHARACTER_NAMES[claimed.familyId] ?? 'Mossprout'}.`);
      } else if (result.message) setTrackNotice(result.message);
    } catch (error) {
      setTrackNotice(error instanceof Error ? error.message : 'The chest did not open. Try again.');
    } finally { setTrackBusy(false); }
  }, [grantTrackPack]);
  const restorationBoardVisible = Boolean(islandRestoration && restorationStore.state) && restorationOpen && screenFocused && !upgradePresentation && !interactionCreatureId && !pendingIslandCampaign && !stepplingMissionActive && !journeyMissionActive && !openingBoardActive && !islandEncounterActive;
  // The mist, given faces: wisps over the veiled tile take the merges' Glow; the last falls on the final item, and the mist lifts with it.
  // A friend's board has them too, over the island, for as long as the board is up; their hits come from the board's saved merges.
  // A chapter authored as a rush is played as one: the same clock, board and wisps as a daily heat, with the chapter's own goal.
  const chapterRush = restorationBoardVisible ? restorationDefinition?.rush ?? null : null;
  const [chapterRushAttempt, setChapterRushAttempt] = useState(0);
  const [chapterRushNote, setChapterRushNote] = useState<string | null>(null);
  const activeRush = useMemo(() => {
    if (rushSpec && rushRun) return { kind: 'daily' as const, spec: rushSpec, goal: heatPars(rushSpec).bronze, title: `Heat ${rushRun.index + 1}`, runKey: `${rushSpec.id}:${rushRun.attempt}`, node: rushTileNode };
    if (chapterRush && islandRestoration) {
      const id = `${islandRestoration.campaign.campaignId}:${islandRestoration.level}:${chapterRushAttempt}`;
      const { goal, ...rules } = chapterRush;
      return { kind: 'chapter' as const, spec: heatFromRules(id, rules), goal, title: islandRestoration.chapter.title, runKey: id, node: restorationTileNode };
    }
    return null;
  }, [chapterRush, chapterRushAttempt, islandRestoration, restorationTileNode, rushRun, rushSpec, rushTileNode]);
  const activeRushKey = activeRush?.runKey ?? null;
  // The run's wisps reach the wisp layer through this, not through this screen: a wisp appearing re-renders nothing here.
  const rushLive = useMemo(() => createRushLive(), [activeRushKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const rushHost = useMemo(() => activeRush ? heatHost(activeRush.spec, activeRush.goal) : null, [activeRush]);
  const rushWispTarget = useMemo((): CorruptionWispTarget | null => activeRush && rushHost && screenFocused
    ? { ...missionWispTarget({ key: activeRush.runKey, host: rushHost, mechanicState: createMechanicState(resolveMechanic(rushHost)), node: activeRush.node, boardMetrics: openingBoardMetrics, settled: ftueCameraSettled }), live: rushLive }
    : null, [activeRush, ftueCameraSettled, openingBoardMetrics, rushHost, rushLive, screenFocused]);
  const wispTarget = useMemo((): CorruptionWispTarget | null => rushWispTarget ?? firstBattle.wispTarget ?? trail1.wispTarget ?? hatchableMist.wispTarget ?? journeyMist.wispTarget ?? islandMist.wispTarget ?? (restorationBoardVisible && restorationBinding && restorationBoardRunId && restorationStore.mechanicState
      ? missionWispTarget({ key: restorationBoardRunId, host: restorationBinding.host, mechanicState: restorationStore.mechanicState, node: restorationTileNode, boardMetrics: openingBoardMetrics, window: restorationBinding.window, lines: restorationWispLines, settled: ftueCameraSettled })
      : null), [rushWispTarget, ftueCameraSettled, firstBattle.wispTarget, trail1.wispTarget, hatchableMist.wispTarget, islandMist.wispTarget, journeyMist.wispTarget, openingBoardMetrics, restorationBinding, restorationBoardRunId, restorationBoardVisible, restorationStore.mechanicState, restorationTileNode, restorationWispLines]);
  useEffect(() => {
    // Back puts the board away; it never leaves the Kingdom from here.
    if (!restorationBoardVisible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { closeRestoration(); return true; });
    return () => subscription.remove();
  }, [closeRestoration, restorationBoardVisible]);
  const restorationSummary = useMemo(() => restorationBinding && restorationStore.mechanicState ? mechanicProgress(resolveMechanic(restorationBinding.host), restorationBinding.host, restorationStore.mechanicState) : null, [restorationBinding, restorationStore.mechanicState]);
  const restorationDone = Boolean(restorationBinding && restorationStore.mechanicState && mechanicComplete(resolveMechanic(restorationBinding.host), restorationBinding.host, restorationStore.mechanicState));
  // While a docked board is up, only its tile stays on the map (the opening uses `homeSolo` instead).
  // The map comes back the moment the bar is full: clearing the mist is done, so everything is shown again for the reveal.
  // Busy until the finale has landed, not until the count is full: the map stays faded while the last item is still in the air.
  const stepplingBoardBusy = stepplingMissionActive && !stepplingMissionLanded;
  const restorationBoardBusy = restorationBoardVisible && !restorationLanded;
  const journeyBoardBusy = journeyMissionActive && !journeyMissionLanded;
  // From the finale's landing until the resolution story is up, the screen holds still: no marker, no Back,
  // no progress pill flashing through while the island grows and the story opens.
  const [restorationHandoff, setRestorationHandoff] = useState<string | null>(null);
  useEffect(() => {
    if (restorationLanded && restorationBoardRunId) setRestorationHandoff(restorationBoardRunId);
  }, [restorationBoardRunId, restorationLanded]);
  useEffect(() => {
    if (!restorationHandoff) return;
    if (pendingIslandCampaign?.phase === 'resolution' || upgradeError) { setRestorationHandoff(null); return; }
    // Whatever happens, the screen is never held for long.
    const timer = setTimeout(() => setRestorationHandoff(null), RESTORATION_HANDOFF_MAX_MS);
    return () => clearTimeout(timer);
  }, [pendingIslandCampaign?.phase, restorationHandoff, upgradeError]);
  const soloLayerId = rushSpec ? `nature:mossprout:${WISP_RUSH_HOST.islandId}` : stepplingBoardBusy ? `structure:${activeHatchable.tile.id}` : journeyBoardBusy && journeyMission ? `structure:${journeyMission.tile.id}` : islandEncounterBusy && islandEncounterIslandId ? `nature:mossprout:${islandEncounterIslandId}` : restorationBoardBusy && restorationIslandId ? `nature:mossprout:${restorationIslandId}` : null;
  // No marker percentage while the board is up: the request lives on the dock's tray instead.
  const soloOfferId = stepplingBoardBusy ? `mist:${activeHatchable.tile.id}` : null;
  // No tutorial on a friend's board: the step only locks the board once its bar is full.
  const restorationStep = useMemo(() => islandRestoration && restorationStore.state
    ? restorationBoardStep(islandRestoration.campaign, islandRestoration.level, restorationStore.state, restorationStore.merges, restorationDone)
    : null, [islandRestoration, restorationDone, restorationStore.merges, restorationStore.state]);
  // The tray's request: the chapter's order once the board has asked for it, served or not.
  const restorationOrder = useMemo(() => {
    if (!islandRestoration || !restorationChapterProgress || islandRestoration.progress.deliveryRequestedAt == null) return null;
    const orderId = restorationChapterProgress.orderIds.at(-1);
    const saved = orderId ? mergeWorld.activeOrders.find((candidate) => candidate.id === orderId) : null;
    const authored = islandCampaignChapterOrder(islandRestoration.campaign, islandRestoration.level, restorationChapterProgress.selectedOptionId ?? null);
    return saved ?? (authored && orderId ? { ...authored, id: orderId } : authored);
  }, [islandRestoration, mergeWorld.activeOrders, restorationChapterProgress]);
  const restorationOrderServed = Boolean(restorationChapterProgress && restorationChapterProgress.orderIds.length > 0 && restorationChapterProgress.orderIds.every((id) => restorationChapterProgress.servedOrderIds.includes(id)));
  const restorationPendingDeliveries = useMemo(() => islandRestoration ? deliveriesToPlace(islandRestoration.progress, restorationStore.placedDeliveries) : [], [islandRestoration, restorationStore.placedDeliveries]);
  // What the friend says beside the tray: the panel's own voice for the stage (the request's line while it
  // is open on the Main Board, the answer's return line once the delivery is in).
  const restorationSpeech = useMemo(() => {
    if (!islandRestoration) return null;
    const panel = islandCampaignUpgradePanelState(mergeWorld, islandRestoration.campaign);
    if (!panel) return null;
    return panel.speech ?? (panel.status === 'delivery_requested' ? panel.voicedStateLabel : null);
  }, [islandRestoration, mergeWorld]);
  // The one hint a friend's board gives, every friend, every time: while the patch is spent and the
  // request sits on the tray unserved, a finger under the card points the way to the Merge board.
  const restorationCheckpointHint = Boolean(islandRestoration && restorationOrder && !restorationOrderServed && restorationBoardVisible);
  // Settled is per showing: put away and reopened, the dock plays its entrance again and the finger waits for it again.
  useEffect(() => { if (islandRestoration && !restorationBoardVisible) setOpeningDockSettled(false); }, [islandRestoration, restorationBoardVisible]);
  // The finger comes last: the board has settled, the card has faded in and the bubble has spoken.
  const [restorationHintReady, setRestorationHintReady] = useState(false);
  useEffect(() => {
    if (!(restorationCheckpointHint && openingDockSettled)) { setRestorationHintReady(false); return; }
    const timer = setTimeout(() => setRestorationHintReady(true), RESTORATION_HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [openingDockSettled, restorationCheckpointHint]);
  // One cue object per request: a new object each render would re-measure the card on every board move and restart the finger.
  const restorationOrderId = restorationOrder?.id ?? null;
  const restorationHintCue = useMemo<FtueCueDefinition | null>(() => restorationOrderId
    ? { kind: 'tap', target: { kind: 'order_card', orderId: restorationOrderId }, offset: { y: RESTORATION_HINT_FINGER_DROP } }
    : null, [restorationOrderId]);
  const openRestorationOrder = useCallback(() => {
    if (!islandRestoration || !restorationOrder) return;
    // Back from the Merge page lands on this board again.
    requestIslandRestorationOpen(islandRestoration.campaign.campaignId);
    openGarden(restorationOrder.id, 'mossprout');
  }, [islandRestoration, openGarden, restorationOrder]);
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
    if (!islandRestoration || !restorationSummary || restorationDefinition?.rush) return;
    if (recordedCurrent === restorationSummary.current && recordedTotal === restorationSummary.total) return;
    void recordStoredIslandRestorationProgress(islandRestoration.campaign.campaignId, islandRestoration.level, restorationSummary).catch(() => undefined);
  }, [islandRestoration, recordedCurrent, recordedTotal, restorationDefinition?.rush, restorationSummary]);
  // The checkpoint: the beds can go no further, so the chapter's order goes to the Main Board.
  useEffect(() => {
    if (!islandRestoration || !restorationDefinition || !restorationStore.state) return;
    // A rush asks the Main Board for nothing: the run itself is the whole chapter.
    if (restorationDefinition.rush) return;
    if (islandRestoration.progress.deliveryRequestedAt != null) {
      // A board that asks for what it is missing asks again once the last round has been served and placed and the beds are stuck again.
      if (!restorationDefinition.request || !restorationChapterProgress) return;
      if (!restorationChapterProgress.orderIds.every((id) => restorationChapterProgress.servedOrderIds.includes(id))) return;
      if (deliveriesToPlace(islandRestoration.progress, restorationStore.placedDeliveries).length) return;
    }
    if (!restorationCheckpointReached(restorationDefinition, restorationStore.state, restorationStore.merges, restorationDone)) return;
    const authored = islandCampaignChapterOrder(islandRestoration.campaign, islandRestoration.level, restorationChapterProgress?.selectedOptionId ?? null);
    if (!authored) return;
    // A board that asks for what it is missing reads its request off its own pieces.
    const order = restorationRequestOrder(restorationDefinition, restorationStore.state, authored);
    void requestStoredIslandCampaignDelivery(islandRestoration.campaign.campaignId, islandRestoration.level, [order]).catch((error) => console.warn('The request could not be sent', error));
  }, [islandRestoration, restorationChapterProgress, restorationDefinition, restorationDone, restorationStore.merges, restorationStore.placedDeliveries, restorationStore.state]);
  // Finish: the last planting's bloom strikes the last wisp (or a board saved full finishes on arrival).
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
  const { launchFinale: launchGlowFinale, launchItem: launchGlowItem, launchShot: launchGlowShot } = openingGlow;
  const launchRestorationFinale = useCallback((from: RewardFlightPoint, definitionId: string, strike: MissionStrike) => {
    restorationFinaleIdRef.current = launchGlowFinale(from, definitionId, strike);
  }, [launchGlowFinale]);
  const { launch: launchGlow } = openingGlow;
  const launchRushStrike = useCallback((from: RewardFlightPoint, strike: MissionStrike) => launchGlow(from, undefined, strike), [launchGlow]);
  const rushAttemptRef = useRef(0);
  const rushResultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (rushResultTimerRef.current) clearTimeout(rushResultTimerRef.current); }, []);
  const playRushHeat = useStableCallback((index: number) => {
    // Called from the sheet's own close animation: the sheet (and its gesture tree) leaves first, and the board with
    // its own gesture tree mounts on a later frame, never in the same commit as that unmount.
    setRushSheetOpen(false); setRushResult(null); setRushNotice(null); setOpeningDockSettled(false);
    const attempt = ++rushAttemptRef.current;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (rushAttemptRef.current !== attempt) return;
      setRushRun({ dayId: localDayId(new Date(gameNow())), index, attempt });
    }));
  });
  const leaveRushHeat = useStableCallback(() => {
    if (activeRush?.kind === 'chapter') { closeRestoration(); return; }
    setRushRun(null); setRushSheetOpen(true);
  });
  const voidRushHeat = useStableCallback(() => {
    if (activeRush?.kind === 'chapter') { setChapterRushNote('You left, so that run does not count. Again'); setChapterRushAttempt((attempt) => attempt + 1); return; }
    setRushNotice('You left the app, so that run does not count. Run it again.'); leaveRushHeat();
  });
  const finishRushHeat = useStableCallback((score: number) => {
    const active = activeRush;
    if (!active || rushResultTimerRef.current) return;
    const run = rushRun;
    const restoration = islandRestoration;
    // The last Glow is still in the air: the result waits for it to land and for the wisp to fall.
    rushResultTimerRef.current = setTimeout(() => {
      rushResultTimerRef.current = null;
      if (active.kind === 'daily' && run) {
        void recordStoredTimeTrialHeat({ dayId: run.dayId, index: run.index, score })
          .then(({ outcome }) => { setRushResult({ index: run.index, score, outcome }); })
          .catch((error) => setRushNotice(error instanceof Error ? error.message : 'That run could not be saved.'))
          .finally(leaveRushHeat);
        return;
      }
      if (active.kind !== 'chapter' || !restoration) return;
      if (score < active.goal) {
        // Short of the chapter's goal: the clock is reset and the run starts again; nothing is lost.
        setChapterRushNote(`${active.goal - score} short. Again`);
        setChapterRushAttempt((attempt) => attempt + 1);
        return;
      }
      setChapterRushNote(null);
      setRestorationHandoff(restorationBoardRunId);
      void recordStoredIslandRestorationProgress(restoration.campaign.campaignId, restoration.level, { current: active.goal, total: active.goal })
        .then(() => completeStoredIslandRestoration(restoration.campaign.campaignId, restoration.level))
        .catch((error) => console.warn('The run could not be recorded', error));
    }, OPENING_GLOW_FLIGHT_MS + WISP_FALL_MS);
  });
  const openRushChest = useStableCallback(async () => {
    const taken = await claimStoredTimeTrialChest(localDayId(new Date(gameNow())));
    if (!taken) return;
    commandFriendWispPacks({ type: 'grant', receiptId: taken.receiptId, familyId: taken.familyId, kind: taken.kind, seed: Math.floor(Math.random() * 4294967296) });
    setRushNotice('A friend pack is waiting with Steppling.');
  });
  // Items, not Glow, fly into an island being restored; a column shot goes straight up its column.
  const restorationShot = restorationBinding ? resolveMechanic(restorationBinding.host).kind === 'column-shot' : false;
  const launchRestorationStrike = useCallback((from: RewardFlightPoint, strike: MissionStrike) => {
    if (restorationShot) launchGlowShot(from, strike);
    else launchGlowItem(from, strike.resultDefinitionId, strike);
  }, [launchGlowItem, launchGlowShot, restorationShot]);
  useEffect(() => {
    if (!(restorationDone && restorationLanded)) return;
    // The wisp falls first; the island grows once it has gone.
    const timer = setTimeout(finishIslandRestoration, WISP_FALL_MS);
    return () => clearTimeout(timer);
  }, [finishIslandRestoration, restorationDone, restorationLanded]);
  const restorationCheckedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!islandRestoration || !restorationStore.state) return;
    const key = `${islandRestoration.campaign.campaignId}:${islandRestoration.level}`;
    if (restorationCheckedRef.current === key) return;
    restorationCheckedRef.current = key;
    if (restorationDone) finishIslandRestoration();
  }, [finishIslandRestoration, islandRestoration, restorationDone, restorationStore.state]);
  const lastRestorationKeyRef = useRef<string | null>(null);
  useEffect(() => {
    // The board's store goes with the chapter once its restoration is done.
    const key = islandRestoration ? previewMissionStorageKey(restorationStorageKey(islandRestoration.campaign.campaignId, islandRestoration.level), mechanicPreview) : null;
    if (!key && lastRestorationKeyRef.current) clearMission(lastRestorationKeyRef.current);
    lastRestorationKeyRef.current = key;
  }, [islandRestoration, mechanicPreview]);

  useEffect(() => {
    if (!screenFocused || pendingIslandDiscovery || islandEncounter || trackOpen
      || interactionCreatureId || selectedUpgrade || upgradePresentation || requiredUpgradeStory || ordinaryUpgradeRun) return;
    // Not `mergeWorld.revision`: that bumps on every command in the game,
    // including ones that have nothing to do with this campaign (an energy
    // tick, an unrelated merge). Keying on it meant the guard reset itself
    // the instant anything else happened — including mid-conversation — so
    // the same narrative could get torn down and reopened before it ever
    // reached its own completion callback, and its chapter never actually
    // persisted as complete. `status` only changes when this chapter's own
    // progress does, which is the only thing that should ever re-arm this.
    const fired = campaignAutoTransitionRef.current;
    /** Continues one friend's story if it is waiting on the game; true when it did (one continuation per pass). */
    const advance = ({ campaign, chapter, status }: ActiveIslandCampaign): boolean => {
      if (status === 'return_ready') {
        const key = `return:${campaign.campaignId}:${chapter.level}:${status}`;
        if (fired.has(key)) return false;
        fired.add(key);
        if (chapter.level === 1) {
          // The first return is the gift beat: a full scene, then the free restoration.
          openIslandCampaignNarrative(campaign, chapter.level, 'return');
          return true;
        }
        // Later returns land where the Glow is spent: the friend speaks on the island panel.
        returnPanelRef.current = `${campaign.campaignId}:${chapter.level}`;
        void acknowledgeStoredIslandCampaignChapterReturn(campaign.campaignId, chapter.level).catch(() => { returnPanelRef.current = null; });
        return true;
      }
      if (status === 'restoration_ready' && chapter.restoration) {
        // The beds are full and the stage was paid when they opened: the island grows on its own.
        const offer = upgradeOffers.find((candidate) => candidate.id === `nature:${campaign.islandId}` && candidate.nextLevel === chapter.level && candidate.eligible);
        const key = `restore-board:${campaign.campaignId}:${chapter.level}:${status}`;
        if (!offer || fired.has(key)) return false;
        fired.add(key);
        void purchaseWorldUpgrade(offer, { beforeValidation: flushMergeWorld }).catch((error) => {
          fired.delete(key);
          setUpgradeError(error instanceof Error ? error.message : 'The garden restoration paused.');
        });
        return true;
      }
      if (status === 'restoration_ready' && returnPanelRef.current === `${campaign.campaignId}:${chapter.level}`) {
        returnPanelRef.current = null;
        const offer = upgradeOffers.find((candidate) => candidate.id === `nature:${campaign.islandId}` && candidate.nextLevel === chapter.level);
        if (offer) void openUpgradeOfferRef.current?.(offer);
        return true;
      }
      if (chapter.level === 1 && status === 'restoration_ready') {
        const offer = upgradeOffers.find((candidate) => candidate.id === `nature:${campaign.islandId}` && candidate.nextLevel === 1 && candidate.eligible);
        const key = `restore:${campaign.campaignId}:${chapter.level}:${status}`;
        if (!offer || fired.has(key)) return false;
        fired.add(key);
        void purchaseWorldUpgrade(offer, { beforeValidation: flushMergeWorld }).catch((error) => {
          fired.delete(key);
          setUpgradeError(error instanceof Error ? error.message : 'The garden restoration paused.');
        });
        return true;
      }
      if (status === 'resolution_ready') {
        const key = `resolution:${campaign.campaignId}:${chapter.level}:${status}`;
        if (fired.has(key)) return false;
        fired.add(key);
        openIslandCampaignNarrative(campaign, chapter.level, 'resolution');
        return true;
      }
      return false;
    };
    // Only ever the friend the player is dealing with. If that friend cannot go on right now (not enough Glow, a
    // step that needs the player), nothing happens and the player is left on the map: another friend's story in
    // progress is never "what comes next". This once tried the friend in focus first and then every other friend, so
    // finishing a section of Petalimp's board with no Glow to continue walked the player into Wanderling's story.
    // With no friend in focus (a fresh launch), a story continues on its own only when it is the only one in
    // progress, and that friend becomes the one in focus.
    const stories = activeIslandCampaigns(mergeWorld);
    const story = restorationFocusCampaignId
      ? stories.find((candidate) => candidate.campaign.campaignId === restorationFocusCampaignId)
      : stories.length === 1 ? stories[0] : undefined;
    if (story && advance(story) && !restorationFocusCampaignId) setRestorationFocusCampaignId(story.campaign.campaignId);
  }, [flushMergeWorld, interactionCreatureId, islandEncounter, mergeWorld, openIslandCampaignNarrative, ordinaryUpgradeRun,
    pendingIslandDiscovery, requiredUpgradeStory, restorationFocusCampaignId, screenFocused, selectedUpgrade, trackOpen, upgradeOffers, upgradePresentation]);

  // Mossprout's wish plays once Steppling's garden lesson is over: a blocking
  // full-screen scene, then a guided walk to the first mist. Both phases are
  // durable (`kingdomGoal.introducedAt`, `kingdomGoal.coachmarkSeenAt`), so a
  // relaunch resumes exactly where the player left off.
  // The campaign pivot: no Garden lesson after Steppling. His day one ending (or a lesson a save already finished) opens the goal.
  const stepplingLessonDone = stepplingLesson.ready && (
    hatchableRuns.dayOnes[HATCHABLE_COMPANIONS[0]!.companion]?.status === 'completed'
    || (stepplingLesson.run ? stepplingLesson.run.status === 'completed' : stepplingShoeServed(mergeWorld)));
  const kingdomGoalWanted = screenFocused && stepplingLessonDone && !kingdomGoal?.introducedAt
    && loadFtueRun()?.status === 'complete' && hatchableRuns.discovery[HATCHABLE_COMPANIONS[0]!.companion]?.status === 'completed'
    && !sharedUpgrade && !upgradePresentation && !requiredUpgradeStory && !stepplingEggOpen && !pendingIslandDiscovery && !islandEncounter && !trackOpen;
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
    ? visibleWorldUpgradeOffers(upgradeOffers, ftueStepId, glowRun, activeHatchable.tile.id).find((offer) => offer.id === `nature:${goalIslandId}` && offer.eligible) ?? null
    : null;
  const kingdomGoalGuideActive = Boolean(screenFocused && kingdomGoal?.introducedAt && kingdomGoal.coachmarkSeenAt == null && goalIslandOffer
    && !ftueStepId && !adventureOpen && !lanternSurfaceOpen && !progressSheetOpen && !wakeHandoffCampaign && !selectedUpgrade
    && !eventBoardActive && !openingBoardActive && !stepplingMissionActive && !journeyMissionActive && !restorationBoardVisible && !upgradeHandoffPending
    && !interactionCreatureId && !activeInteractionResidentId && !stepplingEggOpen && !upgradePresentation && !requiredUpgradeStory && !ordinaryUpgradeRun
    // A level on a tile, or a track open over one, owns the camera and the touches: the guide never comes back over it.
    && !islandEncounter && !trackOpen);
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
    // The saved introduction arms the camera/marker guide above. Do not swap
    // the closing native sheet for another modal: the next stop is the map.
    setAdventureOpen(false);
    setProgressSheetOpen(false);
    setGoalCoachmarkArmed(false);
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
    if (next.kind === 'shared_adventure') { setProgressSheetOpen(false); setAdventureOpen(true); return; }
    if (next.kind === 'merge') { setProgressSheetOpen(false); openGarden(undefined, 'mossprout'); return; }
    if (next.kind === 'mist') {
      setProgressSheetOpen(false);
      const offer = next.islandId ? upgradeOffers.find((candidate) => candidate.id === `nature:${next.islandId}`) : null;
      if (offer) void openUpgradeOfferRef.current?.(offer);
      return;
    }
    if (next.islandId) showIslandFromTracker(next.islandId);
    else setProgressSheetOpen(false);
  }, [openGarden, showIslandFromTracker]);
  useEffect(() => {
    if (!screenFocused) { stepplingLessonOpening.current = false; return; }
    if (!stepplingLesson.active || !stepplingLesson.run || !havenMergeBoardActive) return;
    if (HATCHABLE_LESSON_FINALE_NODE_IDS.includes(stepplingLesson.run.nodeId)) {
      const resident = companionSlots.find((slot) => slot.kind === 'owned' && slot.familyId === activeLessonHatchable.companion);
      if (resident?.kind === 'owned' && interactionCreatureId !== resident.creature.creatureId) selectResident(resident.creature.creatureId);
    } else if (!activeInteractionResidentId && !stepplingLessonOpening.current) {
      stepplingLessonOpening.current = true;
      openGarden(undefined, activeLessonHatchable.companion);
    }
  }, [screenFocused, stepplingLesson.active, stepplingLesson.run, havenMergeBoardActive, companionSlots, interactionCreatureId, activeInteractionResidentId, activeLessonHatchable.companion, selectResident, openGarden]);

  // A friend rescued in battle (no ticket): a tap on their tile goes straight into the rescue (the camera is already
  // on the tile, the battle's story card, then the board), never through a panel with a 0 Glow button and a zoom out.
  const rescueStartingRef = useRef(false);
  const enterRescue = useCallback(async (definition: HatchableCompanionDefinition) => {
    if (rescueStartingRef.current) return;
    rescueStartingRef.current = true;
    try {
      const result = await payStoredHatchableMission(definition.companion, hatchableTicketReceiptId(definition.discoveryFlow.runId));
      await startHatchableDiscovery(definition);
      await resumeHatchableDiscovery(definition, result.state);
    } catch (error) { console.warn('The rescue could not start', error); }
    finally { rescueStartingRef.current = false; }
  }, []);
  const openUpgradeOffer = useCallback(async (offer: WorldUpgradeOffer) => {
    if (storyHoldRef.current && !storyBypassRef.current) return;
    if (offer.action === 'Enter the Mist' && offer.hatchable && offer.hatchable.state !== 'sleeping') {
      const definition = hatchableByTile(offer.id.slice('mist:'.length));
      if (definition?.mission.encounter) { void enterRescue(definition); return; }
    }
    // The trial's clock on the Rush Track opens today's ladder, not an upgrade.
    if (offer.trial) { setRushNotice(null); setRushSheetOpen(true); return; }
    // Mossprout's own tile carries the Grove's track, and the Daily Mist's once the Grove is done.
    if (offer.id === HOME_TRACK_OFFER_ID && offer.track) { setTrackNotice(null); setTrackOpen({ kind: offer.track.kind === 'daily' ? 'daily' : 'grove' }); return; }
    if (upgradePressBusy.current || upgradePurchasing || upgradePresentation) return;
    // Resting friends are on the map from the first frame, but not yet the player's business.
    if (offer.sleepingSkinId && ftueStepId) return;
    // A friend mid-restoration: the marker is the board, not a panel about the board. Their own board, even while
    // another friend's is also unfinished.
    const offerCampaignId = islandCampaignForOffer(offer.id)?.campaignId;
    // Tapping a friend's island makes them the friend being dealt with, whether or not a board is open: everything
    // that continues on its own from here continues for them.
    if (offerCampaignId) setRestorationFocusCampaignId(offerCampaignId);
    if (offerCampaignId && activeIslandRestoration(mergeWorldRef.current, offerCampaignId)) {
      setRestorationOpen(true);
      return;
    }
    // A friend's island is its level track: the Mist to lift, then each chapter's levels with the story between.
    // A reveal waiting on its discovery keeps the panel it always had, which carries that moment.
    if (offerCampaignId && !ftueStepId) {
      // A friend's hatch story (Steppling's clearing, the next hatchable's) owns the camera and its panel until it
      // is finished: a level started under it framed the wrong tile and took no touches. The tap goes back to it.
      if (hatchableStoryOpenRef.current) {
        setSelectedUpgrade(null);
        setGlowPanelOpen(true);
        void resumeActiveHatchable();
        return;
      }
      const world = mergeWorldRef.current;
      const campaign = islandCampaignById.get(offerCampaignId);
      const revealed = campaign ? Boolean(world.haven.mossproutNatureIslandReveals[campaign.islandId] || (world.haven.mossproutNatureIslands[campaign.islandId] ?? 0) > 0) : false;
      const discovered = world.islandCampaigns?.[offerCampaignId]?.discoveryRevealSeenAt != null;
      // A misted friend waits for the Sanctuary to be founded (the Heart Tree woken; the old Kingdom goal on older saves).
      if (campaign && !revealed && !sanctuaryFounded(world)) { setSelectedUpgrade(null); return; }
      if (campaign && (!revealed || discovered)) {
        // The goal's guide pointed here: tapping its island is the guide done (it would otherwise come back over the level).
        if (goalIslandIdRef.current && offer.id === `nature:${goalIslandIdRef.current}` && world.kingdomGoal?.introducedAt && world.kingdomGoal.coachmarkSeenAt == null) {
          setGoalCoachmarkArmed(false);
          void acknowledgeStoredKingdomGoalCoachmark().catch(() => undefined);
        }
        setTrackNotice(null);
        setTrackOpen({ kind: 'island', campaignId: offerCampaignId });
        setSelectedUpgrade(null);
        return;
      }
    }
    upgradePressBusy.current = true;
    setUpgradeError(null); setUpgradeCommitted(false);
    try {
      if (ftueStepId === 'world.first_bloom_offer') await advanceFtueActionDurably({ expectedStepId: ftueStepId, actionId: 'world.open_first_bloom_upgrade' });
      // A hatchable tile's bubble: with the ticket paid, the board is the tile's business (re-docked here);
      // otherwise the panel with the price, and nothing moves (no story, no camera) until it is confirmed.
      const tappedHatchable = offer.id.startsWith('mist:') ? hatchableByTile(offer.id.slice('mist:'.length)) : null;
      const tappedRun = tappedHatchable ? hatchableRuns.discovery[tappedHatchable.companion] ?? null : null;
      if (tappedHatchable && (offer.hatchable?.state === 'board' || (tappedRun && tappedRun.status !== 'completed' && !GLOW_GATEWAY_NODE_IDS.includes(tappedRun.nodeId)))) {
        if (!tappedRun) await startHatchableDiscovery(tappedHatchable);
        await resumeHatchableDiscovery(tappedHatchable, mergeWorldRef.current);
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
  }, [ftueStepId, hatchableRuns, upgradePresentation, upgradePurchasing]);
  openUpgradeOfferRef.current = openUpgradeOffer;
  openGardenRef.current = openGarden;
  const handleUpgradeOfferPress = useCallback((offer: WorldUpgradeOffer) => {
    void openUpgradeOffer(offer);
  }, [openUpgradeOffer]);
  const upgradeMarkerNodesRef = useRef<Record<string, View | null>>({});
  const setUpgradeMarkerNode = useCallback((id: string, node: View | null) => {
    upgradeMarkerNodesRef.current[id] = node;
    if (id === 'haven:mossprout') registerFtueTarget('upgrade:mossprout', node);
    const hatchable = id.startsWith('mist:') ? hatchableByTile(id.slice('mist:'.length)) : null;
    if (hatchable) registerFtueTarget(`upgrade:${hatchable.companion}`, node);
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
      const confirmedHatchable = sharedUpgrade.hatchable ? hatchableByTile(sharedUpgrade.id.slice('mist:'.length)) : null;
      if (confirmedHatchable) {
        // The ticket first: the tile's price leaves the counter and flies into the tile (as a friend's restoration
        // stage does), and only a paid ticket lets the story begin and the board dock. A refusal keeps the panel.
        const cost = sharedUpgrade.cost;
        if (cost > 0) setGlowSpend({ amount: cost, counting: false });
        let result: Awaited<ReturnType<typeof payStoredHatchableMission>>;
        try { result = await payStoredHatchableMission(confirmedHatchable.companion, hatchableTicketReceiptId(confirmedHatchable.discoveryFlow.runId)); }
        catch (error) { setGlowSpend(null); throw error; }
        const paid = Boolean(result.state.hatchableMissions?.[confirmedHatchable.companion] || result.state.worldUnlocks?.[confirmedHatchable.tile.unlockId]);
        if (!paid) { setGlowSpend(null); throw new Error(result.message ?? 'Clear the Mist to earn more Glow.'); }
        if (cost > 0 && result.changed) {
          const spent = result.state.coins;
          void measureGlowCurrencyOrigin().then((origin) => {
            const aim = (attempt: number) => {
              const node = upgradeMarkerNodesRef.current[sharedUpgrade.id] ?? gatewayTileNode;
              if (!node && attempt < 30) { requestAnimationFrame(() => aim(attempt + 1)); return; }
              openingGlow.launch(origin, node);
              setGlowSpend({ amount: cost, counting: true });
              setDisplayedGlow(spent);
              setTimeout(() => setGlowSpend(null), 900);
            };
            aim(0);
          });
        } else if (cost === 0) setDisplayedGlow(result.state.coins);
        // Paid: the panel leaves first, so nothing of its camera competes with the story's framing of the tile.
        setSelectedUpgrade(null); setUpgradeCommitted(false);
        await startHatchableDiscovery(confirmedHatchable);
        await resumeHatchableDiscovery(confirmedHatchable, result.state);
      } else if (ftueStepId === 'world.first_bloom_restore') {
        await advanceFtueActionDurably({ expectedStepId: ftueStepId, actionId: 'world.restore_with_first_bloom', nextStepId: ftueStepId, evidenceRef: 'shared-upgrade:confirm' });
      } else {
        const run = await purchaseWorldUpgrade(sharedUpgrade, { beforeValidation: flushMergeWorld });
        if (run?.status === 'failed_recoverable') throw new Error('The upgrade could not finish. Try again.');
        if (run?.status === 'completed') setSelectedUpgrade(null);
      }
    } catch (error) { setDisplayedGlow(mergeWorldRef.current.coins); setUpgradeError(error instanceof Error ? error.message : 'Could not upgrade. Please try again.'); setUpgradeCommitted(false); }
    finally { upgradePressBusy.current = false; setUpgradePurchasing(false); }
  }, [flushMergeWorld, ftueStepId, gatewayTileNode, measureGlowCurrencyOrigin, openingGlow, sharedUpgrade, upgradeCommitted, upgradeError]);
  // Sleeping islands arrive from the offers layer already locked, in wake order.
  // Once Dashkit is home the Rush Track's marker is the trial's clock, with today's heats, unless a story chapter is mid-run on it.
  const rushTrialOpen = (mergeWorld.haven.mossproutNatureIslands[WISP_RUSH_HOST.islandId] ?? 0) >= WISP_RUSH_HOST.unlockLevel && !activeIslandRestoration(mergeWorld, WISP_RUSH_HOST.campaignId);
  const rushTrialOffers = useMemo(() => {
    if (!rushTrialOpen) return upgradeOffers;
    const day = timeTrialFor(mergeWorld).days[localDayId(new Date(gameNow()))];
    const trial = { heat: nextHeatIndex(day) + 1, total: HEATS_PER_DAY, done: heatsCleared(day) >= HEATS_PER_DAY };
    const id = `nature:${WISP_RUSH_HOST.islandId}`;
    const base = upgradeOffers.find((offer) => offer.id === id) ?? worldUpgradeArchiveOffer(mergeWorld, id);
    if (!base) return upgradeOffers;
    const clock: WorldUpgradeOffer = { ...base, trial, eligible: !trial.done, affordable: !trial.done, missingGlow: 0, markerSkinId: undefined, restorationProgress: undefined, lockedReason: undefined };
    return upgradeOffers.some((offer) => offer.id === id) ? upgradeOffers.map((offer) => (offer.id === id ? clock : offer)) : [...upgradeOffers, clock];
  }, [mergeWorld, rushTrialOpen, upgradeOffers]);
  const presentedUpgradeOffers = useMemo(() => withTrackBadges(mergeWorld, rushTrialOffers, !ftueStepId), [ftueStepId, mergeWorld, rushTrialOffers]);
  // Alone until the hatch: no markers at all until the islands are drawn. And none while any mini board is
  // docked (the opening's, Steppling's, a friend's): the board is the only thing to do until it is put away.
  // A level docked under a tile (a friend's island, the Grove, the Daily Mist) holds the world like every other board: no markers, no taps on tiles.
  // The Supply Run (`features/supply-run/supply-run.ts`): the calm board under the Lost Trail, kept between visits.
  // Once Feastle is home the Caf\u00e9 is a Kitchen: a fresh board with the Hearth Pantry, and Feastle's feasts on the cards.
  const kitchen = kitchenOpen(mergeWorld);
  const createCafeBoard = useCallback((now: number) => createSupplyRunBoard(now, kitchen), [kitchen]);
  // v2: coffee is the Café's one drink chain (a board saved with juice on it starts fresh).
  const supplyRunStore = useMissionBoard('katchimeras.cafe.v3', supplyRunOpen ? (kitchen ? 'kitchen' : 'supply-run') : null, createCafeBoard);
  const supplyRunDocked = supplyRunOpen && screenFocused && Boolean(supplyRunStore.state);
  // Back ends a Café visit whenever: the board keeps everything for next time. Not while an order's pieces are flying.
  const leaveCafe = useCallback(() => { if (!supplyServingRef.current) setSupplyRunOpen(false); }, []);
  // The Café's and the Kitchen's buildings pour better pieces: their odds ride on every generator tap.
  const { send: cafeStoreSend } = supplyRunStore;
  // The first visit's lesson remembers the first pour (tap the Ritual Bar) so it moves on to the merge.
  const [cafePoured, setCafePoured] = useState(false);
  const cafeSend = useCallback((command: MergeWorldCommand) => {
    if (command.type === 'tapGenerator') setCafePoured(true);
    return cafeStoreSend(command.type === 'tapGenerator'
      ? { ...command, dropProfile: cafeDropProfile(mergeWorldRef.current, command.generatorId) } : command);
  }, [cafeStoreSend]);
  const cafeRailRefs = useRef(new Map<string, View>());
  const [cafeRailRevision, setCafeRailRevision] = useState(0);
  const setCafeRailTarget = useCallback((key: string, view: View | null) => {
    if (view) cafeRailRefs.current.set(key, view); else cafeRailRefs.current.delete(key);
    setCafeRailRevision((revision) => revision + 1);
  }, []);
  const supplyRunOrders = useMemo((): SupplyRunOrder[] => supplyRunSlots(mergeWorld).map((index, slot) => ({ slot: slot as 0 | 1, index, order: supplyOrder(slot as 0 | 1, index, kitchen) })), [kitchen, mergeWorld]);
  const [supplyCrateFull, setSupplyCrateFull] = useState(false);
  // Serving is the Merge page's own serve (`MergeServeRewardOverlay`): each piece the order takes flies from its cell to
  // its own slot on the card, then the order's Glow flies from the card to the counter, and only then is the order served
  // and paid. A flight that cannot be measured serves at once instead, so Serve always works.
  const [supplyServeFlight, setSupplyServeFlight] = useState<MergeServeRewardFlight | null>(null);
  const [supplyHiddenItemIds, setSupplyHiddenItemIds] = useState<ReadonlySet<string>>(() => new Set());
  const supplyServingRef = useRef<SupplyRunOrder | null>(null);
  const supplyServeNonceRef = useRef(0);
  const measureInScreen = useCallback((node: View | null) => new Promise<{ x: number; y: number; width: number; height: number } | null>((resolve) => {
    if (!node) { resolve(null); return; }
    node.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null));
  }), []);
  // What an order pays: the Explorer's Lodge adds Timber to every order; Baristabbit's Café adds Meals.
  const supplyOrderPayout = useCallback((entry: SupplyRunOrder) => ({
    glow: entry.order.reward.coins,
    timber: entry.order.timber + lodgeTimberBonus(heroBuildingLevel(mergeWorldRef.current, 'explorers-lodge')),
    meals: entry.order.meals + cafeMealsBonus(heroBuildingLevel(mergeWorldRef.current, 'baristabbit-cafe')),
  }), []);
  const commitSupplyOrder = useCallback(async (entry: SupplyRunOrder) => {
    const served = supplyRunStore.send({ type: 'serveBoardOrder', order: entry.order, now: Date.now() });
    if (!served?.changed) return false;
    const before = mergeWorldRef.current.coins;
    const servedBefore = mergeWorldRef.current.supplyRun?.served ?? 0;
    const { timber, meals } = supplyOrderPayout(entry);
    // One continuous board: each order pays and the next takes its place (no crates).
    await completeStoredSupplyOrder(entry.slot, entry.index, timber, entry.order.reward.coins, undefined, meals, undefined, kitchen).catch((error) => { console.warn('The order could not be paid', error); return null; });
    countGlowIn(before, entry.order.reward.coins);
    return true;
  // `countGlowIn` is declared below and stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplyOrderPayout, supplyRunStore.send]);
  const serveSupplyOrder = useCallback(async (entry: SupplyRunOrder, itemTargets: readonly MergeScreenPoint[]) => {
    const board = supplyRunStore.state;
    const metrics = openingBoardMetrics;
    if (!board || supplyServingRef.current) return false;
    const servingItems = mergeOrderServingCells(board, entry.order);
    const [screenRect, coinRect, timberRect, mealsRect] = await Promise.all([measureInScreen(screenRef.current), measureInScreen(glowCurrencyArtRef.current),
      measureInScreen(timberCurrencyArtRef.current), measureInScreen(mealsCurrencyArtRef.current)]);
    if (reduceMotion || !metrics || !screenRect || !coinRect || servingItems.length !== itemTargets.length) return commitSupplyOrder(entry);
    const targets = itemTargets.map((point) => ({ x: point.x - screenRect.x, y: point.y - screenRect.y }));
    const items = servingItems.map((item, index) => {
      const center = mergeCellCenter(metrics.geometry, item.cell);
      return { definitionId: item.definitionId, instanceId: item.instanceId, from: { x: metrics.x - screenRect.x + center.x, y: metrics.y - screenRect.y + center.y }, to: targets[index]! };
    });
    const coinFrom = targets.reduce((point, target) => ({ x: point.x + target.x / targets.length, y: point.y + target.y / targets.length }), { x: 0, y: 0 });
    const coinTo = { x: coinRect.x - screenRect.x + coinRect.width / 2, y: coinRect.y - screenRect.y + coinRect.height / 2 };
    // Every reward the order pays flies into its own counter: Glow, and the Timber and Meals when it pays them.
    const payout = supplyOrderPayout(entry);
    const toCounter = (rect: { x: number; y: number; width: number; height: number }) => ({ x: rect.x - screenRect.x + rect.width / 2, y: rect.y - screenRect.y + rect.height / 2 });
    const extras = [
      ...(payout.timber > 0 && timberRect ? [{ id: 'timber', amount: payout.timber, art: GAME_CURRENCY_ART.timber, to: toCounter(timberRect), targetSize: { width: timberRect.width, height: timberRect.height } }] : []),
      ...(payout.meals > 0 && mealsRect ? [{ id: 'meals', amount: payout.meals, art: GAME_CURRENCY_ART.meals, to: toCounter(mealsRect), targetSize: { width: mealsRect.width, height: mealsRect.height } }] : []),
    ];
    supplyServingRef.current = entry;
    supplyServeNonceRef.current += 1;
    setSupplyHiddenItemIds(new Set(items.map((item) => item.instanceId)));
    setSupplyServeFlight({ coinAmount: entry.order.reward.coins, coinFrom, coinTo, coinTargetSize: { width: coinRect.width, height: coinRect.height }, energyAmount: 0, energyTo: coinTo, extras, items, nonce: supplyServeNonceRef.current, phase: 'items' });
    return true;
  }, [commitSupplyOrder, measureInScreen, openingBoardMetrics, reduceMotion, supplyOrderPayout, supplyRunStore.state]);
  const supplyItemsArrived = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSupplyServeFlight((current) => current ? { ...current, phase: 'rewards' } : null);
  }, []);
  const supplyCoinArrived = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);
  const finishSupplyServe = useCallback(() => {
    const entry = supplyServingRef.current;
    supplyServingRef.current = null;
    setSupplyServeFlight(null);
    if (!entry) { setSupplyHiddenItemIds(new Set()); return; }
    void commitSupplyOrder(entry).finally(() => setSupplyHiddenItemIds(new Set()));
  }, [commitSupplyOrder]);
  // Baristabbit's Café opens once he is home.
  const supplyRunAvailable = !ftueStepId && mergeWorld.companionDiscovery.records.some((record) => record.characterId === 'baristabbit');
  // Timber and Meals join the currency bar once there is any (or the Café has opened).
  // (And from the first Café visit on: its rewards fly into them.)
  const timberShown = (mergeWorld.materials?.timber ?? 0) > 0 || Boolean(mergeWorld.supplyRun) || supplyRunDocked;
  const mealsShown = (mergeWorld.materials?.meals ?? 0) > 0 || Boolean(mergeWorld.supplyRun) || supplyRunDocked;
  const missionBoardDocked = eventBoardActive || openingBoardActive || stepplingMissionActive || journeyMissionActive || restorationBoardVisible || Boolean(rushSpec) || islandEncounterActive || supplyRunDocked;
  // The Glow a card or chapter paid counts up into the counter once it is back on screen.
  const countGlowIn = useCallback((before: number, amount: number) => {
    if (amount <= 0) return;
    setGlowSpend({ amount, counting: true });
    setDisplayedGlow(before);
    setTimeout(() => setDisplayedGlow(mergeWorldRef.current.coins), 380);
    setTimeout(() => setGlowSpend(null), 1_600);
  }, []);
  const continueBattleReward = useCallback(() => {
    const reward = battleReward;
    if (!reward) return;
    setBattleReward(null);
    reward.finish();
    countGlowIn(reward.before, reward.glow);
  }, [battleReward, countGlowIn]);
  // The Sanctuary's next thing (`constants/sanctuary-chapters.ts`), once the first session is over.
  const chapterState = useMemo(() => sanctuaryChapterState(mergeWorld), [mergeWorld]);
  // The Sanctuary with nothing else up: its buttons, bubbles and chapter card show. Still true once every chapter is done.
  const sanctuarySurfaceFree = !ftueStepId && screenFocused && !rushSheetOpen && !wispLanternOpen && !adventureOpen && !friendWispsFamilyId && !lockedHintFamilyId && !detailCreatureId
    && !pendingIslandDiscovery && !revealedFriendCardId && !wakeHandoffCampaign && !requiredUpgradeStory && !stepplingEncounter.open && !supplyRunOpen && !missionBoardDocked && !upgradePresentation && !buildingPanelId && !katchimeraPanelId && !heroBuildingPanelId && !heroRosterOpen && !heartTreePanelOpen
    && !activeInteractionResidentId && !interactionCreatureId && !trackOpen && !islandEncounter && !battleReward && !selectedUpgrade && !progressSheetOpen && !pendingIslandCampaign;
  const chapterSurfaceFree = Boolean(chapterState) && sanctuarySurfaceFree && !openingTileTap && !arrivalTalk && !rescueRevealing;
  // The first goal after the first session: a finger on the card, once, so the player knows where "next" lives.
  const goalCardRef = useRef<View>(null);
  const firstGoalCoach = chapterSurfaceFree && Boolean(chapterState) && !chapterState!.complete && !chapterState!.openingPending
    && chapterState!.chapter.number === 1 && chapterState!.done === 1 && !mergeWorld.chapterOpeningsSeen?.includes(FIRST_GOAL_COACH_ID);
  // What the Explorer's Lodge has made while you were away: a bubble over its tile, rechecked every minute.
  const [lodgeNow, setLodgeNow] = useState(() => Date.now());
  useEffect(() => {
    if (!screenFocused) return;
    setLodgeNow(Date.now());
    const timer = setInterval(() => setLodgeNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [screenFocused]);
  const lodgeWaiting = lodgeTimberWaiting(mergeWorld, lodgeNow);
  const lodgeCollectingRef = useRef(false);
  const collectLodge = useCallback(() => {
    if (lodgeCollectingRef.current) return;
    lodgeCollectingRef.current = true;
    void collectStoredHeroBuilding('explorers-lodge').catch((error) => console.warn('The Lodge could not be collected', error))
      .finally(() => { lodgeCollectingRef.current = false; setLodgeNow(Date.now()); });
  }, []);
  const lodgeTileBubbles = useMemo(() => (sanctuarySurfaceFree && lodgeWaiting > 0
    ? [{ tileId: 'steppling-home', label: `+${lodgeWaiting}`, art: GAME_CURRENCY_ART.timber, onPress: collectLodge }]
    : undefined), [collectLodge, lodgeWaiting, sanctuarySurfaceFree]);
  // Where Glow, XP and Meals come from, for every "Enter the Mist" and "Earn more" there is: the Grove's levels (Mossprout's
  // own track, then the Daily Mist), or the Café for Timber and Meals. The Merge page these used to open is gone.
  const openGlowSource = useCallback(() => {
    setSelectedUpgrade(null); setUpgradeError(null); setProgressSheetOpen(false);
    const world = mergeWorldRef.current;
    const grove = groveTrack(world, { ftueComplete: true });
    setTrackNotice(null);
    setTrackOpen({ kind: grove.cleared < grove.total || !dailyMistUnlocked(world) ? 'grove' : 'daily' });
  }, []);
  const openCafe = useCallback(() => {
    setSelectedUpgrade(null); setUpgradeError(null);
    if (mergeWorldRef.current.companionDiscovery.records.some((record) => record.characterId === 'baristabbit')) setSupplyRunOpen(true);
    else openGlowSource();
  }, [openGlowSource]);
  const openGoalSource = useCallback((source: GoalNeedSource) => { if (source === 'cafe') openCafe(); else openGlowSource(); }, [openCafe, openGlowSource]);
  const chapterGoalNeed = useMemo(() => (chapterState?.goal ? goalNeed(mergeWorld, chapterState.goal) : null), [chapterState?.goal, mergeWorld]);
  // A light kept on a misted tile while the chapter points there (the lit window): from the opening's camera on.
  // Every friend waiting under their tile's Mist, as a faint silhouette where they will stand: those lost in it from the
  // start (Steppling on his trailhead) and those who can be reached now (Baristabbit's window, then on). Not while their
  // own rescue plays (the board shows them trapped in its cell; the tile clears with them fading in).
  const mistedFriends = useMemo(() => HATCHABLE_COMPANIONS.flatMap((definition) => {
    if (hatchableTiles[definition.tile.id] !== 'locked') return [];
    if (!definition.tile.lostSkinId && !hatchableAvailable(mergeWorld, definition)) return [];
    if (rescueRevealing === definition.companion || (stepplingMissionActive && activeHatchable.companion === definition.companion)) return [];
    return [{ tileId: definition.tile.id, color: '#2B2640' }];
  }), [activeHatchable.companion, hatchableTiles, mergeWorld, rescueRevealing, stepplingMissionActive]);
  const followChapterGoal = useCallback(() => {
    const goal = chapterState?.goal;
    if (!goal) return;
    if (!mergeWorldRef.current.chapterOpeningsSeen?.includes(FIRST_GOAL_COACH_ID)) void markStoredChapterOpened(FIRST_GOAL_COACH_ID).catch(() => undefined);
    // Short of something: straight to where it is earned (the card says what and where).
    if (chapterGoalNeed) { openGoalSource(chapterGoalNeed.source); return; }
    if (goal.action.kind === 'building') { setBuildingPanelId(goal.action.buildingId); return; }
    if (goal.action.kind === 'supply_run') { setSupplyRunOpen(true); return; }
    if (goal.action.kind === 'hero') { openFriendPanel(goal.action.characterId, 'hero'); return; }
    if (goal.action.kind === 'hero_building') {
      const building = HERO_BUILDINGS.find((candidate) => candidate.id === (goal.action as { id: HeroBuildingId }).id);
      if (building) openFriendPanel(building.companion, 'building'); else setHeroBuildingPanelId(goal.action.id);
      return;
    }
    if (goal.action.kind === 'heart_tree') { setHeartTreePanelOpen(true); return; }
    if (goal.action.kind === 'grove') { openGlowSource(); return; }
    if (goal.action.kind === 'world_offer') {
      const offerId = goal.action.offerId;
      const offer = upgradeOffers.find((candidate) => candidate.id === offerId);
      if (offer) void openUpgradeOfferRef.current?.(offer);
      return;
    }
    followKingdomNext(progressSummary.next);
  }, [chapterGoalNeed, chapterState?.goal, followKingdomNext, openGlowSource, openGoalSource, progressSummary.next, upgradeOffers]);
  const followChapterGoalRef = useRef(followChapterGoal);
  followChapterGoalRef.current = followChapterGoal;
  // The Café's first visit is taught (`docs/cozy-4x-ftue-v2-wayfinders-road.md`, Chapter 1), the way the Merge page
  // once taught it: a spotlight and a finger, one step at a time, on the first friend's first order. Pour (tap the Ritual
  // Bar), merge the two pieces the order's item is made of, then Serve. Baristabbit says each step.
  const cafeLesson = useMemo(() => {
    const board = supplyRunStore.state;
    const entry = supplyRunOrders[0];
    if (!supplyRunDocked || !board || !entry || (mergeWorld.supplyRun?.served ?? 0) > 0) return null;
    const order = entry.order;
    const say = (text: string) => ({ speaker: 'Baristabbit', text });
    if (mergeOrderReady(board, order)) {
      const target: FtueTarget = { kind: 'order_serve', orderId: order.id };
      return { cue: { kind: 'tap', target } as FtueCueDefinition, spotlight: { targets: [target], grouping: 'bounding_rect', padding: 6, radius: 18, dimOpacity: 0.55 } as FtueSpotlightDefinition, line: say('That\u2019s it. Tap Serve, and Steppling eats.') };
    }
    const wanted = order.requirements[0]?.definitionId ?? '';
    const tierAt = wanted.lastIndexOf(':');
    const part = tierAt > 0 ? `${wanted.slice(0, tierAt)}:${Number(wanted.slice(tierAt + 1)) - 1}` : '';
    const loose = board.board.flatMap((cell, index) => cell?.occupant?.kind === 'item' && !cell.mist && !cell.locked && cell.occupant.definitionId === part ? [index] : []);
    const bar = board.board.findIndex((cell) => cell?.occupant?.kind === 'generator' && cell.occupant.generatorId === 'ritual-bar');
    if (!cafePoured && bar >= 0) {
      const target: FtueTarget = { kind: 'board_cell', cell: bar };
      return { cue: { kind: 'tap', target } as FtueCueDefinition, spotlight: { targets: [target], grouping: 'bounding_rect', padding: 4, radius: 14, dimOpacity: 0.55 } as FtueSpotlightDefinition, line: say('Tap the Ritual Bar. It pours a Tiny Espresso.') };
    }
    if (loose.length >= 2) {
      const from: FtueTarget = { kind: 'board_cell', cell: loose[1]! };
      const to: FtueTarget = { kind: 'board_cell', cell: loose[0]! };
      return { cue: { kind: 'drag', from, to } as FtueCueDefinition, spotlight: { targets: [from, to], grouping: 'bounding_rect', padding: 3, radius: 11, dimOpacity: 0.55 } as FtueSpotlightDefinition, line: say('Two of the same make the next one. Drag one onto the other.') };
    }
    if (bar >= 0) {
      const target: FtueTarget = { kind: 'board_cell', cell: bar };
      return { cue: { kind: 'tap', target } as FtueCueDefinition, spotlight: null, line: say('Pour another one.') };
    }
    return null;
  }, [cafePoured, mergeWorld.supplyRun?.served, supplyRunDocked, supplyRunOrders, supplyRunStore.state]);
  const cafeAfterFirstLine = (mergeWorld.supplyRun?.served ?? 0) === 1 ? { speaker: 'Baristabbit', text: 'That\u2019s Meals in the pantry. Meals train heroes.' } : null;
  // The bar is the chapter goal's own count when the goal is the Café's (Serve 3 orders: 1 of 3), a crate's five when
  // the goal is a crate; no bar at all otherwise.
  const cafeBar = useMemo(() => {
    const goal = chapterState?.goal;
    const count = goal?.action.kind === 'supply_run' ? goal.progress?.(mergeWorld) : null;
    return count ? { progress: count.current, required: count.total } : null;
  }, [chapterState?.goal, mergeWorld]);
  // When the Café's goal is done, the visit ends on its own and the next goal opens: nothing to find, no bar to restart.
  const cafeGoalRef = useRef<string | null>(null);
  useEffect(() => {
    if (!supplyRunDocked) { cafeGoalRef.current = null; return; }
    const goal = chapterState?.goal ?? null;
    if (cafeGoalRef.current == null) { cafeGoalRef.current = goal?.action.kind === 'supply_run' ? goal.id : ''; return; }
    if (!cafeGoalRef.current || goal?.id === cafeGoalRef.current || supplyServeFlight || battleReward) return;
    const timer = setTimeout(() => {
      setSupplyRunOpen(false);
      // The next goal, straight there (its panel, the next friend's tile); a finished chapter shows its card instead.
      if (goal && !chapterState?.complete) setTimeout(() => followChapterGoalRef.current?.(), 450);
    }, 700);
    return () => clearTimeout(timer);
  }, [battleReward, chapterState?.complete, chapterState?.goal, supplyRunDocked, supplyServeFlight]);
  // The chapter's opening (The Signal): camera to the island, the flare, the friends' lines, the chapter's card. Once.
  const [chapterOpeningPhase, setChapterOpeningPhase] = useState<'camera' | 'flare' | 'talk' | 'title' | null>(null);
  const chapterOpening = chapterState?.openingPending ? chapterState.chapter.opening ?? null : null;
  useEffect(() => {
    if (!chapterOpening || !chapterSurfaceFree || chapterOpeningPhase) return;
    setChapterOpeningPlace({ islandId: chapterOpening.islandId, tileId: chapterOpening.tileId });
    setChapterOpeningPhase('camera');
  }, [chapterOpening, chapterOpeningPhase, chapterSurfaceFree]);
  // The flare waits for the camera, but never forever: its fallback runs from the moment the camera phase starts and
  // is not restarted by the camera settling and unsettling (a camera that keeps moving once left the opening stuck).
  useEffect(() => {
    if (chapterOpeningPhase !== 'camera') return;
    const fallback = setTimeout(() => setChapterOpeningPhase((phase) => (phase === 'camera' ? 'flare' : phase)), 2_600);
    return () => clearTimeout(fallback);
  }, [chapterOpeningPhase]);
  useEffect(() => {
    if (chapterOpeningPhase !== 'camera' || !ftueCameraSettled) return;
    const timer = setTimeout(() => setChapterOpeningPhase((phase) => (phase === 'camera' ? 'flare' : phase)), 300);
    return () => clearTimeout(timer);
  }, [chapterOpeningPhase, ftueCameraSettled]);
  // An opening whose chapter was marked opened elsewhere (a relaunch, another device) lets go of the camera.
  useEffect(() => {
    if (chapterOpening || !chapterOpeningPhase || openingTileTap) return;
    setChapterOpeningPhase(null);
    setChapterOpeningPlace(null);
  }, [chapterOpening, chapterOpeningPhase, openingTileTap]);
  useEffect(() => {
    if (chapterOpeningPhase !== 'flare') return;
    const timer = setTimeout(() => setChapterOpeningPhase('talk'), CHAPTER_SIGNAL_FLARE_MS);
    return () => clearTimeout(timer);
  }, [chapterOpeningPhase]);
  // A chapter opening on a friend's tile (the lit window) leaves the camera there, and the one thing to do is tap it:
  // a finger under their silhouette, nothing else takes a touch. The goal widget comes later.
  const finishChapterOpening = useCallback(() => {
    const chapter = chapterState?.chapter;
    setChapterOpeningPhase(null);
    const tileId = chapter?.opening?.tileId;
    if (tileId && chapterState?.goal?.action.kind === 'world_offer' && chapterState.goal.action.offerId === `mist:${tileId}`) setOpeningTileTap(tileId);
    else setChapterOpeningPlace(null);
    if (chapter) void markStoredChapterOpened(chapter.id).catch(() => undefined);
  }, [chapterState?.chapter, chapterState?.goal]);
  const tapOpeningTile = useCallback(() => {
    setOpeningTileTap(null);
    // The camera stays on the tile while the rescue takes it over (its own framing of the same tile), then lets go.
    setTimeout(() => setChapterOpeningPlace((place) => (place?.tileId ? null : place)), 1_400);
    // The one guided way through the story's hold: this tap opens the tile's panel.
    storyBypassRef.current = true;
    try { followChapterGoalRef.current?.(); } finally { storyBypassRef.current = false; }
  }, []);
  // The Heart Tree up a level: Glow leaves the counter, and when it grows into its next stage the Heartwood
  // crossblends (the same reveal the first session wakes it with).
  const upgradeHeartTreeWithFx = useCallback(async (expectedLevel: number) => {
    const before = mergeWorldRef.current.coins;
    const from = heartwoodStage(mergeWorldRef.current);
    // Every level plays the tile upgrade (the same sequence as a Mist clear): Glow flies from the counter into the tree,
    // the field of light rises around it, and when it grows a stage the Heartwood crossblends into its new art.
    const coinOrigin = reduceMotion ? { x: 0, y: 0 } : await measureGlowCurrencyOrigin();
    const result = await upgradeStoredHeartTree(expectedLevel);
    const spent = before - result.state.coins;
    const to = heartwoodStage(result.state);
    if (spent > 0 && reduceMotion) setDisplayedGlow(result.state.coins);
    if (spent > 0 && !reduceMotion) {
      revealedUpgradeRef.current = null;
      setUpgrading(true);
      // The counter holds the old Glow while the coins fly into the tile; it counts down when the upgrade lands.
      setDisplayedGlow(before);
      const homeStage = (result.state.haven.tileStages.mossprout ?? 0) as HavenStage;
      setUpgradePresentation({
        cameraAlreadyFocused: true, characterId: 'mossprout', coinCost: spent, coinOrigin,
        creatureId: 'companion:mossprout', creatureName: 'Mossprout', fromStage: homeStage, toStage: homeStage,
        nonce: ++upgradeNonceRef.current,
        palette: { accent: '#FFE7A8', glow: '#FFD36B', mist: 'rgba(255,240,205,0.9)', primary: '#E0A23C' },
        reactionLine: '', showCoins: true, status: 'playing', upgradeName: 'Heart Tree',
        heartTree: { from, to, grown: true },
      });
    }
    return result;
  }, [measureGlowCurrencyOrigin, reduceMotion]);
  // A hero building up a level: Glow leaves the counter, the world is written, and a new look crossblends on the tile.
  const upgradeHeroBuildingWithFx = useCallback(async (id: HeroBuildingId, expectedLevel: number) => {
    const before = mergeWorldRef.current.coins;
    // Every level plays the tile upgrade (the same sequence as a Mist clear): Glow flies from the counter into the tile,
    // the field of light rises around it, and when the building reaches a new look the tile crossblends into it.
    const coinOrigin = reduceMotion ? { x: 0, y: 0 } : await measureGlowCurrencyOrigin();
    const result = await upgradeStoredHeroBuilding(id, expectedLevel);
    const spent = before - result.state.coins;
    const building = heroBuildingById.get(id)!;
    const [from, to] = [heroTileSlot(expectedLevel), heroTileSlot(expectedLevel + 1)];
    if (spent > 0 && reduceMotion) setDisplayedGlow(result.state.coins);
    if (spent > 0 && !reduceMotion) {
      revealedUpgradeRef.current = null;
      setUpgrading(true);
      setDisplayedGlow(before);
      setUpgradePresentation({
        cameraAlreadyFocused: true, characterId: building.companion, coinCost: spent, coinOrigin,
        creatureId: `companion:${building.companion}`, creatureName: building.name, fromStage: 1, toStage: 1,
        nonce: ++upgradeNonceRef.current,
        palette: { accent: '#FFE7A8', glow: '#FFD36B', mist: 'rgba(255,240,205,0.9)', primary: '#B07A3E' },
        reactionLine: '', showCoins: true, status: 'playing', upgradeName: building.name,
        tileLook: { tileId: building.tileId, from, to },
      });
    }
    return result;
  }, [measureGlowCurrencyOrigin, reduceMotion]);
  const upgradeKatchimeraWithFx = useCallback(async (id: MergeCharacterId, expectedLevel: number) => {
    const before = mergeWorldRef.current.coins;
    const coinOrigin = reduceMotion ? { x: 0, y: 0 } : await measureGlowCurrencyOrigin();
    const result = await upgradeStoredKatchimera(id, expectedLevel);
    if (!result.changed && result.message) throw new Error(result.message);
    const spent = before - result.state.coins;
    if (spent > 0 && reduceMotion) setDisplayedGlow(result.state.coins);
    if (spent <= 0 || reduceMotion) return;
    const building = heroBuildingForCompanion(id);
    const hatchable = hatchableByCompanion(id);
    const layerId = id === 'mossprout' ? 'home' : building ? heroTileLayerId(building.tileId) : hatchable ? `structure:${hatchable.tile.id}` : null;
    if (!layerId) { setDisplayedGlow(result.state.coins); return; }
    revealedUpgradeRef.current = null;
    setUpgrading(true);
    setDisplayedGlow(before);
    setUpgradePresentation({
      cameraAlreadyFocused: true, characterId: id, coinCost: spent, coinOrigin,
      creatureId: `companion:${id}`, creatureName: katchimeraSkinById.get(id)?.displayName ?? id, fromStage: 1, toStage: 1,
      nonce: ++upgradeNonceRef.current,
      palette: { accent: '#DDF6FF', glow: '#A9E4FF', mist: 'rgba(214,229,238,0.92)', primary: '#7FBFD9' },
      reactionLine: '', showCoins: true, status: 'playing', upgradeName: 'level',
      tileLevelUp: { layerId },
    });
  }, [measureGlowCurrencyOrigin, reduceMotion]);
  const chapterClaimingRef = useRef(false);
  const claimChapter = useCallback(() => {
    const chapter = chapterState?.chapter;
    if (!chapter || chapterClaimingRef.current) return;
    chapterClaimingRef.current = true;
    const before = mergeWorldRef.current.coins;
    void claimStoredChapterReward(chapter.id, chapter.reward.glow)
      .then(() => countGlowIn(before, chapter.reward.glow))
      .finally(() => { chapterClaimingRef.current = false; });
  }, [chapterState?.chapter, countGlowIn]);
  // A chapter's opening scene (and a friend's tile clearing) plays alone: no markers pop up over it.
  const storyHold = Boolean(chapterState?.openingPending && chapterState.chapter.opening?.tileId) || Boolean(chapterOpeningPhase) || Boolean(openingTileTap) || Boolean(arrivalTalk) || Boolean(rescueRevealing);
  storyHoldRef.current = storyHold;
  const worldOffers = storyHold ? NO_UPGRADE_OFFERS : homeSoloForStep(ftueStepId) ? NO_UPGRADE_OFFERS : restorationHandoff ? NO_UPGRADE_OFFERS : missionBoardDocked ? NO_UPGRADE_OFFERS : chapterOpeningPhase || rescueRevealing ? NO_UPGRADE_OFFERS : visibleWorldUpgradeOffers(presentedUpgradeOffers, ftueStepId, glowRun, activeHatchable.tile.id);
  // After the first session only what the story is about shows: the chapter's island, a friend's tile the chapter asks
  // for, anything already open, and the Grove. The old restore, sleeping islands and later friends wait their turn.
  const visibleUpgradeOffers = useMemo(() => (ftueStepId || !sanctuaryFounded(mergeWorld) ? worldOffers : chapterOffers(mergeWorld, worldOffers, chapterState)), [chapterState, ftueStepId, mergeWorld, worldOffers]);

  // The canvas is memoised, and it holds only if none of its props change identity on an ordinary
  // screen render: these handlers read live state through a ref instead of being re-created.
  // While a mini board is docked under a tile, the world behind it takes no taps: the only ways out are its own Back
  // or Leave and finishing it. (Markers are already gone; this covers the tiles themselves.)
  const selectLockedFamily = useStableCallback((familyId: string) => {
    if (kingdomGoalGuideActive || missionBoardDocked) return;
    if (!ftueStep || ftueStep.surface !== 'haven') setLockedHintFamilyId(familyId);
  });
  const openNatureIslandOffer = useStableCallback((islandId: MossproutNatureIslandId) => {
    const offer = presentedUpgradeOffers.find((candidate) => candidate.id === `nature:${islandId}`);
    if (offer?.lockedReason) {
      void openUpgradeOffer(offer);
      return;
    }
    if (offer) void openUpgradeOffer(offer);
    else { const archive = worldUpgradeArchiveOffer(mergeWorld, `nature:${islandId}`); if (archive) setSelectedUpgrade(archive); }
  });
  const selectNatureIsland = useStableCallback((islandId: MossproutNatureIslandId) => {
    if (ftueStep?.surface === 'haven' || missionBoardDocked) return;
    if (kingdomGoalGuideActive && islandId !== goalIslandId) return;
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Dashkit's tile, once they are home, opens the daily trial; their story stays one tap away inside it (and on the tile's marker).
    if (islandId === WISP_RUSH_HOST.islandId && (mergeWorld.haven.mossproutNatureIslands[islandId] ?? 0) >= WISP_RUSH_HOST.unlockLevel) {
      setRushNotice(null);
      setRushSheetOpen(true);
      return;
    }
    openNatureIslandOffer(islandId);
  });
  const selectGateway = useStableCallback(() => {
    if (kingdomGoalGuideActive || missionBoardDocked || storyHoldRef.current) return;
    // The Egg on the live companion's tile opens their encounter.
    if (hatchableGatewayState(mergeWorld, activeHatchable) === 'egg' && !glowDiscoveryLocksCamera(glowRun)) {
      setFtueCameraSettled(false);
      setGlowPanelOpen(false);
      void stepplingEncounter.enter();
      return;
    }
    if (glowRun && glowDiscoveryMissionNode(glowRun.nodeId)) { if (glowRun.status === 'failed_recoverable') void resumeActiveHatchable(); return; }
    const offer = upgradeOffers.find((candidate) => candidate.id === `mist:${activeHatchable.tile.id}`);
    if (offer && (!glowRun || glowRun.status === 'completed' || GLOW_GATEWAY_NODE_IDS.includes(glowRun.nodeId))) { void openUpgradeOffer(offer); return; }
    setGlowPanelOpen(true);
    void resumeActiveHatchable();
  });
  const selectResidentFromCanvas = useStableCallback((creatureId: string) => {
    if (storyHoldRef.current) return;
    if (glowDiscoveryLocksCamera(glowRun) || kingdomGoalGuideActive || missionBoardDocked) return;
    selectResident(creatureId);
  });
  const canvasNatureIslandReveals = useMemo(
    () => Object.fromEntries(Object.keys(mergeWorld.haven.mossproutNatureIslandReveals).map((id) => [id, true])),
    [mergeWorld.haven.mossproutNatureIslandReveals],
  );

  // A friend without a page is looked at on a detail card: that is an interaction too, and nothing of the world's begins under it.
  const sharedAdventureAllowed = !lanternSurfaceOpen && !adventureOpen && !eventBoardActive && screenFocused && !activeInteractionResidentId && !interactionCreatureId && !detailCreatureId && !stepplingSurfaceOpen && !upgradePresentation && !navigationLocked && !kingdomGoalGuideActive && !kingdomGoalPending && !sharedUpgrade && !requiredUpgradeStory && !pendingIslandDiscovery && !progressSheetOpen && !restorationBoardVisible && !stepplingMissionActive && !journeyMissionActive && !pendingIslandCampaign && !ordinaryUpgradeRun && !ftueStepId && !rushSheetOpen && !rushSpec && !islandEncounter && !trackOpen;
  const heartwoodRecap = sharedAdventureAllowed && !(glowPanelOpen && glowGatewayActive && glowRun?.status !== 'completed') && !havenMergeBoardActive && (mergeWorld.haven.tileStages.mossprout ?? 0) >= 1 && needsHeartwoodRecap(mergeWorld);
  const worldEventsAllowed = sharedAdventureAllowed && !havenMergeBoardActive && !heartwoodRecap;
  // havenMergeBoardActive means an owned Mossprout can open the Garden, not
  // that a board is on screen. Owning the Garden must not disable this tap.
  const wispLanternAllowed = sharedAdventureAllowed && !heartwoodRecap
    && !(glowPanelOpen && glowGatewayActive && glowRun?.status !== 'completed');
  const wispLanternAdornment = lanternEligible(mergeWorld) ? <WispLanternWorld
    level={mergeWorld.wispLanternProgress?.level}
    planted={Boolean(mergeWorld.wispLanternPlacement)} rewards={mergeWorld.wispLanternProgress?.rewards}
    onPress={wispLanternAllowed ? () => setWispLanternOpen(true) : undefined} /> : null;

  // Each building stands on its own patch. While one is open on the stage the others stay drawn but do not take taps.
  // A built one stays drawn through the rest of the first session (the Spring the first seed became); the signs on
  // empty patches are offers, and wait until the first session is over.
  const buildingOffersShown = heartwoodBuildingsEligible(mergeWorld) && !ftueStepId;
  const heartwoodBuiltSlots = HEARTWOOD_BUILDINGS.filter((building) => heartwoodBuildingLevel(mergeWorld, building.id) > 0).map((building) => building.slotId);
  const heartwoodBuildingAdornments = Object.fromEntries(HEARTWOOD_BUILDINGS.flatMap((building) => {
    const level = heartwoodBuildingLevel(mergeWorld, building.id);
    // An unbuilt patch's sign is an offer: it only shows while the world is free to take it. Its first build keeps
    // the spot mounted, sign away, so the coins have somewhere to land and the building can swell up out of it.
    const spawning = level === 0 && buildingFx?.id === building.id;
    if (level === 0 && !spawning && (!buildingOffersShown || !wispLanternAllowed || buildingPanelId != null)) return [];
    return [[building.slotId, <HeartwoodBuildingWorld key={building.id} id={building.id} level={level}
      affordable={mergeWorld.coins >= (heartwoodBuildingCost(level) ?? Infinity)}
      impactNonce={buildingImpact?.id === building.id ? buildingImpact.nonce : 0}
      charged={buildingFx?.id === building.id && buildingFx.phase !== 'payment'} spawning={spawning}
      onPress={wispLanternAllowed ? () => setBuildingPanelId(building.id) : undefined} />]];
  }));

  useEffect(() => {
    if (!wispLanternAllowed || !lanternEligible(mergeWorld) || wispAutoPresented.current || eventSelection || wakeHandoffCampaign || revealedFriendCardId || heartwoodOpenToken > 0) return;
    if (mergeWorld.wispLanternPlacement && loadWispState().lantern?.introducedAt != null) return;
    wispAutoPresented.current = true;
    setWispLanternOpen(true);
  }, [wispLanternAllowed, mergeWorld, eventSelection, wakeHandoffCampaign, revealedFriendCardId, heartwoodOpenToken]);

  // Ordinary story/FTUE always wins. Only a new occurrence auto-introduces;
  // later chapters stay available as cards, and interrupted stories resume by tap.
  useEffect(() => {
    if (!worldEventsAllowed || eventSelection) return;
    const action = eventActions.find(a => a.phase === 'opening' && !mergeWorld.localLiveOps?.runs[a.event.id] && !eventIntroduced.current.has(a.event.id));
    if (!action) return;
    eventIntroduced.current.add(action.event.id);
    void openWorldEvent(action);
  }, [eventActions, eventSelection, mergeWorld.localLiveOps, openWorldEvent, worldEventsAllowed]);
  useEffect(() => {
    if (!eventSelection || eventBusy.current) return;
    if (!selectedEventAction) {
      setEventSelection(null);
      if (eventSelection.kind !== 'board') requestResidentInteractionExit();
    } else if (eventSelection.kind === 'board' && selectedEventAction.phase === 'resolution') {
      const timer = setTimeout(() => { setEventSelection(null); void openWorldEvent(selectedEventAction); }, 900);
      return () => clearTimeout(timer);
    }
  }, [eventSelection, selectedEventAction, openWorldEvent, requestResidentInteractionExit]);

  // Mount the camera with its saved framing, rather than initializing the overview first.
  // A Haven's details and a hidden friend's tile share the upgrade stage with the offers: the canvas frames them the same way.
  const detailFamilyId = detailCreatureId ? visibleCompanionSlots.find((slot) => slot.kind === 'owned' && slot.creature.creatureId === detailCreatureId)?.familyId ?? null : null;
  const upgradeStageSubject = useMemo(() => lockedHintFamilyId
    ? { id: `hidden:${lockedHintFamilyId}`, target: { kind: 'haven_tile' as const, familyId: lockedHintFamilyId } }
    : detailFamilyId ? { id: `haven:${detailFamilyId}`, target: { kind: 'haven_tile' as const, familyId: detailFamilyId } } : null,
  [detailFamilyId, lockedHintFamilyId]);

  if (!glowReady || !stepplingLesson.ready) return null;

  const upgradePanelOpen = Boolean(screenFocused && sharedUpgrade && !upgradePresentation && !upgradeHandoffPending && !activeInteractionResidentId);

  return (
    <View collapsable={false} onLayout={onContentReady} ref={screenRef} style={styles.screen}>
      <KingdomHexCanvas
        onHeartwoodPress={sharedAdventureAllowed ? () => { setSelectedHeartwoodBed(undefined); setHeartwoodOpenToken(value => value + 1); } : undefined}
        wispLanternAdornment={wispLanternAdornment}
        heartwoodBuildingAdornments={heartwoodBuildingAdornments}
        heartwoodBuildingFx={buildingFx}
        heartwoodBuiltSlots={heartwoodBuiltSlots}
        wispLanternPlanted={Boolean(mergeWorld.wispLanternPlacement)}
        onPlantWispLantern={wispPlanting ? plantWispLantern : undefined}
        onSelectHeartwoodBed={sharedAdventureAllowed ? (slotId) => { setSelectedHeartwoodBed(slotId); setHeartwoodOpenToken(value => value + 1); } : undefined}
        lanternPostAdornment={SHARED_ADVENTURE_ENABLED && kingdomGoal?.introducedAt ? <LanternPost progress={mergeWorld.sharedAdventure} onPress={sharedAdventureAllowed ? () => setAdventureOpen(true) : undefined} /> : null}
        hearthAdornment={sharedAdventureAllowed && mergeWorld.sharedAdventure?.completedAt ? <KatchaButton label="🍲 Warm delivery" onPress={() => { setRouteCompanion('feastle'); setAdventureOpen(true); }} /> : null}
        gardenEventAdornment={worldEventsAllowed ? <View style={{ gap: 8 }}>
          {treeStage !== 'dormant' ? <KatchaButton label={`🌱 Garden supplies ${gardenSupplyStatus(mergeWorld.sharedAdventure?.gardenSupply, eventClock).stored}/2`} onPress={() => setHeartwoodOpenToken(value => value + 1)} /> : null}
          <GardenEventAdornment world={mergeWorld} onExplore={eventActions.length ? () => { void openWorldEvent(eventActions[0]); } : undefined} />
        </View> : null}
        background={background}
        cameraLocked={lanternSurfaceOpen || eventBoardActive || ftueLocksCamera(ftueStep) || glowDiscoveryLocksCamera(glowRun) || stepplingEncounter.open || stepplingLesson.active || kingdomGoalGuideActive || Boolean(selectedUpgrade) || Boolean(upgradeStageSubject) || Boolean(requiredUpgradeStory) || restorationBoardVisible || rushSheetOpen || Boolean(rushSpec) || islandEncounterActive
          // The Café holds the camera on its tile: nothing behind the board moves it.
          || supplyRunOpen
          // A chapter's opening scene and its tile tap hold the camera: no touch cancels the move.
          || Boolean(chapterOpeningPhase) || Boolean(openingTileTap)}
        discoveredEggInteraction={stepplingEncounter.open}
        gatewayTileId={activeHatchable.tile.id}
        discoveredEggPresentation={stepplingEncounter.presentation}
        discoveredEggTargetRef={stepplingEncounter.feedController.eggTargetRef}
        cameraMaximumScale={stepplingEncounter.open ? DISCOVERED_EGG_ZOOM : ftueEggFeedingCloseupActive
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
        interactionEnabled={!lanternSurfaceOpen && !activeInteractionResidentId && !stepplingEncounter.open && !supplyRunOpen && !storyHold && (mistUpgradeActive || havenOpeningActive || !ftueStep || ftueStep.surface !== 'haven')}
        interactionExitNonce={interactionExitNonce}
        interactionNatureIslandId={pendingIslandCampaign?.campaign.islandId ?? null}
        preserveInteractionCameraOnExit={Boolean(pendingIslandCampaign || eventSelection || interactionExitHandsOver)}
        interactionResidentAnchorY={ftueReturnResidentAnchorY}
        interactionResidentId={activeInteractionResidentId}
        mossproutMeditating={mossproutMeditating}
        interactionRewardPulseKey={pendingIslandCampaign ? 0 : interactionRewardPulseKey}
        gardenOrdersInteractive={false}
        initialTutorialCameraScale={initialFtueCameraScale}
        initialCameraSnapshot={initialCameraSnapshot}
        mossproutNatureIslandLevels={mergeWorld.haven.mossproutNatureIslands}
        mossproutNatureIslandReveals={canvasNatureIslandReveals}
        mossproutGarden={mossproutGardenScene}
        onCameraSnapshotChange={onCameraSnapshotChange}
        onCameraMotionChange={handleCameraMotionChange}
        onInteractionExitFocusComplete={closeResidentInteraction}
        onOpenGarden={ftueStepId ? undefined : openGarden}
        onGardenPlotTargetChange={setGardenPlotNode}
        onHomeTileTargetChange={setHomeTileNode}
        homeVeil={homeVeil}
        homeSolo={homeSoloForStep(ftueStepId)}
        revealWorldWithHome={heartwoodIntroActive}
        openingWeather={homeVeil !== 'none'}
        openingWeatherActive={homeVeil === 'veiled' && !missionBoardDocked}
        sleepingMarkersInert={Boolean(ftueStepId)}
        onTileUpgradeOfferPress={wispPlanting ? plantWispLantern : beginFirstSeedPlanting}
        upgradeOffers={screenFocused && !activeInteractionResidentId && !interactionCreatureId && !stepplingEggOpen && !ordinaryUpgradeRun && !upgradeHandoffPending
          ? kingdomGoalGuideActive ? visibleUpgradeOffers.filter((offer) => offer.id === `nature:${goalIslandId}`) : visibleUpgradeOffers
          : NO_UPGRADE_OFFERS}
        selectedUpgradeOffer={selectedUpgrade}
        onDismissUpgrade={() => upgradeDismiss.current?.()}
        upgradePanelOpen={upgradePanelOpen || Boolean(upgradeStageSubject)}
        upgradeStageSubject={sharedUpgrade ? null : upgradeStageSubject}
        onUpgradeStageArt={setUpgradeStageArt}
        upgradeStage={upgradeStageBand}
        preserveUpgradeCamera={ftueGardenUpgradeActive || Boolean(pendingIslandCampaign)
          || (selectedUpgrade?.id === `mist:${activeHatchable.tile.id}` && Boolean(glowRun && glowRun.status !== 'completed'))}
        upgradeSelectionCommitted={upgradeCommitted}
        upgradeFailed={Boolean(upgradeError)}
        onUpgradeOfferPress={handleUpgradeOfferPress}
        onUpgradeOfferTargetChange={setUpgradeMarkerNode}
        onTileUpgradeOfferTargetChange={setGardenWorldOfferNode}
        onSelectHome={noop}
        onSelectLocked={selectLockedFamily}
        onSelectNatureIsland={selectNatureIsland}
        focusNatureIslandId={focusIslandId}
        onFocusNatureIslandComplete={completeIslandFocus}
        onSelectMemoryPlant={kingdomGoalGuideActive || missionBoardDocked ? undefined : setSelectedMemoryPlantId}
        onGatewayTargetChange={setGatewayNode}
        onNatureIslandTargetChange={setNatureIslandTileNode}
        onStoryTileTargetChange={setStoryTileNode}
        cameraMinimumScale={ftueStepId === FRONTIER_STEP_ID ? FRONTIER_MINIMUM_SCALE : undefined}
        tileBubbles={lodgeTileBubbles}
        tileBeacons={mistedFriends}
        soloLayerId={soloLayerId}
        soloOfferId={soloOfferId}
        storyOperationsEnabled={screenFocused && !activeInteractionResidentId && !interactionExiting}
        onSelectGateway={selectGateway}
        onSelectResident={selectResidentFromCanvas}
        onResidentFocusComplete={completeResidentFocus}
        onUpgradePresentationComplete={completeUpgradePresentation}
        recenterBottom={Math.max(insets.bottom, 12) + 150}
        residentStatusGlyphs={residentStatusGlyphs}
        residentWisps={sanctuaryFounded(mergeWorld) ? NO_RESIDENT_WISPS : residentWisps}
        onResidentWispsPress={sharedAdventureAllowed ? setFriendWispsFamilyId : undefined}
        tileUpgradeOffer={wispPlanting ? LANTERN_PLANT_OFFER : ftueStepId === 'world.garden_arrival'
          ? FIRST_SEED_GARDEN_PLANT_OFFER
          : null}
        tutorialCamera={tutorialCamera}
        upgradePresentation={upgradePresentation}
        focusedMossproutWorld
        worldEggTargetRef={worldEggTargetRef}
        worldSubjectPresentation={openingLiftCameraHeld ? null : worldSubjectPresentation}
      />
      {/* The companion journal is a life-input feature: off with them (`constants/product-scope.ts`). */}
      {LIFE_INPUT_ENABLED && !activeInteractionResidentId && !interactionCreatureId && !stepplingSurfaceOpen && !upgradePresentation && !navigationLocked && !kingdomGoalGuideActive && !kingdomGoalPending && !sharedUpgrade && (!ftueStepId || ftueStepId === 'companion.meditating') ? <View style={{ position: 'absolute', left: 16, bottom: Math.max(insets.bottom, 12) + 10, zIndex: 30 }}>
        <CompanionJournalButton familyId="mossprout" />
      </View> : null}
      {heartwoodRecap ? <HeartwoodStoryScene scene="recap" onContinue={() => { if (kingdomGoal?.introducedAt) setAdventureOpen(true); }} /> : null}
      {sharedAdventureAllowed && !chapterState && (mergeWorld.haven.tileStages.mossprout ?? 0) >= 1 && !heartwoodRecap && !havenMergeBoardActive && !(glowPanelOpen && glowGatewayActive && glowRun?.status !== 'completed') ? <View style={{ position: 'absolute', top: insets.top + 56, left: 18, right: 18, zIndex: 32 }}>
        <HeartwoodRoad selectedBed={selectedHeartwoodBed} world={mergeWorld} openToken={heartwoodOpenToken} onOpenHandled={() => setHeartwoodOpenToken(0)} onGarden={() => openGarden(undefined, 'mossprout')} onNext={() => {
          if (kingdomGoal?.introducedAt) { setAdventureOpen(true); return; }
          const offer = upgradeOffers.find(item => item.id === 'mist:steppling-home');
          if (offer) void openUpgradeOffer(offer);
          else openGarden(undefined, 'steppling');
        }} />
      </View> : null}
      {worldEventsAllowed ? <LocalWorldEvents world={mergeWorld} onMerge={openGarden} onExplore={(id) => { const action = eventActions.find(a => a.event.id === id); if (action) void openWorldEvent(action); }} /> : null}
      {worldEventsAllowed && eventActions.length > 0 ? <View style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(insets.bottom, 12) + 82, zIndex: 32, gap: 6 }}>
        {eventActions.slice(0, 2).map(action => <WorldEventActionCard key={action.event.id} action={action} onPress={() => void openWorldEvent(action)} />)}
      </View> : null}
      {wispPlanting && screenFocused ? <HavenFtueOverlay
        cue={{ kind: 'tap', target: { kind: 'haven_garden_plant_button', characterId: 'mossprout' } }}
        spotlight={{ targets: [{ kind: 'haven_garden_plot', characterId: 'mossprout', slotId: 'front-right' }, { kind: 'haven_garden_plant_button', characterId: 'mossprout' }], grouping: 'bounding_rect', padding: 8, radius: 22, dimOpacity: 0.62 }}
        fingerPlacement="below" screenRef={screenRef} targetRefs={ftueTargetRefs} targetRevision={ftueTargetRevision} /> : null}
      {wispPlantError && wispPlanting ? <View style={{ position: 'absolute', bottom: insets.bottom + 24, left: 20, right: 20, zIndex: 160 }}><ThemedText accessibilityRole="alert">{wispPlantError}</ThemedText></View> : null}
      {upgradePanelOpen && sharedUpgrade ? <WorldUpgradePanel key={`${sharedUpgrade.id}:${sharedUpgrade.nextLevel}`}
        offer={sharedUpgrade} world={mergeWorld} busy={upgradePurchasing || (upgradeCommitted && !upgradeError)}
        layout={upgradeStage} bottomInset={insets.bottom} currentArt={upgradeStageArt}
        campaignState={islandCampaignPanelState}
        saveRead={saveUpgradeStoryRead}
        onCoachmarkChange={setUpgradeCoachmark} error={upgradeError} coached={coachedUpgrade} actionRef={upgradeActionRef} registerDismiss={registerUpgradeDismiss}
        onCampaignAction={islandCampaignPanelState?.actionLabel ? handleIslandCampaignPanelAction : undefined}
        onClose={() => { pendingUpgradeReward.current = null; setSelectedUpgrade(null); setUpgradeError(null); }} onConfirm={() => { void confirmWorldUpgrade(); }}
        onGarden={() => { openGlowSource(); }} /> : null}
      {wispLanternOpen && screenFocused ? <WispLanternPanel onPlantingChange={setWispPlanting} world={mergeWorld} onClose={() => setWispLanternOpen(false)} onGarden={() => { setWispLanternOpen(false); openGarden(undefined, 'mossprout'); }}
        onUpgrade={() => { setWispLanternOpen(false); setLanternUpgradeOpen(true); }} /> : null}
      {lanternUpgradeOpen && screenFocused ? <WispLanternUpgradePanel world={mergeWorld} layout={upgradeStage} bottomInset={insets.bottom}
        onUpgrade={upgradeStoredWispLantern}
        onClose={() => { setLanternUpgradeOpen(false); setWispLanternOpen(true); }}
        onGarden={() => { setLanternUpgradeOpen(false); openGarden(undefined, 'mossprout'); }} /> : null}
      {friendWispsFamilyId && screenFocused ? <FriendWispsSheet familyId={friendWispsFamilyId}
        friendName={katchimeraFamilyById.get(friendWispsFamilyId)?.displayName ?? 'your friend'} onClose={() => setFriendWispsFamilyId(null)} /> : null}
      {openTrack && !islandEncounter && screenFocused ? <LevelTrackSheet key={openTrack.id} track={openTrack} world={mergeWorld} layout={upgradeStage} bottomInset={insets.bottom}
        ownedWispIds={Object.keys(wispState.unlocked)} busy={trackBusy} notice={trackNotice}
        onPlay={enterTrackLevel} onStory={openTrackStory} onReveal={revealFromTrack} onChest={(threshold) => { void openTrackChest(threshold); }}
        onClose={() => { setTrackOpen(null); setTrackNotice(null); }} /> : null}
      {rushSheetOpen && !rushSpec && screenFocused ? <WispRushSheet world={mergeWorld} dayId={localDayId(new Date(gameNow()))} hostName={WISP_RUSH_HOST.hostName} layout={upgradeStage} bottomInset={insets.bottom}
        result={rushResult} notice={rushNotice} storyLabel={`${WISP_RUSH_HOST.hostName}’s story`}
        onPlay={playRushHeat} onOpenChest={openRushChest} onClose={() => setRushSheetOpen(false)}
        onStory={() => { setRushSheetOpen(false); openNatureIslandOffer(WISP_RUSH_HOST.islandId); }} /> : null}
      {katchimeraPanelId && screenFocused ? <KatchimeraUpgradePanel key={katchimeraPanelId} world={mergeWorld} characterId={katchimeraPanelId} layout={upgradeStage} bottomInset={insets.bottom}
        tabs={friendTabs} entered={friendPanelSwitched} onBuilding={friendTabs ? () => friendTabs.onChange('building') : undefined}
        registerDismiss={registerUpgradeDismiss} onClose={() => setKatchimeraPanelId(null)} onMist={() => { setKatchimeraPanelId(null); openGlowSource(); }} onSupplyRun={() => { setKatchimeraPanelId(null); openCafe(); }}
        onUpgrade={upgradeKatchimeraWithFx} /> : null}
      {heroBuildingPanelId && screenFocused ? <HeroBuildingPanel key={heroBuildingPanelId} world={mergeWorld} buildingId={heroBuildingPanelId} layout={upgradeStage} bottomInset={insets.bottom}
        tabs={friendTabs} entered={friendPanelSwitched}
        registerDismiss={registerUpgradeDismiss} onClose={() => setHeroBuildingPanelId(null)}
        onSupplyRun={() => { setHeroBuildingPanelId(null); openCafe(); }} onMist={() => { setHeroBuildingPanelId(null); openGlowSource(); }}
        onUpgrade={upgradeHeroBuildingWithFx} /> : null}
      {heartTreePanelOpen && screenFocused ? <HeartTreePanel world={mergeWorld} layout={upgradeStage} bottomInset={insets.bottom}
        registerDismiss={registerUpgradeDismiss} onClose={() => setHeartTreePanelOpen(false)}
        onSupplyRun={() => { setHeartTreePanelOpen(false); openCafe(); }} onMist={() => { setHeartTreePanelOpen(false); openGlowSource(); }}
        onUpgrade={upgradeHeartTreeWithFx} /> : null}
      {heroRosterOpen && screenFocused ? <HeroRosterSheet world={mergeWorld} onClose={() => setHeroRosterOpen(false)}
        onTrain={(id) => { setHeroRosterOpen(false); openFriendPanel(id, 'hero'); }}
        onBuilding={(id) => { setHeroRosterOpen(false); const building = HERO_BUILDINGS.find((candidate) => candidate.id === id); if (building) openFriendPanel(building.companion, 'building'); else setHeroBuildingPanelId(id); }} /> : null}
      {buildingPanelId && screenFocused ? <HeartwoodBuildingPanel key={buildingPanelId} world={mergeWorld} buildingId={buildingPanelId} layout={upgradeStage} bottomInset={insets.bottom} registerDismiss={registerUpgradeDismiss}
        onUpgrade={upgradeHeartwoodBuildingWithFx}
        onClose={() => setBuildingPanelId(null)}
        onGarden={() => { setBuildingPanelId(null); openGlowSource(); }} onSupplyRun={() => { setBuildingPanelId(null); openCafe(); }} /> : null}
      {SHARED_ADVENTURE_ENABLED && adventureOpen && screenFocused ? <SharedAdventurePanel world={mergeWorld} routeCompanion={routeCompanion}
        onClose={() => { setAdventureOpen(false); setRouteCompanion(undefined); }}
        onGarden={() => { setAdventureOpen(false); openGarden(undefined, 'mossprout'); }}
        onFeastle={() => {
          setAdventureOpen(false);
          const offer = upgradeOffers.find(item => item.id === 'mist:feastle-home');
          if (offer && !mergeWorld.worldUnlocks?.['feastle:arrival']?.hatchedAt) void openUpgradeOffer(offer);
          else openGarden(undefined, 'feastle');
        }} /> : null}
      {eventBoardActive && selectedEventAction ? <LocalEventMissionDock action={selectedEventAction} width={window.width} bottomInset={insets.bottom} onClose={() => setEventSelection(null)} /> : null}
      {screenFocused && eventError ? <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 160, zIndex: 120 }}><KatchaButton label={eventError} onPress={() => setEventError('')} /></View> : null}
      {screenFocused && mistExitError ? <View style={{ position: 'absolute', bottom: insets.bottom + 20, left: 24, right: 24, zIndex: 120 }}>
        <KatchaButton label="Explore the mist · Try again" onPress={() => requestResidentInteractionExit()} />
      </View> : null}
      {screenFocused && eggHandoff.error ? <View style={{ position: 'absolute', bottom: insets.bottom + 20, left: 24, right: 24, zIndex: 120 }}>
        <KatchaButton label="Try again" onPress={eggHandoff.retry} />
      </View> : null}
      {screenFocused && stepplingEncounter.open ? <HatchableEncounterPanel definition={activeHatchable}
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
      {/* A Lanes battle keeps only Back in the top bar: the Glow count and the friends pill step out while it is played. */}
      {laneBattleActive || ftueGardenUpgradeActive || seedPlantingFtueActive || Boolean(selectedUpgrade) || Boolean(upgradePresentation && !upgradePresentation.veilLift)
        || (!upgradePresentation && (!ftueStepId || ftueStepId === 'companion.meditating')) ? (
        <Animated.View entering={FadeIn.duration(reduceMotion ? 100 : 360)} exiting={FadeOut.duration(reduceMotion ? 80 : 260)} pointerEvents="box-none" style={[styles.topHudLayer, { top: insets.top + 3 }, ftueGardenUpgradeActive && { zIndex: 90 }, supplyRunDocked && { zIndex: FTUE_SCENE_LAYERS.spotlight + 2 }]}>
          <GameHudBar
            leading={laneBattleActive ? <KatchimeraBackButton
              accessibilityHint="Puts the battle away; it is here to come back to"
              accessibilityLabel="Leave the battle"
              compact
              onPress={leaveIslandEncounter}
            /> : supplyRunDocked ? <KatchimeraBackButton
              accessibilityHint="Puts the Café board away; everything on it is kept for next time"
              accessibilityLabel="Leave the Café"
              compact
              onPress={leaveCafe}
            /> : ftueGardenUpgradeActive || seedPlantingFtueActive || upgradePresentation || kingdomGoalGuideActive || restorationHandoff
              // The lesson owns Back only while it has a surface up. Hiding it
              // for an active run with nothing on screen strands the player.
              || (stepplingLesson.active && Boolean(interactionCreatureId))
              // The world is the game's top level: Back is only there while something inside it can be put away.
              || !(stepplingEncounter.open || restorationBoardVisible || interactionCreatureId) ? undefined : <KatchimeraBackButton
              accessibilityHint={restorationBoardVisible ? 'Puts the restoration board away' : stepplingEncounter.open ? 'Closes the encounter' : "Returns to this Katchimera's world"}
              accessibilityLabel={restorationBoardVisible ? 'Put the board away' : stepplingEncounter.open ? 'Close' : 'Exit interaction'}
              compact
              disabled={stepplingEncounter.busy || stepplingEncounter.hatching || interactionExiting}
              onPress={stepplingEncounter.open ? stepplingEncounter.close : restorationBoardVisible ? closeRestoration : () => requestResidentInteractionExit()}
            />}
            content={!laneBattleActive && kingdomGoal?.introducedAt && !kingdomGoalGuideActive && !ftueStepId && !stepplingLesson.active && !upgradePresentation && !restorationHandoff && !interactionCreatureId && !stepplingEncounter.open
              ? <View style={styles.progressPill}><KingdomProgressPill progress={progressSummary} onPress={() => setProgressSheetOpen(true)} /></View>
              : <View />}
            trailing={laneBattleActive ? <View /> : <GameCurrencyHud style={[styles.currencyHud, { width: currencyHudWidth(1 + (timberShown ? 1 : 0) + (mealsShown ? 1 : 0)) }]} balances={[...(mealsShown ? [{
              art: GAME_CURRENCY_ART.meals, artTargetRef: mealsCurrencyArtRef, id: 'meals' as const, value: mergeWorld.materials?.meals ?? 0, valueAnimationDurationMs: reduceMotion ? 180 : 650,
            }] : []), ...(timberShown ? [{
              art: GAME_CURRENCY_ART.timber, artTargetRef: timberCurrencyArtRef, id: 'timber' as const, value: mergeWorld.materials?.timber ?? 0, valueAnimationDurationMs: reduceMotion ? 180 : 650,
            }] : []), {
              animateValue: Boolean(upgradePresentation?.showCoins && upgradePresentation.coinCost > 0) || Boolean(glowSpend?.counting),
              art: GAME_CURRENCY_ART.coins,
              artTargetRef: glowCurrencyArtRef,
              id: 'coins',
              value: displayedGlow,
              valueAnimationDurationMs: reduceMotion ? 180 : 650,
            }]} tone="glass" />}
            density="compact"
            style={styles.topHud}
            tone="glass"
          />
        </Animated.View>
      ) : null}
      {/* The Merge button waits for the Garden lesson in Steppling's discovery: never during the first session. */}
      {!MERGE_PAGE_REMOVED && !stepplingSurfaceOpen && !upgradePresentation && !activeInteractionResidentId && !kingdomGoalGuideActive && !sharedUpgrade && havenMergeBoardActive && !ftueStepId ? (
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
                  void submitHatchableAction(activeHatchable, glowScene.actionId).then((run) => { if (run?.status === 'active') openGarden(); }).catch((error) => console.warn('The Garden could not open', error));
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
            worldEventAction={!eventSelection && !ftueStepId ? eventActions.filter(action => (action.encounter.companionId ?? 'mossprout') === interactionSlot?.familyId).map(action => <WorldEventActionCard key={action.event.id} action={action} onPress={() => {
              if (action.phase === 'board') closeResidentInteraction();
              void openWorldEvent(action);
            }} />) : undefined}
            ftueConversationDefinitionId={hostedInteractionRequest?.ftueConversationDefinitionId}
            hostedInHaven
            hostedNarrativeRequired={Boolean(pendingIslandCampaign || eventSelection)}
            journeyReturnConversationDefinitionId={hostedInteractionRequest?.journeyReturnConversationDefinitionId}
            onHostedClose={requestResidentInteractionExit}
            onHostedInitialConversationComplete={eventSelection ? completeWorldEventConversation : completeIslandCampaignConversation}
            onHostedFtueComplete={closeResidentInteraction}
            onHostedOpenMerge={interactionHasGarden ? openGarden : undefined}
            onVisibleCreatureRewardPulse={pendingIslandCampaign || eventSelection ? undefined : pulseVisibleResident}
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
      {screenFocused && !activeInteractionResidentId && (!ftueStepId || glowGatewayActive) && !upgradePresentation && !stepplingEggOpen && glowRun?.status !== 'completed' && (glowRun?.nodeId !== 'gateway.egg' || glowRun?.status === 'failed_recoverable') && glowPanelOpen && (ftueCameraSettled || glowRun?.status === 'failed_recoverable') && !mistUpgradeActive && !sharedUpgrade && glowGatewayActive && (glowRun?.status === 'failed_recoverable' || (glowScene && glowScene.view.kind !== 'garden') || glowRun?.nodeId.startsWith('lesson.')) ? <GlowGatewayGuide
        world={mergeWorld}
        onClose={() => setGlowPanelOpen(false)}
        onOpenMerge={() => openGlowSource()}
      /> : null}
      {screenFocused && sharedUpgrade && upgradeCoachmark.visible && !upgradePresentation && !requiredUpgradeStory && !activeInteractionResidentId ? <CompanionFtueCoachmark
        targetRef={upgradeActionRef} targetRevision={upgradeCoachmark.revision} placement="above" showFinger
        message={[{ text: `Use ${sharedUpgrade.cost} ` }, { emphasis: true, text: 'Glow' }, { text: sharedUpgrade.action === 'Clear mist' ? ' to clear this mist.' : ' to restore the Garden.' }]} /> : null}
      {kingdomGoalGuideActive && goalCoachmarkArmed && goalIslandId
        && !sharedUpgrade && !upgradePresentation && !requiredUpgradeStory && !activeInteractionResidentId && !interactionCreatureId ? <CompanionFtueCoachmark
        targetRef={goalMarkerRef} targetRevision={goalMarkerRevision} placement="above" showFinger
        message={[{ text: 'Someone is waiting beyond this mist.' }]} /> : null}
      {kingdomGoalPending ? <KingdomGoalScene onDone={finishKingdomGoalScene} /> : null}
      {screenFocused && requiredUpgradeStory ? <WorldUpgradeNarrative key={requiredUpgradeStory.presentation.storyPresentationKey ?? requiredUpgradeStory.presentation.nonce}
        offer={requiredUpgradeStory.offer} world={mergeWorld} required saveRead={saveUpgradeStoryRead}
        onClose={() => finishUpgradePresentation(requiredUpgradeStory.presentation)} /> : null}
      {/* A friend's reveal comes after the island's lift has played out in full, never over the battle or between its beats. */}
      {screenFocused && pendingIslandDiscovery && !activeInteractionResidentId && !sharedUpgrade && !upgradePresentation && !requiredUpgradeStory
        && !upgradeHandoffPending && !islandLiftHold && !islandEncounter ? <KatchimeraFriendDiscoveryReveal
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
        onSharedAdventure={SHARED_ADVENTURE_ENABLED && kingdomGoal?.introducedAt ? () => { setProgressSheetOpen(false); setAdventureOpen(true); } : undefined}
        world={mergeWorld}
        onMerge={() => { setProgressSheetOpen(false); openGlowSource(); }}
        onDailyMist={dailyMistUnlocked(mergeWorld) && !hatchableStoryOpen ? () => { setProgressSheetOpen(false); setTrackOpen({ kind: 'daily' }); } : undefined}
        onGrove={!ftueStepId && !hatchableStoryOpen ? () => { setProgressSheetOpen(false); setTrackOpen({ kind: 'grove' }); } : undefined}
        onExplore={(id) => { setProgressSheetOpen(false); const action = eventActions.find(a => a.event.id === id); if (action) void openWorldEvent(action); }}
      /> : null}
      {screenFocused && wakeHandoffCampaign && !pendingIslandCardReveal && !sharedUpgrade && !upgradePresentation && !interactionCreatureId && goalIslandId ? <IslandWakeHandoffSheet
        campaign={wakeHandoffCampaign}
        nextIslandId={goalIslandId}
        onClose={() => setWakeHandoffCampaign(null)}
        onShow={showIslandFromTracker}
      /> : null}
      {screenFocused && mistUpgradeActive && !sharedUpgrade && !upgradePresentation && !activeInteractionResidentId && !stepplingEggOpen ? (
        <HavenFtueOverlay
          cue={{ kind: 'tap', target: { kind: 'haven_upgrade_button', characterId: activeHatchable.companion } }}
          spotlight={{ targets: [{ kind: 'haven_upgrade_button', characterId: activeHatchable.companion }], grouping: 'bounding_rect' }}
          fingerPlacement="below" screenRef={screenRef} targetRefs={ftueTargetRefs} targetRevision={ftueTargetRevision}
        />
      ) : null}
      {screenFocused && ordinaryUpgradeRun?.status === 'failed_recoverable' && !sharedUpgrade ? <View style={[styles.upgradeRecoveryCta, { bottom: Math.max(insets.bottom, 12) + 20 }]}>
        <KatchaButton label="Resume upgrade" onPress={() => { void dispatchContentFlowCommand(ordinaryUpgradeRun.runId, { type: 'retry' }); }} />
      </View> : screenFocused && glowRun?.status === 'failed_recoverable' && !mistUpgradeActive && !sharedUpgrade && !stepplingEggOpen && !activeInteractionResidentId ? <View style={[styles.upgradeRecoveryCta, { bottom: Math.max(insets.bottom, 12) + 20 }]}>
        <KatchaButton label="Resume" onPress={() => { void resumeActiveHatchable(); }} />
      </View> : stepplingMissionStalled ? <View style={[styles.upgradeRecoveryCta, { bottom: Math.max(insets.bottom, 12) + 20 }]}>
        <KatchaButton label="Set the board up again" onPress={stepplingMission.reset} />
      </View> : journeyMist.stalled ? <View style={[styles.upgradeRecoveryCta, { bottom: Math.max(insets.bottom, 12) + 20 }]}>
        <KatchaButton label="Set the board up again" onPress={journeyMissionStore.reset} />
      </View> : hatchableMist.stuck || journeyMist.stuck ? <View style={[styles.upgradeRecoveryCta, { bottom: Math.max(insets.bottom, 12) + 20 }]}>
        <KatchaButton label="More pieces drift in" onPress={hatchableMist.stuck ? stepplingMission.reseed : journeyMissionStore.reseed} />
      </View> : null}
      {lockedHintFamilyId && !sharedUpgrade ? <UndiscoveredHavenPanel key={lockedHintFamilyId} art={upgradeStageArt ?? KINGDOM_DREAM_MIST_LOCKED_HEX_TILE_V1} layout={upgradeStage} bottomInset={insets.bottom}
        registerDismiss={registerUpgradeDismiss} onClose={() => setLockedHintFamilyId(null)} /> : null}
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
              Growth {selectedMemoryPlant.growthPoints} · {selectedMemoryPlant.slotId ? 'Heartwood bed' : 'Not planted'}
            </ThemedText>
            {sharedAdventureAllowed ? <KatchaButton fullWidth label="Tend Heartwood’s plants" onPress={() => {
              setSelectedMemoryPlantId(null);
              setSelectedHeartwoodBed(selectedMemoryPlant.slotId ?? undefined);
              setHeartwoodOpenToken(token => token + 1);
            }} /> : null}
          </View>
        </KatchaSheet>
      ) : null}
      {(havenOpeningActive || ftueStepId === 'egg.opening') && ftueStep && !activeInteractionResidentId && ftueStepId !== 'world.first_bloom_restore'
        && ftueStepId !== OPENING_MIST_OPEN_STEP_ID && ftueStepId !== GUARDIAN_STEP_ID && ftueStepId !== OPENING_MIST_CLEAR_STEP_ID
        && (ftueStepId !== OPENING_MIST_LIFT_STEP_ID || liftCaptionVisible)
        && (ftueStepId !== 'world.seed_planted' || firstSeedPlacementFailed) ? (
        <View
          // The bottom Mist caption must not carry its exiting title into the
          // question header when this container moves to the top of the screen.
          key={ftueStepId === 'egg.opening' ? 'egg-question-header' : 'world-discovery-caption'}
          pointerEvents="box-none"
          style={[
            styles.discoveryCalloutLayer,
            ftueStepId === OPENING_MIST_LIFT_STEP_ID || ftueStepId === 'world.egg_intro'
              ? { bottom: Math.max(insets.bottom, 12) + 22 }
              : gardenWorldBottomCtaActive
              ? {
                  bottom: Math.max(insets.bottom, 12) + 22,
                  justifyContent: 'space-between',
                  top: insets.top + 18,
                }
              : gardenWorldGuidanceActive || ftueStepId === 'egg.opening'
              ? { top: insets.top + 18 }
              : { bottom: Math.max(insets.bottom, 12) + 12 },
          ]}>
          <View collapsable={false} pointerEvents="none" ref={setHavenGuideNode} style={styles.discoveryCallout}>
            <FtueGuideCopy guide={ftueStep.guide} hero steadyHero={ftueStepId === OPENING_MIST_LIFT_STEP_ID || ftueStepId === 'world.egg_intro' || ftueStepId === 'egg.opening'} />
          </View>
          {(!['egg.opening', 'world.mist_lift', 'world.egg_intro', 'world.garden_arrival', 'world.garden_handoff', 'world.first_bloom_offer', 'world.first_bloom_restore'].includes(ftueStepId ?? '')
              || (ftueStepId === 'world.first_bloom_offer' && firstLightFailed))
            && (ftueStepId !== 'world.seed_planted' || firstSeedPlacementFailed)
            && ftueStepId !== 'world.first_seed_grew' ? <View style={styles.discoveryCalloutButton}>
            <KatchaButton
              fullWidth
              glow={ftueStepId === 'world.garden_arrival'}
              icon={ftueStep.actions[0]?.icon ?? 'sparkles'}
              label={ftueStepId === 'world.seed_planted' && firstSeedPlacementFailed
                ? 'Try again'
                : ftueStepId === 'world.first_bloom_offer'
                  ? 'Try again'
                  : ftueStep.actions[0]?.title ?? 'Continue'}
              loading={firstSeedPlacementBusy && (ftueStepId === 'world.garden_arrival' || ftueStepId === 'world.seed_planted')}
              onPress={ftueStepId === 'world.garden_arrival'
                ? beginFirstSeedPlanting
                : ftueStepId === 'world.first_bloom_offer'
                  ? repairFirstLight
                : ftueStepId === 'world.seed_planted'
                  ? acknowledgeFirstSeedPlanting
                : ftueStepId === 'world.first_seed_grew'
                  ? beginFirstSeedReturn
                  : advanceOpening}
            />
          </View> : null}
        </View>
      ) : null}
      {/* The Last Clearing (`docs/cozy-4x-ftue-the-last-clearing.md`): the cold open, then the guardian. */}
      {ftueStepId === OPENING_MIST_OPEN_STEP_ID && ftueStep && screenFocused ? <LastClearingColdOpen onDone={advanceOpening} /> : null}
      {ftueStepId === GUARDIAN_STEP_ID && ftueStep && screenFocused ? <LastClearingGuardian onContinue={advanceOpening} /> : null}
      {/* Then, after the first battle and the Mist's retreat: the Heart Tree woken, and the Sanctuary founded. */}
      {ftueStepId === HEART_TREE_STEP_ID && ftueStep && screenFocused && ftueCameraSettled && !heartTreeBusy && !upgradePresentation && !mergeWorld.heartTree
        ? <LastClearingHeartTree onRestore={() => { void restoreHeartTree(); }} /> : null}
      {ftueStepId === SANCTUARY_STEP_ID && ftueStep && screenFocused && ftueCameraSettled
        ? <LastClearingTitleCard title={SANCTUARY_TITLE} line={SANCTUARY_LINE} onContinue={foundSanctuary} /> : null}
      {ftueStepId === FRONTIER_STEP_ID && ftueStep && screenFocused && ftueCameraSettled
        ? <LastClearingTitleCard title={FRONTIER_TITLE} lines={FRONTIER_LINES} placement="top" onContinue={seeFrontier} /> : null}
      {ftueStepId === LOST_TRACKS_STEP_ID && ftueStep && screenFocused && ftueCameraSettled && !tracksLooked
        ? <LastClearingTracks onLooked={() => setTracksLooked(true)} /> : null}
      {ftueStepId === LOST_TRACKS_STEP_ID && ftueStep && screenFocused && ftueCameraSettled && tracksLooked ? <>
        <HavenFtueOverlay cue={ftueStep.cue ?? null} fingerPlacement="center" screenRef={screenRef} spotlight={ftueStep.spotlight ?? null} targetRefs={ftueTargetRefs} targetRevision={ftueTargetRevision} />
        <LostTrailTapTarget node={lostTrailNode} onPress={followTracks} />
      </> : null}
      {trailStoneIndex >= 0 && ftueStep && screenFocused && ftueCameraSettled && trailIntroSeen !== LOST_TRAIL_STONE_STEP_IDS[trailStoneIndex]
        ? <LastClearingTitleCard key={LOST_TRAIL_STONE_STEP_IDS[trailStoneIndex]} eyebrow={LOST_TRAIL_EYEBROW} title={LOST_TRAIL_STONES[trailStoneIndex]!.title}
            line={LOST_TRAIL_STONES[trailStoneIndex]!.line} placement="top" onContinue={() => setTrailIntroSeen(LOST_TRAIL_STONE_STEP_IDS[trailStoneIndex]!)} /> : null}
      {trailStoneIndex === 0 && openingBoardActive && openingDockSettled && openingBoardMetrics && battle?.store.state?.board[LOST_TRAIL_RESCUE_CELL]?.mist ? (() => {
        const origin = mergeCellOrigin(openingBoardMetrics.geometry, LOST_TRAIL_RESCUE_CELL);
        return <TrappedFriendSilhouette frame={{ x: openingBoardMetrics.x + origin.x, y: openingBoardMetrics.y + origin.y, width: openingBoardMetrics.geometry.cellSize, height: openingBoardMetrics.geometry.cellHeight ?? openingBoardMetrics.geometry.cellSize }} />;
      })() : null}
      {rescueIntroPending && screenFocused && ftueCameraSettled && !battleReward ? (
        <LastClearingTitleCard key={`rescue-intro:${activeHatchable.companion}`} eyebrow="Rescue" title={activeHatchable.mission.rescue?.intro?.title ?? activeHatchable.tile.name}
          line={activeHatchable.mission.rescue?.intro?.line} placement="top" onContinue={() => setRescueIntroSeen(activeHatchable.discoveryFlow.runId)} />
      ) : null}
      {stepplingMissionActive && hatchableRescue?.objective.kind === 'rescue' && openingDockSettled && openingBoardMetrics && stepplingMission.state?.board[hatchableRescue.objective.cell]?.mist ? (() => {
        const origin = mergeCellOrigin(openingBoardMetrics.geometry, hatchableRescue.objective.cell);
        return <TrappedFriendSilhouette companion={activeHatchable.companion} frame={{ x: openingBoardMetrics.x + origin.x, y: openingBoardMetrics.y + origin.y, width: openingBoardMetrics.geometry.cellSize, height: openingBoardMetrics.geometry.cellHeight ?? openingBoardMetrics.geometry.cellSize }} />;
      })() : null}
      {ftueStepId === STEPPLING_MEETS_STEP_ID && ftueStep && screenFocused && stepplingPhase === 'talk'
        ? <LastClearingStepplingMeets onWelcome={welcomeSteppling} /> : null}
      {ftueStepId === STEPPLING_JOINED_STEP_ID && ftueStep && screenFocused && ftueCameraSettled
        ? <LastClearingTitleCard eyebrow={STEPPLING_JOINED_EYEBROW} title={STEPPLING_JOINED_TITLE} onContinue={stepplingJoined} /> : null}
      {ftueStepId === HOME_STEP_ID && ftueStep && screenFocused && ftueCameraSettled
        ? <LastClearingTitleCard title={HOME_TITLE} lines={HOME_LINES} placement="top" onContinue={comeHome} /> : null}
      {/* After the first session: the chapter's next goal, and its reward once every goal is done. */}
      {chapterOpening?.islandId && (chapterOpeningPhase === 'flare' || chapterOpeningPhase === 'talk')
        ? <SignalFlare node={islandTileNodes[chapterOpening.islandId] ?? null} color={chapterOpening.color} /> : null}
      {chapterOpening && chapterOpeningPhase === 'talk' ? (
        <ConversationNarrativeOverlay title={chapterOpening.title} entries={chapterOpening.lines.map((line, index) => ({ id: `chapter-opening:${chapterState!.chapter.id}:${index}`, speaker: line.speaker, text: line.text }))}
          checkpoint={`chapter-opening:${chapterState!.chapter.id}`} required paced onClose={() => undefined}>
          {(perform) => <KatchaButton fullWidth glow pill label={chapterOpening.answer ?? 'Answer the signal'} onPress={() => perform(() => setChapterOpeningPhase('title'), true)} />}
        </ConversationNarrativeOverlay>
      ) : null}
      {openingTileTap && screenFocused && ftueCameraSettled ? <>
        <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onPress={() => undefined} style={[StyleSheet.absoluteFill, { zIndex: 998 }]} />
        <HavenFtueOverlay cue={{ kind: 'tap', target: { kind: 'haven_structure', structureId: openingTileTap }, offset: { y: 34 } }} fingerPlacement="center" screenRef={screenRef}
          spotlight={{ targets: [{ kind: 'haven_structure', structureId: openingTileTap }], grouping: 'bounding_rect', padding: 8, radius: 26, dimOpacity: 0.5 }} targetRefs={ftueTargetRefs} targetRevision={ftueTargetRevision} />
        <LostTrailTapTarget node={gatewayTileNode} onPress={tapOpeningTile} />
      </> : null}
      {arrivalTalk && screenFocused && !battleReward ? (
        <ConversationNarrativeOverlay title={arrivalTalk.title} entries={arrivalTalk.lines.map((line, index) => ({ id: `arrival:${arrivalTalk.companion}:${index}`, speaker: line.speaker, text: line.text }))}
          checkpoint={`arrival:${arrivalTalk.companion}`} required paced onClose={() => undefined}>
          {(perform) => <KatchaButton fullWidth glow pill label={arrivalTalk.answer} onPress={() => perform(() => setArrivalTalk(null), true)} />}
        </ConversationNarrativeOverlay>
      ) : null}
      {chapterOpening && chapterOpeningPhase === 'title' && chapterState ? (
        <LastClearingTitleCard key={`chapter-title:${chapterState.chapter.id}`} eyebrow={`Chapter ${chapterState.chapter.number}`} title={chapterState.chapter.title}
          line={chapterState.goal?.title} onContinue={finishChapterOpening} />
      ) : null}
      {chapterSurfaceFree && chapterState && !chapterState.complete && !chapterState.openingPending ? (
        <View pointerEvents="box-none" style={[styles.chapterGoal, { top: insets.top + 64 }]}>
          <View ref={goalCardRef} collapsable={false}><ChapterGoalCard state={chapterState} need={chapterGoalNeed?.text ?? null} onPress={followChapterGoal} /></View>
        </View>
      ) : null}
      {firstGoalCoach ? <CompanionFtueCoachmark targetRef={goalCardRef} targetRevision={chapterState?.done ?? 0} placement="below" showFinger
        message={[{ text: 'Your next step is always ' }, { emphasis: true, text: 'here' }, { text: '. Tap it and it takes you there.' }]} /> : null}
      {chapterSurfaceFree && chapterState?.complete ? (
        <LastClearingTitleCard key={chapterState.chapter.id} eyebrow={`Chapter ${chapterState.chapter.number} complete`} title={chapterState.chapter.title}
          lines={[chapterState.chapter.closing, `+${chapterState.chapter.reward.glow} Glow`, ...(chapterState.chapter.unlock ? [chapterState.chapter.unlock] : [])]} onContinue={claimChapter} />
      ) : null}
      {supplyRunDocked && supplyRunStore.state ? <SupplyRunDock state={supplyRunStore.state} send={cafeSend} orders={supplyRunOrders} bar={cafeBar} line={cafeLesson?.line ?? cafeAfterFirstLine}
        hiddenItemIds={supplyHiddenItemIds} servingOrderId={supplyServeFlight ? supplyServingRef.current?.order.id ?? null : null} onRailTargetRef={setCafeRailTarget}
        width={window.width} bottomInset={insets.bottom} onServe={serveSupplyOrder} onBoardMetrics={setOpeningBoardMetrics} onEntranceSettled={markOpeningDockSettled}
        title={kitchen ? 'Feastle\u2019s Kitchen' : undefined} /> : null}
      {cafeLesson && openingDockSettled && !supplyServeFlight && !battleReward ? <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: FTUE_SCENE_LAYERS.spotlight }]}>
        <MergeFtueOverlay blockedPulseNonce={0} boardMetrics={openingBoardMetrics} cue={cafeLesson.cue} guide={null}
          layoutNonce={cafeRailRevision} railTargetRefs={cafeRailRefs} screenRef={screenRef} spotlight={cafeLesson.spotlight}
          state={supplyRunStore.state!} targetRevision={(supplyRunStore.state?.revision ?? 0) * 100 + cafeRailRevision} />
      </View> : null}
      {sanctuarySurfaceFree ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Heroes" accessibilityHint="Your friends, their levels and their buildings" onPress={() => setHeroRosterOpen(true)}
          style={({ pressed }) => [styles.supplyRunButton, { bottom: Math.max(insets.bottom, 12) + (supplyRunAvailable ? 64 : 14) }, pressed ? { opacity: 0.85 } : null]}>
          <Text style={styles.heroesStar}>★</Text>
          <Text style={styles.supplyRunLabel}>Heroes</Text>
        </Pressable>
      ) : null}
      {sanctuarySurfaceFree && mergeWorld.heartTree ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Heart Tree, level ${heartTreeLevel(mergeWorld)}`} accessibilityHint="Grow the heart of the Sanctuary" onPress={() => setHeartTreePanelOpen(true)}
          style={({ pressed }) => [styles.supplyRunButton, { bottom: Math.max(insets.bottom, 12) + (supplyRunAvailable ? 114 : 64) }, pressed ? { opacity: 0.85 } : null]}>
          <Text style={styles.heroesStar}>♣</Text>
          <Text style={styles.supplyRunLabel}>{`Heart Tree · ${heartTreeLevel(mergeWorld)}`}</Text>
        </Pressable>
      ) : null}
      {supplyRunAvailable && sanctuarySurfaceFree ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Café" accessibilityHint="Serve friends' orders for Meals, Timber and Glow" onPress={() => setSupplyRunOpen(true)}
          style={({ pressed }) => [styles.supplyRunButton, { bottom: Math.max(insets.bottom, 12) + 14 }, pressed ? { opacity: 0.85 } : null]}>
          <Image source={GAME_CURRENCY_ART.meals} style={styles.supplyRunIcon} contentFit="contain" transition={0} />
          <Text style={styles.supplyRunLabel}>Café</Text>
        </Pressable>
      ) : null}
      {supplyServeFlight ? <MergeServeRewardOverlay flight={supplyServeFlight} onItemsArrive={supplyItemsArrived} onCoinArrive={supplyCoinArrived} onEnergyArrive={() => undefined} onFinish={finishSupplyServe} /> : null}
      {battleReward ? <BattleRewardCard key={`battle-reward:${battleReward.key}`} reward={battleReward} onContinue={continueBattleReward} /> : null}
      {/* A docked mini board dims the Kingdom behind it, easing in and out. */}
      <BoardSessionDim active={Boolean(openingBoardActive || supplyRunDocked || (stepplingMissionActive && stepplingMission.state) || (journeyMissionActive && journeyMissionStore.state) || (activeRush && screenFocused) || (islandEncounterActive && islandMist.store.state) || (restorationBoardVisible && !chapterRush))} />
      {openingBoardActive && battle?.mission && battle.store.state ? <HatchableMissionDock key={`battle-dock:${battleEncounter?.id ?? 'none'}`} mission={battle.mission}
        state={battle.store.state} send={battle.store.send} merges={battle.store.merges} mechanicState={battle.store.mechanicState} encounter={battle.encounter} width={window.width} bottomInset={insets.bottom}
        landings={openingGlow.store} onStrike={battle.onStrike} onFinale={battle.onFinale} onReveal={battle.bumpReveal} onBoardMetrics={setOpeningBoardMetrics} onBlockedInteraction={bumpOpeningBlocked}
        onEntranceSettled={markOpeningDockSettled} /> : null}
      {openingGuidanceVisible && ftueCameraSettled && openingDockSettled ? <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: FTUE_SCENE_LAYERS.spotlight }]}>
        <MergeFtueOverlay blockedPulseNonce={openingBlockedNonce} boardMetrics={openingBoardMetrics} cue={openingBoardStep?.cue ?? null} guide={openingBoardStep?.guide?.title ? openingBoardStep.guide : null}
          layoutNonce={openingBoardRevision} railTargetRefs={openingRailRefs} screenRef={screenRef} spotlight={openingBoardStep?.spotlight ?? null} state={battle?.store.state ?? mergeWorld} targetRevision={openingBoardRevision} />
      </View> : null}
      {stepplingMissionActive && stepplingMission.state ? <HatchableMissionDock mission={hatchableMist.mission ?? activeHatchable.mission}
        state={stepplingMission.state} send={stepplingMission.send} merges={stepplingMission.merges} mechanicState={stepplingMission.mechanicState} encounter={hatchableMist.encounter} width={window.width} bottomInset={insets.bottom}
        landings={openingGlow.store} onStrike={hatchableMist.onStrike} onFinale={hatchableMist.onFinale} onReveal={hatchableMist.bumpReveal} onBoardMetrics={setOpeningBoardMetrics} onBlockedInteraction={bumpOpeningBlocked}
        onEntranceSettled={markOpeningDockSettled} /> : null}
      {stepplingMissionActive && stepplingMission.state && stepplingMissionGuidanceVisible && openingDockSettled ? <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: FTUE_SCENE_LAYERS.spotlight }]}>
        <MergeFtueOverlay blockedPulseNonce={openingBlockedNonce} boardMetrics={openingBoardMetrics} cue={stepplingMissionStep?.cue ?? null} guide={stepplingMissionStep?.guide ?? null}
          layoutNonce={stepplingMission.state.revision} railTargetRefs={openingRailRefs} screenRef={screenRef} spotlight={stepplingMissionStep?.spotlight ?? null} state={stepplingMission.state} targetRevision={stepplingMission.state.revision}
          visualTheme={stepplingMissionStep?.spotlight ? undefined : STEPPLING_MISSION_HINT_THEME} />
      </View> : null}
      {journeyMissionActive && journeyMissionDefinition && journeyMissionStore.state ? <HatchableMissionDock mission={journeyMist.mission ?? journeyMissionDefinition}
        state={journeyMissionStore.state} send={journeyMissionStore.send} merges={journeyMissionStore.merges} mechanicState={journeyMissionStore.mechanicState} encounter={journeyMist.encounter} width={window.width} bottomInset={insets.bottom}
        landings={openingGlow.store} onStrike={journeyMist.onStrike} onFinale={journeyMist.onFinale} onReveal={journeyMist.bumpReveal} onBoardMetrics={setOpeningBoardMetrics} onBlockedInteraction={bumpOpeningBlocked}
        onEntranceSettled={markOpeningDockSettled} /> : null}
      {journeyMissionActive && journeyMissionDefinition && journeyMissionStore.state && journeyMissionGuidanceVisible && openingDockSettled ? <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: FTUE_SCENE_LAYERS.spotlight }]}>
        <MergeFtueOverlay blockedPulseNonce={openingBlockedNonce} boardMetrics={openingBoardMetrics} cue={journeyMissionStep?.cue ?? null} guide={journeyMissionStep?.guide ?? null}
          layoutNonce={journeyMissionStore.state.revision} railTargetRefs={openingRailRefs} screenRef={screenRef} spotlight={journeyMissionStep?.spotlight ?? null} state={journeyMissionStore.state} targetRevision={journeyMissionStore.state.revision}
          visualTheme={journeyMissionStep?.spotlight ? undefined : STEPPLING_MISSION_HINT_THEME} />
      </View> : null}
      {activeRush && screenFocused ? <WispRushDock key={activeRush.runKey} spec={activeRush.spec} goal={activeRush.goal} live={rushLive}
        title={activeRush.kind === 'chapter' && chapterRushNote ? chapterRushNote : `${activeRush.title} · ${activeRush.goal} wisps`} width={window.width} bottomInset={insets.bottom}
        landings={openingGlow.store} onStrike={launchRushStrike} onBoardMetrics={setOpeningBoardMetrics} onBlockedInteraction={bumpOpeningBlocked}
        onEntranceSettled={markOpeningDockSettled} onFinished={finishRushHeat} onVoided={voidRushHeat} onClose={leaveRushHeat} /> : null}
      {islandEncounterActive && islandMist.mission && islandMist.store.state ? <HatchableMissionDock mission={islandMist.mission}
        state={islandMist.store.state} send={islandMist.store.send} merges={islandMist.store.merges} mechanicState={islandMist.store.mechanicState} encounter={islandMist.encounter} width={window.width} bottomInset={insets.bottom}
        landings={openingGlow.store} onStrike={islandMist.onStrike} onFinale={islandMist.onFinale} onReveal={islandMist.bumpReveal} onBoardMetrics={setOpeningBoardMetrics} onBlockedInteraction={bumpOpeningBlocked}
        onEntranceSettled={markOpeningDockSettled} /> : null}
      {restorationBoardVisible && islandRestoration && restorationStore.state && !chapterRush ? <IslandRestorationDock
        campaign={islandRestoration.campaign} level={islandRestoration.level} state={restorationStore.state} send={restorationStore.send} boardStep={restorationStep}
        progress={restorationSummary ?? { current: 0, total: 1 }} width={window.width} bottomInset={insets.bottom}
        order={restorationOrder} orderServed={restorationOrderServed} pendingDeliveries={restorationPendingDeliveries} speech={restorationSpeech} onOpenOrder={openRestorationOrder} onPlaceDelivery={placeRestorationDelivery}
        railTargetRefs={openingRailRefs}
        landings={openingGlow.store} onStrike={launchRestorationStrike} onFinale={launchRestorationFinale} onBoardMetrics={setOpeningBoardMetrics} onBlockedInteraction={bumpOpeningBlocked}
        onEntranceSettled={markOpeningDockSettled} /> : null}
      {restorationCheckpointHint && restorationHintCue && restorationStore.state && restorationHintReady ? <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: FTUE_SCENE_LAYERS.spotlight }]}>
        <MergeFtueOverlay blockedPulseNonce={0} boardMetrics={openingBoardMetrics}
          cue={restorationHintCue}
          guide={null}
          layoutNonce={0} railTargetRefs={openingRailRefs} screenRef={screenRef}
          spotlight={null}
          state={restorationStore.state} targetRevision={0} />
      </View> : null}
      {/* The wisps under the Glow flights. Both own their state: a landing or a strike re-renders them, never this screen. */}
      <MissionWisps target={wispTarget} glow={openingGlow.store} screenRef={screenRef} />
      <MissionGlowLayer store={openingGlow.store} screenRef={screenRef} />
      {detailCreatureId ? (() => {
        const slot = visibleCompanionSlots.find((candidate) => candidate.kind === 'owned' && candidate.creature.creatureId === detailCreatureId);
        if (!slot || slot.kind !== 'owned') return null;
        const characterId = slot.familyId as MergeCharacterId;
        const environment = HAVEN_ENVIRONMENTS[characterId];
        const currentStage = mergeWorld.haven.tileStages[characterId] ?? 0;
        const next = characterId === 'mossprout' && currentStage >= 1
          ? undefined
          : environment?.stages[currentStage + 1];
        const guided = ftueStepId === 'haven.mossprout.restore';
        const hatchable = hatchableByCompanion(characterId);
        const links = ftueStepId ? [] : [
          ...(PLAYABLE_KATCHIMERAS.includes(characterId) && (characterId === 'mossprout' || mergeWorld.unlockedCharacters.includes(characterId)) ? [{ label: `Train ${slot.creature.name}`, onPress: () => {
            setDetailCreatureId(null);
            setKatchimeraPanelId(characterId);
          } }] : []),
          ...(characterId === 'mossprout' && currentStage >= 1 ? [{ label: 'Garden story & history', onPress: () => {
            const archive = worldUpgradeArchiveOffer(mergeWorld, 'haven:mossprout');
            setDetailCreatureId(null);
            if (archive) setSelectedUpgrade({ ...archive, currentLevel: currentStage });
          } }] : []),
          ...(hatchable && mergeWorld.worldUnlocks?.[hatchable.tile.unlockId] ? [{ label: 'Clearing story & history', onPress: () => {
            const archive = worldUpgradeArchiveOffer(mergeWorld, `mist:${hatchable.tile.id}`);
            setDetailCreatureId(null);
            if (archive) setSelectedUpgrade(archive);
          } }] : []),
        ];
        const havenLevels = (environment?.stages ?? []).map((stage) => ({
          level: stage.stage as number, name: stage.name, description: stage.narrative,
          state: stage.stage <= currentStage ? 'done' as const : stage.stage === next?.stage ? 'next' as const : 'ahead' as const,
        }));
        return <HavenDetailPanel key={detailCreatureId}
          residentName={slot.creature.name} level={currentStage} maxLevel={Math.max(currentStage, (environment?.stages.length ?? 1) - 1)}
          levels={havenLevels} nextCost={next?.coinCost}
          artFor={(level) => tileLevelArt(`haven:${characterId}`, level)} currentArt={upgradeStageArt}
          glow={mergeWorld.coins} upgrading={upgrading} error={upgradeError} guided={guided}
          restoreRef={characterId === 'mossprout' ? setRestoreButtonNode : undefined} links={links}
          layout={upgradeStage} bottomInset={insets.bottom} registerDismiss={registerUpgradeDismiss}
          onClose={() => setDetailCreatureId(null)}
          onRestore={() => { const offer = upgradeOffers.find((candidate) => candidate.id === `haven:${characterId}`); setDetailCreatureId(null); if (offer) void openUpgradeOffer(offer); }}
          onVisit={companionHasPage(characterId) ? () => selectResident(slot.creature.creatureId) : undefined}
          onGarden={() => { setDetailCreatureId(null); openGarden(); }} />;
      })() : null}
      {ftueCameraSettled && !sharedUpgrade && !upgradePresentation && !interactionCreatureId && (ftueStepId === 'haven.mossprout.focus' || ftueStepId === 'haven.mossprout.restore' || ftueStepId === 'world.garden_arrival' || (ftueStepId === 'world.seed_planted' && firstSeedPlacementFailed && !firstSeedPlacementBusy) || ftueStepId === 'world.garden_handoff' || ftueStepId === 'world.first_bloom_offer' || ftueStepId === 'world.first_bloom_restore') ? (
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
});

/** The longest the friend's reveal waits for an island lift that never shows its sequence. */
const ISLAND_LIFT_HOLD_MAX_MS = 12_000;

const styles = StyleSheet.create({
  supplyRunButton: { position: 'absolute', right: 12, zIndex: 26, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: 'rgba(22,20,40,0.78)', borderWidth: 1, borderColor: 'rgba(255,231,168,0.35)' },
  supplyRunIcon: { width: 24, height: 24 },
  heroesStar: { fontSize: 18, lineHeight: 22, color: '#FFD36B' },
  supplyRunLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 13, fontWeight: '800', color: '#FFF8E6' },
  chapterGoal: { position: 'absolute', left: 12, right: 12, zIndex: 26 },
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
  currencyHud: { flex: 0, flexShrink: 0, paddingLeft: 18 },
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
  memoryPlantDetail: { alignItems: 'center', gap: 12, paddingBottom: 8 },
  memoryPlantArt: { height: 210, width: 210 },
  memoryPlantReflection: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 21, lineHeight: 27, maxWidth: 330, textAlign: 'center' },
  memoryPlantProgress: { fontFamily: AppFontFamilies.manrope, fontSize: 12, fontWeight: '800', opacity: 0.68, textTransform: 'capitalize' },
});

/** Where the camera frames a friend's building: their structure tile, or their island. */
function heroBuildingTarget(id: HeroBuildingId): Extract<StoryTarget, { kind: 'haven_structure' | 'haven_nature_island' }> {
  const building = heroBuildingById.get(id)!;
  return building.place === 'island' ? { kind: 'haven_nature_island', islandId: building.tileId } : { kind: 'haven_structure', structureId: building.tileId };
}

/** The heroes who can come into a battle: Mossprout, and every playable friend who is home. */
function playableHeroes(world: MergeWorldState): MergeCharacterId[] {
  return PLAYABLE_KATCHIMERAS.filter((id) => id === 'mossprout' || world.unlockedCharacters.includes(id) || world.companionDiscovery.records.some((record) => record.characterId === id));
}

const NO_RESIDENT_WISPS = {} as const;

/**
 * The world's markers once the Sanctuary is founded: the current chapter's island (once its opening has played), any
 * island already revealed, a friend's tile the chapter's goal asks for (or one already under way), and everything that
 * is not a tile offer (the Grove). The old garden restore goes: the chapters build the Sanctuary now.
 */
function chapterOffers(world: MergeWorldState, offers: readonly WorldUpgradeOffer[], chapter: SanctuaryChapterState | null): WorldUpgradeOffer[] {
  const chapterIsland = chapter && !chapter.openingPending ? chapter.chapter.opening?.islandId ?? null : null;
  const goalOffer = chapter?.goal?.action.kind === 'world_offer' ? chapter.goal.action.offerId : null;
  return offers.filter((offer) => {
    if (offer.id === 'haven:mossprout') return false;
    if (offer.id === goalOffer) return true;
    if (offer.target.kind === 'haven_nature_island') {
      const islandId = offer.target.islandId;
      const revealed = Boolean(world.haven.mossproutNatureIslandReveals[islandId] || (world.haven.mossproutNatureIslands[islandId] ?? 0) > 0);
      return revealed || islandId === chapterIsland || goalOffer === `nature:${islandId}`;
    }
    if (offer.id.startsWith('mist:')) return offer.hatchable?.state === 'board' || offer.hatchable?.state === 'egg' || offer.hatchable?.state === 'open';
    return true;
  });
}
