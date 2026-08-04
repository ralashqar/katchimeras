import { canonicalFamilyId, familyIdFromCompanionId, katchimeraFamilies } from '@/constants/katchimera-skins';
import type { HomeDayRecord, JournalLocationSelection } from '@/types/home';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { CompanionAchievementContext } from '@/types/companion-achievements';
import type { CompanionBondState } from '@/utils/companion-bond';
import type { CompanionJourneyState } from '@/utils/companion-journey';
import type { CompanionQuickGoalState } from '@/utils/companion-quick-goals';
import type { CompanionQuestState } from '@/utils/katchimera-quests';
import { questDefinition } from '@/utils/quests/definitions';

export type CompanionAchievementSources = {
  days: HomeDayRecord[];
  bond: CompanionBondState;
  quests: CompanionQuestState;
  journey: CompanionJourneyState;
  quickGoals: CompanionQuickGoalState;
};

type JournalLike = {
  id: string;
  flowId: string;
  categoryId: string;
  fields: Record<string, string | string[] | boolean | null>;
  feeling?: string | null;
  location?: JournalLocationSelection | null;
  createdAt: string;
};

const DAY_MS = 86_400_000;
const REFLECTION_KINDS = new Set(['feeling', 'inner_weather', 'day_word', 'meaning', 'gratitude', 'highlight']);

function ownerFamily(value: string | null | undefined): KatchimeraFamilyId | null {
  return familyIdFromCompanionId(value) ?? canonicalFamilyId(value);
}

function normalise(value: string | null | undefined): string {
  return (value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, ' ').trim();
}

