import { READY_WISPS, WISP_CATALOG, wispDefinition } from '@/constants/wisps';
import type { HomeDayRecord, StoredHomeDayRecord } from '@/types/home';
import type { WispConfidence, WispDayCandidate, WispId, WispProgress } from '@/types/wisp';

type Day = StoredHomeDayRecord | HomeDayRecord;

const CONFIDENCE_WEIGHT: Record<WispConfidence, number> = {
  explicit: 1,
  confirmed: 0.92,
  inferred: 0.72,
};

const candidate = (
  wispId: WispId,
  strength: number,
  confidence: WispConfidence,
  evidence: string[],
): WispDayCandidate => ({
  wispId,
  score: Math.round(strength * CONFIDENCE_WEIGHT[confidence] * 1000) / 1000,
  confidence,
  evidence,
});

export function resolveWispCandidates(day: Day, pastDays: readonly Day[] = []): WispDayCandidate[] {
  const candidates = READY_WISPS
    .map((definition) => evaluateReadyDayRule(definition.id, day, pastDays))
    .filter((value): value is WispDayCandidate => Boolean(value && value.score >= 0.45));

  candidates.sort((left, right) => (
    right.score - left.score
    || wispDefinition(left.wispId).sortOrder - wispDefinition(right.wispId).sortOrder
    || left.wispId.localeCompare(right.wispId)
  ));
  return candidates;
}

export function selectFeaturedWisps(day: Day, pastDays: readonly Day[] = []): WispDayCandidate[] {
  const candidates = resolveWispCandidates(day, pastDays);
  const first = candidates[0];
  if (!first) return [];
  const remaining = candidates.slice(1);
  const strongestRemaining = remaining[0];
  if (!strongestRemaining) return [first];
  const firstFamily = wispDefinition(first.wispId).featureFamily;
  const diverse = remaining.find((entry) => (
    wispDefinition(entry.wispId).featureFamily !== firstFamily
    && entry.score >= strongestRemaining.score - 0.15
  ));
  return [first, diverse ?? strongestRemaining];
}

function evaluateReadyDayRule(wispId: WispId, day: Day, pastDays: readonly Day[]): WispDayCandidate | null {
  const qualities = qualityIds(day);
  const places = day.confirmedPlaces ?? [];
  const studio = day.studioMoments ?? [];
  switch (wispId) {
    case 'sprout':
      return places.some((place) => ['park', 'garden'].includes(place.category)) || qualities.has('place.park') || qualities.has('place.garden')
        ? candidate(wispId, 1, places.length ? 'confirmed' : 'inferred', ['place:nature']) : null;
    case 'steam':
      return places.some((place) => ['cafe', 'coffee_shop'].includes(place.category)) || day.moments.some((item) => item.type === 'coffee')
        ? candidate(wispId, 0.95, places.length ? 'confirmed' : 'explicit', ['place:cafe']) : null;
    case 'flash': {
      const count = photoCount(day);
      return count >= 1 ? candidate(wispId, Math.min(0.58 + count * 0.09, 0.94), 'confirmed', [`photos:${count}`]) : null;
    }
    case 'drizzle':
      return day.weather?.condition === 'rain' || day.weather?.condition === 'storm'
        ? candidate(wispId, 0.93, 'inferred', [`weather:${day.weather.condition}`]) : null;
    case 'moonlit':
      return hasLateMemory(day) ? candidate(wispId, 0.86, 'confirmed', ['time:late_memory']) : null;
    case 'page':
      return studio.some((item) => item.mediaType === 'book') || qualities.has('media.book')
        ? candidate(wispId, 0.9, studio.length ? 'explicit' : 'inferred', ['studio:book']) : null;
    case 'wander':
      return day.newPlaceCount > 0 || places.some((place) => Boolean(place.locality)) || (day.bigMoments ?? []).some((item) => item.type === 'trip')
        ? candidate(wispId, 0.88, day.newPlaceCount > 0 ? 'confirmed' : 'explicit', ['place:new']) : null;
    case 'heartlet':
      return isSocialDay(day) ? candidate(wispId, 0.89, 'explicit', ['connection:shared']) : null;
    case 'sunset':
      return qualities.has('nature.sunset') ? candidate(wispId, 0.88, 'inferred', ['quality:nature.sunset']) : null;
    case 'bloom':
      return qualities.has('nature.flowers') ? candidate(wispId, 0.84, 'inferred', ['quality:nature.flowers']) : null;
    case 'pixel':
      return studio.some((item) => item.mediaType === 'game') || qualities.has('media.game')
        ? candidate(wispId, 0.86, studio.length ? 'explicit' : 'inferred', ['studio:game']) : null;
    case 'buddy':
      return qualities.has('subject.dog') ? candidate(wispId, 0.84, 'inferred', ['quality:subject.dog']) : null;
    case 'crumb':
      return (day.foodMoments?.length ?? 0) > 0 || qualities.has('subject.food')
        ? candidate(wispId, 0.85, (day.foodMoments?.length ?? 0) > 0 ? 'explicit' : 'inferred', ['memory:food']) : null;
    case 'dream':
      return day.sleep?.quality === 'good' ? candidate(wispId, 0.92, 'explicit', ['sleep:good']) : null;
    case 'relic':
      return places.some((place) => ['museum', 'landmark', 'historic'].includes(place.category)) || qualities.has('place.museum')
        ? candidate(wispId, 0.93, places.length ? 'confirmed' : 'inferred', ['place:culture']) : null;
    case 'spark': {
      const streak = capturedStreak([...pastDays, day]);
      return streak === 7 ? candidate(wispId, 1, 'confirmed', ['streak:7']) : null;
    }
    default:
      return null;
  }
}

