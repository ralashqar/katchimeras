import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import type { MergeScreenPoint } from '@/components/katchadeck/games/merge-serve-reward-overlay';
import { MergeOrderRail, type MergeTrayEntry } from '@/components/katchadeck/games/merge-order-rail';
import { ServiceCounter } from '@/components/katchadeck/games/merge-play-surface';
import { createMergeBoardSession } from '@/features/onboarding/merge-ftue-interaction-coordinator';
import type { MissionCommandResult } from '@/features/onboarding/use-opening-mission-board';
import type { supplyOrder } from '@/features/supply-run/supply-run';
import type { MergeOrder, MergeWorldCommand, MergeWorldState } from '@/types/merge-world';
import { mergeOrderItemReadiness, mergeOrderReady } from '@/utils/merge-world/engine';
import { FriendSpeechBubble, type SpeechLine } from './friend-speech-bubble';
import { MistMissionDock } from './kingdom-opening-merge-dock';

export type SupplyRunOrder = { slot: 0 | 1; index: number; order: ReturnType<typeof supplyOrder> };

/** Orders filled toward the bar's crate. */

/**
 * The Supply Run's dock (`features/supply-run/supply-run.ts`): the board with no wisps, and above it the two orders the
 * Sanctuary's friends have posted, as the Merge page's own tray cards. A card's items tick off as they are made; once
 * ready, Serve sends them off the board, each into its own slot on the card (the Merge page's own serve flight, run
 * by the host over the whole screen), and the order pays out. What the first friend wants is said beside the cards.
 * Back (in the top bar) puts the board away; it keeps everything for next time.
 */
export const SupplyRunDock = memo(function SupplyRunDock({
  state, send, orders, width, bottomInset, onServe, onBoardMetrics, onEntranceSettled, hiddenItemIds, servingOrderId, title, bar, line, onRailTargetRef,
}: {
  state: MergeWorldState;
  send: (command: MergeWorldCommand) => MissionCommandResult | null;
  orders: readonly SupplyRunOrder[];
  /** The bar: the chapter goal's count when the goal is the Café's (Serve 3 orders); none otherwise. */
  bar: { progress: number; required: number } | null;
  /** What is said over the cards: Baristabbit teaching (the first order), else the first friend's own line. */
  line?: SpeechLine | null;
  /** Each card's targets (the serve button) for the first order's guidance. */
  onRailTargetRef?: (targetKey: string, view: View | null) => void;
  width: number;
  bottomInset: number;
  /** Serve: the card's item slots on screen, in requirement order, are where the served items fly to. */
  onServe: (order: SupplyRunOrder, itemTargets: readonly MergeScreenPoint[]) => Promise<boolean> | boolean;
  /** The bar's title: Baristabbit's Caf\u00e9 until Feastle makes it a Kitchen. */
  title?: string;
  /** Pieces on their way to a card: hidden on the board while their copies fly. */
  hiddenItemIds?: ReadonlySet<string>;
  /** The order whose items are in flight: its card shows it, and no other can be served meanwhile. */
  servingOrderId?: string | null;
  onBoardMetrics?: (metrics: MergeBoardScreenMetrics | null) => void;
  onEntranceSettled?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const sessionRef = useRef<ReturnType<typeof createMergeBoardSession> | null>(null);
  if (!sessionRef.current) sessionRef.current = createMergeBoardSession();
  const [noneHidden] = useState<ReadonlySet<string>>(() => new Set());
  // The Pod on a calm board costs nothing to tap.
  const dispatch = useCallback((command: MergeWorldCommand) => send(command.type === 'tapGenerator' ? { ...command, spendEnergy: false } : command), [send]);
  const serve = useCallback((entry: SupplyRunOrder, itemTargets: readonly MergeScreenPoint[]) => (servingOrderId ? false : onServe(entry, itemTargets)), [onServe, servingOrderId]);
  const first = orders[0]?.order;
  // The Merge page's own tray (as it was): the orders on a horizontal rail of tray cards, sitting on the full-width
  // service counter, right above the board. The first friend's (or Baristabbit's) line is said over it.
  const entries = useMemo((): MergeTrayEntry[] => orders.map((entry) => ({
    id: entry.order.id, kind: 'order', order: entry.order, itemReadiness: mergeOrderItemReadiness(state, entry.order), ready: mergeOrderReady(state, entry.order),
  })), [orders, state]);
  const serveOrder = useCallback((order: MergeOrder, itemTargets: readonly MergeScreenPoint[]) => {
    const entry = orders.find((candidate) => candidate.order.id === order.id);
    return entry ? serve(entry, itemTargets) : false;
  }, [orders, serve]);
  const parcelRef = useRef<View | null>(null);
  const noop = useCallback(() => undefined, []);
  const tray = <View pointerEvents="box-none" style={styles.traySection}>
    {first ? <View pointerEvents="none" style={styles.bubble}><FriendSpeechBubble text={line ?? first.line} reduceMotion={reduceMotion} tail="none" /></View> : null}
    <MergeOrderRail entries={entries} servingOrderId={servingOrderId ?? null} onOpenChat={noop} onOpenParcel={noop} onReroll={noop}
      onServe={serveOrder} onRailTargetRef={onRailTargetRef} parcelTargetRef={parcelRef} />
    <ServiceCounter viewportWidth={width} />
  </View>;
  return <MistMissionDock
    state={state} boardStep={null} progress={bar?.progress ?? 0} required={bar?.required ?? 1} hideBar={!bar} barTitle={title ?? "Baristabbit’s Café"}
    interactionKey="supply-run" sessionId={sessionRef.current.id} hiddenItemIds={hiddenItemIds ?? noneHidden}
    width={width} bottomInset={bottomInset}
    onCommand={dispatch} onBoardMetrics={onBoardMetrics} onEntranceSettled={onEntranceSettled}
    header={tray} headerGap={4} />;
});

const styles = StyleSheet.create({
  traySection: { alignSelf: 'stretch', alignItems: 'stretch' },
  bubble: { alignItems: 'center', marginBottom: 6 },
});
