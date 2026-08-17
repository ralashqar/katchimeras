import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { CalendarMonth } from '@/components/katchadeck/collection/calendar-month';
import { CardDeckCarousel } from '@/components/katchadeck/collection/card-deck-carousel';
import { presenceEnter } from '@/components/katchadeck/motion';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { SegmentedControl } from '@/components/katchadeck/ui/segmented-control';
import { WispArtwork } from '@/components/katchadeck/wisps/wisp-artwork';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaDeckUI, Lantern } from '@/constants/theme';
import { WISP_COLLECTIONS } from '@/constants/wisp-collections';
import { SCENE_CATALOG } from '@/constants/scenes';
import { TODAY_EXPLORATION_BACKGROUND_SOURCES } from '@/constants/today-exploration-background-sources.gen';
import { wispDefinition } from '@/constants/wisps';
import { useWisps } from '@/features/wisps/wisp-provider';
import { useScenes } from '@/features/scenes/scene-provider';
import { getCreatureVisual, hydrateHomeState } from '@/game/days';
import { useAllDays } from '@/hooks/use-all-days';
import { useDiscoveries } from '@/hooks/use-discoveries';
import { useStreak } from '@/hooks/use-streak';
import { useDevAllKatchimerasAvailable } from '@/hooks/use-dev-all-katchimeras-available';
import { homeRepository } from '@/storage/repositories/home-repository';
import type { DailyCreatureCard, HomeRarityTier, StoredHomeState } from '@/types/home';
import { buildDex, dexCategoryLabel, type Dex, type DexEntry } from '@/utils/dex';
import { emptyCompanionBondState, type CompanionBondState } from '@/utils/companion-bond';
import { loadCompanionBondState } from '@/utils/companion-bond-storage';
import { loadCompanionQuests } from '@/utils/katchimera-quests';
import { companionIdResolverForHomeState } from '@/utils/katchimera-identity';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { wispCollectionProgress, wispEvolutionTier } from '@/utils/wisp-collections';
import { dayState, localDateId } from '@/utils/streak-engine';
import { streakRepository } from '@/storage/repositories/streak-repository';

type CollectionView = 'cards' | 'calendar' | 'species' | 'wisps' | 'scenes';
type CardFilters = { year: string; species: string; rarity: string; trait: string };

const collectionViewOptions = [
  { value: 'cards', label: 'Cards' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'species', label: 'Companions' },
  { value: 'wisps', label: 'Wisps' },
  { value: 'scenes', label: 'Scenes' },
] as const;

const EMPTY_FILTERS: CardFilters = { year: 'all', species: 'all', rarity: 'all', trait: 'all' };
const auroraRing = require('../../assets/images/katchimeras/aurora-ring.png');
const SCREEN_HORIZONTAL_PADDING = 20;

const RARITY_COLOR: Record<HomeRarityTier, string> = {
  common: Lantern.moon500,
  rare: '#7DE8CD',
  epic: '#A78BFA',
  legendary: '#FFC36B',
};

