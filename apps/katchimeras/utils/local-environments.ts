import { LOCAL_ENVIRONMENTS } from '@/constants/local-environments';
import type { KingdomCreature, KingdomState } from '@/types/kingdom';
import type { CuisineFamily, HomeDayRecord } from '@/types/home';
import type {
  LocalEnvironmentDefinition,
  LocalEnvironmentId,
  LocalEnvironmentRuntime,
  LocalEnvironmentStationDefinition,
  LocalEnvironmentStationRuntime,
} from '@/types/local-environment';
import { activeQuests, questFor, type CompanionQuestState } from '@/utils/katchimera-quests';
import { resolveFoodMomentDisplay } from '@/utils/memory-display';

export type LocalKatchimeraHomeCard = {
  creature: KingdomCreature;
  environment: LocalEnvironmentDefinition | null;
  hatchCount: number;
  latestIsoDate: string;
  available: boolean;
};

type CoffeeMemoryEntry = { id: string; title: string; subtitle: string; thumbnailUri?: string | null };
type EnvironmentMemoryEntry = CoffeeMemoryEntry;

type CoffeeStats = {
  coffeeMoments: number;
  drinkVarieties: string[];
  cafeVisits: number;
  cafePlaces: EnvironmentMemoryEntry[];
  coffeePhotos: EnvironmentMemoryEntry[];
  homeBrews: EnvironmentMemoryEntry[];
  milestones: EnvironmentMemoryEntry[];
};

type FoodStats = {
  foodMoments: number;
  foodEntries: EnvironmentMemoryEntry[];
  cuisineFamilies: CuisineFamily[];
  foodPlaces: EnvironmentMemoryEntry[];
  foodPhotos: EnvironmentMemoryEntry[];
  homeCookedMeals: EnvironmentMemoryEntry[];
  desserts: EnvironmentMemoryEntry[];
  milestones: EnvironmentMemoryEntry[];
};

const COFFEE_RE = /\b(coffee|espresso|latte|cappuccino|americano|mocha|flat white|cold brew|cortado|macchiato)\b/i;
const DRINK_RE = /\b(coffee|espresso|latte|cappuccino|americano|mocha|flat white|cold brew|cortado|macchiato|tea|matcha|boba|drink)\b/i;
const FOOD_RE = /\b(food|meal|dinner|lunch|breakfast|brunch|dish|plate|restaurant|bakery|bread|pastry|pizza|pasta|sushi|ramen|curry|taco|dessert|cake|gelato|ice ?cream|cookie|cooking|home ?cooked|feast)\b/i;
const DESSERT_RE = /\b(dessert|cake|ice ?cream|gelato|cookie|brownie|pastry|sweet|donut|doughnut|cupcake|pie|waffle|chocolate|pudding|sundae|macaron)\b/i;
const FOOD_PLACE_RE = /\b(food|restaurant|cafe|bakery|market|grocery|dessert|pizza|sushi|ramen|diner|bar|pub|bistro|kitchen|tea)\b/i;

const CUISINE_LABELS: Record<CuisineFamily, string> = {
  chinese: 'Chinese',
  french: 'French',
  greek: 'Greek',
  indian: 'Indian',
  italian: 'Italian',
  japanese: 'Japanese',
  mexican: 'Mexican',
  middle_eastern: 'Middle Eastern',
};

export function localKatchimeraHomeCards(kingdom: KingdomState): LocalKatchimeraHomeCard[] {
  const grouped = new Map<string, { creature: KingdomCreature; hatchCount: number; latestIsoDate: string }>();
  for (const creature of kingdom.creatures) {
    const key = creature.creatureId || creature.visualKey || creature.name;
    const existing = grouped.get(key);
    if (existing) {
      existing.hatchCount += 1;
      if (creature.isoDate > existing.latestIsoDate) existing.latestIsoDate = creature.isoDate;
    } else {
      grouped.set(key, { creature, hatchCount: 1, latestIsoDate: creature.isoDate });
    }
  }

  return [...grouped.values()].map((entry) => {
    const environment = environmentForCreature(entry.creature);
    return {
      ...entry,
      environment,
      available: !!environment,
    };
  });
}

