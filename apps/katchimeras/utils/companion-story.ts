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
  { key: 'rainy-warmth', title: 'Warmth after the rain', description: 'Something simple for a villager caught in the rain.', definitionId: 'food:table:3', guestDefinitionId: 'drink:hot:2', guestGeneratorId: 'ritual-bar', difficulty: 'small', signal: 'comfort' },
  { key: 'forgotten-lunch', title: 'The forgotten lunch', description: 'A quick plate and a sweet bite before hunger turns theatrical.', definitionId: 'food:table:3', secondaryDefinitionId: 'food:dessert:2', difficulty: 'small', signal: 'ease' },
  { key: 'traveller-snack', title: 'A familiar bite', description: 'A traveller misses the snack and little cake they know by heart.', definitionId: 'food:table:3', secondaryDefinitionId: 'food:dessert:3', difficulty: 'small', signal: 'comfort' },
  { key: 'crumb-note', title: 'Written entirely in crumbs', description: 'The request is mysterious, but apparently urgent.', definitionId: 'food:dessert:3', secondaryDefinitionId: 'food:table:3', difficulty: 'small', signal: 'curiosity' },
  { key: 'quiet-company', title: 'A table for quiet company', description: 'Two villagers would like supper and cake without making a fuss.', definitionId: 'food:table:4', secondaryDefinitionId: 'food:dessert:3', difficulty: 'medium', signal: 'connection' },
  { key: 'cake-for-no-reason', title: 'Cake for no particular reason', description: 'A cheerful little cake beside a simple plate, because ordinary days can have icing too.', definitionId: 'food:dessert:4', secondaryDefinitionId: 'food:table:3', difficulty: 'medium', signal: 'curiosity' },
  { key: 'late-shift', title: 'After the late shift', description: 'A dependable dish for someone whose day ran long.', definitionId: 'food:table:4', guestDefinitionId: 'drink:hot:3', guestGeneratorId: 'ritual-bar', difficulty: 'medium', signal: 'ease' },
  { key: 'new-neighbour', title: 'Welcome, new neighbour', description: 'A warm dish can make an unfamiliar table easier.', definitionId: 'food:table:4', secondaryDefinitionId: 'food:table:3', difficulty: 'medium', signal: 'connection' },
  { key: 'suspicious-spice', title: 'The suspicious spice club', description: 'Three brave villagers want to try something different.', definitionId: 'food:table:4', secondaryDefinitionId: 'food:dessert:3', difficulty: 'medium', signal: 'curiosity' },
  { key: 'long-table', title: 'Room at the long table', description: 'A generous meal and cake for a table that keeps adding chairs.', definitionId: 'food:table:5', secondaryDefinitionId: 'food:dessert:4', difficulty: 'major', signal: 'connection' },
  { key: 'celebration-leftovers', title: 'The leftovers celebration', description: 'A proper cake and a warm shared dish to turn an ordinary ending into an occasion.', definitionId: 'food:dessert:5', secondaryDefinitionId: 'food:table:4', difficulty: 'major', signal: 'connection' },
  { key: 'market-surprise', title: 'The market surprise', description: 'Make a meal from the village’s most unexpected basket.', definitionId: 'food:table:5', guestDefinitionId: 'drink:refresh:3', guestGeneratorId: 'ritual-bar', difficulty: 'major', signal: 'curiosity' },
] as const;

