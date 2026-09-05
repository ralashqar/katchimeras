import { MOSSPROUT_CAMPAIGN_VERSION } from '@/constants/mossprout-campaign';
import { emptyRelationshipProgressState } from '@/game/katchimeras/relationship-progression';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { loadCompanionAchievementState, saveCompanionAchievementState } from '@/utils/companion-achievements-storage';
import { loadCompanionBondState, saveCompanionBondState } from '@/utils/companion-bond-storage';
import { loadCompanionContentState, saveCompanionContentState } from '@/utils/companion-content-storage';
import { loadCompanionDiscoveryState, saveCompanionDiscoveryState } from '@/utils/companion-discovery-storage';
import { loadCompanionJourneyState, saveCompanionJourneyState } from '@/utils/companion-journey-storage';
import { loadCompanionQuickGoalState, saveCompanionQuickGoalState } from '@/utils/companion-quick-goal-storage';
import { loadCompanionQuests, saveCompanionQuests } from '@/utils/katchimera-quests';
import { installMossproutOnboardingMergeWorld, loadMergeWorldState, saveMergeWorldState } from '@/utils/merge-world/repository';

const MARKER_KEY = 'katchimeras.mossprout-campaign-migration';

type MigrationMarker = { version: number; completedAt: number };
type FamilyRecord = { familyId?: string; companionId?: string; creatureId?: string; characterId?: string; definitionId?: string | null; id?: string };

function isMossprout(value: FamilyRecord) {
  return value.familyId === 'mossprout'
    || value.companionId === 'companion:mossprout'
    || value.creatureId === 'companion:mossprout'
    || value.creatureId === 'mossprout'
    || value.characterId === 'mossprout'
    || value.definitionId?.startsWith('mossprout:')
    || value.id?.startsWith('mossprout:');
}

function withoutMossprout<T extends FamilyRecord>(values: readonly T[]) {
  return values.filter((value) => !isMossprout(value));
}

/**
 * Destructive, one-time campaign reset. Raw journal/home content, Wisps,
 * currency and unrelated companions are deliberately outside this migration.
 */
