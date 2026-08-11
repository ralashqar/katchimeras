import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBorderHighlight } from '@/components/katchadeck/ui/animated-border-highlight';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  MERGE_CHARACTER_NAMES,
  MERGE_ITEMS_BY_ID,
  MERGE_LEVEL_THRESHOLDS,
} from '@/constants/merge-world-catalog';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import { useMergeWorld } from '@/features/merge-world/merge-world-provider';
import type { HomeVisualKey } from '@/types/home';
import type { MergeCharacterId, MergeOrder, MergeWorldCommand } from '@/types/merge-world';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import { markFlowStart, reportFlowReady } from '@/utils/flow-performance';
import { availableExpansion, readyMergeOrderIds } from '@/utils/merge-world/engine';

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

export function MergeWorldScreen({ effectsPaused }: { effectsPaused?: SharedValue<number> } = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { state, loading, error, lastResult, friendshipLevels, dispatch: send } = useMergeWorld();
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [boardAreaHeight, setBoardAreaHeight] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [discovery, setDiscovery] = useState<string | null>(null);
  const contentWidth = Math.min(width - 12, 600);
  const flowReady = !loading && state != null;
  const readyOrderIds = useMemo(() => state ? readyMergeOrderIds(state) : new Set<string>(), [state]);

  useEffect(() => {
    markFlowStart('merge-world');
  }, []);

  useEffect(() => {
    if (!flowReady) return;
    return reportFlowReady('merge-world');
  }, [flowReady]);

  useEffect(() => {
    if (!lastResult) return;
    const message = lastResult.spawnedCell != null && !lastResult.discoveryId ? null : lastResult.message ?? null;
    setMessage(message);
    setDiscovery(lastResult.discoveryId ?? null);
    if (!message && !lastResult.discoveryId) return;
    const timer = setTimeout(() => {
      setMessage(null);
      setDiscovery(null);
    }, lastResult.discoveryId ? 2_200 : 1_450);
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
          {state.activeOrders.slice(0, 3).map((order) => <CompactOrder
            effectsPaused={effectsPaused}
            friendshipLevel={friendshipLevels[order.characterId] ?? 1}
            key={order.id}
            onServe={() => dispatch({ type: 'serveOrder', orderId: order.id, now: Date.now() })}
            order={order}
            ready={readyOrderIds.has(order.id)}
          />)}
        </View>

        <View onLayout={measureBoardArea} style={styles.boardStage}>
          {boardAreaHeight > 0 ? <FeastlePersistentMergeBoard
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
      {discovery ? <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(160)} exiting={reduceMotion ? undefined : FadeOut.duration(140)} pointerEvents="none" style={styles.discovery}><IconSymbol color="#A85E20" name="sparkles" size={26} /><ThemedText darkColor="#A85E20" style={styles.discoveryEyebrow}>NEW DISCOVERY</ThemedText><ThemedText darkColor="#4A291B" style={styles.discoveryTitle}>{MERGE_ITEMS_BY_ID.get(discovery)?.name}</ThemedText></Animated.View> : null}
    </View>
  );
}

function CurrencyHud({ art, label, progress, value, suffix }: { art: number; label: string; progress?: number; value: string; suffix?: string }) {
  return <View accessibilityLabel={`${label} ${value}${suffix ?? ''}`} style={styles.currency}>
    <View pointerEvents="none" style={styles.currencySheen} />
    <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" source={art} style={styles.currencyArt} transition={0} />
    <ThemedText darkColor="#FFF4D7" style={styles.currencyValue}>{value}<ThemedText darkColor="#CDBAAB" style={styles.currencySuffix}>{suffix}</ThemedText></ThemedText>
    {progress != null ? <View pointerEvents="none" style={styles.currencyTrack}><View style={[styles.currencyFill, { width: `${progress * 100}%` }]} /></View> : null}
  </View>;
}

function CompactOrder({ order, ready, onServe, friendshipLevel, effectsPaused }: { order: MergeOrder; ready: boolean; onServe: () => void; friendshipLevel: number; effectsPaused?: SharedValue<number> }) {
  const characterSource = resolveCreatureArtSource(CHARACTER_VISUALS[order.characterId], { lod: 'medium' });
  return <Pressable
    accessibilityLabel={`${MERGE_CHARACTER_NAMES[order.characterId]} order, ${order.title}${ready ? ', ready to serve' : ''}`}
    accessibilityRole="button"
    accessibilityState={{ disabled: !ready }}
    disabled={!ready}
    onPress={onServe}
    style={({ pressed }) => [styles.orderSlot, ready && styles.orderSlotReady, pressed && styles.pressed]}>
    {ready ? <AnimatedBorderHighlight borderRadius={15} inset={1} orbitDurationMs={2_100} pauseDurationMs={700} paused={effectsPaused} /> : null}
    <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" recyclingKey={`merge-order-${order.characterId}`} source={characterSource} style={styles.orderCharacter} transition={0} />
    <View style={styles.orderTray}>
      <View style={styles.orderItems}>
        {order.requirements.slice(0, 2).map((requirement) => <View key={requirement.definitionId} style={styles.orderItem}>
          <PersistentMergeItemArt definitionId={requirement.definitionId} size={36} />
          {requirement.quantity > 1 ? <View style={styles.quantityBadge}><ThemedText darkColor="#FFF" style={styles.quantityText}>×{requirement.quantity}</ThemedText></View> : null}
        </View>)}
      </View>
      <View style={[styles.serveMark, ready && styles.serveMarkReady]}><IconSymbol color={ready ? '#FFF7D8' : '#8D6A51'} name={ready ? 'checkmark' : 'heart.fill'} size={11} /><ThemedText darkColor={ready ? '#FFF7D8' : '#8D6A51'} style={styles.friendshipLevel}>{friendshipLevel}</ThemedText></View>
    </View>
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
  orderRail: { flexDirection: 'row', gap: 7, height: 108, overflow: 'visible', paddingHorizontal: 2 },
  orderSlot: { backgroundColor: 'rgba(45,36,41,0.88)', borderColor: 'rgba(255,226,174,0.46)', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, boxShadow: '0 6px 15px rgba(32,19,19,0.28), inset 0 1px 0 rgba(255,255,255,0.10)', flex: 1, overflow: 'hidden', position: 'relative' },
  orderSlotReady: { backgroundColor: 'rgba(66,65,39,0.94)', borderColor: '#F0C765', boxShadow: '0 7px 17px rgba(48,34,15,0.34), 0 0 12px rgba(240,199,101,0.15)' },
  orderCharacter: { height: 87, left: '5%', position: 'absolute', top: -7, width: '90%' },
  orderTray: { alignItems: 'center', backgroundColor: '#FFF2D5', borderColor: '#D6A75A', borderRadius: 14, borderWidth: 1, bottom: 3, boxShadow: '0 3px 8px rgba(71,42,22,0.22), inset 0 1px 0 rgba(255,255,255,0.80)', flexDirection: 'row', height: 43, justifyContent: 'space-between', left: 3, paddingHorizontal: 5, position: 'absolute', right: 3 },
  orderItems: { alignItems: 'center', flexDirection: 'row', gap: 1 },
  orderItem: { height: 37, position: 'relative', width: 37 },
  quantityBadge: { alignItems: 'center', backgroundColor: '#A85C2A', borderColor: '#FFE8B6', borderRadius: 999, borderWidth: 1, bottom: 0, justifyContent: 'center', minWidth: 17, paddingHorizontal: 3, position: 'absolute', right: 0 },
  quantityText: { fontFamily: AppFontFamilies.manrope, fontSize: 7, fontWeight: '900' },
  serveMark: { alignItems: 'center', backgroundColor: 'rgba(116,83,60,0.11)', borderColor: 'rgba(127,91,57,0.16)', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 2, height: 24, justifyContent: 'center', minWidth: 31, paddingHorizontal: 5 },
  serveMarkReady: { backgroundColor: '#64863B', borderColor: '#456727', boxShadow: '0 2px 5px rgba(65,91,31,0.32)' },
  friendshipLevel: { fontFamily: AppFontFamilies.manrope, fontSize: 7.5, fontWeight: '900' },
  boardStage: { alignItems: 'center', flex: 1, justifyContent: 'flex-start', minHeight: 0, paddingTop: 2, position: 'relative' },
  expansionButton: { alignItems: 'center', backgroundColor: '#F5D488', borderColor: '#B8752C', borderRadius: 999, borderWidth: 1, boxShadow: '0 3px 8px rgba(55,28,13,0.3)', flexDirection: 'row', gap: 2, paddingHorizontal: 8, paddingVertical: 5, position: 'absolute', right: 5, top: 5, zIndex: 40 },
  expansionLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 9, fontWeight: '900' },
  errorBanner: { alignSelf: 'center', backgroundColor: 'rgba(121,38,31,0.92)', borderRadius: 12, maxWidth: 360, paddingHorizontal: 12, paddingVertical: 7, position: 'absolute', zIndex: 80 },
  errorText: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, fontWeight: '700' },
  toast: { alignSelf: 'center', backgroundColor: '#FFF0CE', borderColor: '#C98435', borderRadius: 999, borderWidth: 1, boxShadow: '0 6px 16px rgba(55,28,13,0.34)', paddingHorizontal: 15, paddingVertical: 7, position: 'absolute', zIndex: 90 },
  toastText: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '900' },
  discovery: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#FFF0CE', borderColor: '#D79A4A', borderCurve: 'continuous', borderRadius: 20, borderWidth: 2, boxShadow: '0 16px 42px rgba(55,28,13,0.44)', gap: 2, paddingHorizontal: 28, paddingVertical: 17, position: 'absolute', top: '39%', zIndex: 100 },
  discoveryEyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  discoveryTitle: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 19 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
