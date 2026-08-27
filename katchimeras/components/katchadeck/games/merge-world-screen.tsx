import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, ZoomIn, useReducedMotion } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { KatchimeraCardRevealModal } from '@/components/katchadeck/collection/katchimera-card-deck-carousel';
import { RewardSplash, type RewardSplashItem } from '@/components/katchadeck/ui/reward-splash';
import { GameCurrencyHud } from '@/components/katchadeck/ui/game-currency-hud';
import { GameHudBar } from '@/components/katchadeck/ui/game-primitives';
import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
import { KatchaInlineNotice } from '@/components/katchadeck/ui/katcha-inline-notice';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSurfaceProvider } from '@/components/katchadeck/ui/katcha-surface';
import { RotatingRadialSunburst } from '@/components/katchadeck/ui/radial-sunburst';
import { CelebrationParticles } from '@/components/katchadeck/world/companion-achievement-celebration';
import {
  MERGE_GENERATORS_BY_ID,
  MERGE_ITEMS_BY_ID,
  MERGE_CHARACTER_NAMES,
} from '@/constants/merge-world-catalog';
import { mergeWorldGeneratorArt } from '@/constants/merge-world-art';
import { MEMORY_CARDS_BY_ID } from '@/constants/memory-card-catalog';
import { RARE_MEMORY_CARD_REVEAL_ART, VEILED_MEMORY_CARD_ART, memoryCardArt } from '@/constants/memory-card-art';
import { COMPANION_DISCOVERY_CATALOG } from '@/constants/companion-discovery-catalog';
import { Lantern } from '@/constants/theme';
import { useMergeWorldActions, useMergeWorldLastResult, useMergeWorldState } from '@/features/merge-world/merge-world-provider';
import { advanceFtueActionDurably, commitFtueAction, dispatchFtueEvent, flushFtuePersistence, registerFtueObjectiveBaseline, repairFtueStep, useFtueRun } from '@/features/onboarding/ftue-runtime';
import { MOSSPROUT_FTUE_RETURN_NOTE_ID, mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import { mergeFtueAllowsChatNote, mergeFtueAllowsCommand, mergeFtueBoardGate, mergeFtueEventForCommand, mergeFtueRailGate, mergeFtueRepairTarget, mergeFtueStepEntryBaseline, mergeFtueStepForBoard, recoverMergeFtueEvent } from '@/features/onboarding/merge-ftue';
import type { FtueCueDefinition, FtueSpotlightDefinition } from '@/features/onboarding/ftue-types';
import { useFtueNavigationLock } from '@/features/onboarding/use-ftue-navigation-lock';
import {
  finishResidentMergeSession,
  markResidentMergePresented,
  pauseResidentMerge,
} from '@/features/onboarding/resident-ftue-navigation-session';
import { useGameFeedback } from '@/features/ui/game-feedback-provider';
import { GameUI } from '@/constants/game-ui';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import {
  createMergeBoardSession,
  mergeFtueInteractionKey,
  MergeFtueInteractionCoordinator,
} from '@/features/onboarding/merge-ftue-interaction-coordinator';
import type { KatchimeraSkinId } from '@/types/katchimera';
import type { MergeCharacterId, MergeOrder, MergeWorldCommand } from '@/types/merge-world';
import { mergeCellCenter } from '@/utils/merge-world/board-geometry';
import { mergeOrderItemReadiness, mergeOrderServingCells, readyMergeOrderIds } from '@/utils/merge-world/engine';
import { isMossproutChapterZeroActive } from '@/utils/merge-world/chapter-zero-policy';
import { beginAuthoredCohortReturn, beginFeastleReturn, isAuthoredCohortFamily, loadAuthoredCohortStory, loadFeastleStory, subscribeCompanionStories } from '@/utils/companion-story-storage';
import { useGameScreenTransition, useGameSurfaceReadiness } from '@/features/navigation/game-screen-transition';
import { beginCriticalInteractionWork } from '@/utils/critical-interaction';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import { beginMossproutJourneyReturn, mossproutJourneyForDay, mossproutJourneyRuntimeDayId, recordMossproutFirstGardenRestored, startMossproutJourneyDay } from '@/game/katchimeras/relationship-progression';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';
import { useKatchimeraCards } from '@/hooks/use-katchimera-cards';
import { familyIdFromCompanionId, katchimeraSkinById } from '@/constants/katchimera-skins';
import { mossproutResidentById } from '@/constants/mossprout-residents';
import { localDayId } from '@/utils/world-identity';
import { isJourneyQuickModeEnabled } from '@/utils/dev-settings';

import { FeastlePersistentMergeBoard, type MergeBoardScreenMetrics } from './feastle-persistent-merge-board';
import { MergeCellInspector } from './merge-cell-inspector';
import { MergeParcelFlightOverlay, type MergeParcelFlight } from './merge-parcel-overlay';
import { MergeOrderRail, type MergeTrayEntry } from './merge-order-rail';
import { MergeServeRewardOverlay, type MergeScreenPoint, type MergeServeRewardFlight } from './merge-serve-reward-overlay';
import { MergeFtueOverlay } from './merge-ftue-overlay';

const EARLY_DISCOVERY_REVEAL_COPY: Partial<Record<MergeCharacterId, { description: string; rewardBody: string }>> = {
  steppling: { description: 'Every path starts somewhere.', rewardBody: 'The final trail marker became a Journey Locker.' },
  feastle: { description: 'A warm table was waiting beneath the Mist.', rewardBody: 'The Dreambound Dish became a Hearth Pantry.' },
  baristabbit: { description: 'A familiar warmth followed the light home.', rewardBody: 'The Dreambound Teapot became a Ritual Bar.' },
  bedrotte: { description: 'The quiet hollow finally felt safe enough to open.', rewardBody: 'The Dreambound Pillow became a Comfort Chest.' },
};

export function MergeWorldScreen({ active = true, backgroundReady = true, playBoardEntrance = true }: { active?: boolean; backgroundReady?: boolean; playBoardEntrance?: boolean } = {}) {
  const router = useRouter();
  const { transitionTo } = useGameScreenTransition();
  const { creatureId, focusOrderId } = useLocalSearchParams<{
    creatureId?: string;
    focusOrderId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { state, loading, error } = useMergeWorldState();
  const { dispatch: send, flush: flushMergeWorld } = useMergeWorldActions();
  const ftueRun = useFtueRun();
  const ftueNavigationLocked = useFtueNavigationLock(ftueRun, 'merge', active);
  const scriptedFtueStep = ftueRun?.status === 'active' ? mossproutFtueStep(ftueRun.stepId) : null;
  const ftueStep = useMemo(() => mergeFtueStepForBoard(state, scriptedFtueStep), [scriptedFtueStep, state]);
  const residentFtueActive = Boolean(ftueStep?.id.startsWith('merge.resident_'));
  const returnToResidentStory = useCallback(() => {
    if (!creatureId) return;
    transitionTo({
      announcement: 'Returning to Mossprout',
      target: 'companion',
      navigate: () => {
        pauseResidentMerge();
        // `navigate` reuses the companion route already beneath Merge,
        // avoiding a duplicate companion/board pair on every pause.
        router.navigate({ pathname: '/katchimera/[creatureId]', params: { creatureId, residentResume: '1' } });
      },
    });
  }, [creatureId, router, transitionTo]);
  useEffect(() => {
    if (!active || !residentFtueActive) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      returnToResidentStory();
      return true;
    });
    return () => subscription.remove();
  }, [active, residentFtueActive, returnToResidentStory]);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [inspectedCell, setInspectedCell] = useState<number | null>(null);
  const [revealedMemoryCardId, setRevealedMemoryCardId] = useState<string | null>(null);
  const [revealedKatchimeraCardId, setRevealedKatchimeraCardId] = useState<KatchimeraSkinId | null>(null);
  const { cards: mossproutCards } = useKatchimeraCards('mossprout');
  const [boardAreaHeight, setBoardAreaHeight] = useState(0);
  const [story, setStory] = useState(loadFeastleStory);
  const relationships = useRelationshipProgression();
  const mossproutJourneyDayId = mossproutJourneyRuntimeDayId(relationships, localDayId(), isJourneyQuickModeEnabled());
  const mossproutJourney = mossproutJourneyForDay(relationships, mossproutJourneyDayId);
  const mossproutJourneyExclusive = Boolean(mossproutJourney && mossproutJourney.status !== 'complete');
  const activityFamilyId = familyIdFromCompanionId(creatureId);
  const [authoredStories, setAuthoredStories] = useState(() => ({
    baristabbit: loadAuthoredCohortStory('baristabbit'),
    steppling: loadAuthoredCohortStory('steppling'),
    voyagle: loadAuthoredCohortStory('voyagle'),
    flexel: loadAuthoredCohortStory('flexel'),
    bedrotte: loadAuthoredCohortStory('bedrotte'),
  }));
  const [returnCharacterId, setReturnCharacterId] = useState<MergeOrder['characterId'] | null>(null);
  const [serveFlight, setServeFlight] = useState<MergeServeRewardFlight | null>(null);
  const [serveHiddenItemIds, setServeHiddenItemIds] = useState<Set<string>>(() => new Set());
  const [parcelFlight, setParcelFlight] = useState<MergeParcelFlight | null>(null);
  const [parcelHiddenItemIds, setParcelHiddenItemIds] = useState<Set<string>>(() => new Set());
  const [parcelShakeNonce, setParcelShakeNonce] = useState(0);
  const [presentedCoins, setPresentedCoins] = useState<number | null>(null);
  const [coinValueAnimationDurationMs, setCoinValueAnimationDurationMs] = useState(0);
  const [coinPulseNonce, setCoinPulseNonce] = useState(0);
  const [blockedFtuePulseNonce, setBlockedFtuePulseNonce] = useState(0);
  const [boardMetrics, setBoardMetrics] = useState<MergeBoardScreenMetrics | null>(null);
  const [boardVisualReady, setBoardVisualReady] = useState(false);
  const [ftueInteractionTargetReady, setFtueInteractionTargetReady] = useState(false);
  const [ftueTargetRevision, setFtueTargetRevision] = useState(0);
  const [screenLayoutNonce, setScreenLayoutNonce] = useState(0);
  const screenRef = useRef<View>(null);
  const coinHudRef = useRef<View>(null);
  const boardMetricsRef = useRef<MergeBoardScreenMetrics | null>(null);
  const railTargetRefs = useRef(new Map<string, View>());
  const parcelRef = useRef<View>(null);
  const activeServeRef = useRef(false);
  const activeParcelRef = useRef(false);
  const activeServeOrderRef = useRef<{ coinAmount: number; energyAmount: number; orderId: string } | null>(null);
  const coinPayoutStartedRef = useRef(false);
  const serveNonceRef = useRef(0);
  const parcelNonceRef = useRef(0);
  const storyNavigationPendingRef = useRef(false);
  const ftuePreviewNavigationPendingRef = useRef(false);
  const residentCardReturnPendingRef = useRef(false);
  const mergeSessionRef = useRef<ReturnType<typeof createMergeBoardSession> | null>(null);
  if (!mergeSessionRef.current) mergeSessionRef.current = createMergeBoardSession();
  const mergeSession = mergeSessionRef.current;
  const mergeSessionId = mergeSession.id;
  const ftueCoordinatorRef = useRef<MergeFtueInteractionCoordinator | null>(null);
  if (!ftueCoordinatorRef.current) ftueCoordinatorRef.current = new MergeFtueInteractionCoordinator(mergeSessionId);
  const ftueCoordinator = ftueCoordinatorRef.current;
  const stateRef = useRef(state);
  const ftueRunRef = useRef(ftueRun);
  const ftueStepRef = useRef(ftueStep);
  stateRef.current = state;
  ftueRunRef.current = ftueRun;
  ftueStepRef.current = ftueStep;
  const interactionSessionKey = `${mergeFtueInteractionKey(ftueRun, active)}:${ftueStep?.id ?? 'open'}`;
  const contentWidth = Math.min(width - 12, 600);
  const flowReady = !loading && state != null;
  useGameSurfaceReadiness('merge', {
    background: backgroundReady,
    data: flowReady,
    foreground: boardMetrics != null && boardVisualReady,
    interaction_target: ftueInteractionTargetReady,
    layout: screenLayoutNonce > 0 && boardAreaHeight > 0,
  }, active);
  useEffect(() => {
    if (
      !active
      || !residentFtueActive
      || !backgroundReady
      || !flowReady
      || boardMetrics == null
      || !boardVisualReady
      || screenLayoutNonce <= 0
      || boardAreaHeight <= 0
    ) return;
    markResidentMergePresented();
  }, [active, backgroundReady, boardAreaHeight, boardMetrics, boardVisualReady, flowReady, residentFtueActive, screenLayoutNonce]);
  const ftueExclusive = ftueStep?.surface === 'merge' && ftueStep.interaction?.mode === 'exclusive';
  const readyOrderIds = useMemo(() => state ? readyMergeOrderIds(state) : new Set<string>(), [state]);
  const activeResidentDiscovery = state?.residentCardDiscovery.records.find((record) => record.status !== 'locked' && record.status !== 'card_earned') ?? null;
  const pendingResidentDialogue = state?.residentCardDiscovery.records.find((record) => record.status === 'revealed' && record.dialogueSeenAt == null) ?? null;
  const pendingResidentCardReveal = state?.residentCardDiscovery.records.find((record) => record.status === 'card_earned' && record.cardRevealSeenAt == null) ?? null;
  const ftueBoardGate = useMemo(() => state ? mergeFtueBoardGate(ftueStep, state) : { kind: 'open' as const }, [ftueStep, state]);
  const ftueRailGate = useMemo(() => state ? mergeFtueRailGate(ftueStep, state) : { kind: 'locked' as const }, [ftueStep, state]);
  const hiddenAnimatedItemIds = useMemo(() => new Set([
    ...serveHiddenItemIds,
    ...parcelHiddenItemIds,
  ]), [parcelHiddenItemIds, serveHiddenItemIds]);
  const generatorUnlockRewards = useMemo(() => (state?.generatorUnlockReceipts ?? [])
    .filter((receipt) => receipt.seenAt == null)
    .flatMap((receipt): RewardSplashItem[] => {
      const generator = MERGE_GENERATORS_BY_ID.get(receipt.generatorId);
      const art = mergeWorldGeneratorArt(receipt.generatorId);
      if (!generator || !art) return [];
      const firstItems = [...new Set(generator.tierOneDropDefinitionIds
        .map((definitionId) => MERGE_ITEMS_BY_ID.get(definitionId)?.name)
        .filter((name): name is string => Boolean(name)))];
      return [{
        id: receipt.id,
        eyebrow: 'New item maker',
        title: generator.name,
        description: generator.unlockDescription,
        image: art,
        imageAccessibilityLabel: generator.name,
        detail: firstItems.length ? `Makes ${firstItems.join(' and ')}` : 'Ready to make new items',
        rewardTitle: 'Ready on your Merge board',
        rewardBody: 'Tap it whenever you want to make something new.',
        tint: generator.color,
        tier: 2,
      }];
    }), [state?.generatorUnlockReceipts]);
  const companionDiscoveryRewards = useMemo<RewardSplashItem[]>(() => (state?.companionDiscovery.records ?? [])
    .filter((record) => record.source === 'board_discovery' && record.revealSeenAt == null)
    .flatMap((record) => {
      const image = resolveCreatureArtSource(record.characterId, { stage: 'grown' });
      const revealCopy = EARLY_DISCOVERY_REVEAL_COPY[record.characterId];
      return [{
        id: `companion-discovery:${record.characterId}`,
        eyebrow: 'New Katchimera',
        title: `${MERGE_CHARACTER_NAMES[record.characterId]} discovered`,
        description: revealCopy?.description ?? 'A new companion found its way through the Dream Mist.',
        image,
        imageAccessibilityLabel: record.characterId,
        detail: 'Found on the Merge board',
        rewardTitle: 'Meet them',
        rewardBody: revealCopy?.rewardBody ?? 'Their discovery changed the board permanently.',
        tint: '#D7A956',
        tier: 3,
        nextLabel: 'See what changed',
      }];
    }), [state?.companionDiscovery.records]);
  const mergeCelebrationRewards = useMemo(() => [...companionDiscoveryRewards, ...generatorUnlockRewards], [companionDiscoveryRewards, generatorUnlockRewards]);
  const discoveryFork = state?.companionDiscovery.active?.selectedCharacterId == null
    && state?.companionDiscovery.active?.discoveryId.startsWith('fork:')
      ? state.companionDiscovery.active
      : null;
  const postFtueDiscoveryGuidance = useMemo<{
    cue: FtueCueDefinition | null;
    spotlight: FtueSpotlightDefinition | null;
  }>(() => {
    if (ftueStep || !state || state.companionDiscovery.active?.gateId !== 'gate-3-first-choice') return { cue: null, spotlight: null };
    const discovery = state.companionDiscovery.active;
    if (!discovery.selectedCharacterId) {
      const target = { kind: 'board_discovery_fork' as const, gateId: discovery.gateId };
      return { cue: null, spotlight: { targets: [target], padding: 6, radius: 14, dimOpacity: 0.46 } };
    }
    const parcel = state.arrivals.find((arrival) => arrival.kind === 'discovery_parcel'
      && arrival.discoveryId === discovery.discoveryId && arrival.claimedAt == null);
    if (!parcel) return { cue: null, spotlight: null };
    const target = { kind: 'tray_parcel' as const, arrivalId: parcel.id };
    return {
      cue: { kind: 'tap', target },
      spotlight: { targets: [target], padding: 7, radius: 14, dimOpacity: 0.52 },
    };
  }, [ftueStep, state]);
  const mergeGuidanceCue = ftueStep?.cue ?? postFtueDiscoveryGuidance.cue;
  const mergeGuidanceSpotlight = ftueStep?.spotlight ?? postFtueDiscoveryGuidance.spotlight;
  const mergeGuidanceGuide = ftueStep?.surface === 'merge' ? ftueStep.guide : null;
  const mergeGuidanceVisible = active && !serveFlight && !parcelFlight;

  useEffect(() => subscribeCompanionStories(() => {
    setStory(loadFeastleStory());
    setAuthoredStories({
      baristabbit: loadAuthoredCohortStory('baristabbit'),
      steppling: loadAuthoredCohortStory('steppling'),
      voyagle: loadAuthoredCohortStory('voyagle'),
      flexel: loadAuthoredCohortStory('flexel'),
      bedrotte: loadAuthoredCohortStory('bedrotte'),
    });
  }), []);

  useEffect(() => {
    if (!active || revealedKatchimeraCardId || !pendingResidentCardReveal) return;
    setRevealedKatchimeraCardId(pendingResidentCardReveal.residentId);
  }, [active, pendingResidentCardReveal, revealedKatchimeraCardId]);

  useEffect(() => {
    if (active) storyNavigationPendingRef.current = false;
    else {
      activeParcelRef.current = false;
      setParcelFlight(null);
      setParcelHiddenItemIds(new Set());
    }
  }, [active]);

  const openCharacterReturn = useCallback((characterId: MergeOrder['characterId'], noteId: string) => {
    if (!active || storyNavigationPendingRef.current) return;
    if (noteId === MOSSPROUT_FTUE_RETURN_NOTE_ID) {
      if (!mergeFtueAllowsChatNote(ftueStep, noteId)) {
        setBlockedFtuePulseNonce((current) => current + 1);
        if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }
      storyNavigationPendingRef.current = true;
      const accepted = transitionTo({
        announcement: 'Opening Mossprout',
        target: 'companion',
        navigate: async () => {
          try {
            const nextRun = dispatchFtueEvent({ type: 'chat_note_opened', noteId, revision: state?.revision ?? 0 });
            if (nextRun?.stepId !== 'companion.chapter_zero_return') {
              throw new Error('Mossprout did not accept the chapter-zero return');
            }
            await flushFtuePersistence();
            router.push({
              pathname: '/katchimera/[creatureId]',
              params: { creatureId: 'companion:mossprout', ftue: 'chapter-zero-return', source: 'merge-world' },
            });
          } catch (error) {
            storyNavigationPendingRef.current = false;
            throw error;
          }
        },
      });
      if (!accepted) storyNavigationPendingRef.current = false;
      return;
    }
    storyNavigationPendingRef.current = true;
    const accepted = transitionTo({
      announcement: 'Opening your Katchimera',
      target: 'companion',
      navigate: () => {
        if (characterId === 'feastle') beginFeastleReturn();
        else if (characterId === 'mossprout') {
          relationshipProgressionRepository.update((current) => beginMossproutJourneyReturn(current, mossproutJourneyDayId));
        }
        else if (isAuthoredCohortFamily(characterId)) beginAuthoredCohortReturn(characterId);
        else setReturnCharacterId((current) => current === characterId ? null : current);
        router.push({
          pathname: '/katchimera/[creatureId]',
          params: { creatureId: `companion:${characterId}`, source: 'merge-world', story: 'return' },
        });
      },
    });
    if (!accepted) storyNavigationPendingRef.current = false;
  }, [active, ftueStep, mossproutJourneyDayId, router, state?.revision, transitionTo]);

  useEffect(() => {
    if (!active
      || ftueRun?.status !== 'active'
      || ftueRun.stepId !== 'companion.chapter_zero_return'
      || storyNavigationPendingRef.current) return;
    storyNavigationPendingRef.current = true;
    transitionTo({
      announcement: 'Opening Mossprout',
      target: 'companion',
      navigate: () => router.push({
        pathname: '/katchimera/[creatureId]',
        params: { creatureId: 'companion:mossprout', ftue: 'chapter-zero-return', source: 'merge-world' },
      }),
    });
  }, [active, ftueRun?.status, ftueRun?.stepId, router, transitionTo]);

  useLayoutEffect(() => {
    return () => ftueCoordinator.dispose();
  }, [ftueCoordinator]);

  useEffect(() => {
    if (!active || ftueRun?.status !== 'active' || ftueRun.stepId !== 'companion.order_preview' || ftuePreviewNavigationPendingRef.current) return;
    ftuePreviewNavigationPendingRef.current = true;
    const accepted = transitionTo({
      announcement: 'Opening Mossprout',
      target: 'companion',
      navigate: () => router.push({ pathname: '/katchimera/[creatureId]', params: { creatureId: 'companion:mossprout' } }),
    });
    if (!accepted) ftuePreviewNavigationPendingRef.current = false;
  }, [active, ftueRun?.status, ftueRun?.stepId, router, transitionTo]);

  const openFtueHavenReveal = useCallback(() => {
    if (!active || ftueRun?.status !== 'active' || ftueRun.stepId !== 'haven.reveal' || storyNavigationPendingRef.current) return;
    storyNavigationPendingRef.current = true;
    transitionTo({
      announcement: 'The Haven is opening',
      target: 'katchimeras',
      navigate: () => router.push('/katchimeras'),
    });
  }, [active, ftueRun?.status, ftueRun?.stepId, router, transitionTo]);

  useEffect(() => {
    if (!active || !state || !ftueStep || !ftueRun) return;
    if (
      ftueRun.status === 'active'
      && ftueRun.stepId === 'companion.resident_parcel_ready'
      && ftueStep.id.startsWith('merge.resident_')
    ) {
      // Complete the route-first parcel handoff only once Merge is focused and
      // its durable board has identified the canonical resident step. This is
      // the single owner transfer for the companion -> Merge boundary.
      commitFtueAction({
        actionId: 'companion.open_resident_parcel',
        evidenceRef: 'merge-focused:resident-parcel-handoff',
        nextStepId: ftueStep.id,
      });
      return;
    }
    if (
      ftueRun.status === 'active'
      && ftueStep.id.startsWith('merge.resident_')
      && ftueRun.stepId !== ftueStep.id
      && ftueRun.stepId.startsWith('merge.resident_')
    ) {
      repairFtueStep(ftueRun.stepId, ftueStep.id);
      return;
    }
    const repairTarget = mergeFtueRepairTarget(ftueStep, state);
    if (repairTarget) repairFtueStep(ftueStep.id, repairTarget);
  }, [active, ftueRun, ftueStep, state]);

  useEffect(() => {
    if (!active || !state || !ftueStep || !ftueRun) return;
    const baseline = mergeFtueStepEntryBaseline(ftueStep, state);
    if (baseline) registerFtueObjectiveBaseline(baseline.stepId, baseline.actionId, baseline.value);
  }, [active, ftueRun, ftueStep, state]);

  useEffect(() => {
    if (!active || !state || !ftueStep || !ftueRun) return;
    if (ftueCoordinator.hasPendingRevision(state.revision)) return;
    const recovered = recoverMergeFtueEvent(ftueStep, state, ftueRun.objectiveProgress);
    if (!recovered) return;
    dispatchFtueEvent(recovered, `merge-recovery:${state.revision}`);
  }, [active, ftueCoordinator, ftueRun, ftueStep, state]);

  useEffect(() => {
    if (!active) return;
    setSelectedCell(null);
    setFtueTargetRevision((revision) => revision + 1);
  }, [active, ftueRun?.runId, ftueStep?.id]);

  const handleBlockedFtueInteraction = useCallback(() => {
    setBlockedFtuePulseNonce((current) => current + 1);
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const openFtueEnergyCapture = useCallback(() => {
    transitionTo({
      announcement: 'Returning to Today',
      target: 'today',
      navigate: async () => {
        const result = await advanceFtueActionDurably({
          expectedStepId: 'merge.energy_exhausted',
          actionId: 'merge.tell_me_more',
        });
        if (result.run?.stepId !== 'energy.capture') {
          throw new Error('Today did not accept the Energy capture FTUE step');
        }
        router.navigate({ pathname: '/today', params: { onboardingCapture: '1' } });
      },
    });
  }, [router, transitionTo]);

  const dispatch = useCallback((command: MergeWorldCommand) => {
    const releaseCriticalInteraction = beginCriticalInteractionWork();
    setTimeout(releaseCriticalInteraction, 180);
    const currentState = stateRef.current;
    const currentRun = ftueRunRef.current;
    const currentStep = ftueStepRef.current;
    if (!currentState) return null;
    if (ftueCoordinator.leased) return null;
    if (!mergeFtueAllowsCommand(currentStep, currentState, command)) {
      handleBlockedFtueInteraction();
      return null;
    }
    const shouldGuardFtueCommand = currentRun?.status === 'active'
      && currentStep?.surface === 'merge'
      && (command.type === 'tapGenerator' || command.type === 'move');
    // This guard covers only the synchronous reducer + narrative commit. The
    // visual operation deliberately outlives it, so a valid second tap can be
    // accepted while the first spawn is still animating.
    const commandToken = shouldGuardFtueCommand
      ? ftueCoordinator.begin(currentStep?.id ?? 'unknown', currentState.revision)
      : null;
    if (shouldGuardFtueCommand && !commandToken) return null;
    try {
      // Character activities use the polished Merge reducer and presentation,
      // but their opportunities are paced by Journey content rather than the
      // retired global Energy economy.
      const effectiveCommand = creatureId && command.type === 'tapGenerator'
        ? {
            ...command,
            spendEnergy: false as const,
            ...(activityFamilyId === 'mossprout'
              && !isMossproutChapterZeroActive(currentState)
              && mossproutJourney?.status === 'activity_in_progress'
              && mossproutJourney.activity?.opportunityId
              ? { activityOpportunityId: mossproutJourney.activity.opportunityId }
              : {}),
          }
        : command;
      const result = send(effectiveCommand);
      if (result) stateRef.current = result.state;
      const event = mergeFtueEventForCommand(currentState, command, result);
      if (event) {
        const nextRun = dispatchFtueEvent(
          event,
          `merge-command:${mergeSessionId}:${event.revision}`,
        );
        ftueRunRef.current = nextRun;
        ftueStepRef.current = nextRun?.status === 'active'
          ? mossproutFtueStep(nextRun.stepId)
          : null;
      }
      if (commandToken) ftueCoordinator.complete(commandToken);
      return result;
    } catch (error) {
      if (commandToken) ftueCoordinator.abort(commandToken);
      throw error;
    }
  }, [activityFamilyId, creatureId, ftueCoordinator, handleBlockedFtueInteraction, mergeSessionId, mossproutJourney?.activity?.opportunityId, mossproutJourney?.status, send]);
  const pendingParcels = useMemo(() => state?.arrivals.filter((arrival) => (
    arrival.claimedAt == null
    && (arrival.kind === 'discovery_parcel' || arrival.kind === 'root_match_parcel' || arrival.kind === 'resident_card_parcel' || arrival.kind === 'contextual_parcel' || arrival.kind === 'goal_chest')
    && arrival.itemDefinitionIds.length > 0
  )).sort((left, right) => left.createdAt - right.createdAt) ?? [], [state?.arrivals]);
  const pendingParcel = pendingParcels[0] ?? null;
  const pendingMemoryCard = state?.ownedMemoryCards.find((card) => card.revealedAt == null) ?? null;
  const revealedMemoryCard = revealedMemoryCardId ? MEMORY_CARDS_BY_ID.get(revealedMemoryCardId) ?? null : null;
  const memoryCardPresentation = pendingMemoryCard ? MEMORY_CARDS_BY_ID.get(pendingMemoryCard.cardId) ?? null : revealedMemoryCard;

  const trayEntries = useMemo<MergeTrayEntry[]>(() => {
    if (!state) return [];
    const featured = state.favouriteCharacterId;
    const chapterZeroOrders = state.activeOrders.filter((order) => order.id.startsWith('mossprout:chapter-0:'));
    const chapterZeroActive = chapterZeroOrders.length > 0;
    const mossproutReturnEntry: MergeTrayEntry = {
      id: `chat-note:mossprout:${mossproutJourney?.dayId}:${mossproutJourney?.beatId}`,
      kind: 'chat_note',
      characterId: 'mossprout',
      bondPoints: 0,
    };
    const journeyReturnReady = mossproutJourney?.status === 'return_available' || mossproutJourney?.status === 'resolution_ready';
    const returnEntries: MergeTrayEntry[] = chapterZeroActive ? [] : mossproutJourneyExclusive
      ? journeyReturnReady ? [mossproutReturnEntry] : []
      : [
      ...(ftueStep?.id === 'merge.return_note' ? [{
        id: MOSSPROUT_FTUE_RETURN_NOTE_ID,
        kind: 'chat_note' as const,
        characterId: 'mossprout' as const,
        bondPoints: 0,
      }] : []),
      ...(story.status === 'return_available' ? [{
        id: `chat-note:${story.id}:${story.targetLevel}`,
        kind: 'chat_note' as const,
        characterId: 'feastle' as const,
        bondPoints: story.pendingBondPoints,
      }] : []),
      ...Object.values(authoredStories).flatMap((authoredStory): MergeTrayEntry[] => {
        if (authoredStory.status !== 'return_available' || !isAuthoredCohortFamily(authoredStory.familyId)) return [];
        return [{
          id: `chat-note:${authoredStory.id}:${authoredStory.targetLevel}`,
          kind: 'chat_note',
          characterId: authoredStory.familyId,
          bondPoints: authoredStory.pendingBondPoints,
        }];
      }),
      ...(returnCharacterId ? [{
        id: `chat-note:${returnCharacterId}:chapter-1`,
        kind: 'chat_note' as const,
        characterId: returnCharacterId,
        bondPoints: 0,
      }] : []),
    ];
    const focusCharacterId = focusOrderId
      ? state.activeOrders.find((order) => order.id === focusOrderId)?.characterId ?? null
      : null;
    const journeyOrderIds = new Set(mossproutJourney?.activity?.mergeOrderIds
      ?? (mossproutJourney?.activity ? [mossproutJourney.activity.mergeOrderId] : []));
    const visibleOrders = chapterZeroActive
      ? chapterZeroOrders.slice(0, 1)
      : mossproutJourneyExclusive
        ? state.activeOrders.filter((order) => journeyOrderIds.has(order.id) || order.storyArcId === activeResidentDiscovery?.id)
        : state.activeOrders;
    const prioritizedOrders = visibleOrders
      .map((order, sourceIndex) => ({ order, sourceIndex }))
      .sort((left, right) => {
        const priority = (order: MergeOrder) => {
          if (focusOrderId && order.id === focusOrderId) return 0;
          if (focusCharacterId && order.characterId === focusCharacterId) return 1;
          if (featured && order.characterId === featured) return focusCharacterId ? 2 : 0;
          return focusCharacterId ? 3 : 1;
        };
        return priority(left.order) - priority(right.order) || left.sourceIndex - right.sourceIndex;
      })
      .map(({ order }) => order);
    const orderEntries = prioritizedOrders.map((order): MergeTrayEntry => ({
      id: order.id,
      kind: 'order' as const,
      order,
      itemReadiness: mergeOrderItemReadiness(state, order),
      ready: readyOrderIds.has(order.id),
    }));
    const parcelEntries: MergeTrayEntry[] = !chapterZeroActive && pendingParcel && (!mossproutJourneyExclusive || pendingParcel.kind === 'resident_card_parcel') ? [{
      id: 'parcel-stack',
      kind: 'parcel',
      arrival: pendingParcel,
      count: pendingParcels.length,
      disabled: !active || Boolean(parcelFlight) || Boolean(serveFlight),
      shakeNonce: parcelShakeNonce,
    }] : [];
    // Midpoint notes sit before the remaining requests so the story beat is
    // immediately visible without replacing or hiding any unserved order.
    return [...parcelEntries, ...returnEntries, ...orderEntries];
  }, [active, activeResidentDiscovery?.id, authoredStories, focusOrderId, ftueStep?.id, mossproutJourney?.activity, mossproutJourney?.beatId, mossproutJourney?.dayId, mossproutJourney?.status, mossproutJourneyExclusive, parcelFlight, parcelShakeNonce, pendingParcel, pendingParcels.length, readyOrderIds, returnCharacterId, serveFlight, state, story.id, story.pendingBondPoints, story.status, story.targetLevel]);

  const startServeAnimation = useCallback(async (order: MergeOrder, itemTargets: readonly MergeScreenPoint[]) => {
    if (!state || activeServeRef.current || activeParcelRef.current || parcelFlight) return false;
    activeServeRef.current = true;
    coinPayoutStartedRef.current = false;
    const boardMetrics = boardMetricsRef.current;
    const servingItems = mergeOrderServingCells(state, order);
    const [screenRect, coinRect] = await Promise.all([
      measureViewInWindow(screenRef),
      measureViewInWindow(coinHudRef),
    ]);
    if (!boardMetrics || !screenRect || !coinRect || servingItems.length !== itemTargets.length) {
      activeServeRef.current = false;
      return false;
    }
    const localTargets = itemTargets.map((point) => ({ x: point.x - screenRect.x, y: point.y - screenRect.y }));
    const items = servingItems.map((item, index) => {
      const center = mergeCellCenter(boardMetrics.geometry, item.cell);
      return {
        definitionId: item.definitionId,
        from: { x: boardMetrics.x - screenRect.x + center.x, y: boardMetrics.y - screenRect.y + center.y },
        instanceId: item.instanceId,
        to: localTargets[index],
      };
    });
    const coinFrom = localTargets.reduce((point, target) => ({ x: point.x + target.x / localTargets.length, y: point.y + target.y / localTargets.length }), { x: 0, y: 0 });
    const coinTo = { x: coinRect.x - screenRect.x + coinRect.width / 2, y: coinRect.y - screenRect.y + coinRect.height / 2 };
    const energyTo = coinTo;
    serveNonceRef.current += 1;
    activeServeOrderRef.current = {
      coinAmount: order.reward.coins,
      energyAmount: 0,
      orderId: order.id,
    };
    setServeHiddenItemIds(new Set(items.map((item) => item.instanceId)));
    setServeFlight({ coinAmount: order.reward.coins, coinFrom, coinTo, energyAmount: 0, energyTo, items, nonce: serveNonceRef.current, phase: 'items' });
    return true;
  }, [parcelFlight, state]);

  const handleServeItemsArrive = useCallback(() => {
    const activeOrder = activeServeOrderRef.current;
    const orderStillReady = state?.activeOrders.some((order) => order.id === activeOrder?.orderId)
      && readyOrderIds.has(activeOrder?.orderId ?? '');
    if (!activeOrder || !state || !orderStillReady) {
      activeServeRef.current = false;
      activeServeOrderRef.current = null;
      setServeHiddenItemIds(new Set());
      setServeFlight(null);
      return;
    }
    // Keep the order and its consumed board items in state until every reward
    // token has reached the HUD. Removing the order here would start the tray
    // outro while the coin flight is still running.
    setPresentedCoins(state.coins);
    setCoinValueAnimationDurationMs(0);
    setServeFlight((current) => current ? { ...current, energyAmount: 0, phase: 'rewards' } : null);
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [readyOrderIds, state]);

  const handleCoinArrive = useCallback((_amount: number, contactWindowMs: number, _index: number, totalAmount: number) => {
    if (!coinPayoutStartedRef.current) {
      coinPayoutStartedRef.current = true;
      setCoinValueAnimationDurationMs(contactWindowMs);
      setPresentedCoins((current) => (
        (current ?? stateRef.current?.coins ?? 0) + (activeServeOrderRef.current?.coinAmount ?? totalAmount)
      ));
    }
    setCoinPulseNonce((current) => current + 1);
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleEnergyArrive = useCallback((_amount: number, _contactWindowMs: number, _index: number, _totalAmount: number) => undefined, []);

  const finishServeAnimation = useCallback(() => {
    const activeOrder = activeServeOrderRef.current;
    if (!activeOrder) return;
    const servedOrder = state?.activeOrders.find((order) => order.id === activeOrder.orderId);
    const result = dispatch({ type: 'serveOrder', orderId: activeOrder.orderId, now: Date.now() });
    if (result?.changed && activeOrder.orderId === 'mossprout:chapter-0:first-sprout') {
      const dayId = localDayId();
      relationshipProgressionRepository.update((current) => {
        const started = startMossproutJourneyDay(current, dayId, Date.now(), stateRef.current?.mossproutBoardProgression.activeDayIds.length ?? 0);
        return recordMossproutFirstGardenRestored(started.state, dayId, `merge-order:${activeOrder.orderId}`);
      });
    }
    if (result?.changed && servedOrder?.signature && servedOrder.characterId !== 'feastle' && servedOrder.characterId !== 'mossprout' && !isAuthoredCohortFamily(servedOrder.characterId)) {
      setReturnCharacterId(servedOrder.characterId);
    }
    if (result?.changed && servedOrder?.reward.katchimeraCardId) {
      setRevealedKatchimeraCardId(servedOrder.reward.katchimeraCardId);
    }
    setPresentedCoins(null);
    setCoinValueAnimationDurationMs(0);
    if (!result?.changed) setServeHiddenItemIds(new Set());
    setServeFlight(null);
    activeServeRef.current = false;
    coinPayoutStartedRef.current = false;
    activeServeOrderRef.current = null;
  }, [dispatch, state?.activeOrders]);
  const handleHiddenItemsRetired = useCallback((instanceIds: readonly string[]) => {
    setServeHiddenItemIds((current) => {
      if (!instanceIds.some((instanceId) => current.has(instanceId))) return current;
      const next = new Set(current);
      instanceIds.forEach((instanceId) => next.delete(instanceId));
      return next;
    });
  }, []);
  const handleBoardScreenMetrics = useCallback((metrics: MergeBoardScreenMetrics) => {
    boardMetricsRef.current = metrics;
    setBoardMetrics(metrics);
  }, []);
  const handleRailTargetRef = useCallback((targetKey: string, view: View | null) => {
    const current = railTargetRefs.current.get(targetKey) ?? null;
    if (current === view) return;
    if (view) railTargetRefs.current.set(targetKey, view);
    else railTargetRefs.current.delete(targetKey);
    setFtueTargetRevision((revision) => revision + 1);
  }, []);
  const rerollOrder = useCallback((orderId: string) => {
    dispatch({ type: 'rerollOrder', orderId, now: Date.now() });
  }, [dispatch]);

  const openParcel = useCallback(async (arrivalId: string) => {
    if (!state || activeParcelRef.current || parcelFlight || serveFlight) return;
    activeParcelRef.current = true;
    const boardMetrics = boardMetricsRef.current;
    const [screenRect, parcelRect] = await Promise.all([
      measureViewInWindow(screenRef),
      measureViewInWindow(parcelRef),
    ]);
    if (!boardMetrics || !screenRect || !parcelRect) {
      activeParcelRef.current = false;
      return;
    }
    const result = dispatch({ type: 'claimArrival', arrivalId, now: Date.now() });
    if (!result?.changed || !result.spawnedItems?.length) {
      activeParcelRef.current = false;
      setParcelShakeNonce((value) => value + 1);
      if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    parcelNonceRef.current += 1;
    const from = {
      x: parcelRect.x - screenRect.x + parcelRect.width / 2,
      y: parcelRect.y - screenRect.y + parcelRect.height / 2,
    };
    const items = result.spawnedItems.map((item) => {
      const center = mergeCellCenter(boardMetrics.geometry, item.cell);
      return {
        instanceId: item.instanceId,
        definitionId: item.definitionId,
        destinationSize: boardMetrics.geometry.cellSize - 4,
        to: {
          x: boardMetrics.x - screenRect.x + center.x,
          y: boardMetrics.y - screenRect.y + center.y,
        },
      };
    });
    setParcelHiddenItemIds(new Set(items.map((item) => item.instanceId)));
    const arrival = state.arrivals.find((candidate) => candidate.id === arrivalId);
    setParcelFlight({ nonce: parcelNonceRef.current, from, items, rootMatch: arrival?.kind === 'root_match_parcel' });
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [dispatch, parcelFlight, serveFlight, state]);

  const handleParcelItemArrive = useCallback((instanceId: string) => {
    setParcelHiddenItemIds((current) => {
      const next = new Set(current);
      next.delete(instanceId);
      return next;
    });
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const finishParcelFlight = useCallback(() => {
    activeParcelRef.current = false;
    setParcelHiddenItemIds(new Set());
    setParcelFlight(null);
    setFtueTargetRevision((revision) => revision + 1);
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const measureBoardArea = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.height);
    setBoardAreaHeight((current) => current === next ? current : next);
  }, []);

  if (loading || !state) {
    return <View style={styles.loading}><ActivityIndicator color={Lantern.ember300} size="large" /><ThemedText darkColor="#FFF0CE">Opening the pantry…</ThemedText></View>;
  }

  return (
    <View onLayout={() => setScreenLayoutNonce((nonce) => nonce + 1)} ref={screenRef} style={styles.screen}>
      <Stack.Screen options={{ gestureEnabled: !residentFtueActive }} />
      <MergeCommandFeedback />
      <View style={[styles.game, { paddingTop: Math.max(insets.top + 3, 7), paddingBottom: Math.max(insets.bottom + 3, 7), width: contentWidth }]}>
        <GameHudBar
          density="compact"
          leading={<KatchimeraBackButton
            accessibilityLabel={creatureId ? 'Return to Mossprout' : 'Open legacy games'}
            disabled={ftueNavigationLocked && !residentFtueActive}
            onPress={() => residentFtueActive && creatureId
              ? returnToResidentStory()
              : ftueNavigationLocked || ftueExclusive
                ? handleBlockedFtueInteraction()
                : creatureId ? router.back() : router.push('/legacy-games')}
            style={ftueNavigationLocked && !residentFtueActive ? styles.hiddenBackButton : undefined}
          />}
          style={styles.hudBar}
          tone="glass"
          trailing={<GameCurrencyHud balances={[
              {
                animateValue: presentedCoins != null,
                art: GAME_CURRENCY_ART.coins,
                id: 'coins',
                pulseNonce: coinPulseNonce,
                targetRef: coinHudRef,
                value: presentedCoins ?? state.coins,
                valueAnimationDurationMs: coinValueAnimationDurationMs,
              },
            ]} style={styles.currencyHud} tone="glass" />}
        />
        {/* Static game geometry: onboarding guidance must never be inserted in
            this flex column. Future guidance belongs in an absolute world-space
            overlay so the tray, counter, and board retain identical frames. */}
        <View style={styles.mergeArea}>
          <MergeOrderRail
            entries={trayEntries}
            focusOrderId={focusOrderId}
            onOpenChat={openCharacterReturn}
            onOpenParcel={(arrivalId) => void openParcel(arrivalId)}
            onReroll={(order) => rerollOrder(order.id)}
            onServe={startServeAnimation}
            onBlockedInteraction={handleBlockedFtueInteraction}
            onRailTargetRef={handleRailTargetRef}
            interactionGate={ftueRailGate}
            parcelTargetRef={parcelRef}
          />

          <ServiceCounter viewportWidth={width} />

          <View onLayout={measureBoardArea} style={styles.boardStage}>
            {active && boardAreaHeight > 0 ? <FeastlePersistentMergeBoard
              animateEntrance={playBoardEntrance}
              hiddenItemInstanceIds={hiddenAnimatedItemIds}
              interactionGate={ftueBoardGate}
              interactionSessionKey={interactionSessionKey}
              maxHeight={boardAreaHeight - 1}
              onBlockedInteraction={handleBlockedFtueInteraction}
              onCommand={dispatch}
              onHiddenItemsRetired={handleHiddenItemsRetired}
              onInspectMist={setInspectedCell}
              onInspectRootbound={(gateId) => {
                const cell = state.board.findIndex((candidate) => candidate.mist?.kind === 'rootbound_echo' && candidate.mist.gateId === gateId);
                if (cell >= 0) setInspectedCell(cell);
              }}
              onSelect={(cell) => {
                setSelectedCell(cell);
                if (cell != null) setInspectedCell(cell);
              }}
              onScreenMetrics={handleBoardScreenMetrics}
              onVisualReady={() => setBoardVisualReady(true)}
              selectedCell={selectedCell}
              state={state}
              sessionId={mergeSessionId}
              width={contentWidth}
            /> : null}
            {parcelFlight ? <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.boardInteractionShield} /> : null}
          </View>
          <MergeCellInspector
            cell={inspectedCell}
            onUseGrovelight={(gateId) => dispatch({ type: 'useGrovelightResonance', gateId, dayId: localDayId(), now: Date.now() })}
            state={state}
          />
        </View>

      </View>

      <MergeFtueOverlay
        blockedPulseNonce={blockedFtuePulseNonce}
        boardMetrics={boardMetrics}
        cue={mergeGuidanceVisible ? mergeGuidanceCue : null}
        guide={mergeGuidanceVisible ? mergeGuidanceGuide : null}
        layoutNonce={screenLayoutNonce}
        onReadinessChange={setFtueInteractionTargetReady}
        screenRef={screenRef}
        railTargetRefs={railTargetRefs}
        state={state}
        spotlight={mergeGuidanceVisible ? mergeGuidanceSpotlight : null}
        targetRevision={ftueTargetRevision}
      />

      {active && memoryCardPresentation ? <KatchaSurfaceProvider surface="parchment"><View style={[styles.memoryCardOverlay, { bottom: Math.max(insets.bottom + 20, 28) }]}>
        <View style={styles.memoryCardArtWrap}>
          <Image accessibilityIgnoresInvertColors contentFit="contain" source={RARE_MEMORY_CARD_REVEAL_ART} style={styles.memoryCardGlowArt} transition={0} />
          <Image accessibilityIgnoresInvertColors contentFit="contain" source={pendingMemoryCard ? VEILED_MEMORY_CARD_ART : memoryCardArt(memoryCardPresentation.id)} style={styles.memoryCardArt} transition={180} />
        </View>
        <ThemedText lightColor="#675126" darkColor="#675126" style={styles.memoryCardEyebrow}>{pendingMemoryCard ? 'VEILED MEMORY CARD' : 'SMALL WONDERS · RARE'}</ThemedText>
        <ThemedText lightColor="#322713" darkColor="#322713" style={styles.memoryCardTitle}>{pendingMemoryCard ? 'Something worth remembering' : memoryCardPresentation.name}</ThemedText>
        <ThemedText lightColor="#675B41" darkColor="#675B41" style={styles.memoryCardBody}>{pendingMemoryCard ? 'This collectible is a memory-themed card, separate from Katchimera skins.' : memoryCardPresentation.reflection}</ThemedText>
        <KatchaButton
          fullWidth
          glow
          label={pendingMemoryCard ? 'Reveal card' : 'Keep in Memory Album'}
          onPress={() => {
            if (pendingMemoryCard) {
              setRevealedMemoryCardId(pendingMemoryCard.cardId);
              dispatch({ type: 'revealMemoryCard', cardId: pendingMemoryCard.cardId, now: Date.now() });
            } else setRevealedMemoryCardId(null);
          }}
        />
      </View></KatchaSurfaceProvider> : null}

      {active && ftueStep?.id === 'merge.energy_exhausted' ? (
        <View style={[styles.energyConnectionOverlay, { bottom: Math.max(insets.bottom + 20, 28) }]}>
          <ThemedText style={styles.energyConnectionEyebrow} lightColor="#FFD36A" darkColor="#FFD36A">MOSSPROUT NOTICED</ThemedText>
          <ThemedText selectable style={styles.energyConnectionTitle} lightColor="#FFF8E8" darkColor="#FFF8E8">“Oh… we’re running out of that strange energy.”</ThemedText>
          <ThemedText selectable style={styles.energyConnectionBody} lightColor="rgba(255,248,232,0.82)" darkColor="rgba(255,248,232,0.82)">“Wait. It got stronger when you told me about your day.”</ThemedText>
          <KatchaButton fullWidth glow label="Tell me something else" onPress={openFtueEnergyCapture} />
        </View>
      ) : null}

      {active && ftueStep?.id === 'haven.reveal' ? (
        <View style={[styles.energyConnectionOverlay, { bottom: Math.max(insets.bottom + 20, 28) }]}>
          <ThemedText style={styles.energyConnectionEyebrow} lightColor="#FFD36A" darkColor="#FFD36A">A WIDER WORLD IS WAITING</ThemedText>
          <ThemedText selectable style={styles.energyConnectionTitle} lightColor="#FFF8E8" darkColor="#FFF8E8">Mossprout’s garden is only the beginning.</ThemedText>
          <ThemedText selectable style={styles.energyConnectionBody} lightColor="rgba(255,248,232,0.82)" darkColor="rgba(255,248,232,0.82)">Return to the restored clearing and look beyond the Dream Mist.</ThemedText>
          <KatchaButton fullWidth glow label="Visit Haven" onPress={openFtueHavenReveal} />
        </View>
      ) : null}

      {active && discoveryFork ? <View style={[styles.discoveryForkOverlay, { bottom: Math.max(insets.bottom + 18, 26) }]}>
        <ThemedText style={styles.energyConnectionEyebrow} lightColor="#FFD36A" darkColor="#FFD36A">THE MIST IS LISTENING</ThemedText>
        <ThemedText selectable style={styles.discoveryForkTitle} lightColor="#FFF8E8" darkColor="#FFF8E8">{discoveryFork.candidateIds.length === 1 ? 'One path remains.' : 'Which path should we follow?'}</ThemedText>
        <ThemedText selectable style={styles.discoveryForkBody} lightColor="rgba(255,248,232,0.82)" darkColor="rgba(255,248,232,0.82)">{discoveryFork.candidateIds.length === 1 ? 'Follow it to complete this circle of companions.' : 'The others will return another time.'}</ThemedText>
        <View style={styles.discoveryForkActions}>{discoveryFork.candidateIds.map((characterId) => <KatchaButton
          fullWidth
          glow={discoveryFork.recommendedCharacterId === characterId}
          key={characterId}
          label={`${discoveryFork.candidateIds.length === 1 ? 'Follow ' : ''}${COMPANION_DISCOVERY_CATALOG.find((definition) => definition.characterId === characterId)?.pathName ?? 'Mysterious Path'}${discoveryFork.recommendedCharacterId === characterId ? ' · This feels familiar' : ''}`}
          onPress={() => dispatch({ type: 'selectCompanionDiscoveryPath', characterId, now: Date.now() })}
          variant={discoveryFork.recommendedCharacterId === characterId ? 'primary' : 'secondary'}
        />)}</View>
      </View> : null}

      {error ? <KatchaSurfaceProvider surface="parchment"><View style={[styles.errorBanner, { top: Math.max(insets.top + 56, 64) }]}><KatchaInlineNotice body={error} title="Merge paused" tone="danger" /></View></KatchaSurfaceProvider> : null}
      <MergeServeRewardOverlay flight={serveFlight} onCoinArrive={handleCoinArrive} onEnergyArrive={handleEnergyArrive} onFinish={finishServeAnimation} onItemsArrive={handleServeItemsArrive} />
      <MergeParcelFlightOverlay flight={parcelFlight} onFinish={finishParcelFlight} onItemArrive={handleParcelItemArrive} />
      {active && pendingResidentDialogue ? <ResidentRevealDialogue
        onContinue={() => dispatch({ type: 'ackResidentCardDialogue', discoveryId: pendingResidentDialogue.id, now: Date.now() })}
        residentId={pendingResidentDialogue.residentId}
      /> : null}
      <KatchimeraCardRevealModal
        cardId={revealedKatchimeraCardId}
        cards={mossproutCards}
        onDone={() => {
          if (residentCardReturnPendingRef.current) return;
          const discovery = stateRef.current?.residentCardDiscovery.records.find((record) => record.residentId === revealedKatchimeraCardId && record.status === 'card_earned' && record.cardRevealSeenAt == null);
          if (discovery) {
            residentCardReturnPendingRef.current = true;
            // The card confirmation is the final Merge-owned FTUE action. Use
            // keep the native reveal modal mounted while the root curtain
            // covers. Only then acknowledge it, persist the terminal handoff,
            // and uncover the completed match conversation beneath Merge.
            let handoffCommitted = false;
            const accepted = transitionTo({
              announcement: 'Returning to Mossprout',
              target: 'companion',
              navigate: async () => {
                if (!handoffCommitted) {
                  const result = dispatch({ type: 'ackResidentCardReveal', discoveryId: discovery.id, now: Date.now() });
                  if (!result?.changed) throw new Error('Resident card reveal acknowledgement was not accepted');
                  setRevealedKatchimeraCardId(null);
                  finishResidentMergeSession();
                  handoffCommitted = true;
                }
                await Promise.all([flushMergeWorld(), flushFtuePersistence()]);
                router.back();
              },
            });
            if (!accepted) residentCardReturnPendingRef.current = false;
            return;
          }
          setRevealedKatchimeraCardId(null);
          if (creatureId) router.back();
        }}
      />
      {active && mergeCelebrationRewards.length ? <RewardSplash
        items={mergeCelebrationRewards}
        onItemSeen={(receiptId) => receiptId.startsWith('companion-discovery:')
          ? dispatch({ type: 'ackCompanionDiscoveryReveal', characterId: receiptId.slice('companion-discovery:'.length) as MergeOrder['characterId'], now: Date.now() })
          : dispatch({ type: 'ackGeneratorUnlock', receiptId, now: Date.now() })}
      /> : null}
    </View>
  );
}

function ResidentRevealDialogue({ residentId, onContinue }: { residentId: KatchimeraSkinId; onContinue: () => void }) {
  const reduceMotion = useReducedMotion();
  const [celebrating, setCelebrating] = useState(true);
  const resident = katchimeraSkinById.get(residentId);
  const image = resolveCreatureArtSource(resident?.visualKey ?? 'mossprout', { stage: 'grown' });
  const name = resident?.displayName ?? residentId;
  const dialogue = mossproutResidentById.get(residentId)?.revealDialogue
    ?? 'Mossprout told me this garden was growing. Help me with two small things, and I may stay.';
  useEffect(() => {
    if (reduceMotion) {
      setCelebrating(false);
      return;
    }
    const timer = setTimeout(() => setCelebrating(false), 1_150);
    return () => clearTimeout(timer);
  }, [reduceMotion]);
  return <Animated.View accessibilityViewIsModal entering={FadeIn.duration(reduceMotion ? 80 : 220)} exiting={FadeOut.duration(reduceMotion ? 80 : 180)} style={styles.residentRevealOverlay}>
    {celebrating ? <Animated.View exiting={FadeOut.duration(150)} key="resident-celebration" pointerEvents="none" style={styles.residentRevealHero}>
      <RotatingRadialSunburst baseOpacity={0.9} rotationDurationMs={18_000} size={390} style={styles.residentRevealRays} />
      <CelebrationParticles layerStyle={styles.residentRevealConfetti} tier={3} tint="#8DD56B" />
      <Animated.View entering={reduceMotion ? FadeIn.duration(80) : ZoomIn.duration(560)} style={styles.residentRevealArtWrap}>
        <Image accessibilityLabel={name} contentFit="contain" source={image} style={styles.residentRevealArt} transition={0} />
      </Animated.View>
    </Animated.View> : <Animated.View entering={FadeIn.duration(reduceMotion ? 80 : 260)} key="resident-dialogue" style={styles.residentDialogueStage}>
      <Image accessibilityLabel={name} contentFit="contain" source={image} style={styles.residentDialogueArt} transition={0} />
      <View style={styles.residentSpeech}>
        <ThemedText style={styles.residentEyebrow} lightColor="#D6B758" darkColor="#D6B758">A GARDEN RESIDENT ANSWERED</ThemedText>
        <ThemedText selectable style={styles.residentTitle} lightColor="#332918" darkColor="#332918">{name}</ThemedText>
        <ThemedText selectable style={styles.residentBody} lightColor="#5C513B" darkColor="#5C513B">{`“${dialogue}”`}</ThemedText>
        <KatchaButton fullWidth glow label="See the first request" onPress={onContinue} />
      </View>
    </Animated.View>}
  </Animated.View>;
}

function MergeCommandFeedback() {
  const lastResult = useMergeWorldLastResult();
  const feedback = useGameFeedback();
  useEffect(() => {
    if (!lastResult || lastResult.failureReason) return;
    const message = lastResult.spawnedCell != null ? null : lastResult.message ?? null;
    if (message) feedback.show({ id: `merge:${lastResult.state.revision}:${message}`, message });
  }, [feedback, lastResult]);
  return null;
}

function ServiceCounter({ viewportWidth }: { viewportWidth: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.serviceCounter, { width: viewportWidth }]}>
      <View style={styles.counterUpperLip} />
      <View style={styles.counterInsetShade} />
      <View style={styles.counterFaceEdge} />
      <View style={styles.counterFace} />
      <View style={styles.counterLowerEdge} />
      <View style={styles.counterLowerFlat} />
    </View>
  );
}

function measureViewInWindow(ref: RefObject<View | null>): Promise<{ height: number; width: number; x: number; y: number } | null> {
  return new Promise((resolve) => {
    if (!ref.current) {
      resolve(null);
      return;
    }
    ref.current.measureInWindow((x, y, width, height) => resolve({ height, width, x, y }));
  });
}

const styles = StyleSheet.create({
  screen: { alignItems: 'center', backgroundColor: 'transparent', flex: 1, overflow: 'hidden' },
  game: { flex: 1, gap: 7, minHeight: 0 },
  loading: { alignItems: 'center', backgroundColor: '#2B1B13', flex: 1, gap: 12, justifyContent: 'center' },
  currencyHud: { flex: 0, paddingLeft: 18, width: 106 },
  hudBar: { justifyContent: 'space-between' },
  hiddenBackButton: { opacity: 0 },
  mergeArea: { flex: 1, marginTop: 18, minHeight: 0, position: 'relative' },
  serviceCounter: { alignSelf: 'center', height: 32, marginTop: -29, position: 'relative', zIndex: 1 },
  counterUpperLip: { backgroundColor: '#FFE876', height: 3, left: 0, position: 'absolute', right: 0, top: 0 },
  counterInsetShade: { backgroundColor: '#A64F32', height: 5, left: 0, position: 'absolute', right: 0, top: 3 },
  counterFaceEdge: { backgroundColor: '#FFE36A', height: 3, left: 0, position: 'absolute', right: 0, top: 8 },
  counterFace: { backgroundColor: '#EEA621', bottom: 5, left: 0, position: 'absolute', right: 0, top: 11 },
  counterLowerEdge: { backgroundColor: '#CB701D', bottom: 2, height: 3, left: 0, position: 'absolute', right: 0 },
  counterLowerFlat: { backgroundColor: '#8F4932', bottom: 0, height: 2, left: 0, position: 'absolute', right: 0 },
  boardStage: { alignItems: 'center', elevation: 0, flex: 1, justifyContent: 'flex-start', minHeight: 0, position: 'relative', zIndex: 0 },
  boardInteractionShield: { ...StyleSheet.absoluteFillObject, zIndex: 50 },
  errorBanner: { alignSelf: 'center', maxWidth: 360, position: 'absolute', width: '92%', zIndex: GameUI.layer.notice },
  memoryCardOverlay: { alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(250,241,207,0.97)', borderColor: 'rgba(127,96,38,0.32)', borderRadius: 24, borderWidth: 1, gap: 8, left: 24, maxWidth: 360, padding: 18, position: 'absolute', right: 24, zIndex: GameUI.layer.modal },
  memoryCardArtWrap: { alignItems: 'center', height: 178, justifyContent: 'center', width: 148 },
  memoryCardGlowArt: { height: 166, opacity: 0.46, position: 'absolute', width: 166 },
  memoryCardArt: { height: 174, width: 130 },
  memoryCardEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, lineHeight: 14, textAlign: 'center' },
  memoryCardTitle: { fontSize: 21, fontWeight: '900', lineHeight: 26, textAlign: 'center' },
  memoryCardBody: { fontSize: 13, fontWeight: '600', lineHeight: 18, maxWidth: 290, textAlign: 'center' },
  residentRevealOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', backgroundColor: 'rgba(24,42,23,0.88)', justifyContent: 'center', paddingHorizontal: 22, zIndex: GameUI.layer.modal },
  residentRevealHero: { alignItems: 'center', height: 300, justifyContent: 'center', marginBottom: -22, width: 390 },
  residentRevealRays: { left: 0, top: -45 },
  residentRevealConfetti: { top: '50%', zIndex: 3 },
  residentRevealArtWrap: { alignItems: 'center', height: 286, justifyContent: 'center', width: 286, zIndex: 2 },
  residentRevealArt: { height: 286, width: 286 },
  residentDialogueStage: { alignItems: 'center', maxWidth: 390, width: '100%' },
  residentDialogueArt: { height: 220, marginBottom: -24, width: 220, zIndex: 4 },
  residentSpeech: { backgroundColor: '#FFF8E6', borderColor: '#D6B758', borderCurve: 'continuous', borderRadius: 25, borderWidth: 2, gap: 8, maxWidth: 390, padding: 18, width: '100%', zIndex: 3 },
  residentEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.25, textAlign: 'center' },
  residentTitle: { fontSize: 27, fontWeight: '900', lineHeight: 31, textAlign: 'center' },
  residentBody: { fontSize: 15, fontWeight: '700', lineHeight: 21, paddingBottom: 5, textAlign: 'center' },
  energyConnectionOverlay: { alignSelf: 'center', backgroundColor: 'rgba(31,24,45,0.9)', borderColor: 'rgba(255,226,151,0.5)', borderCurve: 'continuous', borderRadius: 24, borderWidth: 1, boxShadow: '0 12px 30px rgba(24,14,34,0.42)', gap: 8, left: 18, maxWidth: 430, padding: 18, position: 'absolute', right: 18, zIndex: GameUI.layer.modal },
  energyConnectionEyebrow: { ...GameUI.type.label, fontSize: 11, letterSpacing: 1.4, textAlign: 'center' },
  energyConnectionTitle: { ...GameUI.type.title, fontSize: 19, lineHeight: 24, textAlign: 'center' },
  energyConnectionBody: { ...GameUI.type.body, fontSize: 14, lineHeight: 20, paddingBottom: 4, textAlign: 'center' },
  discoveryForkOverlay: { alignSelf: 'center', backgroundColor: 'rgba(31,24,45,0.94)', borderColor: 'rgba(255,226,151,0.55)', borderCurve: 'continuous', borderRadius: 24, borderWidth: 1, boxShadow: '0 12px 30px rgba(24,14,34,0.48)', gap: 8, left: 18, maxWidth: 430, padding: 18, position: 'absolute', right: 18, zIndex: GameUI.layer.modal },
  discoveryForkTitle: { ...GameUI.type.title, fontSize: 20, lineHeight: 25, textAlign: 'center' },
  discoveryForkBody: { ...GameUI.type.body, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  discoveryForkActions: { gap: 8, paddingTop: 6 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
