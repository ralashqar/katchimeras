import { memo, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { PersistentMergeItemArt } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import { MergeParcelFlightOverlay, type MergeParcelFlight } from '@/components/katchadeck/games/merge-parcel-overlay';
import type { RewardFlightPoint } from '@/components/katchadeck/ui/reward-token-flight';
import type { IslandCampaignDefinition } from '@/constants/island-campaigns/types';
import { mossproutNatureIslandById } from '@/constants/mossprout-nature-islands';
import { KatchaDeckUI } from '@/constants/theme';
import { restorationDeliveryCells, restorationLayout, restorationProgress } from '@/features/island-restoration/island-restoration';
import type { FtueStepDefinition } from '@/features/onboarding/ftue-types';
import { mergeFtueAllowsCommand } from '@/features/onboarding/merge-ftue';
import { createMergeBoardSession } from '@/features/onboarding/merge-ftue-interaction-coordinator';
import type { MergeOrder, MergeWorldCommand, MergeWorldCommandResult, MergeWorldState, MossproutNatureIslandLevel } from '@/types/merge-world';
import { mergeCellCenter } from '@/utils/merge-world/board-geometry';
import { MistMissionDock } from './kingdom-opening-merge-dock';

const TRAY_ITEM_SIZE = 40;

/**
 * A friend's restoration board under their island: the same dock the mist
 * missions use, counting merges (a match into a misted cell counts too).
 * Above the bar sits the friend's request as a tray card: while it is open on
 * the Main Board it leads there; once served, the delivered items fly from
 * the tray into the board's free cells, the reverse of serving on the Merge
 * page, and only land on the board as each one arrives.
 */
export const IslandRestorationDock = memo(function IslandRestorationDock({
  campaign, level, state, send, merges, mergesRef, boardStep, order, orderServed, pendingDeliveries, width, bottomInset, impactKey = 0,
  onMerge, onFinale, onBoardMetrics, onBlockedInteraction, onEntranceSettled, onClose, onOpenOrder, onPlaceDelivery,
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
  /** The board is optional: put it away and come back from the island's marker. */
  onClose?: () => void;
  /** The tray card leads to the Main Board while the request is open there. */
  onOpenOrder?: () => void;
  /** A delivered item has landed in its cell. */
  onPlaceDelivery: (entry: { cell: number; definitionId: string }) => void;
}) {
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

  // The delivery flight: from the tray's chips into the board's free cells,
  // each item landing on the board the moment its copy arrives.
  const rootRef = useRef<View | null>(null);
  const chipRef = useRef<View | null>(null);
  const [flight, setFlight] = useState<MergeParcelFlight | null>(null);
  const flightRef = useRef<{ nonce: number; entries: Map<string, { cell: number; definitionId: string }> } | null>(null);
  const nonceRef = useRef(0);
  const [flying, setFlying] = useState(false);
  const pendingKey = pendingDeliveries.join(',');
  useEffect(() => {
    if (!definition || !pendingDeliveries.length || !metricsReady || flightRef.current || !orderServed) return;
    const metrics = boardMetricsRef.current;
    const root = rootRef.current;
    const chip = chipRef.current;
    if (!metrics || !root || !chip) return;
    const cells = restorationDeliveryCells(definition, stateRef.current, pendingDeliveries.length);
    if (cells.length < pendingDeliveries.length) return;
    let cancelled = false;
    root.measureInWindow((rootX, rootY) => {
      chip.measureInWindow((chipX, chipY, chipWidth, chipHeight) => {
        if (cancelled || flightRef.current) return;
        const nonce = ++nonceRef.current;
        const entries = new Map<string, { cell: number; definitionId: string }>();
        const items = pendingDeliveries.map((definitionId, index) => {
          const instanceId = `delivery-flight:${nonce}:${index}`;
          entries.set(instanceId, { cell: cells[index]!, definitionId });
          const center = mergeCellCenter(metrics.geometry, cells[index]!);
          return { instanceId, definitionId, destinationSize: metrics.geometry.cellSize - 4, to: { x: metrics.x - rootX + center.x, y: metrics.y - rootY + center.y } };
        });
        flightRef.current = { nonce, entries };
        setFlying(true);
        setFlight({ nonce, from: { x: chipX - rootX + chipWidth / 2, y: chipY - rootY + chipHeight / 2 }, items });
        if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      });
    });
    return () => { cancelled = true; };
  }, [definition, metricsReady, orderServed, pendingDeliveries, pendingKey]);
  const handleItemArrive = useCallback((instanceId: string) => {
    const entry = flightRef.current?.entries.get(instanceId);
    if (entry) onPlaceDelivery(entry);
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onPlaceDelivery]);
  const finishFlight = useCallback(() => {
    flightRef.current = null;
    setFlight(null);
    setFlying(false);
  }, []);

  const trayItems = orderServed && pendingDeliveries.length ? pendingDeliveries : order
    ? order.requirements.flatMap((requirement) => Array.from({ length: requirement.quantity }, () => requirement.definitionId))
    : [];
  const trayOpen = Boolean(order && !orderServed);
  const tray = order && trayItems.length && (trayOpen || (orderServed && pendingDeliveries.length)) ? (
    <Pressable
      accessibilityRole={trayOpen ? 'button' : undefined}
      accessibilityLabel={trayOpen ? `${campaign.residentName}’s request: ${order.title}. Opens the Merge board.` : `${campaign.residentName}’s delivery has arrived.`}
      disabled={!trayOpen}
      onPress={trayOpen ? onOpenOrder : undefined}
      style={({ pressed }) => [styles.tray, pressed && trayOpen ? styles.trayPressed : null]}>
      <View style={styles.trayText}>
        <Text numberOfLines={1} style={styles.trayTitle}>{trayOpen ? order.title : 'Delivered'}</Text>
        <Text numberOfLines={1} style={styles.trayHint}>{trayOpen ? 'Requested in Merge · Tap to go' : 'Into the patch it goes'}</Text>
      </View>
      <View ref={chipRef} collapsable={false} style={[styles.chips, flying ? styles.chipsFlying : null]}>
        {trayItems.map((definitionId, index) => <View key={`${definitionId}:${index}`} style={styles.chip}>
          <PersistentMergeItemArt definitionId={definitionId} size={TRAY_ITEM_SIZE - 8} />
        </View>)}
      </View>
    </Pressable>
  ) : null;

  const progress = definition ? restorationProgress(definition, merges) : { current: 0, total: 1 };
  const islandName = mossproutNatureIslandById.get(campaign.islandId)?.name ?? 'the garden';
  return <MistMissionDock
    state={state} boardStep={boardStep} progress={progress.current} required={Math.max(1, progress.total)}
    layout={restorationLayout(definition?.rows ?? 4)} barTitle={`Restore ${islandName}`}
    interactionKey={`restoration:${campaign.campaignId}:${level}:${boardStep?.id ?? 'free'}`} sessionId={sessionId} hiddenItemIds={hiddenItemIds}
    width={width} bottomInset={bottomInset} impactKey={impactKey}
    onCommand={dispatch} onBoardMetrics={handleMetrics} onBlockedInteraction={onBlockedInteraction} onEntranceSettled={onEntranceSettled}
    onClose={onClose} closeLabel="Later" rootRef={rootRef} header={tray}
    overlay={<MergeParcelFlightOverlay flight={flight} opening={false} onFinish={finishFlight} onItemArrive={handleItemArrive} />} />;
});

const styles = StyleSheet.create({
  tray: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    backgroundColor: '#F4F9FD', borderWidth: 1.5, borderColor: '#FFFFFF', boxShadow: '0 4px 14px rgba(20,40,60,0.16)',
  },
  trayPressed: { opacity: 0.86 },
  trayText: { flex: 1, gap: 1 },
  trayTitle: { ...KatchaDeckUI.typography.ftuePanelTitle, color: '#2E4A66' },
  trayHint: { color: '#5B7390', fontSize: 12, lineHeight: 15, fontWeight: '700' },
  chips: { flexDirection: 'row', gap: 6 },
  chipsFlying: { opacity: 0 },
  chip: { width: TRAY_ITEM_SIZE, height: TRAY_ITEM_SIZE, borderRadius: TRAY_ITEM_SIZE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(143,211,255,0.22)', borderWidth: 1.5, borderColor: '#FFFFFF' },
});
