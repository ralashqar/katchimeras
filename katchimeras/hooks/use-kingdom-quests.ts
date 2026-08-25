import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DEV_TOOLS_ENABLED } from '@/constants/dev';
import { useQuestCapabilities } from '@/hooks/use-quest-capabilities';
import { homeRepository } from '@/storage/repositories/home-repository';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { completeMossproutJourneyGoalPlan, mossproutJourneyForDay, mossproutJourneyRuntimeDayId, recordMossproutMatchedCard } from '@/game/katchimeras/relationship-progression';
import { commitKatchimeraActionCompletion } from '@/game/katchimeras/action-completion';
import type { HomeDayRecord, MemoryQualityScore, StoredHomeDayRecord } from '@/types/home';
import type { KingdomCreature, KingdomState } from '@/types/kingdom';
import type { KatchimeraSkinId } from '@/types/katchimera';
import type { CompanionDestination, CompanionNavigationIntent, CompanionVisitResponse, QuestCaptureFeedback } from '@/types/companion-interaction';
import {
  archetypeForCreature,
  companionUnit,
  subtypeForCreature,
} from '@/utils/katchimera-engagement';
import { insightForArchetype } from '@/utils/companion-interaction';
import { requestCompanionNavigationIntent } from '@/utils/companion-navigation-intent';
import {
  acceptQuest,
  canAcceptQuestForDay,
  cancelQuestAttempt,
  completeInteractiveQuest,
  completeQuest,
  hasCompletedRealLifeQuestForDay,
  interactionState,
  isQuestCompletedForDay,
  loadCompanionQuests,
  questCriteria,
  questFor,
  questOffersForDay,
  reconcileActiveQuestPool,
  releaseActiveQuest,
  saveCompanionQuests,
  submitQuest,
  startQuestAttempt,
  type CompanionQuestState,
  type CompanionQuest,
} from '@/utils/katchimera-quests';
import {
  acknowledgeCompanionBondCelebration,
  COMPANION_BOND_REWARDS,
  companionBondProgress,
  companionFriendshipProgress,
  questBondEventKind,
  questBondEventId,
  recordCompanionBondEvent,
  syncCompanionBondEvent,
  type CompanionBondEventKind,
} from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState, subscribeCompanionBondState } from '@/utils/companion-bond-storage';
import { completeAuthoredCohortConversation, completeFeastleConversation, isAuthoredCohortFamily, markFeastleJournalFtue, recordFeastleConfirmedMemory, recordFeastleStorySignal } from '@/utils/companion-story-storage';
import {
  answerCompanionDiscoveryPrompt,
  answersForCompanion,
  removeCompanionDiscoveryAnswer,
  setCompanionGoalStatus,
} from '@/utils/companion-discovery';
import {
  loadCompanionDiscoveryState,
  saveCompanionDiscoveryState,
} from '@/utils/companion-discovery-storage';
import {
  discoveryPromptsForFamily,
  katchimeraRoleByFamilyId,
  type CompanionDiscoveryPromptDefinition,
} from '@/constants/katchimera-roles';
import { companionJourneyByFamilyId, type CompanionJourneyGoalStatus } from '@/constants/companion-journeys';
import {
  companionIntroductionByFamilyId,
  type CompanionSupportStyle,
} from '@/constants/companion-introductions';
import { companionContentById, companionContentForFamily } from '@/constants/companion-content';
import {
  companionConversationDefinitionById,
  companionConversationDefinitionsForFamily,
} from '@/constants/companion-conversations-v2';
import { resolveMossproutCampaignConversation } from '@/constants/mossprout-campaign-conversations';
import { companionIdForFamily, katchimeraSkinById } from '@/constants/katchimera-skins';
import { isJourneyQuickModeEnabled } from '@/utils/dev-settings';
import { companionQuickGoalTemplateById } from '@/constants/companion-quick-goals';
import { activateStoredResidentCardDiscovery } from '@/utils/merge-world/repository';
import type { ConversationDefinition, ConversationMode, ConversationNode, ConversationOutcomePresentation, ConversationSession } from '@/types/companion-conversation';
import type { KatchimeraActionOrigin } from '@/types/relationship-progression';
import { isConversationV2Family, isConversationV2IdealSkinFamily } from '@/types/companion-conversation';
import {
  activeConversationForFamily,
  answerJourneyCheckIn,
  answerJourneyConversation,
  backJourneyCheckIn,
  checkInForDay,
  createJourneyGoalFromProposal,
  currentJourneyConversationNode,
  editJourneyCheckIn,
  goalsForJourneyFamily,
  hasJourneyMomentForDay,
  journeyProgressForGoal,
  primaryGoalForFamily,
  recordJourneyMoment,
  renameJourneyGoal,
  setJourneyGoalStatus,
  setJourneyCheckInTaskSuggestionStatus,
  setPrimaryJourneyGoal,
  startJourneyCheckIn,
  startJourneyConversation,
  syncJourneyQuestCompletions,
  type CompanionJourneyCheckInAnswer,
} from '@/utils/companion-journey';
import { companionCheckInSuggestedGoalIds } from '@/utils/companion-check-in';
import {
  activeConversationSessionForFamily,
  consumeConversationSignal,
  ensureCompanionInvitation,
  completeCompanionIntroduction,
  completeCompanionVisit,
  deferCompanionIntroduction,
  ensureCompanionVisitPlan,
  introductionForFamily,
  insightsForFamily,
  memoriesForFamily,
  migrateCompanionIntroduction,
  recordCompanionVisit,
  recordCompanionVisitTelemetry,
  recordConversationTelemetry,
  receiptForVisitPlan,
  resetCompanionMemory,
  removeCompanionInsight,
  selectCompanionDailyInvitation,
  updateCompanionMemoryStatus,
  updateCompanionInvitation,
  upsertCompanionMemory,
  upsertCompanionInsight,
  upsertConversationSession,
  previewConversationSessionForFamily,
  visitPlanForDay,
  type CompanionContentState,
  type CompanionIntroductionAnswer,
  type CompanionVisitGreeting,
} from '@/utils/companion-content';
import {
  answerConversation,
  archiveConversationSession,
  continueConversation,
  conversationNode,
  createConversationSession,
  conversationQuestionCount,
  recordConversationOutcome,
  selectConversationDefinition,
  selectConversationForMode,
  selectConversationFromPool,
} from '@/utils/companion-conversation';
import { reconcileConversationJournalSignals } from '@/utils/companion-conversation-signals';
import { loadCompanionContentState, saveCompanionContentState, subscribeCompanionContentResets } from '@/utils/companion-content-storage';
import { loadCompanionJourneyState, saveCompanionJourneyState } from '@/utils/companion-journey-storage';
import { companionIdResolverForHomeState } from '@/utils/katchimera-identity';
import type { KingdomResident } from '@/utils/kingdom-residents';
import { requestQuestActionIntent } from '@/utils/quest-action-signal';
import { selectBalancedQuestOffers, sortQuestOffersByAvailability } from '@/utils/quest-offer-order';
import { withDailyQuestPresentationVariant } from '@/utils/quests/presentation-variants';
import { beginQuestCapture, consumeCompletedQuestCapture, questCaptureBelongsTo } from '@/utils/quest-capture-session';
import {
  buildQuestReportBackItems,
  buildQuestSubmissionItems,
  type QuestSubmissionItem,
} from '@/utils/quests/report-back-evidence';
import { evaluateQuestRuntime } from '@/utils/quests/runtime';
import {
  questDefinition,
  semanticQuestJournalFallbackRoute,
} from '@/utils/quests/definitions';
import { completedQuestCount, resolveBlockJamConfig, resolveBreathingConfig, resolveLostWordDifficulty, resolveMatchingConfig, resolveMergeConfig, resolvePatternConfig, resolveRhythmConfig, resolveSortingConfig, resolveStepChallengeConfig, resolveTimingConfig, resolveWordPathsDifficulty } from '@/utils/quests/experiences/difficulty';
import { selectWordPathPuzzle } from '@/utils/quests/experiences/word-paths-puzzles';
import { isInteractiveExecution, type QuestResult } from '@/utils/quests/experiences/types';
import { refreshQuestFacts } from '@/utils/quests/facts';
import type { Facts } from '@/utils/signals/facts';
import { recalibrateClassifiedMemory, repairUrbanPhotoCentrality, withQualityConfirmation } from '@/utils/intelligence/classification';
import { buildPhotoEvidence, upsertEvidence } from '@/utils/intelligence/evidence';
import { useEconomy } from '@/features/economy/economy-provider';
import { historyDaysForAccess } from '@/utils/history-access';
import { buildCompanionVisitPlan } from '@/utils/companion-visit';
import { deriveCompanionPatternCandidates } from '@/utils/companion-memory-patterns';
import { localDayId } from '@/utils/world-identity';

type SelectedResident = {
  creature: KingdomCreature;
  resident: KingdomResident;
  destination: CompanionDestination | null;
};

type MossproutActionCandidate = {
  definitionId: string;
  mode: ConversationMode;
  questionCount: number;
  title: string;
  actionKind?: 'journal_prompt' | 'journey_focus';
  label?: string;
  description?: string;
};

type Args = {
  kingdom: KingdomState;
  residents: KingdomResident[];
  today: HomeDayRecord | null;
  todayFacts: Partial<Facts>;
};

export type QuestResultNotice = {
  kind: 'success' | 'possible' | 'no_match';
  title: string;
  message: string;
  thumbnailUri: string | null;
  questId: string;
  creatureId: string;
};

function loadIdentityAwareCompanionQuests(): CompanionQuestState {
  return loadCompanionQuests(companionIdResolverForHomeState(homeRepository.load()));
}

function loadIdentityAwareCompanionBondState() {
  const homeState = homeRepository.load();
  const resolveCompanionId = companionIdResolverForHomeState(homeState);
  const quests = loadCompanionQuests(resolveCompanionId);
  return loadCompanionBondState(quests, resolveCompanionId, homeState);
}

function settleMossproutJourneyBond(dayId: string) {
  const relationships = relationshipProgressionRepository.load();
  const journey = mossproutJourneyForDay(relationships, dayId);
  const receipt = journey?.status === 'complete' ? journey.completionReceipt : null;
  if (!journey || !receipt) return;
  // The first Journey Day deliberately settles after the player chooses one
  // optional action card. This makes the visible action the cause of the Bond
  // reward and avoids turning all three cards into a checklist.
  if (journey.beatId === 'quiet-patch:first-flower'
    && !journey.actions.some((action) => action.kind !== 'journey' && action.status === 'completed')) return;
  const current = loadIdentityAwareCompanionBondState();
  const individuallyAwarded = relationships.actionCompletionEvents.reduce((total, event) => {
    if (event.source.journeyId !== journey.id || event.source.kind === 'story_chat' || !event.rewardEventId) return total;
    return total + (current.events.find((bondEvent) => bondEvent.id === event.rewardEventId)?.points ?? 0);
  }, 0);
  const result = syncCompanionBondEvent(current, {
    id: receipt.id,
    creatureId: companionIdForFamily('mossprout'),
    kind: 'journey_day_completed',
    points: Math.max(0, receipt.bondPoints - individuallyAwarded),
    occurredAt: receipt.createdAt,
    dayId: receipt.dayId,
  }, { queueCelebration: true });
  if (result.awarded) saveCompanionBondState(result.state);
}

function settleMossproutConversationCompletion(
  session: ConversationSession,
  definition: ConversationDefinition | null | undefined,
) {
  if (!definition || definition.familyId !== 'mossprout') return;
  commitKatchimeraActionCompletion({ session, definition });
}

function conversationHasIndependentBond(definitionId: string, dayId?: string | null) {
  if (!definitionId.startsWith('mossprout:') || !dayId) return true;
  const relationships = relationshipProgressionRepository.load();
  const runtimeDayId = mossproutJourneyRuntimeDayId(relationships, dayId, isJourneyQuickModeEnabled());
  const journey = mossproutJourneyForDay(relationships, runtimeDayId)
    ?? [...relationships.journeyDays].reverse().find((candidate) => (
      candidate.familyId === 'mossprout'
      && candidate.actions.some((action) => action.definitionId === definitionId)
    ));
  return !journey?.actions.some((action) => action.definitionId === definitionId);
}

function mossproutConversationCompletionDayId(dayId: string): string {
  const relationships = relationshipProgressionRepository.load();
  return mossproutJourneyRuntimeDayId(relationships, dayId, isJourneyQuickModeEnabled());
}

function independentConversationBondPoints(definitionId: string) {
  return definitionId.startsWith('mossprout:') ? 4 : COMPANION_BOND_REWARDS.conversation_completed;
}

function questBondPoints(questId: string) {
  if (questId === 'quest-mossprout-green-photo' || questId === 'quest-mossprout-nature-note') return 5;
  return COMPANION_BOND_REWARDS[questBondEventKind(questDefinition(questId))];
}

function releasedQuestOption(questId: string): boolean {
  const execution = questDefinition(questId)?.execution;
  if (!execution || !isInteractiveExecution(execution)) return true;
  if (execution.kind === 'merge' || execution.kind === 'block_blast' || execution.kind === 'block_jam' || execution.kind === 'word_connect') return true;
  return execution.kind === 'matching' && execution.packId === 'mossprout-garden';
}

export type { QuestCaptureFeedback } from '@/types/companion-interaction';

