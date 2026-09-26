import { placeSpawner } from '@/features/encounter/create-state';
import { createMissionState } from '@/features/onboarding/steppling-mission';
import { openTierOneDropIds } from '@/utils/merge-world/generator-branches';
import type { MergeCharacterId, MergeOrder, MergeWorldState } from '@/types/merge-world';

/**
 * Baristabbit's Café (cozy 4X, the calm half of the loop; the gathering that feeds the team): a docked board with no
 * wisps, where the Sanctuary's friends order drinks and treats. Merge up what they ask for and serve it: each order pays
 * Meals (the team's food, spent training heroes), a little Timber and a little Glow, and the next order takes its place.
 * The Ritual Bar pours coffee (the one chain); a few pieces sleep under the Mist at the start and
 * wake the way the first boards taught. It opens once Baristabbit is home.
 *
 * Each of the two cards belongs to one friend (Steppling, then Mossprout) and keeps them: only the order on it changes.
 * Each friend's orders come from their own authored list, in order, and repeat a little richer each time round. The world
 * keeps which order each card shows (`supplyRun.slots`) and how many have been served, so a relaunch shows the same two
 * and nothing is paid twice. It is one continuous board: no crates, no end; Back ends a visit whenever.
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

/**
 * The Café pours one chain, coffee (`drink:hot`: Tiny Espresso, Caramel Latte, Strawberry Boba, Matcha Cloud Frappe...),
 * from the Ritual Bar: nothing else to learn while the Café is being introduced. Steppling wants something for the trail;
 * Mossprout something warm under the Heart Tree. The first orders are small.
 */
export const SUPPLY_ORDER_POOLS: Readonly<Record<'steppling' | 'mossprout', readonly SupplyOrderSpec[]>> = {
  steppling: [
    { title: 'Coffee for the trail', wants: [['drink:hot', 2, 1]], meals: 3, timber: 1, glow: 5, line: 'A Caramel Latte for the road!' },
    { title: 'Two for the road', wants: [['drink:hot', 2, 2]], meals: 5, timber: 1, glow: 6, line: 'Two Lattes. One for now, one for later.' },
    { title: 'A proper boba', wants: [['drink:hot', 3, 1]], meals: 6, timber: 2, glow: 8, line: 'A Strawberry Boba. That\u2019s a real picnic.' },
  ],
  mossprout: [
    { title: 'Something warm', wants: [['drink:hot', 2, 1]], meals: 3, timber: 1, glow: 5, line: 'A Caramel Latte. Warm paws, warm heart.' },
    { title: 'Boba under the Tree', wants: [['drink:hot', 3, 1]], meals: 6, timber: 1, glow: 6, line: 'A Strawberry Boba, under the Heart Tree.' },
    { title: 'A little treat', wants: [['drink:hot', 4, 1]], meals: 9, timber: 2, glow: 9, line: 'A Matcha Cloud Frappe. Just this once.' },
  ],
};

/**
 * Once Feastle is home the Café is a Kitchen: the Hearth Pantry joins the board (savoury dishes; desserts once Cheerlet
 * brings them), and each friend's list gains Feastle's feasts, bigger orders that pay more Meals. The friends keep their
 * cards. An order the board cannot make yet (a Dessert) is skipped until it can (`supplyRunChains`).
 */
export const KITCHEN_ORDER_POOLS: Readonly<Record<'steppling' | 'mossprout', readonly SupplyOrderSpec[]>> = {
  steppling: [
    { title: 'Trail lunch', wants: [['food:table', 3, 1]], meals: 6, timber: 1, glow: 6, line: 'A proper Dish before the climb!' },
    { title: 'Coffee for the trail', wants: [['drink:hot', 2, 1]], meals: 3, timber: 1, glow: 5, line: 'A Caramel Latte for the road!' },
    { title: 'Summit cupcakes', wants: [['food:dessert', 3, 2]], meals: 9, timber: 2, glow: 8, line: 'Two Cupcakes, for the top of the hill.' },
    { title: 'A hiker\u2019s feast', wants: [['food:table', 4, 1], ['drink:hot', 3, 1]], meals: 14, timber: 2, glow: 12, line: 'A Meal and a Boba. I could walk for days on that.' },
    { title: 'Packed lunches', wants: [['food:table', 3, 2]], meals: 10, timber: 2, glow: 8, line: 'Two Dishes. One for me, one for whoever I find out there.' },
  ],
  mossprout: [
    { title: 'Supper for two', wants: [['food:table', 3, 1], ['drink:hot', 2, 1]], meals: 8, timber: 1, glow: 7, line: 'A warm Dish and a Latte. Like old times.' },
    { title: 'Something warm', wants: [['drink:hot', 2, 1]], meals: 3, timber: 1, glow: 5, line: 'A Caramel Latte. Warm paws, warm heart.' },
    { title: 'Cake for the Tree', wants: [['food:dessert', 4, 1]], meals: 10, timber: 2, glow: 9, line: 'A Layer Cake. The Heart Tree deserves a party.' },
    { title: 'A Sanctuary feast', wants: [['food:table', 4, 1], ['food:dessert', 3, 1]], meals: 16, timber: 2, glow: 14, line: 'A Meal and a Cupcake for everyone. Well. For me first.' },
    // Savoury feasts: the Pantry makes these from the start (Desserts wait for Cheerlet, and so do the orders for them).
    { title: 'Harvest supper', wants: [['food:table', 4, 1]], meals: 11, timber: 2, glow: 9, line: 'A whole Meal, under the Heart Tree. Just like the old days.' },
    { title: 'A feast for the Tree', wants: [['food:table', 5, 1]], meals: 16, timber: 3, glow: 13, line: 'A real Feast. Everyone\u2019s invited, even the Tree.' },
  ],
};

