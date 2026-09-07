// Frozen pre-optimization implementation: seeded AI equivalence oracle.
import { varietyData } from '@incubator/tile-match/varieties';
import { beatDeadlineMs, slotReducer, type SlotAction, type SlotRunState } from '@incubator/tile-match/engine';
import type { AiProfile } from '../../game/types';

export function seedNumber(seed: string) {
  let n = 2166136261;
  for (let i = 0; i < seed.length; i++) n = Math.imul(n ^ seed.charCodeAt(i), 16777619);
  return n >>> 0;
}
export function randomStep(seed: number): [number, number] {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return [next / 4294967296, next];
}
export function actionDelay(profile: AiProfile, seed: number): [number, number] {
  const [roll, next] = randomStep(seed);
  return [Math.round(profile.minActionMs + roll * (profile.maxActionMs - profile.minActionMs)), next];
}

/** Inspect real reducer outcomes, including split-piece origins and modifier refusal. */
export function choosePlacement(run: SlotRunState, accurate: boolean, elapsedMs: number, roll = 0): SlotAction | null {
  const live = run.tray.filter(p => !p.used);
  const bomb = varietyData<{pieceId: string | null; armed: boolean}>(run.beat, 'bomb');
  if (!accurate && bomb?.armed && bomb.pieceId && roll < .25) {
    const piece = live.find(p => p.id === bomb.pieceId);
    if (piece) return {type: 'discard', pieceId: piece.id, elapsedMs};
  }
  const safe = live.filter(p => !(bomb?.armed && bomb.pieceId === p.id));
  const pieces = accurate ? safe : live;
  const partial: SlotAction[] = [];
  for (const piece of pieces) {
    // Origins are a fast path; the exhaustive fallback also solves fused halves.
    const origins = run.beat.groups.map(g => g.origin);
    for (let row = 0; row < run.grid.rows; row++) for (let column = 0; column < run.grid.cols; column++) origins.push({row, column});
    for (const origin of origins) {
      const action: SlotAction = {type: 'place', pieceId: piece.id, ...origin, elapsedMs};
      const next = slotReducer(run, action);
      if (next === run) continue;
      const placement = next.beat.placements.at(-1)!;
      if (accurate && !next.beat.voided && (placement.grade === 'perfect' || placement.absorbed)) return action;
      if (!accurate && !placement.absorbed && placement.grade !== 'perfect' && placement.filled.length > 0 && !next.beat.voided) partial.push(action);
    }
  }
  if (accurate && beatDeadlineMs(run) !== null) return null; // Wait for a safe colour/bomb phase.
  if (partial.length) return partial[Math.min(partial.length - 1, Math.floor(roll * partial.length))];
  if (!accurate && live[0]) {
    const group = run.beat.groups.find(g => g.pieceId === live[0].id);
    if (group && group.colorId !== live[0].colorId) return {type: 'place', pieceId: live[0].id, ...group.origin, elapsedMs};
  }
  return live[0] ? {type: 'discard', pieceId: live[0].id, elapsedMs} : null;
}
