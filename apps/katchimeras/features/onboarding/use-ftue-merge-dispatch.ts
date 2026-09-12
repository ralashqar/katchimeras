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
  /**
   * Advance the FTUE run on the next frame instead of inside the board's
   * command. Every run subscriber (the tab, the route, the Kingdom and its
   * canvas) re-renders on that advance; the docked opening board keeps that
   * off the frame the merge animation starts on.
   */
  deferEvent?: boolean;
  onBlocked?: () => void;
  onEvent?: (event: FtueEvent, result: MergeWorldCommandResult) => void;
  /**
   * Like onEvent, but before the run advances. Anything that must be on screen
   * on the same frame the step changes (the opening's finale flag, which holds
   * the camera) goes here, so no subscriber ever renders the next step without it.
   */
  onBeforeAdvance?: (event: FtueEvent, result: MergeWorldCommandResult) => void;
};

/**
 * One board command through the FTUE contract: gate, reduce, persist, then
 * translate the board result into the FTUE event that advances the run.
 * Extracted from the dedicated merge page so the opening's docked board
 * cannot drift from it.
 */
export function useFtueMergeDispatch({ send, coordinator, sessionId, stateRef, runRef, stepRef, guided, deferEvent = false, onBlocked, onEvent, onBeforeAdvance }: FtueMergeDispatchInput) {
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
        const advance = () => {
          if (result) onBeforeAdvance?.(event, result);
          const nextRun = dispatchFtueEvent(event, `merge-command:${sessionId}:${event.revision}`);
          runRef.current = nextRun;
          stepRef.current = nextRun?.status === 'active' ? mossproutFtueStep(nextRun.stepId) : null;
          if (result) onEvent?.(event, result);
        };
        if (deferEvent) requestAnimationFrame(advance);
        else advance();
      }
      if (token) coordinator.complete(token);
      return result;
    } catch (error) {
      if (token) coordinator.abort(token);
      throw error;
    }
  }, [coordinator, deferEvent, guided, onBeforeAdvance, onBlocked, onEvent, runRef, send, sessionId, stateRef, stepRef]);
}
