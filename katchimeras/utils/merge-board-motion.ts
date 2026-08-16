export type MergeBoardMotionKind = 'move' | 'swap' | 'return' | 'spawn' | 'merge-source' | 'merge-target' | 'merge-result';

export const MERGE_MORPH_DURATION_MS = 460;
export const MERGE_MORPH_REDUCED_MOTION_DURATION_MS = 100;
export const SPAWN_MOTION_DURATION_MS = 760;

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

/**
 * Authors the generator spawn as two readable phases: a buoyant arc that
 * lands short of the destination, followed by a grounded slide into its cell.
 * Values are normalized so the board can apply them at any cell size.
 */
export function spawnSpriteMotionFrame(progress: number, reduceMotion = false) {
  'worklet';
  const p = Math.max(0, Math.min(1, progress));
  if (reduceMotion) return { arc: 0, opacity: 1, scale: 1, settleY: 0, travel: p };
  const arcEnd = 0.78;
  const arcProgress = Math.min(1, p / arcEnd);
  return {
    arc: p < arcEnd ? -4 * arcProgress * (1 - arcProgress) : 0,
    opacity: mergeMotionPiecewise(p, [0, 0.04, 0.12, 1], [0, 0.52, 1, 1]),
    scale: mergeMotionPiecewise(
      p,
      [0, 0.07, 0.18, 0.68, 0.78, 0.87, 1],
      [0.18, 0.88, 1.18, 1.06, 0.92, 1.03, 1],
    ),
    settleY: mergeMotionPiecewise(p, [0, 0.78, 0.83, 0.91, 1], [0, 0, 0.08, -0.025, 0]),
    travel: mergeMotionPiecewise(p, [0, 0.12, 0.68, 0.78, 1], [0, 0.025, 0.78, 0.86, 1]),
  };
}
