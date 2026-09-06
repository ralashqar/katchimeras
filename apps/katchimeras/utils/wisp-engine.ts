import { READY_WISPS, WISP_CATALOG, wispDefinition } from '@/constants/wisps';
import { COMPANION_ACHIEVEMENT_CATALOG } from '@/constants/companion-achievements';
import type { HomeDayRecord, StoredHomeDayRecord } from '@/types/home';
import type { WispConfidence, WispDayCandidate, WispId, WispProgress, WispRuleDefinition } from '@/types/wisp';

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
    .map((definition) => evaluateReadyDayRule(definition.id, definition.dayRule, day, pastDays))
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

function evaluateReadyDayRule(wispId: WispId, rule: WispRuleDefinition | null, day: Day, pastDays: readonly Day[]): WispDayCandidate | null {
  if (!rule) return null;
  const result = evaluateDayRule(rule, day, pastDays);
  return result ? candidate(wispId, result.strength, result.confidence, result.evidence) : null;
}

export type WispProgressContext = { unlockedAchievementIds?: ReadonlySet<string> };

export function wispProgress(wispId: WispId, days: readonly Day[], context: WispProgressContext = {}): WispProgress {
  const definition = wispDefinition(wispId);
  const target = definition.unlockRule?.target ?? 1;
  const unit = definition.unlockRule?.unit ?? 'discovery';
  const value = definition.unlockRule ? progressValue(definition.unlockRule, days, context) : 0;
  return { current: Math.min(value, target), target, unit };
}

export function earnedWispIds(days: readonly Day[], context: WispProgressContext = {}) {
  return READY_WISPS
    .filter((definition) => wispProgress(definition.id, days, context).current >= (definition.unlockRule?.target ?? Infinity))
    .map((definition) => definition.id);
}

function progressValue(rule: WispRuleDefinition, days: readonly Day[], context: WispProgressContext): number {
  const params = rule.params ?? {};
  const categories = strings(params.categories);
  const movements = strings(params.movements);
  const mediaType = stringParam(params.mediaType);
  const quality = stringParam(params.quality);
  switch (rule.id) {
    case 'distinct_places': return distinctPlaces(days, categories);
    case 'place_days': return countDays(days, (day) => hasPlace(day, categories) || (categories.includes('cafe') && day.moments.some((item) => item.type === 'coffee')));
    case 'photo_count': return days.reduce((sum, day) => sum + photoCount(day), 0);
    case 'rain_memory_days': return countDays(days, (day) => isRain(day) && hasMemory(day));
    case 'late_memory_days': return countDays(days, hasLateMemory);
    case 'distinct_studio': return mediaType ? distinctStudio(days, mediaType) : 0;
    case 'new_localities': return distinctLocalities(days);
    case 'social_days': return countDays(days, isSocialDay);
    case 'quality_days': return quality ? countDays(days, (day) => qualityIds(day).has(quality)) : 0;
    case 'studio_days': return mediaType ? countDays(days, (day) => hasStudio(day, mediaType)) : 0;
    case 'food_days': return countDays(days, hasFood);
    case 'good_sleep_days': return countDays(days, (day) => day.sleep?.quality === 'good');
    case 'capture_streak': return longestCapturedStreak(days);
    case 'rain_steps': return Math.max(0, ...days.filter(isRain).map((day) => day.stepsCount ?? 0));
    case 'clear_outdoor_days': return countDays(days, isClearOutdoorDay);
    case 'calm_days': return countDays(days, isCalmDay);
    case 'focus_days': return countDays(days, isFocusDay);
    case 'happy_days': return countDays(days, isHappyDay);
    case 'movement_days': return countDays(days, (day) => hasMovement(day, movements));
    case 'calm_home_days': return countDays(days, (day) => isCalmDay(day) && isHomeDay(day));
    case 'walking_days': return countDays(days, isWalkingDay);
    case 'home_cooked_days': return countDays(days, isHomeCookedDay);
    case 'snow_days': return countDays(days, (day) => day.weather?.condition === 'snow');
    case 'hatched_count': return countDays(days, (day) => day.state === 'hatched');
    case 'celebration_days': return countDays(days, isCelebrationDay);
    case 'memory_game_wins': return days.reduce((sum, day) => sum + memoryGameWins(day), 0);
    case 'family_section_breadth': return familySectionBreadth(context.unlockedAchievementIds, stringParam(params.familyId), numberParam(params.minimumTier, 1));
    case 'all_of': return countDays(days, (day) => ruleTokensMatch(day, strings(params.rules)));
    case 'achievement_id': return context.unlockedAchievementIds?.has(stringParam(params.achievementId)) ? 1 : 0;
    case 'grant_only':
    case 'shop':
    case 'global_discovery_id': return 0;
    default: return 0;
  }
}

