export type MergeBoardMotionKind = 'move' | 'swap' | 'return' | 'spawn' | 'merge-source' | 'merge-target' | 'merge-result';

export const MERGE_MORPH_DURATION_MS = 460;
export const MERGE_MORPH_REDUCED_MOTION_DURATION_MS = 100;

export function mergeMotionPiecewise(progress: number, stops: readonly number[], values: readonly number[]) {
  'worklet';
  const p = Math.max(stops[0] ?? 0, Math.min(stops[stops.length - 1] ?? 1, progress));
  for (let index = 1; index < stops.length; index += 1) {
    const end = stops[index] ?? 1;
    if (p > end) continue;
    const start = stops[index - 1] ?? 0;
    const ratio = end === start ? 1 : (p - start) / (end - start);
    const from = values[index - 1] ?? 0;
    const to = values[index] ?? from;
    return from + (to - from) * ratio;
  }
  return values[values.length - 1] ?? 0;
}

export function mergeSpriteMotionFrame(kind: MergeBoardMotionKind, progress: number, reduceMotion = false) {
  'worklet';
  const p = Math.max(0, Math.min(1, progress));
  if (kind === 'merge-source' || kind === 'merge-target') return reduceMotion
    ? { opacity: 1 - p, scale: 1 }
    : {
        opacity: mergeMotionPiecewise(p, [0, 0.12, 0.56, 1], [1, 1, 0, 0]),
        scale: mergeMotionPiecewise(p, [0, 0.12, 0.58, 1], [1, 1, 0.1, 0.05]),
      };
  if (kind === 'merge-result') return reduceMotion
    ? { opacity: p, scale: 1 }
    : {
        opacity: mergeMotionPiecewise(p, [0, 0.22, 0.4, 1], [0, 0, 1, 1]),
        scale: mergeMotionPiecewise(p, [0, 0.22, 0.78, 1], [0.06, 0.06, 1.12, 1]),
      };
  return { opacity: 1, scale: 1 };
}