export function wispProgress(wispId: WispId, days: readonly Day[]): WispProgress {
  const definition = wispDefinition(wispId);
  const target = definition.unlockRule?.target ?? 1;
  const unit = definition.unlockRule?.unit ?? 'discovery';
  const value = progressValue(wispId, days);
  return { current: Math.min(value, target), target, unit };
}

export function earnedWispIds(days: readonly Day[]) {
  return READY_WISPS
    .filter((definition) => wispProgress(definition.id, days).current >= (definition.unlockRule?.target ?? Infinity))
    .map((definition) => definition.id);
}

function progressValue(wispId: WispId, days: readonly Day[]): number {
  switch (wispId) {
    case 'sprout': return distinctPlaces(days, ['park', 'garden']);
    case 'steam': return countDays(days, (day) => hasPlace(day, ['cafe', 'coffee_shop']) || day.moments.some((item) => item.type === 'coffee'));
    case 'flash': return days.reduce((sum, day) => sum + photoCount(day), 0);
    case 'drizzle': return countDays(days, (day) => ['rain', 'storm'].includes(day.weather?.condition ?? '') && hasMemory(day));
    case 'moonlit': return countDays(days, hasLateMemory);
    case 'page': return distinctStudio(days, 'book');
    case 'wander': return new Set(days.flatMap((day) => (day.confirmedPlaces ?? []).map((place) => place.locality?.trim().toLowerCase()).filter(Boolean))).size;
    case 'heartlet': return countDays(days, isSocialDay);
    case 'sunset': return countDays(days, (day) => qualityIds(day).has('nature.sunset'));
    case 'bloom': return countDays(days, (day) => qualityIds(day).has('nature.flowers'));
    case 'pixel': return countDays(days, (day) => (day.studioMoments ?? []).some((item) => item.mediaType === 'game') || qualityIds(day).has('media.game'));
    case 'buddy': return countDays(days, (day) => qualityIds(day).has('subject.dog'));
    case 'crumb': return countDays(days, (day) => (day.foodMoments?.length ?? 0) > 0 || qualityIds(day).has('subject.food'));
    case 'dream': return countDays(days, (day) => day.sleep?.quality === 'good');
    case 'relic': return countDays(days, (day) => hasPlace(day, ['museum', 'landmark', 'historic']) || qualityIds(day).has('place.museum'));
    case 'spark': return longestCapturedStreak(days);
    default: return 0;
  }
}

