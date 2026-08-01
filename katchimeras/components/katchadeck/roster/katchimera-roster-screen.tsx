import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList, type FlashListRef, type ListRenderItemInfo } from '@shopify/flash-list';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KatchimeraRosterCard } from '@/components/katchadeck/roster/katchimera-roster-card';
import { KatchimeraRosterFilters } from '@/components/katchadeck/roster/katchimera-roster-filters';
import { TodaySceneBackdrop } from '@/components/katchadeck/home/today-scene-backdrop';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { lifeAspects } from '@/constants/life-aspects';
import { AppFontFamilies, KatchaDeckUI } from '@/constants/theme';
import type { LifeAspectId } from '@/types/katchimera';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';
import { resolveCreatureArtSource } from '@/utils/creature-art';
import {
  featuredKatchimera,
  filterAndSortKatchimeraRoster,
  katchimeraRosterItemId,
  type KatchimeraRosterItem,
  type KatchimeraRosterSort,
} from '@/utils/katchimera-roster';

type RosterListItem =
  | { type: 'hero'; id: 'hero' }
  | { type: 'filters'; id: 'filters' }
  | { type: 'card'; id: string; item: KatchimeraRosterItem };

const ROSTER_STICKY_HEADER_INDICES = [1];
const ROSTER_MAINTAIN_VISIBLE_POSITION = { disabled: true } as const;

function rosterListKey(item: RosterListItem): string {
  return item.id;
}

function rosterListItemType(item: RosterListItem): string {
  if (item.type !== 'card') return item.type;
  return item.item.kind === 'owned' ? 'card-owned' : 'card-locked';
}

