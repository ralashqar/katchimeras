import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { PlacesModal } from '@/components/katchadeck/home/places-modal';
import { CATEGORY_ART, VARIANT_ART } from '@/components/katchadeck/home/today-category-ring';
import { AnimatedBorderHighlight } from '@/components/katchadeck/ui/animated-border-highlight';
import { Meadow } from '@/constants/meadow-theme';
import type { HomeDayRecord } from '@/types/home';
import type { TodayCategoryState } from '@/utils/today-categories';
import { buildMomentTimeline } from '@/utils/moment-timeline';

// Meaning archetypes (calm/energy/together/meaningful) → icon + colour so the
// "what it meant" chips read like the chips shown when the photo was prompted.
const MEANING_META: Record<string, { icon: IconSymbolName; accent: string }> = {
  calm: { icon: 'leaf.fill', accent: '#91D8C7' },
  energy: { icon: 'bolt.fill', accent: '#FFC36B' },
  together: { icon: 'person.2.fill', accent: '#F4BE8D' },
  meaningful: { icon: 'sparkles', accent: '#C77DFF' },
};
const MEANING_FALLBACK: { icon: IconSymbolName; accent: string } = { icon: 'sparkles', accent: '#FFC36B' };

const STAT_ART: Record<DayStatKey, number> = {
  steps: require('../../../assets/images/katchimeras/card-icons/steps.png'),
  places: require('../../../assets/images/katchimeras/card-icons/place.png'),
  photos: require('../../../assets/images/katchimeras/card-icons/photos.png'),
  moments: require('../../../assets/images/katchimeras/card-icons/highlight.png'),
};
// The 'Through the day' card is parked while the v3 layout settles.
const SHOW_TIMELINE_SECTION = false;
// The photos card is parked too (v5 mockup slims Today to egg + numbers).
const SHOW_PHOTOS_SECTION = false;

export type DayStatKey = 'steps' | 'places' | 'photos' | 'moments';

