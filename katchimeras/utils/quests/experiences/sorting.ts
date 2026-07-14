import { seededShuffle } from './trivia-packs';

export type SortingPackId = 'feastle-table' | 'tasklet-triage';
export type SortingCategory =
  | 'food'
  | 'drink'
  | 'tableware'
  | 'quick'
  | 'focus'
  | 'scheduled'
  | 'waiting';
export type SortingItem = { id: string; label: string; symbol: string; category: SortingCategory };

export type SortingPack = {
  id: SortingPackId;
  items: SortingItem[];
  categoriesForTier: (tier: number) => SortingCategory[];
};

const FOODS = ['Apple','Bread','Cheese','Carrot','Rice','Pasta','Cake','Soup','Pizza','Berry','Egg','Taco','Noodles','Pear','Croissant','Sushi','Corn','Cookie','Sandwich','Yoghurt'];
const DRINKS = ['Water','Tea','Coffee','Juice','Milk','Lemonade','Smoothie','Cocoa','Soda','Iced tea','Sparkling water','Herbal tea','Milkshake','Orange juice','Apple juice','Espresso','Latte','Green tea','Berry juice','Coconut water'];
const TABLEWARE = ['Plate','Bowl','Fork','Spoon','Knife','Cup','Mug','Napkin','Chopsticks','Saucer','Tray','Teapot','Glass','Pitcher','Tongs','Ladle','Spatula','Whisk','Platter','Coaster'];

const QUICK_TASKS = [
  'Reply yes to Mia',
  'Put the clean mug away',
  'Confirm the lunch booking',
  'Rename the project file',
  'Send the address to Alex',
  'Add milk to the shopping list',
  'Charge the headphones',
  'Tick off the delivered parcel',
  'Forward the receipt',
  'Water the desk plant',
  'Save the phone number',
  'Return the library book',
  'Put tomorrow’s keys by the door',
  'Approve the calendar invite',
  'File the signed form',
];
const FOCUS_TASKS = [
  'Draft the project proposal',
  'Compare three holiday options',
  'Edit the presentation',
  'Plan the workshop outline',
  'Review the monthly budget',
  'Write the first article draft',
  'Research a new laptop',
  'Prepare the portfolio update',
  'Map the next project phase',
  'Reconcile the expense report',
  'Study the course chapter',
  'Design the event invitation',
  'Organise the photo archive',
  'Practise the full presentation',
  'Build the prototype screen',
];
const SCHEDULED_TASKS = [
  'Dentist — Friday at 3',
  'Call Mum — Sunday morning',
  'Team review — Monday at 10',
  'Put the bins out tonight',
  'Renew the pass on the 28th',
  'Collect the parcel after 5',
  'Book club — Thursday evening',
  'Submit the form by noon',
  'Water the garden tomorrow',
  'Train departs at 8:15',
  'Pay the bill on payday',
  'Take medicine with dinner',
  'Video call — Wednesday at 7',
  'Return the hire car by 9',
  'Send birthday wishes tomorrow',
];
const WAITING_TASKS = [
  'Send the order after approval',
  'Finish the report when figures arrive',
  'Book travel after dates are confirmed',
  'Reply when Sam sends the link',
  'Pay the invoice after it is corrected',
  'Publish after the final review',
  'Choose a venue when numbers are known',
  'Print the cards after the design arrives',
  'Confirm delivery when tracking updates',
  'Start painting after the primer dries',
  'Submit after the manager signs',
  'Order parts when stock returns',
  'Close the ticket after testing finishes',
  'Share notes when the recording arrives',
  'Pack the gift after it is delivered',
];

function items(values: string[], category: SortingCategory, symbol: string): SortingItem[] {
  return values.map((label, index) => ({
    id: `${category}:${index + 1}:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
    label,
    symbol,
    category,
  }));
}

export const FEASTLE_SORTING_ITEMS: SortingItem[] = [
  ...items(FOODS, 'food', 'fork.knife'),
  ...items(DRINKS, 'drink', 'cup.and.saucer.fill'),
  ...items(TABLEWARE, 'tableware', 'circle.grid.2x2.fill'),
];

export const TASKLET_SORTING_ITEMS: SortingItem[] = [
  ...items(QUICK_TASKS, 'quick', 'bolt.fill'),
  ...items(FOCUS_TASKS, 'focus', 'scope'),
  ...items(SCHEDULED_TASKS, 'scheduled', 'calendar'),
  ...items(WAITING_TASKS, 'waiting', 'timer'),
];

export const SORTING_PACKS: Record<SortingPackId, SortingPack> = {
  'feastle-table': {
    id: 'feastle-table',
    items: FEASTLE_SORTING_ITEMS,
    categoriesForTier: () => ['food', 'drink', 'tableware'],
  },
  'tasklet-triage': {
    id: 'tasklet-triage',
    items: TASKLET_SORTING_ITEMS,
    categoriesForTier: (tier) => tier <= 1
      ? ['quick', 'focus']
      : tier === 2
        ? ['quick', 'focus', 'scheduled']
        : ['quick', 'focus', 'scheduled', 'waiting'],
  },
};

export function sortingPack(packId: SortingPackId): SortingPack {
  return SORTING_PACKS[packId] ?? SORTING_PACKS['feastle-table'];
}

export function createSortingRound(
  seed: string,
  itemCount: number,
  recentIds: string[] = [],
  packId: SortingPackId = 'feastle-table',
  tier = 3,
): SortingItem[] {
  const pack = sortingPack(packId);
  const categories = pack.categoriesForTier(tier);
  const eligible = pack.items.filter((item) => categories.includes(item.category));
  const recent = new Set(recentIds);
  const fresh = eligible.filter((item) => !recent.has(item.id));
  const source = fresh.length >= itemCount ? fresh : eligible;
  const pools = new Map(categories.map((category) => [
    category,
    seededShuffle(source.filter((item) => item.category === category), `${seed}:${packId}:${category}`),
  ]));
  const selected: SortingItem[] = [];
  for (let index = 0; selected.length < itemCount; index += 1) {
    const category = categories[index % categories.length];
    const next = pools.get(category)?.shift();
    if (next) selected.push(next);
    if (index > source.length * categories.length) break;
  }
  return seededShuffle(selected, `${seed}:${packId}:round`);
}

export function validateSortingItems(itemsToValidate: SortingItem[] = FEASTLE_SORTING_ITEMS): string[] {
  const ids = new Set<string>();
  const errors: string[] = [];
  for (const item of itemsToValidate) {
    if (ids.has(item.id)) errors.push(`Duplicate sorting item: ${item.id}`);
    if (!item.label || !item.symbol) errors.push(`Incomplete sorting item: ${item.id}`);
    ids.add(item.id);
  }
  return errors;
}
