import * as Haptics from 'expo-haptics';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CompanionAchievementCelebration } from '@/components/katchadeck/world/companion-achievement-celebration';
import { CompanionBondLevelUpCelebration } from '@/components/katchadeck/world/companion-bond-level-up-celebration';
import type { CompanionBondAwardReceipt } from '@/utils/companion-bond';
import { CompanionInteractionSheet } from '@/components/katchadeck/world/companion-interaction-sheet';
import { HomeIdentitySheet } from '@/components/katchadeck/world/home-identity-sheet';
import { ZodiacTileSheet } from '@/components/katchadeck/world/zodiac-tile-sheet';
import { ManualJournalSheet } from '@/components/katchadeck/home/manual-journal-sheet';
import { CompanionReflectionComposerModal } from '@/components/katchadeck/world/companion-reflection-composer-modal';
import { KatchaDialog } from '@/components/katchadeck/ui/katcha-dialog';
import { KatchimeraRosterScreen } from '@/components/katchadeck/roster/katchimera-roster-screen';
import { hasQuickGoalTemplates } from '@/constants/companion-quick-goals';
import { AppFontFamilies, KatchaDeckUI } from '@/constants/theme';
import { useAllDays } from '@/hooks/use-all-days';
import { useDevAllKatchimerasAvailable } from '@/hooks/use-dev-all-katchimeras-available';
import { useKingdomQuests } from '@/hooks/use-kingdom-quests';
import { useCompanionQuickGoals } from '@/hooks/use-companion-quick-goals';
import { useCompanionAchievements } from '@/hooks/use-companion-achievements';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import type { CompanionReflectionDraft } from '@/types/companion-interaction';
import type { JournalSource, ManualJournalSubmission } from '@/types/home';
import type { KatchimeraFamilyId, KatchimeraSkinId, KatchimeraWardrobeState } from '@/types/katchimera';
import type { KingdomCreature } from '@/types/kingdom';
import type { WorldIdentityState } from '@/types/world-identity';
import { deriveKingdom } from '@/utils/kingdom-engine';
import { deriveResidents, type HatchRecord } from '@/utils/kingdom-residents';
import { resolveFactsForDay } from '@/utils/signals/resolve';
import { todayAtmosphereBackgroundForDay } from '@/utils/day-background-scene';
import {
  todayKatchimeraExplorationBackgroundKeyForEnvironment,
  todayKatchimeraExplorationBackgroundKeyForFamily,
} from '@/utils/today-exploration-backgrounds';
import { prepareCompanionCheckInReflection } from '@/utils/companion-reflection';
import type { CompanionJourneyCheckIn } from '@/utils/companion-journey';
import { loadWorldIdentity, saveWorldIdentity } from '@/utils/world-identity';
import {
  applyWardrobeToKingdom,
  equipKatchimeraSkin,
  skinsForKingdomCompanion,
} from '@/utils/katchimera-wardrobe';
import {
  loadKatchimeraWardrobe,
  saveKatchimeraWardrobe,
  subscribeKatchimeraWardrobeResets,
} from '@/utils/katchimera-wardrobe-storage';
import { companionIdForFamily } from '@/constants/katchimera-skins';
import type { CompanionQuickGoal, CompanionQuickGoalCompletion } from '@/utils/companion-quick-goals';
import { questDefinition } from '@/utils/quests/definitions';
import type { QuestJournalCaptureMode, QuestJournalTemplate } from '@/utils/quests/journal-templates';
import type { QuestSubmissionItem } from '@/utils/quests/report-back-evidence';
import { journalIdempotencyKey, journalRecordId } from '@/utils/journal-domain';
import { noteEvidenceId } from '@/utils/intelligence/evidence';
import { buildKatchimeraRoster } from '@/utils/katchimera-roster';
import { beginQuestCapture, cancelQuestCapture } from '@/utils/quest-capture-session';
import { completeSemanticNoteQuestCapture } from '@/utils/quests/semantic-note-capture';
import { manualJournalFlow } from '@/utils/manual-journal-registry';
import { withDevAvailableKatchimeras } from '@/utils/dev-katchimera-availability';
import { useEconomy } from '@/features/economy/economy-provider';

type QuestJournalReviewContext = {
  initialFlowId: string;
  initialChoiceId?: string | null;
  noteExpanded: boolean;
  template: QuestJournalTemplate;
  questRunId: string;
  questId: string;
  creatureId: string;
  acceptedDayId: string;
  inputMode: QuestJournalCaptureMode;
  captureSourceId?: string;
};

type QuestNoteCapture = QuestJournalReviewContext & {
  inputMode: 'note' | 'voice';
  captureSourceId: string;
};

type QuestNoteMismatch = {
  message: string;
  review: QuestNoteCapture;
};

type EmbeddedJournalReview =
  | {
      origin: 'insight';
      initialFlowId: string;
      initialChoiceId?: string | null;
      noteExpanded: boolean;
    }
  | {
      origin: 'visit';
      initialFlowId: string;
      noteExpanded: boolean;
    }
  | ({
      origin: 'quest';
    } & QuestJournalReviewContext)
  | {
      origin: 'quick_goal';
      initialFlowId: string;
      noteExpanded: boolean;
      completion: CompanionQuickGoalCompletion;
      goal: CompanionQuickGoal;
    };

// The Kingdom tab is the persistent hex map: center egg, then one tile per
// unique Katchimera in hatch order. Capture stays on Today; this is the archive.

function hatchTimestamp(creature: KingdomCreature, index: number): number {
  const time = Date.parse(`${creature.isoDate}T00:00:00`);
  return Number.isFinite(time) ? time + index : index;
}

