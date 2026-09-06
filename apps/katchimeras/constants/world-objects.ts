import type { HomeDayRecord } from '@/types/home';

// THE WORLD OBJECT REGISTRY — the single source of truth for earnable world
// objects: what they are, HOW A LIFE EARNS THEM (declarative unlock specs one
// evaluator interprets — designer-editable data, no closures), their art
// variants, and their provenance-label templates. Runtime systems
// (kingdom-decor granting, the almanac, the Asset Lab) derive their tables
// from here; adding a new earned object = adding ONE definition.

// ---------------------------------------------------------------------------
// Unlock specs — small declarative conditions, evaluated in one place.
// ---------------------------------------------------------------------------

// Day metrics readable by 'metric' specs — extend HERE when a new signal lands.
export type DayMetricId =
  | 'steps'
  | 'notes'
  | 'voiceNotes'
  | 'reflections'
  | 'confirmedPlaces'
  | 'foodMoments'
  | 'studioMoments'
  | 'bigMoments'
  | 'capturedMeanings'
  | 'sleepLogged'
  | 'goodSleep'
  | 'newPlaces'
  // Photos given meaning today (captured meanings + the hero photo).
  | 'photosKept'
  // Most faces seen in one of today's photos (gatherings).
  | 'photoFaces'
  // Dessert food memories today (the Dessert food type).
  | 'desserts'
  // Meals tagged Home-made today (the "what kind?" step).
  | 'homeCookedMeals';

// Calendar windows (month-day ranges on the day's isoDate).
export type CalendarWindowId = 'newYear' | 'leapDay' | 'firstSpring' | 'harvest' | 'winterLights';

export type UnlockSpec =
  // ---- Day lane: evaluated against one day's record ----
  | { kind: 'metric'; metric: DayMetricId; gte: number }
  // A named movement event (the user's steps interpretation).
  | { kind: 'event'; event: 'hike' | 'run' | 'cycle' | 'travel' }
  // A confirmed place of this category today ('park' | 'cafe' | 'museum'…).
  | { kind: 'placeCategory'; category: string }
  // A Big Moment of this type today ('birthday' | 'anniversary'…).
  | { kind: 'bigMomentType'; type: string }
  // The day falls inside a calendar window (New Year, leap day…).
  | { kind: 'calendar'; window: CalendarWindowId }
  // The day roamed at least this far from the home anchor (needs eval context).
  | { kind: 'distanceFromHome'; gteKm: number }
  // The day's photos contained this canonical Vision concept ('sunset',
  // 'snow', 'dog'… — utils/vision-signals.ts vocabulary).
  | { kind: 'photoLabel'; label: string }
  // An inspiration of this media type kept today ('book' | 'film' | 'music'…).
  | { kind: 'studioMediaType'; mediaType: string }
  // A meal tagged with a cuisine family today (any family when omitted).
  // With repeat 'perSubject', the family IS the dedup subject.
  | { kind: 'cuisine'; family?: string }
  | { kind: 'any'; of: UnlockSpec[] }
  | { kind: 'all'; of: UnlockSpec[] }
  // ---- Lifetime lane: evaluated over ALL hatched days (kingdom-decor) ----
  | { kind: 'tenure'; daysLived: number }
  | { kind: 'streak'; of: UnlockSpec; days: number }
  | { kind: 'lifetimeCount'; of: UnlockSpec; gte: number }
  // Escape hatch: full code power, registered below by id.
  | { kind: 'custom'; id: string };

// Registered custom predicates for `{ kind: 'custom' }` specs.
const CUSTOM_UNLOCKS: Record<string, (day: HomeDayRecord) => boolean> = {};

export function dayMetric(day: HomeDayRecord, metric: DayMetricId): number {
  switch (metric) {
    case 'steps':
      return day.stepsCount ?? 0;
    case 'notes':
      return day.notes?.length ?? 0;
    case 'reflections':
      return (day.promptAnswers ?? []).filter((answer) => !answer.dismissed && answer.choiceIds.length > 0).length;
    case 'confirmedPlaces':
      return day.confirmedPlaces?.length ?? 0;
    case 'foodMoments':
      return day.foodMoments?.length ?? 0;
    case 'studioMoments':
      return day.studioMoments?.length ?? 0;
    case 'bigMoments':
      return day.bigMoments?.length ?? 0;
    case 'capturedMeanings':
      return day.capturedMeanings?.length ?? 0;
    case 'voiceNotes':
      return (day.notes ?? []).filter((note) => note.kind === 'voice').length;
    case 'sleepLogged':
      return day.sleep ? 1 : 0;
    case 'goodSleep':
      return day.sleep?.quality === 'good' ? 1 : 0;
    case 'newPlaces':
      return day.newPlaceCount ?? 0;
    case 'photosKept':
      return (day.capturedMeanings?.length ?? 0) + (day.heroPhoto ? 1 : 0);
    case 'photoFaces':
      return day.vision?.maxFaceCount ?? 0;
    case 'desserts':
      return (day.foodMoments ?? []).filter((moment) => moment.label === 'Dessert').length;
    case 'homeCookedMeals':
      return (day.foodMoments ?? []).filter((moment) => moment.homeCooked).length;
  }
}

// Cuisine families, in CANONICAL ORDER — the Cuisine Lantern's art variants
// are indexed by this list, so the order is load-bearing (append only).
export const CUISINE_FAMILIES = [
  'italian',
  'japanese',
  'chinese',
  'indian',
  'mexican',
  'middle_eastern',
  'french',
  'greek',
] as const;

export const CUISINE_FAMILY_LABELS: Record<string, string> = {
  italian: 'Italian',
  japanese: 'Japanese',
  chinese: 'Chinese',
  indian: 'Indian',
  mexican: 'Mexican',
  middle_eastern: 'Middle Eastern',
  french: 'French',
  greek: 'Greek',
};

// The distinct dedup subjects a day yields for a perSubject spec (e.g. the
// cuisine families tasted today). Empty for specs with no subject notion.
export function subjectsForSpec(spec: UnlockSpec, day: HomeDayRecord): string[] {
  if (spec.kind === 'cuisine') {
    const families = (day.foodMoments ?? [])
      .map((moment) => moment.cuisine)
      .filter((family): family is NonNullable<typeof family> => Boolean(family))
      .filter((family) => !spec.family || family === spec.family);
    return [...new Set(families)];
  }
  return [];
}

