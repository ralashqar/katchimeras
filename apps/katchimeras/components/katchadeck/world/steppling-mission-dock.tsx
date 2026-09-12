import { memo, useCallback, useMemo, useRef, useState, type RefObject } from 'react';

import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import type { RewardFlightPoint } from '@/components/katchadeck/ui/reward-token-flight';
import { mergeFtueAllowsCommand, mergeFtueEventForCommand } from '@/features/onboarding/merge-ftue';
import { createMergeBoardSession } from '@/features/onboarding/merge-ftue-interaction-coordinator';
import { missionBoardStep, missionProgress } from '@/features/onboarding/steppling-mission';
import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/registry';
import type { HatchableMissionDefinition } from '@/types/hatchable-companion';
import type { MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import { mergeCellCenter } from '@/utils/merge-world/board-geometry';
import { MistMissionDock, type GlowLandingSource } from './kingdom-opening-merge-dock';

type HatchableMissionDockProps = {
  /** Whose mission: the board's seed, bar and guidance come from the definition. */
  mission: HatchableMissionDefinition;
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
  /** Veiled cells that burst open because a sleeper beside them woke. */
  onReveal?: (count: number) => void;
  onBoardMetrics?: (metrics: MergeBoardScreenMetrics | null) => void;
  onBlockedInteraction?: () => void;
  onEntranceSettled?: () => void;
};

/**
 * A hatchable companion's mission board under their misted tile: the same
 * dock the opening used, on the companion's own board. Progress is the
 * mission store's own merge count, not an FTUE run: the discovery story only
 * hears about the bar filling.
 */
export const HatchableMissionDock = memo(function HatchableMissionDock({ mission, state, send, merges, mergesRef, width, bottomInset, landings, onGlow, onFinale, onReveal, onBoardMetrics, onBlockedInteraction, onEntranceSettled }: HatchableMissionDockProps) {
  const sessionRef = useRef<ReturnType<typeof createMergeBoardSession> | null>(null);
  if (!sessionRef.current) sessionRef.current = createMergeBoardSession();
  const sessionId = sessionRef.current.id;
  const boardStep = useMemo(() => missionBoardStep(mission, state, merges), [merges, mission, state]);
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
  const required = mission.required;
  const dispatch = useCallback((command: MergeWorldCommand): MergeWorldCommandResult | null => {
    const current = stateRef.current;
    if (!mergeFtueAllowsCommand(stepRef.current, current, command)) {
      onBlockedInteraction?.();
      return null;
    }
    // A mission has no Energy economy; a spawner tap (a friend's board may have one) is never refused for it.
    const effective = command.type === 'tapGenerator' ? { ...command, spendEnergy: false as const } : command;
    const result = send(effective);
    if (result) stateRef.current = result.state;
    if (result?.revealedMistCells?.length) onReveal?.(result.revealedMistCells.length);
    const event = mergeFtueEventForCommand(current, command, result);
    // A sleeping cell woken by its match is a strike as much as a merge is: the store counts both.
    if (!result || (event?.type !== 'merge_completed' && event?.type !== 'dream_echo_cleared')) return result;
    const metrics = boardMetricsRef.current;
    if (!metrics) return result;
    const center = mergeCellCenter(metrics.geometry, event.resultCell);
    const from = { x: metrics.x + center.x, y: metrics.y + center.y };
    if ((mergesRef.current ?? 0) >= required) {
      const occupant = result.state.board[event.resultCell]?.occupant;
      if (occupant?.kind === 'item') setHiddenItemIds((hidden) => new Set([...hidden, occupant.instanceId]));
      onFinale?.(from, event.resultDefinitionId);
    } else {
      onGlow?.(from);
    }
    return result;
  }, [mergesRef, onBlockedInteraction, onFinale, onGlow, onReveal, required, send]);

  return <MistMissionDock
    state={state} boardStep={boardStep} progress={missionProgress(merges, required)} required={required}
    interactionKey={`${mission.id}:${boardStep?.id ?? 'free'}`} sessionId={sessionId} hiddenItemIds={hiddenItemIds}
    width={width} bottomInset={bottomInset} landings={landings}
    onCommand={dispatch} onBoardMetrics={handleMetrics} onBlockedInteraction={onBlockedInteraction} onEntranceSettled={onEntranceSettled} />;
});

/** Steppling's dock, by its old name. */
export const StepplingMissionDock = memo(function StepplingMissionDock(props: Omit<HatchableMissionDockProps, 'mission'>) {
  return <HatchableMissionDock mission={STEPPLING_HATCHABLE.mission} {...props} />;
});
