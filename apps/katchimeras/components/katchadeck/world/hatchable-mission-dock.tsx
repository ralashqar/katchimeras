import { memo, useCallback, useMemo, useRef, useState } from 'react';

import type { MergeBoardScreenMetrics } from '@/components/katchadeck/games/feastle-persistent-merge-board';
import type { RewardFlightPoint } from '@/components/katchadeck/ui/reward-token-flight';
import { mechanicProgress, resolveMechanic } from '@/features/mission-mechanics/mechanic';
import { mergeFtueAllowsCommand } from '@/features/onboarding/merge-ftue';
import { createMergeBoardSession } from '@/features/onboarding/merge-ftue-interaction-coordinator';
import { missionBoardStep } from '@/features/onboarding/steppling-mission';
import type { MissionCommandResult } from '@/features/onboarding/use-opening-mission-board';
import type { HatchableMissionDefinition } from '@/types/hatchable-companion';
import type { MergeWorldCommand, MergeWorldState } from '@/types/merge-world';
import type { MissionMechanicState, MissionStrike } from '@/types/mission-mechanic';
import { mergeCellCenter } from '@/utils/merge-world/board-geometry';
import { MistMissionDock, type GlowLandingSource } from './kingdom-opening-merge-dock';

type HatchableMissionDockProps = {
  /** Whose mission: the board's seed, bar, guidance and mechanic come from the definition (a friend's, or a journey tile's without a camera). */
  mission: Omit<HatchableMissionDefinition, 'camera'>;
  state: MergeWorldState;
  send: (command: MergeWorldCommand) => MissionCommandResult | null;
  merges: number;
  /** Where the board's strikes stand, by its mechanic: the bar and the guidance read it. */
  mechanicState: MissionMechanicState | null;
  width: number;
  bottomInset: number;
  landings?: GlowLandingSource;
  /** A strike on the wisps: what flies is the mechanic's to say. */
  onStrike?: (from: RewardFlightPoint, strike: MissionStrike) => void;
  /** The strike that fills the bar: its item leaves the board for the mist. */
  onFinale?: (from: RewardFlightPoint, definitionId: string, strike: MissionStrike) => void;
  /** Veiled cells that burst open because a sleeper beside them woke. */
  onReveal?: (count: number) => void;
  onBoardMetrics?: (metrics: MergeBoardScreenMetrics | null) => void;
  onBlockedInteraction?: () => void;
  onEntranceSettled?: () => void;
};

/**
 * A hatchable companion's mission board under their misted tile: the same
 * dock the opening used, on the companion's own board. Progress is the
 * mission store's own count, resolved by the board's mechanic, not an FTUE
 * run: the discovery story only hears about the bar filling.
 */
export const HatchableMissionDock = memo(function HatchableMissionDock({ mission, state, send, merges, mechanicState, width, bottomInset, landings, onStrike, onFinale, onReveal, onBoardMetrics, onBlockedInteraction, onEntranceSettled }: HatchableMissionDockProps) {
  const sessionRef = useRef<ReturnType<typeof createMergeBoardSession> | null>(null);
  if (!sessionRef.current) sessionRef.current = createMergeBoardSession();
  const sessionId = sessionRef.current.id;
  const boardStep = useMemo(() => missionBoardStep(mission, state, merges, mechanicState), [mechanicState, merges, mission, state]);
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
  const mechanic = resolveMechanic(mission);
  const progress = useMemo(() => mechanicState ? mechanicProgress(mechanic, mission, mechanicState) : { current: Math.max(0, Math.min(mission.required, merges)), total: mission.required }, [mechanic, mechanicState, merges, mission]);
  const dispatch = useCallback((command: MergeWorldCommand): MissionCommandResult | null => {
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
    // A merge or a waking is a strike; the store resolved what it does by the board's mechanic.
    const strike = result?.strike ?? null;
    if (!result || !strike) return result;
    const metrics = boardMetricsRef.current;
    if (!metrics) return result;
    const center = mergeCellCenter(metrics.geometry, strike.fromCell);
    const from = { x: metrics.x + center.x, y: metrics.y + center.y };
    if (strike.finale) {
      const occupant = result.state.board[strike.fromCell]?.occupant;
      if (occupant?.kind === 'item') setHiddenItemIds((hidden) => new Set([...hidden, occupant.instanceId]));
      onFinale?.(from, strike.resultDefinitionId, strike);
    } else {
      onStrike?.(from, strike);
    }
    return result;
  }, [onBlockedInteraction, onFinale, onReveal, onStrike, send]);

  return <MistMissionDock
    state={state} boardStep={boardStep} progress={progress.current} required={progress.total} barTitle={mission.barTitle}
    interactionKey={`${mission.id}:${boardStep?.id ?? 'free'}`} sessionId={sessionId} hiddenItemIds={hiddenItemIds}
    width={width} bottomInset={bottomInset} landings={landings}
    onCommand={dispatch} onBoardMetrics={handleMetrics} onBlockedInteraction={onBlockedInteraction} onEntranceSettled={onEntranceSettled} />;
});
