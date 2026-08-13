import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { RewardSplash, type RewardSplashItem } from '@/components/katchadeck/ui/reward-splash';
import { GameCurrencyHud } from '@/components/katchadeck/ui/game-currency-hud';
import { GameHudBar, GameHudControl, GameHudItem } from '@/components/katchadeck/ui/game-primitives';
import { KatchaInlineNotice } from '@/components/katchadeck/ui/katcha-inline-notice';
import { KatchaSurfaceProvider } from '@/components/katchadeck/ui/katcha-surface';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  MERGE_GENERATORS_BY_ID,
  MERGE_LEVEL_THRESHOLDS,
} from '@/constants/merge-world-catalog';
import { mergeWorldGeneratorArt } from '@/constants/merge-world-art';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import { useMergeWorld } from '@/features/merge-world/merge-world-provider';
import { useGameFeedback } from '@/features/ui/game-feedback-provider';
import { useGameWallet } from '@/features/ui/game-wallet-provider';
import { GameUI } from '@/constants/game-ui';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import type { MergeOrder, MergeWorldCommand } from '@/types/merge-world';
import { markFlowStart, reportFlowReady } from '@/utils/flow-performance';
import { mergeCellCenter } from '@/utils/merge-world/board-geometry';
import { availableExpansion, mergeOrderEnergyRefund, mergeOrderItemReadiness, mergeOrderServingCells, readyMergeOrderIds } from '@/utils/merge-world/engine';
import { MERGE_ENERGY_REGEN_MS } from '@/utils/merge-world/economy-policy';
import { beginAuthoredCohortReturn, beginFeastleReturn, isAuthoredCohortFamily, loadAuthoredCohortStory, loadFeastleStory, subscribeCompanionStories } from '@/utils/companion-story-storage';

import { FeastlePersistentMergeBoard, type MergeBoardScreenMetrics } from './feastle-persistent-merge-board';
import { MergeParcelFlightOverlay, type MergeParcelFlight } from './merge-parcel-overlay';
import { MergeOrderRail, type MergeTrayEntry } from './merge-order-rail';
import { MergeServeRewardOverlay, type MergeScreenPoint, type MergeServeRewardFlight } from './merge-serve-reward-overlay';

