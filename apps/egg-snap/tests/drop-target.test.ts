import assert from "node:assert/strict";
import { test } from "node:test";
import { NO_CELL, type DropRelease } from "@incubator/tile-match/engine";
import { varietyData } from "@incubator/tile-match/varieties";
import { DUELS, MOVES } from "../data/campaign";
import { createCombat, placeCombat, tickCombat } from "../game/combat";
import { battleLayout } from "../game/layout";
import { dropPreview, shouldCancelDrop } from "../game/drop-target";

function targetRelease(
  s: ReturnType<typeof createCombat>,
  pieceId: string,
  tray: ReturnType<typeof battleLayout>,
): DropRelease {
  const group = s.run.beat.groups.find((g) => g.pieceId === pieceId)!;
  return {
    cellIndex: group.origin.row * s.run.grid.cols + group.origin.column,
    centerX: 60,
    centerY: tray.trayY - 55,
    fingerX: 80,
    fingerY: tray.trayY + 20,
  };
}

test("a green target wins over finger-in-tray cancellation and resolves damage", () => {
  const tray = battleLayout(390, 844, 0, 0);
  const s = createCombat(DUELS[0], "regression", "green-tray");
  const p = s.run.tray[0];
  const release = targetRelease(s, p.id, tray);
  assert.ok(
    dropPreview(s.run, p.id, release.cellIndex).every((c) => c.onTarget),
  );
  assert.equal(shouldCancelDrop(s.run, p.id, release, tray), false);
  const next = placeCombat(
    s,
    { pieceId: p.id, ...s.run.beat.groups[0].origin },
    900,
  );
  assert.equal(next.run.lastBeatGrade, "perfect");
  assert.ok(next.opponentHp < s.opponentHp);
});

test("returning to the tray away from targets still cancels, including empty captured grid cells", () => {
  const s = createCombat(DUELS[0], "cancel", "cancel");
  const tray = battleLayout(390, 844, 0, 0);
  const p = s.run.tray[0];
  const release = targetRelease(s, p.id, tray);
  for (const cellIndex of [NO_CELL, 0]) {
    assert.equal(
      shouldCancelDrop(s.run, p.id, { ...release, cellIndex }, tray),
      true,
    );
    assert.equal(
      shouldCancelDrop(
        s.run,
        p.id,
        { ...release, cellIndex, fingerY: tray.trayY - 10 },
        tray,
      ),
      false,
    );
  }
});

test("partial matching cells still land when the finger overlaps the tray", () => {
  const s = createCombat(DUELS[1], "partial", "lower-target");
  const tray = battleLayout(390, 844, 0, 0);
  const p = s.run.tray[0];
  const release = targetRelease(s, p.id, tray);
  release.cellIndex -= s.run.grid.cols;
  const preview = dropPreview(s.run, p.id, release.cellIndex);
  assert.ok(preview.some((c) => c.onTarget));
  assert.ok(preview.some((c) => !c.onTarget));
  assert.equal(shouldCancelDrop(s.run, p.id, release, tray), false);
  const next = placeCombat(
    s,
    {
      pieceId: p.id,
      row: Math.floor(release.cellIndex / s.run.grid.cols),
      column: release.cellIndex % s.run.grid.cols,
    },
    800,
  );
  assert.equal(
    next.run.beat.placements.at(-1)?.filled.length,
    preview.filter((c) => c.onTarget).length,
  );
  assert.equal(next.run.tray.find((piece) => piece.id === p.id)?.used, true);
});

test("shield chips are processed before tray cancellation and return an unspent piece", () => {
  const s = createCombat(DUELS[3], "chip", "chip");
  const tray = battleLayout(390, 844, 0, 0);
  const shield = varietyData<{ pieceId: string }>(s.run.beat, "armour")!;
  const release = targetRelease(s, shield.pieceId, tray);
  assert.ok(
    dropPreview(s.run, shield.pieceId, release.cellIndex).every(
      (c) => c.onTarget,
    ),
  );
  assert.equal(shouldCancelDrop(s.run, shield.pieceId, release, tray), false);
  const origin = s.run.beat.groups.find(
    (g) => g.pieceId === shield.pieceId,
  )!.origin;
  const chipped = placeCombat(s, { pieceId: shield.pieceId, ...origin }, 800);
  assert.equal(chipped.run.beat.placements.at(-1)?.absorbed, true);
  assert.equal(
    chipped.run.tray.find((p) => p.id === shield.pieceId)?.used,
    false,
  );
  const filled = placeCombat(
    chipped,
    { pieceId: shield.pieceId, ...origin },
    1600,
  );
  assert.equal(
    filled.run.tray.find((p) => p.id === shield.pieceId)?.used,
    true,
  );
});

test("wrong colours and already-filled cells never produce a green preview", () => {
  const s = createCombat(DUELS[1], "preview", "lower-target");
  const p = s.run.tray[0];
  const target = s.run.beat.groups[0];
  const index = target.origin.row * s.run.grid.cols + target.origin.column;
  const filledRun = {
    ...s.run,
    beat: {
      ...s.run.beat,
      groups: s.run.beat.groups.map((g) => ({ ...g, filled: [...g.cells] })),
    },
  };
  assert.ok(dropPreview(filledRun, p.id, index).every((c) => !c.onTarget));
  const other = s.run.tray.find((q) => q.colorId !== p.colorId)!;
  assert.ok(other);
  assert.ok(dropPreview(s.run, other.id, index).every((c) => !c.onTarget));
});

test("the same held-cell preview follows a colour shift without moving the pointer", () => {
  let s = createCombat({ ...DUELS[0], progression: { kind: "stream", turns: [{ slots: 1, varieties: [] }], loop: true }, moves: [MOVES.hues] }, "hues", "hues");
  const tray = battleLayout(390, 844, 0, 0);
  const p = s.run.tray[0];
  const release = targetRelease(s, p.id, tray);
  s = tickCombat(s, 1);
  assert.ok(
    dropPreview(s.run, p.id, release.cellIndex).every((c) => !c.onTarget),
  );
  const data = varietyData<{ nextSwapMs: number }>(s.run.beat, "hues")!;
  s = tickCombat(s, data.nextSwapMs);
  assert.ok(
    dropPreview(s.run, p.id, release.cellIndex).every((c) => c.onTarget),
  );
  assert.equal(shouldCancelDrop(s.run, p.id, release, tray), false);
});
