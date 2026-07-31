import * as Haptics from 'expo-haptics';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  KingdomHexCanvas,
  kingdomResidentHexTiles,
} from '@/components/katchadeck/world/kingdom-hex-canvas';
import { DiscoveriesHallSheet } from '@/components/katchadeck/world/discoveries-hall-sheet';
import { CompanionInteractionSheet } from '@/components/katchadeck/world/companion-interaction-sheet';
import { HomeIdentitySheet } from '@/components/katchadeck/world/home-identity-sheet';
import { ZodiacTileSheet } from '@/components/katchadeck/world/zodiac-tile-sheet';
import { ManualJournalSheet } from '@/components/katchadeck/home/manual-journal-sheet';
import { KatchimeraRosterScreen } from '@/components/katchadeck/roster/katchimera-roster-screen';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { hasQuickGoalTemplates } from '@/constants/companion-quick-goals';
import { AppFontFamilies, KatchaDeckUI, Lantern } from '@/constants/theme';
import { useAllDays } from '@/hooks/use-all-days';
import { useDiscoveriesFromArchive } from '@/hooks/use-discoveries';
import { useKingdomQuests } from '@/hooks/use-kingdom-quests';
import { useCompanionQuickGoals } from '@/hooks/use-companion-quick-goals';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import type { CompanionReflectionDraft } from '@/types/companion-interaction';
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
} from '@/utils/katchimera-wardrobe-storage';
import { companionIdForFamily } from '@/constants/katchimera-skins';
import type { CompanionQuickGoal, CompanionQuickGoalCompletion } from '@/utils/companion-quick-goals';
import { questDefinition } from '@/utils/quests/definitions';
import { buildKatchimeraRoster } from '@/utils/katchimera-roster';

type EmbeddedJournalReview =
  | {
      origin: 'insight' | 'quest';
      initialFlowId: string;
      initialChoiceId?: string | null;
      noteExpanded: boolean;
    }
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

export type KingdomCompanionPresentation = 'world' | 'roster';

