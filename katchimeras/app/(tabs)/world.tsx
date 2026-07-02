import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
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
  kingdomDecorObjects,
  loadKingdomDecor,
  moveKingdomDecor,
  plantKingdomGift,
  syncKingdomDecorFromDays,
  unplantKingdomDecor,
  type KingdomDecorItem,
} from '@/utils/kingdom-decor';
import { deriveKingdomArrivals, witnessKingdom, type KingdomArrivals } from '@/utils/kingdom-arrival';
import { KingdomArrivalCeremony } from '@/components/katchadeck/world/kingdom-arrival-ceremony';
import { useCosmetics } from '@/hooks/use-cosmetics';
import { useEssence } from '@/hooks/use-essence';
import { buildingIdForCategory, deriveKingdomPatch } from '@/utils/kingdom-patch';
import { collectUnlockedArtefacts, placeArtefacts } from '@/utils/discoveries-artefacts';
import type { KingdomBuilding } from '@/types/kingdom';
import type { WorldObjectCategory } from '@/types/world';

// The Kingdom — the ONE persistent world every day of living builds (see
// docs/kingdom-world-design.md). No day switcher, no egg: buildings stand at
// lifetime levels, hatched creatures populate the plaza, artefacts ring the
// island. All capture happens on Today; day-level detail lives in Collection.

// One ring of empty ground cells frames the island.
const PATCH_RING = 1;
// Highest-rarity-first ordering for picking which pending discovery to celebrate.
const DISCOVERY_RARITY_ORDER: Record<string, number> = { legendary: 3, epic: 2, rare: 1, common: 0 };

