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
} from '@/components/katchadeck/world/kingdom-hex-canvas';
import { KatchimeraCompanionRouteScreen } from '@/components/katchadeck/world/katchimera-companion-route-screen';
import { HavenTileHudLayer } from '@/components/katchadeck/world/haven-tile-hud-layer';
import { MossproutNatureIslandSheet } from '@/components/katchadeck/world/mossprout-nature-island-sheet';
import { HavenFtueOverlay } from '@/components/katchadeck/onboarding/haven-ftue-overlay';
import { FtueGuideCopy } from '@/components/katchadeck/onboarding/ftue-guide-copy';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { GameCurrencyHud } from '@/components/katchadeck/ui/game-currency-hud';
import { GameHudBar } from '@/components/katchadeck/ui/game-primitives';
import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
import { ThemedText } from '@/components/themed-text';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { AppFontFamilies } from '@/constants/theme';
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import { loadWorldIdentity, localDayId } from '@/utils/world-identity';
import type { KingdomHexCompanionSlot } from '@/utils/katchimera-kingdom-slots';
import type { MergeCharacterId, MergeWorldState, MossproutNatureIslandId, MossproutNatureIslandLevel } from '@/types/merge-world';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import { HAVEN_ENVIRONMENTS, havenStoryGateSatisfied, type HavenEnvironmentStage, type HavenStage } from '@/constants/haven-catalog';
import { completeMossproutHavenUpgrade } from '@/utils/companion-story-storage';
import { reconcileStoredHavenStory, upgradeStoredHavenTile, upgradeStoredMossproutNatureIsland } from '@/utils/merge-world/repository';
import { mossproutNatureIslandById, mossproutNatureIslandLevelDefinition } from '@/constants/mossprout-nature-islands';
import { havenHexTileSpec, kingdomHexTileSourceForLod } from '@/utils/world-visuals';
import type { HavenTileUpgradePresentation } from '@/utils/haven-upgrade-presentation';
import { deriveHavenTilePresentation } from '@/utils/haven-tile-presentation';
import { commitFtueAction } from '@/features/onboarding/ftue-runtime';
import {
  MOSSPROUT_WORLD_EGG_CLOSE_ZOOM,
  MOSSPROUT_WORLD_EGG_ENTRY_ZOOM,
  MOSSPROUT_WORLD_EGG_REST_ZOOM,
  mossproutFtueStep,
} from '@/features/onboarding/mossprout-ftue-script';
import { mossproutJourneyForDay, mossproutJourneyRuntimeDayId } from '@/game/katchimeras/relationship-progression';
import { isJourneyQuickModeEnabled } from '@/utils/dev-settings';
import { mergeOrderItemReadiness, readyMergeOrderIds } from '@/utils/merge-world/engine';
import { prioritizedVisibleMergeOrders } from '@/utils/merge-world/order-presentation';
import type { MergeOrderTrayEntry } from '@/components/katchadeck/games/merge-order-rail';
import type { KingdomCameraSnapshot } from '@/utils/kingdom-rendering';
import { useGameScreenTransition } from '@/features/navigation/game-screen-transition';
import type { WorldFtueSubjectPresentation } from '@/components/katchadeck/world/world-ftue-subject-presentation';
import type { MossproutWorldInteractionRequest } from '@/components/katchadeck/world/mossprout-world-interaction';

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
  const [natureUpgradeError, setNatureUpgradeError] = useState<string | null>(null);
  const restoreButtonRef = useRef<View>(null);
  const screenRef = useRef<View>(null);
  const ftueTargetRefs = useRef(new Map<string, View>());
  const upgradeNonceRef = useRef(0);
  const interactionCreatureIdRef = useRef<string | null>(null);
  const handledInteractionRequestRef = useRef<string | null>(null);
  const ftueRestoreStartedRef = useRef(false);
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
  const interactionSlot = useMemo(() => visibleCompanionSlots.find((slot) => (
    slot.kind === 'owned' && slot.creature.creatureId === interactionCreatureId
  )), [interactionCreatureId, visibleCompanionSlots]);
  const interactionHasGarden = interactionSlot?.familyId === 'mossprout';
  const tutorialCamera = ftueStep?.camera ?? null;
  const initialFtueCameraScale = ftueStepId === 'world.egg_intro'
    ? MOSSPROUT_WORLD_EGG_ENTRY_ZOOM
    : tutorialCamera?.kind === 'focus_target' && tutorialCamera.target.kind === 'haven_resident'
      ? tutorialCamera.zoom ?? MOSSPROUT_WORLD_EGG_REST_ZOOM
      : undefined;
  useEffect(() => {
    const delays: Partial<Record<string, number>> = {
      'world.egg_intro': 4_100,
      'grove.egg_inspect': 1_650,
      'world.garden_arrival': 2_150,
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
    const cameraFallbackTimer = ftueStepId ? null : setTimeout(() => {
      if (interactionCreatureIdRef.current === interactionCreatureId) setInteractionCameraReady(true);
    }, 900);
    return () => {
      clearTimeout(loadingTimer);
      if (cameraFallbackTimer) clearTimeout(cameraFallbackTimer);
    };
  }, [ftueStepId, interactionCameraReady, interactionCreatureId]);
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
    || ftueStepId === 'grove.egg_inspect'
    || ftueStepId === 'world.garden_arrival'
    || ftueStepId === 'world.garden_handoff'
    || ftueStepId === 'haven.first_bloom'
    || ftueStepId === 'world.complete';
  const ftueWorldCloseupActive = Boolean(ftueStepId && (
    ftueStepId === 'world.egg_intro'
    || ftueStepId === 'grove.egg_inspect'
    || ftueStepId.startsWith('egg.')
    || ftueStepId.startsWith('companion.')
  ));
  const ftueEggFeedingCloseupActive = ftueStepId === 'grove.egg_inspect'
    || ftueStepId === 'world.egg_intro'
    || Boolean(ftueStepId?.startsWith('egg.'));
  const gardenWorldGuidanceActive = ftueStepId === 'world.garden_arrival'
    || ftueStepId === 'world.garden_handoff';
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

  const completeUpgradePresentation = useCallback((presentation: HavenTileUpgradePresentation) => {
    setUpgradePresentation((current) => current?.nonce === presentation.nonce ? null : current);
    setUpgrading(false);
    if (
      ftueStepId === 'haven.mossprout.restore'
      && presentation.characterId === 'mossprout'
      && presentation.toStage === 1
    ) {
      ftueRecoveryRef.current = ftueStepId;
      onFtueRestore?.();
    }
  }, [ftueStepId, onFtueRestore]);

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
    if (ftueStepId === 'companion.first_meeting') {
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
    setInteractionCameraReady(false);
    setInteractionExiting(false);
    setInteractionCreatureId(interactionRequest.creatureId);
    onInteractionRequestConsumed?.();
  }, [ftueStepId, interactionRequest, onInteractionRequestConsumed, visibleCompanionSlots]);

  const completeResidentFocus = useCallback((creatureId: string) => {
    if (interactionCreatureIdRef.current === creatureId) setInteractionCameraReady(true);
  }, []);

  const closeResidentInteraction = useCallback(() => {
    setInteractionCameraReady(false);
    setInteractionExiting(false);
    setInteractionLoadingVisible(false);
    setHostedInteractionRequest(null);
    setInteractionCreatureId(null);
  }, []);
  const requestResidentInteractionExit = useCallback(() => {
    if (!interactionCreatureIdRef.current || ftueStepId) return;
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
          : ftueWorldCloseupActive || Boolean(interactionCreatureId)
            ? MOSSPROUT_WORLD_EGG_REST_ZOOM
            : undefined}
        companionSlots={visibleCompanionSlots}
        identity={identity}
        discoveryRevealFamilyId={null}
        highlightedLockedFamilyId={null}
        interactionEnabled={!interactionCreatureId && (havenOpeningActive || !ftueStep || ftueStep.surface !== 'haven')}
        interactionExitNonce={interactionExitNonce}
        interactionResidentId={interactionCreatureId}
        interactionRewardPulseKey={interactionRewardPulseKey}
        gardenOrders={gardenOrderEntries}
        gardenOrdersInteractive={ftueStepId !== 'world.garden_handoff'}
        initialTutorialCameraScale={initialFtueCameraScale}
        initialCameraSnapshot={initialCameraSnapshot}
        mossproutNatureIslandLevels={mergeWorld.haven.mossproutNatureIslands}
        onCameraSnapshotChange={onCameraSnapshotChange}
        onInteractionExitFocusComplete={closeResidentInteraction}
        onOpenGarden={openGarden}
        onSelectHome={() => {}}
        onSelectLocked={(familyId) => {
          if (ftueStepId === 'world.egg_intro') {
            return;
          }
          if (!ftueStep || ftueStep.surface !== 'haven') setLockedHintVisible(true);
        }}
        onSelectNatureIsland={(islandId) => {
          if (ftueStep?.surface === 'haven') return;
          if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setNatureUpgradeError(null);
          setSelectedNatureIslandId(islandId);
        }}
        onSelectResident={selectResident}
        onResidentFocusComplete={completeResidentFocus}
        onResidentAnchorsChange={setResidentAnchors}
        onUpgradePresentationComplete={completeUpgradePresentation}
        recenterBottom={Math.max(insets.bottom, 12) + 150}
        residentStatusGlyphs={residentStatusGlyphs}
        tutorialCamera={tutorialCamera}
        upgradePresentation={upgradePresentation}
        focusedMossproutWorld
        worldEggTargetRef={worldEggTargetRef}
        worldSubjectPresentation={worldSubjectPresentation}
      />
      {!upgradePresentation && !interactionCreatureId ? (
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
      {!upgradePresentation && !interactionCreatureId && havenMergeBoardActive && (!havenOpeningActive || ftueStepId === 'world.garden_handoff') ? (
        <Pressable
          accessibilityHint="Opens the dedicated Merge Garden"
          accessibilityLabel="Open Garden"
          accessibilityRole="button"
          disabled={navigationLocked && ftueStepId !== 'world.garden_handoff'}
          onPress={ftueStepId === 'world.garden_handoff' ? onFtueOpenGarden : () => openGarden()}
          ref={setGardenButtonNode}
          style={({ pressed }) => [
            styles.gardenButton,
            { bottom: Math.max(insets.bottom, 12) + 10 },
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
      {havenOpeningActive && ftueStep ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.discoveryCalloutLayer,
            gardenWorldGuidanceActive
              ? { top: insets.top + 18 }
              : { bottom: Math.max(insets.bottom, 12) + 12 },
          ]}>
          <View pointerEvents="none" style={styles.discoveryCallout}>
            <FtueGuideCopy guide={ftueStep.guide} hero />
          </View>
          {!['world.egg_intro', 'grove.egg_inspect', 'world.garden_arrival', 'world.garden_handoff'].includes(ftueStepId ?? '') ? <View style={styles.discoveryCalloutButton}>
            <KatchaButton fullWidth icon="sparkles" label={ftueStep.actions[0]?.title ?? 'Continue'} onPress={advanceOpening} />
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
      {!upgradePresentation && (ftueStepId === 'haven.mossprout.focus' || ftueStepId === 'haven.mossprout.restore' || ftueStepId === 'world.garden_handoff') ? (
        <HavenFtueOverlay
          cue={ftueStep?.cue ?? null}
          screenRef={screenRef}
          spotlight={ftueStep?.spotlight ?? null}
          targetRefs={ftueTargetRefs}
          targetRevision={ftueTargetRevision}
        />
      ) : null}
      {ftueStepId === 'world.egg_intro' ? (
        <FtueOpeningFade />
      ) : null}
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
    alignItems: 'center',
    height: 132,
    justifyContent: 'flex-start',
    position: 'absolute',
    right: 8,
    width: 132,
    zIndex: 32,
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
    zIndex: 40,
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
  previewLocked: { opacity: 0.58 },
  previewLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
});
