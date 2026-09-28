import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { ActivitySceneProps } from '@/features/activities/activity-scene';
import type { MergeWorldCommand } from '@/types/merge-world';
import type { MergeBoardScreenMetrics } from './feastle-persistent-merge-board';
import { SupplyRunDock, type SupplyRunOrder } from '../world/supply-run-dock';
import { MergeServeRewardOverlay, type MergeScreenPoint, type MergeServeRewardFlight } from './merge-serve-reward-overlay';
import { MergeFtueOverlay } from './merge-ftue-overlay';
import { cafeChains, createSupplyRunBoard, kitchenOpen, supplyOrder, supplyRunChains, supplyRunSlots } from '@/features/supply-run/supply-run';
import { cafeDropProfile, cafeMealsBonus, heroBuildingLevel, lodgeTimberBonus } from '@/constants/hero-buildings';
import { mergeOrderReady, mergeOrderServingCells } from '@/utils/merge-world/engine';
import { mergeCellCenter } from '@/utils/merge-world/board-geometry';
import { completeStoredSupplyOrder } from '@/utils/merge-world/repository';
import { useMissionBoard } from '@/features/onboarding/use-opening-mission-board';
import { sanctuaryChapterState } from '@/constants/sanctuary-chapters';
import type { FtueCueDefinition, FtueSpotlightDefinition, FtueTarget } from '@/features/onboarding/ftue-types';
import { FTUE_SCENE_LAYERS } from '@/constants/ftue-scene-layers';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { GameCurrencyHud } from '../ui/game-currency-hud';
import { KatchimeraBackButton } from '../ui/katchimera-back-button';
import { KatchaButton } from '../ui/katcha-button';