// Context for specs that need more than the day record itself (kept as
// injected resolvers so this module stays pure and Node-verifiable).
export type DayEvalContext = {
  // Max distance (km) the day roamed from the home anchor; absent = 0.
  distanceFromHomeKm?: (day: HomeDayRecord) => number;
};

// Month-day window check ("12-31" style, inclusive; windows may wrap the year).
function inCalendarWindow(isoDate: string, window: CalendarWindowId): boolean {
  const monthDay = isoDate.slice(5); // 'MM-DD'
  switch (window) {
    case 'newYear':
      return monthDay === '12-31' || monthDay === '01-01';
    case 'leapDay':
      return monthDay === '02-29';
    case 'firstSpring':
      return monthDay >= '03-20' && monthDay <= '03-22';
    case 'harvest':
      return monthDay >= '09-21' && monthDay <= '09-23';
    case 'winterLights':
      return monthDay >= '12-20' && monthDay <= '12-26';
  }
}

export function evaluateDayUnlock(spec: UnlockSpec, day: HomeDayRecord, ctx: DayEvalContext = {}): boolean {
  switch (spec.kind) {
    case 'metric':
      return dayMetric(day, spec.metric) >= spec.gte;
    case 'event':
      return day.stepsInterpretation?.movement === spec.event;
    case 'placeCategory':
      return (day.confirmedPlaces ?? []).some((place) => place.category === spec.category);
    case 'bigMomentType':
      return (day.bigMoments ?? []).some((moment) => moment.type === spec.type);
    case 'calendar':
      return inCalendarWindow(day.isoDate, spec.window);
    case 'distanceFromHome':
      return (ctx.distanceFromHomeKm?.(day) ?? 0) >= spec.gteKm;
    case 'photoLabel':
      return (day.vision?.concepts ?? []).some((concept) => concept.name === spec.label);
    case 'studioMediaType':
      return (day.studioMoments ?? []).some((moment) => moment.mediaType === spec.mediaType);
    case 'cuisine':
      return subjectsForSpec(spec, day).length > 0;
    case 'any':
      return spec.of.some((inner) => evaluateDayUnlock(inner, day, ctx));
    case 'all':
      return spec.of.every((inner) => evaluateDayUnlock(inner, day, ctx));
    // Lifetime kinds never fire in the day lane.
    case 'tenure':
    case 'streak':
    case 'lifetimeCount':
      return false;
    case 'custom':
      return CUSTOM_UNLOCKS[spec.id]?.(day) ?? false;
  }
}

// Lifetime lane: evaluated over every hatched day (ascending isoDate order).
export function evaluateLifetimeUnlock(spec: UnlockSpec, hatchedDays: HomeDayRecord[], ctx: DayEvalContext = {}): boolean {
  switch (spec.kind) {
    case 'tenure':
      return hatchedDays.length >= spec.daysLived;
    case 'lifetimeCount':
      return hatchedDays.filter((day) => evaluateDayUnlock(spec.of, day, ctx)).length >= spec.gte;
    case 'streak': {
      // Longest run of CONSECUTIVE calendar days whose record meets the inner spec.
      let run = 0;
      let prevIso: string | null = null;
      for (const day of hatchedDays) {
        if (!evaluateDayUnlock(spec.of, day, ctx)) {
          run = 0;
          prevIso = null;
          continue;
        }
        run = prevIso && nextIsoDay(prevIso) === day.isoDate ? run + 1 : 1;
        prevIso = day.isoDate;
        if (run >= spec.days) return true;
      }
      return false;
    }
    default:
      // Day-lane specs count as "ever happened once".
      return hatchedDays.some((day) => evaluateDayUnlock(spec, day, ctx));
  }
}

function nextIsoDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Spec → human sentence. Renders the EXACT rule (thresholds, streak lengths,
// composites) for the Asset Lab detail page and the almanac — always derived
// from the live spec, so the copy can't drift from the evaluator.
// ---------------------------------------------------------------------------

const METRIC_PHRASES: Record<DayMetricId, string> = {
  steps: 'steps',
  notes: 'notes kept',
  voiceNotes: 'voice notes kept',
  reflections: 'reflections answered',
  confirmedPlaces: 'places confirmed',
  foodMoments: 'food memories saved',
  studioMoments: 'inspirations kept',
  bigMoments: 'Big Moments marked',
  capturedMeanings: 'photos given meaning',
  sleepLogged: 'sleep logged',
  goodSleep: 'a good night logged',
  newPlaces: 'new places visited',
  photosKept: 'photos kept',
  photoFaces: 'faces in one photo',
  desserts: 'desserts savoured',
  homeCookedMeals: 'home-cooked meals',
};

const CALENDAR_PHRASES: Record<CalendarWindowId, string> = {
  newYear: 'on New Year (Dec 31 – Jan 1)',
  leapDay: 'on a February 29th',
  firstSpring: 'on the first days of spring (Mar 20–22)',
  harvest: 'at the harvest equinox (Sep 21–23)',
  winterLights: 'during winter lights (Dec 20–26)',
};

export function describeUnlockSpec(spec: UnlockSpec): string {
  switch (spec.kind) {
    case 'metric': {
      const phrase = METRIC_PHRASES[spec.metric] ?? spec.metric;
      // Boolean-ish metrics read better without the "1+" prefix.
      return spec.gte === 1 ? phrase : `${spec.gte.toLocaleString()}+ ${phrase} in one day`;
    }
    case 'event':
      return `a ${spec.event} day (steps interpretation)`;
    case 'placeCategory':
      return `confirm a ${spec.category} place`;
    case 'bigMomentType':
      return `mark a ${spec.type} Big Moment`;
    case 'calendar':
      return `live a day ${CALENDAR_PHRASES[spec.window]}`;
    case 'distanceFromHome':
      return `roam ${spec.gteKm.toLocaleString()}+ km from home`;
    case 'photoLabel':
      return `a photo of ${spec.label} (read on-device)`;
    case 'studioMediaType':
      return `keep a ${spec.mediaType} in the Studio`;
    case 'cuisine':
      return spec.family
        ? `a meal tagged ${CUISINE_FAMILY_LABELS[spec.family] ?? spec.family}`
        : 'a meal tagged with any cuisine (one lantern per family)';
    case 'any':
      return spec.of.map(describeUnlockSpec).join(' — OR — ');
    case 'all':
      return spec.of.map(describeUnlockSpec).join(' — AND — ');
    case 'tenure':
      return `${spec.daysLived.toLocaleString()} days lived with the Kingdom`;
    case 'streak':
      return `${spec.days} consecutive days of: ${describeUnlockSpec(spec.of)}`;
    case 'lifetimeCount':
      return `${spec.gte.toLocaleString()} lifetime days of: ${describeUnlockSpec(spec.of)}`;
    case 'custom':
      return 'a special condition';
  }
}

// ---------------------------------------------------------------------------
// Provenance label templates — tokens expand to the same phrases the old
// closure labels produced ("9,000 steps in one day", "🍜 Ramen · savoured").
// A template with no tokens is a static label.
// ---------------------------------------------------------------------------

const LABEL_TOKENS: Record<string, (day: HomeDayRecord) => string> = {
  bigMomentLabel: (day) => day.bigMoments?.[0]?.label ?? 'A big moment',
  stepsLine: (day) => `${(day.stepsCount ?? 0).toLocaleString()} steps in one day`,
  placeLine: (day) => {
    const place = day.confirmedPlaces?.[0];
    return place ? `${place.label} · a place given meaning` : 'A place given meaning';
  },
  foodLine: (day) => {
    const food = day.foodMoments?.[0];
    return food ? `${food.emoji} ${food.label} · savoured` : 'A meal savoured';
  },
  studioLine: (day) => {
    const studio = day.studioMoments?.[0];
    return studio ? `${studio.emoji} ${studio.label} · an inspiration` : 'An inspiration kept';
  },
  notesLine: (day) => `${day.notes?.length ?? 0} notes kept in one day`,
  cuisineLine: (day) => {
    const family = (day.foodMoments ?? []).find((moment) => moment.cuisine)?.cuisine;
    return family ? `First taste of ${CUISINE_FAMILY_LABELS[family] ?? family}` : 'A new cuisine tasted';
  },
};

export function formatUnlockLabel(template: string, day: HomeDayRecord): string {
  return template.replace(/\{(\w+)\}/g, (whole, token: string) => LABEL_TOKENS[token]?.(day) ?? whole);
}

// ---------------------------------------------------------------------------
// Object definitions.
// ---------------------------------------------------------------------------

export type WorldObjectPickMode = 'random' | 'level' | 'state';

export type WorldObjectRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type WorldObjectDefinition = {
  id: string;
  name: string;
  art: {
    // worldAssetSource keys. ONE entry = fixed art; several + pick 'random' =
    // a variant family the grant picks from (deterministically, per grant id).
    variants: string[];
    pick: WorldObjectPickMode;
    sizeScale?: number;
  };
  // How a day earns it (signature keepsakes). Bloom commons and discovery
  // keepsakes are granted by their own lanes and carry no day-unlock spec.
  unlock?: UnlockSpec;
  // Almanac copy: how a day earns this, phrased for the user.
  hint?: string;
  // Provenance line template (see LABEL_TOKENS); static string = static label.
  labelTemplate?: string;
  // --- Expansion catalog fields (docs/world-objects-expansion-design.md) ---
  rarity?: WorldObjectRarity;
  // Milestone-lane repetition: 'once' (default), 'perYear' (calendar earns),
  // or 'perSubject' (one grant per distinct subject — see subjectsForSpec).
  repeat?: 'once' | 'perYear' | 'perSubject';
  // Which generation grid replaces this fallback art (production planning).
  artBatch?: string;
};

// Signature keepsakes — array order IS grant priority (max 2 fire per day).
export const SIGNATURE_KEEPSAKES: WorldObjectDefinition[] = [
  {
    id: 'big_moment_blossom',
    name: 'Festival Bunting',
    art: { variants: ['festival_bunting'], pick: 'random', sizeScale: 1.1 },
    unlock: { kind: 'metric', metric: 'bigMoments', gte: 1 },
    hint: 'Mark a Big Moment',
    labelTemplate: '{bigMomentLabel}',
  },
  {
    id: 'journey_stone',
    name: 'Trail Stone',
    art: { variants: ['trail_stone'], pick: 'random' },
    unlock: { kind: 'any', of: [{ kind: 'metric', metric: 'steps', gte: 8000 }, { kind: 'event', event: 'hike' }] },
    hint: '8,000+ steps, or a hike',
    labelTemplate: '{stepsLine}',
  },
  {
    id: 'wayfinder_post',
    name: 'Wayfinder Post',
    art: { variants: ['decor_13'], pick: 'random' },
    unlock: { kind: 'metric', metric: 'confirmedPlaces', gte: 1 },
    hint: 'Give a place its meaning',
    labelTemplate: '{placeLine}',
  },
  {
    id: 'market_crate',
    name: 'Picnic Basket',
    art: { variants: ['picnic_basket'], pick: 'random' },
    unlock: { kind: 'metric', metric: 'foodMoments', gte: 1 },
    hint: 'Save a food memory',
    labelTemplate: '{foodLine}',
  },
  {
    id: 'study_planter',
    name: 'Book Stack',
    art: { variants: ['book_stack'], pick: 'random' },
    unlock: { kind: 'metric', metric: 'studioMoments', gte: 1 },
    hint: 'Keep an inspiration',
    labelTemplate: '{studioLine}',
  },
  {
    id: 'reflection_flowers',
    name: 'Wildflowers',
    art: { variants: ['decor_7'], pick: 'random' },
    unlock: { kind: 'metric', metric: 'reflections', gte: 3 },
    hint: 'Answer 3 reflections in a day',
    labelTemplate: 'A deeply reflected day',
  },
  {
    id: 'keeper_lantern',
    name: 'Keeper’s Lantern',
    art: { variants: ['decor_12'], pick: 'random', sizeScale: 1.15 },
    unlock: { kind: 'metric', metric: 'notes', gte: 2 },
    hint: 'Keep 2 notes in a day',
    labelTemplate: '{notesLine}',
  },
  // --- Expansion wave 1 (fallback art until batches B5/B9 land) -------------
  {
    id: 'dream_bell',
    name: 'Dream Bell',
    rarity: 'uncommon',
    artBatch: 'B9',
    art: { variants: ['dream_bell'], pick: 'random' },
    unlock: { kind: 'metric', metric: 'goodSleep', gte: 1 },
    hint: 'Wake from a good night’s sleep',
    labelTemplate: 'A well-rested morning',
  },
  {
    id: 'echo_shell',
    name: 'Echo Shell',
    rarity: 'uncommon',
    artBatch: 'B5',
    art: { variants: ['echo_shell'], pick: 'random' },
    unlock: { kind: 'metric', metric: 'voiceNotes', gte: 1 },
    hint: 'Speak a voice note',
    labelTemplate: 'A day kept in your own voice',
  },
  {
    id: 'milepost_50',
    name: 'Day-Tripper Milepost',
    rarity: 'uncommon',
    artBatch: 'B3',
    art: { variants: ['milepost_50'], pick: 'random' },
    unlock: { kind: 'distanceFromHome', gteKm: 50 },
    hint: 'Roam 50 km from home in a day',
    labelTemplate: 'A day far from home',
  },
  {
    id: 'memory_prism',
    name: 'Memory Prism',
    rarity: 'uncommon',
    art: { variants: ['memory_prism'], pick: 'random' },
    unlock: { kind: 'metric', metric: 'capturedMeanings', gte: 1 },
    hint: 'Give a photo its meaning',
    labelTemplate: 'A moment made meaning',
  },
  {
    id: 'golden_frame',
    name: 'Golden Hour Frame',
    rarity: 'uncommon',
    art: { variants: ['golden_frame'], pick: 'random' },
    unlock: { kind: 'metric', metric: 'photosKept', gte: 3 },
    hint: 'Keep 3 photos in a day',
    labelTemplate: 'A day in three frames',
  },
  {
    id: 'harmony_wreath',
    name: 'Harmony Wreath',
    rarity: 'rare',
    art: { variants: ['harmony_wreath'], pick: 'random' },
    unlock: {
      kind: 'all',
      of: [
        { kind: 'metric', metric: 'reflections', gte: 1 },
        { kind: 'metric', metric: 'notes', gte: 1 },
        { kind: 'metric', metric: 'foodMoments', gte: 1 },
        { kind: 'metric', metric: 'sleepLogged', gte: 1 },
      ],
    },
    hint: 'Reflect, note, savour and rest — all in one day',
    labelTemplate: 'A day lived in full',
  },
];

// Milestone keepsakes — the lifetime lane (docs §5 C/D/E/J wave 1): streaks,
// tenure, lifetime counts, calendar windows and first-time places. Granted
// ONCE (or once per year for calendar earns) by kingdom-decor's milestone
// lane; grant ids are `ms:<id>` so re-syncs never duplicate. Art is tier
// fallback until the noted batch lands.
export const MILESTONE_KEEPSAKES: WorldObjectDefinition[] = [
  // Streaks & tenure (batch B3/B11)
  {
    id: 'thinkers_bench',
    name: 'Thinker’s Bench',
    rarity: 'uncommon',
    artBatch: 'B3',
    art: { variants: ['thinkers_bench'], pick: 'random' },
    unlock: { kind: 'streak', of: { kind: 'metric', metric: 'reflections', gte: 1 }, days: 3 },
    hint: 'Reflect 3 days in a row',
    labelTemplate: 'Three reflective days in a row',
  },
  {
    id: 'striders_obelisk',
    name: 'Strider’s Obelisk',
    rarity: 'rare',
    artBatch: 'B3',
    art: { variants: ['striders_obelisk'], pick: 'random', sizeScale: 1.15 },
    unlock: { kind: 'streak', of: { kind: 'metric', metric: 'steps', gte: 8000 }, days: 7 },
    hint: 'Walk 8,000+ steps 7 days in a row',
    labelTemplate: 'A week of long walks',
  },
  {
    id: 'month_ring',
    name: 'Month Ring',
    rarity: 'rare',
    artBatch: 'B3',
    art: { variants: ['month_ring'], pick: 'random', sizeScale: 1.15 },
    unlock: {
      kind: 'streak',
      of: {
        kind: 'any',
        of: [
          { kind: 'metric', metric: 'notes', gte: 1 },
          { kind: 'metric', metric: 'reflections', gte: 1 },
          { kind: 'metric', metric: 'capturedMeanings', gte: 1 },
          { kind: 'metric', metric: 'foodMoments', gte: 1 },
          { kind: 'metric', metric: 'studioMoments', gte: 1 },
          { kind: 'metric', metric: 'sleepLogged', gte: 1 },
        ],
      },
      days: 30,
    },
    hint: 'Keep something every day for 30 days',
    labelTemplate: 'Thirty days, thirty moments',
  },
  {
    id: 'founding_stone',
    name: 'Founding Stone',
    rarity: 'uncommon',
    artBatch: 'B11',
    art: { variants: ['founding_stone'], pick: 'random' },
    unlock: { kind: 'tenure', daysLived: 30 },
    hint: 'Live 30 days with your Kingdom',
    labelTemplate: '30 days lived',
  },
  {
    id: 'century_pillar',
    name: 'Century Pillar',
    rarity: 'epic',
    artBatch: 'B11',
    art: { variants: ['century_pillar'], pick: 'random', sizeScale: 1.2 },
    unlock: { kind: 'tenure', daysLived: 100 },
    hint: 'Live 100 days with your Kingdom',
    labelTemplate: '100 days lived',
  },
  {
    id: 'year_monument',
    name: 'Year Monument',
    rarity: 'legendary',
    artBatch: 'B11',
    art: { variants: ['year_monument'], pick: 'random', sizeScale: 1.3 },
    unlock: { kind: 'tenure', daysLived: 365 },
    hint: 'A whole year, lived and kept',
    labelTemplate: 'One year of days',
  },
  {
    id: 'chronicler_desk',
    name: 'Chronicler’s Desk',
    rarity: 'rare',
    artBatch: 'B3',
    art: { variants: ['chronicler_desk'], pick: 'random' },
    unlock: { kind: 'lifetimeCount', of: { kind: 'metric', metric: 'notes', gte: 1 }, gte: 100 },
    hint: 'Keep notes on 100 days',
    labelTemplate: 'A hundred days of notes',
  },
  // Movement (batch B9)
  {
    id: 'iron_boots',
    name: 'Iron Boots Statue',
    rarity: 'rare',
    artBatch: 'B9',
    art: { variants: ['iron_boots'], pick: 'random' },
    unlock: { kind: 'metric', metric: 'steps', gte: 20000 },
    hint: 'Walk 20,000 steps in one day',
    labelTemplate: '{stepsLine}',
  },
  {
    id: 'cairn_tower',
    name: 'Cairn Tower',
    rarity: 'rare',
    artBatch: 'B9',
    art: { variants: ['cairn_tower'], pick: 'random', sizeScale: 1.2 },
    unlock: { kind: 'lifetimeCount', of: { kind: 'event', event: 'hike' }, gte: 10 },
    hint: 'Ten hikes, one tower',
    labelTemplate: 'Ten hikes climbed',
  },
  // First-time places (batch B4) — the confirm sheet already sets categories.
  {
    id: 'park_kite',
    name: 'Park Kite Bench',
    rarity: 'uncommon',
    artBatch: 'B4',
    art: { variants: ['park_kite'], pick: 'random' },
    unlock: { kind: 'placeCategory', category: 'park' },
    hint: 'Spend time at a park',
    labelTemplate: '{placeLine}',
  },
  {
    id: 'curio_obelisk',
    name: 'Curio Obelisk',
    rarity: 'uncommon',
    artBatch: 'B4',
    art: { variants: ['curio_obelisk'], pick: 'random' },
    unlock: { kind: 'placeCategory', category: 'museum' },
    hint: 'Visit a museum or gallery',
    labelTemplate: '{placeLine}',
  },
  {
    id: 'wonder_miniature',
    name: 'Wonder Miniature',
    rarity: 'rare',
    artBatch: 'B4',
    art: { variants: ['wonder_miniature'], pick: 'random' },
    unlock: { kind: 'placeCategory', category: 'landmark' },
    hint: 'Stand before a landmark',
    labelTemplate: '{placeLine}',
  },
  {
    id: 'tidepool_basin',
    name: 'Tidepool Basin',
    rarity: 'uncommon',
    art: { variants: ['tidepool_basin'], pick: 'random' },
    unlock: { kind: 'placeCategory', category: 'beach' },
    hint: 'Spend time at the beach',
    labelTemplate: '{placeLine}',
  },
  {
    id: 'whisper_archive',
    name: 'Whisper Archive',
    rarity: 'uncommon',
    art: { variants: ['whisper_archive'], pick: 'random' },
    unlock: { kind: 'placeCategory', category: 'library' },
    hint: 'Visit a library',
    labelTemplate: '{placeLine}',
  },
  {
    id: 'cinema_marquee',
    name: 'Cinema Marquee',
    rarity: 'uncommon',
    art: { variants: ['cinema_marquee'], pick: 'random' },
    unlock: { kind: 'placeCategory', category: 'cinema' },
    hint: 'Catch a film at the cinema',
    labelTemplate: '{placeLine}',
  },
  {
    id: 'market_awning',
    name: 'Market Awning',
    rarity: 'uncommon',
    art: { variants: ['market_awning'], pick: 'random' },
    unlock: { kind: 'placeCategory', category: 'shopping' },
    hint: 'Wander a market or shops',
    labelTemplate: '{placeLine}',
  },
  {
    id: 'corner_cart',
    name: 'Corner Café Cart',
    rarity: 'uncommon',
    art: { variants: ['corner_cart'], pick: 'random' },
    unlock: { kind: 'streak', of: { kind: 'placeCategory', category: 'cafe' }, days: 3 },
    hint: 'Your café, 3 days running',
    labelTemplate: 'A third place, three days running',
  },
  {
    id: 'hometown_plaque',
    name: 'Hometown Plaque',
    rarity: 'rare',
    art: { variants: ['hometown_plaque'], pick: 'random' },
    unlock: { kind: 'lifetimeCount', of: { kind: 'metric', metric: 'confirmedPlaces', gte: 1 }, gte: 30 },
    hint: 'Give places their meaning on 30 days',
    labelTemplate: 'Thirty days of placed meaning',
  },
  // Calendar windows (batch B2) — perYear earns return each year.
  {
    id: 'countdown_orb',
    name: 'Countdown Orb',
    rarity: 'rare',
    repeat: 'perYear',
    artBatch: 'B2',
    art: { variants: ['countdown_orb'], pick: 'random' },
    unlock: { kind: 'calendar', window: 'newYear' },
    hint: 'Be here when the year turns',
    labelTemplate: 'A new year welcomed',
  },
  {
    id: 'maypole',
    name: 'Spring Maypole',
    rarity: 'uncommon',
    repeat: 'perYear',
    artBatch: 'B2',
    art: { variants: ['maypole'], pick: 'random' },
    unlock: { kind: 'calendar', window: 'firstSpring' },
    hint: 'Greet the first days of spring',
    labelTemplate: 'Spring, welcomed',
  },
  {
    id: 'harvest_horn',
    name: 'Harvest Horn',
    rarity: 'uncommon',
    repeat: 'perYear',
    artBatch: 'B2',
    art: { variants: ['harvest_horn'], pick: 'random' },
    unlock: { kind: 'calendar', window: 'harvest' },
    hint: 'Mark the turn into autumn',
    labelTemplate: 'A harvest kept',
  },
  {
    id: 'garland_arch',
    name: 'Winter Garland Arch',
    rarity: 'rare',
    repeat: 'perYear',
    artBatch: 'B2',
    art: { variants: ['garland_arch'], pick: 'random' },
    unlock: { kind: 'calendar', window: 'winterLights' },
    hint: 'Be here for the winter lights',
    labelTemplate: 'Winter lights remembered',
  },
  // Geography (batch B3) — distance needs the home anchor (DayEvalContext).
  {
    id: 'voyager_compass',
    name: 'Voyager Compass',
    rarity: 'rare',
    artBatch: 'B3',
    art: { variants: ['voyager_compass'], pick: 'random' },
    unlock: { kind: 'distanceFromHome', gteKm: 500 },
    hint: 'Journey 500 km from home',
    labelTemplate: 'A true voyage',
  },
  {
    id: 'meridian_globe',
    name: 'Meridian Globe',
    rarity: 'epic',
    artBatch: 'B11',
    art: { variants: ['meridian_globe'], pick: 'random', sizeScale: 1.2 },
    unlock: { kind: 'distanceFromHome', gteKm: 3000 },
    hint: 'Cross 3,000 km from home',
    labelTemplate: 'Half a world away',
  },
  {
    id: 'pathfinder_post',
    name: 'Pathfinder Post',
    rarity: 'rare',
    artBatch: 'B3',
    art: { variants: ['pathfinder_post'], pick: 'random' },
    unlock: { kind: 'lifetimeCount', of: { kind: 'metric', metric: 'newPlaces', gte: 1 }, gte: 25 },
    hint: 'Discover new places on 25 days',
    labelTemplate: 'Twenty-five days of somewhere new',
  },
  {
    id: 'birthday_crown',
    name: 'Birthday Crown Pedestal',
    rarity: 'rare',
    repeat: 'perYear',
    art: { variants: ['birthday_crown'], pick: 'random' },
    unlock: { kind: 'bigMomentType', type: 'birthday' },
    hint: 'Mark a birthday',
    labelTemplate: '{bigMomentLabel}',
  },
  // Life events (batch B2 art) — the Big Moment types that mark a chapter.
  {
    id: 'stork_lantern',
    name: 'Stork Lantern',
    rarity: 'rare',
    repeat: 'perYear',
    art: { variants: ['stork_lantern'], pick: 'random' },
    unlock: { kind: 'bigMomentType', type: 'baby' },
    hint: 'Welcome a new baby',
    labelTemplate: '{bigMomentLabel}',
  },
  {
    id: 'vow_arbor',
    name: 'Vow Arbor',
    rarity: 'epic',
    art: { variants: ['vow_arbor'], pick: 'random', sizeScale: 1.15 },
    unlock: { kind: 'bigMomentType', type: 'wedding' },
    hint: 'Mark a wedding day',
    labelTemplate: '{bigMomentLabel}',
  },
  {
    id: 'laurel_scroll',
    name: 'Laurel Scroll',
    rarity: 'rare',
    art: { variants: ['laurel_scroll'], pick: 'random' },
    unlock: { kind: 'bigMomentType', type: 'graduation' },
    hint: 'Mark a graduation',
    labelTemplate: '{bigMomentLabel}',
  },
  {
    id: 'housewarming_wreath',
    name: 'Housewarming Wreath',
    rarity: 'rare',
    art: { variants: ['housewarming_wreath'], pick: 'random' },
    unlock: { kind: 'bigMomentType', type: 'newHome' },
    hint: 'Mark a new home',
    labelTemplate: '{bigMomentLabel}',
  },
  {
    id: 'desk_bell',
    name: 'First-Day Desk Bell',
    rarity: 'uncommon',
    art: { variants: ['desk_bell'], pick: 'random' },
    unlock: { kind: 'bigMomentType', type: 'newJob' },
    hint: 'Mark a new job',
    labelTemplate: '{bigMomentLabel}',
  },
  {
    id: 'reunion_table',
    name: 'Reunion Long Table',
    rarity: 'uncommon',
    repeat: 'perYear',
    art: { variants: ['reunion_table'], pick: 'random' },
    unlock: { kind: 'bigMomentType', type: 'reunion' },
    hint: 'Gather a reunion',
    labelTemplate: '{bigMomentLabel}',
  },
  // Photo subjects (batch B5/B6) — the day's photos, read on-device. Once-ever.
  {
    id: 'pet_pedestal',
    name: 'Companion Statue',
    rarity: 'rare',
    artBatch: 'B5',
    art: { variants: ['pet_pedestal'], pick: 'random' },
    unlock: { kind: 'any', of: [{ kind: 'photoLabel', label: 'dog' }, { kind: 'photoLabel', label: 'cat' }] },
    hint: 'Photograph a beloved companion',
    labelTemplate: 'A companion, remembered',
  },
  {
    id: 'dusk_mirror',
    name: 'Dusk Mirror',
    rarity: 'uncommon',
    artBatch: 'B5',
    art: { variants: ['dusk_mirror'], pick: 'random' },
    unlock: { kind: 'photoLabel', label: 'sunset' },
    hint: 'Catch a golden hour',
    labelTemplate: 'A golden hour kept',
  },
  {
    id: 'snow_globe',
    name: 'Snow Day Globe',
    rarity: 'uncommon',
    artBatch: 'B5',
    art: { variants: ['snow_globe'], pick: 'random' },
    unlock: { kind: 'photoLabel', label: 'snow' },
    hint: 'Photograph a snowy day',
    labelTemplate: 'A snow day kept',
  },
  {
    id: 'star_basin',
    name: 'Star Basin',
    rarity: 'rare',
    artBatch: 'B6',
    art: { variants: ['star_basin'], pick: 'random' },
    unlock: { kind: 'photoLabel', label: 'stars' },
    hint: 'Photograph a starry sky',
    labelTemplate: 'A night under stars',
  },
  {
    id: 'skyline_diorama',
    name: 'Skyline Diorama',
    rarity: 'uncommon',
    artBatch: 'B6',
    art: { variants: ['skyline_diorama'], pick: 'random' },
    unlock: { kind: 'photoLabel', label: 'city' },
    hint: 'Photograph a city skyline',
    labelTemplate: 'A city, framed',
  },
  {
    id: 'sea_glass',
    name: 'Sea Glass Bowl',
    rarity: 'uncommon',
    artBatch: 'B6',
    art: { variants: ['sea_glass'], pick: 'random' },
    unlock: { kind: 'photoLabel', label: 'beach' },
    hint: 'Photograph the sea',
    labelTemplate: 'A day by the water',
  },
  {
    id: 'peak_banner',
    name: 'Peak Banner',
    rarity: 'uncommon',
    artBatch: 'B6',
    art: { variants: ['peak_banner'], pick: 'random' },
    unlock: { kind: 'photoLabel', label: 'mountains' },
    hint: 'Photograph the mountains',
    labelTemplate: 'Mountains on the horizon',
  },
  {
    id: 'buskers_case',
    name: 'Busker’s Case',
    rarity: 'uncommon',
    artBatch: 'B6',
    art: { variants: ['buskers_case'], pick: 'random' },
    unlock: { kind: 'photoLabel', label: 'creative' },
    hint: 'Photograph your craft — an instrument, a canvas…',
    labelTemplate: 'A maker’s day',
  },
  {
    id: 'forest_heart',
    name: 'Forest Heart',
    rarity: 'uncommon',
    art: { variants: ['forest_heart'], pick: 'random' },
    unlock: { kind: 'photoLabel', label: 'forest' },
    hint: 'Photograph the deep woods',
    labelTemplate: 'The forest, kept',
  },
  {
    id: 'gathering_table',
    name: 'Gathering Table',
    rarity: 'uncommon',
    art: { variants: ['gathering_table'], pick: 'random' },
    unlock: { kind: 'metric', metric: 'photoFaces', gte: 3 },
    hint: 'Photograph a gathering of friends',
    labelTemplate: 'A table full of company',
  },
  {
    id: 'moonpetal_bed',
    name: 'Moonpetal Bed',
    rarity: 'rare',
    art: { variants: ['moonpetal_bed'], pick: 'random' },
    unlock: { kind: 'streak', of: { kind: 'metric', metric: 'goodSleep', gte: 1 }, days: 7 },
    hint: 'Sleep well 7 nights running',
    labelTemplate: 'A week of good nights',
  },
  {
    id: 'bound_volume',
    name: 'Bound Volume Plinth',
    rarity: 'uncommon',
    art: { variants: ['bound_volume'], pick: 'random' },
    unlock: { kind: 'studioMediaType', mediaType: 'book' },
    hint: 'Keep your first book',
    labelTemplate: '{studioLine}',
  },
  {
    id: 'library_totem',
    name: 'Stacked Library Totem',
    rarity: 'rare',
    art: { variants: ['library_totem'], pick: 'random', sizeScale: 1.15 },
    unlock: { kind: 'lifetimeCount', of: { kind: 'studioMediaType', mediaType: 'book' }, gte: 10 },
    hint: 'Keep books on 10 days',
    labelTemplate: 'Ten days of books',
  },
  {
    id: 'reel_lantern',
    name: 'Reel Lantern',
    rarity: 'uncommon',
    art: { variants: ['reel_lantern'], pick: 'random' },
    unlock: { kind: 'studioMediaType', mediaType: 'film' },
    hint: 'Keep your first film',
    labelTemplate: '{studioLine}',
  },
  {
    id: 'marquee_sign',
    name: 'Marquee Sign',
    rarity: 'rare',
    art: { variants: ['marquee_sign'], pick: 'random' },
    unlock: { kind: 'lifetimeCount', of: { kind: 'studioMediaType', mediaType: 'film' }, gte: 25 },
    hint: 'Keep films on 25 days',
    labelTemplate: 'Twenty-five nights at the movies',
  },
  {
    id: 'melody_chime',
    name: 'Melody Chime',
    rarity: 'uncommon',
    art: { variants: ['melody_chime'], pick: 'random' },
    unlock: { kind: 'studioMediaType', mediaType: 'music' },
    hint: 'Keep a piece of music',
    labelTemplate: '{studioLine}',
  },
  {
    id: 'leap_clock',
    name: 'Leap Day Clock',
    rarity: 'legendary',
    artBatch: 'B11',
    art: { variants: ['leap_clock'], pick: 'random', sizeScale: 1.2 },
    unlock: { kind: 'calendar', window: 'leapDay' },
    hint: 'Live a February 29th',
    labelTemplate: 'A day that almost never happens',
  },
  {
    id: 'harmony_prism',
    name: 'Harmony Prism',
    rarity: 'epic',
    art: { variants: ['harmony_prism'], pick: 'random', sizeScale: 1.2 },
    unlock: {
      kind: 'lifetimeCount',
      of: {
        kind: 'all',
        of: [
          { kind: 'metric', metric: 'reflections', gte: 1 },
          { kind: 'metric', metric: 'notes', gte: 1 },
          { kind: 'metric', metric: 'foodMoments', gte: 1 },
          { kind: 'metric', metric: 'sleepLogged', gte: 1 },
        ],
      },
      gte: 7,
    },
    hint: 'Live seven days in full',
    labelTemplate: 'Seven days lived in full',
  },
  // Food journey (docs §5 I) — cuisine tag + food-type signals.
  {
    id: 'cuisine_lantern',
    name: 'Cuisine Lantern',
    rarity: 'uncommon',
    // One lantern per cuisine family — variants INDEXED BY CUISINE_FAMILIES
    // order (the perSubject lane picks by subject, not by hash).
    art: {
      variants: [
        'cuisine_lantern_italian',
        'cuisine_lantern_japanese',
        'cuisine_lantern_chinese',
        'cuisine_lantern_indian',
        'cuisine_lantern_mexican',
        'cuisine_lantern_middle_eastern',
        'cuisine_lantern_french',
        'cuisine_lantern_greek',
      ],
      pick: 'level',
    },
    repeat: 'perSubject',
    unlock: { kind: 'cuisine' },
    hint: 'Taste a cuisine for the first time',
    labelTemplate: '{cuisineLine}',
  },
  {
    id: 'hearth_pot',
    name: 'Hearth Pot',
    rarity: 'rare',
    art: { variants: ['hearth_pot'], pick: 'random' },
    unlock: { kind: 'streak', of: { kind: 'metric', metric: 'homeCookedMeals', gte: 1 }, days: 7 },
    hint: 'Cook at home 7 days running',
    labelTemplate: 'A week of home cooking',
  },
  {
    id: 'sugar_pagoda',
    name: 'Sugar Pagoda',
    rarity: 'uncommon',
    art: { variants: ['sugar_pagoda'], pick: 'random' },
    unlock: { kind: 'lifetimeCount', of: { kind: 'metric', metric: 'desserts', gte: 1 }, gte: 5 },
    hint: 'Savour 5 dessert days',
    labelTemplate: 'Five sweet days',
  },
  {
    id: 'grocers_stand',
    name: "Grocer's Stand",
    rarity: 'uncommon',
    art: { variants: ['grocers_stand'], pick: 'random' },
    unlock: {
      kind: 'all',
      of: [
        { kind: 'placeCategory', category: 'market' },
        { kind: 'metric', metric: 'foodMoments', gte: 1 },
      ],
    },
    hint: 'Bring home something from a market',
    labelTemplate: 'A market day, savoured',
  },
];

// Everyday bloom commons — the green pool the bloom lane draws from. Variant
// families come from the B1 grid batch (4 fresh looks per species, picked
// deterministically per grant id); the birch keeps its bespoke BiRefNet art.
const BLOOM_PINE_VARIANTS = ['bloom_pine_1', 'bloom_pine_2', 'bloom_pine_3', 'bloom_pine_4'];
const BLOOM_OAK_VARIANTS = ['bloom_oak_1', 'bloom_oak_2', 'bloom_oak_3', 'bloom_oak_4'];
const BLOOM_BIRCH_VARIANTS = ['decor_4', 'bloom_birch_1', 'bloom_birch_2', 'bloom_birch_3', 'bloom_birch_4'];
const BLOOM_BLOSSOM_VARIANTS = ['bloom_blossom_1', 'bloom_blossom_2', 'bloom_blossom_3', 'bloom_blossom_4'];
const DISCOVERY_SAPLING_VARIANTS = [
  ...BLOOM_PINE_VARIANTS,
  ...BLOOM_OAK_VARIANTS,
  ...BLOOM_BIRCH_VARIANTS,
  ...BLOOM_BLOSSOM_VARIANTS,
];

export const BLOOM_COMMONS: WorldObjectDefinition[] = [
  { id: 'bloom_pine', name: 'Pine Tree', art: { variants: BLOOM_PINE_VARIANTS, pick: 'random' } },
  { id: 'bloom_oak', name: 'Oak Tree', art: { variants: BLOOM_OAK_VARIANTS, pick: 'random' } },
  { id: 'bloom_birch', name: 'Birch Tree', art: { variants: BLOOM_BIRCH_VARIANTS, pick: 'random' } },
  { id: 'bloom_blossom', name: 'Blossom Tree', art: { variants: BLOOM_BLOSSOM_VARIANTS, pick: 'random' } },
  { id: 'bloom_shrub', name: 'Garden Shrub', art: { variants: ['bloom_shrub_1', 'bloom_shrub_2', 'bloom_shrub_3', 'bloom_shrub_4'], pick: 'random' } },
  { id: 'bloom_fern', name: 'Fern', art: { variants: ['bloom_fern_1', 'bloom_fern_2', 'bloom_fern_3', 'bloom_fern_4'], pick: 'random' } },
  { id: 'bloom_wildflowers', name: 'Wildflowers', art: { variants: ['bloom_wildflowers_1', 'bloom_wildflowers_2', 'bloom_wildflowers_3', 'bloom_wildflowers_4'], pick: 'random' } },
  { id: 'bloom_mushrooms', name: 'Mushroom Cluster', art: { variants: ['bloom_mushrooms_1', 'bloom_mushrooms_2', 'bloom_mushrooms_3', 'bloom_mushrooms_4'], pick: 'random' } },
  { id: 'bloom_planter', name: 'Garden Planter', art: { variants: ['bloom_planter_1', 'bloom_planter_2', 'bloom_planter_3', 'bloom_planter_4'], pick: 'random' } },
  // B1 expansion species (docs §5 B).
  { id: 'bloom_lavender', name: 'Lavender Patch', art: { variants: ['bloom_lavender_1', 'bloom_lavender_2', 'bloom_lavender_3', 'bloom_lavender_4'], pick: 'random' } },
  { id: 'bloom_butterfly_bush', name: 'Butterfly Bush', art: { variants: ['bloom_butterfly_bush_1', 'bloom_butterfly_bush_2', 'bloom_butterfly_bush_3', 'bloom_butterfly_bush_4'], pick: 'random' } },
  { id: 'bloom_cattails', name: 'Cattail Cluster', art: { variants: ['bloom_cattails_1', 'bloom_cattails_2', 'bloom_cattails_3', 'bloom_cattails_4'], pick: 'random' } },
  { id: 'bloom_snowdrops', name: 'Snowdrop Bed', art: { variants: ['bloom_snowdrops_1', 'bloom_snowdrops_2', 'bloom_snowdrops_3', 'bloom_snowdrops_4'], pick: 'random' } },
  { id: 'bloom_bird_bath', name: 'Bird Bath', art: { variants: ['bloom_bird_bath_1', 'bloom_bird_bath_2', 'bloom_bird_bath_3', 'bloom_bird_bath_4'], pick: 'random' } },
  { id: 'bloom_stone_lantern', name: 'Stone Lantern', art: { variants: ['bloom_stone_lantern_1', 'bloom_stone_lantern_2', 'bloom_stone_lantern_3', 'bloom_stone_lantern_4'], pick: 'random' } },
  { id: 'bloom_pumpkin_patch', name: 'Pumpkin Patch', art: { variants: ['bloom_pumpkin_patch_1', 'bloom_pumpkin_patch_2', 'bloom_pumpkin_patch_3', 'bloom_pumpkin_patch_4'], pick: 'random' } },
];

// Grove merge — the tray sink (docs §9.2): three identical unplanted commons
// fuse into one denser, uncommon "grove" of the same species. One grove art
// per species (grove_<species> keys, grove grid batch).
export const GROVE_MERGE_COUNT = 3;

export type GroveUpgrade = { speciesId: string; assetKey: string; name: string };

export function groveForSpecies(speciesId: string): GroveUpgrade | null {
  const species = BLOOM_COMMONS.find((definition) => definition.id === speciesId);
  if (!species) return null;
  return {
    speciesId,
    assetKey: `grove_${speciesId.replace(/^bloom_/, '')}`,
    name: `${species.name} Grove`,
  };
}

// Which bloom species a granted gift belongs to, resolved from its art key
// (gifts store only the picked variant).
export function bloomSpeciesForAssetKey(assetKey: string): string | null {
  for (const species of BLOOM_COMMONS) {
    if (species.art.variants.includes(assetKey)) return species.id;
  }
  return null;
}

// Discovery keepsakes by rarity tier (fallbacks for unmapped discoveries).
// Common discoveries use the tree/sapling family pool so generic discoveries
// do not all collapse into the same birch sprite.
export const DISCOVERY_TIER_KEEPSAKES: Record<'common' | 'rare' | 'epic' | 'legendary', WorldObjectDefinition> = {
  common: { id: 'discovery_sapling', name: 'Discovery Sapling', art: { variants: DISCOVERY_SAPLING_VARIANTS, pick: 'random' } },
  rare: { id: 'discovery_lantern', name: 'Honour Lantern', art: { variants: ['decor_12'], pick: 'random', sizeScale: 1.15 } },
  epic: { id: 'discovery_stone', name: 'Milestone Stone', art: { variants: ['monument_stone'], pick: 'random', sizeScale: 1.15 } },
  legendary: { id: 'discovery_shard', name: 'Monument Shard', art: { variants: ['monument_shard'], pick: 'random', sizeScale: 1.3 } },
};

// ---------------------------------------------------------------------------
// Variant picking — deterministic per seed (same seed → same art forever, so
// re-syncing a grant never reshuffles what the player already owns).
// ---------------------------------------------------------------------------

export function hashSeed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function pickFromVariants(variants: string[], seed: string): string {
  if (variants.length <= 1) return variants[0];
  return variants[hashSeed(seed) % variants.length];
}

export function pickVariant(definition: WorldObjectDefinition, seed: string): string {
  return pickFromVariants(definition.art.variants, seed);
}
