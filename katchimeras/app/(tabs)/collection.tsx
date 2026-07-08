import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { CalendarMonth } from '@/components/katchadeck/collection/calendar-month';
import { DiscoveriesHallSheet } from '@/components/katchadeck/world/discoveries-hall-sheet';
import { presenceEnter } from '@/components/katchadeck/motion';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { SegmentedControl } from '@/components/katchadeck/ui/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { homeCreatureVisuals } from '@/constants/home-mvp';
import { KatchaDeckUI, Lantern } from '@/constants/theme';
import { useAllDays } from '@/hooks/use-all-days';
import { useDiscoveries } from '@/hooks/use-discoveries';
import { homeRepository } from '@/storage/repositories/home-repository';
import type { StoredHomeState } from '@/types/home';
import { bondStageLabel } from '@/utils/bond';
import { buildDex, dexCategoryLabel, type Dex, type DexEntry } from '@/utils/dex';
import { hydrateHomeState } from '@/game/days';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { requestSelectedDay } from '@/utils/selected-day-signal';

type CollectionView = 'calendar' | 'dex';

const collectionViewOptions = [
  { value: 'calendar', label: 'Calendar' },
  { value: 'dex', label: 'Dex' },
] as const;

const auroraRing = require('../../assets/images/katchimeras/aurora-ring.png');

const RARITY_COLOR: Record<string, string> = {
  common: Lantern.moon500,
  rare: '#7DE8CD',
  epic: '#A78BFA',
  legendary: '#FFC36B',
};

export default function CollectionScreen() {
  const router = useRouter();
  const [state, setState] = useState<StoredHomeState | null>(null);
  const [view, setView] = useState<CollectionView>('calendar');
  const [discoveriesOpen, setDiscoveriesOpen] = useState(false);
  const { days } = useAllDays();
  const { entries: discoveryEntries, unlockedCount: discoveriesUnlocked, totalCount: discoveriesTotal } = useDiscoveries();

  useFocusEffect(
    useCallback(() => {
      const profile = loadOnboardingProfile();
      const hydrated = hydrateHomeState(homeRepository.load(), profile, new Date());
      setState(hydrated.state);
    }, [])
  );

  const dex: Dex | null = useMemo(() => {
    if (!state) return null;
    const hatchedDays = [...state.archivedDays, state.today].filter((day) => day.creature !== null);
    return buildDex(state.encounterHistory, hatchedDays);
  }, [state]);

  const hatchedTotal = days.filter((day) => day.creature !== null).length;
  const completion = dex && dex.total > 0 ? Math.round((dex.collected / dex.total) * 100) : 0;

  return (
    <View style={styles.screen}>
      <AmbientBackground
        accentColor="rgba(167,139,250,0.14)"
        colors={KatchaDeckUI.gradients.world}
        meshColors={['rgba(167,139,250,0.12)', 'rgba(125,232,205,0.08)', 'rgba(255,195,107,0.08)', 'rgba(20,17,31,0.2)']}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={presenceEnter()}>
          <ThemedText type="onboardingLabel" style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            {view === 'calendar' ? 'Your days' : 'The Dex'}
          </ThemedText>
          <ThemedText type="display" style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {view === 'calendar' ? 'Every day, a creature.' : 'Every kind of day.'}
          </ThemedText>
          <ThemedText style={styles.subtitle} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            {view === 'calendar'
              ? `${hatchedTotal} ${hatchedTotal === 1 ? 'day' : 'days'} hatched · tap one to open its journal`
              : dex
                ? `${dex.collected} of ${dex.total} met · ${completion}% complete`
                : 'Loading…'}
          </ThemedText>
        </Animated.View>

        <Animated.View entering={presenceEnter(30)}>
          <SegmentedControl
            options={collectionViewOptions}
            value={view}
            onChange={setView}
            variant="bar"
          />
        </Animated.View>

        <Animated.View entering={presenceEnter(40)}>
          <KatchaButton label="Open the life map" onPress={() => router.push('/life-map')} variant="secondary" />
        </Animated.View>

        <Animated.View entering={presenceEnter(50)}>
          <KatchaButton
            label={`Discoveries · ${discoveriesUnlocked}/${discoveriesTotal}`}
            onPress={() => setDiscoveriesOpen(true)}
            variant="secondary"
          />
        </Animated.View>

        {view === 'calendar' ? (
          <Animated.View entering={presenceEnter(80)}>
            <CalendarMonth
              days={days}
              onSelectDay={(dayId) => {
                // Show the regular Home page for the chosen day instead of a
                // separate page: hand the day to the Today tab and switch to it.
                requestSelectedDay(dayId);
                router.replace('/today');
              }}
            />
          </Animated.View>
        ) : null}

        {view === 'dex'
          ? dex?.categories.map((category, sectionIndex) => {
          const entries = dex.entries.filter((entry) => entry.category === category.category);
          return (
            <Animated.View key={category.category} entering={presenceEnter(80 + sectionIndex * 40)} style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText type="onboardingLabel" style={styles.sectionTitle} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                  {dexCategoryLabel[category.category]}
                </ThemedText>
                <ThemedText style={styles.sectionCount} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                  {category.collected}/{category.total}
                </ThemedText>
              </View>
              <View style={styles.grid}>
                {entries.map((entry) => (
                  <DexCell key={entry.speciesId} entry={entry} />
                ))}
              </View>
            </Animated.View>
          );
        })
          : null}
      </ScrollView>

      {discoveriesOpen ? (
        <DiscoveriesHallSheet
          entries={discoveryEntries}
          unlockedCount={discoveriesUnlocked}
          totalCount={discoveriesTotal}
          onClose={() => setDiscoveriesOpen(false)}
        />
      ) : null}
    </View>
  );
}

