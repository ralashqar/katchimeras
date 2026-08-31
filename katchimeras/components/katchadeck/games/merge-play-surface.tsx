import { memo, useCallback, useState, type RefObject } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';

import type { MergeBoardInteractionGate, MergeRailInteractionGate } from '@/features/onboarding/merge-ftue';
import type { MergeBoardSessionId } from '@/features/onboarding/merge-ftue-interaction-coordinator';
import type { MergeCharacterId, MergeOrder, MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';

import { FeastlePersistentMergeBoard, type MergeBoardLayout, type MergeBoardScreenMetrics } from './feastle-persistent-merge-board';
import { MergeCellInspector } from './merge-cell-inspector';
import { MergeOrderRail, type MergeTrayEntry } from './merge-order-rail';
import type { MergeScreenPoint } from './merge-serve-reward-overlay';

export type MergePlaySurfaceLayout = {
  boardHeight: number;
  height: number;
  width: number;
};

export type MergePlaySurfaceProps = {
  animateEntrance?: boolean;
  boardInteractionGate?: MergeBoardInteractionGate;
  boardLayout?: MergeBoardLayout;
  focusOrderId?: string;
  hiddenItemInstanceIds?: ReadonlySet<string>;
  inspectedCell: number | null;
  interactionEnabled?: boolean;
  interactionSessionKey?: string;
  maxHeight?: number;
  onBlockedInteraction?: () => void;
  onBoardAreaHeight?: (height: number) => void;
  onBoardRelease?: () => void;
  onCommand: (command: MergeWorldCommand) => MergeWorldCommandResult | null;
  onHiddenItemsRetired?: (instanceIds: readonly string[]) => void;
  onInspectMist?: (cell: number) => void;
  onInspectRootbound?: (gateId: string) => void;
  onLayoutMetrics?: (layout: MergePlaySurfaceLayout) => void;
  onOpenChat: (characterId: MergeCharacterId, noteId: string) => void;
  onOpenParcel: (arrivalId: string) => void;
  onRailTargetRef?: (targetKey: string, view: View | null) => void;
  onReroll: Parameters<typeof MergeOrderRail>[0]['onReroll'];
  onScreenMetrics?: (metrics: MergeBoardScreenMetrics) => void;
  onSelect: (cell: number | null) => void;
  onServe: (order: MergeOrder, itemTargets: readonly MergeScreenPoint[]) => Promise<boolean> | boolean;
  onUseGrovelight: (gateId: string) => void;
  onVisualReady?: () => void;
  parcelTargetRef: RefObject<View | null>;
  railInteractionGate?: MergeRailInteractionGate;
  screenMetricsRevision?: number;
  selectedCell: number | null;
  sessionId: MergeBoardSessionId;
  state: MergeWorldState;
  style?: ViewStyle;
  trayEntries: readonly MergeTrayEntry[];
  width: number;
};

/**
 * The canonical Merge play surface. Both the dedicated route and Haven mount
 * this exact rail/counter/board/inspector stack so their geometry cannot drift.
 */
export const MergePlaySurface = memo(function MergePlaySurface({
  animateEntrance = true,
  boardInteractionGate = { kind: 'open' },
  boardLayout,
  focusOrderId,
  hiddenItemInstanceIds,
  inspectedCell,
  interactionEnabled = true,
  interactionSessionKey = 'open',
  maxHeight,
  onBlockedInteraction,
  onBoardAreaHeight,
  onBoardRelease,
  onCommand,
  onHiddenItemsRetired,
  onInspectMist,
  onInspectRootbound,
  onLayoutMetrics,
  onOpenChat,
  onOpenParcel,
  onRailTargetRef,
  onReroll,
  onScreenMetrics,
  onSelect,
  onServe,
  onUseGrovelight,
  onVisualReady,
  parcelTargetRef,
  railInteractionGate = { kind: 'open' },
  screenMetricsRevision = 0,
  selectedCell,
  sessionId,
  state,
  style,
  trayEntries,
  width,
}: MergePlaySurfaceProps) {
  const [boardAreaHeight, setBoardAreaHeight] = useState(0);
  const measureBoardArea = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.height);
    setBoardAreaHeight((current) => current === next ? current : next);
    onBoardAreaHeight?.(next);
  }, [onBoardAreaHeight]);
  const measureSurface = useCallback((event: LayoutChangeEvent) => {
    const { height, width: measuredWidth } = event.nativeEvent.layout;
    onLayoutMetrics?.({ boardHeight: boardAreaHeight, height, width: measuredWidth });
  }, [boardAreaHeight, onLayoutMetrics]);

  return (
    <View
      accessibilityElementsHidden={!interactionEnabled}
      importantForAccessibility={interactionEnabled ? 'auto' : 'no-hide-descendants'}
      onLayout={measureSurface}
      pointerEvents={interactionEnabled ? 'auto' : 'none'}
      style={[styles.surface, maxHeight == null ? styles.flexSurface : { height: maxHeight }, { width }, style]}>
      <MergeOrderRail
        entries={[...trayEntries]}
        focusOrderId={focusOrderId}
        interactionGate={railInteractionGate}
        onBlockedInteraction={onBlockedInteraction}
        onOpenChat={onOpenChat}
        onOpenParcel={onOpenParcel}
        onRailTargetRef={onRailTargetRef}
        onReroll={onReroll}
        onServe={onServe}
        parcelTargetRef={parcelTargetRef}
      />
      <ServiceCounter viewportWidth={width} />
      <View onLayout={measureBoardArea} style={styles.boardStage}>
        {boardAreaHeight > 0 ? (
          <FeastlePersistentMergeBoard
            animateEntrance={animateEntrance}
            hiddenItemInstanceIds={hiddenItemInstanceIds}
            interactionGate={boardInteractionGate}
            interactionSessionKey={interactionSessionKey}
            layout={boardLayout}
            maxHeight={boardAreaHeight - 1}
            onBlockedInteraction={onBlockedInteraction}
            onBoardRelease={onBoardRelease}
            onCommand={onCommand}
            onHiddenItemsRetired={onHiddenItemsRetired}
            onInspectMist={onInspectMist}
            onInspectRootbound={onInspectRootbound}
            onScreenMetrics={onScreenMetrics}
            onSelect={onSelect}
            onVisualReady={onVisualReady}
            screenMetricsRevision={screenMetricsRevision}
            selectedCell={selectedCell}
            sessionId={sessionId}
            state={state}
            width={width}
          />
        ) : null}
      </View>
      <MergeCellInspector cell={inspectedCell} onUseGrovelight={onUseGrovelight} state={state} />
    </View>
  );
});

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

const styles = StyleSheet.create({
  surface: { minHeight: 0, position: 'relative' },
  flexSurface: { flex: 1 },
  serviceCounter: { alignSelf: 'center', height: 32, marginTop: -29, position: 'relative', zIndex: 1 },
  counterUpperLip: { backgroundColor: '#FFE876', height: 3, left: 0, position: 'absolute', right: 0, top: 0 },
  counterInsetShade: { backgroundColor: '#A64F32', height: 5, left: 0, position: 'absolute', right: 0, top: 3 },
  counterFaceEdge: { backgroundColor: '#FFE36A', height: 3, left: 0, position: 'absolute', right: 0, top: 8 },
  counterFace: { backgroundColor: '#EEA621', bottom: 5, left: 0, position: 'absolute', right: 0, top: 11 },
  counterLowerEdge: { backgroundColor: '#CB701D', bottom: 2, height: 3, left: 0, position: 'absolute', right: 0 },
  counterLowerFlat: { backgroundColor: '#8F4932', bottom: 0, height: 2, left: 0, position: 'absolute', right: 0 },
  boardStage: { alignItems: 'center', elevation: 0, flex: 1, justifyContent: 'flex-start', minHeight: 0, position: 'relative', zIndex: 0 },
});
