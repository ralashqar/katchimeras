import { memo, useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import type { MergeScreenPoint } from '@/components/katchadeck/games/merge-serve-reward-overlay';
import { MergeOrderTrayCard } from '@/components/katchadeck/games/merge-order-rail';
import { createMergeBoardSession } from '@/features/onboarding/merge-ftue-interaction-coordinator';
import type { MissionCommandResult } from '@/features/onboarding/use-opening-mission-board';
import { SUPPLY_CRATE, type supplyOrder } from '@/features/supply-run/supply-run';
import type { MergeWorldCommand, MergeWorldState } from '@/types/merge-world';
import { mergeOrderItemReadiness, mergeOrderReady } from '@/utils/merge-world/engine';
import { FriendSpeechBubble } from './friend-speech-bubble';
import { MistMissionDock } from './kingdom-opening-merge-dock';

export type SupplyRunOrder = { slot: 0 | 1; index: number; order: ReturnType<typeof supplyOrder> };

/** Orders filled toward the bar's crate. */
const CRATE = SUPPLY_CRATE.every;

/**
 * The Supply Run's dock (`features/supply-run/supply-run.ts`): the board with no wisps, and above it the two orders the
 * Sanctuary's friends have posted, as the Merge page's own tray cards. A card's items tick off as they are made; once
 * ready, Serve sends them off the board, each into its own slot on the card (the Merge page's own serve flight, run
 * by the host over the whole screen), and the order pays out. What the first friend wants is said beside the cards.
 * Done puts the board away; it keeps everything for next time.
 */
export const SupplyRunDock = memo(function SupplyRunDock({
  state, send, orders, served, width, bottomInset, onServe, onBoardMetrics, onEntranceSettled, onClose, hiddenItemIds, servingOrderId, crateFull = false,
}: {
  state: MergeWorldState;
  send: (command: MergeWorldCommand) => MissionCommandResult | null;
  orders: readonly SupplyRunOrder[];
  served: number;
  width: number;
  bottomInset: number;
  /** Serve: the card's item slots on screen, in requirement order, are where the served items fly to. */
  onServe: (order: SupplyRunOrder, itemTargets: readonly MergeScreenPoint[]) => Promise<boolean> | boolean;
  /** Pieces on their way to a card: hidden on the board while their copies fly. */
  hiddenItemIds?: ReadonlySet<string>;
  /** The order whose items are in flight: its card shows it, and no other can be served meanwhile. */
  servingOrderId?: string | null;
  /** A crate was just filled: the bar stays full until the run closes. */
  crateFull?: boolean;
  onBoardMetrics?: (metrics: MergeBoardScreenMetrics | null) => void;
  onEntranceSettled?: () => void;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const sessionRef = useRef<ReturnType<typeof createMergeBoardSession> | null>(null);
  if (!sessionRef.current) sessionRef.current = createMergeBoardSession();
  const [noneHidden] = useState<ReadonlySet<string>>(() => new Set());
  // The Pod on a calm board costs nothing to tap.
  const dispatch = useCallback((command: MergeWorldCommand) => send(command.type === 'tapGenerator' ? { ...command, spendEnergy: false } : command), [send]);
  const serve = useCallback((entry: SupplyRunOrder, itemTargets: readonly MergeScreenPoint[]) => (servingOrderId ? false : onServe(entry, itemTargets)), [onServe, servingOrderId]);
  const first = orders[0]?.order;
  const tray = <View pointerEvents="box-none" style={styles.trayPanel}>
    {first ? <View pointerEvents="none" style={styles.bubble}><FriendSpeechBubble text={first.line} reduceMotion={reduceMotion} /></View> : null}
    <View pointerEvents="box-none" style={styles.trayRow}>
      {orders.map((entry, index) => {
        const ready = mergeOrderReady(state, entry.order);
        // Keyed by the card, not the order: the friend stays at their card, and only what they ask for changes.
        return <MergeOrderTrayCard
          key={`supply-card:${entry.slot}`}
          animateEntrance={false}
          entry={{ id: entry.order.id, kind: 'order', order: entry.order, itemReadiness: mergeOrderItemReadiness(state, entry.order), ready }}
          index={index}
          interactionAllowed
          interactionLocked={Boolean(servingOrderId)}
          serveInFlight={servingOrderId === entry.order.id}
          onReroll={() => {}}
          onServe={(itemTargets) => serve(entry, itemTargets)}
          reduceMotion={reduceMotion}
        />;
      })}
    </View>
  </View>;
  return <MistMissionDock
    state={state} boardStep={null} progress={served > 0 && served % CRATE === 0 && crateFull ? CRATE : served % CRATE} required={CRATE} barTitle="Supplies for the Sanctuary"
    interactionKey="supply-run" sessionId={sessionRef.current.id} hiddenItemIds={hiddenItemIds ?? noneHidden}
    width={width} bottomInset={bottomInset}
    onCommand={dispatch} onBoardMetrics={onBoardMetrics} onEntranceSettled={onEntranceSettled}
    onClose={onClose} closeLabel="Done"
    header={tray} headerGap={4} />;
});

const styles = StyleSheet.create({
  trayPanel: { alignSelf: 'stretch', borderRadius: 24, borderCurve: 'continuous', backgroundColor: 'rgba(22,16,40,0.26)', paddingTop: 10, paddingBottom: 10, paddingHorizontal: 10, gap: 6 },
  bubble: { alignItems: 'center' },
  trayRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10 },
});