export function environmentForCreature(creature: KingdomCreature): LocalEnvironmentDefinition | null {
  return (
    LOCAL_ENVIRONMENTS.find(
      (environment) =>
        environment.ownerCreatureIds.includes(creature.creatureId) ||
        environment.ownerVisualKeys.includes(creature.visualKey) ||
        environment.ownerSeedIds.some((seed) => creature.creatureId.includes(seed))
    ) ?? null
  );
}

export function deriveLocalEnvironmentRuntime(
  environmentId: LocalEnvironmentId,
  days: HomeDayRecord[],
  quests: CompanionQuestState,
  creatureId: string
): LocalEnvironmentRuntime {
  const definition = LOCAL_ENVIRONMENTS.find((item) => item.id === environmentId);
  if (!definition) {
    throw new Error(`Unknown local environment: ${environmentId}`);
  }

  const activeQuest = questFor(quests, creatureId);
  const activeQuestCount = activeQuests(quests).filter((quest) => quest.creatureId === creatureId).length;
  const coffeeStats = definition.domain === 'coffee' ? deriveCoffeeStats(days) : null;
  const foodStats = definition.domain === 'food' ? deriveFoodStats(days) : null;

  return {
    definition,
    stations: definition.stations.map((station) =>
      definition.domain === 'food'
        ? foodStationRuntime(station, foodStats as FoodStats, activeQuest, activeQuestCount)
        : coffeeStationRuntime(station, coffeeStats as CoffeeStats, activeQuest, activeQuestCount)
    ),
  };
}

function coffeeStationRuntime(
  station: LocalEnvironmentStationDefinition,
  stats: CoffeeStats,
  activeQuest: ReturnType<typeof questFor>,
  activeQuestCount: number
): LocalEnvironmentStationRuntime {
  switch (station.id) {
    case 'coffee_bar':
      return withLevel(station, stats.coffeeMoments, {
        valueLabel: `${stats.coffeeMoments} coffee ${stats.coffeeMoments === 1 ? 'moment' : 'moments'}`,
        detail: stats.drinkVarieties[0] ? `Most recent drink family: ${stats.drinkVarieties[0]}` : 'Save a coffee moment to wake the bar.',
        entries: latestCoffeeEntries(stats),
      });
    case 'bean_shelf':
      return withLevel(station, stats.drinkVarieties.length, {
        valueLabel: `${stats.drinkVarieties.length} drink ${stats.drinkVarieties.length === 1 ? 'type' : 'types'}`,
        detail: stats.drinkVarieties.length ? stats.drinkVarieties.join(', ') : 'Coffee, latte, matcha, tea and other drink labels collect here.',
        entries: stats.drinkVarieties.map((label) => ({ id: label, title: label, subtitle: 'Detected drink variety' })),
      });
    case 'travel_map':
      return withLevel(station, stats.cafeVisits, {
        valueLabel: `${stats.cafeVisits} cafe ${stats.cafeVisits === 1 ? 'visit' : 'visits'}`,
        detail: stats.cafePlaces.length ? 'Confirmed cafe places are pinned here.' : 'Confirm cafe places to fill the map.',
        entries: stats.cafePlaces,
      });
    case 'photo_wall':
      return withLevel(station, stats.coffeePhotos.length, {
        valueLabel: `${stats.coffeePhotos.length} coffee ${stats.coffeePhotos.length === 1 ? 'photo' : 'photos'}`,
        detail: 'Coffee and drink photos become the wall collection.',
        entries: stats.coffeePhotos,
      });
    case 'recipe_book':
      return withLevel(station, stats.homeBrews.length, {
        valueLabel: `${stats.homeBrews.length} home ${stats.homeBrews.length === 1 ? 'brew' : 'brews'}`,
        detail: stats.homeBrews.length ? 'Home coffee notes and home-made drink memories live here.' : 'Write or save a home coffee moment to start the book.',
        entries: stats.homeBrews,
      });
    case 'notice_board':
      return withLevel(station, activeQuest ? 1 : activeQuestCount, {
        valueLabel: activeQuest ? 'Quest active' : 'No active quest',
        detail: activeQuest ? `${activeQuest.title}: ${activeQuest.hint}` : 'Talk to Baristabbit to pick up a personal quest.',
        entries: activeQuest ? [{ id: activeQuest.questId, title: activeQuest.title, subtitle: activeQuest.hint }] : [],
      });
    case 'trophy_shelf':
      return withLevel(station, stats.milestones.length, {
        valueLabel: `${stats.milestones.length} milestone${stats.milestones.length === 1 ? '' : 's'}`,
        detail: stats.milestones.length ? 'Coffee milestones earned by real patterns.' : 'Milestones appear as coffee patterns deepen.',
        entries: stats.milestones,
      });
    default:
      return withLevel(station, 0, {
        valueLabel: 'Not started',
        detail: 'This station is waiting for its first matching memory.',
        entries: [],
      });
  }
}