export function CafeActivity({ session, world: mergeWorld, active, rootRef: screenRef, width, bottomInset, topInset, onBoardMetrics, onReady, onLeave }: ActivitySceneProps) {
  const reduceMotion = useReducedMotion();
  const mergeWorldRef = useRef(mergeWorld);
  mergeWorldRef.current = mergeWorld;
  const glowCurrencyArtRef = useRef<View>(null);
  const timberCurrencyArtRef = useRef<View>(null);
  const mealsCurrencyArtRef = useRef<View>(null);
  const [openingBoardMetrics, setMetrics] = useState<MergeBoardScreenMetrics | null>(null);
  const [openingDockSettled, setDockSettled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [serving, setServing] = useState(false);
  const servingConsumed = useRef(false);
  const committing = useRef(false);
  const leavingRef = useRef(false);
  const setOpeningBoardMetrics = useCallback((metrics: MergeBoardScreenMetrics | null) => { setMetrics(metrics); onBoardMetrics(metrics); }, [onBoardMetrics]);
  const markOpeningDockSettled = useCallback(() => { setDockSettled(true); onReady(); }, [onReady]);
  const supplyRunDocked = true;
  const chapterState = useMemo(() => sanctuaryChapterState(mergeWorld), [mergeWorld]);
  const kitchen = kitchenOpen(mergeWorld);
  const createCafeBoard = useCallback((now: number) => createSupplyRunBoard(now, kitchen), [kitchen]);
  // v2: coffee is the Café's one drink chain (a board saved with juice on it starts fresh).
  const supplyRunStore = useMissionBoard('katchimeras.cafe.v3', kitchen ? 'kitchen' : 'supply-run', createCafeBoard);
  // The Café's and the Kitchen's buildings pour better pieces: their odds ride on every generator tap.
  const { send: cafeStoreSend, flush: flushCafe } = supplyRunStore;
  // The first visit's lesson remembers the first pour (tap the Ritual Bar) so it moves on to the merge.
  const [cafePoured, setCafePoured] = useState(false);
  const cafeSend = useCallback((command: MergeWorldCommand) => {
    if (!active || serving || leaving) return null;
    if (command.type === 'tapGenerator') setCafePoured(true);
    return cafeStoreSend(command.type === 'tapGenerator'
      ? { ...command, dropProfile: cafeDropProfile(mergeWorldRef.current, command.generatorId) } : command);
  }, [active, cafeStoreSend, leaving, serving]);
  const cafeRailRefs = useRef(new Map<string, View>());
  const [cafeRailRevision, setCafeRailRevision] = useState(0);
  const setCafeRailTarget = useCallback((key: string, view: View | null) => {
    if (view) cafeRailRefs.current.set(key, view); else cafeRailRefs.current.delete(key);
    setCafeRailRevision((revision) => revision + 1);
  }, []);
  // Orders ask only for what the board's spawners can make now (the live board's, else a fresh one's).
  const cafeChainKey = [...(supplyRunStore.state ? supplyRunChains(supplyRunStore.state) : cafeChains(kitchen))].sort().join('|');
  const supplyRunOrders = useMemo((): SupplyRunOrder[] => {
    const chains = new Set(cafeChainKey.split('|').filter(Boolean));
    return supplyRunSlots(mergeWorld).map((index, slot) => ({ slot: slot as 0 | 1, index, order: supplyOrder(slot as 0 | 1, index, kitchen, chains) }));
  }, [cafeChainKey, kitchen, mergeWorld]);
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
    if (committing.current) return false;
    committing.current = true; setError(null);
    try {
      if (!servingConsumed.current) {
        const served = cafeStoreSend({ type: 'serveBoardOrder', order: entry.order, now: Date.now() });
        if (!served?.changed) {
          supplyServingRef.current = null; setServing(false); setSupplyHiddenItemIds(new Set());
          return false;
        }
        servingConsumed.current = true;
      }
      // Complete the board save before paying and allowing the route to leave.
      // A failed payout can retry the same order receipt without consuming twice.
      await flushCafe();
      const { timber, meals } = supplyOrderPayout(entry);
      await completeStoredSupplyOrder(entry.slot, entry.index, timber, entry.order.reward.coins, undefined, meals, undefined, kitchen);
      supplyServingRef.current = null; servingConsumed.current = false;
      setServing(false); setSupplyHiddenItemIds(new Set());
      return true;
    } catch { setError('This order could not be saved. Tap to finish serving it.'); return false; }
    finally { committing.current = false; }
  }, [kitchen, supplyOrderPayout, cafeStoreSend, flushCafe]);
  const serveSupplyOrder = useCallback(async (entry: SupplyRunOrder, itemTargets: readonly MergeScreenPoint[]) => {
    const board = supplyRunStore.state;
    const metrics = openingBoardMetrics;
    if (!active || leaving || !board || supplyServingRef.current || !mergeOrderReady(board, entry.order)) return false;
    supplyServingRef.current = entry;
    setServing(true);
    const servingItems = mergeOrderServingCells(board, entry.order);
    const [screenRect, coinRect, timberRect, mealsRect] = await Promise.all([measureInScreen(screenRef.current), measureInScreen(glowCurrencyArtRef.current),
      measureInScreen(timberCurrencyArtRef.current), measureInScreen(mealsCurrencyArtRef.current)]);
    if (reduceMotion || !metrics || !screenRect || !coinRect || !itemTargets.length || servingItems.length !== itemTargets.length) return commitSupplyOrder(entry);
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
  }, [active, leaving, commitSupplyOrder, measureInScreen, openingBoardMetrics, reduceMotion, screenRef, supplyOrderPayout, supplyRunStore.state]);
  const supplyItemsArrived = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSupplyServeFlight((current) => current ? { ...current, phase: 'rewards' } : null);
  }, []);
  const supplyCoinArrived = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);
  const finishSupplyServe = useCallback(() => {
    const entry = supplyServingRef.current;
    setSupplyServeFlight(null);
    if (!entry) { setSupplyHiddenItemIds(new Set()); return; }
    void commitSupplyOrder(entry);
  }, [commitSupplyOrder]);
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

  const leaveCafe = useCallback(async (goalCompleted = false) => {
    if (supplyServingRef.current || leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true); setError(null);
    try { await flushCafe(); await onLeave({ goalCompleted }); }
    catch { leavingRef.current = false; setLeaving(false); setError('The Café could not be saved. Please try leaving again.'); }
  }, [onLeave, flushCafe]);
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => { void leaveCafe(); return true; });
    return () => back.remove();
  }, [leaveCafe]);
  const goalId = session.source.kind === 'cafe' ? session.source.goalId : null;
  useEffect(() => {
    if (!active || !goalId || chapterState?.goal?.id === goalId || serving || leaving) return;
    const timer = setTimeout(() => { void leaveCafe(true); }, 700);
    return () => clearTimeout(timer);
  }, [active, chapterState?.goal?.id, goalId, leaveCafe, leaving, serving]);
  return <>
    <View style={{ position: 'absolute', left: 16, right: 16, top: topInset + 8, zIndex: FTUE_SCENE_LAYERS.spotlight + 2, flexDirection: 'row', justifyContent: 'space-between' }}>
      <KatchimeraBackButton accessibilityLabel="Leave the Café" onPress={() => { void leaveCafe(); }} disabled={leaving || serving} />
      <GameCurrencyHud tone="glass" balances={[
        { id: 'meals', art: GAME_CURRENCY_ART.meals, artTargetRef: mealsCurrencyArtRef, value: mergeWorld.materials?.meals ?? 0 },
        { id: 'timber', art: GAME_CURRENCY_ART.timber, artTargetRef: timberCurrencyArtRef, value: mergeWorld.materials?.timber ?? 0 },
        { id: 'coins', art: GAME_CURRENCY_ART.coins, artTargetRef: glowCurrencyArtRef, value: mergeWorld.coins, animateValue: true },
      ]} />
    </View>
    <View style={StyleSheet.absoluteFill} pointerEvents={active && !leaving && !serving ? 'box-none' : 'none'}>
      {supplyRunDocked && supplyRunStore.state ? <SupplyRunDock strictReadiness state={supplyRunStore.state} send={cafeSend} orders={supplyRunOrders} bar={cafeBar} line={cafeLesson?.line ?? cafeAfterFirstLine}
        hiddenItemIds={supplyHiddenItemIds} servingOrderId={serving ? supplyServingRef.current?.order.id ?? null : null} onRailTargetRef={setCafeRailTarget}
        width={width} bottomInset={bottomInset} onServe={serveSupplyOrder} onBoardMetrics={setOpeningBoardMetrics} onEntranceSettled={markOpeningDockSettled}
        title={kitchen ? 'Feastle\u2019s Kitchen' : undefined} /> : null}
      {cafeLesson && openingDockSettled && !serving ? <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: FTUE_SCENE_LAYERS.spotlight }]}>
        <MergeFtueOverlay blockedPulseNonce={0} boardMetrics={openingBoardMetrics} cue={cafeLesson.cue} guide={null}
          layoutNonce={cafeRailRevision} railTargetRefs={cafeRailRefs} screenRef={screenRef} spotlight={cafeLesson.spotlight}
          state={supplyRunStore.state!} targetRevision={(supplyRunStore.state?.revision ?? 0) * 100 + cafeRailRevision} />
      </View> : null}
    </View>
    {supplyServeFlight ? <MergeServeRewardOverlay flight={supplyServeFlight} onItemsArrive={supplyItemsArrived} onCoinArrive={supplyCoinArrived} onEnergyArrive={() => undefined} onFinish={finishSupplyServe} /> : null}
    {error ? <View style={{ position: 'absolute', top: topInset + 65, left: 24, right: 24, zIndex: 150 }}><Text accessibilityRole="alert">{error}</Text><KatchaButton label="Try again" onPress={() => { if (supplyServingRef.current) void commitSupplyOrder(supplyServingRef.current); else void leaveCafe(); }} /></View> : null}
  </>;
}
