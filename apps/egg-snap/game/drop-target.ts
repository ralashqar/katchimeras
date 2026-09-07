import {
  NO_CELL,
  scorePlacement,
  type DropRelease,
  type SlotRunState,
} from "@incubator/tile-match/engine";
import { absorbDrop, eligibleGroups } from "@incubator/tile-match/varieties";

export type TrayBounds = { width: number; trayY: number; trayHeight: number };

/** Use the reducer's attribution rules for the preview, including filled cells and modifier gates. */
export function dropPreview(
  run: SlotRunState,
  pieceId: string,
  cellIndex: number,
) {
  const piece = run.tray.find((p) => p.id === pieceId && !p.used);
  if (!piece || run.beat.status !== "placing" || cellIndex === NO_CELL)
    return [];
  const origin = {
    row: Math.floor(cellIndex / run.grid.cols),
    column: cellIndex % run.grid.cols,
  };
  const groups = run.beat.groups.filter((g) => g.colorId === piece.colorId);
  const covered = scorePlacement(run.grid, [], piece.cells, origin).dropped;
  // Correct shield chips are valid target actions even though they return the piece.
  const candidates = absorbDrop(run.beat, { piece, covered })
    ? groups
    : eligibleGroups({ ...run.beat, groups }, piece);
  const score = scorePlacement(run.grid, candidates, piece.cells, origin);
  const filled = new Set(score.filled);
  return score.dropped.map((index) => ({ index, onTarget: filled.has(index) }));
}

export function shouldCancelDrop(
  run: SlotRunState,
  pieceId: string,
  release: DropRelease,
  tray: TrayBounds,
) {
  // Lift and drag gain let a piece reach low footprints before the finger exits
  // the tray. A real match (including partial credit or a shield chip) wins.
  if (
    dropPreview(run, pieceId, release.cellIndex).some((cell) => cell.onTarget)
  )
    return false;
  return (
    release.fingerX >= 0 &&
    release.fingerX <= tray.width &&
    release.fingerY >= tray.trayY &&
    release.fingerY <= tray.trayY + tray.trayHeight
  );
}
