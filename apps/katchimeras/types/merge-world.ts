import type { WispId } from '@/types/wisp';
import type { HavenRevealState, HavenStage } from '@/constants/haven-catalog';
import type { KatchimeraSkinId } from '@/types/katchimera';

/**
 * Content ids are strings: the bundled catalogue names the families, chains,
 * characters and boards it ships, and a content pack may add more without a
 * build. What an id means is read from a registry (`constants/merge-world-catalog.ts`,
 * `constants/hatchable-companions/registry.ts`, ...), never from the type.
 */
export type MergeFamilyId = string;
export type MergeChainId = string;
export type MergeCharacterId = string;
export type MergeBoardId = string;
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
  /** Full mist hiding the next sleeper: it bursts open, as that echo, the moment an echo beside it wakes. */
  | { kind: 'veiled'; echo: { id: string; definitionId: string; ownerCharacterId: MergeCharacterId | null } }
  | { kind: 'rootbound_echo'; id: string; gateId: string; definitionId: string; chapter: MossproutBoardChapter; ready: boolean }
  | { kind: 'resident_card'; discoveryId: string; gateId: string; residentId: KatchimeraSkinId | null; ready: boolean }
  | { kind: 'discovery_fork'; gateId: string; candidateIds: MergeCharacterId[]; recommendedCharacterId: MergeCharacterId | null }
  | { kind: 'dreambound_item'; discoveryId: string; gateId: string; pathId: string; sequenceIndex: number; boundDefinitionId: string; active: boolean }
  /** An encounter's own Mist: worn down by merges beside it (or by its wisp's fall), revealing what it holds. */
  | { kind: 'encounter'; type: import('./encounter').EncounterMistType; hp: number; wispId?: string; holds?: import('./encounter').EncounterMistHolds };

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

export type KatchimeraCardAcquisition = 'journey_match' | 'story_resident' | 'resident_discovery' | 'island_campaign' | 'coins';

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

/** An island of Mossprout's neighbourhood; the bundled six are in `constants/mossprout-nature-islands.ts`, a pack may add more. */
export type MossproutNatureIslandId = string;

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
  | 'curiosity'
  | 'connection';

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
  economyMode: 'normal' | 'free' | 'grant' | 'encounter';
  coinCost: number;
  createdAt: number;
  transition?: 'island_reveal';
};

export type IslandCampaignChapterProgress = {
  level: MossproutNatureIslandLevel;
  /** The authored answer that shapes this chapter's request and payoff. */
  selectedOptionId?: string | null;
  orderIds: string[];
  servedOrderIds: string[];
  startedAt: number;
  /** Set after Petalimp acknowledges the delivered request, before Glow restoration. */
  returnConversationSeenAt?: number | null;
  /** A chapter played on the friend's docked restoration board (paid at activation; the order is its delivery). */
  restoration?: IslandRestorationProgress;
  completedAt: number | null;
};

export type IslandRestorationProgress = {
  startedAt: number;
  paidCoins: number;
  /** Merges counted over merges needed; the marker's bar. */
  progress: { current: number; total: number };
  /** When the board could go no further and the chapter's order was published. */
  deliveryRequestedAt: number | null;
  /** Items served to the order, in order; the board places them as they arrive. */
  delivered: { definitionId: string; deliveredAt: number }[];
  completedAt: number | null;
};

export type MossproutNatureIslandReveal = {
  revealedAt: number;
  receiptId: string;
  paid: number;
};

export type IslandCampaignProgress = {
  campaignId: string;
  islandId: MossproutNatureIslandId;
  residentSkinId: KatchimeraSkinId;
  /** Discovery lets this friend speak and publish requests before their card is earned. */
  discoveredAt: number;
  discoveryRevealSeenAt: number | null;
  cardEarnedAt: number | null;
  cardRevealSeenAt: number | null;
  chapters: Record<string, IslandCampaignChapterProgress>;
};

/** A mission cleared, however many times, and how well. */
export type EncounterClearRecord = { firstClearedAt: number; clears: number; bestGrade: import('./encounter').EncounterGrade; lastKatchimeraId: MergeCharacterId };
export type EncounterActive = { missionId: string; runId: string; campaignId?: string; katchimeraId: MergeCharacterId; helperWispId: WispId | null; startedAt: number };
export type EncounterOutcomeRecord = { missionId: string; receiptId: string; grade: import('./encounter').EncounterGrade; glow: number; xp: number; firstClear: boolean; katchimeraId: MergeCharacterId; ackedAt: number | null };
/**
 * Everything the world keeps of the Mist encounters: exactly-once receipts,
 * what has been cleared, the board that is up, the last loadout, the Daily
 * Mist by day, and the last outcome until it is seen.
 */