export const BARISTABBIT_CHAPTER_ONE_ORDER_POOL = [
  { key: 'first-pour', title: 'The first pour', description: 'A bright iced cup to open the counter without rushing it.', definitionId: 'drink:refresh:2', difficulty: 'small', signal: 'comfort' },
  { key: 'garden-glass', title: 'A bright garden glass', description: 'A bigger pink smoothie for a villager coming in from the sun.', definitionId: 'drink:refresh:3', difficulty: 'small', signal: 'ease' },
  { key: 'quiet-corner', title: 'The quiet corner', description: 'A strawberry boba for someone who needs ten minutes without a question.', definitionId: 'drink:hot:3', secondaryDefinitionId: 'drink:hot:2', difficulty: 'small', signal: 'comfort' },
  { key: 'two-temperatures', title: 'Two colours, one table', description: 'A pink smoothie and strawberry boba for friends with different favourites.', definitionId: 'drink:refresh:3', secondaryDefinitionId: 'drink:hot:3', difficulty: 'medium', signal: 'connection' },
  { key: 'cake-on-side', title: 'Cake on the side', description: 'A pink smoothie with a small café bake beside it.', definitionId: 'drink:refresh:3', guestDefinitionId: 'food:cafe-pastry:3', guestGeneratorId: 'cafe-counter', difficulty: 'medium', signal: 'curiosity' },
  { key: 'after-the-walk', title: 'After the long walk', description: 'A generous cold pitcher and a smaller caramel latte for the journey home.', definitionId: 'drink:refresh:4', secondaryDefinitionId: 'drink:hot:2', difficulty: 'medium', signal: 'ease' },
  { key: 'catch-up-cups', title: 'The catch-up cups', description: 'Two drinks that can give an overdue conversation somewhere to land.', definitionId: 'drink:refresh:4', secondaryDefinitionId: 'drink:hot:3', difficulty: 'medium', signal: 'connection' },
  { key: 'shared-pause', title: 'A table for two cups', description: 'A colourful pitcher and small café table for a pause that is easier with company.', definitionId: 'drink:refresh:4', guestDefinitionId: 'social:cafe-sharing:3', guestGeneratorId: 'cafe-counter', difficulty: 'medium', signal: 'connection' },
  { key: 'closing-time', title: 'Closing-time kindness', description: 'A full drinks cart for someone whose day kept running after they stopped.', definitionId: 'drink:refresh:5', secondaryDefinitionId: 'drink:hot:4', difficulty: 'major', signal: 'comfort' },
  { key: 'menu-experiment', title: 'The menu experiment', description: 'A playful cold drink and café bake pairing with absolutely no productivity target.', definitionId: 'drink:refresh:4', guestDefinitionId: 'food:cafe-pastry:3', guestGeneratorId: 'cafe-counter', difficulty: 'major', signal: 'curiosity' },
  { key: 'lantern-table', title: 'The lantern table', description: 'A colourful drinks cart and a window nook kept open for someone arriving late.', definitionId: 'drink:refresh:5', guestDefinitionId: 'social:cafe-sharing:4', guestGeneratorId: 'cafe-counter', difficulty: 'major', signal: 'comfort' },
  { key: 'window-table', title: 'The window table', description: 'Two vivid café favourites for a pause shared at the best seat in the cafe.', definitionId: 'drink:refresh:5', secondaryDefinitionId: 'drink:hot:4', difficulty: 'major', signal: 'connection' },
] as const;

/** A friend whose Garden story is authored: every hatchable friend. */
export type AuthoredCohortFamilyId = string;

export const STEPPLING_CHAPTER_ONE_ORDER_POOL = [
  { key: 'shoes-by-door', title: 'Shoes by the door', description: 'A small, ready pair for the easiest possible first step.', definitionId: 'adventure:trail:2', difficulty: 'small', signal: 'ease' },
  { key: 'ticket-no-itinerary', title: 'A ticket with no itinerary', description: 'A pocket ticket from Voyagle: enough direction to begin, with room to choose.', definitionId: 'adventure:travel:2', difficulty: 'small', signal: 'curiosity' },
  { key: 'familiar-loop', title: 'The familiar loop', description: 'Reliable shoes and a small map for a route that asks very little.', definitionId: 'adventure:trail:3', secondaryDefinitionId: 'adventure:travel:2', difficulty: 'medium', signal: 'comfort' },
  { key: 'walk-and-talk', title: 'Walk and talk', description: 'A route with enough shape for company and enough space for silence.', definitionId: 'adventure:trail:3', secondaryDefinitionId: 'adventure:travel:3', difficulty: 'medium', signal: 'connection' },
  { key: 'useful-journey', title: 'One useful journey', description: 'Turn an ordinary errand into movement with a destination.', definitionId: 'adventure:travel:3', secondaryDefinitionId: 'adventure:trail:3', difficulty: 'medium', signal: 'ease' },
  { key: 'curious-turning', title: 'The curious turning', description: 'Take the shoes that make one unfamiliar corner feel inviting.', definitionId: 'adventure:trail:4', secondaryDefinitionId: 'adventure:travel:3', difficulty: 'medium', signal: 'curiosity' },
  { key: 'after-rain-trail', title: 'After-rain trail', description: 'A sturdier route for a day when starting conditions are imperfect.', definitionId: 'adventure:trail:4', secondaryDefinitionId: 'adventure:travel:2', difficulty: 'major', signal: 'comfort' },
  { key: 'headspace-route', title: 'The headspace route', description: 'A longer path made for letting thoughts move without solving them.', definitionId: 'adventure:trail:5', secondaryDefinitionId: 'adventure:travel:3', difficulty: 'major', signal: 'ease' },
  { key: 'long-way-home', title: 'The long way home', description: 'A route that chooses discovery over efficiency for once.', definitionId: 'adventure:travel:4', secondaryDefinitionId: 'adventure:trail:4', difficulty: 'major', signal: 'curiosity' },
  { key: 'shared-stride', title: 'A shared stride', description: 'Two kinds of journey meeting at the same comfortable pace.', definitionId: 'adventure:trail:4', secondaryDefinitionId: 'adventure:travel:4', difficulty: 'major', signal: 'connection' },
] as const;

