import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { GestureHandlerRootView, type GestureType } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { WorldCanvas } from '@/components/katchadeck/world/world-canvas';
import { KingdomBuildingSheet } from '@/components/katchadeck/world/kingdom-building-sheet';
import { DiscoveriesHallSheet } from '@/components/katchadeck/world/discoveries-hall-sheet';
import { DiscoveryReveal } from '@/components/katchadeck/world/discovery-reveal';
import { CosmeticsSheet } from '@/components/katchadeck/world/cosmetics-sheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MeadowSheet } from '@/components/katchadeck/ui/meadow-sheet';
import { ThemedText } from '@/components/themed-text';
import { KatchaDeckUI, Lantern } from '@/constants/theme';
import { useKingdom } from '@/hooks/use-kingdom';
import { useAllDays } from '@/hooks/use-all-days';
import { useDiscoveries } from '@/hooks/use-discoveries';
import {
  findKingdomDecor,
  groveMergeCandidates,
  kingdomDecorObjects,
  loadKingdomDecor,
  mergeKingdomGrove,
  moveKingdomDecor,
  plantKingdomGift,
  expansionStatsFor,
  keepsakeAlmanac,
  markExpansionCeremonyShown,
  pendingExpansionCeremony,
  syncKingdomDecorFromDays,
  unplantKingdomDecor,
  type KingdomDecorItem,
} from '@/utils/kingdom-decor';
import { expansionProgress, nextExpansionTarget } from '@/utils/world-expansion';
import { deriveContinuityMotifs } from '@/utils/continuity-engine';
import { deriveObservations } from '@/utils/observations-engine';
import { deriveWorldPropInventory } from '@/utils/world-props-engine';
import { loadWorldPropsState } from '@/utils/world-props-storage';
import { deriveKingdomArrivals, witnessKingdom, type KingdomArrivals } from '@/utils/kingdom-arrival';
import { KeepsakesSheet } from '@/components/katchadeck/world/keepsakes-sheet';
import { KeepsakeAlmanacSheet } from '@/components/katchadeck/world/keepsake-almanac-sheet';
import { consumeKeepsakesShelfRequest } from '@/utils/kingdom-decorate-signal';
import { worldAssetSource } from '@/utils/world-visuals';
import { Image } from 'expo-image';
import { KingdomArrivalCeremony } from '@/components/katchadeck/world/kingdom-arrival-ceremony';
import { useCosmetics } from '@/hooks/use-cosmetics';
import { useEssence } from '@/hooks/use-essence';
import { buildingIdForCategory, deriveKingdomExpansionPatch, deriveKingdomPatch, deriveKingdomPlotPatch } from '@/utils/kingdom-patch';
import { deriveKingdomPlots } from '@/utils/kingdom-engine';
import { archetypeForCreature, companionUnit, subtypeForCreature } from '@/utils/katchimera-engagement';
import {
  acceptQuest,
  activeQuests,
  evaluateCompanionQuests,
  loadCompanionQuests,
  questCriteria,
  questFor,
  saveCompanionQuests,
} from '@/utils/katchimera-quests';
import { resolveFactsForDay } from '@/utils/signals/resolve';
import { ESSENCE_AWARD } from '@/utils/essence-engine';
import { deriveResidents, residentObjects, tilesNeeded } from '@/utils/kingdom-residents';
import { ARCHIVE_BUILDINGS, buildKingdomArchive, collectKingdomArchiveEntries } from '@/utils/kingdom-archive';
import { KingdomArchiveModal } from '@/components/katchadeck/world/kingdom-archive-modal';
import { requestSelectedDay } from '@/utils/selected-day-signal';
import { useRouter } from 'expo-router';
import { collectUnlockedArtefacts, placeArtefacts } from '@/utils/discoveries-artefacts';
import type { KingdomBuilding } from '@/types/kingdom';
import type { WorldObjectCategory } from '@/types/world';
import { Meadow } from '@/constants/meadow-theme';

// The Kingdom — the ONE persistent world every day of living builds (see
// docs/kingdom-world-design.md). No day switcher, no egg: buildings stand at
// lifetime levels, hatched creatures populate the plaza, artefacts ring the
// island. All capture happens on Today; day-level detail lives in Collection.

// Ground rendering mode: false = the procedural Skia slab + decal tiles
// (current direction); true = the prebaked base-PNG tiles (parked for now —
// flip back to restore them, PATCH_RING pairs below).
const KINGDOM_IMAGE_BASE = false;
// Rings of empty ground cells framing the island. In Skia mode the slab IS
// the whole ground, so 5 rings (a 14-cell slab) match the footprint the
// enlarged 2.2× base PNG used to cover; image mode kept its original 1.
const PATCH_RING = KINGDOM_IMAGE_BASE ? 1 : 5;
// Compass copy for the grow ceremony.
const SIDE_NAMES: Record<string, string> = { ne: 'north-east', se: 'south-east', sw: 'south-west', nw: 'north-west' };
// Highest-rarity-first ordering for picking which pending discovery to celebrate.
const DISCOVERY_RARITY_ORDER: Record<string, number> = { legendary: 3, epic: 2, rare: 1, common: 0 };

