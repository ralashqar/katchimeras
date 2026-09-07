/**
 * Small pure math helpers shared by the puzzle engine and the race sim.
 *
 * Everything here must stay worklet-safe: no closures over module state, no
 * dependencies, no allocation in the hot paths.
 */

export const clamp = (value: number, low: number, high: number): number => {
  'worklet';
  return value < low ? low : value > high ? high : value;
};

export const clamp01 = (value: number): number => {
  'worklet';
  return clamp(value, 0, 1);
};

export const lerp = (from: number, to: number, t: number): number => {
  'worklet';
  return from + (to - from) * t;
};

/** Inverse lerp, clamped. Returns where `value` sits between `from` and `to` as 0..1. */
export const normalise = (value: number, from: number, to: number): number => {
  'worklet';
  return from === to ? 0 : clamp01((value - from) / (to - from));
};

/**
 * Frame-rate independent approach toward a target.
 *
 * `tau` is the time constant in seconds: after `tau` the gap has shrunk to ~37%
 * of its original size, regardless of how the elapsed time was subdivided.
 *
 * Never use `current + (target - current) * 0.1` in a stepped simulation — that
 * form makes the result depend on frame rate, so the game plays differently on a
 * 120Hz device than on a 60Hz one.
 */
export const expApproach = (
  current: number,
  target: number,
  tau: number,
  dt: number,
): number => {
  'worklet';
  return tau <= 0 ? target : current + (target - current) * (1 - Math.exp(-dt / tau));
};

/** Exponential decay toward zero with time constant `tau`. */
export const expDecay = (value: number, tau: number, dt: number): number => {
  'worklet';
  return tau <= 0 ? 0 : value * Math.exp(-dt / tau);
};
