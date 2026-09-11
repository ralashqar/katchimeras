import { memo, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { MergeOrderTrayCard } from '@/components/katchadeck/games/merge-order-rail';
import { MergeParcelFlightOverlay, type MergeParcelFlight } from '@/components/katchadeck/games/merge-parcel-overlay';
import type { RewardFlightPoint } from '@/components/katchadeck/ui/reward-token-flight';
import type { IslandCampaignDefinition } from '@/constants/island-campaigns/types';
import { AppFontFamilies } from '@/constants/theme';
import { mossproutNatureIslandById } from '@/constants/mossprout-nature-islands';
import { restorationDeliveryCells, restorationLayout, restorationProgress } from '@/features/island-restoration/island-restoration';
import type { FtueStepDefinition } from '@/features/onboarding/ftue-types';
import { mergeFtueAllowsCommand } from '@/features/onboarding/merge-ftue';
import { createMergeBoardSession } from '@/features/onboarding/merge-ftue-interaction-coordinator';
import type { MergeOrder, MergeWorldCommand, MergeWorldCommandResult, MergeWorldState, MossproutNatureIslandLevel } from '@/types/merge-world';
import { mergeCellCenter } from '@/utils/merge-world/board-geometry';
import { MistMissionDock } from './kingdom-opening-merge-dock';

/**
 * One delivered item's flight. The parcel flight restarts its animation
 * whenever its callbacks change identity, so each flight gets callbacks that
 * are stable for its lifetime; an inline closure here made the item hover
 * forever, re-arriving on every render and re-placing itself each time.
 */
const DeliveryFlight = memo(function DeliveryFlight({ flight, onFinish, onItemArrive }: {
  flight: MergeParcelFlight;
  onFinish: (nonce: number) => void;
  onItemArrive: (instanceId: string) => void;
}) {
  const finish = useCallback(() => onFinish(flight.nonce), [flight.nonce, onFinish]);
  return <MergeParcelFlightOverlay flight={flight} opening={false} onFinish={finish} onItemArrive={onItemArrive} />;
});

/** How far the tray row's bottom edge sits above the bar. */
const TRAY_LIFT = 4;
/** The card is 120 tall; the bubble's bottom sits beside its items, a little above the plate. */
const BUBBLE_RAISE = 18;

/**
 * What the friend says beside their request: a small bubble whose tail points
 * at the card. It fades in when it appears and out when it goes; a new line
 * (the request's, then the answer's once the delivery is in) crossfades.
 */
const FriendSpeechBubble = memo(function FriendSpeechBubble({ text, reduceMotion }: { text: string; reduceMotion: boolean }) {
  return <Animated.View key={text} entering={FadeIn.duration(reduceMotion ? 80 : 280).delay(reduceMotion ? 0 : 120)} exiting={FadeOut.duration(reduceMotion ? 60 : 180)}
    pointerEvents="none" style={styles.bubbleColumn}>
    <View style={styles.bubble}>
      <Text style={styles.bubbleText}>{text}</Text>
      <View style={styles.bubbleTail} />
    </View>
  </Animated.View>;
});

/**
 * A friend's restoration board under their island: the same dock the mist
 * missions use, counting merges (a match into a misted cell counts too).
 * Above the bar sits the friend's request as the Merge page's own tray card,
 * with what the friend has to say about it in a bubble beside it: while the
 * request is open on the Main Board a tap on the card leads there; once
 * served, the delivered items fly from the card's own item slots into the
 * board's free cells, the reverse of serving, and land on the board as each
 * one arrives. The board is put away from Back, not from a button of its own.
 */
export const IslandRestorationDock = memo(function IslandRestorationDock({
  campaign, level, state, send, merges, mergesRef, boardStep, order, orderServed, pendingDeliveries, speech, width, bottomInset, impactKey = 0,
  onMerge, onFinale, onBoardMetrics, onBlockedInteraction, onEntranceSettled, onOpenOrder, onPlaceDelivery, railTargetRefs,
}: {
  campaign: IslandCampaignDefinition;
  level: MossproutNatureIslandLevel;
  state: MergeWorldState;
  send: (command: MergeWorldCommand) => MergeWorldCommandResult | null;
  merges: number;
  /** The store's merge count as of the last command, readable in the same tick as `send`. */
  mergesRef: RefObject<number>;
  boardStep: FtueStepDefinition | null;
  /** The chapter's request once the board has asked for it; null before the checkpoint. */
  order: MergeOrder | null;
  orderServed: boolean;
  /** Delivered items not yet on the board, in delivery order. */
  pendingDeliveries: readonly string[];
  /** The friend's line about the request, shown beside the card while it is up. */
  speech?: string | null;
  width: number;
  bottomInset: number;
  impactKey?: number;
  /** Every merge sends the thing it made into the tile (a copy; the item stays on the board). */
  onMerge?: (from: RewardFlightPoint, definitionId: string) => void;
  /** The merge that fills the bar: its item leaves the board for the tile. */
  onFinale?: (from: RewardFlightPoint, definitionId: string) => void;
  onBoardMetrics?: (metrics: MergeBoardScreenMetrics | null) => void;
  onBlockedInteraction?: () => void;
  onEntranceSettled?: () => void;
  /** The tray card leads to the Main Board while the request is open there. */
  onOpenOrder?: () => void;
  /** A delivered item has landed in its cell. */
  onPlaceDelivery: (entry: { cell: number; definitionId: string }) => void;
  /** The Kingdom's rail target registry, so guidance can point at the request card. */
  railTargetRefs?: RefObject<Map<string, View>>;
}) {
  const reduceMotion = useReducedMotion();
  const sessionRef = useRef<ReturnType<typeof createMergeBoardSession> | null>(null);
  if (!sessionRef.current) sessionRef.current = createMergeBoardSession();
  const sessionId = sessionRef.current.id;
  const definition = campaign.chapters.find((candidate) => candidate.level === level)?.restoration ?? null;
  const required = definition?.merges ?? 1;
  const stateRef = useRef(state);
  const stepRef = useRef(boardStep);
  stateRef.current = state;
  stepRef.current = boardStep;
  const boardMetricsRef = useRef<MergeBoardScreenMetrics | null>(null);
  const [metricsReady, setMetricsReady] = useState(false);
  const handleMetrics = useCallback((metrics: MergeBoardScreenMetrics | null) => {
    boardMetricsRef.current = metrics;
    setMetricsReady(Boolean(metrics));
    onBoardMetrics?.(metrics);
  }, [onBoardMetrics]);
  const [hiddenItemIds, setHiddenItemIds] = useState<ReadonlySet<string>>(() => new Set());
  const dispatch = useCallback((command: MergeWorldCommand): MergeWorldCommandResult | null => {
    const current = stateRef.current;
    if (!mergeFtueAllowsCommand(stepRef.current, current, command)) {
      onBlockedInteraction?.();
      return null;
    }
    const effective = command.type === 'tapGenerator' ? { ...command, spendEnergy: false as const } : command;
    const result = send(effective);
    if (result) stateRef.current = result.state;
    if (!result?.changed || command.type !== 'move' || result.mergedCell == null) return result;
    const metrics = boardMetricsRef.current;
    if (!metrics) return result;
    const center = mergeCellCenter(metrics.geometry, result.mergedCell);
    const from = { x: metrics.x + center.x, y: metrics.y + center.y };
    const occupant = result.state.board[result.mergedCell]?.occupant;
    const made = occupant?.kind === 'item' ? occupant.definitionId : 'nature:garden:4';
    if ((mergesRef.current ?? 0) >= required) {
      if (occupant?.kind === 'item') setHiddenItemIds((hidden) => new Set([...hidden, occupant.instanceId]));
      onFinale?.(from, made);
    } else {
      onMerge?.(from, made);
    }
    return result;
  }, [mergesRef, onBlockedInteraction, onFinale, onMerge, required, send]);

  // The card's item slots, by index, so each delivered item can leave from its own slot.
  const itemNodesRef = useRef(new Map<number, View | null>());
  const registerRailTarget = useCallback((targetKey: string, view: View | null) => {
    const match = /^order-item:.*:(\d+)$/.exec(targetKey);
    if (match) itemNodesRef.current.set(Number(match[1]), view);
    if (railTargetRefs?.current) {
      if (view) railTargetRefs.current.set(targetKey, view);
      else railTargetRefs.current.delete(targetKey);
    }
  }, [railTargetRefs]);

  // The delivery flight: from the card's slots into the board's free cells,
  // one flight per item, each landing on the board the moment its copy arrives.
  const rootRef = useRef<View | null>(null);
  const [flights, setFlights] = useState<MergeParcelFlight[]>([]);
  const flightRef = useRef<{ entries: Map<string, { cell: number; definitionId: string }>; remaining: number } | null>(null);
  const nonceRef = useRef(0);
  const pendingKey = pendingDeliveries.join(',');
  useEffect(() => {
    if (!definition || !pendingDeliveries.length || !metricsReady || flightRef.current || !orderServed) return;
    const metrics = boardMetricsRef.current;
    const root = rootRef.current;
    const slots = pendingDeliveries.map((_, index) => itemNodesRef.current.get(index) ?? itemNodesRef.current.get(0) ?? null);
    if (!metrics || !root) return;
    const cells = restorationDeliveryCells(definition, stateRef.current, pendingDeliveries.length);
    if (cells.length < pendingDeliveries.length) return;
    // No card slot to fly from (the card was not measured): the items still land, quietly, rather than never.
    if (slots.some((slot) => !slot)) {
      pendingDeliveries.forEach((definitionId, index) => onPlaceDelivery({ cell: cells[index]!, definitionId }));
      return;
    }
    let cancelled = false;
    root.measureInWindow((rootX, rootY) => {
      Promise.all(slots.map((slot) => new Promise<{ x: number; y: number }>((resolve) => {
        slot!.measureInWindow((x, y, slotWidth, slotHeight) => resolve({ x: x - rootX + slotWidth / 2, y: y - rootY + slotHeight / 2 }));
      }))).then((origins) => {
        if (cancelled || flightRef.current) return;
        const entries = new Map<string, { cell: number; definitionId: string }>();
        const launched = pendingDeliveries.map((definitionId, index) => {
          const nonce = ++nonceRef.current;
          const instanceId = `delivery-flight:${nonce}`;
          entries.set(instanceId, { cell: cells[index]!, definitionId });
          const center = mergeCellCenter(metrics.geometry, cells[index]!);
          return { nonce, from: origins[index]!, items: [{ instanceId, definitionId, destinationSize: metrics.geometry.cellSize - 4, to: { x: metrics.x - rootX + center.x, y: metrics.y - rootY + center.y } }] };
        });
        flightRef.current = { entries, remaining: launched.length };
        setFlights(launched);
        if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      });
    });
    return () => { cancelled = true; };
  }, [definition, metricsReady, onPlaceDelivery, orderServed, pendingDeliveries, pendingKey]);
  const handleItemArrive = useCallback((instanceId: string) => {
    const entry = flightRef.current?.entries.get(instanceId);
    // Each copy lands once: the entry is consumed so a repeated arrival cannot place it twice.
    if (entry) {
      flightRef.current?.entries.delete(instanceId);
      onPlaceDelivery(entry);
    }
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onPlaceDelivery]);
  const finishFlight = useCallback((nonce: number) => {
    setFlights((current) => current.filter((flight) => flight.nonce !== nonce));
    if (flightRef.current && --flightRef.current.remaining <= 0) flightRef.current = null;
  }, []);

  const trayOpen = Boolean(order && !orderServed);
  // Served: the card stays up until every delivered item has flown off it, then fades.
  const trayDelivered = Boolean(order && orderServed && (pendingDeliveries.length || flights.length));
  const tray = order && (trayOpen || trayDelivered) ? (
    <View pointerEvents="box-none" style={styles.trayPanel}>
    <View pointerEvents="box-none" style={styles.trayRow}>
      {speech ? <FriendSpeechBubble text={speech} reduceMotion={reduceMotion} /> : null}
      <MergeOrderTrayCard
        animateEntrance={false}
        entry={{ id: order.id, kind: 'order', order, itemReadiness: order.requirements.flatMap((requirement) => Array.from({ length: requirement.quantity }, () => trayDelivered)), ready: false }}
        index={0}
        interactionAllowed
        interactionLocked={false}
        onPressCard={trayOpen ? onOpenOrder : undefined}
        onRailTargetRef={registerRailTarget}
        onReroll={() => {}}
        onServe={() => false}
        reduceMotion={reduceMotion}
      />
    </View>
    </View>
  ) : null;

  const progress = definition ? restorationProgress(definition, merges) : { current: 0, total: 1 };
  const islandName = mossproutNatureIslandById.get(campaign.islandId)?.name ?? 'the garden';
  return <MistMissionDock
    state={state} boardStep={boardStep} progress={progress.current} required={Math.max(1, progress.total)}
    layout={restorationLayout(definition?.rows ?? 4)} barTitle={`Drive the Mist from ${islandName}`}
    interactionKey={`restoration:${campaign.campaignId}:${level}:${boardStep?.id ?? 'free'}`} sessionId={sessionId} hiddenItemIds={hiddenItemIds}
    width={width} bottomInset={bottomInset} impactKey={impactKey}
    onCommand={dispatch} onBoardMetrics={handleMetrics} onBlockedInteraction={onBlockedInteraction} onEntranceSettled={onEntranceSettled}
    rootRef={rootRef} header={tray} headerGap={TRAY_LIFT}
    overlay={flights.map((flight) => <DeliveryFlight key={flight.nonce} flight={flight} onFinish={finishFlight} onItemArrive={handleItemArrive} />)} />;
});

const styles = StyleSheet.create({
  // Centred; the dock hangs it above the bar as an overlay, so the board never moves for it.
  // A low, dark panel gathers the bubble and the card into one section; its top clears the card's portrait.
  trayPanel: { alignSelf: 'stretch', borderRadius: 24, borderCurve: 'continuous', backgroundColor: 'rgba(22,16,40,0.26)', paddingTop: 18, paddingBottom: 10, paddingHorizontal: 10 },
  trayRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, paddingHorizontal: 4 },
  bubbleColumn: { flexShrink: 1, maxWidth: 220, marginBottom: BUBBLE_RAISE },
  bubble: {
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16, borderCurve: 'continuous',
    backgroundColor: '#F4F9FD', borderWidth: 1.5, borderColor: '#FFFFFF', boxShadow: '0 4px 14px rgba(20,40,60,0.16)',
  },
  bubbleText: { color: '#2E4A66', fontFamily: AppFontFamilies.fredokaBold, fontSize: 13, lineHeight: 17 },
  // The tail: a corner of the same bubble, turned to point at the card.
  bubbleTail: { position: 'absolute', right: -6, top: '50%', marginTop: -6, width: 12, height: 12, backgroundColor: '#F4F9FD', borderRightWidth: 1.5, borderTopWidth: 1.5, borderColor: '#FFFFFF', transform: [{ rotate: '45deg' }] },
});
