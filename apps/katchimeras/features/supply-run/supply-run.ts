import { placeSpawner } from '@/features/encounter/create-state';
import { createMissionState } from '@/features/onboarding/steppling-mission';
import type { MergeCharacterId, MergeOrder, MergeWorldState } from '@/types/merge-world';

/**
 * Baristabbit's Café (cozy 4X, the calm half of the loop; the gathering that feeds the team): a docked board with no
 * wisps, where the Sanctuary's friends order drinks and treats. Merge up what they ask for and serve it: each order pays
 * Meals (the team's food, spent training heroes), a little Timber and a little Glow, and the next order takes its place.
 * The Ritual Bar pours drinks and the Café Counter bakes pastries; a few pieces sleep under the Mist at the start and
 * wake the way the first boards taught. It opens once Baristabbit is home.
 *
 * Each of the two cards belongs to one friend (Steppling, then Mossprout) and keeps them: only the order on it changes.
 * Each friend's orders come from their own authored list, in order, and repeat a little richer each time round. The world
 * keeps which order each card shows (`supplyRun.slots`) and how many have been served, so a relaunch shows the same two
 * and nothing is paid twice. Every `SUPPLY_CRATE.every` orders fill a crate, which pays a bonus and ends the visit.
 */
export type CafeChain = 'drink:refresh' | 'drink:hot' | 'food:cafe-pastry' | 'food:table' | 'food:dessert';
export type SupplyOrderSpec = {
  title: string;
  /** Chain tiers wanted, with how many of each. */
  wants: readonly (readonly [chain: CafeChain, tier: number, quantity: number])[];
  meals: number;
  timber: number;
  glow: number;
  /** What the friend says beside it. */
  line: string;
};

/** Who stands at each card, left to right. */
export const SUPPLY_SLOT_CHARACTERS: readonly [MergeCharacterId, MergeCharacterId] = ['steppling', 'mossprout'];

/** Steppling wants trail snacks and juice; Mossprout wants something warm and a biscuit under the Heart Tree. */
export const SUPPLY_ORDER_POOLS: Readonly<Record<'steppling' | 'mossprout', readonly SupplyOrderSpec[]>> = {
  steppling: [
    { title: 'Juice for the trail', wants: [['drink:refresh', 2, 1]], meals: 3, timber: 1, glow: 5, line: 'An Iced Fruit Tea for the road!' },
    { title: 'Trail biscuits', wants: [['food:cafe-pastry', 2, 2]], meals: 4, timber: 1, glow: 6, line: 'Two Cookie Pairs. One for now, one for later.' },
    { title: 'A proper picnic', wants: [['drink:refresh', 3, 1], ['food:cafe-pastry', 2, 1]], meals: 6, timber: 2, glow: 8, line: 'A Berry Smoothie and cookies. That\u2019s a real picnic.' },
  ],
  mossprout: [
    { title: 'Something warm', wants: [['drink:hot', 2, 1]], meals: 3, timber: 1, glow: 5, line: 'A Caramel Latte. Warm paws, warm heart.' },
    { title: 'Tea under the Tree', wants: [['drink:refresh', 2, 1], ['food:cafe-pastry', 1, 1]], meals: 4, timber: 1, glow: 6, line: 'Iced tea and a biscuit, under the Heart Tree.' },
    { title: 'A little treat', wants: [['drink:hot', 3, 1]], meals: 6, timber: 2, glow: 8, line: 'A Strawberry Boba. Just this once.' },
  ],
};

/**
 * Once Feastle is home the Café is a Kitchen: the Hearth Pantry joins the board (savoury dishes and desserts), and
 * each friend's list gains Feastle's feasts, bigger orders that pay more Meals. The friends keep their cards.
 */
export const KITCHEN_ORDER_POOLS: Readonly<Record<'steppling' | 'mossprout', readonly SupplyOrderSpec[]>> = {
  steppling: [
    { title: 'Trail lunch', wants: [['food:table', 3, 1]], meals: 6, timber: 1, glow: 6, line: 'A proper Dish before the climb!' },
    { title: 'Juice for the trail', wants: [['drink:refresh', 2, 1]], meals: 3, timber: 1, glow: 5, line: 'An Iced Fruit Tea for the road!' },
    { title: 'Summit cupcakes', wants: [['food:dessert', 3, 2]], meals: 9, timber: 2, glow: 8, line: 'Two Cupcakes, for the top of the hill.' },
    { title: 'A hiker\u2019s feast', wants: [['food:table', 4, 1], ['drink:refresh', 3, 1]], meals: 14, timber: 2, glow: 12, line: 'A Meal and a Smoothie. I could walk for days on that.' },
  ],
  mossprout: [
    { title: 'Supper for two', wants: [['food:table', 3, 1], ['drink:hot', 2, 1]], meals: 8, timber: 1, glow: 7, line: 'A warm Dish and a Latte. Like old times.' },
    { title: 'Something warm', wants: [['drink:hot', 2, 1]], meals: 3, timber: 1, glow: 5, line: 'A Caramel Latte. Warm paws, warm heart.' },
    { title: 'Cake for the Tree', wants: [['food:dessert', 4, 1]], meals: 10, timber: 2, glow: 9, line: 'A Layer Cake. The Heart Tree deserves a party.' },
    { title: 'A Sanctuary feast', wants: [['food:table', 4, 1], ['food:dessert', 3, 1]], meals: 16, timber: 2, glow: 14, line: 'A Meal and a Cupcake for everyone. Well. For me first.' },
  ],
};

