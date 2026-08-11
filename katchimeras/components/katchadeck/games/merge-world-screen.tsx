import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBorderHighlight } from '@/components/katchadeck/ui/animated-border-highlight';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
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

  const selected = selectedCell == null ? null : state.board[selectedCell]?.occupant;
  const selectedDefinition = selected?.kind === 'item' ? MERGE_ITEMS_BY_ID.get(selected.definitionId) : null;
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
          <CurrencyHud art={MERGE_CURRENCY_ART.level} label="Merge level" value={String(state.mergeLevel)} />
          <Pressable accessibilityLabel="Open legacy games" accessibilityRole="button" onPress={() => router.push('/legacy-games')} style={({ pressed }) => [styles.hudAction, pressed && styles.pressed]}>
            <IconSymbol color="#F6D993" name="gamecontroller.fill" size={19} />
          </Pressable>
          <View pointerEvents="none" style={styles.levelTrack}><View style={[styles.levelFill, { width: `${levelRatio * 100}%` }]} /></View>
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

        <View style={styles.bottomDock}>
          <Pressable
            accessibilityLabel={state.rewardInbox.length ? `Claim reward, ${state.rewardInbox.length} waiting` : `Storage, ${state.storage.length} of ${state.storageCapacity} slots used`}
            accessibilityRole="button"
            disabled={!state.rewardInbox.length}
            onPress={() => state.rewardInbox[0] && dispatch({ type: 'claimInbox', entryId: state.rewardInbox[0].id, now: Date.now() })}
            style={({ pressed }) => [styles.storageChest, pressed && styles.pressed]}>
            <IconSymbol color="#FFF0CE" name={state.rewardInbox.length ? 'shippingbox.fill' : 'archivebox.fill'} size={23} />
            <ThemedText darkColor="#FFF0CE" style={styles.storageCount}>{state.storage.length}/{state.storageCapacity}</ThemedText>
            {state.rewardInbox.length ? <View style={styles.alertBadge}><ThemedText darkColor="#FFF" style={styles.alertText}>{state.rewardInbox.length}</ThemedText></View> : null}
          </Pressable>

          <View style={styles.dockContent}>
            {selectedDefinition && selectedCell != null ? <>
              <PersistentMergeItemArt definitionId={selectedDefinition.id} size={43} />
              <View style={styles.itemCopy}>
                <ThemedText darkColor="#4A291B" numberOfLines={1} style={styles.itemName}>{selectedDefinition.name}</ThemedText>
                <ThemedText darkColor="#886044" numberOfLines={1} style={styles.itemMeta}>{selectedDefinition.familyId} · tier {selectedDefinition.tier}</ThemedText>
              </View>
              <DockAction icon="archivebox.fill" label="Store" onPress={() => { dispatch({ type: 'storeItem', cell: selectedCell, now: Date.now() }); setSelectedCell(null); }} />
              <DockAction icon="trash.fill" label="Sell" onPress={() => { dispatch({ type: 'sellItem', cell: selectedCell, now: Date.now() }); setSelectedCell(null); }} />
            </> : state.storage.length ? <>
              <View style={styles.itemCopy}><ThemedText darkColor="#4A291B" style={styles.itemName}>Storage</ThemedText><ThemedText darkColor="#886044" style={styles.itemMeta}>Tap an item to return it</ThemedText></View>
              {state.storage.slice(0, 4).map((item, index) => <Pressable accessibilityLabel={`Return ${MERGE_ITEMS_BY_ID.get(item.definitionId)?.name ?? 'item'} to board`} accessibilityRole="button" key={item.instanceId} onPress={() => dispatch({ type: 'restoreItem', storageIndex: index, now: Date.now() })} style={({ pressed }) => [styles.storedItem, pressed && styles.pressed]}><PersistentMergeItemArt definitionId={item.definitionId} size={39} /></Pressable>)}
            </> : <>
              <IconSymbol color="#B77943" name="hand.tap.fill" size={22} />
              <ThemedText darkColor="#755039" numberOfLines={2} style={styles.dockHint}>Tap an item for details, or drag matching pieces together.</ThemedText>
            </>}
          </View>
        </View>
      </View>

      {error ? <View style={[styles.errorBanner, { top: Math.max(insets.top + 56, 64) }]}><ThemedText darkColor="#FFE1D8" numberOfLines={2} style={styles.errorText}>{error}</ThemedText></View> : null}
      {message ? <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(120)} pointerEvents="none" style={[styles.toast, { bottom: Math.max(insets.bottom + 76, 82) }]}><ThemedText darkColor="#4A291B" style={styles.toastText}>{message}</ThemedText></Animated.View> : null}
      {discovery ? <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(160)} exiting={reduceMotion ? undefined : FadeOut.duration(140)} pointerEvents="none" style={styles.discovery}><IconSymbol color="#A85E20" name="sparkles" size={26} /><ThemedText darkColor="#A85E20" style={styles.discoveryEyebrow}>NEW DISCOVERY</ThemedText><ThemedText darkColor="#4A291B" style={styles.discoveryTitle}>{MERGE_ITEMS_BY_ID.get(discovery)?.name}</ThemedText></Animated.View> : null}
    </View>
  );
}

