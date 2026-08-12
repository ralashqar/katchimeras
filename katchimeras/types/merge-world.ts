import type { WispId } from '@/types/wisp';

export type MergeFamilyId = 'food' | 'nature' | 'adventure';
export type MergeCharacterId = 'feastle' | 'mossprout' | 'steppling' | 'shellio' | 'voyagle';
export type MergeOrderDifficulty = 'small' | 'medium' | 'major';
export type MergeOrderPurpose = 'normal' | 'signature';

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
  description?: string;
  narrativeSignal?: 'ease' | 'comfort' | 'connection' | 'curiosity';
  difficulty: MergeOrderDifficulty;
  requirements: MergeOrderRequirement[];
  reward: MergeReward;
  createdAt: number;
  signature: boolean;
  purpose: MergeOrderPurpose;
  chapterId?: string;
  rerollAvailableAt?: number;
  storyArcId?: string;
  storyBeatId?: string;
  storyTargetLevel?: number;
  storyStep?: number;
  storyStepCount?: number;
};

export type MergeGeneratorUnlockReceipt = {
  id: string;
  generatorId: string;
  createdAt: number;
  seenAt: number | null;
};

export type MergeCharacterProgress = {
  friendshipLevel: number;
  completedChapterIds: string[];
};

export type MergeRewardInboxEntry = {
  id: string;
  createdAt: number;
  items: string[];
  source: 'order' | 'discovery' | 'chest' | 'activity';
};

export type MergeExternalRewardReceipt = {
  id: string;
  kind: 'friendship' | 'wisp' | 'conversation' | 'story_order_served';
  characterId: MergeCharacterId;
  amount: number;
  presentation?: 'celebration' | 'quiet_summary';
  wispId?: WispId;
  sourceId?: string;
  storyStep?: number;
  storyStepCount?: number;
  createdAt: number;
  appliedAt: number | null;
};

export type MergeWorldState = {
  version: 3;
  revision: number;
  createdAt: number;
  updatedAt: number;
  nextInstance: number;
  board: MergeBoardCell[];
  storage: MergeBoardItem[];
  storageCapacity: number;
  rewardInbox: MergeRewardInboxEntry[];
  generatorUnlockReceipts: MergeGeneratorUnlockReceipt[];
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
  activityEnergyByDay: Record<string, number>;
  lastFreeRerollDayId: string | null;
  characterProgress: Partial<Record<MergeCharacterId, MergeCharacterProgress>>;
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
  | { type: 'grantActivityRewardsBatch'; rewards: Array<{ receiptId: string; amount: number; grantDayId: string; rewardClass: 'daily_journal' | 'daily_quest' | 'food_basket'; itemDefinitionIds?: string[] }>; now: number }
  | { type: 'ackGeneratorUnlock'; receiptId: string; now: number }
  | { type: 'rerollOrder'; orderId: string; now: number }
  | { type: 'reconcileCharacters'; characterIds: string[]; now: number }
  | { type: 'reconcileFriendship'; levels: Partial<Record<MergeCharacterId, number>>; now: number }
  | { type: 'reconcileStory'; familyId: MergeCharacterId; status: string; targetLevel: number; actPhase?: string; orderTemplateKeys?: string[]; servedOrderIds?: string[]; now: number }
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