function DayJournalSectionsComponent({
  day,
  loadingStats,
  momentCount,
  onStatPress,
  statAttention,
  categories,
  onCategoryPress,
}: {
  day: HomeDayRecord;
  loadingStats?: DayStatKey[];
  momentCount?: number;
  // When set, every stat tile becomes a door into its category surface (steps →
  // journey sheet, places → Crossroads reader, …) instead of the built-in
  // places modal. Absent → legacy behaviour (hatched/archive views).
  onStatPress?: (key: DayStatKey) => void;
  // Golden highlight per tile when its category is asking a contextual question
  // (same read as utils/today-categories needsAttention).
  statAttention?: Partial<Record<DayStatKey, boolean>>;
  // Category doors (Inspo / Mood / Sleep / Food) rendered as a row ABOVE the
  // stats, inside the same panel — the ring around the egg keeps only quests.
  categories?: TodayCategoryState[];
  onCategoryPress?: (category: TodayCategoryState) => void;
}) {
  // The media sections are parked on Today. Avoid traversing and prefetching
  // their content during every deck selection while they are not rendered.
  const photos = SHOW_PHOTOS_SECTION ? collectPhotos(day) : [];
  const meanings = SHOW_PHOTOS_SECTION ? collectMeanings(day) : [];
  // A photo/meaning record can exist while its thumbnail is stale / yields no
  // pixels. Prefetch every thumbnail (photos AND meaning photos) up front and keep
  // only the URIs that actually load — so we never render an empty / grey box.
  const [loadableUris, setLoadableUris] = useState<Set<string>>(() => new Set());
  const [failedUris, setFailedUris] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!SHOW_PHOTOS_SECTION) return;
    let active = true;
    setLoadableUris(new Set());
    setFailedUris(new Set());
    const uris = new Set<string>();
    for (const photo of collectPhotos(day)) {
      uris.add(photo.thumbnailUri);
    }
    for (const meaning of collectMeanings(day)) {
      if (meaning.thumbnailUri) {
        uris.add(meaning.thumbnailUri);
      }
    }
    void (async () => {
      const checked = await Promise.all(
        [...uris].map(async (uri) => {
          try {
            return (await Image.prefetch(uri)) ? uri : null;
          } catch {
            return null;
          }
        })
      );
      if (active) {
        setLoadableUris(new Set(checked.filter((uri): uri is string => uri !== null)));
      }
    })();
    return () => {
      active = false;
    };
    // photos/meanings derive from `day`; re-check whenever the day changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.id]);
  const canShowUri = (uri: string | null | undefined): uri is string =>
    Boolean(uri) && loadableUris.has(uri as string) && !failedUris.has(uri as string);
  const markUriFailed = (uri: string) =>
    setFailedUris((prev) => (prev.has(uri) ? prev : new Set(prev).add(uri)));

  const visiblePhotos = photos.filter((photo) => canShowUri(photo.thumbnailUri));
  // Photos already shown beside a meaning aren't repeated in the plain grid below.
  const meaningUris = new Set(meanings.map((meaning) => meaning.thumbnailUri).filter(canShowUri));
  const extraPhotos = visiblePhotos.filter((photo) => !meaningUris.has(photo.thumbnailUri));

  const timeline = SHOW_TIMELINE_SECTION ? buildDayTimeline(day) : [];
  const timelineGroups = SHOW_TIMELINE_SECTION && timeline.length >= 1 ? buildTimelineGroups(timeline) : [];

  const placeNodes = day.dayMap?.nodes ?? [];
  const accent = day.creature?.accentColor ?? day.egg?.accentColor ?? '#A7D5FF';
  const [placesOpen, setPlacesOpen] = useState(false);

  const openPlaces = useCallback(() => setPlacesOpen(true), []);
  const closePlaces = useCallback(() => setPlacesOpen(false), []);
  const momentCountLoading = loadingStats?.includes('moments') ?? false;
  const resolvedMomentCount = momentCountLoading ? 0 : momentCount ?? buildMomentTimeline(day).length;
    // "moments" = everything logged today (prompts, captures, meanings) — the
    // timeline entries. The legacy day.moments list is no longer written to.
  return (
    <View style={styles.wrap}>
      <View style={styles.sectionCard}>
        <CategoryTiles categories={categories} onCategoryPress={onCategoryPress} />
        {categories && categories.length > 0 ? <View style={styles.panelDivider} /> : null}
        <StatTiles
          loadingStats={loadingStats}
          momentCount={resolvedMomentCount}
          onOpenPlaces={placeNodes.length > 0 ? openPlaces : undefined}
          onStatPress={onStatPress}
          photoCount={day.vision?.analyzedPhotoCount ?? photos.length}
          placeCount={day.visitedPlaceCount}
          statAttention={statAttention}
          steps={day.stepsCount}
        />
      </View>

      {placesOpen ? <PlacesModal accentColor={accent} nodes={placeNodes} onClose={closePlaces} visible /> : null}

      {SHOW_PHOTOS_SECTION && (meanings.length > 0 || visiblePhotos.length > 0) ? (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>
              Photos · what they meant
            </ThemedText>
            {onStatPress ? (
              <Pressable accessibilityRole="button" onPress={() => onStatPress('photos')} style={styles.seeAll}>
                <ThemedText style={styles.seeAllLabel} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                  See all
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
          {meanings.length > 0 ? (
            // The mockup's photo tiles: the photo IS the card, with the meaning
            // as a caption on a dark scrim along the bottom edge.
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.meaningRow}>
              {meanings.map((meaning) => (
                <View key={meaning.key} style={styles.meaningTile}>
                  {canShowUri(meaning.thumbnailUri) ? (
                    <Image
                      contentFit="cover"
                      onError={() => markUriFailed(meaning.thumbnailUri as string)}
                      source={meaning.thumbnailUri}
                      style={StyleSheet.absoluteFill}
                      transition={120}
                    />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, styles.meaningTileEmpty]}>
                      <IconSymbol color={Meadow.iconOnCard} name={meaning.icon} size={26} />
                    </View>
                  )}
                  <View style={styles.meaningCaption}>
                    <IconSymbol color={meaning.accent} name={meaning.icon} size={10} />
                    <ThemedText style={styles.meaningCaptionLabel} numberOfLines={1} lightColor="#FBF3E4" darkColor="#FBF3E4">
                      {meaning.label}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : null}
          {extraPhotos.length > 0 ? (
            <View style={styles.photoGrid}>
              {extraPhotos.slice(0, 9).map((photo) => (
                <Image
                  key={photo.id}
                  contentFit="cover"
                  onError={() => markUriFailed(photo.thumbnailUri)}
                  source={photo.thumbnailUri}
                  style={styles.photo}
                  transition={120}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {SHOW_TIMELINE_SECTION && timelineGroups.length > 0 ? (
        <View style={styles.sectionCard}>
          <ThemedText type="onboardingLabel" style={styles.sectionLabel} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>
            Through the day
          </ThemedText>
          {timelineGroups.map((group) => (
            <View key={group.part} style={styles.timelineGroup}>
              <ThemedText style={styles.timelinePart} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                {group.part}
              </ThemedText>
              {group.buckets.map((bucket) => (
                <View key={bucket.id} style={styles.timelineRow}>
                  <ThemedText style={styles.timelineTime} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                    {bucket.timeLabel}
                  </ThemedText>
                  <View style={styles.timelineChips}>
                    {bucket.items.map((item) => (
                      <View
                        key={item.id}
                        style={[styles.timelineChip, { borderColor: `${item.accent}44`, backgroundColor: `${item.accent}14` }]}>
                        <IconSymbol color={item.accent} name={item.icon} size={12} />
                        {item.category ? (
                          <ThemedText style={styles.timelineChipCategory} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>
                            {item.category}
                          </ThemedText>
                        ) : null}
                        <ThemedText style={[styles.timelineChipLabel, { color: item.accent }]} numberOfLines={1}>
                          {item.label}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const CategoryTiles = memo(function CategoryTiles({
  categories,
  onCategoryPress,
}: {
  categories?: TodayCategoryState[];
  onCategoryPress?: (category: TodayCategoryState) => void;
}) {
  if (!categories || categories.length === 0) return null;
  return (
    <View style={styles.categoryRow}>
      {categories.map((category) => {
        const art =
          (category.variant ? VARIANT_ART[category.id]?.[category.variant] : undefined) ??
          CATEGORY_ART[category.id];
        const badge = category.countLabel ?? (category.count > 0 ? `${category.count}` : null);
        return (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityLabel={`${category.label}${badge ? ` (${badge})` : ''}`}
            disabled={!onCategoryPress}
            onPress={() => onCategoryPress?.(category)}
            style={styles.categoryTile}>
            {category.needsAttention ? <AnimatedBorderHighlight borderRadius={Meadow.radius.tile} /> : null}
            {art ? (
              <Image source={art} style={styles.categoryArt} contentFit="contain" transition={0} />
            ) : (
              <IconSymbol name={category.icon} size={30} color={Meadow.iconOnCard} />
            )}
            <ThemedText numberOfLines={1} style={styles.categoryLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>
              {category.label}
            </ThemedText>
            {badge ? (
              <View style={styles.categoryBadge} pointerEvents="none">
                <ThemedText style={styles.categoryBadgeLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                  {badge}
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
});

const StatTiles = memo(function StatTiles({
  loadingStats,
  momentCount,
  onOpenPlaces,
  onStatPress,
  photoCount,
  placeCount,
  statAttention,
  steps,
}: {
  loadingStats?: DayStatKey[];
  momentCount: number;
  onOpenPlaces?: () => void;
  onStatPress?: (key: DayStatKey) => void;
  photoCount: number;
  placeCount: number;
  statAttention?: Partial<Record<DayStatKey, boolean>>;
  steps: number;
}) {
  const plain = (value: number) => `${value}`;
  const stats: {
    key: DayStatKey;
    label: string;
    value: number;
    format: (value: number) => string;
    onPress?: () => void;
  }[] = [
    {
      key: 'steps',
      label: 'steps',
      value: steps,
      format: formatCompact,
      onPress: onStatPress ? () => onStatPress('steps') : undefined,
    },
    {
      key: 'places',
      label: placeCount === 1 ? 'place' : 'places',
      value: placeCount,
      format: plain,
      onPress: onStatPress ? () => onStatPress('places') : onOpenPlaces,
    },
    {
      key: 'photos',
      label: 'photos',
      value: photoCount,
      format: plain,
      onPress: onStatPress ? () => onStatPress('photos') : undefined,
    },
    {
      key: 'moments',
      label: 'moments',
      value: momentCount,
      format: plain,
      onPress: onStatPress ? () => onStatPress('moments') : undefined,
    },
  ];

  return (
    <View style={styles.statsRow}>
      {stats.map((stat) => {
        const attention = !!statAttention?.[stat.key];
        const loading = loadingStats?.includes(stat.key) ?? false;
        return (
          <Pressable
            key={stat.key}
            accessibilityLabel={loading
              ? `Loading ${stat.label}`
              : `${stat.value} ${stat.label}${attention ? stat.key === 'photos' ? ', new photos ready to review' : ', needs review' : ''}`}
            accessibilityRole="button"
            disabled={!stat.onPress}
            onPress={stat.onPress}
            style={({ pressed }) => [styles.statTile, pressed && stat.onPress ? styles.statTilePressed : null]}>
            {attention ? <AnimatedBorderHighlight borderRadius={Meadow.radius.tile} /> : null}
            <Image contentFit="contain" source={STAT_ART[stat.key]} style={styles.statArt} transition={0} />
            {loading ? (
              <ActivityIndicator color={Meadow.inkSoft} size="small" style={styles.statLoading} />
            ) : (
              <ThemedText style={styles.statValue} lightColor={Meadow.ink} darkColor={Meadow.ink}>
                {stat.format(stat.value)}
              </ThemedText>
            )}
            <ThemedText style={styles.statLabel} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>
              {stat.label}
            </ThemedText>
            {attention ? (
              stat.key === 'photos' ? (
                <View pointerEvents="none" style={styles.photoReviewBadge}>
                  <IconSymbol name="sparkles" size={8} color={Meadow.ink} />
                  <ThemedText style={styles.photoReviewBadgeLabel} lightColor={Meadow.ink} darkColor={Meadow.ink}>New</ThemedText>
                </View>
              ) : <View style={styles.statAlertDot} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
});

export const DayJournalSections = memo(DayJournalSectionsComponent);

function collectPhotos(day: HomeDayRecord): { id: string; thumbnailUri: string }[] {
  if (!day.dayMap) {
    return [];
  }
  const seen = new Set<string>();
  const out: { id: string; thumbnailUri: string }[] = [];
  for (const node of day.dayMap.nodes) {
    for (const photo of node.photos) {
      if (!seen.has(photo.id) && photo.thumbnailUri) {
        seen.add(photo.id);
        out.push({ id: photo.id, thumbnailUri: photo.thumbnailUri });
      }
    }
  }
  return out;
}

type Meaning = { key: string; label: string; icon: IconSymbolName; accent: string; thumbnailUri: string | null };

function collectMeanings(day: HomeDayRecord): Meaning[] {
  const out: Meaning[] = [];
  const seen = new Set<string>();
  const add = (label: string, choiceId: string | undefined, thumbnailUri: string | null | undefined) => {
    const key = label.trim().toLowerCase();
    if (!key || seen.has(key) || out.length >= 8) {
      return;
    }
    seen.add(key);
    const meta = (choiceId && MEANING_META[choiceId]) || MEANING_FALLBACK;
    out.push({ key, label, icon: meta.icon, accent: meta.accent, thumbnailUri: thumbnailUri ?? null });
  };
  // The camera / essence answers ("Working", "A slow sip") — each with its photo.
  for (const captured of day.capturedMeanings ?? []) {
    add(captured.label, captured.archetype, captured.thumbnailUri);
  }
  const hero = day.heroPhoto;
  if (hero) {
    hero.meaningLabels.forEach((label, index) => add(label, hero.meaningChoiceIds[index], hero.thumbnailUri));
  }
  for (const answer of day.promptAnswers ?? []) {
    // Only the real meaning answer — NOT the 'meaningful_photo' selection step,
    // whose label is just the placeholder "Meaningful photo".
    if (answer.kind === 'meaning' && !answer.dismissed) {
      answer.labels.forEach((label, index) => add(label, answer.choiceIds[index], day.heroPhoto?.thumbnailUri ?? null));
    }
  }
  return out;
}

type TimelineEntry = {
  id: string;
  time: number;
  timeLabel: string;
  icon: IconSymbolName;
  accent: string;
  label: string;
  category?: string;
};

// Everything the user logged today, with a timestamp, woven into one stream:
// moments, prompt answers, photo meanings. Sorted earliest → latest. Display-only.
function buildDayTimeline(day: HomeDayRecord): TimelineEntry[] {
  return buildMomentTimeline(day).map((entry) => ({
    id: entry.id,
    time: entry.time,
    timeLabel: formatClock(entry.time),
    icon: entry.icon,
    accent: entry.accent,
    label: entry.label,
    category: entry.category,
  }));
}

type TimelineBucket = { id: string; time: number; timeLabel: string; items: TimelineEntry[] };

const BUCKET_MS = 15 * 60 * 1000;

// Collapse entries within the same 15-minute window into one timestamped bucket,
// then group the buckets by daypart. Entries arrive sorted, so same-window entries
// are contiguous.
function buildTimelineGroups(entries: TimelineEntry[]): { part: string; buckets: TimelineBucket[] }[] {
  const buckets: TimelineBucket[] = [];
  for (const entry of entries) {
    const index = Math.floor(entry.time / BUCKET_MS);
    const last = buckets[buckets.length - 1];
    if (last && Math.floor(last.time / BUCKET_MS) === index) {
      last.items.push(entry);
    } else {
      buckets.push({ id: `b-${index}`, time: entry.time, timeLabel: entry.timeLabel, items: [entry] });
    }
  }
  const groups: { part: string; buckets: TimelineBucket[] }[] = [];
  for (const bucket of buckets) {
    const part = daypartOf(bucket.time);
    const last = groups[groups.length - 1];
    if (last && last.part === part) {
      last.buckets.push(bucket);
    } else {
      groups.push({ part, buckets: [bucket] });
    }
  }
  return groups;
}

function daypartOf(time: number): string {
  const hour = new Date(time).getHours();
  if (hour < 12) {
    return 'Morning';
  }
  if (hour < 17) {
    return 'Afternoon';
  }
  if (hour < 21) {
    return 'Evening';
  }
  return 'Night';
}

function formatClock(time: number): string {
  const date = new Date(time);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes < 10 ? `0${minutes}` : minutes} ${period}`;
}

function formatCompact(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return `${value}`;
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 7,
  },
  // Category doors row (mockup panel): the same 3D icon art the ring chips
  // used, on light tiles with the label tight beneath.
  categoryRow: {
    flexDirection: 'row',
    gap: 7,
  },
  categoryTile: {
    alignItems: 'center',
    backgroundColor: Meadow.cardSoft,
    borderColor: Meadow.cardBorder,
    borderCurve: 'continuous',
    borderRadius: Meadow.radius.tile,
    borderWidth: 1,
    boxShadow: '0 3px 7px rgba(58, 38, 18, 0.16), inset 0 1px 0 rgba(255, 248, 230, 0.68)',
    flex: 1,
    gap: 1,
    height: 58,
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  categoryArt: {
    height: 35,
    width: 38,
  },
  categoryLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    lineHeight: 14,
  },
  categoryBadge: {
    alignItems: 'center',
    backgroundColor: Meadow.gold,
    borderColor: Meadow.goldDeep,
    borderRadius: 999,
    borderWidth: 1.5,
    boxShadow: '0 2px 6px rgba(40, 26, 8, 0.35)',
    height: 20,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 5,
    position: 'absolute',
    right: -5,
    top: -5,
  },
  categoryBadgeLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    lineHeight: 13,
    textAlign: 'center',
  },
  panelDivider: {
    backgroundColor: 'rgba(122, 84, 44, 0.13)',
    height: 1,
  },
  statTile: {
    alignItems: 'center',
    backgroundColor: Meadow.cardSoft,
    borderColor: Meadow.cardBorder,
    borderCurve: 'continuous',
    borderRadius: Meadow.radius.tile,
    borderWidth: 1,
    // Bottom-LEFT drop shadow (light from the upper right) lifts each tile
    // off the card; the inset line is a soft top bevel.
    boxShadow: '0 3px 7px rgba(58, 38, 18, 0.16), inset 0 1px 0 rgba(255, 248, 230, 0.68)',
    flex: 1,
    gap: 1,
    height: 76,
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  statTilePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  statArt: {
    height: 40,
    width: 48,
  },
  // Value + label sit as one tight caption block under the big icon.
  statValue: {
    fontSize: 17.5,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    lineHeight: 20,
  },
  statLoading: {
    height: 20,
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    lineHeight: 11,
    marginTop: -2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statAlertDot: {
    // Deep gold with a darker rim — the pale gold read as a washed-out peach
    // dot on the cream tile.
    backgroundColor: '#E9A93E',
    borderColor: Meadow.goldDeep,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 9,
    position: 'absolute',
    right: 8,
    top: 8,
    width: 9,
  },
  photoReviewBadge: {
    alignItems: 'center',
    backgroundColor: Meadow.gold,
    borderColor: Meadow.goldDeep,
    borderRadius: 999,
    borderWidth: 1,
    boxShadow: '0 2px 6px rgba(58,38,18,0.24), inset 0 1px 0 rgba(255,248,230,0.52)',
    flexDirection: 'row',
    gap: 2,
    minHeight: 18,
    paddingHorizontal: 5,
    position: 'absolute',
    right: -5,
    top: -6,
    zIndex: 4,
  },
  photoReviewBadgeLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
    lineHeight: 10,
    textTransform: 'uppercase',
  },
  sectionCard: {
    backgroundColor: Meadow.card,
    borderColor: Meadow.cardBorder,
    borderCurve: 'continuous',
    borderRadius: Meadow.radius.card,
    borderWidth: 1.25,
    boxShadow: '0 7px 18px rgba(52, 34, 16, 0.22), inset 0 1px 0 rgba(255, 250, 236, 0.72), inset 0 -1px 0 rgba(151, 105, 54, 0.12)',
    gap: 6,
    padding: 8,
  },
  sectionLabel: {
    fontSize: Meadow.type.kicker,
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  seeAll: {
    backgroundColor: Meadow.cardSoft,
    borderColor: Meadow.cardBorder,
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  seeAllLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  meaningRow: {
    gap: 8,
    paddingRight: 4,
  },
  meaningTile: {
    backgroundColor: Meadow.cardSoft,
    borderCurve: 'continuous',
    borderRadius: 12,
    boxShadow: '-3px 4px 8px rgba(58, 38, 18, 0.20)',
    height: 104,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: 82,
  },
  meaningTileEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  meaningCaption: {
    alignItems: 'center',
    backgroundColor: 'rgba(30, 20, 10, 0.62)',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  meaningCaptionLabel: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '700',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  photo: {
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    flexBasis: '31.5%',
  },
  timelineGroup: {
    gap: 8,
  },
  timelinePart: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  timelineRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  timelineTime: {
    fontSize: 11,
    fontWeight: '600',
    paddingTop: 5,
    width: 62,
  },
  timelineChips: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  timelineChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timelineChipCategory: {
    fontSize: 12,
    fontWeight: '600',
  },
  timelineChipLabel: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
  },
});