function qualityIds(day: Day) {
  return new Set([
    ...(day.classifiedMemories ?? []).flatMap((memory) => memory.qualities.filter((quality) => quality.status !== 'rejected').map((quality) => quality.qualityId)),
    ...(day.journalRecords ?? []).flatMap((record) => record.canonicalQualityIds ?? []),
  ]);
}

function photoCount(day: Day) {
  const ids = new Set<string>();
  if (day.heroPhoto?.assetId) ids.add(day.heroPhoto.assetId);
  for (const item of day.capturedMeanings ?? []) if (item.sourceId) ids.add(item.sourceId);
  for (const item of day.moments) if (item.type === 'photo') ids.add(item.metadata?.assetId ?? item.id);
  return ids.size;
}

function hasMemory(day: Day) {
  return photoCount(day) > 0 || day.moments.length > 0 || (day.notes?.length ?? 0) > 0 || (day.journalRecords?.length ?? 0) > 0;
}

function isSocialDay(day: Day) {
  if (day.moments.some((item) => item.type === 'social')) return true;
  if (qualityIds(day).has('subject.group')) return true;
  return day.promptAnswers.some((answer) => !answer.dismissed && answer.semanticTags.some((tag) => /friend|family|together|social/.test(tag)));
}

function hasLateMemory(day: Day) {
  const stamps = [
    ...(day.notes ?? []).map((item) => item.createdAt),
    ...(day.journalRecords ?? []).map((item) => item.createdAt),
  ];
  return stamps.some((stamp) => {
    const hour = new Date(stamp).getHours();
    return hour >= 23 || hour < 5;
  });
}

function hasPlace(day: Day, categories: string[]) {
  return (day.confirmedPlaces ?? []).some((place) => categories.includes(place.category));
}

function distinctPlaces(days: readonly Day[], categories: string[]) {
  const identities = new Set<string>();
  for (const day of days) {
    for (const place of day.confirmedPlaces ?? []) {
      if (categories.length && !categories.includes(place.category)) continue;
      const identity = place.venueKey ?? place.placeId ?? [place.name, place.locality, place.category].filter(Boolean).join('|').toLowerCase();
      if (identity) identities.add(identity);
    }
  }
  return identities.size;
}

function distinctStudio(days: readonly Day[], mediaType: 'book' | 'film' | 'game' | 'music') {
  return new Set(days.flatMap((day) => (day.studioMoments ?? [])
    .filter((item) => item.mediaType === mediaType)
    .map((item) => item.label.trim().toLowerCase())
    .filter(Boolean))).size;
}

function countDays(days: readonly Day[], predicate: (day: Day) => boolean) {
  return new Set(days.filter(predicate).map((day) => day.isoDate)).size;
}

function capturedStreak(days: readonly Day[]) {
  const unique = [...new Set(days.filter((day) => day.state === 'hatched').map((day) => day.isoDate))].sort();
  if (!unique.length) return 0;
  let run = 1;
  for (let index = unique.length - 1; index > 0; index -= 1) {
    const current = Date.parse(`${unique[index]}T00:00:00Z`);
    const previous = Date.parse(`${unique[index - 1]}T00:00:00Z`);
    if (current - previous !== 86_400_000) break;
    run += 1;
  }
  return run;
}

function longestCapturedStreak(days: readonly Day[]) {
  const unique = [...new Set(days.filter((day) => day.state === 'hatched').map((day) => day.isoDate))].sort();
  let best = 0;
  let run = 0;
  let previous = 0;
  for (const isoDate of unique) {
    const current = Date.parse(`${isoDate}T00:00:00Z`);
    run = previous && current - previous === 86_400_000 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = current;
  }
  return best;
}

export const ALL_WISP_IDS = WISP_CATALOG.map((item) => item.id);
