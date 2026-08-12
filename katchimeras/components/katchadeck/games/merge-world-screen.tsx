import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { RewardSplash, type RewardSplashItem } from '@/components/katchadeck/ui/reward-splash';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  MERGE_CHARACTER_NAMES,
  MERGE_GENERATORS_BY_ID,
  MERGE_LEVEL_THRESHOLDS,
} from '@/constants/merge-world-catalog';
import { mergeWorldGeneratorArt } from '@/constants/merge-world-art';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import { useMergeWorld } from '@/features/merge-world/merge-world-provider';
import type { HomeVisualKey } from '@/types/home';
import type { MergeCharacterId, MergeOrder, MergeWorldCommand } from '@/types/merge-world';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import { markFlowStart, reportFlowReady } from '@/utils/flow-performance';
import { availableExpansion, readyMergeOrderIds } from '@/utils/merge-world/engine';
import { beginFeastleReturn, loadFeastleStory, subscribeCompanionStories } from '@/utils/companion-story-storage';

import { FeastlePersistentMergeBoard, PersistentMergeItemArt } from './feastle-persistent-merge-board';

const CHARACTER_VISUALS: Record<MergeCharacterId, HomeVisualKey> = {
  feastle: 'feastle',
  mossprout: 'mossprout',
  steppling: 'steppling',
  shellio: 'shellio',
  voyagle: 'voyagle',
};

const MERGE_CURRENCY_ART = {
  energy: require('../../../assets/images/katchimeras/merge-world/ui/energy.webp'),
  coins: require('../../../assets/images/katchimeras/merge-world/ui/coin.webp'),
  level: require('../../../assets/images/katchimeras/merge-world/ui/merge-level.webp'),
} as const;

const MERGE_ORDER_TRAY_ART = require('../../../assets/images/katchimeras/merge-world/ui/order-service-tray.webp');

