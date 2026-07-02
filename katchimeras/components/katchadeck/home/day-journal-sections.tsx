import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { PlacesModal } from '@/components/katchadeck/home/places-modal';
import { dayPromptRegistry } from '@/constants/day-prompts';
import { Lantern } from '@/constants/theme';
import type { DayPromptKind, HomeDayRecord } from '@/types/home';

// Meaning archetypes (calm/energy/together/meaningful) → icon + colour so the
// "what it meant" chips read like the chips shown when the photo was prompted.
const MEANING_META: Record<string, { icon: IconSymbolName; accent: string }> = {
  calm: { icon: 'leaf.fill', accent: '#91D8C7' },
  energy: { icon: 'bolt.fill', accent: '#FFC36B' },
  together: { icon: 'person.2.fill', accent: '#F4BE8D' },
  meaningful: { icon: 'sparkles', accent: '#C77DFF' },
};
const MEANING_FALLBACK: { icon: IconSymbolName; accent: string } = { icon: 'sparkles', accent: '#FFC36B' };

const DAY_PROMPT_ACCENT: Partial<Record<DayPromptKind, string>> = {
  feeling: '#F5AFC6',
  sleep: '#AAB2FF',
  activity: '#91D8C7',
  hobby: '#C77DFF',
  people: '#F4BE8D',
  day_word: '#A7D5FF',
};
const NOTE_FALLBACK_ACCENT = '#C9C2E8';

const STAT_ICON: Record<string, IconSymbolName> = {
  steps: 'figure.walk',
  place: 'mappin.and.ellipse',
  places: 'mappin.and.ellipse',
  photos: 'camera.fill',
  moments: 'sparkles',
};
const ATTENTION_GOLD = '#FFC36B';

export type DayStatKey = 'steps' | 'places' | 'photos' | 'moments';

// A stat value that COUNTS to its new number instead of snapping — so live
// step updates roll up. Eased over ~0.7s; formatting is applied per frame.
function CountingValue({ value, format }: { value: number; format: (value: number) => string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    const from = prevRef.current;
    if (from === value) return;
    prevRef.current = value;
    const started = Date.now();
    const duration = 700;
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - started) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(display)}</>;
}

