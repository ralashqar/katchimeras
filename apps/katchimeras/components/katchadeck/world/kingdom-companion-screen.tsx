import { acceptDailyStoryHabit } from '@/utils/companion-life-storage';
import { useUpgradeSkinGrants } from '@/hooks/use-upgrade-skin-grants';
import { lifeConversationEntryId } from '@/utils/companion-life-recording';
import * as Haptics from 'expo-haptics';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CompanionAchievementCelebration } from '@/components/katchadeck/world/companion-achievement-celebration';
import {
  CompanionBondLevelUpCelebration,
  type CompanionBondCelebrationVariant,
} from '@/components/katchadeck/world/companion-bond-level-up-celebration';
import type { CompanionBondAwardReceipt } from '@/utils/companion-bond';
import { CompanionInteractionSheet } from '@/components/katchadeck/world/companion-interaction-sheet';
import { HomeIdentitySheet } from '@/components/katchadeck/world/home-identity-sheet';
import { ManualJournalSheet } from '@/components/katchadeck/home/manual-journal-sheet';
import { KatchimeraRosterScreen } from '@/components/katchadeck/roster/katchimera-roster-screen';
import { hasQuickGoalTemplates } from '@/constants/companion-quick-goals';
import { AppFontFamilies, KatchaDeckUI } from '@/constants/theme';
import { useAllDays } from '@/hooks/use-all-days';
import { useDevAllKatchimerasAvailable } from '@/hooks/use-dev-all-katchimeras-available';
import type { CompanionDiscoveryRecord, MergeCharacterId } from '@/types/merge-world';
import { useKingdomQuests } from '@/hooks/use-kingdom-quests';
import { useCompanionQuickGoals } from '@/hooks/use-companion-quick-goals';
import { useCompanionAchievements } from '@/hooks/use-companion-achievements';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import { useHavenTileStages } from '@/hooks/use-haven-tile-stages';
import type { ConversationNode, ConversationSession } from '@/types/companion-conversation';
import type { KatchimeraFamilyId, KatchimeraSkinId, KatchimeraWardrobeState } from '@/types/katchimera';
import type { KingdomCreature } from '@/types/kingdom';
import type { WorldIdentityState } from '@/types/world-identity';
import { deriveKingdom } from '@/utils/kingdom-engine';
import { deriveResidents, type HatchRecord } from '@/utils/kingdom-residents';
import { todayAtmosphereBackgroundForDay } from '@/utils/day-background-scene';
import {
  todayKatchimeraExplorationBackgroundKeyForEnvironment,
  todayKatchimeraExplorationBackgroundKeyForFamily,
} from '@/utils/today-exploration-backgrounds';
import { loadWorldIdentity, saveWorldIdentity } from '@/utils/world-identity';
import {
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
import { journalIdempotencyKey, journalRecordId } from '@/utils/journal-domain';
import { requestCompanionNavigationIntent } from '@/utils/companion-navigation-intent';
import { createCompanionJournalHandoff } from '@/utils/companion-journal-handoff';
import { buildCompanionJournalHandoff, type CompanionJournalHandoff } from '@/utils/companion-journal-handoff-domain';
import { buildKatchimeraRoster } from '@/utils/katchimera-roster';
import { withDevAvailableKatchimeras } from '@/utils/dev-katchimera-availability';
import { withDiscoveredKatchimeras } from '@/utils/discovered-katchimera-availability';
import { mossproutJourneyDayNumberForCompletionEvent } from '@/game/katchimeras/mossprout-journey-handoff';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { KatchimeraPageHeaderChromeProvider } from '@/components/katchadeck/world/katchimera-page-header';
import { useEconomy } from '@/features/economy/economy-provider';

/** A journal opened from the companion page: a conversation's handoff, or a small goal just completed. */
type EmbeddedJournalReview =
  | {
      origin: 'conversation';
      initialFlowId: string;
      initialChoiceId: string | null;
      noteExpanded: true;
      handoff: CompanionJournalHandoff;
      node: Extract<ConversationNode, { kind: 'journal_handoff' }>;
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

export type KingdomCompanionPresentation = 'world' | 'roster' | 'companion';

export function KingdomCompanionScreen({
  active,
  forceMossproutAvailable = false,
  presentation = 'world',
  initialCreatureId,
  onCloseCompanion,
  onOpenMerge,
  ftueConversationDefinitionId,
  initialConversationDefinitionId,
  onInitialConversationComplete,
  onFtueConversationComplete,
  onCompletedConversationExit,
  ftueOrderPreviewActive = false,
  ftueProfileStep = null,
  ftueBondSpotlightActive = false,
  ftueDayOneActionActive = false,
  ftueDayOneActionAnswerId = null,
  ftueResidentHandoffActive = false,
  ftueResidentMatchResultActive = false,
  ftueResidentStoryResume = false,
  ftueNavigationLocked = false,
  ftueCompanionSurfaceOwned = false,
  renderRegularStage = false,
  reuseUnderlyingStage = false,
  hostedNarrativeOnly = false,
  suppressWorldSpeech = false,
  onVisibleCreatureRewardPulse,
  onFtueBondSpotlightComplete,
  onFtueJourneyDayComplete,
  onFtueOpenMerge,
  onFtueProfileContinue,
  onFtueMeditationAction,
  onFtueOpenResidentParcel,
  discoveryRecords = [],
}: {
  presentation?: KingdomCompanionPresentation;
  initialCreatureId?: string;
  onCloseCompanion?: () => void;
  onOpenMerge?: (orderId?: string | null, familyId?: KatchimeraFamilyId) => void;
  ftueConversationDefinitionId?: string;
  initialConversationDefinitionId?: string;
  onInitialConversationComplete?: (session: ConversationSession) => void | Promise<void>;
  onFtueConversationComplete?: () => void | Promise<void>;
  onCompletedConversationExit?: (definitionId: string) => boolean | Promise<boolean>;
  ftueOrderPreviewActive?: boolean;
  ftueProfileStep?: 'intro_action' | 'nickname' | 'bond' | 'bond_choice' | 'garden_intro' | 'water_together' | 'first_grow' | 'notice_bond' | 'water_response' | 'first_insight' | 'meditating' | 'resident_result' | null;
  ftueBondSpotlightActive?: boolean;
  ftueDayOneActionActive?: boolean;
  ftueDayOneActionAnswerId?: string | null;
  ftueResidentHandoffActive?: boolean;
  ftueResidentMatchResultActive?: boolean;
  ftueResidentStoryResume?: boolean;
  ftueNavigationLocked?: boolean;
  ftueCompanionSurfaceOwned?: boolean;
  renderRegularStage?: boolean;
  reuseUnderlyingStage?: boolean;
  hostedNarrativeOnly?: boolean;
  suppressWorldSpeech?: boolean;
  onVisibleCreatureRewardPulse?: () => void;
  onFtueBondSpotlightComplete?: () => void | Promise<void>;
  onFtueJourneyDayComplete?: () => void;
  onFtueOpenMerge?: () => void;
  onFtueProfileContinue?: (nickname?: string) => void;
  onFtueMeditationAction?: (action: 'tend_together' | 'share_moment', optionId?: string) => void;
  onFtueOpenResidentParcel?: () => void;
  discoveryRecords?: readonly CompanionDiscoveryRecord[];
  active?: boolean;
  forceMossproutAvailable?: boolean;
}) {
  const routeFocused = useIsFocused();
  const isFocused = active ?? routeFocused;
  const router = useRouter();
  const economy = useEconomy();
  const archive = useAllDays();
  const { days } = archive;
  const allKatchimerasAvailable = useDevAllKatchimerasAvailable();
  const havenTileStages = useHavenTileStages();
  const kingdom = useMemo(() => {
    const derived = withDevAvailableKatchimeras(
      withDiscoveredKatchimeras(deriveKingdom(days), discoveryRecords),
      allKatchimerasAvailable,
    );
    if ((!ftueConversationDefinitionId && !forceMossproutAvailable) || derived.creatures.some((creature) => creature.creatureId === 'companion:mossprout')) return derived;
    const mossprout: KingdomCreature = {
      dayId: 'ftue-discovery',
      isoDate: new Date().toISOString().slice(0, 10),
      creatureId: 'companion:mossprout',
      sourceCreatureId: 'ftue-discovery-mossprout',
      companionId: 'companion:mossprout',
      aspectId: 'nature-outdoors',
      familyId: 'mossprout',
      skinId: 'mossprout',
      name: 'Mossprout',
      visualKey: 'mossprout',
      rarity: 'common',
      accentColor: '#8FBE67',
    };
    return { ...derived, creatures: [mossprout, ...derived.creatures] };
  }, [allKatchimerasAvailable, days, discoveryRecords, forceMossproutAvailable, ftueConversationDefinitionId]);

  const [identity, setIdentity] = useState<WorldIdentityState>(loadWorldIdentity);
  const [wardrobe, setWardrobe] = useState<KatchimeraWardrobeState>(loadKatchimeraWardrobe);
  const [pendingPlusSkin, setPendingPlusSkin] = useState<{ familyId: KatchimeraFamilyId; skinId: KatchimeraSkinId } | null>(null);
  const [homeIdentityOpen, setHomeIdentityOpen] = useState(false);
  const [embeddedJournal, setEmbeddedJournal] = useState<EmbeddedJournalReview | null>(null);
  const [bondCelebration, setBondCelebration] = useState<{
    continueFtueAfter?: boolean;
    journeyDayNumber?: number;
    receipt: CompanionBondAwardReceipt;
    variant: CompanionBondCelebrationVariant;
  } | null>(null);
  const { addManualJournalEntry, cloudIntelligenceEnabled } = useHomeScreenState({
    enableInteractiveServices: false,
  });
  // Form artwork is now collected as cards. Card ownership never changes the
  // persistent companion who lives in Haven.
  const presentationKingdom = kingdom;

  useEffect(
    () => subscribeKatchimeraWardrobeResets(() => setWardrobe(loadKatchimeraWardrobe())),
    [],
  );

  const upgradeSkinIds = useUpgradeSkinGrants();
  const ownedSkinIds = useMemo(
    () =>
      new Set<KatchimeraSkinId>(
        [...upgradeSkinIds, ...kingdom.creatures.flatMap((creature) =>
          creature.skinId ? [creature.skinId] : []
        )]
      ),
    [kingdom.creatures, upgradeSkinIds]
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
  const quests = useKingdomQuests({
    kingdom: presentationKingdom,
    residents,
    today,
  });
  const acknowledgeBondCelebration = quests.acknowledgeBondCelebration;
  const completeBondCelebration = useCallback((receipt: CompanionBondAwardReceipt) => {
    acknowledgeBondCelebration(receipt.id);
    if (receipt.kind === 'friendship_started') return;
    const journeyDayNumber = receipt.kind === 'journey_day_completed'
      ? mossproutJourneyDayNumberForCompletionEvent(relationshipProgressionRepository.load(), receipt.eventId) ?? undefined
      : undefined;
    if (ftueDayOneActionActive && receipt.kind === 'journey_day_completed') {
      setBondCelebration({ continueFtueAfter: true, journeyDayNumber, receipt, variant: 'journey_complete' });
      return;
    }
    if (ftueDayOneActionActive) {
      // Day 1 now continues into resident discovery before the Journey itself
      // completes. The selected Bond action advances FTUE after its own reward
      // flight; it must not wait for the later Journey-completion receipt.
      if (receipt.afterLevel > receipt.beforeLevel) {
        setBondCelebration({ continueFtueAfter: true, receipt, variant: 'level_up' });
      } else {
        onFtueJourneyDayComplete?.();
      }
      return;
    }
    if (receipt.afterLevel > receipt.beforeLevel) {
      setBondCelebration({ receipt, variant: 'level_up' });
      return;
    }
    if (receipt.kind === 'journey_day_completed') {
      setBondCelebration({ journeyDayNumber, receipt, variant: 'journey_complete' });
    }
  }, [acknowledgeBondCelebration, ftueDayOneActionActive, onFtueJourneyDayComplete]);
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
    onBondChanged: quests.refreshBondState,
  });
  const selectedFamilyId = quests.selectedResident?.creature.familyId ?? null;
  const companionAchievements = useCompanionAchievements();
  const refreshCompanionAchievements = companionAchievements.refresh;
  const achievementRefreshSignature = [
    quests.selectedBondProgress.totalPoints,
    quickGoals.state.completions.length,
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
  const selectedHomeEnvironmentStage = useMemo(() => {
    const familyId = quests.selectedResident?.creature.familyId;
    if (!familyId) return 0;
    return havenTileStages[familyId as MergeCharacterId] ?? 0;
  }, [havenTileStages, quests.selectedResident?.creature.familyId]);
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
  const activePlus = economy.snapshot.activePlus;
  const equipSelectedSkin = (skinId: KatchimeraSkinId) => {
    if (!selectedFamilyId) return;
    if (!activePlus) {
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
    if (!activePlus || !pendingPlusSkin) return;
    setWardrobe((current) => {
      const next = equipKatchimeraSkin(current, pendingPlusSkin.familyId, pendingPlusSkin.skinId);
      if (next !== current) saveKatchimeraWardrobe(next);
      return next;
    });
    setPendingPlusSkin(null);
  }, [activePlus, pendingPlusSkin]);

  // World-hosted interactions always retain the relationship context. The world
  // owns navigation and currency chrome, while this header contributes Bond only.
  const pageHeaderChromeMode = reuseUnderlyingStage ? 'hosted' : 'standard';

  return (
    <KatchimeraPageHeaderChromeProvider mode={pageHeaderChromeMode}>
    <GestureHandlerRootView style={[styles.screen, reuseUnderlyingStage && styles.transparentScreen]}>
      {presentation === 'roster' || presentation === 'world' ? (
        <KatchimeraRosterScreen
          background={kingdomBackground}
          items={rosterItems}
          onGoToday={() => router.dismissTo('/today')}
          onSelectCreature={quests.selectResident}
        />
      ) : <View style={[styles.companionRouteStage, reuseUnderlyingStage && styles.transparentScreen]} />}

      {!hostedNarrativeOnly && homeIdentityOpen ? <HomeIdentitySheet identity={identity} onChange={updateIdentity} onClose={() => setHomeIdentityOpen(false)} /> : null}

      {quests.selectedResident && !embeddedJournal ? (
        <CompanionInteractionSheet
          active={isFocused}
          key={quests.selectedResident.creature.creatureId}
          embedded={presentation === 'companion'}
          renderRegularStage={renderRegularStage}
          reuseUnderlyingStage={reuseUnderlyingStage}
          hostedNarrativeOnly={hostedNarrativeOnly}
          suppressWorldSpeech={suppressWorldSpeech}
          onVisibleCreatureRewardPulse={onVisibleCreatureRewardPulse}
          creatureId={quests.selectedResident.creature.creatureId}
          name={quests.selectedResident.creature.name}
          visualKey={quests.selectedResident.creature.visualKey}
          accentColor={quests.selectedResident.creature.accentColor}
          questionnaireBackground={kingdomBackground}
          homeEnvironmentKey={selectedHomeEnvironmentKey}
          homeEnvironmentStage={selectedHomeEnvironmentStage}
          houseLevel={quests.selectedResident.resident.houseLevel}
          initialDestination={quests.selectedResident.destination}
          initialConversationDefinitionId={ftueConversationDefinitionId ?? initialConversationDefinitionId}
          onInitialConversationComplete={onInitialConversationComplete ?? onFtueConversationComplete}
          onCompletedConversationExit={onCompletedConversationExit}
          ftueOrderPreviewActive={ftueOrderPreviewActive}
          ftueProfileStep={ftueProfileStep}
          ftueBondSpotlightActive={ftueBondSpotlightActive}
          ftueDayOneActionActive={ftueDayOneActionActive}
          ftueDayOneActionAnswerId={ftueDayOneActionAnswerId}
          ftueResidentHandoffActive={ftueResidentHandoffActive}
          ftueResidentMatchResultActive={ftueResidentMatchResultActive}
          ftueResidentStoryResume={ftueResidentStoryResume}
          ftueNavigationLocked={ftueNavigationLocked}
          ftueCompanionSurfaceOwned={ftueCompanionSurfaceOwned}
          onFtueBondSpotlightComplete={onFtueBondSpotlightComplete}
          onFtueOpenMerge={onFtueOpenMerge}
          onFtueProfileContinue={onFtueProfileContinue}
          onFtueMeditationAction={onFtueMeditationAction}
          onFtueOpenResidentParcel={onFtueOpenResidentParcel}
          onSelectDestination={quests.selectDestination}
          onClose={() => {
            quests.closeSelectedResident();
            if (presentation === 'companion') onCloseCompanion?.();
          }}
          bondProgress={quests.selectedBondProgress}
          pendingBondCelebration={hostedNarrativeOnly || bondCelebration ? null : quests.selectedPendingBondCelebration}
          onBondCelebrationComplete={completeBondCelebration}
          skins={selectedSkinOptions}
          onEquipSkin={equipSelectedSkin}
          journeyDefinition={quests.selectedJourneyDefinition}
          journeyGoals={quests.selectedJourneyGoals}
          journeyConversation={quests.selectedJourneyConversation}
          journeyNode={quests.selectedJourneyNode}
          onStartJourneyConversation={quests.startSelectedJourneyConversation}
          onAnswerJourneyConversation={quests.answerSelectedJourneyConversation}
          onCompleteJourneyQuestionnaire={quests.completeSelectedJourneyQuestionnaire}
          familyId={quests.selectedResident.creature.familyId ?? 'mossprout'}
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
            if (addedTemplateIds.length) quests.refreshBondState();
            return addedTemplateIds;
          }}
          onDismissQuickGoalSuggestions={quests.dismissQuickGoalSuggestions}
          conversationSession={quests.selectedConversationSession}
          conversationDefinition={quests.selectedConversationDefinition}
          mossproutActionCandidates={quests.selectedMossproutActionCandidates}
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
            if (addedTemplateIds.length && !quests.selectedConversationSession?.preview) quests.refreshBondState();
          }}
          onOpenMerge={(orderId, familyId) => onOpenMerge
            ? onOpenMerge(orderId, familyId)
            : router.navigate({
                pathname: '/games',
                params: { familyId: familyId ?? quests.selectedResident?.creature.familyId ?? 'mossprout', ...(orderId ? { focusOrderId: orderId } : {}) },
              })}
          onJournalFood={() => {
            const resident = quests.selectedResident;
            if (!resident) return;
            const handoff = createCompanionJournalHandoff({
              mode: 'optional',
              familyId: resident.creature.familyId ?? 'mossprout',
              creatureId: resident.creature.creatureId,
              target: today?.state === 'hatched' ? 'tomorrow' : 'today',
            });
            requestCompanionNavigationIntent({ kind: 'journal_handoff', handoffId: handoff.id });
            router.dismissTo('/today');
          }}
          onOpenTodayGoals={() => {
            requestCompanionNavigationIntent({ kind: 'quick_goals' });
            router.dismissTo('/today');
          }}
          onInsightConversationDecision={quests.decideSelectedConversationInsight}
          onQuickGoalConversationDecision={(accept, node) => {
            const added = accept && !quests.selectedConversationSession?.preview
              ? node.storyDaily && (quests.selectedConversationDefinition?.familyId === 'mossprout' || quests.selectedConversationDefinition?.familyId === 'steppling')
                ? Boolean(acceptDailyStoryHabit(quests.selectedConversationDefinition.familyId, node.templateId, lifeConversationEntryId(quests.selectedConversationDefinition.id) ?? undefined))
                : quickGoals.addTemplates([node.templateId]).includes(node.templateId)
              : false;
            quests.decideSelectedConversationQuickGoal(accept, added, node);
          }}
          onJournalConversationHandoff={(open, node) => {
            if (!open) {
              quests.decideSelectedConversationJournalHandoff(false, node);
              return;
            }
            const session = quests.selectedConversationSession;
            const resident = quests.selectedResident;
            if (!session || !resident) return;
            if (session.preview) {
              quests.decideSelectedConversationJournalHandoff(true, node);
              return;
            }
            quests.recordSelectedConversationJournalHandoffOpened(node);
            const handoff = buildCompanionJournalHandoff({
              mode: 'story',
              familyId: session.familyId,
              creatureId: resident.creature.creatureId,
              session,
              node,
              target: 'today',
              now: Date.now(),
            });
            setEmbeddedJournal({
              origin: 'conversation',
              initialFlowId: handoff.flowId,
              initialChoiceId: handoff.initialChoiceId,
              noteExpanded: true,
              handoff,
              node,
            });
          }}
          onDismissConversationOutcome={quests.dismissSelectedConversationOutcome}
          memories={quests.selectedMemories}
          onUpdateMemory={quests.updateSelectedMemory}
        />
      ) : null}
      {embeddedJournal ? (
        <ManualJournalSheet
          allowRemoteIntelligence={cloudIntelligenceEnabled}
          entryVariant="standard"
          dayLocationPoints={today?.locations}
          initialFlowId={embeddedJournal.initialFlowId}
          initialChoiceId={'initialChoiceId' in embeddedJournal ? embeddedJournal.initialChoiceId : undefined}
          allowedChoiceIds={embeddedJournal.origin === 'conversation' ? embeddedJournal.handoff.allowedChoiceIds : undefined}
          promptBody={embeddedJournal.origin === 'conversation' ? embeddedJournal.handoff.body : undefined}
          promptTitle={embeddedJournal.origin === 'conversation' ? embeddedJournal.handoff.title : undefined}
          saveLabel={embeddedJournal.origin === 'conversation' ? embeddedJournal.handoff.saveLabel : undefined}
          initialSpecific={embeddedJournal.origin === 'quick_goal' ? embeddedJournal.goal.title : undefined}
          initialNote={embeddedJournal.origin === 'quick_goal'
            ? `I completed: ${embeddedJournal.goal.title}`
            : embeddedJournal.handoff.generatedDraft ?? undefined}
          initialNoteExpanded={embeddedJournal.noteExpanded}
          journalSource={embeddedJournal.origin === 'conversation' ? {
            kind: 'manual',
            sourceId: embeddedJournal.handoff.id,
            origin: {
              kind: 'companion_reflection',
              creatureId: embeddedJournal.handoff.creatureId,
              familyId: embeddedJournal.handoff.familyId,
              promptId: embeddedJournal.node.id,
              promptText: embeddedJournal.node.prompt,
              answerIds: embeddedJournal.handoff.answerIds,
              reflectionMode: 'story',
            },
          } : {
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
          }}
          returnToOriginOnBack
          onBackFromInitial={() => setEmbeddedJournal(null)}
          onClose={() => {
            setEmbeddedJournal(null);
            if (embeddedJournal.origin !== 'conversation') quests.closeSelectedResident();
          }}
          onSave={(submission) => {
            addManualJournalEntry(submission, 'today');
            if (embeddedJournal.origin === 'conversation') {
              const source = submission.journalSource ?? {
                kind: 'manual' as const,
                sourceId: embeddedJournal.handoff.id,
              };
              const recordId = journalRecordId(journalIdempotencyKey(
                source,
                submission.sessionId ?? embeddedJournal.handoff.id,
              ));
              quests.decideSelectedConversationJournalHandoff(true, embeddedJournal.node, recordId);
            }
            if (embeddedJournal.origin === 'quick_goal') {
              quickGoals.markJournaled(embeddedJournal.completion.id);
            }
            setEmbeddedJournal(null);
            if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        />
      ) : null}
      {isFocused && !hostedNarrativeOnly && bondCelebration ? (
        <CompanionBondLevelUpCelebration
          autoContinue={!ftueDayOneActionActive}
          continueLabel={ftueDayOneActionActive ? 'Hear Mossprout\'s story' : undefined}
          dismissible={!ftueDayOneActionActive}
          journeyDayNumber={bondCelebration.journeyDayNumber}
          journeyHandoff={ftueDayOneActionActive ? {
            dayNumber: 1,
            recap: ['You met Mossprout', 'You restored the Quiet Patch', 'You chose one Bond moment'],
            tomorrowPreview: 'New growth begins tomorrow.',
          } : undefined}
          onContinue={() => {
            const finishesFtue = bondCelebration.continueFtueAfter === true;
            setBondCelebration(null);
            if (finishesFtue) onFtueJourneyDayComplete?.();
          }}
          receipt={bondCelebration.receipt}
          variant={bondCelebration.variant}
        />
      ) : null}
      {isFocused && !hostedNarrativeOnly && companionAchievements.pending.length > 0 && !bondCelebration && !quests.selectedPendingBondCelebration && !embeddedJournal ? (
        <CompanionAchievementCelebration
          achievements={companionAchievements.pending}
          onAchievementSeen={(id) => companionAchievements.markSeen([id])}
        />
      ) : null}
    </GestureHandlerRootView>
    </KatchimeraPageHeaderChromeProvider>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#55A9E2', flex: 1 },
  transparentScreen: { backgroundColor: 'transparent' },
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
