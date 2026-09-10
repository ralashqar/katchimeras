import type { DuelDefinition } from './types';
import { createCombat, placeCombat, tickCombat, type CombatState } from './combat';
import { choosePlacement, randomStep, seedNumber } from './opponent';

/**
 * A human-paced model player, for tuning encounters against something closer to a thumb than the 0.75 s
 * scripted player the original numbers were sized against.
 *
 * The model reads a fresh beat for `readMs`, then places every `placeMs`; each placement is exact with probability
 * `accuracy`, otherwise a partial through the same real-reducer chooser the rival uses. An accurate model waits
 * out a live deadline (a turned target, an armed cycling bomb) the way a careful player does, retrying shortly.
 */
export type ModelPlayer = { readMs: number; placeMs: number; accuracy: number };

/** Roughly a first-session player: unhurried, mostly accurate. */
export const CASUAL: ModelPlayer = { readMs: 1800, placeMs: 1600, accuracy: .85 };

export type ProbeResult = {
  outcome: CombatState['outcome'];
  durationMs: number;
  beats: number;
  exactBeats: number;
  /** Rival beats that resolved into a volley, i.e. visible pressure on the player. */
  rivalVolleys: number;
  playerHpLeft: number;
};

export function probeEncounter(definition: DuelDefinition, seed: string, model: ModelPlayer = CASUAL, limitMs = 240000): ProbeResult {
  let s = createCombat(definition, `probe:${seed}`, seed);
  let rng = seedNumber(`model:${seed}`);
  let nextAct = model.readMs;
  let lastBeat = -1;
  let rivalVolleys = 0;
  let rivalBeats = 0;
  for (let now = 100; now <= limitMs && !s.outcome; now += 100) {
    s = tickCombat(s, now);
    if (s.opponent.totalBeats > rivalBeats) {
      rivalBeats = s.opponent.totalBeats;
      if (s.opponent.run.lastResolution && s.opponent.run.lastResolution.blocksCleared > 0 && !s.opponent.run.beat.voided) rivalVolleys += 1;
    }
    if (s.run.beat.status !== 'placing') continue;
    if (s.run.beat.index !== lastBeat) { lastBeat = s.run.beat.index; nextAct = s.beatStartedAt + model.readMs; }
    if (now < nextAct) continue;
    const [roll, next] = randomStep(rng);
    rng = next;
    const action = choosePlacement(s.run, roll < model.accuracy, now - s.lastDropAt, roll);
    if (!action || (action.type !== 'place' && action.type !== 'discard')) { nextAct = now + 300; continue; }
    s = placeCombat(s, action.type === 'place' ? action : { pieceId: action.pieceId, discard: true }, now);
    nextAct = now + model.placeMs;
  }
  return { outcome: s.outcome, durationMs: s.elapsed, beats: s.player.totalBeats, exactBeats: s.player.exactBeats, rivalVolleys, playerHpLeft: s.playerHp };
}

/** Median of a probe across seeds, for a table that reads at a glance. */
export function probeMedian(definition: DuelDefinition, seeds = 20, model: ModelPlayer = CASUAL) {
  const runs = Array.from({ length: seeds }, (_, i) => probeEncounter(definition, `${definition.id}:${i}`, model));
  const median = (pick: (r: ProbeResult) => number) => {
    const values = runs.map(pick).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };
  return {
    wins: runs.filter(r => r.outcome === 'won').length,
    durationS: Math.round(median(r => r.durationMs) / 1000),
    beats: median(r => r.beats),
    rivalVolleys: median(r => r.rivalVolleys),
    hpLeft: median(r => r.playerHpLeft),
    minHpLeft: Math.min(...runs.map(r => r.playerHpLeft)),
  };
}
