import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { RewardSplash, type RewardSplashItem } from '@/components/katchadeck/ui/reward-splash';
import { GameCurrencyHud } from '@/components/katchadeck/ui/game-currency-hud';
import { GameHudBar, GameHudItem } from '@/components/katchadeck/ui/game-primitives';
import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
import { KatchimeraPageHeader } from '@/components/katchadeck/world/katchimera-page-header';
import { KatchaInlineNotice } from '@/components/katchadeck/ui/katcha-inline-notice';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSurfaceProvider } from '@/components/katchadeck/ui/katcha-surface';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  MERGE_GENERATORS_BY_ID,
  MERGE_ITEMS_BY_ID,
  MERGE_CHARACTER_NAMES,
} from '@/constants/merge-world-catalog';
import { mossproutWorldChapterForActiveDays } from '@/constants/mossprout-world-chapters';
import { mergeWorldGeneratorArt } from '@/constants/merge-world-art';
import { MEMORY_CARDS_BY_ID } from '@/constants/memory-card-catalog';
import { RARE_MEMORY_CARD_REVEAL_ART, VEILED_MEMORY_CARD_ART, memoryCardArt } from '@/constants/memory-card-art';
import { COMPANION_DISCOVERY_CATALOG } from '@/constants/companion-discovery-catalog';
import { Lantern } from '@/constants/theme';
import { useMergeWorldActions, useMergeWorldLastResult, useMergeWorldState } from '@/features/merge-world/merge-world-provider';
import { commitFtueAction, dispatchFtueEvent, registerFtueObjectiveBaseline, repairFtueStep, useFtueRun } from '@/features/onboarding/ftue-runtime';
import { MOSSPROUT_FTUE_RETURN_NOTE_ID, mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import { mergeFtueAllowsChatNote, mergeFtueAllowsCommand, mergeFtueBoardGate, mergeFtueEventForCommand, mergeFtueRailGate, mergeFtueRepairTarget, mergeFtueStepEntryBaseline, recoverMergeFtueEvent } from '@/features/onboarding/merge-ftue';
import type { FtueCueDefinition, FtueSpotlightDefinition } from '@/features/onboarding/ftue-types';
import { useGameFeedback } from '@/features/ui/game-feedback-provider';
import { GameUI } from '@/constants/game-ui';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { KatchaUI } from '@/constants/katcha-ui';
import {
  createMergeBoardSession,
  mergeFtueInteractionKey,
  MergeFtueInteractionCoordinator,
} from '@/features/onboarding/merge-ftue-interaction-coordinator';
import type { MergeCharacterId, MergeOrder, MergeWorldCommand } from '@/types/merge-world';
import { mergeCellCenter } from '@/utils/merge-world/board-geometry';
import { mergeOrderItemReadiness, mergeOrderServingCells, readyMergeOrderIds } from '@/utils/merge-world/engine';
import { isMossproutChapterZeroActive } from '@/utils/merge-world/chapter-zero-policy';
import { beginAuthoredCohortReturn, beginFeastleReturn, isAuthoredCohortFamily, loadAuthoredCohortStory, loadFeastleStory, subscribeCompanionStories } from '@/utils/companion-story-storage';
import { useGameScreenTransition, useGameSurfaceReadiness } from '@/features/navigation/game-screen-transition';
import { beginCriticalInteractionWork } from '@/utils/critical-interaction';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import { beginMossproutJourneyReturn, mossproutJourneyForDay, recordMossproutFirstGardenRestored, startMossproutJourneyDay } from '@/game/katchimeras/relationship-progression';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';
import { familyIdFromCompanionId } from '@/constants/katchimera-skins';
import { localDayId } from '@/utils/world-identity';

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
  const { creatureId, focusOrderId } = useLocalSearchParams<{ creatureId?: string; focusOrderId?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { state, loading, error } = useMergeWorldState();
  const { dispatch: send } = useMergeWorldActions();
  const ftueRun = useFtueRun();
  const ftueStep = ftueRun?.status === 'active' ? mossproutFtueStep(ftueRun.stepId) : null;
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [inspectedCell, setInspectedCell] = useState<number | null>(null);
  const [revealedMemoryCardId, setRevealedMemoryCardId] = useState<string | null>(null);
  const [boardAreaHeight, setBoardAreaHeight] = useState(0);
  const [story, setStory] = useState(loadFeastleStory);
  const relationships = useRelationshipProgression();
  const mossproutJourney = mossproutJourneyForDay(relationships, localDayId());
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
  const interactionSessionKey = mergeFtueInteractionKey(ftueRun, active);
  const contentWidth = Math.min(width - 12, 600);
  const contentLeft = Math.max(0, (width - contentWidth) / 2);
  const companionHeaderLeftInset = Math.max(0, KatchaUI.layout.phoneGutter - contentLeft);
  const flowReady = !loading && state != null;
  useGameSurfaceReadiness('merge', {
    background: backgroundReady,
    data: flowReady,
    foreground: boardMetrics != null,
    layout: screenLayoutNonce > 0 && boardAreaHeight > 0,
  }, active);
  const ftueExclusive = ftueStep?.surface === 'merge' && ftueStep.interaction?.mode === 'exclusive';
  const readyOrderIds = useMemo(() => state ? readyMergeOrderIds(state) : new Set<string>(), [state]);
  const ftueBoardGate = useMemo(() => state ? mergeFtueBoardGate(ftueStep, state) : { kind: 'open' as const }, [ftueStep, state]);
  const ftueRailGate = useMemo(() => mergeFtueRailGate(ftueStep), [ftueStep]);
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
      const nextRun = dispatchFtueEvent({ type: 'chat_note_opened', noteId, revision: state?.revision ?? 0 });
      if (nextRun?.stepId !== 'companion.chapter_zero_return') return;
      storyNavigationPendingRef.current = true;
      transitionTo({
        announcement: 'Opening Mossprout',
        target: 'companion',
        navigate: () => router.push({
          pathname: '/katchimera/[creatureId]',
          params: { creatureId: 'companion:mossprout', ftue: 'chapter-zero-return', source: 'merge-world' },
        }),
      });
      return;
    }
    storyNavigationPendingRef.current = true;
    if (characterId === 'feastle') beginFeastleReturn();
    else if (characterId === 'mossprout') {
      relationshipProgressionRepository.update((current) => beginMossproutJourneyReturn(current, localDayId()));
    }
    else if (isAuthoredCohortFamily(characterId)) beginAuthoredCohortReturn(characterId);
    else setReturnCharacterId((current) => current === characterId ? null : current);
    transitionTo({
      announcement: 'Opening your Katchimera',
      target: 'companion',
      navigate: () => router.push({
        pathname: '/katchimera/[creatureId]',
        params: { creatureId: `companion:${characterId}`, source: 'merge-world', story: 'return' },
      }),
    });
  }, [active, ftueStep, router, state?.revision, transitionTo]);

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
    router.push({ pathname: '/katchimera/[creatureId]', params: { creatureId: 'companion:mossprout' } });
  }, [active, ftueRun?.status, ftueRun?.stepId, router]);

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
    const next = commitFtueAction({ actionId: 'merge.tell_me_more' });
    if (next?.stepId !== 'energy.capture') return;
    transitionTo({
      announcement: 'Returning to Today',
      target: 'today',
      navigate: () => router.navigate({ pathname: '/today', params: { onboardingCapture: '1' } }),
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
    && (arrival.kind === 'discovery_parcel' || arrival.kind === 'root_match_parcel' || arrival.kind === 'contextual_parcel' || arrival.kind === 'goal_chest')
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
    const returnEntries: MergeTrayEntry[] = chapterZeroActive ? [] : [
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
      ...(mossproutJourney?.status === 'return_available' ? [{
        id: `chat-note:mossprout:${mossproutJourney.dayId}:${mossproutJourney.beatId}`,
        kind: 'chat_note' as const,
        characterId: 'mossprout' as const,
        bondPoints: 0,
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
    const visibleOrders = chapterZeroActive ? chapterZeroOrders.slice(0, 1) : state.activeOrders;
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
    const parcelEntries: MergeTrayEntry[] = !chapterZeroActive && pendingParcel ? [{
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
  }, [active, authoredStories, focusOrderId, ftueStep?.id, mossproutJourney?.beatId, mossproutJourney?.dayId, mossproutJourney?.status, parcelFlight, parcelShakeNonce, pendingParcel, pendingParcels.length, readyOrderIds, returnCharacterId, serveFlight, state, story.id, story.pendingBondPoints, story.status, story.targetLevel]);

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
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const measureBoardArea = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.height);
    setBoardAreaHeight((current) => current === next ? current : next);
  }, []);

  if (loading || !state) {
    return <View style={styles.loading}><ActivityIndicator color={Lantern.ember300} size="large" /><ThemedText darkColor="#FFF0CE">Opening the pantry…</ThemedText></View>;
  }

  const activeGardenDays = state.mossproutBoardProgression.activeDayIds.length;
  const worldChapter = mossproutWorldChapterForActiveDays(activeGardenDays);
  const chapterRatio = Math.max(0, Math.min(1,
    (Math.max(1, activeGardenDays) - worldChapter.firstActiveDay + 1)
      / (worldChapter.finalActiveDay - worldChapter.firstActiveDay + 1),
  ));
  return (
    <View onLayout={() => setScreenLayoutNonce((nonce) => nonce + 1)} ref={screenRef} style={styles.screen}>
      <MergeCommandFeedback />
      <View style={[styles.game, { paddingTop: Math.max(insets.top + 3, 7), paddingBottom: Math.max(insets.bottom + 3, 7), width: contentWidth }]}>
        {!ftueExclusive && creatureId ? <KatchimeraPageHeader
          creatureId={creatureId}
          includeSafeArea={false}
          onBack={() => router.back()}
          onOpenCards={() => router.push({ pathname: '/katchimera/[creatureId]/cards', params: { creatureId } })}
          onOpenTrophies={() => router.push({ pathname: '/katchimera/[creatureId]/achievements', params: { creatureId } })}
        /> : null}
        <GameHudBar
          density="compact"
          leading={ftueExclusive || !creatureId ? <KatchimeraBackButton
            accessibilityLabel={creatureId ? 'Return to Mossprout' : 'Open legacy games'}
            onPress={() => ftueExclusive ? handleBlockedFtueInteraction() : creatureId ? router.back() : router.push('/legacy-games')}
          /> : undefined}
          style={[styles.hudBar, { paddingLeft: companionHeaderLeftInset }]}
          tone="glass"
          trailing={<>
            <GameHudItem accessibilityLabel={`Mossprout chapter ${worldChapter.number}: ${worldChapter.title}`} style={styles.levelPill} tone="glass">
              <IconSymbol color={GameUI.color.goldStrong} name="leaf.fill" size={14} />
              <ThemedText numberOfLines={1} style={styles.levelValue} lightColor={GameUI.color.ink} darkColor={GameUI.color.ink}>{worldChapter.title}</ThemedText>
              <View pointerEvents="none" style={styles.levelTrack}><View style={[styles.levelFill, { width: `${chapterRatio * 100}%` }]} /></View>
            </GameHudItem>
            <GameCurrencyHud balances={[
              {
                animateValue: presentedCoins != null,
                art: GAME_CURRENCY_ART.coins,
                id: 'coins',
                pulseNonce: coinPulseNonce,
                targetRef: coinHudRef,
                value: presentedCoins ?? state.coins,
                valueAnimationDurationMs: coinValueAnimationDurationMs,
              },
            ]} style={styles.currencyHud} tone="glass" />
          </>}
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
        cue={active && !serveFlight ? mergeGuidanceCue : null}
        layoutNonce={screenLayoutNonce}
        screenRef={screenRef}
        railTargetRefs={railTargetRefs}
        state={state}
        spotlight={active && !serveFlight ? mergeGuidanceSpotlight : null}
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
      {active && mergeCelebrationRewards.length ? <RewardSplash
        items={mergeCelebrationRewards}
        onItemSeen={(receiptId) => receiptId.startsWith('companion-discovery:')
          ? dispatch({ type: 'ackCompanionDiscoveryReveal', characterId: receiptId.slice('companion-discovery:'.length) as MergeOrder['characterId'], now: Date.now() })
          : dispatch({ type: 'ackGeneratorUnlock', receiptId, now: Date.now() })}
      /> : null}
    </View>
  );
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
  levelPill: { gap: 3, minWidth: 48, overflow: 'hidden', paddingHorizontal: 7 },
  levelValue: { ...GameUI.type.numeric, fontSize: 13 },
  levelTrack: { backgroundColor: 'rgba(68,51,31,0.12)', bottom: 0, height: 2.5, left: 8, overflow: 'hidden', position: 'absolute', right: 8 },
  levelFill: { backgroundColor: GameUI.color.gold, height: 2.5 },
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