export function MergeWorldScreen({ active = true, effectsPaused }: { active?: boolean; effectsPaused?: SharedValue<number> } = {}) {
  const router = useRouter();
  const { focusOrderId } = useLocalSearchParams<{ focusOrderId?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { state, loading, error, lastResult, friendshipLevels, dispatch: send } = useMergeWorld();
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [boardAreaHeight, setBoardAreaHeight] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [story, setStory] = useState(loadFeastleStory);
  const storyNavigationPendingRef = useRef(false);
  const contentWidth = Math.min(width - 12, 600);
  const flowReady = !loading && state != null;
  const readyOrderIds = useMemo(() => state ? readyMergeOrderIds(state) : new Set<string>(), [state]);
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
  const isFeastleThreeDishChapter = story.targetLevel === 4
    && (story.status === 'order_active' || story.status === 'return_available');
  const feastleChapterOrders = isFeastleThreeDishChapter
    ? new Map(state.activeOrders
        .filter((order) => order.characterId === 'feastle' && order.storyTargetLevel === 4)
        .map((order) => [order.storyStep ?? 1, order]))
    : null;

  return (
    <View style={styles.screen}>
      <View style={[styles.game, { paddingTop: Math.max(insets.top + 3, 7), paddingBottom: Math.max(insets.bottom + 3, 7), width: contentWidth }]}>
        <View style={styles.hud}>
          <CurrencyHud art={MERGE_CURRENCY_ART.energy} label="Energy" value={`${state.energy.value}`} suffix={`/${state.energy.cap}`} />
          <CurrencyHud art={MERGE_CURRENCY_ART.coins} label="Coins" value={String(state.coins)} />
          <CurrencyHud art={MERGE_CURRENCY_ART.level} label="Merge level" progress={levelRatio} value={String(state.mergeLevel)} />
          <Pressable accessibilityLabel="Open legacy games" accessibilityRole="button" onPress={() => router.push('/legacy-games')} style={({ pressed }) => [styles.hudAction, pressed && styles.pressed]}>
            <IconSymbol color="#F6D993" name="gamecontroller.fill" size={19} />
          </Pressable>
        </View>

        <View accessibilityLabel="Katchimera orders" style={styles.orderRail}>
          {feastleChapterOrders ? [1, 2, 3].map((step) => {
            const order = feastleChapterOrders.get(step);
            if (order) return <CompactOrder
              friendshipLevel={friendshipLevels[order.characterId] ?? 1}
              focused={order.id === focusOrderId}
              key={order.id}
              onServe={() => dispatch({ type: 'serveOrder', orderId: order.id, now: Date.now() })}
              onReroll={() => dispatch({ type: 'rerollOrder', orderId: order.id, now: Date.now() })}
              order={order}
              ready={readyOrderIds.has(order.id)}
            />;
            if (story.status === 'return_available' && step === 3) return <StoryReturnCard bondPoints={story.pendingBondPoints} key="feastle-chapter-return" onPress={openFeastleReturn} />;
            return <CompletedOrderSlot key={`feastle-order-complete:${step}`} step={step} />;
          }) : state.activeOrders.slice(0, story.status === 'return_available' ? 2 : 3).map((order) => <CompactOrder
              friendshipLevel={friendshipLevels[order.characterId] ?? 1}
              focused={order.id === focusOrderId}
              key={order.id}
              onServe={() => dispatch({ type: 'serveOrder', orderId: order.id, now: Date.now() })}
              onReroll={() => dispatch({ type: 'rerollOrder', orderId: order.id, now: Date.now() })}
              order={order}
              ready={readyOrderIds.has(order.id)}
            />)}
          {!isFeastleThreeDishChapter && story.status === 'return_available' ? <StoryReturnCard bondPoints={story.pendingBondPoints} onPress={openFeastleReturn} /> : null}
        </View>

        <View onLayout={measureBoardArea} style={styles.boardStage}>
          {active && boardAreaHeight > 0 ? <FeastlePersistentMergeBoard
            effectsPaused={effectsPaused}
            maxHeight={boardAreaHeight - 4}
            onCommand={dispatch}
            onSelect={setSelectedCell}
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

      {error ? <View style={[styles.errorBanner, { top: Math.max(insets.top + 56, 64) }]}><ThemedText darkColor="#FFE1D8" numberOfLines={2} style={styles.errorText}>{error}</ThemedText></View> : null}
      {message ? <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(120)} pointerEvents="none" style={[styles.toast, { bottom: Math.max(insets.bottom + 76, 82) }]}><ThemedText darkColor="#4A291B" style={styles.toastText}>{message}</ThemedText></Animated.View> : null}
      {active && generatorUnlockRewards.length ? <RewardSplash
        items={generatorUnlockRewards}
        onItemSeen={(receiptId) => dispatch({ type: 'ackGeneratorUnlock', receiptId, now: Date.now() })}
      /> : null}
    </View>
  );
}

function StoryReturnCard({ bondPoints, onPress }: { bondPoints: number; onPress: () => void }) {
  return <Pressable accessibilityLabel="Feastle wants to continue the story" accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.returnCard, pressed && styles.pressed]}>
    <View style={styles.returnIcon}><IconSymbol color="#FFF7DF" name="bubble.left.and.bubble.right.fill" size={22} /></View>
    <ThemedText darkColor="#4A291B" numberOfLines={2} style={styles.returnTitle}>A note from Feastle</ThemedText>
    <ThemedText darkColor="#7B5A34" numberOfLines={1} style={styles.returnAction}>{bondPoints > 0 ? `+${bondPoints} Bond · Read next scene` : 'Read next scene'}</ThemedText>
  </Pressable>;
}

function CompletedOrderSlot({ step }: { step: number }) {
  return <Animated.View
    accessibilityLabel={`Feastle order ${step} served`}
    entering={FadeIn.duration(180)}
    style={styles.completedOrderSlot}>
    <View style={styles.completedOrderCheck}><IconSymbol color="#FFF7DF" name="checkmark" size={18} /></View>
    <ThemedText darkColor="#5E4429" numberOfLines={1} style={styles.completedOrderTitle}>Served</ThemedText>
  </Animated.View>;
}

