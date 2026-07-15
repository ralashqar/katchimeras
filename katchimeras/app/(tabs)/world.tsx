import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import {
  KingdomHexCanvas,
  kingdomResidentHexTiles,
} from '@/components/katchadeck/world/kingdom-hex-canvas';
import { DiscoveriesHallSheet } from '@/components/katchadeck/world/discoveries-hall-sheet';
import { CompanionInteractionSheet } from '@/components/katchadeck/world/companion-interaction-sheet';
import { HomeIdentitySheet } from '@/components/katchadeck/world/home-identity-sheet';
import { ZodiacTileSheet } from '@/components/katchadeck/world/zodiac-tile-sheet';
import { ManualJournalSheet } from '@/components/katchadeck/home/manual-journal-sheet';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaDeckUI, Lantern } from '@/constants/theme';
import { useAllDays } from '@/hooks/use-all-days';
import { useDiscoveriesFromArchive } from '@/hooks/use-discoveries';
import { useKingdomQuests } from '@/hooks/use-kingdom-quests';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import type { CompanionReflectionDraft } from '@/types/companion-interaction';
import type { JournalRouteProposal, JournalSource } from '@/types/home';
import type { KingdomCreature } from '@/types/kingdom';
import type { WorldIdentityState } from '@/types/world-identity';
import { openingLine, reflectionLine } from '@/utils/katchimera-engagement';
import { deriveKingdom } from '@/utils/kingdom-engine';
import { deriveResidents, type HatchRecord } from '@/utils/kingdom-residents';
import { resolveFactsForDay } from '@/utils/signals/resolve';
import { noteJournalInputAdapter } from '@/utils/journal-input-adapters';
import { journalRouteNeedsConfirmation } from '@/utils/journal-routing';
import { loadWorldIdentity, saveWorldIdentity } from '@/utils/world-identity';

type ReflectionReview = {
  draft: CompanionReflectionDraft;
  source: Extract<JournalSource, { kind: 'text_note' | 'voice_note' }>;
  route: JournalRouteProposal | null;
  suggestedSpecific: string | null;
};

type EmbeddedJournalReview = {
  origin: 'insight' | 'quest';
  initialFlowId: string;
  initialChoiceId?: string | null;
  noteExpanded: boolean;
};

// The Kingdom tab is the persistent hex map: center egg, then one tile per
// unique Katchimera in hatch order. Capture stays on Today; this is the archive.

function hatchTimestamp(creature: KingdomCreature, index: number): number {
  const time = Date.parse(`${creature.isoDate}T00:00:00`);
  return Number.isFinite(time) ? time + index : index;
}

