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

export const FEASTLE_ACT_TWO_ORDER_POOL = [
  { key: 'rainy-warmth', title: 'Warmth after the rain', description: 'Something simple for a villager caught in the rain.', definitionId: 'food:table:3', difficulty: 'small', signal: 'comfort' },
  { key: 'forgotten-lunch', title: 'The forgotten lunch', description: 'A quick plate before hunger turns theatrical.', definitionId: 'food:table:3', secondaryDefinitionId: 'food:table:2', difficulty: 'small', signal: 'ease' },
  { key: 'traveller-snack', title: 'A familiar bite', description: 'A traveller misses the snack they know by heart.', definitionId: 'food:table:3', difficulty: 'small', signal: 'comfort' },
  { key: 'crumb-note', title: 'Written entirely in crumbs', description: 'The request is mysterious, but apparently urgent.', definitionId: 'food:table:3', secondaryDefinitionId: 'food:table:2', difficulty: 'small', signal: 'curiosity' },
  { key: 'quiet-company', title: 'A table for quiet company', description: 'Two villagers would like to sit together without making a fuss.', definitionId: 'food:table:4', secondaryDefinitionId: 'food:table:3', difficulty: 'medium', signal: 'connection' },
  { key: 'late-shift', title: 'After the late shift', description: 'A dependable dish for someone whose day ran long.', definitionId: 'food:table:4', difficulty: 'medium', signal: 'ease' },
  { key: 'new-neighbour', title: 'Welcome, new neighbour', description: 'A warm dish can make an unfamiliar table easier.', definitionId: 'food:table:4', secondaryDefinitionId: 'food:table:3', difficulty: 'medium', signal: 'connection' },
  { key: 'suspicious-spice', title: 'The suspicious spice club', description: 'Three brave villagers want to try something different.', definitionId: 'food:table:4', secondaryDefinitionId: 'food:table:2', difficulty: 'medium', signal: 'curiosity' },
  { key: 'long-table', title: 'Room at the long table', description: 'A generous meal for a table that keeps adding chairs.', definitionId: 'food:table:5', secondaryDefinitionId: 'food:table:3', difficulty: 'major', signal: 'connection' },
  { key: 'market-surprise', title: 'The market surprise', description: 'Make a meal from the village’s most unexpected basket.', definitionId: 'food:table:5', secondaryDefinitionId: 'food:table:3', difficulty: 'major', signal: 'curiosity' },
] as const;

export type FeastleActTwoOrderTemplate = (typeof FEASTLE_ACT_TWO_ORDER_POOL)[number];

export function selectFeastleActTwoOrderKeys(seed: string): string[] {
  const groups: FeastleActTwoOrderTemplate[][] = [
    FEASTLE_ACT_TWO_ORDER_POOL.filter((item) => item.difficulty === 'small'),
    FEASTLE_ACT_TWO_ORDER_POOL.filter((item) => item.difficulty === 'medium'),
    FEASTLE_ACT_TWO_ORDER_POOL.filter((item) => item.difficulty === 'major'),
  ];
  return [
    ...pickStable(groups[0], 2, `${seed}:small`),
    ...pickStable(groups[1], 2, `${seed}:medium`),
    ...pickStable(groups[2], 1, `${seed}:major`),
  ].map((item) => item.key);
}

function pickStable<T extends { key: string }>(items: readonly T[], count: number, seed: string): T[] {
  return [...items]
    .sort((left, right) => hash(`${seed}:${left.key}`) - hash(`${seed}:${right.key}`))
    .slice(0, count);
}

function hash(value: string): number {
  let output = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    output ^= value.charCodeAt(index);
    output = Math.imul(output, 16777619);
  }
  return output >>> 0;
}