export function MergeWorldScreen({ active = true, effectsPaused }: { active?: boolean; effectsPaused?: SharedValue<number> } = {}) {
  const router = useRouter();
  const { focusOrderId } = useLocalSearchParams<{ focusOrderId?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { state, loading, error, lastResult, dispatch: send } = useMergeWorld();
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [boardAreaHeight, setBoardAreaHeight] = useState(0);
  const feedback = useGameFeedback();
  const wallet = useGameWallet();
  const [story, setStory] = useState(loadFeastleStory);
  const [authoredStories, setAuthoredStories] = useState(() => ({
    baristabbit: loadAuthoredCohortStory('baristabbit'),
    steppling: loadAuthoredCohortStory('steppling'),
    voyagle: loadAuthoredCohortStory('voyagle'),
    flexel: loadAuthoredCohortStory('flexel'),
    bedrotte: loadAuthoredCohortStory('bedrotte'),
  }));
  const [returnCharacterId, setReturnCharacterId] = useState<MergeOrder['characterId'] | null>(null);
  const [serveFlight, setServeFlight] = useState<MergeServeRewardFlight | null>(null);
  const [parcelFlight, setParcelFlight] = useState<MergeParcelFlight | null>(null);
  const [parcelHiddenItemIds, setParcelHiddenItemIds] = useState<Set<string>>(() => new Set());
  const [parcelShakeNonce, setParcelShakeNonce] = useState(0);
  const [presentedEnergy, setPresentedEnergy] = useState<number | null>(null);
  const [presentedCoins, setPresentedCoins] = useState<number | null>(null);
  const [energyPulseNonce, setEnergyPulseNonce] = useState(0);
  const [coinPulseNonce, setCoinPulseNonce] = useState(0);
  const [energyClockNow, setEnergyClockNow] = useState(Date.now);
  const screenRef = useRef<View>(null);
  const energyHudRef = useRef<View>(null);
  const coinHudRef = useRef<View>(null);
  const boardMetricsRef = useRef<MergeBoardScreenMetrics | null>(null);
  const parcelRef = useRef<View>(null);
  const activeServeRef = useRef(false);
  const activeParcelRef = useRef(false);
  const activeServeOrderRef = useRef<{ coinAmount: number; energyAmount: number; orderId: string } | null>(null);
  const serveNonceRef = useRef(0);
  const parcelNonceRef = useRef(0);
  const storyNavigationPendingRef = useRef(false);
  const contentWidth = Math.min(width - 12, 600);
  const flowReady = !loading && state != null;
  const shouldTickEnergyClock = active && state != null && state.energy.value < state.energy.regenCap;
  const readyOrderIds = useMemo(() => state ? readyMergeOrderIds(state) : new Set<string>(), [state]);
  const hiddenAnimatedItemIds = useMemo(() => new Set([
    ...(serveFlight?.items.map((item) => item.instanceId) ?? []),
    ...parcelHiddenItemIds,
  ]), [parcelHiddenItemIds, serveFlight]);
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

  const openCharacterReturn = useCallback((characterId: MergeOrder['characterId']) => {
    if (!active || storyNavigationPendingRef.current) return;
    storyNavigationPendingRef.current = true;
    if (characterId === 'feastle') beginFeastleReturn();
    else if (isAuthoredCohortFamily(characterId)) beginAuthoredCohortReturn(characterId);
    else setReturnCharacterId((current) => current === characterId ? null : current);
    router.push({
      pathname: '/katchimera/[creatureId]',
      params: { creatureId: `companion:${characterId}`, source: 'merge-world', story: 'return' },
    });
  }, [active, router]);

  useEffect(() => {
    markFlowStart('merge-world');
  }, []);

  useEffect(() => {
    if (!flowReady) return;
    return reportFlowReady('merge-world');
  }, [flowReady]);

  useEffect(() => {
    if (!lastResult) return;
    const message = lastResult.spawnedCell != null ? null : lastResult.message ?? null;
    if (message) feedback.show({ id: `merge:${lastResult.state.revision}:${message}`, message });
  }, [feedback, lastResult]);

  const dispatch = useCallback((command: MergeWorldCommand) => send(command), [send]);
  const pendingParcels = useMemo(() => state?.arrivals.filter((arrival) => (
    arrival.claimedAt == null
    && arrival.kind !== 'memory_arrival'
    && arrival.itemDefinitionIds.length > 0
  )) ?? [], [state?.arrivals]);
  const pendingParcel = pendingParcels[0] ?? null;

  const trayEntries = useMemo<MergeTrayEntry[]>(() => {
    if (!state) return [];
    const featured = state.favouriteCharacterId;
    const returnEntries: MergeTrayEntry[] = [
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
    const prioritizedOrders = state.activeOrders
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
    const parcelEntries: MergeTrayEntry[] = pendingParcel ? [{
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
  }, [active, authoredStories, focusOrderId, parcelFlight, parcelShakeNonce, pendingParcel, pendingParcels.length, readyOrderIds, returnCharacterId, serveFlight, state, story.id, story.pendingBondPoints, story.status, story.targetLevel]);

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
    if (result?.changed && servedOrder?.signature && servedOrder.characterId !== 'feastle' && !isAuthoredCohortFamily(servedOrder.characterId)) {
      setReturnCharacterId(servedOrder.characterId);
    }
    setPresentedEnergy(null);
    setPresentedCoins(null);
    setServeFlight(null);
    activeServeRef.current = false;
    activeServeOrderRef.current = null;
  }, [dispatch, state?.activeOrders]);
  const handleBoardScreenMetrics = useCallback((metrics: MergeBoardScreenMetrics) => {
    boardMetricsRef.current = metrics;
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
  const expansion = availableExpansion(state);
  const expansionReady = Boolean(expansion && state.mergeLevel >= expansion.requiredLevel && state.coins >= expansion.coinCost);
  const energyCountdownSeconds = state.energy.value < state.energy.regenCap
    ? Math.max(1, Math.ceil((MERGE_ENERGY_REGEN_MS - ((energyClockNow - state.energy.lastRegenAt) % MERGE_ENERGY_REGEN_MS)) / 1_000))
    : null;
  return (
    <View ref={screenRef} style={styles.screen}>
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
            <GameHudControl accessibilityLabel="Open legacy games" onPress={() => router.push('/legacy-games')} style={styles.hudAction} tone="glass">
              <IconSymbol color={GameUI.color.ink} name="gamecontroller.fill" size={18} />
            </GameHudControl>
          </>}
        />
        <View style={styles.mergeArea}>
          <MergeOrderRail
            entries={trayEntries}
            focusOrderId={focusOrderId}
            onOpenChat={openCharacterReturn}
            onOpenParcel={(arrivalId) => void openParcel(arrivalId)}
            onReroll={(order) => rerollOrder(order.id)}
            onServe={startServeAnimation}
            parcelTargetRef={parcelRef}
          />

          <ServiceCounter viewportWidth={width} />

          <View onLayout={measureBoardArea} style={styles.boardStage}>
            {active && boardAreaHeight > 0 ? <FeastlePersistentMergeBoard
              effectsPaused={effectsPaused}
              hiddenItemInstanceIds={hiddenAnimatedItemIds}
              maxHeight={boardAreaHeight - 1}
              onCommand={dispatch}
              onSelect={setSelectedCell}
              onScreenMetrics={handleBoardScreenMetrics}
              selectedCell={selectedCell}
              state={state}
              width={contentWidth}
            /> : null}
            {expansionReady && expansion ? <Pressable accessibilityLabel={`Clear blockers and unlock ${expansion.cells.length} spaces`} accessibilityRole="button" onPress={() => dispatch({ type: 'unlockExpansion', expansionId: expansion.id, now: Date.now() })} style={({ pressed }) => [styles.expansionButton, pressed && styles.pressed]}>
              <IconSymbol color="#4A291B" name="leaf.fill" size={12} />
              <ThemedText darkColor="#4A291B" style={styles.expansionLabel}>+{expansion.cells.length}</ThemedText>
            </Pressable> : null}
            {parcelFlight ? <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.boardInteractionShield} /> : null}
          </View>
        </View>

      </View>

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
  expansionButton: { alignItems: 'center', backgroundColor: '#F5D488', borderColor: '#B8752C', borderRadius: 999, borderWidth: 1, boxShadow: '0 3px 8px rgba(55,28,13,0.3)', flexDirection: 'row', gap: 2, paddingHorizontal: 8, paddingVertical: 5, position: 'absolute', right: 5, top: 5, zIndex: 40 },
  expansionLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 9, fontWeight: '900' },
  errorBanner: { alignSelf: 'center', maxWidth: 360, position: 'absolute', width: '92%', zIndex: GameUI.layer.notice },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
