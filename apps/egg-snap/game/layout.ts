import { SLOT_GRID, SLOT_CAPTURE_MARGIN } from "@incubator/tile-match/engine";
import {
  boardMetricsForCell,
  firstCellCenter,
} from "@incubator/tile-match/geometry";
import { slotPlayRect } from "@incubator/tile-match/timing";

export function battleLayout(
  width: number,
  height: number,
  top: number,
  bottom: number,
) {
  const cell = Math.max(24, Math.min(42, Math.floor((width - 32 - 8 * 3) / 9)));
  const metrics = boardMetricsForCell(SLOT_GRID, cell);
  const play = slotPlayRect(metrics);
  const x = (width - metrics.width) / 2;
  const trayHeight = 118;
  const trayY = height - bottom - trayHeight - 38;
  const y = trayY - 22 - play.height - play.y;
  const first = firstCellCenter(metrics);
  const eggSize = Math.min(width * 0.48, metrics.pitch * 4.8);
  return {
    width,
    height,
    metrics,
    field: { x, y },
    trayY,
    trayHeight,
    eggSize,
    eggY: y + play.y + play.height / 2 - eggSize / 2,
    opponentSize: Math.min(145, height * 0.19, Math.max(72, y + play.y - (top + 62) - 72)),
    opponentY: top + 62,
    driftAmplitude: Math.max(0, Math.min(42, y + play.y - (top + 252))),
    dropFrame: {
      anchorX: x + first.x,
      anchorY: y + first.y,
      pitch: metrics.pitch,
      rows: SLOT_GRID.rows,
      cols: SLOT_GRID.cols,
      captureMargin: SLOT_CAPTURE_MARGIN,
    },
  };
}
