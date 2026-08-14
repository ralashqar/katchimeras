import type { WispId } from '@/types/wisp';

export type MergeFamilyId = 'food' | 'drink' | 'adventure' | 'nature' | 'comfort' | 'social' | 'mind' | 'creative';
export type MergeChainId =
  | 'food:table' | 'food:dessert'
  | 'drink:hot' | 'drink:refresh'
  | 'adventure:trail' | 'adventure:travel'
  | 'nature:garden' | 'nature:waterside'
  | 'comfort:rest' | 'comfort:care'
  | 'social:gathering' | 'social:celebration'
  | 'mind:work' | 'mind:books'
  | 'creative:art' | 'creative:screen';
export type MergeCharacterId =
  | 'baristabbit' | 'feastle' | 'steppling' | 'flexel' | 'bedrotte'
  | 'dawnle' | 'mendle' | 'gatherglow' | 'heartmote' | 'kindling'
  | 'snuglet' | 'waglet' | 'tasklet' | 'errandimp' | 'pagelet'
  | 'relicoon' | 'museling' | 'encora' | 'flickerbun' | 'pixooka'
  | 'mossprout' | 'shellio' | 'skylo' | 'voyagle' | 'cheerlet';
export type MergeOrderDifficulty = 'small' | 'medium' | 'major';
export type MergeOrderPurpose = 'normal' | 'signature';

