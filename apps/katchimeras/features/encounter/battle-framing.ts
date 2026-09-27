export type BattleTileFrame = { left: number; top: number; width: number; height: number };
export type BattleTileFraming = { frame: BattleTileFrame; viewport: { width: number; height: number } };
export type CaptureBattleTile = (layerId: string) => Promise<BattleTileFrame | null>;

/** Same centre-origin transforms as the world camera and its tile focus wrapper. */
export function projectBattleTile(frame: BattleTileFrame, scene: { width: number; height: number },
  camera: { tx: number; ty: number; scale: number }, origin: { x: number; y: number },
  focus: { x: number; y: number; scale: number }) {
  return {
    left: origin.x + scene.width / 2 + camera.tx
      + (focus.x + (frame.left - focus.x) * focus.scale - scene.width / 2) * camera.scale,
    top: origin.y + scene.height / 2 + camera.ty
      + (focus.y + (frame.top - focus.y) * focus.scale - scene.height / 2) * camera.scale,
    width: frame.width * focus.scale * camera.scale,
    height: frame.height * focus.scale * camera.scale,
  };
}

/** Same device: exact pixels. Resizing follows the board's width scale and bottom anchor. */
export function restoreBattleTileFrame(saved: BattleTileFraming, viewport: BattleTileFraming['viewport']): BattleTileFrame {
  const scale = viewport.width / saved.viewport.width;
  return { left: saved.frame.left * scale, width: saved.frame.width * scale, height: saved.frame.height * scale,
    top: viewport.height - (saved.viewport.height - saved.frame.top) * scale };
}

/** Let child focus effects commit, then reject stale or interrupted native measurements. */
export async function captureSettledBattleTile(isCurrent: () => boolean, capture: () => Promise<BattleTileFrame | null>,
  nextFrame: () => Promise<void> = () => new Promise(resolve => requestAnimationFrame(() => resolve()))) {
  await nextFrame();
  await nextFrame();
  if (!isCurrent()) return null;
  const frame = await capture();
  return isCurrent() ? frame : null;
}
