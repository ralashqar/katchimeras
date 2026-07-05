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
import { expansionProgress } from '@/utils/world-expansion';
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

// One ring of empty ground cells frames the island.
const PATCH_RING = 1;
// Compass copy for the grow ceremony.
const SIDE_NAMES: Record<string, string> = { ne: 'north-east', se: 'south-east', sw: 'south-west', nw: 'north-west' };
// Highest-rarity-first ordering for picking which pending discovery to celebrate.
const DISCOVERY_RARITY_ORDER: Record<string, number> = { legendary: 3, epic: 2, rare: 1, common: 0 };

export default function KingdomScreen() {
  const router = useRouter();
  const { kingdom } = useKingdom();
  const { days } = useAllDays();
  const kingdomPatch = useMemo(() => deriveKingdomPatch(kingdom), [kingdom]);

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
  const visibleExpansions = useMemo(
    () => (decorState.expansions ?? []).filter((expansion) => expansion.ceremonyShown || expansion.index === growAnimIndex),
    [decorState.expansions, growAnimIndex]
  );
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
      setArrivals((current) => current ?? deriveKingdomArrivals(kingdom, next, { holdGiftDayIds: formingDayIds }));
      if (consumeKeepsakesShelfRequest()) setKeepsakesOpen(true);
    }, [days, kingdom, unlockedDiscoveries, patternProps, formingDayIds])
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
      // its own plantable cell space (decor addressed by `exp-<index>`).
      ...visibleExpansions.map((expansion) => ({
        ...deriveKingdomExpansionPatch(expansion),
        objects: kingdomDecorObjects(decorState, `exp-${expansion.index}`),
      })),
    ],
    [renderPatch, plots, decorState, visibleExpansions]
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
          imageBase
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
