import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import {
  KingdomHexCanvas,
  kingdomResidentHexTiles,
} from '@/components/katchadeck/world/kingdom-hex-canvas';
import { DiscoveriesHallSheet } from '@/components/katchadeck/world/discoveries-hall-sheet';
import { CompanionCard, type CompanionThread } from '@/components/katchadeck/world/companion-card';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaDeckUI, Lantern } from '@/constants/theme';
import { useAllDays } from '@/hooks/use-all-days';
import { useDiscoveries } from '@/hooks/use-discoveries';
import { useKingdom } from '@/hooks/use-kingdom';
import { useQuestCapabilities } from '@/hooks/use-quest-capabilities';
import { homeRepository } from '@/storage/repositories/home-repository';
import type { KingdomCreature } from '@/types/kingdom';
import type { CompanionQuestState } from '@/utils/katchimera-quests';
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
} from '@/utils/katchimera-quests';
import {
  archetypeForCreature,
  companionUnit,
  openingLine,
  reflectionLine,
  subtypeForCreature,
} from '@/utils/katchimera-engagement';
import { deriveResidents, type HatchRecord, type KingdomResident } from '@/utils/kingdom-residents';
import { buildQuestReportBackItems, buildQuestSubmissionItems, type QuestSubmissionItem } from '@/utils/quests/report-back-evidence';
import { evaluateQuestRuntime } from '@/utils/quests/runtime';
import { requestQuestActionIntent } from '@/utils/quest-action-signal';
import { resolveFactsForDay } from '@/utils/signals/resolve';

// The Kingdom tab is the persistent hex map: center egg, then one tile per
// unique Katchimera in hatch order. Capture stays on Today; this is the archive.

function hatchTimestamp(creature: KingdomCreature, index: number): number {
  const time = Date.parse(`${creature.isoDate}T00:00:00`);
  return Number.isFinite(time) ? time + index : index;
}

