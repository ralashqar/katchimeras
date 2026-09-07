import type { BulletVolley } from '@incubator/tile-match/effects';
import { SLOT_BLAST_SHAKE_MS, SLOT_BLAST_POP_MS, SLOT_BLAST_STEP_MS } from '@incubator/tile-match/timing';
import { TILE_COLORS } from '../data/tile-theme';
import { arrivalTime, cellImpactTarget, CELL_FLIGHT_MS, CELL_IMPACT_MS } from './volley-presentation';
import { EFFECT_BUDGET, type EffectQuality } from './effect-quality';
export type CombatVolleyData = BulletVolley & { damage: number; opponentWidth: number; startAt: number; quality?: EffectQuality };
export type CombatBurstData = {id: number; startAt: number; kind: 'miss' | 'blast'; cell: number;
  cells: {x: number; y: number; colorId: keyof typeof TILE_COLORS}[]; quality: EffectQuality};

const ids = Object.keys(TILE_COLORS) as (keyof typeof TILE_COLORS)[];
export function effectCommands(volleys: readonly CombatVolleyData[], bursts: readonly CombatBurstData[], endedAt?: number) {
  return [...volleys.flatMap(v => v.bullets.map(b => ({
    ...b, kind: "volley" as const, ordinal: 0, start: v.startAt + b.delay, target: cellImpactTarget(b.x, v.target, v.opponentWidth),
    colour: ids.indexOf(b.colorId), shards: EFFECT_BUDGET[v.quality ?? 'balanced'].shards,
    cap: EFFECT_BUDGET[v.quality ?? 'balanced'].cap,
  }))).filter(b => endedAt === undefined || b.start + CELL_FLIGHT_MS <= endedAt),
    ...bursts.flatMap(b => b.cells.map((c, ordinal) => ({...c, kind: b.kind, ordinal,
      x: c.x + b.cell/2, y: c.y + b.cell/2, target: {x: c.x + b.cell/2, y: c.y + b.cell/2},
      start: b.startAt, size: b.cell, colour: ids.indexOf(c.colorId),
      shards: EFFECT_BUDGET[b.quality].shards, cap: EFFECT_BUDGET[b.quality].cap,
    })))].map(b => ({...b, dx: b.target.x-b.x, dy: b.target.y-b.y, outward: -Math.sign(b.target.x-b.x)*48,
    directions: Array.from({length:b.shards},(_,i) => {const angle=i*Math.PI*2/b.shards;return {x:Math.cos(angle),y:Math.sin(angle),angle};}),
  }));
}
export function effectCapacity(cells: number) {
  return Math.max(128, 2 ** Math.ceil(Math.log2(Math.max(1, cells*2+96))));
}
export function effectDeadlines(volleys: readonly CombatVolleyData[], bursts: readonly CombatBurstData[], endedAt?: number) {
  return [...volleys.map(v => ({id:v.id, at:Math.min(
    v.startAt + Math.max(0,...v.bullets.map(b => arrivalTime(b.delay))) + CELL_IMPACT_MS,
    (endedAt ?? Infinity) + CELL_IMPACT_MS,
  )})), ...bursts.map(b => ({id:b.id, at:b.startAt+(b.kind==='miss' ? 340 :
    SLOT_BLAST_SHAKE_MS + Math.max(0,b.cells.length-1)*SLOT_BLAST_STEP_MS + SLOT_BLAST_POP_MS)}))];
}
