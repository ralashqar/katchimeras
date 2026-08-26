import { useCallback, useEffect, useReducer, useRef } from 'react';

export type ActionPresentationControllerState = {
  id: string | null;
  phase: 'idle' | 'animating' | 'revealing';
  revealingSlotId: string | null;
};

export type ActionPresentationControllerEvent =
  | { type: 'present'; id: string }
  | { type: 'finish'; id: string; slotId: string | null }
  | { type: 'reveal_finished'; id: string };

export function reduceActionPresentationController(
  state: ActionPresentationControllerState,
  event: ActionPresentationControllerEvent,
): ActionPresentationControllerState {
  if (event.type === 'present') {
    if (state.phase !== 'idle') return state;
    return { id: event.id, phase: 'animating', revealingSlotId: null };
  }
  if (event.type === 'finish') {
    if (state.id !== event.id || state.phase !== 'animating') return state;
    return event.slotId
      ? { id: null, phase: 'revealing', revealingSlotId: event.slotId }
      : { id: null, phase: 'idle', revealingSlotId: null };
  }
  if (state.phase !== 'revealing' || state.revealingSlotId !== event.id) return state;
  return { id: null, phase: 'idle', revealingSlotId: null };
}

/**
 * Visual-only controller. Claiming happens before animation; callback and
 * deadline race safely through the same idempotent finish path.
 */
export function useActionPresentationController(input: {
  presentationId: string | null;
  claim: (id: string) => void;
  dismiss: (id: string) => void;
  presentationSlotId: string | null;
  fallbackMs?: number;
  revealMs?: number;
}) {
  const claimRef = useRef(input.claim);
  const dismissRef = useRef(input.dismiss);
  claimRef.current = input.claim;
  dismissRef.current = input.dismiss;
  const presentationSlotIdRef = useRef(input.presentationSlotId);
  presentationSlotIdRef.current = input.presentationSlotId;
  const [state, dispatch] = useReducer(reduceActionPresentationController, {
    id: null,
    phase: 'idle',
    revealingSlotId: null,
  });

  useEffect(() => {
    if (!input.presentationId || state.phase !== 'idle') return;
    claimRef.current(input.presentationId);
    dispatch({ type: 'present', id: input.presentationId });
  }, [input.presentationId, state.phase]);

  const finish = useCallback((id: string, slotId = presentationSlotIdRef.current) => {
    if (state.id !== id || state.phase !== 'animating') return;
    dismissRef.current(id);
    dispatch({ type: 'finish', id, slotId });
  }, [state.id, state.phase]);

  useEffect(() => {
    if (!state.id || state.phase !== 'animating') return;
    // DayActionCompletedRow may wait 2.8s for a late reward callback before
    // running its own exit. Leave generous headroom so this safety deadline
    // never races a healthy reward/outro sequence.
    const timer = setTimeout(() => finish(state.id!), input.fallbackMs ?? 6000);
    return () => clearTimeout(timer);
  }, [finish, input.fallbackMs, state.id, state.phase]);

  useEffect(() => {
    if (state.phase !== 'revealing' || !state.revealingSlotId) return;
    const id = state.revealingSlotId;
    const timer = setTimeout(() => dispatch({ type: 'reveal_finished', id }), input.revealMs ?? 360);
    return () => clearTimeout(timer);
  }, [input.revealMs, state.phase, state.revealingSlotId]);

  return { activeId: state.id, finish, phase: state.phase, revealingSlotId: state.revealingSlotId };
}
