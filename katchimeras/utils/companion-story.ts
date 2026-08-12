export function nextFeastleBundleOrderId(completedOrderIds: readonly string[], targetLevel: number, storyStepCount: number): string | null {
  const bundlePrefix = `merge-story:feastle:chapter-1:level-${targetLevel}:order-`;
  return Array.from({ length: Math.max(0, storyStepCount) }, (_, index) => `${bundlePrefix}${index + 1}`)
    .find((id) => !completedOrderIds.includes(id)) ?? null;
}

export function accumulateQuietBond(
  currentPoints: number,
  processedReceiptIds: readonly string[],
  receiptId: string,
  points: number,
): { points: number; processedReceiptIds: string[]; changed: boolean } {
  if (!receiptId || processedReceiptIds.includes(receiptId)) {
    return { points: currentPoints, processedReceiptIds: [...processedReceiptIds], changed: false };
  }
  return {
    points: Math.max(0, Math.floor(currentPoints)) + Math.max(0, Math.floor(points)),
    processedReceiptIds: [...processedReceiptIds, receiptId],
    changed: true,
  };
}
