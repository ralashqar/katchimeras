import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeOut, cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { RewardSplash, type RewardSplashItem } from '@/components/katchadeck/ui/reward-splash';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  MERGE_GENERATORS_BY_ID,
  MERGE_LEVEL_THRESHOLDS,
} from '@/constants/merge-world-catalog';
import { mergeWorldGeneratorArt } from '@/constants/merge-world-art';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import { useMergeWorld } from '@/features/merge-world/merge-world-provider';
import type { MergeOrder, MergeWorldCommand } from '@/types/merge-world';
import { markFlowStart, reportFlowReady } from '@/utils/flow-performance';
import { mergeCellCenter } from '@/utils/merge-world/board-geometry';
import { availableExpansion, mergeOrderItemReadiness, mergeOrderServingCells, readyMergeOrderIds } from '@/utils/merge-world/engine';
import { beginFeastleReturn, loadFeastleStory, subscribeCompanionStories } from '@/utils/companion-story-storage';

import { FeastlePersistentMergeBoard, type MergeBoardScreenMetrics } from './feastle-persistent-merge-board';
import { MergeOrderRail, type MergeTrayEntry } from './merge-order-rail';
import { MergeServeRewardOverlay, type MergeScreenPoint, type MergeServeRewardFlight } from './merge-serve-reward-overlay';

const MERGE_CURRENCY_ART = {
  energy: require('../../../assets/images/katchimeras/merge-world/ui/energy.webp'),
  coins: require('../../../assets/images/katchimeras/merge-world/ui/coin.webp'),
  level: require('../../../assets/images/katchimeras/merge-world/ui/merge-level.webp'),
} as const;

