import { HEX_TILE_LIP, HEX_TILE_W, hexSpiral, hexToWorld } from '../../utils/world-hex';
import { kingdomSceneMetrics } from '../../utils/kingdom-rendering';

export function createKingdomRendererFixture(residentCount = 50) {
  const metrics = kingdomSceneMetrics(residentCount);
  const coords = [{ q: 0, r: 0 }, ...hexSpiral(residentCount, false)];
  const artSize = HEX_TILE_W * (1024 / 996);
  const frames = coords.map((coord, index) => {
    const point = hexToWorld(coord);
    const cx = point.x + metrics.centerX;
    const cy = point.y + metrics.centerY;
    return {
      id: index === 0 ? 'kingdom' : `resident:${index}`,
      left: cx - artSize / 2,
      top: cy + HEX_TILE_LIP / 2 - artSize / 2,
      width: artSize,
      height: artSize,
    };
  });
  return { frames, metrics };
}

