import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useQuestCapabilities } from '@/hooks/use-quest-capabilities';
import { homeRepository } from '@/storage/repositories/home-repository';
import type { HomeDayRecord, MemoryQualityScore } from '@/types/home';
import type { KingdomCreature, KingdomState } from '@/types/kingdom';
import type { CompanionNavigationIntent, CompanionThread, QuestCaptureFeedback } from '@/types/companion-interaction';
import {
  archetypeForCreature,
  companionUnit,
  subtypeForCreature,
} from '@/utils/katchimera-engagement';
import { insightForArchetype } from '@/utils/companion-interaction';
import { requestCompanionNavigationIntent } from '@/utils/companion-navigation-intent';
import {
  acceptQuest,
  cancelQuestAttempt,
  completeInteractiveQuest,
  completeQuest,
  hasCompanionQuestForDay,
  interactionState,
  loadCompanionQuests,
  questCriteria,
  questFor,
  questOffersForDay,
  saveCompanionQuests,
  submitQuest,
  startQuestAttempt,
  type CompanionQuestState,
} from '@/utils/katchimera-quests';
import {
  COMPANION_BOND_REWARDS,
  companionBondProgress,
  questBondEventKind,
  questBondEventId,
  recordCompanionBondEvent,
  type CompanionBondEventKind,
} from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState } from '@/utils/companion-bond-storage';
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
  activeConversationForFamily,
  answerJourneyConversation,
  currentJourneyConversationNode,
  goalsForJourneyFamily,
  hasJourneyMomentForDay,
  journeyProgressForGoal,
  primaryGoalForFamily,
  recordJourneyMoment,
  recordJourneyReflection,
  reflectionPromptForJourney,
  setJourneyGoalStatus,
  setPrimaryJourneyGoal,
  startJourneyConversation,
  syncJourneyQuestCompletions,
} from '@/utils/companion-journey';
import { loadCompanionJourneyState, saveCompanionJourneyState } from '@/utils/companion-journey-storage';
import { companionIdResolverForHomeState } from '@/utils/katchimera-identity';
import type { KingdomResident } from '@/utils/kingdom-residents';
import { requestQuestActionIntent } from '@/utils/quest-action-signal';
import { beginQuestCapture, consumeCompletedQuestCapture, questCaptureBelongsTo } from '@/utils/quest-capture-session';
import {
  buildQuestReportBackItems,
  buildQuestSubmissionItems,
  type QuestSubmissionItem,
} from '@/utils/quests/report-back-evidence';
import { evaluateQuestRuntime } from '@/utils/quests/runtime';
import { questDefinition } from '@/utils/quests/definitions';
import { completedQuestCount, resolveBlockJamConfig, resolveBreathingConfig, resolveLostWordDifficulty, resolveMatchingConfig, resolveMergeConfig, resolvePatternConfig, resolveRhythmConfig, resolveSortingConfig, resolveStepChallengeConfig, resolveTimingConfig, resolveWordPathsDifficulty } from '@/utils/quests/experiences/difficulty';
import { selectWordPathPuzzle } from '@/utils/quests/experiences/word-paths-puzzles';
import { isInteractiveExecution, type QuestResult } from '@/utils/quests/experiences/types';
import { refreshQuestFacts } from '@/utils/quests/facts';
import type { Facts } from '@/utils/signals/facts';
import { recalibrateClassifiedMemory, repairUrbanPhotoCentrality, withQualityConfirmation } from '@/utils/intelligence/classification';
import { buildPhotoEvidence, upsertEvidence } from '@/utils/intelligence/evidence';

type SelectedResident = {
  creature: KingdomCreature;
  resident: KingdomResident;
  thread: CompanionThread | null;
};