export default function KingdomScreen() {
  const router = useRouter();
  const { kingdom } = useKingdom();
  const { days } = useAllDays();
  const {
    entries: discoveryEntries,
    unlockedCount: discoveriesUnlocked,
    totalCount: discoveriesTotal,
  } = useDiscoveries();

  const [discoveriesOpen, setDiscoveriesOpen] = useState(false);
  const [microcopy, setMicrocopy] = useState<string | null>(null);
  const [selectedResident, setSelectedResident] = useState<{ resident: KingdomResident; creature: KingdomCreature; thread: CompanionThread | null } | null>(null);
  const [companionQuestState, setCompanionQuestState] = useState<CompanionQuestState>(() => loadCompanionQuests());
  const [storedHomeState, setStoredHomeState] = useState(() => homeRepository.load());
  const { capabilities: questCapabilities } = useQuestCapabilities(storedHomeState);

  useFocusEffect(
    useCallback(() => {
      setCompanionQuestState(loadCompanionQuests());
      setStoredHomeState(homeRepository.load());
    }, [])
  );

  useEffect(() => {
    if (!microcopy) return;
    const timeout = setTimeout(() => setMicrocopy(null), 2300);
    return () => clearTimeout(timeout);
  }, [microcopy]);

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
  const residentById = useMemo(() => new Map(residents.map((resident) => [resident.creatureId, resident])), [residents]);
  const creatureById = useMemo(() => new Map(kingdom.creatures.map((creature) => [creature.creatureId, creature])), [kingdom.creatures]);
  const eggVisual = useMemo(() => days.find((day) => day.isToday)?.egg ?? days[days.length - 1]?.egg ?? null, [days]);
  const today = useMemo(() => days.find((day) => day.isToday) ?? null, [days]);
  const yesterday = useMemo(() => {
    if (!today) return null;
    const index = days.findIndex((day) => day.id === today.id);
    return index > 0 ? days[index - 1] : null;
  }, [days, today]);
  const todayFacts = useMemo(() => resolveFactsForDay(today, yesterday), [today, yesterday]);

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
        offer &&
          today?.isoDate &&
          !hasCompanionQuestForDay(companionQuestState, creature.creatureId, today.isoDate)
      );
      const state = interactionState(companionQuestState, creature.creatureId, todayFacts, hasOffer, questCapabilities);
      if (state !== 'idle') {
        glyphs[creature.creatureId] = state;
      }
    }
    return glyphs;
  }, [companionDataByCreatureId, companionQuestState, kingdom.creatures, questCapabilities, today?.isoDate, todayFacts]);

  const selectedCompanionData = selectedResident ? companionDataByCreatureId.get(selectedResident.creature.creatureId) : null;
  const selectedActiveQuest = selectedResident ? questFor(companionQuestState, selectedResident.creature.creatureId) : null;
  const selectedQuestRuntime = useMemo(
    () =>
      selectedActiveQuest
        ? evaluateQuestRuntime({
            questId: selectedActiveQuest.questId,
            day: today,
            facts: todayFacts,
            capabilities: questCapabilities,
          })
        : null,
    [questCapabilities, selectedActiveQuest, today, todayFacts]
  );
  const selectedQuestItems = useMemo(() => {
    if (!selectedActiveQuest || !selectedQuestRuntime) return [];
    if (selectedQuestRuntime.readyToSubmit) {
      return buildQuestSubmissionItems(today, selectedQuestRuntime, selectedActiveQuest, companionQuestState.submissions);
    }
    if (selectedQuestRuntime.complete) {
      return buildQuestReportBackItems(today, selectedQuestRuntime);
    }
    return [];
  }, [companionQuestState.submissions, selectedActiveQuest, selectedQuestRuntime, today]);
  const selectedOffer =
    selectedResident && selectedCompanionData?.quest && today?.isoDate &&
    !selectedActiveQuest &&
    !hasCompanionQuestForDay(companionQuestState, selectedResident.creature.creatureId, today.isoDate)
      ? selectedCompanionData.quest
      : undefined;
  const selectedInteractionState = selectedResident
    ? interactionState(companionQuestState, selectedResident.creature.creatureId, todayFacts, Boolean(selectedOffer), questCapabilities)
    : 'idle';

  const commitCompanionQuestState = useCallback((next: CompanionQuestState) => {
    saveCompanionQuests(next);
    setCompanionQuestState(next);
  }, []);

  const handleSelectResident = (creatureId: string) => {
    const resident = residentById.get(creatureId);
    const creature = creatureById.get(creatureId);
    if (resident && creature) setSelectedResident({ resident, creature, thread: 'quest' });
  };

  const handleAcceptQuest = () => {
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
  };

  const handleCashInQuest = () => {
    if (!selectedResident) return;
    commitCompanionQuestState(completeQuest(companionQuestState, selectedResident.creature.creatureId, Date.now(), today?.isoDate ?? null));
    setMicrocopy('Quest complete');
    setSelectedResident(null);
  };

  const handleSubmitQuest = (item: QuestSubmissionItem) => {
    if (!selectedResident) return;
    const result = submitQuest(
      companionQuestState,
      selectedResident.creature.creatureId,
      {
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        evidenceId: item.evidenceId,
      },
      Date.now(),
      today?.isoDate ?? null
    );
    commitCompanionQuestState(result.state);
    setMicrocopy(result.submitted ? 'Quest submitted' : 'Already submitted');
    if (result.submitted) setSelectedResident(null);
  };

  const handleQuestAction = () => {
    if (!selectedQuestRuntime || selectedQuestRuntime.nextAction === 'none') return;
    requestQuestActionIntent({
      action: selectedQuestRuntime.nextAction,
      questId: selectedQuestRuntime.questId,
    });
    setSelectedResident(null);
    router.push('/today');
  };

  const handleAnswerReflection = () => {
    requestQuestActionIntent({ action: 'add_note' });
    setSelectedResident(null);
    router.push('/today');
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
          eggVisual={eggVisual}
          residentStatusGlyphs={residentStatusGlyphs}
          onSelectResident={(creatureId) => handleSelectResident(creatureId)}
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

        {microcopy ? (
          <Animated.View
            key={microcopy}
            entering={FadeInDown.duration(240)}
            exiting={FadeOut.duration(180)}
            pointerEvents="none"
            style={styles.microcopy}>
            <ThemedText style={styles.microcopyText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              {microcopy}
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

      {selectedResident ? (
        <CompanionCard
          name={selectedResident.creature.name}
          houseLevel={selectedResident.resident.houseLevel}
          openingLine={openingLine(selectedResident.creature.name, selectedInteractionState)}
          thread={selectedResident.thread}
          onSelectThread={(thread) => setSelectedResident((current) => (current ? { ...current, thread } : current))}
          onClose={() => setSelectedResident(null)}
          activeQuest={selectedActiveQuest ? { title: selectedActiveQuest.title, hint: selectedActiveQuest.hint } : null}
          questComplete={Boolean(selectedQuestRuntime?.complete)}
          questRuntime={selectedQuestRuntime}
          submissionItems={selectedQuestItems}
          offer={selectedOffer}
          criteria={selectedQuestRuntime?.progress ?? (selectedActiveQuest ? questCriteria(selectedActiveQuest.questId, todayFacts) : [])}
          onAccept={handleAcceptQuest}
          onCashIn={handleCashInQuest}
          onSubmitQuest={handleSubmitQuest}
          onQuestAction={handleQuestAction}
          insightText={selectedCompanionData?.line ?? 'This tile remembers the day we met.'}
          reflectionText={reflectionLine(selectedCompanionData?.archetype ?? '')}
          onAnswerReflection={handleAnswerReflection}
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