export default function CollectionScreen() {
  const router = useRouter();
  const allKatchimerasAvailable = useDevAllKatchimerasAvailable();
  const [state, setState] = useState<StoredHomeState | null>(null);
  const [bondState, setBondState] = useState<CompanionBondState>(emptyCompanionBondState);
  const [view, setView] = useState<CollectionView>('cards');
  const [filters, setFilters] = useState<CardFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { days } = useAllDays();
  const wisps = useWisps();
  const scenes = useScenes();
  const { unlockedCount: discoveriesUnlocked, totalCount: discoveriesTotal } = useDiscoveries();
  useStreak();
  const storedStreak = streakRepository.load();

  useFocusEffect(
    useCallback(() => {
      const profile = loadOnboardingProfile();
      const hydrated = hydrateHomeState(homeRepository.load(), profile, new Date());
      setState(hydrated.state);
      const resolveCompanionId = companionIdResolverForHomeState(hydrated.state);
      const quests = loadCompanionQuests(resolveCompanionId);
      setBondState(loadCompanionBondState(quests, resolveCompanionId, hydrated.state));
    }, [])
  );

  const dex: Dex | null = useMemo(() => {
    if (!state) return null;
    const hatchedDays = [...state.archivedDays, state.today].filter((day) => day.creature !== null);
    return buildDex(
      state.aspectHistory ?? state.encounterHistory,
      hatchedDays,
      bondState,
      { unlockAll: allKatchimerasAvailable },
    );
  }, [allKatchimerasAvailable, bondState, state]);

  const cards = useMemo(
    () => days.flatMap((day) => (day.state === 'hatched' || day.state === 'sealed') && day.card ? [{ card: day.card, dayId: day.id, sealed: day.state === 'sealed' }] : []).sort((left, right) => right.card.isoDate.localeCompare(left.card.isoDate)),
    [days]
  );
  const filterOptions = useMemo(() => buildFilterOptions(cards.map((entry) => entry.card)), [cards]);
  const filteredCards = useMemo(
    () => cards.filter(({ card }) =>
      (filters.year === 'all' || card.isoDate.startsWith(filters.year)) &&
      (filters.species === 'all' || card.speciesId === filters.species) &&
      (filters.rarity === 'all' || card.rarity === filters.rarity) &&
      (filters.trait === 'all' || card.traits.some((trait) => trait.id === filters.trait))
    ),
    [cards, filters]
  );
  const activeFilterCount = Object.values(filters).filter((value) => value !== 'all').length;
  const completion = dex && dex.total > 0 ? Math.round((dex.collected / dex.total) * 100) : 0;
  const carouselCards = useMemo(() => filteredCards.map(({ card }) => card), [filteredCards]);
  const sealedCardIds = useMemo(() => new Set(cards.filter((entry) => entry.sealed).map((entry) => entry.card.id)), [cards]);
  const collectedCardCount = cards.length - sealedCardIds.size;

  return (
    <View style={styles.screen}>
      <AmbientBackground
        accentColor="rgba(167,139,250,0.14)"
        colors={KatchaDeckUI.gradients.world}
        meshColors={['rgba(167,139,250,0.12)', 'rgba(125,232,205,0.08)', 'rgba(255,195,107,0.08)', 'rgba(20,17,31,0.2)']}
      />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
        <Animated.View entering={presenceEnter(20)}>
          <ThemedText type="onboardingLabel" style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            {view === 'species' ? 'The life companions you have met' : view === 'wisps' ? 'Wisps collected from your days' : view === 'scenes' ? 'Places your days discovered' : 'Your life deck'}
          </ThemedText>
          <ThemedText type="display" style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {view === 'cards' ? 'Your life, in cards.' : view === 'calendar' ? 'Every day became something.' : view === 'wisps' ? 'Small memories, still glowing.' : view === 'scenes' ? 'Make Today feel like yours.' : 'Every kind of day.'}
          </ThemedText>
          <ThemedText style={styles.subtitle} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            {view === 'species' && dex
              ? `${dex.collected} of ${dex.total} met · ${completion}% complete`
              : view === 'wisps'
                ? `${Object.values(wisps.state.inventory).filter(Boolean).length} Wisps discovered`
                : view === 'scenes'
                  ? `${Object.values(scenes.state.unlocked).filter(Boolean).length} Scenes discovered`
                : `${collectedCardCount} ${collectedCardCount === 1 ? 'card' : 'cards'} collected`}
          </ThemedText>
        </Animated.View>

        <SegmentedControl options={collectionViewOptions} value={view} onChange={setView} variant="bar" />

        {view === 'cards' ? (
          <>
            <View style={styles.actionRow}>
              <KatchaButton label={activeFilterCount ? `Filters · ${activeFilterCount}` : 'Filter cards'} onPress={() => setFiltersOpen(true)} variant="secondary" />
            </View>
            {filteredCards.length ? (
              <View style={styles.carouselBleed}>
                <CardDeckCarousel
                  cards={carouselCards}
                  sealedCardIds={sealedCardIds}
                  onOpenCard={(cardId) => {
                    const entry = cards.find((candidate) => candidate.card.id === cardId);
                    if (entry?.sealed) {
                      router.replace({ pathname: '/today', params: { recoveryHatchDayId: entry.dayId } });
                      return;
                    }
                    router.push({ pathname: '/card/[cardId]', params: { cardId } });
                  }}
                />
              </View>
            ) : (
              <View style={styles.empty}>
                <IconSymbol color={Lantern.moon500} name="rectangle.stack" size={34} />
                <ThemedText type="subtitle" lightColor={Lantern.moon50} darkColor={Lantern.moon50}>No cards match</ThemedText>
                <ThemedText style={styles.emptyText} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>Reset the filters to bring the whole deck back.</ThemedText>
              </View>
            )}
          </>
        ) : null}

        {view === 'calendar' ? (
          <>
            <View style={styles.actionRow}>
              <KatchaButton label="Open the life map" onPress={() => router.push('/life-map')} variant="secondary" />
              <KatchaButton label={`Discoveries · ${discoveriesUnlocked}/${discoveriesTotal}`} onPress={() => router.push('/discoveries')} variant="secondary" />
            </View>
            <CalendarMonth
              days={days}
              streakStateForDate={(isoDate) => dayState(storedStreak, isoDate, localDateId(new Date()))}
              onSelectDay={(dayId) => {
                const day = days.find((candidate) => candidate.id === dayId);
                if (day?.state === 'hatched' && day.card) {
                  router.push({ pathname: '/card/[cardId]', params: { cardId: day.card.id } });
                  return;
                }
                if (day?.state === 'sealed') {
                  router.replace({ pathname: '/today', params: { recoveryHatchDayId: day.id } });
                }
              }}
            />
          </>
        ) : null}

        {view === 'wisps' ? WISP_COLLECTIONS.map((collection) => {
          const progress = wispCollectionProgress(collection, wisps.state);
          return (
            <View key={collection.id} style={styles.albumCard}>
              <View style={styles.albumHeader}>
                <View style={styles.albumCopy}>
                  <ThemedText selectable type="subtitle" lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{collection.name}</ThemedText>
                  <ThemedText selectable style={styles.albumDescription} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>{collection.description}</ThemedText>
                </View>
                <ThemedText selectable style={styles.albumCount} lightColor={progress.complete ? Lantern.ember300 : Lantern.moon300} darkColor={progress.complete ? Lantern.ember300 : Lantern.moon300}>{progress.owned}/{progress.total}</ThemedText>
              </View>
              <View style={styles.wispGrid}>
                {collection.wispIds.map((id) => {
                  const quantity = wisps.quantity(id);
                  const definition = wispDefinition(id);
                  return (
                    <Pressable key={id} accessibilityRole="button" onPress={() => router.push({ pathname: '/wisp/[wispId]', params: { wispId: id } })} style={({ pressed }) => [styles.wispCell, pressed && styles.wispCellPressed]}>
                      <WispArtwork id={id} silhouette={!quantity} size={48} thumbnail />
                      <ThemedText numberOfLines={1} style={styles.wispName} lightColor={quantity ? Lantern.moon50 : Lantern.moon500} darkColor={quantity ? Lantern.moon50 : Lantern.moon500}>{quantity ? definition.name : '???'}</ThemedText>
                      <ThemedText style={styles.wispTier} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>{quantity ? `Resonance ${wispEvolutionTier(Math.max(1, wisps.resonance(id)))} · ${wisps.resonance(id)} days` : 'Not found'}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.albumReward}>
                <IconSymbol color={progress.complete ? Lantern.ember300 : Lantern.moon500} name={progress.complete ? 'checkmark' : 'gift.fill'} size={14} />
                <ThemedText selectable style={styles.albumRewardText} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{collection.rewardLabel}</ThemedText>
              </View>
            </View>
          );
        }) : null}

        {view === 'scenes' ? (
          <View style={styles.sceneGrid}>
            {SCENE_CATALOG.map((scene) => {
              const owned = scenes.isOwned(scene.id);
              const equipped = scenes.equippedSceneId === scene.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={!owned}
                  key={scene.id}
                  onPress={() => scenes.equip(scene.id)}
                  style={({ pressed }) => [styles.sceneCell, !owned && styles.sceneLocked, pressed && { opacity: 0.82 }]}>
                  <Image contentFit="cover" source={TODAY_EXPLORATION_BACKGROUND_SOURCES[scene.id].source} style={styles.scenePreview} transition={0} />
                  <View style={styles.sceneCellCopy}>
                    <ThemedText numberOfLines={1} style={styles.wispName} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>{owned ? scene.name : 'Undiscovered Scene'}</ThemedText>
                    <ThemedText style={styles.wispTier} lightColor={equipped ? Lantern.ember300 : Lantern.moon500} darkColor={equipped ? Lantern.ember300 : Lantern.moon500}>{equipped ? 'Equipped on Today' : owned ? 'Tap to equip' : 'Hatch a matching day'}</ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {view === 'species' ? dex?.categories.map((category) => {
          const entries = dex.entries.filter((entry) => entry.category === category.category);
          return (
            <View key={category.category} style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText type="onboardingLabel" style={styles.sectionTitle} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{dexCategoryLabel[category.category]}</ThemedText>
                <ThemedText style={styles.sectionCount} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>{category.collected}/{category.total}</ThemedText>
              </View>
              <View style={styles.speciesGrid}>{entries.map((entry) => <DexCell key={entry.speciesId} entry={entry} />)}</View>
            </View>
          );
        }) : null}
      </ScrollView>

      {filtersOpen ? (
        <KatchaSheet
          header={{ eyebrow: 'Your deck', title: 'Filter cards', subtitle: `${filteredCards.length} cards match` }}
          onRequestClose={() => setFiltersOpen(false)}
          scroll
          size="tall"
          surface="night">
          <FilterSection label="Year" options={filterOptions.years} value={filters.year} onChange={(year) => setFilters((current) => ({ ...current, year }))} />
          <FilterSection label="Species" options={filterOptions.species} value={filters.species} onChange={(species) => setFilters((current) => ({ ...current, species }))} />
          <FilterSection label="Rarity" options={filterOptions.rarities} value={filters.rarity} onChange={(rarity) => setFilters((current) => ({ ...current, rarity }))} />
          <FilterSection label="Trait" options={filterOptions.traits} value={filters.trait} onChange={(trait) => setFilters((current) => ({ ...current, trait }))} />
          <KatchaButton label="Reset filters" onPress={() => setFilters(EMPTY_FILTERS)} variant="secondary" />
        </KatchaSheet>
      ) : null}

    </View>
  );
}

function FilterSection({ label, options, value, onChange }: { label: string; options: { id: string; label: string }[]; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.filterSection}>
      <ThemedText type="onboardingLabel" style={styles.filterLabel} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>{label}</ThemedText>
      <View style={styles.filterOptions}>
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onChange(option.id)} style={[styles.filterChip, selected ? styles.filterChipSelected : null]}>
              <ThemedText style={styles.filterChipText} lightColor={selected ? Lantern.ink950 : Lantern.moon300} darkColor={selected ? Lantern.ink950 : Lantern.moon300}>{option.label}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function buildFilterOptions(cards: DailyCreatureCard[]) {
  const unique = (values: { id: string; label: string }[]) => Array.from(new Map(values.map((value) => [value.id, value])).values()).sort((left, right) => left.label.localeCompare(right.label));
  const all = { id: 'all', label: 'All' };
  return {
    years: [all, ...unique(cards.map((card) => ({ id: card.isoDate.slice(0, 4), label: card.isoDate.slice(0, 4) })))],
    species: [all, ...unique(cards.filter((card) => card.speciesId).map((card) => ({ id: card.speciesId!, label: card.creatureName })))],
    rarities: [all, ...unique(cards.map((card) => ({ id: card.rarity, label: card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1) })))],
    traits: [all, ...unique(cards.flatMap((card) => card.traits.map((trait) => ({ id: trait.id, label: trait.label }))))],
  };
}

function DexCell({ entry }: { entry: DexEntry }) {
  const source = getCreatureVisual(entry.visualKey).source;
  const rarityColor = entry.highestRaritySeen ? RARITY_COLOR[entry.highestRaritySeen] : Lantern.moon500;
  return (
    <View style={styles.gridItem}>
      <View style={styles.orb}>
        <Image contentFit="contain" source={auroraRing} style={StyleSheet.absoluteFill} transition={0} />
        {source ? <Image contentFit="contain" source={source} style={[styles.orbImage, entry.locked ? styles.lockedImage : null]} transition={0} /> : null}
      </View>
      <ThemedText style={styles.orbName} lightColor={entry.locked ? Lantern.moon500 : Lantern.moon50} darkColor={entry.locked ? Lantern.moon500 : Lantern.moon50}>{entry.locked ? '???' : entry.name}</ThemedText>
      <ThemedText style={[styles.orbMeta, { color: rarityColor }]}>
        {entry.locked
          ? 'Not yet met'
          : `${entry.forms.filter((form) => form.unlocked).length} forms · ${entry.bondLabel}`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Lantern.ink950, flex: 1 },
  content: { gap: KatchaDeckUI.spacing.lg, paddingBottom: 140, paddingHorizontal: SCREEN_HORIZONTAL_PADDING, paddingTop: 24 },
  kicker: { fontSize: 11 },
  title: { fontSize: 38, lineHeight: 42, marginTop: 8 },
  subtitle: { fontSize: 14, fontWeight: '600', marginTop: 10 },
  actionRow: { gap: 10 },
  carouselBleed: { marginHorizontal: -SCREEN_HORIZONTAL_PADDING },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 60 },
  emptyText: { fontSize: 13, textAlign: 'center' },
  section: { gap: 14 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 12 },
  sectionCount: { fontSize: 12, fontWeight: '700' },
  speciesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  gridItem: { alignItems: 'center', width: 96 },
  orb: { alignItems: 'center', height: 84, justifyContent: 'center', width: 84 },
  orbImage: { height: 62, width: 62 },
  lockedImage: { opacity: 0.12 },
  orbName: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  orbMeta: { fontSize: 11, fontWeight: '600', marginTop: 2, textTransform: 'capitalize' },
  filterSection: { gap: 9, paddingBottom: 8 },
  filterLabel: { fontSize: 10 },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  filterChipSelected: { backgroundColor: Lantern.ember300, borderColor: Lantern.ember300 },
  filterChipText: { fontSize: 12, fontWeight: '700' },
  albumCard: { backgroundColor: 'rgba(255,255,255,0.055)', borderColor: 'rgba(255,255,255,0.1)', borderCurve: 'continuous', borderRadius: 24, borderWidth: 1, gap: 16, padding: 16 },
  albumHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  albumCopy: { flex: 1, gap: 4 },
  albumDescription: { fontSize: 12, lineHeight: 17 },
  albumCount: { fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '900' },
  wispGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wispCell: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderCurve: 'continuous', borderRadius: 16, gap: 2, paddingBottom: 8, paddingHorizontal: 4, paddingTop: 5, width: '23%' },
  wispCellPressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  wispName: { fontSize: 10.5, fontWeight: '800', maxWidth: '100%' },
  wispTier: { fontSize: 8.5, fontWeight: '700', textTransform: 'capitalize' },
  sceneGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sceneCell: { backgroundColor: 'rgba(255,255,255,0.055)', borderColor: 'rgba(255,255,255,0.1)', borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, overflow: 'hidden', width: '48%' },
  sceneLocked: { opacity: 0.38 },
  scenePreview: { aspectRatio: 1.28, width: '100%' },
  sceneCellCopy: { gap: 4, padding: 10 },
  albumReward: { alignItems: 'center', borderTopColor: 'rgba(255,255,255,0.08)', borderTopWidth: 1, flexDirection: 'row', gap: 8, paddingTop: 12 },
  albumRewardText: { flex: 1, fontSize: 11.5, fontWeight: '700' },
});
