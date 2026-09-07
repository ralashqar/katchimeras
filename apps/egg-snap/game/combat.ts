import {
  createSlotRun,
  slotReducer,
  paceBudgetMs,
  type SlotAction,
  type SlotRunState,
  type Progression,
} from "@incubator/tile-match/engine";
import {
  beatPaceAllowanceMs,
  varietyData,
} from "@incubator/tile-match/varieties";
import { beatSettleMs, blastSettleMs } from "@incubator/tile-match/timing";
import type {
  DuelDefinition,
  DuelResult,
  OpponentMoveDefinition,
} from "./types";

export const COMBAT = {
  perCell: 2,
  exactBonus: 4,
  lateBonus: 2,
  comboStep: 0.125,
  comboCap: 2.25,
} as const;
export type CombatEvent = {
  id: number;
  at: number;
  type:
    | "volley"
    | "miss"
    | "blast"
    | "chip"
    | "hit"
    | "interrupt"
    | "warning"
    | "end";
  damage?: number;
  run?: SlotRunState;
};
export type CombatState = {
  definition: DuelDefinition;
  attemptId: string;
  practice: boolean;
  run: SlotRunState;
  elapsed: number;
  beatStartedAt: number;
  lastDropAt: number;
  nextBeatAt: number;
  playerHp: number;
  opponentHp: number;
  phase: "recovery" | "warning";
  moveIndex: number;
  attackAt: number;
  recoveryUntil: number;
  perfects: number;
  resolvedSequence: number;
  eventSequence: number;
  events: readonly CombatEvent[];
  exactBeats: number;
  totalBeats: number;
  outcome: "won" | "lost" | null;
};
function progressionFor(
  d: DuelDefinition,
  move: OpponentMoveDefinition,
): Progression {
  if (d.progression.kind === "stream")
    return {
      ...d.progression,
      turns: d.progression.turns.map((t) => ({
        ...t,
        ...(move.varieties.some(v => v.id === 'fuse') ? { minShapeHeight: 2 } : {}),
        varieties: move.varieties,
      })),
    };
  return d.progression;
}
export function currentMove(s: CombatState) {
  return s.definition.moves[s.moveIndex % s.definition.moves.length];
}
export function warningDuration(
  run: SlotRunState,
  move: OpponentMoveDefinition,
) {
  // Armour chips cost real time even though the puzzle excludes them from pace grading.
  const armour = move.varieties.find((v) => v.id === "armour");
  const protection = varietyData<{ hp: Record<number, number> }>(
    run.beat,
    "armour",
  );
  const chips = Math.max(
    armour ? (armour.strength >= 0.5 ? 2 : 1) : 0,
    ...Object.values(protection?.hp ?? {}),
  );
  const chipMs = chips * 1500;
  const cells = run.beat.groups.reduce((n, g) => n + g.cells.length, 0);
  return Math.max(
    move.warningMs,
    move.perfects *
      (paceBudgetMs(run.tray.length, beatPaceAllowanceMs(run.beat)) +
        chipMs +
        beatSettleMs(cells, run.beat.groups.length)) +
      500,
  );
}
function warningFor(s: CombatState, move: OpponentMoveDefinition) {
  // Preview the next authored beat without changing the live run or RNG. A warning
  // can start over the previous move's footprint, so budget both sides of that boundary.
  const preview = slotReducer(
    {
      ...s.run,
      progression: progressionFor(s.definition, move),
      beat: { ...s.run.beat, status: "resolved" },
    },
    { type: "next_beat" },
  );
  return Math.max(warningDuration(s.run, move), warningDuration(preview, move));
}
export function createCombat(
  definition: DuelDefinition,
  attemptId: string,
  seed: string,
  practice = false,
): CombatState {
  const run = createSlotRun(seed, {
    progression: progressionFor(definition, definition.moves[0]),
    launch: false,
  });
  return {
    definition,
    attemptId,
    practice,
    run,
    elapsed: 0,
    beatStartedAt: 0,
    lastDropAt: 0,
    nextBeatAt: 0,
    playerHp: definition.playerHealth,
    opponentHp: definition.health,
    phase: "warning",
    moveIndex: 0,
    attackAt: warningDuration(run, definition.moves[0]),
    recoveryUntil: 0,
    perfects: 0,
    resolvedSequence: 0,
    eventSequence: 0,
    events: [],
    exactBeats: 0,
    totalBeats: 0,
    outcome: null,
  };
}
function emit(
  s: CombatState,
  event: Omit<CombatEvent, "id" | "at">,
): CombatState {
  const id = s.eventSequence + 1;
  return {
    ...s,
    eventSequence: id,
    events: [...s.events.slice(-23), { ...event, id, at: s.elapsed }],
  };
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
function finish(s: CombatState): CombatState {
  if (s.outcome) return s;
  if (s.opponentHp <= 0)
    return emit({ ...s, outcome: "won", phase: "recovery" }, { type: "end" });
  if (s.playerHp <= 0)
    return emit({ ...s, outcome: "lost", phase: "recovery" }, { type: "end" });
  return s;
}
function resolve(s: CombatState): CombatState {
  const run = s.run;
  if (run.eventSequence <= s.resolvedSequence || !run.lastResolution) return s;
  const damage = damageFor(run);
  const exact = run.lastBeatGrade === "perfect";
  const settle = run.beat.voided
    ? blastSettleMs(run.beat.groups.reduce((n, g) => n + g.cells.length, 0))
    : beatSettleMs(run.lastResolution.blocksCleared, run.lastGroupCount);
  s = {
    ...s,
    resolvedSequence: run.eventSequence,
    opponentHp: Math.max(0, s.opponentHp - damage),
    exactBeats: s.exactBeats + Number(exact),
    totalBeats: s.totalBeats + 1,
    nextBeatAt: s.elapsed + settle,
    perfects: s.perfects + Number(exact && s.phase === "warning"),
  };
  s = emit(s, {
    type: run.beat.voided ? "blast" : damage > 0 ? "volley" : "miss",
    damage,
    run,
  });
  s = finish(s); // A lethal placement at a deadline cancels that attack.
  if (
    !s.outcome &&
    s.phase === "warning" &&
    s.perfects >= currentMove(s).perfects
  ) {
    s = emit(
      {
        ...s,
        phase: "recovery",
        recoveryUntil: s.elapsed + currentMove(s).recoveryMs,
        moveIndex: s.moveIndex + 1,
        perfects: 0,
      },
      { type: "interrupt" },
    );
  }
  return s;
}
function advance(s: CombatState, now: number, inclusive: boolean): CombatState {
  if (s.outcome) return s;
  s = { ...s, elapsed: Math.max(s.elapsed, now) };
  if (s.run.beat.status === "placing")
    s = resolve({
      ...s,
      run: slotReducer(s.run, {
        type: "tick",
        beatElapsedMs: s.elapsed - s.beatStartedAt,
      }),
    });
  if (s.outcome) return s;
  if (
    s.phase === "warning" &&
    (inclusive ? s.elapsed >= s.attackAt : s.elapsed > s.attackAt)
  ) {
    const move = currentMove(s);
    s = emit(
      {
        ...s,
        playerHp: Math.max(0, s.playerHp - move.damage),
        phase: "recovery",
        recoveryUntil: s.elapsed + move.recoveryMs,
        moveIndex: s.moveIndex + 1,
        perfects: 0,
      },
      { type: "hit", damage: move.damage },
    );
    s = finish(s);
  }
  if (s.outcome) return s;
  // Recovery must expire even when the player stops dragging. The currently
  // visible beat stays intact; a different modifier is dealt only at its boundary.
  if (s.phase === "recovery" && s.elapsed >= s.recoveryUntil) {
    const move = currentMove(s);
    s = emit(
      {
        ...s,
        phase: "warning",
        perfects: 0,
        attackAt: s.elapsed + warningFor(s, move),
      },
      { type: "warning" },
    );
  }
  if (s.run.beat.status === "resolved" && s.elapsed >= s.nextBeatAt) {
    const move = currentMove(s);
    const run = slotReducer(
      { ...s.run, progression: progressionFor(s.definition, move) },
      { type: "next_beat" },
    );
    s = { ...s, run, beatStartedAt: s.elapsed, lastDropAt: s.elapsed };
  }
  return s;
}
export function tickCombat(s: CombatState, now: number) {
  return advance(s, now, true);
}
export function placeCombat(
  s: CombatState,
  input:
    | { pieceId: string; row: number; column: number }
    | { pieceId: string; discard: true },
  now: number,
): CombatState {
  if (
    s.outcome ||
    s.run.beat.status !== "placing" ||
    !s.run.tray.some((p) => p.id === input.pieceId && !p.used)
  )
    return s;
  s = advance(s, now, false);
  if (s.outcome) return s;
  const action: SlotAction =
    "discard" in input
      ? {
          type: "discard",
          pieceId: input.pieceId,
          elapsedMs: s.elapsed - s.lastDropAt,
        }
      : { type: "place", ...input, elapsedMs: s.elapsed - s.lastDropAt };
  const run = slotReducer(s.run, action);
  s = { ...s, run, lastDropAt: s.elapsed };
  if (run.beat.placements.at(-1)?.absorbed) s = emit(s, { type: "chip" });
  return advance(resolve(s), s.elapsed, true);
}
export function resultFor(s: CombatState): DuelResult {
  if (!s.outcome) throw new Error("Duel is still active");
  return {
    attemptId: s.attemptId,
    levelId: s.definition.id,
    won: s.outcome === "won",
    accuracy: s.totalBeats ? s.exactBeats / s.totalBeats : 0,
    bestStreak: s.run.maxCombo,
    durationMs: s.elapsed,
    coins: 0,
    practice: s.practice,
  };
}