export default function KingdomScreen() {
  const router = useRouter();
  const { kingdom } = useKingdom();
  const { days } = useAllDays();
  const kingdomPatch = useMemo(() => deriveKingdomPatch(kingdom), [kingdom]);
  // Today's forming egg sits on the capital's nest (docs/kingdom-residents-
  // plan.md); once the day hatches it disappears until tomorrow's egg forms.
  const todayEgg = useMemo(() => {
    const today = days.find((day) => day.isToday);
    return today && today.state !== 'hatched' ? today.egg : null;
  }, [days]);

  // Kingdom decoration — earned by living, planted forever (kingdom-decor.ts).
  // The sync effect lives below (it also needs the discoveries + noticed
  // patterns for the achievement lane); the ceremony then diffs the
  // freshly-synced kingdom against the witnessed snapshot.
  const [decorState, setDecorState] = useState(() => loadKingdomDecor());
  const [arrivals, setArrivals] = useState<KingdomArrivals | null>(null);
  // Gifts live-granted from the still-forming day land on the shelf silently —
  // they're held out of the ceremony (and the witnessed snapshot) so any left
  // unplanted still parade with tomorrow's arrival.
  const formingDayIds = useMemo(
    () => days.filter((day) => day.state !== 'hatched').map((day) => day.id),
    [days]
  );
  const handleCeremonyDone = (options?: { openDecorate?: boolean }) => {
    witnessKingdom(kingdom, decorState, { holdGiftDayIds: formingDayIds });
    setArrivals(null);
    if (options?.openDecorate) setKeepsakesOpen(true);
  };

  const [customising, setCustomising] = useState(false);
  // The keepsake shelf (gift crate / Today's chip / ceremony all open it).
  const [keepsakesOpen, setKeepsakesOpen] = useState(false);
  const [almanacOpen, setAlmanacOpen] = useState(false);
  // Freshly planted keepsake — ringed for a beat so the eye finds it to drag.
  const [justPlantedId, setJustPlantedId] = useState<string | null>(null);
  useEffect(() => {
    if (!justPlantedId) return;
    const id = setTimeout(() => setJustPlantedId(null), 5000);
    return () => clearTimeout(id);
  }, [justPlantedId]);
  // Iso snap: planted items settle onto half-cell steps so they line up with
  // the path grid. Toggleable from the decorate tray.
  const [snapEnabled, setSnapEnabled] = useState(true);
  const snap = (value: number) => (snapEnabled ? Math.round(value * 2) / 2 : value);
  const panRef = useRef<GestureType | undefined>(undefined);
  const getCenterCellRef = useRef<(() => { col: number; row: number; plotId: string | null } | null) | null>(null);
  // Provenance card for a tapped decoration.
  const [provenanceItem, setProvenanceItem] = useState<KingdomDecorItem | null>(null);
  // Companion card for a tapped resident (docs/katchimera-engagement-v1.md).
  const [companion, setCompanion] = useState<{ creatureId: string; name: string } | null>(null);
  const [companionQuests, setCompanionQuests] = useState(() => loadCompanionQuests());
  const [questJournalOpen, setQuestJournalOpen] = useState(false);
  const handleAcceptQuest = (offer: { questId: string; creatureId: string; title: string; hint: string }) => {
    const next = acceptQuest(companionQuests, offer, Date.now());
    if (!next) {
      setMicrocopy('Quest journal is full — finish one first');
      return;
    }
    setCompanionQuests(next);
    saveCompanionQuests(next);
    setMicrocopy('Quest accepted ✦');
  };
  // Today's resolved facts — shared by the auto-check on focus and the
  // journal's manual "Check now" (utils/signals/resolve.ts).
  const todayFacts = useMemo(() => {
    const today = days.find((day) => day.isToday) ?? null;
    return resolveFactsForDay(today);
  }, [days]);
  const runQuestCheck = useCallback(
    (source: 'auto' | 'manual') => {
      setCompanionQuests((current) => {
        const result = evaluateCompanionQuests(current, todayFacts, Date.now());
        if (result.completed.length === 0) {
          if (source === 'manual') setMicrocopy('Nothing finished yet — keep going ✦');
          return current;
        }
        saveCompanionQuests(result.state);
        setMicrocopy(
          `Quest complete ✦ ${result.completed[0].title} — +${result.completed.length * ESSENCE_AWARD.questComplete} essence, their home grows`
        );
        setJustPlantedId(`resident-${result.completed[0].creatureId}`);
        return result.state;
      });
    },
    [todayFacts]
  );

  const renderPatch = useMemo(() => {
    const objects = [...kingdomPatch.objects, ...kingdomDecorObjects(decorState)];
    // Keepsakes waiting on the shelf show as a glowing gift crate by the plaza —
    // tapping it opens decorate mode.
    if (decorState.unplanted.length > 0) {
      objects.push({
        id: 'kingdom-gift-crate',
        kind: 'prop' as const,
        assetKey: 'gift_crate',
        label: 'Keepsakes',
        col: 2.2,
        row: 2.55,
        footprint: 1,
        sourceLabel: `${decorState.unplanted.length} waiting`,
        category: 'decor' as const,
        badge: decorState.unplanted.length,
        sizeScale: 0.95,
      });
    }
    return { ...kingdomPatch, objects };
  }, [kingdomPatch, decorState]);

  const handlePlantGift = (giftId: string, name: string) => {
    // Plants on whichever tile the camera is centred over (plotId null = the
    // main island; `exp-N` / plot ids = docked territory).
    const at = getCenterCellRef.current?.();
    setDecorState((state) =>
      plantKingdomGift(state, giftId, at ? snap(at.col) : undefined, at ? snap(at.row) : undefined, at?.plotId ?? null)
    );
    setJustPlantedId(`placed-${giftId}`);
    setMicrocopy(`${name} planted — drag it into place`);
  };
  const handleMoveDecor = (id: string, col: number, row: number) => {
    setDecorState((state) => moveKingdomDecor(state, id, snap(col), snap(row)));
  };
  // Grove merge — three identical unplanted commons fuse into one grove.
  const mergeCandidates = useMemo(() => groveMergeCandidates(decorState), [decorState]);
  const handleMergeGrove = (speciesId: string, groveName: string) => {
    setDecorState((state) => mergeKingdomGrove(state, speciesId));
    setMicrocopy(`Three become one — ${groveName} added to your keepsakes`);
  };
  const handleRemoveDecor = (id: string) => {
    setDecorState((state) => unplantKingdomDecor(state, id));
    setMicrocopy('Returned to your keepsakes');
  };

  // Growth microcopy toast, auto-dismissed after a beat.
  const [microcopy, setMicrocopy] = useState<string | null>(null);
  useEffect(() => {
    if (!microcopy) return;
    const id = setTimeout(() => setMicrocopy(null), 2400);
    return () => clearTimeout(id);
  }, [microcopy]);

  // Discoveries (life milestones) → the Hall, the artefact ring, and reveals.
  const {
    entries: discoveryEntries,
    unlockedCount: discoveriesUnlocked,
    totalCount: discoveriesTotal,
    pending: pendingDiscoveries,
    backfillCount: discoveryBackfillCount,
    dismissBackfillNotice,
    markSeen: markDiscoverySeen,
  } = useDiscoveries();
  const [discoveriesOpen, setDiscoveriesOpen] = useState(false);
  const worldArtefacts = useMemo(() => placeArtefacts(collectUnlockedArtefacts(discoveryEntries)), [discoveryEntries]);
  const unlockedDiscoveryIds = useMemo(
    () => new Set(discoveryEntries.filter((entry) => entry.record).map((entry) => entry.def.id)),
    [discoveryEntries]
  );

  // One quiet summary the first time history is backfilled into the Hall.
  useEffect(() => {
    if (discoveryBackfillCount > 0) {
      setMicrocopy(
        `${discoveryBackfillCount} ${discoveryBackfillCount === 1 ? 'discovery' : 'discoveries'} from your past are in your Hall`
      );
      dismissBackfillNotice();
    }
  }, [discoveryBackfillCount, dismissBackfillNotice]);

  // Earning inputs for the achievement lane: unlocked discoveries + the
  // observation/mood props the pattern engine says have fired.
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
  const patternProps = useMemo(() => {
    const observations = deriveObservations({ days, selectedDay: null, motifs: deriveContinuityMotifs(days, 6) });
    const inventory = deriveWorldPropInventory({ propsState: loadWorldPropsState(), discoveryEntries, observations, days });
    return inventory.owned
      .filter((entry) => entry.def.unlockKind === 'observation' || entry.def.unlockKind === 'mood')
      .map((entry) => ({
        id: entry.def.id,
        assetKey: entry.def.assetKey,
        name: entry.def.name,
        sourceLabel: entry.def.sourceLabel,
        sizeScale: entry.def.sizeScale,
      }));
  }, [days, discoveryEntries]);

  // Territory growth (docs §10): the pending "Kingdom grows" ceremony, the
  // next-land outlook for the foreshadow chip, and which expansion tiles the
  // canvas may show (a freshly-unlocked tile stays hidden until the player
  // taps "Watch it rise", so its entrance animation is actually witnessed).
  const pendingExpansion = useMemo(() => pendingExpansionCeremony(decorState), [decorState]);
  const [growAnimIndex, setGrowAnimIndex] = useState<number | null>(null);
  const expansionOutlook = useMemo(() => {
    const hatchedDays = days.filter((day) => day.state === 'hatched');
    return expansionProgress(expansionStatsFor(hatchedDays, decorState, unlockedDiscoveries), (decorState.expansions ?? []).length);
  }, [days, decorState, unlockedDiscoveries]);
  const nextLandLine = useMemo(() => {
    const lines = [...expansionOutlook.lines, expansionOutlook.pressure].filter((line) => line.have < line.need);
    lines.sort((a, b) => a.have / Math.max(1, a.need) - b.have / Math.max(1, b.need));
    return lines[0] ?? null;
  }, [expansionOutlook]);
  // Kingdom Residents (docs/kingdom-residents-plan.md): every unique
  // katchimera claims a quad of a ring tile, derived from the hatch history.
  const residents = useMemo(() => {
    // Completed companion quests upgrade the resident's house like dupes do.
    const credits = new Map<string, number>();
    for (const quest of companionQuests.quests) {
      if (quest.completedAt) credits.set(quest.creatureId, (credits.get(quest.creatureId) ?? 0) + 1);
    }
    return deriveResidents(
      kingdom.creatures.map((creature) => ({
        creatureId: creature.creatureId,
        hatchedAt: Date.parse(creature.isoDate) || 0,
      })),
      credits
    );
  }, [kingdom.creatures, companionQuests]);
  const residentMeta = useCallback(
    (creatureId: string) => {
      const creature = kingdom.creatures.find((entry) => entry.creatureId === creatureId);
      return creature ? { name: creature.name, visualKey: creature.visualKey } : undefined;
    },
    [kingdom.creatures]
  );
  const visibleExpansions = useMemo(() => {
    const stored = (decorState.expansions ?? []).filter(
      (expansion) => expansion.ceremonyShown || expansion.index === growAnimIndex
    );
    // Residents guarantee land (slice D): any tile a resident's quad needs
    // exists even if the deeds requirements haven't granted it yet — old
    // profiles backfill instantly, since allocation is derived from the Dex.
    const have = new Set(stored.map((expansion) => expansion.index));
    const guaranteed = [...stored];
    for (let index = 0; index < tilesNeeded(residents.length); index += 1) {
      if (have.has(index)) continue;
      const target = nextExpansionTarget(index);
      guaranteed.push({ index, side: target.side, ring: target.ring, unlockedDayId: '', ceremonyShown: true });
    }
    return guaranteed;
  }, [decorState.expansions, growAnimIndex, residents.length]);
  const handleGrowWitness = () => {
    if (!pendingExpansion) return;
    setGrowAnimIndex(pendingExpansion.index);
    setDecorState((state) => markExpansionCeremonyShown(state, pendingExpansion.index));
    setMicrocopy('New land claimed — plant something on it');
  };

  // Sync on focus: grant whatever new days + achievements have earned (and the
  // one-time legacy hoist), then derive the morning ceremony from the result.
  useFocusEffect(
    useCallback(() => {
      const next = syncKingdomDecorFromDays(days, { unlockedDiscoveries, patternProps });
      setDecorState(next);
      // Companion quests: check today's signals against the active ledger
      // (docs/katchimera-engagement-v1.md — quests are signal-detectable).
      runQuestCheck('auto');
      setArrivals((current) => current ?? deriveKingdomArrivals(kingdom, next, { holdGiftDayIds: formingDayIds }));
      if (consumeKeepsakesShelfRequest()) setKeepsakesOpen(true);
    }, [days, kingdom, unlockedDiscoveries, patternProps, formingDayIds, runQuestCheck])
  );

  // Expansion plots (K4): milestone-earned garden islets docked around the
  // island, each plantable ground with its own decor.
  const legendaryCount = useMemo(
    () => discoveryEntries.filter((entry) => entry.record && entry.def.rarity === 'legendary').length,
    [discoveryEntries]
  );
  const plots = useMemo(() => deriveKingdomPlots(kingdom.totals, legendaryCount), [kingdom.totals, legendaryCount]);
  const renderPatches = useMemo(
    () => [
      renderPatch,
      ...plots.map((plot) => ({
        ...deriveKingdomPlotPatch(plot),
        objects: kingdomDecorObjects(decorState, plot.id),
      })),
      // Territory tiles: docked patches in the Kingdom's own art, each with
      // its own plantable cell space (decor addressed by `exp-<index>`) plus
      // the katchimera residents whose quads live on that tile.
      ...visibleExpansions.map((expansion) => ({
        ...deriveKingdomExpansionPatch(expansion),
        objects: [
          ...kingdomDecorObjects(decorState, `exp-${expansion.index}`),
          ...residentObjects(residents, expansion.index, residentMeta, PATCH_RING),
        ],
      })),
    ],
    [renderPatch, plots, decorState, visibleExpansions, residents, residentMeta]
  );

  // Essence (cosmetic currency) + cosmetics. "+N" toast when it grows.
  const { earned: essenceEarned, balance: essenceBalance, purchases: essencePurchases, spend: spendEssence } = useEssence();
  const prevEssenceRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevEssenceRef.current;
    prevEssenceRef.current = essenceEarned;
    if (prev !== null && essenceEarned > prev) {
      setMicrocopy(`✦ +${essenceEarned - prev} Essence`);
    }
  }, [essenceEarned]);
  const { entries: cosmeticEntries, worldThemeAccent, select: selectCosmetic } = useCosmetics(
    unlockedDiscoveryIds,
    essencePurchases,
    essenceBalance
  );
  const [cosmeticsOpen, setCosmeticsOpen] = useState(false);
  const handleBuyCosmetic = (id: string, cost: number) => {
    const def = cosmeticEntries.find((entry) => entry.def.id === id)?.def;
    if (!def) return;
    if (spendEssence(id, cost)) {
      selectCosmetic(def.type, id);
      setMicrocopy(`✦ ${def.name} unlocked`);
    }
  };

  // Tapping a building opens its card (question, lifetime count, level);
  // tapping a decoration opens its provenance card (where life earned it).
  const [selectedBuilding, setSelectedBuilding] = useState<KingdomBuilding | null>(null);
  // The full-screen collection (the Shelf / the Menu / the Grove).
  const [collectionBuilding, setCollectionBuilding] = useState<KingdomBuilding | null>(null);
  const handleSelectCell = (category: WorldObjectCategory, objectId?: string) => {
    if (category === 'decor') {
      // The gift crate is the door into planting; other decor shows its story.
      if (objectId === 'kingdom-gift-crate') {
        setKeepsakesOpen(true);
        return;
      }
      if (!customising && objectId) setProvenanceItem(findKingdomDecor(decorState, objectId));
      return;
    }
    const buildingId = buildingIdForCategory(category);
    const building = buildingId ? kingdom.buildings.find((item) => item.id === buildingId) ?? null : null;
    if (building) setSelectedBuilding(building);
  };

  const celebrateDiscovery = useMemo(
    () =>
      [...pendingDiscoveries].sort(
        (a, b) => (DISCOVERY_RARITY_ORDER[b.rarity] ?? 0) - (DISCOVERY_RARITY_ORDER[a.rarity] ?? 0)
      )[0] ?? null,
    [pendingDiscoveries]
  );

  const subtitle = [
    `${kingdom.totals.daysHatched} ${kingdom.totals.daysHatched === 1 ? 'day' : 'days'}`,
    `${kingdom.creatures.length} ${kingdom.creatures.length === 1 ? 'katchimera' : 'katchimeras'}`,
    `${discoveriesUnlocked}/${discoveriesTotal} discoveries`,
  ].join('  ·  ');

  return (
    <GestureHandlerRootView style={styles.screen}>
      <AmbientBackground
        accentColor={worldThemeAccent ?? 'rgba(125,232,205,0.12)'}
        colors={KatchaDeckUI.gradients.world}
        meshColors={['rgba(125,232,205,0.12)', 'rgba(167,139,250,0.10)', 'rgba(255,195,107,0.07)', 'rgba(20,17,31,0.25)']}
      />

      <View style={styles.stage}>
        <WorldCanvas
          patches={renderPatches}
          ring={PATCH_RING}
          animateOnMount
          imageBase={KINGDOM_IMAGE_BASE}
          eggPatchId={todayEgg ? 'kingdom' : null}
          eggVisual={todayEgg}
          onPressEgg={() => router.push('/today')}
          onSelectResident={(creatureId, name) => setCompanion({ creatureId, name })}
          artefacts={worldArtefacts}
          customising={customising}
          onToggleCustomising={() => setCustomising((value) => !value)}
          showCustomiseButton={false}
          onMoveDecor={handleMoveDecor}
          onRemoveDecor={handleRemoveDecor}
          snapCell={snap}
          panRef={panRef}
          getCenterCellRef={getCenterCellRef}
          onSelectPatch={() => {}}
          onSelectMemory={() => {}}
          onSelectCell={handleSelectCell}
          highlightObjectId={justPlantedId}
          animateExpansionIndex={growAnimIndex}
        />

        {/* Companion card — a tapped resident speaks (engagement T1 rules;
            the FM voice pass replaces the phrasing in V1b). */}
        {companion
          ? (() => {
              const resident = residents.find((r) => r.creatureId === companion.creatureId);
              const meta = residentMeta(companion.creatureId);
              const fallback = `${companion.name} ${meta?.visualKey ?? ''}`;
              const unit = companionUnit(
                archetypeForCreature(companion.creatureId, fallback),
                kingdom,
                subtypeForCreature(companion.creatureId, fallback)
              );
              return (
                <Pressable
                  onPress={() => setCompanion(null)}
                  style={{
                    position: 'absolute',
                    left: 16,
                    right: 16,
                    bottom: 118,
                    borderRadius: 20,
                    padding: 16,
                    backgroundColor: 'rgba(16, 14, 26, 0.92)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 195, 107, 0.35)',
                  }}>
                  <ThemedText style={{ fontSize: 15, fontWeight: '700' }} lightColor="#FFE2B8" darkColor="#FFE2B8">
                    {companion.name}
                    {resident ? `  ·  home Lv ${resident.houseLevel}` : ''}
                  </ThemedText>
                  <ThemedText style={{ marginTop: 6, fontSize: 14, lineHeight: 20 }} lightColor="#EDEAF6" darkColor="#EDEAF6">
                    {unit.line}
                  </ThemedText>
                  {(() => {
                    const active = questFor(companionQuests, companion.creatureId);
                    if (active) {
                      return (
                        <ThemedText style={{ marginTop: 8, fontSize: 13 }} lightColor="#A8E2C6" darkColor="#A8E2C6">
                          ✦ In progress: {active.title} — {active.hint}
                        </ThemedText>
                      );
                    }
                    if (!unit.quest) return null;
                    const offer = unit.quest;
                    return (
                      <Pressable
                        onPress={() =>
                          handleAcceptQuest({
                            questId: offer.id,
                            creatureId: companion.creatureId,
                            title: offer.title,
                            hint: offer.hint,
                          })
                        }
                        style={{
                          marginTop: 10,
                          alignSelf: 'flex-start',
                          borderRadius: 12,
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          backgroundColor: 'rgba(168, 226, 198, 0.16)',
                          borderWidth: 1,
                          borderColor: 'rgba(168, 226, 198, 0.45)',
                        }}>
                        <ThemedText style={{ fontSize: 13, fontWeight: '600' }} lightColor="#A8E2C6" darkColor="#A8E2C6">
                          ✦ Accept: {offer.title} — {offer.hint}
                        </ThemedText>
                      </Pressable>
                    );
                  })()}
                </Pressable>
              );
            })()
          : null}

        {/* Quest journal — reuses the shared MeadowSheet shell (same as the
            Today moments/places sheets: ScrollView owns its touches, drag-to-
            dismiss, ✕ close) so the list scrolls reliably. */}
        {questJournalOpen ? (
          <MeadowSheet kicker="Companions" title="Quest Journal" onClose={() => setQuestJournalOpen(false)}>
            <Pressable onPress={() => runQuestCheck('manual')} style={styles.questCheckBtn}>
              <ThemedText style={styles.questCheckLabel} lightColor="#A8E2C6" darkColor="#A8E2C6">
                Check now
              </ThemedText>
            </Pressable>
            <ScrollView style={styles.questList} contentContainerStyle={styles.questListContent}>
              {activeQuests(companionQuests).length === 0 ? (
                <ThemedText style={styles.questEmpty} lightColor="#B7B2C6" darkColor="#B7B2C6">
                  No active quests. Tap a katchimera to hear what they need.
                </ThemedText>
              ) : (
                activeQuests(companionQuests).map((quest) => {
                  const who = residentMeta(quest.creatureId);
                  const criteria = questCriteria(quest.questId, todayFacts);
                  return (
                    <View key={quest.questId + quest.creatureId} style={styles.questRow}>
                      <ThemedText style={styles.questRowTitle} lightColor="#FFE2B8" darkColor="#FFE2B8">
                        {quest.title}
                        {who ? `  ·  ${who.name}` : ''}
                      </ThemedText>
                      <ThemedText style={styles.questRowHint} lightColor="#EDEAF6" darkColor="#EDEAF6">
                        {quest.hint}
                      </ThemedText>
                      {criteria.map((c) => (
                        <ThemedText
                          key={c.label}
                          style={styles.questCriterion}
                          lightColor={c.done ? '#A8E2C6' : '#B7B2C6'}
                          darkColor={c.done ? '#A8E2C6' : '#B7B2C6'}>
                          {c.done ? '✓' : '○'} {c.label}
                        </ThemedText>
                      ))}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </MeadowSheet>
        ) : null}

        {/* Header chrome — the Kingdom's name + what a life has built so far.
            The copy stays top-left; the actions live on their own right-edge
            rail below so long subtitles can never push them off screen. */}
        <View pointerEvents="none" style={styles.header}>
          <View style={styles.headerCopy}>
            <ThemedText type="onboardingLabel" style={styles.headerKicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
              Your Kingdom
            </ThemedText>
            <ThemedText style={styles.headerSubtitle} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
              {subtitle}
            </ThemedText>
          </View>
        </View>

        {/* Action rail — vertical, anchored to the right edge. */}
        <View pointerEvents="box-none" style={styles.actionRail}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hall of Discoveries"
            onPress={() => setDiscoveriesOpen(true)}
            style={styles.headerButton}>
            <IconSymbol name="star.fill" size={18} color={Lantern.moon50} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cosmetics"
            onPress={() => setCosmeticsOpen(true)}
            style={styles.headerButton}>
            <IconSymbol name="diamond.fill" size={18} color={Lantern.moon50} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Companion quests"
            onPress={() => setQuestJournalOpen(true)}
            style={styles.headerButton}>
            <IconSymbol name="checklist" size={18} color={Lantern.moon50} />
            {activeQuests(companionQuests).length > 0 ? (
              <View style={styles.questBadge}>
                <ThemedText style={styles.questBadgeText} lightColor="#1B140A" darkColor="#1B140A">
                  {activeQuests(companionQuests).length}
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={customising ? 'Finish decorating' : 'Decorate your Kingdom'}
            onPress={() => setCustomising((value) => !value)}
            style={[styles.headerButton, customising ? styles.headerButtonOn : null]}>
            <IconSymbol
              name={customising ? 'checkmark' : 'pencil'}
              size={18}
              color={customising ? Lantern.ink950 : Lantern.moon50}
            />
            {!customising && decorState.unplanted.length > 0 ? (
              <View style={styles.giftBadge} pointerEvents="none">
                <ThemedText style={styles.giftBadgeLabel} lightColor={Lantern.ink950} darkColor={Lantern.ink950}>
                  {decorState.unplanted.length}
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* Keepsake tray — gifts life has earned, waiting to be planted. Tap one
            to plant it where the camera is centred, then drag it into place. */}
        {customising ? (
          <View style={[styles.decorTray, { bottom: Meadow.overlay.bottomClearance }]}>
            <View style={styles.decorTrayHeader}>
              <ThemedText style={styles.decorTrayHint} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                {decorState.unplanted.length > 0
                  ? `${decorState.unplanted.length} ${decorState.unplanted.length === 1 ? 'keepsake' : 'keepsakes'} to plant · drag to place`
                  : 'Drag placed keepsakes to rearrange'}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSnapEnabled((value) => !value)}
                style={[styles.snapChip, snapEnabled ? styles.snapChipOn : null]}>
                <ThemedText
                  style={styles.snapLabel}
                  lightColor={snapEnabled ? Lantern.ink950 : Lantern.moon300}
                  darkColor={snapEnabled ? Lantern.ink950 : Lantern.moon300}>
                  Snap {snapEnabled ? 'on' : 'off'}
                </ThemedText>
              </Pressable>
            </View>
            {decorState.unplanted.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.giftRow}>
                {mergeCandidates.map((candidate) => (
                  <Pressable
                    key={`merge-${candidate.speciesId}`}
                    accessibilityRole="button"
                    onPress={() => handleMergeGrove(candidate.speciesId, candidate.name)}
                    style={({ pressed }) => [styles.giftChip, styles.groveChip, pressed && styles.giftChipPressed]}>
                    {worldAssetSource(candidate.assetKey) ? (
                      <Image contentFit="contain" source={worldAssetSource(candidate.assetKey)} style={styles.giftThumb} transition={120} />
                    ) : (
                      <ThemedText style={styles.groveGlyph}>🌳</ThemedText>
                    )}
                    <View style={styles.giftChipBody}>
                      <ThemedText style={styles.giftName} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                        Merge 3 → {candidate.name}
                      </ThemedText>
                      <ThemedText numberOfLines={1} style={styles.giftSource} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                        {candidate.available} {candidate.speciesName} waiting
                      </ThemedText>
                    </View>
                  </Pressable>
                ))}
                {decorState.unplanted.map((gift) => (
                  <Pressable
                    key={gift.id}
                    accessibilityRole="button"
                    onPress={() => handlePlantGift(gift.id, gift.name)}
                    style={({ pressed }) => [styles.giftChip, pressed && styles.giftChipPressed]}>
                    {worldAssetSource(gift.assetKey) ? (
                      <Image contentFit="contain" source={worldAssetSource(gift.assetKey)} style={styles.giftThumb} transition={120} />
                    ) : null}
                    <View style={styles.giftChipBody}>
                      <ThemedText style={styles.giftName} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                        {gift.name}
                      </ThemedText>
                      <ThemedText numberOfLines={1} style={styles.giftSource} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                        {gift.provenance.label}
                      </ThemedText>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>
        ) : null}

        {microcopy ? (
          <Animated.View
            key={microcopy}
            entering={FadeInDown.duration(260)}
            exiting={FadeOut.duration(220)}
            pointerEvents="none"
            style={styles.microcopy}>
            <ThemedText style={styles.microcopyText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              {microcopy}
            </ThemedText>
          </Animated.View>
        ) : null}

        {/* Land Deeds foreshadow — quiet chip once the next land is >=50% earned. */}
        {!pendingExpansion && nextLandLine && expansionOutlook.overall >= 0.5 ? (
          <View pointerEvents="none" style={styles.deedsChip}>
            <ThemedText style={styles.deedsLabel} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
              🏞 New land soon · {nextLandLine.have}/{nextLandLine.need} {nextLandLine.label}
            </ThemedText>
          </View>
        ) : null}

        {/* The grow ceremony: announce, then reveal the rising tile on tap. */}
        {pendingExpansion ? (
          <Animated.View entering={FadeInDown.duration(320)} style={styles.growOverlay}>
            <View style={styles.growCard}>
              <ThemedText style={styles.growTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                Your Kingdom grows 🌱
              </ThemedText>
              <ThemedText style={styles.growBody} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                The life you’ve lived has earned new land to the {SIDE_NAMES[pendingExpansion.side]}.
              </ThemedText>
              <Pressable accessibilityRole="button" onPress={handleGrowWitness} style={styles.growButton}>
                <ThemedText style={styles.growButtonLabel} lightColor={Lantern.ink950} darkColor={Lantern.ink950}>
                  Watch it rise
                </ThemedText>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}
      </View>

      {keepsakesOpen ? (
        <KeepsakesSheet
          gifts={decorState.unplanted}
          onPlant={(gift) => {
            setKeepsakesOpen(false);
            handlePlantGift(gift.id, gift.name);
            setCustomising(true);
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

      {selectedBuilding ? (
        <KingdomBuildingSheet
          building={selectedBuilding}
          archive={buildKingdomArchive(days, selectedBuilding.id)}
          onOpenCollection={
            ARCHIVE_BUILDINGS.includes(selectedBuilding.id)
              ? () => {
                  setCollectionBuilding(selectedBuilding);
                  setSelectedBuilding(null);
                }
              : undefined
          }
          onClose={() => setSelectedBuilding(null)}
        />
      ) : null}

      {collectionBuilding ? (
        <KingdomArchiveModal
          building={collectionBuilding}
          entries={collectKingdomArchiveEntries(days, collectionBuilding.id)}
          onOpenDay={(dayId) => {
            // Relive the day this came from — hand off to the Today tab.
            setCollectionBuilding(null);
            requestSelectedDay(dayId);
            router.push('/today');
          }}
          onClose={() => setCollectionBuilding(null)}
        />
      ) : null}

      {/* Provenance card — what a planted keepsake remembers. */}
      {provenanceItem ? (
        <Pressable style={styles.provenanceBackdrop} onPress={() => setProvenanceItem(null)}>
          <Animated.View entering={FadeInDown.duration(240)} style={[styles.provenanceCard, { bottom: Meadow.overlay.bottomClearance }]}>
            <ThemedText style={styles.provenanceName} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              {provenanceItem.name}
            </ThemedText>
            <ThemedText style={styles.provenanceLabel} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
              {provenanceItem.provenance.label}
            </ThemedText>
            {provenanceItem.provenance.isoDate ? (
              <ThemedText style={styles.provenanceDate} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                {provenanceItem.provenance.isoDate}
              </ThemedText>
            ) : null}
            <ThemedText style={styles.provenanceHint} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              Hold & drag to move it
            </ThemedText>
          </Animated.View>
        </Pressable>
      ) : null}

      {discoveriesOpen ? (
        <DiscoveriesHallSheet
          entries={discoveryEntries}
          unlockedCount={discoveriesUnlocked}
          totalCount={discoveriesTotal}
          onClose={() => setDiscoveriesOpen(false)}
        />
      ) : null}

      {cosmeticsOpen ? (
        <CosmeticsSheet
          entries={cosmeticEntries}
          balance={essenceBalance}
          onSelect={selectCosmetic}
          onBuy={handleBuyCosmetic}
          onClose={() => setCosmeticsOpen(false)}
        />
      ) : null}

      {/* Morning ceremony — plays before anything else asks for attention. */}
      {arrivals && !customising && !keepsakesOpen && !almanacOpen ? <KingdomArrivalCeremony arrivals={arrivals} onDone={handleCeremonyDone} /> : null}

      {celebrateDiscovery && !arrivals && !selectedBuilding && !discoveriesOpen && !cosmeticsOpen && !customising && !keepsakesOpen && !provenanceItem ? (
        <DiscoveryReveal discovery={celebrateDiscovery} onDismiss={() => markDiscoverySeen(celebrateDiscovery.id)} />
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
  headerCopy: { gap: 3 },
  headerKicker: { fontSize: 13, letterSpacing: 1.2 },
  headerSubtitle: { fontSize: 12, fontWeight: '600' },
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
    bottom: 120,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
    position: 'absolute',
    zIndex: 45,
  },
  microcopyText: { fontSize: 13, fontWeight: '700' },
  deedsChip: {
    alignSelf: 'center',
    backgroundColor: 'rgba(11,13,20,0.72)',
    borderColor: 'rgba(216,228,255,0.16)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    position: 'absolute',
    top: 118,
  },
  deedsLabel: { fontSize: 12, fontWeight: '700' },
  growOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(7,9,15,0.55)',
    justifyContent: 'center',
    zIndex: 40,
  },
  growCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(11,13,20,0.94)',
    borderColor: 'rgba(255,195,107,0.35)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    maxWidth: 320,
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  growTitle: { fontSize: 19, fontWeight: '800' },
  growBody: { fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  growButton: {
    backgroundColor: '#FFC36B',
    borderCurve: 'continuous',
    borderRadius: 999,
    marginTop: 4,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  growButtonLabel: { fontSize: 14, fontWeight: '800' },
  headerButtonOn: { backgroundColor: Lantern.ember300, borderColor: Lantern.ember300 },
  questBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A8E2C6',
  },
  questBadgeText: { fontSize: 11, fontWeight: '800' },
  questList: { flexGrow: 0, marginTop: 4 },
  questListContent: { gap: 12, paddingBottom: 8 },
  questCheckBtn: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(168,226,198,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(168,226,198,0.45)',
  },
  questCheckLabel: { fontSize: 13, fontWeight: '700' },
  questEmpty: { fontSize: 14, lineHeight: 20, paddingVertical: 8 },
  questRow: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 4,
  },
  questRowTitle: { fontSize: 14, fontWeight: '700' },
  questRowHint: { fontSize: 13, lineHeight: 18 },
  questCriterion: { fontSize: 12.5, marginTop: 2 },
  giftBadge: {
    alignItems: 'center',
    backgroundColor: Lantern.ember300,
    borderRadius: 999,
    height: 17,
    justifyContent: 'center',
    minWidth: 17,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -4,
    top: -4,
  },
  giftBadgeLabel: { fontSize: 10, fontWeight: '900', lineHeight: 13 },
  decorTray: {
    gap: 8,
    left: 16,
    position: 'absolute',
    right: 16,
    zIndex: 40,
  },
  decorTrayHeader: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center' },
  decorTrayHint: { flexShrink: 1, fontSize: 11.5, fontWeight: '700', textAlign: 'center' },
  snapChip: {
    backgroundColor: 'rgba(28,24,48,0.86)',
    borderColor: 'rgba(196,186,240,0.3)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  snapChipOn: { backgroundColor: Lantern.ember300, borderColor: Lantern.ember300 },
  snapLabel: { fontSize: 11, fontWeight: '900' },
  giftRow: { gap: 8, paddingHorizontal: 2 },
  giftChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(28,24,48,0.92)',
    borderColor: 'rgba(255,195,107,0.4)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    maxWidth: 220,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  groveChip: { borderColor: 'rgba(125,232,205,0.55)', borderStyle: 'dashed' },
  groveGlyph: { fontSize: 22 },
  giftThumb: { height: 34, width: 34 },
  giftChipBody: { flexShrink: 1, gap: 1 },
  giftChipPressed: { backgroundColor: 'rgba(40,34,60,0.95)' },
  giftName: { fontSize: 13, fontWeight: '800' },
  giftSource: { fontSize: 11, fontWeight: '600' },
  provenanceBackdrop: { ...StyleSheet.absoluteFillObject, zIndex: 55 },
  provenanceCard: {
    alignSelf: 'center',
    backgroundColor: Meadow.overlay.sheetBg,
    borderColor: Meadow.overlay.sheetBorder,
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    boxShadow: '0 14px 36px rgba(0,0,0,0.5)',
    gap: 3,
    maxWidth: 320,
    paddingHorizontal: 18,
    paddingVertical: 14,
    position: 'absolute',
  },
  provenanceName: { fontSize: 15, fontWeight: '800' },
  provenanceLabel: { fontSize: 12.5, fontWeight: '700' },
  provenanceDate: { fontSize: 11.5, fontWeight: '600' },
  provenanceHint: { fontSize: 11, fontWeight: '600', marginTop: 4, opacity: 0.8 },
});
