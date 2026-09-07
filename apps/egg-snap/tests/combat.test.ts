import assert from "node:assert/strict";
import { test } from "node:test";
import { DUELS, MOVES, validateCampaign, validateDuel } from "../data/campaign";
import {
  createCombat,
  placeCombat,
  tickCombat,
  warningDuration,
  type CombatState,
} from "../game/combat";
import { battleLayout } from "../game/layout";
import { varietyData } from "@incubator/tile-match/varieties";
import { slotPlayRect } from "@incubator/tile-match/timing";

test('content rejects incompatible footprint mechanics', () => {
  assert.throws(() => validateDuel({ ...DUELS[1], progression: { kind: "stream", turns: [{ slots: 2, varieties: [] }], loop: true }, moves: [MOVES.fuse] }), /single/);
  assert.throws(() => validateDuel({ ...DUELS[0], progression: { kind: "stream", turns: [{ slots: 1, varieties: [] }], loop: true }, moves: [MOVES.bomb] }), /second piece/);
});

test('changing warnings preserves the live beat and does not extend deadlines on misses', () => {
  let s = createCombat(DUELS[5], 'boundary', 'boundary');
  const beat = s.run.beat;
  s = tickCombat(s, s.attackAt);
  s = tickCombat(s, s.recoveryUntil);
  assert.equal(s.run.beat, beat);
  const attackAt = s.attackAt;
  for (let i = 0; i < 3; i++) {
    for (const p of s.run.tray.filter(p => !p.used)) s = placeCombat(s, {pieceId: p.id, discard: true}, s.elapsed + 50);
    s = tickCombat(s, s.nextBeatAt);
    assert.equal(s.attackAt, attackAt);
  }
  const hp = s.playerHp;
  s = tickCombat(s, attackAt);
  assert.ok(s.playerHp < hp);
});

test('late input from a retired tray cannot affect the new beat', () => {
  let s = createCombat(DUELS[0], 'stale', 'stale');
  const input = { pieceId: s.run.tray[0].id, ...s.run.beat.groups[0].origin };
  s = solve(s); s = tickCombat(s, s.nextBeatAt);
  assert.equal(placeCombat(s, input, s.elapsed + 100), s);
});

test('every Egg Snap jigsaw seed produces two normalized, playable halves', () => {
  for (let seed = 0; seed < 40; seed++) {
    const s = createCombat(DUELS[6], 'jigsaw', String(seed));
    assert.equal(s.run.tray.length, 2);
    for (const piece of s.run.tray) {
      assert.equal(Math.min(...piece.cells.map(c => c.row)), 0);
      assert.equal(Math.min(...piece.cells.map(c => c.column)), 0);
    }
    assert.equal(solve(s).run.lastBeatGrade, 'perfect');
  }
});

