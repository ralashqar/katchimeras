import type { WispId } from '@/types/wisp';
import type { HavenRevealState, HavenStage } from '@/constants/haven-catalog';
import type { KatchimeraSkinId } from '@/types/katchimera';

export type MergeFamilyId = 'food' | 'drink' | 'adventure' | 'nature' | 'comfort' | 'social' | 'mind' | 'creative';
export type MergeChainId =
  | 'food:table' | 'food:dessert'
  | 'drink:hot' | 'drink:refresh'
  | 'adventure:trail' | 'adventure:travel'
  | 'nature:garden' | 'nature:waterside' | 'nature:keepsake' | 'nature:root-memory'
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
export type MergeBoardId = 'mossprout' | 'steppling';
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
  /** Progression-only items never enter generators, orders, storage, selling, or ordinary merges. */
  progressionOnly?: boolean;
};

export type MergeBoardItem = {
  kind: 'item';
  instanceId: string;
  definitionId: string;
  /** Root Parcel matches are bound to one authored Rootbound Echo. */
  progressionGateId?: string;
};

export type MergeBoardGenerator = {
  kind: 'generator';
  generatorId: string;
};

export type MergeBoardOccupant = MergeBoardItem | MergeBoardGenerator;

export type MergeBoardRegionId = 'central-clearing' | 'inner-mist' | 'mid-mist' | 'deep-mist' | 'ancient-dream';

export type MergeDreamMist =
  | { kind: 'dormant' }
  | { kind: 'garden_growth'; clearingId: string; revealDay: number }
  | { kind: 'discovery_dormant'; characterIds: MergeCharacterId[] }
  | { kind: 'echo'; id: string; definitionId: string; ownerCharacterId: MergeCharacterId | null; generatorId?: string }
  | { kind: 'rootbound_echo'; id: string; gateId: string; definitionId: string; chapter: MossproutBoardChapter; ready: boolean }
  | { kind: 'resident_card'; discoveryId: string; gateId: string; residentId: KatchimeraSkinId | null; ready: boolean }
  | { kind: 'discovery_fork'; gateId: string; candidateIds: MergeCharacterId[]; recommendedCharacterId: MergeCharacterId | null }
  | { kind: 'dreambound_item'; discoveryId: string; gateId: string; pathId: string; sequenceIndex: number; boundDefinitionId: string; active: boolean };

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
  /** Personal-world production replaces the retired universal Energy wallet. */
  capacity: number;
  charges: number;
  restDurationMs: number;
  restStartedAt: number | null;
};

export type MossproutBoardChapter = 'quiet_patch' | 'returning_pond' | 'memory_nursery' | 'heartwood';
export type MossproutRootGateKind = 'journey_day' | 'friendship' | 'memory' | 'focus' | 'wisp' | 'mastery';
export type MossproutRootRewardPreview = 'space' | 'garden_growth' | 'wisp_nest' | 'nursery' | 'keepsake' | 'memory_card' | 'heartwood';
export type MossproutRootReward =
  | { kind: 'generator_unlock'; generatorId: 'memory-nursery' }
  | { kind: 'generator_level'; generatorId: 'wild-garden' | 'memory-nursery'; level: 2 | 3 }
  | { kind: 'merge_item'; definitionId: string }
  | { kind: 'wisp'; wispId: WispId }
  | { kind: 'memory_card'; poolId: 'small-wonders'; rarityFloor: MemoryCardRarity }
  | { kind: 'landmark'; landmarkId: 'mossprout-heartwood'; title: string };
export type MossproutRootGateState = {
  gateId: string;
  status: 'sealed' | 'ready' | 'awakened';
  readyAt: number | null;
  awakenedAt: number | null;
  parcelId: string | null;
  fallbackUsed: boolean;
};
export type MossproutProgressionSignals = {
  activeJourneyDayIds: string[];
  completedBeatIds?: string[];
  friendshipLevel: number;
  natureMemoryDayIds: string[];
  focusStage: number;
  ownedWispIds: WispId[];
  completedGardenDayIds: string[];
};
export type MossproutBoardProgression = {
  activeDayIds: string[];
  chapter: MossproutBoardChapter;
  gates: Record<string, MossproutRootGateState>;
  lastParcelDayId: string | null;
  grovelightResonanceDayIds: string[];
  signals: MossproutProgressionSignals;
};

export type MergeCharacterActivityOpportunity = {
  id: string;
  familyId: MergeCharacterId;
  dayId: string;
  generatorId: string;
  dropDefinitionIds: string[];
  usedCount: number;
  createdAt: number;
};