/** Every this many orders fill a crate: a bonus, and the visit is done for now. */
export const SUPPLY_CRATE = { every: 5, timber: 5, glow: 15, meals: 8 } as const;

/** The order a card shows: its friend's list at `index` (the list repeats, a little richer each time round). */
export function supplyOrder(slot: 0 | 1, index: number, kitchen = false): MergeOrder & { timber: number; meals: number; line: string } {
  const characterId = SUPPLY_SLOT_CHARACTERS[slot];
  const pool = (kitchen ? KITCHEN_ORDER_POOLS : SUPPLY_ORDER_POOLS)[characterId as 'steppling' | 'mossprout'];
  const spec = pool[index % pool.length]!;
  const round = Math.floor(index / pool.length);
  return {
    id: `cafe:${characterId}:${index}`, characterId, recipientSkinId: characterId,
    title: spec.title, description: spec.line, difficulty: 'small',
    requirements: spec.wants.map(([chain, tier, quantity]) => ({ definitionId: `${chain}:${tier}`, quantity })),
    reward: { coins: spec.glow + round * 2, mergeXp: 0, friendshipXp: 0, energy: 0 },
    createdAt: 0, signature: false, purpose: 'normal',
    timber: spec.timber + Math.floor(round / 2), meals: spec.meals + round, line: spec.line,
  };
}

/** The order index each card shows, from the world's record (a first visit shows each friend's first). */
export function supplyRunSlots(world: Pick<MergeWorldState, 'supplyRun'>): readonly [number, number] {
  return world.supplyRun?.slots ?? [0, 0];
}

/** Whether the Caf\u00e9 is a Kitchen yet: Feastle is home. */
export const kitchenOpen = (world: Pick<MergeWorldState, 'companionDiscovery'>) => world.companionDiscovery.records.some((record) => record.characterId === 'feastle');

/**
 * The board: a few drinks and biscuits, a chain asleep under the Mist to wake, the Ritual Bar and the Caf\u00e9 Counter;
 * a Kitchen's has the Hearth Pantry too, with an Ingredient and a Flour Scoop beside it.
 */
export function createSupplyRunBoard(now: number, kitchen = false): MergeWorldState {
  const base = createMissionState({
    items: [
      { cell: 37, definitionId: 'drink:refresh:1' }, { cell: kitchen ? 29 : 38, definitionId: 'drink:hot:1' }, { cell: 39, definitionId: 'food:cafe-pastry:1' },
      { cell: 30, definitionId: 'drink:refresh:1' }, { cell: 33, definitionId: 'food:cafe-pastry:1' },
      ...(kitchen ? [{ cell: 26, definitionId: 'food:table:1' }, { cell: 22, definitionId: 'food:dessert:1' }] : []),
    ],
    echoes: [{ cell: 31, id: 'cafe:sleeper-1', definitionId: 'drink:hot:1' }],
    veiled: [
      { cell: 24, id: 'cafe:veiled-1', definitionId: 'drink:refresh:2' },
      { cell: 32, id: 'cafe:veiled-2', definitionId: 'food:cafe-pastry:1' },
      { cell: 25, id: 'cafe:veiled-3', definitionId: 'drink:hot:2' },
    ],
  }, 'baristabbit', now);
  const bar = placeSpawner(base, { id: 'bar', generatorId: 'ritual-bar', cell: 40, charges: 99, drops: ['drink:refresh:1', 'drink:hot:1'] }, 40);
  const counter = placeSpawner(bar, { id: 'counter', generatorId: 'cafe-counter', cell: 36, charges: 99, drops: ['food:cafe-pastry:1'] }, 36);
  return kitchen ? placeSpawner(counter, { id: 'pantry', generatorId: 'hearth-pantry', cell: 38, charges: 99, drops: ['food:table:1', 'food:dessert:1'] }, 38) : counter;
}
