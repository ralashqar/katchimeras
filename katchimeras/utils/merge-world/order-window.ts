export const MAX_MOUNTED_ORDER_TRAYS = 6;

export function orderMountWindow(centerIndex: number, entryCount: number) {
  const count = Math.max(0, Math.floor(entryCount));
  const size = Math.min(MAX_MOUNTED_ORDER_TRAYS, count);
  const clampedCenter = Math.max(0, Math.min(Math.floor(centerIndex), Math.max(0, count - 1)));
  const start = Math.max(0, Math.min(clampedCenter - Math.floor(size / 2), count - size));
  return { start, end: start + size };
}
