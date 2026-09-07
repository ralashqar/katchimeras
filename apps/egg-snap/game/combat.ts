import { createSlotRun, dealBeat, planBeat, slotReducer, beatDeadlineMs, type SlotAction, type SlotRunState } from '@incubator/tile-match/engine';
import { beatSettleMs, blastSettleMs } from '@incubator/tile-match/timing';
import type { DuelDefinition, DuelResult } from './types';
import { actionDelay, choosePlacement, randomStep, seedNumber } from './opponent';
import { arrivalTime, cellDamage, CELL_STAGGER_MS } from './volley-presentation';
import { varietyData } from '@incubator/tile-match/varieties';

export const BACKFIRE = {shakeMs: 240, perCell: 2, maxDamage: 8} as const;
export function riggedCells(run: SlotRunState) {
  const bomb = varietyData<{pieceId: string}>(run.beat, 'bomb');
  return run.beat.groups.filter(g => g.pieceId === bomb?.pieceId)
    .flatMap(g => g.cells.map(index => ({index, colorId: g.colorId})));
}

export const COMBAT = { perCell: 2, exactBonus: 4, lateBonus: 2, comboStep: .125, comboCap: 2.25 } as const;
export type Combatant = 'player' | 'opponent';
export type CombatEvent = {
  id: number; at: number; type: 'placement' | 'volley' | 'backfire' | 'miss' | 'blast' | 'chip' | 'impact' | 'end';
  damageTarget?: Combatant;
  side: Combatant; damage?: number; run?: SlotRunState; volleyId?: number; cellIndex?: number;
};
export type CombatantState = {
  run: SlotRunState; beatStartedAt: number; lastDropAt: number; nextBeatAt: number;
  resolvedSequence: number; exactBeats: number; totalBeats: number;
};
export type PendingImpact = { at: number; side: Combatant; damageTarget?: Combatant; damage: number; volleyId: number; cellIndex: number };
export type CombatState = {
  definition: DuelDefinition; attemptId: string; seed: string; practice: boolean;
  player: CombatantState; opponent: CombatantState;
  /** Player aliases retained for input and presentation consumers. */
  run: SlotRunState; beatStartedAt: number; lastDropAt: number; nextBeatAt: number;
  exactBeats: number; totalBeats: number;
  elapsed: number; playerHp: number; opponentHp: number;
  aiSeed: number; aiAt: number; aiAccurate: boolean | null; aiRoll: number;
  impacts: readonly PendingImpact[]; eventSequence: number; events: readonly CombatEvent[];
  outcome: 'won' | 'lost' | 'draw' | null;
};
function aliases(s: CombatState): CombatState {
  const {run, beatStartedAt, lastDropAt, nextBeatAt, exactBeats, totalBeats} = s.player;
  return {...s, run, beatStartedAt, lastDropAt, nextBeatAt, exactBeats, totalBeats};
}
/** Ordinary deals depend only on seed/index; the opening lesson repeats until learned. */
function deal(s: CombatState, fighter: CombatantState) {
  const index = fighter.run.beat.index + 1;
  const rng = seedNumber(`${s.seed}:puzzle:${index}`);
  const plan = s.definition.openingGate && fighter === s.player && fighter.exactBeats < s.definition.openingGate
    ? { ...planBeat(s.definition.progression, 0, 0, rng), slots: 1, varieties: [] }
    : planBeat(s.definition.progression, index, 0, rng);
  const next = dealBeat(fighter.run.grid, rng, index, index, plan);
  return {...fighter, beatStartedAt: s.elapsed, lastDropAt: s.elapsed,
    run: {...fighter.run, ...next, trayGeneration: index, lastResolution: null,
      lastBeatGrade: null, lastBeatPace: null, lastBeatElapsedMs: 0, lastGroupCount: 0, lastGroupSizes: []}};
}
export function createCombat(definition: DuelDefinition, attemptId: string, seed: string, practice = false): CombatState {
  const run = createSlotRun(`${seed}:puzzle:0`, {progression: definition.progression, launch: false});
  const fighter: CombatantState = {run, beatStartedAt: 0, lastDropAt: 0, nextBeatAt: Infinity, resolvedSequence: 0, exactBeats: 0, totalBeats: 0};
  const [delay, aiSeed] = actionDelay(definition.ai, seedNumber(`${seed}:ai`));
  return aliases({definition, attemptId, seed, practice, player: fighter, opponent: {...fighter},
    run, beatStartedAt: 0, lastDropAt: 0, nextBeatAt: Infinity, exactBeats: 0, totalBeats: 0,
    elapsed: 0, playerHp: definition.health, opponentHp: definition.opponentHealth ?? definition.health,
    aiSeed, aiAt: delay, aiAccurate: null, aiRoll: 0, impacts: [], eventSequence: 0, events: [], outcome: null});
}
function emit(s: CombatState, event: Omit<CombatEvent, 'id' | 'at'>): CombatState {
  const id = s.eventSequence + 1;
  return {...s, eventSequence: id, events: [...s.events.slice(-255), {...event, id, at: s.elapsed}]};
}
export function damageFor(run: SlotRunState) {
  const r = run.lastResolution;
  if (!r || run.beat.voided || r.blocksCleared === 0) return 0;
  const multiplier = Math.min(
    COMBAT.comboCap,
    1 + r.comboAfter * COMBAT.comboStep,
  );
  const bonus =
    run.lastBeatGrade === "perfect"
      ? run.lastBeatPace === "onTime"
        ? COMBAT.exactBonus
        : COMBAT.lateBonus
      : 0;
  return Math.round(r.blocksCleared * COMBAT.perCell * multiplier + bonus);
}
function resolve(s: CombatState, side: Combatant): CombatState {
  const fighter = s[side], run = fighter.run;
  if (run.eventSequence <= fighter.resolvedSequence || !run.lastResolution) return s;
  const damage = damageFor(run);
  const cells = run.lastResolution.blocksCleared;
  const settle = run.beat.voided ? blastSettleMs(run.beat.groups.reduce((n,g) => n+g.cells.length,0)) : beatSettleMs(cells, run.lastGroupCount);
  s = {...s, [side]: {...fighter, resolvedSequence: run.eventSequence,
    exactBeats: fighter.exactBeats + Number(run.lastBeatGrade === 'perfect'), totalBeats: fighter.totalBeats + 1,
    nextBeatAt: s.elapsed + settle}};
  s = emit(s, {side, type: run.beat.voided ? 'blast' : damage ? 'volley' : 'miss', run, damage});
  if (side === 'player' && run.beat.voided) {
    const count = riggedCells(run).length;
    if (count) {
      const penalty = Math.min(BACKFIRE.maxDamage, count * BACKFIRE.perCell);
      s = emit(s, {side, type: 'backfire', run, damage: penalty, damageTarget: 'player'});
      const hits: PendingImpact[] = Array.from({length: count}, (_, i) => ({side, damageTarget: 'player',
        at: s.elapsed + arrivalTime(BACKFIRE.shakeMs + i * CELL_STAGGER_MS),
        damage: cellDamage(penalty, count, i), volleyId: s.eventSequence, cellIndex: i}));
      s = {...s, player: {...s.player, nextBeatAt: Math.max(s.player.nextBeatAt, hits[count-1].at + 100)},
        impacts: [...s.impacts, ...hits].sort((a,b) => a.at-b.at || a.volleyId-b.volleyId || a.cellIndex-b.cellIndex)};
    }
  }
  if (damage) s = {...s, impacts: [...s.impacts, ...Array.from({length: cells}, (_, i) => ({
    side, at: s.elapsed + arrivalTime(i * CELL_STAGGER_MS), damage: cellDamage(damage, cells, i), volleyId: s.eventSequence, cellIndex: i,
  }))].sort((a,b) => a.at-b.at || a.volleyId-b.volleyId || a.cellIndex-b.cellIndex)};
  return s;
}
function applyAction(s: CombatState, side: Combatant, action: SlotAction): CombatState {
  const fighter = s[side], run = slotReducer(fighter.run, action);
  if (run === fighter.run) return s;
  s = {...s, [side]: {...fighter, run, lastDropAt: s.elapsed}};
  s = emit(s, {side, type: run.beat.placements.at(-1)?.absorbed ? 'chip' : 'placement', run});
  return resolve(s, side);
}
function impactsAt(s: CombatState): CombatState {
  const due = s.impacts.filter(i => i.at <= s.elapsed);
  if (!due.length) return s;
  s = {...s, impacts: s.impacts.filter(i => i.at > s.elapsed)};
  for (const hit of due) {
    const target = hit.damageTarget ?? (hit.side === 'player' ? 'opponent' : 'player');
    const hp = target === 'player' ? 'playerHp' : 'opponentHp';
    s = {...s, [hp]: Math.max(0, s[hp] - hit.damage)};
    s = emit(s, {type: 'impact', side: hit.side, damageTarget: target, damage: hit.damage, volleyId: hit.volleyId, cellIndex: hit.cellIndex});
  }
  if (!s.playerHp || !s.opponentHp) {
    s = {...s, impacts: [], outcome: !s.playerHp && !s.opponentHp ? 'draw' : !s.opponentHp ? 'won' : 'lost'};
    s = emit(s, {type: 'end', side: 'player'});
  }
  return s;
}
function aiAction(s: CombatState): CombatState {
  if (s.aiAccurate === null) {
    const [accuracy, next] = randomStep(s.aiSeed);
    const [roll, seed] = randomStep(next);
    s = {...s, aiSeed: seed, aiAccurate: accuracy < s.definition.ai.accuracy, aiRoll: roll};
  }
  const action = choosePlacement(s.opponent.run, s.aiAccurate!, s.elapsed - s.opponent.lastDropAt, s.aiRoll);
  if (!action) {
    const deadline = beatDeadlineMs(s.opponent.run);
    return {...s, aiAt: deadline === null ? Infinity : s.opponent.beatStartedAt + deadline};
  }
  s = applyAction(s, 'opponent', action);
  const [delay, aiSeed] = actionDelay(s.definition.ai, s.aiSeed);
  return {...s, aiAt: s.opponent.run.beat.status === 'resolved' ? Infinity : s.elapsed + delay, aiSeed, aiAccurate: null};
}
function deadline(f: CombatantState) {
  const d = beatDeadlineMs(f.run);
  return f.run.beat.status === 'resolved' ? f.nextBeatAt : d === null ? Infinity : f.beatStartedAt + d;
}
/** Process deadlines at their authored time, not the render frame that happens to notice them. */
export function tickCombat(s: CombatState, now: number): CombatState {
  if (s.outcome || !Number.isFinite(now) || now < s.elapsed) return s;
  const gated = (s.definition.openingGate ?? 0) > s.player.exactBeats;
  if (gated) s = {...s, aiAt: now + s.definition.ai.maxActionMs};
  while (!s.outcome) {
    const at = Math.min(deadline(s.player), deadline(s.opponent), s.aiAt, s.impacts[0]?.at ?? Infinity);
    if (at > now) break;
    s = {...s, elapsed: at};
    s = impactsAt(s);
    if (s.outcome) break;
    for (const side of ['player', 'opponent'] as const) {
      const f = s[side];
      if (f.run.beat.status === 'resolved' && f.nextBeatAt <= at) {
        s = {...s, [side]: deal(s, f)};
        if (side === 'opponent') {
          const [delay, aiSeed] = actionDelay(s.definition.ai, s.aiSeed);
          s = {...s, aiAt: at + delay, aiSeed, aiAccurate: null};
        }
      } else if (deadline(f) <= at) {
        s = resolve({...s, [side]: {...f, run: slotReducer(f.run, {type: 'tick', beatElapsedMs: at - f.beatStartedAt})}}, side);
      }
    }
    if (s.aiAt <= at && s.opponent.run.beat.status === 'placing') s = aiAction(s);
  }
  return aliases(s.outcome ? s : {...s, elapsed: now});
}
export function placeCombat(s: CombatState, input: {pieceId: string; row: number; column: number} | {pieceId: string; discard: true}, now: number): CombatState {
  if (s.outcome || s.run.beat.status !== 'placing' || !s.run.tray.some(p => p.id === input.pieceId && !p.used)) return s;
  s = tickCombat(s, now);
  if (s.outcome || s.player.run.beat.status !== 'placing' || !s.player.run.tray.some(p => p.id === input.pieceId && !p.used)) return s;
  const elapsedMs = s.elapsed - s.player.lastDropAt;
  const action: SlotAction = 'discard' in input ? {type: 'discard', pieceId: input.pieceId, elapsedMs} : {type: 'place', ...input, elapsedMs};
  return aliases(applyAction(s, 'player', action));
}
export function resultFor(s: CombatState): DuelResult {
  if (!s.outcome) throw new Error('Duel is still active');
  return {attemptId: s.attemptId, levelId: s.definition.id, won: s.outcome === 'won', outcome: s.outcome,
    accuracy: s.totalBeats ? s.exactBeats / s.totalBeats : 0, bestStreak: s.run.maxCombo, durationMs: s.elapsed, coins: 0, practice: s.practice};
}
