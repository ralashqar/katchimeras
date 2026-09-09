import type { SlotRunState } from '@incubator/tile-match/engine';

/**
 * How far the rival is through its current beat: pieces landed against pieces dealt.
 *
 * What the charge meter shows. A resolved beat reads as full — the volley is in the air — and a fresh deal
 * empties it. Absorbed drops (armour chips) do not count; the piece came back.
 */
export function rivalCharge(run: SlotRunState): { placed: number; total: number } {
  const total = Math.max(1, run.beat.groups.length);
  if (run.beat.status === 'resolved') return { placed: total, total };
  return { placed: Math.min(total, run.beat.placements.filter(p => !p.absorbed).length), total };
}

/** How long before the rival acts the shell starts to wind up, milliseconds. */
export const WIND_UP_MS = 400;

/**
 * The wind-up, 0 to 1, at `now` for a rival due to act at `actsAt`.
 *
 * Zero until `WIND_UP_MS` before the action, rising to one at the moment of it, and zero again once the action is
 * past — the placement's own pulse takes over from there. `Infinity` (no action scheduled, or the rival held) is
 * always zero, so a held rival never looks poised.
 */
export function windUpAt(actsAt: number, now: number): number {
  'worklet';
  if (!Number.isFinite(actsAt)) return 0;
  const remaining = actsAt - now;
  if (remaining > WIND_UP_MS || remaining < 0) return 0;
  return 1 - remaining / WIND_UP_MS;
}