function solve(s: CombatState, perDrop = 1100) {
  let guard = 0;
  while (!s.outcome && s.run.beat.status === "placing" && guard++ < 15) {
    const bomb = varietyData<{
      pieceId: string;
      armed: boolean;
      variant: string;
      nextToggleMs: number;
    }>(s.run.beat, "bomb");
    if (bomb?.armed && bomb.variant === "cycle")
      s = tickCombat(s, s.beatStartedAt + bomb.nextToggleMs);
    const piece =
      s.run.tray.find(
        (p) =>
          !p.used &&
          !(bomb?.armed && bomb.variant === "defuse" && bomb.pieceId === p.id),
      ) ?? s.run.tray.find((p) => !p.used)!;
    const group = s.run.beat.groups.find((g) => g.pieceId === piece.id)!;
    s = placeCombat(
      s,
      { pieceId: piece.id, ...group.origin },
      s.elapsed + perDrop,
    );
  }
  return s;
}
test("campaign is valid and each duel starts with its authored mechanic, without a racing launch", () => {
  validateCampaign();
  for (const d of DUELS) {
    const s = createCombat(d, d.id, d.id);
    assert.equal(s.run.beat.launch, false);
    assert.deepEqual(
      s.run.beat.varieties.map((v) => v.id),
      d.moves[0].varieties.map((v) => v.id),
    );
  }
});
test("damage happens once per complete beat; duplicate drop cannot pay twice", () => {
  let s = createCombat(DUELS[1], "test", "test");
  const p = s.run.tray[0];
  const g = s.run.beat.groups.find((g) => g.pieceId === p.id)!;
  s = placeCombat(s, { pieceId: p.id, ...g.origin }, 800);
  assert.equal(s.opponentHp, DUELS[1].health);
  const before = s;
  s = placeCombat(s, { pieceId: p.id, ...g.origin }, 900);
  assert.equal(s, before);
  s = solve(s);
  assert.ok(s.opponentHp < DUELS[1].health);
  const hp = s.opponentHp;
  s = tickCombat(s, s.elapsed + 1);
  assert.equal(s.opponentHp, hp);
});
test("exact late beats keep streak and interrupt, misses reset it", () => {
  let s = solve(createCombat(DUELS[0], "test", "test"), 2000);
  assert.equal(s.run.combo, 1);
  assert.equal(s.run.lastBeatPace, "late");
  assert.ok(s.events.some((e) => e.type === "interrupt"));
  s = tickCombat(s, s.nextBeatAt);
  for (const p of s.run.tray.filter(p => !p.used))
    s = placeCombat(s, { pieceId: p.id, discard: true }, s.elapsed + 100);
  assert.equal(s.run.combo, 0);
});
test("a bomb voids all damage including a charged first piece", () => {
  let s = createCombat(
    {
      ...DUELS[4],
      moves: [{ ...MOVES.bomb, varieties: [{ id: "bomb", strength: 0.8 }] }],
    },
    "bomb",
    "bomb",
  );
  const bomb = varietyData<{ pieceId: string }>(s.run.beat, "bomb")!;
  const safe = s.run.tray.find((p) => p.id !== bomb.pieceId)!;
  const group = s.run.beat.groups.find((g) => g.pieceId === safe.id)!;
  s = placeCombat(s, { pieceId: safe.id, ...group.origin }, 100);
  s = placeCombat(s, { pieceId: bomb.pieceId, discard: true }, 200);
  assert.equal(s.run.beat.voided, true);
  assert.equal(s.opponentHp, s.definition.health);
});
test("armour can be chipped finitely and warning includes chip allowance", () => {
  const s = createCombat(DUELS[3], "armour", "armour");
  const next = solve(s);
  assert.equal(next.run.beat.status, "resolved");
  assert.equal(next.run.combo, 1);
  assert.ok(next.events.some((e) => e.type === "chip"));
  assert.ok(warningDuration(s.run, MOVES.armour) >= 8500);
});
test("lethal player placement at the attack deadline wins before incoming damage", () => {
  let s = createCombat(
    { ...DUELS[0], health: 1, playerHealth: 1 },
    "tie",
    "tie",
  );
  const p = s.run.tray[0];
  const g = s.run.beat.groups[0];
  s = placeCombat(s, { pieceId: p.id, ...g.origin }, s.attackAt);
  assert.equal(s.outcome, "won");
  assert.equal(s.playerHp, 1);
});
test("doing nothing loses even after a previous interruption", () => {
  let s = solve(createCombat(DUELS[0], "idle", "idle"));
  const combo = s.run.combo;
  for (let i = 0; i < 150 && !s.outcome; i++)
    s = tickCombat(s, s.elapsed + 1000);
  assert.equal(s.outcome, "lost");
  assert.equal(s.run.combo, combo);
});
test("all campaign duels are winnable by an accurate player and remain deterministic", () => {
  for (const d of DUELS) {
    const simulate = () => {
      let s = createCombat(d, "sim", d.id);
      for (let i = 0; i < 150 && !s.outcome; i++) {
        s = solve(s);
        if (!s.outcome) s = tickCombat(s, s.nextBeatAt + 1);
      }
      return s;
    };
    const a = simulate(),
      b = simulate();
    assert.equal(a.outcome, "won", d.id);
    assert.deepEqual(a, b);
    console.log(
      `${d.id}: ${(a.elapsed / 1000).toFixed(1)}s, ${a.totalBeats} beats`,
    );
  }
});
test("phone layouts fit visible targets and tray with an unobstructed egg", () => {
  for (const [width, height] of [
    [320, 568],
    [375, 667],
    [390, 844],
    [430, 932],
    [768, 1024],
  ]) {
    const l = battleLayout(width, height, 24, 20);
    const p = slotPlayRect(l.metrics);
    assert.ok(l.field.x + p.x >= 0);
    assert.ok(l.field.x + p.x + p.width <= width);
    assert.ok(l.field.y + p.y + p.height < l.trayY);
    assert.ok(l.field.y + p.y - l.driftAmplitude >= l.opponentY + l.opponentSize + 60);
    assert.ok(l.eggSize * 1.12 < l.metrics.pitch * 5.5);
  }
});


test("first duel opens a duo immediately, rolls tricks at four, and doubles tricks at six", () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 25; seed++) {
    let s = createCombat({ ...DUELS[0], health: 10000 }, "ramp", String(seed));
    assert.equal(s.run.tray.length, 1);
    for (let combo = 1; combo <= 8; combo++) {
      s = solve(s);
      assert.equal(s.run.combo, combo);
      s = tickCombat(s, s.nextBeatAt);
      if (combo < 4) {
        assert.equal(s.run.tray.length, 2);
        assert.equal(s.run.beat.varieties.length, 0);
      } else {
        assert.equal(s.run.beat.varieties.length, 1);
        const modifier = s.run.beat.varieties[0].id;
        seen.add(modifier);
        assert.equal(s.run.tray.length, combo >= 6 || modifier === 'fuse' ? 2 : 1);
      }
    }
    for (const p of s.run.tray.filter(p => !p.used)) s = placeCombat(s, { pieceId: p.id, discard: true }, s.elapsed + 100);
    s = tickCombat(s, s.nextBeatAt);
    assert.equal(s.run.combo, 0);
    assert.equal(s.run.tray.length, 1);
  }
  assert.deepEqual([...seen].sort(), ['armour', 'bomb', 'drift', 'fuse']);
});