type DayRuleMatch = { strength: number; confidence: WispConfidence; evidence: string[] };

function evaluateDayRule(rule: WispRuleDefinition, day: Day, pastDays: readonly Day[]): DayRuleMatch | null {
  const params = rule.params ?? {};
  const categories = strings(params.categories);
  const movements = strings(params.movements);
  const mediaType = stringParam(params.mediaType);
  const quality = stringParam(params.quality);
  const explicit = (evidence: string[], strength = 0.9): DayRuleMatch => ({ strength, confidence: 'explicit', evidence });
  const confirmed = (evidence: string[], strength = 0.92): DayRuleMatch => ({ strength, confidence: 'confirmed', evidence });
  const inferred = (evidence: string[], strength = 0.86): DayRuleMatch => ({ strength, confidence: 'inferred', evidence });
  switch (rule.id) {
    case 'place_category': return hasPlace(day, categories) ? confirmed([`place:${categories.join('|')}`], 0.96) : qualityPlaceMatch(day, categories) ? inferred([`quality:place`]) : null;
    case 'photo_count': { const count = photoCount(day); return count ? confirmed([`photos:${count}`], Math.min(0.58 + count * 0.09, 0.94)) : null; }
    case 'rain_day': return isRain(day) ? inferred([`weather:${day.weather?.condition}`], 0.93) : null;
    case 'late_memory': return hasLateMemory(day) ? confirmed(['time:late_memory']) : null;
    case 'studio_type': return mediaType && hasStudio(day, mediaType) ? explicit([`studio:${mediaType}`]) : null;
    case 'new_place': return day.newPlaceCount > 0 || (day.bigMoments ?? []).some((item) => item.type === 'trip') ? confirmed(['place:new']) : null;
    case 'social_day': return isSocialDay(day) ? explicit(['connection:shared']) : null;
    case 'quality': return quality && qualityIds(day).has(quality) ? inferred([`quality:${quality}`], 0.9) : null;
    case 'food_memory': return hasFood(day) ? explicit(['memory:food']) : null;
    case 'good_sleep': return day.sleep?.quality === 'good' ? explicit(['sleep:good'], 0.92) : null;
    case 'capture_streak_milestone': { const value = capturedStreak([...pastDays, day]); return value === rule.target ? confirmed([`streak:${value}`], 1) : null; }
    case 'rain_steps': return isRain(day) && (day.stepsCount ?? 0) >= rule.target ? confirmed([`steps:${day.stepsCount}`, 'weather:rain'], 1) : null;
    case 'clear_outdoor_day': return isClearOutdoorDay(day) ? inferred(['weather:clear', 'place:outdoor']) : null;
    case 'calm_day': return isCalmDay(day) ? inferred(['score:calm']) : null;
    case 'focus_day': return isFocusDay(day) ? inferred(['score:focus']) : null;
    case 'happy_day': return isHappyDay(day) ? explicit(['mood:happy']) : null;
    case 'movement': return hasMovement(day, movements) ? explicit([`movement:${movements.join('|')}`]) : null;
    case 'calm_home_day': return isCalmDay(day) && isHomeDay(day) ? inferred(['mood:calm', 'place:home']) : null;
    case 'walking_day': return isWalkingDay(day) ? confirmed([`steps:${day.stepsCount ?? 0}`]) : null;
    case 'home_cooked': return isHomeCookedDay(day) ? explicit(['food:home_cooked']) : null;
    case 'snow_day': return day.weather?.condition === 'snow' ? inferred(['weather:snow'], 0.93) : null;
    case 'hatched_count_milestone': { const count = countDays([...pastDays, day], (item) => item.state === 'hatched'); return count === rule.target ? confirmed([`hatched:${count}`], 1) : null; }
    case 'celebration': return isCelebrationDay(day) ? explicit(['memory:celebration'], 0.96) : null;
    case 'memory_game_win': return memoryGameWins(day) > 0 ? explicit(['game:memory_win']) : null;
    case 'all_of': return ruleTokensMatch(day, strings(params.rules)) ? explicit(strings(params.rules)) : null;
    default: return null;
  }
}