function foodStationRuntime(
  station: LocalEnvironmentStationDefinition,
  stats: FoodStats,
  activeQuest: ReturnType<typeof questFor>,
  activeQuestCount: number
): LocalEnvironmentStationRuntime {
  switch (station.id) {
    case 'feast_table':
      return withLevel(station, stats.foodMoments, {
        valueLabel: `${stats.foodMoments} food ${stats.foodMoments === 1 ? 'memory' : 'memories'}`,
        detail: stats.foodMoments ? 'Every saved meal, dish, and feast memory gathers at the table.' : 'Save a food memory to set Feastle\'s table.',
        entries: stats.foodEntries,
      });
    case 'spice_rack':
      return withLevel(station, stats.cuisineFamilies.length, {
        valueLabel: `${stats.cuisineFamilies.length} cuisine ${stats.cuisineFamilies.length === 1 ? 'family' : 'families'}`,
        detail: stats.cuisineFamilies.length
          ? stats.cuisineFamilies.map((family) => CUISINE_LABELS[family]).join(', ')
          : 'Tag meals by cuisine to fill the rack.',
        entries: stats.cuisineFamilies.map((family) => ({
          id: family,
          title: CUISINE_LABELS[family],
          subtitle: 'Cuisine family tasted',
        })),
      });
    case 'hearth_pot':
      return withLevel(station, stats.homeCookedMeals.length, {
        valueLabel: `${stats.homeCookedMeals.length} home-cooked ${stats.homeCookedMeals.length === 1 ? 'meal' : 'meals'}`,
        detail: stats.homeCookedMeals.length ? 'Home-cooked meals warm the hearth.' : 'Mark a meal as home cooked to light the hearth.',
        entries: stats.homeCookedMeals,
      });
    case 'market_map':
      return withLevel(station, stats.foodPlaces.length, {
        valueLabel: `${stats.foodPlaces.length} food ${stats.foodPlaces.length === 1 ? 'place' : 'places'}`,
        detail: stats.foodPlaces.length ? 'Confirmed food stops and markets pin themselves here.' : 'Confirm a food place to start the map.',
        entries: stats.foodPlaces,
      });
    case 'photo_menu':
      return withLevel(station, stats.foodPhotos.length, {
        valueLabel: `${stats.foodPhotos.length} food ${stats.foodPhotos.length === 1 ? 'photo' : 'photos'}`,
        detail: stats.foodPhotos.length ? 'Food photos become Feastle\'s illustrated menu.' : 'Food photos and captured food meanings collect here.',
        entries: stats.foodPhotos,
      });
    case 'dessert_case':
      return withLevel(station, stats.desserts.length, {
        valueLabel: `${stats.desserts.length} dessert ${stats.desserts.length === 1 ? 'memory' : 'memories'}`,
        detail: stats.desserts.length ? 'Sweet stops and dessert memories fill the case.' : 'Dessert memories unlock this display.',
        entries: stats.desserts,
      });
    case 'quest_board':
      return withLevel(station, activeQuest ? 1 : activeQuestCount, {
        valueLabel: activeQuest ? 'Quest active' : 'No active quest',
        detail: activeQuest ? `${activeQuest.title}: ${activeQuest.hint}` : 'Talk to Feastle to pick up a personal food quest.',
        entries: activeQuest ? [{ id: activeQuest.questId, title: activeQuest.title, subtitle: activeQuest.hint }] : [],
      });
    case 'trophy_cupboard':
      return withLevel(station, stats.milestones.length, {
        valueLabel: `${stats.milestones.length} milestone${stats.milestones.length === 1 ? '' : 's'}`,
        detail: stats.milestones.length ? 'Feastle milestones earned through real food patterns.' : 'Milestones appear as Feastle memories deepen.',
        entries: stats.milestones,
      });
    default:
      return withLevel(station, 0, {
        valueLabel: 'Not started',
        detail: 'This station is waiting for its first matching memory.',
        entries: [],
      });
  }
}

