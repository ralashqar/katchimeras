export function resolveCollectionDeckWindow(
  length: number,
  selectedIndex: number,
  radius = 3
): number[] {
  if (length <= 0) return [];
  const center = Math.max(0, Math.min(length - 1, selectedIndex));
  const resolvedRadius = Math.max(1, Math.floor(radius));
  const start = Math.max(0, center - resolvedRadius);
  const end = Math.min(length - 1, center + resolvedRadius);
  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
}