export default function KingdomScreen() {
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
  const [homeIdentityOpen, setHomeIdentityOpen] = useState(false);
  const [zodiacOpen, setZodiacOpen] = useState(false);
  const [reflectionDraft, setReflectionDraft] = useState<CompanionReflectionDraft | null>(null);
  const [reflectionReview, setReflectionReview] = useState<ReflectionReview | null>(null);
  const [reflectionReviewPending, setReflectionReviewPending] = useState(false);
  const [embeddedJournal, setEmbeddedJournal] = useState<EmbeddedJournalReview | null>(null);
  const [savedOrigin, setSavedOrigin] = useState<'reflection' | 'insight' | 'quest' | null>(null);
  const { addManualJournalEntry } = useHomeScreenState();

  const hatches = useMemo<HatchRecord[]>(
    () =>
      kingdom.creatures.map((creature, index) => ({
        creatureId: creature.creatureId,
        hatchedAt: hatchTimestamp(creature, index),
      })),
    [kingdom.creatures]
  );
  const residents = useMemo(() => deriveResidents(hatches), [hatches]);
  const residentTiles = useMemo(() => kingdomResidentHexTiles(residents, kingdom.creatures), [kingdom.creatures, residents]);
  const eggVisual = useMemo(() => days.find((day) => day.isToday)?.egg ?? days[days.length - 1]?.egg ?? null, [days]);
  const today = useMemo(() => days.find((day) => day.isToday) ?? null, [days]);
  const yesterday = useMemo(() => {
    if (!today) return null;
    const index = days.findIndex((day) => day.id === today.id);
    return index > 0 ? days[index - 1] : null;
  }, [days, today]);
  const todayFacts = useMemo(() => resolveFactsForDay(today, yesterday), [today, yesterday]);
  const quests = useKingdomQuests({ kingdom, residents, today, todayFacts });

  useEffect(() => {
    if (!identity.selectedHomeArchetypeId) {
      const seeded: WorldIdentityState = { ...identity, selectedHomeArchetypeId: 'explorer', recommendedHomeArchetypeId: 'explorer' };
      setIdentity(seeded);
      saveWorldIdentity(seeded);
      setHomeIdentityOpen(true);
    }
  }, [identity]);

  const updateIdentity = (next: WorldIdentityState) => {
    setIdentity(next);
    saveWorldIdentity(next);
  };
  const closeSelectedResident = quests.closeSelectedResident;
  const refreshQuestState = quests.refreshQuestState;

  useEffect(() => {
    if (!savedOrigin) return;
    const timeout = setTimeout(() => {
      refreshQuestState();
      setSavedOrigin(null);
      if (savedOrigin === 'reflection') {
        setReflectionDraft(null);
        closeSelectedResident();
      }
    }, 1250);
    return () => clearTimeout(timeout);
  }, [closeSelectedResident, refreshQuestState, savedOrigin]);

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
      setEmbeddedJournal({ origin: 'quest', initialFlowId: 'general', noteExpanded: true });
      return;
    }
    quests.performSelectedQuestAction();
  };

  const reviewReflection = async (draft: CompanionReflectionDraft) => {
    if (!quests.selectedResident || reflectionReviewPending) return;
    setReflectionReviewPending(true);
    setReflectionDraft(draft);
    const sourceId = `companion-reflection:${quests.selectedResident.creature.creatureId}:${Date.now().toString(36)}`;
    const origin = {
      kind: 'companion_reflection' as const,
      creatureId: quests.selectedResident.creature.creatureId,
      promptId: draft.promptId,
      promptText: draft.promptText,
    };
    const source: ReflectionReview['source'] = draft.kind === 'voice'
      ? { kind: 'voice_note', sourceId, audioUri: draft.audioUri ?? null, durationMs: draft.durationMs ?? null, origin }
      : { kind: 'text_note', sourceId, origin };
    try {
      const analysis = await noteJournalInputAdapter.analyze({ source, text: draft.text, audioUri: draft.audioUri ?? undefined }, { allowRemote: false });
      const route = journalRouteNeedsConfirmation(analysis.routes) ? null : analysis.routes[0] ?? null;
      setReflectionReview({ draft, source, route, suggestedSpecific: analysis.suggestedSpecific ?? null });
    } catch {
      setReflectionReview({ draft, source, route: null, suggestedSpecific: null });
    } finally {
      setReflectionReviewPending(false);
    }
  };

  const subtitle = [
    `${kingdom.totals.daysHatched} ${kingdom.totals.daysHatched === 1 ? 'day' : 'days'}`,
    `${residents.length} ${residents.length === 1 ? 'tile' : 'tiles'}`,
    `${discoveriesUnlocked}/${discoveriesTotal} discoveries`,
  ].join('  ·  ');

  return (
    <GestureHandlerRootView style={styles.screen}>
      <AmbientBackground
        accentColor="rgba(125,232,205,0.12)"
        colors={KatchaDeckUI.gradients.world}
        meshColors={['rgba(125,232,205,0.12)', 'rgba(167,139,250,0.10)', 'rgba(255,195,107,0.07)', 'rgba(20,17,31,0.25)']}
      />

      <View style={styles.stage}>
        <KingdomHexCanvas
          residents={residentTiles}
          identity={identity}
          eggVisual={eggVisual}
          residentStatusGlyphs={quests.residentStatusGlyphs}
          onSelectResident={quests.selectResident}
          onSelectHome={() => setHomeIdentityOpen(true)}
          onSelectZodiac={() => setZodiacOpen(true)}
        />

        <View pointerEvents="none" style={styles.header}>
          <ThemedText type="onboardingLabel" style={styles.headerKicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            Your Kingdom
          </ThemedText>
          <ThemedText style={styles.headerSubtitle} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            {subtitle}
          </ThemedText>
        </View>

        <View pointerEvents="box-none" style={styles.actionRail}>
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

      {quests.selectedResident && !reflectionReview && !embeddedJournal ? (
        <CompanionInteractionSheet
          creatureId={quests.selectedResident.creature.creatureId}
          name={quests.selectedResident.creature.name}
          visualKey={quests.selectedResident.creature.visualKey}
          accentColor={quests.selectedResident.creature.accentColor}
          houseLevel={quests.selectedResident.resident.houseLevel}
          openingLine={openingLine(quests.selectedResident.creature.name, quests.selectedInteractionState)}
          initialThread={quests.selectedResident.thread ?? 'insight'}
          onSelectThread={quests.selectThread}
          onClose={() => { setReflectionDraft(null); quests.closeSelectedResident(); }}
          activeQuest={quests.selectedActiveQuest ? {
            title: quests.selectedActiveQuest.title,
            hint: quests.selectedActiveQuest.hint,
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
          reflectionText={reflectionLine(quests.selectedCompanionData?.archetype ?? '')}
          initialReflectionDraft={reflectionDraft}
          onReflectionDraftChange={setReflectionDraft}
          onReviewReflection={(draft) => { void reviewReflection(draft); }}
          reflectionReviewPending={reflectionReviewPending}
          memorySaved={Boolean(savedOrigin)}
          bondProgress={quests.selectedBondProgress}
        />
      ) : null}
      {reflectionReview ? (
        <ManualJournalSheet
          initialFlowId={reflectionReview.route?.flowId}
          initialChoiceId={reflectionReview.route?.choiceId}
          initialSpecific={reflectionReview.suggestedSpecific}
          initialNote={reflectionReview.draft.text}
          initialLinkedNote={reflectionReview.draft}
          initialConfirmedFacets={reflectionReview.route?.confirmedFacets}
          journalSource={reflectionReview.source}
          onBackFromInitial={() => setReflectionReview(null)}
          onClose={() => { setReflectionReview(null); setReflectionDraft(null); quests.closeSelectedResident(); }}
          onSave={(submission) => {
            addManualJournalEntry(submission, 'today');
            quests.awardSelectedReflectionBond(reflectionReview.source.sourceId);
            setReflectionReview(null);
            setSavedOrigin('reflection');
            if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        />
      ) : null}
      {embeddedJournal ? (
        <ManualJournalSheet
          initialFlowId={embeddedJournal.initialFlowId}
          initialChoiceId={embeddedJournal.initialChoiceId}
          initialNoteExpanded={embeddedJournal.noteExpanded}
          returnToOriginOnBack
          onBackFromInitial={() => setEmbeddedJournal(null)}
          onClose={() => { setEmbeddedJournal(null); quests.closeSelectedResident(); }}
          onSave={(submission) => {
            addManualJournalEntry(submission, 'today');
            const origin = embeddedJournal.origin;
            setEmbeddedJournal(null);
            setSavedOrigin(origin);
            if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        />
      ) : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Lantern.ink950, flex: 1 },
  stage: { flex: 1 },
  header: {
    left: 20,
    position: 'absolute',
    right: 76,
    top: 64,
  },
  headerKicker: { fontSize: 13, letterSpacing: 1.2 },
  headerSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  actionRail: {
    alignItems: 'center',
    gap: 12,
    position: 'absolute',
    right: 14,
    top: 64,
    zIndex: 30,
  },
  headerButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(28,24,48,0.86)',
    borderColor: 'rgba(196,186,240,0.16)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
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