function withLevel(
  station: LocalEnvironmentStationDefinition,
  value: number,
  input: { valueLabel: string; detail: string; entries: EnvironmentMemoryEntry[] }
): LocalEnvironmentStationRuntime {
  return {
    ...station,
    value,
    level: levelFor(value, station.thresholds),
    progressLabel: progressLabel(value, station.thresholds),
    ...input,
  };
}

function levelFor(value: number, thresholds: readonly [number, number, number]): 0 | 1 | 2 | 3 {
  if (value >= thresholds[2]) return 3;
  if (value >= thresholds[1]) return 2;
  if (value >= thresholds[0]) return 1;
  return 0;
}

function progressLabel(value: number, thresholds: readonly [number, number, number]): string {
  const next = thresholds.find((threshold) => value < threshold);
  return next ? `${Math.max(0, next - value)} to next upgrade` : 'Max upgrade reached';
}

function deriveCoffeeStats(days: HomeDayRecord[]): CoffeeStats {
  let coffeeMoments = 0;
  let cafeVisits = 0;
  const drinkVarieties = new Set<string>();
  const cafePlaces: CoffeeMemoryEntry[] = [];
  const coffeePhotos: CoffeeMemoryEntry[] = [];
  const homeBrews: CoffeeMemoryEntry[] = [];

  for (const day of days) {
    const date = day.dateLabel || day.isoDate;
    const coffeeQuickMoments = day.moments.filter((moment) => moment.type === 'coffee');
    coffeeMoments += coffeeQuickMoments.length;
    for (const moment of coffeeQuickMoments) {
      addDrinkLabel(drinkVarieties, moment.label);
    }

    for (const food of day.foodMoments ?? []) {
      const text = `${food.label} ${food.detail ?? ''}`;
      if (COFFEE_RE.test(text) || food.emoji === 'coffee') {
        coffeeMoments += 1;
        addDrinkLabel(drinkVarieties, food.label);
        if (food.homeCooked || /home|brew|made/i.test(food.detail ?? '')) {
          homeBrews.push({
            id: `food-${food.id}`,
            title: food.label,
            subtitle: `${date} - ${food.detail ?? 'Home coffee memory'}`,
            thumbnailUri: food.thumbnailUri,
          });
        }
      } else if (DRINK_RE.test(text)) {
        addDrinkLabel(drinkVarieties, food.label);
      }
    }

    for (const note of day.notes ?? []) {
      if (COFFEE_RE.test(note.text) && /home|brew|made|kitchen|morning/i.test(note.text)) {
        homeBrews.push({
          id: `note-${note.id}`,
          title: note.label || 'Home brew note',
          subtitle: `${date} - ${note.text.slice(0, 80)}`,
        });
      }
    }

    for (const place of day.confirmedPlaces ?? []) {
      if (place.category === 'cafe') {
        cafeVisits += 1;
        cafePlaces.push({
          id: `place-${day.id}-${place.id}`,
          title: place.label || 'Cafe',
          subtitle: `${date}${place.meaningLabel ? ` - ${place.meaningLabel}` : ''}`,
        });
      }
    }

    for (const location of day.locations ?? []) {
      if (location.type === 'cafe') cafeVisits += 1;
    }

    for (const meaning of day.capturedMeanings ?? []) {
      const text = `${meaning.label} ${meaning.archetype}`;
      if (DRINK_RE.test(text) || meaning.thumbnailUri) {
        const looksCoffee = DRINK_RE.test(text) || (day.foodMoments ?? []).some((food) => food.thumbnailUri === meaning.thumbnailUri && COFFEE_RE.test(food.label));
        if (looksCoffee) {
          coffeePhotos.push({
            id: `photo-${meaning.sourceId ?? meaning.createdAt}`,
            title: meaning.label || 'Coffee photo',
            subtitle: date,
            thumbnailUri: meaning.thumbnailUri,
          });
        }
      }
    }
  }

  const milestones: CoffeeMemoryEntry[] = [];
  if (coffeeMoments >= 1) milestones.push({ id: 'first-coffee', title: 'First coffee ritual', subtitle: 'Logged one coffee moment' });
  if (cafeVisits >= 3) milestones.push({ id: 'three-cafes', title: 'Cafe regular', subtitle: 'Confirmed 3 cafe visits' });
  if (cafeVisits >= 10) milestones.push({ id: 'ten-cafes', title: 'Map of favourite corners', subtitle: 'Confirmed 10 cafe visits' });
  if (coffeeMoments >= 24) milestones.push({ id: 'coffee-season', title: 'Coffee season', subtitle: '24 coffee moments saved' });

  return {
    coffeeMoments,
    drinkVarieties: [...drinkVarieties],
    cafeVisits,
    cafePlaces: cafePlaces.slice(-8).reverse(),
    coffeePhotos: coffeePhotos.slice(-8).reverse(),
    homeBrews: homeBrews.slice(-8).reverse(),
    milestones,
  };
}

