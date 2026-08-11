import type { WispId } from '@/types/wisp';

export type MergeFamilyId = 'food' | 'nature' | 'adventure';
export type MergeCharacterId = 'feastle' | 'mossprout' | 'steppling' | 'shellio' | 'voyagle';
export type MergeOrderDifficulty = 'small' | 'medium' | 'major';

export type MergeItemDefinition = {
  id: string;
  familyId: MergeFamilyId;
  branchId: string;
  tier: number;
  name: string;
  icon: 'fork.knife' | 'leaf.fill' | 'figure.walk' | 'water.waves' | 'globe.americas.fill' | 'sparkles';
  color: string;
  nextItemId: string | null;
  sellValue: number;
};

export type MergeBoardItem = {
  kind: 'item';
  instanceId: string;
  definitionId: string;
};

export type MergeBoardGenerator = {
  kind: 'generator';
  generatorId: string;
};

export type MergeBoardOccupant = MergeBoardItem | MergeBoardGenerator;

export type MergeBoardCell = {
  locked: boolean;
  blocker: 'vines' | 'rocks' | 'clouds' | null;
  occupant: MergeBoardOccupant | null;
};

export type MergeGeneratorState = {
  id: string;
  familyId: MergeFamilyId;
  name: string;
  charges: number;
  maxCharges: number;
  readyAt: number | null;
  level: number;
  enabledBranches: string[];
};

export type MergeOrderRequirement = {
  definitionId: string;
  quantity: number;
};

export type MergeReward = {
  coins: number;
  mergeXp: number;
  friendshipXp: number;
  energy: number;
  wispId?: WispId;
};

export type MergeOrder = {
  id: string;
  characterId: MergeCharacterId;
  title: string;
  difficulty: MergeOrderDifficulty;
  requirements: MergeOrderRequirement[];
  reward: MergeReward;
  createdAt: number;
  signature: boolean;
};

export type MergeRewardInboxEntry = {
  id: string;
  createdAt: number;
  items: string[];
  source: 'order' | 'discovery' | 'chest';
};

export type MergeExternalRewardReceipt = {
  id: string;
  kind: 'friendship' | 'wisp';
  characterId: MergeCharacterId;
  amount: number;
  wispId?: WispId;
  createdAt: number;
  appliedAt: number | null;
};

export type MergeWorldState = {
  version: 1;
  revision: number;
  createdAt: number;
  updatedAt: number;
  nextInstance: number;
  board: MergeBoardCell[];
  storage: MergeBoardItem[];
  storageCapacity: number;
  rewardInbox: MergeRewardInboxEntry[];
  generators: Record<string, MergeGeneratorState>;
  energy: { value: number; cap: number; lastRegenAt: number };
  coins: number;
  mergeXp: number;
  mergeLevel: number;
  discoveries: string[];
  unlockedFamilies: MergeFamilyId[];
  unlockedCharacters: MergeCharacterId[];
  favouriteCharacterId: MergeCharacterId | null;
  activeOrders: MergeOrder[];
  completedOrderCount: number;
  recentOrderKeys: string[];
  expansions: string[];
  processedActivityReceiptIds: string[];
  externalRewardReceipts: MergeExternalRewardReceipt[];
};

export type MergeWorldCommand =
  | { type: 'refreshTime'; now: number }
  | { type: 'tapGenerator'; generatorId: string; now: number; seed: string }
  | { type: 'move'; from: number; to: number; now: number }
  | { type: 'serveOrder'; orderId: string; now: number }
  | { type: 'storeItem'; cell: number; now: number }
  | { type: 'restoreItem'; storageIndex: number; cell?: number; now: number }
  | { type: 'sellItem'; cell: number; now: number }
  | { type: 'claimInbox'; entryId: string; now: number }
  | { type: 'unlockExpansion'; expansionId: string; now: number }
  | { type: 'grantActivityEnergy'; receiptId: string; amount: number; now: number }
  | { type: 'reconcileCharacters'; characterIds: string[]; now: number }
  | { type: 'ackExternalReward'; receiptId: string; now: number };

export type MergeWorldCommandResult = {
  state: MergeWorldState;
  changed: boolean;
  message?: string;
  discoveryId?: string;
  mergedCell?: number;
  spawnedCell?: number;
  servedOrderId?: string;
};
