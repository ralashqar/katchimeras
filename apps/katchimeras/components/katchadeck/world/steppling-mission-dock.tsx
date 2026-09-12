import { memo, useCallback, useMemo, useRef, useState, type RefObject } from 'react';

import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import type { RewardFlightPoint } from '@/components/katchadeck/ui/reward-token-flight';
import { mergeFtueAllowsCommand, mergeFtueEventForCommand } from '@/features/onboarding/merge-ftue';
import { createMergeBoardSession } from '@/features/onboarding/merge-ftue-interaction-coordinator';
import { STEPPLING_MISSION_MERGE_REQUIRED, stepplingMissionBoardStep, stepplingMissionProgress } from '@/features/onboarding/steppling-mission';
import type { MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import { mergeCellCenter } from '@/utils/merge-world/board-geometry';
import { MistMissionDock, type GlowLandingSource } from './kingdom-opening-merge-dock';

/**
 * Steppling's mission board under the misted clearing: the same dock the
 * opening used, on its own board with Steppling's walking gear and the Journey
 * Locker. Progress is the mission store's own merge count, not an FTUE run:
 * the Glow discovery story only hears about the bar filling.
 */
export const StepplingMissionDock = memo(function StepplingMissionDock({ state, send, merges, mergesRef, width, bottomInset, landings, onGlow, onFinale, onBoardMetrics, onBlockedInteraction, onEntranceSettled }: {
  state: MergeWorldState;
  send: (command: MergeWorldCommand) => MergeWorldCommandResult | null;
  merges: number;
  /** The store's merge count as of the last command, readable in the same tick as `send`. */
  mergesRef: RefObject<number>;
  width: number;
  bottomInset: number;
  landings?: GlowLandingSource;
  onGlow?: (from: RewardFlightPoint) => void;
  /** The merge that fills the bar: its item leaves the board for the mist. */
  onFinale?: (from: RewardFlightPoint, definitionId: string) => void;
  onBoardMetrics?: (metrics: MergeBoardScreenMetrics | null) => void;
  onBlockedInteraction?: () => void;
  onEntranceSettled?: () => void;
}) {
  const sessionRef = useRef<ReturnType<typeof createMergeBoardSession> | null>(null);
  if (!sessionRef.current) sessionRef.current = createMergeBoardSession();
  const sessionId = sessionRef.current.id;
  const boardStep = useMemo(() => stepplingMissionBoardStep(state, merges), [merges, state]);
  const stateRef = useRef(state);
  const stepRef = useRef(boardStep);
  stateRef.current = state;
  stepRef.current = boardStep;
  const boardMetricsRef = useRef<MergeBoardScreenMetrics | null>(null);
  const handleMetrics = useCallback((metrics: MergeBoardScreenMetrics | null) => {
    boardMetricsRef.current = metrics;
    onBoardMetrics?.(metrics);
  }, [onBoardMetrics]);
  const [hiddenItemIds, setHiddenItemIds] = useState<ReadonlySet<string>>(() => new Set());
  const dispatch = useCallback((command: MergeWorldCommand): MergeWorldCommandResult | null => {
    const current = stateRef.current;
    if (!mergeFtueAllowsCommand(stepRef.current, current, command)) {
      onBlockedInteraction?.();
      return null;
    }
    // A mission has no Energy economy; a Locker tap is never refused for it.
    const effective = command.type === 'tapGenerator' ? { ...command, spendEnergy: false as const } : command;
    const result = send(effective);
    if (result) stateRef.current = result.state;
    const event = mergeFtueEventForCommand(current, command, result);
    if (!result || event?.type !== 'merge_completed') return result;
    const metrics = boardMetricsRef.current;
    if (!metrics) return result;
    const center = mergeCellCenter(metrics.geometry, event.resultCell);
    const from = { x: metrics.x + center.x, y: metrics.y + center.y };
    if ((mergesRef.current ?? 0) >= STEPPLING_MISSION_MERGE_REQUIRED) {
      const occupant = result.state.board[event.resultCell]?.occupant;
      if (occupant?.kind === 'item') setHiddenItemIds((hidden) => new Set([...hidden, occupant.instanceId]));
      onFinale?.(from, event.resultDefinitionId);
    } else {
      onGlow?.(from);
    }
    return result;
  }, [mergesRef, onBlockedInteraction, onFinale, onGlow, send]);

  return <MistMissionDock
    state={state} boardStep={boardStep} progress={stepplingMissionProgress(merges)} required={STEPPLING_MISSION_MERGE_REQUIRED}
    interactionKey={`steppling-mission:${boardStep?.id ?? 'free'}`} sessionId={sessionId} hiddenItemIds={hiddenItemIds}
    width={width} bottomInset={bottomInset} landings={landings}
    onCommand={dispatch} onBoardMetrics={handleMetrics} onBlockedInteraction={onBlockedInteraction} onEntranceSettled={onEntranceSettled} />;
});