function deriveFoodStats(days: HomeDayRecord[]): FoodStats {
  let foodMoments = 0;
  const cuisineFamilies = new Set<CuisineFamily>();
  const foodEntries: EnvironmentMemoryEntry[] = [];
  const foodPlaces: EnvironmentMemoryEntry[] = [];
  const foodPhotos: EnvironmentMemoryEntry[] = [];
  const homeCookedMeals: EnvironmentMemoryEntry[] = [];
  const desserts: EnvironmentMemoryEntry[] = [];

  for (const day of days) {
    const date = day.dateLabel || day.isoDate;

    for (const food of day.foodMoments ?? []) {
      foodMoments += 1;
      const display = resolveFoodMomentDisplay(food);
      const title = display.label;
      const subtitle = [date, display.detail]
        .filter(Boolean)
        .join(' - ');
      const entry = {
        id: `food-${food.id}`,
        title,
        subtitle,
        thumbnailUri: food.thumbnailUri,
      };
      foodEntries.push(entry);
      if (food.cuisine) cuisineFamilies.add(food.cuisine);
      if (food.homeCooked || /home|cooked|made|kitchen|recipe/i.test(food.detail ?? '')) homeCookedMeals.push(entry);
      if (isDessertMoment(food.label, food.detail, food.emoji)) desserts.push(entry);
      if (food.thumbnailUri) foodPhotos.push(entry);
    }

    for (const note of day.notes ?? []) {
      if (!FOOD_RE.test(note.text)) continue;
      const entry = {
        id: `note-${note.id}`,
        title: note.label || 'Food note',
        subtitle: `${date} - ${note.text.slice(0, 90)}`,
      };
      foodEntries.push(entry);
      if (/home|cooked|made|kitchen|recipe/i.test(note.text)) homeCookedMeals.push(entry);
      if (DESSERT_RE.test(note.text)) desserts.push(entry);
    }

    for (const place of day.confirmedPlaces ?? []) {
      const text = `${place.category} ${place.label} ${place.meaningLabel ?? ''}`;
      if (!FOOD_PLACE_RE.test(text)) continue;
      foodPlaces.push({
        id: `place-${day.id}-${place.id}`,
        title: place.label || 'Food place',
        subtitle: `${date}${place.meaningLabel ? ` - ${place.meaningLabel}` : ''}`,
      });
    }

    for (const location of day.locations ?? []) {
      if (!FOOD_PLACE_RE.test(String(location.type ?? ''))) continue;
      foodPlaces.push({
        id: `location-${day.id}-${location.id}`,
        title: location.type === 'cafe' ? 'Cafe stop' : 'Food place',
        subtitle: date,
      });
    }

    for (const meaning of day.capturedMeanings ?? []) {
      const text = `${meaning.label} ${meaning.archetype}`;
      const foodMomentHasSameThumb = (day.foodMoments ?? []).some((food) => food.thumbnailUri === meaning.thumbnailUri);
      if (!meaning.thumbnailUri || (!FOOD_RE.test(text) && !foodMomentHasSameThumb)) continue;
      foodPhotos.push({
        id: `photo-${meaning.sourceId ?? meaning.createdAt}`,
        title: meaning.label || 'Food photo',
        subtitle: date,
        thumbnailUri: meaning.thumbnailUri,
      });
    }
  }

  const milestones: EnvironmentMemoryEntry[] = [];
  if (foodMoments >= 1) milestones.push({ id: 'first-feast', title: 'First shared table', subtitle: 'Logged one food memory' });
  if (cuisineFamilies.size >= 3) milestones.push({ id: 'three-cuisines', title: 'Three tastes travelled', subtitle: 'Tagged 3 cuisine families' });
  if (homeCookedMeals.length >= 5) milestones.push({ id: 'home-hearth', title: 'Home hearth lit', subtitle: 'Saved 5 home-cooked meals' });
  if (desserts.length >= 5) milestones.push({ id: 'sweet-shelf', title: 'Sweet shelf', subtitle: 'Saved 5 dessert memories' });
  if (foodMoments >= 30) milestones.push({ id: 'full-season', title: 'A season of feasts', subtitle: '30 food memories saved' });

  return {
    foodMoments,
    foodEntries: foodEntries.slice(-8).reverse(),
    cuisineFamilies: [...cuisineFamilies],
    foodPlaces: foodPlaces.slice(-8).reverse(),
    foodPhotos: uniqueEntries(foodPhotos).slice(-8).reverse(),
    homeCookedMeals: homeCookedMeals.slice(-8).reverse(),
    desserts: desserts.slice(-8).reverse(),
    milestones,
  };
}

function addDrinkLabel(labels: Set<string>, raw: string): void {
  const label = raw.trim();
  if (!label) return;
  labels.add(label.replace(/\b\w/g, (letter) => letter.toUpperCase()));
}

function latestCoffeeEntries(stats: CoffeeStats): CoffeeMemoryEntry[] {
  return [
    ...stats.cafePlaces.slice(0, 3),
    ...stats.coffeePhotos.slice(0, 3),
    ...stats.homeBrews.slice(0, 3),
  ].slice(0, 6);
}

function isDessertMoment(label: string, detail: string | null | undefined, emoji: string): boolean {
  return label === 'Dessert' || DESSERT_RE.test(`${label} ${detail ?? ''} ${emoji}`);
}

function uniqueEntries(entries: EnvironmentMemoryEntry[]): EnvironmentMemoryEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entry.thumbnailUri ?? entry.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
