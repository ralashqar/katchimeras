import type { TodayHatchPhase } from '@/utils/today-hatch-presentation';

export type EggHapticCue = 'shake' | 'hatch' | 'settle';
export const EGG_SHAKE_HAPTIC_INTERVAL_MS = 100;
const MAX_SHAKE_PULSES = 80;

/** One cancellable tactile sequence per hatch, driven by the visual phases. */
export function createEggHapticSequence(emit: (cue: EggHapticCue) => void, reduceMotion: boolean) {
  let phase: TodayHatchPhase = 'idle';
  let timer: ReturnType<typeof setInterval> | null = null;
  let generation = 0;
  const stopShake = () => {
    generation += 1;
    if (timer !== null) clearInterval(timer);
    timer = null;
  };
  const stop = () => { stopShake(); phase = 'idle'; };
  const advance = (next: TodayHatchPhase) => {
    if (next === phase) return;
    const wasShaking = phase === 'shaking' || phase === 'cracking';
    phase = next;
    if (next === 'shaking' || next === 'cracking') {
      if (wasShaking) return;
      emit('shake');
      if (!reduceMotion) {
        let pulses = 1;
        const run = generation;
        timer = setInterval(() => {
          if (run !== generation) return;
          emit('shake');
          if (++pulses >= MAX_SHAKE_PULSES) stopShake();
        }, EGG_SHAKE_HAPTIC_INTERVAL_MS);
      }
      return;
    }
    // Stop the light rhythm BEFORE the reveal impact, never on a later render.
    stopShake();
    if (next === 'crossfading_subject') emit('hatch');
    if (next === 'subject_settling') emit('settle');
  };
  return { advance, stop };
}
