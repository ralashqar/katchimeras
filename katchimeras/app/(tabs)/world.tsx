import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import {
  KingdomHexCanvas,
  kingdomResidentHexTiles,
  type KingdomHexCenterRef,
} from '@/components/katchadeck/world/kingdom-hex-canvas';
import { DiscoveriesHallSheet } from '@/components/katchadeck/world/discoveries-hall-sheet';
import { CompanionCard, type CompanionThread } from '@/components/katchadeck/world/companion-card';
import { KeepsakeAlmanacSheet } from '@/components/katchadeck/world/keepsake-almanac-sheet';
import { KeepsakesSheet } from '@/components/katchadeck/world/keepsakes-sheet';
import { MeadowSheet } from '@/components/katchadeck/ui/meadow-sheet';
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
import {
  findKingdomDecor,
  keepsakeAlmanac,
  loadKingdomDecor,
  moveKingdomDecor,
  plantKingdomGift,
  syncKingdomDecorFromDays,
  unplantKingdomDecor,
  type KingdomDecorItem,
} from '@/utils/kingdom-decor';
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

  const [decorState, setDecorState] = useState(() => loadKingdomDecor());
  const [customising, setCustomising] = useState(false);
  const [keepsakesOpen, setKeepsakesOpen] = useState(false);
  const [almanacOpen, setAlmanacOpen] = useState(false);
  const [discoveriesOpen, setDiscoveriesOpen] = useState(false);
  const [microcopy, setMicrocopy] = useState<string | null>(null);
  const [selectedResident, setSelectedResident] = useState<{ resident: KingdomResident; creature: KingdomCreature; thread: CompanionThread | null } | null>(null);
  const [companionQuestState, setCompanionQuestState] = useState<CompanionQuestState>(() => loadCompanionQuests());
  const [storedHomeState, setStoredHomeState] = useState(() => homeRepository.load());
  const [provenanceItem, setProvenanceItem] = useState<KingdomDecorItem | null>(null);
  const [justPlantedId, setJustPlantedId] = useState<string | null>(null);
  const getCenterCellRef = useRef<KingdomHexCenterRef | null>(null);
  const { capabilities: questCapabilities } = useQuestCapabilities(storedHomeState);

  const unlockedDiscoveries = useMemo(
    () =>
      discoveryEntries
        .filter((entry) => entry.record)
        .map((entry) => ({
          id: entry.def.id,
          name: entry.def.name,
          rarity: entry.def.rarity,
          unlockedAt: entry.record?.unlockedAt ?? null,
        })),
    [discoveryEntries]
  );

  useFocusEffect(
    useCallback(() => {
      setDecorState(syncKingdomDecorFromDays(days, { unlockedDiscoveries }));
      setCompanionQuestState(loadCompanionQuests());
      setStoredHomeState(homeRepository.load());
    }, [days, unlockedDiscoveries])
  );

  useEffect(() => {
    if (!microcopy) return;
    const timeout = setTimeout(() => setMicrocopy(null), 2300);
    return () => clearTimeout(timeout);
  }, [microcopy]);

  useEffect(() => {
    if (!justPlantedId) return;
    const timeout = setTimeout(() => setJustPlantedId(null), 5200);
    return () => clearTimeout(timeout);
  }, [justPlantedId]);

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

  const handlePlantGift = (giftId: string, name: string) => {
    const at = getCenterCellRef.current?.();
    setDecorState((state) => plantKingdomGift(state, giftId, at?.col, at?.row, at?.plotId ?? null));
    setJustPlantedId(`placed-${giftId}`);
    setCustomising(true);
    setMicrocopy(`${name} planted`);
  };

  const handleMoveDecor = (id: string, col: number, row: number, plotId?: string | null) => {
    setDecorState((state) => moveKingdomDecor(state, id, col, row, plotId));
  };

  const handleRemoveDecor = (id: string) => {
    setDecorState((state) => unplantKingdomDecor(state, id));
    setMicrocopy('Returned to keepsakes');
  };

  const handleSelectResident = (creatureId: string) => {
    const resident = residentById.get(creatureId);
    const creature = creatureById.get(creatureId);
    if (resident && creature) setSelectedResident({ resident, creature, thread: 'quest' });
  };

  const handleSelectDecor = (id: string) => {
    setProvenanceItem(findKingdomDecor(decorState, id));
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
          decor={decorState.placed}
          customising={customising}
          highlightObjectId={justPlantedId}
          eggVisual={eggVisual}
          residentStatusGlyphs={residentStatusGlyphs}
          getCenterCellRef={getCenterCellRef}
          onSelectResident={(creatureId) => handleSelectResident(creatureId)}
          onSelectDecor={handleSelectDecor}
          onMoveDecor={handleMoveDecor}
          onRemoveDecor={handleRemoveDecor}
          onOpenKeepsakes={() => setKeepsakesOpen(true)}
          unplantedCount={decorState.unplanted.length}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={customising ? 'Finish decorating' : 'Decorate your Kingdom'}
            onPress={() => setCustomising((value) => !value)}
            style={[styles.headerButton, customising ? styles.headerButtonOn : null]}>
            <IconSymbol name={customising ? 'checkmark' : 'pencil'} size={18} color={customising ? Lantern.ink950 : Lantern.moon50} />
            {!customising && decorState.unplanted.length > 0 ? (
              <View pointerEvents="none" style={styles.giftBadge}>
                <ThemedText style={styles.giftBadgeLabel} lightColor={Lantern.ink950} darkColor={Lantern.ink950}>
                  {decorState.unplanted.length}
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Keepsakes" onPress={() => setKeepsakesOpen(true)} style={styles.headerButton}>
            <IconSymbol name="leaf.fill" size={18} color={Lantern.moon50} />
          </Pressable>
        </View>

        {customising ? (
          <View style={styles.decorHint}>
            <ThemedText style={styles.decorHintText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
              {decorState.unplanted.length > 0
                ? `${decorState.unplanted.length} keepsakes waiting · plant from shelf, drag to move`
                : 'Drag planted keepsakes to move them'}
            </ThemedText>
          </View>
        ) : null}

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

      {keepsakesOpen ? (
        <KeepsakesSheet
          gifts={decorState.unplanted}
          onPlant={(gift) => {
            setKeepsakesOpen(false);
            handlePlantGift(gift.id, gift.name);
          }}
          onDecorate={() => {
            setKeepsakesOpen(false);
            setCustomising(true);
          }}
          onOpenAlmanac={() => {
            setKeepsakesOpen(false);
            setAlmanacOpen(true);
          }}
          onClose={() => setKeepsakesOpen(false)}
        />
      ) : null}

      {almanacOpen ? <KeepsakeAlmanacSheet sections={keepsakeAlmanac(decorState)} onClose={() => setAlmanacOpen(false)} /> : null}

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

      {provenanceItem ? (
        <MeadowSheet onClose={() => setProvenanceItem(null)} kicker={provenanceItem.provenance.isoDate || 'Keepsake'} title={provenanceItem.name}>
          <View style={styles.residentSheet}>
            <ThemedText style={styles.residentBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
              {provenanceItem.provenance.label}
            </ThemedText>
            <ThemedText style={styles.residentHint} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              Hold and drag to move it. Turn on decorate mode to remove it.
            </ThemedText>
          </View>
        </MeadowSheet>
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
  headerButtonOn: { backgroundColor: Lantern.ember300, borderColor: Lantern.ember300 },
  giftBadge: {
    alignItems: 'center',
    backgroundColor: Lantern.ember300,
    borderRadius: 999,
    minWidth: 17,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -4,
    top: -4,
  },
  giftBadgeLabel: { fontSize: 10, fontWeight: '900', lineHeight: 13 },
  decorHint: {
    alignSelf: 'center',
    backgroundColor: 'rgba(12,10,20,0.82)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    bottom: 122,
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: 'absolute',
  },
  decorHintText: { fontSize: 11.5, fontWeight: '800' },
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