function CurrencyHud({ art, label, value, suffix }: { art: number; label: string; value: string; suffix?: string }) {
  return <View accessibilityLabel={`${label} ${value}${suffix ?? ''}`} style={styles.currency}>
    <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" source={art} style={styles.currencyArt} transition={0} />
    <ThemedText darkColor="#FFF4D7" style={styles.currencyValue}>{value}<ThemedText darkColor="#CDBAAB" style={styles.currencySuffix}>{suffix}</ThemedText></ThemedText>
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

function DockAction({ icon, label, onPress }: { icon: IconSymbolName; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.dockAction, pressed && styles.pressed]}><IconSymbol color="#6A426E" name={icon} size={17} /></Pressable>;
}

const styles = StyleSheet.create({
  screen: { alignItems: 'center', backgroundColor: 'transparent', flex: 1, overflow: 'hidden' },
  game: { flex: 1, gap: 6, minHeight: 0 },
  loading: { alignItems: 'center', backgroundColor: '#2B1B13', flex: 1, gap: 12, justifyContent: 'center' },
  hud: { alignItems: 'center', backgroundColor: 'rgba(27,24,42,0.90)', borderColor: 'rgba(255,220,159,0.48)', borderCurve: 'continuous', borderRadius: 19, borderWidth: 1, boxShadow: '0 6px 16px rgba(24,14,24,0.30), inset 0 1px 0 rgba(255,255,255,0.10)', flexDirection: 'row', gap: 4, minHeight: 44, padding: 4, position: 'relative' },
  currency: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,239,207,0.15)', borderCurve: 'continuous', borderRadius: 14, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 1, height: 34, minWidth: 0, paddingHorizontal: 3 },
  currencyArt: { height: 34, width: 34 },
  currencyValue: { flexShrink: 1, fontFamily: AppFontFamilies.fredokaBold, fontSize: 16, fontVariant: ['tabular-nums'], lineHeight: 20 },
  currencySuffix: { fontFamily: AppFontFamilies.manrope, fontSize: 7.5, fontWeight: '800' },
  hudAction: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,220,159,0.28)', borderRadius: 13, borderWidth: 1, height: 34, justifyContent: 'center', width: 36 },
  levelTrack: { backgroundColor: 'rgba(255,255,255,0.08)', bottom: 1, height: 2, left: 12, overflow: 'hidden', position: 'absolute', right: 48 },
  levelFill: { backgroundColor: '#EEC364', boxShadow: '0 0 5px rgba(238,195,100,0.7)', height: 2 },
  orderRail: { flexDirection: 'row', gap: 6, height: 106, overflow: 'visible', paddingHorizontal: 2 },
  orderSlot: { backgroundColor: 'rgba(38,33,53,0.86)', borderColor: 'rgba(255,225,174,0.30)', borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, boxShadow: '0 4px 12px rgba(27,17,28,0.24), inset 0 1px 0 rgba(255,255,255,0.08)', flex: 1, overflow: 'hidden', position: 'relative' },
  orderSlotReady: { backgroundColor: 'rgba(73,57,66,0.94)', borderColor: '#F1BA52', boxShadow: '0 5px 14px rgba(63,32,16,0.32)' },
  orderCharacter: { height: 83, left: '8%', position: 'absolute', top: -5, width: '84%' },
  orderTray: { alignItems: 'center', backgroundColor: 'rgba(255,241,211,0.98)', borderColor: 'rgba(196,129,56,0.64)', borderRadius: 13, borderWidth: 1, bottom: 3, boxShadow: '0 2px 7px rgba(46,25,20,0.20)', flexDirection: 'row', height: 42, justifyContent: 'space-between', left: 3, paddingHorizontal: 5, position: 'absolute', right: 3 },
  orderItems: { alignItems: 'center', flexDirection: 'row', gap: 1 },
  orderItem: { height: 37, position: 'relative', width: 37 },
  quantityBadge: { alignItems: 'center', backgroundColor: '#A9581D', borderRadius: 999, bottom: 0, justifyContent: 'center', minWidth: 16, paddingHorizontal: 3, position: 'absolute', right: 0 },
  quantityText: { fontFamily: AppFontFamilies.manrope, fontSize: 7, fontWeight: '900' },
  serveMark: { alignItems: 'center', backgroundColor: 'rgba(116,83,60,0.12)', borderRadius: 999, flexDirection: 'row', gap: 2, height: 23, justifyContent: 'center', minWidth: 29, paddingHorizontal: 4 },
  serveMarkReady: { backgroundColor: '#6F8B3D', boxShadow: '0 2px 5px rgba(65,91,31,0.32)' },
  friendshipLevel: { fontFamily: AppFontFamilies.manrope, fontSize: 7.5, fontWeight: '900' },
  boardStage: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 0, paddingVertical: 1, position: 'relative' },
  expansionButton: { alignItems: 'center', backgroundColor: '#F5D488', borderColor: '#B8752C', borderRadius: 999, borderWidth: 1, boxShadow: '0 3px 8px rgba(55,28,13,0.3)', flexDirection: 'row', gap: 2, paddingHorizontal: 8, paddingVertical: 5, position: 'absolute', right: 5, top: 5, zIndex: 40 },
  expansionLabel: { fontFamily: AppFontFamilies.manrope, fontSize: 9, fontWeight: '900' },
  bottomDock: { alignItems: 'center', flexDirection: 'row', gap: 6, height: 61 },
  storageChest: { alignItems: 'center', backgroundColor: '#302A45', borderColor: '#D9A75E', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, boxShadow: '0 5px 12px rgba(27,17,28,0.32), inset 0 1px 0 rgba(255,255,255,0.10)', height: 57, justifyContent: 'center', position: 'relative', width: 60 },
  storageCount: { bottom: 2, fontFamily: AppFontFamilies.manrope, fontSize: 7.5, fontVariant: ['tabular-nums'], fontWeight: '900', position: 'absolute' },
  alertBadge: { alignItems: 'center', backgroundColor: '#C94F3C', borderColor: '#FFF0CE', borderRadius: 999, borderWidth: 1, height: 17, justifyContent: 'center', position: 'absolute', right: -3, top: -3, width: 17 },
  alertText: { fontFamily: AppFontFamilies.manrope, fontSize: 7.5, fontWeight: '900' },
  dockContent: { alignItems: 'center', backgroundColor: 'rgba(255,224,181,0.97)', borderColor: '#C8843E', borderCurve: 'continuous', borderRadius: 16, borderWidth: 1, boxShadow: '0 5px 12px rgba(39,22,24,0.28), inset 0 1px 0 rgba(255,250,235,0.78)', flex: 1, flexDirection: 'row', gap: 5, height: 57, minWidth: 0, paddingHorizontal: 9 },
  dockHint: { flex: 1, fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '800', lineHeight: 14, textAlign: 'center' },
  itemCopy: { flex: 1, minWidth: 0 },
  itemName: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 13, lineHeight: 16 },
  itemMeta: { fontFamily: AppFontFamilies.manrope, fontSize: 8.5, fontWeight: '700', textTransform: 'capitalize' },
  dockAction: { alignItems: 'center', backgroundColor: 'rgba(106,66,110,0.10)', borderRadius: 10, height: 34, justifyContent: 'center', width: 34 },
  storedItem: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  errorBanner: { alignSelf: 'center', backgroundColor: 'rgba(121,38,31,0.92)', borderRadius: 12, maxWidth: 360, paddingHorizontal: 12, paddingVertical: 7, position: 'absolute', zIndex: 80 },
  errorText: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, fontWeight: '700' },
  toast: { alignSelf: 'center', backgroundColor: '#FFF0CE', borderColor: '#C98435', borderRadius: 999, borderWidth: 1, boxShadow: '0 6px 16px rgba(55,28,13,0.34)', paddingHorizontal: 15, paddingVertical: 7, position: 'absolute', zIndex: 90 },
  toastText: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '900' },
  discovery: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#FFF0CE', borderColor: '#D79A4A', borderCurve: 'continuous', borderRadius: 20, borderWidth: 2, boxShadow: '0 16px 42px rgba(55,28,13,0.44)', gap: 2, paddingHorizontal: 28, paddingVertical: 17, position: 'absolute', top: '39%', zIndex: 100 },
  discoveryEyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  discoveryTitle: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 19 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
