import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { RewardSplash, type RewardSplashItem } from '@/components/katchadeck/ui/reward-splash';
import { GameCurrencyHud } from '@/components/katchadeck/ui/game-currency-hud';
import { GameHudBar, GameHudControl, GameHudItem } from '@/components/katchadeck/ui/game-primitives';
import { KatchaInlineNotice } from '@/components/katchadeck/ui/katcha-inline-notice';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSurfaceProvider } from '@/components/katchadeck/ui/katcha-surface';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  MERGE_GENERATORS_BY_ID,
  MERGE_LEVEL_THRESHOLDS,
} from '@/constants/merge-world-catalog';
import { mergeWorldGeneratorArt } from '@/constants/merge-world-art';
import { Lantern } from '@/constants/theme';
import { useMergeWorld } from '@/features/merge-world/merge-world-provider';
import { commitFtueAction, dispatchFtueEvent, registerFtueObjectiveBaseline, repairFtueStep, useFtueRun } from '@/features/onboarding/ftue-runtime';
import { MOSSPROUT_FTUE_RETURN_NOTE_ID, mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import { mergeFtueAllowsChatNote, mergeFtueAllowsCommand, mergeFtueBoardGate, mergeFtueEventForCommand, mergeFtueRailGate, mergeFtueRepairTarget, mergeFtueStepEntryBaseline, recoverMergeFtueEvent } from '@/features/onboarding/merge-ftue';
import { useGameFeedback } from '@/features/ui/game-feedback-provider';
import { useGameWallet } from '@/features/ui/game-wallet-provider';
import { GameUI } from '@/constants/game-ui';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import type { MergeOrder, MergeWorldCommand } from '@/types/merge-world';
import { markFlowStart, reportFlowReady } from '@/utils/flow-performance';
import { mergeCellCenter } from '@/utils/merge-world/board-geometry';
import { mergeOrderEnergyRefund, mergeOrderItemReadiness, mergeOrderServingCells, readyMergeOrderIds } from '@/utils/merge-world/engine';
import { MERGE_ENERGY_REGEN_MS } from '@/utils/merge-world/economy-policy';
import { beginAuthoredCohortReturn, beginFeastleReturn, beginMossproutReturn, isAuthoredCohortFamily, loadAuthoredCohortStory, loadFeastleStory, loadMossproutStory, subscribeCompanionStories } from '@/utils/companion-story-storage';
import { useGameScreenTransition, useGameSurfaceReadiness } from '@/features/navigation/game-screen-transition';

import { FeastlePersistentMergeBoard, type MergeBoardScreenMetrics } from './feastle-persistent-merge-board';
import { MergeParcelFlightOverlay, type MergeParcelFlight } from './merge-parcel-overlay';
import { MergeOrderRail, type MergeTrayEntry } from './merge-order-rail';
import { MergeServeRewardOverlay, type MergeScreenPoint, type MergeServeRewardFlight } from './merge-serve-reward-overlay';
import { MergeFtueOverlay } from './merge-ftue-overlay';

export function MergeWorldScreen({ active = true, backgroundReady = true, effectsPaused, playBoardEntrance = true }: { active?: boolean; backgroundReady?: boolean; effectsPaused?: SharedValue<number>; playBoardEntrance?: boolean } = {}) {
  const router = useRouter();
  const { transitionTo } = useGameScreenTransition();
  const { focusOrderId } = useLocalSearchParams<{ focusOrderId?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { state, loading, error, lastResult, dispatch: send } = useMergeWorld();
  const ftueRun = useFtueRun();
  const ftueStep = ftueRun?.status === 'active' ? mossproutFtueStep(ftueRun.stepId) : null;
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [boardAreaHeight, setBoardAreaHeight] = useState(0);
  const feedback = useGameFeedback();
  const wallet = useGameWallet();
  const [story, setStory] = useState(loadFeastleStory);
  const [mossproutStory, setMossproutStory] = useState(loadMossproutStory);
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
  const [presentedEnergy, setPresentedEnergy] = useState<number | null>(null);
  const [presentedCoins, setPresentedCoins] = useState<number | null>(null);
  const [energyPulseNonce, setEnergyPulseNonce] = useState(0);
  const [coinPulseNonce, setCoinPulseNonce] = useState(0);
  const [energyClockNow, setEnergyClockNow] = useState(Date.now);
  const [blockedFtuePulseNonce, setBlockedFtuePulseNonce] = useState(0);
  const [boardMetrics, setBoardMetrics] = useState<MergeBoardScreenMetrics | null>(null);
  const [ftueTargetRevision, setFtueTargetRevision] = useState(0);
  const [screenLayoutNonce, setScreenLayoutNonce] = useState(0);
  const screenRef = useRef<View>(null);
  const energyHudRef = useRef<View>(null);
  const coinHudRef = useRef<View>(null);
  const boardMetricsRef = useRef<MergeBoardScreenMetrics | null>(null);
  const railTargetRefs = useRef(new Map<string, View>());
  const parcelRef = useRef<View>(null);
  const activeServeRef = useRef(false);
  const activeParcelRef = useRef(false);
  const activeServeOrderRef = useRef<{ coinAmount: number; energyAmount: number; orderId: string } | null>(null);
  const serveNonceRef = useRef(0);
  const parcelNonceRef = useRef(0);
  const storyNavigationPendingRef = useRef(false);
  const ftuePreviewNavigationPendingRef = useRef(false);
  const contentWidth = Math.min(width - 12, 600);
  const flowReady = !loading && state != null;
  useGameSurfaceReadiness('merge', {
    background: backgroundReady,
    data: flowReady,
    foreground: boardMetrics != null,
    layout: screenLayoutNonce > 0 && boardAreaHeight > 0,
  }, active);
  const ftueExclusive = ftueStep?.surface === 'merge' && ftueStep.interaction?.mode === 'exclusive';
  const shouldTickEnergyClock = active && state != null && !state.energy.regenPaused && state.energy.value < state.energy.regenCap;
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
      return [{
        id: receipt.id,
        eyebrow: 'New generator unlocked',
        title: generator.name,
        description: generator.unlockDescription,
        image: art,
        imageAccessibilityLabel: generator.name,
        detail: 'A new merge chain is ready',
        rewardTitle: 'Placed on your Merge board',
        rewardBody: 'Tap it whenever you want to make something new.',
        tint: generator.color,
        tier: 2,
      }];
    }), [state?.generatorUnlockReceipts]);

  useEffect(() => subscribeCompanionStories(() => {
    setStory(loadFeastleStory());
    setMossproutStory(loadMossproutStory());
    setAuthoredStories({
      baristabbit: loadAuthoredCohortStory('baristabbit'),
      steppling: loadAuthoredCohortStory('steppling'),
      voyagle: loadAuthoredCohortStory('voyagle'),
      flexel: loadAuthoredCohortStory('flexel'),
      bedrotte: loadAuthoredCohortStory('bedrotte'),
    });
  }), []);

  useEffect(() => {
    if (!shouldTickEnergyClock) return;
    setEnergyClockNow(Date.now());
    const timer = setInterval(() => setEnergyClockNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [shouldTickEnergyClock]);

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
    else if (characterId === 'mossprout') beginMossproutReturn();
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
    markFlowStart('merge-world');
  }, []);

  useEffect(() => {
    if (!active || ftueRun?.status !== 'active' || ftueRun.stepId !== 'companion.order_preview' || ftuePreviewNavigationPendingRef.current) return;
    ftuePreviewNavigationPendingRef.current = true;
    router.push({ pathname: '/katchimera/[creatureId]', params: { creatureId: 'companion:mossprout' } });
  }, [active, ftueRun?.status, ftueRun?.stepId, router]);

  useEffect(() => {
    if (!flowReady) return;
    return reportFlowReady('merge-world');
  }, [flowReady]);

  useEffect(() => {
    if (!lastResult) return;
    if (lastResult.failureReason) return;
    const message = lastResult.spawnedCell != null ? null : lastResult.message ?? null;
    if (message) feedback.show({ id: `merge:${lastResult.state.revision}:${message}`, message });
  }, [feedback, lastResult]);

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
    const recovered = recoverMergeFtueEvent(ftueStep, state, ftueRun.objectiveProgress);
    if (!recovered) return;
    dispatchFtueEvent(recovered, `merge-recovery:${state.revision}`);
  }, [active, ftueRun, ftueStep, state]);

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
    if (!state) return null;
    if (!mergeFtueAllowsCommand(ftueStep, state, command)) {
      handleBlockedFtueInteraction();
      return null;
    }
    const result = send(command);
    const event = mergeFtueEventForCommand(state, command, result);
    if (event) dispatchFtueEvent(event);
    return result;
  }, [ftueStep, handleBlockedFtueInteraction, send, state]);
  const pendingParcels = useMemo(() => state?.arrivals.filter((arrival) => (
    arrival.claimedAt == null
    && arrival.kind !== 'memory_arrival'
    && arrival.itemDefinitionIds.length > 0
  )) ?? [], [state?.arrivals]);
  const pendingParcel = pendingParcels[0] ?? null;

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
      ...(mossproutStory.status === 'return_available' ? [{
        id: `chat-note:${mossproutStory.id}:${mossproutStory.targetLevel}`,
        kind: 'chat_note' as const,
        characterId: 'mossprout' as const,
        bondPoints: mossproutStory.pendingBondPoints,
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
  }, [active, authoredStories, focusOrderId, ftueStep?.id, mossproutStory.id, mossproutStory.pendingBondPoints, mossproutStory.status, mossproutStory.targetLevel, parcelFlight, parcelShakeNonce, pendingParcel, pendingParcels.length, readyOrderIds, returnCharacterId, serveFlight, state, story.id, story.pendingBondPoints, story.status, story.targetLevel]);

  const startServeAnimation = useCallback(async (order: MergeOrder, itemTargets: readonly MergeScreenPoint[]) => {
    if (!state || activeServeRef.current || activeParcelRef.current || parcelFlight) return false;
    activeServeRef.current = true;
    const boardMetrics = boardMetricsRef.current;
    const servingItems = mergeOrderServingCells(state, order);
    const [screenRect, coinRect, energyRect] = await Promise.all([
      measureViewInWindow(screenRef),
      measureViewInWindow(coinHudRef),
      measureViewInWindow(energyHudRef),
    ]);
    if (!boardMetrics || !screenRect || !coinRect || !energyRect || servingItems.length !== itemTargets.length) {
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
    const energyTo = { x: energyRect.x - screenRect.x + energyRect.width / 2, y: energyRect.y - screenRect.y + energyRect.height / 2 };
    serveNonceRef.current += 1;
    activeServeOrderRef.current = {
      coinAmount: order.reward.coins,
      energyAmount: mergeOrderEnergyRefund(order),
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
    setPresentedEnergy(state.energy.value);
    setPresentedCoins(state.coins);
    setServeFlight((current) => current ? { ...current, energyAmount: activeOrder.energyAmount, phase: 'rewards' } : null);
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [readyOrderIds, state]);

  const handleCoinArrive = useCallback((amount: number) => {
    setPresentedCoins((current) => current == null ? amount : current + amount);
    setCoinPulseNonce((current) => current + 1);
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleEnergyArrive = useCallback((amount: number) => {
    setPresentedEnergy((current) => current == null ? amount : current + amount);
    setEnergyPulseNonce((current) => current + 1);
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const finishServeAnimation = useCallback(() => {
    const activeOrder = activeServeOrderRef.current;
    if (!activeOrder) return;
    const servedOrder = state?.activeOrders.find((order) => order.id === activeOrder.orderId);
    const result = dispatch({ type: 'serveOrder', orderId: activeOrder.orderId, now: Date.now() });
    if (result?.changed && servedOrder?.signature && servedOrder.characterId !== 'feastle' && servedOrder.characterId !== 'mossprout' && !isAuthoredCohortFamily(servedOrder.characterId)) {
      setReturnCharacterId(servedOrder.characterId);
    }
    setPresentedEnergy(null);
    setPresentedCoins(null);
    if (!result?.changed) setServeHiddenItemIds(new Set());
    setServeFlight(null);
    activeServeRef.current = false;
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
    setParcelFlight({ nonce: parcelNonceRef.current, from, items });
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

  const nextThreshold = MERGE_LEVEL_THRESHOLDS[state.mergeLevel] ?? null;
  const currentThreshold = MERGE_LEVEL_THRESHOLDS[state.mergeLevel - 1] ?? 0;
  const levelRatio = nextThreshold == null ? 1 : Math.max(0, Math.min(1, (state.mergeXp - currentThreshold) / (nextThreshold - currentThreshold)));
  const energyCountdownSeconds = !state.energy.regenPaused && state.energy.value < state.energy.regenCap
    ? Math.max(1, Math.ceil((MERGE_ENERGY_REGEN_MS - ((energyClockNow - state.energy.lastRegenAt) % MERGE_ENERGY_REGEN_MS)) / 1_000))
    : null;
  return (
    <View onLayout={() => setScreenLayoutNonce((nonce) => nonce + 1)} ref={screenRef} style={styles.screen}>
      <View style={[styles.game, { paddingTop: Math.max(insets.top + 3, 7), paddingBottom: Math.max(insets.bottom + 3, 7), width: contentWidth }]}>
        <GameHudBar
          content={<GameCurrencyHud balances={[
            { art: GAME_CURRENCY_ART.energy, countdownSeconds: energyCountdownSeconds ?? undefined, id: 'energy', pulseNonce: energyPulseNonce, suffix: `/${state.energy.regenCap}`, targetRef: energyHudRef, value: presentedEnergy ?? state.energy.value },
            { art: GAME_CURRENCY_ART.coins, id: 'coins', pulseNonce: coinPulseNonce, targetRef: coinHudRef, value: presentedCoins ?? state.coins },
            { id: 'gems', value: wallet.gems },
          ]} style={styles.currencyHud} tone="glass" />}
          density="compact"
          tone="glass"
          trailing={<>
            <GameHudItem accessibilityLabel={`Merge level ${state.mergeLevel}`} style={styles.levelPill} tone="glass">
              <IconSymbol color={GameUI.color.goldStrong} name="star.fill" size={14} />
              <ThemedText selectable style={styles.levelValue} lightColor={GameUI.color.ink} darkColor={GameUI.color.ink}>{state.mergeLevel}</ThemedText>
              <View pointerEvents="none" style={styles.levelTrack}><View style={[styles.levelFill, { width: `${levelRatio * 100}%` }]} /></View>
            </GameHudItem>
            <GameHudControl accessibilityLabel="Open legacy games" onPress={() => ftueExclusive ? handleBlockedFtueInteraction() : router.push('/legacy-games')} style={styles.hudAction} tone="glass">
              <IconSymbol color={GameUI.color.ink} name="gamecontroller.fill" size={18} />
            </GameHudControl>
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
              effectsPaused={effectsPaused}
              hiddenItemInstanceIds={hiddenAnimatedItemIds}
              interactionGate={ftueBoardGate}
              interactionSessionKey={`${ftueRun?.runId ?? 'free'}:${ftueStep?.id ?? 'open'}:${active ? 'active' : 'inactive'}`}
              maxHeight={boardAreaHeight - 1}
              onBlockedInteraction={handleBlockedFtueInteraction}
              onCommand={dispatch}
              onHiddenItemsRetired={handleHiddenItemsRetired}
              onSelect={setSelectedCell}
              onScreenMetrics={handleBoardScreenMetrics}
              selectedCell={selectedCell}
              state={state}
              width={contentWidth}
            /> : null}
            {parcelFlight ? <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.boardInteractionShield} /> : null}
          </View>
        </View>

      </View>

      <MergeFtueOverlay
        blockedPulseNonce={blockedFtuePulseNonce}
        boardMetrics={boardMetrics}
        cue={active && !serveFlight ? ftueStep?.cue ?? null : null}
        layoutNonce={screenLayoutNonce}
        screenRef={screenRef}
        railTargetRefs={railTargetRefs}
        state={state}
        spotlight={active && !serveFlight ? ftueStep?.spotlight ?? null : null}
        targetRevision={ftueTargetRevision}
      />

      {active && ftueStep?.id === 'merge.energy_exhausted' ? (
        <View style={[styles.energyConnectionOverlay, { bottom: Math.max(insets.bottom + 20, 28) }]}>
          <ThemedText style={styles.energyConnectionEyebrow} lightColor="#FFD36A" darkColor="#FFD36A">MOSSPROUT NOTICED</ThemedText>
          <ThemedText selectable style={styles.energyConnectionTitle} lightColor="#FFF8E8" darkColor="#FFF8E8">“Oh… we’re running out of that strange energy.”</ThemedText>
          <ThemedText selectable style={styles.energyConnectionBody} lightColor="rgba(255,248,232,0.82)" darkColor="rgba(255,248,232,0.82)">“Wait. It got stronger when you told me about your day.”</ThemedText>
          <KatchaButton fullWidth glow label="Tell me something else" onPress={openFtueEnergyCapture} />
        </View>
      ) : null}

      {error ? <KatchaSurfaceProvider surface="parchment"><View style={[styles.errorBanner, { top: Math.max(insets.top + 56, 64) }]}><KatchaInlineNotice body={error} title="Merge paused" tone="danger" /></View></KatchaSurfaceProvider> : null}
      <MergeServeRewardOverlay flight={serveFlight} onCoinArrive={handleCoinArrive} onEnergyArrive={handleEnergyArrive} onFinish={finishServeAnimation} onItemsArrive={handleServeItemsArrive} />
      <MergeParcelFlightOverlay flight={parcelFlight} onFinish={finishParcelFlight} onItemArrive={handleParcelItemArrive} />
      {active && generatorUnlockRewards.length ? <RewardSplash
        items={generatorUnlockRewards}
        onItemSeen={(receiptId) => dispatch({ type: 'ackGeneratorUnlock', receiptId, now: Date.now() })}
      /> : null}
    </View>
  );
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
  currencyHud: { flex: 1 },
  levelPill: { gap: 3, minWidth: 48, overflow: 'hidden', paddingHorizontal: 7 },
  levelValue: { ...GameUI.type.numeric, fontSize: 13 },
  levelTrack: { backgroundColor: 'rgba(68,51,31,0.12)', bottom: 0, height: 2.5, left: 8, overflow: 'hidden', position: 'absolute', right: 8 },
  levelFill: { backgroundColor: GameUI.color.gold, height: 2.5 },
  hudAction: { paddingHorizontal: 0, width: 38 },
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
  energyConnectionOverlay: { alignSelf: 'center', backgroundColor: 'rgba(31,24,45,0.9)', borderColor: 'rgba(255,226,151,0.5)', borderCurve: 'continuous', borderRadius: 24, borderWidth: 1, boxShadow: '0 12px 30px rgba(24,14,34,0.42)', gap: 8, left: 18, maxWidth: 430, padding: 18, position: 'absolute', right: 18, zIndex: GameUI.layer.modal },
  energyConnectionEyebrow: { ...GameUI.type.label, fontSize: 11, letterSpacing: 1.4, textAlign: 'center' },
  energyConnectionTitle: { ...GameUI.type.title, fontSize: 19, lineHeight: 24, textAlign: 'center' },
  energyConnectionBody: { ...GameUI.type.body, fontSize: 14, lineHeight: 20, paddingBottom: 4, textAlign: 'center' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