export const AUTHORED_COHORT_ORDER_POOLS = {
  baristabbit: BARISTABBIT_CHAPTER_ONE_ORDER_POOL,
  steppling: STEPPLING_CHAPTER_ONE_ORDER_POOL,
} as const;

export type BaristabbitChapterOrderTemplate = (typeof BARISTABBIT_CHAPTER_ONE_ORDER_POOL)[number];

export function selectBaristabbitChapterOrderKeys(seed: string): string[] {
  const fixed = ['first-pour', 'garden-glass'];
  const medium = BARISTABBIT_CHAPTER_ONE_ORDER_POOL.filter((item) => item.difficulty === 'medium' && item.key !== 'cake-on-side');
  const major = BARISTABBIT_CHAPTER_ONE_ORDER_POOL.filter((item) => item.difficulty === 'major');
  return [
    ...fixed,
    'cake-on-side',
    ...pickStable(medium, 1, `${seed}:medium`).map((item) => item.key),
    ...pickStable(major, 1, `${seed}:major`).map((item) => item.key),
  ];
}

/** One authored order of a friend's Garden story. */
export type AuthoredCohortOrderTemplate = (typeof AUTHORED_COHORT_ORDER_POOLS)[keyof typeof AUTHORED_COHORT_ORDER_POOLS][number];

/** A friend's authored order pool, or none for a friend whose story has no pool yet. */
export function authoredCohortOrderPool(familyId: AuthoredCohortFamilyId): readonly AuthoredCohortOrderTemplate[] {
  return (AUTHORED_COHORT_ORDER_POOLS as Record<string, readonly AuthoredCohortOrderTemplate[] | undefined>)[familyId] ?? [];
}

export function selectAuthoredCohortOrderKeys(familyId: AuthoredCohortFamilyId, seed: string): string[] {
  if (familyId === 'baristabbit') return selectBaristabbitChapterOrderKeys(seed);
  const pool = authoredCohortOrderPool(familyId);
  const fixed = pool.slice(0, 2);
  const medium = pool.filter((item) => item.difficulty === 'medium');
  const major = pool.filter((item) => item.difficulty === 'major');
  return [
    ...fixed,
    ...pickStable(medium, 2, `${seed}:medium`),
    ...pickStable(major, 1, `${seed}:major`),
  ].map((item) => item.key);
}

export type FeastleActTwoOrderTemplate = (typeof FEASTLE_ACT_TWO_ORDER_POOL)[number];

export function selectFeastleActTwoOrderKeys(seed: string): string[] {
  const small = FEASTLE_ACT_TWO_ORDER_POOL.filter((item) => item.difficulty === 'small' && item.key !== 'crumb-note');
  const medium = FEASTLE_ACT_TWO_ORDER_POOL.filter((item) => item.difficulty === 'medium' && item.key !== 'cake-for-no-reason');
  return [
    FEASTLE_ACT_TWO_ORDER_POOL.find((item) => item.key === 'crumb-note')!,
    ...pickStable(small, 1, `${seed}:small`),
    FEASTLE_ACT_TWO_ORDER_POOL.find((item) => item.key === 'cake-for-no-reason')!,
    ...pickStable(medium, 1, `${seed}:medium`),
    FEASTLE_ACT_TWO_ORDER_POOL.find((item) => item.key === 'celebration-leftovers')!,
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