function CurrencyHud({ art, label, progress, value, suffix }: { art: number; label: string; progress?: number; value: string; suffix?: string }) {
  return <View accessibilityLabel={`${label} ${value}${suffix ?? ''}`} style={styles.currency}>
    <View pointerEvents="none" style={styles.currencySheen} />
    <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" source={art} style={styles.currencyArt} transition={0} />
    <ThemedText darkColor="#FFF4D7" style={styles.currencyValue}>{value}<ThemedText darkColor="#CDBAAB" style={styles.currencySuffix}>{suffix}</ThemedText></ThemedText>
    {progress != null ? <View pointerEvents="none" style={styles.currencyTrack}><View style={[styles.currencyFill, { width: `${progress * 100}%` }]} /></View> : null}
  </View>;
}

function CompactOrder({ order, ready, focused, onServe, onReroll, friendshipLevel }: { order: MergeOrder; ready: boolean; focused: boolean; onServe: () => void; onReroll: () => void; friendshipLevel: number }) {
  const characterSource = resolveCreatureArtSource(CHARACTER_VISUALS[order.characterId], { lod: 'medium' });
  return <Pressable
    accessibilityLabel={`${MERGE_CHARACTER_NAMES[order.characterId]} order, ${order.title}${ready ? ', ready to serve' : ''}`}
    accessibilityRole="button"
    accessibilityState={{ disabled: !ready }}
    onLongPress={onReroll}
    onPress={ready ? onServe : undefined}
    style={({ pressed }) => [styles.orderSlot, focused && styles.orderSlotFocused, ready && styles.orderSlotReady, pressed && styles.pressed]}>
    {ready ? <View pointerEvents="none" style={styles.orderReadyGlow} /> : null}
    {order.purpose === 'signature' ? <View pointerEvents="none" style={styles.chapterRibbon}><ThemedText darkColor="#4A291B" style={styles.chapterRibbonText}>CHAPTER</ThemedText></View> : null}
    <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" recyclingKey={`merge-order-${order.characterId}`} source={characterSource} style={styles.orderCharacter} transition={0} />
    <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="fill" source={MERGE_ORDER_TRAY_ART} style={styles.orderTrayArt} transition={0} />
    <View pointerEvents="none" style={styles.orderItems}>
      {order.requirements.slice(0, 3).map((requirement) => <View key={requirement.definitionId} style={styles.orderItem}>
        <PersistentMergeItemArt definitionId={requirement.definitionId} size={34} />
        {requirement.quantity > 1 ? <View style={styles.quantityBadge}><ThemedText darkColor="#FFF" style={styles.quantityText}>×{requirement.quantity}</ThemedText></View> : null}
      </View>)}
    </View>
    <View pointerEvents="none" style={[styles.serveMark, ready && styles.serveMarkReady]}><IconSymbol color={ready ? '#FFF7D8' : '#F2D49A'} name={ready ? 'checkmark' : 'heart.fill'} size={10} /><ThemedText darkColor={ready ? '#FFF7D8' : '#F2D49A'} style={styles.friendshipLevel}>{friendshipLevel}</ThemedText></View>
  </Pressable>;
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
  orderRail: { flexDirection: 'row', gap: 3, height: 110, overflow: 'visible', paddingHorizontal: 1 },
  orderSlot: { flex: 1, overflow: 'visible', position: 'relative' },
  orderSlotFocused: { backgroundColor: 'rgba(255,240,206,0.18)', borderColor: 'rgba(255,224,159,0.7)', borderRadius: 18, borderWidth: 1 },
  returnCard: { alignItems: 'center', backgroundColor: '#FFF0CE', borderColor: '#B8752C', borderCurve: 'continuous', borderRadius: 19, borderWidth: 1, flex: 1, gap: 3, justifyContent: 'center', padding: 8 },
  returnIcon: { alignItems: 'center', backgroundColor: '#76501F', borderRadius: 14, height: 36, justifyContent: 'center', width: 36 },
  returnTitle: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 12, lineHeight: 14, textAlign: 'center' },
  returnAction: { fontFamily: AppFontFamilies.manrope, fontSize: 8, fontWeight: '900' },
  completedOrderSlot: { alignItems: 'center', backgroundColor: 'rgba(255,240,206,0.48)', borderColor: 'rgba(184,117,44,0.42)', borderCurve: 'continuous', borderRadius: 19, borderStyle: 'dashed', borderWidth: 1, flex: 1, gap: 5, justifyContent: 'center', padding: 8 },
  completedOrderCheck: { alignItems: 'center', backgroundColor: '#708D48', borderRadius: 14, height: 34, justifyContent: 'center', width: 34 },
  completedOrderTitle: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 11.5 },
  orderSlotReady: { transform: [{ translateY: -1 }] },
  orderReadyGlow: { alignSelf: 'center', backgroundColor: 'rgba(247,215,123,0.23)', borderRadius: 999, boxShadow: '0 0 18px rgba(247,215,123,0.52)', height: 68, position: 'absolute', top: 5, width: 82 },
  chapterRibbon: { backgroundColor: '#F4D082', borderColor: '#8D5928', borderRadius: 999, borderWidth: 1, left: 4, paddingHorizontal: 5, paddingVertical: 2, position: 'absolute', top: 1, zIndex: 5 },
  chapterRibbonText: { fontFamily: AppFontFamilies.manrope, fontSize: 6.5, fontWeight: '900', letterSpacing: 0.5 },
  orderCharacter: { bottom: 25, height: 86, left: '7%', position: 'absolute', width: '86%', zIndex: 1 },
  orderTrayArt: { bottom: 1, height: 47, left: 0, position: 'absolute', right: 0, width: '100%', zIndex: 2 },
  orderItems: { alignItems: 'center', bottom: 12, flexDirection: 'row', gap: 0, justifyContent: 'center', left: 5, position: 'absolute', right: 5, zIndex: 3 },
  orderItem: { height: 35, position: 'relative', width: 35 },
  quantityBadge: { alignItems: 'center', backgroundColor: '#A85C2A', borderColor: '#FFE8B6', borderRadius: 999, borderWidth: 1, bottom: -1, justifyContent: 'center', minWidth: 17, paddingHorizontal: 3, position: 'absolute', right: -1 },
  quantityText: { fontFamily: AppFontFamilies.manrope, fontSize: 7, fontWeight: '900' },
  serveMark: { alignItems: 'center', backgroundColor: '#7A532E', borderColor: '#D6A15A', borderRadius: 999, borderWidth: 1, bottom: -2, boxShadow: '0 2px 5px rgba(52,29,14,0.38)', flexDirection: 'row', gap: 2, height: 22, justifyContent: 'center', minWidth: 29, paddingHorizontal: 5, position: 'absolute', right: 5, zIndex: 4 },
  serveMarkReady: { backgroundColor: '#64863B', borderColor: '#456727', boxShadow: '0 2px 5px rgba(65,91,31,0.32)' },
  friendshipLevel: { fontFamily: AppFontFamilies.manrope, fontSize: 7.5, fontWeight: '900' },
  boardStage: { alignItems: 'center', flex: 1, justifyContent: 'flex-start', minHeight: 0, paddingTop: 2, position: 'relative' },
  expansionButton: { alignItems: 'center', backgroundColor: '#F5D488', borderColor: '#B8752C', borderRadius: 999, borderWidth: 1, boxShadow: '0 3px 8px rgba(55,28,13,0.3)', flexDirection: 'row', gap: 2, paddingHorizontal: 8, paddingVertical: 5, position: 'absolute', right: 5, top: 5, zIndex: 40 },
  expansionLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 9, fontWeight: '900' },
  errorBanner: { alignSelf: 'center', backgroundColor: 'rgba(121,38,31,0.92)', borderRadius: 12, maxWidth: 360, paddingHorizontal: 12, paddingVertical: 7, position: 'absolute', zIndex: 80 },
  errorText: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, fontWeight: '700' },
  toast: { alignSelf: 'center', backgroundColor: '#FFF0CE', borderColor: '#C98435', borderRadius: 999, borderWidth: 1, boxShadow: '0 6px 16px rgba(55,28,13,0.34)', paddingHorizontal: 15, paddingVertical: 7, position: 'absolute', zIndex: 90 },
  toastText: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