type Args = {
  kingdom: KingdomState;
  residents: KingdomResident[];
  today: HomeDayRecord | null;
  todayFacts: Partial<Facts>;
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

export type { QuestCaptureFeedback } from '@/types/companion-interaction';

export function useKingdomQuests({ kingdom, residents, today, todayFacts }: Args) {
  const router = useRouter();
  const [microcopy, setMicrocopy] = useState<string | null>(null);
  const [selectedResident, setSelectedResident] = useState<SelectedResident | null>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [companionQuestState, setCompanionQuestState] = useState<CompanionQuestState>(loadIdentityAwareCompanionQuests);
  const [companionBondState, setCompanionBondState] = useState(loadIdentityAwareCompanionBondState);
  const [companionDiscoveryState, setCompanionDiscoveryState] = useState(loadCompanionDiscoveryState);
  const [companionJourneyState, setCompanionJourneyState] = useState(loadCompanionJourneyState);
  const [storedHomeState, setStoredHomeState] = useState(() => homeRepository.load());
  const [questCaptureFeedback, setQuestCaptureFeedback] = useState<QuestCaptureFeedback | null>(null);
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
      setStoredHomeState(homeRepository.load());
      const completedCapture = consumeCompletedQuestCapture();
      if (completedCapture?.sourceId) {
        const resident = residentById.get(completedCapture.creatureId);
        const creature = creatureById.get(completedCapture.creatureId);
        if (resident && creature) setSelectedResident({ resident, creature, thread: 'quest' });
        const evaluation = completedCapture.evaluation;
        setQuestCaptureFeedback({
          phase: evaluation?.status === 'ready' ? 'matched' : evaluation?.status === 'possible' ? 'possible' : evaluation ? 'no_match' : 'analyzing',
          sourceId: completedCapture.sourceId,
          questId: completedCapture.questId,
          creatureId: completedCapture.creatureId,
          evidenceId: evaluation?.evidenceId ?? null,
          reason: evaluation?.reason ?? null,
        });
      }
    }, [creatureById, residentById])
  );

  useEffect(() => {
    if (!microcopy) return;
    const timeout = setTimeout(() => setMicrocopy(null), 2300);
    return () => clearTimeout(timeout);
  }, [microcopy]);

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
      map.set(creature.creatureId, {
        ...companionUnit(archetype, kingdom, subtype, creature.visualKey),
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
    let changed = false;
    const quests = companionQuestState.quests.map((quest) => {
      const activeDefinition = !quest.completedAt ? questDefinition(quest.questId) : null;
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
      const data = companionDataByCreatureId.get(quest.creatureId);
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
      const offer = companionDataByCreatureId.get(creature.creatureId)?.quest;
      const hasOffer = Boolean(
        offer && today?.isoDate && !hasCompanionQuestForDay(companionQuestState, creature.creatureId, today.isoDate)
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
  const selectedInsight = selectedCompanionData
    ? {
        ...insightForArchetype({
        archetype: selectedCompanionData.archetype,
        text: selectedCompanionData.line,
        count: insightCount(selectedCompanionData.archetype, kingdom),
        }),
        evidenceLabel: selectedRole
          ? `${selectedRole.insightThemes[Math.min(selectedBondProgress.level - 1, selectedRole.insightThemes.length - 1)]} · ${selectedBondProgress.label}`
          : null,
      }
    : null;
  const selectedActiveQuest = selectedResident
    ? questFor(companionQuestState, selectedResident.creature.creatureId)
    : null;
  const selectedQuestRuntime = useMemo(
    () =>
      selectedActiveQuest
        ? evaluateQuestRuntime({
            questId: selectedActiveQuest.questId,
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
  }, [companionQuestState.submissions, questDay, selectedActiveQuest, selectedQuestCaptureFeedback?.sourceId, selectedQuestRuntime]);

  useEffect(() => {
    if (selectedQuestCaptureFeedback?.phase !== 'analyzing' || !selectedQuestRuntime) return;
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
        const state = evaluateQuestRuntime({ questId: offer.id, facts: questFacts, capabilities: questCapabilities }).state;
        return state !== 'unavailable' && state !== 'impossible_today';
      })
    : [];
  const selectedOfferOptions = selectedResident && today?.isoDate
    ? balancedQuestOffers(
        questOffersForDay(
          companionQuestState,
          selectedResident.creature.creatureId,
          today.isoDate,
          eligibleSelectedOffers,
          eligibleSelectedOffers.length
        ),
        3
      )
    : [];
  const selectedOffer =
    selectedResident &&
    selectedOfferOptions.length > 0 &&
    today?.isoDate &&
    !selectedActiveQuest &&
    !hasCompanionQuestForDay(companionQuestState, selectedResident.creature.creatureId, today.isoDate)
      ? selectedOfferOptions.find((offer) => offer.id === selectedOfferId) ?? selectedOfferOptions[0]
      : undefined;
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
  const awardBond = useCallback((event: { id: string; creatureId: string; kind: CompanionBondEventKind; occurredAt: number; dayId?: string | null }) => {
    setCompanionBondState((current) => {
      const result = recordCompanionBondEvent(current, event);
      if (result.awarded) saveCompanionBondState(result.state);
      return result.state;
    });
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
  // captured source. Keep the matched state visible briefly, then complete.
  useEffect(() => {
    if (questCaptureFeedback?.phase !== 'matched' || !questCaptureFeedback.creatureId) return;
    const timeout = setTimeout(() => {
      const latest = loadIdentityAwareCompanionQuests();
      const completingQuest = questFor(latest, questCaptureFeedback.creatureId!);
      const result = submitQuest(
        latest,
        questCaptureFeedback.creatureId!,
        {
          sourceType: 'photo',
          sourceId: questCaptureFeedback.sourceId,
          evidenceId: questCaptureFeedback.evidenceId ?? null,
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
        occurredAt: result.quest?.completedAt ?? Date.now(),
        dayId: result.quest?.completedDayId,
      });
      setMicrocopy(result.submitted ? 'Photo matched - quest complete' : 'Quest already submitted');
      if (result.submitted && process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setQuestCaptureFeedback(null);
      if (result.submitted) {
        setSelectedResident((current) =>
          current?.creature.creatureId === questCaptureFeedback.creatureId ? null : current
        );
      }
    }, 1200);
    return () => clearTimeout(timeout);
  }, [awardBond, commitCompanionQuestState, questCaptureFeedback, today?.isoDate]);

  const selectResident = useCallback(
    (creatureId: string) => {
      const resident = residentById.get(creatureId);
      const creature = creatureById.get(creatureId);
      if (resident && creature) {
        const active = questFor(companionQuestState, creatureId);
        const offer = companionDataByCreatureId.get(creatureId)?.quest;
        const hasOffer = Boolean(offer && today?.isoDate && !hasCompanionQuestForDay(companionQuestState, creatureId, today.isoDate));
        setSelectedResident({ resident, creature, thread: active || hasOffer ? 'quest' : 'insight' });
        setSelectedOfferId(null);
      }
    },
    [companionDataByCreatureId, companionQuestState, creatureById, residentById, today?.isoDate]
  );

  const acceptSelectedQuest = useCallback((offerId?: string) => {
    if (!selectedResident) return;
    const offer = selectedOfferOptions.find((item) => item.id === offerId) ?? selectedOffer;
    if (!offer) return;
    const definition = questDefinition(offer.id);
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
      },
      Date.now()
    );
    if (!next) {
      setMicrocopy('Quest already active');
      return;
    }
    commitCompanionQuestState(next);
    setMicrocopy('Quest accepted');
    setSelectedResident((current) => (current ? { ...current, thread: 'quest' } : current));
  }, [commitCompanionQuestState, companionQuestState, selectedOffer, selectedOfferOptions, selectedResident, today?.isoDate]);

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
        ? `mini-game:${selectedResident.creature.creatureId}:${today.isoDate}`
        : `quest-attempt:${attemptId}`,
      creatureId: selectedResident.creature.creatureId,
      kind: bondKind,
      occurredAt: Date.now(),
      dayId: today.isoDate,
    });
    setMicrocopy('Quest complete');
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [awardBond, commitCompanionQuestState, selectedActiveQuest, selectedResident, today?.isoDate]);

  const cashInSelectedQuest = useCallback(() => {
    if (!selectedResident || !selectedActiveQuest) return;
    const completedAt = Date.now();
    commitCompanionQuestState(
      completeQuest(companionQuestState, selectedResident.creature.creatureId, completedAt, today?.isoDate ?? null)
    );
    awardBond({
      id: questBondEventId(selectedResident.creature.creatureId, selectedActiveQuest.questId, selectedActiveQuest.acceptedAt),
      creatureId: selectedResident.creature.creatureId,
      kind: questBondEventKind(questDefinition(selectedActiveQuest.questId)),
      occurredAt: completedAt,
      dayId: today?.isoDate,
    });
    setMicrocopy('Quest complete');
    setSelectedResident(null);
  }, [awardBond, commitCompanionQuestState, companionQuestState, selectedActiveQuest, selectedResident, today?.isoDate]);

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
        { sourceType: item.sourceType, sourceId: item.sourceId, evidenceId: item.evidenceId },
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
        occurredAt: result.quest.completedAt ?? Date.now(),
        dayId: result.quest.completedDayId,
      });
      setMicrocopy(result.submitted ? 'Quest submitted' : 'Already submitted');
      if (result.submitted) setSelectedResident(null);
    },
    [awardBond, commitCompanionQuestState, companionQuestState, selectedResident, today?.isoDate]
  );

  const performSelectedQuestAction = useCallback(() => {
    if (!selectedQuestRuntime || selectedQuestRuntime.nextAction === 'none') return;
    if (
      selectedResident &&
      (selectedQuestRuntime.nextAction === 'take_photo' || selectedQuestRuntime.nextAction === 'enable_camera')
    ) {
      beginQuestCapture(selectedQuestRuntime.questId, selectedResident.creature.creatureId);
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
        },
      });
      return;
    }
    requestQuestActionIntent({ action: selectedQuestRuntime.nextAction, questId: selectedQuestRuntime.questId });
    setSelectedResident(null);
    router.push('/today');
  }, [router, selectedQuestRuntime, selectedResident]);

  const answerSelectedReflection = useCallback(() => {
    requestQuestActionIntent({ action: 'add_note' });
    setSelectedResident(null);
    router.push('/today');
  }, [router]);

  const performSelectedInsightAction = useCallback(() => {
    const intent: CompanionNavigationIntent | undefined = selectedInsight?.action?.intent;
    if (!intent) return;
    requestCompanionNavigationIntent(intent);
    setSelectedResident(null);
    router.push('/today');
  }, [router, selectedInsight?.action?.intent]);

  const selectThread = useCallback((thread: CompanionThread) => {
    setSelectedResident((current) => (current ? { ...current, thread } : current));
  }, []);
  const closeSelectedResident = useCallback(() => {
    setSelectedResident(null);
    setSelectedOfferId(null);
    setQuickGoalSuggestions(null);
  }, []);
  const awardSelectedInsightBond = useCallback(() => {
    if (!selectedResident || !today?.isoDate) return;
    awardBond({
      id: `insight:${selectedResident.creature.creatureId}:${today.isoDate}`,
      creatureId: selectedResident.creature.creatureId,
      kind: 'insight_engaged',
      occurredAt: Date.now(),
      dayId: today.isoDate,
    });
  }, [awardBond, selectedResident, today?.isoDate]);
  const awardSelectedReflectionBond = useCallback((sourceId: string) => {
    if (!selectedResident) return;
    awardBond({
      id: `reflection:${selectedResident.creature.creatureId}:${sourceId}`,
      creatureId: selectedResident.creature.creatureId,
      kind: 'reflection_saved',
      occurredAt: Date.now(),
      dayId: today?.isoDate,
    });
    if (selectedFamilyId) {
      setCompanionJourneyState((current) => {
        const next = recordJourneyReflection(current, selectedFamilyId, sourceId, Date.now(), today?.isoDate);
        if (next !== current) saveCompanionJourneyState(next);
        return next;
      });
    }
  }, [awardBond, selectedFamilyId, selectedResident, today?.isoDate]);
  const selectedReflectionPrompt = selectedFamilyId
    ? reflectionPromptForJourney(companionJourneyState, selectedFamilyId) ?? (selectedRole
      ? `Thinking about ${selectedRole.reflectionLenses[
        Math.min(selectedBondProgress.level - 1, selectedRole.reflectionLenses.length - 1)
      ]}, what would you like ${selectedRole.displayName} to remember about today?`
      : null)
    : null;
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
    if (result.firstAnswer) {
      awardBond({
        id: `discovery:${selectedResident.creature.creatureId}:${prompt.id}`,
        creatureId: selectedResident.creature.creatureId,
        kind: 'discovery_answered',
        occurredAt: Date.now(),
        dayId: today?.isoDate,
      });
    }
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
    setCompanionDiscoveryState((current) => {
      const next = setCompanionGoalStatus(current, selectedFamilyId, promptId, status);
      saveCompanionDiscoveryState(next);
      return next;
    });
    setMicrocopy(status === 'completed' ? 'Goal completed' : 'Goal updated');
  }, [selectedFamilyId]);
  const startSelectedJourneyConversation = useCallback(() => {
    if (!selectedFamilyId || !selectedJourneyDefinition) return;
    setCompanionJourneyState((current) => {
      const next = startJourneyConversation(current, selectedFamilyId);
      if (next !== current) saveCompanionJourneyState(next);
      return next;
    });
  }, [selectedFamilyId, selectedJourneyDefinition]);
  const answerSelectedJourneyConversation = useCallback((sessionId: string, value: string) => {
    if (!selectedResident || !selectedFamilyId || !selectedJourneyDefinition) return;
    const result = answerJourneyConversation(companionJourneyState, sessionId, value);
    if (result.state === companionJourneyState) return;
    saveCompanionJourneyState(result.state);
    setCompanionJourneyState(result.state);
    if (result.createdGoalId) {
      if (result.suggestedQuickGoalIds.length) {
        setQuickGoalSuggestions({
          familyId: selectedFamilyId,
          templateIds: result.suggestedQuickGoalIds,
        });
      }
      awardBond({
        id: `journey-conversation:${selectedResident.creature.creatureId}:${sessionId}`,
        creatureId: selectedResident.creature.creatureId,
        kind: 'discovery_answered',
        occurredAt: Date.now(),
        dayId: today?.isoDate,
      });
      setMicrocopy('Focus updated');
    }
  }, [awardBond, companionJourneyState, selectedFamilyId, selectedJourneyDefinition, selectedResident, today?.isoDate]);
  const setSelectedJourneyGoalStatus = useCallback((goalId: string, status: CompanionJourneyGoalStatus) => {
    setCompanionJourneyState((current) => {
      const next = setJourneyGoalStatus(current, goalId, status);
      if (next !== current) saveCompanionJourneyState(next);
      return next;
    });
    setMicrocopy(status === 'completed' ? 'Focus completed' : status === 'abandoned' ? 'Focus released' : 'Focus updated');
  }, []);
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
    cancelSelectedQuestAttempt,
    answerSelectedReflection,
    cashInSelectedQuest,
    closeSelectedResident,
    microcopy,
    performSelectedQuestAction,
    completeSelectedInteractiveQuest,
    selectOffer,
    questCaptureFeedback: selectedQuestCaptureFeedback,
    questCriteria: selectedQuestRuntime?.progress ?? (selectedActiveQuest ? questCriteria(selectedActiveQuest.questId, questFacts) : []),
    residentStatusGlyphs,
    selectResident,
    selectThread,
    selectedActiveQuest,
    selectedActiveQuestDefinition,
    selectedInteractiveExecution,
    selectedCompanionData,
    selectedInsight,
    selectedInteractionState,
    selectedOffer,
    selectedOfferId: selectedOffer?.id ?? null,
    selectedOffers: selectedOfferOptions.map((offer, index) => ({
      ...offer,
      bondReward: COMPANION_BOND_REWARDS[
        questBondEventKind(questDefinition(offer.id))
      ],
      recommended: index === 0,
    })),
    selectedOfferCount: selectedOfferOptions.length,
    selectedBondProgress,
    selectedRole,
    selectedJourneyDefinition,
    selectedJourneyGoals,
    selectedJourneyConversation,
    selectedJourneyNode,
    selectedJourneyProgress,
    selectedJourneyMomentLoggedToday,
    selectedQuickGoalSuggestionIds: quickGoalSuggestions?.familyId === selectedFamilyId
      ? quickGoalSuggestions.templateIds
      : [],
    dismissQuickGoalSuggestions: () => setQuickGoalSuggestions(null),
    selectedQuestAdvancesJourneyGoal,
    startSelectedJourneyConversation,
    answerSelectedJourneyConversation,
    logSelectedJourneyMoment,
    setSelectedJourneyGoalStatus,
    setSelectedPrimaryJourneyGoal,
    selectedReflectionPrompt,
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
    submitSelectedQuest,
    performSelectedInsightAction,
    awardSelectedInsightBond,
    awardSelectedReflectionBond,
    refreshQuestState,
    startSelectedQuestAttempt,
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

function balancedQuestOffers<T extends { id: string }>(offers: T[], limit: number): T[] {
  const selected: T[] = [];
  for (const lane of ['real_life', 'mini_game'] as const) {
    const match = offers.find((offer) => questDefinition(offer.id)?.lane === lane);
    if (match) selected.push(match);
  }
  for (const offer of offers) {
    if (selected.length >= limit) break;
    if (!selected.some((item) => item.id === offer.id)) selected.push(offer);
  }
  return selected.slice(0, limit);
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

function insightCount(archetype: string, kingdom: KingdomState): number | null {
  if (archetype === 'food' || archetype === 'savour') return kingdom.totals.foodMoments;
  if (archetype === 'culture') return kingdom.totals.studioMoments;
  if (archetype === 'places') return kingdom.totals.places;
  if (archetype === 'journey' || archetype === 'active') return kingdom.totals.daysHatched;
  if (archetype === 'craft' || archetype === 'memory' || archetype === 'tender') return kingdom.totals.notes;
  return null;
}