export default function KingdomScreen() {
  const { kingdom } = useKingdom();
  const { days } = useAllDays();
  const tabBarHeight = useBottomTabBarHeight();
  const kingdomPatch = useMemo(() => deriveKingdomPatch(kingdom), [kingdom]);

  // Kingdom decoration — earned by living, planted forever (kingdom-decor.ts).
  // Sync on focus grants anything new days have earned (+ one-time legacy
  // hoist), then the morning ceremony diffs the freshly-synced kingdom against
  // the witnessed snapshot: yesterday's creature, new keepsakes, level-ups.
  // First run baselines silently inside deriveKingdomArrivals.
  const [decorState, setDecorState] = useState(() => loadKingdomDecor());
  const [arrivals, setArrivals] = useState<KingdomArrivals | null>(null);
  useFocusEffect(
    useCallback(() => {
      const next = syncKingdomDecorFromDays(days);
      setDecorState(next);
      setArrivals((current) => current ?? deriveKingdomArrivals(kingdom, next));
    }, [days, kingdom])
  );
  const handleCeremonyDone = (options?: { openDecorate?: boolean }) => {
    witnessKingdom(kingdom, decorState);
    setArrivals(null);
    if (options?.openDecorate) setCustomising(true);
  };

  const [customising, setCustomising] = useState(false);
  const panRef = useRef<GestureType | undefined>(undefined);
  const getCenterCellRef = useRef<(() => { col: number; row: number } | null) | null>(null);
  // Provenance card for a tapped decoration.
  const [provenanceItem, setProvenanceItem] = useState<KingdomDecorItem | null>(null);

  const renderPatch = useMemo(
    () => ({ ...kingdomPatch, objects: [...kingdomPatch.objects, ...kingdomDecorObjects(decorState)] }),
    [kingdomPatch, decorState]
  );

  const handlePlantGift = (giftId: string, name: string) => {
    const at = getCenterCellRef.current?.();
    setDecorState((state) => plantKingdomGift(state, giftId, at?.col, at?.row));
    setMicrocopy(`${name} planted`);
  };
  const handleMoveDecor = (id: string, col: number, row: number) => {
    setDecorState((state) => moveKingdomDecor(state, id, col, row));
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
  const handleSelectCell = (category: WorldObjectCategory, objectId?: string) => {
    if (category === 'decor') {
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
          patches={[renderPatch]}
          ring={PATCH_RING}
          animateOnMount
          lockCamera
          imageBase
          hideRecenter
          artefacts={worldArtefacts}
          customising={customising}
          onToggleCustomising={() => setCustomising((value) => !value)}
          showCustomiseButton={false}
          onMoveDecor={handleMoveDecor}
          onRemoveDecor={handleRemoveDecor}
          panRef={panRef}
          getCenterCellRef={getCenterCellRef}
          onSelectPatch={() => {}}
          onSelectMemory={() => {}}
          onSelectCell={handleSelectCell}
        />

        {/* Header chrome — the Kingdom's name + what a life has built so far. */}
        <View pointerEvents="box-none" style={styles.header}>
          <View style={styles.headerCopy} pointerEvents="none">
            <ThemedText type="onboardingLabel" style={styles.headerKicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
              Your Kingdom
            </ThemedText>
            <ThemedText style={styles.headerSubtitle} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
              {subtitle}
            </ThemedText>
          </View>
          <View style={styles.headerActions}>
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
        </View>

        {/* Keepsake tray — gifts life has earned, waiting to be planted. Tap one
            to plant it where the camera is centred, then drag it into place. */}
        {customising ? (
          <View style={[styles.decorTray, { bottom: tabBarHeight + 12 }]}>
            <ThemedText style={styles.decorTrayHint} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
              {decorState.unplanted.length > 0
                ? 'Plant your keepsakes · drag to place · ✕ returns them here'
                : 'Live more days to earn keepsakes · drag placed ones to rearrange'}
            </ThemedText>
            {decorState.unplanted.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.giftRow}>
                {decorState.unplanted.map((gift) => (
                  <Pressable
                    key={gift.id}
                    accessibilityRole="button"
                    onPress={() => handlePlantGift(gift.id, gift.name)}
                    style={({ pressed }) => [styles.giftChip, pressed && styles.giftChipPressed]}>
                    <ThemedText style={styles.giftName} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                      {gift.name}
                    </ThemedText>
                    <ThemedText numberOfLines={1} style={styles.giftSource} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                      {gift.provenance.label}
                    </ThemedText>
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
      </View>

      {selectedBuilding ? (
        <KingdomBuildingSheet building={selectedBuilding} onClose={() => setSelectedBuilding(null)} />
      ) : null}

      {/* Provenance card — what a planted keepsake remembers. */}
      {provenanceItem ? (
        <Pressable style={styles.provenanceBackdrop} onPress={() => setProvenanceItem(null)}>
          <Animated.View entering={FadeInDown.duration(240)} style={[styles.provenanceCard, { bottom: tabBarHeight + 24 }]}>
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
      {arrivals && !customising ? <KingdomArrivalCeremony arrivals={arrivals} onDone={handleCeremonyDone} /> : null}

      {celebrateDiscovery && !arrivals && !selectedBuilding && !discoveriesOpen && !cosmeticsOpen && !customising && !provenanceItem ? (
        <DiscoveryReveal discovery={celebrateDiscovery} onDismiss={() => markDiscoverySeen(celebrateDiscovery.id)} />
      ) : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Lantern.ink950, flex: 1 },
  stage: { flex: 1 },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 20,
    position: 'absolute',
    right: 20,
    top: 64,
  },
  headerCopy: { gap: 3 },
  headerKicker: { fontSize: 13, letterSpacing: 1.2 },
  headerSubtitle: { fontSize: 12, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: 10 },
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
  decorTrayHint: { fontSize: 11.5, fontWeight: '700', textAlign: 'center' },
  giftRow: { gap: 8, paddingHorizontal: 2 },
  giftChip: {
    backgroundColor: 'rgba(28,24,48,0.92)',
    borderColor: 'rgba(255,195,107,0.4)',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
    maxWidth: 190,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  giftChipPressed: { backgroundColor: 'rgba(40,34,60,0.95)' },
  giftName: { fontSize: 13, fontWeight: '800' },
  giftSource: { fontSize: 11, fontWeight: '600' },
  provenanceBackdrop: { ...StyleSheet.absoluteFillObject, zIndex: 55 },
  provenanceCard: {
    alignSelf: 'center',
    backgroundColor: '#161226',
    borderColor: 'rgba(255,255,255,0.12)',
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
});