export function useKingdomQuests({ kingdom, residents, today, todayFacts }: Args) {
  const router = useRouter();
  const economy = useEconomy();
  const [microcopy, setMicrocopy] = useState<string | null>(null);
  const [selectedResident, setSelectedResident] = useState<SelectedResident | null>(null);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [companionQuestState, setCompanionQuestState] = useState<CompanionQuestState>(loadIdentityAwareCompanionQuests);
  const [companionBondState, setCompanionBondState] = useState(loadIdentityAwareCompanionBondState);
  const [companionDiscoveryState, setCompanionDiscoveryState] = useState(loadCompanionDiscoveryState);
  const [companionJourneyState, setCompanionJourneyState] = useState(loadCompanionJourneyState);
  const [companionContentState, setCompanionContentState] = useState<CompanionContentState>(loadCompanionContentState);
  const [selectedVisitGreeting, setSelectedVisitGreeting] = useState<CompanionVisitGreeting>('regular');
  const recordedVisitKeyRef = useRef<string | null>(null);
  const [storedHomeState, setStoredHomeState] = useState(() => homeRepository.load());
  const [questCaptureFeedback, setQuestCaptureFeedback] = useState<QuestCaptureFeedback | null>(null);
  const [questCaptureRestoreKey, setQuestCaptureRestoreKey] = useState<string | null>(null);
  const [completedQuestPreview, setCompletedQuestPreview] = useState<{
    quest: CompanionQuest;
    item: QuestSubmissionItem;
  } | null>(null);
  const [questResultNotice, setQuestResultNotice] = useState<QuestResultNotice | null>(null);

  useEffect(() => {
    const reconcile = () => {
      for (const journey of relationshipProgressionRepository.load().journeyDays) {
        if (journey.familyId === 'mossprout' && journey.status === 'complete' && journey.completionReceipt) {
          settleMossproutJourneyBond(journey.dayId);
        }
      }
    };
    reconcile();
    const unsubscribe = relationshipProgressionRepository.subscribe(reconcile);
    return () => { unsubscribe(); };
  }, []);
  const [quickGoalSuggestions, setQuickGoalSuggestions] = useState<{
    familyId: string;
    templateIds: readonly string[];
  } | null>(null);
  const { capabilities: questCapabilities } = useQuestCapabilities(storedHomeState);
  const questDay: HomeDayRecord | null =
    today && storedHomeState?.today?.isoDate === today.isoDate
      ? {
          ...today,
          ...storedHomeState.today,
          classifiedMemories: storedHomeState.today.classifiedMemories?.map((memory) => {
            const recalibrated = memory.schemaVersion < 3 ? recalibrateClassifiedMemory(memory) : memory;
            return repairUrbanPhotoCentrality(recalibrated);
          }),
        }
      : today;
  // A quest capture returns to this screen after `todayFacts` was originally
  // derived. Re-resolve from the freshly loaded persisted day so the runtime,
  // candidate list, and inspector all evaluate the same classified memory.
  const questFacts = useMemo(
    () => refreshQuestFacts(todayFacts, questDay),
    [questDay, todayFacts]
  );
  const residentById = useMemo(() => new Map(residents.map((resident) => [resident.creatureId, resident])), [residents]);
  const creatureById = useMemo(
    () => {
      const map = new Map<string, KingdomCreature>();
      // Kingdom creatures are newest first; retain the equipped/latest skin for
      // each logical companion rather than letting an older hatch overwrite it.
      for (const creature of kingdom.creatures) {
        if (!map.has(creature.creatureId)) map.set(creature.creatureId, creature);
      }
      return map;
    },
    [kingdom.creatures]
  );

  // Appearance can change while the interaction sheet is open. Refresh its
  // presentation record without changing the stable companion selection.
  useEffect(() => {
    setSelectedResident((current) => {
      if (!current) return current;
      const creature = creatureById.get(current.creature.creatureId);
      const resident = residentById.get(current.resident.creatureId);
      if (!creature || !resident) return null;
      if (creature === current.creature && resident === current.resident) return current;
      return { ...current, creature, resident };
    });
  }, [creatureById, residentById]);

  useFocusEffect(
    useCallback(() => {
      setCompanionQuestState(loadIdentityAwareCompanionQuests());
      setCompanionBondState(loadIdentityAwareCompanionBondState());
      setCompanionDiscoveryState(loadCompanionDiscoveryState());
      setCompanionJourneyState(loadCompanionJourneyState());
      setCompanionContentState(loadCompanionContentState());
      setStoredHomeState(homeRepository.load());
      const completedCapture = consumeCompletedQuestCapture();
      if (completedCapture?.sourceId) {
        setQuestCaptureRestoreKey(`${completedCapture.questId}:${completedCapture.sourceId}`);
        const resident = residentById.get(completedCapture.creatureId);
        const creature = creatureById.get(completedCapture.creatureId);
        if (resident && creature) setSelectedResident({ resident, creature, destination: 'quest' });
        const evaluation = completedCapture.evaluation;
        setQuestCaptureFeedback({
          phase: evaluation?.status === 'ready' ? 'matched' : evaluation?.status === 'possible' ? 'possible' : evaluation ? 'no_match' : 'analyzing',
          sourceId: completedCapture.sourceId,
          questId: completedCapture.questId,
          creatureId: completedCapture.creatureId,
          evidenceId: evaluation?.evidenceId ?? null,
          reason: evaluation?.reason ?? null,
          sourceType: completedCapture.sourceType,
        });
        if (evaluation?.status === 'possible' || evaluation?.status === 'no_match') {
          const requested = evaluation.requestedLabel?.toLowerCase() ?? 'the detail this quest needs';
          setQuestResultNotice({
            kind: evaluation.status,
            title: evaluation.status === 'possible' ? 'This might count' : 'Not a clear match yet',
            message: evaluation.status === 'possible'
              ? `Your photo may show ${requested}. Review it in the quest before submitting.`
              : `Your photo was saved, but it does not clearly show ${requested}. You can try another photo.`,
            thumbnailUri: completedCapture.sourceId,
            questId: completedCapture.questId,
            creatureId: completedCapture.creatureId,
          });
        }
      }
    }, [creatureById, residentById])
  );

  useEffect(() => {
    if (!microcopy) return;
    const timeout = setTimeout(() => setMicrocopy(null), 2300);
    return () => clearTimeout(timeout);
  }, [microcopy]);

  const conversationJournalDays = useMemo(() => storedHomeState ? [
    ...storedHomeState.archivedDays,
    storedHomeState.today,
    ...(storedHomeState.tomorrow ? [storedHomeState.tomorrow] : []),
  ] : [], [storedHomeState]);
  useEffect(() => {
    setCompanionContentState((current) => {
      const next = reconcileConversationJournalSignals(current, conversationJournalDays);
      if (next !== current) saveCompanionContentState(next);
      return next;
    });
  }, [conversationJournalDays]);

  useEffect(() => {
    setCompanionJourneyState((current) => {
      const next = syncJourneyQuestCompletions(current, companionQuestState.quests);
      if (next === current) return current;
      saveCompanionJourneyState(next);
      return next;
    });
  }, [companionQuestState.quests]);

  const companionDataByCreatureId = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof companionUnit> & {
        archetype: string;
        subtype: string;
      }
    >();
    for (const creature of kingdom.creatures) {
      if (map.has(creature.creatureId)) continue;
      const fallback = `${creature.name} ${creature.visualKey}`;
      const archetype = archetypeForCreature(creature.creatureId, fallback);
      const subtype = subtypeForCreature(creature.creatureId, fallback);
      const unit = companionUnit(archetype, kingdom, subtype, creature.visualKey);
      map.set(creature.creatureId, {
        ...unit,
        questOptions: unit.questOptions?.filter((offer) => releasedQuestOption(offer.id)),
        archetype,
        subtype,
      });
    }
    return map;
  }, [kingdom]);

  // Quests accepted before interactive experiences existed have no offerSeed.
  // Upgrade launch companions with an interactive family once, so an old
  // quest cannot permanently hide the new experience UI on an existing profile.
  useEffect(() => {
    let repairedState = companionQuestState;
    for (const [creatureId, data] of companionDataByCreatureId) {
      repairedState = reconcileActiveQuestPool(
        repairedState,
        creatureId,
        data.questOptions ?? []
      );
    }
    let changed = repairedState !== companionQuestState;
    const quests = repairedState.quests.map((quest) => {
      const activeDefinition = !quest.completedAt ? questDefinition(quest.questId) : null;
      const data = !quest.completedAt ? companionDataByCreatureId.get(quest.creatureId) : null;
      const progressionSensitive = activeDefinition?.execution?.kind === 'block_jam' || activeDefinition?.execution?.kind === 'word_connect';
      if (!quest.completedAt && progressionSensitive) {
        const dayId = quest.acceptedDayId ?? today?.isoDate ?? 'today';
        const expectedConfig = resolveInteractiveConfig(
          activeDefinition,
          companionQuestState,
          quest.creatureId,
          quest.questId,
          quest.offerSeed ?? `${quest.creatureId}:${dayId}:${quest.questId}`,
        );
        const staleBlockJam = activeDefinition.execution?.kind === 'block_jam' && (
          quest.resolvedConfig?.rulesetId !== 'tasklet-desk-jam-v2' ||
          quest.resolvedConfig?.levelId !== expectedConfig?.levelId ||
          quest.resolvedConfig?.timeLimitMs !== expectedConfig?.timeLimitMs
        );
        const staleWordPaths = activeDefinition.execution?.kind === 'word_connect' && quest.resolvedConfig?.puzzleId !== expectedConfig?.puzzleId;
        if (staleBlockJam || staleWordPaths) {
          changed = true;
          return { ...quest, repairedAt: Date.now(), resolvedConfig: expectedConfig };
        }
      }
      if (quest.completedAt || quest.offerSeed) return quest;
      const creature = creatureById.get(quest.creatureId);
      const key = creature?.visualKey?.toLowerCase();
      if (!creature || !data || !key || !['bedrotte', 'steppling', 'flickerbun', 'pagelet', 'mossprout', 'skylo', 'gatherglow', 'feastle', 'tasklet', 'relicoon', 'encora'].includes(key)) return quest;
      const interactive = data.questOptions?.find((offer) => isInteractiveExecution(questDefinition(offer.id)?.execution));
      if (!interactive || interactive.id === quest.questId) return quest;
      const definition = questDefinition(interactive.id);
      const dayId = quest.acceptedDayId ?? today?.isoDate ?? 'today';
      changed = true;
      return {
        ...quest,
        questId: interactive.id,
        title: interactive.title,
        hint: interactive.hint,
        repairedAt: Date.now(),
        repairedFromQuestId: quest.questId,
        offerSeed: `${quest.creatureId}:${dayId}:${interactive.id}`,
        resolvedConfig: resolveInteractiveConfig(definition, companionQuestState, quest.creatureId, interactive.id, `${quest.creatureId}:${dayId}:${interactive.id}`),
      };
    });
    if (changed) {
      const next = { ...companionQuestState, quests };
      saveCompanionQuests(next);
      setCompanionQuestState(next);
    }
  }, [companionDataByCreatureId, companionQuestState, creatureById, today?.isoDate]);

  const residentStatusGlyphs = useMemo(() => {
    const glyphs: Partial<Record<string, 'offer' | 'active' | 'ready'>> = {};
    for (const creature of kingdom.creatures) {
      const offers = companionDataByCreatureId.get(creature.creatureId)?.questOptions ?? [];
      const hasOffer = Boolean(
        today?.isoDate && offers.some((offer) => canAcceptQuestForDay(
          companionQuestState,
          creature.creatureId,
          offer.id,
          today.isoDate
        ))
      );
      const state = interactionState(companionQuestState, creature.creatureId, questFacts, hasOffer, questCapabilities);
      if (state !== 'idle') glyphs[creature.creatureId] = state;
    }
    return glyphs;
  }, [companionDataByCreatureId, companionQuestState, kingdom.creatures, questCapabilities, questFacts, today?.isoDate]);

  const selectedCompanionData = selectedResident
    ? companionDataByCreatureId.get(selectedResident.creature.creatureId)
    : null;
  const selectedFamilyId = selectedResident?.creature.familyId ?? null;
  const selectedRole = selectedFamilyId ? katchimeraRoleByFamilyId.get(selectedFamilyId) ?? null : null;
  const selectedJourneyDefinition = selectedFamilyId ? companionJourneyByFamilyId.get(selectedFamilyId) ?? null : null;
  const selectedIntroductionDefinition = selectedFamilyId
    ? companionIntroductionByFamilyId.get(selectedFamilyId) ?? null
    : null;
  const selectedIntroduction = selectedFamilyId
    ? introductionForFamily(companionContentState, selectedFamilyId)
    : null;
  const selectedJourneyGoals = useMemo(
    () => selectedFamilyId ? goalsForJourneyFamily(companionJourneyState, selectedFamilyId) : [],
    [companionJourneyState, selectedFamilyId]
  );
  const selectedJourneyConversation = useMemo(
    () => selectedFamilyId ? activeConversationForFamily(companionJourneyState, selectedFamilyId) : null,
    [companionJourneyState, selectedFamilyId]
  );
  const selectedJourneyNode = useMemo(
    () => currentJourneyConversationNode(selectedJourneyConversation),
    [selectedJourneyConversation]
  );
  const selectedJourneyProgress = useMemo(() => {
    if (!selectedFamilyId) return null;
    const goal = primaryGoalForFamily(companionJourneyState, selectedFamilyId);
    return goal ? journeyProgressForGoal(companionJourneyState, goal) : null;
  }, [companionJourneyState, selectedFamilyId]);
  const selectedJourneyCheckIn = useMemo(
    () => selectedResident && today?.isoDate
      ? checkInForDay(companionJourneyState, selectedResident.creature.creatureId, today.isoDate)
      : null,
    [companionJourneyState, selectedResident, today?.isoDate]
  );
  const selectedJourneyMomentLoggedToday = useMemo(
    () => Boolean(
      today?.isoDate &&
      selectedJourneyProgress &&
      hasJourneyMomentForDay(companionJourneyState, selectedJourneyProgress.goal.id, today.isoDate)
    ),
    [companionJourneyState, selectedJourneyProgress, today?.isoDate]
  );
  const selectedBondProgress = useMemo(
    () => companionBondProgress(companionBondState, selectedResident?.creature.creatureId ?? ''),
    [companionBondState, selectedResident?.creature.creatureId]
  );
  const selectedHasRelationshipHistory = Boolean(
    selectedBondProgress.totalPoints > COMPANION_BOND_REWARDS.hatch
    || selectedJourneyGoals.length > 0
    || selectedJourneyConversation
    || (selectedFamilyId && answersForCompanion(companionDiscoveryState, selectedFamilyId).length > 0)
    || (selectedFamilyId && companionContentState.events.some((event) =>
      event.familyId === selectedFamilyId && event.kind !== 'shown'))
  );
  const selectedIntroductionShouldAutoOpen = Boolean(
    selectedResident
    && selectedJourneyDefinition
    && selectedIntroductionDefinition
    && !selectedIntroduction
    && !selectedHasRelationshipHistory
    && !selectedResident.destination
    && selectedFamilyId !== 'mossprout'
  );
  useEffect(() => {
    if (!selectedResident || !selectedFamilyId || !today?.isoDate) return;
    const skinId = selectedResident.creature.skinId ?? selectedResident.creature.visualKey;
    const visitKey = `${selectedResident.creature.creatureId}:${skinId}:${today.isoDate}`;
    if (recordedVisitKeyRef.current === visitKey) return;
    recordedVisitKeyRef.current = visitKey;
    setCompanionContentState((current) => {
      const migrated = migrateCompanionIntroduction(current, {
        companionId: selectedResident.creature.creatureId,
        familyId: selectedFamilyId,
        hasExistingRelationship: selectedHasRelationshipHistory,
      });
      const visit = recordCompanionVisit(migrated, {
        companionId: selectedResident.creature.creatureId,
        familyId: selectedFamilyId,
        skinId,
        dayId: today.isoDate,
        returnAfterDays: 14,
      });
      setSelectedVisitGreeting(visit.greeting);
      saveCompanionContentState(visit.state);
      return visit.state;
    });
  }, [companionContentState, selectedFamilyId, selectedHasRelationshipHistory, selectedResident, today?.isoDate]);
  const bondProgressForCreature = useCallback(
    (creatureId: string) => companionBondProgress(companionBondState, creatureId),
    [companionBondState]
  );
  const selectedInsight = selectedCompanionData
    ? {
        ...insightForArchetype({
        archetype: selectedCompanionData.archetype,
        text: selectedCompanionData.line,
        count: insightCount(
          selectedCompanionData.archetype,
          kingdom,
          economy.snapshot.activePlus || !storedHomeState ? null : historyDaysForAccess([
            ...storedHomeState.archivedDays,
            storedHomeState.today,
            ...(storedHomeState.tomorrow ? [storedHomeState.tomorrow] : []),
          ], false),
        ),
        }),
        evidenceLabel: selectedRole
          ? `${selectedRole.insightThemes[Math.min(selectedBondProgress.level - 1, selectedRole.insightThemes.length - 1)]} · ${selectedBondProgress.label}`
          : null,
      }
    : null;
  const selectedLiveQuest = selectedResident
    ? questFor(companionQuestState, selectedResident.creature.creatureId)
    : null;
  const selectedCompletedQuestPreview = selectedResident
    && completedQuestPreview?.quest.creatureId === selectedResident.creature.creatureId
      ? completedQuestPreview
      : null;
  const selectedActiveQuest = selectedLiveQuest ?? selectedCompletedQuestPreview?.quest ?? null;
  const selectedQuestPersistedComplete = Boolean(!selectedLiveQuest && selectedCompletedQuestPreview);
  const selectedQuestRuntime = useMemo(
    () =>
      selectedActiveQuest
        ? evaluateQuestRuntime({
            questId: selectedActiveQuest.questId,
            questRunId: selectedActiveQuest.questRunId,
            day: questDay,
            facts: questFacts,
            capabilities: questCapabilities,
          })
        : null,
    [questCapabilities, questDay, questFacts, selectedActiveQuest]
  );
  const selectedQuestCaptureFeedback = useMemo(
    () => questCaptureBelongsTo(
      questCaptureFeedback,
      selectedActiveQuest?.questId,
      selectedResident?.creature.creatureId
    ) ? questCaptureFeedback : null,
    [questCaptureFeedback, selectedActiveQuest?.questId, selectedResident?.creature.creatureId]
  );
  const selectedQuestItems = useMemo(() => {
    if (selectedCompletedQuestPreview) return [selectedCompletedQuestPreview.item];
    if (!selectedActiveQuest || !selectedQuestRuntime) return [];
    if (selectedQuestRuntime.readyToSubmit || selectedQuestRuntime.possibleEvidenceIds.length > 0) {
      return buildQuestSubmissionItems(
        questDay,
        selectedQuestRuntime,
        selectedActiveQuest,
        companionQuestState.submissions,
        3,
        selectedQuestCaptureFeedback?.sourceId ?? null
      );
    }
    if (selectedQuestRuntime.complete) return buildQuestReportBackItems(questDay, selectedQuestRuntime);
    return [];
  }, [companionQuestState.submissions, questDay, selectedActiveQuest, selectedCompletedQuestPreview, selectedQuestCaptureFeedback?.sourceId, selectedQuestRuntime]);

  useEffect(() => {
    if (
      selectedQuestCaptureFeedback?.phase !== 'analyzing'
      || selectedQuestCaptureFeedback.reason === 'direct_semantic_pending'
      || !selectedQuestRuntime
    ) return;
    const timeout = setTimeout(() => {
      const capturedItem = selectedQuestItems.find((item) => item.sourceId === selectedQuestCaptureFeedback.sourceId);
      const phase: QuestCaptureFeedback['phase'] = capturedItem?.matchStatus === 'ready'
        ? 'matched'
        : capturedItem?.matchStatus === 'possible'
          ? 'possible'
          : 'no_match';
      setQuestCaptureFeedback((current) =>
        questCaptureBelongsTo(current, selectedQuestCaptureFeedback.questId, selectedQuestCaptureFeedback.creatureId) &&
        current?.sourceId === selectedQuestCaptureFeedback.sourceId
          ? { ...current, phase }
          : current
      );
    }, 450);
    return () => clearTimeout(timeout);
  }, [selectedQuestCaptureFeedback, selectedQuestItems, selectedQuestRuntime]);
  const eligibleSelectedOffers = selectedResident && selectedCompanionData?.questOptions && today?.isoDate
    ? eligibleOfferOptions(
        selectedCompanionData.questOptions,
        companionQuestState,
        selectedResident.creature.creatureId,
        selectedResident.creature.visualKey,
        selectedResident.resident.houseLevel,
        selectedBondProgress.level,
        today.isoDate
      ).filter((offer) => {
        const definition = questDefinition(offer.id);
        if (
          definition?.offerVisibility === 'hide_when_unavailable' &&
          (definition.requiresCapabilities ?? []).some((id) => {
            const status = questCapabilities[id]?.status;
            return status !== 'available' && status !== 'granted';
          })
        ) return false;
        const state = evaluateQuestRuntime({ questId: offer.id, day: questDay, facts: questFacts, capabilities: questCapabilities }).state;
        return state !== 'unavailable' && state !== 'impossible_today';
      }).map((offer) => withDailyQuestPresentationVariant(offer, {
        companionId: selectedResident.creature.creatureId,
        dayId: today.isoDate,
        questState: companionQuestState,
      }))
    : [];
  const selectedOfferOptions = selectedResident && today?.isoDate
    ? selectBalancedQuestOffers(
        questOffersForDay(
          companionQuestState,
          selectedResident.creature.creatureId,
          today.isoDate,
          eligibleSelectedOffers,
          eligibleSelectedOffers.length
        ),
        3,
        selectedFamilyId === 'pagelet'
          ? ['quest-pagelet-word-paths', 'quest-pagelet-lost-word']
          : []
      )
    : [];
  const selectedRealLifeQuestCompletedToday = Boolean(
    selectedResident
    && today?.isoDate
    && hasCompletedRealLifeQuestForDay(
      companionQuestState,
      selectedResident.creature.creatureId,
      today.isoDate
    )
  );
  const selectedActionOfferOptions = [
    ...selectedOfferOptions,
    ...eligibleSelectedOffers.filter((offer) => !selectedOfferOptions.some((selected) => selected.id === offer.id)),
  ];
  const selectedOffer =
    selectedResident &&
    selectedOfferOptions.length > 0 &&
    today?.isoDate &&
    !selectedActiveQuest
      ? selectedOfferOptions.find((offer) =>
          offer.id === selectedOfferId
          && canAcceptQuestForDay(
            companionQuestState,
            selectedResident.creature.creatureId,
            offer.id,
            today.isoDate
          )
        )
        ?? selectedOfferOptions.find((offer) => canAcceptQuestForDay(
          companionQuestState,
          selectedResident.creature.creatureId,
          offer.id,
          today.isoDate
        ))
        ?? selectedOfferOptions[0]
      : undefined;
  const selectedDailyInvitation = useMemo(() => {
    if (!selectedResident || !selectedFamilyId || !today?.isoDate) return null;
    if (isConversationV2Family(selectedFamilyId)) return null;
    const titles = Object.fromEntries(selectedOfferOptions.map((offer) => [offer.id, offer.title]));
    return selectCompanionDailyInvitation({
      state: companionContentState,
      companionId: selectedResident.creature.creatureId,
      familyId: selectedFamilyId,
      dayId: today.isoDate,
      bondLevel: selectedBondProgress.level,
      content: companionContentForFamily(selectedFamilyId),
      activeQuestId: selectedLiveQuest?.questId,
      activeConversationId: selectedJourneyConversation?.id,
      hasActiveGoal: Boolean(selectedJourneyProgress?.goal),
      hasFocusHistory: selectedJourneyGoals.some((goal) => goal.status !== 'active'),
      questCompletions: selectedJourneyProgress?.questCompletions ?? 0,
      reflections: selectedJourneyProgress?.reflections ?? 0,
      eligibleQuestIds: selectedOfferOptions
        .filter((offer) => canAcceptQuestForDay(
          companionQuestState,
          selectedResident.creature.creatureId,
          offer.id,
          today.isoDate
        ))
        .map((offer) => offer.id),
      questTitles: titles,
    });
  }, [
    companionContentState,
    companionQuestState,
    selectedBondProgress.level,
    selectedFamilyId,
    selectedJourneyConversation?.id,
    selectedJourneyProgress,
    selectedJourneyGoals,
    selectedLiveQuest?.questId,
    selectedOfferOptions,
    selectedResident,
    today?.isoDate,
  ]);
  useEffect(() => {
    if (!selectedDailyInvitation) return;
    setCompanionContentState((current) => {
      const next = ensureCompanionInvitation(current, selectedDailyInvitation);
      if (next !== current) saveCompanionContentState(next);
      return next;
    });
  }, [selectedDailyInvitation]);
  useEffect(() => {
    if (!selectedDailyInvitation || !selectedResident || !today?.isoDate) return;
    const questDone = selectedDailyInvitation.questId
      ? isQuestCompletedForDay(
          companionQuestState,
          selectedResident.creature.creatureId,
          selectedDailyInvitation.questId,
          today.isoDate
        )
      : false;
    const focusDone = selectedDailyInvitation.kind === 'resume_focus' && !selectedJourneyConversation;
    if (!questDone && !focusDone) return;
    setCompanionContentState((current) => {
      const next = updateCompanionInvitation(current, selectedDailyInvitation.id, 'completed');
      if (next !== current) saveCompanionContentState(next);
      return next;
    });
  }, [companionQuestState, selectedDailyInvitation, selectedJourneyConversation, selectedResident, today?.isoDate]);
  const selectedHistoryDays = useMemo(() => {
    if (!storedHomeState) return [];
    return historyDaysForAccess([
      ...storedHomeState.archivedDays,
      storedHomeState.today,
      ...(storedHomeState.tomorrow ? [storedHomeState.tomorrow] : []),
    ], economy.snapshot.activePlus);
  }, [economy.snapshot.activePlus, storedHomeState]);
  const selectedHasOlderHistory = Boolean(
    !economy.snapshot.activePlus
    && storedHomeState
    && storedHomeState.archivedDays.length + 1 > selectedHistoryDays.length
  );
  const selectedFriendshipProgress = useMemo(
    () => companionFriendshipProgress(companionBondState, selectedResident?.creature.creatureId ?? ''),
    [companionBondState, selectedResident?.creature.creatureId]
  );
  const selectedPendingBondCelebration = useMemo(
    () => selectedResident
      ? (companionBondState.pendingCelebrations ?? []).find(
          (receipt) => receipt.creatureId === selectedResident.creature.creatureId
        ) ?? null
      : null,
    [companionBondState.pendingCelebrations, selectedResident]
  );

  useEffect(
    () => subscribeCompanionContentResets(() => setCompanionContentState(loadCompanionContentState())),
    [],
  );
  useEffect(
    () => subscribeCompanionBondState(() => setCompanionBondState(loadIdentityAwareCompanionBondState())),
    [],
  );
  const selectedMemories = useMemo(
    () => selectedFamilyId
      ? memoriesForFamily(companionContentState, selectedFamilyId, { includeProvisional: true })
      : [],
    [companionContentState, selectedFamilyId]
  );
  const selectedInsights = useMemo(
    () => selectedFamilyId ? insightsForFamily(companionContentState, selectedFamilyId) : [],
    [companionContentState, selectedFamilyId]
  );
  useEffect(() => {
    if (!selectedFamilyId) return;
    const candidates = deriveCompanionPatternCandidates({
      familyId: selectedFamilyId,
      days: selectedHistoryDays,
      existingMemories: memoriesForFamily(companionContentState, selectedFamilyId, { includeProvisional: true, includeInactive: true }),
      fullHistory: economy.snapshot.activePlus,
    });
    if (!candidates.length) return;
    setCompanionContentState((current) => {
      const next = candidates.reduce((state, candidate) => recordCompanionVisitTelemetry(
        upsertCompanionMemory(state, candidate),
        {
          familyId: selectedFamilyId,
          dayId: today?.isoDate ?? candidate.evidenceRefs.at(-1)?.dayId ?? 'unknown',
          kind: 'memory_proposed',
          occurredAt: candidate.firstRecordedAt,
        }
      ), current);
      if (next !== current) saveCompanionContentState(next);
      return next;
    });
  }, [companionContentState, economy.snapshot.activePlus, selectedFamilyId, selectedHistoryDays, today?.isoDate]);
  const selectedVisitPlan = useMemo(() => {
    if (!selectedFamilyId || !today?.isoDate || !selectedCompanionData) return null;
    const existingPlan = visitPlanForDay(companionContentState, selectedFamilyId, today.isoDate);
    if (isConversationV2Family(selectedFamilyId) && !existingPlan) return null;
    const contentItem = selectedDailyInvitation?.contentItemId
      ? companionContentById.get(selectedDailyInvitation.contentItemId) ?? null
      : null;
    const greeting = selectedIntroductionDefinition
      ? selectedVisitGreeting === 'returning'
        ? selectedIntroductionDefinition.returnGreeting
        : selectedIntroductionDefinition.homeGreeting
      : selectedCompanionData.line;
    return buildCompanionVisitPlan({
      familyId: selectedFamilyId,
      dayId: today.isoDate,
      invitation: selectedDailyInvitation,
      contentItem,
      existingPlan,
      homeGreeting: greeting,
      provisionalMemories: selectedMemories.filter((memory) => memory.status === 'provisional'),
      activeQuestTitle: selectedLiveQuest?.title,
      activeFocusTitle: selectedJourneyProgress?.goal.title,
    });
  }, [companionContentState, selectedCompanionData, selectedDailyInvitation, selectedFamilyId, selectedIntroductionDefinition, selectedJourneyProgress?.goal.title, selectedLiveQuest?.title, selectedMemories, selectedVisitGreeting, today?.isoDate]);
  useEffect(() => {
    if (!selectedVisitPlan) return;
    setCompanionContentState((current) => {
      const next = ensureCompanionVisitPlan(current, selectedVisitPlan);
      if (next !== current) saveCompanionContentState(next);
      return next;
    });
  }, [selectedVisitPlan]);
  const selectedVisitReceipt = selectedVisitPlan
    ? receiptForVisitPlan(companionContentState, selectedVisitPlan.id)
    : null;
  const selectedConversationSession = useMemo(() => {
    if (!selectedFamilyId || !isConversationV2Family(selectedFamilyId)) return null;
    const preview = DEV_TOOLS_ENABLED
      ? previewConversationSessionForFamily(companionContentState, selectedFamilyId)
      : null;
    return preview
      ?? activeConversationSessionForFamily(companionContentState, selectedFamilyId)
      ?? [...companionContentState.conversationSessions]
        .reverse()
        .find((session) => session.familyId === selectedFamilyId && !session.preview && session.status !== 'archived')
      ?? null;
  }, [companionContentState, selectedFamilyId]);
  const selectedConversationDefinition = useMemo(() => {
    if (!selectedConversationSession) return null;
    const definition = companionConversationDefinitionById.get(selectedConversationSession.definitionId) ?? null;
    if (!definition || definition.familyId !== 'mossprout') return definition;
    return resolveMossproutCampaignConversation(
      definition,
      relationshipProgressionRepository.load().stories.mossprout,
      selectedConversationSession.turns,
    );
  }, [selectedConversationSession]);
  useEffect(() => {
    if (!selectedConversationSession || selectedConversationSession.preview || selectedConversationSession.status !== 'completed') return;
    const completedAt = selectedConversationSession.completedAt ?? selectedConversationSession.updatedAt;
    const match = /^feastle:friendship:(\d+)$/.exec(selectedConversationSession.definitionId);
    if (match) completeFeastleConversation(Number(match[1]), completedAt);
    settleMossproutConversationCompletion(selectedConversationSession, selectedConversationDefinition);
    const authoredMatch = /^(baristabbit|steppling|voyagle|flexel|bedrotte):story:(\d+)$/.exec(selectedConversationSession.definitionId);
    if (authoredMatch && isAuthoredCohortFamily(authoredMatch[1])) completeAuthoredCohortConversation(authoredMatch[1], Number(authoredMatch[2]), completedAt);
  }, [selectedConversationDefinition, selectedConversationSession]);
  const selectedConversationNode = selectedConversationDefinition?.nodes.find(
    (node) => node.id === selectedConversationSession?.currentNodeId
  ) ?? null;
  const selectedConversationQuestOffer = selectedConversationNode?.kind === 'quest_handoff'
    ? selectedConversationNode.suggestedQuestIds
        .map((questId) => eligibleSelectedOffers.find((offer) => offer.id === questId))
        .find((offer) => Boolean(offer))
      ?? (selectedConversationSession?.preview
        ? selectedConversationNode.suggestedQuestIds
            .map((questId) => questDefinition(questId))
            .find((definition) => Boolean(definition)) ?? null
        : null)
    : null;
  useEffect(() => {
    if (
      selectedConversationNode?.kind !== 'quest_handoff'
      || selectedConversationSession?.preview
      || selectedConversationQuestOffer
      || !selectedConversationSession
    ) return;
    const fallbackNode = selectedConversationDefinition?.nodes.find((node) => node.id === selectedConversationNode.fallbackNodeId);
    if (!fallbackNode) return;
    setCompanionContentState((current) => {
      const session = current.conversationSessions.find((item) => item.id === selectedConversationSession.id);
      if (!session || session.currentNodeId !== selectedConversationNode.id) return current;
      const next = upsertConversationSession(current, { ...session, currentNodeId: fallbackNode.id, updatedAt: Date.now() });
      saveCompanionContentState(next);
      return next;
    });
  }, [selectedConversationDefinition, selectedConversationNode, selectedConversationQuestOffer, selectedConversationSession]);
  useEffect(() => {
    if (!selectedConversationSession || selectedConversationSession.preview || selectedConversationSession.status !== 'active') return;
    const definition = companionConversationDefinitionById.get(selectedConversationSession.definitionId);
    if (definition && definition.version === selectedConversationSession.definitionVersion && definition.nodes.some((node) => node.id === selectedConversationSession.currentNodeId)) return;
    setCompanionContentState((current) => {
      const stale = current.conversationSessions.find((session) => session.id === selectedConversationSession.id);
      if (!stale || stale.status !== 'active') return current;
      const next = upsertConversationSession(current, { ...archiveConversationSession(stale), encounterId: undefined });
      saveCompanionContentState(next);
      return next;
    });
  }, [selectedConversationSession]);
  const selectedConversationRecommendation = useMemo(() => {
    if (!selectedFamilyId || !today?.isoDate || !selectedEncounterId || !isConversationV2Family(selectedFamilyId)) return null;
    const selection = selectConversationDefinition({
      familyId: selectedFamilyId,
      dayId: today.isoDate,
      definitions: companionConversationDefinitionsForFamily(selectedFamilyId),
      sessions: companionContentState.conversationSessions,
      signals: companionContentState.conversationSignals,
      bondLevel: selectedBondProgress.level,
      friendshipLevel: selectedFriendshipProgress.level,
      selectionSeed: selectedEncounterId,
    });
    return selection?.signal ? { definitionId: selection.definition.id, sourceKind: selection.signal.kind } : null;
  }, [companionContentState.conversationSessions, companionContentState.conversationSignals, selectedBondProgress.level, selectedEncounterId, selectedFamilyId, selectedFriendshipProgress.level, today?.isoDate]);
  const selectedMossproutActionCandidates = useMemo<MossproutActionCandidate[]>(() => {
    if (selectedFamilyId !== 'mossprout' || !selectedEncounterId || !today?.isoDate) return [];
    const allDefinitions = companionConversationDefinitionsForFamily('mossprout');
    const definitions = allDefinitions
      .filter((definition) => definition.format !== 'profile_game' || isConversationV2IdealSkinFamily('mossprout'));
    const collectPool = (poolId: string) => {
      const selected: ConversationDefinition[] = [];
      while (true) {
        const next = selectConversationFromPool({
          familyId: 'mossprout',
          poolId,
          definitions,
          sessions: companionContentState.conversationSessions,
          seed: `${selectedEncounterId}:actions:${poolId}`,
          excludeDefinitionIds: selected.map((definition) => definition.id),
          dayId: today.isoDate,
          bondLevel: selectedBondProgress.level,
          friendshipLevel: selectedFriendshipProgress.level,
        });
        if (!next) return selected;
        selected.push(next);
      }
    };
    const collectMode = (mode: ConversationMode) => {
      const selected: ConversationDefinition[] = [];
      while (true) {
        const next = selectConversationForMode({
          familyId: 'mossprout',
          mode,
          definitions,
          sessions: companionContentState.conversationSessions,
          seed: `${selectedEncounterId}:actions:${mode}`,
          excludeDefinitionIds: selected.map((definition) => definition.id),
          dayId: today.isoDate,
          bondLevel: selectedBondProgress.level,
          friendshipLevel: selectedFriendshipProgress.level,
        });
        if (!next) return selected;
        selected.push(next);
      }
    };
    const questions = collectPool('nature-question');
    const insights = collectMode('discover');
    const journals = collectPool('nature-journal');
    const focusDirection = {
      mode: 'plan' as const,
      actionKind: 'journey_focus' as const,
      definitionId: 'mossprout-nearby-nature',
      title: 'Grow a nearby-nature rhythm',
      questionCount: 3,
      label: 'Find a nature direction',
      description: 'Three practical questions, then keep up to three small ideas.',
    };
    return [
      ...questions.map((question) => ({ mode: 'talk' as const, definitionId: question.id, title: question.title, questionCount: conversationQuestionCount(question), label: question.actionTitle ?? question.title, description: 'A short garden scene—one or two choices.' })),
      ...journals.map((journal) => ({ mode: 'talk' as const, actionKind: 'journal_prompt' as const, definitionId: journal.id, title: journal.title, questionCount: conversationQuestionCount(journal), label: journal.actionTitle ?? journal.title, description: 'Two quick choices become an editable field note.' })),
      ...insights.map((insight) => ({ mode: 'discover' as const, definitionId: insight.id, title: insight.title, questionCount: conversationQuestionCount(insight), label: 'Find your outside instinct', description: 'Three questions, then a result you can keep or leave.' })),
      focusDirection,
    ];
  }, [companionContentState.conversationSessions, selectedBondProgress.level, selectedEncounterId, selectedFamilyId, selectedFriendshipProgress.level, today?.isoDate]);
  const selectedConversationStarters = useMemo(() => {
    if (!selectedFamilyId || !selectedEncounterId || !isConversationV2Family(selectedFamilyId) || !today?.isoDate) return [];
    if (selectedFamilyId === 'mossprout') {
      const question = selectedMossproutActionCandidates.find((candidate) => candidate.mode === 'talk' && !('actionKind' in candidate));
      const journal = selectedMossproutActionCandidates.find((candidate) => 'actionKind' in candidate && candidate.actionKind === 'journal_prompt');
      const insight = selectedMossproutActionCandidates.find((candidate) => candidate.mode === 'discover');
      const plan = selectedMossproutActionCandidates.find((candidate) => candidate.mode === 'plan');
      return [question, journal, insight, plan].filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
    }
    const allDefinitions = companionConversationDefinitionsForFamily(selectedFamilyId);
    const definitions = allDefinitions
      .filter((definition) => definition.format !== 'profile_game' || isConversationV2IdealSkinFamily(selectedFamilyId));
    return (['talk', 'play', 'discover', 'plan'] as const).flatMap((mode) => {
      const definition = selectConversationForMode({
        familyId: selectedFamilyId,
        mode,
        definitions,
        sessions: companionContentState.conversationSessions,
        seed: `${selectedEncounterId}:lobby:${mode}`,
        hasActiveFocus: Boolean(primaryGoalForFamily(companionJourneyState, selectedFamilyId)),
        hasActiveQuest: Boolean(selectedActiveQuest),
        dayId: today.isoDate,
        bondLevel: selectedBondProgress.level,
        friendshipLevel: selectedFriendshipProgress.level,
      });
      return definition ? [{
        mode,
        definitionId: definition.id,
        title: definition.title,
        questionCount: conversationQuestionCount(definition),
      }] : [];
    });
  }, [companionContentState.conversationSessions, companionJourneyState, selectedActiveQuest, selectedBondProgress.level, selectedEncounterId, selectedFamilyId, selectedFriendshipProgress.level, selectedMossproutActionCandidates, today?.isoDate]);
  const selectedIdealSkinDefinition = useMemo(() => {
    if (!selectedFamilyId || !isConversationV2IdealSkinFamily(selectedFamilyId)) return null;
    return companionConversationDefinitionsForFamily(selectedFamilyId)
      .find((definition) => definition.format === 'profile_game') ?? null;
  }, [selectedFamilyId]);
  const selectedIdealSkinOnboardingRequired = Boolean(
    selectedIdealSkinDefinition
    && !companionContentState.conversationSessions.some((session) =>
      !session.preview
      && session.familyId === selectedFamilyId
      && session.definitionId === selectedIdealSkinDefinition.id
      && Boolean(session.formResult)
      && session.currentNodeId !== selectedIdealSkinDefinition.entryNodeId
    )
  );
  const selectedQuestAdvancesJourneyGoal = useMemo(() => {
    const goal = selectedJourneyProgress?.goal;
    const currentQuestId = selectedActiveQuest?.questId ?? selectedOffer?.id;
    const definition = currentQuestId ? questDefinition(currentQuestId) : null;
    const contribution = definition?.goalContribution;
    if (!goal || !contribution || definition?.familyId !== goal.familyId) return false;
    return !contribution.goalTypeIds?.length || contribution.goalTypeIds.includes(goal.goalTypeId);
  }, [selectedActiveQuest?.questId, selectedJourneyProgress, selectedOffer?.id]);
  const selectedInteractionState = selectedResident
    ? interactionState(
        companionQuestState,
        selectedResident.creature.creatureId,
        questFacts,
        Boolean(selectedOffer),
        questCapabilities
      )
    : 'idle';

  const commitCompanionQuestState = useCallback((next: CompanionQuestState) => {
    saveCompanionQuests(next);
    setCompanionQuestState(next);
  }, []);
  const awardBond = useCallback((event: { id: string; creatureId: string; kind: CompanionBondEventKind; points?: number; occurredAt: number; dayId?: string | null }) => {
    const current = loadIdentityAwareCompanionBondState();
    const result = recordCompanionBondEvent(current, event, { queueCelebration: true });
    if (result.awarded) saveCompanionBondState(result.state);
    setCompanionBondState(result.state);
  }, []);
  const refreshQuestState = useCallback(() => {
    setCompanionQuestState(loadIdentityAwareCompanionQuests());
    const nextHomeState = homeRepository.load();
    setStoredHomeState(nextHomeState);
    const resolveCompanionId = companionIdResolverForHomeState(nextHomeState);
    const nextQuestState = loadCompanionQuests(resolveCompanionId);
    setCompanionBondState(loadCompanionBondState(nextQuestState, resolveCompanionId, nextHomeState));
  }, []);

  // A clear quest-camera match is authoritative and auto-submits the exact
  // captured source. Keep the companion sheet open and surface the result so
  // completion is never a silent navigation change.
  useEffect(() => {
    if (questCaptureFeedback?.phase !== 'matched' || !questCaptureFeedback.creatureId) return;
    const capturedItem = selectedQuestItems.find(
      (item) => item.sourceId === questCaptureFeedback.sourceId && item.matchStatus === 'ready'
    ) ?? captureSubmissionItem(questCaptureFeedback);
    const latest = loadIdentityAwareCompanionQuests();
    const completingQuest = questFor(latest, questCaptureFeedback.creatureId);
    const result = submitQuest(
      latest,
      questCaptureFeedback.creatureId,
      {
        sourceType: questCaptureFeedback.sourceType ?? 'photo',
        sourceId: questCaptureFeedback.sourceId,
        evidenceId: questCaptureFeedback.evidenceId ?? capturedItem.evidenceId ?? null,
        verificationSource: 'vision',
      },
      Date.now(),
      today?.isoDate ?? null
    );
    commitCompanionQuestState(result.state);
    if (result.submitted && completingQuest) awardBond({
      id: result.state.submissions.at(-1)?.id
        ? `quest-submission:${result.state.submissions.at(-1)!.id}`
        : questBondEventId(completingQuest.creatureId, completingQuest.questId, completingQuest.acceptedAt),
      creatureId: completingQuest.creatureId,
      kind: questBondEventKind(questDefinition(completingQuest.questId)),
      points: questBondPoints(completingQuest.questId),
      occurredAt: result.quest?.completedAt ?? Date.now(),
      dayId: result.quest?.completedDayId,
    });
    const completedQuest = result.quest?.completedAt
      ? result.quest
      : latest.quests.find((quest) =>
          quest.creatureId === questCaptureFeedback.creatureId
          && quest.questId === questCaptureFeedback.questId
          && Boolean(quest.completedAt)
        ) ?? null;
    if (completedQuest) {
      setCompletedQuestPreview({ quest: completedQuest, item: capturedItem });
      setQuestResultNotice({
        kind: 'success',
        title: 'Quest complete',
        message: `Your photo matched “${completedQuest.title}” and has been submitted.`,
        thumbnailUri: capturedItem.thumbnailUri ?? questCaptureFeedback.sourceId,
        questId: completedQuest.questId,
        creatureId: completedQuest.creatureId,
      });
      setMicrocopy('Photo matched - quest complete');
      if (result.submitted && process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setQuestResultNotice({
        kind: 'no_match',
        title: 'Photo matched, but was not submitted',
        message: 'The photo is still attached to this quest. Return to the quest and tap Submit quest to finish.',
        thumbnailUri: capturedItem.thumbnailUri ?? questCaptureFeedback.sourceId,
        questId: questCaptureFeedback.questId ?? '',
        creatureId: questCaptureFeedback.creatureId,
      });
      setMicrocopy('Photo ready to submit');
    }
    setQuestCaptureFeedback(null);
  }, [awardBond, commitCompanionQuestState, questCaptureFeedback, selectedQuestItems, today?.isoDate]);

  const selectResident = useCallback(
    (creatureId: string) => {
      const resident = residentById.get(creatureId);
      const creature = creatureById.get(creatureId);
      if (resident && creature) {
        setCompletedQuestPreview(null);
        // The dedicated companion route may race this initial selection with a
        // just-completed camera return. Never replace the restored quest
        // destination with the same creature's generic home destination.
        setSelectedResident((current) =>
          current?.creature.creatureId === creatureId
            ? current
            : { resident, creature, destination: null }
        );
        setSelectedOfferId(null);
        setSelectedEncounterId(`encounter:${creatureId}:${Date.now()}`);
      }
    },
    [creatureById, residentById]
  );

  const acceptSelectedQuest = useCallback((offerId?: string, options?: { openDestination?: boolean }) => {
    if (!selectedResident) return false;
    const offer = selectedOfferOptions.find((item) => item.id === offerId)
      ?? eligibleSelectedOffers.find((item) => item.id === offerId)
      ?? selectedOffer;
    if (!offer) return false;
    if (
      today?.isoDate
      && !canAcceptQuestForDay(
        companionQuestState,
        selectedResident.creature.creatureId,
        offer.id,
        today.isoDate
      )
    ) {
      setMicrocopy(questDefinition(offer.id)?.lane === 'mini_game'
        ? 'Finish the active quest first'
        : 'Today’s real-life quest is already complete');
      return false;
    }
    const definition = questDefinition(offer.id);
    const offerRuntime = evaluateQuestRuntime({
      questId: offer.id,
      day: questDay,
      facts: questFacts,
      capabilities: questCapabilities,
    });
    if (offerRuntime.state === 'unavailable' || offerRuntime.state === 'impossible_today') {
      setMicrocopy(offerRuntime.userMessage);
      return false;
    }
    const seed = `${selectedResident.creature.creatureId}:${today?.isoDate ?? 'today'}:${offer.id}`;
    const resolvedConfig = resolveInteractiveConfig(
      definition,
      companionQuestState,
      selectedResident.creature.creatureId,
      offer.id,
      seed
    );
    const next = acceptQuest(
      companionQuestState,
      {
        questId: offer.id,
        creatureId: selectedResident.creature.creatureId,
        title: offer.title,
        hint: offer.hint,
        dayId: today?.isoDate ?? null,
        offerSeed: seed,
        resolvedConfig,
        presentationVariantId: offer.presentationVariantId,
      },
      Date.now()
    );
    if (!next) {
      setMicrocopy('Quest already running');
      return false;
    }
    commitCompanionQuestState(next);
    setMicrocopy('Quest started');
    if (options?.openDestination !== false) {
      setSelectedResident((current) => (current ? { ...current, destination: 'quest' } : current));
    }
    return true;
  }, [commitCompanionQuestState, companionQuestState, eligibleSelectedOffers, questCapabilities, questDay, questFacts, selectedOffer, selectedOfferOptions, selectedResident, today?.isoDate]);

  const selectOffer = useCallback((offerId: string) => {
    setSelectedOfferId(offerId);
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  }, []);

  const startSelectedQuestAttempt = useCallback((config: Record<string, unknown>): string => {
    if (!selectedResident || !selectedActiveQuest || !today?.isoDate) return '';
    const definition = questDefinition(selectedActiveQuest.questId);
    if (!isInteractiveExecution(definition?.execution)) return '';
    const result = startQuestAttempt(companionQuestState, {
      questId: selectedActiveQuest.questId,
      creatureId: selectedResident.creature.creatureId,
      dayId: today.isoDate,
      seed: selectedActiveQuest.offerSeed ?? `${selectedActiveQuest.questId}:${today.isoDate}`,
      executionKind: definition.execution.kind,
      configSnapshot: config,
    });
    commitCompanionQuestState(result.state);
    return result.attempt.id;
  }, [commitCompanionQuestState, companionQuestState, selectedActiveQuest, selectedResident, today?.isoDate]);

  const cancelSelectedQuestAttempt = useCallback((attemptId: string) => {
    const latest = loadIdentityAwareCompanionQuests();
    commitCompanionQuestState(cancelQuestAttempt(latest, attemptId));
  }, [commitCompanionQuestState]);

  const completeSelectedInteractiveQuest = useCallback((attemptId: string, result: QuestResult) => {
    if (!selectedResident || !selectedActiveQuest || !today?.isoDate) return;
    const latest = loadIdentityAwareCompanionQuests();
    commitCompanionQuestState(completeInteractiveQuest(latest, {
      attemptId,
      creatureId: selectedResident.creature.creatureId,
      result,
      dayId: today.isoDate,
    }));
    const bondKind = questBondEventKind(questDefinition(selectedActiveQuest.questId));
    awardBond({
      id: bondKind === 'mini_game_completed'
        ? `mini-game:${selectedResident.creature.creatureId}:${selectedActiveQuest.questId}:${today.isoDate}`
        : `quest-attempt:${attemptId}`,
      creatureId: selectedResident.creature.creatureId,
      kind: bondKind,
      occurredAt: Date.now(),
      dayId: today.isoDate,
    });
    setMicrocopy('Quest complete');
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [awardBond, commitCompanionQuestState, selectedActiveQuest, selectedResident, today?.isoDate]);

  const cashInSelectedQuest = useCallback((options?: { closeResident?: boolean }) => {
    if (!selectedResident || !selectedActiveQuest) return;
    const completedAt = Date.now();
    commitCompanionQuestState(
      completeQuest(companionQuestState, selectedResident.creature.creatureId, completedAt, today?.isoDate ?? null)
    );
    awardBond({
      id: questBondEventId(selectedResident.creature.creatureId, selectedActiveQuest.questId, selectedActiveQuest.acceptedAt),
      creatureId: selectedResident.creature.creatureId,
      kind: questBondEventKind(questDefinition(selectedActiveQuest.questId)),
      points: questBondPoints(selectedActiveQuest.questId),
      occurredAt: completedAt,
      dayId: today?.isoDate,
    });
    setMicrocopy('Quest complete');
    if (options?.closeResident !== false) setSelectedResident(null);
  }, [awardBond, commitCompanionQuestState, companionQuestState, selectedActiveQuest, selectedResident, today?.isoDate]);

  const chooseAnotherSelectedQuest = useCallback(() => {
    if (!selectedResident || !selectedActiveQuest) return;
    commitCompanionQuestState(
      releaseActiveQuest(companionQuestState, selectedResident.creature.creatureId)
    );
    setQuestCaptureFeedback(null);
    setCompletedQuestPreview(null);
    setSelectedOfferId(null);
    setMicrocopy('Choose another quest');
  }, [commitCompanionQuestState, companionQuestState, selectedActiveQuest, selectedResident]);

  const clarifySelectedQuestMatch = useCallback(
    (item: QuestSubmissionItem, answer: MemoryQualityScore['centrality'] | 'rejected') => {
      if (!selectedResident) return;
      if (item.matchStatus === 'possible' && item.qualityId) {
        const stored = homeRepository.load();
        if (!stored) return;
        const targetMemory = (stored.today.classifiedMemories ?? []).find((memory) => memory.sourceId === item.sourceId) ?? null;
        const confirmedMemory = targetMemory
          ? withQualityConfirmation(
              targetMemory,
              item.qualityId!,
              answer !== 'rejected',
              new Date(),
              answer === 'rejected' ? 'incidental' : answer
            )
          : null;
        const classifiedMemories = (stored.today.classifiedMemories ?? []).map((memory) =>
          memory.sourceId === item.sourceId && confirmedMemory ? confirmedMemory : memory
        );
        const existingEvidence = (stored.today.evidence ?? []).find((evidence) => evidence.sourceId === item.sourceId);
        const refreshedEvidence = confirmedMemory
          ? buildPhotoEvidence({
              sourceId: confirmedMemory.sourceId,
              observedAt: confirmedMemory.createdAt,
              thumbnailUri: existingEvidence?.thumbnailUri ?? item.thumbnailUri ?? null,
              memory: confirmedMemory,
            })
          : null;
        const updatedToday = {
          ...stored.today,
          classifiedMemories,
          evidence: refreshedEvidence
            ? upsertEvidence(stored.today.evidence, [refreshedEvidence])
            : stored.today.evidence,
        };
        const nextStored = { ...stored, today: updatedToday };
        homeRepository.save(nextStored);
        setStoredHomeState(nextStored);
        setMicrocopy(
          answer === 'primary' || answer === 'supporting'
            ? 'Match clarified - ready to submit'
            : answer === 'incidental'
              ? 'Kept as background context'
              : 'Possible match dismissed'
        );
      }
    },
    [selectedResident]
  );

  const submitSelectedQuest = useCallback(
    (item: QuestSubmissionItem) => {
      if (!selectedResident || item.matchStatus === 'possible') return;
      const result = submitQuest(
        companionQuestState,
        selectedResident.creature.creatureId,
        {
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          evidenceId: item.evidenceId,
          journalRecordId: item.sourceType === 'manual_log' && item.sourceId.startsWith('manual-')
            ? item.sourceId.slice('manual-'.length)
            : null,
          verificationSource: item.sourceType === 'manual_log'
            ? 'journal'
            : item.sourceType === 'photo'
              ? 'vision'
              : item.sourceType === 'text_note' || item.sourceType === 'voice_note'
                ? 'foundation'
                : 'legacy',
        },
        Date.now(),
        today?.isoDate ?? null
      );
      commitCompanionQuestState(result.state);
      if (result.submitted && result.quest) awardBond({
        id: result.state.submissions.at(-1)?.id
          ? `quest-submission:${result.state.submissions.at(-1)!.id}`
          : questBondEventId(result.quest.creatureId, result.quest.questId, result.quest.acceptedAt),
        creatureId: result.quest.creatureId,
        kind: questBondEventKind(questDefinition(result.quest.questId)),
        points: questBondPoints(result.quest.questId),
        occurredAt: result.quest.completedAt ?? Date.now(),
        dayId: result.quest.completedDayId,
      });
      setMicrocopy(result.submitted ? 'Quest submitted' : 'Already submitted');
      if (result.submitted && result.quest) {
        setCompletedQuestPreview({ quest: result.quest, item });
        setQuestCaptureFeedback(null);
        setQuestResultNotice({
          kind: 'success',
          title: 'Quest complete',
          message: `${item.title} was submitted for “${result.quest.title}”.`,
          thumbnailUri: item.thumbnailUri ?? null,
          questId: result.quest.questId,
          creatureId: result.quest.creatureId,
        });
      }
    },
    [awardBond, commitCompanionQuestState, companionQuestState, selectedResident, today?.isoDate]
  );

  const reportSelectedQuestJournalOutcome = useCallback((input: {
    phase: 'analyzing' | 'possible' | 'no_match';
    sourceId: string;
    sourceType: 'text_note' | 'voice_note';
    evidenceId?: string | null;
    reason?: string | null;
  }) => {
    if (!selectedResident || !selectedActiveQuest) return;
    setQuestCaptureFeedback({
      phase: input.phase,
      sourceId: input.sourceId,
      questId: selectedActiveQuest.questId,
      creatureId: selectedResident.creature.creatureId,
      evidenceId: input.evidenceId ?? null,
      reason: input.reason ?? null,
      sourceType: input.sourceType,
    });
    setMicrocopy(
      input.phase === 'analyzing'
        ? 'Checking your entry'
        : input.phase === 'possible'
          ? 'This may fit - review it first'
          : 'Saved to your journal, but it did not match this quest'
    );
  }, [selectedActiveQuest, selectedResident]);

  const performSelectedQuestAction = useCallback(() => {
    if (!selectedQuestRuntime || selectedQuestRuntime.nextAction === 'none') return;
    if (
      selectedResident &&
      (selectedQuestRuntime.nextAction === 'take_photo' || selectedQuestRuntime.nextAction === 'enable_camera')
    ) {
      beginQuestCapture(selectedQuestRuntime.questId, selectedResident.creature.creatureId, selectedActiveQuest?.questRunId);
      setQuestCaptureFeedback(null);
      // Do not retain a native companion Modal underneath the pushed camera
      // route. It can keep gesture ownership when iOS restores the Kingdom
      // screen. A committed capture reopens the correct quest sheet on focus.
      setSelectedResident(null);
      router.push({
        pathname: '/moment-capture',
        params: {
          target: 'today',
          questId: selectedQuestRuntime.questId,
          questCreatureId: selectedResident.creature.creatureId,
          questRunId: selectedActiveQuest?.questRunId,
        },
      });
      return;
    }
    const definition = questDefinition(selectedQuestRuntime.questId);
    const journalFallback = semanticQuestJournalFallbackRoute(selectedQuestRuntime.questId);
    const foundationStatus = questCapabilities.appleFoundation.status;
    const foundationAvailable = foundationStatus === 'available' || foundationStatus === 'granted';
    if (
      selectedResident &&
      definition?.semanticVerification &&
      (selectedQuestRuntime.nextAction === 'add_note' || selectedQuestRuntime.nextAction === 'record_voice')
    ) {
      if (journalFallback && !foundationAvailable) {
        requestQuestActionIntent({
          action: 'add_note',
          questId: selectedQuestRuntime.questId,
          journalRoute: journalFallback,
        });
        setSelectedResident(null);
        router.push('/today');
        return;
      } else {
        beginQuestCapture(selectedQuestRuntime.questId, selectedResident.creature.creatureId, selectedActiveQuest?.questRunId);
        setQuestCaptureFeedback(null);
      }
    }
    requestQuestActionIntent({ action: selectedQuestRuntime.nextAction, questId: selectedQuestRuntime.questId });
    setSelectedResident(null);
    router.push('/today');
  }, [questCapabilities.appleFoundation.status, router, selectedActiveQuest?.questRunId, selectedQuestRuntime, selectedResident]);

  const performSelectedInsightAction = useCallback(() => {
    const intent: CompanionNavigationIntent | undefined = selectedInsight?.action?.intent;
    if (!intent) return;
    requestCompanionNavigationIntent(intent);
    setSelectedResident(null);
    router.push('/today');
  }, [router, selectedInsight?.action?.intent]);

  const selectDestination = useCallback((destination: CompanionDestination | null) => {
    setSelectedResident((current) => (current ? { ...current, destination } : current));
  }, []);
  const closeSelectedResident = useCallback(() => {
    setSelectedResident(null);
    setSelectedEncounterId(null);
    setSelectedOfferId(null);
    setQuickGoalSuggestions(null);
    setCompletedQuestPreview(null);
    setQuestResultNotice(null);
    setQuestCaptureRestoreKey(null);
  }, []);
  const finishQuestResultNotice = useCallback(() => {
    setQuestResultNotice(null);
    setQuestCaptureFeedback(null);
    setCompletedQuestPreview(null);
    setSelectedOfferId(null);
  }, []);
  const selectedDiscoveryPrompts = useMemo(
    () => selectedFamilyId && !selectedJourneyDefinition
      ? discoveryPromptsForFamily(selectedFamilyId, selectedBondProgress.level)
      : [],
    [selectedBondProgress.level, selectedFamilyId, selectedJourneyDefinition]
  );
  const selectedDiscoveryAnswers = useMemo(
    () => selectedFamilyId
      ? answersForCompanion(companionDiscoveryState, selectedFamilyId)
      : [],
    [companionDiscoveryState, selectedFamilyId]
  );
  const answerSelectedDiscoveryPrompt = useCallback((
    prompt: CompanionDiscoveryPromptDefinition,
    value: string
  ) => {
    if (!selectedResident || prompt.familyId !== selectedResident.creature.familyId) return;
    const result = answerCompanionDiscoveryPrompt(companionDiscoveryState, prompt, value);
    saveCompanionDiscoveryState(result.state);
    setCompanionDiscoveryState(result.state);
    if (result.firstAnswer && prompt.kind === 'goal') awardBond({
      id: `goal-created-daily:${selectedResident.creature.creatureId}:${today?.isoDate ?? localDayId()}`,
      creatureId: selectedResident.creature.creatureId,
      kind: 'goal_created',
      occurredAt: Date.now(),
      dayId: today?.isoDate,
    });
    setMicrocopy('Answer remembered');
  }, [awardBond, companionDiscoveryState, selectedResident, today?.isoDate]);
  const removeSelectedDiscoveryAnswer = useCallback((promptId: string) => {
    if (!selectedFamilyId) return;
    setCompanionDiscoveryState((current) => {
      const next = removeCompanionDiscoveryAnswer(current, selectedFamilyId, promptId);
      saveCompanionDiscoveryState(next);
      return next;
    });
    setMicrocopy('Answer removed');
  }, [selectedFamilyId]);
  const setSelectedDiscoveryGoalStatus = useCallback((
    promptId: string,
    status: 'active' | 'completed' | 'paused'
  ) => {
    if (!selectedFamilyId) return;
    const existing = companionDiscoveryState.answers.find(
      (answer) => answer.familyId === selectedFamilyId && answer.promptId === promptId
    );
    setCompanionDiscoveryState((current) => {
      const next = setCompanionGoalStatus(current, selectedFamilyId, promptId, status);
      saveCompanionDiscoveryState(next);
      return next;
    });
    if (status === 'completed' && existing?.goalStatus !== 'completed' && selectedResident) awardBond({
      id: `goal_completed:${selectedResident.creature.creatureId}:discovery:${promptId}`,
      creatureId: selectedResident.creature.creatureId,
      kind: 'goal_completed',
      occurredAt: Date.now(),
      dayId: today?.isoDate,
    });
    setMicrocopy(status === 'completed' ? 'Goal completed' : 'Goal updated');
  }, [awardBond, companionDiscoveryState.answers, selectedFamilyId, selectedResident, today?.isoDate]);
  const startSelectedJourneyConversation = useCallback((preference?: CompanionIntroductionAnswer) => {
    if (!selectedFamilyId || !selectedJourneyDefinition) return;
    setCompanionJourneyState((current) => {
      const next = startJourneyConversation(
        current,
        selectedFamilyId,
        Date.now(),
        preference ? { nodeId: preference.nodeId, value: preference.optionId } : undefined
      );
      if (next !== current) saveCompanionJourneyState(next);
      return next;
    });
  }, [selectedFamilyId, selectedJourneyDefinition]);
  const deferSelectedIntroduction = useCallback((preference?: CompanionIntroductionAnswer) => {
    if (!selectedResident || !selectedFamilyId) return;
    setCompanionContentState((current) => {
      const next = deferCompanionIntroduction(current, {
        companionId: selectedResident.creature.creatureId,
        familyId: selectedFamilyId,
        preference,
      });
      saveCompanionContentState(next);
      return next;
    });
  }, [selectedFamilyId, selectedResident]);
  const completeSelectedIntroduction = useCallback((
    preference: CompanionIntroductionAnswer,
    supportStyle: CompanionSupportStyle
  ) => {
    if (!selectedResident || !selectedFamilyId) return;
    setCompanionContentState((current) => {
      const next = completeCompanionIntroduction(current, {
        companionId: selectedResident.creature.creatureId,
        familyId: selectedFamilyId,
        preference,
        supportStyle,
      });
      saveCompanionContentState(next);
      return next;
    });
  }, [selectedFamilyId, selectedResident]);
  const answerSelectedJourneyConversation = useCallback((sessionId: string, value: string) => {
    if (!selectedResident || !selectedFamilyId || !selectedJourneyDefinition) return [];
    const result = answerJourneyConversation(companionJourneyState, sessionId, value);
    if (result.state === companionJourneyState) return [];
    saveCompanionJourneyState(result.state);
    setCompanionJourneyState(result.state);
    // Journey answers remain in the goal-plan session that owns their question and
    // timeframe. They are not durable Long Memory facts.
    if (result.completed && selectedDailyInvitation) {
      setCompanionContentState((current) => {
        const next = updateCompanionInvitation(current, selectedDailyInvitation.id, 'completed');
        saveCompanionContentState(next);
        return next;
      });
    }
    if (result.completed && result.suggestedQuickGoalIds.length) {
      setQuickGoalSuggestions({
        familyId: selectedFamilyId,
        templateIds: result.suggestedQuickGoalIds,
      });
    }
    if (result.createdGoalId) {
      if (selectedFamilyId === 'mossprout' && today?.isoDate) {
        relationshipProgressionRepository.update((current) => (
          completeMossproutJourneyGoalPlan(current, today.isoDate)
        ));
        settleMossproutJourneyBond(today.isoDate);
      } else {
        awardBond({
          id: `journey-conversation:${selectedResident.creature.creatureId}:${sessionId}`,
          creatureId: selectedResident.creature.creatureId,
          kind: 'goal_created',
          occurredAt: Date.now(),
          dayId: today?.isoDate,
        });
      }
      setMicrocopy(selectedFamilyId === 'mossprout' ? 'Nature direction chosen' : 'Goal plan updated');
    }
    return result.completed ? result.suggestedQuickGoalIds : [];
  }, [awardBond, companionJourneyState, selectedDailyInvitation, selectedFamilyId, selectedJourneyDefinition, selectedResident, today?.isoDate]);
  const startSelectedJourneyCheckIn = useCallback(() => {
    if (!selectedResident || !selectedFamilyId || !today?.isoDate) return null;
    const result = startJourneyCheckIn(companionJourneyState, {
      companionId: selectedResident.creature.creatureId,
      familyId: selectedFamilyId,
      dayId: today.isoDate,
      ...(selectedDailyInvitation?.contentItemId
        ? (() => {
            const content = companionContentById.get(selectedDailyInvitation.contentItemId);
            return content ? {
              contentItemId: content.id,
              contentPrompt: content.prompt,
              contentHelperText: content.helperText,
              contentOptions: content.options,
            } : {};
          })()
        : {}),
    });
    if (result.state !== companionJourneyState) {
      saveCompanionJourneyState(result.state);
      setCompanionJourneyState(result.state);
    }
    return result.checkIn;
  }, [companionJourneyState, selectedDailyInvitation, selectedFamilyId, selectedResident, today?.isoDate]);
  const answerSelectedJourneyCheckIn = useCallback((
    checkInId: string,
    answer: Omit<CompanionJourneyCheckInAnswer, 'answeredAt'>
  ) => {
    if (!selectedResident) return null;
    const checkIn = companionJourneyState.checkIns.find((item) => item.id === checkInId) ?? null;
    if (!checkIn) return null;
    const goal = checkIn.goalId
      ? companionJourneyState.goals.find((candidate) => candidate.id === checkIn.goalId) ?? null
      : null;
    const proposedAnswers = [
      ...checkIn.answers.filter((item) => item.questionId !== answer.questionId),
      { ...answer, answeredAt: Date.now() },
    ];
    const suggestedQuickGoalIds = companionCheckInSuggestedGoalIds({
      answers: proposedAnswers,
      definition: selectedJourneyDefinition,
      goal,
    });
    const result = answerJourneyCheckIn(companionJourneyState, {
      checkInId,
      questionId: answer.questionId,
      optionId: answer.optionId,
      label: answer.label,
      suggestsTasks: answer.suggestsTasks,
      suggestedQuickGoalIds,
    });
    if (result.state !== companionJourneyState) {
      saveCompanionJourneyState(result.state);
      setCompanionJourneyState(result.state);
    }
    if (result.completedNow) {
      const sourceId = `companion-reflection:${selectedResident.creature.creatureId}:${result.checkIn?.dayId ?? today?.isoDate}`;
      awardBond({
        id: `reflection:${selectedResident.creature.creatureId}:${sourceId}`,
        creatureId: selectedResident.creature.creatureId,
        kind: 'check_in_completed',
        occurredAt: Date.now(),
        dayId: result.checkIn?.dayId ?? today?.isoDate,
      });
      setMicrocopy('Check-in complete');
      setCompanionContentState((current) => {
        let next = current;
        if (selectedDailyInvitation) {
          next = updateCompanionInvitation(next, selectedDailyInvitation.id, 'completed');
        }
        if (next !== current) saveCompanionContentState(next);
        return next;
      });
    }
    return result.checkIn;
  }, [awardBond, companionJourneyState, selectedDailyInvitation, selectedJourneyDefinition, selectedResident, today?.isoDate]);

  const openSelectedDailyInvitation = useCallback(() => {
    if (!selectedDailyInvitation) return;
    setCompanionContentState((current) => {
      const next = updateCompanionInvitation(current, selectedDailyInvitation.id, 'opened');
      if (next !== current) saveCompanionContentState(next);
      return next;
    });
    if (selectedDailyInvitation.questId) setSelectedOfferId(selectedDailyInvitation.questId);
  }, [selectedDailyInvitation]);
  const skipSelectedDailyInvitation = useCallback(() => {
    if (!selectedDailyInvitation) return;
    setCompanionContentState((current) => {
      const next = updateCompanionInvitation(current, selectedDailyInvitation.id, 'skipped');
      if (next !== current) saveCompanionContentState(next);
      return next;
    });
    setMicrocopy('Invitation left for today');
  }, [selectedDailyInvitation]);
  const respondToSelectedVisit = useCallback((response: CompanionVisitResponse) => {
    if (!selectedVisitPlan || !selectedResident || !selectedFamilyId || selectedVisitReceipt) return;
    const occurredAt = Date.now();
    const affectedMemoryIds: string[] = [];
    setCompanionContentState((current) => {
      let next = current;
      if (selectedVisitPlan.subject === 'memory_confirmation' && response.action === 'answer') {
        const memory = selectedVisitPlan.evidenceRefs.length
          ? selectedMemories.find((item) => item.status === 'provisional' && item.evidenceRefs.some((ref) =>
              selectedVisitPlan.evidenceRefs.some((planRef) => planRef.sourceType === ref.sourceType && planRef.sourceId === ref.sourceId)
            ))
          : selectedMemories.find((item) => item.status === 'provisional');
        if (memory) {
          affectedMemoryIds.push(memory.id);
          next = updateCompanionMemoryStatus(next, {
            memoryId: memory.id,
            familyId: selectedFamilyId,
            dayId: selectedVisitPlan.dayId,
            status: response.value === 'reject' ? 'rejected' : 'confirmed',
            ...(response.value === 'correct' ? { summary: `Sometimes, ${memory.summary.charAt(0).toLowerCase()}${memory.summary.slice(1)}` } : {}),
            occurredAt,
          });
        }
      }
      if (selectedVisitPlan.invitationId) {
        next = updateCompanionInvitation(
          next,
          selectedVisitPlan.invitationId,
          response.action === 'defer' ? 'skipped' : response.action === 'open_quest' ? 'opened' : 'completed',
          occurredAt
        );
      }
      if (response.action === 'defer') {
        next = recordCompanionVisitTelemetry(next, {
          familyId: selectedFamilyId,
          dayId: selectedVisitPlan.dayId,
          kind: 'visit_skipped',
          subject: selectedVisitPlan.subject,
          occurredAt,
        });
      }
      next = completeCompanionVisit(next, {
        visitPlanId: selectedVisitPlan.id,
        familyId: selectedFamilyId,
        dayId: selectedVisitPlan.dayId,
        responseIds: [response.id],
        offerOutcome: response.action === 'defer'
          ? 'deferred'
          : response.action === 'accept_quest' || response.action === 'open_focus' || response.action === 'open_quest'
            ? 'accepted'
            : undefined,
        affectedMemoryIds,
        completedAt: occurredAt,
      });
      saveCompanionContentState(next);
      return next;
    });
    if (response.action !== 'defer' && response.action !== 'stay') {
      awardBond({
        id: `conversation:${selectedResident.creature.creatureId}:${selectedVisitPlan.dayId}`,
        creatureId: selectedResident.creature.creatureId,
        kind: 'conversation_completed',
        occurredAt,
        dayId: selectedVisitPlan.dayId,
      });
    }
  }, [awardBond, selectedFamilyId, selectedMemories, selectedResident, selectedVisitPlan, selectedVisitReceipt]);
  const answerSelectedConversation = useCallback((optionId: string) => {
    if (!selectedConversationSession || !selectedConversationDefinition) return;
    const occurredAt = Date.now();
    setCompanionContentState((current) => {
      const currentSession = current.conversationSessions.find((session) => session.id === selectedConversationSession.id);
      if (!currentSession) return current;
      const revisingPendingAnswer = currentSession.pendingReply !== undefined;
      const activeNode = selectedConversationDefinition.nodes.find((node) => node.id === currentSession.currentNodeId);
      const result = answerConversation(currentSession, selectedConversationDefinition, optionId, occurredAt);
      if (result.session === currentSession) return current;
      let resolvedSession = result.session;
      if (activeNode?.kind === 'poll' && resolvedSession.pollResult) {
        resolvedSession = continueConversation(resolvedSession, selectedConversationDefinition, occurredAt);
        const selectedLabel = activeNode.options.find((option) => option.id === resolvedSession.pollResult?.selectedOptionId)?.label ?? 'Your answer';
        resolvedSession = withConversationOutcome(resolvedSession, {
          kind: 'insight',
          eyebrow: 'THE HAVEN VOTED',
          title: selectedLabel,
          message: 'A fictional poll from visitors to the Haven. Your answer is highlighted below.',
          items: activeNode.options.map((option) => `${option.id === resolvedSession.pollResult?.selectedOptionId ? 'You · ' : ''}${option.label} · ${resolvedSession.pollResult?.percentages[option.id] ?? 0}%`),
          celebrate: !resolvedSession.preview,
        }, occurredAt);
      }
      const turn = resolvedSession.turns.at(-1);
      let next = upsertConversationSession(current, resolvedSession);
      if (turn && !result.session.preview) {
        const telemetryId = `${turn.id}:answered`;
        const telemetry = {
          id: telemetryId,
          familyId: result.session.familyId,
          sessionId: result.session.id,
          definitionId: result.session.definitionId,
        kind: 'turn_answered',
        nodeId: turn.nodeId,
          optionId: turn.optionId,
          occurredAt,
        } as const;
        next = revisingPendingAnswer
          ? {
              ...next,
              conversationTelemetry: next.conversationTelemetry.map((event) => event.id === telemetryId ? telemetry : event),
            }
          : recordConversationTelemetry(next, telemetry);
      }
      if (result.completedGame && !result.session.preview) next = recordConversationTelemetry(next, {
        id: `${result.session.id}:game-completed`,
        familyId: result.session.familyId,
        sessionId: result.session.id,
        definitionId: result.session.definitionId,
        kind: 'game_completed',
        nodeId: result.session.currentNodeId,
        occurredAt,
      });
      saveCompanionContentState(next);
      return next;
    });
    const selectedNode = selectedConversationDefinition.nodes.find((node) => node.id === selectedConversationSession.currentNodeId);
    if (
      selectedNode?.kind === 'poll'
      && !selectedConversationSession.preview
      && selectedResident
      && selectedConversationDefinition.familyId !== 'mossprout'
      && conversationHasIndependentBond(selectedConversationDefinition.id, selectedConversationSession.servedDayId)
    ) awardBond({
      id: `conversation-thread:${selectedResident.creature.creatureId}:${selectedConversationDefinition.id}`,
      creatureId: selectedResident.creature.creatureId,
      kind: 'conversation_completed',
      points: independentConversationBondPoints(selectedConversationDefinition.id),
      occurredAt,
      dayId: selectedConversationSession.servedDayId,
    });
  }, [awardBond, selectedConversationDefinition, selectedConversationSession, selectedResident]);
  const continueSelectedConversation = useCallback(() => {
    if (!selectedConversationSession || !selectedConversationDefinition || !selectedResident) return;
    const occurredAt = Date.now();
    let nextSession = continueConversation(selectedConversationSession, selectedConversationDefinition, occurredAt);
    if (nextSession === selectedConversationSession) return;
    const completedNow = nextSession.status === 'completed' && selectedConversationSession.status !== 'completed';
    if (completedNow) {
      // Narrative/end-node conversations (including Pocket Expedition) return
      // immediately after this callback. Publish the durable action receipt
      // before navigation can unmount this hook; the effect below is recovery,
      // not the owner of the normal completion handoff.
      settleMossproutConversationCompletion(nextSession, selectedConversationDefinition);
    }
    let enteredNode = selectedConversationDefinition.nodes.find((node) => node.id === nextSession.currentNodeId);
    if (enteredNode?.kind === 'quest_handoff' && !nextSession.preview) {
      const availableQuest = enteredNode.suggestedQuestIds.some((questId) => eligibleSelectedOffers.some((offer) => offer.id === questId));
      if (!availableQuest) {
        const fallbackNodeId = enteredNode.fallbackNodeId;
        const fallbackNode = selectedConversationDefinition.nodes.find((node) => node.id === fallbackNodeId);
        if (fallbackNode) {
          nextSession = { ...nextSession, currentNodeId: fallbackNode.id, updatedAt: occurredAt };
          enteredNode = fallbackNode;
        }
      }
    }
    setCompanionContentState((current) => {
      let next = upsertConversationSession(current, nextSession);
      if (!nextSession.preview && enteredNode?.kind === 'insight_reveal' && selectedConversationSession.currentNodeId !== nextSession.currentNodeId) {
        next = recordConversationTelemetry(next, {
          id: `${nextSession.id}:${enteredNode.id}:revealed`,
          familyId: nextSession.familyId,
          sessionId: nextSession.id,
          definitionId: nextSession.definitionId,
          kind: 'insight_revealed',
          nodeId: enteredNode.id,
          occurredAt,
        });
      }
      if (!nextSession.preview && completedNow) {
        next = recordConversationTelemetry(next, {
          id: `${nextSession.id}:completed`,
          familyId: nextSession.familyId,
          sessionId: nextSession.id,
          definitionId: nextSession.definitionId,
          kind: 'conversation_completed',
          occurredAt,
        });
      }
      const transition = nextSession.exitTransition;
      if (nextSession.status === 'completed' && selectedConversationDefinition.isOpener && transition && transition.kind !== 'continuation') {
        const definition = transition.kind === 'definition'
          ? companionConversationDefinitionById.get(transition.definitionId) ?? null
          : selectConversationFromPool({
              familyId: nextSession.familyId,
              poolId: transition.poolId,
              definitions: companionConversationDefinitionsForFamily(nextSession.familyId),
              sessions: next.conversationSessions,
              seed: `${nextSession.id}:${transition.poolId}:${occurredAt}`,
              hasActiveFocus: Boolean(primaryGoalForFamily(companionJourneyState, nextSession.familyId)),
              hasActiveQuest: Boolean(selectedActiveQuest),
              dayId: nextSession.servedDayId,
              bondLevel: selectedBondProgress.level,
              friendshipLevel: selectedFriendshipProgress.level,
            }) ?? selectConversationFromPool({
              familyId: nextSession.familyId,
              definitions: companionConversationDefinitionsForFamily(nextSession.familyId),
              sessions: next.conversationSessions,
              seed: `${nextSession.id}:fallback:${occurredAt}`,
              hasActiveFocus: Boolean(primaryGoalForFamily(companionJourneyState, nextSession.familyId)),
              hasActiveQuest: Boolean(selectedActiveQuest),
              dayId: nextSession.servedDayId,
              bondLevel: selectedBondProgress.level,
              friendshipLevel: selectedFriendshipProgress.level,
            });
        if (definition && definition.familyId === nextSession.familyId) {
          const followUp = createConversationSession({
            definition,
            formId: nextSession.formId,
            dayId: nextSession.servedDayId,
            createdAt: occurredAt + 1,
            encounterId: nextSession.encounterId,
            encounterTargetTurns: nextSession.encounterTargetTurns,
            encounterTurns: nextSession.encounterTurns,
            evidenceRefs: nextSession.evidenceRefs,
            preview: nextSession.preview,
            actionOrigin: nextSession.actionOrigin,
            sessionId: `companion-conversation-v2:${nextSession.familyId}:${occurredAt + 1}:${next.conversationSessions.length}`,
          });
          next = upsertConversationSession(next, followUp);
          if (!followUp.preview) next = recordConversationTelemetry(next, {
            id: `${followUp.id}:started`, familyId: followUp.familyId, sessionId: followUp.id,
            definitionId: followUp.definitionId, kind: 'conversation_started', occurredAt: occurredAt + 1,
          });
        }
      }
      saveCompanionContentState(next);
      return next;
    });
    if (!nextSession.preview && completedNow && selectedConversationDefinition.familyId !== 'mossprout' && conversationHasIndependentBond(selectedConversationDefinition.id, nextSession.servedDayId)) awardBond({
      id: `conversation-thread:${selectedResident.creature.creatureId}:${selectedConversationDefinition.id}`,
      creatureId: selectedResident.creature.creatureId,
      kind: 'conversation_completed',
      points: independentConversationBondPoints(selectedConversationDefinition.id),
      occurredAt,
      dayId: nextSession.servedDayId,
    });
  }, [awardBond, companionJourneyState, eligibleSelectedOffers, selectedActiveQuest, selectedBondProgress.level, selectedConversationDefinition, selectedConversationSession, selectedFriendshipProgress.level, selectedResident]);

  const startSelectedConversation = useCallback((input: {
    definitionId?: string;
    mode?: ConversationMode;
    poolId?: string;
    recommendation?: boolean;
    actionOrigin?: KatchimeraActionOrigin;
  } = {}) => {
    if (!selectedResident || !selectedFamilyId || !isConversationV2Family(selectedFamilyId)) return;
    const occurredAt = Date.now();
    const calendarConversationDayId = today?.isoDate ?? localDayId(new Date(occurredAt));
    const conversationDayId = selectedFamilyId === 'mossprout'
      ? mossproutConversationCompletionDayId(calendarConversationDayId)
      : calendarConversationDayId;
    setCompanionContentState((current) => {
      const definitions = companionConversationDefinitionsForFamily(selectedFamilyId)
        .filter((definition) => definition.format !== 'profile_game'
          || isConversationV2IdealSkinFamily(selectedFamilyId)
          || (selectedFamilyId === 'mossprout' && input.definitionId === 'mossprout:game:form-finder'));
      const recommendation = input.recommendation ? selectConversationDefinition({
        familyId: selectedFamilyId,
        dayId: conversationDayId,
        definitions,
        sessions: current.conversationSessions,
        signals: current.conversationSignals,
        bondLevel: selectedBondProgress.level,
        friendshipLevel: selectedFriendshipProgress.level,
        selectionSeed: selectedEncounterId ?? `encounter:${selectedResident.creature.creatureId}`,
      }) : null;
      const definition = input.definitionId
        ? definitions.find((candidate) => candidate.id === input.definitionId) ?? null
        : input.mode
          ? selectConversationForMode({
              familyId: selectedFamilyId,
              mode: input.mode,
              definitions,
              sessions: current.conversationSessions,
              seed: `${selectedEncounterId ?? 'encounter'}:${input.mode}:${occurredAt}`,
              hasActiveFocus: Boolean(primaryGoalForFamily(companionJourneyState, selectedFamilyId)),
              hasActiveQuest: Boolean(selectedActiveQuest),
              dayId: conversationDayId,
              bondLevel: selectedBondProgress.level,
              friendshipLevel: selectedFriendshipProgress.level,
            })
          : recommendation?.definition ?? selectConversationFromPool({
              familyId: selectedFamilyId,
              ...(input.poolId ? { poolId: input.poolId } : {}),
              definitions,
              sessions: current.conversationSessions,
              excludeDefinitionIds: selectedConversationSession ? [selectedConversationSession.definitionId] : [],
              seed: `${selectedEncounterId ?? 'encounter'}:${input.poolId ?? 'anything'}:${occurredAt}:${current.conversationSessions.length}`,
              hasActiveFocus: Boolean(primaryGoalForFamily(companionJourneyState, selectedFamilyId)),
              hasActiveQuest: Boolean(selectedActiveQuest),
              dayId: conversationDayId,
              bondLevel: selectedBondProgress.level,
              friendshipLevel: selectedFriendshipProgress.level,
            });
      if (!definition) return current;
      if (input.definitionId && definition.repeatPolicy === 'once_ever' && current.conversationSessions.some((session) =>
        !session.preview
        && session.familyId === selectedFamilyId
        && session.definitionId === definition.id
        && session.definitionVersion === definition.version
        && session.status === 'completed'
      )) return current;
      const existingExplicitSession = input.definitionId
        ? [...current.conversationSessions].reverse().find((session) =>
            !session.preview
            && session.familyId === selectedFamilyId
            && session.definitionId === definition.id
            && session.definitionVersion === definition.version
            && session.status === 'active'
            && definition.nodes.some((node) => node.id === session.currentNodeId)
          )
        : null;
      if (existingExplicitSession) {
        if (!input.actionOrigin || existingExplicitSession.actionOrigin?.instanceId === input.actionOrigin.instanceId) return current;
        const next = upsertConversationSession(current, {
          ...existingExplicitSession,
          actionOrigin: input.actionOrigin,
          updatedAt: occurredAt,
        });
        saveCompanionContentState(next);
        return next;
      }
      const signal = recommendation?.definition.id === definition.id ? recommendation.signal : null;
      const encounterId = `${selectedEncounterId ?? `encounter:${selectedResident.creature.creatureId}`}:${occurredAt}`;
      const session = createConversationSession({
        definition,
        formId: (selectedResident.creature.skinId ?? selectedResident.creature.visualKey) as KatchimeraSkinId,
        dayId: conversationDayId,
        evidenceRefs: signal ? [{
          sourceType: signal.kind === 'journal' ? 'journal' : signal.kind === 'quest_debrief' ? 'quest' : 'goal',
          sourceId: signal.sourceId,
          dayId: signal.dayId,
        }] : [],
        createdAt: occurredAt,
        encounterId,
        encounterTargetTurns: conversationTurnTarget(encounterId, definition),
        sessionId: `companion-conversation-v2:${selectedFamilyId}:${occurredAt}:${current.conversationSessions.length}`,
        actionOrigin: input.actionOrigin,
      });
      const withoutActiveThread = {
        ...current,
        conversationSessions: current.conversationSessions.map((item) => item.familyId === selectedFamilyId && item.status === 'active'
          ? archiveConversationSession(item, occurredAt)
          : item),
      };
      let next = upsertConversationSession(withoutActiveThread, session);
      if (signal) next = consumeConversationSignal(next, signal.id, occurredAt);
      next = recordConversationTelemetry(next, {
        id: `${session.id}:started`, familyId: session.familyId, sessionId: session.id,
        definitionId: session.definitionId, kind: 'conversation_started', occurredAt,
      });
      saveCompanionContentState(next);
      return next;
    });
  }, [companionJourneyState, selectedActiveQuest, selectedBondProgress.level, selectedConversationSession, selectedEncounterId, selectedFamilyId, selectedFriendshipProgress.level, selectedResident, today?.isoDate]);
  const keepTalkingSelectedConversation = useCallback((poolId?: string) => {
    startSelectedConversation(poolId ? { poolId } : {});
  }, [startSelectedConversation]);
  const retakeSelectedInsight = useCallback((definitionId: string) => {
    if (!selectedResident || !selectedFamilyId || !today?.isoDate || !isConversationV2Family(selectedFamilyId)) return;
    const definition = companionConversationDefinitionById.get(definitionId);
    if (!definition || definition.familyId !== selectedFamilyId || !['insight_game', 'profile_game'].includes(definition.format ?? '')) return;
    if (definition.format === 'profile_game' && !isConversationV2IdealSkinFamily(selectedFamilyId) && selectedFamilyId !== 'mossprout') return;
    const occurredAt = Date.now();
    setCompanionContentState((current) => {
      const session = createConversationSession({
        definition,
        formId: (selectedResident.creature.skinId ?? selectedResident.creature.visualKey) as KatchimeraSkinId,
        dayId: today.isoDate,
        createdAt: occurredAt,
        encounterId: selectedEncounterId ?? `encounter:${selectedResident.creature.creatureId}:${occurredAt}`,
        encounterTargetTurns: 5,
        sessionId: `companion-conversation-v2:${selectedFamilyId}:${occurredAt}:${current.conversationSessions.length}`,
      });
      const withoutActiveThread = {
        ...current,
        conversationSessions: current.conversationSessions.map((item) => item.familyId === selectedFamilyId && item.status === 'active'
          ? archiveConversationSession(item, occurredAt)
          : item),
      };
      let next = upsertConversationSession(withoutActiveThread, session);
      next = recordConversationTelemetry(next, {
        id: `${session.id}:started`, familyId: session.familyId, sessionId: session.id,
        definitionId: session.definitionId, kind: 'conversation_started', occurredAt,
      });
      saveCompanionContentState(next);
      return next;
    });
  }, [selectedEncounterId, selectedFamilyId, selectedResident, today?.isoDate]);
  const decideSelectedConversationMemory = useCallback((remember: boolean, summary: string) => {
    if (!selectedConversationSession || !selectedConversationDefinition || !selectedFamilyId || !selectedResident) return;
    const node = selectedConversationDefinition.nodes.find((candidate) => candidate.id === selectedConversationSession.currentNodeId);
    if (node?.kind !== 'memory_proposal') return;
    const occurredAt = Date.now();
    const formResult = selectedConversationSession.formResult;
    const formReveal = selectedConversationDefinition.nodes.find((candidate) => candidate.kind === 'form_reveal');
    const isFormInsight = Boolean(node.memoryKey.includes(':form-match') && formResult && formReveal?.kind === 'form_reveal');
    const topFormId = formResult?.topFormId;
    const topFormName = topFormId ? katchimeraSkinById.get(topFormId)?.displayName ?? topFormId : null;
    const runnerUpName = formResult?.runnerUpFormId ? katchimeraSkinById.get(formResult.runnerUpFormId)?.displayName ?? formResult.runnerUpFormId : null;
    const formSummary = topFormId && formReveal?.kind === 'form_reveal'
      ? formReveal.descriptions[topFormId] ?? summary.trim()
      : summary.trim();
    const journeyFinder = !selectedConversationSession.preview
      && selectedFamilyId === 'mossprout'
      && (selectedConversationDefinition.id === 'mossprout:game:form-finder'
        || selectedConversationDefinition.id === 'mossprout:campaign-v2:returning-pond:place-for-rain:opening')
      && ['opening', 'profile_available'].includes(
        mossproutJourneyForDay(relationshipProgressionRepository.load(), selectedConversationSession.servedDayId)?.status ?? '',
      );
    let outcomeSession = recordConversationOutcome(
      selectedConversationSession,
      `${remember ? 'memory-confirmed' : 'memory-rejected'}:${node.memoryKey}`,
      occurredAt
    );
    outcomeSession = continueConversation(outcomeSession, selectedConversationDefinition, occurredAt);
    if (remember) {
      outcomeSession = withConversationOutcome(outcomeSession, {
        kind: isFormInsight ? 'insight' : 'memory',
        eyebrow: selectedConversationSession.preview ? 'PREVIEW OUTCOME' : isFormInsight ? 'FORM INSIGHT ADDED' : 'SAVED TO LONG MEMORY',
        title: isFormInsight && topFormName ? `Your closest form: ${topFormName}` : summary.trim(),
        message: selectedConversationSession.preview
          ? `This is how the saved ${isFormInsight ? 'form insight' : 'memory'} outcome will look. Nothing was changed.`
          : isFormInsight
            ? `${formSummary} This does not unlock or equip the skin, and you can retake the game whenever your match changes.`
            : 'I will keep this with the context that helped us learn it. You can edit or forget it anytime.',
        celebrate: !selectedConversationSession.preview,
        destination: isFormInsight ? 'insight' : 'memory',
        destinationLabel: isFormInsight ? 'See all my insights' : 'See what you remember',
      }, occurredAt);
    }
    settleMossproutConversationCompletion(outcomeSession, selectedConversationDefinition);
    setCompanionContentState((current) => {
      let next = current;
      if (!selectedConversationSession.preview) next = recordConversationTelemetry(next, {
        id: `${selectedConversationSession.id}:${node.id}:proposed`,
        familyId: selectedConversationSession.familyId,
        sessionId: selectedConversationSession.id,
        definitionId: selectedConversationSession.definitionId,
        kind: 'memory_proposed',
        nodeId: node.id,
        occurredAt,
      });
      if (remember && !selectedConversationSession.preview) next = upsertCompanionMemory(next, {
        id: `companion-memory:${selectedFamilyId}:${node.memoryKey}`,
        scope: 'family',
        familyId: selectedFamilyId,
        kind: node.memoryKind ?? 'preference',
        key: node.memoryKey,
        summary: summary.trim(),
        evidenceRefs: [
          ...selectedConversationSession.evidenceRefs,
          { sourceType: 'conversation', sourceId: selectedConversationSession.id, dayId: selectedConversationSession.servedDayId },
        ],
        confidence: 1,
        status: 'confirmed',
        sensitivity: node.sensitivity,
        firstRecordedAt: occurredAt,
        lastConfirmedAt: occurredAt,
      });
      if (remember && isFormInsight && topFormId && topFormName && !selectedConversationSession.preview) next = upsertCompanionInsight(next, {
        familyId: selectedConversationSession.familyId,
        insightKey: 'form-match',
        category: 'Katchimera form',
        resultId: topFormId,
        title: `Your closest form: ${topFormName}`,
        summary: formSummary,
        emblemId: `form-match:${topFormId}`,
        supportingTraits: [
          `Closest match: ${topFormName}`,
          ...(runnerUpName ? [`Runner-up: ${runnerUpName}`] : []),
          `Based on ${selectedConversationSession.turns.filter((turn) => turn.questionId).length} choices`,
        ],
        evidenceRefs: [
          ...selectedConversationSession.evidenceRefs,
          { sourceType: 'conversation', sourceId: selectedConversationSession.id, dayId: selectedConversationSession.servedDayId },
        ],
        sourceDefinitionId: selectedConversationDefinition.id,
        sourceSessionId: selectedConversationSession.id,
        recordedAt: occurredAt,
      });
      if (!selectedConversationSession.preview) next = recordConversationTelemetry(next, {
        id: `${selectedConversationSession.id}:${node.id}:${remember ? 'confirmed' : 'rejected'}`,
        familyId: selectedConversationSession.familyId,
        sessionId: selectedConversationSession.id,
        definitionId: selectedConversationSession.definitionId,
        kind: remember ? 'memory_confirmed' : 'memory_rejected',
        nodeId: node.id,
        occurredAt,
      });
      next = upsertConversationSession(next, outcomeSession);
      if (!outcomeSession.preview && outcomeSession.status === 'completed') next = recordConversationTelemetry(next, {
        id: `${outcomeSession.id}:completed`,
        familyId: outcomeSession.familyId,
        sessionId: outcomeSession.id,
        definitionId: outcomeSession.definitionId,
        kind: 'conversation_completed',
        occurredAt,
      });
      saveCompanionContentState(next);
      return next;
    });
    if (remember && !selectedConversationSession.preview && selectedFamilyId === 'feastle') {
      recordFeastleConfirmedMemory(node.memoryKey, occurredAt);
      const signal = node.memoryKey.match(/feastle:signal:(ease|comfort|connection|curiosity)/)?.[1];
      if (signal === 'ease' || signal === 'comfort' || signal === 'connection' || signal === 'curiosity') {
        recordFeastleStorySignal(`${selectedConversationSession.id}:${node.id}`, signal, occurredAt);
      }
    }
    if (journeyFinder && topFormId) {
      relationshipProgressionRepository.update((current) => recordMossproutMatchedCard(
        current,
        selectedConversationSession.servedDayId,
        topFormId,
      ));
      void activateStoredResidentCardDiscovery('mossprout:journey', selectedConversationSession.servedDayId, topFormId, occurredAt);
    }
    if (!selectedConversationSession.preview && isFormInsight && !journeyFinder && selectedFamilyId !== 'mossprout') {
      awardBond({
        id: `ideal-skin-questionnaire:${selectedResident.creature.creatureId}`,
        creatureId: selectedResident.creature.creatureId,
        kind: 'ideal_skin_questionnaire_completed',
        occurredAt,
        dayId: selectedConversationSession.servedDayId,
      });
    } else if (!selectedConversationSession.preview && outcomeSession.status === 'completed' && selectedConversationDefinition.familyId !== 'mossprout' && conversationHasIndependentBond(selectedConversationDefinition.id, selectedConversationSession.servedDayId)) {
      awardBond({
        id: `conversation-thread:${selectedResident.creature.creatureId}:${selectedConversationDefinition.id}`,
        creatureId: selectedResident.creature.creatureId,
        kind: 'conversation_completed',
        points: independentConversationBondPoints(selectedConversationDefinition.id),
        occurredAt,
        dayId: selectedConversationSession.servedDayId,
      });
    }
    setMicrocopy(selectedConversationSession.preview
      ? 'Preview only — memory was not changed'
      : remember ? isFormInsight ? 'Form match saved to Your insights' : 'Saved to Long Memory' : 'Not remembered');
  }, [awardBond, selectedConversationDefinition, selectedConversationSession, selectedFamilyId, selectedResident]);
  const decideSelectedConversationInsight = useCallback((accept: boolean, node: Extract<ConversationNode, { kind: 'insight_reveal' }>) => {
    if (!selectedConversationSession || !selectedConversationDefinition || !selectedConversationSession.insightResult || !selectedResident) return;
    const occurredAt = Date.now();
    const result = selectedConversationSession.insightResult;
    const displayOnly = node.persistence === 'display_only';
    if (!selectedConversationSession.preview
      && selectedConversationDefinition.id === 'mossprout:ftue:chapter-zero-return') {
      const firstResidentByResult: Record<string, string> = {
        'quiet-clearing': 'fernip',
        'curious-grove': 'petalimp',
        'shared-patch': 'blossle',
      };
      const residentId = firstResidentByResult[result.resultId];
      if (residentId) relationshipProgressionRepository.update((current) => recordMossproutMatchedCard(
        current,
        selectedConversationSession.servedDayId,
        residentId,
      ));
    }
    let outcomeSession = recordConversationOutcome(selectedConversationSession, `${accept ? 'insight-confirmed' : 'insight-dismissed'}:${node.insightKey}`, occurredAt);
    outcomeSession = continueConversation(outcomeSession, selectedConversationDefinition, occurredAt);
    if (accept) {
      outcomeSession = withConversationOutcome(outcomeSession, {
        kind: 'insight',
        eyebrow: selectedConversationSession.preview ? 'PREVIEW OUTCOME' : displayOnly ? 'YOUR NATURE RESULT' : 'INSIGHT ADDED',
        title: result.title,
        message: selectedConversationSession.preview
          ? 'This is how the insight celebration will look. Nothing was saved.'
          : displayOnly
            ? result.summary
            : `${result.summary} You can revisit or update this anytime in Your insights.`,
        celebrate: !selectedConversationSession.preview,
        ...(!displayOnly ? { destination: 'insight' as const, destinationLabel: 'See all my insights' } : {}),
      }, occurredAt);
    }
    settleMossproutConversationCompletion(outcomeSession, selectedConversationDefinition);
    setCompanionContentState((current) => {
      let next = current;
      if (accept && !displayOnly && !selectedConversationSession.preview) next = upsertCompanionInsight(next, {
        familyId: selectedConversationSession.familyId,
        insightKey: result.insightKey,
        category: result.category,
        resultId: result.resultId,
        title: result.title,
        summary: result.summary,
        emblemId: result.emblemId,
        supportingTraits: [...result.supportingTraits],
        ...(result.secondaryResultId ? { secondaryResultId: result.secondaryResultId } : {}),
        ...(result.secondaryTitle ? { secondaryTitle: result.secondaryTitle } : {}),
        confidence: result.confidence,
        scoreMargin: result.scoreMargin,
        evidenceRefs: [
          ...selectedConversationSession.evidenceRefs,
          { sourceType: 'conversation', sourceId: selectedConversationSession.id, dayId: selectedConversationSession.servedDayId },
        ],
        sourceDefinitionId: selectedConversationDefinition.id,
        sourceSessionId: selectedConversationSession.id,
        recordedAt: occurredAt,
      });
      if (!selectedConversationSession.preview) next = recordConversationTelemetry(next, {
        id: `${selectedConversationSession.id}:${node.id}:${accept ? 'confirmed' : 'dismissed'}`,
        familyId: selectedConversationSession.familyId,
        sessionId: selectedConversationSession.id,
        definitionId: selectedConversationSession.definitionId,
        kind: accept ? 'insight_confirmed' : 'insight_dismissed',
        nodeId: node.id,
        occurredAt,
      });
      next = upsertConversationSession(next, outcomeSession);
      saveCompanionContentState(next);
      return next;
    });
    if (accept && !selectedConversationSession.preview && selectedFamilyId !== 'mossprout') {
      const commonReward = {
        creatureId: selectedResident.creature.creatureId,
        points: selectedFamilyId === 'mossprout' ? 4 : undefined,
        occurredAt,
        dayId: selectedConversationSession.servedDayId,
      };
      if (displayOnly) awardBond({
        ...commonReward,
        id: `conversation-thread:${selectedResident.creature.creatureId}:${selectedConversationSession.id}:${node.id}`,
        kind: 'conversation_completed',
      });
      else awardBond({
        ...commonReward,
        id: `insight-saved:${selectedResident.creature.creatureId}:${selectedConversationSession.id}:${node.id}`,
        kind: 'insight_saved',
      });
    }
  }, [awardBond, selectedConversationDefinition, selectedConversationSession, selectedFamilyId, selectedResident]);

  const removeSelectedInsight = useCallback((insightId: string) => {
    setCompanionContentState((current) => {
      const next = removeCompanionInsight(current, insightId);
      if (next !== current) saveCompanionContentState(next);
      return next;
    });
  }, []);
  const acknowledgeBondCelebration = useCallback((receiptId: string) => {
    const current = loadIdentityAwareCompanionBondState();
    const next = acknowledgeCompanionBondCelebration(current, receiptId);
    if (next !== current) saveCompanionBondState(next);
    setCompanionBondState(next);
  }, []);

  const decideSelectedConversationGoal = useCallback((selectedTemplateIds: readonly string[] | null, node: Extract<ConversationNode, { kind: 'goal_proposal' }>, addedTemplateIds: readonly string[] = []) => {
    if (!selectedConversationSession || !selectedConversationDefinition || !selectedFamilyId || !selectedResident) return;
    const occurredAt = Date.now();
    const accept = selectedTemplateIds !== null;
    let accepted = false;
    let bondGoal: { id: string; kind: 'goal_created' | 'goal_completed' } | null = null;
    if (accept && !selectedConversationSession.preview) {
      const action = node.action ?? 'create';
      const currentGoal = primaryGoalForFamily(companionJourneyState, selectedFamilyId);
      let nextJourneyState = companionJourneyState;
      if ((action === 'rename' || action === 'pause' || action === 'complete') && !currentGoal) {
        setMicrocopy('There is no current goal plan to change');
      } else if (action === 'rename' && currentGoal) {
        nextJourneyState = renameJourneyGoal(nextJourneyState, currentGoal.id, node.goalTitle, occurredAt);
        accepted = nextJourneyState !== companionJourneyState;
        setMicrocopy('Goal plan renamed');
      } else if ((action === 'pause' || action === 'complete') && currentGoal) {
        nextJourneyState = setJourneyGoalStatus(nextJourneyState, currentGoal.id, action === 'pause' ? 'paused' : 'completed', occurredAt);
        accepted = nextJourneyState !== companionJourneyState;
        if (accepted && action === 'complete') bondGoal = { id: currentGoal.id, kind: 'goal_completed' };
        setMicrocopy(action === 'pause' ? 'Goal plan paused' : 'Goal plan completed');
      } else {
        if (selectedFamilyId === 'mossprout') {
          accepted = addedTemplateIds.length > 0;
          setMicrocopy(accepted ? `${addedTemplateIds.length} nature goal${addedTemplateIds.length === 1 ? '' : 's'} added` : 'Those nature goals are already active');
        } else {
          if (action === 'replace' && currentGoal) nextJourneyState = setJourneyGoalStatus(nextJourneyState, currentGoal.id, 'paused', occurredAt);
          const result = createJourneyGoalFromProposal(nextJourneyState, {
            familyId: selectedFamilyId,
            goalTypeId: node.goalTypeId,
            title: node.goalTitle,
            suggestedQuickGoalIds: selectedTemplateIds ?? [],
            createdAt: occurredAt,
          });
          nextJourneyState = result.state;
          accepted = !result.blockedReason;
          if (accepted && result.createdGoalId) bondGoal = { id: result.createdGoalId, kind: 'goal_created' };
          if (result.blockedReason) {
            setMicrocopy(currentGoal ? 'Your goal plan was kept and the selected steps were added' : 'The goal plan could not be changed');
          } else {
            setMicrocopy(action === 'replace' && currentGoal ? 'Previous goal plan paused; new plan added' : 'Goal plan added');
          }
        }
      }
      if (accepted) {
        accepted = true;
        saveCompanionJourneyState(nextJourneyState);
        setCompanionJourneyState(nextJourneyState);
      }
    }
    if (bondGoal && selectedConversationDefinition.familyId !== 'mossprout' && conversationHasIndependentBond(selectedConversationDefinition.id, selectedConversationSession.servedDayId)) awardBond({
      id: `${bondGoal.kind}:${selectedResident.creature.creatureId}:${bondGoal.id}`,
      creatureId: selectedResident.creature.creatureId,
      kind: bondGoal.kind,
      points: selectedFamilyId === 'mossprout' ? 4 : undefined,
      occurredAt,
      dayId: today?.isoDate,
    });
    if (selectedConversationSession.preview) setMicrocopy('Preview only — goals were not changed');
    let outcomeSession = recordConversationOutcome(
      selectedConversationSession,
      `${accepted ? 'goal-accepted' : accept ? 'goal-small-step' : 'goal-declined'}:${node.goalTypeId}`,
      occurredAt
    );
    outcomeSession = continueConversation(outcomeSession, selectedConversationDefinition, occurredAt);
    if (accept && (accepted || selectedTemplateIds.length || selectedConversationSession.preview)) {
      const resultTemplateIds = addedTemplateIds.length ? addedTemplateIds : selectedTemplateIds;
      const addedTitles = resultTemplateIds
        .map((id) => companionQuickGoalTemplateById.get(id)?.title)
        .filter((title): title is string => Boolean(title));
      outcomeSession = withConversationOutcome(outcomeSession, {
        kind: 'goal',
        eyebrow: selectedConversationSession.preview ? 'PREVIEW OUTCOME' : addedTitles.length > 1 ? 'GOALS ADDED' : 'GOAL ADDED',
        title: selectedConversationSession.preview ? node.goalTitle : addedTitles.length > 1 ? `${addedTitles.length} steps are ready` : addedTitles[0] ?? node.goalTitle,
        message: selectedConversationSession.preview
          ? 'This is how the selected goals would be confirmed. Nothing was changed.'
          : accepted
            ? selectedFamilyId === 'mossprout'
              ? 'I added the nature goals you chose to Today.'
              : 'I saved the direction from our conversation and added the concrete steps you chose.'
            : 'Those goals are already on your list, so I left them as they are.',
        items: addedTitles,
        celebrate: !selectedConversationSession.preview,
        destination: 'goals',
        destinationLabel: 'View my goals',
      }, occurredAt);
    } else if (!accept) {
      outcomeSession = withConversationOutcome(outcomeSession, {
        kind: 'goal',
        eyebrow: 'NOTHING ADDED',
        title: 'Your goals stayed as they are',
        message: 'Mossprout leaves the ideas here without turning them into a commitment.',
        celebrate: false,
      }, occurredAt);
    }
    settleMossproutConversationCompletion(outcomeSession, selectedConversationDefinition);
    setCompanionContentState((current) => {
      let next = selectedConversationSession.preview ? current : recordConversationTelemetry(current, {
        id: `${selectedConversationSession.id}:${node.id}:proposed`,
        familyId: selectedConversationSession.familyId,
        sessionId: selectedConversationSession.id,
        definitionId: selectedConversationSession.definitionId,
        kind: 'goal_proposed',
        nodeId: node.id,
        occurredAt,
      });
      if (accepted && !selectedConversationSession.preview) next = recordConversationTelemetry(next, {
        id: `${selectedConversationSession.id}:${node.id}:accepted`,
        familyId: selectedConversationSession.familyId,
        sessionId: selectedConversationSession.id,
        definitionId: selectedConversationSession.definitionId,
        kind: 'goal_accepted',
        nodeId: node.id,
        occurredAt,
      });
      next = upsertConversationSession(next, outcomeSession);
      if (!outcomeSession.preview && outcomeSession.status === 'completed') next = recordConversationTelemetry(next, {
        id: `${outcomeSession.id}:completed`,
        familyId: outcomeSession.familyId,
        sessionId: outcomeSession.id,
        definitionId: outcomeSession.definitionId,
        kind: 'conversation_completed',
        occurredAt,
      });
      saveCompanionContentState(next);
      return next;
    });
  }, [awardBond, companionJourneyState, selectedConversationDefinition, selectedConversationSession, selectedFamilyId, selectedResident, today?.isoDate]);
  const decideSelectedConversationQuickGoal = useCallback((accept: boolean, added: boolean, node: Extract<ConversationNode, { kind: 'quick_goal_proposal' }>) => {
    if (!selectedConversationSession || !selectedConversationDefinition || !selectedResident) return;
    const occurredAt = Date.now();
    let outcomeSession = recordConversationOutcome(
      selectedConversationSession,
      `${accept && added ? 'quick-goal-added' : accept ? 'quick-goal-unavailable' : 'quick-goal-declined'}:${node.templateId}`,
      occurredAt
    );
    outcomeSession = continueConversation(outcomeSession, selectedConversationDefinition, occurredAt);
    if (accept) {
      outcomeSession = withConversationOutcome(outcomeSession, {
        kind: 'task',
        eyebrow: selectedConversationSession.preview
          ? 'PREVIEW OUTCOME'
          : added ? 'ADDED TO YOUR GOALS' : 'ALREADY IN YOUR GOALS',
        title: node.title,
        message: selectedConversationSession.preview
          ? 'This is how the added-task confirmation will look. Nothing was changed.'
          : added
            ? 'It is on your goals list now. Nothing else was added.'
            : 'This task is already active, so I left your list unchanged.',
        celebrate: added && !selectedConversationSession.preview,
        destination: 'goals',
        destinationLabel: 'View all goals',
      }, occurredAt);
    }
    settleMossproutConversationCompletion(outcomeSession, selectedConversationDefinition);
    setCompanionContentState((current) => {
      const next = upsertConversationSession(current, outcomeSession);
      saveCompanionContentState(next);
      return next;
    });
    setMicrocopy(selectedConversationSession.preview
      ? 'Preview only — task was not changed'
      : accept && added ? 'Task added' : accept ? 'That task is already active' : 'No task added');
    if (accept && added && !selectedConversationSession.preview && selectedConversationDefinition.familyId !== 'mossprout' && conversationHasIndependentBond(selectedConversationDefinition.id, selectedConversationSession.servedDayId)) awardBond({
      id: `goal-created-daily:${selectedResident.creature.creatureId}:${today?.isoDate ?? localDayId()}`,
      creatureId: selectedResident.creature.creatureId,
      kind: 'goal_created',
      occurredAt,
      dayId: today?.isoDate,
    });
  }, [awardBond, selectedConversationDefinition, selectedConversationSession, selectedResident, today?.isoDate]);
  const recordSelectedConversationJournalHandoffOpened = useCallback((node: Extract<ConversationNode, { kind: 'journal_handoff' }>) => {
    if (!selectedConversationSession || selectedConversationSession.currentNodeId !== node.id || selectedConversationSession.preview) return;
    const occurredAt = Date.now();
    setCompanionContentState((current) => {
      const next = recordConversationTelemetry(current, {
        id: `${selectedConversationSession.id}:${node.id}:opened`,
        familyId: selectedConversationSession.familyId,
        sessionId: selectedConversationSession.id,
        definitionId: selectedConversationSession.definitionId,
        kind: 'journal_handoff_opened',
        nodeId: node.id,
        occurredAt,
      });
      if (next !== current) saveCompanionContentState(next);
      return next;
    });
  }, [selectedConversationSession]);
  const decideSelectedConversationJournalHandoff = useCallback((
    saved: boolean,
    node: Extract<ConversationNode, { kind: 'journal_handoff' }>,
    journalRecordId: string | null = null,
  ) => {
    if (!selectedConversationSession || !selectedConversationDefinition || selectedConversationSession.currentNodeId !== node.id) return;
    const occurredAt = Date.now();
    let nextSession = recordConversationOutcome(
      selectedConversationSession,
      `journal-handoff:${saved ? 'saved' : 'skipped'}:${journalRecordId ?? node.id}`,
      occurredAt,
    );
    nextSession = continueConversation(nextSession, selectedConversationDefinition, occurredAt);
    if (
      nextSession.status === 'active'
      && conversationNode(selectedConversationDefinition, nextSession.currentNodeId)?.kind === 'end'
    ) {
      nextSession = continueConversation(nextSession, selectedConversationDefinition, occurredAt);
    }
    settleMossproutConversationCompletion(nextSession, selectedConversationDefinition);
    setCompanionContentState((current) => {
      let next = current;
      if (!selectedConversationSession.preview) next = recordConversationTelemetry(next, {
        id: `${selectedConversationSession.id}:${node.id}:${saved ? 'saved' : 'skipped'}`,
        familyId: selectedConversationSession.familyId,
        sessionId: selectedConversationSession.id,
        definitionId: selectedConversationSession.definitionId,
        kind: saved ? 'journal_handoff_saved' : 'journal_handoff_skipped',
        nodeId: node.id,
        occurredAt,
      });
      if (!nextSession.preview && nextSession.status === 'completed' && selectedConversationSession.status !== 'completed') {
        next = recordConversationTelemetry(next, {
          id: `${nextSession.id}:completed`, familyId: nextSession.familyId, sessionId: nextSession.id,
          definitionId: nextSession.definitionId, kind: 'conversation_completed', occurredAt,
        });
      }
      next = upsertConversationSession(next, nextSession);
      saveCompanionContentState(next);
      return next;
    });
    if (!selectedConversationSession.preview && selectedConversationSession.familyId === 'feastle') {
      markFeastleJournalFtue(saved ? 'saved' : 'skipped', journalRecordId, occurredAt);
    }
    if (
      !nextSession.preview
      && nextSession.status === 'completed'
      && selectedConversationSession.status !== 'completed'
      && selectedResident
      && selectedConversationDefinition.familyId !== 'mossprout'
      && conversationHasIndependentBond(selectedConversationDefinition.id, nextSession.servedDayId)
    ) awardBond({
      id: `conversation-thread:${selectedResident.creature.creatureId}:${selectedConversationDefinition.id}`,
      creatureId: selectedResident.creature.creatureId,
      kind: 'conversation_completed',
      points: independentConversationBondPoints(selectedConversationDefinition.id),
      occurredAt,
      dayId: nextSession.servedDayId,
    });
    setMicrocopy(selectedConversationSession.preview
      ? 'Preview only — journal was not changed'
      : saved
        ? selectedConversationSession.familyId === 'mossprout'
          ? 'Field note saved with Mossprout'
          : 'Saved to Today — the Pantry is restocking'
        : 'Nothing was saved');
  }, [awardBond, selectedConversationDefinition, selectedConversationSession, selectedResident]);
  const decideSelectedConversationQuestHandoff = useCallback((
    accept: boolean,
    accepted: boolean,
    node: Extract<ConversationNode, { kind: 'quest_handoff' }>,
    quest: { id: string; title: string; hint: string } | null
  ) => {
    if (!selectedConversationSession || !selectedConversationDefinition) return;
    const occurredAt = Date.now();
    let outcomeSession = recordConversationOutcome(
      selectedConversationSession,
      `${accepted ? 'quest-accepted' : accept ? 'quest-unavailable' : 'quest-declined'}:${quest?.id ?? node.id}`,
      occurredAt
    );
    outcomeSession = continueConversation(outcomeSession, selectedConversationDefinition, occurredAt);
    if (accept && quest && (accepted || selectedConversationSession.preview)) {
      outcomeSession = withConversationOutcome(outcomeSession, {
        kind: 'quest',
        eyebrow: selectedConversationSession.preview ? 'PREVIEW OUTCOME' : 'QUEST STARTED',
        title: quest.title,
        message: selectedConversationSession.preview
          ? 'This is how a started quest would be confirmed. Nothing was changed.'
          : quest.hint,
        celebrate: !selectedConversationSession.preview,
        destination: 'quest',
        destinationLabel: 'View this quest',
      }, occurredAt);
    }
    settleMossproutConversationCompletion(outcomeSession, selectedConversationDefinition);
    setCompanionContentState((current) => {
      const next = upsertConversationSession(current, outcomeSession);
      saveCompanionContentState(next);
      return next;
    });
  }, [selectedConversationDefinition, selectedConversationSession]);
  const dismissSelectedConversationOutcome = useCallback(() => {
    if (!selectedConversationSession?.outcomePresentation) return;
    const occurredAt = Date.now();
    const dismissOutcome = (session: ConversationSession) => {
      let acknowledged: ConversationSession = { ...session, outcomePresentation: undefined, updatedAt: occurredAt };
      if (selectedConversationDefinition && acknowledged.status === 'active') {
        const node = conversationNode(selectedConversationDefinition, acknowledged.currentNodeId);
        if (node?.kind === 'end') acknowledged = continueConversation(acknowledged, selectedConversationDefinition, occurredAt);
      }
      return acknowledged;
    };
    const dismissedSelectedSession = dismissOutcome(selectedConversationSession);
    setCompanionContentState((current) => {
      const session = current.conversationSessions.find((candidate) => candidate.id === selectedConversationSession.id);
      if (!session?.outcomePresentation) return current;
      const acknowledged = dismissOutcome(session);
      const next = upsertConversationSession(current, acknowledged);
      saveCompanionContentState(next);
      return next;
    });
    const feastleLevel = selectedConversationDefinition?.id.match(/^feastle:friendship:(\d+)$/)?.[1];
    if (feastleLevel) completeFeastleConversation(Number(feastleLevel));
    if (selectedConversationDefinition) {
      // Publish completion before the focused conversation route returns. A
      // post-render effect is too late when the route immediately unmounts.
      settleMossproutConversationCompletion(dismissedSelectedSession, selectedConversationDefinition);
    }
    const authoredMatch = selectedConversationDefinition?.id.match(/^(baristabbit|steppling|voyagle|flexel|bedrotte):story:(\d+)$/);
    if (authoredMatch && isAuthoredCohortFamily(authoredMatch[1])) completeAuthoredCohortConversation(authoredMatch[1], Number(authoredMatch[2]));
  }, [awardBond, selectedConversationDefinition, selectedConversationSession, selectedResident]);
  const previewSelectedConversation = useCallback((definitionId: string) => {
    if (!DEV_TOOLS_ENABLED || !selectedResident || !selectedFamilyId || !today?.isoDate || !isConversationV2Family(selectedFamilyId)) return;
    const definition = companionConversationDefinitionById.get(definitionId);
    if (!definition || definition.familyId !== selectedFamilyId) return;
    const occurredAt = Date.now();
    const preview = createConversationSession({
      definition,
      formId: (selectedResident.creature.skinId ?? selectedResident.creature.visualKey) as KatchimeraSkinId,
      dayId: today.isoDate,
      createdAt: occurredAt,
      preview: true,
      encounterTargetTurns: conversationTurnTarget(`preview:${definition.id}:${occurredAt}`, definition),
      sessionId: `companion-conversation-preview:${selectedFamilyId}:${definition.id}:${occurredAt}`,
    });
    setCompanionContentState((current) => {
      const withoutOldPreviews = {
        ...current,
        conversationSessions: current.conversationSessions.filter((session) => !(session.familyId === selectedFamilyId && session.preview)),
      };
      const next = upsertConversationSession(withoutOldPreviews, preview);
      saveCompanionContentState(next);
      return next;
    });
    setMicrocopy(`Previewing ${definition.title}`);
  }, [selectedFamilyId, selectedResident, today?.isoDate]);
  const exitSelectedConversationPreview = useCallback(() => {
    if (!DEV_TOOLS_ENABLED || !selectedFamilyId) return;
    setCompanionContentState((current) => {
      const conversationSessions = current.conversationSessions.filter((session) => !(session.familyId === selectedFamilyId && session.preview));
      if (conversationSessions.length === current.conversationSessions.length) return current;
      const next = { ...current, conversationSessions };
      saveCompanionContentState(next);
      return next;
    });
    setMicrocopy('Conversation preview closed');
  }, [selectedFamilyId]);
  const updateSelectedMemory = useCallback((input: {
    memoryId: string;
    status: 'confirmed' | 'rejected' | 'forgotten';
    summary?: string;
  }) => {
    if (!selectedFamilyId || !today?.isoDate) return;
    setCompanionContentState((current) => {
      const next = updateCompanionMemoryStatus(current, {
        ...input,
        familyId: selectedFamilyId,
        dayId: today.isoDate,
      });
      if (next !== current) saveCompanionContentState(next);
      return next;
    });
  }, [selectedFamilyId, today?.isoDate]);
  const resetSelectedCompanionMemory = useCallback(() => {
    if (!selectedFamilyId) return;
    setCompanionContentState((current) => {
      const next = resetCompanionMemory(current, selectedFamilyId);
      saveCompanionContentState(next);
      return next;
    });
    setMicrocopy('Companion memory reset');
  }, [selectedFamilyId]);
  const rememberSelectedSharedMoment = useCallback((input: { sourceId: string; summary: string }) => {
    if (!selectedFamilyId || !today?.isoDate) return;
    const summary = input.summary.trim();
    if (!summary) return;
    setCompanionContentState((current) => {
      const next = upsertCompanionMemory(current, {
        id: `companion-memory:${selectedFamilyId}:shared:${input.sourceId}`,
        scope: 'family',
        familyId: selectedFamilyId,
        kind: 'shared_moment',
        key: `shared:${input.sourceId}`,
        summary,
        evidenceRefs: [{ sourceType: 'memory', sourceId: input.sourceId, dayId: today.isoDate }],
        confidence: 1,
        status: 'confirmed',
        sensitivity: 'personal',
        firstRecordedAt: Date.now(),
        lastConfirmedAt: Date.now(),
      });
      saveCompanionContentState(next);
      return next;
    });
  }, [selectedFamilyId, today?.isoDate]);
  const recordSelectedSharedHistoryOpened = useCallback(() => {
    if (!selectedFamilyId || !today?.isoDate) return;
    setCompanionContentState((current) => {
      const next = recordCompanionVisitTelemetry(current, {
        familyId: selectedFamilyId,
        dayId: today.isoDate,
        kind: 'shared_history_opened',
        occurredAt: Date.now(),
      });
      const withPlusPrompt = selectedHasOlderHistory
        ? recordCompanionVisitTelemetry(next, {
            familyId: selectedFamilyId,
            dayId: today.isoDate,
            kind: 'plus_history_prompted',
            occurredAt: Date.now(),
          })
        : next;
      if (withPlusPrompt !== current) saveCompanionContentState(withPlusPrompt);
      return withPlusPrompt;
    });
  }, [selectedFamilyId, selectedHasOlderHistory, today?.isoDate]);
  const backSelectedJourneyCheckIn = useCallback((checkInId: string) => {
    setCompanionJourneyState((current) => {
      const next = backJourneyCheckIn(current, checkInId);
      if (next !== current) saveCompanionJourneyState(next);
      return next;
    });
  }, []);
  const editSelectedJourneyCheckIn = useCallback((checkInId: string) => {
    setCompanionJourneyState((current) => {
      const next = editJourneyCheckIn(current, checkInId);
      if (next !== current) saveCompanionJourneyState(next);
      return next;
    });
  }, []);
  const setSelectedJourneyCheckInTaskStatus = useCallback((
    checkInId: string,
    status: 'added' | 'dismissed'
  ) => {
    setCompanionJourneyState((current) => {
      const next = setJourneyCheckInTaskSuggestionStatus(current, checkInId, status);
      if (next !== current) saveCompanionJourneyState(next);
      return next;
    });
  }, []);
  const setSelectedJourneyGoalStatus = useCallback((goalId: string, status: CompanionJourneyGoalStatus) => {
    const existing = companionJourneyState.goals.find((goal) => goal.id === goalId);
    setCompanionJourneyState((current) => {
      const next = setJourneyGoalStatus(current, goalId, status);
      if (next !== current) saveCompanionJourneyState(next);
      return next;
    });
    if (status === 'completed' && existing?.status !== 'completed' && selectedResident) awardBond({
      id: `goal_completed:${selectedResident.creature.creatureId}:${goalId}`,
      creatureId: selectedResident.creature.creatureId,
      kind: 'goal_completed',
      occurredAt: Date.now(),
      dayId: today?.isoDate,
    });
    setMicrocopy(status === 'completed' ? 'Goal plan completed' : status === 'abandoned' ? 'Goal plan released' : 'Goal plan updated');
  }, [awardBond, companionJourneyState.goals, selectedResident, today?.isoDate]);
  const setSelectedPrimaryJourneyGoal = useCallback((goalId: string) => {
    setCompanionJourneyState((current) => {
      const next = setPrimaryJourneyGoal(current, goalId);
      if (next !== current) saveCompanionJourneyState(next);
      return next;
    });
    setMicrocopy('Current goal changed');
  }, []);
  const logSelectedJourneyMoment = useCallback((kindId: string, note = '') => {
    if (!selectedFamilyId) return;
    const result = recordJourneyMoment(
      companionJourneyState,
      selectedFamilyId,
      kindId,
      note,
      Date.now(),
      today?.isoDate
    );
    if (!result.recorded) {
      setMicrocopy(result.reason === 'already_recorded_today'
        ? 'Today already has a moment'
        : 'Choose a current goal first');
      return;
    }
    saveCompanionJourneyState(result.state);
    setCompanionJourneyState(result.state);
    setMicrocopy('Moment remembered');
  }, [companionJourneyState, selectedFamilyId, today?.isoDate]);
  const selectedActiveQuestDefinition = selectedActiveQuest ? questDefinition(selectedActiveQuest.questId) : null;
  const selectedFoundationAvailable = questCapabilities.appleFoundation.status === 'available' || questCapabilities.appleFoundation.status === 'granted';
  const selectedSemanticJournalFallbackActive = Boolean(
    selectedActiveQuest &&
    semanticQuestJournalFallbackRoute(selectedActiveQuest.questId) &&
    questCapabilities.appleFoundation.status !== 'available' &&
    questCapabilities.appleFoundation.status !== 'granted'
  );
  const selectedInteractiveExecution = isInteractiveExecution(selectedActiveQuestDefinition?.execution)
    ? selectedActiveQuestDefinition.execution
    : null;
  const selectedSortingItemCount = typeof selectedActiveQuest?.resolvedConfig?.itemCount === 'number'
    ? selectedActiveQuest.resolvedConfig.itemCount
    : null;
  const selectedSortingBestDurationMs = selectedActiveQuest && selectedInteractiveExecution?.kind === 'sorting'
    ? companionQuestState.attempts.reduce<number | null>((best, attempt) => {
        const result = attempt.questId === selectedActiveQuest.questId && attempt.result?.kind === 'sorting'
          ? attempt.result
          : null;
        if (!result?.success || (selectedSortingItemCount != null && result.totalItems !== selectedSortingItemCount)) return best;
        return best == null ? result.durationMs : Math.min(best, result.durationMs);
      }, null)
    : null;
  const selectedMatchingPairCount = typeof selectedActiveQuest?.resolvedConfig?.pairCount === 'number'
    ? selectedActiveQuest.resolvedConfig.pairCount
    : null;
  const selectedMatchingBestDurationMs = selectedActiveQuest && selectedInteractiveExecution?.kind === 'matching'
    ? companionQuestState.attempts.reduce<number | null>((best, attempt) => {
        const result = attempt.questId === selectedActiveQuest.questId && attempt.result?.kind === 'matching'
          ? attempt.result
          : null;
        if (!result?.success || (selectedMatchingPairCount != null && result.pairs !== selectedMatchingPairCount)) return best;
        return best == null ? result.durationMs : Math.min(best, result.durationMs);
      }, null)
    : null;
  const selectedMergeBest = selectedActiveQuest && selectedInteractiveExecution?.kind === 'merge'
    ? companionQuestState.attempts.reduce<{ movesUsed: number; durationMs: number } | null>((best, attempt) => {
        const result = attempt.questId === selectedActiveQuest.questId && attempt.result?.kind === 'merge' ? attempt.result : null;
        if (!result?.success) return best;
        if (!best || result.durationMs < best.durationMs || (result.durationMs === best.durationMs && result.movesUsed < best.movesUsed)) {
          return { movesUsed: result.movesUsed, durationMs: result.durationMs };
        }
        return best;
      }, null)
    : null;
  const selectedBlockJamBest = selectedActiveQuest && selectedInteractiveExecution?.kind === 'block_jam'
    ? companionQuestState.attempts.reduce<{ movesUsed: number; durationMs: number } | null>((best, attempt) => {
        const result = attempt.questId === selectedActiveQuest.questId && attempt.result?.kind === 'block_jam' ? attempt.result : null;
        if (!result?.success || result.rulesetId !== 'tasklet-desk-jam-v2' || result.levelId !== selectedActiveQuest.resolvedConfig?.levelId) return best;
        if (!best || result.durationMs < best.durationMs || (result.durationMs === best.durationMs && result.movesUsed < best.movesUsed)) return { movesUsed: result.movesUsed, durationMs: result.durationMs };
        return best;
      }, null)
    : null;

  return {
    acceptSelectedQuest,
    bondProgressForCreature,
    cancelSelectedQuestAttempt,
    cashInSelectedQuest,
    chooseAnotherSelectedQuest,
    closeSelectedResident,
    microcopy,
    performSelectedQuestAction,
    completeSelectedInteractiveQuest,
    selectOffer,
    questCaptureFeedback: selectedQuestCaptureFeedback,
    questCaptureRestoreKey,
    questResultNotice: selectedResident && questResultNotice?.creatureId === selectedResident.creature.creatureId
      ? questResultNotice
      : null,
    dismissQuestResultNotice: () => setQuestResultNotice(null),
    finishQuestResultNotice,
    questCriteria: selectedQuestRuntime?.progress ?? (selectedActiveQuest ? questCriteria(selectedActiveQuest.questId, questFacts) : []),
    residentStatusGlyphs,
    selectResident,
    selectDestination,
    selectedActiveQuest,
    selectedQuestPersistedComplete,
    selectedActiveQuestDefinition,
    selectedFoundationAvailable,
    selectedSemanticJournalFallbackActive,
    selectedInteractiveExecution,
    selectedCompanionData,
    selectedInsight,
    selectedInteractionState,
    selectedDailyInvitation,
    openSelectedDailyInvitation,
    skipSelectedDailyInvitation,
    selectedVisitPlan,
    selectedVisitReceipt,
    selectedConversationSession,
    selectedConversationDefinition,
    selectedConversationRecommendation,
    selectedConversationStarters,
    selectedMossproutActionCandidates,
    selectedIdealSkinDefinitionId: selectedIdealSkinDefinition?.id ?? null,
    selectedIdealSkinOnboardingRequired,
    selectedConversationQuestOffer,
    selectedMemories,
    selectedInsights,
    selectedHistoryDays,
    selectedHistoryIsPlus: economy.snapshot.activePlus,
    selectedHasOlderHistory,
    respondToSelectedVisit,
    answerSelectedConversation,
    continueSelectedConversation,
    decideSelectedConversationInsight,
    removeSelectedInsight,
    retakeSelectedInsight,
    keepTalkingSelectedConversation,
    startSelectedConversation,
    decideSelectedConversationMemory,
    decideSelectedConversationGoal,
    decideSelectedConversationQuickGoal,
    recordSelectedConversationJournalHandoffOpened,
    decideSelectedConversationJournalHandoff,
    decideSelectedConversationQuestHandoff,
    dismissSelectedConversationOutcome,
    previewSelectedConversation,
    exitSelectedConversationPreview,
    updateSelectedMemory,
    resetSelectedCompanionMemory,
    rememberSelectedSharedMoment,
    recordSelectedSharedHistoryOpened,
    selectedOffer,
    selectedOfferId: selectedOffer?.id ?? null,
    selectedOffers: sortQuestOffersByAvailability(selectedOfferOptions.map((offer, index) => {
      const definition = questDefinition(offer.id);
      const repeatable = definition?.lane === 'mini_game';
      const completedToday = Boolean(
        selectedResident
        && today?.isoDate
        && isQuestCompletedForDay(
          companionQuestState,
          selectedResident.creature.creatureId,
          offer.id,
          today.isoDate
        )
      );
      return {
        ...offer,
        bondReward: questBondPoints(offer.id),
        recommended: index === 0,
        completedToday,
        repeatable,
        availableToday: repeatable || !selectedRealLifeQuestCompletedToday,
      };
    })),
    selectedActionOffers: sortQuestOffersByAvailability(selectedActionOfferOptions.map((offer, index) => {
      const definition = questDefinition(offer.id);
      const repeatable = definition?.lane === 'mini_game';
      const completedToday = Boolean(
        selectedResident
        && today?.isoDate
        && isQuestCompletedForDay(
          companionQuestState,
          selectedResident.creature.creatureId,
          offer.id,
          today.isoDate
        )
      );
      return {
        ...offer,
        bondReward: questBondPoints(offer.id),
        recommended: index === 0,
        completedToday,
        repeatable,
        availableToday: repeatable || !selectedRealLifeQuestCompletedToday,
      };
    })),
    selectedOfferCount: selectedOfferOptions.length,
    selectedBondProgress,
    selectedPendingBondCelebration,
    acknowledgeBondCelebration,
    selectedRole,
    selectedJourneyDefinition,
    selectedIntroductionDefinition,
    selectedIntroduction,
    selectedIntroductionShouldAutoOpen,
    selectedVisitGreeting,
    selectedJourneyGoals,
    selectedJourneyConversation,
    selectedJourneyNode,
    selectedJourneyProgress,
    selectedJourneyCheckIn,
    selectedJourneyMomentLoggedToday,
    selectedQuickGoalSuggestionIds: quickGoalSuggestions?.familyId === selectedFamilyId
      ? quickGoalSuggestions.templateIds
      : [],
    dismissQuickGoalSuggestions: () => setQuickGoalSuggestions(null),
    selectedQuestAdvancesJourneyGoal,
    startSelectedJourneyConversation,
    deferSelectedIntroduction,
    completeSelectedIntroduction,
    answerSelectedJourneyConversation,
    startSelectedJourneyCheckIn,
    answerSelectedJourneyCheckIn,
    backSelectedJourneyCheckIn,
    editSelectedJourneyCheckIn,
    setSelectedJourneyCheckInTaskStatus,
    logSelectedJourneyMoment,
    setSelectedJourneyGoalStatus,
    setSelectedPrimaryJourneyGoal,
    selectedDiscoveryPrompts,
    selectedDiscoveryAnswers,
    answerSelectedDiscoveryPrompt,
    removeSelectedDiscoveryAnswer,
    setSelectedDiscoveryGoalStatus,
    recentTriviaQuestionIds: companionQuestState.attempts.flatMap((attempt) => attempt.result?.kind === 'trivia' ? attempt.result.questionIds : []).slice(-40),
    recentWordPuzzleIds: companionQuestState.attempts.flatMap((attempt) => attempt.result?.kind === 'word_game' ? [attempt.result.puzzleId] : []).slice(-30),
    recentWordPathPuzzleIds: companionQuestState.attempts.flatMap((attempt) => attempt.result?.kind === 'word_connect' ? [attempt.result.puzzleId] : []).slice(-30),
    recentSortingItemIds: companionQuestState.attempts.flatMap((attempt) => attempt.result?.kind === 'sorting' ? attempt.result.itemIds : []).slice(-40),
    selectedSortingBestDurationMs,
    selectedMatchingBestDurationMs,
    recentMatchingContentIds: companionQuestState.attempts.flatMap((attempt) => attempt.result?.kind === 'matching' ? attempt.result.contentIds : []).slice(-32),
    recentMergeOrderIds: companionQuestState.attempts.flatMap((attempt) => attempt.result?.kind === 'merge' ? attempt.result.contentIds : []).slice(-12),
    selectedMergeBest,
    recentBlockJamLevelIds: companionQuestState.attempts.flatMap((attempt) => attempt.result?.kind === 'block_jam' ? [attempt.result.levelId] : []).slice(-12),
    selectedBlockJamBest,
    selectedQuestItems,
    selectedQuestRuntime,
    selectedResident,
    clarifySelectedQuestMatch,
    reportSelectedQuestJournalOutcome,
    submitSelectedQuest,
    performSelectedInsightAction,
    refreshQuestState,
    startSelectedQuestAttempt,
  };
}

function captureSubmissionItem(feedback: QuestCaptureFeedback): QuestSubmissionItem {
  return {
    id: feedback.evidenceId ?? `photo:${feedback.sourceId}`,
    kind: 'photo',
    sourceType: feedback.sourceType ?? 'photo',
    sourceId: feedback.sourceId,
    evidenceId: feedback.evidenceId ?? `photo:${feedback.sourceId}`,
    title: 'Quest photo',
    subtitle: 'Matched privately on this device',
    thumbnailUri: feedback.sourceId,
    icon: 'photo.fill',
    accentColor: '#6B805F',
    matchStatus: 'ready',
  };
}

function eligibleOfferOptions<T extends { id: string }>(
  offers: T[],
  state: CompanionQuestState,
  creatureId: string,
  creatureKey: string,
  houseLevel: number,
  bondLevel: number,
  dayId: string
): T[] {
  return offers.filter((offer) => {
    const definition = questDefinition(offer.id);
    if (!definition) return false;
    const eligibility = definition.eligibility;
    if ((definition.minimumBondLevel ?? 1) > bondLevel) return false;
    if (eligibility?.creatureKeys?.length && !eligibility.creatureKeys.includes(creatureKey.toLowerCase())) return false;
    if ((eligibility?.minimumHomeLevel ?? 0) > houseLevel) return false;
    if (offer.id === 'quest-step-time-trial' && completedQuestCount(state.quests, 'quest-step-sprint', creatureId, state.attempts) < 1) return false;
    // Keep today's completed card in the daily list so it can render as a
    // visible green-tick state instead of disappearing after success.
    if (isQuestCompletedForDay(state, creatureId, offer.id, dayId)) return true;
    const cooldownDays = definition.repeatPolicy?.cooldownDays ?? eligibility?.cooldownDays ?? 0;
    if (!cooldownDays) return true;
    const latest = state.quests
      .filter((quest) => quest.questId === offer.id && quest.creatureId === creatureId && quest.completedDayId)
      .map((quest) => quest.completedDayId!)
      .sort()
      .at(-1);
    return !latest || dayDistance(latest, dayId) >= cooldownDays;
  });
}

function dayDistance(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00`).getTime();
  const end = new Date(`${to}T12:00:00`).getTime();
  return Math.floor((end - start) / 86_400_000);
}

function conversationTurnTarget(seed: string, definition?: ConversationDefinition): number {
  void seed;
  if (definition?.id.endsWith(':goal-discovery')) return 4;
  return 3;
}

function withConversationOutcome(
  session: ReturnType<typeof continueConversation>,
  presentation: Omit<ConversationOutcomePresentation, 'id' | 'createdAt'>,
  createdAt: number
) {
  return {
    ...session,
    outcomePresentation: {
      ...presentation,
      id: `conversation-outcome:${session.id}:${createdAt}`,
      createdAt,
    },
  };
}

function resolveInteractiveConfig(
  definition: ReturnType<typeof questDefinition>,
  state: CompanionQuestState,
  creatureId: string,
  questId: string,
  seed = `${creatureId}:${questId}`
): Record<string, unknown> | undefined {
  const completedCount = completedQuestCount(state.quests, questId, creatureId, state.attempts);
  if (definition?.execution?.kind === 'live_steps') {
    return resolveStepChallengeConfig({
      challengeId: definition.execution.challengeId,
      completedCount,
    });
  }
  if (definition?.execution?.kind === 'trivia') {
    return { packIds: definition.execution.packIds, questionCount: definition.execution.questionCount };
  }
  if (definition?.execution?.kind === 'word_game') {
    return {
      gameId: definition.execution.gameId,
      rulesetId: definition.execution.rulesetId,
      answerLength: definition.execution.answerLength,
      maxGuesses: definition.execution.maxGuesses,
      ...resolveLostWordDifficulty(completedCount),
    };
  }
  if (definition?.execution?.kind === 'word_connect') {
    const difficulty = resolveWordPathsDifficulty(completedCount);
    const recentPuzzleIds = state.attempts.flatMap((attempt) =>
      attempt.questId === questId && attempt.creatureId === creatureId && attempt.result?.kind === 'word_connect'
        ? [attempt.result.puzzleId]
        : [],
    ).slice(-30);
    const puzzle = selectWordPathPuzzle(`${seed}:round:${completedCount}`, recentPuzzleIds, difficulty.difficultyTier);
    return {
      gameId: definition.execution.gameId,
      packId: definition.execution.packId,
      rulesetId: definition.execution.rulesetId,
      ...difficulty,
      puzzleId: puzzle.id,
    };
  }
  if (definition?.execution?.kind === 'paced_breathing') return resolveBreathingConfig(completedCount);
  if (definition?.execution?.kind === 'timing_zone') return resolveTimingConfig(definition.execution.challengeId, completedCount);
  if (definition?.execution?.kind === 'pattern_memory') return resolvePatternConfig(completedCount);
  if (definition?.execution?.kind === 'sorting') return resolveSortingConfig(completedCount);
  if (definition?.execution?.kind === 'matching') return resolveMatchingConfig(completedCount);
  if (definition?.execution?.kind === 'merge') return resolveMergeConfig(completedCount);
  if (definition?.execution?.kind === 'block_jam') return resolveBlockJamConfig(
    completedCount,
    seed,
    state.attempts.flatMap((attempt) => attempt.result?.kind === 'block_jam' && attempt.result.rulesetId === 'tasklet-desk-jam-v2' ? [attempt.result.levelId] : []).slice(-12),
  );
  if (definition?.execution?.kind === 'block_blast') return {
    packId: definition.execution.packId,
    rulesetId: definition.execution.rulesetId,
    boardSize: 8,
    mode: 'endless',
  };
  if (definition?.execution?.kind === 'rhythm') return resolveRhythmConfig(completedCount);
  return undefined;
}

function insightCount(archetype: string, kingdom: KingdomState, scopedDays: readonly StoredHomeDayRecord[] | null = null): number | null {
  if (scopedDays) {
    if (archetype === 'food' || archetype === 'savour') return scopedDays.reduce((total, day) => total + (day.foodMoments?.length ?? 0), 0);
    if (archetype === 'culture') return scopedDays.reduce((total, day) => total + (day.studioMoments?.length ?? 0), 0);
    if (archetype === 'places') return scopedDays.reduce((total, day) => total + (day.confirmedPlaces?.length ?? 0), 0);
    if (archetype === 'journey' || archetype === 'active') return scopedDays.filter((day) => day.state === 'hatched').length;
    if (archetype === 'craft' || archetype === 'memory' || archetype === 'tender') return scopedDays.reduce((total, day) => total + (day.notes?.length ?? 0), 0);
  }
  if (archetype === 'food' || archetype === 'savour') return kingdom.totals.foodMoments;
  if (archetype === 'culture') return kingdom.totals.studioMoments;
  if (archetype === 'places') return kingdom.totals.places;
  if (archetype === 'journey' || archetype === 'active') return kingdom.totals.daysHatched;
  if (archetype === 'craft' || archetype === 'memory' || archetype === 'tender') return kingdom.totals.notes;
  return null;
}