export type EncounterLedger = {
  receipts: string[];
  clears: Record<string, EncounterClearRecord>;
  active: EncounterActive | null;
  loadout: { katchimeraId: MergeCharacterId; helperWispId: WispId | null } | null;
  daily: Record<string, { slots: Record<string, { clearedAt: number; grade: import('./encounter').EncounterGrade }> }>;
  lastOutcome: EncounterOutcomeRecord | null;
  /** Per level track: the star milestones already opened. */
  milestones?: Record<string, number[]>;
  /** Today's replays per level track (only today is kept): past the first few, a replay pays a trickle. */
  replays?: { dayId: string; byTrack: Record<string, number> };
};
/** A playable Katchimera's level and the experience toward the next; level-ups spend Glow. */
export type KatchimeraProgress = { level: number; xp: number; upgradedAt: number | null };

export type MergeWorldState = {
  /** Set once a save has crossed into the campaign pivot (v25); orders and the persistent board are history. */
  pivot?: 'campaign-v1';
  encounters?: EncounterLedger;
  katchimeraProgress?: Partial<Record<MergeCharacterId, KatchimeraProgress>>;
  wispLanternPlacement?: { slotId: 'front-right'; plantedAt: number };
  wispLanternProgress?: import('@/features/wisps/lantern-world').LanternWorldProgress;
  /** Heartwood's economy buildings (Dew Spring, Seed Nursery, Root Cellar, Garden Stall), by id. Absent until one is built. */
  heartwoodBuildings?: import('@/constants/heartwood-buildings').HeartwoodBuildings;
  /** Daily time trials (Wisp Rush): results and records by trial id. Boards inside a heat are never saved. */
  timeTrials?: import('@/features/time-trial/trial-world').TimeTrials;
  sharedAdventure?: import('@/features/shared-adventure/types').SharedAdventureProgress;
  localLiveOps?: import('./local-live-ops').LocalLiveOpsState;
  /** Reading is independent of purchase flow runs; cursors count revealed lines. */
  upgradeStoryRead?: Record<string, number>;
  upgradeSkinGrants?: Record<string, { skinId: string; grantedAt: number }>;
  /** Durable mini-campaign state for narrative-led nature islands. */
  islandCampaigns?: Record<string, IslandCampaignProgress>;
  /** Kept for saves written before `hatchableEggs`; mirrors `hatchableEggs.steppling`. */
  stepplingEgg?: import('@/features/onboarding/hatchable-egg-policy').HatchableEggProgress;
  /** Each hatchable companion's Egg, from the clearing to the hatch. */
  hatchableEggs?: Partial<Record<MergeCharacterId, import('@/features/onboarding/hatchable-egg-policy').HatchableEggProgress>>;
  worldUnlocks?: Record<string, { unlockedAt: number; paid: number; destination: MergeCharacterId; transferredAt: number | null; hatchedAt: number | null }>;
  /** A mist mission's ticket: the tile's price, paid once at its bubble, before the board opens; the reveal after the board then costs nothing. */
  hatchableMissions?: Partial<Record<MergeCharacterId, { paidAt: number; paidCoins: number; receiptId: string }>>;
  /** `layoutVersion` 3: the Basket is earned by parcel on a board with no loose items; anything older is re-prepared. */
  glowDiscoveryLesson?: { preparedAt: number; servedOrderIds: string[]; spawnedAt?: number; guidedOrderIndex?: 0 | 1; layoutVersion?: 2 | 3 };
  /** The first light, earned when the last wisp fell on the opening board: what the first garden restore is paid with. */
  openingGlow?: { receiptId: string; amount: number; grantedAt: number } | null;
  /** Kept for saves written before `gardenLessons`; mirrors `gardenLessons.steppling`. */
  stepplingGardenLesson?: { preparedAt: number; servedAt?: number };
  /** Each hatchable companion's garden lesson (parcel, grow, serve): prepared once, served once. */
  gardenLessons?: Partial<Record<MergeCharacterId, { preparedAt: number; servedAt?: number }>>;
  /** Mossprout's wish — bring every friend home — once it has been told, and once its map hint was seen. */
  kingdomGoal?: { introducedAt: number; coachmarkSeenAt: number | null };
  version: 25;
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
  companionDailyGarden?: Partial<Record<MergeCharacterId, import('@/utils/merge-world/companion-daily-garden').CompanionDailyGardenBatch>>;
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
    /** Level zero can be visible after its mist is cleared, before restoration. */
    mossproutNatureIslandReveals: Partial<Record<MossproutNatureIslandId, MossproutNatureIslandReveal>>;
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
  /** `stepplingEgg` is the same command for Steppling, kept for callers and saves. */
  | { type: 'stepplingEgg'; action: import('@/features/onboarding/hatchable-egg-policy').HatchableEggAction; now: number }
  | { type: 'hatchableEgg'; companion: MergeCharacterId; action: import('@/features/onboarding/hatchable-egg-policy').HatchableEggAction; now: number }
  | { type: 'grantGeneratorParcel'; generatorId: string; rewardId: string; dayId: string; now: number }
  | { type: 'reconcileJourneyMeditation'; cycle: import('./companion-journey-cycle').CompanionJourneyCycle; availableAt: number; now: number }
  | { type: 'ensureCompanionDailyGarden'; familyId: MergeCharacterId; now: number }
  | { type: 'grantJourneyReturn'; cycle: import('./companion-journey-cycle').CompanionJourneyCycle; dayId: string; now: number }
  | { type: 'unlockWorldTarget'; targetId: string; now: number; receiptId?: string }
  | { type: 'payHatchableMission'; companion: MergeCharacterId; receiptId: string; now: number }
  | { type: 'transferDiscoveryEgg'; targetId: string; now: number }
  | { type: 'hatchWorldEgg'; targetId: string; now: number }
  | { type: 'prepareGlowDiscoveryLesson'; now: number }
  /** The first light: the Glow that drove the opening's wisps off stays with you, once per run. */
  | { type: 'grantOpeningGlow'; receiptId: string; amount: number; now: number }
  /** Glow the story hands over once (e.g. Steppling's mist price), keyed in the encounter ledger's receipts. */
  | { type: 'grantStoryGlow'; receiptId: string; amount: number; now: number }
  /** Keep going on a lost level: its Glow, once per receipt; refused when the Glow is not there. */
  | { type: 'payEncounterContinue'; receiptId: string; cost: number; now: number }
  /** `prepareStepplingGardenLesson` is the same command for Steppling, kept for callers and saves. */
  | { type: 'prepareStepplingGardenLesson'; now: number }
  | { type: 'prepareGardenLesson'; companion: MergeCharacterId; now: number }
  | { type: 'refreshTime'; boardId?: MergeBoardId; now: number }
  | { type: 'tapGenerator'; boardId?: MergeBoardId; generatorId: string; now: number; seed: string; spendEnergy?: boolean; activityOpportunityId?: string; /** An encounter's spawner: its charges are spent whatever the world's policy says. */ enforceCharges?: boolean; /** An encounter's odds of a better drop, in place of the world's own. */ dropProfile?: { tierTwoChance: number; tierThreeChance: number } }
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
  | { type: 'revealMossproutNatureIsland'; islandId: MossproutNatureIslandId; campaignId: string; residentSkinId: KatchimeraSkinId; cost: number; receiptId: string; now: number }
  | { type: 'discoverIslandCampaignResident'; campaignId: string; islandId: MossproutNatureIslandId; residentSkinId: KatchimeraSkinId; now: number }
  | { type: 'ackIslandCampaignResidentDiscovery'; campaignId: string; now: number }
  | { type: 'ackIslandCampaignResidentCardReveal'; campaignId: string; now: number }
  | { type: 'activateIslandCampaignChapter'; campaignId: string; islandId: MossproutNatureIslandId; residentSkinId: KatchimeraSkinId; level: MossproutNatureIslandLevel; selectedOptionId?: string | null; orders: MergeOrder[]; now: number }
  | { type: 'ackIslandCampaignChapterReturn'; campaignId: string; level: MossproutNatureIslandLevel; now: number }
  | { type: 'requestIslandCampaignDelivery'; campaignId: string; level: MossproutNatureIslandLevel; orders: MergeOrder[]; now: number }
  | { type: 'recordIslandRestorationProgress'; campaignId: string; level: MossproutNatureIslandLevel; current: number; total: number; now: number }
  | { type: 'completeIslandRestoration'; campaignId: string; level: MossproutNatureIslandLevel; now: number }
  | { type: 'completeIslandCampaignChapter'; campaignId: string; level: MossproutNatureIslandLevel; now: number }
  | { type: 'introduceKingdomGoal'; now: number }
  | { type: 'ackKingdomGoalCoachmark'; now: number }
  | { type: 'revealHaven'; now: number }
  | { type: 'grantPlantableMemory'; definitionId: MossproutMemoryPlantId; source: PlantableMemorySource; receiptId: string; now: number }
  | { type: 'placePlantableMemory'; instanceId: string; slotId: MossproutGardenPlantSlotId; receiptId: string; now: number }
  | { type: 'growPlantableMemory'; instanceId: string; amount: number; receiptId: string; now: number }
  | { type: 'upgradeHavenStructure'; structureId: 'mossprout-garden'; level: number; receiptId: string; now: number }
  | { type: 'upgradeHavenFeature'; structureId: 'mossprout-garden'; featureId: MossproutGardenFeatureId; level: number; receiptId: string; now: number }
  | { type: 'revealMovementEgg'; receiptId: string; now: number }
  | { type: 'recordMovementEggProgress'; observedSteps?: number; manualMovement?: boolean; receiptId: string; now: number }
  | { type: 'ackExternalReward'; receiptId: string; now: number }
  /** A Mist encounter begins: the board that is up, and what was brought in. */
  | { type: 'startEncounter'; missionId: string; runId: string; campaignId?: string; katchimeraId: MergeCharacterId; helperWispId: WispId | null; now: number }
  | { type: 'abandonEncounter'; now: number }
  /**
   * A cleared encounter pays once per receipt: Glow to the world, experience to the Katchimera, the clear to the ledger,
   * and, when the rung was the last of its chapter, the island a level up.
   */
  /** A star milestone on a level track: its Glow once, and the friend pack the caller then grants. */
  | { type: 'claimTrackMilestone'; trackId: string; threshold: number; now: number }
  | { type: 'completeEncounter'; receiptId: string; missionId: string; campaignId?: string; katchimeraId: MergeCharacterId; helperWispId: WispId | null; outcome: import('@/features/encounter/outcome').EncounterOutcome; difficulty: import('./encounter').EncounterDifficulty; base?: { glow: number; xp: number } | null; now: number }
  | { type: 'ackEncounterOutcome'; now: number }
  /** A Katchimera a level up, for Glow, once their experience allows; a stale expected level changes nothing. */
  | { type: 'upgradeKatchimera'; characterId: MergeCharacterId; expectedLevel: number; now: number };

export type MergeWorldFailureReason =
  | 'locked_cell'
  | 'generator_resting'
  | 'out_of_energy'
  | 'board_full'
  | 'wrong_echo_match'
  | 'sealed_mist'
  /** An encounter: the Mist allows no more actions. */
  | 'out_of_resolve'
  /** An encounter: the spawner has no charge left. */
  | 'spawner_spent';

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
  /** An island friend's final chapter just granted their card. */
  friendCardEarned?: { campaignId: string; residentSkinId: KatchimeraSkinId };
  clearedMistCells?: number[];
  /** Veiled cells that burst open into sleepers because a neighbour woke: shown, never counted. */
  revealedMistCells?: number[];
  spawnedCell?: number;
  spawnedItems?: { instanceId: string; definitionId: string; progressionGateId?: string; cell: number }[];
  servedOrderId?: string;
  energyGranted?: number;
  stepEnergyClaim?: { consumedSteps: number; remainingClaimableSteps: number; beforeEnergy: number; afterEnergy: number; status: 'awarded' | 'below_threshold' | 'daily_cap' | 'duplicate' };
  itemsQueued?: number;
  havenUpgrade?: { characterId: MergeCharacterId; stage: HavenStage; coinCost: number };
  natureIslandUpgrade?: { islandId: MossproutNatureIslandId; level: MossproutNatureIslandLevel; coinCost: number; completedTier: boolean };
  storyWorldMutationReceipt?: StoryWorldMutationReceipt;
  /** An encounter just paid: what it paid and to whom, for the provider's celebration, Bond and sparks. */
  encounterCleared?: { missionId: string; campaignId?: string; glow: number; xp: number; grade: import('./encounter').EncounterGrade; firstClear: boolean; katchimeraId: MergeCharacterId; islandRaised?: { islandId: MossproutNatureIslandId; level: MossproutNatureIslandLevel }; trackId?: string; bossPack?: { receiptId: string; familyId: string } };
  milestoneClaimed?: { trackId: string; threshold: number; glow: number; pack: 'gift' | 'gift-rare' | 'finale'; familyId: string; receiptId: string };
  /** A Katchimera just levelled. */
  katchimeraUpgraded?: { characterId: MergeCharacterId; level: number; cost: number };
};