function questJournalSubmissionItem(
  submission: ManualJournalSubmission,
  review: QuestJournalReviewContext
): QuestSubmissionItem {
  const source = submission.journalSource ?? {
    kind: 'manual' as const,
    sourceId: review.questRunId,
  };
  const noteSource = source.kind === 'text_note' || source.kind === 'voice_note';
  const journalId = journalRecordId(journalIdempotencyKey(source, submission.sessionId ?? review.questRunId));
  const sourceId = noteSource ? source.sourceId : `manual-${journalId}`;
  const evidenceId = noteSource ? noteEvidenceId(source.sourceId) : `evidence:manual:${sourceId}`;
  return {
    id: evidenceId,
    kind: source.kind === 'voice_note' ? 'voice' : source.kind === 'text_note' ? 'note' : 'note',
    sourceType: noteSource ? source.kind : 'manual_log',
    sourceId,
    evidenceId,
    title: review.template.reviewLabel,
    subtitle: review.inputMode === 'guided' ? 'Guided journal · Added to this quest' : 'Checked on device · Added to this quest',
    body: submission.linkedNote?.text?.trim() || submission.note?.trim() || null,
    icon: source.kind === 'voice_note' ? 'mic.fill' : source.kind === 'text_note' ? 'square.and.pencil' : 'book.closed.fill',
    accentColor: '#D2AE59',
    matchStatus: 'ready',
  };
}

function questJournalSource(review: QuestJournalReviewContext): JournalSource {
  const origin = {
    kind: 'companion_quest' as const,
    questRunId: review.questRunId,
    questId: review.questId,
    creatureId: review.creatureId,
    acceptedDayId: review.acceptedDayId,
    journalTemplateId: review.template.id,
    inputMode: review.inputMode,
  };
  if (review.inputMode === 'note') return { kind: 'text_note', sourceId: review.captureSourceId ?? review.questRunId, origin };
  if (review.inputMode === 'voice') return { kind: 'voice_note', sourceId: review.captureSourceId ?? review.questRunId, origin };
  return { kind: 'manual', sourceId: review.questRunId, origin };
}

function questNoteSubmission(
  draft: CompanionReflectionDraft,
  review: QuestNoteCapture
): ManualJournalSubmission | null {
  const flow = manualJournalFlow(review.template.flowId);
  const categoryId = review.template.initialChoiceId
    ?? review.template.allowedChoiceIds?.[0]
    ?? flow?.choices[0]?.id
    ?? null;
  const choice = flow?.choices.find((item) => item.id === categoryId);
  if (!flow || !choice || !categoryId) return null;
  return {
    flowId: flow.id,
    path: [categoryId],
    categoryId,
    canonicalQualityIds: choice.qualityIds ?? [],
    fields: { specific: draft.text.trim() || review.template.reviewLabel },
    feeling: null,
    note: draft.text.trim() || null,
    linkedNote: {
      kind: draft.kind,
      text: draft.text.trim(),
      audioUri: draft.audioUri ?? null,
      durationMs: draft.durationMs ?? null,
    },
    sessionId: review.captureSourceId,
    journalSource: questJournalSource(review),
  };
}

export type KingdomCompanionPresentation = 'world' | 'roster' | 'companion';