function DexCell({ entry }: { entry: DexEntry }) {
  const source = homeCreatureVisuals[entry.visualKey]?.source ?? null;
  const rarityColor = entry.highestRaritySeen ? RARITY_COLOR[entry.highestRaritySeen] ?? Lantern.moon500 : Lantern.moon500;

  return (
    <View style={styles.gridItem}>
      <View style={styles.orb}>
        <Image contentFit="contain" source={auroraRing} style={StyleSheet.absoluteFill} transition={0} />
        {source ? (
          <Image
            contentFit="contain"
            source={source}
            style={[styles.orbImage, entry.locked ? styles.lockedImage : null]}
            transition={0}
          />
        ) : null}
      </View>
      <ThemedText style={styles.orbName} lightColor={entry.locked ? Lantern.moon500 : Lantern.moon50} darkColor={entry.locked ? Lantern.moon500 : Lantern.moon50}>
        {entry.locked ? '???' : entry.name}
      </ThemedText>
      {entry.locked ? (
        <ThemedText style={styles.orbMeta} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
          Not yet met
        </ThemedText>
      ) : (
        <ThemedText style={[styles.orbMeta, { color: rarityColor }]}>
          {entry.highestRaritySeen ?? 'common'} · {bondStageLabel(entry.bondStage)}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: Lantern.ink950,
    flex: 1,
  },
  content: {
    gap: KatchaDeckUI.spacing.lg,
    paddingBottom: 140,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  kicker: {
    fontSize: 11,
  },
  title: {
    fontSize: 40,
    lineHeight: 44,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
  },
  section: {
    gap: 14,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 12,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    justifyContent: 'flex-start',
  },
  gridItem: {
    alignItems: 'center',
    width: 96,
  },
  orb: {
    alignItems: 'center',
    height: 84,
    justifyContent: 'center',
    width: 84,
  },
  orbImage: {
    height: 62,
    width: 62,
  },
  lockedImage: {
    opacity: 0.12,
  },
  orbName: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  orbMeta: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'capitalize',
  },
});