function qualityIds(day: Day) {
  return new Set([
    ...(day.classifiedMemories ?? []).flatMap((memory) => memory.qualities.filter((quality) => quality.status !== 'rejected').map((quality) => quality.qualityId)),
    ...(day.journalRecords ?? []).flatMap((record) => record.canonicalQualityIds ?? []),
  ]);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function stringParam(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberParam(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isRain(day: Day) {
  return day.weather?.condition === 'rain' || day.weather?.condition === 'storm';
}

function hasStudio(day: Day, mediaType: string) {
  return (day.studioMoments ?? []).some((item) => item.mediaType === mediaType)
    || qualityIds(day).has(`media.${mediaType}`);
}

function hasFood(day: Day) {
  return (day.foodMoments?.length ?? 0) > 0 || qualityIds(day).has('subject.food');
}

function hasMovement(day: Day, movements: string[]) {
  const movement = day.stepsInterpretation?.movement;
  if (movement && movements.includes(movement)) return true;
  if (movements.includes('workout') && (day.moments ?? []).some((item) => /workout|exercise|gym|sport/.test(`${item.type} ${item.label ?? ''}`.toLowerCase()))) return true;
  if (movements.some((item) => ['transit', 'commute', 'travel'].includes(item)) && (day.healthRouteImport || movement === 'travel')) return true;
  return false;
}

function isWalkingDay(day: Day) {
  return (day.stepsCount ?? 0) >= 5_000 || ['walk', 'hike'].includes(day.stepsInterpretation?.movement ?? '');
}

function isHomeCookedDay(day: Day) {
  return (day.foodMoments ?? []).some((item) => item.homeCooked === true);
}

function dayScores(day: Day) {
  if ('scores' in day && day.scores) return day.scores;
  return day.capturedEnergy ?? {};
}

function isCalmDay(day: Day) {
  const scores = dayScores(day);
  const calm = scores.calm ?? 0;
  return calm > 0 && calm >= (scores.energy ?? 0) && calm >= (scores.social ?? 0)
    && calm >= (scores.exploration ?? 0) && calm >= (scores.focus ?? 0);
}

function isFocusDay(day: Day) {
  const scores = dayScores(day);
  return (scores.focus ?? 0) >= 0.45 || day.moments.some((item) => item.type === 'focus');
}

function isHappyDay(day: Day) {
  return (day.capturedMeanings ?? []).some((item) => /happy|joy|laugh|smile|good/.test(`${item.label} ${item.archetype}`.toLowerCase()))
    || day.promptAnswers.some((answer) => answer.semanticTags.some((tag) => /happy|joy|grateful|positive/.test(tag)));
}

function isHomeDay(day: Day) {
  const places = day.confirmedPlaces ?? [];
  return places.some((place) => place.category === 'home') || (day.visitedPlaceCount <= 1 && day.newPlaceCount === 0);
}

function isClearOutdoorDay(day: Day) {
  const weather = day.weather?.condition;
  const outdoors = hasPlace(day, ['park', 'garden', 'forest', 'woodland', 'beach', 'shore'])
    || ['place.park', 'place.garden', 'place.forest', 'place.beach'].some((id) => qualityIds(day).has(id));
  return weather !== 'rain' && weather !== 'storm' && weather !== 'snow' && outdoors;
}

function isCelebrationDay(day: Day) {
  return (day.bigMoments?.length ?? 0) > 0
    || day.promptAnswers.some((answer) => answer.semanticTags.some((tag) => /celebrat|birthday|anniversary|graduation/.test(tag)));
}

function memoryGameWins(day: Day) {
  return day.moments.filter((item) => {
    const metadata = item.metadata as Record<string, unknown> | undefined;
    return metadata?.gameId === 'memory' && (metadata.result === 'win' || metadata.won === true);
  }).length;
}

function qualityPlaceMatch(day: Day, categories: string[]) {
  const qualities = qualityIds(day);
  return categories.some((category) => qualities.has(`place.${category}`));
}

function ruleTokensMatch(day: Day, rules: string[]) {
  return rules.every((rule) => {
    if (rule === 'place:nature') return hasPlace(day, ['park', 'garden', 'forest', 'woodland']) || qualityPlaceMatch(day, ['park', 'garden', 'forest']);
    if (rule === 'memory:food') return hasFood(day);
    if (rule === 'weather:rain') return isRain(day);
    return false;
  });
}

function distinctLocalities(days: readonly Day[]) {
  return new Set(days.flatMap((day) => (day.confirmedPlaces ?? [])
    .map((place) => place.locality?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value)))).size;
}

function familySectionBreadth(ids: ReadonlySet<string> | undefined, familyId: string, minimumTier: number) {
  if (!ids || !familyId) return 0;
  const sections = new Set<string>();
  for (const id of ids) {
    const definition = COMPANION_ACHIEVEMENT_CATALOG.find((item) => item.id === id);
    if (!definition || definition.familyId !== familyId || definition.tier < minimumTier) continue;
    sections.add(definition.sectionId);
  }
  return sections.size;
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

function distinctStudio(days: readonly Day[], mediaType: string) {
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