export async function runMossproutCampaignV2Migration(now = Date.now()): Promise<boolean> {
  const marker = getStoredJson<MigrationMarker | null>(MARKER_KEY, null);
  if (marker?.version === MOSSPROUT_CAMPAIGN_VERSION) return false;

  const content = loadCompanionContentState();
  saveCompanionContentState({
    ...content,
    invitations: withoutMossprout(content.invitations),
    memoryFacts: withoutMossprout(content.memoryFacts),
    memories: withoutMossprout(content.memories),
    insights: withoutMossprout(content.insights),
    visitPlans: withoutMossprout(content.visitPlans),
    conversationReceipts: withoutMossprout(content.conversationReceipts),
    telemetry: withoutMossprout(content.telemetry),
    events: withoutMossprout(content.events),
    introductions: withoutMossprout(content.introductions),
    visits: withoutMossprout(content.visits),
    conversationSessions: withoutMossprout(content.conversationSessions),
    conversationSignals: withoutMossprout(content.conversationSignals),
    conversationTelemetry: withoutMossprout(content.conversationTelemetry),
    servedConversationDayKeys: content.servedConversationDayKeys.filter((key) => !key.startsWith('mossprout:')),
    processedConversationEvidenceIds: content.processedConversationEvidenceIds.filter((id) => !id.includes('mossprout')),
  });

  const journey = loadCompanionJourneyState();
  saveCompanionJourneyState({
    ...journey,
    goals: withoutMossprout(journey.goals),
    conversations: withoutMossprout(journey.conversations),
    questEvents: withoutMossprout(journey.questEvents),
    momentEvents: withoutMossprout(journey.momentEvents),
    reflectionEvents: withoutMossprout(journey.reflectionEvents),
    checkIns: withoutMossprout(journey.checkIns),
  });

  const quickGoals = loadCompanionQuickGoalState();
  const keptQuickGoals = withoutMossprout(quickGoals.goals);
  const keptGoalIds = new Set(keptQuickGoals.map((goal) => goal.id));
  saveCompanionQuickGoalState({
    ...quickGoals,
    goals: keptQuickGoals,
    completions: quickGoals.completions.filter((entry) => keptGoalIds.has(entry.goalId) && entry.familyId !== 'mossprout'),
    dismissals: quickGoals.dismissals.filter((entry) => keptGoalIds.has(entry.goalId) && entry.familyId !== 'mossprout'),
  });

  const discovery = loadCompanionDiscoveryState();
  saveCompanionDiscoveryState({ ...discovery, answers: withoutMossprout(discovery.answers) });

  const achievements = loadCompanionAchievementState();
  saveCompanionAchievementState({
    ...achievements,
    unlocked: Object.fromEntries(Object.entries(achievements.unlocked).filter(([id]) => !id.includes('mossprout'))),
  });

  const bonds = loadCompanionBondState();
  saveCompanionBondState({
    ...bonds,
    events: bonds.events.filter((event) => !isMossprout(event)),
    pendingCelebrations: bonds.pendingCelebrations?.filter((receipt) => !isMossprout(receipt)),
    resetCutoffsByCreature: Object.fromEntries(Object.entries(bonds.resetCutoffsByCreature ?? {}).filter(([id]) => !id.includes('mossprout'))),
  });

  const quests = loadCompanionQuests();
  const keptQuests = quests.quests.filter((quest) => !isMossprout(quest) && !quest.questId.startsWith('mossprout:'));
  const keptQuestIds = new Set(keptQuests.map((quest) => quest.questId));
  saveCompanionQuests({
    ...quests,
    quests: keptQuests,
    submissions: quests.submissions.filter((entry) => keptQuestIds.has(entry.questId)),
    offerCycles: quests.offerCycles.filter((entry) => !isMossprout(entry)),
    attempts: quests.attempts.filter((entry) => keptQuestIds.has(entry.questId)),
  });

  relationshipProgressionRepository.save(emptyRelationshipProgressState());

  const previousWorld = await loadMergeWorldState(now);
  const freshWorld = await installMossproutOnboardingMergeWorld(now);
  const previousFavourite = previousWorld.favouriteCharacterId !== 'mossprout'
    ? previousWorld.favouriteCharacterId
    : freshWorld.favouriteCharacterId;
  const otherCharacterProgress = Object.fromEntries(
    Object.entries(previousWorld.characterProgress).filter(([characterId]) => characterId !== 'mossprout'),
  );
  const otherHavenTiles = Object.fromEntries(
    Object.entries(previousWorld.haven.tileStages).filter(([characterId]) => characterId !== 'mossprout'),
  );
  await saveMergeWorldState({
    ...freshWorld,
    coins: previousWorld.coins,
    rewardInbox: previousWorld.rewardInbox,
    ownedMemoryCards: previousWorld.ownedMemoryCards,
    ownedKatchimeraCards: previousWorld.ownedKatchimeraCards.filter((card) => card.familyId !== 'mossprout'),
    unlockedCharacters: [...new Set([
      ...freshWorld.unlockedCharacters,
      ...previousWorld.unlockedCharacters.filter((id) => id !== 'mossprout'),
    ])],
    favouriteCharacterId: previousFavourite,
    characterProgress: { ...otherCharacterProgress, ...freshWorld.characterProgress },
    companionDiscovery: {
      ...previousWorld.companionDiscovery,
      records: [
        ...freshWorld.companionDiscovery.records,
        ...previousWorld.companionDiscovery.records.filter((record) => record.characterId !== 'mossprout'),
      ],
      openedGateIds: [...new Set([
        ...freshWorld.companionDiscovery.openedGateIds,
        ...previousWorld.companionDiscovery.openedGateIds,
      ])],
      completedGateIds: [...new Set([
        ...freshWorld.companionDiscovery.completedGateIds,
        ...previousWorld.companionDiscovery.completedGateIds,
      ])],
    },
    haven: {
      ...freshWorld.haven,
      tileStages: { ...otherHavenTiles, ...freshWorld.haven.tileStages },
      revealState: previousWorld.haven.revealState,
    },
    externalRewardReceipts: previousWorld.externalRewardReceipts.filter((receipt) => receipt.characterId !== 'mossprout'),
    updatedAt: now,
    revision: freshWorld.revision + 1,
  });

  setStoredJson<MigrationMarker>(MARKER_KEY, { version: MOSSPROUT_CAMPAIGN_VERSION, completedAt: now });
  return true;
}
