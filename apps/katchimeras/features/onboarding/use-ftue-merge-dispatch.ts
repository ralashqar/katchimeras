import { useCallback, type MutableRefObject } from 'react';
import type { MergeWorldCommand, MergeWorldCommandResult, MergeWorldState } from '@/types/merge-world';
import type { MergeWorldDispatchOptions } from '@/features/merge-world/merge-world-provider';
import { dispatchFtueEvent } from './ftue-runtime';
import type { FtueEvent, FtueRunState, FtueStepDefinition } from './ftue-types';
import { mergeFtueAllowsCommand, mergeFtueEventForCommand } from './merge-ftue';
import { mossproutFtueStep } from './mossprout-ftue-script';
import type { MergeFtueInteractionCoordinator } from './merge-ftue-interaction-coordinator';

export type FtueMergeDispatchInput = {
  /** The provider's dispatch. */
  send: (command: MergeWorldCommand, options?: MergeWorldDispatchOptions) => MergeWorldCommandResult | null;
  coordinator: MergeFtueInteractionCoordinator;
  sessionId: string;
  stateRef: MutableRefObject<MergeWorldState | null>;
  runRef: MutableRefObject<FtueRunState | null>;
  /** The step the board is currently projecting (may be derived from the board, not the run). */
  stepRef: MutableRefObject<FtueStepDefinition | null>;
  /**
   * A guided board persists every command immediately and leases the
   * coordinator, whatever surface the authored step declares. The dedicated
   * merge page derives this from `step.surface === 'merge'`; the opening's
   * docked board is guided while its haven-surface step is active.
   */
  guided: boolean;
  onBlocked?: () => void;
  onEvent?: (event: FtueEvent, result: MergeWorldCommandResult) => void;
};

/**
 * One board command through the FTUE contract: gate, reduce, persist, then
 * translate the board result into the FTUE event that advances the run.
 * Extracted from the dedicated merge page so the opening's docked board
 * cannot drift from it.
 */
export function useFtueMergeDispatch({ send, coordinator, sessionId, stateRef, runRef, stepRef, guided, onBlocked, onEvent }: FtueMergeDispatchInput) {
  return useCallback((command: MergeWorldCommand): MergeWorldCommandResult | null => {
    const currentState = stateRef.current;
    const currentRun = runRef.current;
    const currentStep = stepRef.current;
    if (!currentState) return null;
    if (coordinator.leased) return null;
    if (!mergeFtueAllowsCommand(currentStep, currentState, command)) {
      onBlocked?.();
      return null;
    }
    const guard = guided && currentRun?.status === 'active' && (command.type === 'tapGenerator' || command.type === 'move');
    const token = guard ? coordinator.begin(currentStep?.id ?? 'unknown', currentState.revision) : null;
    if (guard && !token) return null;
    try {
      // Chapter zero has no Energy economy; a Basket tap must never be refused for it.
      const effective = command.type === 'tapGenerator' ? { ...command, spendEnergy: false as const } : command;
      const result = send(effective, guided ? { persist: 'immediate' } : undefined);
      if (result) stateRef.current = result.state;
      const event = mergeFtueEventForCommand(currentState, command, result);
      if (event && currentRun?.status === 'active') {
        const nextRun = dispatchFtueEvent(event, `merge-command:${sessionId}:${event.revision}`);
        runRef.current = nextRun;
        stepRef.current = nextRun?.status === 'active' ? mossproutFtueStep(nextRun.stepId) : null;
        if (result) onEvent?.(event, result);
      }
      if (token) coordinator.complete(token);
      return result;
    } catch (error) {
      if (token) coordinator.abort(token);
      throw error;
    }
  }, [coordinator, guided, onBlocked, onEvent, runRef, send, sessionId, stateRef, stepRef]);
}