export function DayJournalSections({
  day,
  onStatPress,
  statAttention,
}: {
  day: HomeDayRecord;
  // When set, every stat tile becomes a door into its category surface (steps →
  // journey sheet, places → Crossroads reader, …) instead of the built-in
  // places modal. Absent → legacy behaviour (hatched/archive views).
  onStatPress?: (key: DayStatKey) => void;
  // Golden highlight per tile when its category is asking a contextual question
  // (same read as utils/today-categories needsAttention).
  statAttention?: Partial<Record<DayStatKey, boolean>>;
}) {
  const photos = collectPhotos(day);
  const meanings = collectMeanings(day);
  // A photo/meaning record can exist while its thumbnail is stale / yields no
  // pixels. Prefetch every thumbnail (photos AND meaning photos) up front and keep
  // only the URIs that actually load — so we never render an empty / grey box.
  const [loadableUris, setLoadableUris] = useState<Set<string>>(() => new Set());
  const [failedUris, setFailedUris] = useState<Set<string>>(() => new Set());
  useEffect(() => {
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

  const timeline = buildDayTimeline(day);
  const timelineGroups = timeline.length >= 1 ? buildTimelineGroups(timeline) : [];

  const placeNodes = day.dayMap?.nodes ?? [];
  const accent = day.creature?.accentColor ?? day.egg?.accentColor ?? '#A7D5FF';
  const [placesOpen, setPlacesOpen] = useState(false);

  const plain = (value: number) => `${value}`;
  const stats: { key: DayStatKey; label: string; value: number; format: (value: number) => string; onPress?: () => void }[] = [
    {
      key: 'steps',
      label: 'steps',
      value: day.stepsCount,
      format: formatCompact,
      onPress: onStatPress ? () => onStatPress('steps') : undefined,
    },
    {
      key: 'places',
      label: day.visitedPlaceCount === 1 ? 'place' : 'places',
      value: day.visitedPlaceCount,
      format: plain,
      onPress: onStatPress
        ? () => onStatPress('places')
        : placeNodes.length > 0
          ? () => setPlacesOpen(true)
          : undefined,
    },
    {
      key: 'photos',
      label: 'photos',
      value: day.vision?.analyzedPhotoCount ?? photos.length,
      format: plain,
      onPress: onStatPress ? () => onStatPress('photos') : undefined,
    },
    // "moments" = everything logged today (prompts, captures, meanings) — the
    // timeline entries. The legacy day.moments list is no longer written to.
    {
      key: 'moments',
      label: 'moments',
      value: timeline.length,
      format: plain,
      onPress: onStatPress ? () => onStatPress('moments') : undefined,
    },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.statsRow}>
        {stats.map((stat) => {
          const attention = !!statAttention?.[stat.key];
          const tint = attention ? ATTENTION_GOLD : accent;
          return (
            <Pressable
              key={stat.key}
              disabled={!stat.onPress}
              onPress={stat.onPress}
              style={[
                styles.statTile,
                stat.onPress ? { borderColor: `${tint}66`, borderWidth: 1 } : null,
                attention ? styles.statTileAttention : null,
              ]}>
              <IconSymbol color={stat.onPress ? tint : Lantern.moon300} name={STAT_ICON[stat.label] ?? 'sparkles'} size={16} />
              <ThemedText style={styles.statValue} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                <CountingValue value={stat.value} format={stat.format} />
              </ThemedText>
              <ThemedText style={styles.statLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                {stat.label}
              </ThemedText>
              {attention ? <View style={styles.statAlertDot} /> : null}
            </Pressable>
          );
        })}
      </View>

      <PlacesModal accentColor={accent} nodes={placeNodes} onClose={() => setPlacesOpen(false)} visible={placesOpen} />

      {meanings.length > 0 || visiblePhotos.length > 0 ? (
        <View style={styles.sectionCard}>
          <ThemedText type="onboardingLabel" style={styles.sectionLabel} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            Photos · what they meant
          </ThemedText>
          {meanings.length > 0 ? (
            <View style={styles.meaningGrid}>
              {meanings.map((meaning) => (
                <View key={meaning.key} style={[styles.meaningCard, { borderColor: `${meaning.accent}44` }]}>
                  {canShowUri(meaning.thumbnailUri) ? (
                    <Image
                      contentFit="cover"
                      onError={() => markUriFailed(meaning.thumbnailUri as string)}
                      source={meaning.thumbnailUri}
                      style={styles.meaningCardThumb}
                      transition={120}
                    />
                  ) : (
                    <View style={[styles.meaningCardThumb, styles.meaningCardIcon, { backgroundColor: `${meaning.accent}22` }]}>
                      <IconSymbol color={meaning.accent} name={meaning.icon} size={18} />
                    </View>
                  )}
                  <ThemedText style={[styles.meaningCardLabel, { color: meaning.accent }]} numberOfLines={2}>
                    {meaning.label}
                  </ThemedText>
                </View>
              ))}
            </View>
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

      {timelineGroups.length > 0 ? (
        <View style={styles.sectionCard}>
          <ThemedText type="onboardingLabel" style={styles.sectionLabel} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            Through the day
          </ThemedText>
          {timelineGroups.map((group) => (
            <View key={group.part} style={styles.timelineGroup}>
              <ThemedText style={styles.timelinePart} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                {group.part}
              </ThemedText>
              {group.buckets.map((bucket) => (
                <View key={bucket.id} style={styles.timelineRow}>
                  <ThemedText style={styles.timelineTime} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                    {bucket.timeLabel}
                  </ThemedText>
                  <View style={styles.timelineChips}>
                    {bucket.items.map((item) => (
                      <View
                        key={item.id}
                        style={[styles.timelineChip, { borderColor: `${item.accent}44`, backgroundColor: `${item.accent}14` }]}>
                        <IconSymbol color={item.accent} name={item.icon} size={12} />
                        {item.category ? (
                          <ThemedText style={styles.timelineChipCategory} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
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

function resolveAnswerIcon(kind: DayPromptKind, choiceIds: string[]): IconSymbolName {
  const prompt = dayPromptRegistry[kind];
  const option = prompt?.options.find((candidate) => choiceIds.includes(candidate.id));
  return option?.icon ?? prompt?.categoryIcon ?? 'sparkles';
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

function humanizeKind(kind: DayPromptKind): string {
  return kind.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

// Everything the user logged today, with a timestamp, woven into one stream:
// moments, prompt answers, photo meanings. Sorted earliest → latest. Display-only.
function buildDayTimeline(day: HomeDayRecord): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const pushAt = (
    createdAt: string,
    id: string,
    icon: IconSymbolName,
    accent: string,
    label: string,
    category?: string
  ) => {
    const time = Date.parse(createdAt);
    if (!Number.isNaN(time) && label.trim()) {
      entries.push({ id, time, timeLabel: formatClock(time), icon, accent, label, category });
    }
  };
  for (const moment of day.moments ?? []) {
    pushAt(moment.createdAt, `m-${moment.id}`, moment.icon, moment.accentColor, moment.label);
  }
  for (const answer of day.promptAnswers ?? []) {
    if (answer.dismissed || answer.labels.length === 0 || answer.kind === 'meaningful_photo') {
      continue;
    }
    const label = answer.labels.join(' · ');
    if (answer.kind === 'meaning') {
      const meta = MEANING_META[answer.choiceIds[0]] ?? MEANING_FALLBACK;
      pushAt(answer.createdAt, `a-${answer.id}`, meta.icon, meta.accent, label);
    } else {
      // A bare value ("Poor") is ambiguous, so carry the category ("Sleep") too.
      pushAt(
        answer.createdAt,
        `a-${answer.id}`,
        resolveAnswerIcon(answer.kind, answer.choiceIds),
        DAY_PROMPT_ACCENT[answer.kind] ?? NOTE_FALLBACK_ACCENT,
        label,
        humanizeKind(answer.kind)
      );
    }
  }
  (day.capturedMeanings ?? []).forEach((captured, index) => {
    const meta = MEANING_META[captured.archetype] ?? MEANING_FALLBACK;
    pushAt(captured.createdAt, `c-${index}`, meta.icon, meta.accent, captured.label);
  });
  for (const note of day.notes ?? []) {
    const meta = MEANING_META[note.archetype] ?? MEANING_FALLBACK;
    pushAt(
      note.createdAt,
      `n-${note.id}`,
      note.kind === 'voice' ? 'mic.fill' : 'square.and.pencil',
      meta.accent,
      note.label,
      note.kind === 'voice' ? 'Voice note' : 'Note'
    );
  }
  return entries.sort((left, right) => left.time - right.time);
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
    gap: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statTile: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderCurve: 'continuous',
    borderRadius: 12,
    flex: 1,
    gap: 3,
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  statTileAttention: {
    backgroundColor: 'rgba(255,195,107,0.10)',
    boxShadow: '0 0 14px rgba(255,195,107,0.28)',
  },
  statAlertDot: {
    backgroundColor: ATTENTION_GOLD,
    borderRadius: 999,
    height: 8,
    position: 'absolute',
    right: 8,
    top: 8,
    width: 8,
  },
  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(215, 228, 255, 0.1)',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 11,
  },
  meaningGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  meaningCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    flexBasis: '47%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: 10,
    padding: 8,
  },
  meaningCardThumb: {
    borderRadius: 9,
    height: 40,
    width: 40,
  },
  meaningCardIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  meaningCardLabel: {
    flexShrink: 1,
    fontSize: 13,
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