export function MergeWorldScreen({ active = true, effectsPaused }: { active?: boolean; effectsPaused?: SharedValue<number> } = {}) {
  const router = useRouter();
  const { focusOrderId } = useLocalSearchParams<{ focusOrderId?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { state, loading, error, lastResult, dispatch: send } = useMergeWorld();
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [boardAreaHeight, setBoardAreaHeight] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [story, setStory] = useState(loadFeastleStory);
  const [serveFlight, setServeFlight] = useState<MergeServeRewardFlight | null>(null);
  const [presentedCoins, setPresentedCoins] = useState<number | null>(null);
  const [coinPulseNonce, setCoinPulseNonce] = useState(0);
  const screenRef = useRef<View>(null);
  const coinHudRef = useRef<View>(null);
  const boardMetricsRef = useRef<MergeBoardScreenMetrics | null>(null);
  const activeServeRef = useRef(false);
  const activeServeOrderRef = useRef<{ coinAmount: number; orderId: string } | null>(null);
  const serveNonceRef = useRef(0);
  const storyNavigationPendingRef = useRef(false);
  const contentWidth = Math.min(width - 12, 600);
  const flowReady = !loading && state != null;
  const readyOrderIds = useMemo(() => state ? readyMergeOrderIds(state) : new Set<string>(), [state]);
  const hiddenServingItemIds = useMemo(() => new Set(serveFlight?.phase === 'items' ? serveFlight.items.map((item) => item.instanceId) : []), [serveFlight]);
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

  useEffect(() => subscribeCompanionStories(() => setStory(loadFeastleStory())), []);

  useEffect(() => {
    if (active) storyNavigationPendingRef.current = false;
  }, [active]);

  const openFeastleReturn = useCallback(() => {
    if (!active || storyNavigationPendingRef.current) return;
    storyNavigationPendingRef.current = true;
    beginFeastleReturn();
    router.push({
      pathname: '/katchimera/[creatureId]',
      params: { creatureId: 'companion:feastle', source: 'merge-world', story: 'return' },
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
    setMessage(message);
    if (!message) return;
    const timer = setTimeout(() => {
      setMessage(null);
    }, 1_450);
    return () => clearTimeout(timer);
  }, [lastResult]);

  const dispatch = useCallback((command: MergeWorldCommand) => send(command), [send]);

  const trayEntries = useMemo<MergeTrayEntry[]>(() => state ? [
    ...(story.status === 'return_available' ? [{
      id: `chat-note:${story.id}:${story.targetLevel}`,
      kind: 'chat_note' as const,
      characterId: 'feastle' as const,
      bondPoints: story.pendingBondPoints,
    }] : []),
    ...state.activeOrders.map((order) => ({
      id: order.id,
      kind: 'order' as const,
      order,
      itemReadiness: mergeOrderItemReadiness(state, order),
      ready: readyOrderIds.has(order.id),
    })),
  ] : [], [readyOrderIds, state, story.id, story.pendingBondPoints, story.status, story.targetLevel]);

  const startServeAnimation = useCallback(async (order: MergeOrder, itemTargets: readonly MergeScreenPoint[]) => {
    if (!state || activeServeRef.current) return false;
    activeServeRef.current = true;
    const boardMetrics = boardMetricsRef.current;
    const servingItems = mergeOrderServingCells(state, order);
    const [screenRect, coinRect] = await Promise.all([measureViewInWindow(screenRef), measureViewInWindow(coinHudRef)]);
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
    serveNonceRef.current += 1;
    activeServeOrderRef.current = { coinAmount: order.reward.coins, orderId: order.id };
    setServeFlight({ coinAmount: order.reward.coins, coinFrom, coinTo, items, nonce: serveNonceRef.current, phase: 'items' });
    return true;
  }, [state]);

  const handleServeItemsArrive = useCallback(() => {
    const activeOrder = activeServeOrderRef.current;
    if (!activeOrder) return;
    const result = dispatch({ type: 'serveOrder', orderId: activeOrder.orderId, now: Date.now() });
    if (!result?.changed) {
      activeServeRef.current = false;
      activeServeOrderRef.current = null;
      setServeFlight(null);
      return;
    }
    setPresentedCoins(result.state.coins - activeOrder.coinAmount);
    setServeFlight((current) => current ? { ...current, phase: 'coins' } : null);
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [dispatch]);

  const handleCoinArrive = useCallback((amount: number) => {
    setPresentedCoins((current) => current == null ? amount : current + amount);
    setCoinPulseNonce((current) => current + 1);
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const finishServeAnimation = useCallback(() => {
    setPresentedCoins(null);
    setServeFlight(null);
    activeServeRef.current = false;
    activeServeOrderRef.current = null;
  }, []);
  const handleBoardScreenMetrics = useCallback((metrics: MergeBoardScreenMetrics) => {
    boardMetricsRef.current = metrics;
  }, []);
  const rerollOrder = useCallback((orderId: string) => {
    dispatch({ type: 'rerollOrder', orderId, now: Date.now() });
  }, [dispatch]);

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
  return (
    <View ref={screenRef} style={styles.screen}>
      <View style={[styles.game, { paddingTop: Math.max(insets.top + 3, 7), paddingBottom: Math.max(insets.bottom + 3, 7), width: contentWidth }]}>
        <View style={styles.hud}>
          <CurrencyHud art={MERGE_CURRENCY_ART.energy} label="Energy" value={`${state.energy.value}`} suffix={`/${state.energy.cap}`} />
          <CurrencyHud art={MERGE_CURRENCY_ART.coins} label="Coins" pulseNonce={coinPulseNonce} targetRef={coinHudRef} value={String(presentedCoins ?? state.coins)} />
          <CurrencyHud art={MERGE_CURRENCY_ART.level} label="Merge level" progress={levelRatio} value={String(state.mergeLevel)} />
          <Pressable accessibilityLabel="Open legacy games" accessibilityRole="button" onPress={() => router.push('/legacy-games')} style={({ pressed }) => [styles.hudAction, pressed && styles.pressed]}>
            <IconSymbol color="#F6D993" name="gamecontroller.fill" size={19} />
          </Pressable>
        </View>

        <View style={styles.mergeArea}>
          <MergeOrderRail
            entries={trayEntries}
            focusOrderId={focusOrderId}
            onOpenChat={openFeastleReturn}
            onReroll={(order) => rerollOrder(order.id)}
            onServe={startServeAnimation}
          />

          <ServiceCounter viewportWidth={width} />

          <View onLayout={measureBoardArea} style={styles.boardStage}>
            {active && boardAreaHeight > 0 ? <FeastlePersistentMergeBoard
              effectsPaused={effectsPaused}
              hiddenItemInstanceIds={hiddenServingItemIds}
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
          </View>
        </View>

      </View>

      {error ? <View style={[styles.errorBanner, { top: Math.max(insets.top + 56, 64) }]}><ThemedText darkColor="#FFE1D8" numberOfLines={2} style={styles.errorText}>{error}</ThemedText></View> : null}
      {message ? <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(120)} pointerEvents="none" style={[styles.toast, { bottom: Math.max(insets.bottom + 76, 82) }]}><ThemedText darkColor="#4A291B" style={styles.toastText}>{message}</ThemedText></Animated.View> : null}
      <MergeServeRewardOverlay flight={serveFlight} onCoinArrive={handleCoinArrive} onFinish={finishServeAnimation} onItemsArrive={handleServeItemsArrive} />
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

function CurrencyHud({ art, label, progress, pulseNonce = 0, targetRef, value, suffix }: { art: number; label: string; progress?: number; pulseNonce?: number; targetRef?: RefObject<View | null>; value: string; suffix?: string }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (pulseNonce < 1) return;
    pulse.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 150 }));
    return () => cancelAnimation(pulse);
  }, [pulse, pulseNonce]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.09 }] }), [pulse]);
  return <Animated.View accessibilityLabel={`${label} ${value}${suffix ?? ''}`} ref={targetRef} style={[styles.currency, pulseStyle]}>
    <View pointerEvents="none" style={styles.currencySheen} />
    <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" source={art} style={styles.currencyArt} transition={0} />
    <ThemedText darkColor="#FFF4D7" style={styles.currencyValue}>{value}<ThemedText darkColor="#CDBAAB" style={styles.currencySuffix}>{suffix}</ThemedText></ThemedText>
    {progress != null ? <View pointerEvents="none" style={styles.currencyTrack}><View style={[styles.currencyFill, { width: `${progress * 100}%` }]} /></View> : null}
  </Animated.View>;
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
  hud: { alignItems: 'center', flexDirection: 'row', gap: 6, minHeight: 43, paddingHorizontal: 1 },
  currency: { alignItems: 'center', backgroundColor: 'rgba(26,23,38,0.93)', borderColor: 'rgba(255,223,165,0.43)', borderCurve: 'continuous', borderRadius: 15, borderWidth: 1, boxShadow: '0 5px 13px rgba(25,14,18,0.30), inset 0 1px 0 rgba(255,255,255,0.10)', flex: 1, flexDirection: 'row', gap: 1, height: 39, minWidth: 0, overflow: 'hidden', paddingHorizontal: 4, position: 'relative' },
  currencySheen: { backgroundColor: 'rgba(255,255,255,0.045)', borderRadius: 999, height: 20, left: 7, position: 'absolute', right: 7, top: 2 },
  currencyArt: { height: 35, width: 35 },
  currencyValue: { flexShrink: 1, fontFamily: AppFontFamilies.fredokaBold, fontSize: 16.5, fontVariant: ['tabular-nums'], lineHeight: 21 },
  currencySuffix: { fontFamily: AppFontFamilies.manrope, fontSize: 7.5, fontWeight: '800' },
  currencyTrack: { backgroundColor: 'rgba(255,255,255,0.08)', bottom: 0, height: 2.5, left: 10, overflow: 'hidden', position: 'absolute', right: 10 },
  currencyFill: { backgroundColor: '#EEC364', boxShadow: '0 0 5px rgba(238,195,100,0.72)', height: 2.5 },
  hudAction: { alignItems: 'center', backgroundColor: 'rgba(26,23,38,0.93)', borderColor: 'rgba(255,223,165,0.43)', borderCurve: 'continuous', borderRadius: 15, borderWidth: 1, boxShadow: '0 5px 13px rgba(25,14,18,0.30), inset 0 1px 0 rgba(255,255,255,0.10)', height: 39, justifyContent: 'center', width: 42 },
  mergeArea: { flex: 1, minHeight: 0 },
  serviceCounter: { alignSelf: 'center', height: 32, marginTop: -29, position: 'relative', zIndex: 1 },
  counterUpperLip: { backgroundColor: '#FFE876', height: 3, left: 0, position: 'absolute', right: 0, top: 0 },
  counterInsetShade: { backgroundColor: '#A64F32', height: 5, left: 0, position: 'absolute', right: 0, top: 3 },
  counterFaceEdge: { backgroundColor: '#FFE36A', height: 3, left: 0, position: 'absolute', right: 0, top: 8 },
  counterFace: { backgroundColor: '#EEA621', bottom: 5, left: 0, position: 'absolute', right: 0, top: 11 },
  counterLowerEdge: { backgroundColor: '#CB701D', bottom: 2, height: 3, left: 0, position: 'absolute', right: 0 },
  counterLowerFlat: { backgroundColor: '#8F4932', bottom: 0, height: 2, left: 0, position: 'absolute', right: 0 },
  boardStage: { alignItems: 'center', flex: 1, justifyContent: 'flex-start', minHeight: 0, position: 'relative' },
  expansionButton: { alignItems: 'center', backgroundColor: '#F5D488', borderColor: '#B8752C', borderRadius: 999, borderWidth: 1, boxShadow: '0 3px 8px rgba(55,28,13,0.3)', flexDirection: 'row', gap: 2, paddingHorizontal: 8, paddingVertical: 5, position: 'absolute', right: 5, top: 5, zIndex: 40 },
  expansionLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 9, fontWeight: '900' },
  errorBanner: { alignSelf: 'center', backgroundColor: 'rgba(121,38,31,0.92)', borderRadius: 12, maxWidth: 360, paddingHorizontal: 12, paddingVertical: 7, position: 'absolute', zIndex: 80 },
  errorText: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, fontWeight: '700' },
  toast: { alignSelf: 'center', backgroundColor: '#FFF0CE', borderColor: '#C98435', borderRadius: 999, borderWidth: 1, boxShadow: '0 6px 16px rgba(55,28,13,0.34)', paddingHorizontal: 15, paddingVertical: 7, position: 'absolute', zIndex: 90 },
  toastText: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