export type MergeItemDefinition = {
  id: string;
  familyId: MergeFamilyId;
  chainId: MergeChainId;
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

export type MergeBoardRegionId = 'central-clearing' | 'inner-mist' | 'mid-mist' | 'deep-mist' | 'ancient-dream';

export type MergeDreamMist =
  | { kind: 'dormant' }
  | { kind: 'echo'; id: string; definitionId: string; ownerCharacterId: MergeCharacterId }
  | { kind: 'katchimera'; id: string; mysteryId: 'moon' | 'trail'; ownerCharacterId: MergeCharacterId | null };

export type MergeBoardCell = {
  /** Compatibility projection. In v10 this is true whenever `mist` is present. */
  locked: boolean;
  blocker: 'vines' | 'rocks' | 'clouds' | null;
  regionId: MergeBoardRegionId;
  mist: MergeDreamMist | null;
  occupant: MergeBoardOccupant | null;
};

export type MergeBoardAwakeningReceipt = {
  id: string;
  source: 'dream_echo' | 'story';
  clearedCells: number[];
  createdAt: number;
};

export type MergeGeneratorState = {
  id: string;
  name: string;
  level: number;
  upgradeFragments: number;
  chainIds: [MergeChainId, MergeChainId];
  tierOneDropDefinitionIds: [string, string];
  forcedDropDefinitionId: string | null;
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

export type MergeActivityRewardKind =
  | 'daily_journal_energy'
  | 'daily_companion_energy'
  | 'daily_quest_energy'
  | 'companion_story_starter'
  | 'contextual_parcel'
  | 'memory_arrival'
  | 'goal_chest';

export type MergeLifeTheme =
  | 'food' | 'ritual' | 'movement' | 'travel' | 'nature' | 'rest'
  | 'connection' | 'celebration' | 'focus' | 'learning' | 'creativity' | 'play' | 'memory';

export type MergeWorldArrival = {
  id: string;
  kind: 'contextual_parcel' | 'memory_arrival' | 'goal_chest';
  createdAt: number;
  dayId: string;
  label: string;
  theme: MergeLifeTheme;
  familyId: MergeFamilyId;
  chainId: MergeChainId;
  characterId?: MergeCharacterId;
  source: 'journal' | 'companion_story' | 'goal' | 'legacy';
  itemDefinitionIds: string[];
  memoryRef?: { dayId: string; journalRecordId: string; sourceKind: 'manual' | 'photo' | 'text_note' | 'voice_note' };
  claimedAt: number | null;
  seenAt: number | null;
};

export type MergeWorldLandmark = {
  id: string;
  characterId: MergeCharacterId;
  chapterId: string;
  unlockedAt: number;
};

export type MergeActivityReward = {
  receiptId: string;
  kind: MergeActivityRewardKind;
  amount: number;
  grantDayId: string;
  label: string;
  itemDefinitionIds?: string[];
  arrival?: Omit<MergeWorldArrival, 'createdAt' | 'claimedAt' | 'seenAt'>;
};

export type MergeStepEnergyDay = {
  highestObservedSteps: number;
  accountedSteps: number;
  remainderSteps: number;
  energyAwarded: number;
  bootstrapClaimed: boolean;
  lastObservedAt: string;
  receiptIds: string[];
};

export type MergeWorldState = {
  version: 10;
  revision: number;
  createdAt: number;
  updatedAt: number;
  nextInstance: number;
  board: MergeBoardCell[];
  storage: MergeBoardItem[];
  storageCapacity: number;
  rewardInbox: MergeRewardInboxEntry[];
  arrivals: MergeWorldArrival[];
  landmarks: MergeWorldLandmark[];
  generatorUnlockReceipts: MergeGeneratorUnlockReceipt[];
  generators: Record<string, MergeGeneratorState>;
  energy: { value: number; regenCap: number; lastRegenAt: number; regenPaused?: boolean };
  coins: number;
  mergeXp: number;
  mergeLevel: number;
  discoveries: string[];
  unlockedFamilies: MergeFamilyId[];
  unlockedChains: MergeChainId[];
  unlockedCharacters: MergeCharacterId[];
  favouriteCharacterId: MergeCharacterId | null;
  activeOrders: MergeOrder[];
  completedOrderCount: number;
  recentOrderKeys: string[];
  expansions: string[];
  unlockedRegions: MergeBoardRegionId[];
  boardAwakeningReceipts: MergeBoardAwakeningReceipt[];
  processedActivityReceiptIds: string[];
  activityEnergyByDay: Record<string, number>;
  stepEnergyByDay: Record<string, MergeStepEnergyDay>;
  lastFreeRerollDayId: string | null;
  characterProgress: Partial<Record<MergeCharacterId, MergeCharacterProgress>>;
  externalRewardReceipts: MergeExternalRewardReceipt[];
};

export type MergeWorldCommand =
  | { type: 'refreshTime'; now: number }
  | { type: 'tapGenerator'; generatorId: string; now: number; seed: string }
  | { type: 'setGeneratorForcedDrop'; generatorId: string; definitionId: string | null; now: number }
  | { type: 'upgradeGenerator'; generatorId: string; now: number }
  | { type: 'move'; from: number; to: number; now: number }
  | { type: 'serveOrder'; orderId: string; now: number }
  | { type: 'storeItem'; cell: number; now: number }
  | { type: 'restoreItem'; storageIndex: number; cell?: number; now: number }
  | { type: 'sellItem'; cell: number; now: number }
  | { type: 'claimInbox'; entryId: string; now: number }
  | { type: 'claimArrival'; arrivalId: string; now: number }
  | { type: 'viewMemoryArrival'; arrivalId: string; now: number }
  | { type: 'grantActivityRewardsBatch'; rewards: MergeActivityReward[]; now: number }
  | { type: 'claimStepEnergy'; dayId: string; observedSteps: number; observedAt: string; allowBootstrap: boolean; receiptId: string; now: number }
  | { type: 'setEnergyRegenPaused'; paused: boolean; now: number }
  | { type: 'featureCharacter'; characterId: MergeCharacterId; now: number }
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
  dreamEchoClearedId?: string;
  clearedMistCells?: number[];
  spawnedCell?: number;
  spawnedItems?: { instanceId: string; definitionId: string; cell: number }[];
  servedOrderId?: string;
  energyGranted?: number;
  stepEnergyClaim?: { consumedSteps: number; remainingClaimableSteps: number; beforeEnergy: number; afterEnergy: number; status: 'awarded' | 'below_threshold' | 'daily_cap' | 'duplicate' };
  itemsQueued?: number;
};
