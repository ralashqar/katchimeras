export function todayTileWindowIndices(
  centerIndex: number,
  itemCount: number,
): number[] {
  if (itemCount <= 0) return [];
  const center = Math.max(0, Math.min(itemCount - 1, centerIndex));
  const indices: number[] = [];
  for (let index = Math.max(0, center - 1); index <= Math.min(itemCount - 1, center + 1); index += 1) {
    indices.push(index);
  }
  return indices;
}

/**
 * Keeps both endpoints alive while the camera moves. A non-adjacent top-bar
 * jump also retains its corridor so the camera never crosses an empty world.
 */
export function todayTileTransitionIndices(
  fromIndex: number,
  toIndex: number,
  itemCount: number,
): number[] {
  const indices = new Set([
    ...todayTileWindowIndices(fromIndex, itemCount),
    ...todayTileWindowIndices(toIndex, itemCount),
  ]);
  const start = Math.max(0, Math.min(fromIndex, toIndex));
  const end = Math.min(itemCount - 1, Math.max(fromIndex, toIndex));
  for (let index = start; index <= end; index += 1) {
    indices.add(index);
  }
  return [...indices].sort((left, right) => left - right);
}