/**
 * The chains the board's spawners can make right now: the Ritual Bar's one pour, and each of the Hearth Pantry's
 * branches that is open (`openTierOneDropIds`: a branch opens with the friend who brings it; Desserts come with
 * Cheerlet). An order never asks for anything these cannot make.
 */
export function supplyRunChains(board: MergeWorldState): ReadonlySet<string> {
  const chains = new Set<string>();
  for (const cell of board.board) {
    if (cell.occupant?.kind !== 'generator') continue;
    const generator = board.generators[cell.occupant.generatorId];
    if (!generator) continue;
    const drops = generator.forcedDropDefinitionId ? [generator.forcedDropDefinitionId] : openTierOneDropIds(board, generator);
    for (const drop of drops) chains.add(drop.replace(/:\d+$/, ''));
  }
  return chains;
}

const defaultChains = new Map<boolean, ReadonlySet<string>>();
/** A fresh board's chains (a Café's, or a Kitchen's): what the orders can ask for before a board is loaded. */
export function cafeChains(kitchen: boolean): ReadonlySet<string> {
  let chains = defaultChains.get(kitchen);
  if (!chains) { chains = supplyRunChains(createSupplyRunBoard(0, kitchen)); defaultChains.set(kitchen, chains); }
  return chains;
}

/**
 * The order a card shows: its friend's list at `index` (the list repeats, a little richer each time round), keeping
 * only the orders whose every piece the board's spawners can make (`chains`: the live board's, else a fresh one's).
 */
export function supplyOrder(slot: 0 | 1, index: number, kitchen = false, chains: ReadonlySet<string> = cafeChains(kitchen)): MergeOrder & { timber: number; meals: number; line: string } {
  const characterId = SUPPLY_SLOT_CHARACTERS[slot];
  const listed = (kitchen ? KITCHEN_ORDER_POOLS : SUPPLY_ORDER_POOLS)[characterId as 'steppling' | 'mossprout'];
  const makeable = listed.filter((spec) => spec.wants.every(([chain]) => chains.has(chain)));
  const pool = makeable.length ? makeable : SUPPLY_ORDER_POOLS[characterId as 'steppling' | 'mossprout'];
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
 * The board: a few coffees, a chain asleep under the Mist to wake, and the Ritual Bar; a Kitchen's has the Hearth
 * Pantry too, with two Ingredients beside it.
 */
export function createSupplyRunBoard(now: number, kitchen = false): MergeWorldState {
  const base = createMissionState({
    items: [
      { cell: 37, definitionId: 'drink:hot:1' }, { cell: kitchen ? 29 : 38, definitionId: 'drink:hot:1' }, { cell: 30, definitionId: 'drink:hot:1' },
      ...(kitchen ? [{ cell: 26, definitionId: 'food:table:1' }, { cell: 22, definitionId: 'food:table:1' }] : []),
    ],
    echoes: [{ cell: 31, id: 'cafe:sleeper-1', definitionId: 'drink:hot:1' }],
    veiled: [
      { cell: 24, id: 'cafe:veiled-1', definitionId: 'drink:hot:2' },
      { cell: 32, id: 'cafe:veiled-2', definitionId: 'drink:hot:1' },
      { cell: 25, id: 'cafe:veiled-3', definitionId: 'drink:hot:2' },
    ],
  }, 'baristabbit', now);
  const bar = placeSpawner(base, { id: 'bar', generatorId: 'ritual-bar', cell: 40, charges: 99, drops: ['drink:hot:1'] }, 40);
  return kitchen ? placeSpawner(bar, { id: 'pantry', generatorId: 'hearth-pantry', cell: 38, charges: 99, drops: ['food:table:1', 'food:dessert:1'] }, 38) : bar;
}
