import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { CompanionThread } from '@/components/katchadeck/world/companion-card';
import { useQuestCapabilities } from '@/hooks/use-quest-capabilities';
import { homeRepository } from '@/storage/repositories/home-repository';
import type { HomeDayRecord, MemoryQualityScore } from '@/types/home';
import type { KingdomCreature, KingdomState } from '@/types/kingdom';
import {
  archetypeForCreature,
  companionUnit,
  subtypeForCreature,
} from '@/utils/katchimera-engagement';
import {
  acceptQuest,
  completeQuest,
  hasCompanionQuestForDay,
  interactionState,
  loadCompanionQuests,
  questCriteria,
  questFor,
  saveCompanionQuests,
  submitQuest,
  type CompanionQuestState,
} from '@/utils/katchimera-quests';
import type { KingdomResident } from '@/utils/kingdom-residents';
import { requestQuestActionIntent } from '@/utils/quest-action-signal';
import { beginQuestCapture, consumeCompletedQuestCapture } from '@/utils/quest-capture-session';
import {
  buildQuestReportBackItems,
  buildQuestSubmissionItems,
  type QuestSubmissionItem,
} from '@/utils/quests/report-back-evidence';
import { evaluateQuestRuntime } from '@/utils/quests/runtime';
import { refreshQuestFacts } from '@/utils/quests/facts';
import type { Facts } from '@/utils/signals/facts';
import { recalibrateClassifiedMemory, repairUrbanPhotoCentrality, withQualityConfirmation } from '@/utils/intelligence/classification';

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

export type QuestCaptureFeedback = {
  phase: 'analyzing' | 'matched' | 'possible' | 'no_match';
  sourceId: string;
  questId?: string;
  creatureId?: string;
  evidenceId?: string | null;
  reason?: string | null;
};

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
        ...companionUnit(archetype, kingdom, subtype),
        archetype,
        subtype,
      });
    }
    return map;
  }, [kingdom]);

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
  const selectedQuestItems = useMemo(() => {
    if (!selectedActiveQuest || !selectedQuestRuntime) return [];
    if (selectedQuestRuntime.readyToSubmit || selectedQuestRuntime.possibleEvidenceIds.length > 0) {
      return buildQuestSubmissionItems(
        questDay,
        selectedQuestRuntime,
        selectedActiveQuest,
        companionQuestState.submissions,
        3,
        questCaptureFeedback?.sourceId ?? null
      );
    }
    if (selectedQuestRuntime.complete) return buildQuestReportBackItems(questDay, selectedQuestRuntime);
    return [];
  }, [companionQuestState.submissions, questCaptureFeedback?.sourceId, questDay, selectedActiveQuest, selectedQuestRuntime]);

  useEffect(() => {
    if (questCaptureFeedback?.phase !== 'analyzing' || !selectedQuestRuntime) return;
    const timeout = setTimeout(() => {
      const capturedItem = selectedQuestItems.find((item) => item.sourceId === questCaptureFeedback.sourceId);
      const phase: QuestCaptureFeedback['phase'] = capturedItem?.matchStatus === 'ready'
        ? 'matched'
        : capturedItem?.matchStatus === 'possible'
          ? 'possible'
          : 'no_match';
      setQuestCaptureFeedback((current) => current?.sourceId === questCaptureFeedback.sourceId ? { ...current, phase } : current);
    }, 450);
    return () => clearTimeout(timeout);
  }, [questCaptureFeedback, selectedQuestItems, selectedQuestRuntime]);
  const selectedOffer =
    selectedResident &&
    selectedCompanionData?.quest &&
    today?.isoDate &&
    !selectedActiveQuest &&
    !hasCompanionQuestForDay(companionQuestState, selectedResident.creature.creatureId, today.isoDate)
      ? selectedCompanionData.quest
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
      setQuestCaptureFeedback(null);
      if (result.submitted) setSelectedResident(null);
    }, 900);
    return () => clearTimeout(timeout);
  }, [commitCompanionQuestState, questCaptureFeedback, today?.isoDate]);

  const selectResident = useCallback(
    (creatureId: string) => {
      const resident = residentById.get(creatureId);
      const creature = creatureById.get(creatureId);
      if (resident && creature) setSelectedResident({ resident, creature, thread: 'quest' });
    },
    [creatureById, residentById]
  );

  const acceptSelectedQuest = useCallback(() => {
    if (!selectedResident || !selectedOffer) return;
    const next = acceptQuest(
      companionQuestState,
      {
        questId: selectedOffer.id,
        creatureId: selectedResident.creature.creatureId,
        title: selectedOffer.title,
        hint: selectedOffer.hint,
        dayId: today?.isoDate ?? null,
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
        const updatedToday = {
          ...stored.today,
          classifiedMemories: (stored.today.classifiedMemories ?? []).map((memory) =>
            memory.sourceId === item.sourceId
              ? withQualityConfirmation(
                  memory,
                  item.qualityId!,
                  answer !== 'rejected',
                  new Date(),
                  answer === 'rejected' ? 'incidental' : answer
                )
              : memory
          ),
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

  const selectThread = useCallback((thread: CompanionThread) => {
    setSelectedResident((current) => (current ? { ...current, thread } : current));
  }, []);
  const closeSelectedResident = useCallback(() => setSelectedResident(null), []);

  return {
    acceptSelectedQuest,
    answerSelectedReflection,
    cashInSelectedQuest,
    closeSelectedResident,
    microcopy,
    performSelectedQuestAction,
    questCaptureFeedback,
    questCriteria: selectedQuestRuntime?.progress ?? (selectedActiveQuest ? questCriteria(selectedActiveQuest.questId, questFacts) : []),
    residentStatusGlyphs,
    selectResident,
    selectThread,
    selectedActiveQuest,
    selectedCompanionData,
    selectedInteractionState,
    selectedOffer,
    selectedQuestItems,
    selectedQuestRuntime,
    selectedResident,
    clarifySelectedQuestMatch,
    submitSelectedQuest,
  };
}