function KatchimeraRosterScreenComponent({
  background,
  items,
  onGoToday,
  onSelectCreature,
}: {
  background: TodayAtmosphereBackground;
  items: KatchimeraRosterItem[];
  onGoToday: () => void;
  onSelectCreature: (creatureId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const listRef = useRef<FlashListRef<RosterListItem>>(null);
  const hasCompletedInitialLoad = useRef(false);
  const [selectedAspect, setSelectedAspect] = useState<LifeAspectId | 'all'>('all');
  const [sort, setSort] = useState<KatchimeraRosterSort>('bond');
  const [sortOpen, setSortOpen] = useState(false);
  const columnCount = width >= 390 ? 3 : 2;
  const horizontalPadding = 14;
  const gap = 9;
  const drawDistance = Math.min(360, Math.max(240, height * 0.4));
  const cardWidth = (
    width
    - horizontalPadding * 2
    - gap * (columnCount - 1)
  ) / columnCount;
  const featured = useMemo(() => featuredKatchimera(items), [items]);
  const availableAspects = useMemo(() => {
    const available = new Set(items.map((item) => item.aspectId));
    return lifeAspects
      .filter((aspect) => available.has(aspect.id))
      .map((aspect) => aspect.id);
  }, [items]);
  const visibleItems = useMemo(
    () => filterAndSortKatchimeraRoster(items, selectedAspect, sort),
    [items, selectedAspect, sort],
  );
  const listItems = useMemo<RosterListItem[]>(() => [
    { type: 'hero', id: 'hero' },
    { type: 'filters', id: 'filters' },
    ...visibleItems.map((item) => ({
      type: 'card' as const,
      id: katchimeraRosterItemId(item),
      item,
    })),
  ], [visibleItems]);

  const contentContainerStyle = useMemo(() => ({
    paddingBottom: insets.bottom + 112,
    paddingHorizontal: horizontalPadding,
  }), [insets.bottom]);

  const selectCreature = useCallback((creatureId: string) => {
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSelectCreature(creatureId);
  }, [onSelectCreature]);
  const scrollToGridStart = useCallback(() => {
    requestAnimationFrame(() => {
      void listRef.current?.scrollToIndex({ animated: false, index: 1 }).catch(() => undefined);
    });
  }, []);
  const changeAspect = useCallback((aspect: LifeAspectId | 'all') => {
    setSelectedAspect(aspect);
    setSortOpen(false);
    scrollToGridStart();
  }, [scrollToGridStart]);
  const changeSort = useCallback((nextSort: KatchimeraRosterSort) => {
    setSort(nextSort);
    setSortOpen(false);
    scrollToGridStart();
  }, [scrollToGridStart]);
  const toggleSort = useCallback(() => setSortOpen((current) => !current), []);
  const handleLoad = useCallback(({ elapsedTimeInMs }: { elapsedTimeInMs: number }) => {
    if (hasCompletedInitialLoad.current) return;
    hasCompletedInitialLoad.current = true;
    if (__DEV__ && process.env.EXPO_PUBLIC_SCENE_PERF === '1') {
      console.info('[roster-perf] initial-grid', { readyMs: Math.round(elapsedTimeInMs * 10) / 10 });
    }
  }, []);
  const renderItem = useCallback(({ item, target }: ListRenderItemInfo<RosterListItem>) => {
    const renderArtwork = target === 'Cell';
    if (item.type === 'hero') {
      return (
        <View style={styles.fullBleedItem}>
          <RosterHero
            featured={featured}
            onGoToday={onGoToday}
            renderArtwork={renderArtwork}
            safeTop={insets.top}
          />
        </View>
      );
    }
    if (item.type === 'filters') {
      return (
        <View style={styles.stickyFilters}>
          <KatchimeraRosterFilters
            aspectIds={availableAspects}
            count={visibleItems.length}
            onAspectChange={changeAspect}
            onSortChange={changeSort}
            onToggleSort={toggleSort}
            selectedAspect={selectedAspect}
            sort={sort}
            sortOpen={sortOpen}
          />
        </View>
      );
    }
    return (
      <View style={styles.cardCell}>
        <KatchimeraRosterCard
          featured={item.item.kind === 'owned' && item.item.creatureId === featured?.creatureId}
          item={item.item}
          onPress={selectCreature}
          renderArtwork={renderArtwork}
          width={cardWidth}
        />
      </View>
    );
  }, [
    availableAspects,
    cardWidth,
    changeAspect,
    changeSort,
    featured,
    insets.top,
    onGoToday,
    selectCreature,
    selectedAspect,
    sort,
    sortOpen,
    toggleSort,
    visibleItems.length,
  ]);
  const overrideItemLayout = useCallback((layout: { span?: number }, item: RosterListItem) => {
    layout.span = item.type === 'card' ? 1 : columnCount;
  }, [columnCount]);

  return (
    <View style={styles.screen}>
      <TodaySceneBackdrop background={background} scene={null} variant="splash" />
      <LinearGradient
        colors={[
          'rgba(14,20,11,0.38)',
          'rgba(17,20,13,0.62)',
          'rgba(14,15,12,0.94)',
        ]}
        locations={[0, 0.36, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(240)}
        style={styles.listFrame}>
        <FlashList<RosterListItem>
          contentContainerStyle={contentContainerStyle}
          data={listItems}
          drawDistance={drawDistance}
          getItemType={rosterListItemType}
          key={`roster-${columnCount}`}
          keyExtractor={rosterListKey}
          keyboardShouldPersistTaps="handled"
          maintainVisibleContentPosition={ROSTER_MAINTAIN_VISIBLE_POSITION}
          numColumns={columnCount}
          onLoad={handleLoad}
          overrideItemLayout={overrideItemLayout}
          ref={listRef}
          renderItem={renderItem}
          style={styles.list}
          stickyHeaderIndices={ROSTER_STICKY_HEADER_INDICES}
          showsVerticalScrollIndicator={false}
        />
      </Animated.View>
    </View>
  );
}

export const KatchimeraRosterScreen = memo(KatchimeraRosterScreenComponent);

function RosterHero({
  featured,
  onGoToday,
  renderArtwork,
  safeTop,
}: {
  featured: ReturnType<typeof featuredKatchimera>;
  onGoToday: () => void;
  renderArtwork: boolean;
  safeTop: number;
}) {
  return (
    <View style={[styles.hero, { paddingTop: safeTop + 20 }]}>
      <View style={styles.heroCopy}>
        <ThemedText selectable style={styles.heroEyebrow} lightColor="#F0D67A" darkColor="#F0D67A">
          YOUR
        </ThemedText>
        <ThemedText
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          numberOfLines={1}
          selectable
          style={styles.heroTitle}
          lightColor="#FFF9E9"
          darkColor="#FFF9E9">
          Katchimeras
        </ThemedText>
        <ThemedText selectable style={styles.heroBody} lightColor="#E8DFC8" darkColor="#E8DFC8">
          Your companions grow from the life you live.
        </ThemedText>
        {featured ? (
          <View style={styles.featuredBond}>
            <IconSymbol name="heart.fill" size={13} color="#F0CF6B" />
            <ThemedText style={styles.featuredBondText} lightColor="#F4E7C3" darkColor="#F4E7C3">
              {featured.name} · Bond level {featured.bond.level}
            </ThemedText>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={onGoToday} style={styles.emptyCta}>
            <IconSymbol name="moon.stars.fill" size={15} color="#34260B" />
            <ThemedText style={styles.emptyCtaText} lightColor="#34260B" darkColor="#34260B">
              Live today to meet one
            </ThemedText>
          </Pressable>
        )}
      </View>
      {featured ? renderArtwork ? (
          <View
            pointerEvents="none"
            style={styles.heroArt}>
            <Image
              accessibilityLabel={`${featured.name}, your closest companion`}
              cachePolicy="memory-disk"
              contentFit="contain"
              recyclingKey={`roster-hero:${featured.creatureId}:${featured.visualKey}`}
              source={resolveCreatureArtSource(featured.visualKey, { lod: 'medium' })}
              style={StyleSheet.absoluteFill}
              transition={0}
            />
          </View>
        ) : null : (
        <View pointerEvents="none" style={styles.emptyArt}>
          <IconSymbol name="sparkles" size={66} color="rgba(240,214,122,0.72)" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#171A12', flex: 1 },
  listFrame: { flex: 1 },
  list: { flex: 1 },
  hero: {
    minHeight: 296,
    overflow: 'hidden',
    paddingBottom: 18,
    paddingHorizontal: 22,
    position: 'relative',
  },
  heroCopy: {
    gap: 5,
    paddingTop: 20,
    width: '54%',
    zIndex: 2,
  },
  heroEyebrow: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  heroTitle: {
    ...KatchaDeckUI.typography.display,
    fontSize: 43,
    lineHeight: 46,
    textShadowColor: 'rgba(12,15,8,0.72)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  heroBody: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    maxWidth: 188,
    textShadowColor: 'rgba(12,15,8,0.76)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  featuredBond: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(28,27,20,0.68)',
    borderColor: 'rgba(255,238,185,0.2)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    minHeight: 33,
    paddingHorizontal: 11,
  },
  featuredBondText: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 9.5,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  heroArt: {
    bottom: -5,
    height: 262,
    position: 'absolute',
    right: -15,
    width: '58%',
  },
  emptyArt: {
    alignItems: 'center',
    bottom: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 35,
  },
  emptyCta: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EBC55C',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 7,
    marginTop: 8,
    minHeight: 38,
    paddingHorizontal: 13,
  },
  emptyCtaText: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 11,
    fontWeight: '900',
  },
  cardCell: { alignItems: 'center', paddingTop: 9 },
  fullBleedItem: { marginHorizontal: -14 },
  stickyFilters: { backgroundColor: '#171A12', marginHorizontal: -14, zIndex: 4 },
});