function fieldValues(entry: JournalLike, key: string): string[] {
  const value = entry.fields[key];
  if (typeof value === 'string') return [value];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function fieldHas(entry: JournalLike, ...values: string[]): boolean {
  const expected = new Set(values.map(normalise));
  return Object.values(entry.fields).some((value) => {
    const items = Array.isArray(value) ? value : [value];
    return items.some((item) => typeof item === 'string' && expected.has(normalise(item)));
  });
}

function explicitTitle(entry: JournalLike): string | null {
  for (const key of ['specific', 'title', 'name', 'subject', 'detail']) {
    const value = fieldValues(entry, key)[0];
    const cleaned = normalise(value);
    if (cleaned) return cleaned;
  }
  return null;
}

function journalEntries(day: HomeDayRecord): JournalLike[] {
  const records = (day.journalRecords ?? []) as JournalLike[];
  const ids = new Set(records.map((entry) => entry.id));
  return [
    ...records,
    ...((day.manualJournalEntries ?? []) as JournalLike[]).filter((entry) => !ids.has(entry.id)),
  ];
}

function placeKey(place: {
  placeId?: string | null;
  venueKey?: string | null;
  latitude?: number;
  longitude?: number;
  name?: string;
  label?: string;
  address?: string | null;
  category?: string;
}): string | null {
  if (place.venueKey) return place.venueKey;
  if (place.placeId) return `provider:${place.placeId}`;
  if (Number.isFinite(place.latitude) && Number.isFinite(place.longitude)) {
    return `geo:${place.latitude!.toFixed(3)}:${place.longitude!.toFixed(3)}:${normalise(place.category)}`;
  }
  const name = normalise(place.name ?? place.label);
  const address = normalise(place.address);
  return name ? `named:${name}:${address}:${normalise(place.category)}` : null;
}

function locationKey(location: JournalLocationSelection | null | undefined, category: string, fallback?: string | null): string | null {
  if (location?.venueKey) return location.venueKey;
  if (location?.placeId) return `provider:${location.placeId}`;
  if (location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
    return `geo:${location.latitude.toFixed(3)}:${location.longitude.toFixed(3)}:${normalise(category)}`;
  }
  const name = normalise(location?.name ?? fallback);
  return name ? `named:${name}:${normalise(location?.address)}:${normalise(category)}` : null;
}

function isWalkingDay(day: HomeDayRecord): boolean {
  if ((day.stepsCount ?? 0) >= 5000) return true;
  if (day.stepsInterpretation?.movement === 'walk' || day.stepsInterpretation?.movement === 'hike') return true;
  return (day.moments ?? []).some((moment) => moment.type === 'walk');
}

function isCalmDay(day: HomeDayRecord): boolean {
  const scores = day.scores;
  if (!scores || scores.calm <= 0) return false;
  return scores.calm >= scores.energy
    && scores.calm >= scores.social
    && scores.calm >= scores.exploration
    && scores.calm >= scores.focus;
}

function longestWalkingStreak(days: HomeDayRecord[]): number {
  const times = [...new Set(days.filter(isWalkingDay).map((day) => Date.parse(`${day.isoDate}T00:00:00Z`)).filter(Number.isFinite))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let previous: number | null = null;
  for (const time of times) {
    run = previous !== null && time - previous === DAY_MS ? run + 1 : 1;
    best = Math.max(best, run);
    previous = time;
  }
  return best;
}

function emptyContext(familyId: KatchimeraFamilyId): CompanionAchievementContext {
  return { familyId, values: {}, sourceDayBySignal: {} };
}

export function buildCompanionAchievementContexts(
  sources: CompanionAchievementSources
): Map<KatchimeraFamilyId, CompanionAchievementContext> {
  const contexts = new Map<KatchimeraFamilyId, CompanionAchievementContext>(
    katchimeraFamilies.map((family) => [family.id, emptyContext(family.id)])
  );
  const buckets = new Map<string, Set<string>>();
  const latestDay = new Map<string, string>();

  const add = (familyId: KatchimeraFamilyId, signal: string, id: string, dayId?: string) => {
    const key = `${familyId}|${signal}`;
    const bucket = buckets.get(key) ?? new Set<string>();
    bucket.add(id);
    buckets.set(key, bucket);
    if (dayId) latestDay.set(key, dayId);
  };
  const setMax = (familyId: KatchimeraFamilyId, signal: string, value: number, dayId?: string) => {
    const context = contexts.get(familyId);
    if (!context || value <= (context.values[signal] ?? 0)) return;
    context.values[signal] = value;
    if (dayId) context.sourceDayBySignal[signal] = dayId;
  };

  for (const completion of sources.quickGoals.completions) {
    const familyId = canonicalFamilyId(completion.familyId);
    if (familyId) add(familyId, `${familyId}.quickGoals`, completion.id, completion.dayId);
  }
  for (const quest of sources.quests.quests) {
    if (!quest.completedAt) continue;
    const familyId = canonicalFamilyId(questDefinition(quest.questId)?.familyId) ?? ownerFamily(quest.creatureId);
    if (familyId) add(familyId, `${familyId}.quests`, `${quest.creatureId}:${quest.questId}:${quest.acceptedAt}`, quest.completedDayId);
  }
  for (const goal of sources.journey.goals) {
    const familyId = canonicalFamilyId(goal.familyId);
    if (familyId && goal.completedAt) add(familyId, `${familyId}.journeyGoals`, goal.id);
  }

  for (const day of sources.days) {
    setMax('steppling', 'steppling.maxSteps', day.stepsCount ?? 0, day.id);
    if (day.sleep?.quality === 'good' || day.sleep?.quality === 'normal') add('bedrotte', 'bedrotte.restedDays', day.id, day.id);
    if (isCalmDay(day)) add('mendle', 'mendle.calmDays', day.id, day.id);

    const places = day.confirmedPlaces ?? [];
    for (const place of places) {
      const category = normalise(place.category);
      const id = `place:${day.id}:${place.id}`;
      const distinct = placeKey(place);
      if (category === 'cafe') add('baristabbit', 'baristabbit.cafeVisits', id, day.id);
      if (category === 'museum' || category === 'gallery') add('relicoon', 'relicoon.museumVisits', id, day.id);
      if (category === 'museum' || category === 'gallery') add('relicoon', 'relicoon.cultureEntries', id, day.id);
      if (category === 'cinema') add('flickerbun', 'flickerbun.cinemaVisits', id, day.id);
      if (category === 'park' || category === 'green space') add('mossprout', 'mossprout.parkVisits', id, day.id);
      if (['beach', 'coast', 'waterfront', 'swimming pool', 'pool'].includes(category)) add('shellio', 'shellio.waterVisits', id, day.id);
      if (category !== 'home' && category !== 'unassigned' && distinct) add('skylo', 'skylo.distinctVenues', distinct, day.id);
      if (category === 'city' || category === 'town') {
        const city = normalise(place.locality ?? place.name ?? place.label);
        if (city) add('skylo', 'skylo.distinctCities', `city:${normalise(place.countryCode)}:${city}`, day.id);
      }
      if (['park', 'green space', 'garden', 'forest', 'trail'].includes(category) && distinct) {
        add('mossprout', 'mossprout.distinctNaturePlaces', distinct, day.id);
      }
      if (category === 'travel' && distinct) add('voyagle', 'voyagle.distinctDestinations', distinct, day.id);
    }

    for (const food of day.foodMoments ?? []) {
      const id = `food:${day.id}:${food.id}`;
      add('feastle', 'feastle.foodEntries', id, day.id);
      if (food.cuisine) add('feastle', 'feastle.distinctCuisines', `cuisine:${food.cuisine}`, day.id);
      const label = normalise(food.label);
      if (['coffee', 'tea', 'drink', 'another drink'].some((value) => label.includes(value))) add('baristabbit', 'baristabbit.drinkEntries', id, day.id);
    }

    for (const studio of day.studioMoments ?? []) {
      const id = `studio:${day.id}:${studio.id}`;
      const title = normalise(studio.label);
      if (studio.mediaType === 'book') {
        add('pagelet', 'pagelet.bookEntries', id, day.id);
        if (title && title !== 'a book' && title !== 'book') add('pagelet', 'pagelet.distinctBooks', `book:${title}`, day.id);
      }
      if (studio.mediaType === 'film' || studio.mediaType === 'show') {
        add('flickerbun', 'flickerbun.screenEntries', id, day.id);
        if (title && !['a film', 'film', 'a show', 'show'].includes(title)) add('flickerbun', 'flickerbun.distinctScreenTitles', `${studio.mediaType}:${title}`, day.id);
      }
      if (studio.mediaType === 'game') {
        add('pixooka', 'pixooka.gameEntries', id, day.id);
        if (title && title !== 'a game' && title !== 'game') add('pixooka', 'pixooka.distinctGames', `game:${title}`, day.id);
      }
      if (studio.mediaType === 'music') {
        add('encora', 'encora.musicEntries', id, day.id);
        if (title && title !== 'music') add('encora', 'encora.distinctMusic', `music:${title}`, day.id);
      }
      if (studio.mediaType === 'art') add('relicoon', 'relicoon.cultureEntries', id, day.id);
    }

    for (const answer of day.promptAnswers ?? []) {
      if (!answer.dismissed && REFLECTION_KINDS.has(answer.kind)) add('mendle', 'mendle.reflectionEntries', `reflection:${day.id}:${answer.id}`, day.id);
    }
    for (const big of day.bigMoments ?? []) {
      add('cheerlet', 'cheerlet.bigMoments', `big:${day.id}:${big.id}`, day.id);
      add('cheerlet', 'cheerlet.distinctBigMomentTypes', `type:${big.type}`, day.id);
      if (big.type === 'birthday') add('cheerlet', 'cheerlet.birthdays', `big:${day.id}:${big.id}`, day.id);
      if (big.type === 'achievement') add('cheerlet', 'cheerlet.achievementMoments', `big:${day.id}:${big.id}`, day.id);
      if (big.type === 'milestone') add('cheerlet', 'cheerlet.milestones', `big:${day.id}:${big.id}`, day.id);
      if (big.type === 'anniversary') add('cheerlet', 'cheerlet.anniversaries', `big:${day.id}:${big.id}`, day.id);
      if (big.type === 'trip') add('voyagle', 'voyagle.travelEntries', `big:${day.id}:${big.id}`, day.id);
    }

    for (const entry of journalEntries(day)) {
      const id = `journal:${day.id}:${entry.id}`;
      const category = normalise(entry.categoryId);
      const flow = normalise(entry.flowId);
      const title = explicitTitle(entry);
      const created = new Date(entry.createdAt);
      if (!Number.isNaN(created.getTime()) && created.getHours() < 10) {
        add('dawnle', 'dawnle.morningEntries', id, day.id);
        add('dawnle', 'dawnle.morningDays', day.id, day.id);
      }

      if (flow === 'food' && ['coffee', 'tea', 'drink'].includes(category)) add('baristabbit', 'baristabbit.drinkEntries', id, day.id);
      if (flow === 'movement') {
        if (category === 'walk') add('steppling', 'steppling.walkEntries', id, day.id);
        if (['workout', 'sport', 'cycle'].includes(category)) add('flexel', 'flexel.exerciseEntries', id, day.id);
        if (category === 'swim' || fieldHas(entry, 'swimming')) add('shellio', 'shellio.swimEntries', id, day.id);
        if (category === 'errands') add('errandimp', 'errandimp.errandEntries', id, day.id);
        if (category === 'travel') add('voyagle', 'voyagle.travelEntries', id, day.id);
        const sport = fieldValues(entry, 'detail')[0] ?? fieldValues(entry, 'context')[0] ?? category;
        if (['workout', 'sport', 'cycle'].includes(category) && sport) add('flexel', 'flexel.distinctSports', `sport:${normalise(sport)}`, day.id);
      }
      if (flow === 'people') {
        if (category === 'friends') add('gatherglow', 'gatherglow.friendEntries', id, day.id);
        if (category === 'group' || fieldHas(entry, 'gathering', 'event', 'party')) add('gatherglow', 'gatherglow.gatheringEntries', id, day.id);
        if (category === 'partner') add('heartmote', 'heartmote.partnerEntries', id, day.id);
        if (category === 'partner' && (normalise(entry.feeling) === 'grateful' || normalise(entry.feeling) === 'close')) add('heartmote', 'heartmote.appreciationEntries', id, day.id);
        if (fieldHas(entry, 'community')) add('kindling', 'kindling.communityEntries', id, day.id);
        if (fieldHas(entry, 'support', 'care')) add('kindling', 'kindling.helpingEntries', id, day.id);
        if (category === 'my child') add('snuglet', 'snuglet.childEntries', id, day.id);
        if (category === 'my child' && fieldHas(entry, 'care')) add('snuglet', 'snuglet.careEntries', id, day.id);
        if (category === 'pet') {
          add('waglet', 'waglet.petEntries', id, day.id);
          if (fieldHas(entry, 'play', 'walk', 'care')) add('waglet', 'waglet.petCareEntries', id, day.id);
        }
        if (category === 'solo' && fieldHas(entry, 'rest', 'reset')) add('bedrotte', 'bedrotte.restEntries', id, day.id);
      }
      if (flow === 'work') {
        if (category === 'focus' || category === 'office') add('tasklet', 'tasklet.focusEntries', id, day.id);
        if (fieldHas(entry, 'finished')) add('tasklet', 'tasklet.finishedEntries', id, day.id);
        if (category === 'admin') add('errandimp', 'errandimp.adminEntries', id, day.id);
        if (category === 'creative') {
          add('museling', 'museling.creativeEntries', id, day.id);
          if (title) add('museling', 'museling.distinctProjects', `project:${title}`, day.id);
        }
      }
      if (flow === 'general' && ['rest', 'difficult', 'gratitude'].includes(category)) add('mendle', 'mendle.recoveryEntries', id, day.id);
      if (flow === 'general' && category === 'rest') add('bedrotte', 'bedrotte.restEntries', id, day.id);
      if (flow === 'went somewhere' || flow === 'went_somewhere') {
        if (category === 'travel') add('voyagle', 'voyagle.travelEntries', id, day.id);
        if (category === 'city') {
          const city = normalise(entry.location?.locality ?? entry.location?.name ?? title);
          if (city) add('skylo', 'skylo.distinctCities', `city:${normalise(entry.location?.countryCode)}:${city}`, day.id);
        }
        if (category === 'travel' || category === 'city') {
          const destination = locationKey(entry.location, category, title);
          if (destination) add('voyagle', 'voyagle.distinctDestinations', destination, day.id);
        }
      }
    }
  }

  setMax('steppling', 'steppling.walkingStreak', longestWalkingStreak(sources.days));

  for (const [key, ids] of buckets) {
    const split = key.indexOf('|');
    const familyId = key.slice(0, split) as KatchimeraFamilyId;
    const signal = key.slice(split + 1);
    const context = contexts.get(familyId);
    if (!context) continue;
    context.values[signal] = ids.size;
    context.sourceDayBySignal[signal] = latestDay.get(key);
  }

  return contexts;
}