export function KingdomCompanionScreen({
  presentation = 'world',
  initialCreatureId,
  onCloseCompanion,
  onOpenQuestGame,
}: {
  presentation?: KingdomCompanionPresentation;
  initialCreatureId?: string;
  onCloseCompanion?: () => void;
  onOpenQuestGame?: (creatureId: string, questId: string) => void;
}) {
  const isFocused = useIsFocused();
  const router = useRouter();
  const economy = useEconomy();
  const archive = useAllDays();
  const { days } = archive;
  const allKatchimerasAvailable = useDevAllKatchimerasAvailable();
  const kingdom = useMemo(
    () => withDevAvailableKatchimeras(deriveKingdom(days), allKatchimerasAvailable),
    [allKatchimerasAvailable, days],
  );

  const [identity, setIdentity] = useState<WorldIdentityState>(loadWorldIdentity);
  const [wardrobe, setWardrobe] = useState<KatchimeraWardrobeState>(loadKatchimeraWardrobe);
  const [pendingPlusSkin, setPendingPlusSkin] = useState<{ familyId: KatchimeraFamilyId; skinId: KatchimeraSkinId } | null>(null);
  const [homeIdentityOpen, setHomeIdentityOpen] = useState(false);
  const [zodiacOpen, setZodiacOpen] = useState(false);
  const [embeddedJournal, setEmbeddedJournal] = useState<EmbeddedJournalReview | null>(null);
  const [questNoteCapture, setQuestNoteCapture] = useState<QuestNoteCapture | null>(null);
  const [questNoteMismatch, setQuestNoteMismatch] = useState<QuestNoteMismatch | null>(null);
  const [savedOrigin, setSavedOrigin] = useState<'insight' | 'quest' | 'visit' | null>(null);
  const [questExperienceActive, setQuestExperienceActive] = useState(false);
  const [bondLevelUp, setBondLevelUp] = useState<CompanionBondAwardReceipt | null>(null);
  const { addManualJournalEntry, cloudIntelligenceEnabled } = useHomeScreenState({
    enableInteractiveServices: false,
  });
  const presentationKingdom = useMemo(
    () => economy.snapshot.activePlus ? applyWardrobeToKingdom(kingdom, wardrobe) : kingdom,
    [economy.snapshot.activePlus, kingdom, wardrobe]
  );

  useEffect(
    () => subscribeKatchimeraWardrobeResets(() => setWardrobe(loadKatchimeraWardrobe())),
    [],
  );

  const ownedSkinIds = useMemo(
    () =>
      new Set<KatchimeraSkinId>(
        kingdom.creatures.flatMap((creature) =>
          creature.skinId ? [creature.skinId] : []
        )
      ),
    [kingdom.creatures]
  );

  const hatches = useMemo<HatchRecord[]>(
    () =>
      kingdom.creatures.map((creature, index) => ({
        creatureId: creature.creatureId,
        hatchedAt: hatchTimestamp(creature, index),
      })),
    [kingdom.creatures]
  );
  const residents = useMemo(() => deriveResidents(hatches), [hatches]);
  const today = useMemo(() => days.find((day) => day.isToday) ?? null, [days]);
  const kingdomBackground = useMemo(
    () => todayAtmosphereBackgroundForDay(today, days),
    [days, today]
  );
  const yesterday = useMemo(() => {
    if (!today) return null;
    const index = days.findIndex((day) => day.id === today.id);
    return index > 0 ? days[index - 1] : null;
  }, [days, today]);
  const todayFacts = useMemo(() => resolveFactsForDay(today, yesterday), [today, yesterday]);
  const quests = useKingdomQuests({
    kingdom: presentationKingdom,
    residents,
    today,
    todayFacts,
  });
  const acknowledgeBondCelebration = quests.acknowledgeBondCelebration;
  const completeBondCelebration = useCallback((receipt: CompanionBondAwardReceipt) => {
    acknowledgeBondCelebration(receipt.id);
    if (receipt.afterLevel > receipt.beforeLevel) setBondLevelUp(receipt);
  }, [acknowledgeBondCelebration]);
  const quickGoalFamilyIds = useMemo(() => {
    const ids = new Set<KatchimeraFamilyId>();
    for (const creature of kingdom.creatures) {
      const familyId = creature.familyId;
      if (familyId && hasQuickGoalTemplates(familyId)) {
        ids.add(familyId);
      }
    }
    return [...ids];
  }, [kingdom.creatures]);
  const quickGoalDayId = today?.isoDate ?? new Date().toISOString().slice(0, 10);
  const quickGoals = useCompanionQuickGoals({
    dayId: quickGoalDayId,
    availableFamilyIds: quickGoalFamilyIds,
    onBondChanged: quests.refreshQuestState,
  });
  const selectedFamilyId = quests.selectedResident?.creature.familyId ?? null;
  const companionAchievements = useCompanionAchievements();
  const refreshCompanionAchievements = companionAchievements.refresh;
  const selectedAchievementEntries = selectedFamilyId
    ? companionAchievements.entriesForFamily(selectedFamilyId)
    : [];
  const selectedAchievementProgress = {
    earned: selectedAchievementEntries.filter((entry) => entry.record).length,
    total: selectedAchievementEntries.length,
    unseen: selectedAchievementEntries.filter((entry) => entry.record && !entry.record.seenCelebration).length,
  };
  const achievementRefreshSignature = [
    quests.selectedBondProgress.totalPoints,
    quickGoals.state.completions.length,
    quests.selectedQuestPersistedComplete ? 1 : 0,
    quests.selectedJourneyProgress?.completedStageCount ?? 0,
    quests.selectedJourneyProgress?.moments ?? 0,
    quests.selectedJourneyProgress?.reflections ?? 0,
  ].join('|');

  useEffect(() => {
    refreshCompanionAchievements();
  }, [achievementRefreshSignature, refreshCompanionAchievements]);
  const selectedHomeEnvironmentKey = useMemo(() => {
    const creature = quests.selectedResident?.creature;
    if (!creature) return null;

    // The companion hub is the Katchimera's permanent home, not a replay of
    // the mixed day scene in which this particular hatch happened.
    return (
      todayKatchimeraExplorationBackgroundKeyForEnvironment(creature.visualKey)
      ?? todayKatchimeraExplorationBackgroundKeyForFamily(creature.familyId)
      ?? 'home'
    );
  }, [quests.selectedResident?.creature]);
  const selectedSkinOptions = useMemo(
    () =>
      selectedFamilyId
        ? skinsForKingdomCompanion(selectedFamilyId, ownedSkinIds)
        : [],
    [ownedSkinIds, selectedFamilyId]
  );
  const rosterItems = useMemo(
    () => buildKatchimeraRoster({
      creatures: presentationKingdom.creatures,
      residents,
      bondForCreature: quests.bondProgressForCreature,
      statusByCreatureId: quests.residentStatusGlyphs,
    }),
    [
      presentationKingdom.creatures,
      quests.bondProgressForCreature,
      quests.residentStatusGlyphs,
      residents,
    ],
  );
  const selectInitialResident = quests.selectResident;
  const selectedCreatureId = quests.selectedResident?.creature.creatureId;

  useEffect(() => {
    if (presentation !== 'companion' || !initialCreatureId) return;
    if (selectedCreatureId === initialCreatureId) return;
    selectInitialResident(initialCreatureId);
  }, [initialCreatureId, presentation, selectInitialResident, selectedCreatureId]);

  useEffect(() => {
    if (presentation !== 'world') return;
    if (!identity.selectedHomeArchetypeId) {
      const seeded: WorldIdentityState = { ...identity, selectedHomeArchetypeId: 'explorer', recommendedHomeArchetypeId: 'explorer' };
      setIdentity(seeded);
      saveWorldIdentity(seeded);
      setHomeIdentityOpen(true);
    }
  }, [identity, presentation]);

  const updateIdentity = (next: WorldIdentityState) => {
    setIdentity(next);
    saveWorldIdentity(next);
  };
  const equipSelectedSkin = (skinId: KatchimeraSkinId) => {
    if (!selectedFamilyId) return;
    if (!quests.selectedHistoryIsPlus) {
      setPendingPlusSkin({ familyId: selectedFamilyId, skinId });
      router.push({
        pathname: '/modal',
        params: { source: 'katchimera-skin', familyId: selectedFamilyId, skinId },
      });
      return;
    }
    const next = equipKatchimeraSkin(wardrobe, selectedFamilyId, skinId);
    if (next === wardrobe) return;
    saveKatchimeraWardrobe(next);
    setWardrobe(next);
  };

  useEffect(() => {
    if (!quests.selectedHistoryIsPlus || !pendingPlusSkin) return;
    setWardrobe((current) => {
      const next = equipKatchimeraSkin(current, pendingPlusSkin.familyId, pendingPlusSkin.skinId);
      if (next !== current) saveKatchimeraWardrobe(next);
      return next;
    });
    setPendingPlusSkin(null);
  }, [pendingPlusSkin, quests.selectedHistoryIsPlus]);
  const refreshQuestState = quests.refreshQuestState;

  useEffect(() => {
    if (!savedOrigin) return;
    const timeout = setTimeout(() => {
      refreshQuestState();
      setSavedOrigin(null);
    }, 1250);
    return () => clearTimeout(timeout);
  }, [refreshQuestState, savedOrigin]);

  const handleInsightAction = () => {
    const action = quests.selectedInsight?.action;
    if (!action) return;
    if (action.intent.kind === 'journal_flow') {
      setEmbeddedJournal({
        origin: 'insight',
        initialFlowId: action.intent.flowId,
        noteExpanded: /note|memory/i.test(action.label),
      });
      return;
    }
    quests.performSelectedInsightAction();
  };

  const handleQuestAction = (requestedInputMode?: QuestJournalCaptureMode) => {
    const inputMode = requestedInputMode ?? (quests.selectedFoundationAvailable ? 'note' : 'guided');
    const action = quests.selectedQuestRuntime?.nextAction;
    if (action === 'add_note' || action === 'record_voice') {
      const definition = quests.selectedQuestRuntime
        ? questDefinition(quests.selectedQuestRuntime.questId)
        : null;
      const activeQuest = quests.selectedActiveQuest;
      const template = definition?.evidenceInput?.kind === 'journal'
        ? definition.evidenceInput.template
        : null;
      if (activeQuest && template && quests.selectedResident) {
        const review: QuestJournalReviewContext = {
          initialFlowId: template.flowId,
          initialChoiceId: inputMode === 'guided'
            ? template.initialChoiceId
            : template.initialChoiceId ?? template.allowedChoiceIds?.[0] ?? null,
          noteExpanded: inputMode !== 'guided',
          template,
          questRunId: activeQuest.questRunId ?? `quest-run:${quests.selectedResident.creature.creatureId}:${activeQuest.questId}:${activeQuest.acceptedAt.toString(36)}`,
          questId: activeQuest.questId,
          creatureId: quests.selectedResident.creature.creatureId,
          acceptedDayId: activeQuest.acceptedDayId ?? today?.isoDate ?? 'today',
          inputMode,
        };
        if (inputMode === 'guided') {
          setEmbeddedJournal({ origin: 'quest', ...review });
        } else {
          if (definition?.semanticVerification && quests.selectedFoundationAvailable) {
            beginQuestCapture(activeQuest.questId, quests.selectedResident.creature.creatureId, activeQuest.questRunId);
          }
          setQuestNoteMismatch(null);
          setQuestNoteCapture({
            ...review,
            inputMode,
            captureSourceId: `${review.questRunId}:${inputMode}:${Date.now().toString(36)}`,
          });
        }
        return;
      }
      setEmbeddedJournal({ origin: 'insight', initialFlowId: 'general', noteExpanded: true });
      return;
    }
    quests.performSelectedQuestAction();
  };

  const saveJourneyCheckIn = (
    checkIn: CompanionJourneyCheckIn,
    note: CompanionReflectionDraft | null
  ) => {
    const prepared = prepareCompanionCheckInReflection({ checkIn, note });
    if (!prepared) return;
    addManualJournalEntry(prepared.submission, 'today');
    quests.refreshQuestState();
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  return (
    <GestureHandlerRootView style={styles.screen}>
      {presentation === 'roster' || presentation === 'world' ? (
        <KatchimeraRosterScreen
          background={kingdomBackground}
          items={rosterItems}
          onGoToday={() => router.navigate('/today')}
          onSelectCreature={quests.selectResident}
        />
      ) : <View style={styles.companionRouteStage} />}

      {homeIdentityOpen ? <HomeIdentitySheet identity={identity} onChange={updateIdentity} onClose={() => setHomeIdentityOpen(false)} /> : null}
      {zodiacOpen ? <ZodiacTileSheet identity={identity} onChange={updateIdentity} onClose={() => setZodiacOpen(false)} /> : null}

      {quests.selectedResident && !embeddedJournal && !questNoteCapture ? (
        <CompanionInteractionSheet
          key={`${quests.selectedResident.creature.creatureId}:${quests.questCaptureRestoreKey ?? 'standard'}`}
          onExperienceActiveChange={setQuestExperienceActive}
          embedded={presentation === 'companion'}
          creatureId={quests.selectedResident.creature.creatureId}
          name={quests.selectedResident.creature.name}
          visualKey={quests.selectedResident.creature.visualKey}
          accentColor={quests.selectedResident.creature.accentColor}
          questionnaireBackground={kingdomBackground}
          homeEnvironmentKey={selectedHomeEnvironmentKey}
          houseLevel={quests.selectedResident.resident.houseLevel}
          initialDestination={quests.selectedResident.destination}
          onSelectDestination={quests.selectDestination}
          onClose={() => {
            quests.closeSelectedResident();
            if (presentation === 'companion') onCloseCompanion?.();
          }}
          activeQuest={quests.selectedActiveQuest ? {
            questId: quests.selectedActiveQuest.questId,
            title: quests.selectedActiveQuest.title,
            hint: quests.selectedActiveQuest.hint,
            semanticInput: Boolean(questDefinition(quests.selectedActiveQuest.questId)?.semanticVerification),
            journalInput: questDefinition(quests.selectedActiveQuest.questId)?.evidenceInput?.kind === 'journal',
            journalFallback: questDefinition(quests.selectedActiveQuest.questId)?.evidenceInput?.kind === 'journal',
            assistedJournalInput: Boolean(
              questDefinition(quests.selectedActiveQuest.questId)?.semanticVerification && quests.selectedFoundationAvailable
            ),
            execution: quests.selectedInteractiveExecution,
            resolvedConfig: quests.selectedActiveQuest.resolvedConfig,
            offerSeed: quests.selectedActiveQuest.offerSeed,
          } : null}
          questComplete={Boolean(quests.selectedQuestPersistedComplete || quests.selectedQuestRuntime?.complete)}
          questRuntime={quests.selectedQuestRuntime}
          questCaptureFeedback={quests.questCaptureFeedback}
          submissionItems={quests.selectedQuestItems}
          offers={quests.selectedOffers}
          selectedOfferId={quests.selectedOfferId}
          onSelectOffer={quests.selectOffer}
          criteria={quests.questCriteria}
          onAccept={quests.acceptSelectedQuest}
          onCashIn={quests.cashInSelectedQuest}
          onChooseAnotherQuest={quests.chooseAnotherSelectedQuest}
          onSubmitQuest={quests.submitSelectedQuest}
          onClarifyQuestMatch={quests.clarifySelectedQuestMatch}
          onQuestAction={handleQuestAction}
          recentTriviaQuestionIds={quests.recentTriviaQuestionIds}
          recentWordPuzzleIds={quests.recentWordPuzzleIds}
          recentWordPathPuzzleIds={quests.recentWordPathPuzzleIds}
          recentSortingItemIds={quests.recentSortingItemIds}
          sortingBestDurationMs={quests.selectedSortingBestDurationMs}
          matchingBestDurationMs={quests.selectedMatchingBestDurationMs}
          recentMatchingContentIds={quests.recentMatchingContentIds}
          recentMergeOrderIds={quests.recentMergeOrderIds}
          mergeBest={quests.selectedMergeBest}
          blockJamBest={quests.selectedBlockJamBest}
          onStartQuestAttempt={quests.startSelectedQuestAttempt}
          onCancelQuestAttempt={quests.cancelSelectedQuestAttempt}
          onCompleteInteractiveQuest={quests.completeSelectedInteractiveQuest}
          onOpenQuestGame={onOpenQuestGame
            ? (questId) => onOpenQuestGame(quests.selectedResident!.creature.creatureId, questId)
            : undefined}
          insight={quests.selectedInsight ?? { text: 'This tile remembers the day we met.', action: null }}
          insights={quests.selectedInsights}
          onRemoveInsight={quests.removeSelectedInsight}
          onRetakeInsight={quests.retakeSelectedInsight}
          onInsightAction={handleInsightAction}
          memorySaved={Boolean(savedOrigin)}
          bondProgress={quests.selectedBondProgress}
          pendingBondCelebration={bondLevelUp ? null : quests.selectedPendingBondCelebration}
          onBondCelebrationComplete={completeBondCelebration}
          achievementProgress={selectedAchievementProgress}
          introductionDefinition={quests.selectedIntroductionDefinition}
          introductionRecord={quests.selectedIntroduction}
          introductionShouldAutoOpen={quests.selectedIntroductionShouldAutoOpen}
          visitGreeting={quests.selectedVisitGreeting}
          onDeferIntroduction={quests.deferSelectedIntroduction}
          onCompleteIntroduction={quests.completeSelectedIntroduction}
          skins={selectedSkinOptions}
          equippedSkinId={quests.selectedResident.creature.skinId ?? null}
          onEquipSkin={equipSelectedSkin}
          role={quests.selectedRole}
          discoveryPrompts={quests.selectedDiscoveryPrompts}
          discoveryAnswers={quests.selectedDiscoveryAnswers}
          onAnswerDiscovery={quests.answerSelectedDiscoveryPrompt}
          onRemoveDiscoveryAnswer={quests.removeSelectedDiscoveryAnswer}
          onSetDiscoveryGoalStatus={quests.setSelectedDiscoveryGoalStatus}
          journeyDefinition={quests.selectedJourneyDefinition}
          journeyGoals={quests.selectedJourneyGoals}
          journeyConversation={quests.selectedJourneyConversation}
          journeyNode={quests.selectedJourneyNode}
          journeyProgress={quests.selectedJourneyProgress}
          journeyMomentLoggedToday={quests.selectedJourneyMomentLoggedToday}
          questAdvancesJourneyGoal={quests.selectedQuestAdvancesJourneyGoal}
          onStartJourneyConversation={quests.startSelectedJourneyConversation}
          onAnswerJourneyConversation={quests.answerSelectedJourneyConversation}
          onLogJourneyMoment={quests.logSelectedJourneyMoment}
          onSetJourneyGoalStatus={quests.setSelectedJourneyGoalStatus}
          onSetPrimaryJourneyGoal={quests.setSelectedPrimaryJourneyGoal}
          journeyCheckIn={quests.selectedJourneyCheckIn}
          onStartJourneyCheckIn={quests.startSelectedJourneyCheckIn}
          onAnswerJourneyCheckIn={quests.answerSelectedJourneyCheckIn}
          onBackJourneyCheckIn={quests.backSelectedJourneyCheckIn}
          onEditJourneyCheckIn={quests.editSelectedJourneyCheckIn}
          onSetJourneyCheckInTaskStatus={quests.setSelectedJourneyCheckInTaskStatus}
          onSaveJourneyCheckIn={saveJourneyCheckIn}
          familyId={quests.selectedResident.creature.familyId ?? 'vesperitt'}
          quickGoalsEnabled={quickGoalFamilyIds.includes(quests.selectedResident.creature.familyId ?? '')}
          quickGoalDayId={quickGoalDayId}
          quickGoalState={quickGoals.state}
          onAddQuickGoalTemplate={quickGoals.addTemplate}
          onAddCustomQuickGoal={quickGoals.addCustom}
          onCompleteQuickGoal={quickGoals.completeGoal}
          onSkipQuickGoal={quickGoals.skipGoal}
          onSnoozeQuickGoal={quickGoals.snoozeGoal}
          onUndoQuickGoal={quickGoals.undoGoal}
          onRememberQuickGoal={(completion, goal) => {
            setEmbeddedJournal({
              origin: 'quick_goal',
              initialFlowId: 'general',
              noteExpanded: true,
              completion,
              goal,
            });
          }}
          quickGoalSuggestionIds={quests.selectedQuickGoalSuggestionIds}
          onAddQuickGoalSuggestions={(templateIds) => {
            const addedTemplateIds = quickGoals.addTemplates(templateIds);
            quests.dismissQuickGoalSuggestions();
            if (addedTemplateIds.length) quests.refreshQuestState();
            return addedTemplateIds;
          }}
          onDismissQuickGoalSuggestions={quests.dismissQuickGoalSuggestions}
          conversationSession={quests.selectedConversationSession}
          conversationDefinition={quests.selectedConversationDefinition}
          conversationRecommendation={quests.selectedConversationRecommendation}
          conversationStarters={quests.selectedConversationStarters}
          idealSkinDefinitionId={quests.selectedIdealSkinDefinitionId}
          idealSkinOnboardingRequired={quests.selectedIdealSkinOnboardingRequired}
          conversationQuestOffer={quests.selectedConversationQuestOffer}
          onAnswerConversation={quests.answerSelectedConversation}
          onContinueConversation={quests.continueSelectedConversation}
          onStartConversation={quests.startSelectedConversation}
          onKeepTalkingConversation={quests.keepTalkingSelectedConversation}
          onMemoryConversationDecision={quests.decideSelectedConversationMemory}
          onGoalConversationDecision={(selectedTemplateIds, node) => {
            const addedTemplateIds = selectedTemplateIds && !quests.selectedConversationSession?.preview
              ? quickGoals.addTemplates(selectedTemplateIds)
              : selectedTemplateIds ?? [];
            quests.decideSelectedConversationGoal(selectedTemplateIds, node, addedTemplateIds);
            if (addedTemplateIds.length && !quests.selectedConversationSession?.preview) quests.refreshQuestState();
          }}
          onInsightConversationDecision={quests.decideSelectedConversationInsight}
          onQuickGoalConversationDecision={(accept, node) => {
            const added = accept && !quests.selectedConversationSession?.preview
              ? quickGoals.addTemplates([node.templateId]).includes(node.templateId)
              : false;
            quests.decideSelectedConversationQuickGoal(accept, added, node);
          }}
          onQuestConversationHandoff={(accept, node) => {
            const quest = quests.selectedConversationQuestOffer;
            const accepted = Boolean(
              accept
              && quest
              && !quests.selectedConversationSession?.preview
              && quests.acceptSelectedQuest(quest.id, { openDestination: false })
            );
            quests.decideSelectedConversationQuestHandoff(accept, accepted, node, quest);
          }}
          onDismissConversationOutcome={quests.dismissSelectedConversationOutcome}
          onPreviewConversation={quests.previewSelectedConversation}
          onExitConversationPreview={quests.exitSelectedConversationPreview}
          visitPlan={quests.selectedVisitPlan}
          visitReceipt={quests.selectedVisitReceipt}
          memories={quests.selectedMemories}
          historyIsPlus={quests.selectedHistoryIsPlus}
          hasOlderHistory={quests.selectedHasOlderHistory}
          onRespondVisit={quests.respondToSelectedVisit}
          onSayMoreVisit={() => setEmbeddedJournal({ origin: 'visit', initialFlowId: 'general', noteExpanded: true })}
          onUpdateMemory={quests.updateSelectedMemory}
          onResetMemory={quests.resetSelectedCompanionMemory}
          onSharedHistoryOpened={quests.recordSelectedSharedHistoryOpened}
        />
      ) : null}
      {embeddedJournal ? (
        <ManualJournalSheet
          allowRemoteIntelligence={embeddedJournal.origin === 'quest' ? false : cloudIntelligenceEnabled}
          entryVariant={embeddedJournal.origin === 'quest' ? 'quest_focused' : 'standard'}
          dayLocationPoints={today?.locations}
          initialFlowId={embeddedJournal.initialFlowId}
          initialChoiceId={'initialChoiceId' in embeddedJournal ? embeddedJournal.initialChoiceId : undefined}
          allowedChoiceIds={embeddedJournal.origin === 'quest' ? embeddedJournal.template.allowedChoiceIds : undefined}
          contextOptionsOverride={embeddedJournal.origin === 'quest' && embeddedJournal.inputMode === 'guided' ? embeddedJournal.template.contextOptions : undefined}
          contextTitleOverride={embeddedJournal.origin === 'quest' && embeddedJournal.inputMode === 'guided' ? embeddedJournal.template.contextTitle : undefined}
          promptBody={embeddedJournal.origin === 'quest' ? embeddedJournal.template.promptBody : undefined}
          promptTitle={embeddedJournal.origin === 'quest' ? embeddedJournal.template.promptTitle : undefined}
          saveLabel={embeddedJournal.origin === 'quest'
            ? embeddedJournal.inputMode === 'guided' ? 'Save and complete quest' : 'Check and submit'
            : undefined}
          initialInputMode={embeddedJournal.origin === 'quest' ? embeddedJournal.inputMode : undefined}
          initialSpecific={embeddedJournal.origin === 'quick_goal' ? embeddedJournal.goal.title : undefined}
          initialNote={embeddedJournal.origin === 'quick_goal' ? `I completed: ${embeddedJournal.goal.title}` : undefined}
          initialNoteExpanded={embeddedJournal.noteExpanded}
          journalSource={embeddedJournal.origin === 'quest' ? questJournalSource(embeddedJournal) : embeddedJournal.origin === 'quick_goal' ? {
            kind: 'text_note',
            sourceId: embeddedJournal.completion.id,
            origin: {
              kind: 'quick_goal_completion',
              creatureId: companionIdForFamily(embeddedJournal.goal.familyId),
              familyId: embeddedJournal.goal.familyId,
              goalId: embeddedJournal.goal.id,
              completionId: embeddedJournal.completion.id,
              goalTitle: embeddedJournal.goal.title,
            },
          } : embeddedJournal.origin === 'visit' && quests.selectedResident && quests.selectedVisitPlan ? {
            kind: 'manual',
            sourceId: quests.selectedVisitPlan.id,
            origin: {
              kind: 'companion_reflection',
              creatureId: quests.selectedResident.creature.creatureId,
              familyId: quests.selectedResident.creature.familyId,
              promptId: quests.selectedVisitPlan.id,
              promptText: quests.selectedVisitPlan.opening,
            },
          } : undefined}
          returnToOriginOnBack
          onBackFromInitial={() => {
            if (embeddedJournal.origin === 'quest') cancelQuestCapture(embeddedJournal.questId);
            setEmbeddedJournal(null);
          }}
          onClose={() => {
            if (embeddedJournal.origin === 'quest') cancelQuestCapture(embeddedJournal.questId);
            setEmbeddedJournal(null);
            quests.closeSelectedResident();
          }}
          onSave={(submission) => {
            addManualJournalEntry(submission, 'today');
            const origin = embeddedJournal.origin;
            if (origin === 'visit') {
              const specific = typeof submission.fields.specific === 'string' ? submission.fields.specific : '';
              const summary = submission.linkedNote?.text?.trim() || submission.note?.trim() || specific.trim() || 'A moment we talked about';
              quests.rememberSelectedSharedMoment({
                sourceId: submission.journalSource?.sourceId ?? submission.sessionId ?? `visit:${Date.now().toString(36)}`,
                summary,
              });
            }
            if (embeddedJournal.origin === 'quick_goal') {
              quickGoals.markJournaled(embeddedJournal.completion.id);
            }
            if (embeddedJournal.origin === 'quest') {
              const review = embeddedJournal;
              const submissionItem = questJournalSubmissionItem(submission, review);
              const noteText = submission.linkedNote?.text.trim() || submission.note?.trim() || '';
              const semantic = questDefinition(review.questId)?.semanticVerification;
              if (review.inputMode === 'guided') {
                cancelQuestCapture(review.questId);
                quests.submitSelectedQuest(submissionItem);
              } else if (semantic && quests.selectedFoundationAvailable && noteText) {
                void completeSemanticNoteQuestCapture({
                  sourceId: review.questRunId,
                  sourceType: review.inputMode === 'voice' ? 'voice_note' : 'text_note',
                  text: noteText,
                  target: 'today',
                }).then((outcome) => {
                  if (outcome.matched) {
                    quests.submitSelectedQuest(submissionItem);
                    return;
                  }
                  quests.reportSelectedQuestJournalOutcome({
                    phase: 'no_match',
                    sourceId: review.questRunId,
                    sourceType: review.inputMode === 'voice' ? 'voice_note' : 'text_note',
                    evidenceId: outcome.evidenceId,
                    reason: outcome.message,
                  });
                }).finally(quests.refreshQuestState);
              } else {
                cancelQuestCapture(review.questId);
                quests.reportSelectedQuestJournalOutcome({
                  phase: 'no_match',
                  sourceId: review.questRunId,
                  sourceType: review.inputMode === 'voice' ? 'voice_note' : 'text_note',
                  reason: noteText
                    ? 'This device could not check the entry. Use the guided journal to complete the quest.'
                    : 'Add a transcript or use the guided journal so the quest can check this entry.',
                });
              }
            }
            setEmbeddedJournal(null);
            setSavedOrigin(origin === 'quick_goal' ? null : origin);
            if (origin === 'quest' && embeddedJournal.origin === 'quest' && embeddedJournal.inputMode !== 'guided') quests.refreshQuestState();
            if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        />
      ) : null}
      {questNoteCapture ? (
        <CompanionReflectionComposerModal
          eyebrow="QUEST ENTRY"
          hapticOnSave={false}
          initialDraft={null}
          initialVoiceRecording={questNoteCapture.inputMode === 'voice'}
          promptId={questNoteCapture.questId}
          promptText={questNoteCapture.template.promptBody}
          saveLabel="Check and submit"
          title={questNoteCapture.template.promptTitle}
          onCancel={() => {
            cancelQuestCapture(questNoteCapture.questId);
            setQuestNoteCapture(null);
          }}
          onSave={(draft) => {
            const review = questNoteCapture;
            const captureSourceId = review.captureSourceId;
            const submission = questNoteSubmission(draft, review);
            if (!submission) {
              cancelQuestCapture(review.questId);
              quests.reportSelectedQuestJournalOutcome({
                phase: 'no_match',
                sourceId: captureSourceId,
                sourceType: review.inputMode === 'voice' ? 'voice_note' : 'text_note',
                reason: 'This entry could not be filed. Try the guided journal instead.',
              });
              setQuestNoteCapture(null);
              return;
            }
            addManualJournalEntry(submission, 'today');
            const submissionItem = questJournalSubmissionItem(submission, review);
            const noteText = draft.text.trim();
            const semantic = questDefinition(review.questId)?.semanticVerification;
            setQuestNoteCapture(null);
            if (semantic && quests.selectedFoundationAvailable && noteText) {
              quests.reportSelectedQuestJournalOutcome({
                phase: 'analyzing',
                sourceId: captureSourceId,
                sourceType: review.inputMode === 'voice' ? 'voice_note' : 'text_note',
                reason: 'direct_semantic_pending',
              });
              void completeSemanticNoteQuestCapture({
                sourceId: captureSourceId,
                sourceType: review.inputMode === 'voice' ? 'voice_note' : 'text_note',
                text: noteText,
                target: 'today',
              }).then((outcome) => {
                if (outcome.matched) {
                  if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  quests.submitSelectedQuest(submissionItem);
                  return;
                }
                if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                setQuestNoteMismatch({
                  message: outcome.message ?? 'This note does not clearly answer the quest question yet.',
                  review,
                });
                quests.reportSelectedQuestJournalOutcome({
                  phase: 'no_match',
                  sourceId: captureSourceId,
                  sourceType: review.inputMode === 'voice' ? 'voice_note' : 'text_note',
                  evidenceId: outcome.evidenceId,
                  reason: outcome.message,
                });
              }).catch(() => {
                cancelQuestCapture(review.questId);
                if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                const message = 'Your note was saved, but it could not be checked just now.';
                setQuestNoteMismatch({ message, review });
                quests.reportSelectedQuestJournalOutcome({
                  phase: 'no_match',
                  sourceId: captureSourceId,
                  sourceType: review.inputMode === 'voice' ? 'voice_note' : 'text_note',
                  reason: message,
                });
              }).finally(quests.refreshQuestState);
            } else {
              cancelQuestCapture(review.questId);
              if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              quests.reportSelectedQuestJournalOutcome({
                phase: 'no_match',
                sourceId: captureSourceId,
                sourceType: review.inputMode === 'voice' ? 'voice_note' : 'text_note',
                reason: noteText
                  ? 'This device could not check the entry. Use the guided journal to complete the quest.'
                  : 'Add a transcript or use the guided journal so the quest can check this entry.',
              });
            }
          }}
        />
      ) : null}
      {isFocused && bondLevelUp ? (
        <CompanionBondLevelUpCelebration
          onContinue={() => setBondLevelUp(null)}
          receipt={bondLevelUp}
        />
      ) : null}
      {isFocused && companionAchievements.pending.length > 0 && !bondLevelUp && !quests.selectedPendingBondCelebration && !questExperienceActive && !embeddedJournal && !questNoteCapture ? (
        <CompanionAchievementCelebration
          achievements={companionAchievements.pending}
          onAchievementSeen={(id) => companionAchievements.markSeen([id])}
        />
      ) : null}
      <KatchaDialog
        body={quests.questResultNotice?.message ?? ''}
        cancelLabel={quests.questResultNotice?.kind === 'success'
          ? 'Back to quests'
          : quests.questResultNotice?.kind === 'possible'
            ? 'Review photo'
            : 'Keep quest open'}
        confirmLabel="Try another photo"
        icon={quests.questResultNotice?.kind === 'success' ? 'checkmark' : 'camera.fill'}
        imageUri={quests.questResultNotice?.thumbnailUri}
        onCancel={quests.questResultNotice?.kind === 'success'
          ? quests.finishQuestResultNotice
          : quests.dismissQuestResultNotice}
        onConfirm={quests.questResultNotice?.kind === 'no_match'
          ? () => {
              quests.dismissQuestResultNotice();
              quests.performSelectedQuestAction();
            }
          : undefined}
        open={Boolean(quests.questResultNotice)}
        title={quests.questResultNotice?.title ?? ''}
        tone={quests.questResultNotice?.kind === 'success' ? 'info' : 'warning'}
      />
      <KatchaDialog
        body={questNoteMismatch
          ? `${questNoteMismatch.message} Try another answer, or use the guided journal to complete it without on-device checking.`
          : ''}
        cancelLabel="Try another answer"
        confirmLabel="Use guided journal"
        icon="text.bubble.fill"
        onCancel={() => {
          if (!questNoteMismatch) return;
          const review = questNoteMismatch.review;
          cancelQuestCapture(review.questId);
          beginQuestCapture(review.questId, review.creatureId, review.questRunId);
          setQuestNoteMismatch(null);
          setQuestNoteCapture({
            ...review,
            captureSourceId: `${review.questRunId}:${review.inputMode}:${Date.now().toString(36)}`,
          });
        }}
        onConfirm={() => {
          if (!questNoteMismatch) return;
          const review = questNoteMismatch.review;
          cancelQuestCapture(review.questId);
          setQuestNoteMismatch(null);
          setEmbeddedJournal({
            origin: 'quest',
            ...review,
            captureSourceId: undefined,
            inputMode: 'guided',
            initialChoiceId: review.template.initialChoiceId,
            noteExpanded: true,
          });
        }}
        open={Boolean(questNoteMismatch)}
        surface="parchment"
        title="That doesn’t answer the quest yet"
        tone="warning"
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#55A9E2', flex: 1 },
  stage: { flex: 1 },
  companionRouteStage: { flex: 1, backgroundColor: '#11131B' },
  header: {
    left: 20,
    position: 'absolute',
    right: 76,
    zIndex: 30,
  },
  headerKicker: {
    ...KatchaDeckUI.typography.kingdomDisplay,
    textShadowColor: 'rgba(30,70,111,0.92)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 13.5,
    fontWeight: '800',
    lineHeight: 19,
    marginTop: 1,
    textShadowColor: 'rgba(27,72,111,0.76)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actionRail: {
    alignItems: 'center',
    gap: 12,
    position: 'absolute',
    right: 14,
    zIndex: 30,
  },
  headerButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(77,106,193,0.42)',
    borderColor: 'rgba(255,255,255,0.38)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    shadowColor: '#1B4B78',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    width: 46,
  },
  microcopy: {
    alignSelf: 'center',
    backgroundColor: 'rgba(12, 10, 20, 0.88)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    bottom: 174,
    paddingHorizontal: 16,
    paddingVertical: 9,
    position: 'absolute',
    zIndex: 45,
  },
  microcopyText: { fontSize: 13, fontWeight: '700' },
  residentSheet: { gap: 12 },
  residentBody: { fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
  residentHint: { fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  residentStats: { flexDirection: 'row', gap: 10 },
  residentStat: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    padding: 12,
  },
  residentStatValue: { fontSize: 22, fontWeight: '900' },
  residentStatLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
});
