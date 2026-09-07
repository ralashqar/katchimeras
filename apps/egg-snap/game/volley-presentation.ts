export const CELL_FLIGHT_MS = 360;
export const CELL_IMPACT_MS = 280;
export const CELL_LAUNCH_MS = 190;
export const CELL_STAGGER_MS = 48;

/** Keep each launch flank on that side of the shell, safely inside its silhouette. */
export function cellImpactTarget(sourceX: number, target: { x: number; y: number }, opponentWidth: number) {
  const width = Math.max(1, opponentWidth);
  return { x: target.x + Math.tanh((sourceX - target.x) / width) * width * .24, y: target.y };
}

/** Outward control point gives both flanks a clean fan-out before converging. */
export function flightOffset(dx: number, dy: number, progress: number) {
  'worklet';
  const t = 1 - Math.pow(1 - Math.max(0, Math.min(1, progress)), 1.5);
  const outward = -Math.sign(dx) * 48;
  return { x: 2 * (1-t) * t * outward + t*t*dx, y: dy*t, scale: 1-t*.55 };
}

/** Shared by simulation and presentation: split a beat's damage without rounding losses. */
export function cellDamage(total: number, count: number, index: number) {
  return Math.floor(total * (index + 1) / count) - Math.floor(total * index / count);
}
export function arrivalTime(delay: number) { return delay + CELL_FLIGHT_MS; }
export function arrivedCells(delays: readonly number[], elapsed: number) {
  'worklet';
  return delays.filter(delay => elapsed >= delay + CELL_FLIGHT_MS).length;
}
