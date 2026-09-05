export const MAX_MOUNTED_ORDER_TRAYS = 6;

export function orderMountWindow(centerIndex: number, entryCount: number) {
  const count = Math.max(0, Math.floor(entryCount));
  const size = Math.min(MAX_MOUNTED_ORDER_TRAYS, count);
  const clampedCenter = Math.max(0, Math.min(Math.floor(centerIndex), Math.max(0, count - 1)));
  const start = Math.max(0, Math.min(clampedCenter - Math.floor(size / 2), count - size));
  return { start, end: start + size };
}

/** Exact viewport intersection (including partially visible cards), separate
 * from the six-card image prefetch/mount window. Unknown layout runs no effects. */
export function orderVisibleWindow(offset: number, width: number, entryCount: number, stride: number, cardWidth: number, paddingLeft = 0) {
  const count = Math.max(0, Math.floor(entryCount));
  if (width <= 0 || stride <= 0 || !count) return { start: 0, end: 0 };
  const x = Math.max(0, offset) - paddingLeft;
  const start = Math.min(count, Math.max(0, Math.floor((x - cardWidth) / stride) + 1));
  const end = Math.min(count, Math.max(start, Math.ceil((x + width) / stride)));
  return { start, end };
}

export function orderViewportWindows(offset: number, width: number, entryCount: number, stride: number, cardWidth: number, paddingLeft = 0) {
  const visible = orderVisibleWindow(offset, width, entryCount, stride, cardWidth, paddingLeft);
  // Centre on intersecting card indices, not the pixel midpoint: a 600px
  // viewport can straddle six cards and needs both edge cards mounted.
  const mounted = orderMountWindow(Math.floor((visible.start + visible.end) / 2), entryCount);
  return { mounted, visible };
}
