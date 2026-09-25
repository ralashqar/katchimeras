import { placeSpawner } from '@/features/encounter/create-state';
import { createMissionState } from '@/features/onboarding/steppling-mission';
import type { MergeCharacterId, MergeOrder, MergeWorldState } from '@/types/merge-world';

/**
 * The Supply Run (cozy 4X, the calm half of the loop): a docked board under the Lost Trail with no wisps, where the
 * Sanctuary's friends post orders. Merge up what they ask for and serve it: each order pays Timber (the Sanctuary's
 * building material) and a little Glow, and the next order takes its place. A few pieces sleep under the Mist at the
 * start and wake the way the first boards taught; the Seed Pod never runs dry.
 *
 * Each of the two cards belongs to one friend (Steppling, then Mossprout) and keeps them: only the order on it changes.
 * Each friend's orders come from their own authored list, in order, and repeat a little richer each time round. The world
 * keeps which order each card shows (`supplyRun.slots`) and how many have been served, so a relaunch shows the same two
 * and nothing is paid twice. Every `SUPPLY_CRATE.every` orders fill a crate, which pays a bonus and ends the run.
 */
export type SupplyOrderSpec = {
  title: string;
  /** Nature garden chain tiers wanted, with how many of each. */
  wants: readonly (readonly [tier: number, quantity: number])[];
  timber: number;
  glow: number;
  /** What the friend says beside it. */
  line: string;
};

/** Who stands at each card, left to right. */
export const SUPPLY_SLOT_CHARACTERS: readonly [MergeCharacterId, MergeCharacterId] = ['steppling', 'mossprout'];

export const SUPPLY_ORDER_POOLS: Readonly<Record<'steppling' | 'mossprout', readonly SupplyOrderSpec[]>> = {
  steppling: [
    { title: 'Trail posts', wants: [[2, 2]], timber: 2, glow: 5, line: 'Two Sprouts and I can mark the trail again!' },
    { title: 'Walking sticks', wants: [[2, 1], [3, 1]], timber: 3, glow: 6, line: 'Long trails need good sticks.' },
    { title: 'A lookout', wants: [[4, 1]], timber: 4, glow: 8, line: 'Something tall, so I can see the sea!' },
  ],
  mossprout: [
    { title: 'A bed for the Tree', wants: [[3, 1]], timber: 2, glow: 5, line: 'The Heart Tree would love a Plant beside it.' },
    { title: 'Shade for the Spring', wants: [[2, 3]], timber: 3, glow: 6, line: 'Three Sprouts to keep the Spring cool.' },
    { title: 'Garden rows', wants: [[3, 2]], timber: 4, glow: 8, line: 'Two Plants, side by side. Like old times.' },
  ],
};

/** Every this many orders fill a crate: a bonus, and the run is done for now. */
export const SUPPLY_CRATE = { every: 5, timber: 5, glow: 15 } as const;

const GARDEN = (tier: number) => `nature:garden:${tier}`;

/** The order a card shows: its friend's list at `index` (the list repeats, a little richer each time round). */
export function supplyOrder(slot: 0 | 1, index: number): MergeOrder & { timber: number; line: string } {
  const characterId = SUPPLY_SLOT_CHARACTERS[slot];
  const pool = SUPPLY_ORDER_POOLS[characterId as 'steppling' | 'mossprout'];
  const spec = pool[index % pool.length]!;
  const round = Math.floor(index / pool.length);
  return {
    id: `supply-run:${characterId}:${index}`, characterId, recipientSkinId: characterId,
    title: spec.title, description: spec.line, difficulty: 'small',
    requirements: spec.wants.map(([tier, quantity]) => ({ definitionId: GARDEN(tier), quantity })),
    reward: { coins: spec.glow + round * 2, mergeXp: 0, friendshipXp: 0, energy: 0 },
    createdAt: 0, signature: false, purpose: 'normal',
    timber: spec.timber + round, line: spec.line,
  };
}

/** The order index each card shows, from the world's record (a first visit shows each friend's first). */
export function supplyRunSlots(world: Pick<MergeWorldState, 'supplyRun'>): readonly [number, number] {
  return world.supplyRun?.slots ?? [0, 0];
}

/** The board: a few Seeds and Sprouts, a chain asleep under the Mist to wake, and the Seed Pod in the corner. */
export function createSupplyRunBoard(now: number): MergeWorldState {
  const base = createMissionState({
    items: [[36, 1], [37, 1], [38, 2], [39, 1], [30, 1]].map(([cell, tier]) => ({ cell: cell!, definitionId: GARDEN(tier!) })),
    echoes: [{ cell: 31, id: 'supply-run:sleeper-1', definitionId: GARDEN(1) }],
    veiled: [
      { cell: 24, id: 'supply-run:veiled-1', definitionId: GARDEN(2) },
      { cell: 32, id: 'supply-run:veiled-2', definitionId: GARDEN(1) },
      { cell: 25, id: 'supply-run:veiled-3', definitionId: GARDEN(2) },
    ],
  }, 'steppling', now);
  return placeSpawner(base, { id: 'pod', generatorId: 'wild-garden', cell: 40, charges: 99, drops: [GARDEN(1)] }, 40);
}
