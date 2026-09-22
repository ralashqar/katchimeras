/** Public action contract. These are observations, never client authority to grant money. */
export type GameplayEventKind = 'merge' | 'order_completed' | 'mist_cleared' | 'hex_restored' | 'structure_upgraded' | 'friend_rescued' | 'bond_gained' | 'wisp_discovered' | 'journey_completed' | 'expedition_completed' | 'incursion_completed'
  /** A Mist encounter cleared: `targetId` is the mission, `level` the grade's rank (0 cleared, 1 bright, 2 perfect). */
  | 'encounter_cleared';

export type GameplayEvent = {
  version: 1;
  id: string;
  kind: GameplayEventKind;
  source: 'merge-world' | 'relationship' | 'mission' | 'collection';
  sourceRevision: number;
  occurredAt: number;
  contentRevision: number;
  quantity: number;
  context: {
    companionId?: string;
    regionId?: string;
    targetId?: string;
    itemId?: string;
    itemTier?: number;
    level?: number;
    tags?: readonly string[];
  };
  /** Historical backfill may establish Harmony, but never score a new event. */
  historical?: boolean;
};

export type RewardItem =
  | { kind: 'wisp_pack'; packId: string; scope: 'local-lantern-v1' | 'verified' }
  | { kind: 'glow'; amount: number }
  | { kind: 'gems'; amount: number }
  | { kind: 'wisp'; id: string }
  | { kind: 'cosmetic'; id: string }
  | { kind: 'item'; id: string; quantity: number }
  | { kind: 'event_currency'; eventId: string; amount: number };
export type RewardBundle = { id: string; items: readonly RewardItem[] };