export type KatchimeraCardAcquisition = 'journey_match' | 'story_resident' | 'resident_discovery' | 'coins';

export type OwnedKatchimeraCard = {
  cardId: KatchimeraSkinId;
  familyId: MergeCharacterId;
  acquisition: KatchimeraCardAcquisition;
  sourceReceiptId: string;
  acquiredAt: number;
  coinCost: number;
};

export type MemoryCardRarity = 'common' | 'uncommon' | 'rare';

export type OwnedMemoryCard = {
  cardId: string;
  poolId: 'small-wonders';
  rarity: MemoryCardRarity;
  sourceReceiptId: string;
  acquiredAt: number;
  revealedAt: number | null;
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
  /** A collectible form revealed after this order is served. */
  katchimeraCardId?: KatchimeraSkinId;
};

export type MergeOrder = {
  id: string;
  characterId: MergeCharacterId;
  /** One named form requesting the order; progression still belongs to characterId. */
  recipientSkinId?: KatchimeraSkinId;
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
  expiresAt?: number;
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

export type MossproutDailyGardenOrders = {
  dayId: string;
  /** Frozen when the day's batch is created so milestone changes cannot rewrite live orders. */
  chapterId?: 'quiet-patch' | 'returning-pond' | 'memory-nursery' | 'heartwood';
  activeOrderId: string | null;
  offeredOrderIds: string[];
  servedOrderIds: string[];
  complete: boolean;
  nextOrderSequence?: number;
  tailServedCount?: number;
  activeTailSequences?: number[];
  lastRecipientSkinId?: KatchimeraSkinId | null;
};

export type CompanionDiscoverySource = 'ftue_hatch' | 'board_discovery' | 'legacy_grandfather';

export type CompanionDiscoveryRecord = {
  characterId: MergeCharacterId;
  source: CompanionDiscoverySource;
  gateId: string;
  pathId: string | null;
  discoveredAt: number;
  revealSeenAt: number | null;
  firstOrderCompletedAt: number | null;
  permanentFeatureId: string | null;
};

export type ActiveCompanionDiscovery = {
  discoveryId: string;
  gateId: string;
  anchorCell: number;
  pathCells: number[];
  candidateIds: MergeCharacterId[];
  recommendedCharacterId: MergeCharacterId | null;
  selectedCharacterId: MergeCharacterId | null;
  pathId: string | null;
  stage: number;
  startedAt: number;
};

export type CompanionDiscoveryTelemetryEvent = {
  id: string;
  kind: 'gate_eligible' | 'gate_activated' | 'path_chosen' | 'parcel_claimed' | 'stage_advanced' | 'character_revealed' | 'first_order_completed';
  gateId: string;
  discoveryId?: string;
  characterId?: MergeCharacterId;
  stage?: number;
  createdAt: number;
};

export type CompanionDiscoveryProgress = {
  records: CompanionDiscoveryRecord[];
  openedGateIds: string[];
  completedGateIds: string[];
  queuedGateIds: string[];
  active: ActiveCompanionDiscovery | null;
  lastStartedDayId: string | null;
  events: CompanionDiscoveryTelemetryEvent[];
};

export type ResidentCardDiscoveryStatus =
  | 'locked'
  | 'parcel_ready'
  | 'parcel_claimed'
  | 'revealed'
  | 'orders_active'
  | 'card_earned';

export type ResidentCardDiscoveryRecord = {
  id: string;
  campaignId: string;
  journeyDayId: string;
  residentId: KatchimeraSkinId;
  nodeGateId: string;
  nodeCell: number;
  status: ResidentCardDiscoveryStatus;
  parcelId: string | null;
  revealedAt: number | null;
  dialogueSeenAt: number | null;
  servedOrderIds: string[];
  earnedAt: number | null;
  cardRevealSeenAt: number | null;
};

export type ResidentCardDiscoveryProgress = {
  records: ResidentCardDiscoveryRecord[];
  campaignMilestoneReceiptIds: string[];
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
  generatorId?: string;
  id: string;
  kind: 'contextual_parcel' | 'memory_arrival' | 'goal_chest' | 'discovery_parcel' | 'root_match_parcel' | 'resident_card_parcel';
  createdAt: number;
  dayId: string;
  label: string;
  theme: MergeLifeTheme;
  familyId: MergeFamilyId;
  chainId: MergeChainId;
  characterId?: MergeCharacterId;
  source: 'journal' | 'companion_story' | 'goal' | 'legacy' | 'discovery' | 'companion_progression';
  discoveryId?: string;
  progressionGateId?: string;
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

export type HavenResidentMergeBoardState = {
  board: MergeBoardCell[];
  createdAt: number;
  generators: Record<string, MergeGeneratorState>;
  revision: number;
  storage: MergeBoardItem[];
  storageCapacity: number;
  updatedAt: number;
};

export type MossproutNatureIslandId =
  | 'seed-nursery'
  | 'bloom-garden'
  | 'pond-sanctuary'
  | 'orchard-grove'
  | 'ancient-tree-grove'
  | 'wildgrowth-grove';

export type MossproutNatureIslandLevel = 0 | 1 | 2 | 3 | 4;

export type MossproutGardenPlantSlotId =
  | 'back-left'
  | 'back-centre'
  | 'back-right'
  | 'front-left'
  | 'front-centre'
  | 'front-right';

export type MossproutMemoryPlantId =
  | 'momentum'
  | 'stillness'
  | 'renewal'
  | 'warmth'
  | 'curiosity';

export type PlantableMemorySource = {
  kind: 'ftue' | 'journey' | 'tending' | 'moment';
  sourceId: string;
};

export type PlantableMemoryInstance = {
  id: string;
  definitionId: MossproutMemoryPlantId;
  status: 'earned' | 'planted';
  slotId: MossproutGardenPlantSlotId | null;
  growthPoints: number;
  source: PlantableMemorySource;
  earnedAt: number;
  plantedAt: number | null;
};

export type MossproutGardenFeatureId = 'spring' | 'path';

export type HavenStructureProgress = {
  level: number;
  featureLevels: Record<MossproutGardenFeatureId, number>;
};

export type MossproutMovementEggProgress = {
  status: 'hidden' | 'revealed' | 'stirring';
  observedSteps: number;
  manualMovementLogs: number;
  updatedAt: number | null;
};

export type HavenMutationReceipt = {
  id: string;
  kind: 'plantable_grant' | 'plantable_place' | 'plantable_growth' | 'structure_upgrade' | 'feature_upgrade' | 'movement_egg';
  targetId: string;
  createdAt: number;
};

export type StoryWorldMutationReceipt = {
  id: string;
  kind: 'haven_upgrade';
  target: { kind: 'haven_tile'; characterId: MergeCharacterId } | { kind: 'haven_nature_island'; islandId: MossproutNatureIslandId } | { kind: 'haven_structure'; structureId: string };
  fromLevel: number;
  toLevel: number;
  economyMode: 'normal' | 'free' | 'grant';
  coinCost: number;
  createdAt: number;
};

export type MergeWorldState = {
  /** Reading is independent of purchase flow runs; cursors count revealed lines. */
  upgradeStoryRead?: Record<string, number>;
  upgradeSkinGrants?: Record<string, { skinId: string; grantedAt: number }>;
  stepplingEgg?: import('@/features/onboarding/steppling-egg-policy').StepplingEggProgress;
  worldUnlocks?: Record<string, { unlockedAt: number; paid: number; destination: MergeCharacterId; transferredAt: number | null; hatchedAt: number | null }>;
  glowDiscoveryLesson?: { preparedAt: number; servedOrderIds: string[]; spawnedAt?: number; guidedOrderIndex?: 0 | 1; layoutVersion?: 2 };
  stepplingGardenLesson?: { preparedAt: number; servedAt?: number };
  version: 22;
  /** The first personal Merge World is owned by Mossprout. */
  ownerCharacterId: 'mossprout';
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
  companionDailyGardenVersion?: 1;
  companionDailyGarden?: Partial<Record<'mossprout' | 'steppling', import('@/utils/merge-world/companion-daily-garden').CompanionDailyGardenBatch>>;
  mossproutDailyGardenOrders: MossproutDailyGardenOrders | null;
  characterActivityOpportunities: MergeCharacterActivityOpportunity[];
  ownedKatchimeraCards: OwnedKatchimeraCard[];
  mossproutResidentSkinIds: KatchimeraSkinId[];
  ownedMemoryCards: OwnedMemoryCard[];
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
  /** Exactly-once receipts for story-authored world mutations. */
  storyWorldMutationReceipts: StoryWorldMutationReceipt[];
  companionDiscovery: CompanionDiscoveryProgress;
  residentCardDiscovery: ResidentCardDiscoveryProgress;
  mossproutBoardProgression: MossproutBoardProgression;
  haven: {
    tileStages: Partial<Record<MergeCharacterId, HavenStage>>;
    mossproutNatureIslands: Record<MossproutNatureIslandId, MossproutNatureIslandLevel>;
    revealState: HavenRevealState;
    mossproutStoryLevel: number;
    nextProceduralOrder: number;
    residentMergeBoards: Partial<Record<Exclude<MergeBoardId, 'mossprout'>, HavenResidentMergeBoardState>>;
    structures: {
      mossproutGarden: HavenStructureProgress;
    };
    plantableMemories: PlantableMemoryInstance[];
    mutationReceipts: HavenMutationReceipt[];
    movementEgg: MossproutMovementEggProgress;
  };
};

export type MergeWorldCommand =
  | { type: 'stepplingEgg'; action: import('@/features/onboarding/steppling-egg-policy').StepplingEggAction; now: number }
  | { type: 'grantGeneratorParcel'; generatorId: string; rewardId: string; dayId: string; now: number }
  | { type: 'reconcileJourneyMeditation'; cycle: import('./companion-journey-cycle').CompanionJourneyCycle; availableAt: number; now: number }
  | { type: 'ensureCompanionDailyGarden'; familyId: 'mossprout' | 'steppling'; now: number }
  | { type: 'grantJourneyReturn'; cycle: import('./companion-journey-cycle').CompanionJourneyCycle; dayId: string; now: number }
  | { type: 'unlockWorldTarget'; targetId: string; now: number; receiptId?: string }
  | { type: 'transferDiscoveryEgg'; targetId: 'mossprout:overgrown-trail'; now: number }
  | { type: 'hatchWorldEgg'; targetId: 'mossprout:overgrown-trail'; now: number }
  | { type: 'prepareGlowDiscoveryLesson'; now: number }
  | { type: 'prepareStepplingGardenLesson'; now: number }
  | { type: 'refreshTime'; boardId?: MergeBoardId; now: number }
  | { type: 'tapGenerator'; boardId?: MergeBoardId; generatorId: string; now: number; seed: string; spendEnergy?: boolean; activityOpportunityId?: string }
  | { type: 'setGeneratorForcedDrop'; boardId?: MergeBoardId; generatorId: string; definitionId: string | null; now: number }
  | { type: 'upgradeGenerator'; boardId?: MergeBoardId; generatorId: string; now: number }
  | { type: 'move'; boardId?: MergeBoardId; from: number; to: number; now: number }
  | { type: 'serveOrder'; boardId?: MergeBoardId; orderId: string; now: number }
  | { type: 'serveDevHavenOrder'; boardId?: MergeBoardId; order: MergeOrder; now: number }
  | { type: 'storeItem'; boardId?: MergeBoardId; cell: number; now: number }
  | { type: 'restoreItem'; boardId?: MergeBoardId; storageIndex: number; cell?: number; now: number }
  | { type: 'sellItem'; boardId?: MergeBoardId; cell: number; now: number }
  | { type: 'claimInbox'; entryId: string; now: number }
  | { type: 'claimArrival'; arrivalId: string; now: number }
  | { type: 'viewMemoryArrival'; arrivalId: string; now: number }
  | { type: 'grantActivityRewardsBatch'; rewards: MergeActivityReward[]; now: number }
  | { type: 'claimStepEnergy'; dayId: string; observedSteps: number; observedAt: string; allowBootstrap: boolean; receiptId: string; now: number }
  | { type: 'setEnergyRegenPaused'; paused: boolean; now: number }
  | { type: 'featureCharacter'; characterId: MergeCharacterId; now: number }
  | { type: 'reconcileCharacterActivity'; familyId: MergeCharacterId; dayId: string; status: string; activity: { objectiveId: string; mergeOrderId: string; mergeOrderIds?: string[]; servedOrderIds?: string[]; opportunityId: string; generatorId: string; dropDefinitionIds: string[] } | null; residentSignals?: { completedObjectiveIds: string[]; completedBeatIds?: string[]; matchedCardIds: KatchimeraSkinId[]; firstResidentSkinId?: KatchimeraSkinId | null; habitatStage: 0 | 1 | 2 | 3 | 4 }; now: number }
  | { type: 'grantKatchimeraCard'; cardId: KatchimeraSkinId; familyId: MergeCharacterId; sourceReceiptId: string; now: number }
  | { type: 'purchaseKatchimeraCard'; cardId: KatchimeraSkinId; familyId: MergeCharacterId; cost: number; purchaseId: string; now: number }
  | { type: 'ackGeneratorUnlock'; receiptId: string; now: number }
  | { type: 'rerollOrder'; boardId?: MergeBoardId; orderId: string; now: number }
  | { type: 'startStepplingDiscovery'; now: number }
  | { type: 'openCompanionDiscoveryGate'; gateId: string; candidateIds: MergeCharacterId[]; recommendedCharacterId: MergeCharacterId | null; now: number }
  | { type: 'selectCompanionDiscoveryPath'; characterId: MergeCharacterId; now: number }
  | { type: 'ackCompanionDiscoveryReveal'; characterId: MergeCharacterId; now: number }
  | { type: 'activateResidentCardDiscovery'; campaignId: string; journeyDayId: string; residentId: KatchimeraSkinId; now: number }
  | { type: 'ackResidentCardDialogue'; discoveryId: string; now: number }
  | { type: 'ackResidentCardReveal'; discoveryId: string; now: number }
  | { type: 'reconcileCharacters'; characterIds: string[]; now: number }
  | { type: 'reconcileFriendship'; levels: Partial<Record<MergeCharacterId, number>>; now: number }
  | { type: 'reconcileMossproutBoardProgression'; signals: MossproutProgressionSignals; dayId: string; now: number }
  | { type: 'useGrovelightResonance'; gateId: string; dayId: string; now: number }
  | { type: 'revealMemoryCard'; cardId: string; now: number }
  | { type: 'reconcileStory'; familyId: MergeCharacterId; status: string; targetLevel: number; actPhase?: string; orderTemplateKeys?: string[]; servedOrderIds?: string[]; now: number }
  | { type: 'reconcileHavenStory'; characterId: MergeCharacterId; storyLevel: number; now: number }
  | { type: 'upgradeHavenTile'; characterId: MergeCharacterId; stage: HavenStage; now: number; receiptId?: string; economyMode?: 'normal' | 'free' | 'grant'; grantedCoins?: number }
  | { type: 'upgradeMossproutNatureIsland'; islandId: MossproutNatureIslandId; level: MossproutNatureIslandLevel; now: number; receiptId?: string; economyMode?: 'normal' | 'free' | 'grant'; grantedCoins?: number }
  | { type: 'revealHaven'; now: number }
  | { type: 'grantPlantableMemory'; definitionId: MossproutMemoryPlantId; source: PlantableMemorySource; receiptId: string; now: number }
  | { type: 'placePlantableMemory'; instanceId: string; slotId: MossproutGardenPlantSlotId; receiptId: string; now: number }
  | { type: 'growPlantableMemory'; instanceId: string; amount: number; receiptId: string; now: number }
  | { type: 'upgradeHavenStructure'; structureId: 'mossprout-garden'; level: number; receiptId: string; now: number }
  | { type: 'upgradeHavenFeature'; structureId: 'mossprout-garden'; featureId: MossproutGardenFeatureId; level: number; receiptId: string; now: number }
  | { type: 'revealMovementEgg'; receiptId: string; now: number }
  | { type: 'recordMovementEggProgress'; observedSteps?: number; manualMovement?: boolean; receiptId: string; now: number }
  | { type: 'ackExternalReward'; receiptId: string; now: number };

export type MergeWorldFailureReason =
  | 'locked_cell'
  | 'generator_resting'
  | 'board_full'
  | 'wrong_echo_match'
  | 'sealed_mist';

export type MergeWorldCommandResult = {
  spawnedGenerator?: { generatorId: string; cell: number };
  state: MergeWorldState;
  changed: boolean;
  message?: string;
  failureReason?: MergeWorldFailureReason;
  discoveryId?: string;
  mergedCell?: number;
  dreamEchoClearedId?: string;
  companionDiscoveryAdvanced?: { discoveryId: string; stage: number; completedCharacterId?: MergeCharacterId };
  residentCardRevealed?: { discoveryId: string; residentId: KatchimeraSkinId };
  residentCardEarned?: { discoveryId: string; residentId: KatchimeraSkinId };
  clearedMistCells?: number[];
  spawnedCell?: number;
  spawnedItems?: { instanceId: string; definitionId: string; progressionGateId?: string; cell: number }[];
  servedOrderId?: string;
  energyGranted?: number;
  stepEnergyClaim?: { consumedSteps: number; remainingClaimableSteps: number; beforeEnergy: number; afterEnergy: number; status: 'awarded' | 'below_threshold' | 'daily_cap' | 'duplicate' };
  itemsQueued?: number;
  havenUpgrade?: { characterId: MergeCharacterId; stage: HavenStage; coinCost: number };
  natureIslandUpgrade?: { islandId: MossproutNatureIslandId; level: MossproutNatureIslandLevel; coinCost: number; completedTier: boolean };
  storyWorldMutationReceipt?: StoryWorldMutationReceipt;
};