export function KingdomCompanionScreen({
  presentation = 'world',
}: {
  presentation?: KingdomCompanionPresentation;
}) {
  const isFocused = useIsFocused();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const archive = useAllDays();
  const { days } = archive;
  const kingdom = useMemo(() => deriveKingdom(days), [days]);
  const {
    entries: discoveryEntries,
    unlockedCount: discoveriesUnlocked,
    totalCount: discoveriesTotal,
  } = useDiscoveriesFromArchive(archive);

  const [discoveriesOpen, setDiscoveriesOpen] = useState(false);
  const [identity, setIdentity] = useState<WorldIdentityState>(loadWorldIdentity);
  const [wardrobe, setWardrobe] = useState<KatchimeraWardrobeState>(loadKatchimeraWardrobe);
  const [homeIdentityOpen, setHomeIdentityOpen] = useState(false);
  const [zodiacOpen, setZodiacOpen] = useState(false);
  const [embeddedJournal, setEmbeddedJournal] = useState<EmbeddedJournalReview | null>(null);
  const [savedOrigin, setSavedOrigin] = useState<'insight' | 'quest' | null>(null);
  const [questExperienceActive, setQuestExperienceActive] = useState(false);
  const { addManualJournalEntry, cloudIntelligenceEnabled } = useHomeScreenState({
    enableInteractiveServices: false,
  });
  const presentationKingdom = useMemo(
    () => applyWardrobeToKingdom(kingdom, wardrobe),
    [kingdom, wardrobe]
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
  const residentTiles = useMemo(
    () => kingdomResidentHexTiles(residents, presentationKingdom.creatures),
    [presentationKingdom.creatures, residents]
  );
  const eggVisual = useMemo(() => days.find((day) => day.isToday)?.egg ?? days[days.length - 1]?.egg ?? null, [days]);
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
  const selectedHomeEnvironmentKey = useMemo(() => {
    const creature = quests.selectedResident?.creature;
    if (!creature) return null;

    // The companion hub is the Katchimera's permanent home, not a replay of
    // the mixed day scene in which this particular hatch happened.
    return (
      todayKatchimeraExplorationBackgroundKeyForEnvironment(creature.visualKey)
      ?? todayKatchimeraExplorationBackgroundKeyForFamily(creature.familyId)
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
    const next = equipKatchimeraSkin(wardrobe, selectedFamilyId, skinId);
    if (next === wardrobe) return;
    saveKatchimeraWardrobe(next);
    setWardrobe(next);
  };
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
    quests.awardSelectedInsightBond();
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

  const handleQuestAction = () => {
    const action = quests.selectedQuestRuntime?.nextAction;
    if (action === 'add_note' || action === 'record_voice') {
      const definition = quests.selectedQuestRuntime
        ? questDefinition(quests.selectedQuestRuntime.questId)
        : null;
      if (definition?.semanticVerification) {
        quests.performSelectedQuestAction();
        return;
      }
      setEmbeddedJournal({ origin: 'quest', initialFlowId: 'general', noteExpanded: true });
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

  const subtitle = [
    `${kingdom.totals.daysHatched} ${kingdom.totals.daysHatched === 1 ? 'day' : 'days'}`,
    `${residents.length} ${residents.length === 1 ? 'tile' : 'tiles'}`,
    `${discoveriesUnlocked}/${discoveriesTotal} discoveries`,
  ].join('  ·  ');

  return (
    <GestureHandlerRootView style={styles.screen}>
      {presentation === 'roster' ? (
        <KatchimeraRosterScreen
          background={kingdomBackground}
          items={rosterItems}
          onGoToday={() => router.navigate('/today')}
          onSelectCreature={quests.selectResident}
        />
      ) : (
      <View style={styles.stage}>
        {isFocused && !questExperienceActive ? (
          <KingdomHexCanvas
            background={kingdomBackground}
            residents={residentTiles}
            identity={identity}
            eggVisual={eggVisual}
            residentStatusGlyphs={quests.residentStatusGlyphs}
            onSelectResident={quests.selectResident}
            onSelectHome={() => setHomeIdentityOpen(true)}
            onSelectZodiac={() => setZodiacOpen(true)}
          />
        ) : null}

        <View pointerEvents="none" style={[styles.header, { top: insets.top + 12 }]}>
          <ThemedText style={styles.headerKicker} lightColor="#FFD36E" darkColor="#FFD36E">
            YOUR KINGDOM
          </ThemedText>
          <ThemedText style={styles.headerSubtitle} lightColor="#F8FCFF" darkColor="#F8FCFF">
            {subtitle}
          </ThemedText>
        </View>

        <View pointerEvents="box-none" style={[styles.actionRail, { top: insets.top + 14 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Hall of Discoveries" onPress={() => setDiscoveriesOpen(true)} style={styles.headerButton}>
            <IconSymbol name="star.fill" size={18} color={Lantern.moon50} />
          </Pressable>
        </View>

        {quests.microcopy ? (
          <Animated.View
            key={quests.microcopy}
            entering={FadeInDown.duration(240)}
            exiting={FadeOut.duration(180)}
            pointerEvents="none"
            style={styles.microcopy}>
            <ThemedText style={styles.microcopyText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              {quests.microcopy}
            </ThemedText>
          </Animated.View>
        ) : null}
      </View>
      )}

      {discoveriesOpen ? (
        <DiscoveriesHallSheet
          entries={discoveryEntries}
          unlockedCount={discoveriesUnlocked}
          totalCount={discoveriesTotal}
          onClose={() => setDiscoveriesOpen(false)}
        />
      ) : null}
      {homeIdentityOpen ? <HomeIdentitySheet identity={identity} onChange={updateIdentity} onClose={() => setHomeIdentityOpen(false)} /> : null}
      {zodiacOpen ? <ZodiacTileSheet identity={identity} onChange={updateIdentity} onClose={() => setZodiacOpen(false)} /> : null}

      {quests.selectedResident && !embeddedJournal ? (
        <CompanionInteractionSheet
          onExperienceActiveChange={setQuestExperienceActive}
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
          }}
          activeQuest={quests.selectedActiveQuest ? {
            title: quests.selectedActiveQuest.title,
            hint: quests.selectedActiveQuest.hint,
            semanticInput: Boolean(questDefinition(quests.selectedActiveQuest.questId)?.semanticVerification),
            journalFallback: quests.selectedSemanticJournalFallbackActive,
            execution: quests.selectedInteractiveExecution,
            resolvedConfig: quests.selectedActiveQuest.resolvedConfig,
            offerSeed: quests.selectedActiveQuest.offerSeed,
          } : null}
          questComplete={Boolean(quests.selectedQuestRuntime?.complete)}
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
          insight={quests.selectedInsight ?? { text: 'This tile remembers the day we met.', action: null }}
          onInsightAction={handleInsightAction}
          memorySaved={Boolean(savedOrigin)}
          bondProgress={quests.selectedBondProgress}
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
        />
      ) : null}
      {embeddedJournal ? (
        <ManualJournalSheet
          allowRemoteIntelligence={cloudIntelligenceEnabled}
          dayLocationPoints={today?.locations}
          initialFlowId={embeddedJournal.initialFlowId}
          initialChoiceId={'initialChoiceId' in embeddedJournal ? embeddedJournal.initialChoiceId : undefined}
          initialSpecific={embeddedJournal.origin === 'quick_goal' ? embeddedJournal.goal.title : undefined}
          initialNote={embeddedJournal.origin === 'quick_goal' ? `I completed: ${embeddedJournal.goal.title}` : undefined}
          initialNoteExpanded={embeddedJournal.noteExpanded}
          journalSource={embeddedJournal.origin === 'quick_goal' ? {
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
          } : undefined}
          returnToOriginOnBack
          onBackFromInitial={() => setEmbeddedJournal(null)}
          onClose={() => { setEmbeddedJournal(null); quests.closeSelectedResident(); }}
          onSave={(submission) => {
            addManualJournalEntry(submission, 'today');
            const origin = embeddedJournal.origin;
            if (embeddedJournal.origin === 'quick_goal') {
              quickGoals.markJournaled(embeddedJournal.completion.id);
            }
            setEmbeddedJournal(null);
            setSavedOrigin(origin === 'quick_goal' ? null : origin);
            if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        />
      ) : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#55A9E2', flex: 1 },
  stage: { flex: 1 },
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
