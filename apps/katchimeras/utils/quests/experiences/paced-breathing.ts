export type BreathingPhase = 'inhale' | 'exhale';
export type BreathingState = { phase: BreathingPhase; cycle: number; completed: boolean };

export function createBreathingState(): BreathingState {
  return { phase: 'inhale', cycle: 0, completed: false };
}

export function advanceBreathing(state: BreathingState, cycles: number): BreathingState {
  if (state.completed) return state;
  if (state.phase === 'inhale') return { ...state, phase: 'exhale' };
  const cycle = state.cycle + 1;
  return { phase: 'inhale', cycle, completed: cycle >= cycles };
}

