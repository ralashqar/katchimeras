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
  cycleQuestOffer,
  hasCompanionQuestForDay,
  interactionState,
  loadCompanionQuests,
  questCriteria,
  questFor,
  questOfferForDay,
  saveCompanionQuests,
  submitQuest,
  startQuestAttempt,
  type CompanionQuestState,
} from '@/utils/katchimera-quests';
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
import { completedQuestCount, resolveBreathingConfig, resolveLostWordDifficulty, resolveMatchingConfig, resolveMergeConfig, resolvePatternConfig, resolveRhythmConfig, resolveSortingConfig, resolveStepChallengeConfig, resolveTimingConfig } from '@/utils/quests/experiences/difficulty';
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

export type { QuestCaptureFeedback } from '@/types/companion-interaction';

export function useKingdomQuests({ kingdom, residents, today, todayFacts }: Args) {
  const router = useRouter();
  const [microcopy, setMicrocopy] = useState<string | null>(null);
  const [selectedResident, setSelectedResident] = useState<SelectedResident | null>(null);
  const [companionQuestState, setCompanionQuestState] = useState<CompanionQuestState>(() => loadCompanionQuests());
  const [storedHomeState, setStoredHomeState] = useState(() => homeRepository.load());
  const [questCaptureFeedback, setQuestCaptureFeedback] = useState<QuestCaptureFeedback | null>(null);
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
    () => new Map(kingdom.creatures.map((creature) => [creature.creatureId, creature])),
    [kingdom.creatures]
  );

  useFocusEffect(
    useCallback(() => {
      setCompanionQuestState(loadCompanionQuests());
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

  const companionDataByCreatureId = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof companionUnit> & {
        archetype: string;
        subtype: string;
      }
    >();
    for (const creature of kingdom.creatures) {
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
        resolvedConfig: resolveInteractiveConfig(definition, companionQuestState, quest.creatureId, interactive.id),
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
  const selectedInsight = selectedCompanionData
    ? insightForArchetype({
        archetype: selectedCompanionData.archetype,
        text: selectedCompanionData.line,
        count: insightCount(selectedCompanionData.archetype, kingdom),
      })
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
  const selectedOfferOptions = selectedResident && selectedCompanionData?.questOptions && today?.isoDate
    ? eligibleOfferOptions(
        selectedCompanionData.questOptions,
        companionQuestState,
        selectedResident.creature.creatureId,
        selectedResident.creature.visualKey,
        selectedResident.resident.houseLevel,
        today.isoDate
      )
    : [];
  const selectedOffer =
    selectedResident &&
    selectedOfferOptions.length > 0 &&
    today?.isoDate &&
    !selectedActiveQuest &&
    !hasCompanionQuestForDay(companionQuestState, selectedResident.creature.creatureId, today.isoDate)
      ? questOfferForDay(companionQuestState, selectedResident.creature.creatureId, today.isoDate, selectedOfferOptions)
      : undefined;
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
  const refreshQuestState = useCallback(() => {
    setCompanionQuestState(loadCompanionQuests());
    setStoredHomeState(homeRepository.load());
  }, []);

  // A clear quest-camera match is authoritative and auto-submits the exact
  // captured source. Keep the matched state visible briefly, then complete.
  useEffect(() => {
    if (questCaptureFeedback?.phase !== 'matched' || !questCaptureFeedback.creatureId) return;
    const timeout = setTimeout(() => {
      const latest = loadCompanionQuests();
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
  }, [commitCompanionQuestState, questCaptureFeedback, today?.isoDate]);

  const selectResident = useCallback(
    (creatureId: string) => {
      const resident = residentById.get(creatureId);
      const creature = creatureById.get(creatureId);
      if (resident && creature) {
        const active = questFor(companionQuestState, creatureId);
        const offer = companionDataByCreatureId.get(creatureId)?.quest;
        const hasOffer = Boolean(offer && today?.isoDate && !hasCompanionQuestForDay(companionQuestState, creatureId, today.isoDate));
        setSelectedResident({ resident, creature, thread: active || hasOffer ? 'quest' : 'insight' });
      }
    },
    [companionDataByCreatureId, companionQuestState, creatureById, residentById, today?.isoDate]
  );

  const acceptSelectedQuest = useCallback(() => {
    if (!selectedResident || !selectedOffer) return;
    const definition = questDefinition(selectedOffer.id);
    const seed = `${selectedResident.creature.creatureId}:${today?.isoDate ?? 'today'}:${selectedOffer.id}`;
    const resolvedConfig = resolveInteractiveConfig(
      definition,
      companionQuestState,
      selectedResident.creature.creatureId,
      selectedOffer.id
    );
    const next = acceptQuest(
      companionQuestState,
      {
        questId: selectedOffer.id,
        creatureId: selectedResident.creature.creatureId,
        title: selectedOffer.title,
        hint: selectedOffer.hint,
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
  }, [commitCompanionQuestState, companionQuestState, selectedOffer, selectedResident, today?.isoDate]);

  const cycleSelectedOffer = useCallback(() => {
    if (!selectedResident || !today?.isoDate || selectedOfferOptions.length < 2) return;
    const result = cycleQuestOffer(
      companionQuestState,
      selectedResident.creature.creatureId,
      today.isoDate,
      selectedOfferOptions
    );
    commitCompanionQuestState(result.state);
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  }, [commitCompanionQuestState, companionQuestState, selectedOfferOptions, selectedResident, today?.isoDate]);

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
    const latest = loadCompanionQuests();
    commitCompanionQuestState(cancelQuestAttempt(latest, attemptId));
  }, [commitCompanionQuestState]);

  const completeSelectedInteractiveQuest = useCallback((attemptId: string, result: QuestResult) => {
    if (!selectedResident || !today?.isoDate) return;
    const latest = loadCompanionQuests();
    commitCompanionQuestState(completeInteractiveQuest(latest, {
      attemptId,
      creatureId: selectedResident.creature.creatureId,
      result,
      dayId: today.isoDate,
    }));
    setMicrocopy('Quest complete');
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [commitCompanionQuestState, selectedResident, today?.isoDate]);

  const cashInSelectedQuest = useCallback(() => {
    if (!selectedResident) return;
    commitCompanionQuestState(
      completeQuest(companionQuestState, selectedResident.creature.creatureId, Date.now(), today?.isoDate ?? null)
    );
    setMicrocopy('Quest complete');
    setSelectedResident(null);
  }, [commitCompanionQuestState, companionQuestState, selectedResident, today?.isoDate]);

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
      setMicrocopy(result.submitted ? 'Quest submitted' : 'Already submitted');
      if (result.submitted) setSelectedResident(null);
    },
    [commitCompanionQuestState, companionQuestState, selectedResident, today?.isoDate]
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
  const closeSelectedResident = useCallback(() => setSelectedResident(null), []);
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
        if (!best || result.movesUsed < best.movesUsed || (result.movesUsed === best.movesUsed && result.durationMs < best.durationMs)) {
          return { movesUsed: result.movesUsed, durationMs: result.durationMs };
        }
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
    cycleSelectedOffer,
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
    selectedOfferCount: selectedOfferOptions.length,
    recentTriviaQuestionIds: companionQuestState.attempts.flatMap((attempt) => attempt.result?.kind === 'trivia' ? attempt.result.questionIds : []).slice(-40),
    recentWordPuzzleIds: companionQuestState.attempts.flatMap((attempt) => attempt.result?.kind === 'word_game' ? [attempt.result.puzzleId] : []).slice(-30),
    recentSortingItemIds: companionQuestState.attempts.flatMap((attempt) => attempt.result?.kind === 'sorting' ? attempt.result.itemIds : []).slice(-40),
    selectedSortingBestDurationMs,
    selectedMatchingBestDurationMs,
    recentMatchingContentIds: companionQuestState.attempts.flatMap((attempt) => attempt.result?.kind === 'matching' ? attempt.result.contentIds : []).slice(-32),
    recentMergeOrderIds: companionQuestState.attempts.flatMap((attempt) => attempt.result?.kind === 'merge' ? attempt.result.contentIds : []).slice(-12),
    selectedMergeBest,
    selectedQuestItems,
    selectedQuestRuntime,
    selectedResident,
    clarifySelectedQuestMatch,
    submitSelectedQuest,
    performSelectedInsightAction,
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
  dayId: string
): T[] {
  return offers.filter((offer) => {
    const definition = questDefinition(offer.id);
    if (!definition) return false;
    const eligibility = definition.eligibility;
    if (eligibility?.creatureKeys?.length && !eligibility.creatureKeys.includes(creatureKey.toLowerCase())) return false;
    if ((eligibility?.minimumHomeLevel ?? 0) > houseLevel) return false;
    if (offer.id === 'quest-step-time-trial' && completedQuestCount(state.quests, 'quest-step-sprint', creatureId) < 1) return false;
    const cooldownDays = eligibility?.cooldownDays ?? 0;
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

function resolveInteractiveConfig(
  definition: ReturnType<typeof questDefinition>,
  state: CompanionQuestState,
  creatureId: string,
  questId: string
): Record<string, unknown> | undefined {
  if (definition?.execution?.kind === 'live_steps') {
    return resolveStepChallengeConfig({
      challengeId: definition.execution.challengeId,
      completedCount: completedQuestCount(state.quests, questId, creatureId),
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
      ...resolveLostWordDifficulty(completedQuestCount(state.quests, questId, creatureId)),
    };
  }
  if (definition?.execution?.kind === 'paced_breathing') return resolveBreathingConfig(completedQuestCount(state.quests, questId, creatureId));
  if (definition?.execution?.kind === 'timing_zone') return resolveTimingConfig(definition.execution.challengeId, completedQuestCount(state.quests, questId, creatureId));
  if (definition?.execution?.kind === 'pattern_memory') return resolvePatternConfig(completedQuestCount(state.quests, questId, creatureId));
  if (definition?.execution?.kind === 'sorting') return resolveSortingConfig(completedQuestCount(state.quests, questId, creatureId));
  if (definition?.execution?.kind === 'matching') return resolveMatchingConfig(completedQuestCount(state.quests, questId, creatureId));
  if (definition?.execution?.kind === 'merge') return resolveMergeConfig(completedQuestCount(state.quests, questId, creatureId));
  if (definition?.execution?.kind === 'rhythm') return resolveRhythmConfig(completedQuestCount(state.quests, questId, creatureId));
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
